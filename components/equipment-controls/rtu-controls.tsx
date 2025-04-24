"use client"

import { useState, useEffect } from "react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface RTUControlsProps {
  equipment: any
}

export function RTUControls({ equipment }: RTUControlsProps) {
  const [controlValues, setControlValues] = useState<any>({
    ...equipment.controls,
    // Set default values if not provided
    unitEnable: equipment.controls?.unitEnable ?? false,
    operationMode: equipment.controls?.operationMode ?? "auto",
    temperatureSetpoint: equipment.controls?.temperatureSetpoint ?? 72,
    stage1HeatingEnable: equipment.controls?.stage1HeatingEnable ?? false,
    stage2HeatingEnable: equipment.controls?.stage2HeatingEnable ?? false,
    heatingMode: equipment.controls?.heatingMode ?? "auto",
    stage1CoolingEnable: equipment.controls?.stage1CoolingEnable ?? false,
    stage2CoolingEnable: equipment.controls?.stage2CoolingEnable ?? false,
    coolingMode: equipment.controls?.coolingMode ?? "auto",
    supplyFanEnable: equipment.controls?.supplyFanEnable ?? false,
    supplyFanMode: equipment.controls?.supplyFanMode ?? "auto",
    economizerPosition: equipment.controls?.economizerPosition ?? 0,
  })
  const [username, setUsername] = useState<string>("")
  const [password, setPassword] = useState<string>("")
  const [showAuthDialog, setShowAuthDialog] = useState<boolean>(false)
  const [loginError, setLoginError] = useState<string>("")
  const [pendingChange, setPendingChange] = useState<{ key: string; value: any } | null>(null)
  const { socket } = useSocket()
  const { toast } = useToast()
  const { db } = useFirebase()
  const { user, loginWithUsername } = useAuth()

  // Derive authentication status from user object instead of local state
  const isAuthenticated = !!user && user.roles && (user.roles.includes("DevOps") || user.roles.includes("admin"))

  // Add effect to handle authentication state changes
  useEffect(() => {
    if (user && showAuthDialog) {
      // Check if user has the required role
      if (user.roles && (user.roles.includes("DevOps") || user.roles.includes("admin"))) {
        setShowAuthDialog(false)
        setLoginError("")

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
        setLoginError("You don't have permission to modify these controls")
        toast({
          title: "Authentication Failed",
          description: "Insufficient permissions",
          variant: "destructive",
        })
      }
    }
  }, [user, showAuthDialog, pendingChange, controlValues, toast])

  const handleControlChange = (key: string, value: any) => {
    // Setpoint changes don't require authentication
    if (key.toLowerCase().includes("setpoint")) {
      setControlValues({
        ...controlValues,
        [key]: value,
      })
    } else {
      // For other controls, require authentication
      if (isAuthenticated) {
        // If already authenticated, apply the change directly
        setControlValues({
          ...controlValues,
          [key]: value,
        })
      } else {
        // Otherwise, store the pending change and show auth dialog
        setPendingChange({ key, value })
        setShowAuthDialog(true)
      }
    }
  }

  const handleAuthenticate = async () => {
    setLoginError("")

    try {
      // Just attempt login - the useEffect will handle success
      await loginWithUsername(username, password)
      // Note: Don't manually set authenticated state here
      // The useEffect will handle this when the user state updates
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
        throw new Error("Database or equipment ID not available")
      }

      const equipmentRef = doc(db, "equipment", equipment.id)

      // Update the controls field in the equipment document
      await updateDoc(equipmentRef, {
        controls: controlValues,
        lastUpdated: new Date(),
      })

      // Also send to socket if available
      if (socket) {
        socket.emit("control", {
          equipmentId: equipment.id,
          controls: controlValues,
        })
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
          <TabsTrigger value="heating">Heating</TabsTrigger>
          <TabsTrigger value="cooling">Cooling</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>General Controls</CardTitle>
              <CardDescription>Basic operation controls for the rooftop unit</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="unit-enable">Unit Enable</Label>
                <Switch
                  id="unit-enable"
                  checked={controlValues.unitEnable === true}
                  onCheckedChange={(checked) => handleControlChange("unitEnable", checked)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="mode">Operation Mode</Label>
                  <Select
                    value={controlValues.operationMode || "auto"}
                    onValueChange={(value) => handleControlChange("operationMode", value)}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto</SelectItem>
                      <SelectItem value="cooling">Cooling</SelectItem>
                      <SelectItem value="heating">Heating</SelectItem>
                      <SelectItem value="fan">Fan Only</SelectItem>
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
                  onValueChange={(value) => handleControlChange("temperatureSetpoint", value[0])}
                />
              </div>

              <div className="space-y-2 border-t pt-4">
                <h3 className="font-medium">Supply Fan Controls</h3>
                <div className="flex items-center justify-between">
                  <Label htmlFor="supply-fan-mode">Supply Fan Mode</Label>
                  <Select
                    value={controlValues.supplyFanMode || "auto"}
                    onValueChange={(value) => handleControlChange("supplyFanMode", value)}
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

                {controlValues.supplyFanMode === "manual" && (
                  <div className="flex items-center justify-between mt-2">
                    <Label htmlFor="supply-fan-enable">Supply Fan Enable</Label>
                    <Switch
                      id="supply-fan-enable"
                      checked={controlValues.supplyFanEnable === true}
                      onCheckedChange={(checked) => handleControlChange("supplyFanEnable", checked)}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2 border-t pt-4">
                <h3 className="font-medium">Economizer Controls</h3>
                <div className="flex items-center justify-between">
                  <Label htmlFor="economizer-position">Economizer Position (0-10V)</Label>
                  <span className="text-sm">{controlValues.economizerPosition || 0}%</span>
                </div>
                <Slider
                  id="economizer-position"
                  min={0}
                  max={100}
                  step={1}
                  value={[controlValues.economizerPosition || 0]}
                  onValueChange={(value) => handleControlChange("economizerPosition", value[0])}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="heating" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Heating Controls</CardTitle>
              <CardDescription>Control settings for heating stages</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="heating-mode">Heating Mode</Label>
                  <Select
                    value={controlValues.heatingMode || "auto"}
                    onValueChange={(value) => handleControlChange("heatingMode", value)}
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
              </div>

              {controlValues.heatingMode === "manual" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="stage1-heating-enable">Stage 1 Heating</Label>
                    <Switch
                      id="stage1-heating-enable"
                      checked={controlValues.stage1HeatingEnable === true}
                      onCheckedChange={(checked) => handleControlChange("stage1HeatingEnable", checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="stage2-heating-enable">Stage 2 Heating</Label>
                    <Switch
                      id="stage2-heating-enable"
                      checked={controlValues.stage2HeatingEnable === true}
                      onCheckedChange={(checked) => handleControlChange("stage2HeatingEnable", checked)}
                      disabled={!controlValues.stage1HeatingEnable}
                    />
                  </div>
                </div>
              )}

              {controlValues.heatingMode === "auto" && (
                <div className="p-4 bg-gray-50 rounded-md">
                  <p className="text-sm text-gray-500">
                    Heating stages will be controlled automatically based on temperature setpoint and current
                    conditions.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cooling" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Cooling Controls</CardTitle>
              <CardDescription>Control settings for DX cooling stages</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="cooling-mode">Cooling Mode</Label>
                  <Select
                    value={controlValues.coolingMode || "auto"}
                    onValueChange={(value) => handleControlChange("coolingMode", value)}
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
              </div>

              {controlValues.coolingMode === "manual" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="stage1-cooling-enable">Stage 1 Cooling</Label>
                    <Switch
                      id="stage1-cooling-enable"
                      checked={controlValues.stage1CoolingEnable === true}
                      onCheckedChange={(checked) => handleControlChange("stage1CoolingEnable", checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="stage2-cooling-enable">Stage 2 Cooling</Label>
                    <Switch
                      id="stage2-cooling-enable"
                      checked={controlValues.stage2CoolingEnable === true}
                      onCheckedChange={(checked) => handleControlChange("stage2CoolingEnable", checked)}
                      disabled={!controlValues.stage1CoolingEnable}
                    />
                  </div>
                </div>
              )}

              {controlValues.coolingMode === "auto" && (
                <div className="p-4 bg-gray-50 rounded-md">
                  <p className="text-sm text-gray-500">
                    Cooling stages will be controlled automatically based on temperature setpoint and current
                    conditions.
                  </p>
                </div>
              )}
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
            <DialogDescription>Please enter your credentials to modify equipment controls</DialogDescription>
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
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAuthenticate()
                  }
                }}
              />
            </div>
            {loginError && <div className="text-red-500 text-sm">{loginError}</div>}
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
