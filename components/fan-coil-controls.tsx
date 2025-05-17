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
import { create } from "zustand"
import { ControlLogicManager } from "@/lib/control-logic-manager"

// Import our component types
import type { FanCoilControlsProps, ControlValues, PIDSettings, ControlHistoryEntry, LogicEvaluation } from "./types"
import { FanCoilGeneralControls } from "./fan-coil-general-controls"

// Define Zod schema for ControlValues for data validation
const ControlValuesSchema: z.ZodType<ControlValues> = z.object({
  fanSpeed: z.string(),
  fanMode: z.string(),
  fanEnabled: z.boolean(),
  heatingValvePosition: z.number(),
  coolingValvePosition: z.number(),
  heatingValveMode: z.string(),
  coolingValveMode: z.string(),
  temperatureSetpoint: z.number(),
  operationMode: z.string(),
  unitEnable: z.boolean(),
  customLogicEnabled: z.boolean().optional(),
  customLogic: z.string().optional(),
  outdoorDamperPosition: z.number().optional(),
  pidControllers: z
    .object({
      heating: z
        .object({
          kp: z.number(),
          ki: z.number(),
          kd: z.number(),
          enabled: z.boolean(),
          outputMin: z.number(),
          outputMax: z.number(),
          sampleTime: z.number(),
          setpoint: z.number().optional(),
          reverseActing: z.boolean(),
        })
        .optional(),
      cooling: z
        .object({
          kp: z.number(),
          ki: z.number(),
          kd: z.number(),
          enabled: z.boolean(),
          outputMin: z.number(),
          outputMax: z.number(),
          sampleTime: z.number(),
          setpoint: z.number().optional(),
          reverseActing: z.boolean(),
        })
        .optional(),
      outdoorDamper: z
        .object({
          kp: z.number(),
          ki: z.number(),
          kd: z.number(),
          enabled: z.boolean(),
          outputMin: z.number(),
          outputMax: z.number(),
          sampleTime: z.number(),
          setpoint: z.number().optional(),
          reverseActing: z.boolean(),
        })
        .optional(),
    })
    .optional(),
  outdoorAirReset: z
    .object({
      enabled: z.boolean(),
      outdoorTempLow: z.number(),
      outdoorTempHigh: z.number(),
      setpointLow: z.number(),
      setpointHigh: z.number(),
    })
    .optional(),
})

// Update the defaultPIDSettings to include reverseActing
const defaultPIDSettings: PIDSettings = {
  kp: 1.0,
  ki: 0.1,
  kd: 0.01,
  enabled: true, // Changed from false to true
  outputMin: 0,
  outputMax: 100,
  sampleTime: 1000,
  reverseActing: false,
}

// Add this default logic constant after the interfaces
const defaultLogic = `// Fan Coil Control Logic
function fanCoilControl(metrics, settings) {
  // Get current temperatures with proper fallbacks
  const currentTemp = metrics.Supply || metrics.roomTemp || metrics.coveTemp || metrics.chapelTemp || metrics.kitchenTemp ||
    metrics.mailRoomTemp || metrics.spaceTemp || metrics.SpaceTemp || metrics.zoneTemp ||
    metrics.ZoneTemp || 72;
  const setpoint = settings.temperatureSetpoint || 72; // Global setpoint for all controllers
  const deadband = 1; // Reduce deadband to 1°F for more responsive control

  console.log("Current temp:", currentTemp, "Setpoint:", setpoint);

  // Determine if we need heating or cooling based on the temperature difference
  let operationMode = settings.operationMode;

  // If in auto mode, determine whether to heat or cool
  if (operationMode === "auto") {
    if (currentTemp < setpoint - deadband) {
      operationMode = "heating";
      console.log("Auto mode selected heating");
    } else if (currentTemp > setpoint + deadband) {
      operationMode = "cooling";
      console.log("Auto mode selected cooling");
    } else {
      console.log("Auto mode - within deadband, maintaining current state");
    }
  }

  console.log("Operating in mode:", operationMode);

  // Access PID controller settings if needed - safely handle undefined values
  const pidSettings = settings.pidControllers || {};

  // Check for outdoor damper control first
  let outdoorDamperPosition;

  // Get outdoor temperature with fallbacks
  const outdoorTemp = metrics.outdoorTemperature || metrics.outdoorTemp || metrics.Outdoor || 50;

  // Check if PID controller is enabled for outdoor damper
  if (pidSettings.outdoorDamper &&
      typeof pidSettings.outdoorDamper === 'object' &&
      pidSettings.outdoorDamper.enabled === true) {
    // PID controller is enabled for outdoor damper
    console.log("Using PID controller for outdoor damper");
    // PID logic would be handled separately
    const kp = pidSettings.outdoorDamper.kp || 1.0;
    const ki = pidSettings.outdoorDamper.ki || 0.1;
    const kd = pidSettings.outdoorDamper.kd || 0.01;
    const outputMin = pidSettings.outdoorDamper.outputMin || 0;
    const outputMax = pidSettings.outdoorDamper.outputMax || 100;
    const reverseActing = !!pidSettings.outdoorDamper.reverseActing;

    // Example PID calculation for outdoor damper
    const damperSetpoint = 70; // Example setpoint for outdoor air
    const error = damperSetpoint - outdoorTemp;

    const output = pidController(
      outdoorTemp,
      damperSetpoint,
      kp,
      ki,
      kd,
      1.0, // dt (time step)
      outputMin,
      outputMax,
      'outdoorDamper' // Add controller type
    );

    // Apply reverse acting logic if configured
    outdoorDamperPosition = reverseActing ? outputMax - output.output : output.output;
    outdoorDamperPosition = Math.max(0, Math.min(100, outdoorDamperPosition)) / 100; // Ensure it's between 0-1 range
  } else {
    // Binary control based on outdoor temperature
    if (outdoorTemp > 40 && outdoorTemp < 90) {
      console.log("Outdoor temp between 40°F and 90°F, opening outdoor damper");
      outdoorDamperPosition = 1; // Open damper (binary control)
    } else {
      console.log("Outdoor temp outside 40-90°F range, closing outdoor damper");
      outdoorDamperPosition = 0; // Close damper (binary control)
    }
  }

  // Use PID controllers if enabled - with proper null/undefined checks
  if (operationMode === "heating" &&
      pidSettings.heating &&
      typeof pidSettings.heating === 'object' &&
      pidSettings.heating.enabled === true) {

    // Safely extract PID parameters with defaults
    const kp = pidSettings.heating.kp || 1.0;
    const ki = pidSettings.heating.ki || 0.1;
    const kd = pidSettings.heating.kd || 0.01;
    const outputMin = pidSettings.heating.outputMin || 0;
    const outputMax = pidSettings.heating.outputMax || 100;
    const reverseActing = !!pidSettings.heating.reverseActing;

    // Use the global setpoint with heating PID controller
    const error = setpoint - currentTemp;
    console.log("Using heating PID controller with Kp:", kp, "Error:", error);

    // Example PID calculation for heating
    const output = pidController(
      currentTemp,
      setpoint,
      kp,
      ki,
      kd,
      1.0, // dt (time step)
      outputMin,
      outputMax,
      'heating' // Add controller type
    );

    // Apply reverse acting logic if configured
    let finalOutput = output.output;
    if (reverseActing) {
      finalOutput = outputMax - finalOutput;
    }

    return {
      heatingValvePosition: finalOutput,
      coolingValvePosition: 0,
      fanEnabled: true,
      fanSpeed: "medium",
      outdoorDamperPosition: outdoorDamperPosition // Include outdoor damper position
    };
  }

  if (operationMode === "cooling" &&
    pidSettings.cooling &&
    typeof pidSettings.cooling === 'object' &&
    pidSettings.cooling.enabled === true) {

    // Safely extract PID parameters with defaults
    const kp = pidSettings.cooling.kp || 1.0;
    const ki = pidSettings.cooling.ki || 0.1;
    const kd = pidSettings.cooling.kd || 0.01;
    const outputMin = pidSettings.cooling.outputMin || 0;
    const outputMax = pidSettings.cooling.outputMax || 100;
    const reverseActing = !!pidSettings.cooling.reverseActing;

    // For cooling, we need to reverse the error calculation (higher temp = higher error)
    const error = currentTemp - setpoint; // Positive error means we need cooling
    console.log("Using cooling PID controller with Kp:", kp, "Error:", error);

    // Example PID calculation for cooling
    const output = pidController(
      currentTemp,
      setpoint,
      kp,
      ki,
      kd,
      1.0, // dt (time step)
      outputMin,
      outputMax,
      'cooling' // Add controller type
    );

    // Apply reverse acting logic if configured
    let finalOutput = output.output;
    if (reverseActing) {
      finalOutput = outputMax - finalOutput;
    }

    // Ensure cooling valve position is properly set based on temperature difference
    if (currentTemp > setpoint) {
      console.log("Cooling needed: Current temp", currentTemp, "is above setpoint", setpoint);
      console.log("Setting cooling valve position to:", finalOutput);
    } else {
      console.log("No cooling needed: Current temp", currentTemp, "is below setpoint", setpoint);
      // Still use PID output for smoother control
    }

    return {
      coolingValvePosition: finalOutput,
      heatingValvePosition: 100, // Fully closed for reverse acting heating valve
      fanEnabled: true,
      fanSpeed: "medium",
      outdoorDamperPosition: outdoorDamperPosition // Include outdoor damper position
    };
  }

  // Binary control logic when PID is not enabled
  // Simple control logic based on mode
  if (operationMode === "cooling") {
    // Cooling mode logic - binary control
    if (currentTemp > setpoint + deadband) {
      console.log("Cooling: Opening cooling valve");
      return {
        coolingValvePosition: 100, // Fully open cooling valve
        heatingValvePosition: 100, // Fully closed for reverse acting heating valve
        fanEnabled: true,
        fanSpeed: "medium",
        outdoorDamperPosition: outdoorDamperPosition // Include outdoor damper position
      };
    } else if (currentTemp < setpoint - deadband) {
      console.log("Cooling: Closing cooling valve");
      return {
        coolingValvePosition: 0, // Fully closed cooling valve
        heatingValvePosition: 100, // Fully closed for reverse acting heating valve
        fanEnabled: true,
        fanSpeed: "low",
        outdoorDamperPosition: outdoorDamperPosition // Include outdoor damper position
      };
    }
  } else if (operationMode === "heating") {
    // Heating mode logic - binary control
    if (currentTemp < setpoint - deadband) {
      console.log("Heating: Opening heating valve (reverse acting)");
      return {
        heatingValvePosition: 0, // Fully open heating valve (reverse acting)
        coolingValvePosition: 0,
        fanEnabled: true,
        fanSpeed: "medium",
        outdoorDamperPosition: outdoorDamperPosition // Include outdoor damper position
      };
    } else if (currentTemp > setpoint + deadband) {
      console.log("Heating: Closing heating valve (reverse acting)");
      return {
        heatingValvePosition: 100, // Fully closed heating valve (reverse acting)
        coolingValvePosition: 0,
        fanEnabled: true,
        fanSpeed: "low",
        outdoorDamperPosition: outdoorDamperPosition // Include outdoor damper position
      };
    }
  }

  // Default: maintain current state if within deadband
  console.log("Within deadband, maintaining current state");
  return {
    coolingValvePosition: settings.coolingValvePosition || 0,
    heatingValvePosition: settings.heatingValvePosition || 0,
    fanEnabled: settings.fanEnabled !== undefined ? settings.fanEnabled : true,
    fanSpeed: settings.fanSpeed || "low",
    outdoorDamperPosition: outdoorDamperPosition // Include outdoor damper position
  };
}

// Helper Functions
function calculateValvePosition(currentTemp, setpoint, mode) {
  // Add your valve position calculation logic here
  const error = mode === "cooling" ? currentTemp - setpoint : setpoint - currentTemp;
  return Math.max(0, Math.min(100, error * 10));
}

// PID Controller Implementation
function pidController(input, setpoint, kp, ki, kd, dt, outputMin, outputMax, controllerType) {
  // Get the current state for this controller - use the controllerType parameter
  // Make sure controllerType is treated as a string
  const controllerKey = String(controllerType);
  const state = pidState[controllerKey] || { integral: 0, previousError: 0, lastOutput: 0 };

  // Calculate error - special handling for cooling
  let error;
  if (controllerKey === 'cooling') {
    // For cooling, higher temp means positive error (need more cooling)
    error = input - setpoint;
  } else {
    // For heating and other controls, lower temp means positive error
    error = setpoint - input;
  }

  // Calculate integral with anti-windup
  let integral = state.integral + (error * dt);

  // Anti-windup - limit integral to prevent excessive buildup
  const maxIntegral = (outputMax - outputMin) / (ki || 0.1); // Avoid division by zero
  integral = Math.max(Math.min(integral, maxIntegral), -maxIntegral);

  // Calculate derivative
  const derivative = (error - state.previousError) / dt;

  // Calculate output
  let output = kp * error + ki * integral + kd * derivative;

  // Clamp output
  output = Math.max(outputMin, Math.min(outputMax, output));

  console.log(\`PID Controller (\${controllerKey}): Error=\${error.toFixed(2)}, Integral=\${integral.toFixed(2)}, Derivative=\${derivative.toFixed(2)}, Output=\${output.toFixed(2)}\`);

  // Return the result with updated state values
  return {
    output,
    newState: {
      integral,
      previousError: error,
      lastOutput: output
    }
  };
}

// IMPORTANT: Never directly destructure from a variable named 'pid'
// Always check if objects exist before accessing their properties
`

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
  ) => Promise<void> // add equipmentId
}

const usePIDStore = create<PIDState>((set, get) => ({
  pidControllers: {
    heating: { ...defaultPIDSettings, reverseActing: true },
    cooling: { ...defaultPIDSettings },
    outdoorDamper: { ...defaultPIDSettings },
  },
  setPIDControllers: async (newPIDControllers, equipmentId) => {
    // Function to update PID settings
    set({ pidControllers: newPIDControllers })
    console.log("PID settings updated:", newPIDControllers)

    // Save to Firestore and RTDB (implement your saving logic here)
    // Example:
    try {
      // Save to Firestore
      if (db && equipmentId) {
        const equipmentRef = doc(db, "equipment", equipmentId)
        await updateDoc(equipmentRef, {
          "controls.pidControllers": newPIDControllers,
          lastUpdated: new Date(),
        })
        console.log("PID settings saved to Firestore")
      }

      // Save to RTDB (implement your saving logic here)
      // Send command to update PID controllers
    } catch (error) {
      console.error("Error saving PID settings:", error)
    }
  },
}))

// Function to get command description
const getCommandDescription = (command: string): string => {
  switch (command) {
    case "update_fan_speed":
      return "Fan Speed"
    case "update_fan_mode":
      return "Fan Mode"
    case "update_fan_enable":
      return "Fan Enable"
    case "update_heating_valve":
      return "Heating Valve Position"
    case "update_cooling_valve":
      return "Cooling Valve Position"
    case "update_heating_valve_mode":
      return "Heating Valve Mode"
    case "update_cooling_valve_mode":
      return "Cooling Valve Mode"
    case "update_temperature_setpoint":
      return "Temperature Setpoint"
    case "update_operation_mode":
      return "Operation Mode"
    case "update_unit_enable":
      return "Unit Enable"
    case "update_customLogicEnabled":
      return "Custom Logic Enable"
    case "update_customLogic":
      return "Custom Logic"
    case "update_outdoor_damper_position":
      return "Outdoor Damper Position"
    case "update_pidControllers":
      return "PID Controllers"
    case "update_outdoorAirReset":
      return "Outdoor Air Reset"
    default:
      return command
  }
}

// Main component
export function FanCoilControls({ equipment, metrics, values, onChange }: FanCoilControlsProps) {
  // Add loading state
  const [isLoading, setIsLoading] = useState(true)
  // Add autoSync state
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true)
  // Add logic loading state
  const [isLogicLoading, setIsLogicLoading] = useState(false)

  // Add these state variables to store PID state between evaluations
  const [pidState, setPidState] = useState({
    heating: {
      integral: 0,
      previousError: 0,
      lastOutput: 0,
    },
    cooling: {
      integral: 0,
      previousError: 0,
      lastOutput: 0,
    },
    outdoorDamper: {
      integral: 0,
      previousError: 0,
      lastOutput: 0,
    },
  })

  // --- States ---
  const [logicEvaluation, setLogicEvaluation] = useState<LogicEvaluation | null>(null)
  const [controlValues, setControlValues] = useState<ControlValues>({
    ...equipment.controls,
    heatingValveMode: equipment.controls?.heatingValveMode || "auto",
    coolingValveMode: equipment.controls?.coolingValveMode || "auto",
    fanMode: equipment.controls?.fanMode || "auto",
    fanSpeed: equipment.controls?.fanSpeed || "low",
    temperatureSetpoint: equipment.controls?.temperatureSetpoint || 72,
    operationMode: equipment.controls?.operationMode || "auto",
    heatingValvePosition: equipment.controls?.heatingValvePosition || 0,
    coolingValvePosition: equipment.controls?.coolingValvePosition || 0,
    fanEnabled: true, // Always default to true
    unitEnable: true, // Always default to true
    customLogicEnabled: true, // Always default to true
    customLogic: equipment.controls?.customLogic || defaultLogic,
    outdoorDamperPosition: equipment.controls?.outdoorDamperPosition || 0,
    // Initialize PID controllers with defaults if not present, with heating and cooling enabled by default
    pidControllers: equipment.controls?.pidControllers || {
      heating: { ...defaultPIDSettings, reverseActing: true, enabled: true }, // Explicitly set enabled to true
      cooling: { ...defaultPIDSettings, enabled: true }, // Explicitly set enabled to true
      outdoorDamper: { ...defaultPIDSettings, enabled: false }, // Set to false by default
    },
    // Initialize Outdoor Air Reset settings with defaults if not present
    outdoorAirReset: equipment.controls?.outdoorAirReset || {
      enabled: true,
      outdoorTempLow: 32,
      outdoorTempHigh: 72,
      setpointLow: 75,
      setpointHigh: 71,
    },
  })

  const [previousControlValues, setPreviousControlValues] = useState<ControlValues>({
    ...equipment.controls,
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

  // Create a reference to the ControlLogicManager
  const logicManagerRef = useRef<ControlLogicManager | null>(null)

  // Function to fetch control logic from the database
  const fetchControlLogic = useCallback(async () => {
    if (!equipment?.id) return null

    try {
      setIsLogicLoading(true)

      // Initialize the logic manager if not already done
      if (!logicManagerRef.current) {
        logicManagerRef.current = new ControlLogicManager()
      }

      // Get the latest logic for this equipment
      const logicData = await logicManagerRef.current.getLatestLogic(equipment.id)

      // Check if we got valid logic data
      if (logicData && logicData.code && logicData.code.length > 0) {
        const controlLogicCode = logicData.code[0].as_py()
        console.log(`Retrieved logic for ${equipment.id}: ${controlLogicCode.substring(0, 100)}...`)
        return controlLogicCode
      } else {
        console.log(`No logic found for ${equipment.id}, using default logic`)
        return defaultLogic
      }
    } catch (error) {
      console.error("Error fetching control logic:", error)
      return defaultLogic
    } finally {
      setIsLogicLoading(false)
    }
  }, [equipment?.id])

  // Function to save control logic to the database
  const saveControlLogic = useCallback(
    async (logicCode: string) => {
      if (!equipment?.id || !user?.id) return false

      try {
        // Initialize the logic manager if not already done
        if (!logicManagerRef.current) {
          logicManagerRef.current = new ControlLogicManager()
        }

        // Save the logic for this equipment
        await logicManagerRef.current.addLogic(
          equipment.id,
          "1.0", // Version
          logicCode,
          user?.name || "system",
        )

        console.log(`Saved logic for ${equipment.id}`)
        return true
      } catch (error) {
        console.error("Error saving control logic:", error)
        return false
      }
    },
    [equipment?.id, user?.id, user?.name],
  )

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

                  // Special handling for custom logic to ensure it's properly loaded
                  if (controlKey === "customLogic" && latestCommand.value) {
                    console.log("Loaded custom logic from database:", latestCommand.value.substring(0, 100) + "...")
                  }
                }
              }
            })

            // Try to fetch control logic from the InfluxDB 3 database
            const controlLogic = await fetchControlLogic()

            // Update control values with the latest values from Firebase
            setControlValues((prev) => {
              // Create a new object with the previous values and the latest values from Firebase
              const updatedValues = {
                ...prev,
                ...latestControls,
                // Use the fetched control logic or fall back to default logic
                customLogic: controlLogic || defaultLogic,
              }

              // Ensure PID controllers are properly initialized from the database
              if (latestControls.pidControllers) {
                // Make sure we preserve the enabled state for heating and cooling
                updatedValues.pidControllers = {
                  heating: {
                    ...defaultPIDSettings,
                    reverseActing: true,
                    enabled: true,
                    ...(prev.pidControllers?.heating || {}),
                    ...(latestControls.pidControllers.heating || {}),
                  },
                  cooling: {
                    ...defaultPIDSettings,
                    enabled: true,
                    ...(prev.pidControllers?.cooling || {}),
                    ...(latestControls.pidControllers?.cooling || {}),
                  },
                  outdoorDamper: {
                    ...defaultPIDSettings,
                    ...(prev.pidControllers?.outdoorDamper || {}),
                    ...(latestControls.pidControllers.outdoorDamper || {}),
                  },
                }

                console.log("PID controllers loaded from database:", updatedValues.pidControllers)
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
  }, [equipment?.locationId, equipment?.id, secondaryDb, fetchControlLogic])

  // Add a new effect to update the PID store when controlValues.pidControllers changes
  // Add this helper function at the top of your component
  const isEqual = (obj1: any, obj2: any) => {
    return JSON.stringify(obj1) === JSON.stringify(obj2)
  }

  // Then modify the effect:
  const prevPidControllersRef = useRef(controlValues.pidControllers)

  useEffect(() => {
    if (
      controlValues.pidControllers &&
      equipment?.id &&
      !isEqual(prevPidControllersRef.current, controlValues.pidControllers)
    ) {
      // Update the PID store to keep it in sync with controlValues
      usePIDStore.getState().setPIDControllers(controlValues.pidControllers, equipment.id)
      prevPidControllersRef.current = controlValues.pidControllers
    }
  }, [controlValues.pidControllers, equipment?.id])

  // Update the sandbox object to include all possible temperature sources  equipment?.id])

  // Update the sandbox object to include all possible temperature sources
  // Replace the existing sandbox definition with this more comprehensive one
  // Memoize the sandbox object to prevent infinite loops
  const sandbox = useMemo(
    () => ({
      metrics: {
        roomTemperature:
          metrics?.roomTemperature ||
          metrics?.roomTemp ||
          metrics?.coveTemp ||
          metrics?.chapelTemp ||
          metrics?.kitchenTemp ||
          metrics?.mailRoomTemp ||
          metrics?.spaceTemp ||
          metrics?.SpaceTemp ||
          metrics?.zoneTemp ||
          metrics?.ZoneTemp ||
          metrics?.RoomTemp ||
          metrics?.ZoneTemperature ||
          metrics?.zone_temperature ||
          metrics?.room_temperature ||
          72,
        supplyTemperature:
          metrics?.supplyTemperature ||
          metrics?.supplyTemp ||
          metrics?.Supply ||
          metrics?.supply ||
          metrics?.SupplyTemp ||
          metrics?.supply_temperature ||
          metrics?.supply_temp ||
          metrics?.dischargeTemperature ||
          metrics?.dischargeTemp ||
          metrics?.DischargeTemperature ||
          metrics?.DischargeTemp ||
          metrics?.Discharge ||
          metrics?.discharge ||
          metrics?.discharge_temperature ||
          metrics?.discharge_temp ||
          metrics?.SAT ||
          metrics?.sat ||
          metrics?.SupplyAirTemp ||
          metrics?.supplyAirTemp ||
          metrics?.SupplyAirTemperature ||
          metrics?.supplyAirTemperature ||
          55,
        returnTemperature:
          metrics?.returnTemperature ||
          metrics?.returnTemp ||
          metrics?.Return ||
          metrics?.return ||
          metrics?.ReturnTemp ||
          metrics?.return_temperature ||
          metrics?.return_temp ||
          metrics?.RAT ||
          metrics?.rat ||
          metrics?.ReturnAirTemp ||
          metrics?.returnAirTemp ||
          metrics?.ReturnAirTemperature ||
          metrics?.returnAirTemperature ||
          75,
        outdoorTemperature:
          metrics?.outdoorTemperature ||
          metrics?.outdoorTemp ||
          metrics?.Outdoor ||
          metrics?.outdoor ||
          metrics?.OutdoorTemp ||
          metrics?.OutdoorAir ||
          metrics?.outdoorAir ||
          metrics?.outdoorAirTemp ||
          metrics?.OutdoorAirTemp ||
          metrics?.OutdoorAirTemperature ||
          metrics?.outdoorAirTemperature ||
          metrics?.outdoor_temperature ||
          metrics?.outdoor_temp ||
          metrics?.outdoor_air_temp ||
          metrics?.outdoor_air_temperature ||
          metrics?.OAT ||
          metrics?.oat ||
          metrics?.OutsideAirTemp ||
          metrics?.outsideAirTemp ||
          metrics?.OutsideTemp ||
          metrics?.outsideTemp ||
          85,
        // Make sure all raw metrics are available with their original names
        Supply: metrics?.Supply,
        Return: metrics?.Return,
        Outdoor: metrics?.Outdoor,
        Setpoint: metrics?.Setpoint || controlValues.temperatureSetpoint,
        // Include all additional temperature metrics
        coveTemp: metrics?.coveTemp,
        chapelTemp: metrics?.chapelTemp,
        kitchenTemp: metrics?.kitchenTemp,
        mailRoomTemp: metrics?.mailRoomTemp,
        spaceTemp: metrics?.spaceTemp,
        SpaceTemp: metrics?.SpaceTemp,
        zoneTemp: metrics?.zoneTemp,
        ZoneTemp: metrics?.ZoneTemp,
        // Include valve positions
        valvePosition: {
          heating:
            metrics?.valve_position?.heating ||
            metrics?.valvePosition?.heating ||
            controlValues.heatingValvePosition ||
            0,
          cooling:
            metrics?.valve_position?.cooling ||
            metrics?.valvePosition?.cooling ||
            controlValues.coolingValvePosition ||
            0,
        },
        fanStatus: metrics?.fan_status || metrics?.fanStatus || (controlValues.fanEnabled ? "on" : "off"),
        fanSpeed: metrics?.fan_speed || metrics?.fanSpeed || controlValues.fanSpeed || "off",
        // Add raw metrics for advanced logic
        ...metrics,
      },
      settings: {
        temperatureSetpoint: controlValues.temperatureSetpoint,
        operationMode: controlValues.operationMode,
        fanEnabled: controlValues.fanEnabled,
        fanSpeed: controlValues.fanSpeed,
        heatingValvePosition: controlValues.heatingValvePosition,
        coolingValvePosition: controlValues.coolingValvePosition,
        heatingValveMode: controlValues.heatingValveMode,
        coolingValveMode: controlValues.coolingValveMode,
        unitEnable: controlValues.unitEnable,
        pidControllers: controlValues.pidControllers, // Make PID settings available to logic
      },
    }),
    [metrics, controlValues],
  )

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
  // Find the existing useEffect for control values update (around line 450-500) and replace it with:
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

        // Special handling for PID controllers
        if (command === "update_pidControllers" && value) {
          console.log("Saving PID controllers:", value)
          usePIDStore.getState().setPIDControllers(value, equipment.id)
        }

        // Special handling for custom logic - save to InfluxDB 3
        if (command === "update_customLogic" && value) {
          console.log("Saving custom logic to InfluxDB 3")
          await saveControlLogic(value)
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
    [equipment.id, equipment.locationId, controlValues, user, toast, equipment, saveControlLogic],
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

      // Send the complete state to the server
      return await sendControlCommand("update_complete_state", updatedValues, {
        previousValue: previousControlValues,
      })
    } catch (error) {
      console.error("Error sending complete state:", error)
      return false
    }
  }

  // Modify handleValveChange to use sendCompleteState
  const handleValveChange = async (valveType: "heating" | "cooling", value: number) => {
    // Update local state immediately for responsive UI
    const updatedValues = {
      ...controlValues,
      [`${valveType}ValvePosition`]: value,
    }

    setControlValues(updatedValues)

    // Send the complete state
    const success = await sendCompleteState(updatedValues)

    if (success) {
      setHasUnsavedChanges(true)
    }
  }

  // Similarly modify handleFanToggle
  const handleFanToggle = async (enabled: boolean) => {
    // Update local state immediately
    const updatedValues = {
      ...controlValues,
      fanEnabled: enabled,
    }

    setControlValues(updatedValues)

    // Send the complete state
    const success = await sendCompleteState(updatedValues)

    if (success) {
      setHasUnsavedChanges(true)
    }
  }

  // And handleTemperatureSetpointChange
  const handleTemperatureSetpointChange = async (value: number) => {
    console.log("Temperature setpoint changed to:", value)

    // Make sure the value is a valid number
    const numericValue = Number(value)
    if (isNaN(numericValue)) {
      console.error("Invalid temperature setpoint value:", value)
      return
    }

    // Update local state immediately
    const updatedValues = {
      ...controlValues,
      temperatureSetpoint: numericValue,
    }

    setControlValues(updatedValues)

    // First, send a direct command just for the temperature setpoint
    // Make sure to send the plain numeric value
    console.log("Sending direct temperature setpoint update with value:", numericValue)
    const directUpdate = await sendControlCommand("update_temperature_setpoint", numericValue, {
      previousValue: previousControlValues.temperatureSetpoint,
    })

    console.log("Temperature setpoint direct update result:", directUpdate)

    // Then send the complete state update
    const success = await sendCompleteState(updatedValues)

    if (success || directUpdate) {
      setPreviousControlValues((prev) => ({
        ...prev,
        temperatureSetpoint: numericValue,
      }))
      setHasUnsavedChanges(true)
      console.log("Temperature setpoint saved:", numericValue)
    }
  }

  // Add the valve mode change handler
  const onValveModeChange = (valveType: "heating" | "cooling", value: string) => {
    // Update local state immediately
    const updatedValues = {
      ...controlValues,
      [`${valveType}ValveMode`]: value,
    }

    setControlValues(updatedValues)

    // Send the complete state
    sendCompleteState(updatedValues)
      .then((success) => {
        if (success) {
          setHasUnsavedChanges(true)
        }
      })
      .catch((error) => {
        console.error(`Error updating ${valveType} valve mode:`, error)
      })
  }

  // Modify the handleApplyChanges function to ensure PID settings are explicitly saved
  const shouldUpdatePreviousValues = useRef(false)

  const handleApplyChanges = async () => {
    try {
      setIsSubmitting(true)
      console.log("Apply changes button clicked")

      // Set the ref to true before applying changes
      shouldUpdatePreviousValues.current = true

      // Create a complete state object with ALL current values
      const completeState = {
        fanSpeed: controlValues.fanSpeed,
        fanMode: controlValues.fanMode,
        fanEnabled: controlValues.fanEnabled,
        heatingValvePosition: controlValues.heatingValvePosition,
        coolingValvePosition: controlValues.coolingValvePosition,
        heatingValveMode: controlValues.heatingValveMode,
        coolingValveMode: controlValues.coolingValveMode,
        temperatureSetpoint: controlValues.temperatureSetpoint,
        operationMode: controlValues.operationMode,
        unitEnable: controlValues.unitEnable,
        customLogicEnabled: controlValues.customLogicEnabled,
        customLogic: controlValues.customLogic,
        outdoorDamperPosition: controlValues.outdoorDamperPosition,
        pidControllers: controlValues.pidControllers,
        outdoorAirReset: controlValues.outdoorAirReset,
      }

      console.log("Sending complete state update:", completeState)

      // Send the complete state to the server
      const success = await sendControlCommand("update_complete_state", completeState, {
        previousValue: previousControlValues,
      })

      if (success) {
        // Reset hasUnsavedChanges flag
        setHasUnsavedChanges(false)

        // Update previous control values
        setPreviousControlValues(completeState)

        toast({
          title: "Controls Applied",
          description: "All control values have been successfully applied to the equipment",
          className: "bg-teal-50 border-teal-200",
        })
      } else {
        toast({
          title: "Save Error",
          description: "Failed to apply control settings",
          variant: "destructive",
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

  // --- Control Change Handling ---
  const handleControlValueChange = (key: string, value: any) => {
    setControlValues((prev) => ({ ...prev, [key]: value }))
    setHasUnsavedChanges(true)
    console.log(`Control value changed: ${key} = ${value}, hasUnsavedChanges set to true`)
  }

  // Add this function after the handleTemperatureSetpointChange function
  const handleCustomLogicChange = async (value: string) => {
    // Update local state
    setControlValues((prev) => ({
      ...prev,
      customLogic: value || "",
    }))

    // Save to database immediately
    await sendControlCommand("update_customLogic", value, {
      previousValue: previousControlValues.customLogic,
    })

    // Update previous values
    setPreviousControlValues((prev) => ({
      ...prev,
      customLogic: value || "",
    }))

    setHasUnsavedChanges(true)
    console.log("Custom logic updated and saved")
  }

  // Add this useEffect to update previousControlValues whenever controlValues changes
  useEffect(() => {
    if (shouldUpdatePreviousValues.current) {
      setPreviousControlValues(controlValues)
      shouldUpdatePreviousValues.current = false
    }
  }, [controlValues])

  const handleUnitEnable = (enabled: boolean) => {
    setControlValues((prev) => ({ ...prev, unitEnable: enabled }))
    handleControlValueChange("unitEnable", enabled)
  }

  // --- PID Controller Hooks ---
  const { pidControllers, setPIDControllers } = usePIDStore()

  const handlePidChange = async (
    controllerType: "heating" | "cooling" | "outdoorDamper",
    paramName: keyof PIDSettings,
    value: number | boolean,
  ) => {
    const newPIDControllers = {
      ...pidControllers,
      [controllerType]: {
        ...pidControllers[controllerType],
        [paramName]: value,
      },
    }

    // Update the local state
    setControlValues((prev) => ({
      ...prev,
      pidControllers: newPIDControllers,
    }))

    // Save to RTDB immediately
    await sendControlCommand("update_pidControllers", newPIDControllers, {
      previousValue: controlValues.pidControllers,
    })

    // Optimistically update the local zustand state
    setPIDControllers(newPIDControllers, equipment.id)
    setHasUnsavedChanges(true)
  }

  // Handle outdoor air reset changes
  const handleOutdoorAirResetChange = (key: string, value: any) => {
    setControlValues((prev) => ({
      ...prev,
      outdoorAirReset: {
        ...(prev.outdoorAirReset || {
          enabled: false,
          outdoorTempLow: 20,
          outdoorTempHigh: 70,
          setpointLow: 75,
          setpointHigh: 68,
        }),
        [key]: value,
      },
    }))
    setHasUnsavedChanges(true)
  }

  // Handle custom logic enabled change
  const handleCustomLogicEnabledChange = (enabled: boolean) => {
    setControlValues((prev) => ({
      ...prev,
      customLogicEnabled: enabled,
    }))
    setHasUnsavedChanges(true)
  }

  // Now update the evaluateCustomLogic function to properly handle the new PID controller implementation:
  // Replace the existing evaluateCustomLogic function with this more robust implementation
  const evaluateCustomLogic = useCallback(() => {
    if (!controlValues.customLogicEnabled || !controlValues.customLogic) {
      console.log("Custom logic is disabled or empty")
      return null
    }

    try {
      console.log("Evaluating custom logic for display only...")

      // Create a display-only version that doesn't conflict with server-side PID
      const displayLogicFn = new Function(
        "metrics",
        "settings",
        `
try {
  // Create a mock PID state object and make it available globally in this context
  const pidState = {
    heating: { integral: 0, previousError: 0, lastOutput: 0 },
    cooling: { integral: 0, previousError: 0, lastOutput: 0 },
    outdoorDamper: { integral: 0, previousError: 0, lastOutput: 0 }
  };
  
  // Define the pidController function BEFORE the custom logic is executed
  function pidController(input, setpoint, kp, ki, kd, dt, outputMin, outputMax, controllerType) {
    // Simple proportional calculation for display
    const controllerKey = String(controllerType);
    const state = pidState[controllerKey] || { integral: 0, previousError: 0, lastOutput: 0 };
    
    // Calculate error - special handling for cooling
    let error;
    if (controllerKey === 'cooling') {
      // For cooling, higher temp means positive error (need more cooling)
      error = input - setpoint;
    } else {
      // For heating and other controls, lower temp means positive error
      error = setpoint - input;
    }
    
    // Calculate integral with anti-windup
    let integral = state.integral + (error * dt);
    
    // Anti-windup - limit integral to prevent excessive buildup
    const maxIntegral = (outputMax - outputMin) / (ki || 0.1); // Avoid division by zero
    integral = Math.max(Math.min(integral, maxIntegral), -maxIntegral);
    
    // Calculate derivative
    const derivative = (error - state.previousError) / dt;
    
    // Calculate output
    let output = kp * error + ki * integral + kd * derivative;
    
    // Clamp output
    output = Math.max(outputMin, Math.min(outputMax, output));
    
    console.log(\`Display PID (\${controllerKey}): Error=\${error.toFixed(2)}, Integral=\${integral.toFixed(2)}, Derivative=\${derivative.toFixed(2)}, Output=\${output.toFixed(2)}\`);
    
    // Return the result with updated state values
    return {
      output,
      newState: {
        integral,
        previousError: error,
        lastOutput: output
      }
    };
  }

  // Determine which temperature to use based on source preference
  const temperatureSource = settings.temperatureSource || "space";
  let currentTemp;
  
  if (temperatureSource === "space") {
    currentTemp = metrics.roomTemperature || metrics.roomTemp || metrics.coveTemp || 
      metrics.chapelTemp || metrics.kitchenTemp || metrics.mailRoomTemp || 
      metrics.spaceTemp || metrics.SpaceTemp || metrics.zoneTemp || 
      metrics.ZoneTemp || 72;
    console.log("Using SPACE temperature for display:", currentTemp);
  } else {
    currentTemp = metrics.supplyTemperature || metrics.supplyTemp || 
      metrics.Supply || metrics.supply || metrics.SupplyTemp || 
      metrics.dischargeTemperature || metrics.DischargeTemp || 55;
    console.log("Using SUPPLY temperature for display:", currentTemp);
  }
  
  // Add the selected temperature to metrics for use in the control logic
  metrics._activeTemperature = currentTemp;

  // Now execute the custom logic with our pidController already defined
  ${controlValues.customLogic || ""}

  // Try to run the fan coil control function
  try {
    if (typeof fanCoilControl === 'function') {
      const result = fanCoilControl(metrics, settings);
      
      // Always preserve temperature setpoint in the result
      if (result && typeof result === 'object') {
        // If the result doesn't explicitly set temperatureSetpoint, use the user's value
        if (result.temperatureSetpoint === undefined) {
          result.temperatureSetpoint = settings.temperatureSetpoint;
        }
        
        // If we have a temperature source setting, preserve it
        if (!result.temperatureSource && temperatureSource) {
          result.temperatureSource = temperatureSource;
        }
      }
      
      return result;
    } else {
      throw new Error("No fan coil control function found");
    }
  } catch (fanCoilError) {
    console.error("Error in fan coil control:", fanCoilError);
    return { error: fanCoilError.message };
  }
} catch (error) {
  console.error("Display logic error:", error);
  return { error: error.message };
}
`,
      )

      // Run the display-only logic
      console.log("Running display-only logic preview...")
      const result = displayLogicFn(sandbox.metrics, sandbox.settings)
      console.log("Display logic preview returned:", result)

      if (result && result.error) {
        console.error("Display logic evaluation failed:", result.error)
        return { error: result.error, result: null, hasChanges: false, timestamp: Date.now() }
      }

      return {
        result,
        hasChanges: true,
        timestamp: Date.now(),
        displayOnly: true,
      }
    } catch (error) {
      console.error("Error in display logic:", error)
      return {
        error: error instanceof Error ? error.message : "Unknown error",
        result: null,
        hasChanges: false,
        timestamp: Date.now(),
      }
    }
  }, [controlValues.customLogicEnabled, controlValues.customLogic, sandbox.metrics, sandbox.settings])

  // Replace the runLogicNow function with this improved version
  const runLogicNow = useCallback(() => {
    console.log("Manually running logic evaluation...")
    const evalResult = evaluateCustomLogic()
    console.log("Logic evaluation result:", evalResult)

    // Update the UI with the evaluation result
    if (evalResult) {
      setLogicEvaluation(evalResult)
    }

    return evalResult
  }, [evaluateCustomLogic])

  // Replace the automatic logic evaluation effect with this improved version
  // This effect handles applying the logic results to the control values
  const applyLogicResultsRef = useRef(false)
  const lastEvaluationTimeRef = useRef(0)
  const evaluationThrottleTimeMs = 5000 // Minimum time between evaluations (5 seconds)

  // Add this effect to handle automatic logic evaluation with throttling
  useEffect(() => {
    const runAndApplyLogic = () => {
      const now = Date.now()
      // Throttle evaluations to prevent too many updates
      if (now - lastEvaluationTimeRef.current < evaluationThrottleTimeMs) {
        return
      }

      lastEvaluationTimeRef.current = now
      const evalResult = evaluateCustomLogic()

      if (evalResult) {
        // Update the UI with the evaluation result
        setLogicEvaluation(evalResult)

        // Apply the results if in auto mode and there are changes
        if (evalResult.hasChanges && evalResult.result && controlValues.operationMode === "auto") {
          const result = evalResult.result

          // Create a new object to track changes
          const newValues = { ...controlValues }
          let hasUpdates = false

          if (result && typeof result === "object") {
            Object.entries(result).forEach(([key, value]) => {
              if (newValues[key as keyof ControlValues] !== value) {
                newValues[key as keyof ControlValues] = value as any
                hasUpdates = true
              }
            })
          }

          // Only update state if there are actual changes
          if (hasUpdates) {
            console.log("Applying updates to control values:", newValues)
            applyLogicResultsRef.current = true
            setControlValues(newValues)
          }
        }
      }
    }

    // Run once immediately when enabled
    runAndApplyLogic()

    // Then set up recurring evaluation
    const intervalId = setInterval(runAndApplyLogic, 15000) // 15 seconds

    return () => {
      clearInterval(intervalId)
    }
  }, [evaluateCustomLogic])

  // Add this effect to handle metrics changes
  useEffect(() => {
    // Skip if custom logic is disabled
    if (!controlValues.customLogicEnabled) return

    // Skip if we're already applying logic results
    if (applyLogicResultsRef.current) {
      applyLogicResultsRef.current = false
      return
    }

    // Throttle evaluations based on metrics changes
    const now = Date.now()
    if (now - lastEvaluationTimeRef.current < evaluationThrottleTimeMs) {
      return
    }

    console.log("Metrics changed, re-evaluating logic...")
    lastEvaluationTimeRef.current = now
    const evalResult = evaluateCustomLogic()

    if (evalResult) {
      setLogicEvaluation(evalResult)
    }
  }, [
    metrics?.roomTemperature,
    metrics?.Supply,
    metrics?.Return,
    metrics?.supplyTemperature,
    metrics?.returnTemperature,
    controlValues.temperatureSetpoint,
    evaluateCustomLogic,
    controlValues.customLogicEnabled,
  ])

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

  // Return your component UI here
  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-lg">Loading controls...</p>
        </div>
      ) : (
        <>
          {/* Import and use the FanCoilGeneralControls component */}
          <FanCoilGeneralControls
            controlValues={controlValues}
            onControlValueChange={handleControlValueChange}
            onTemperatureSetpointChange={handleTemperatureSetpointChange}
            onValveChange={handleValveChange}
            onValveModeChange={onValveModeChange}
            onFanChange={(value) => handleControlValueChange("fanSpeed", value)}
            onFanModeChange={(value) => handleControlValueChange("fanMode", value)}
            onFanToggle={handleFanToggle}
            onUnitEnable={handleUnitEnable}
            metrics={metrics}
            sandbox={sandbox}
            autoSyncEnabled={autoSyncEnabled}
            onApplyChanges={handleApplyChanges}
            isSubmitting={isSubmitting}
          />

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
                          onClick={() => handleDeleteCommand(command.id, command.commandType, command.sequentialId)}
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

// Define the onValveModeChange function
function onValveModeChange(valveType: "heating" | "cooling", mode: string) {
  console.log(`${valveType} valve mode changed to: ${mode}`)
  // Implement your logic here to handle the valve mode change
}
