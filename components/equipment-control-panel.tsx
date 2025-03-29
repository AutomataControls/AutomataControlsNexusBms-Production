"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { useSocket } from "@/lib/socket-context"
import { Gauge, Power, Thermometer, Fan } from "lucide-react"

interface EquipmentControlPanelProps {
  equipment: any
  onControlChange?: (controlKey: string, value: any) => void
}

export function EquipmentControlPanel({ equipment, onControlChange }: EquipmentControlPanelProps) {
  const [controlValues, setControlValues] = useState<any>(equipment.controls || {})
  const { socket, connected } = useSocket()
  const { toast } = useToast()

  const handleControlChange = (key: string, value: any) => {
    setControlValues({
      ...controlValues,
      [key]: value,
    })

    if (onControlChange) {
      onControlChange(key, value)
    }
  }

  const handleApplyChanges = () => {
    if (!connected || !socket) {
      toast({
        title: "Connection Error",
        description: "Not connected to control system. Please check your connection.",
        variant: "destructive",
      })
      return
    }

    // Send control values to the equipment via socket.io
    socket.emit("control", {
      equipmentId: equipment.id,
      controls: controlValues,
    })

    toast({
      title: "Controls Applied",
      description: `Changes have been applied to ${equipment.name}`,
    })
  }

  const getControlIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "temperature":
        return <Thermometer className="h-4 w-4" />
      case "power":
        return <Power className="h-4 w-4" />
      case "speed":
        return <Fan className="h-4 w-4" />
      default:
        return <Gauge className="h-4 w-4" />
    }
  }

  const renderControl = (key: string, config: any) => {
    const { type, label, min, max, step, unit } = config

    switch (type) {
      case "switch":
        return (
          <div className="flex items-center justify-between" key={key}>
            <div className="flex items-center">
              {getControlIcon(config.category || "default")}
              <Label htmlFor={key} className="ml-2">
                {label}
              </Label>
            </div>
            <Switch
              id={key}
              checked={controlValues[key] === true}
              onCheckedChange={(checked) => handleControlChange(key, checked)}
            />
          </div>
        )
      case "slider":
        return (
          <div className="space-y-2" key={key}>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                {getControlIcon(config.category || "default")}
                <Label htmlFor={key} className="ml-2">
                  {label}
                </Label>
              </div>
              <span className="text-sm">
                {controlValues[key]}
                {unit ? ` ${unit}` : ""}
              </span>
            </div>
            <Slider
              id={key}
              min={min || 0}
              max={max || 100}
              step={step || 1}
              value={[controlValues[key]]}
              onValueChange={(value) => handleControlChange(key, value[0])}
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
    <Card>
      <CardHeader>
        <CardTitle>{equipment.name} Control Panel</CardTitle>
        <CardDescription>Adjust settings and parameters</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.entries(groupedControls).map(([category, controls]) => (
          <div key={category} className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">{category}</h3>
            <div className="space-y-4">
              {Object.entries(controls).map(([key, config]: [string, any]) => renderControl(key, config))}
            </div>
          </div>
        ))}

        <div className="pt-4">
          <Button onClick={handleApplyChanges} disabled={!connected} className="w-full">
            Apply Changes
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

