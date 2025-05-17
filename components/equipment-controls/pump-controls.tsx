import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { useToast } from "@/components/ui/use-toast"
import { useSocket } from "@/lib/socket-context"
import { useAuth } from "@/lib/auth-context"
import { logAuditEvent } from "@/lib/audit-logger"
import { ref, type Database, onValue, off, type DataSnapshot } from "firebase/database"
import { secondaryDb } from "@/lib/secondary-firebase"
import { db } from "@/lib/firebase"
import { doc, updateDoc } from "firebase/firestore"
import { CheckCircle, XCircle, Clock } from 'lucide-react'
import { z } from "zod"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface PumpControlsProps {
  equipment: {
    id: string
    locationId: string
    locationName: string
    controls: ControlValues
    status: string
    name: string
    type: string
  }
  metrics?: {
    [key: string]: any
  }
  values?: ControlValues
  onChange?: (key: string, value: any) => void
}

interface ControlValues {
  pumpEnable: boolean
  operationMode: string
  speedSetpoint: number
  controlMode: string
  autoAlternation: boolean
  pressureSetpoint: number
  flowSetpoint: number
  minSpeed: number
  maxSpeed: number
  flowSensorEnable: boolean
  rampUpTime: number
  rampDownTime: number
  dryRunProtection: boolean
  autoRestart: boolean
  restartDelay: number
  maxRestartAttempts: number
  customLogicEnabled?: boolean
}

interface ControlHistoryEntry {
  id: string
  commandType?: string
  sequentialId?: string
  command: string
  source: string
  status: string
  timestamp: number
  value: any
  previousValue?: any
  mode?: string
  userId: string
  userName: string
  details: string
}

// Define Zod schema for ControlValues for data validation
const ControlValuesSchema = z.object({
  pumpEnable: z.boolean(),
  operationMode: z.string(),
  speedSetpoint: z.number(),
  controlMode: z.string(),
  autoAlternation: z.boolean(),
  pressureSetpoint: z.number(),
  flowSetpoint: z.number(),
  minSpeed: z.number(),
  maxSpeed: z.number(),
  flowSensorEnable: z.boolean(),
  rampUpTime: z.number(),
  rampDownTime: z.number(),
  dryRunProtection: z.boolean(),
  autoRestart: z.boolean(),
  restartDelay: z.number(),
  maxRestartAttempts: z.number(),
  customLogicEnabled: z.boolean().optional()
})

export function PumpControls({ equipment, metrics, values, onChange }: PumpControlsProps) {
  // Add loading state
  const [isLoading, setIsLoading] = useState(true)
  // Add autoSync state
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true)

  const defaultControlValues: ControlValues = {
    pumpEnable: false,
    operationMode: "auto",
    speedSetpoint: 75,
    controlMode: "constant-speed",
    autoAlternation: false,
    pressureSetpoint: 45,
    flowSetpoint: 100,
    minSpeed: 20,
    maxSpeed: 100,
    flowSensorEnable: false,
    rampUpTime: 30,
    rampDownTime: 30,
    dryRunProtection: true,
    autoRestart: false,
    restartDelay: 5,
    maxRestartAttempts: 3,
    customLogicEnabled: false
  }

  // --- States ---
  const [controlValues, setControlValues] = useState<ControlValues>({
    ...defaultControlValues,
    ...(equipment?.controls || {}),
    ...(values || {}),
  })

  const [previousControlValues, setPreviousControlValues] = useState<ControlValues>({
    ...defaultControlValues,
    ...(equipment?.controls || {}),
  })

  const [pendingCommands, setPendingCommands] = useState<{
    [key: string]: boolean
  }>({})
  const [controlHistory, setControlHistory] = useState<ControlHistoryEntry[]>([])
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const { socket } = useSocket()
  const { toast } = useToast()
  const { user } = useAuth()
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false)

  // Add initialization effect
  useEffect(() => {
    // Start in loading state and wait for data
    if (!equipment?.locationId || !equipment?.id || !secondaryDb) {
      // If we don't have required data, set loading to false after a short delay
      const timer = setTimeout(() => {
        setIsLoading(false)
      }, 1000)
      return () => clearTimeout(timer)
    }

    // We'll keep loading true until we get data from the database
    const controlsRef = ref(secondaryDb as Database, `control_history/${equipment.locationId}/${equipment.id}`)

    const handleInitialDataLoad = async (snapshot: DataSnapshot) => {
      try {
        if (snapshot.exists()) {
          const data = snapshot.val()
          if (data) {
            // Process the data to get the latest values for each control
            const latestControls: { [key: string]: any } = {}

            // Iterate through each command type
            Object.entries(data).forEach(([commandType, commandsObj]) => {
              if (commandsObj && typeof commandsObj === "object") {
                // Get all commands for this type
                const commands = Object.values(commandsObj)

                // Sort by timestamp descending to get the latest first
                commands.sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0))

                // Get the latest command for this type
                const latestCommand = commands[0]

                if (latestCommand) {
                  // Convert command type to control key (e.g., "temperature_setpoint" -> "temperatureSetpoint")
                  const controlKey = commandType
                    .replace(/^(save|update)_/, "")
                    .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())

                  // Store the latest value
                  latestControls[controlKey] = latestCommand.value
                }
              }
            })

            // Update control values with the latest values from Firebase
            setControlValues((prev) => {
              // Create a new object with the previous values and the latest values from Firebase
              const updatedValues = {
                ...prev,
                ...latestControls,
              }

              return updatedValues
            })

            // Also update previous control values to match
            setPreviousControlValues((prev) => ({
              ...prev,
              ...latestControls,
            }))
          }
        }
      } catch (error) {
        console.error("Error processing control history:", error)
      } finally {
        // Once we get data, set loading to false
        setIsLoading(false)
        // Unsubscribe from this initial load listener
        off(controlsRef, "value", handleInitialDataLoad)
      }
    }

    // Listen for the initial data load
    onValue(controlsRef, handleInitialDataLoad)

    // Set a fallback timer in case data never loads
    const fallbackTimer = setTimeout(() => {
      setIsLoading(false)
    }, 5000)

    return () => {
      clearTimeout(fallbackTimer)
      off(controlsRef, "value", handleInitialDataLoad)
    }
  }, [equipment?.locationId, equipment?.id, secondaryDb])

  // Add this helper function at the top of your component
  const isEqual = (obj1: any, obj2: any) => {
    return JSON.stringify(obj1) === JSON.stringify(obj2)
  }

  // --- RTDB History Updates ---
  useEffect(() => {
    if (!equipment?.locationId || !equipment?.id) return

    const fetchControlHistory = async () => {
      try {
        const response = await fetch(
          `/api/control-history?locationId=${equipment.locationId}&equipmentId=${equipment.id}`,
        )

        if (!response.ok) {
          throw new Error(`Failed to fetch history: ${response.statusText}`)
        }

        const data = await response.json()
        setControlHistory(data)
      } catch (error) {
        console.error("Error fetching control history:", error)
        toast({
          title: "Error",
          description: "Failed to fetch history",
          variant: "destructive",
        })
      }
    }

    // Initial fetch
    fetchControlHistory()

    // Set up interval for periodic updates
    const intervalId = setInterval(fetchControlHistory, 30000)

    return () => {
      clearInterval(intervalId)
    }
  }, [equipment.locationId, equipment.id, toast])

  // Replace the RTDB Control Values Update useEffect with this InfluxDB version
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!equipment?.locationId || !equipment?.id) return

    const fetchControlValues = async () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }

      debounceTimeoutRef.current = setTimeout(async () => {
        try {
          const response = await fetch(
            `/api/control-values?locationId=${equipment.locationId}&equipmentId=${equipment.id}`,
          )

          if (!response.ok) {
            throw new Error(`Failed to fetch control values: ${response.statusText}`)
          }

          const latestControls = await response.json()

          setControlValues((prev) => ({
            ...prev,
            ...latestControls,
          }))
        } catch (error) {
          console.error("Error fetching control values:", error)
          toast({
            title: "Error",
            description: "Failed to fetch control values",
            variant: "destructive",
          })
        } finally {
          debounceTimeoutRef.current = null
        }
      }, 500) // Debounce delay of 500ms
    }

    // Initial fetch
    fetchControlValues()

    // Set up interval for periodic updates
    const intervalId = setInterval(fetchControlValues, 10000)

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
      clearInterval(intervalId)
    }
  }, [equipment.locationId, equipment.id, toast])

  // --- Audit Logging ---
  const logControlEvent = async (details: string, changes?: any) => {
    if (!hasValidLocationData()) {
      console.warn("Cannot log event: Missing location data")
      return
    }

    try {
      await logAuditEvent({
        action: "update",
        userId: user?.id || "",
        userName: user?.name || "",
        locationId: equipment.locationId,
        locationName: equipment.locationName,
        details,
        path: `/equipment/${equipment.id}/controls`,
        ...(changes && { changes }),
      })
    } catch (error) {
      console.error("Failed to log audit event:", error)
    }
  }

  // --- Socket Listeners ---
  useEffect(() => {
    if (socket) {
      socket.on("command_complete", (data: { commandId: string; status: string }) => {
        setPendingCommands((prev) => ({ ...prev, [data.commandId]: false }))
        toast({
          title: "Command Complete",
          description: `Control update successful`,
          className: "bg-teal-50 border-teal-200",
        })
      })

      socket.on("command_failed", (data: { commandId: string; error: string }) => {
        setPendingCommands((prev) => ({ ...prev, [data.commandId]: false }))
        toast({
          title: "Command Failed",
          description: data.error,
          variant: "destructive",
        })
      })

      return () => {
        socket.off("command_complete")
        socket.off("command_failed")
      }
    }
  }, [socket, toast])

  // --- Send Control Command ---
  // Memoize the sendControlCommand function
  const sendControlCommand = useCallback(
    async (command: string, value: any, metadata?: any) => {
      const commandId = Date.now().toString()

      try {
        console.log(`Sending control command: ${command}`, { value, metadata })
        setPendingCommands((prev) => ({ ...prev, [commandId]: true }))

        // Validate ControlValues using Zod
        try {
          const validationObject = {
            ...controlValues,
            pumpEnable: controlValues.pumpEnable === undefined ? false : controlValues.pumpEnable,
          }
          console.log("Validating controlValues:", JSON.stringify(validationObject, null, 2))
          ControlValuesSchema.parse(validationObject)
        } catch (error) {
          console.error("ControlValues validation failed:", error)
          toast({
            title: "Validation Error",
            description: "Control settings failed validation. Check your input values.",
            variant: "destructive",
          })
          return false
        }

        // Extract command type
        const commandType = command.replace("update_", "")
        const now = new Date()
        const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
          now.getDate(),
        ).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(
          2,
          "0",
        )}-${String(now.getSeconds()).padStart(2, "0")}`

        // Format data for InfluxDB - send to API endpoint instead of Firebase
        const commandData = {
          command,
          commandType,
          equipmentId: equipment.id,
          locationId: equipment.locationId,
          timestamp: Date.now(),
          formattedTimestamp: formattedDate,
          value: value ?? null,
          previousValue: metadata?.previousValue ?? null,
          mode: metadata?.mode ?? null,
          source: "web_dashboard",
          status: "pending",
          userId: user?.id || "unknown",
          userName: user?.name || "unknown",
          details: `${getCommandDescription(command)} changed to ${value}`,
        }

        console.log("Sending command data to API:", commandData)

        // Send to API endpoint that will handle the InfluxDB writing
        const response = await fetch("/api/control-commands", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(commandData),
        })

        console.log("API response status:", response.status)

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`Failed to send command: ${response.status} ${response.statusText}`, errorText)
          throw new Error(`Failed to send command: ${response.statusText}`)
        }

        const responseData = await response.json()
        console.log("API response data:", responseData)

        // Always write to Firestore for all commands to maintain compatibility
        try {
          if (db && equipment?.id) {
            const equipmentRef = doc(db, "equipment", equipment.id)

            // For complete state updates, write the entire object
            if (command === "update_complete_state") {
              await updateDoc(equipmentRef, {
                controls: value,
                lastUpdated: new Date(),
              })
            }
            // For individual control updates, write just that property
            else {
              const controlKey = command.replace("update_", "")
              await updateDoc(equipmentRef, {
                [`controls.${controlKey}`]: value,
                lastUpdated: new Date(),
              })
            }

            console.log(`Control value ${command} saved to Firestore`)
          }
        } catch (firebaseError) {
          console.error("Error writing to Firestore:", firebaseError)
          // Don't throw here - we want to continue even if Firestore fails
        }

        // Audit logging
        if (equipment && equipment.locationId && equipment.locationName) {
          await logControlEvent(`Changed ${command} to ${value}`, { [command]: value })
        }

        return true
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred"
        console.error("Failed to send control command:", error)

        if (equipment && equipment.locationId && equipment.locationName) {
          await logControlEvent(`Failed to change ${command} to ${value}: ${errorMessage}`)
        }

        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        })
        return false
      } finally {
        setPendingCommands((prev) => ({ ...prev, [commandId]: false }))
      }
    },
    [equipment.id, equipment.locationId, controlValues, user, toast, equipment, db]
  )

  // --- Role Checking ---
  // Check if we have valid location data
  const hasValidLocationData = () => {
    return Boolean(equipment && equipment.locationId && equipment.locationName)
  }

  // --- Control Handlers ---
  // Add this helper function to send the complete state
  const sendCompleteState = async (updatedValues: ControlValues) => {
    try {
      console.log("Sending complete state:", updatedValues)

      // Instead of sending the entire state as one command, send individual updates
      // This avoids the InfluxDB "No fields were provided" error
      const promises = []

      // Send each property individually, only if it has changed
      for (const [key, value] of Object.entries(updatedValues)) {
        // Skip complex objects
        if (typeof value !== "object") {
          // Only send if the value has changed
          if (previousControlValues[key as keyof ControlValues] !== value) {
            console.log(`Sending update for ${key}: ${value}`)

            // Convert key to command format (e.g., "fanSpeed" -> "update_fan_speed")
            const commandKey = `update_${key.replace(/([A-Z])/g, "_$1").toLowerCase()}`

            promises.push(
              sendControlCommand(commandKey, value, {
                previousValue: previousControlValues[key as keyof ControlValues],
              })
            )
          }
        }
      }

      // Wait for all individual updates to complete
      const results = await Promise.all(promises)

      // If any of the updates succeeded, consider it a success
      return results.some((result) => result === true)
    } catch (error) {
      console.error("Error sending complete state:", error)
      return false
    }
  }

  // Function to get command description
  const getCommandDescription = (command: string): string => {
    switch (command) {
      case "update_pump_enable":
        return "Pump Enable"
      case "update_operation_mode":
        return "Operation Mode"
      case "update_speed_setpoint":
        return "Speed Setpoint"
      case "update_control_mode":
        return "Control Mode"
      case "update_auto_alternation":
        return "Auto Alternation"
      case "update_pressure_setpoint":
        return "Pressure Setpoint"
      case "update_flow_setpoint":
        return "Flow Setpoint"
      case "update_min_speed":
        return "Minimum Speed"
      case "update_max_speed":
        return "Maximum Speed"
      case "update_flow_sensor_enable":
        return "Flow Sensor Enable"
      case "update_ramp_up_time":
        return "Ramp Up Time"
      case "update_ramp_down_time":
        return "Ramp Down Time"
      case "update_dry_run_protection":
        return "Dry Run Protection"
      case "update_auto_restart":
        return "Auto Restart"
      case "update_restart_delay":
        return "Restart Delay"
      case "update_max_restart_attempts":
        return "Maximum Restart Attempts"
      default:
        return command
    }
  }

  // Handle value changes
  const handleValueChange = async (key: string, value: any) => {
    // For numeric values, ensure we don't set NaN
    if (typeof value === "number" && isNaN(value)) {
      console.warn(`Received NaN for ${key}, using default value instead`)

      // Use appropriate default values based on the field
      if (key.includes("Speed")) {
        value = 75 // Default speed
      } else if (key.includes("Setpoint")) {
        value = key.includes("pressure") ? 45 : 100 // Default pressure or flow setpoint
      } else if (key.includes("Time")) {
        value = 30 // Default time
      } else {
        value = 0 // Generic default
      }
    }

    // Update local state immediately for responsive UI
    const updatedValues = {
      ...controlValues,
      [key]: value,
    }

    setControlValues(updatedValues)
    setHasUnsavedChanges(true)

    // If onChange is provided, call it
    if (onChange) {
      onChange(key, value)
    }
  }

  // Handle pump enable toggle
  const handlePumpEnable = async (enabled: boolean) => {
    // Update local state immediately
    const updatedValues = {
      ...controlValues,
      pumpEnable: enabled,
    }

    setControlValues(updatedValues)

    // Send the complete state
    const success = await sendCompleteState(updatedValues)

    if (success) {
      setHasUnsavedChanges(true)
    }
  }

  // Modify the handleApplyChanges function
  const shouldUpdatePreviousValues = useRef(false)

  const handleApplyChanges = async () => {
    try {
      setIsSubmitting(true)
      console.log("Apply changes button clicked")

      // Set the ref to true before applying changes
      shouldUpdatePreviousValues.current = true

      // Define simple properties that can be sent directly
      const simpleProps = [
        "pumpEnable",
        "operationMode",
        "speedSetpoint",
        "controlMode",
        "autoAlternation",
        "pressureSetpoint",
        "flowSetpoint",
        "minSpeed",
        "maxSpeed",
        "flowSensorEnable",
        "rampUpTime",
        "rampDownTime",
        "dryRunProtection",
        "autoRestart",
        "restartDelay",
        "maxRestartAttempts",
      ]

      let successCount = 0

      // Send individual updates for each property
      for (const prop of simpleProps) {
        const key = prop as keyof ControlValues
        // Check if value has changed
        if (controlValues[key] !== previousControlValues[key]) {
          // Convert camelCase to snake_case for command name
          const commandKey = `update_${prop.replace(/([A-Z])/g, "_$1").toLowerCase()}`

          const success = await sendControlCommand(commandKey, controlValues[key], {
            previousValue: previousControlValues[key],
          })

          if (success) {
            successCount++
          }
        }
      }

      // Update previous values and show success message
      if (successCount > 0) {
        setPreviousControlValues({ ...controlValues })
        setHasUnsavedChanges(false)

        toast({
          title: "Controls Applied",
          description: `Successfully applied ${successCount} control updates`,
          className: "bg-teal-50 border-teal-200",
        })
      } else {
        toast({
          title: "No Changes",
          description: "No control values were changed",
          className: "bg-blue-50 border-blue-200",
        })
      }
    } catch (error) {
      console.error("Error in handleApplyChanges:", error)
      toast({
        title: "Save Error",
        description: "Failed to apply control settings",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Update the handleDeleteCommand function to work with the new structure
  const handleDeleteCommand = async (commandId: string, commandType: string, sequentialId: string) => {
    if (!equipment || !equipment.locationId || !equipment.id) return

    try {
      // Delete the command via API endpoint
      const response = await fetch("/api/delete-command", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          commandId,
          commandType,
          sequentialId,
          equipmentId: equipment.id,
          locationId: equipment.locationId,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to delete command: ${response.statusText}`)
      }

      // Remove from local state
      const updatedHistory = controlHistory.filter((item) => item.id !== commandId)
      setControlHistory(updatedHistory)

      toast({
        title: "Command Deleted",
        description: "The command has been removed from history",
        className: "bg-teal-50 border-teal-200",
      })
    } catch (error) {
      console.error("Failed to delete command:", error)
      toast({
        title: "Error",
        description: "Failed to delete command",
        variant: "destructive",
      })
    }
  }

  // Add this useEffect to update previousControlValues whenever controlValues changes
  useEffect(() => {
    if (shouldUpdatePreviousValues.current) {
      setPreviousControlValues(controlValues)
      shouldUpdatePreviousValues.current = false
    }
  }, [controlValues])

  // Function to render the status icon for a command
  const renderStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />
      case "pending":
        return <Clock className="h-4 w-4 text-amber-500" />
      case "acknowledged":
        return <CheckCircle className="h-4 w-4 text-blue-500" />
      case "deleted":
        return <XCircle className="h-4 w-4 text-gray-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-lg">Loading controls...</p>
        </div>
      ) : (
        <>
          <Tabs defaultValue="general">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="flow">Flow Control</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 pt-4">
              <Card>
                <CardHeader>
                  <CardTitle>General Controls</CardTitle>
                  <CardDescription>Basic operation controls for the pump</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="pump-enable">Pump Enable</Label>
                    <Switch
                      id="pump-enable"
                      checked={controlValues.pumpEnable === true}
                      onCheckedChange={(checked) => handlePumpEnable(checked)}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="operation-mode">Operation Mode</Label>
                      <select
                        id="operation-mode"
                        className="flex h-10 w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={controlValues.operationMode || "auto"}
                        onChange={(e) => handleValueChange("operationMode", e.target.value)}
                      >
                        <option value="auto">Auto</option>
                        <option value="manual">Manual</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="standby">Standby</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="speed-setpoint">Speed Setpoint (%)</Label>
                      <span className="text-sm">{controlValues.speedSetpoint || 75}%</span>
                    </div>
                    <Slider
                      id="speed-setpoint"
                      min={0}
                      max={100}
                      step={1}
                      value={[controlValues.speedSetpoint || 75]}
                      onValueChange={(value) => handleValueChange("speedSetpoint", value[0])}
                      disabled={!controlValues.pumpEnable}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="control-mode">Control Mode</Label>
                      <select
                        id="control-mode"
                        className="flex h-10 w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={controlValues.controlMode || "constant-speed"}
                        onChange={(e) => handleValueChange("controlMode", e.target.value)}
                        disabled={!controlValues.pumpEnable}
                      >
                        <option value="constant-speed">Constant Speed</option>
                        <option value="constant-pressure">Constant Pressure</option>
                        <option value="constant-flow">Constant Flow</option>
                        <option value="proportional-pressure">Proportional Pressure</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="auto-alternation">Auto Alternation</Label>
                    <Switch
                      id="auto-alternation"
                      checked={controlValues.autoAlternation === true}
                      onCheckedChange={(checked) => handleValueChange("autoAlternation", checked)}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="flow" className="space-y-4 pt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Flow Control</CardTitle>
                  <CardDescription>Flow and pressure control settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="pressure-setpoint">Pressure Setpoint (PSI)</Label>
                      <span className="text-sm">{controlValues.pressureSetpoint || 45} PSI</span>
                    </div>
                    <Slider
                      id="pressure-setpoint"
                      min={0}
                      max={100}
                      step={1}
                      value={[controlValues.pressureSetpoint || 45]}
                      onValueChange={(value) => handleValueChange("pressureSetpoint", value[0])}
                      disabled={
                        !controlValues.pumpEnable ||
                        (controlValues.controlMode !== "constant-pressure" &&
                          controlValues.controlMode !== "proportional-pressure")
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="flow-setpoint">Flow Setpoint (GPM)</Label>
                      <span className="text-sm">{controlValues.flowSetpoint || 100} GPM</span>
                    </div>
                    <Slider
                      id="flow-setpoint"
                      min={0}
                      max={500}
                      step={5}
                      value={[controlValues.flowSetpoint || 100]}
                      onValueChange={(value) => handleValueChange("flowSetpoint", value[0])}
                      disabled={!controlValues.pumpEnable || controlValues.controlMode !== "constant-flow"}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="min-speed">Minimum Speed (%)</Label>
                      <span className="text-sm">{controlValues.minSpeed || 20}%</span>
                    </div>
                    <Slider
                      id="min-speed"
                      min={0}
                      max={50}
                      step={1}
                      value={[controlValues.minSpeed || 20]}
                      onValueChange={(value) => handleValueChange("minSpeed", value[0])}
                      disabled={!controlValues.pumpEnable}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="max-speed">Maximum Speed (%)</Label>
                      <span className="text-sm">{controlValues.maxSpeed || 100}%</span>
                    </div>
                    <Slider
                      id="max-speed"
                      min={50}
                      max={100}
                      step={1}
                      value={[controlValues.maxSpeed || 100]}
                      onValueChange={(value) => handleValueChange("maxSpeed", value[0])}
                      disabled={!controlValues.pumpEnable}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="flow-sensor">Flow Sensor Enable</Label>
                    <Switch
                      id="flow-sensor"
                      checked={controlValues.flowSensorEnable === true}
                      onCheckedChange={(checked) => handleValueChange("flowSensorEnable", checked)}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="advanced" className="space-y-4 pt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Advanced Settings</CardTitle>
                  <CardDescription>Advanced pump control settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="ramp-up-time">Ramp Up Time (seconds)</Label>
                      <span className="text-sm">{controlValues.rampUpTime || 30} sec</span>
                    </div>
                    <Slider
                      id="ramp-up-time"
                      min={0}
                      max={120}
                      step={5}
                      value={[controlValues.rampUpTime || 30]}
                      onValueChange={(value) => handleValueChange("rampUpTime", value[0])}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="ramp-down-time">Ramp Down Time (seconds)</Label>
                      <span className="text-sm">{controlValues.rampDownTime || 30} sec</span>
                    </div>
                    <Slider
                      id="ramp-down-time"
                      min={0}
                      max={120}
                      step={5}
                      value={[controlValues.rampDownTime || 30]}
                      onValueChange={(value) => handleValueChange("rampDownTime", value[0])}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="dry-run-protection">Dry Run Protection</Label>
                    <Switch
                      id="dry-run-protection"
                      checked={controlValues.dryRunProtection === true}
                      onCheckedChange={(checked) => handleValueChange("dryRunProtection", checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="auto-restart">Auto Restart</Label>
                    <Switch
                      id="auto-restart"
                      checked={controlValues.autoRestart === true}
                      onCheckedChange={(checked) => handleValueChange("autoRestart", checked)}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="restart-delay">Restart Delay (minutes)</Label>
                      <span className="text-sm">{controlValues.restartDelay || 5} min</span>
                    </div>
                    <Slider
                      id="restart-delay"
                      min={1}
                      max={60}
                      step={1}
                      value={[controlValues.restartDelay || 5]}
                      onValueChange={(value) => handleValueChange("restartDelay", value[0])}
                      disabled={!controlValues.autoRestart}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="max-restart-attempts">Maximum Restart Attempts</Label>
                      <span className="text-sm">{controlValues.maxRestartAttempts || 3}</span>
                    </div>
                    <Slider
                      id="max-restart-attempts"
                      min={1}
                      max={10}
                      step={1}
                      value={[controlValues.maxRestartAttempts || 3]}
                      onValueChange={(value) => handleValueChange("maxRestartAttempts", value[0])}
                      disabled={!controlValues.autoRestart}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end space-x-4">
            <Button variant="outline" onClick={handleApplyChanges} disabled={isSubmitting}>
              {isSubmitting ? "Applying..." : "Apply Changes"}
            </Button>
          </div>

          {/* Command History */}
          <div className="bg-white p-4 rounded-lg border shadow-sm">
            <h3 className="text-lg font-medium mb-4">Command History</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Command
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Value
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {controlHistory.slice(0, 10).map((command) => (
                    <tr key={command.id}>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">{getCommandDescription(command.command)}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">
                        {typeof command.value === "object" ? "Complex Value" : String(command.value)}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">
                        {new Date(command.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm flex items-center">
                        {renderStatusIcon(command.status)}
                        <span className="ml-1">{command.status}</span>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">
                        <button
                          onClick={() => handleDeleteCommand(command.id, command.commandType || "", command.sequentialId || "")}
                          className="text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {controlHistory.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-2 text-center text-sm text-gray-500">
                        No commands in history
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
