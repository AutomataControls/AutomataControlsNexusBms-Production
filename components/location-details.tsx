root @AutomataControlsDevOps: /opt/productionapp / components# cat location - details.tsx
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
    }, [db, id])

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

    // FIXED: Helper function to get equipment realtime data - SINGLE LOOKUP ONLY
    const getEquipmentRealtimeData = (equipmentId: string) => {
        // Try direct match first
        if (realtimeData[equipmentId]) {
            return realtimeData[equipmentId]
        }

        // Try case-insensitive match with the ID ONLY - No fallbacks to prevent duplicates
        const lowerEquipmentId = equipmentId.toLowerCase()
        for (const [key, value] of Object.entries(realtimeData)) {
            if (key.toLowerCase() === lowerEquipmentId) {
                return value
            }
        }

        return null
    }

    // Helper function to get key metrics for the equipment
    const getKeyMetrics = (equipmentItem: any) => {
        // FIXED: Single lookup only - no more double fallback
        const rtData = getEquipmentRealtimeData(equipmentItem.id)
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

        // Look for pump amps and status
        const pump1Amps = findMetric([
            "Pump1Amps",
            "Pump 1 Amps",
            "PumpAmps",
            "Pump Amps",
            "HWPumpAmps",
            "HW Pump Amps",
        ])

        const pump1Status = findMetric([
            "Pump1Status",
            "Pump 1 Status",
            "PumpStatus",
            "Pump Status",
            "HWPumpStatus",
            "HW Pump Status",
            "PumpRunning",
            "Pump Running",
        ])

        // Add pump metrics if available
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
                name: "Pump Amps",
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
                name: "Pump Status",
                value: typeof pump1Status === "boolean" ? (pump1Status ? "Running" : "Off") : pump1Status,
                unit: "",
                icon: <Settings className={`h-4 w-4 ${isRunning ? "animate-spin text-blue-500" : "text-gray-500"}`} />,
                className: isRunning ? "text-green-500 font-medium drop-shadow-sm" : "",
            })
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
        // FIXED: Single lookup only
        const rtData = getEquipmentRealtimeData(equipmentItem.id)

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
                variant: "secondary" as const,
            }
        } else if (status === "Warning" || status.toLowerCase() === "warning") {
            return {
                label: "Warning",
                variant: "secondary" as const,
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
                                                // FIXED: Single lookup only
                                                const rtData = getEquipmentRealtimeData(item.id)
                                                // Check for warnings in realtime data
                                                if (
                                                    rtData &&
                                                    rtData.alerts &&
                                                    rtData.alerts.some((alert: any) => alert.severity === "warning" || alert.severity === "Warning")
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
                                                // FIXED: Single lookup only
                                                const rtData = getEquipmentRealtimeData(item.id)
                                                // Check for errors in realtime data
                                                if (
                                                    rtData &&
                                                    rtData.alerts &&
                                                    rtData.alerts.some(
                                                        (alert: any) =>
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
                                                // FIXED: Single lookup only
                                                const rtData = getEquipmentRealtimeData(item.id)
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
                                // FIXED: Single lookup only - no more double fallback
                                const rtData = getEquipmentRealtimeData(item.id)
                                const keyMetrics = getKeyMetrics(item)
                                const status = getEquipmentStatus(item)

                                return (
                                    <Card
                                        key={item.id}
                                        className="hover:bg-muted/50 cursor-pointer transition-colors"
                                        onClick={() => {
                                            // FIXED: Navigate to individual equipment control page
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
