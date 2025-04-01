"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useFirebase } from "@/lib/firebase-context"
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore"
import { toast } from "@/components/ui/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

export function EquipmentZoneAssignment() {
  const [locations, setLocations] = useState<any[]>([])
  const [zones, setZones] = useState<any[]>([])
  const [equipment, setEquipment] = useState<any[]>([])
  const [selectedLocation, setSelectedLocation] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const { db } = useFirebase()

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
    const fetchZonesAndEquipment = async () => {
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

        // Fetch equipment for selected location
        const equipmentRef = collection(db, "equipment")
        const equipmentQuery = query(equipmentRef, where("locationId", "==", selectedLocation))
        const equipmentSnapshot = await getDocs(equipmentQuery)

        const equipmentData = equipmentSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        setEquipment(equipmentData)
      } catch (error) {
        console.error("Error fetching data:", error)
        toast({
          title: "Error",
          description: "Failed to load zones and equipment",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    if (selectedLocation) {
      fetchZonesAndEquipment()
    } else {
      setZones([])
      setEquipment([])
      setLoading(false)
    }
  }, [db, selectedLocation])

  const handleZoneAssignment = async (equipmentId: string, zoneId: string | null) => {
    if (!db) return

    try {
      const equipmentRef = doc(db, "equipment", equipmentId)

      if (zoneId === "none") {
        // Remove zone assignment
        await updateDoc(equipmentRef, { zoneId: null })
      } else {
        // Assign to zone
        await updateDoc(equipmentRef, { zoneId })
      }

      // Update local state
      setEquipment((prev) =>
        prev.map((item) => (item.id === equipmentId ? { ...item, zoneId: zoneId === "none" ? null : zoneId } : item)),
      )

      toast({
        title: "Success",
        description: zoneId === "none" ? "Equipment removed from zone" : "Equipment assigned to zone",
      })
    } catch (error) {
      console.error("Error updating zone assignment:", error)
      toast({
        title: "Error",
        description: "Failed to update zone assignment",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Equipment Zone Assignment</h2>
        <p className="text-muted-foreground">Assign equipment to temperature-controlled zones</p>
      </div>

      <div className="flex items-center space-x-4">
        <Label htmlFor="location-filter" className="w-32">
          Select Location:
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
        <div>Loading...</div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Equipment</CardTitle>
            <CardDescription>Assign equipment to zones at this location</CardDescription>
          </CardHeader>
          <CardContent>
            {equipment.length === 0 ? (
              <div className="text-center py-4">
                <p>No equipment found for this location</p>
              </div>
            ) : zones.length === 0 ? (
              <div className="text-center py-4">
                <p>No zones available for this location</p>
                <Button
                  variant="outline"
                  className="mt-2"
                  onClick={() => {
                    // Navigate to zone creation
                    // This depends on your routing setup
                  }}
                >
                  Create Zone
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {equipment.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between border-b pb-4 last:border-b-0 last:pb-0"
                  >
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <div className="flex items-center space-x-2">
                        <p className="text-sm text-muted-foreground">{item.type}</p>
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
                    </div>
                    <div className="flex items-center space-x-2">
                      <Label htmlFor={`zone-${item.id}`} className="sr-only">
                        Assign to Zone
                      </Label>
                      <Select
                        value={item.zoneId || "none"}
                        onValueChange={(value) => handleZoneAssignment(item.id, value === "none" ? null : value)}
                      >
                        <SelectTrigger id={`zone-${item.id}`} className="w-[180px]">
                          <SelectValue placeholder="Select a zone" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Zone</SelectItem>
                          {zones.map((zone) => (
                            <SelectItem key={zone.id} value={zone.id}>
                              {zone.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

