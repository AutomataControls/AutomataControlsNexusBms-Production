"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { useToast } from "@/components/ui/use-toast"
import { useSocket } from "@/lib/socket-context"
import { useFirebase } from "@/lib/firebase-context"
import { doc, updateDoc } from "firebase/firestore"
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

interface ActuatorControlsProps {
  equipment: any
}

export function ActuatorControls({ equipment }: ActuatorControlsProps) {
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
  const { db } = useFirebase()

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
    // Use lowercase for consistency in username check
    if (username.toLowerCase() === "devops" && password === "Juelze") {
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
      <Card>
        <CardHeader>
          <CardTitle>Actuator Controls</CardTitle>
          <CardDescription>Control settings for the actuator</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="actuator-enable">Actuator Enable</Label>
            <Switch
              id="actuator-enable"
              checked={controlValues.actuatorEnable === true}
              onCheckedChange={(checked) => handleSetpointChange("actuatorEnable", checked)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="position-setpoint">Position Setpoint (%)</Label>
              <span className="text-sm">{controlValues.positionSetpoint || 0}%</span>
            </div>
            <Slider
              id="position-setpoint"
              min={0}
              max={100}
              step={1}
              value={[controlValues.positionSetpoint || 0]}
              onValueChange={(value) => handleSetpointChange("positionSetpoint", value[0])}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="control-mode">Control Mode</Label>
              <select
                id="control-mode"
                className="flex h-10 w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={controlValues.controlMode || "auto"}
                onChange={(e) => handleSetpointChange("controlMode", e.target.value)}
              >
                <option value="auto">Auto</option>
                <option value="manual">Manual</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="actuator-type">Actuator Type</Label>
              <select
                id="actuator-type"
                className="flex h-10 w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={controlValues.actuatorType || "modulating"}
                onChange={(e) => handleSetpointChange("actuatorType", e.target.value)}
              >
                <option value="modulating">Modulating</option>
                <option value="two-position">Two-Position</option>
                <option value="three-position">Three-Position</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="signal-type">Signal Type</Label>
              <select
                id="signal-type"
                className="flex h-10 w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={controlValues.signalType || "0-10v"}
                onChange={(e) => handleSetpointChange("signalType", e.target.value)}
              >
                <option value="0-10v">0-10V DC</option>
                <option value="4-20ma">4-20mA</option>
                <option value="2-10v">2-10V DC</option>
                <option value="floating">Floating</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="travel-time">Travel Time (seconds)</Label>
              <span className="text-sm">{controlValues.travelTime || 90} sec</span>
            </div>
            <Slider
              id="travel-time"
              min={0}
              max={300}
              step={5}
              value={[controlValues.travelTime || 90]}
              onValueChange={(value) => handleSetpointChange("travelTime", value[0])}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="fail-position">Fail Position</Label>
            <select
              id="fail-position"
              className="flex h-10 w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={controlValues.failPosition || "last"}
              onChange={(e) => handleSetpointChange("failPosition", e.target.value)}
            >
              <option value="last">Last Position</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="mid">Mid Position</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="reverse-action">Reverse Action</Label>
            <Switch
              id="reverse-action"
              checked={controlValues.reverseAction === true}
              onCheckedChange={(checked) => handleSetpointChange("reverseAction", checked)}
            />
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