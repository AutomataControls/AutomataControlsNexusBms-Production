"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

interface DOASControlsProps {
  equipment: any
}

export function DOASControls({ equipment }: DOASControlsProps) {
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
          <TabsTrigger value="ventilation">Ventilation</TabsTrigger>
          <TabsTrigger value="recovery">Energy Recovery</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>General Controls</CardTitle>
              <CardDescription>Basic operation controls for the DOAS unit</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="unit-enable">Unit Enable</Label>
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
                    <option value="cooling">Cooling</option>
                    <option value="heating">Heating</option>
                    <option value="ventilation">Ventilation Only</option>
                    <option value="dehumidification">Dehumidification</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="supply-temp-setpoint">Supply Air Temperature Setpoint (°F)</Label>
                  <span className="text-sm">{controlValues.supplyAirTempSetpoint || 70}°F</span>
                </div>
                <Slider
                  id="supply-temp-setpoint"
                  min={60}
                  max={80}
                  step={0.5}
                  value={[controlValues.supplyAirTempSetpoint || 70]}
                  onValueChange={(value) => handleSetpointChange("supplyAirTempSetpoint", value[0])}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="humidity-setpoint">Humidity Setpoint (%)</Label>
                  <span className="text-sm">{controlValues.humiditySetpoint || 50}%</span>
                </div>
                <Slider
                  id="humidity-setpoint"
                  min={30}
                  max={70}
                  step={1}
                  value={[controlValues.humiditySetpoint || 50]}
                  onValueChange={(value) => handleSetpointChange("humiditySetpoint", value[0])}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ventilation" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Ventilation Controls</CardTitle>
              <CardDescription>Control settings for ventilation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="outdoor-air-cfm">Outdoor Air Flow (CFM)</Label>
                  <span className="text-sm">{controlValues.outdoorAirCFM || 1000} CFM</span>
                </div>
                <Slider
                  id="outdoor-air-cfm"
                  min={0}
                  max={2000}
                  step={50}
                  value={[controlValues.outdoorAirCFM || 1000]}
                  onValueChange={(value) => handleSetpointChange("outdoorAirCFM", value[0])}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="supply-fan-speed">Supply Fan Speed (%)</Label>
                  <span className="text-sm">{controlValues.supplyFanSpeed || 75}%</span>
                </div>
                <Slider
                  id="supply-fan-speed"
                  min={0}
                  max={100}
                  step={1}
                  value={[controlValues.supplyFanSpeed || 75]}
                  onValueChange={(value) => handleSetpointChange("supplyFanSpeed", value[0])}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="co2-control-enable">CO2 Demand Control</Label>
                <Switch
                  id="co2-control-enable"
                  checked={controlValues.co2ControlEnable === true}
                  onCheckedChange={(checked) => handleSetpointChange("co2ControlEnable", checked)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="co2-setpoint">CO2 Setpoint (ppm)</Label>
                  <span className="text-sm">{controlValues.co2Setpoint || 800} ppm</span>
                </div>
                <Slider
                  id="co2-setpoint"
                  min={500}
                  max={1500}
                  step={50}
                  value={[controlValues.co2Setpoint || 800]}
                  onValueChange={(value) => handleSetpointChange("co2Setpoint", value[0])}
                  disabled={!controlValues.co2ControlEnable}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recovery" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Energy Recovery Controls</CardTitle>
              <CardDescription>Control settings for energy recovery</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="energy-recovery-enable">Energy Recovery Enable</Label>
                <Switch
                  id="energy-recovery-enable"
                  checked={controlValues.energyRecoveryEnable === true}
                  onCheckedChange={(checked) => handleSetpointChange("energyRecoveryEnable", checked)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="energy-recovery-speed">Energy Recovery Wheel Speed (%)</Label>
                  <span className="text-sm">{controlValues.energyRecoverySpeed || 80}%</span>
                </div>
                <Slider
                  id="energy-recovery-speed"
                  min={0}
                  max={100}
                  step={1}
                  value={[controlValues.energyRecoverySpeed || 80]}
                  onValueChange={(value) => handleSetpointChange("energyRecoverySpeed", value[0])}
                  disabled={!controlValues.energyRecoveryEnable}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="bypass-damper-enable">Bypass Damper Enable</Label>
                <Switch
                  id="bypass-damper-enable"
                  checked={controlValues.bypassDamperEnable === true}
                  onCheckedChange={(checked) => handleSetpointChange("bypassDamperEnable", checked)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="bypass-damper-position">Bypass Damper Position (%)</Label>
                  <span className="text-sm">{controlValues.bypassDamperPosition || 0}%</span>
                </div>
                <Slider
                  id="bypass-damper-position"
                  min={0}
                  max={100}
                  step={1}
                  value={[controlValues.bypassDamperPosition || 0]}
                  onValueChange={(value) => handleSetpointChange("bypassDamperPosition", value[0])}
                  disabled={!controlValues.bypassDamperEnable}
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

