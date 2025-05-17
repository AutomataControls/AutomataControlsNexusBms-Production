"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useToast } from "@/components/ui/use-toast"
import { useSocket } from "@/lib/socket-context"
import { logAuditEvent } from "@/lib/audit-logger"
import { useAuth } from "@/lib/auth-context"
import { ref, type Database, onValue, off, type DataSnapshot } from "firebase/database"
import { secondaryDb } from "@/lib/secondary-firebase"
import { db } from "@/lib/firebase"
import { doc, updateDoc } from "firebase/firestore"
import { CheckCircle, XCircle, Clock } from "lucide-react"
import { z } from "zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Import our component types
interface BoilerControlsProps {
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
  unitEnable: boolean
  operationMode: string
  waterTempSetpoint: number
  pressureSetpoint: number
  circulationPump: boolean
  firingRate: number
  highLimitTemp: number
  highLimitPressure: number
  lowWaterCutoff: boolean
  flameSafeguard: boolean
  purgeTime: number
  autoReset: boolean
  isLeadBoiler: boolean
  outdoorAirResetEnabled: boolean
  outdoorAirResetMinTemp: number
  outdoorAirResetMaxTemp: number
  outdoorAirResetMinSetpoint: number
  outdoorAirResetMaxSetpoint: number
  customLogicEnabled: boolean
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
const ControlValuesSchema: z.ZodType<ControlValues> = z.object({
  unitEnable: z.boolean(),
  operationMode: z.string(),
  waterTempSetpoint: z.number(),
  pressureSetpoint: z.number(),
  circulationPump: z.boolean(),
  firingRate: z.number(),
  highLimitTemp: z.number(),
  highLimitPressure: z.number(),
  lowWaterCutoff: z.boolean(),
  flameSafeguard: z.boolean(),
  purgeTime: z.number(),
  autoReset: z.boolean(),
  isLeadBoiler: z.boolean(),
  outdoorAirResetEnabled: z.boolean(),
  outdoorAirResetMinTemp: z.number(),
  outdoorAirResetMaxTemp: z.number(),
  outdoorAirResetMinSetpoint: z.number(),
  outdoorAirResetMaxSetpoint: z.number(),
  customLogicEnabled: z.boolean(),
})

// Add this interface for logic evaluation results
interface LogicEvaluation {
  result: any
  error?: string
  timestamp: number
  hasChanges: boolean
  displayOnly?: boolean
}

export function BoilerControls({ equipment, metrics, values, onChange }: BoilerControlsProps) {
  // Add loading state
  const [isLoading, setIsLoading] = useState(true)
  // Add autoSync state
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true)

  const defaultControlValues: ControlValues = {
    unitEnable: false,
    operationMode: "auto",
    waterTempSetpoint: 180,
    pressureSetpoint: 15,
    circulationPump: false,
    firingRate: 0,
    highLimitTemp: 200,
    highLimitPressure: 30,
    lowWaterCutoff: true,
    flameSafeguard: true,
    purgeTime: 60,
    autoReset: false,
    isLeadBoiler: false,
    outdoorAirResetEnabled: false,
    outdoorAirResetMinTemp: 0,
    outdoorAirResetMaxTemp: 100,
    outdoorAirResetMinSetpoint: 120,
    outdoorAirResetMaxSetpoint: 180,
    customLogicEnabled: false,
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
  const [logicEvaluation, setLogicEvaluation] = useState<LogicEvaluation | null>(null)

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
            unitEnable: controlValues.unitEnable === undefined ? true : controlValues.unitEnable,
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
        // Note: Update the API endpoint to write to the "control_commands" bucket
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
    [equipment.id, equipment.locationId, controlValues, user, toast, equipment, db],
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
              }),
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
      case "update_unit_enable":
        return "Unit Enable"
      case "update_operation_mode":
        return "Operation Mode"
      case "update_water_temp_setpoint":
        return "Water Temperature Setpoint"
      case "update_pressure_setpoint":
        return "Pressure Setpoint"
      case "update_circulation_pump":
        return "Circulation Pump"
      case "update_firing_rate":
        return "Firing Rate"
      case "update_high_limit_temp":
        return "High Limit Temperature"
      case "update_high_limit_pressure":
        return "High Limit Pressure"
      case "update_low_water_cutoff":
        return "Low Water Cutoff"
      case "update_flame_safeguard":
        return "Flame Safeguard"
      case "update_purge_time":
        return "Purge Time"
      case "update_auto_reset":
        return "Auto Reset"
      case "update_is_lead_boiler":
        return "Lead Boiler Status"
      case "update_outdoor_air_reset_enabled":
        return "Outdoor Air Reset Enable"
      case "update_outdoor_air_reset_min_temp":
        return "Outdoor Air Reset Min Temp"
      case "update_outdoor_air_reset_max_temp":
        return "Outdoor Air Reset Max Temp"
      case "update_outdoor_air_reset_min_setpoint":
        return "Outdoor Air Reset Min Setpoint"
      case "update_outdoor_air_reset_max_setpoint":
        return "Outdoor Air Reset Max Setpoint"
      case "update_custom_logic_enabled":
        return "Custom Logic Enable"
      default:
        return command
    }
  }

  // Handle value changes
  const handleValueChange = async (key: string, value: any) => {
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

  // Handle temperature setpoint change
  const handleTemperatureSetpointChange = async (value: number) => {
    console.log("Temperature setpoint changed to:", value)

    // Make sure the value is a valid number
    const numericValue = Number(value)
    if (isNaN(numericValue)) {
      console.error("Invalid temperature setpoint value:", value)
      return
    }

    // Update local state immediately
    setControlValues((prev) => ({
      ...prev,
      waterTempSetpoint: numericValue,
    }))

    // Send just the temperature setpoint update - nothing else
    const success = await sendControlCommand("update_water_temp_setpoint", numericValue, {
      previousValue: previousControlValues.waterTempSetpoint,
    })

    if (success) {
      // Update previous value
      setPreviousControlValues((prev) => ({
        ...prev,
        waterTempSetpoint: numericValue,
      }))

      setHasUnsavedChanges(true)
      console.log("Temperature setpoint saved:", numericValue)
    }
  }

  // Handle unit enable toggle
  const handleUnitEnable = async (enabled: boolean) => {
    // Update local state immediately
    const updatedValues = {
      ...controlValues,
      unitEnable: enabled,
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
        "unitEnable",
        "operationMode",
        "waterTempSetpoint",
        "pressureSetpoint",
        "circulationPump",
        "firingRate",
        "highLimitTemp",
        "highLimitPressure",
        "lowWaterCutoff",
        "flameSafeguard",
        "purgeTime",
        "autoReset",
        "isLeadBoiler",
        "outdoorAirResetEnabled",
        "outdoorAirResetMinTemp",
        "outdoorAirResetMaxTemp",
        "outdoorAirResetMinSetpoint",
        "outdoorAirResetMaxSetpoint",
        "customLogicEnabled",
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

  // Create a sandbox object for metrics display
  const sandbox = useMemo(
    () => ({
      metrics: {
        supplyTemp:
          metrics?.supplyTemp || metrics?.["H2O Supply"] || metrics?.H2O_Supply || metrics?.supplyTemperature || 180,
        returnTemp:
          metrics?.returnTemp || metrics?.["H2O Return"] || metrics?.H2O_Return || metrics?.returnTemperature || 160,
        outdoorTemp:
          metrics?.outdoorTemp ||
          metrics?.["Outdoor Air Temperature"] ||
          metrics?.Outdoor_Air_Temperature ||
          metrics?.outdoorTemperature ||
          50,
        pressure: metrics?.pressure || metrics?.boilerPressure || metrics?.waterPressure || 15,
        firingRate: metrics?.firingRate || metrics?.burnerFiringRate || 0,
        // Include all raw metrics
        ...metrics,
      },
      settings: {
        waterTempSetpoint: controlValues.waterTempSetpoint,
        pressureSetpoint: controlValues.pressureSetpoint,
        operationMode: controlValues.operationMode,
        unitEnable: controlValues.unitEnable,
        circulationPump: controlValues.circulationPump,
        outdoorAirReset: {
          enabled: controlValues.outdoorAirResetEnabled,
          minTemp: controlValues.outdoorAirResetMinTemp,
          maxTemp: controlValues.outdoorAirResetMaxTemp,
          minSetpoint: controlValues.outdoorAirResetMinSetpoint,
          maxSetpoint: controlValues.outdoorAirResetMaxSetpoint,
        },
      },
    }),
    [metrics, controlValues],
  )

  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-lg">Loading controls...</p>
        </div>
      ) : (
        <>
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="safety">Safety</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Boiler Controls</CardTitle>
                  <CardDescription>Control the boiler operation and temperature settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4">
                    <div className="flex items-center justify-between">
                      <Label>Unit Enable</Label>
                      <Switch
                        checked={controlValues.unitEnable}
                        onCheckedChange={(checked) => handleUnitEnable(checked)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Operation Mode</Label>
                      <Select
                        value={controlValues.operationMode}
                        onValueChange={(value) => handleValueChange("operationMode", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select mode" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Auto</SelectItem>
                          <SelectItem value="manual">Manual</SelectItem>
                          <SelectItem value="off">Off</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Water Temperature Setpoint (°F)</Label>
                      <div className="flex items-center space-x-2">
                        <Slider
                          value={[controlValues.waterTempSetpoint]}
                          min={100}
                          max={200}
                          step={1}
                          onValueChange={(value) => handleTemperatureSetpointChange(value[0])}
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          value={controlValues.waterTempSetpoint}
                          onChange={(e) => handleTemperatureSetpointChange(Number.parseFloat(e.target.value))}
                          min={100}
                          max={200}
                          className="w-20"
                        />
                      </div>
                      <div className="text-sm text-gray-500">
                        Current: {sandbox.metrics.supplyTemp?.toFixed(1) || "N/A"}°F
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Pressure Setpoint (PSI)</Label>
                      <div className="flex items-center space-x-2">
                        <Slider
                          value={[controlValues.pressureSetpoint]}
                          min={0}
                          max={50}
                          step={1}
                          onValueChange={(value) => handleValueChange("pressureSetpoint", value[0])}
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          value={controlValues.pressureSetpoint}
                          onChange={(e) => handleValueChange("pressureSetpoint", Number.parseFloat(e.target.value))}
                          min={0}
                          max={50}
                          className="w-20"
                        />
                      </div>
                      <div className="text-sm text-gray-500">
                        Current: {sandbox.metrics.pressure?.toFixed(1) || "N/A"} PSI
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <Label>Circulation Pump</Label>
                      <Switch
                        checked={controlValues.circulationPump}
                        onCheckedChange={(checked) => handleValueChange("circulationPump", checked)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Firing Rate (%)</Label>
                      <div className="flex items-center space-x-2">
                        <Slider
                          value={[controlValues.firingRate]}
                          min={0}
                          max={100}
                          step={1}
                          onValueChange={(value) => handleValueChange("firingRate", value[0])}
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          value={controlValues.firingRate}
                          onChange={(e) => handleValueChange("firingRate", Number.parseFloat(e.target.value))}
                          min={0}
                          max={100}
                          className="w-20"
                        />
                      </div>
                      <div className="text-sm text-gray-500">
                        Current: {sandbox.metrics.firingRate?.toFixed(1) || "N/A"}%
                      </div>
                    </div>

                    {/* Lead/Lag Controls */}
                    <div className="space-y-4 border rounded-lg p-4">
                      <h3 className="font-medium">Lead/Lag Configuration</h3>
                      <div className="flex items-center justify-between">
                        <Label>Lead Boiler</Label>
                        <Switch
                          checked={controlValues.isLeadBoiler}
                          onCheckedChange={(checked) => handleValueChange("isLeadBoiler", checked)}
                        />
                      </div>
                    </div>

                    {/* Outdoor Air Reset Controls */}
                    <div className="space-y-4 border rounded-lg p-4">
                      <h3 className="font-medium">Outdoor Air Reset</h3>
                      <div className="flex items-center justify-between">
                        <Label>Enable Outdoor Air Reset</Label>
                        <Switch
                          checked={controlValues.outdoorAirResetEnabled}
                          onCheckedChange={(checked) => handleValueChange("outdoorAirResetEnabled", checked)}
                        />
                      </div>

                      {controlValues.outdoorAirResetEnabled && (
                        <>
                          <div className="space-y-2">
                            <Label>Minimum Outdoor Temperature (°F)</Label>
                            <Input
                              type="number"
                              value={controlValues.outdoorAirResetMinTemp}
                              onChange={(e) =>
                                handleValueChange("outdoorAirResetMinTemp", Number.parseFloat(e.target.value))
                              }
                              min={-20}
                              max={120}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Maximum Outdoor Temperature (°F)</Label>
                            <Input
                              type="number"
                              value={controlValues.outdoorAirResetMaxTemp}
                              onChange={(e) =>
                                handleValueChange("outdoorAirResetMaxTemp", Number.parseFloat(e.target.value))
                              }
                              min={0}
                              max={120}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Minimum Water Temperature Setpoint (°F)</Label>
                            <Input
                              type="number"
                              value={controlValues.outdoorAirResetMinSetpoint}
                              onChange={(e) =>
                                handleValueChange("outdoorAirResetMinSetpoint", Number.parseFloat(e.target.value))
                              }
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Maximum Water Temperature Setpoint (°F)</Label>
                            <Input
                              type="number"
                              value={controlValues.outdoorAirResetMaxSetpoint}
                              onChange={(e) =>
                                handleValueChange("outdoorAirResetMaxSetpoint", Number.parseFloat(e.target.value))
                              }
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="safety" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Safety Settings</CardTitle>
                  <CardDescription>Configure safety limits and protection features</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label>High Limit Temperature (°F)</Label>
                      <Input
                        type="number"
                        value={controlValues.highLimitTemp}
                        onChange={(e) => handleValueChange("highLimitTemp", Number.parseFloat(e.target.value))}
                        min={150}
                        max={250}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>High Limit Pressure (PSI)</Label>
                      <Input
                        type="number"
                        value={controlValues.highLimitPressure}
                        onChange={(e) => handleValueChange("highLimitPressure", Number.parseFloat(e.target.value))}
                        min={50}
                        max={150}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label>Low Water Cutoff</Label>
                      <Switch
                        checked={controlValues.lowWaterCutoff}
                        onCheckedChange={(checked) => handleValueChange("lowWaterCutoff", checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label>Flame Safeguard</Label>
                      <Switch
                        checked={controlValues.flameSafeguard}
                        onCheckedChange={(checked) => handleValueChange("flameSafeguard", checked)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Purge Time (seconds)</Label>
                      <Input
                        type="number"
                        value={controlValues.purgeTime}
                        onChange={(e) => handleValueChange("purgeTime", Number.parseFloat(e.target.value))}
                        min={30}
                        max={120}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label>Auto Reset</Label>
                      <Switch
                        checked={controlValues.autoReset}
                        onCheckedChange={(checked) => handleValueChange("autoReset", checked)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end space-x-2">
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
                          onClick={() =>
                            handleDeleteCommand(command.id, command.commandType || "", command.sequentialId || "")
                          }
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
