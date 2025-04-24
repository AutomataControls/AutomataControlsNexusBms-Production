"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { useToast } from "@/components/ui/use-toast"
import { useSocket } from "@/lib/socket-context"
import { useFirebase } from "@/lib/firebase-context"
import { useAuth } from "@/lib/auth-context"
import { doc, updateDoc } from "firebase/firestore"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  update,
  Database,
  onValue,
  off,
  query as rtdbQuery,
  orderByChild,
  limitToLast,
  DataSnapshot,
  remove
} from "firebase/database"
import { secondaryDb } from "@/lib/secondary-firebase"
import { logAuditEvent } from "@/lib/audit-logger"

interface BoilerControlsProps {
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

interface ControlValues {
  unitEnable: boolean;
  operationMode: string;
  waterTempSetpoint: number;
  pressureSetpoint: number;
  circulationPump: boolean;
  burnerEnable: boolean;
  firingRate: number;
  burnerMode: string;
  minFiringRate: number;
  pilotValve: boolean;
  mainGasValve: boolean;
  highLimitTemp: number;
  highLimitPressure: number;
  lowWaterCutoff: boolean;
  flameSafeguard: boolean;
  purgeTime: number;
  autoReset: boolean;
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

export function BoilerControls({ equipment }: BoilerControlsProps) {
  const [controlValues, setControlValues] = useState<ControlValues>({
    ...equipment.controls as ControlValues,
  })
  const [previousControlValues, setPreviousControlValues] = useState<ControlValues>({
    ...equipment.controls as ControlValues,
  })
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
  const [username, setUsername] = useState<string>("")
  const [password, setPassword] = useState<string>("")
  const [showAuthDialog, setShowAuthDialog] = useState<boolean>(false)
  const [loginError, setLoginError] = useState<string>("")
  const [pendingCommands, setPendingCommands] = useState<{ [key: string]: boolean }>({})
  const [pendingChange, setPendingChange] = useState<{ key: string; value: any } | null>(null)
  const [controlHistory, setControlHistory] = useState<ControlHistoryEntry[]>([])
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const { socket } = useSocket()
  const { toast } = useToast()
  const { db } = useFirebase()
  const { loginWithUsername, user } = useAuth()

  // Reset authentication state when component mounts or equipment changes
  useEffect(() => {
    setIsAuthenticated(false);
    setLoginError("");
    setPendingChange(null);
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

  // Replace API fetch with direct RTDB subscription for control history
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
    const isSetpointCommand = command.toLowerCase().includes("setpoint");
    if (!isSetpointCommand && (!isAuthenticated || !hasRequiredRole())) {
      setPendingChange({
        key: command,
        value: { value, metadata }
      });
      setShowAuthDialog(true);
      return false;
    }

    try {
      setPendingCommands(prev => ({ ...prev, [commandId]: true }));

      // Create a descriptive detail about the command
      const getCommandDescription = () => {
        switch (command) {
          case "update_water_temp_setpoint": return "Water temperature setpoint";
          case "update_pressure_setpoint": return "Pressure setpoint";
          case "update_unit_enable": return "Boiler enable";
          case "update_operation_mode": return "Operation mode";
          case "update_circulation_pump": return "Circulation pump";
          case "update_burner_enable": return "Burner enable";
          case "update_firing_rate": return "Firing rate";
          case "update_burner_mode": return "Burner mode";
          case "update_min_firing_rate": return "Minimum firing rate";
          case "update_pilot_valve": return "Pilot valve";
          case "update_main_gas_valve": return "Main gas valve";
          case "update_high_limit_temp": return "High limit temperature";
          case "update_high_limit_pressure": return "High limit pressure";
          case "update_low_water_cutoff": return "Low water cutoff";
          case "update_flame_safeguard": return "Flame safeguard";
          case "update_purge_time": return "Purge time";
          case "update_auto_reset": return "Auto reset on fault";
          default: return command;
        }
      };

      // If socket is available, send the command
      if (socket) {
        socket.emit("control", {
          equipmentId: equipment.id,
          commandId,
          command,
          value
        });
      }

      // Save to RTDB control history with detailed information
      if (equipment && equipment.locationId && equipment.id) {
        const controlHistoryRef = ref(secondaryDb as Database, `control_history/${equipment.locationId}/${equipment.id}/${commandId}`);

        // Format value for better display
        const displayValue = typeof value === 'boolean' 
          ? (value ? 'Enabled' : 'Disabled') 
          : String(value);

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
          details: `${getCommandDescription()} changed to ${displayValue}`,
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

  const handleSetpointChange = async (key: string, value: any) => {
    // Convert key to command format
    const command = `update_${key.replace(/([A-Z])/g, '_$1').toLowerCase()}`;
    const previousValue = previousControlValues[key as keyof ControlValues];
    
    const success = await sendControlCommand(command, value, { previousValue });
    if (success) {
      setControlValues(prev => ({ ...prev, [key]: value }));
    }
  };

  const handleAuthenticate = async () => {
    setLoginError("");
    setIsSubmitting(true);

    try {
      // Use the authentication system
      await loginWithUsername(username, password);

      setIsAuthenticated(true);
      setShowAuthDialog(false);

      // Apply the pending change if there is one
      if (pendingChange) {
        const { key, value } = pendingChange;
        await sendControlCommand(key, value.value, value.metadata);
        
        // Update the UI state for the specific control
        const controlKey = key.replace('update_', '').replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        setControlValues({
          ...controlValues,
          [controlKey]: value.value
        });
        
        setPendingChange(null);
      }

      toast({
        title: "Authentication Successful",
        description: "You can now modify equipment controls",
        className: "bg-teal-50 border-teal-200",
      });
    } catch (error) {
      console.error("Authentication error:", error);
      setLoginError("Invalid username or password");
      toast({
        title: "Authentication Failed",
        description: "Invalid username or password",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApply = async () => {
    // Check if there are any non-setpoint changes
    const hasNonSetpointChanges = Object.entries(controlValues).some(([key, value]) => {
      return !key.toLowerCase().includes("setpoint") && 
             previousControlValues[key as keyof ControlValues] !== value;
    });

    if (hasNonSetpointChanges && !isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please authenticate to apply changes to controls other than setpoints",
        variant: "destructive",
      });
      setShowAuthDialog(true);
      return;
    }

    // Apply changes one by one
    for (const [key, value] of Object.entries(controlValues)) {
      if (previousControlValues[key as keyof ControlValues] !== value) {
        const command = `update_${key.replace(/([A-Z])/g, '_$1').toLowerCase()}`;
        await sendControlCommand(command, value, {
          previousValue: previousControlValues[key as keyof ControlValues]
        });
      }
    }

    // Also send to socket if available
    if (socket) {
      socket.emit("control", {
        equipmentId: equipment.id,
        controls: controlValues,
      });
    }

    toast({
      title: "Controls Applied",
      description: "Changes have been applied to the equipment",
      className: "bg-teal-50 border-teal-200",
    });
  };

  const handleSave = async () => {
    // Check if there are any non-setpoint changes
    const hasNonSetpointChanges = Object.entries(controlValues).some(([key, value]) => {
      return !key.toLowerCase().includes("setpoint") && 
             previousControlValues[key as keyof ControlValues] !== value;
    });

    if (hasNonSetpointChanges && !isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please authenticate to save changes to controls other than setpoints",
        variant: "destructive",
      });
      setShowAuthDialog(true);
      return;
    }

    try {
      // Apply changes one by one
      const changes: Array<{ key: string; newValue: any; previousValue: any }> = [];
      
      for (const [key, value] of Object.entries(controlValues)) {
        if (previousControlValues[key as keyof ControlValues] !== value) {
          const command = `save_${key.replace(/([A-Z])/g, '_$1').toLowerCase()}`;
          await sendControlCommand(command, value, {
            previousValue: previousControlValues[key as keyof ControlValues]
          });
          
          changes.push({
            key, 
            newValue: value, 
            previousValue: previousControlValues[key as keyof ControlValues]
          });
        }
      }
      
      // Save to Firebase
      if (!db || !equipment.id) {
        throw new Error("Database or equipment ID not available");
      }

      const equipmentRef = doc(db, "equipment", equipment.id);

      // Update the controls field in the equipment document
      await updateDoc(equipmentRef, {
        controls: controlValues,
        lastUpdated: new Date()
      });

      // Update previous values
      setPreviousControlValues({ ...controlValues });

      if (changes.length > 0 && hasValidLocationData()) {
        await logControlEvent("Applied and saved control updates", { changes });
      }

      toast({
        title: "Controls Saved",
        description: "Changes have been saved and applied to the equipment",
        className: "bg-teal-50 border-teal-200",
      });
    } catch (error) {
      console.error("Error saving controls:", error);
      toast({
        title: "Save Error",
        description: "Failed to save control settings",
        variant: "destructive",
      });
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

  return (
    <div className="space-y-6">
      <Tabs defaultValue="general">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="burner">Burner</TabsTrigger>
          <TabsTrigger value="safety">Safety</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>General Controls</CardTitle>
              <CardDescription>Basic operation controls for the boiler</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="unit-enable">Boiler Enable</Label>
                <Switch
                  id="unit-enable"
                  checked={controlValues.unitEnable === true}
                  onCheckedChange={(checked) => handleSetpointChange("unitEnable", checked)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="mode">Operation Mode</Label>
                  <select
                    id="mode"
                    className="flex h-10 w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={controlValues.operationMode || "auto"}
                    onChange={(e) => handleSetpointChange("operationMode", e.target.value)}
                  >
                    <option value="auto">Auto</option>
                    <option value="manual">Manual</option>
                    <option value="standby">Standby</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="water-temp-setpoint">Water Temperature Setpoint (°F)</Label>
                  <span className="text-sm">{controlValues.waterTempSetpoint || 180}°F</span>
                </div>
                <Slider
                  id="water-temp-setpoint"
                  min={120}
                  max={210}
                  step={1}
                  value={[controlValues.waterTempSetpoint || 180]}
                  onValueChange={(value) => handleSetpointChange("waterTempSetpoint", value[0])}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="pressure-setpoint">Pressure Setpoint (PSI)</Label>
                  <span className="text-sm">{controlValues.pressureSetpoint || 12} PSI</span>
                </div>
                <Slider
                  id="pressure-setpoint"
                  min={5}
                  max={30}
                  step={0.5}
                  value={[controlValues.pressureSetpoint || 12]}
                  onValueChange={(value) => handleSetpointChange("pressureSetpoint", value[0])}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="circulation-pump">Circulation Pump</Label>
                <Switch
                  id="circulation-pump"
                  checked={controlValues.circulationPump === true}
                  onCheckedChange={(checked) => handleSetpointChange("circulationPump", checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="burner" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Burner Controls</CardTitle>
              <CardDescription>Control settings for the boiler burner</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="burner-enable">Burner Enable</Label>
                <Switch
                  id="burner-enable"
                  checked={controlValues.burnerEnable === true}
                  onCheckedChange={(checked) => handleSetpointChange("burnerEnable", checked)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="firing-rate">Firing Rate (%)</Label>
                  <span className="text-sm">{controlValues.firingRate || 50}%</span>
                </div>
                <Slider
                  id="firing-rate"
                  min={0}
                  max={100}
                  step={1}
                  value={[controlValues.firingRate || 50]}
                  onValueChange={(value) => handleSetpointChange("firingRate", value[0])}
                  disabled={!controlValues.burnerEnable}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="burner-mode">Burner Mode</Label>
                  <select
                    id="burner-mode"
                    className="flex h-10 w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={controlValues.burnerMode || "modulating"}
                    onChange={(e) => handleSetpointChange("burnerMode", e.target.value)}
                    disabled={!controlValues.burnerEnable}
                  >
                    <option value="modulating">Modulating</option>
                    <option value="high-low">High/Low</option>
                    <option value="on-off">On/Off</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="min-firing-rate">Minimum Firing Rate (%)</Label>
                  <span className="text-sm">{controlValues.minFiringRate || 20}%</span>
                </div>
                <Slider
                  id="min-firing-rate"
                  min={0}
                  max={50}
                  step={1}
                  value={[controlValues.minFiringRate || 20]}
                  onValueChange={(value) => handleSetpointChange("minFiringRate", value[0])}
                  disabled={!controlValues.burnerEnable || controlValues.burnerMode !== "modulating"}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="pilot-valve">Pilot Valve</Label>
                <Switch
                  id="pilot-valve"
                  checked={controlValues.pilotValve === true}
                  onCheckedChange={(checked) => handleSetpointChange("pilotValve", checked)}
                  disabled={!controlValues.burnerEnable}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="main-gas-valve">Main Gas Valve</Label>
                <Switch
                  id="main-gas-valve"
                  checked={controlValues.mainGasValve === true}
                  onCheckedChange={(checked) => handleSetpointChange("mainGasValve", checked)}
                  disabled={!controlValues.burnerEnable}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="safety" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Safety Controls</CardTitle>
              <CardDescription>Safety settings and limits</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="high-limit-temp">High Limit Temperature (°F)</Label>
                  <span className="text-sm">{controlValues.highLimitTemp || 210}°F</span>
                </div>
                <Slider
                  id="high-limit-temp"
                  min={180}
                  max={240}
                  step={1}
                  value={[controlValues.highLimitTemp || 210]}
                  onValueChange={(value) => handleSetpointChange("highLimitTemp", value[0])}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="high-limit-pressure">High Limit Pressure (PSI)</Label>
                  <span className="text-sm">{controlValues.highLimitPressure || 30} PSI</span>
                </div>
                <Slider
                  id="high-limit-pressure"
                  min={15}
                  max={60}
                  step={1}
                  value={[controlValues.highLimitPressure || 30]}
                  onValueChange={(value) => handleSetpointChange("highLimitPressure", value[0])}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="low-water-cutoff">Low Water Cutoff</Label>
                <Switch
                  id="low-water-cutoff"
                  checked={controlValues.lowWaterCutoff === true}
                  onCheckedChange={(checked) => handleSetpointChange("lowWaterCutoff", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="flame-safeguard">Flame Safeguard</Label>
                <Switch
                  id="flame-safeguard"
                  checked={controlValues.flameSafeguard === true}
                  onCheckedChange={(checked) => handleSetpointChange("flameSafeguard", checked)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="purge-time">Pre-Purge Time (seconds)</Label>
                  <span className="text-sm">{controlValues.purgeTime || 30} sec</span>
                </div>
                <Slider
                  id="purge-time"
                  min={0}
                  max={120}
                  step={5}
                  value={[controlValues.purgeTime || 30]}
                  onValueChange={(value) => handleSetpointChange("purgeTime", value[0])}
                />
              </div>

              <div className="flex items-center justify-between">
		<Label htmlFor="auto-reset">Auto Reset on Fault</Label>
                <Switch
                  id="auto-reset"
                  checked={controlValues.autoReset === true}
                  onCheckedChange={(checked) => handleSetpointChange("autoReset", checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* History Section */}
      {controlHistory.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Command History</CardTitle>
            <CardDescription>Recent control commands for this boiler</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-60 overflow-y-auto">
              {controlHistory.map((entry) => (
                <div key={entry.id} className="p-4 border rounded-md">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{entry.details}</div>
                      <div className="text-sm text-gray-500">
                        {new Date(entry.timestamp).toLocaleString()} by {entry.userName}
                      </div>
                      <div className="flex space-x-2 mt-1">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          entry.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          entry.status === 'completed' ? 'bg-green-100 text-green-800' :
                          entry.status === 'acknowledged' ? 'bg-blue-100 text-blue-800' :
                          entry.status === 'failed' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {entry.status}
                        </span>
                        {entry.previousValue !== undefined && (
                          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-800">
                            Previous: {String(entry.previousValue)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      {entry.status === 'pending' && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleAcknowledgeCommand(entry.id)}
                        >
                          Acknowledge
                        </Button>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDeleteCommand(entry.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
              <AlertDialogAction onClick={handleApply}>Apply</AlertDialogAction>
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
              <AlertDialogAction onClick={handleSave}>Save & Apply</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Authentication Dialog */}
      <Dialog open={showAuthDialog} onOpenChange={(open) => {
        setShowAuthDialog(open);
        if (!open) {
          setPendingChange(null);
          setLoginError("");
          setUsername("");
          setPassword("");
        }
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Authentication Required</DialogTitle>
            <DialogDescription>Please authenticate to modify equipment controls other than setpoints</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {loginError && (
              <div className="text-red-500 text-sm">{loginError}</div>
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
              variant="outline" 
              onClick={() => setShowAuthDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAuthenticate}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Authenticating..." : "Login"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
