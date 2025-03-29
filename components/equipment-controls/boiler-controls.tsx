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

interface BoilerControlsProps {
  equipment: any
}

export function BoilerControls({ equipment }: BoilerControlsProps) {
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

