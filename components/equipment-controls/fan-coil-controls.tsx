"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { useToast } from "@/components/ui/use-toast"
import { useSocket } from "@/lib/socket-context"
import { logAuditEvent } from "@/lib/audit-logger"
import { useAuth } from "@/lib/auth-context"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
    ref,
    set,
    serverTimestamp,
    remove,
    update,
    Database,
    onValue,
    off,
    query as rtdbQuery,
    orderByChild,
    limitToLast,
    DataSnapshot
} from "firebase/database"
import { secondaryDb } from "@/lib/secondary-firebase"
import { getFirestore, doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import {
    collection,
    getDocs,
    query as firestoreQuery,
    where,
    DocumentData,
    DocumentSnapshot
} from "firebase/firestore"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    MinusIcon,
    PlusIcon,
} from "lucide-react"

interface FanCoilControlsProps {
    equipment: {
        id: string;
        locationId: string;
        locationName: string;
        controls: ControlValues;
        status: string;
        name: string;
        type: string;
    }
}

interface ChangeRecord {
    key: string;
    newValue: any;
    previousValue: any;
}

interface ControlValues {
    fanSpeed: string;
    fanMode: string;
    fanEnabled: boolean;
    heatingValvePosition: number;
    coolingValvePosition: number;
    heatingValveMode: string;
    coolingValveMode: string;
    temperatureSetpoint: number;
    operationMode: string;
    unitEnable: boolean;
}

interface ControlHistoryEntry {
    id: string;
    command: string;
    source: string;
    status: string;
    timestamp: number;
    value: any;
    previousValue?: any;
    mode?: string;
    userId: string;
    userName: string;
    details: string;
}

interface HistorySnapshot extends DataSnapshot {
    val(): { [key: string]: ControlHistoryEntry } | null;
}

// Add type for secondaryDb
declare module "@/lib/secondary-firebase" {
    export const secondaryDb: Database;
}

export function FanCoilControls({ equipment }: FanCoilControlsProps) {
    const [controlValues, setControlValues] = useState<ControlValues>({
        ...equipment.controls,
        heatingValveMode: equipment.controls?.heatingValveMode || "auto",
        coolingValveMode: equipment.controls?.coolingValveMode || "auto",
        fanMode: equipment.controls?.fanMode || "auto",
        heatingValvePosition: equipment.controls?.heatingValvePosition || 0,
        coolingValvePosition: equipment.controls?.coolingValvePosition || 0,
        fanEnabled: equipment.controls?.fanEnabled || false,
    })
    const [previousControlValues, setPreviousControlValues] = useState<ControlValues>({
        ...equipment.controls,
    })
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
    const [username, setUsername] = useState<string>("")
    const [password, setPassword] = useState<string>("")
    const [showAuthDialog, setShowAuthDialog] = useState<boolean>(false)
    const [pendingCommands, setPendingCommands] = useState<{ [key: string]: boolean }>({})
    const [controlHistory, setControlHistory] = useState<ControlHistoryEntry[]>([])
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
    const { socket } = useSocket()
    const { toast } = useToast()
    const { user } = useAuth()
    const [authError, setAuthError] = useState<string>("")
    const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)
    const [pendingChanges, setPendingChanges] = useState<{ [key: string]: any }>({})
    const [showConfirmDialog, setShowConfirmDialog] = useState(false)

    // Reset authentication state when component mounts or equipment changes
    useEffect(() => {
        setIsAuthenticated(false);
        setAuthError("");
        setPendingAction(null);
    }, [equipment.id]); // Reset when equipment changes

    // Check if user has required roles
    const hasRequiredRole = () => {
        if (!user || !user.roles) return false;
        const allowedRoles = ["admin", "DevOps", "devops", "Facilities", "facilities"];
        return user.roles.some(role => allowedRoles.includes(role.toLowerCase()));
    }

    // Check if we have valid location data
    const hasValidLocationData = () => {
        return Boolean(equipment && equipment.locationId && equipment.locationName);
    }

    // Replace API fetch with direct RTDB subscription
    useEffect(() => {
        if (!equipment || !equipment.locationId || !equipment.id) return;

        const historyRef = ref(secondaryDb, `control_history/${equipment.locationId}/${equipment.id}`);

        const handleHistoryUpdate = (snapshot: HistorySnapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                if (data) {
                    // Convert object to array and sort by timestamp descending
                    const historyArray = Object.entries(data).map(([id, entry]) => ({
                        id,
                        ...entry,
                        timestamp: entry.timestamp || Date.now()
                    }))
                        .sort((a, b) => b.timestamp - a.timestamp)
                        .slice(0, 20); // Take only the last 20 entries after sorting

                    setControlHistory(historyArray);
                } else {
                    setControlHistory([]);
                }
            } else {
                setControlHistory([]);
            }
        };

        onValue(historyRef, handleHistoryUpdate);

        return () => {
            off(historyRef);
        };
    }, [equipment]);

    const logControlEvent = async (details: string, changes?: any) => {
        if (!hasValidLocationData()) {
            console.warn("Cannot log event: Missing location data");
            return;
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
                ...(changes && { changes })
            });
        } catch (error) {
            console.error("Failed to log audit event:", error);
        }
    };

    useEffect(() => {
        // Set up socket listeners for command acknowledgments
        if (socket) {
            socket.on("command_complete", (data: { commandId: string, status: string }) => {
                setPendingCommands(prev => ({ ...prev, [data.commandId]: false }));
                toast({
                    title: "Command Complete",
                    description: `Control update successful`,
                    className: "bg-teal-50 border-teal-200",
                });
            });

            socket.on("command_failed", (data: { commandId: string, error: string }) => {
                setPendingCommands(prev => ({ ...prev, [data.commandId]: false }));
                toast({
                    title: "Command Failed",
                    description: data.error,
                    variant: "destructive",
                });
            });

            return () => {
                socket.off("command_complete");
                socket.off("command_failed");
            };
        }
    }, [socket, toast]);

    const sendControlCommand = async (command: string, value: any, metadata?: any) => {
        const commandId = Date.now().toString();

        // Check if authentication is required for this command
        if (command !== "update_temperature_setpoint" && (!isAuthenticated || !hasRequiredRole())) {
            setPendingAction(() => () => sendControlCommand(command, value, metadata));
            setShowAuthDialog(true);
            return false;
        }

        try {
            setPendingCommands(prev => ({ ...prev, [commandId]: true }));

            // Create a descriptive detail about the command
            const getCommandDescription = () => {
                switch (command) {
                    case "update_temperature_setpoint": return "Temperature setpoint";
                    case "update_heating_valve": return "Heating valve position";
                    case "update_cooling_valve": return "Cooling valve position";
                    case "update_fan_speed": return "Fan speed";
                    case "update_fan_mode": return "Fan mode";
                    case "update_heating_valve_mode": return "Heating valve mode";
                    case "update_cooling_valve_mode": return "Cooling valve mode";
                    case "update_operation_mode": return "Operation mode";
                    case "update_unit_enable": return "Unit enabled";
                    default: return command;
                }
            };

            // Save to RTDB control history with detailed information
            if (equipment && equipment.locationId && equipment.id) {
                const controlHistoryRef = ref(secondaryDb as Database, `control_history/${equipment.locationId}/${equipment.id}/${commandId}`);

                // Ensure we have valid values for the history entry
                const historyEntry = {
                    id: commandId,
                    command,
                    source: "web_dashboard",
                    status: "pending",
                    timestamp: Date.now(),
                    value: value ?? null,
                    previousValue: metadata?.previousValue ?? null,
                    mode: metadata?.mode ?? null,
                    userId: user?.id || "unknown",
                    userName: user?.name || "unknown",
                    details: `${getCommandDescription()} changed to ${value}`,
                    ...(metadata ? Object.fromEntries(
                        Object.entries(metadata).filter(([_, v]) => v !== undefined)
                    ) : {})
                };

                await set(controlHistoryRef, historyEntry);
            }

            if (hasValidLocationData()) {
                await logControlEvent(`Changed ${command} to ${value}`, { [command]: value });
            }

            return true;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";

            if (hasValidLocationData()) {
                await logControlEvent(`Failed to change ${command} to ${value}: ${errorMessage}`);
            }

            console.error('Failed to send control command:', error);
            toast({
                title: "Error",
                description: errorMessage,
                variant: "destructive",
            });
            return false;
        } finally {
            setPendingCommands(prev => ({ ...prev, [commandId]: false }));
        }
    };

    const handleValveChange = async (valveType: "heating" | "cooling", value: number) => {
        const command = `update_${valveType}_valve`;
        const metadata = {
            mode: controlValues[`${valveType}ValveMode`],
            previousValue: previousControlValues[`${valveType}ValvePosition`]
        };

        const success = await sendControlCommand(command, value, metadata);
        if (success) {
            setControlValues((prev: ControlValues) => ({ ...prev, [`${valveType}ValvePosition`]: value }));
        }
    };

    const handleValveModeChange = async (valveType: "heating" | "cooling", mode: string) => {
        const command = `update_${valveType}_valve_mode`;
        const metadata = {
            position: controlValues[`${valveType}ValvePosition`],
            previousMode: previousControlValues[`${valveType}ValveMode`]
        };

        const success = await sendControlCommand(command, mode, metadata);
        if (success) {
            setControlValues((prev: ControlValues) => ({ ...prev, [`${valveType}ValveMode`]: mode }));
        }
    };

    const handleFanChange = async (value: string) => {
        const metadata = {
            mode: controlValues.fanMode,
            previousValue: previousControlValues.fanSpeed
        };

        const success = await sendControlCommand("update_fan_speed", value, metadata);
        if (success) {
            setControlValues((prev: ControlValues) => ({ ...prev, fanSpeed: value }));
        }
    };

    const handleFanModeChange = async (mode: string) => {
        const metadata = {
            speed: controlValues.fanSpeed,
            previousMode: previousControlValues.fanMode
        };

        const success = await sendControlCommand("update_fan_mode", mode, metadata);
        if (success) {
            setControlValues((prev: ControlValues) => ({ ...prev, fanMode: mode }));
        }
    };

    // Function to log status changes
    const logStatusChange = async (newStatus: string) => {
        if (equipment && equipment.status !== newStatus && hasValidLocationData()) {
            await logControlEvent(`Equipment status changed from ${equipment.status} to ${newStatus}`);
        }
    };

    // Function to log maintenance actions
    const logMaintenanceAction = async (maintenanceType: string, description: string) => {
        if (hasValidLocationData()) {
            await logControlEvent(`Maintenance action: ${maintenanceType} - ${description}`);
        }
    }

    const handleApplyChanges = async () => {
        // Check if any non-temperature changes are being made
        const hasNonTempChanges = Object.entries(controlValues).some(([key, value]) => {
            return key !== "temperatureSetpoint" && previousControlValues[key] !== value;
        });

        if (hasNonTempChanges && !isAuthenticated) {
            setPendingAction(() => handleApplyChanges);
            setShowAuthDialog(true);
            return;
        }

        Object.entries(controlValues).forEach(([key, value]) => {
            if (previousControlValues[key] !== value) {
                sendControlCommand(`update_${key}`, value, {
                    previousValue: previousControlValues[key]
                });
            }
        });
    };

    const handleBatchUpdate = async () => {
        // Check if any non-temperature changes are being made
        const hasNonTempChanges = Object.entries(controlValues).some(([key, value]) => {
            return key !== "temperatureSetpoint" && previousControlValues[key] !== value;
        });

        if (hasNonTempChanges && !isAuthenticated) {
            setPendingAction(() => handleBatchUpdate);
            setShowAuthDialog(true);
            return;
        }

        try {
            const changes: Array<{ key: string; newValue: any; previousValue: any }> = [];
            Object.entries(controlValues).forEach(([key, value]) => {
                if (previousControlValues[key] !== value) {
                    sendControlCommand(`save_${key}`, value, {
                        previousValue: previousControlValues[key]
                    });
                    changes.push({ key, newValue: value, previousValue: previousControlValues[key] });
                }
            });
            setPreviousControlValues({ ...controlValues });

            if (changes.length > 0 && hasValidLocationData()) {
                await logControlEvent("Applied batch control updates", { changes });
            }
        } catch (error) {
            if (hasValidLocationData()) {
                await logControlEvent("Failed to apply batch updates", { error: error instanceof Error ? error.message : String(error) });
            }
            console.error('Failed to apply changes:', error);
        }
    };

    const handleAcknowledgeCommand = async (commandId: string) => {
        if (!equipment || !equipment.locationId || !equipment.id) return;

        try {
            // Update the status in the RTDB
            const commandRef = ref(secondaryDb, `control_history/${equipment.locationId}/${equipment.id}/${commandId}`);
            await update(commandRef, { status: "acknowledged" });

            // Refresh the control history
            const updatedHistory = controlHistory.map(item =>
                item.id === commandId ? { ...item, status: "acknowledged" } : item
            );
            setControlHistory(updatedHistory);

            toast({
                title: "Command Acknowledged",
                description: "The command has been marked as acknowledged",
                className: "bg-teal-50 border-teal-200",
            });
        } catch (error) {
            console.error("Failed to acknowledge command:", error);
            toast({
                title: "Error",
                description: "Failed to acknowledge command",
                variant: "destructive",
            });
        }
    };

    const handleDeleteCommand = async (commandId: string) => {
        if (!equipment || !equipment.locationId || !equipment.id) return;

        try {
            // Delete the command from the RTDB
            const commandRef = ref(secondaryDb, `control_history/${equipment.locationId}/${equipment.id}/${commandId}`);
            await remove(commandRef);

            // Remove from local state
            const updatedHistory = controlHistory.filter(item => item.id !== commandId);
            setControlHistory(updatedHistory);

            toast({
                title: "Command Deleted",
                description: "The command has been removed from history",
                className: "bg-teal-50 border-teal-200",
            });
        } catch (error) {
            console.error("Failed to delete command:", error);
            toast({
                title: "Error",
                description: "Failed to delete command",
                variant: "destructive",
            });
        }
    };

    const handleAuthentication = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        try {
            setIsSubmitting(true);
            setAuthError("");

            // First check if current user has the base required role
            if (!user || !hasRequiredRole()) {
                throw new Error("You do not have permission to modify equipment controls");
            }

            // Try to find user by name first, then by username if not found
            let userDoc = null;
            let nameQuery = await getDocs(firestoreQuery(collection(db, 'users'), where('name', '==', username)));

            if (nameQuery.empty) {
                // If not found by name, try username
                nameQuery = await getDocs(firestoreQuery(collection(db, 'users'), where('username', '==', username)));
            }

            if (nameQuery.empty) {
                throw new Error("Invalid credentials");
            }

            userDoc = nameQuery.docs[0];
            const userData = userDoc.data() as { password?: string; roles?: string[] };

            // Verify password
            if (!userData.password || userData.password !== password) {
                throw new Error("Invalid credentials");
            }

            // Check if the user has one of the required roles (admin, DevOps, or Facilities)
            const userRoles = userData.roles || [];
            const allowedRoles = ["admin", "DevOps", "devops", "Facilities", "facilities"];
            const hasRole = userRoles.some((role: string) => allowedRoles.includes(role.toLowerCase()));

            if (!hasRole) {
                throw new Error("User does not have equipment control permissions");
            }

            // Execute any pending action after successful authentication
            if (pendingAction) {
                await pendingAction();
                setPendingAction(null);
            }

            setIsAuthenticated(true);
            setShowAuthDialog(false);
            setUsername("");
            setPassword("");

            if (hasValidLocationData()) {
                await logControlEvent("Successfully authenticated for equipment control");
            }

            toast({
                title: "Authentication Successful",
                description: "You can now modify equipment controls",
                className: "bg-teal-50 border-teal-200",
            });

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Authentication failed";
            setAuthError(errorMessage);

            if (hasValidLocationData()) {
                await logControlEvent(`Failed to authenticate for equipment control: ${errorMessage}`);
            }

            toast({
                title: "Authentication Failed",
                description: errorMessage,
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleControlChange = (command: string, value: any, metadata?: any) => {
        // Get the current value before updating as the previous value
        const getCurrentValue = (command: string) => {
            switch (command) {
                case "update_fan_speed": return controlValues.fanSpeed;
                case "update_fan_mode": return controlValues.fanMode;
                case "update_heating_valve": return controlValues.heatingValvePosition;
                case "update_cooling_valve": return controlValues.coolingValvePosition;
                case "update_heating_valve_mode": return controlValues.heatingValveMode;
                case "update_cooling_valve_mode": return controlValues.coolingValveMode;
                case "update_temperature_setpoint": return controlValues.temperatureSetpoint;
                case "update_operation_mode": return controlValues.operationMode;
                case "update_unit_enable": return controlValues.unitEnable;
                default: return null;
            }
        };

        const previousValue = getCurrentValue(command);

        setPendingChanges(prev => ({
            ...prev,
            [command]: {
                value,
                metadata: {
                    ...metadata,
                    previousValue: previousValue ?? null
                }
            }
        }));
    };

    const handleConfirmChanges = async () => {
        setIsSubmitting(true);
        try {
            // Execute all pending changes
            for (const [command, data] of Object.entries(pendingChanges)) {
                await sendControlCommand(command, data.value, data.metadata);
            }

            toast({
                title: "Control Commands Sent Successfully",
                description: "All changes have been applied",
                className: "bg-teal-50 border-teal-200",
            });

            // Clear pending changes
            setPendingChanges({});
            setShowConfirmDialog(false);
        } catch (error) {
            toast({
                title: "Failed to Apply Changes",
                description: error instanceof Error ? error.message : "An error occurred",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleTemperatureSetpointChange = (value: number) => {
        setControlValues(prev => ({ ...prev, temperatureSetpoint: value }));
        handleControlChange("update_temperature_setpoint", value);
    };

    const handleUnitEnable = (enabled: boolean) => {
        setControlValues(prev => ({ ...prev, unitEnable: enabled }));
        handleControlChange("update_unit_enable", enabled);
    };

    const handleFanToggle = async (enabled: boolean) => {
        const newValues = { ...controlValues, fanEnabled: enabled };
        setControlValues(newValues);

        await sendControlCommand("update_fan_enable", enabled, {
            previousValue: previousControlValues.fanEnabled,
            mode: controlValues.fanMode
        });
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Fan Coil Controls</CardTitle>
                    <CardDescription>Control settings for fan coil unit</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="unit-enable">Unit Enable</Label>
                        <Switch
                            id="unit-enable"
                            checked={controlValues.unitEnable === true}
                            onCheckedChange={handleUnitEnable}
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="mode">Operation Mode</Label>
                            <Select value={controlValues.operationMode || "auto"} onValueChange={(value) => {
                                setControlValues(prev => ({ ...prev, operationMode: value }));
                                handleControlChange("update_operation_mode", value);
                            }}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Select mode" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="auto">Auto</SelectItem>
                                    <SelectItem value="cooling">Cooling</SelectItem>
                                    <SelectItem value="heating">Heating</SelectItem>
                                    <SelectItem value="fan">Fan Only</SelectItem>
                                    <SelectItem value="maintenance">Maintenance</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="temp-setpoint">Temperature Setpoint (°F)</Label>
                            <span className="text-sm">{controlValues.temperatureSetpoint || 72}°F</span>
                        </div>
                        <Slider
                            id="temp-setpoint"
                            min={65}
                            max={85}
                            step={0.5}
                            value={[controlValues.temperatureSetpoint || 72]}
                            onValueChange={(value) => handleTemperatureSetpointChange(value[0])}
                        />
                    </div>

                    {/* Heating Valve Controls */}
                    <div className="space-y-2 border-t pt-4">
                        <h3 className="font-medium">Heating Valve</h3>
                        <div className="flex items-center justify-between">
                            <Label htmlFor="heating-valve-mode">Heating Valve Mode</Label>
                            <Select
                                value={controlValues.heatingValveMode || "auto"}
                                onValueChange={(value) => handleValveModeChange("heating", value)}
                            >
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Select mode" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="auto">Auto</SelectItem>
                                    <SelectItem value="manual">Manual</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {controlValues.heatingValveMode === "manual" && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="heating-valve-position">Heating Valve Position</Label>
                                    <span className="text-sm">{controlValues.heatingValvePosition || 0}%</span>
                                </div>
                                <Slider
                                    id="heating-valve-position"
                                    min={0}
                                    max={100}
                                    step={1}
                                    value={[controlValues.heatingValvePosition || 0]}
                                    onValueChange={(value) => handleValveChange("heating", value[0])}
                                />
                            </div>
                        )}
                    </div>

                    {/* Cooling Valve Controls */}
                    <div className="space-y-2 border-t pt-4">
                        <h3 className="font-medium">Cooling Valve</h3>
                        <div className="flex items-center justify-between">
                            <Label htmlFor="cooling-valve-mode">Cooling Valve Mode</Label>
                            <Select
                                value={controlValues.coolingValveMode || "auto"}
                                onValueChange={(value) => handleValveModeChange("cooling", value)}
                            >
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Select mode" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="auto">Auto</SelectItem>
                                    <SelectItem value="manual">Manual</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {controlValues.coolingValveMode === "manual" && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="cooling-valve-position">Cooling Valve Position</Label>
                                    <span className="text-sm">{controlValues.coolingValvePosition || 0}%</span>
                                </div>
                                <Slider
                                    id="cooling-valve-position"
                                    min={0}
                                    max={100}
                                    step={1}
                                    value={[controlValues.coolingValvePosition || 0]}
                                    onValueChange={(value) => handleValveChange("cooling", value[0])}
                                />
                            </div>
                        )}
                    </div>

                    {/* Fan Controls */}
                    <div className="space-y-2 border-t pt-4">
                        <h3 className="font-medium">Fan Controls</h3>
                        <div className="flex items-center justify-between">
                            <Label htmlFor="fan-mode">Fan Mode</Label>
                            <Select
                                value={controlValues.fanMode || "auto"}
                                onValueChange={handleFanModeChange}
                            >
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Select mode" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="auto">Auto</SelectItem>
                                    <SelectItem value="manual">Manual</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {controlValues.fanMode === "manual" && (
                            <>
                                <div className="flex items-center justify-between pt-2">
                                    <Label htmlFor="fan-enable">Fan Enable</Label>
                                    <Switch
                                        id="fan-enable"
                                        checked={controlValues.fanEnabled}
                                        onCheckedChange={handleFanToggle}
                                    />
                                </div>

                                {controlValues.fanEnabled && (
                                    <div className="flex items-center justify-between pt-2">
                                        <Label htmlFor="fan-speed">Fan Speed</Label>
                                        <Select
                                            value={controlValues.fanSpeed || "low"}
                                            onValueChange={handleFanChange}
                                        >
                                            <SelectTrigger className="w-[180px]">
                                                <SelectValue placeholder="Select speed" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="low">Low</SelectItem>
                                                <SelectItem value="medium">Medium</SelectItem>
                                                <SelectItem value="high">High</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end space-x-4">
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="outline">Apply Changes</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Apply Control Changes</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will apply the current control settings to the equipment. The changes will not be saved
                                permanently.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleApplyChanges}>Apply</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button>Save & Apply</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Save Control Changes</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will save the current control settings and apply them to the equipment. The changes will be
                                permanent.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleBatchUpdate}>Save & Apply</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>

            <Dialog open={showAuthDialog} onOpenChange={(open) => {
                setShowAuthDialog(open);
                if (!open) {
                    setPendingAction(null);
                    setAuthError("");
                    setUsername("");
                    setPassword("");
                }
            }}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Equipment Control Authentication</DialogTitle>
                        <DialogDescription>
                            Please enter your username and password to verify equipment control permissions
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAuthentication}>
                        <div className="grid gap-4 py-4">
                            {authError && (
                                <div className="text-red-500 text-sm">{authError}</div>
                            )}
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="auth-username" className="text-right">
                                    Username
                                </Label>
                                <Input
                                    id="auth-username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="col-span-3"
                                    disabled={isSubmitting}
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="auth-password" className="text-right">
                                    Password
                                </Label>
                                <Input
                                    id="auth-password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="col-span-3"
                                    disabled={isSubmitting}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setShowAuthDialog(false);
                                    setAuthError("");
                                    setUsername("");
                                    setPassword("");
                                    setPendingAction(null);
                                }}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="bg-orange-50 text-black hover:bg-orange-100"
                            >
                                {isSubmitting ? "Authenticating..." : "Authenticate"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
