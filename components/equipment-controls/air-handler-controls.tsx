"use client"

import { useState, useEffect, useRef } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { useSocket } from "@/lib/socket-context"
import { logAuditEvent } from "@/lib/audit-logger"
import { useAuth } from "@/lib/auth-context"
import { db } from "@/lib/firebase"
import { doc, updateDoc } from "firebase/firestore"
import { CheckCircle, XCircle, Clock, RefreshCw } from "lucide-react"
import { z } from "zod"
import { create } from "zustand"

// Import our component types
import type {
  AirHandlerControls as AirHandlerControlsType,
  PIDSettings,
  ControlHistoryEntry,
  LogicEvaluation,
  OutdoorAirResetSettings,
  AirHandlerControlsProps,
} from "./types"

// Import sub-components
import { AirHandlerGeneralControls } from "./air-handler-general-controls"
import { AirHandlerPIDSettings } from "./air-handler-pid-settings"
import { AirHandlerOutdoorAirReset } from "./air-handler-outdoor-air-reset"
import { AirHandlerCustomLogic } from "./air-handler-custom-logic"
import { AirHandlerCommandHistory } from "./air-handler-command-history"

import type React from "react"
import dynamic from "next/dynamic"
import type { EditorProps } from "@monaco-editor/react"

// Add Monaco Editor import
const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="h-[400px] border rounded-md flex items-center justify-center">Loading editor...</div>,
}) as React.ComponentType<EditorProps>

// Define default PID settings
const defaultPIDSettings: PIDSettings = {
  kp: 1.0,
  ki: 0.1,
  kd: 0.01,
  enabled: false,
  outputMin: 0,
  outputMax: 100,
  sampleTime: 1000,
  reverseActing: false,
}

// Define default outdoor air reset settings
const defaultOutdoorAirResetSettings: OutdoorAirResetSettings = {
  enabled: false,
  outdoorTempLow: 20,
  outdoorTempHigh: 70,
  setpointLow: 75,
  setpointHigh: 68,
}

// Helper function to get command descriptions
const getCommandDescription = (command: string): string => {
  switch (command) {
    case "update_unitEnable":
      return "Unit Enable"
    case "update_operationMode":
      return "Operation Mode"
    case "update_temperatureSetpoint":
      return "Temperature Setpoint"
    case "update_humiditySetpoint":
      return "Humidity Setpoint"
    case "update_economizerEnable":
      return "Economizer Enable"
    case "update_supplyAirTempSetpoint":
      return "Supply Air Temperature Setpoint"
    case "update_supplyFanSpeed":
      return "Supply Fan Speed"
    case "update_supplyFanEnable":
      return "Supply Fan Enable"
    case "update_staticPressureSetpoint":
      return "Static Pressure Setpoint"
    case "update_returnFanEnable":
      return "Return Fan Enable"
    case "update_returnFanSpeed":
      return "Return Fan Speed"
    case "update_returnAirDamper":
      return "Return Air Damper"
    case "update_customLogicEnabled":
      return "Custom Logic Enable"
    case "update_customLogic":
      return "Custom Logic"
    case "update_heatingValveEnable":
      return "Heating Valve Enable"
    case "update_heatingValveMode":
      return "Heating Valve Mode"
    case "update_heatingValvePosition":
      return "Heating Valve Position"
    case "update_coolingValveEnable":
      return "Cooling Valve Enable"
    case "update_coolingValveMode":
      return "Cooling Valve Mode"
    case "update_coolingValvePosition":
      return "Cooling Valve Position"
    case "update_outdoorDamperMode":
      return "Outdoor Damper Mode"
    case "update_outdoorDamperPosition":
      return "Outdoor Damper Position"
    case "update_pidControllers":
      return "PID Controllers"
    case "update_outdoorAirReset":
      return "Outdoor Air Reset"
    default:
      return command
  }
}

// Add interfaces for type safety
interface AirHandlerControls extends AirHandlerControlsType {}

// Add interface for logic evaluation results
interface LogicEvaluationResult extends LogicEvaluation {}

// Add interface for control history entry
interface ControlHistoryEntryResult extends ControlHistoryEntry {}

// Add interface for command from custom logic
interface LogicCommand {
  type: string
  value: any
  metadata?: any
}

interface OutdoorAirResetSettingsResult extends OutdoorAirResetSettings {}

// Update the defaultPIDSettings to include reverseActing
// --- Zustand Store for PID Settings ---
interface PIDState {
  pidControllers: {
    heating?: PIDSettings
    cooling?: PIDSettings
    outdoorDamper?: PIDSettings
  }
  setPIDControllers: (
    newPIDControllers: {
      heating?: PIDSettings
      cooling?: PIDSettings
      outdoorDamper?: PIDSettings
    },
    equipmentId: string,
  ) => Promise<void>
}

const usePIDStore = create<PIDState>()((set) => ({
  pidControllers: {
    heating: { ...defaultPIDSettings, reverseActing: true },
    cooling: { ...defaultPIDSettings },
    outdoorDamper: { ...defaultPIDSettings },
  },
  setPIDControllers: async (newPIDControllers, equipmentId) => {
    set({ pidControllers: newPIDControllers })
    console.log("PID settings updated:", newPIDControllers)

    try {
      // Send to API endpoint that will handle the InfluxDB writing
      const response = await fetch("/api/control-commands", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          command: "update_pidControllers",
          commandType: "pidControllers",
          equipmentId: equipmentId,
          value: newPIDControllers,
          source: "web_dashboard",
          status: "pending",
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to save PID settings: ${response.statusText}`)
      }

      console.log("PID settings saved to database")
    } catch (error) {
      console.error("Error saving PID settings:", error)
    }
  },
}))

// Define Zod schema for ControlValues for data validation
const AirHandlerControlsSchema = z.object({
  unitEnable: z.boolean().default(false),
  operationMode: z.string().default("auto"),
  temperatureSetpoint: z.number().default(72),
  humiditySetpoint: z.number().optional(),
  economizerEnable: z.boolean().default(false),
  supplyAirTempSetpoint: z.number().default(55),
  supplyFanSpeed: z.number().optional(),
  supplyFanEnable: z.boolean().default(true),
  staticPressureSetpoint: z.number().optional(),
  returnFanEnable: z.boolean().optional(),
  returnFanSpeed: z.number().optional(),
  returnAirDamper: z.number().optional(),
  customLogicEnabled: z.boolean().default(false),
  customLogic: z.string().optional(),
  heatingValveEnable: z.boolean().optional(),
  heatingValveMode: z.string().optional(),
  heatingValvePosition: z.number().optional(),
  coolingValveEnable: z.boolean().optional(),
  coolingValveMode: z.string().optional(),
  coolingValvePosition: z.number().optional(),
  outdoorDamperMode: z.string().optional(),
  outdoorDamperPosition: z.number().optional(),
  pidControllers: z
    .object({
      heating: z
        .object({
          kp: z.number().default(1.0),
          ki: z.number().default(0.1),
          kd: z.number().default(0.01),
          enabled: z.boolean().default(false),
          outputMin: z.number().default(0),
          outputMax: z.number().default(100),
          sampleTime: z.number().default(1000),
          setpoint: z.number().optional(),
          reverseActing: z.boolean().default(true),
        })
        .optional(),
      cooling: z
        .object({
          kp: z.number().default(1.0),
          ki: z.number().default(0.1),
          kd: z.number().default(0.01),
          enabled: z.boolean().default(false),
          outputMin: z.number().default(0),
          outputMax: z.number().default(100),
          sampleTime: z.number().default(1000),
          setpoint: z.number().optional(),
          reverseActing: z.boolean().default(false),
        })
        .optional(),
      outdoorDamper: z
        .object({
          kp: z.number().default(1.0),
          ki: z.number().default(0.1),
          kd: z.number().default(0.01),
          enabled: z.boolean().default(false),
          outputMin: z.number().default(0),
          outputMax: z.number().default(100),
          sampleTime: z.number().default(1000),
          setpoint: z.number().optional(),
          reverseActing: z.boolean().default(false),
        })
        .optional(),
    })
    .optional(),
  outdoorAirReset: z
    .object({
      enabled: z.boolean().default(false),
      outdoorTempLow: z.number().default(20),
      outdoorTempHigh: z.number().default(70),
      setpointLow: z.number().default(75),
      setpointHigh: z.number().default(68),
    })
    .optional(),
})

// Add default logic template - UPDATED to use commands array instead of direct sendControlCommand calls
const defaultLogic = `// Air Handler Control Logic
function airHandlerControl(metrics, settings) {
  // Get current temperatures with proper fallbacks
  const supplyTemp = metrics.supplyTemperature || metrics.Supply || metrics.DischargeAir || metrics.Discharge || 55;
  const outdoorTemp = metrics.outdoorTemperature || metrics.outdoorTemp || metrics.Outdoor || metrics.OutdoorAir || metrics["Outdoor Air"] || 85;
  const roomTemp = metrics.roomTemperature || metrics.roomTemp || metrics.Zone || metrics.ZoneTemp || 72;

  // Use supplyAirTempSetpoint as our primary setpoint for supply air control
  const supplySetpoint = settings.supplyAirTempSetpoint || 55;
  const roomSetpoint = settings.temperatureSetpoint || 72;
  const deadband = 1; // Reduce deadband to 1°F for more responsive control

  console.log("Current supply temp:", supplyTemp, "Supply setpoint:", supplySetpoint, "Outdoor temp:", outdoorTemp);

  // High and Low Limit Protection
  const HIGH_LIMIT = 120; // High limit protection temperature
  const LOW_LIMIT = 45;   // Low limit protection temperature

  // Initialize result object
  const result = {};

  // Safety checks
  if (supplyTemp > HIGH_LIMIT) {
    console.log("HIGH LIMIT PROTECTION ACTIVATED");
    // Emergency shutdown
    result.heatingValvePosition = 0;
    result.coolingValvePosition = 100;
    return result;
  }

  if (supplyTemp < LOW_LIMIT) {
    console.log("LOW LIMIT PROTECTION ACTIVATED");
    // Emergency heating
    result.heatingValvePosition = 100;
    result.coolingValvePosition = 0;
    return result;
  }

  // Normal operation based on mode
  switch (settings.operationMode) {
    case "cooling":
      // Cooling mode logic
      if (settings.pidControllers?.cooling?.enabled) {
        console.log("PID cooling mode active");
        // Let the PID controller handle it, but ensure valve is enabled
        result.coolingValveEnable = true;

        // Calculate cooling valve position based on temperature difference
        if (supplyTemp > supplySetpoint) {
          const tempDiff = supplyTemp - supplySetpoint;
          const coolingValvePosition = Math.min(100, Math.max(0, tempDiff * 10)); // 10% per degree difference
          result.coolingValvePosition = coolingValvePosition;
          console.log("Setting cooling valve to", coolingValvePosition, "% based on temp difference of", tempDiff);
        }
      } else {
        // Manual cooling logic
        if (supplyTemp > supplySetpoint + deadband) {
          // Need cooling
          const coolingValvePosition = Math.min(100, (supplyTemp - supplySetpoint) * 20); // More aggressive cooling
          result.coolingValvePosition = coolingValvePosition;
          result.heatingValvePosition = 0;
          console.log("Cooling needed. Valve position:", coolingValvePosition);
        } else if (supplyTemp < supplySetpoint - deadband) {
          // Too cold, reduce cooling
          result.coolingValvePosition = 0;
          console.log("Too cold, closing cooling valve");
        } else {
          // Within deadband, maintain current state
          console.log("Temperature within deadband, maintaining state");
        }
      }
      break;

    case "heating":
      // Heating mode logic
      if (settings.pidControllers?.heating?.enabled) {
        console.log("PID heating mode active");
        // Let the PID controller handle it, but ensure valve is enabled
        result.heatingValveEnable = true;
      } else {
        // Manual heating logic
        if (supplyTemp < supplySetpoint - deadband) {
          // Need heating
          const heatingValvePosition = Math.min(100, (supplySetpoint - supplyTemp) * 20); // More aggressive heating
          result.heatingValvePosition = heatingValvePosition;
          result.coolingValvePosition = 0;
          console.log("Heating needed. Valve position:", heatingValvePosition);
        } else if (supplyTemp > supplySetpoint + deadband) {
          // Too hot, reduce heating
          result.heatingValvePosition = 0;
          console.log("Too hot, closing heating valve");
        } else {
          // Within deadband, maintain current state
          console.log("Temperature within deadband, maintaining state");
        }
      }
      break;

    case "auto":
    default:
      // Auto mode - determine if heating or cooling is needed based on room temp vs room setpoint
      if (roomTemp > roomSetpoint + deadband) {
        // Room is too warm, need cooling
        if (supplyTemp > supplySetpoint) {
          // Supply air is too warm, increase cooling
          const coolingValvePosition = Math.min(100, (supplyTemp - supplySetpoint) * 15);
          result.coolingValvePosition = coolingValvePosition;
          result.heatingValvePosition = 0;
          console.log("Auto mode: Cooling. Valve position:", coolingValvePosition);
        }
      } else if (roomTemp < roomSetpoint - deadband) {
        // Room is too cool, need heating
        if (supplyTemp < supplySetpoint) {
          // Supply air is too cool, increase heating
          const heatingValvePosition = Math.min(100, (supplySetpoint - supplyTemp) * 15);
          result.heatingValvePosition = heatingValvePosition;
          result.coolingValvePosition = 0;
          console.log("Auto mode: Heating. Valve position:", heatingValvePosition);
        }
      } else {
        // Room temperature is within deadband
        console.log("Auto mode: Room temperature within deadband");
        // Gradually close valves if supply temp is close to setpoint
        if (Math.abs(supplyTemp - supplySetpoint) < deadband) {
          result.heatingValvePosition = 0;
          result.coolingValvePosition = 0;
        }
      }
      break;
  }

  // Economizer logic (if enabled)
  if (settings.economizerEnable && outdoorTemp < roomTemp - 5) {
    // Outdoor air is at least 5°F cooler than indoor, use economizer
    console.log("Economizer enabled and beneficial");
    result.outdoorDamperPosition = 100;
  } else if (settings.economizerEnable) {
    // Economizer enabled but not beneficial
    console.log("Economizer enabled but not beneficial");
    result.outdoorDamperPosition = 20; // Minimum outdoor air
  }

  return result;
}`

// Add a Save Controls button to the top level component
export function AirHandlerControls({ equipment, metrics = {}, showSaveButton = true }: AirHandlerControlsProps) {
  // State variables
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("general")
  const [controlValues, setControlValues] = useState<AirHandlerControls>({
    ...equipment.controls,
    customLogicEnabled: equipment.controls?.customLogicEnabled || false,
    customLogic: equipment.controls?.customLogic || defaultLogic,
    heatingValveEnable: equipment.controls?.heatingValveEnable || false,
    heatingValveMode: equipment.controls?.heatingValveMode || "auto",
    heatingValvePosition: equipment.controls?.heatingValvePosition || 0,
    coolingValveEnable: equipment.controls?.coolingValveEnable || false,
    coolingValveMode: equipment.controls?.coolingValveMode || "auto",
    coolingValvePosition: equipment.controls?.coolingValvePosition || 0,
    outdoorDamperMode: equipment.controls?.outdoorDamperMode || "auto",
    outdoorDamperPosition: equipment.controls?.outdoorDamperPosition || 0,
    // Initialize PID controllers with defaults if not present or invalid
    pidControllers:
      typeof equipment.controls?.pidControllers === "object" && equipment.controls?.pidControllers !== null
        ? equipment.controls.pidControllers
        : {
            heating: { ...defaultPIDSettings, reverseActing: true },
            cooling: { ...defaultPIDSettings },
            outdoorDamper: { ...defaultPIDSettings },
          },
    // Initialize outdoor air reset with defaults if not present
    outdoorAirReset: equipment.controls?.outdoorAirReset || { ...defaultOutdoorAirResetSettings },
  })
  const [previousControlValues, setPreviousControlValues] = useState<AirHandlerControls>({
    ...equipment.controls,
  })
  const [username, setUsername] = useState<string>("")
  const [password, setPassword] = useState<string>("")
  const [loginError, setLoginError] = useState<string>("")
  const [pendingChange, setPendingChange] = useState<{ key: string; value: any } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [pendingCommands, setPendingCommands] = useState<{
    [key: string]: boolean
  }>({})
  const [controlHistory, setControlHistory] = useState<ControlHistoryEntryResult[]>([])
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(true)
  const [logicEvaluation, setLogicEvaluation] = useState<LogicEvaluationResult | null>(null)

  // Refs
  const isEvaluatingLogicRef = useRef(false)
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pidInitializedRef = useRef(false)
  // Add shouldUpdatePreviousValues ref after the other refs
  const shouldUpdatePreviousValues = useRef(false)

  // Hooks
  const { socket } = useSocket()
  const { toast } = useToast()
  const { user, loginWithUsername } = useAuth()
  const { pidControllers, setPIDControllers } = usePIDStore()

  // Derived state
  const isAuthenticated = !!user && user.roles && (user.roles.includes("DevOps") || user.roles.includes("admin"))

  // Helper functions
  const hasRequiredRole = () => {
    if (!user || !user.roles) return false
    const allowedRoles = ["admin", "DevOps", "devops", "Facilities", "facilities"]
    return user.roles.some((role) => allowedRoles.includes(role.toLowerCase()))
  }

  const hasValidLocationData = () => {
    return Boolean(equipment && equipment.locationId && equipment.locationName)
  }

  // Initialize loading state
  useEffect(() => {
    // Show loading spinner for 3 seconds to allow databases to initialize
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 3000)

    return () => clearTimeout(timer)
  }, [])

  // Initialize PID controllers from equipment data
  useEffect(() => {
    if (equipment?.controls?.pidControllers && !pidInitializedRef.current) {
      pidInitializedRef.current = true
      setPIDControllers(equipment.controls.pidControllers, equipment.id)
    }
  }, [equipment?.controls?.pidControllers, setPIDControllers, equipment.id])

  // RTDB History Updates
  useEffect(() => {
    if (!equipment || !equipment.locationId || !equipment.id) return

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

  // RTDB Control Values Update (with Debounce)
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

  // Audit Logging
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
        locationId: equipment.locationId || "",
        locationName: equipment.locationName || "",
        details,
        path: `/equipment/${equipment.id}/controls`,
        ...(changes && { changes }),
      })
    } catch (error) {
      console.error("Failed to log audit event:", error)
    }
  }

  // Socket Listeners
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

  // Send Control Command - UPDATED to use InfluxDB API endpoint
  const sendControlCommand = async (command: string, value: any, metadata?: any) => {
    // Generate a truly unique ID by combining timestamp with a random number
    const commandId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const now = new Date()
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate(),
    ).padStart(2, "0")}_${String(now.getHours()).padStart(
      2,
      "0",
    )}-${String(now.getMinutes()).padStart(2, "0")}-${String(now.getSeconds()).padStart(2, "0")}`

    // Check if authentication is required for this command
    if (command !== "update_temperature_setpoint" && (!isAuthenticated || !hasRequiredRole())) {
      setPendingAction(() => () => sendControlCommand(command, value, metadata))
      // setShowAuthDialog(true)
      toast({
        title: "Authentication Required",
        description: "Please log in with appropriate credentials to perform this action.",
        variant: "destructive",
      })
      return false
    }

    try {
      console.log(`Sending control command: ${command}`, { value, metadata })
      setPendingCommands((prev) => ({ ...prev, [commandId]: true }))

      // Skip sending custom logic code to the database
      if (command === "update_customLogic") {
        // Just update local state
        setControlValues((prev) => ({
          ...prev,
          customLogic: value,
        }))
        setHasUnsavedChanges(true)
        return true
      }

      // Validate ControlValues using Zod
      try {
        // Fix any invalid data types before validation
        const validatedControlValues = { ...controlValues }

        // Ensure pidControllers is an object
        if (
          typeof validatedControlValues.pidControllers !== "object" ||
          validatedControlValues.pidControllers === null
        ) {
          validatedControlValues.pidControllers = {
            heating: { ...defaultPIDSettings, reverseActing: true },
            cooling: { ...defaultPIDSettings },
            outdoorDamper: { ...defaultPIDSettings },
          }
        }

        // Add debugging log to see what's being validated
        console.log("Validating controlValues:", JSON.stringify(validatedControlValues, null, 2))
        AirHandlerControlsSchema.parse(validatedControlValues)
      } catch (error) {
        console.error("ControlValues validation failed:", error)
        toast({
          title: "Validation Error",
          description: "Control settings failed validation. Check your input values.",
          variant: "destructive",
        })
        return false
      }

      // Extract command type from the command string (e.g., "update_heating_valve" -> "heating_valve")
      const commandType = command.replace("update_", "")

      // For complex objects like pidControllers, ensure we're sending a serializable value
      let commandValue = value
      if (typeof value === "object" && value !== null) {
        try {
          // Test if it can be serialized
          JSON.stringify(value)
        } catch (e) {
          console.error("Value cannot be serialized:", e)
          commandValue = JSON.parse(JSON.stringify(value))
        }
      }

      // Format data for InfluxDB - send to API endpoint instead of Firebase
      const commandData = {
        command,
        commandType,
        equipmentId: equipment.id,
        locationId: equipment.locationId,
        timestamp: Date.now(),
        formattedTimestamp: formattedDate,
        value: commandValue ?? null,
        previousValue: metadata?.previousValue ?? null,
        mode: metadata?.mode ?? null,
        source: "web_dashboard",
        status: "pending",
        userId: user?.id || "unknown",
        userName: user?.name || "unknown",
        details: `${getCommandDescription(command)} changed to ${typeof commandValue === "object" ? "updated settings" : commandValue}`,
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

      // Special handling for PID controllers
      if (command === "update_pidControllers" && value) {
        console.log("Saving PID controllers:", value)
        usePIDStore.getState().setPIDControllers(value, equipment.id)
      }

      if (hasValidLocationData()) {
        await logControlEvent(`Changed ${command} to ${typeof value === "object" ? "updated settings" : value}`, {
          [command]: value,
        })
      }

      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred"

      if (hasValidLocationData()) {
        await logControlEvent(
          `Failed to change ${command} to ${typeof value === "object" ? "updated settings" : value}: ${errorMessage}`,
        )
      }

      console.error("Failed to send control command:", error)
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
      return false
    } finally {
      setPendingCommands((prev) => ({ ...prev, [commandId]: false }))
    }
  }

  // Add the sendCompleteState function after the sendControlCommand function
  const sendCompleteState = async (updatedValues: AirHandlerControls) => {
    try {
      console.log("Sending complete state:", updatedValues)

      // Instead of sending the entire state as one command, send individual updates
      // This avoids the InfluxDB "No fields were provided" error
      const promises = []

      // Send each property individually, only if it has changed
      for (const [key, value] of Object.entries(updatedValues)) {
        // Skip complex objects and custom logic (handled separately)
        if (typeof value !== "object" && key !== "customLogic") {
          // Only send if the value has changed
          if (previousControlValues[key as keyof AirHandlerControls] !== value) {
            console.log(`Sending update for ${key}: ${value}`)

            // Convert key to command format (e.g., "fanSpeed" -> "update_fan_speed")
            const commandKey = `update_${key.replace(/([A-Z])/g, "_$1").toLowerCase()}`

            promises.push(
              sendControlCommand(commandKey, value, {
                previousValue: previousControlValues[key as keyof AirHandlerControls],
              }),
            )
          }
        }
      }

      // Handle PID controllers separately if they've changed
      if (
        updatedValues.pidControllers &&
        JSON.stringify(updatedValues.pidControllers) !== JSON.stringify(previousControlValues.pidControllers)
      ) {
        promises.push(
          sendControlCommand("update_pidControllers", updatedValues.pidControllers, {
            previousValue: previousControlValues.pidControllers,
          }),
        )
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

  // Add this useEffect to update previousControlValues whenever controlValues changes
  useEffect(() => {
    if (shouldUpdatePreviousValues.current) {
      setPreviousControlValues(controlValues)
      shouldUpdatePreviousValues.current = false
    }
  }, [controlValues])

  // Replace the existing saveAndApplySettings function with this improved version
  const saveAndApplySettings = async () => {
    setIsSubmitting(true)
    try {
      console.log("Apply changes button clicked")

      // Set the ref to true before applying changes
      shouldUpdatePreviousValues.current = true

      // Define simple properties that can be sent directly
      const simpleProps = [
        "unitEnable",
        "operationMode",
        "temperatureSetpoint",
        "humiditySetpoint",
        "economizerEnable",
        "supplyAirTempSetpoint",
        "supplyFanSpeed",
        "supplyFanEnable",
        "staticPressureSetpoint",
        "returnFanEnable",
        "returnFanSpeed",
        "returnAirDamper",
        "customLogicEnabled",
        "heatingValveEnable",
        "heatingValveMode",
        "heatingValvePosition",
        "coolingValveEnable",
        "coolingValveMode",
        "coolingValvePosition",
        "outdoorDamperMode",
        "outdoorDamperPosition",
      ]

      let successCount = 0

      // Send individual updates for each property
      for (const prop of simpleProps) {
        const key = prop as keyof AirHandlerControls
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

      // Handle PID controllers separately
      if (
        controlValues.pidControllers &&
        JSON.stringify(controlValues.pidControllers) !== JSON.stringify(previousControlValues.pidControllers)
      ) {
        const success = await sendControlCommand("update_pidControllers", controlValues.pidControllers, {
          previousValue: previousControlValues.pidControllers,
        })
        if (success) {
          successCount++
        }
      }

      // Handle custom logic separately
      if (controlValues.customLogic !== previousControlValues.customLogic) {
        const success = await sendControlCommand("update_customLogic", controlValues.customLogic, {
          previousValue: previousControlValues.customLogic,
        })
        if (success) {
          successCount++
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

  // Replace the existing handleValveEnable function with this improved version
  const handleValveEnable = (valveType: string, checked: boolean) => {
    // Update local state immediately
    const updatedValues = {
      ...controlValues,
      [`${valveType}ValveEnable`]: checked,
    }

    setControlValues(updatedValues)

    // Send the complete state
    const success = sendCompleteState(updatedValues)

    if (success) {
      setHasUnsavedChanges(true)
    }
  }

  // Replace the existing handleValveModeChange function with this improved version
  const handleValveModeChange = (valveType: string, value: string) => {
    // Update local state immediately
    const updatedValues = {
      ...controlValues,
      [`${valveType}ValveMode`]: value,
    }

    setControlValues(updatedValues)

    // Send the complete state
    const success = sendCompleteState(updatedValues)

    if (success) {
      setHasUnsavedChanges(true)
    }
  }

  // Replace the existing handleValveChange function with this improved version
  const handleValveChange = (valveType: string, value: number) => {
    // Update local state immediately
    const updatedValues = {
      ...controlValues,
      [`${valveType}ValvePosition`]: value,
    }

    setControlValues(updatedValues)

    // Send the complete state
    const success = sendCompleteState(updatedValues)

    if (success) {
      setHasUnsavedChanges(true)
    }
  }

  // Replace the existing handleDamperModeChange function with this improved version
  const handleDamperModeChange = (value: string) => {
    // Update local state immediately
    const updatedValues = {
      ...controlValues,
      outdoorDamperMode: value,
    }

    setControlValues(updatedValues)

    // Send the complete state
    const success = sendCompleteState(updatedValues)

    if (success) {
      setHasUnsavedChanges(true)
    }
  }

  // Replace the existing handleDamperPositionChange function with this improved version
  const handleDamperPositionChange = (value: number) => {
    // Update local state immediately
    const updatedValues = {
      ...controlValues,
      outdoorDamperPosition: value,
    }

    setControlValues(updatedValues)

    // Send the complete state
    const success = sendCompleteState(updatedValues)

    if (success) {
      setHasUnsavedChanges(true)
    }
  }

  // Replace the existing handlePidChange function with this improved version
  const handlePidChange = (pidType: string, key: string, value: any) => {
    const updatedPidControllers = {
      ...controlValues.pidControllers,
      [pidType]: {
        ...controlValues.pidControllers?.[pidType],
        [key]: value,
      },
    }

    // Update local state immediately
    const updatedValues = {
      ...controlValues,
      pidControllers: updatedPidControllers,
    }

    setControlValues(updatedValues)

    // Send the complete state
    const success = sendCompleteState(updatedValues)

    if (success) {
      setHasUnsavedChanges(true)
    }
  }

  // Command history handlers
  const handleAcknowledgeCommand = async (commandId: string, commandType: string, sequentialId: string) => {
    if (!equipment || !equipment.locationId || !equipment.id) return

    try {
      // Update the command via API endpoint
      const response = await fetch("/api/update-command-status", {
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
          status: "acknowledged",
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to acknowledge command: ${response.statusText}`)
      }

      // Optimistically update the local state
      setControlHistory((prevHistory) =>
        prevHistory.map((entry) => (entry.id === commandId ? { ...entry, status: "acknowledged" } : entry)),
      )

      toast({
        title: "Command Acknowledged",
        description: "The command has been acknowledged.",
      })
    } catch (error) {
      console.error("Failed to acknowledge command:", error)
      toast({
        title: "Error",
        description: "Failed to acknowledge command.",
        variant: "destructive",
      })
    }
  }

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

      // Optimistically update the local state
      setControlHistory((prevHistory) => prevHistory.filter((entry) => entry.id !== commandId))

      toast({
        title: "Command Deleted",
        description: "The command has been deleted.",
      })
    } catch (error) {
      console.error("Failed to delete command:", error)
      toast({
        title: "Error",
        description: "Failed to delete command.",
        variant: "destructive",
      })
    }
  }

  // Logic evaluation handler
  // Fix the logic evaluation function to properly call airHandlerControl
  const evaluateLogic = async () => {
    if (isEvaluatingLogicRef.current) return

    isEvaluatingLogicRef.current = true
    try {
      // Validate ControlValues using Zod
      try {
        // Fix any invalid data types before validation
        const validatedControlValues = { ...controlValues }

        // Ensure pidControllers is an object
        if (
          typeof validatedControlValues.pidControllers !== "object" ||
          validatedControlValues.pidControllers === null
        ) {
          validatedControlValues.pidControllers = {
            heating: { ...defaultPIDSettings, reverseActing: true },
            cooling: { ...defaultPIDSettings },
            outdoorDamper: { ...defaultPIDSettings },
          }
        }

        // Add debugging log to see what's being validated
        console.log("Validating controlValues:", JSON.stringify(validatedControlValues, null, 2))
        AirHandlerControlsSchema.parse(validatedControlValues)
      } catch (error) {
        console.error("ControlValues validation failed:", error)
        toast({
          title: "Validation Error",
          description: "Control settings failed validation. Check your input values.",
          variant: "destructive",
        })
        return
      }

      // Create a sandbox environment for the code to run in
      const sandbox = {
        metrics: metrics,
        settings: controlValues,
        console: {
          log: (...args: any[]) => {
            console.log(...args)
          },
          warn: (...args: any[]) => {
            console.warn(...args)
          },
          error: (...args: any[]) => {
            console.error(...args)
          },
        },
      }

      const sandboxProxy = new Proxy(sandbox, {
        get: (target, prop) => {
          if (typeof prop === "string" && prop in target) {
            return target[prop]
          }
          // Return a safe default value or handle the missing property
          console.warn(`Attempted to access missing property: ${String(prop)}`)
          return undefined
        },
      })

      // Wrap the code in a try-catch block to handle errors
      try {
        // Extract the airHandlerControl function from the custom logic
        const customLogicCode = controlValues.customLogic || defaultLogic

        // Create a function that will execute the custom logic and return the airHandlerControl function
        const getAirHandlerControlFn = new Function(
          "return (function() { " +
            customLogicCode +
            '\nreturn typeof airHandlerControl === "function" ? airHandlerControl : function() { return {}; }; })();',
        )

        // Get the airHandlerControl function
        const airHandlerControlFn = getAirHandlerControlFn()

        // Add detailed debug logging
        console.log("Evaluating logic with:", {
          supplyTemp: sandboxProxy.metrics.supplyTemperature,
          setpoint: sandboxProxy.settings.supplyAirTempSetpoint,
          operationMode: sandboxProxy.settings.operationMode,
          pidEnabled: {
            heating: sandboxProxy.settings.pidControllers?.heating?.enabled,
            cooling: sandboxProxy.settings.pidControllers?.cooling?.enabled,
          },
        })

        // Execute the airHandlerControl function with the sandbox data
        const result = airHandlerControlFn(sandboxProxy.metrics, sandboxProxy.settings)

        // Log the result
        console.log("Logic evaluation result:", result)

        // Fix for PID controller output - if we're in cooling mode with PID enabled, make sure the cooling valve is open
        if (
          result &&
          sandboxProxy.settings.operationMode === "cooling" &&
          sandboxProxy.settings.pidControllers?.cooling?.enabled &&
          sandboxProxy.metrics.supplyTemperature > sandboxProxy.settings.supplyAirTempSetpoint
        ) {
          // Calculate a proper cooling valve position based on the temperature difference
          const tempDiff = sandboxProxy.metrics.supplyTemperature - sandboxProxy.settings.supplyAirTempSetpoint
          const coolingValvePosition = Math.min(100, Math.max(0, tempDiff * 10)) // 10% per degree difference

          console.log("Fixing cooling valve position:", coolingValvePosition)

          // Update the result
          result.coolingValvePosition = coolingValvePosition

          // Update the commands
          if (Array.isArray(result.commands)) {
            // Find and update the cooling valve command
            const coolingValveCommand = result.commands.find((cmd) => cmd.type === "update_coolingValvePosition")
            if (coolingValveCommand) {
              coolingValveCommand.value = coolingValvePosition
            } else {
              // Add a new command if not found
              result.commands.push({ type: "update_coolingValvePosition", value: coolingValvePosition })
            }
          }
        }

        // Check if the result is an object and contains a commands array
        if (result && typeof result === "object" && Array.isArray(result.commands)) {
          // Iterate through the commands array and execute each command
          for (const command of result.commands) {
            if (command && typeof command === "object" && command.type && command.value !== undefined) {
              // Execute the command using sendControlCommand
              await sendControlCommand(command.type, command.value, command.metadata)

              // Also update local state for immediate feedback
              const controlKey = command.type.replace(/^update_/, "")
              setControlValues((prev) => ({
                ...prev,
                [controlKey]: command.value,
              }))
            } else {
              console.warn("Invalid command format:", command)
            }
          }
        } else if (result && typeof result === "object") {
          // Iterate through the result object and execute each command
          for (const key in result) {
            if (result.hasOwnProperty(key) && key !== "commands") {
              // Construct the command type from the key
              const commandType = `update_${key}`

              // Execute the command using sendControlCommand
              await sendControlCommand(commandType, result[key])

              // Also update local state for immediate feedback
              setControlValues((prev) => ({
                ...prev,
                [key]: result[key],
              }))
            }
          }
        } else {
          console.warn("No commands found in the evaluation result.")
        }

        // Update the logic evaluation state with the result
        setLogicEvaluation({
          result,
          timestamp: Date.now(),
          hasChanges: true,
        })
      } catch (error) {
        // Log the error
        console.error("Logic evaluation error:", error)

        // Update the logic evaluation state with the error
        setLogicEvaluation({
          result: null,
          error: error.message,
          timestamp: Date.now(),
          hasChanges: true,
        })
      }
    } finally {
      isEvaluatingLogicRef.current = false
    }
  }

  // Add auto-evaluation timer
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null

    // If custom logic is enabled, set up auto-evaluation
    if (controlValues.customLogicEnabled) {
      // Initial evaluation
      evaluateLogic()

      // Set up timer for periodic evaluation (every 15 seconds)
      timer = setInterval(() => {
        evaluateLogic()
      }, 15000)
    }

    // Clean up timer on unmount or when customLogicEnabled changes
    return () => {
      if (timer) {
        clearInterval(timer)
      }
    }
  }, [controlValues.customLogicEnabled, metrics, controlValues])

  // Add function to save and apply all settings

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

  const handleAuthenticate = async () => {
    setIsSubmitting(true)
    setLoginError("")

    try {
      const success = await loginWithUsername(username, password)
      if (success) {
        // setShowAuthDialog(false)
        setUsername("")
        setPassword("")
        setLoginError("")

        // Execute the pending action if any
        if (pendingAction) {
          pendingAction()
          setPendingAction(null)
        }
      } else {
        setLoginError("Invalid credentials")
      }
    } catch (error) {
      console.error("Authentication failed:", error)
      setLoginError("Authentication failed")
    } finally {
      setIsSubmitting(false)
    }
  }

  // General controls handler
  const handleGeneralControlChange = (key: string, value: any) => {
    // Update local state immediately
    const updatedValues = {
      ...controlValues,
      [key]: value,
    }

    setControlValues(updatedValues)

    // Send the complete state
    const success = sendCompleteState(updatedValues)

    if (success) {
      setHasUnsavedChanges(true)
    }
  }

  // Outdoor air reset handler
  const handleOutdoorAirResetChange = (key: string, value: any) => {
    const updatedOutdoorAirReset = {
      ...controlValues.outdoorAirReset,
      [key]: value,
    }

    // Update local state immediately
    const updatedValues = {
      ...controlValues,
      outdoorAirReset: updatedOutdoorAirReset,
    }

    setControlValues(updatedValues)

    // Send the complete state
    const success = sendCompleteState(updatedValues)

    if (success) {
      setHasUnsavedChanges(true)
    }
  }

  // Custom logic handler
  const handleCustomLogicChange = (value: string) => {
    // Update local state immediately
    const updatedValues = {
      ...controlValues,
      customLogic: value,
    }

    setControlValues(updatedValues)
    setHasUnsavedChanges(true)
  }

  // Custom logic enabled handler
  const handleCustomLogicEnabledChange = (checked: boolean) => {
    // Update local state immediately
    const updatedValues = {
      ...controlValues,
      customLogicEnabled: checked,
    }

    setControlValues(updatedValues)

    // Send the complete state
    const success = sendCompleteState(updatedValues)

    if (success) {
      setHasUnsavedChanges(true)
    }
  }

  // Run logic now handler
  const runLogicNow = () => {
    evaluateLogic()
  }

  // Render component
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">{equipment.name || "Air Handler Controls"}</h2>
        <Button
          onClick={saveAndApplySettings}
          disabled={isSubmitting || !hasUnsavedChanges}
          className="bg-[#d2f4ea] hover:bg-[#b5e9d8] text-black"
        >
          {isSubmitting ? (
            <span className="flex items-center">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </span>
          ) : (
            "Save Controls"
          )}
        </Button>
      </div>

      <Tabs defaultValue="general" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="border-b w-full justify-start">
          <TabsTrigger value="general" className="data-[state=active]:border-orange-500">
            General
          </TabsTrigger>
          <TabsTrigger value="pid" className="data-[state=active]:border-orange-500">
            PID Settings
          </TabsTrigger>
          <TabsTrigger value="oar" className="data-[state=active]:border-orange-500">
            Outdoor Air Reset
          </TabsTrigger>
          <TabsTrigger value="custom-logic" className="data-[state=active]:border-orange-500">
            Custom Logic
          </TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:border-orange-500">
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <AirHandlerGeneralControls controls={controlValues} onControlChange={handleGeneralControlChange} />
        </TabsContent>

        <TabsContent value="pid">
          <AirHandlerPIDSettings pidControllers={controlValues.pidControllers} onPidChange={handlePidChange} />
        </TabsContent>

        <TabsContent value="oar">
          <AirHandlerOutdoorAirReset
            outdoorAirReset={controlValues.outdoorAirReset}
            onOutdoorAirResetChange={handleOutdoorAirResetChange}
          />
        </TabsContent>

        <TabsContent value="custom-logic">
          <AirHandlerCustomLogic
            customLogic={controlValues.customLogic}
            customLogicEnabled={controlValues.customLogicEnabled}
            autoSyncEnabled={autoSyncEnabled}
            setAutoSyncEnabled={setAutoSyncEnabled}
            onCustomLogicChange={handleCustomLogicChange}
            onCustomLogicEnabledChange={handleCustomLogicEnabledChange}
            runLogicNow={runLogicNow}
            logicEvaluation={logicEvaluation}
            sandbox={{
              metrics: metrics,
              settings: controlValues,
            }}
          />
        </TabsContent>

        <TabsContent value="history">
          <AirHandlerCommandHistory
            controlHistory={controlHistory}
            onDeleteCommand={handleDeleteCommand}
            renderStatusIcon={renderStatusIcon}
            getCommandDescription={getCommandDescription}
          />
        </TabsContent>
      </Tabs>

      {/* Apply Changes Button at the bottom */}
      <div className="flex justify-end mt-4">
        <Button
          onClick={saveAndApplySettings}
          disabled={isSubmitting || !hasUnsavedChanges}
          className="bg-[#d2f4ea] hover:bg-[#b5e9d8] text-black"
        >
          {isSubmitting ? (
            <span className="flex items-center">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Applying...
            </span>
          ) : (
            "Apply Changes"
          )}
        </Button>
      </div>
    </div>
  )
}
