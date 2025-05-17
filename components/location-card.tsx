"use client"

import React, { useState, useEffect } from "react"
const { memo } = React;
import { useRouter } from "next/navigation"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Building, Thermometer, Droplet, Fan, AlertTriangle, Wrench, Activity, Clock } from "lucide-react"
import { useFirebase } from "@/lib/firebase-context"
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore"
import { ref, onValue } from "firebase/database"
import { secondaryDb } from "@/lib/secondary-firebase"

interface LocationCardProps {
  location: any
}

// Memoize the LocationCard component to prevent unnecessary re-renders
export const LocationCard = memo(function LocationCard({ location }: LocationCardProps) {
  const [equipmentCount, setEquipmentCount] = useState<number>(0)
  const [alarmCount, setAlarmCount] = useState<number>(0)
  const [displayItems, setDisplayItems] = useState<any[]>([])
  const [technicians, setTechnicians] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { db, fetchCachedData } = useFirebase()
  const router = useRouter()

  const [realtimeData, setRealtimeData] = useState<{ [key: string]: any }>({})

  useEffect(() => {
    const fetchData = async () => {
      if (!db || !location.id) return

      setLoading(true)
      try {
        // Use cached data with a unique key for each location
        const cacheKey = `location_${location.id}_data`

        const data = await fetchCachedData(
          cacheKey,
          async () => {
            // Fetch equipment count
            const equipmentRef = collection(db, "equipment")
            const equipmentQuery = query(equipmentRef, where("locationId", "==", location.id))
            const equipmentSnapshot = await getDocs(equipmentQuery)

            // Fetch alarm count
            const alarmsRef = collection(db, "alarms")
            const alarmsQuery = query(alarmsRef, where("locationId", "==", location.id), where("active", "==", true))
            const alarmSnapshot = await getDocs(alarmsQuery)

            // Fetch display items
            const items = []
            if (location.displayItems) {
              for (const itemId of location.displayItems) {
                const itemRef = doc(db, "equipment", itemId)
                const itemSnap = await getDoc(itemRef)

                if (itemSnap.exists()) {
                  items.push({
                    id: itemSnap.id,
                    ...itemSnap.data(),
                  })
                }
              }
            }

            // Fetch technicians assigned to this location
            const techniciansRef = collection(db, "technicians")
            const techniciansQuery = query(techniciansRef, where("assignedLocations", "array-contains", location.id))
            const techniciansSnapshot = await getDocs(techniciansQuery)
            const techniciansData = techniciansSnapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }))

            return {
              equipmentCount: equipmentSnapshot.size,
              alarmCount: alarmSnapshot.size,
              displayItems: items,
              technicians: techniciansData,
            }
          },
          5, // Cache for 5 minutes
        )

        setEquipmentCount(data.equipmentCount)
        setAlarmCount(data.alarmCount)
        setDisplayItems(data.displayItems)
        setTechnicians(data.technicians)
      } catch (error) {
        console.error("Error fetching location data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [db, location.id, location.displayItems, fetchCachedData])

  // Fetch realtime data from Firebase RTDB
  useEffect(() => {
    if (!secondaryDb || !location.id) return

    const fetchRealtimeData = () => {
      try {
        // First, get all locations to find the one with matching ID
        const locationsRef = ref(secondaryDb, "locations")

        onValue(
          locationsRef,
          (snapshot) => {
            const data = snapshot.val()
            if (!data) {
              console.log("No locations found in Realtime Database")
              return
            }

            // Find the location with the matching ID
            let foundLocationData = null

            // Loop through all locations to find the one with matching ID
            for (const [locationKey, locationData] of Object.entries(data)) {
              const typedLocationData = locationData as any

              // Check if this location has the matching id
              if (typedLocationData.id === location.id) {
                foundLocationData = typedLocationData
                break
              }
            }

            if (foundLocationData && foundLocationData.systems) {
              setRealtimeData(foundLocationData.systems)
            }
          },
          (error) => {
            console.error("Error fetching RTDB data:", error)
          },
        )
      } catch (error) {
        console.error("Error setting up RTDB listener:", error)
      }
    }

    fetchRealtimeData()
  }, [secondaryDb, location.id])

  // Helper function to get equipment realtime data
  const getEquipmentRealtimeData = (equipmentId: string) => {
    // Try direct match
    if (realtimeData[equipmentId]) {
      return realtimeData[equipmentId]
    }

    // Try case-insensitive match
    const lowerEquipmentId = equipmentId.toLowerCase()
    for (const [key, value] of Object.entries(realtimeData)) {
      if (key.toLowerCase() === lowerEquipmentId) {
        return value
      }
    }

    return null
  }

  // Helper function to find a metric by various possible names
  const findMetric = (metrics: any, possibleNames: string[]) => {
    if (!metrics) return undefined

    // First try exact matches
    for (const name of possibleNames) {
      if (metrics[name] !== undefined) {
        return metrics[name]
      }
    }

    // Then try case-insensitive partial matches
    const lowerPossibleNames = possibleNames.map((name) => name.toLowerCase())
    for (const [key, value] of Object.entries(metrics)) {
      const lowerKey = key.toLowerCase()
      for (const searchTerm of lowerPossibleNames) {
        if (lowerKey.includes(searchTerm)) {
          return value
        }
      }
    }
    return undefined
  }

  // Helper function to format date
  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A"
    const date = new Date(dateString)
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hour12: true,
    }).format(date)
  }

  const handleViewLocation = () => {
    router.push(`/dashboard/location/${location.id}`)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Building className="h-5 w-5 mr-2" />
          {location.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="animate-pulse space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="h-5 bg-gray-200 rounded"></div>
              <div className="h-5 bg-gray-200 rounded"></div>
            </div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              <div className="grid grid-cols-1 gap-2">
                <div className="h-10 bg-gray-200 rounded"></div>
                <div className="h-10 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center">
                <Fan className="h-4 w-4 mr-2 text-blue-500" />
                <span className="text-sm">{equipmentCount} Equipment</span>
              </div>
              <div className="flex items-center">
                <AlertTriangle className={`h-4 w-4 mr-2 ${alarmCount > 0 ? "text-red-500" : "text-gray-400"}`} />
                <span className="text-sm">{alarmCount} Alarms</span>
              </div>
            </div>

            {technicians.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-gray-500" />
                  <h4 className="text-sm font-medium">Assigned Technicians</h4>
                </div>
                <div className="flex flex-wrap gap-1">
                  {technicians.map((tech) => (
                    <div key={tech.id} className="flex items-center">
                      <span
                        className="px-2 py-1 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: `${tech.color}20`, // 20 is hex for 12% opacity
                          color: tech.color,
                        }}
                      >
                        {tech.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {displayItems.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Status</h4>
                <div className="grid grid-cols-1 gap-2">
                  {displayItems.map((item) => {
                    const Icon = Fan
                    const rtData = getEquipmentRealtimeData(item.id) || getEquipmentRealtimeData(item.name)
                    const metrics = rtData?.metrics || {}

                    // Get supply temp
                    const supplyTemp = findMetric(metrics, [
                      "Supply Air Temp",
                      "SupplyAirTemp",
                      "SAT",
                      "DischargeAir",
                      "Supply",
                      "SupplyTemp",
                      "SupplyAir",
                    ])

                    // Get humidity
                    const humidity = findMetric(metrics, [
                      "Humidity",
                      "RelativeHumidity",
                      "RH",
                      "Space Humidity",
                      "SpaceHumidity",
                      "Room Humidity",
                    ])

                    // Get amps
                    const amps = findMetric(metrics, [
                      "Amps",
                      "Current",
                      "Motor Amps",
                      "MotorAmps",
                      "PumpAmps",
                      "Current Draw",
                    ])

                    return (
                      <div key={item.id} className="flex flex-col p-2 bg-muted rounded-md">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <Fan className="h-4 w-4 mr-2" />
                            <span className="text-sm font-medium">{item.name}</span>
                          </div>
                          <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800">
                            {item.status || "Online"}
                          </span>
                        </div>

                        {rtData && (
                          <div className="mt-2 grid grid-cols-1 gap-1 text-xs">
                            {supplyTemp !== undefined && (
                              <div className="flex items-center">
                                <Thermometer className="h-3 w-3 mr-1 text-blue-500" />
                                <span>Supply Temp: {supplyTemp}°F</span>
                              </div>
                            )}
                            {humidity !== undefined && (
                              <div className="flex items-center">
                                <Droplet className="h-3 w-3 mr-1 text-blue-500" />
                                <span>Humidity: {humidity}%</span>
                              </div>
                            )}
                            {amps !== undefined && (
                              <div className="flex items-center">
                                <Activity className="h-3 w-3 mr-1 text-purple-500" />
                                <span>Amps: {amps}A</span>
                              </div>
                            )}
                            {rtData.dateTime && (
                              <div className="flex items-center text-muted-foreground mt-1">
                                <Clock className="h-3 w-3 mr-1" />
                                <span>{formatDate(rtData.dateTime)}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
      <CardFooter>
        <Button variant="outline" className="w-full" onClick={handleViewLocation} disabled={loading}>
          View Details
        </Button>
      </CardFooter>
    </Card>
  )
})
