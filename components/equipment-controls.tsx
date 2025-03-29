"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { useToast } from "@/components/ui/use-toast"
import { useSocket } from "@/lib/socket-context"
import { useFirebase } from "@/lib/firebase-context"
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

interface EquipmentControlsProps {
  equipment: any
}

export function EquipmentControls({ equipment }: EquipmentControlsProps) {
  const [controlValues, setControlValues] = useState<any>({
    ...equipment.controls,
  })
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
  const [username, setUsername] = useState<string>("")
  const [password, setPassword] = useState<string>("")
  const { socket } = useSocket()
  const { db } = useFirebase()
  const { toast } = useToast()

  const handleControlChange = (key: string, value: any) => {
    setControlValues({
      ...controlValues,
      [key]: value,
    })
  }

  const handleAuthenticate = () => {
    if (username === "DevOps" && password === "Juelz2") {
      setIsAuthenticated(true)
      toast({
        title: "Authentication Successful",
        description: "You can now modify equipment controls",
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
    if (!isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please authenticate to apply changes",
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
    if (!isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please authenticate to save changes",
        variant: "destructive",
      })
      return
    }

    if (!db) {
      toast({
        title: "Database Error",
        description: "Unable to connect to the database",
        variant: "destructive",
      })
      return
    }

    try {
      // Update the equipment controls in the database
      await db.collection("equipment").doc(equipment.id).update({
        controls: controlValues,
      })

      // Send control values to the equipment via socket.io
      if (socket) {
        socket.emit("control", {
          equipmentId: equipment.id,
          controls: controlValues,
        })
      }

      toast({
        title: "Controls Saved",
        description: "Changes have been saved and applied to the equipment",
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

  const renderControlItem = (key: string, value: any, config: any) => {
    const { type, label, min, max, step } = config

    switch (type) {
      case "switch":
        return (
          <div className="flex items-center justify-between" key={key}>
            <Label htmlFor={key}>{label}</Label>
            <Switch
              id={key}
              checked={controlValues[key] === true}
              onCheckedChange={(checked) => handleControlChange(key, checked)}
              disabled={!isAuthenticated}
            />
          </div>
        )
      case "slider":
        return (
          <div className="space-y-2" key={key}>
            <div className="flex items-center justify-between">
              <Label htmlFor={key}>{label}</Label>
              <span className="text-sm">{controlValues[key]}</span>
            </div>
            <Slider
              id={key}
              min={min || 0}
              max={max || 100}
              step={step || 1}
              value={[controlValues[key]]}
              onValueChange={(value) => handleControlChange(key, value[0])}
              disabled={!isAuthenticated}
            />
          </div>
        )
      case "input":
        return (
          <div className="space-y-2" key={key}>
            <Label htmlFor={key}>{label}</Label>
            <Input
              id={key}
              type="number"
              value={controlValues[key]}
              onChange={(e) => handleControlChange(key, Number.parseFloat(e.target.value))}
              disabled={!isAuthenticated}
            />
          </div>
        )
      default:
        return null
    }
  }

  // Group controls by category
  const groupedControls: Record<string, any> = {}

  if (equipment.controlConfig) {
    Object.entries(equipment.controlConfig).forEach(([key, config]: [string, any]) => {
      const category = config.category || "General"

      if (!groupedControls[category]) {
        groupedControls[category] = {}
      }

      groupedControls[category][key] = config
    })
  }

  return (
    <div className="space-y-6">
      {!isAuthenticated && (
        <Card>
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please authenticate to modify equipment controls</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="auth-username">Username</Label>
              <Input id="auth-username" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="auth-password">Password</Label>
              <Input
                id="auth-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleAuthenticate}>Authenticate</Button>
          </CardFooter>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {Object.entries(groupedControls).map(([category, controls]) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle>{category} Controls</CardTitle>
              <CardDescription>
                {equipment.name} - {equipment.type}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(controls).map(([key, config]: [string, any]) =>
                renderControlItem(key, controlValues[key], config),
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end space-x-4">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" disabled={!isAuthenticated}>
              Apply Changes
            </Button>
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
            <Button disabled={!isAuthenticated}>Save & Apply</Button>
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
    </div>
  )
}

