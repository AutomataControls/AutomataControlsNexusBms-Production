"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useFirebase } from "@/lib/firebase-context"
import { Plus, Edit, Trash2, Building } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { collection, query, where, getDocs, doc, addDoc, updateDoc, deleteDoc } from "firebase/firestore"
import { toast } from "@/components/ui/use-toast"

export function ZoneSettings() {
  const [zones, setZones] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLocation, setSelectedLocation] = useState<string>("")
  const { db } = useFirebase()
  const router = useRouter()

  // Form state for adding/editing zones
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [currentZone, setCurrentZone] = useState<any>(null)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "",
    locationId: "",
    locationName: "",
    setpoint: "72",
    hasTemperatureControl: true,
    hasHumidityControl: false,
    hasLightingControl: false,
  })

  useEffect(() => {
    const fetchLocations = async () => {
      if (!db) return

      try {
        const locationsRef = collection(db, "locations")
        const locationsSnapshot = await getDocs(locationsRef)

        const locationsData = locationsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        setLocations(locationsData)

        // Set default selected location if available
        if (locationsData.length > 0 && !selectedLocation) {
          setSelectedLocation(locationsData[0].id)
        }
      } catch (error) {
        console.error("Error fetching locations:", error)
        toast({
          title: "Error",
          description: "Failed to load locations",
          variant: "destructive",
        })
      }
    }

    fetchLocations()
  }, [db])

  useEffect(() => {
    const fetchZones = async () => {
      if (!db || !selectedLocation) return

      setLoading(true)
      try {
        // Fetch zones for selected location
        const zonesRef = collection(db, "zones")
        const zonesQuery = query(zonesRef, where("locationId", "==", selectedLocation))
        const zonesSnapshot = await getDocs(zonesQuery)

        const zonesData = zonesSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        setZones(zonesData)
      } catch (error) {
        console.error("Error fetching zones:", error)
        toast({
          title: "Error",
          description: "Failed to load zones",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    if (selectedLocation) {
      fetchZones()
    } else {
      setZones([])
      setLoading(false)
    }
  }, [db, selectedLocation])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSwitchChange = (name: string, checked: boolean) => {
    setFormData((prev) => ({ ...prev, [name]: checked }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }))

    // If changing location, update locationName
    if (name === "locationId") {
      const location = locations.find((loc) => loc.id === value)
      if (location) {
        setFormData((prev) => ({ ...prev, locationName: location.name }))
      }
    }
  }

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      type: "",
      locationId: selectedLocation,
      locationName: locations.find((loc) => loc.id === selectedLocation)?.name || "",
      setpoint: "72",
      hasTemperatureControl: true,
      hasHumidityControl: false,
      hasLightingControl: false,
    })
    setCurrentZone(null)
    setIsEditing(false)
  }

  const openAddDialog = () => {
    resetForm()
    setIsDialogOpen(true)
  }

  const openEditDialog = (zone: any) => {
    setCurrentZone(zone)
    setFormData({
      name: zone.name || "",
      description: zone.description || "",
      type: zone.type || "",
      locationId: zone.locationId || "",
      locationName: zone.locationName || "",
      setpoint: zone.setpoint?.toString() || "72",
      hasTemperatureControl: zone.hasTemperatureControl !== false, // Default to true if undefined
      hasHumidityControl: !!zone.hasHumidityControl,
      hasLightingControl: !!zone.hasLightingControl,
    })
    setIsEditing(true)
    setIsDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!db) return

    try {
      const zoneData = {
        ...formData,
        setpoint: Number.parseInt(formData.setpoint, 10) || 72,
        updatedAt: new Date().toISOString(),
      }

      if (isEditing && currentZone) {
        // Update existing zone
        const zoneRef = doc(db, "zones", currentZone.id)
        await updateDoc(zoneRef, zoneData)

        toast({
          title: "Success",
          description: "Zone updated successfully",
        })
      } else {
        // Add new zone
        zoneData.createdAt = new Date().toISOString()
        await addDoc(collection(db, "zones"), zoneData)

        toast({
          title: "Success",
          description: "Zone created successfully",
        })
      }

      // Refresh zones list
      const zonesRef = collection(db, "zones")
      const zonesQuery = query(zonesRef, where("locationId", "==", selectedLocation))
      const zonesSnapshot = await getDocs(zonesQuery)

      const zonesData = zonesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      setZones(zonesData)

      // Close dialog and reset form
      setIsDialogOpen(false)
      resetForm()
    } catch (error) {
      console.error("Error saving zone:", error)
      toast({
        title: "Error",
        description: "Failed to save zone",
        variant: "destructive",
      })
    }
  }

  const handleDeleteZone = async (zoneId: string) => {
    if (!db || !zoneId) return

    if (!confirm("Are you sure you want to delete this zone? This action cannot be undone.")) {
      return
    }

    try {
      // Check if any equipment is assigned to this zone
      const equipmentRef = collection(db, "equipment")
      const equipmentQuery = query(equipmentRef, where("zoneId", "==", zoneId))
      const equipmentSnapshot = await getDocs(equipmentQuery)

      if (!equipmentSnapshot.empty) {
        // Equipment is assigned to this zone
        if (
          !confirm(
            "This zone has equipment assigned to it. Deleting this zone will remove the zone assignment from all equipment. Continue?",
          )
        ) {
          return
        }

        // Update all equipment to remove zoneId
        const batch = db.batch()
        equipmentSnapshot.docs.forEach((doc) => {
          batch.update(doc.ref, { zoneId: null })
        })
        await batch.commit()
      }

      // Delete the zone
      await deleteDoc(doc(db, "zones", zoneId))

      toast({
        title: "Success",
        description: "Zone deleted successfully",
      })

      // Refresh zones list
      const zonesRef = collection(db, "zones")
      const zonesQuery = query(zonesRef, where("locationId", "==", selectedLocation))
      const zonesSnapshot = await getDocs(zonesQuery)

      const zonesData = zonesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      setZones(zonesData)
    } catch (error) {
      console.error("Error deleting zone:", error)
      toast({
        title: "Error",
        description: "Failed to delete zone",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Zone Management</h2>
          <p className="text-muted-foreground">Create and manage temperature-controlled zones</p>
        </div>
        <Button onClick={openAddDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Zone
        </Button>
      </div>

      <div className="flex items-center space-x-4">
        <Label htmlFor="location-filter" className="w-32">
          Filter by Location:
        </Label>
        <Select value={selectedLocation} onValueChange={(value) => setSelectedLocation(value)}>
          <SelectTrigger id="location-filter" className="w-[240px]">
            <SelectValue placeholder="Select a location" />
          </SelectTrigger>
          <SelectContent>
            {locations.map((location) => (
              <SelectItem key={location.id} value={location.id}>
                {location.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div>Loading zones...</div>
      ) : zones.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <Building className="h-10 w-10 text-muted-foreground mb-2" />
            <p className="text-lg font-medium">No Zones Found</p>
            <p className="text-sm text-muted-foreground mb-4">
              {selectedLocation
                ? "No zones have been created for this location yet"
                : "Please select a location to view zones"}
            </p>
            {selectedLocation && (
              <Button onClick={openAddDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Create Zone
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {zones.map((zone) => (
            <Card key={zone.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{zone.name}</CardTitle>
                    <CardDescription>{zone.type || "Zone"}</CardDescription>
                  </div>
                  <div className="flex space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(zone)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteZone(zone.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pb-2">
                <div className="space-y-2">
                  {zone.description && <p className="text-sm text-muted-foreground">{zone.description}</p>}
                  <div className="flex items-center justify-between text-sm">
                    <span>Temperature Setpoint:</span>
                    <span className="font-medium">{zone.setpoint || "--"}°F</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {zone.hasTemperatureControl !== false && <Badge variant="outline">Temperature Control</Badge>}
                    {zone.hasHumidityControl && <Badge variant="outline">Humidity Control</Badge>}
                    {zone.hasLightingControl && <Badge variant="outline">Lighting Control</Badge>}
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full" onClick={() => router.push(`/dashboard/zones/${zone.id}`)}>
                  View Zone
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Zone Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Zone" : "Add New Zone"}</DialogTitle>
            <DialogDescription>
              {isEditing ? "Update the details for this zone" : "Create a new temperature-controlled zone"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="col-span-3"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right">
                  Description
                </Label>
                <Input
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="type" className="text-right">
                  Type
                </Label>
                <Input
                  id="type"
                  name="type"
                  value={formData.type}
                  onChange={handleInputChange}
                  className="col-span-3"
                  placeholder="Office, Greenhouse, etc."
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="location" className="text-right">
                  Location
                </Label>
                <Select
                  name="locationId"
                  value={formData.locationId}
                  onValueChange={(value) => handleSelectChange("locationId", value)}
                >
                  <SelectTrigger id="location" className="col-span-3">
                    <SelectValue placeholder="Select a location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="setpoint" className="text-right">
                  Temperature Setpoint
                </Label>
                <div className="col-span-3 flex items-center">
                  <Input
                    id="setpoint"
                    name="setpoint"
                    type="number"
                    value={formData.setpoint}
                    onChange={handleInputChange}
                    className="w-20"
                    min="50"
                    max="95"
                  />
                  <span className="ml-2">°F</span>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Controls</Label>
                <div className="col-span-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="temp-control" className="cursor-pointer">
                      Temperature Control
                    </Label>
                    <Switch
                      id="temp-control"
                      checked={formData.hasTemperatureControl}
                      onCheckedChange={(checked) => handleSwitchChange("hasTemperatureControl", checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="humidity-control" className="cursor-pointer">
                      Humidity Control
                    </Label>
                    <Switch
                      id="humidity-control"
                      checked={formData.hasHumidityControl}
                      onCheckedChange={(checked) => handleSwitchChange("hasHumidityControl", checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="lighting-control" className="cursor-pointer">
                      Lighting Control
                    </Label>
                    <Switch
                      id="lighting-control"
                      checked={formData.hasLightingControl}
                      onCheckedChange={(checked) => handleSwitchChange("hasLightingControl", checked)}
                    />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{isEditing ? "Update Zone" : "Create Zone"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

