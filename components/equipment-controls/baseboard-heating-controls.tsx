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

interface BaseboardHeatingControlsProps {
  equipment: any
}

export function BaseboardHeatingControls({ equipment }: BaseboardHeatingControlsProps) {
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
    if (key.toLowerCase().includes("setpoint") || key.toLowerCase().includes("temperature")) {
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
    if (
      !isAuthenticated &&
      Object.keys(controlValues).some(
        (key) => !key.toLowerCase().includes("setpoint") && !key.toLowerCase().includes("temperature"),
      )
    ) {
      toast({
        title: "Authentication Required",
        description: "Please authenticate to apply changes to controls other than temperature setpoints",
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
    if (
      !isAuthenticated &&
      Object.keys(controlValues).some(
        (key) => !key.toLowerCase().includes("setpoint") && !key.toLowerCase().includes("temperature"),
      )
    ) {
      toast({
        title: "Authentication Required",
        description: "Please authenticate to save changes to controls other than temperature setpoints",
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
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>General Controls</CardTitle>
              <CardDescription>Basic operation controls for the electric baseboard heating</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="heater-enable">Heater Enable</Label>
                <Switch
                  id="heater-enable"
                  checked={controlValues.heaterEnable === true}
                  onCheckedChange={(checked) => handleSetpointChange("heaterEnable", checked)}
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
                    <option value="eco">Eco</option>
                    <option value="away">Away</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="temperature-setpoint">Temperature Setpoint (°F)</Label>
                  <span className="text-sm">{controlValues.temperatureSetpoint || 68}°F</span>
                </div>
                <Slider
                  id="temperature-setpoint"
                  min={50}
                  max={90}
                  step={1}
                  value={[controlValues.temperatureSetpoint || 68]}
                  onValueChange={(value) => handleSetpointChange("temperatureSetpoint", value[0])}
                  disabled={!controlValues.heaterEnable}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="heating-power">Heating Power (%)</Label>
                  <span className="text-sm">{controlValues.heatingPower || 100}%</span>
                </div>
                <Slider
                  id="heating-power"
                  min={0}
                  max={100}
                  step={5}
                  value={[controlValues.heatingPower || 100]}
                  onValueChange={(value) => handleSetpointChange("heatingPower", value[0])}
                  disabled={!controlValues.heaterEnable || controlValues.operationMode !== "manual"}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="temperature-hold">Temperature Hold</Label>
                <Switch
                  id="temperature-hold"
                  checked={controlValues.temperatureHold === true}
                  onCheckedChange={(checked) => handleSetpointChange("temperatureHold", checked)}
                  disabled={!controlValues.heaterEnable}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Schedule Settings</CardTitle>
              <CardDescription>Configure heating schedule and temperature setbacks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="schedule-enable">Enable Schedule</Label>
                <Switch
                  id="schedule-enable"
                  checked={controlValues.scheduleEnable === true}
                  onCheckedChange={(checked) => handleSetpointChange("scheduleEnable", checked)}
                  disabled={!controlValues.heaterEnable || controlValues.operationMode !== "scheduled"}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="eco-temperature">Eco Temperature (°F)</Label>
                  <span className="text-sm">{controlValues.ecoTemperature || 62}°F</span>
                </div>
                <Slider
                  id="eco-temperature"
                  min={50}
                  max={75}
                  step={1}
                  value={[controlValues.ecoTemperature || 62]}
                  onValueChange={(value) => handleSetpointChange("ecoTemperature", value[0])}
                  disabled={!controlValues.heaterEnable}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="away-temperature">Away Temperature (°F)</Label>
                  <span className="text-sm">{controlValues.awayTemperature || 55}°F</span>
                </div>
                <Slider
                  id="away-temperature"
                  min={45}
                  max={65}
                  step={1}
                  value={[controlValues.awayTemperature || 55]}
                  onValueChange={(value) => handleSetpointChange("awayTemperature", value[0])}
                  disabled={!controlValues.heaterEnable}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="schedule-override">Schedule Override</Label>
                <Switch
                  id="schedule-override"
                  checked={controlValues.scheduleOverride === true}
                  onCheckedChange={(checked) => handleSetpointChange("scheduleOverride", checked)}
                  disabled={!controlValues.heaterEnable || !controlValues.scheduleEnable}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="override-duration">Override Duration (hours)</Label>
                  <span className="text-sm">{controlValues.overrideDuration || 2} hours</span>
                </div>
                <Slider
                  id="override-duration"
                  min={1}
                  max={24}
                  step={1}
                  value={[controlValues.overrideDuration || 2]}
                  onValueChange={(value) => handleSetpointChange("overrideDuration", value[0])}
                  disabled={
                    !controlValues.heaterEnable || !controlValues.scheduleEnable || !controlValues.scheduleOverride
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
              <CardDescription>Advanced heating control settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="temperature-differential">Temperature Differential (°F)</Label>
                  <span className="text-sm">{controlValues.temperatureDifferential || 1}°F</span>
                </div>
                <Slider
                  id="temperature-differential"
                  min={0.5}
                  max={3}
                  step={0.5}
                  value={[controlValues.temperatureDifferential || 1]}
                  onValueChange={(value) => handleSetpointChange("temperatureDifferential", value[0])}
                  disabled={!controlValues.heaterEnable}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="frost-protection">Frost Protection</Label>
                <Switch
                  id="frost-protection"
                  checked={controlValues.frostProtection === true}
                  onCheckedChange={(checked) => handleSetpointChange("frostProtection", checked)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="frost-protection-temp">Frost Protection Temperature (°F)</Label>
                  <span className="text-sm">{controlValues.frostProtectionTemp || 45}°F</span>
                </div>
                <Slider
                  id="frost-protection-temp"
                  min={35}
                  max={50}
                  step={1}
                  value={[controlValues.frostProtectionTemp || 45]}
                  onValueChange={(value) => handleSetpointChange("frostProtectionTemp", value[0])}
                  disabled={!controlValues.frostProtection}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="open-window-detection">Open Window Detection</Label>
                <Switch
                  id="open-window-detection"
                  checked={controlValues.openWindowDetection === true}
                  onCheckedChange={(checked) => handleSetpointChange("openWindowDetection", checked)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="temperature-limit">Maximum Temperature Limit (°F)</Label>
                  <span className="text-sm">{controlValues.temperatureLimit || 85}°F</span>
                </div>
                <Slider
                  id="temperature-limit"
                  min={70}
                  max={95}
                  step={1}
                  value={[controlValues.temperatureLimit || 85]}
                  onValueChange={(value) => handleSetpointChange("temperatureLimit", value[0])}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="adaptive-start">Adaptive Start</Label>
                <Switch
                  id="adaptive-start"
                  checked={controlValues.adaptiveStart === true}
                  onCheckedChange={(checked) => handleSetpointChange("adaptiveStart", checked)}
                  disabled={!controlValues.scheduleEnable}
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
                This will apply the current control settings to the electric baseboard heating. The changes will not be
                saved permanently.
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
                This will save the current control settings and apply them to the electric baseboard heating. The
                changes will be permanent.
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
            <DialogDescription>
              Please authenticate to modify equipment controls other than temperature setpoints
            </DialogDescription>
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
