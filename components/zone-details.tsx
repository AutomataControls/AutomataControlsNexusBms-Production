"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useFirebase } from "@/lib/firebase-context"
import {
  Building,
  Settings,
  ArrowLeft,
  Fan,
  AlertTriangle,
  MapPin,
  Thermometer,
  Power,
  Edit,
  Calendar,
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from "firebase/firestore"
import { toast } from "@/components/ui/use-toast"
import { AddEquipmentModal } from "./zones/add-equipment-modal"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface ZoneDetailsProps {
  id: string
}

export function ZoneDetails({ id }: ZoneDetailsProps) {
  const [zone, setZone] = useState<any>(null)
  const [equipment, setEquipment] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [temperatureValue, setTemperatureValue] = useState<number>(72)
  const [humidityValue, setHumidityValue] = useState<number>(45)
  const [lightingOn, setLightingOn] = useState<boolean>(false)
  const [isOccupied, setIsOccupied] = useState<boolean>(false)
  const [isAddEquipmentModalOpen, setIsAddEquipmentModalOpen] = useState(false)
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false)
  const { db } = useFirebase()
  const router = useRouter()

  useEffect(() => {
    const fetchData = async () => {
      if (!db || !id) return

      setLoading(true)
      try {
        // Fetch zone data
        const zoneRef = collection(db, "zones")
        const zoneDoc = doc(zoneRef, id)
        const zoneSnapshot = await getDoc(zoneDoc)

        if (zoneSnapshot.exists()) {
          const zoneData = { id: zoneSnapshot.id, ...zoneSnapshot.data() }
          setZone(zoneData)

          // Set initial control values
          if (zoneData.setpoint) setTemperatureValue(zoneData.setpoint)
          if (zoneData.currentTemperature) setTemperatureValue(zoneData.currentTemperature)
          if (zoneData.humiditySetpoint) setHumidityValue(zoneData.humiditySetpoint)
          if (zoneData.currentHumidity) setHumidityValue(zoneData.currentHumidity)
          if (zoneData.lightingStatus === "on") setLightingOn(true)
          if (zoneData.isOccupied !== undefined) setIsOccupied(zoneData.isOccupied)

          // Fetch equipment for this zone
          const equipmentRef = collection(db, "equipment")
          const equipmentQuery = query(equipmentRef, where("zoneId", "==", id))
          const equipmentSnapshot = await getDocs(equipmentQuery)

          const equipmentData = equipmentSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          setEquipment(equipmentData)
        } else {
          console.error("Zone not found:", id)
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

    fetchData()
  }, [db, id])

  const updateZoneSetpoint = async (value: number) => {
    if (!db || !id) return

    try {
      const zoneRef = doc(db, "zones", id)
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

  const updateZoneHumidity = async (value: number) => {
    if (!db || !id) return

    try {
      const zoneRef = doc(db, "zones", id)
      await updateDoc(zoneRef, {
        humiditySetpoint: value,
      })

      toast({
        title: "Success",
        description: `Humidity setpoint updated to ${value}%`,
      })
    } catch (error) {
      console.error("Error updating zone humidity:", error)
      toast({
        title: "Error",
        description: "Failed to update humidity setpoint",
        variant: "destructive",
      })
    }
  }

  const updateZoneLighting = async (value: boolean) => {
    if (!db || !id) return

    try {
      const zoneRef = doc(db, "zones", id)
      await updateDoc(zoneRef, {
        lightingStatus: value ? "on" : "off",
      })

      toast({
        title: "Success",
        description: `Lighting turned ${value ? "on" : "off"}`,
      })
    } catch (error) {
      console.error("Error updating zone lighting:", error)
      toast({
        title: "Error",
        description: "Failed to update lighting status",
        variant: "destructive",
      })
    }
  }

  const updateZoneOccupancy = async (value: boolean) => {
    if (!db || !id) return

    try {
      const zoneRef = doc(db, "zones", id)
      await updateDoc(zoneRef, {
        isOccupied: value,
      })

      setIsOccupied(value)
      toast({
        title: "Success",
        description: `Zone set to ${value ? "Occupied" : "Unoccupied"}`,
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
    return <div>Loading zone details...</div>
  }

  if (!zone) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Zone Not Found</CardTitle>
          <CardDescription>The requested zone could not be found.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="mr-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">{zone.name}</h1>
          <Badge variant={isOccupied ? "default" : "outline"} className="ml-2">
            {isOccupied ? "Occupied" : "Unoccupied"}
          </Badge>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => setScheduleDialogOpen(true)} className="hover:bg-[#e6f3f1]">
            <Calendar className="mr-2 h-4 w-4" />
            Schedule
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push(`/dashboard/settings/zones/${id}`)}
            className="hover:bg-[#e6f3f1]"
          >
            <Edit className="mr-2 h-4 w-4" />
            Edit Zone
          </Button>
          <Button variant="outline" onClick={() => router.push("/dashboard/settings")} className="hover:bg-[#e6f3f1]">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="controls">Controls</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Zone Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Zone Overview</CardTitle>
              <CardDescription>Details and statistics for {zone.name}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-start space-x-2">
                  <MapPin className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Location</p>
                    <p className="text-sm text-muted-foreground">{zone.locationName || "Unknown Location"}</p>
                  </div>
                </div>
                {zone.description && (
                  <div className="flex items-start space-x-2">
                    <Building className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Description</p>
                      <p className="text-sm text-muted-foreground">{zone.description}</p>
                    </div>
                  </div>
                )}
                {zone.setpoint && (
                  <div className="flex items-start space-x-2">
                    <Thermometer className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Target Temperature</p>
                      <p className="text-sm text-muted-foreground">{zone.setpoint}°F</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="p-4">
                    <div className="flex items-center justify-between">
                      <Fan className="h-4 w-4 text-blue-500" />
                      <span className="text-2xl font-bold">{equipment.length}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">Total Equipment</p>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="p-4">
                    <div className="flex items-center justify-between">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      <span className="text-2xl font-bold">
                        {equipment.filter((e) => e.status === "warning" || e.status === "Warning").length}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">Warnings</p>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="p-4">
                    <div className="flex items-center justify-between">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <span className="text-2xl font-bold">
                        {equipment.filter((e) => e.status === "error" || e.status === "Fault").length}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">Errors</p>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="p-4">
                    <div className="flex items-center justify-between">
                      <Power className="h-4 w-4 text-green-500" />
                      <span className="text-2xl font-bold">
                        {equipment.filter((e) => e.status === "online" || e.status === "Online").length}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">Online</p>
                  </CardHeader>
                </Card>
              </div>
            </CardContent>
          </Card>

          {/* Equipment List */}
          <Card>
            <CardHeader>
              <CardTitle>Equipment</CardTitle>
              <CardDescription>Equipment assigned to this zone</CardDescription>
            </CardHeader>
            <CardContent>
              {equipment.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <Fan className="h-10 w-10 text-muted-foreground mb-2" />
                  <p className="text-lg font-medium">No Equipment</p>
                  <p className="text-sm text-muted-foreground">Add equipment to this zone to get started</p>
                  <Button className="mt-4" onClick={() => setIsAddEquipmentModalOpen(true)}>
                    Add Equipment
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {equipment.map((item) => (
                    <Card
                      key={item.id}
                      className="hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => {
                        // Normalize the type to match the URL format
                        const normalizedType = item.type.toLowerCase().replace(/\s+/g, "-")
                        router.push(`/dashboard/controls/${normalizedType}/${item.id}`)
                      }}
                    >
                      <CardHeader className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-base">{item.name}</CardTitle>
                            <CardDescription>{item.type}</CardDescription>
                          </div>
                          <Badge
                            variant={
                              item.status === "Fault" || item.status === "error"
                                ? "destructive"
                                : item.status === "Warning" || item.status === "warning"
                                  ? "outline"
                                  : "default"
                            }
                          >
                            {item.status || "Unknown"}
                          </Badge>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="controls" className="space-y-6">
          {/* Zone Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Zone Controls</CardTitle>
              <CardDescription>Manage settings for this zone</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Temperature Control */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="temperature">Temperature</Label>
                    <div className="text-sm text-muted-foreground">
                      Current: {zone.currentTemperature || temperatureValue}°F
                    </div>
                  </div>
                  <div className="text-2xl font-bold">{temperatureValue}°F</div>
                </div>
                <Slider
                  id="temperature"
                  min={65}
                  max={85}
                  step={1}
                  value={[temperatureValue]}
                  onValueChange={(value) => setTemperatureValue(value[0])}
                  onValueCommit={(value) => updateZoneSetpoint(value[0])}
                />
              </div>

              {/* Humidity Control */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="humidity">Humidity</Label>
                    <div className="text-sm text-muted-foreground">
                      Current: {zone.currentHumidity || humidityValue}%
                    </div>
                  </div>
                  <div className="text-2xl font-bold">{humidityValue}%</div>
                </div>
                <Slider
                  id="humidity"
                  min={30}
                  max={70}
                  step={1}
                  value={[humidityValue]}
                  onValueChange={(value) => setHumidityValue(value[0])}
                  onValueCommit={(value) => updateZoneHumidity(value[0])}
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
                  onCheckedChange={(checked) => updateZoneOccupancy(checked)}
                />
              </div>

              {/* Lighting Control (if applicable) */}
              {zone.hasLightingControl && (
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="lighting">Lighting</Label>
                    <div className="text-sm text-muted-foreground">Turn zone lighting on or off</div>
                  </div>
                  <Switch
                    id="lighting"
                    checked={lightingOn}
                    onCheckedChange={(checked) => {
                      setLightingOn(checked)
                      updateZoneLighting(checked)
                    }}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Equipment Modal */}
      <AddEquipmentModal
        open={isAddEquipmentModalOpen}
        onOpenChange={setIsAddEquipmentModalOpen}
        locationId={zone?.locationId || ""}
        zoneName={zone?.name || ""}
        onEquipmentAdded={async (equipmentIds) => {
          if (!db || !id) return

          try {
            // Update equipment to associate with this zone
            for (const equipmentId of equipmentIds) {
              const equipmentRef = doc(db, "equipment", equipmentId)
              await updateDoc(equipmentRef, {
                zoneId: id,
              })
            }

            // Refresh equipment list
            const equipmentRef = collection(db, "equipment")
            const equipmentQuery = query(equipmentRef, where("zoneId", "==", id))
            const equipmentSnapshot = await getDocs(equipmentQuery)

            const equipmentData = equipmentSnapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }))
            setEquipment(equipmentData)

            toast({
              title: "Success",
              description: `Added ${equipmentIds.length} equipment to zone`,
            })
          } catch (error) {
            console.error("Error adding equipment to zone:", error)
            toast({
              title: "Error",
              description: "Failed to add equipment to zone",
              variant: "destructive",
            })
          }
        }}
      />

      {/* Schedule Dialog */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Zone Schedule</DialogTitle>
            <DialogDescription>Set the occupancy schedule for {zone.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Weekdays</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Start Time</Label>
                  <input
                    type="time"
                    defaultValue="08:00"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">End Time</Label>
                  <input
                    type="time"
                    defaultValue="17:00"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Weekends</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Start Time</Label>
                  <input
                    type="time"
                    defaultValue="10:00"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">End Time</Label>
                  <input
                    type="time"
                    defaultValue="15:00"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                toast({
                  title: "Schedule Updated",
                  description: "Zone schedule has been updated successfully",
                })
                setScheduleDialogOpen(false)
              }}
            >
              Save Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

