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
        case "update_coolingType":
            return "Cooling Type"
        case "update_heatingType":
            return "Heating Type"
        case "update_activeCoolingStages":
            return "Active Cooling Stages"
        case "update_controlMode":
            return "Control Mode"
        default:
            return command
    }
}

// Add interfaces for type safety
interface AirHandlerControls extends AirHandlerControlsType { }
interface ControlHistoryEntryResult extends ControlHistoryEntry { }

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
    customLogicEnabled: z.boolean().default(true),
    customLogic: z.string().optional(),
    heatingValveEnable: z.boolean().optional(),
    heatingValveMode: z.string().optional(),
    heatingValvePosition: z.number().optional(),
    coolingValveEnable: z.boolean().optional(),
    coolingValveMode: z.string().optional(),
    coolingValvePosition: z.number().optional(),
    outdoorDamperMode: z.string().optional(),
    outdoorDamperPosition: z.number().optional(),
    // Add equipment type configuration properties
    coolingType: z.enum(["dx_single_stage", "dx_two_stage", "chilled_water", "none"]).default("chilled_water"),
    heatingType: z.enum(["hot_water", "none"]).default("hot_water"),
    activeCoolingStages: z.number().optional(),
    controlMode: z.enum(["space", "supply"]).default("space"),
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

// Main component
export function AirHandlerControls({ equipment, metrics = {}, showSaveButton = true }: AirHandlerControlsProps) {
    // State variables
    const [isLoading, setIsLoading] = useState(true)
    const [activeTab, setActiveTab] = useState("general")
    const [controlValues, setControlValues] = useState<AirHandlerControls>({
        ...equipment.controls,
        customLogicEnabled: true, // Always enabled by default
        customLogic: equipment.controls?.customLogic || "", // Default to empty string
        heatingValveEnable: equipment.controls?.heatingValveEnable || false,
        heatingValveMode: equipment.controls?.heatingValveMode || "auto",
        heatingValvePosition: equipment.controls?.heatingValvePosition || 0,
        coolingValveEnable: equipment.controls?.coolingValveEnable || false,
        coolingValveMode: equipment.controls?.coolingValveMode || "auto",
        coolingValvePosition: equipment.controls?.coolingValvePosition || 0,
        outdoorDamperMode: equipment.controls?.outdoorDamperMode || "auto",
        outdoorDamperPosition: equipment.controls?.outdoorDamperPosition || 0,
        // Add default for control mode
        controlMode: equipment.controls?.controlMode || "space",
        // Set default equipment types
        coolingType: equipment.controls?.coolingType || "chilled_water",
        heatingType: equipment.controls?.heatingType || "hot_water",
        activeCoolingStages: equipment.controls?.activeCoolingStages || 0,
        // Initialize PID controllers with defaults if not present or invalid
        pidControllers:
            typeof equipment.controls?.pidControllers === "object" && equipment.controls?.pidControllers !== null
                ? equipment.controls.pidControllers
                : {
                    // Enable by default for HW/CW and OD
                    heating: { ...defaultPIDSettings, reverseActing: true, enabled: true },
                    cooling: { ...defaultPIDSettings, enabled: true },
                    outdoorDamper: { ...defaultPIDSettings, enabled: true },
                },
        // Initialize outdoor air reset with defaults if not present
        outdoorAirReset: equipment.controls?.outdoorAirReset || { ...defaultOutdoorAirResetSettings },
    })
    
    const [previousControlValues, setPreviousControlValues] = useState<AirHandlerControls>({
        ...equipment.controls,
    })
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
    const [pendingCommands, setPendingCommands] = useState<{
        [key: string]: boolean
    }>({})
    const [controlHistory, setControlHistory] = useState<ControlHistoryEntryResult[]>([])
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false)
    const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(true)

    // Refs
    const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const pidInitializedRef = useRef(false)
    const shouldUpdatePreviousValues = useRef(false)

    // Hooks
    const { socket } = useSocket()
    const { toast } = useToast()
    const { user } = useAuth()
    const { pidControllers, setPIDControllers } = usePIDStore()

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
        const timer = setTimeout(() => {
            setIsLoading(false)
        }, 3000)

        return () => clearTimeout(timer)
    }, [])

    // Ensure defaults on initialization
    useEffect(() => {
        if (isLoading) return
        
        const ensureDefaults = async () => {
            // Ensure customLogicEnabled is true
            if (controlValues.customLogicEnabled !== true) {
                await sendControlCommand("update_customLogicEnabled", true)
            }
            
            // Ensure cooling type is chilled_water
            if (controlValues.coolingType !== "chilled_water") {
                await sendControlCommand("update_coolingType", "chilled_water")
            }
            
            // Ensure heating type is hot_water
            if (controlValues.heatingType !== "hot_water") {
                await sendControlCommand("update_heatingType", "hot_water")
            }
        }
        
        ensureDefaults()
    }, [isLoading])

    // Initialize PID controllers from equipment data
    useEffect(() => {
        if (equipment?.controls?.pidControllers && !pidInitializedRef.current) {
            pidInitializedRef.current = true
            setPIDControllers(equipment.controls.pidControllers, equipment.id)
        }
    }, [equipment?.controls?.pidControllers, setPIDControllers, equipment.id])

    // Fetch control history
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

        return () => clearInterval(intervalId)
    }, [equipment?.locationId, equipment?.id, toast])

    // Fetch control values
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
    }, [equipment?.locationId, equipment?.id, toast])

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
        if (!socket) return

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
    }, [socket, toast])

    // Send Control Command - Only sends to database, no logic execution
    const sendControlCommand = async (command: string, value: any, metadata?: any) => {
        const commandId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const now = new Date()
        const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
            now.getDate(),
        ).padStart(2, "0")}_${String(now.getHours()).padStart(
            2,
            "0",
        )}-${String(now.getMinutes()).padStart(2, "0")}-${String(now.getSeconds()).padStart(2, "0")}`

        // Check authorization
        if (!hasRequiredRole()) {
            toast({
                title: "Authorization Required",
                description: "You don't have permission to change settings.",
                variant: "destructive",
            })
            return false
        }

        try {
            console.log(`Sending control command: ${command}`, { value })
            setPendingCommands((prev) => ({ ...prev, [commandId]: true }))

            // Extract command type
            const commandType = command.replace("update_", "")

            // Format data for InfluxDB
            const commandData = {
                command,
                commandType,
                equipmentId: equipment.id,
                locationId: equipment.locationId,
                timestamp: Date.now(),
                formattedTimestamp: formattedDate,
                value: value,
                previousValue: metadata?.previousValue ?? previousControlValues[commandType],
                source: "web_dashboard",
                status: "pending",
                userId: user?.id || "unknown",
                userName: user?.name || "unknown",
                details: `${getCommandDescription(command)} changed to ${typeof value === "object" ? "updated settings" : value}`,
            }

            console.log("Sending command data:", commandData)

            // Send to API endpoint
            const response = await fetch("/api/control-commands", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(commandData),
            })

            if (!response.ok) {
                throw new Error(`Failed to send command: ${response.statusText}`)
            }

            // Update Firestore for compatibility
            try {
                if (db && equipment?.id) {
                    const equipmentRef = doc(db, "equipment", equipment.id)
                    const controlKey = command.replace("update_", "")
                    
                    await updateDoc(equipmentRef, {
                        [`controls.${controlKey}`]: value,
                        lastUpdated: new Date(),
                    })
                    
                    console.log(`Control value ${command} saved to Firestore`)
                }
            } catch (error) {
                console.error("Error writing to Firestore:", error)
            }

            // Special handling for PID controllers
            if (command === "update_pidControllers" && value) {
                usePIDStore.getState().setPIDControllers(value, equipment.id)
            }

            // Log the event
            if (hasValidLocationData()) {
                await logControlEvent(`Changed ${command} to ${typeof value === "object" ? "updated settings" : value}`, {
                    [command]: value,
                })
            }

            // Update local state
            setControlValues(prev => ({
                ...prev,
                [commandType]: value
            }))

            return true
        } catch (error) {
            console.error("Failed to send control command:", error)
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Unknown error",
                variant: "destructive",
            })
            return false
        } finally {
            setPendingCommands((prev) => ({ ...prev, [commandId]: false }))
        }
    }

    // Apply all changes at once
    const saveAndApplySettings = async () => {
        setIsSubmitting(true)
        try {
            console.log("Applying changes...")
            
            // Track changes that need to be sent
            const changedProperties = []
            
            // Check each property for changes
            for (const [key, value] of Object.entries(controlValues)) {
                // Skip complex objects for separate handling
                if (typeof value !== "object") {
                    if (previousControlValues[key as keyof AirHandlerControls] !== value) {
                        changedProperties.push({
                            key,
                            value,
                            previous: previousControlValues[key as keyof AirHandlerControls]
                        })
                    }
                }
            }
            
            // Check PID controllers
            if (JSON.stringify(controlValues.pidControllers) !== JSON.stringify(previousControlValues.pidControllers)) {
                changedProperties.push({
                    key: "pidControllers",
                    value: controlValues.pidControllers,
                    previous: previousControlValues.pidControllers
                })
            }
            
            // Check outdoor air reset
            if (JSON.stringify(controlValues.outdoorAirReset) !== JSON.stringify(previousControlValues.outdoorAirReset)) {
                changedProperties.push({
                    key: "outdoorAirReset",
                    value: controlValues.outdoorAirReset,
                    previous: previousControlValues.outdoorAirReset
                })
            }
            
            // Send updates
            let successCount = 0
            
            for (const change of changedProperties) {
                // Format command name (e.g., temperatureSetpoint -> update_temperature_setpoint)
                const commandName = `update_${change.key.replace(/([A-Z])/g, "_$1").toLowerCase()}`
                
                const success = await sendControlCommand(
                    commandName,
                    change.value,
                    { previousValue: change.previous }
                )
                
                if (success) {
                    successCount++
                }
            }
            
            // Update previous values
            if (successCount > 0) {
                setPreviousControlValues({ ...controlValues })
                setHasUnsavedChanges(false)
                
                toast({
                    title: "Settings Saved",
                    description: `Successfully applied ${successCount} setting changes`,
                    className: "bg-teal-50 border-teal-200",
                })
            } else {
                toast({
                    title: "No Changes",
                    description: "No settings were changed",
                    className: "bg-blue-50 border-blue-200",
                })
            }
        } catch (error) {
            console.error("Error saving settings:", error)
            toast({
                title: "Save Error",
                description: "Failed to save settings",
                variant: "destructive",
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    // General controls handler
    const handleGeneralControlChange = (key: string, value: any) => {
        // Immediately update UI
        setControlValues(prev => ({
            ...prev,
            [key]: value
        }))
        
        // Mark changes as unsaved
        setHasUnsavedChanges(true)
        
        // For dropdowns, immediately save to prevent reverting
        if (key === 'coolingType' || key === 'heatingType' || key === 'controlMode' || key === 'operationMode') {
            const commandName = `update_${key.replace(/([A-Z])/g, "_$1").toLowerCase()}`
            
            sendControlCommand(commandName, value)
                .then(success => {
                    if (success) {
                        setPreviousControlValues(prev => ({
                            ...prev,
                            [key]: value
                        }))
                    }
                })
        }
    }

    // Handler for outdoor air reset
    const handleOutdoorAirResetChange = (key: string, value: any) => {
        setControlValues(prev => ({
            ...prev,
            outdoorAirReset: {
                ...prev.outdoorAirReset,
                [key]: value
            }
        }))
        
        setHasUnsavedChanges(true)
    }

    // Handler for PID settings
    const handlePidChange = (pidType: string, key: string, value: any) => {
        setControlValues(prev => ({
            ...prev,
            pidControllers: {
                ...prev.pidControllers,
                [pidType]: {
                    ...prev.pidControllers?.[pidType],
                    [key]: value
                }
            }
        }))
        
        setHasUnsavedChanges(true)
    }

    // Custom logic enable/disable
    const handleCustomLogicEnabledChange = (checked: boolean) => {
        setControlValues(prev => ({
            ...prev,
            customLogicEnabled: checked
        }))
        
        // Send immediately
        sendControlCommand("update_customLogicEnabled", checked)
            .then(success => {
                if (success) {
                    setPreviousControlValues(prev => ({
                        ...prev,
                        customLogicEnabled: checked
                    }))
                }
            })
    }

    // Delete commands from history
    const handleDeleteCommand = async (commandId: string, commandType: string, sequentialId: string) => {
        if (!equipment?.locationId || !equipment?.id) return

        try {
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

            // Update local state
            setControlHistory(prev => prev.filter(entry => entry.id !== commandId))

            toast({
                title: "Command Deleted",
                description: "Command removed from history",
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

    // Render status icon for history
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
                        customLogic=""
                        customLogicEnabled={controlValues.customLogicEnabled}
                        autoSyncEnabled={autoSyncEnabled}
                        setAutoSyncEnabled={setAutoSyncEnabled}
                        onCustomLogicChange={() => {}} // No-op - logic is managed on the server
                        onCustomLogicEnabledChange={handleCustomLogicEnabledChange}
                        runLogicNow={() => {}} // No-op - logic runs on the server
                        logicEvaluation={null}
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
