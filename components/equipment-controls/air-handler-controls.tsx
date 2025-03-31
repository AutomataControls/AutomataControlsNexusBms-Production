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

interface AirHandlerControlsProps {
  equipment: any
}

export function AirHandlerControls({ equipment }: AirHandlerControlsProps) {
  const [controlValues, setControlValues] = useState<any>({
    ...equipment.controls,
  })
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
  const [username, setUsername] = useState<string>("")
  const [password, setPassword] = useState<string>("")
  const [showAuthDialog, setShowAuthDialog] = useState<boolean>(false)
  const [loginError, setLoginError] = useState<string>("")
  const [pendingChange, setPendingChange] = useState<{ key: string; value: any } | null>(null)
  const { socket } = useSocket()
  const { toast } = useToast()
  const { db } = useFirebase()
  const { loginWithUsername } = useAuth()

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

  const handleAuthenticate = async () => {
    setLoginError("")
    
    try {
      // Use the authentication system instead of hardcoded credentials
      await loginWithUsername(username, password)
      
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
    } catch (error) {
      console.error("Authentication error:", error)
      setLoginError("Invalid username or password")
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
      
      // Also send to socket if available
      if (socket) {
        socket.emit("control", {
          equipmentId: equipment.id,
          controls: controlValues,
        });
      }

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
          <TabsTrigger value="supply">Supply Air</TabsTrigger>
          <TabsTrigger value="return">Return Air</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>General Controls</CardTitle>
              <CardDescription>Basic operation controls for the air handler</CardDescription>
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
                    <option value="fan">Fan Only</option>
                    <option value="dehumidification">Dehumidification</option>
                  </select>
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
                  onValueChange={(value) => handleSetpointChange("temperatureSetpoint", value[0])}
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

              <div className="flex items-center justify-between">
                <Label htmlFor="economizer-enable">Economizer Enable</Label>
                <Switch
                  id="economizer-enable"
                  checked={controlValues.economizerEnable === true}
                  onCheckedChange={(checked) => handleSetpointChange("economizerEnable", checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="supply" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Supply Air Controls</CardTitle>
              <CardDescription>Control settings for supply air</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="supply-temp-setpoint">Supply Air Temperature Setpoint (°F)</Label>
                  <span className="text-sm">{controlValues.supplyAirTempSetpoint || 55}°F</span>
                </div>
                <Slider
                  id="supply-temp-setpoint"
                  min={45}
                  max={75}
                  step={0.5}
                  value={[controlValues.supplyAirTempSetpoint || 55]}
                  onValueChange={(value) => handleSetpointChange("supplyAirTempSetpoint", value[0])}
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
                <Label htmlFor="supply-fan-enable">Supply Fan Enable</Label>
                <Switch
                  id="supply-fan-enable"
                  checked={controlValues.supplyFanEnable === true}
                  onCheckedChange={(checked) => handleSetpointChange("supplyFanEnable", checked)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="static-pressure-setpoint">Static Pressure Setpoint (inWC)</Label>
                  <span className="text-sm">{controlValues.staticPressureSetpoint || 1.5} inWC</span>
                </div>
                <Slider
                  id="static-pressure-setpoint"
                  min={0.5}
                  max={3.0}
                  step={0.1}
                  value={[controlValues.staticPressureSetpoint || 1.5]}
                  onValueChange={(value) => handleSetpointChange("staticPressureSetpoint", value[0])}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="return" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Return Air Controls</CardTitle>
              <CardDescription>Control settings for return air</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="return-fan-enable">Return Fan Enable</Label>
                <Switch
                  id="return-fan-enable"
                  checked={controlValues.returnFanEnable === true}
                  onCheckedChange={(checked) => handleSetpointChange("returnFanEnable", checked)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="return-fan-speed">Return Fan Speed (%)</Label>
                  <span className="text-sm">{controlValues.returnFanSpeed || 60}%</span>
                </div>
                <Slider
                  id="return-fan-speed"
                  min={0}
                  max={100}
                  step={1}
                  value={[controlValues.returnFanSpeed || 60]}
                  onValueChange={(value) => handleSetpointChange("returnFanSpeed", value[0])}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="return-air-damper">Return Air Damper Position (%)</Label>
                  <span className="text-sm">{controlValues.returnAirDamper || 50}%</span>
                </div>
                <Slider
                  id="return-air-damper"
                  min={0}
                  max={100}
                  step={1}
                  value={[controlValues.returnAirDamper || 50]}
                  onValueChange={(value) => handleSetpointChange("returnAirDamper", value[0])}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Authentication Required</DialogTitle>
            <DialogDescription>
              Please enter your credentials to modify equipment controls
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
              />
            </div>
            {loginError && (
              <div className="text-red-500 text-sm">
                {loginError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAuthDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAuthenticate}>Login</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}