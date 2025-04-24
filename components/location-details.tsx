"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useFirebase } from "@/lib/firebase-context"
import {
  Building,
  Settings,
  ArrowLeft,
  Fan,
  AlertTriangle,
  MapPin,
  Phone,
  Mail,
  Edit,
  Clock,
  Activity,
  ExternalLink,
  Droplet,
  Gauge,
  Sliders,
  Atom,
  Thermometer,
  CloudRain,
  ToggleLeft,
  Sun,
  Leaf,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore"
import { toast } from "@/components/ui/use-toast"
import { ZonesSection } from "@/components/zones-section"
import { Skeleton } from "@/components/ui/skeleton"
import { ref, onValue } from "firebase/database"
import { secondaryDb } from "@/lib/secondary-firebase"

interface LocationDetailsProps {
  id: string
}

export function LocationDetails({ id }: LocationDetailsProps) {
  const [location, setLocation] = useState<any>(null)
  const [equipment, setEquipment] = useState<any[]>([])
  const [realtimeData, setRealtimeData] = useState<{ [key: string]: any }>({})
  const [loading, setLoading] = useState(true)
  const { db } = useFirebase()
  const router = useRouter()

  useEffect(() => {
    const fetchData = async () => {
      if (!db || !id) return

      setLoading(true)
      try {
        console.log("Fetching location with ID:", id)

        // Try to fetch all locations first to debug
        const locationsRef = collection(db, "locations")
        const allLocationsSnapshot = await getDocs(locationsRef)

        console.log(
          "All locations:",
          allLocationsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        )

        // First try direct lookup by document ID
        const locationDoc = doc(locationsRef, id)
        const locationSnapshot = await getDoc(locationDoc)

        if (locationSnapshot.exists()) {
          console.log("Location found with direct ID lookup:", locationSnapshot.data())
          const locationData = { id: locationSnapshot.id, ...locationSnapshot.data() }
          setLocation(locationData)
        } else {
          console.log("Location not found with direct ID lookup, trying to find in all locations")

          // Try to find the location by matching any field that could be an ID
          let foundLocation = null

          allLocationsSnapshot.forEach((doc) => {
            const data = doc.data()
            // Check various possible ID fields
            if (data.id === id || data.id === Number(id) || data.locationId === id || doc.id === id) {
              console.log("Found location with ID match:", data)
              foundLocation = { id: doc.id, ...data }
            }
          })

          if (foundLocation) {
            setLocation(foundLocation)
          } else {
            console.error("Location not found after all attempts:", id)
            toast({
              title: "Error",
              description: "Location not found. Please check the location ID.",
              variant: "destructive",
            })
          }
        }

        // Fetch equipment for this location regardless of how we found it
        const equipmentRef = collection(db, "equipment")
        const equipmentQuery = query(equipmentRef, where("locationId", "==", id))
        const equipmentSnapshot = await getDocs(equipmentQuery)

        const equipmentData = equipmentSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        console.log("Equipment found:", equipmentData.length)
        setEquipment(equipmentData)
      } catch (error) {
        console.error("Error fetching location data:", error)
        toast({
          title: "Error",
          description: "Failed to load location data",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [db, id, toast])

  // Fetch realtime data from Firebase RTDB
  useEffect(() => {
    if (!secondaryDb || !id) return

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
              if (typedLocationData.id === id) {
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
  }, [secondaryDb, id])

  // Helper function to get equipment realtime data
  const getEquipmentRealtimeData = (equipmentId: string) => {
    // Try direct match first
    if (realtimeData[equipmentId]) {
      return realtimeData[equipmentId]
    }

    // Try case-insensitive match with the ID
    const lowerEquipmentId = equipmentId.toLowerCase()
    for (const [key, value] of Object.entries(realtimeData)) {
      if (key.toLowerCase() === lowerEquipmentId) {
        return value
      }
    }

    // Try matching by name or alias
    for (const [key, value] of Object.entries(realtimeData)) {
      const systemData = value as any
      if (
        (systemData.name && systemData.name.toLowerCase() === lowerEquipmentId) ||
        (systemData.alias && systemData.alias.toLowerCase() === lowerEquipmentId) ||
        (systemData.zone && systemData.zone.toLowerCase() === lowerEquipmentId)
      ) {
        return systemData
      }
    }

    // Try partial matches
    for (const [key, value] of Object.entries(realtimeData)) {
      const systemData = value as any
      if (
        key.toLowerCase().includes(lowerEquipmentId) ||
        (systemData.name && systemData.name.toLowerCase().includes(lowerEquipmentId)) ||
        (systemData.alias && systemData.alias.toLowerCase().includes(lowerEquipmentId)) ||
        (systemData.zone && systemData.zone.toLowerCase().includes(lowerEquipmentId))
      ) {
        return systemData
      }
    }

    return null
  }

  // Helper function to get key metrics for the equipment
  const getKeyMetrics = (equipmentItem: any) => {
    const rtData = getEquipmentRealtimeData(equipmentItem.id) || getEquipmentRealtimeData(equipmentItem.name)
    if (!rtData || !rtData.metrics) return []

    const metrics = rtData.metrics
    const results = []

    // First, let's enhance the findMetric function to be more context-aware
    const findMetric = (possibleNames: string[], excludeNames: string[] = [], equipmentType?: string) => {
      // First try exact matches
      for (const name of possibleNames) {
        if (metrics[name] !== undefined) {
          // Check if this name is in the exclude list
          if (!excludeNames.some((excludeName) => name.toLowerCase() === excludeName.toLowerCase())) {
            return metrics[name]
          }
        }
      }

      // Then try case-insensitive partial matches
      const lowerPossibleNames = possibleNames.map((name) => name.toLowerCase())
      const lowerExcludeNames = excludeNames.map((name) => name.toLowerCase())

      for (const [key, value] of Object.entries(metrics)) {
        const lowerKey = key.toLowerCase()

        // Skip if this key is in the exclude list
        if (lowerExcludeNames.some((excludeName) => lowerKey.includes(excludeName))) {
          continue
        }

        for (const searchTerm of lowerPossibleNames) {
          if (lowerKey.includes(searchTerm)) {
            return value
          }
        }
      }
      return undefined
    }

    // Check if this is a greenhouse-related equipment
    const isGreenhouse =
      equipmentItem.type?.toLowerCase().includes("greenhouse") ||
      equipmentItem.name?.toLowerCase().includes("greenhouse") ||
      (location?.name && location.name.toLowerCase().includes("greenhouse"))

    // If this is greenhouse equipment, look for specific greenhouse metrics first
    if (isGreenhouse) {
      // Find global setpoint
      const globalSetpoint = findMetric([
        "GlobalSetpoint",
        "Global Setpoint",
        "Global_Setpoint",
        "System Setpoint",
        "SystemSetpoint",
      ])

      if (globalSetpoint !== undefined) {
        results.push({
          name: "Global Setpoint",
          value: roundValue(globalSetpoint),
          unit: "°F",
          icon: <Atom className="h-4 w-4 text-red-500" />,
        })
      }

      // Find average temperature
      const averageTemp = findMetric([
        "averagetemp",
        "average temp",
        "average temperature",
        "AverageTemp",
        "AverageTemperature",
      ])

      if (averageTemp !== undefined) {
        results.push({
          name: "Avg Temperature",
          value: roundValue(averageTemp),
          unit: "°F",
          icon: <Thermometer className="h-4 w-4 text-orange-500" />,
        })
      }

      // Find average humidity
      const averageHumidity = findMetric(["averagehumidity", "average humidity", "AverageHumidity", "Average Humidity"])

      if (averageHumidity !== undefined) {
        results.push({
          name: "Avg Humidity",
          value: roundValue(averageHumidity),
          unit: "%",
          icon: <Droplet className="h-4 w-4 text-blue-500" />,
        })
      }

      // Find zone temperatures
      const zone1Temp = findMetric(["zones/zone1/temp", "zone1/temp", "zone1temp", "temp1"])

      if (zone1Temp !== undefined) {
        results.push({
          name: "Zone 1 Temp",
          value: roundValue(zone1Temp),
          unit: "°F",
          icon: <Thermometer className="h-4 w-4 text-red-500" />,
        })
      }

      const zone2Temp = findMetric(["zones/zone2/temp", "zone2/temp", "zone2temp", "temp2"])

      if (zone2Temp !== undefined) {
        results.push({
          name: "Zone 2 Temp",
          value: roundValue(zone2Temp),
          unit: "°F",
          icon: <Thermometer className="h-4 w-4 text-red-500" />,
        })
      }

      // Find zone humidity
      const zone1Humidity = findMetric(["zones/zone1/humidity", "zone1/humidity", "zone1humidity", "humidity1"])

      if (zone1Humidity !== undefined) {
        results.push({
          name: "Zone 1 Humidity",
          value: roundValue(zone1Humidity),
          unit: "%",
          icon: <Droplet className="h-4 w-4 text-blue-500" />,
        })
      }

      const zone2Humidity = findMetric(["zones/zone2/humidity", "zone2/humidity", "zone2humidity", "humidity2"])

      if (zone2Humidity !== undefined) {
        results.push({
          name: "Zone 2 Humidity",
          value: roundValue(zone2Humidity),
          unit: "%",
          icon: <Droplet className="h-4 w-4 text-blue-500" />,
        })
      }

      // Find outside temperature
      const outsideTemp = findMetric([
        "outsideTemp",
        "outside temp",
        "OutsideTemp",
        "Outside Temperature",
        "OutsideTemperature",
        "outdoor temp",
        "outdoor temperature",
      ])

      if (outsideTemp !== undefined) {
        results.push({
          name: "Outside Temp",
          value: roundValue(outsideTemp),
          unit: "°F",
          icon: <Thermometer className="h-4 w-4 text-gray-500" />,
        })
      }

      // Find rain status
      const isRaining = findMetric(["isRaining", "is raining", "IsRaining", "raining", "rain status"])

      if (isRaining !== undefined) {
        results.push({
          name: "Rain Status",
          value: isRaining === true || isRaining === "true" ? "Yes" : "No",
          unit: "",
          icon: (
            <CloudRain
              className={`h-4 w-4 ${isRaining === true || isRaining === "true" ? "text-blue-500" : "text-gray-400"}`}
            />
          ),
        })
      }

      // Time of day
      const timeOfDay = findMetric(["timeofday", "time of day", "TimeOfDay", "daypart"])

      if (timeOfDay !== undefined) {
        results.push({
          name: "Time of Day",
          value: typeof timeOfDay === "string" ? timeOfDay : "Unknown",
          unit: "",
          icon: <Sun className="h-4 w-4 text-yellow-500" />,
        })
      }

      // Check active control status for various systems
      const systemControls = [
        { name: "Exhaust Fan 1", key: "ExhaustFan1ActiveControl", icon: <Fan /> },
        { name: "Exhaust Fan 2", key: "ExhaustFan2ActiveControl", icon: <Fan /> },
        { name: "Supply", key: "SupplyActiveControl", icon: <Fan /> },
        { name: "FCU 1", key: "FCU1ActiveControl", icon: <Fan /> },
        { name: "FCU 2", key: "FCU2ActiveControl", icon: <Fan /> },
        { name: "FCU 4", key: "FCU4ActiveControl", icon: <Fan /> },
        { name: "FCU", key: "FCUActiveControl", icon: <Fan /> },
        { name: "Floor Heat 1", key: "FloorHeat1ActiveControl", icon: <Thermometer /> },
        { name: "Floor Heat 2", key: "FloorHeat2ActiveControl", icon: <Thermometer /> },
        { name: "Floor Heat", key: "FloorHeatActiveControl", icon: <Thermometer /> },
        { name: "Exhaust", key: "ExhaustActiveControl", icon: <Fan /> },
      ]

      // Find equipment enabled status
      const equipmentStatus = [
        { name: "Exhaust Fan 1", key: "equipment/exhuastfan1/enabled", icon: <Fan /> },
        { name: "Exhaust Fan 2", key: "equipment/exhaustfan2/enabled", icon: <Fan /> },
        { name: "Supply", key: "equipment/supply/enabled", icon: <Fan /> },
        { name: "FCU 1", key: "equipment/fcu1/enabled", icon: <Fan /> },
        { name: "FCU 2", key: "equipment/fcu2/enabled", icon: <Fan /> },
        { name: "FCU 3", key: "equipment/fcu3/enabled", icon: <Fan /> },
        { name: "FCU 4", key: "equipment/fcu4/enabled", icon: <Fan /> },
        { name: "Floor Heat 1", key: "equipment/floorheat1/enabled", icon: <Thermometer /> },
        { name: "Floor Heat 2", key: "equipment/floorheat2/enabled", icon: <Thermometer /> },
      ]

      // Find vents status
      const ventsStatus = [
        { name: "Ridge Vent", key: "equipment/ridgevent/open", icon: <Leaf /> },
        { name: "Window Vent", key: "equipment/windowvent/open", icon: <Leaf /> },
      ]

      // Find equipment-specific metrics
      const supplyAmps = findMetric(["equipment/supply/amps", "supply/amps", "supply amps"])

      if (supplyAmps !== undefined) {
        results.push({
          name: "Supply Amps",
          value: roundValue(supplyAmps),
          unit: "A",
          icon: <Activity className="h-4 w-4 text-purple-500" />,
        })
      }

      const exhaustFan1Amps = findMetric(["equpment/exhaustfan1/amps", "exhaustfan1/amps", "exhaust fan 1 amps"])

      if (exhaustFan1Amps !== undefined) {
        results.push({
          name: "Exhaust 1 Amps",
          value: roundValue(exhaustFan1Amps),
          unit: "A",
          icon: <Activity className="h-4 w-4 text-purple-500" />,
        })
      }

      const exhaustFan2Amps = findMetric(["equpment/exhaustfan2/amps", "exhaustfan2/amps", "exhaust fan 2 amps"])

      if (exhaustFan2Amps !== undefined) {
        results.push({
          name: "Exhaust 2 Amps",
          value: roundValue(exhaustFan2Amps),
          unit: "A",
          icon: <Activity className="h-4 w-4 text-purple-500" />,
        })
      }

      // Add specific active controls based on the equipment name/type
      if (
        equipmentItem.name?.toLowerCase().includes("exhaust") ||
        equipmentItem.type?.toLowerCase().includes("exhaust")
      ) {
        // Add exhaust-specific active controls
        for (const control of systemControls) {
          if (control.name.toLowerCase().includes("exhaust")) {
            const activeControl = findMetric([control.key])
            if (activeControl !== undefined) {
              results.push({
                name: `${control.name} Control`,
                value: activeControl === true || activeControl === "true" ? "Active" : "Inactive",
                unit: "",
                icon: (
                  <ToggleLeft
                    className={`h-4 w-4 ${activeControl === true || activeControl === "true" ? "text-green-500" : "text-gray-400"}`}
                  />
                ),
              })
            }
          }
        }

        // Add exhaust enabled status
        for (const status of equipmentStatus) {
          if (status.name.toLowerCase().includes("exhaust")) {
            const enabled = findMetric([status.key])
            if (enabled !== undefined) {
              results.push({
                name: `${status.name}`,
                value: enabled === true || enabled === "true" ? "Enabled" : "Disabled",
                unit: "",
                icon: (
                  <ToggleLeft
                    className={`h-4 w-4 ${enabled === true || enabled === "true" ? "text-green-500" : "text-gray-400"}`}
                  />
                ),
              })
            }
          }
        }
      } else if (
        equipmentItem.name?.toLowerCase().includes("fcu") ||
        equipmentItem.type?.toLowerCase().includes("fcu")
      ) {
        // Add FCU-specific active controls
        for (const control of systemControls) {
          if (control.name.toLowerCase().includes("fcu")) {
            const activeControl = findMetric([control.key])
            if (activeControl !== undefined) {
              results.push({
                name: `${control.name} Control`,
                value: activeControl === true || activeControl === "true" ? "Active" : "Inactive",
                unit: "",
                icon: (
                  <ToggleLeft
                    className={`h-4 w-4 ${activeControl === true || activeControl === "true" ? "text-green-500" : "text-gray-400"}`}
                  />
                ),
              })
            }
          }
        }

        // Add FCU enabled status
        for (const status of equipmentStatus) {
          if (status.name.toLowerCase().includes("fcu")) {
            const enabled = findMetric([status.key])
            if (enabled !== undefined) {
              results.push({
                name: `${status.name}`,
                value: enabled === true || enabled === "true" ? "Enabled" : "Disabled",
                unit: "",
                icon: (
                  <ToggleLeft
                    className={`h-4 w-4 ${enabled === true || enabled === "true" ? "text-green-500" : "text-gray-400"}`}
                  />
                ),
              })
            }
          }
        }
      } else if (
        equipmentItem.name?.toLowerCase().includes("floor") ||
        equipmentItem.type?.toLowerCase().includes("floor heat")
      ) {
        // Add floor heat-specific active controls
        for (const control of systemControls) {
          if (control.name.toLowerCase().includes("floor")) {
            const activeControl = findMetric([control.key])
            if (activeControl !== undefined) {
              results.push({
                name: `${control.name} Control`,
                value: activeControl === true || activeControl === "true" ? "Active" : "Inactive",
                unit: "",
                icon: (
                  <ToggleLeft
                    className={`h-4 w-4 ${activeControl === true || activeControl === "true" ? "text-green-500" : "text-gray-400"}`}
                  />
                ),
              })
            }
          }
        }

        // Add floor heat enabled status
        for (const status of equipmentStatus) {
          if (status.name.toLowerCase().includes("floor")) {
            const enabled = findMetric([status.key])
            if (enabled !== undefined) {
              results.push({
                name: `${status.name}`,
                value: enabled === true || enabled === "true" ? "Enabled" : "Disabled",
                unit: "",
                icon: (
                  <ToggleLeft
                    className={`h-4 w-4 ${enabled === true || enabled === "true" ? "text-green-500" : "text-gray-400"}`}
                  />
                ),
              })
            }
          }
        }
      } else if (
        equipmentItem.name?.toLowerCase().includes("vent") ||
        equipmentItem.type?.toLowerCase().includes("vent")
      ) {
        // Add vent-specific status
        for (const vent of ventsStatus) {
          const isOpen = findMetric([vent.key])
          if (isOpen !== undefined) {
            results.push({
              name: `${vent.name}`,
              value: isOpen === true || isOpen === "true" ? "Open" : "Closed",
              unit: "",
              icon: (
                <ToggleLeft
                  className={`h-4 w-4 ${isOpen === true || isOpen === "true" ? "text-green-500" : "text-gray-400"}`}
                />
              ),
            })
          }
        }
      } else if (
        equipmentItem.name?.toLowerCase().includes("supply") ||
        equipmentItem.type?.toLowerCase().includes("supply")
      ) {
        // Add supply-specific active controls
        for (const control of systemControls) {
          if (control.name.toLowerCase().includes("supply")) {
            const activeControl = findMetric([control.key])
            if (activeControl !== undefined) {
              results.push({
                name: `${control.name} Control`,
                value: activeControl === true || activeControl === "true" ? "Active" : "Inactive",
                unit: "",
                icon: (
                  <ToggleLeft
                    className={`h-4 w-4 ${activeControl === true || activeControl === "true" ? "text-green-500" : "text-gray-400"}`}
                  />
                ),
              })
            }
          }
        }

        // Add supply enabled status
        for (const status of equipmentStatus) {
          if (status.name.toLowerCase().includes("supply")) {
            const enabled = findMetric([status.key])
            if (enabled !== undefined) {
              results.push({
                name: `${status.name}`,
                value: enabled === true || enabled === "true" ? "Enabled" : "Disabled",
                unit: "",
                icon: (
                  <ToggleLeft
                    className={`h-4 w-4 ${enabled === true || enabled === "true" ? "text-green-500" : "text-gray-400"}`}
                  />
                ),
              })
            }
          }
        }
      }

      // If results has data and equipment is a general "greenhouse" controller, return results
      if (
        results.length > 0 &&
        (equipmentItem.name?.toLowerCase().includes("controller") ||
          equipmentItem.type?.toLowerCase().includes("controller") ||
          equipmentItem.name?.toLowerCase().includes("greenhouse") ||
          equipmentItem.type?.toLowerCase().includes("greenhouse"))
      ) {
        return results
      }
    }

    // Now update the temperature detection logic based on equipment type
    const type = equipmentItem.type?.toLowerCase() || ""
    const name = equipmentItem.name?.toLowerCase() || ""
    const locationName = equipmentItem.locationName?.toLowerCase() || ""

    // Check if this is a fan coil unit to add fan status
    const isFanCoil = type.includes("fan coil") || name.includes("fancoil") || name.includes("fan coil")

    // Look for fan status if this is a fan coil unit
    if (isFanCoil) {
      // Look for fan status with various naming conventions
      const fanStatus = findMetric([
        "Fan Status",
        "FanStatus",
        "Supply Fan Status",
        "SupplyFanStatus",
        "Fan Running",
        "FanRunning",
        "Supply Fan Running",
        "SupplyFanRunning",
        "Fan State",
        "FanState",
        "Supply Fan State",
        "SupplyFanState",
        "Fan On",
        "FanOn",
        "Supply Fan On",
        "SupplyFanOn",
      ])

      if (fanStatus !== undefined) {
        const isRunning =
          typeof fanStatus === "boolean"
            ? fanStatus
            : typeof fanStatus === "string" &&
              (fanStatus.toLowerCase() === "running" ||
                fanStatus.toLowerCase() === "on" ||
                fanStatus.toLowerCase() === "true")

        results.push({
          name: "Fan Status",
          value:
            typeof fanStatus === "boolean"
              ? fanStatus
                ? "Running"
                : "Off"
              : typeof fanStatus === "string" && fanStatus.toLowerCase() === "on"
                ? "Running"
                : fanStatus,
          unit: "",
          icon: <Settings className={`h-4 w-4 ${isRunning ? "animate-spin text-blue-500" : "text-gray-500"}`} />,
          className: isRunning ? "text-green-500 font-medium drop-shadow-sm" : "",
        })
      }

      // Look for fan amps
      const fanAmps = findMetric([
        "Fan Amps",
        "FanAmps",
        "Supply Fan Amps",
        "SupplyFanAmps",
        "Fan Current",
        "FanCurrent",
        "Supply Fan Current",
        "SupplyFanCurrent",
      ])

      if (fanAmps !== undefined) {
        // Check if the value has °F in it (incorrectly labeled)
        let ampsValue = fanAmps
        const ampsUnit = "A"

        // If the value is a string and contains °F, extract the numeric part
        if (typeof fanAmps === "string" && fanAmps.includes("°F")) {
          ampsValue = Number.parseFloat(fanAmps.replace("°F", ""))
        }

        results.push({
          name: "Fan Amps",
          value: roundValue(ampsValue),
          unit: ampsUnit,
          icon: <Activity className="h-4 w-4 text-purple-500" />,
        })
      }
    }

    // Look for supply temperature with various naming conventions based on equipment type
    let supplyTempNames = [
      "Supply Temperature",
      "SupplyTemperature",
      "Supply Air Temp",
      "SupplyAirTemp",
      "SAT",
      "DischargeAir",
      "dischargeAir",
      "Discharge Air",
      "Discharge",
      "discharge",
      "Supply",
      "SupplyTemp",
      "SupplyAir",
      "supply",
      "supplytemp",
      "supplyair",
      "supplyAir",
      "supplyTemp",
      "Discharge Air Temperature",
      "DischargeTempAir",
      "DischargeTemp",
      "Discharge Temp",
    ]

    // Add chiller-specific temperature names
    if (type.includes("chiller")) {
      supplyTempNames = [
        ...supplyTempNames,
        "Chilled Water Temp",
        "ChilledWaterTemp",
        "CHWT",
        "ChilledWater",
        "Chilled",
        "ChilledSupply",
        "H2O Supply",
        "H2OSupply",
        "H20Supply",
        "H20 Supply",
        "H2O Supply Temperature",
        "H20SupplyTemperature",
      ]
    }
    // Add boiler-specific temperature names
    else if (type.includes("boiler")) {
      // Check if it's a domestic hot water boiler
      if (name.includes("domestic") || name.includes("dhw") || name.includes("dm")) {
        supplyTempNames = [
          ...supplyTempNames,
          "DM H2O Supply",
          "DMH2OSupply",
          "DM H20 Supply",
          "DMH20Supply",
          "Domestic Hot Water Supply",
          "DomesticHotWaterSupply",
          "DHW Supply",
          "DHWSupply",
        ]
      }
      // Check if it's a comfort heating boiler
      else if (name.includes("comfort") || name.includes("heating")) {
        supplyTempNames = [
          ...supplyTempNames,
          "H2O Supply",
          "H2OSupply",
          "H20Supply",
          "H20 Supply",
          "Heating Loop Supply",
          "HeatingLoopSupply",
          "Heating Loop Supply Temperature",
          "HeatingLoopSupplyTemperature",
        ]
      }
      // Generic boiler
      else {
        supplyTempNames = [
          ...supplyTempNames,
          "Hot Water Temp",
          "HotWaterTemp",
          "HWT",
          "HotWater",
          "HWSupply",
          "BoilerTemp",
          "Heating Loop Supply",
          "HeatingLoopSupply",
          "Heating Loop Supply Temperature",
          "HeatingLoopSupplyTemperature",
          "H2O Supply",
          "H2OSupply",
          "H20Supply",
          "H20 Supply",
        ]
      }
    }

    // Special case for Heritage Pointe of Huntington
    if (locationName.includes("heritage") && (locationName.includes("huntington") || locationName.includes("pointe"))) {
      if (name.includes("domestic") || name.includes("dhw") || name.includes("dm")) {
        supplyTempNames = [...supplyTempNames, "DM H2O Supply", "DMH2OSupply", "DM H20 Supply", "DMH20Supply"]
      } else if (name.includes("comfort") || name.includes("heating")) {
        supplyTempNames = [...supplyTempNames, "H2O Supply", "H2OSupply", "H20Supply", "H20 Supply"]
      }
    }

    // Explicitly exclude "Supply Fan Amps" from temperature search
    const supplyTemp = findMetric(supplyTempNames, ["Supply Fan Amps", "SupplyFanAmps", "Fan Amps"], type)

    // Similarly, update the return temperature detection for different equipment types
    let returnTempNames = [
      "Return Temperature",
      "ReturnTemperature",
      "Return Air Temp",
      "ReturnAirTemp",
      "RAT",
      "Return Air",
      "ReturnAir",
      "Return",
      "return",
    ]

    // Add chiller-specific return temperature names
    if (type.includes("chiller")) {
      returnTempNames = [
        ...returnTempNames,
        "Chilled Water Return",
        "ChilledWaterReturn",
        "CHWR",
        "H2O Return",
        "H2OReturn",
        "H20Return",
        "H20 Return",
        "H2O Return Temperature",
        "H20ReturnTemperature",
      ]
    }
    // Add boiler-specific return temperature names
    else if (type.includes("boiler")) {
      // Check if it's a domestic hot water boiler
      if (name.includes("domestic") || name.includes("dhw") || name.includes("dm")) {
        returnTempNames = [
          ...returnTempNames,
          "DM H2O Return",
          "DMH2OReturn",
          "DM H20 Return",
          "DMH20Return",
          "Domestic Hot Water Return",
          "DomesticHotWaterReturn",
          "DHW Return",
          "DHWReturn",
        ]
      }
      // Check if it's a comfort heating boiler
      else if (name.includes("comfort") || name.includes("heating")) {
        returnTempNames = [
          ...returnTempNames,
          "H2O Return",
          "H2OReturn",
          "H20Return",
          "H20 Return",
          "Heating Loop Return",
          "HeatingLoopReturn",
          "Heating Loop Return Temperature",
          "HeatingLoopReturnTemperature",
        ]
      }
      // Generic boiler
      else {
        returnTempNames = [
          ...returnTempNames,
          "Hot Water Return",
          "HotWaterReturn",
          "HWR",
          "HWReturn",
          "Heating Loop Return",
          "HeatingLoopReturn",
          "Heating Loop Return Temperature",
          "HeatingLoopReturnTemperature",
          "H2O Return",
          "H2OReturn",
          "H20Return",
          "H20 Return",
        ]
      }
    }

    // Special case for Heritage Pointe of Huntington
    if (locationName.includes("heritage") && (locationName.includes("huntington") || locationName.includes("pointe"))) {
      if (name.includes("domestic") || name.includes("dhw") || name.includes("dm")) {
        returnTempNames = [...returnTempNames, "DM H2O Return", "DMH2OReturn", "DM H20 Return", "DMH20Return"]
      } else if (name.includes("comfort") || name.includes("heating")) {
        returnTempNames = [...returnTempNames, "H2O Return", "H2OReturn", "H20Return", "H20 Return"]
      }
    }

    const returnTemp = findMetric(returnTempNames, [], type)

    // Add supply temperature to results if found
    if (supplyTemp !== undefined) {
      results.push({
        name: type.includes("chiller")
          ? "Chilled Water"
          : type.includes("boiler") && name.includes("domestic")
            ? "DHW Supply"
            : type.includes("boiler")
              ? "Hot Water"
              : "Supply Temp",
        value: roundValue(supplyTemp),
        unit: "°F",
        icon: <Thermometer className="h-4 w-4 text-blue-500" />,
      })
    }

    // Add return temperature to results if found
    if (returnTemp !== undefined) {
      results.push({
        name: type.includes("chiller")
          ? "Return Water"
          : type.includes("boiler") && name.includes("domestic")
            ? "DHW Return"
            : type.includes("boiler")
              ? "Return Water"
              : "Return Temp",
        value: roundValue(returnTemp),
        unit: "°F",
        icon: <Thermometer className="h-4 w-4 text-orange-500" />,
      })
    }

    // Look for GlobalSetpoint first (highest priority)
    const globalSetpoint = findMetric([
      "GlobalSetpoint",
      "Global Setpoint",
      "Global_Setpoint",
      "System Setpoint",
      "SystemSetpoint",
    ])

    // If GlobalSetpoint is not found, look for regular setpoint names
    const setpoint =
      globalSetpoint !== undefined
        ? undefined
        : findMetric(
            [
              "Setpoint",
              "SetPoint",
              "Set Point",
              "Temperature Setpoint",
              "TemperatureSetpoint",
              "Temp Setpoint",
              "TempSetpoint",
              "Supply Setpoint",
              "SupplySetpoint",
              "Discharge Setpoint",
              "DischargeSetpoint",
              "SAT Setpoint",
              "SATSetpoint",
            ],
            ["Setpoint Differential", "SetpointDifferential", "Differential"],
          )

    const targetTemp = findMetric([
      "Target Temperature",
      "TargetTemperature",
      "Target Temp",
      "TargetTemp",
      "Target",
      "Temperature Target",
      "TempTarget",
    ])

    // Add setpoint to results, prioritizing GlobalSetpoint, then regular setpoint, then target temp
    if (globalSetpoint !== undefined) {
      results.push({
        name: "Global Setpoint",
        value: roundValue(globalSetpoint),
        unit: "°F",
        icon: <Atom className="h-4 w-4 text-red-500" />,
      })
    } else if (setpoint !== undefined) {
      results.push({
        name: "Setpoint",
        value: roundValue(setpoint),
        unit: "°F",
        icon: <Atom className="h-4 w-4 text-red-500" />,
      })
    } else if (targetTemp !== undefined) {
      results.push({
        name: "Target Temp",
        value: roundValue(targetTemp),
        unit: "°F",
        icon: <Atom className="h-4 w-4 text-red-500" />,
      })
    }

    // Look for humidity
    const humidity = findMetric([
      "Humidity",
      "RelativeHumidity",
      "RH",
      "Space Humidity",
      "SpaceHumidity",
      "Room Humidity",
    ])

    if (humidity !== undefined) {
      results.push({
        name: "Humidity",
        value: roundValue(humidity),
        unit: "%",
        icon: <Droplet className="h-4 w-4 text-blue-500" />,
      })
    }

    // Look for supply fan amps
    const supplyFanAmps = findMetric(["Supply Fan Amps", "SupplyFanAmps", "Supply Amps", "SupplyAmps"])

    if (supplyFanAmps !== undefined) {
      // Check if the value has °F in it (incorrectly labeled)
      let ampsValue = supplyFanAmps
      const ampsUnit = "A"

      // If the value is a string and contains °F, extract the numeric part
      if (typeof supplyFanAmps === "string" && supplyFanAmps.includes("°F")) {
        ampsValue = Number.parseFloat(supplyFanAmps.replace("°F", ""))
      }

      results.push({
        name: "Supply Fan Amps",
        value: roundValue(ampsValue),
        unit: ampsUnit,
        icon: <Activity className="h-4 w-4 text-purple-500" />,
      })
    }

    // Look specifically for exhaust fan amps
    const exhaustFanAmps = findMetric(["Exhaust Fan Amps", "ExhaustFanAmps", "Exhaust Amps", "ExhaustAmps"])

    if (exhaustFanAmps !== undefined) {
      // Check if the value has °F in it (incorrectly labeled)
      let exhaustAmpsValue = exhaustFanAmps
      const exhaustAmpsUnit = "A"

      // If the value is a string and contains °F, extract the numeric part
      if (typeof exhaustFanAmps === "string" && exhaustFanAmps.includes("°F")) {
        exhaustAmpsValue = Number.parseFloat(exhaustFanAmps.replace("°F", ""))
      }

      results.push({
        name: "Exhaust Fan Amps",
        value: roundValue(exhaustAmpsValue),
        unit: exhaustAmpsUnit,
        icon: <Activity className="h-4 w-4 text-orange-500" />,
      })
    }

    // Look for building pressure
    const buildingPressure = findMetric([
      "Building Pressure",
      "BuildingPressure",
      "Static Pressure",
      "StaticPressure",
      "Pressure",
    ])

    if (buildingPressure !== undefined) {
      results.push({
        name: "Building Pressure",
        value: roundValue(buildingPressure),
        unit: "inWC",
        icon: <Gauge className="h-4 w-4 text-green-500" />,
      })
    }

    // Look for OA (Outside Air) Actuator
    const oaActuator = findMetric([
      "OA Actuator",
      "OAActuator",
      "Outside Air Actuator",
      "OutsideAirActuator",
      "OA Damper",
      "OADamper",
    ])

    if (oaActuator !== undefined) {
      results.push({
        name: "OA Actuator",
        value: roundValue(oaActuator),
        unit: "%",
        icon: <Sliders className="h-4 w-4 text-teal-500" />,
      })
    }

    // Look for other actuators
    const actuatorNames = Object.keys(metrics).filter(
      (key) =>
        key.toLowerCase().includes("actuator") ||
        key.toLowerCase().includes("damper") ||
        key.toLowerCase().includes("valve"),
    )

    // Add any other actuators that weren't already added (like OA Actuator)
    for (const actuatorName of actuatorNames) {
      // Skip if this is the OA Actuator we already added
      if (
        actuatorName.toLowerCase().includes("oa actuator") ||
        actuatorName.toLowerCase().includes("oaactuator") ||
        actuatorName.toLowerCase().includes("outside air actuator")
      ) {
        continue
      }

      const actuatorValue = metrics[actuatorName]
      if (actuatorValue !== undefined) {
        // Format the display name to be more readable
        const displayName = actuatorName
          .replace(/([A-Z])/g, " $1") // Add spaces before capital letters
          .replace(/^\w/, (c) => c.toUpperCase()) // Capitalize first letter

        results.push({
          name: displayName,
          value: roundValue(actuatorValue),
          unit: "%",
          icon: <Sliders className="h-4 w-4 text-indigo-500" />,
        })
      }
    }

    // Look for VFD Speed
    const vfdSpeed = findMetric([
      "VFD Speed",
      "VFDSpeed",
      "Fan VFD Speed",
      "FanVFDSpeed",
      "Exhaust Fan VFD Speed",
      "ExhaustFanVFDSpeed",
      "Supply Fan VFD Speed",
      "SupplyFanVFDSpeed",
    ])

    if (vfdSpeed !== undefined) {
      results.push({
        name: "VFD Speed",
        value: roundValue(vfdSpeed),
        unit: "%",
        icon: <Fan className="h-4 w-4 text-cyan-500" />,
      })
    }

    // Look for pump 1 amps and status
    const pump1Amps = findMetric([
      "Pump1Amps",
      "Pump 1 Amps",
      "Pump1 Amps",
      "Pump_1_Amps",
      "HWP1Amps",
      "HW Pump 1 Amps",
    ])

    const pump1Status = findMetric([
      "Pump1Status",
      "Pump 1 Status",
      "Pump1 Status",
      "Pump_1_Status",
      "HWP1Status",
      "HW Pump 1 Status",
    ])

    // Look for pump 2 amps and status
    const pump2Amps = findMetric([
      "Pump2Amps",
      "Pump 2 Amps",
      "Pump2 Amps",
      "Pump_2_Amps",
      "HWP2Amps",
      "HW Pump 2 Amps",
    ])

    const pump2Status = findMetric([
      "Pump2Status",
      "Pump 2 Status",
      "Pump2 Status",
      "Pump_2_Status",
      "HWP2Status",
      "HW Pump 2 Status",
      "Pump2Running",
      "Pump 2 Running",
    ])

    // Add pump 1 metrics if available
    if (pump1Amps !== undefined) {
      // Determine color based on amp value
      let ampsColor = "text-red-500"
      const ampsValue = Number(roundValue(pump1Amps))
      if (ampsValue > 20) {
        ampsColor = "text-green-500"
      } else if (ampsValue >= 10) {
        ampsColor = "text-orange-500"
      }

      results.push({
        name: "Pump 1 Amps",
        value: roundValue(pump1Amps),
        unit: "A",
        icon: <Gauge className={`h-4 w-4 ${ampsColor}`} />,
      })
    }

    if (pump1Status !== undefined) {
      const isRunning =
        typeof pump1Status === "boolean"
          ? pump1Status
          : typeof pump1Status === "string" && pump1Status.toLowerCase() === "running"

      results.push({
        name: "Pump 1 Status",
        value: typeof pump1Status === "boolean" ? (pump1Status ? "Running" : "Off") : pump1Status,
        unit: "",
        icon: <Settings className={`h-4 w-4 ${isRunning ? "animate-spin text-blue-500" : "text-gray-500"}`} />,
        className: isRunning ? "text-green-500 font-medium drop-shadow-sm" : "",
      })
    }

    // Add pump 2 metrics if available
    if (pump2Amps !== undefined) {
      // Determine color based on amp value
      let ampsColor = "text-red-500"
      const ampsValue = Number(roundValue(pump2Amps))
      if (ampsValue > 20) {
        ampsColor = "text-green-500"
      } else if (ampsValue >= 10) {
        ampsColor = "text-orange-500"
      }

      results.push({
        name: "Pump 2 Amps",
        value: roundValue(pump2Amps),
        unit: "A",
        icon: <Gauge className={`h-4 w-4 ${ampsColor}`} />,
      })
    }

    if (pump2Status !== undefined) {
      const isRunning =
        typeof pump2Status === "boolean"
          ? pump2Status
          : typeof pump2Status === "string" && pump2Status.toLowerCase() === "running"

      results.push({
        name: "Pump 2 Status",
        value: typeof pump2Status === "boolean" ? (pump2Status ? "Running" : "Off") : pump2Status,
        unit: "",
        icon: <Settings className={`h-4 w-4 ${isRunning ? "animate-spin text-blue-500" : "text-gray-500"}`} />,
        className: isRunning ? "text-green-500 font-medium drop-shadow-sm" : "",
      })
    }

    // Look for generic pump metrics if specific ones aren't found
    if (!pump1Amps && !pump2Amps) {
      const pumpAmps = findMetric(["PumpAmps", "Pump Amps", "Pump_Amps", "HWPumpAmps", "HW Pump Amps"])

      if (pumpAmps !== undefined) {
        // Determine color based on amp value
        let ampsColor = "text-red-500"
        const ampsValue = Number(roundValue(pumpAmps))
        if (ampsValue > 20) {
          ampsColor = "text-green-500"
        } else if (ampsValue >= 10) {
          ampsColor = "text-orange-500"
        }

        results.push({
          name: "Pump Amps",
          value: roundValue(pumpAmps),
          unit: "A",
          icon: <Gauge className={`h-4 w-4 ${ampsColor}`} />,
        })
      }
    }

    if (!pump1Status && !pump2Status) {
      const pumpStatus = findMetric([
        "PumpStatus",
        "Pump Status",
        "Pump_Status",
        "HWPumpStatus",
        "HW Pump Status",
        "PumpRunning",
        "Pump Running",
      ])

      if (pumpStatus !== undefined) {
        const isRunning =
          typeof pumpStatus === "boolean"
            ? pumpStatus
            : typeof pumpStatus === "string" && pumpStatus.toLowerCase() === "running"

        results.push({
          name: "Pump Status",
          value: typeof pumpStatus === "boolean" ? (pumpStatus ? "Running" : "Off") : pumpStatus,
          unit: "",
          icon: <Settings className={`h-4 w-4 ${isRunning ? "animate-spin text-blue-500" : "text-gray-500"}`} />,
          className: isRunning ? "text-green-500 font-medium drop-shadow-sm" : "",
        })
      }
    }

    // Additional metrics for greenhouse-specific equipment
    // Look for active control statuses if not already checked earlier
    if (!(isGreenhouse && results.length > 0)) {
      // Check for ExhaustActiveControl
      const exhaustActiveControl = findMetric(["ExhaustActiveControl"])
      if (exhaustActiveControl !== undefined) {
        results.push({
          name: "Exhaust Control",
          value: exhaustActiveControl === true || exhaustActiveControl === "true" ? "Active" : "Inactive",
          unit: "",
          icon: (
            <ToggleLeft
              className={`h-4 w-4 ${exhaustActiveControl === true || exhaustActiveControl === "true" ? "text-green-500" : "text-gray-400"}`}
            />
          ),
        })
      }

      // Check for FCU active controls
      const fcuActiveControls = [
        { key: "FCU1ActiveControl", name: "FCU 1" },
        { key: "FCU2ActiveControl", name: "FCU 2" },
        { key: "FCU4ActiveControl", name: "FCU 4" },
        { key: "FCUActiveControl", name: "FCU" },
      ]

      for (const control of fcuActiveControls) {
        const activeControl = findMetric([control.key])
        if (activeControl !== undefined) {
          results.push({
            name: `${control.name} Control`,
            value: activeControl === true || activeControl === "true" ? "Active" : "Inactive",
            unit: "",
            icon: (
              <ToggleLeft
                className={`h-4 w-4 ${activeControl === true || activeControl === "true" ? "text-green-500" : "text-gray-400"}`}
              />
            ),
          })
        }
      }

      // Check for floor heat active controls
      const floorHeatControls = [
        { key: "FloorHeat1ActiveControl", name: "Floor Heat 1" },
        { key: "FloorHeat2ActiveControl", name: "Floor Heat 2" },
        { key: "FloorHeatActiveControl", name: "Floor Heat" },
      ]

      for (const control of floorHeatControls) {
        const activeControl = findMetric([control.key])
        if (activeControl !== undefined) {
          results.push({
            name: `${control.name} Control`,
            value: activeControl === true || activeControl === "true" ? "Active" : "Inactive",
            unit: "",
            icon: (
              <ToggleLeft
                className={`h-4 w-4 ${activeControl === true || activeControl === "true" ? "text-green-500" : "text-gray-400"}`}
              />
            ),
          })
        }
      }

      // Check for supply active control
      const supplyActiveControl = findMetric(["SupplyActiveControl"])
      if (supplyActiveControl !== undefined) {
        results.push({
          name: "Supply Control",
          value: supplyActiveControl === true || supplyActiveControl === "true" ? "Active" : "Inactive",
          unit: "",
          icon: (
            <ToggleLeft
              className={`h-4 w-4 ${supplyActiveControl === true || supplyActiveControl === "true" ? "text-green-500" : "text-gray-400"}`}
            />
          ),
        })
      }

      // Check for enabled equipment
      const enabledEquipment = [
        { key: "equipment/exhuastfan1/enabled", name: "Exhaust Fan 1" },
        { key: "equipment/exhaustfan2/enabled", name: "Exhaust Fan 2" },
        { key: "equipment/supply/enabled", name: "Supply" },
        { key: "equipment/fcu1/enabled", name: "FCU 1" },
        { key: "equipment/fcu2/enabled", name: "FCU 2" },
        { key: "equipment/fcu3/enabled", name: "FCU 3" },
        { key: "equipment/fcu4/enabled", name: "FCU 4" },
        { key: "equipment/floorheat1/enabled", name: "Floor Heat 1" },
        { key: "equipment/floorheat2/enabled", name: "Floor Heat 2" },
      ]

      for (const item of enabledEquipment) {
        const enabled = findMetric([item.key])
        if (enabled !== undefined) {
          results.push({
            name: item.name,
            value: enabled === true || enabled === "true" ? "Enabled" : "Disabled",
            unit: "",
            icon: (
              <ToggleLeft
                className={`h-4 w-4 ${enabled === true || enabled === "true" ? "text-green-500" : "text-gray-400"}`}
              />
            ),
          })
        }
      }

      // Check for vent status
      const ventStatus = [
        { key: "equipment/ridgevent/open", name: "Ridge Vent" },
        { key: "equipment/windowvent/open", name: "Window Vent" },
      ]

      for (const vent of ventStatus) {
        const isOpen = findMetric([vent.key])
        if (isOpen !== undefined) {
          results.push({
            name: vent.name,
            value: isOpen === true || isOpen === "true" ? "Open" : "Closed",
            unit: "",
            icon: (
              <ToggleLeft
                className={`h-4 w-4 ${isOpen === true || isOpen === "true" ? "text-green-500" : "text-gray-400"}`}
              />
            ),
          })
        }
      }

      // Check for equipment-specific amps
      const ampsMetrics = [
        { key: "equipment/supply/amps", name: "Supply Amps" },
        { key: "equpment/exhaustfan1/amps", name: "Exhaust Fan 1 Amps" },
        { key: "equpment/exhaustfan2/amps", name: "Exhaust Fan 2 Amps" },
      ]

      for (const amp of ampsMetrics) {
        const ampValue = findMetric([amp.key])
        if (ampValue !== undefined) {
          results.push({
            name: amp.name,
            value: roundValue(ampValue),
            unit: "A",
            icon: <Activity className="h-4 w-4 text-purple-500" />,
          })
        }
      }

      // Check for zone temperatures and humidity
      const zoneMetrics = [
        {
          key: "zones/zone1/temp",
          name: "Zone 1 Temp",
          unit: "°F",
          icon: <Thermometer className="h-4 w-4 text-red-500" />,
        },
        {
          key: "zones/zone2/temp",
          name: "Zone 2 Temp",
          unit: "°F",
          icon: <Thermometer className="h-4 w-4 text-red-500" />,
        },
        { key: "temp1", name: "Zone 1 Temp", unit: "°F", icon: <Thermometer className="h-4 w-4 text-red-500" /> },
        { key: "temp2", name: "Zone 2 Temp", unit: "°F", icon: <Thermometer className="h-4 w-4 text-red-500" /> },
        {
          key: "zones/zone1/humidity",
          name: "Zone 1 Humidity",
          unit: "%",
          icon: <Droplet className="h-4 w-4 text-blue-500" />,
        },
        {
          key: "zones/zone2/humidity",
          name: "Zone 2 Humidity",
          unit: "%",
          icon: <Droplet className="h-4 w-4 text-blue-500" />,
        },
        { key: "humidity1", name: "Zone 1 Humidity", unit: "%", icon: <Droplet className="h-4 w-4 text-blue-500" /> },
        { key: "humidity2", name: "Zone 2 Humidity", unit: "%", icon: <Droplet className="h-4 w-4 text-blue-500" /> },
      ]

      for (const zone of zoneMetrics) {
        const value = findMetric([zone.key])
        if (value !== undefined) {
          results.push({
            name: zone.name,
            value: roundValue(value),
            unit: zone.unit,
            icon: zone.icon,
          })
        }
      }

      // Check for averages
      const averageMetrics = [
        {
          key: "averagetemp",
          name: "Avg Temperature",
          unit: "°F",
          icon: <Thermometer className="h-4 w-4 text-orange-500" />,
        },
        {
          key: "averagehumidity",
          name: "Avg Humidity",
          unit: "%",
          icon: <Droplet className="h-4 w-4 text-blue-500" />,
        },
      ]

      for (const avg of averageMetrics) {
        const value = findMetric([avg.key])
        if (value !== undefined) {
          results.push({
            name: avg.name,
            value: roundValue(value),
            unit: avg.unit,
            icon: avg.icon,
          })
        }
      }

      // Check for outside temperature
      const outsideTemp = findMetric(["outsideTemp"])
      if (outsideTemp !== undefined) {
        results.push({
          name: "Outside Temp",
          value: roundValue(outsideTemp),
          unit: "°F",
          icon: <Thermometer className="h-4 w-4 text-gray-500" />,
        })
      }

      // Check for rain status
      const isRaining = findMetric(["isRaining"])
      if (isRaining !== undefined) {
        results.push({
          name: "Rain Status",
          value: isRaining === true || isRaining === "true" ? "Yes" : "No",
          unit: "",
          icon: (
            <CloudRain
              className={`h-4 w-4 ${isRaining === true || isRaining === "true" ? "text-blue-500" : "text-gray-400"}`}
            />
          ),
        })
      }

      // Check for time of day
      const timeOfDay = findMetric(["timeofday"])
      if (timeOfDay !== undefined) {
        results.push({
          name: "Time of Day",
          value: typeof timeOfDay === "string" ? timeOfDay : "Unknown",
          unit: "",
          icon: <Sun className="h-4 w-4 text-yellow-500" />,
        })
      }
    }

    return results
  }

  // Helper function to round numeric values to 2 decimal places
  const roundValue = (value: any): any => {
    if (typeof value === "number") {
      return Number(value.toFixed(2))
    } else if (typeof value === "string") {
      // Try to convert string to number and round it
      const num = Number.parseFloat(value)
      if (!isNaN(num)) {
        return Number(num.toFixed(2))
      }
    }
    return value
  }

  // Helper function to get equipment status
  const getEquipmentStatus = (equipmentItem: any) => {
    const rtData = getEquipmentRealtimeData(equipmentItem.id) || getEquipmentRealtimeData(equipmentItem.name)

    // If we have realtime data with alerts, use that for status
    if (rtData && rtData.alerts && rtData.alerts.length > 0) {
      return {
        label: "Alert",
        variant: "destructive" as const,
      }
    }

    // Check if we have realtime data with a recent timestamp
    if (rtData && rtData.dateTime) {
      const lastUpdateTime = new Date(rtData.dateTime).getTime()
      const currentTime = new Date().getTime()
      const timeDifference = currentTime - lastUpdateTime

      // If data was updated in the last 24 hours, consider it online
      if (timeDifference < 24 * 60 * 60 * 1000) {
        return {
          label: "Online",
          variant: "default" as const,
        }
      }
    }

    // Otherwise use the status from Firestore
    const status = equipmentItem.status || "Unknown"

    if (status === "Fault" || status.toLowerCase() === "fault") {
      return {
        label: "Fault",
        variant: "destructive" as const,
      }
    } else if (status === "Offline" || status.toLowerCase() === "offline") {
      return {
        label: "Offline",
        variant: "warning" as const,
      }
    } else if (status === "Warning" || status.toLowerCase() === "warning") {
      return {
        label: "Warning",
        variant: "warning" as const,
      }
    } else if (status === "Online" || status.toLowerCase() === "online") {
      return {
        label: "Online",
        variant: "default" as const,
      }
    }

    return {
      label: status,
      variant: "secondary" as const,
    }
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Button variant="ghost" size="icon" disabled className="mr-2">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Skeleton className="h-9 w-[200px]" />
          </div>
          <div className="flex space-x-2">
            <Skeleton className="h-10 w-[120px]" />
            <Skeleton className="h-10 w-[100px]" />
          </div>
        </div>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-[150px]" />
            <Skeleton className="h-4 w-[250px]" />
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-start space-x-2">
                  <Skeleton className="h-4 w-4 mt-1" />
                  <div>
                    <Skeleton className="h-5 w-[100px] mb-1" />
                    <Skeleton className="h-4 w-[150px] mb-1" />
                    <Skeleton className="h-4 w-[120px]" />
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardHeader className="p-4">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-4" />
                      <Skeleton className="h-8 w-8" />
                    </div>
                    <Skeleton className="h-4 w-[80px] mt-1" />
                  </CardHeader>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-[100px]" />
            <Skeleton className="h-4 w-[200px]" />
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i}>
                  <CardHeader className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Skeleton className="h-5 w-[120px] mb-1" />
                        <Skeleton className="h-4 w-[80px]" />
                      </div>
                      <Skeleton className="h-6 w-[60px]" />
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!location) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Location Not Found</CardTitle>
          <CardDescription>The requested location could not be found.</CardDescription>
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
          <h1 className="text-3xl font-bold">{location.name}</h1>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => router.push(`/dashboard/settings`)} className="hover:bg-[#e6f3f1]">
            <Edit className="mr-2 h-4 w-4" />
            Edit Location
          </Button>
          <Button variant="outline" onClick={() => router.push("/dashboard/settings")} className="hover:bg-[#e6f3f1]">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
        </div>
      </div>

      {/* Location Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Location Overview</CardTitle>
          <CardDescription>Details and statistics for {location.name}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start space-x-2">
              <MapPin className="h-4 w-4 mt-1 text-muted-foreground" />
              <div>
                <p className="font-medium">Address</p>
                <p className="text-sm text-muted-foreground">{location.address}</p>
                <p className="text-sm text-muted-foreground">
                  {[location.city, location.state, location.zipCode, location.country].filter(Boolean).join(", ")}
                </p>
              </div>
            </div>
            {location.contactName && (
              <div className="flex items-start space-x-2">
                <Phone className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <p className="font-medium">Contact</p>
                  <p className="text-sm text-muted-foreground">{location.contactName}</p>
                  <p className="text-sm text-muted-foreground">{location.contactPhone}</p>
                </div>
              </div>
            )}
            {location.contactEmail && (
              <div className="flex items-start space-x-2">
                <Mail className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <p className="font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">{location.contactEmail}</p>
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
                    {
                      equipment.filter((item) => {
                        const rtData = getEquipmentRealtimeData(item.id) || getEquipmentRealtimeData(item.name)
                        // Check for warnings in realtime data
                        if (
                          rtData &&
                          rtData.alerts &&
                          rtData.alerts.some((alert) => alert.severity === "warning" || alert.severity === "Warning")
                        ) {
                          return true
                        }
                        // Fallback to Firestore status if no realtime data
                        return item.status === "warning" || item.status === "Warning"
                      }).length
                    }
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
                    {
                      equipment.filter((item) => {
                        const rtData = getEquipmentRealtimeData(item.id) || getEquipmentRealtimeData(item.name)
                        // Check for errors in realtime data
                        if (
                          rtData &&
                          rtData.alerts &&
                          rtData.alerts.some(
                            (alert) =>
                              alert.severity === "error" ||
                              alert.severity === "critical" ||
                              alert.severity === "Error" ||
                              alert.severity === "Critical" ||
                              alert.severity === "Fault",
                          )
                        ) {
                          return true
                        }
                        // Fallback to Firestore status if no realtime data
                        return item.status === "error" || item.status === "Fault"
                      }).length
                    }
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">Errors</p>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="p-4">
                <div className="flex items-center justify-between">
                  <Building className="h-4 w-4 text-green-500" />
                  <span className="text-2xl font-bold">
                    {
                      equipment.filter((item) => {
                        const rtData = getEquipmentRealtimeData(item.id) || getEquipmentRealtimeData(item.name)
                        // Check if we have recent realtime data (within last 24 hours)
                        if (rtData && rtData.dateTime) {
                          const lastUpdateTime = new Date(rtData.dateTime).getTime()
                          const currentTime = new Date().getTime()
                          const timeDifference = currentTime - lastUpdateTime

                          // If data was updated in the last 24 hours, consider it online
                          if (timeDifference < 24 * 60 * 60 * 1000) {
                            return true
                          }
                        }
                        // Fallback to Firestore status if no realtime data
                        return item.status === "online" || item.status === "Online"
                      }).length
                    }
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
          <CardDescription>Equipment installed at this location</CardDescription>
        </CardHeader>
        <CardContent>
          {equipment.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Fan className="h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-lg font-medium">No Equipment</p>
              <p className="text-sm text-muted-foreground">Add equipment to this location to get started</p>
              <Button className="mt-4" onClick={() => router.push("/dashboard/settings")}>
                Add Equipment
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {equipment.map((item) => {
                const rtData = getEquipmentRealtimeData(item.id) || getEquipmentRealtimeData(item.name)
                const keyMetrics = getKeyMetrics(item)
                const status = getEquipmentStatus(item)

                return (
                  <Card
                    key={item.id}
                    className="hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => {
                      // Navigate to the equipment details page
                      router.push(`/dashboard/equipment-details?locationId=${id}&equipmentId=${item.id}`)
                    }}
                  >
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base">{item.name}</CardTitle>
                          {/* Show zone from equipment data if available */}
                          {item.zone && (
                            <span className="inline-block px-2 py-0.5 text-sm rounded-full bg-[#e6f3f1] text-black my-1 mr-1">
                              {item.zone}
                            </span>
                          )}
                          {/* Show alias from realtime data if available */}
                          {rtData && rtData.alias && (
                            <span className="inline-block px-2 py-0.5 text-sm rounded-full bg-[#e6f3f1] text-black my-1">
                              {rtData.alias}
                            </span>
                          )}
                          <CardDescription>{item.type}</CardDescription>
                        </div>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 pt-0">
                      {rtData && (
                        <div className="grid grid-cols-1 gap-2 mt-2">
                          {keyMetrics.length > 0 ? (
                            <div className="grid grid-cols-1 gap-1">
                              {keyMetrics.map((metric, index) => (
                                <div key={index} className="flex items-center space-x-1">
                                  {metric.icon}
                                  <span className={`text-sm font-medium ${metric.className || ""}`}>
                                    {metric.name}:{" "}
                                    {metric.value !== undefined ? `${metric.value}${metric.unit}` : "N/A"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground">No metrics available</div>
                          )}
                          {rtData.dateTime && (
                            <div className="flex items-center space-x-1 text-muted-foreground mt-1">
                              <Clock className="h-3 w-3" />
                              <span className="text-xs">{formatDate(rtData.dateTime)}</span>
                            </div>
                          )}
                        </div>
                      )}
                      {rtData && rtData.alerts && rtData.alerts.length > 0 && (
                        <div className="mt-2 p-2 bg-red-50 rounded-md border border-red-200">
                          <p className="text-xs font-medium text-red-700 flex items-center">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {rtData.alerts.length} Alert{rtData.alerts.length > 1 ? "s" : ""}
                          </p>
                        </div>
                      )}
                    </CardContent>

                    <CardFooter className="p-2 pt-0 flex justify-end">
                      <Button variant="ghost" size="sm" className="text-xs h-7 px-2">
                        <ExternalLink className="h-3 w-3 mr-1" />
                        View Details
                      </Button>
                    </CardFooter>
                  </Card>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
      <ZonesSection locationId={id} />
    </div>
  )
}
