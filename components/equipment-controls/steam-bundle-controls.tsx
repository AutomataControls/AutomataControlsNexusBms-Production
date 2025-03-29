"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { useToast } from "@/components/ui/use-toast"
import { useSocket } from "@/lib/socket-context"
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
import { Badge } from "@/components/ui/badge"

interface SteamBundleControlsProps {
  equipment: any
}

export function SteamBundleControls({ equipment }: SteamBundleControlsProps) {
  const [controlValues, setControlValues] = useState<any>({
    ...equipment.controls,
  })
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
  const [username, setUsername] = useState<string>("")
  const [password, setPassword] = useState<string>("")
  const [showAuthDialog, setShowAuthDialog] = useState<boolean>(false)
  const [pendingChange, setPendingChange] = useState<{ key: string; value: any } | null>(null)
  const { socket } = useSocket()
  const { toast } = useToast()

  const handleSetpointChange = (key: string, value: any) => {
    // Setpoint changes don't require authentication
    if (key.toLowerCase().includes("setpoint")) {
      setControlValues({
        ...controlValues,
        [key]: value,
      })
    } else {
      // For other controls, require authentication
      setPendingChange({ key, value })
      setShowAuthDialog(true)
    }
  }

  const handleAuthenticate = () => {
    if (username === "Devops" && password === "Juelze") {
      setIsAuthenticated(true)
      setShowAuthDialog(false)

      // Apply the pending change if there is one
      if (pendingChange) {
        setControlValues({
          ...controlValues,
          [pendingChange.key]: pendingChange.value,
        })
        setPendingChange(null)
      }

      toast({
        title: "Authentication Successful",
        description: "You can now modify equipment controls",
        className: "bg-teal-50 border-teal-200",
      })
    } else {
      toast({
        title: "Authentication Failed",
        description: "Invalid username or password",
        variant: "destructive",
      })
    }
  }

  const handleApply = () => {
    if (!isAuthenticated && Object.keys(controlValues).some((key) => !key.toLowerCase().includes("setpoint"))) {
      toast({
        title: "Authentication Required",
        description: "Please authenticate to apply changes to controls other than setpoints",
        variant: "destructive",
      })
      return
    }

    // Send control values to the equipment via socket.io
    if (socket) {
      socket.emit("control", {
        equipmentId: equipment.id,
        controls: controlValues,
      })

      toast({
        title: "Controls Applied",
        description: "Changes have been applied to the equipment",
        className: "bg-teal-50 border-teal-200",
      })
    } else {
      toast({
        title: "Connection Error",
        description: "Unable to connect to the control system",
        variant: "destructive",
      })
    }
  }

  const handleSave = async () => {
    if (!isAuthenticated && Object.keys(controlValues).some((key) => !key.toLowerCase().includes("setpoint"))) {
      toast({
        title: "Authentication Required",
        description: "Please authenticate to save changes to controls other than setpoints",
        variant: "destructive",
      })
      return
    }

    try {
      // In a real application, this would save to your database
      toast({
        title: "Controls Saved",
        description: "Changes have been saved and applied to the equipment",
        className: "bg-teal-50 border-teal-200",
      })
    } catch (error) {
      console.error("Error saving controls:", error)
      toast({
        title: "Save Error",
        description: "Failed to save control settings",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="general">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="valves">Valves</TabsTrigger>
          <TabsTrigger value="pumps">Pumps</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>General Controls</CardTitle>
              <CardDescription>Basic operation controls for the steam bundle</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="system-enable">System Enable</Label>
                <Switch
                  id="system-enable"
                  checked={controlValues.systemEnable === true}
                  onCheckedChange={(checked) => handleSetpointChange("systemEnable", checked)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="operation-mode">Operation Mode</Label>
                  <select
                    id="operation-mode"
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
                  <Label htmlFor="pressure-setpoint">Pressure Setpoint (PSI)</Label>
                  <span className="text-sm">{controlValues.pressureSetpoint || 30} PSI</span>
                </div>
                <Slider
                  id="pressure-setpoint"
                  min={0}
                  max={100}
                  step={1}
                  value={[controlValues.pressureSetpoint || 30]}
                  onValueChange={(value) => handleSetpointChange("pressureSetpoint", value[0])}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="temperature-setpoint">Temperature Setpoint (°F)</Label>
                  <span className="text-sm">{controlValues.temperatureSetpoint || 180}°F</span>
                </div>
                <Slider
                  id="temperature-setpoint"
                  min={120}
                  max={250}
                  step={1}
                  value={[controlValues.temperatureSetpoint || 180]}
                  onValueChange={(value) => handleSetpointChange("temperatureSetpoint", value[0])}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="differential-pressure-setpoint">Differential Pressure Setpoint (PSI)</Label>
                  <span className="text-sm">{controlValues.differentialPressureSetpoint || 5} PSI</span>
                </div>
                <Slider
                  id="differential-pressure-setpoint"
                  min={1}
                  max={20}
                  step={0.5}
                  value={[controlValues.differentialPressureSetpoint || 5]}
                  onValueChange={(value) => handleSetpointChange("differentialPressureSetpoint", value[0])}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="system-status">System Status</Label>
                <Badge
                  variant={controlValues.systemEnable ? "default" : "outline"}
                  className={controlValues.systemEnable ? "bg-green-500" : ""}
                >
                  {controlValues.systemEnable ? "Running" : "Stopped"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="valves" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Valve Controls</CardTitle>
              <CardDescription>Control settings for steam valves</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1/3 Valve Controls */}
                <div className="space-y-4 border p-4 rounded-lg">
                  <h3 className="text-lg font-medium">1/3 Valve</h3>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="valve-1-3-enable">Enable</Label>
                    <Switch
                      id="valve-1-3-enable"
                      checked={controlValues.valve13Enable === true}
                      onCheckedChange={(checked) => handleSetpointChange("valve13Enable", checked)}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="valve-1-3-position">Valve Position (%)</Label>
                      <span className="text-sm">{controlValues.valve13Position || 0}%</span>
                    </div>
                    <Slider
                      id="valve-1-3-position"
                      min={0}
                      max={100}
                      step={1}
                      value={[controlValues.valve13Position || 0]}
                      onValueChange={(value) => handleSetpointChange("valve13Position", value[0])}
                      disabled={!controlValues.valve13Enable}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="valve-1-3-mode">Control Mode</Label>
                      <select
                        id="valve-1-3-mode"
                        className="flex h-10 w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={controlValues.valve13Mode || "auto"}
                        onChange={(e) => handleSetpointChange("valve13Mode", e.target.value)}
                        disabled={!controlValues.valve13Enable}
                      >
                        <option value="auto">Auto</option>
                        <option value="manual">Manual</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 2/3 Valve Controls */}
                <div className="space-y-4 border p-4 rounded-lg">
                  <h3 className="text-lg font-medium">2/3 Valve</h3>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="valve-2-3-enable">Enable</Label>
                    <Switch
                      id="valve-2-3-enable"
                      checked={controlValues.valve23Enable === true}
                      onCheckedChange={(checked) => handleSetpointChange("valve23Enable", checked)}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="valve-2-3-position">Valve Position (%)</Label>
                      <span className="text-sm">{controlValues.valve23Position || 0}%</span>
                    </div>
                    <Slider
                      id="valve-2-3-position"
                      min={0}
                      max={100}
                      step={1}
                      value={[controlValues.valve23Position || 0]}
                      onValueChange={(value) => handleSetpointChange("valve23Position", value[0])}
                      disabled={!controlValues.valve23Enable}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="valve-2-3-mode">Control Mode</Label>
                      <select
                        id="valve-2-3-mode"
                        className="flex h-10 w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={controlValues.valve23Mode || "auto"}
                        onChange={(e) => handleSetpointChange("valve23Mode", e.target.value)}
                        disabled={!controlValues.valve23Enable}
                      >
                        <option value="auto">Auto</option>
                        <option value="manual">Manual</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="valve-control-strategy">Valve Control Strategy</Label>
                    <select
                      id="valve-control-strategy"
                      className="flex h-10 w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={controlValues.valveControlStrategy || "sequential"}
                      onChange={(e) => handleSetpointChange("valveControlStrategy", e.target.value)}
                    >
                      <option value="sequential">Sequential</option>
                      <option value="parallel">Parallel</option>
                      <option value="split-range">Split Range</option>
                    </select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pumps" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Pump Controls</CardTitle>
              <CardDescription>Control settings for pumps with VFDs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Pump 1 Controls */}
                <div className="space-y-4 border p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Pump 1</h3>
                    <Badge variant={controlValues.pump1IsLead ? "default" : "outline"}>
                      {controlValues.pump1IsLead ? "Lead" : "Lag"}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="pump-1-enable">Enable</Label>
                    <Switch
                      id="pump-1-enable"
                      checked={controlValues.pump1Enable === true}
                      onCheckedChange={(checked) => handleSetpointChange("pump1Enable", checked)}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="pump-1-speed">Speed (%)</Label>
                      <span className="text-sm">{controlValues.pump1Speed || 0}%</span>
                    </div>
                    <Slider
                      id="pump-1-speed"
                      min={0}
                      max={100}
                      step={1}
                      value={[controlValues.pump1Speed || 0]}
                      onValueChange={(value) => handleSetpointChange("pump1Speed", value[0])}
                      disabled={!controlValues.pump1Enable || controlValues.pumpControlMode === "auto"}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="pump-1-mode">Control Mode</Label>
                      <select
                        id="pump-1-mode"
                        className="flex h-10 w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={controlValues.pump1Mode || "auto"}
                        onChange={(e) => handleSetpointChange("pump1Mode", e.target.value)}
                        disabled={!controlValues.pump1Enable}
                      >
                        <option value="auto">Auto</option>
                        <option value="manual">Manual</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="pump-1-status">Status</Label>
                    <Badge
                      variant={controlValues.pump1Status === "running" ? "default" : "outline"}
                      className={
                        controlValues.pump1Status === "running"
                          ? "bg-green-500"
                          : controlValues.pump1Status === "fault"
                            ? "bg-red-500"
                            : ""
                      }
                    >
                      {controlValues.pump1Status === "running"
                        ? "Running"
                        : controlValues.pump1Status === "fault"
                          ? "Fault"
                          : "Stopped"}
                    </Badge>
                  </div>
                </div>

                {/* Pump 2 Controls */}
                <div className="space-y-4 border p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Pump 2</h3>
                    <Badge variant={!controlValues.pump1IsLead ? "default" : "outline"}>
                      {!controlValues.pump1IsLead ? "Lead" : "Lag"}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="pump-2-enable">Enable</Label>
                    <Switch
                      id="pump-2-enable"
                      checked={controlValues.pump2Enable === true}
                      onCheckedChange={(checked) => handleSetpointChange("pump2Enable", checked)}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="pump-2-speed">Speed (%)</Label>
                      <span className="text-sm">{controlValues.pump2Speed || 0}%</span>
                    </div>
                    <Slider
                      id="pump-2-speed"
                      min={0}
                      max={100}
                      step={1}
                      value={[controlValues.pump2Speed || 0]}
                      onValueChange={(value) => handleSetpointChange("pump2Speed", value[0])}
                      disabled={!controlValues.pump2Enable || controlValues.pumpControlMode === "auto"}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="pump-2-mode">Control Mode</Label>
                      <select
                        id="pump-2-mode"
                        className="flex h-10 w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={controlValues.pump2Mode || "auto"}
                        onChange={(e) => handleSetpointChange("pump2Mode", e.target.value)}
                        disabled={!controlValues.pump2Enable}
                      >
                        <option value="auto">Auto</option>
                        <option value="manual">Manual</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="pump-2-status">Status</Label>
                    <Badge
                      variant={controlValues.pump2Status === "running" ? "default" : "outline"}
                      className={
                        controlValues.pump2Status === "running"
                          ? "bg-green-500"
                          : controlValues.pump2Status === "fault"
                            ? "bg-red-500"
                            : ""
                      }
                    >
                      {controlValues.pump2Status === "running"
                        ? "Running"
                        : controlValues.pump2Status === "fault"
                          ? "Fault"
                          : "Stopped"}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="pt-4 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="pump-control-mode">Pump Control Mode</Label>
                    <select
                      id="pump-control-mode"
                      className="flex h-10 w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={controlValues.pumpControlMode || "auto"}
                      onChange={(e) => handleSetpointChange("pumpControlMode", e.target.value)}
                    >
                      <option value="auto">Auto</option>
                      <option value="manual">Manual</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="lead-lag-auto-changeover">Lead/Lag Auto Changeover</Label>
                  <Switch
                    id="lead-lag-auto-changeover"
                    checked={controlValues.leadLagAutoChangeover === true}
                    onCheckedChange={(checked) => handleSetpointChange("leadLagAutoChangeover", checked)}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="changeover-time">Changeover Time (hours)</Label>
                    <span className="text-sm">{controlValues.changeoverTime || 24} hours</span>
                  </div>
                  <Slider
                    id="changeover-time"
                    min={1}
                    max={168}
                    step={1}
                    value={[controlValues.changeoverTime || 24]}
                    onValueChange={(value) => handleSetpointChange("changeoverTime", value[0])}
                    disabled={!controlValues.leadLagAutoChangeover}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="auto-failover">Auto Failover</Label>
                  <Switch
                    id="auto-failover"
                    checked={controlValues.autoFailover === true}
                    onCheckedChange={(checked) => handleSetpointChange("autoFailover", checked)}
                  />
                </div>

                <Button
                  variant="outline"
                  onClick={() => handleSetpointChange("pump1IsLead", !controlValues.pump1IsLead)}
                  disabled={controlValues.pumpControlMode !== "manual"}
                >
                  Swap Lead/Lag Pumps
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
              <CardDescription>Advanced control settings for the steam bundle</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="differential-pressure-low-limit">Differential Pressure Low Limit (PSI)</Label>
                  <span className="text-sm">{controlValues.differentialPressureLowLimit || 2} PSI</span>
                </div>
                <Slider
                  id="differential-pressure-low-limit"
                  min={0.5}
                  max={10}
                  step={0.5}
                  value={[controlValues.differentialPressureLowLimit || 2]}
                  onValueChange={(value) => handleSetpointChange("differentialPressureLowLimit", value[0])}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="low-flow-alarm">Low Flow Alarm</Label>
                <Switch
                  id="low-flow-alarm"
                  checked={controlValues.lowFlowAlarm === true}
                  onCheckedChange={(checked) => handleSetpointChange("lowFlowAlarm", checked)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="low-flow-delay">Low Flow Alarm Delay (seconds)</Label>
                  <span className="text-sm">{controlValues.lowFlowDelay || 10} sec</span>
                </div>
                <Slider
                  id="low-flow-delay"
                  min={0}
                  max={60}
                  step={1}
                  value={[controlValues.lowFlowDelay || 10]}
                  onValueChange={(value) => handleSetpointChange("lowFlowDelay", value[0])}
                  disabled={!controlValues.lowFlowAlarm}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="pump-failover-on-low-flow">Pump Failover on Low Flow</Label>
                <Switch
                  id="pump-failover-on-low-flow"
                  checked={controlValues.pumpFailoverOnLowFlow === true}
                  onCheckedChange={(checked) => handleSetpointChange("pumpFailoverOnLowFlow", checked)}
                  disabled={!controlValues.autoFailover}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="pump-ramp-time">Pump Ramp Time (seconds)</Label>
                  <span className="text-sm">{controlValues.pumpRampTime || 30} sec</span>
                </div>
                <Slider
                  id="pump-ramp-time"
                  min={5}
                  max={120}
                  step={5}
                  value={[controlValues.pumpRampTime || 30]}
                  onValueChange={(value) => handleSetpointChange("pumpRampTime", value[0])}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="valve-response-time">Valve Response Time (seconds)</Label>
                  <span className="text-sm">{controlValues.valveResponseTime || 15} sec</span>
                </div>
                <Slider
                  id="valve-response-time"
                  min={1}
                  max={60}
                  step={1}
                  value={[controlValues.valveResponseTime || 15]}
                  onValueChange={(value) => handleSetpointChange("valveResponseTime", value[0])}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="auto-restart">Auto Restart After Fault</Label>
                <Switch
                  id="auto-restart"
                  checked={controlValues.autoRestart === true}
                  onCheckedChange={(checked) => handleSetpointChange("autoRestart", checked)}
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
                  onValueChange={(value) => handleSetpointChange("restartDelay", value[0])}
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
                  onValueChange={(value) => handleSetpointChange("maxRestartAttempts", value[0])}
                  disabled={!controlValues.autoRestart}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Authentication Required</DialogTitle>
            <DialogDescription>Please authenticate to modify equipment controls other than setpoints</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="auth-username" className="text-right">
                Username
              </Label>
              <Input
                id="auth-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="col-span-3"
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
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAuthDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAuthenticate}>Authenticate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

