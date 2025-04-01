"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useFirebase } from "@/lib/firebase-context"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { toast } from "@/components/ui/use-toast"
import { Thermometer, Droplets, Clock } from "lucide-react"

interface ZoneControlPanelProps {
  zoneId: string
}

export function ZoneControlPanel({ zoneId }: ZoneControlPanelProps) {
  const { db } = useFirebase()
  const [zone, setZone] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [temperatureValue, setTemperatureValue] = useState<number>(72)
  const [isOccupied, setIsOccupied] = useState<boolean>(false)
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false)

  useEffect(() => {
    const fetchZoneData = async () => {
      if (!db || !zoneId) return

      setLoading(true)
      try {
        const zoneDoc = doc(db, "zones", zoneId)
        const zoneSnapshot = await getDoc(zoneDoc)

        if (zoneSnapshot.exists()) {
          const zoneData = { id: zoneSnapshot.id, ...zoneSnapshot.data() }
          setZone(zoneData)

          // Set initial values from zone data
          if (zoneData.setpoint) setTemperatureValue(zoneData.setpoint)
          if (zoneData.isOccupied !== undefined) setIsOccupied(zoneData.isOccupied)
        } else {
          console.error("Zone not found")
          toast({
            title: "Error",
            description: "Zone not found",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error("Error fetching zone data:", error)
        toast({
          title: "Error",
          description: "Failed to load zone data",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchZoneData()
  }, [db, zoneId])

  const updateZoneSetpoint = async (value: number) => {
    if (!db || !zoneId) return

    try {
      const zoneRef = doc(db, "zones", zoneId)
      await updateDoc(zoneRef, {
        setpoint: value,
      })

      toast({
        title: "Success",
        description: `Temperature setpoint updated to ${value}°F`,
      })
    } catch (error) {
      console.error("Error updating zone setpoint:", error)
      toast({
        title: "Error",
        description: "Failed to update temperature setpoint",
        variant: "destructive",
      })
    }
  }

  const updateZoneOccupancy = async (value: boolean) => {
    if (!db || !zoneId) return

    try {
      const zoneRef = doc(db, "zones", zoneId)
      await updateDoc(zoneRef, {
        isOccupied: value,
      })

      toast({
        title: "Success",
        description: `Zone occupancy set to ${value ? "Occupied" : "Unoccupied"}`,
      })
    } catch (error) {
      console.error("Error updating zone occupancy:", error)
      toast({
        title: "Error",
        description: "Failed to update zone occupancy",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Zone Controls</CardTitle>
          <CardDescription>Loading zone data...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (!zone) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Zone Controls</CardTitle>
          <CardDescription>Zone not found</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{zone.name}</CardTitle>
            <CardDescription>{zone.description || "Zone Controls"}</CardDescription>
          </div>
          <Badge variant={isOccupied ? "default" : "outline"}>{isOccupied ? "Occupied" : "Unoccupied"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Temperature and Humidity Readout */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Thermometer className="mr-2 h-4 w-4" />
                Temperature
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{zone.currentTemperature || temperatureValue}°F</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Droplets className="mr-2 h-4 w-4" />
                Humidity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{zone.currentHumidity || "45"}%</div>
            </CardContent>
          </Card>
        </div>

        {/* Temperature Setpoint Control */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="temperature-setpoint">Temperature Setpoint</Label>
            <div className="text-xl font-bold">{temperatureValue}°F</div>
          </div>
          <Slider
            id="temperature-setpoint"
            min={65}
            max={85}
            step={1}
            value={[temperatureValue]}
            onValueChange={(value) => setTemperatureValue(value[0])}
            onValueCommit={(value) => updateZoneSetpoint(value[0])}
          />
        </div>

        {/* Occupancy Control */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="occupancy">Occupancy</Label>
            <div className="text-sm text-muted-foreground">Set zone as occupied or unoccupied</div>
          </div>
          <Switch
            id="occupancy"
            checked={isOccupied}
            onCheckedChange={(checked) => {
              setIsOccupied(checked)
              updateZoneOccupancy(checked)
            }}
          />
        </div>
      </CardContent>
      <CardFooter>
        <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full">
              <Clock className="mr-2 h-4 w-4" />
              Schedule
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Zone Schedule</DialogTitle>
              <DialogDescription>Set the occupancy schedule for this zone.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Tabs defaultValue="weekly">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="weekly">Weekly</TabsTrigger>
                  <TabsTrigger value="calendar">Calendar</TabsTrigger>
                </TabsList>
                <TabsContent value="weekly" className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Weekdays</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Start Time</Label>
                        <Input type="time" defaultValue="08:00" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">End Time</Label>
                        <Input type="time" defaultValue="17:00" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Weekends</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Start Time</Label>
                        <Input type="time" defaultValue="10:00" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">End Time</Label>
                        <Input type="time" defaultValue="15:00" />
                      </div>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="calendar" className="pt-4">
                  <Calendar mode="single" selected={new Date()} onSelect={() => {}} className="rounded-md border" />
                </TabsContent>
              </Tabs>
            </div>
            <DialogFooter>
              <Button type="submit" onClick={() => setScheduleDialogOpen(false)}>
                Save Schedule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardFooter>
    </Card>
  )
}

// Input component for time selection
function Input({ type, defaultValue, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      defaultValue={defaultValue}
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      {...props}
    />
  )
}

