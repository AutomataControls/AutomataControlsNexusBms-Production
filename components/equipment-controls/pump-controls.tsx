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

interface PumpControlsProps {
  equipment: any
}

export function PumpControls({ equipment }: PumpControlsProps) {
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
                  onCheckedChange={(checked) => handleSetpointChange("pumpEnable", checked)}
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
                  onValueChange={(value) => handleSetpointChange("speedSetpoint", value[0])}
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
                    onChange={(e) => handleSetpointChange("controlMode", e.target.value)}
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
                  onCheckedChange={(checked) => handleSetpointChange("autoAlternation", checked)}
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
                  onValueChange={(value) => handleSetpointChange("pressureSetpoint", value[0])}
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
                  onValueChange={(value) => handleSetpointChange("flowSetpoint", value[0])}
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
                  onValueChange={(value) => handleSetpointChange("minSpeed", value[0])}
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
                  onValueChange={(value) => handleSetpointChange("maxSpeed", value[0])}
                  disabled={!controlValues.pumpEnable}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="flow-sensor">Flow Sensor Enable</Label>
                <Switch
                  id="flow-sensor"
                  checked={controlValues.flowSensorEnable === true}
                  onCheckedChange={(checked) => handleSetpointChange("flowSensorEnable", checked)}
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
                  onValueChange={(value) => handleSetpointChange("rampUpTime", value[0])}
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
                  onValueChange={(value) => handleSetpointChange("rampDownTime", value[0])}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="dry-run-protection">Dry Run Protection</Label>
                <Switch
                  id="dry-run-protection"
                  checked={controlValues.dryRunProtection === true}
                  onCheckedChange={(checked) => handleSetpointChange("dryRunProtection", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="auto-restart">Auto Restart</Label>
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

