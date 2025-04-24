"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, ArrowLeft, RefreshCw, Clock, Info, Save } from "lucide-react"
import { db } from "@/lib/firebase"
import { secondaryDb } from "@/lib/secondary-firebase"
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore"
import { ref, onValue, set, update } from "firebase/database"
import { useSearchParams, useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"

// Import control components directly
import { AirHandlerControls } from "@/components/equipment-controls/air-handler-controls"
import { BoilerControls } from "@/components/equipment-controls/boiler-controls"
import { ChillerControls } from "@/components/equipment-controls/chiller-controls"
import { CoolingTowerControls } from "@/components/equipment-controls/cooling-tower-controls"
import { DOASControls } from "@/components/equipment-controls/doas-controls"
import { ExhaustFanControls } from "@/components/equipment-controls/exhaust-fan-controls"
import { FanCoilControls } from "@/components/equipment-controls/fan-coil-controls"
import { GreenhouseControls } from "@/components/equipment-controls/greenhouse-controls"
import { PumpControls } from "@/components/equipment-controls/pump-controls"
import { ActuatorControls } from "@/components/equipment-controls/actuator-controls"
import { RTUControls } from "@/components/equipment-controls/rtu-controls"

// Types for our data structure
interface Location {
  id: string
  name: string
  locationId?: string
  status?: string
}

interface Equipment {
  id: string
  name: string
  type?: string
  status?: string
  locationId?: string
  [key: string]: any
}

interface SystemMetric {
  [key: string]: any
}

interface System {
  dateTime: string
  metrics: SystemMetric
  source?: string
  timestamp: number
  zone?: string
  alerts?: string[]
  controls?: {
    [key: string]: any
  }
}

interface ControlCommand {
  command: string
  value: any
  timestamp: number
  status: "pending" | "executed" | "failed"
  source: string
}

export default function EquipmentDetailsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()

  // Get parameters from URL
  const locationId = searchParams.get("locationId")
  const equipmentId = searchParams.get("equipmentId") || searchParams.get("systemId")

  const [location, setLocation] = useState<Location | null>(null)
  const [equipment, setEquipment] = useState<Equipment | null>(null)
  const [equipmentData, setEquipmentData] = useState<System | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [locationName, setLocationName] = useState<string | null>(null)
  const [controlValues, setControlValues] = useState<{ [key: string]: any }>({})
  const [savingControls, setSavingControls] = useState<boolean>(false)
  const [controlHistory, setControlHistory] = useState<ControlCommand[]>([])
  const [firebaseDataFetched, setFirebaseDataFetched] = useState<boolean>(false)

  // Validate required parameters
  useEffect(() => {
    if (!locationId || !equipmentId) {
      setError(
        `Missing required parameters: ${!locationId ? "locationId" : ""} ${!equipmentId ? "equipmentId/systemId" : ""}`,
      )
      setLoading(false)
    }
  }, [locationId, equipmentId])

  // Fetch location and equipment from Firestore
  useEffect(() => {
    if (!locationId || !equipmentId) return

    const fetchLocationAndEquipment = async () => {
      try {
        // First try direct lookup by document ID for location
        let locationData = null
        const locationDoc = await getDoc(doc(db, "locations", locationId))

        if (locationDoc.exists()) {
          locationData = {
            id: locationDoc.id,
            ...(locationDoc.data() as Location),
          }
          console.log("Location found with direct ID lookup:", locationData)
        } else {
          console.log("Location not found with direct ID lookup")

          // Try to find by 'id' field
          const locationsRef = collection(db, "locations")
          const q = query(locationsRef, where("id", "==", locationId))
          const querySnapshot = await getDocs(q)

          if (!querySnapshot.empty) {
            locationData = {
              id: querySnapshot.docs[0].id,
              ...(querySnapshot.docs[0].data() as Location),
            }
            console.log("Found location with query by 'id' field:", locationData)
          } else {
            setError("Location not found")
            return
          }
        }

        setLocation(locationData)

        // Now fetch the equipment details from Firestore
        console.log("Fetching equipment details from Firestore for ID:", equipmentId)

        // First try direct lookup
        const equipmentDoc = await getDoc(doc(db, "equipment", equipmentId))

        if (equipmentDoc.exists()) {
          const equipmentData = {
            id: equipmentDoc.id,
            ...(equipmentDoc.data() as Equipment),
          }
          console.log("Equipment found with direct ID lookup:", equipmentData)
          setEquipment(equipmentData)
        } else {
          console.log("Equipment not found with direct ID lookup, trying query")

          // Try to find by query
          const equipmentRef = collection(db, "equipment")
          const q = query(equipmentRef, where("locationId", "==", locationId))
          const querySnapshot = await getDocs(q)

          let foundEquipment = null
          querySnapshot.forEach((doc) => {
            const data = doc.data() as Equipment
            if (doc.id === equipmentId) {
              foundEquipment = { id: doc.id, ...data }
            }
          })

          if (foundEquipment) {
            console.log("Equipment found with query:", foundEquipment)
            setEquipment(foundEquipment)
          } else {
            console.log("Equipment not found in Firestore")
            // We'll still try to find it in RTDB using the provided ID
          }
        }

        setFirebaseDataFetched(true)
      } catch (error) {
        console.error("Error fetching location or equipment:", error)
        setError("Failed to fetch data from Firestore.")
      }
    }

    fetchLocationAndEquipment()
  }, [locationId, equipmentId, db])

  // Fetch equipment metrics from RTDB
  useEffect(() => {
    if (!secondaryDb || !locationId || !equipmentId || !firebaseDataFetched) return

    const fetchEquipmentData = async () => {
      try {
        console.log(`Fetching equipment data for locationId: ${locationId}, equipmentId: ${equipmentId}`)
        console.log(`Equipment from Firestore:`, equipment)

        // First, get all locations to find the one with matching ID
        const locationsRef = ref(secondaryDb, "locations")

        onValue(
          locationsRef,
          (snapshot) => {
            const data = snapshot.val()
            if (!data) {
              console.error("No locations found in Realtime Database")
              setError("No locations found in Realtime Database")
              setLoading(false)
              return
            }

            console.log("RTDB locations:", Object.keys(data))

            // Find the location with the matching ID
            let foundLocationKey = null
            let foundSystem = null
            let foundSystemKey = null

            // Loop through all locations to find the one with matching ID
            for (const [locationKey, locationData] of Object.entries(data)) {
              const typedLocationData = locationData as any

              // Check if this location has the matching id
              if (typedLocationData.id === locationId) {
                foundLocationKey = locationKey
                setLocationName(locationKey)
                console.log(`Found location in RTDB with id ${locationId}: ${locationKey}`)

                // If we found the location, check if it has systems
                // Check if the equipment exists in the systems
                if (typedLocationData.systems) {
                  console.log(`Available systems for ${locationKey}:`, Object.keys(typedLocationData.systems))

                  // First try with the equipment ID directly
                  if (typedLocationData.systems[equipmentId]) {
                    foundSystem = typedLocationData.systems[equipmentId]
                    foundSystemKey = equipmentId
                    console.log(`Found equipment ${equipmentId} in location ${locationKey}:`, foundSystem)
                  }
                  // If equipment was found in Firestore, try with its name
                  else if (equipment?.name && typedLocationData.systems[equipment.name]) {
                    foundSystem = typedLocationData.systems[equipment.name]
                    foundSystemKey = equipment.name
                    console.log(`Found equipment by name ${equipment.name} in location ${locationKey}:`, foundSystem)
                  }
                  // Try case-insensitive search
                  else {
                    console.log(`Equipment ${equipmentId} not found directly in systems for ${locationKey}`)

                    // Try case-insensitive search with equipment name or ID
                    const searchTerms = [equipmentId.toLowerCase()]
                    if (equipment?.name) searchTerms.push(equipment.name.toLowerCase())

                    for (const [sysKey, sysData] of Object.entries(typedLocationData.systems)) {
                      const lowerSysKey = sysKey.toLowerCase()
                      if (searchTerms.some((term) => lowerSysKey === term || lowerSysKey.includes(term))) {
                        foundSystem = sysData
                        foundSystemKey = sysKey
                        console.log(`Found equipment with case-insensitive match: ${sysKey}`)
                        break
                      }
                    }
                  }

                  if (foundSystem) break
                } else {
                  console.log(`No systems found for location ${locationKey}`)
                }
              }
            }

            if (foundSystem) {
              // Check if any alerts should be cleared based on current metrics
              if (foundSystem.alerts && foundSystem.metrics) {
                const updatedAlerts = foundSystem.alerts.filter(
                  (alert) => !shouldClearAlert(alert, foundSystem.metrics),
                )

                // If alerts changed, update them in RTDB
                if (updatedAlerts.length !== foundSystem.alerts.length && foundLocationKey && foundSystemKey) {
                  const alertsRef = ref(secondaryDb, `locations/${foundLocationKey}/systems/${foundSystemKey}/alerts`)
                  update(alertsRef, { alerts: updatedAlerts })
                  foundSystem.alerts = updatedAlerts
                }
              }

              setEquipmentData(foundSystem as System)

              // Initialize control values from existing data if available
              if (foundSystem.controls) {
                setControlValues(foundSystem.controls)
              }

              // Load control history if available
              if (foundLocationKey && foundSystemKey) {
                const historyRef = ref(secondaryDb, `control_history/${foundLocationKey}/${foundSystemKey}`)
                onValue(historyRef, (historySnapshot) => {
                  const historyData = historySnapshot.val()
                  if (historyData) {
                    const historyArray = Object.values(historyData) as ControlCommand[]
                    // Sort by timestamp descending (newest first)
                    historyArray.sort((a, b) => b.timestamp - a.timestamp)
                    setControlHistory(historyArray.slice(0, 20)) // Get last 20 commands
                  }
                })
              }

              setLastUpdated(new Date())
              setLoading(false)
              setRefreshing(false)
            } else {
              if (foundLocationKey) {
                console.error(`Equipment ${equipmentId} not found in systems for location ${foundLocationKey}`)
                setError(`Equipment "${equipmentId}" not found in systems for location "${foundLocationKey}"`)
              } else {
                console.error(`Location with ID ${locationId} not found in Realtime Database`)
                setError(`Location with ID ${locationId} not found in Realtime Database`)
              }
              setLoading(false)
              setRefreshing(false)
            }
          },
          (error) => {
            console.error("Error fetching RTDB data:", error)
            setError("Failed to fetch equipment metrics from Realtime Database.")
            setLoading(false)
            setRefreshing(false)
          },
        )
      } catch (error) {
        console.error("Error setting up RTDB listener:", error)
        setError("Failed to connect to Realtime Database.")
        setLoading(false)
        setRefreshing(false)
      }
    }

    fetchEquipmentData()
  }, [locationId, equipmentId, secondaryDb, equipment, firebaseDataFetched])

  // Handle control value changes
  const handleControlChange = (key: string, value: any) => {
    setControlValues((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  // Save control values to RTDB
  const saveControlValues = async () => {
    if (!secondaryDb || !locationName || !equipment?.name) {
      toast({
        title: "Error",
        description: "Missing required data to save controls",
        variant: "destructive",
      })
      return
    }

    setSavingControls(true)

    try {
      // Path to the equipment controls in RTDB
      const controlsPath = `locations/${locationName}/systems/${equipment.name}/controls`
      const controlsRef = ref(secondaryDb, controlsPath)

      // Update controls
      await update(controlsRef, controlValues)

      // Add to control history
      const historyRef = ref(secondaryDb, `control_history/${locationName}/${equipment.name}/${Date.now()}`)

      const command: ControlCommand = {
        command: "update_controls",
        value: controlValues,
        timestamp: Date.now(),
        status: "pending",
        source: "web_dashboard",
      }

      await set(historyRef, command)

      toast({
        title: "Controls Updated",
        description: "Control commands have been sent to the system",
        variant: "default",
      })
    } catch (error) {
      console.error("Error saving control values:", error)
      toast({
        title: "Error",
        description: "Failed to save control values",
        variant: "destructive",
      })
    } finally {
      setSavingControls(false)
    }
  }

  // Helper function to format date
  const formatDate = (dateString: string | number) => {
    const date = typeof dateString === "number" ? new Date(dateString) : new Date(dateString)
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(date)
  }

  // Helper function to get status color
  const getStatusColor = (value: any, metricName: string) => {
    if (typeof value === "boolean") {
      return value ? "bg-green-500" : "bg-red-500"
    }

    if (typeof value === "string") {
      if (value.toLowerCase().includes("on") || value.toLowerCase() === "true") return "bg-green-500"
      if (value.toLowerCase().includes("off") || value.toLowerCase() === "false") return "bg-red-500"
      if (value.toLowerCase().includes("alarm") || value.toLowerCase().includes("error")) return "bg-yellow-500"
    }

    return "bg-blue-500"
  }

  // Helper function to render metric value
  const formatMetricValue = (key: string, value: any) => {
    if (value === null || value === undefined) return "N/A"

    const keyLower = key.toLowerCase()

    if (typeof value === "boolean" || value === "true" || value === "false") {
      return value === true || value === "true" ? "On" : "Off"
    }

    if (typeof value === "number" || !isNaN(Number.parseFloat(value))) {
      if (
        keyLower.includes("temp") ||
        keyLower.includes("air") ||
        keyLower.includes("supply") ||
        keyLower.includes("return")
      ) {
        return `${Number.parseFloat(value).toFixed(1)}°F`
      }
      if (keyLower.includes("setpoint")) {
        return `${Number.parseFloat(value).toFixed(1)}°F`
      }
      if (typeof value === "string" && value.includes("%")) {
        return value.replace("%%", "%")
      }
      if (keyLower.includes("speed") || keyLower.includes("actuator") || keyLower.includes("vfd")) {
        return `${Number.parseFloat(value).toFixed(1)}%`
      }
      if (keyLower.includes("pressure") || keyLower === "dp") {
        return `${Number.parseFloat(value).toFixed(2)} inWC`
      }
      if (keyLower.includes("amp")) {
        return `${Number.parseFloat(value).toFixed(2)} A`
      }
      if (keyLower.includes("humidity")) {
        return `${Number.parseFloat(value).toFixed(0)}%`
      }
      if (keyLower.includes("wind") || keyLower.includes("speed")) {
        return `${Number.parseFloat(value).toFixed(2)} mph`
      }
      if (keyLower.includes("differential")) {
        return `${Number.parseFloat(value).toFixed(3)}`
      }

      // For generic numeric values, format with reasonable precision
      return isNaN(Number.parseFloat(value)) ? value.toString() : Number.parseFloat(value).toFixed(1)
    }

    return value.toString()
  }

  // Group metrics by category
  const groupMetrics = (metrics: SystemMetric) => {
    const groups: { [key: string]: { [key: string]: any } } = {
      Temperature: {},
      Status: {},
      Controls: {},
      Environment: {},
      Other: {},
    }

    Object.entries(metrics).forEach(([key, value]) => {
      const lowerKey = key.toLowerCase()

      if (lowerKey.includes("temperature") || lowerKey.includes("temp") || lowerKey.includes("air")) {
        groups["Temperature"][key] = value
      } else if (
        lowerKey.includes("status") ||
        lowerKey.includes("state") ||
        lowerKey.includes("enabled") ||
        lowerKey.includes("alarm")
      ) {
        groups["Status"][key] = value
      } else if (
        lowerKey.includes("actuator") ||
        lowerKey.includes("valve") ||
        lowerKey.includes("speed") ||
        lowerKey.includes("vfd")
      ) {
        groups["Controls"][key] = value
      } else if (lowerKey.includes("humidity") || lowerKey.includes("pressure") || lowerKey.includes("wind")) {
        groups["Environment"][key] = value
      } else {
        groups["Other"][key] = value
      }
    })

    // Remove empty groups
    return Object.fromEntries(Object.entries(groups).filter(([_, values]) => Object.keys(values).length > 0))
  }

  // Add this new function after the groupMetrics function
  const shouldClearAlert = (alert: string, metrics: SystemMetric) => {
    // Clear pump command mismatch alerts if pump is running (amp reading > 12)
    if (alert.toLowerCase().includes("pump") && alert.toLowerCase().includes("command mismatch")) {
      const pumpKeys = Object.keys(metrics).filter((key) => key.toLowerCase().includes("amp"))
      return pumpKeys.some((key) => Number(metrics[key]) > 12)
    }
    return false
  }

  // Refresh data
  const handleRefresh = () => {
    setRefreshing(true)
    // The onValue listener will automatically refresh the data
    // This is just to show a loading state
    setTimeout(() => {
      if (refreshing) {
        setRefreshing(false)
      }
    }, 3000)
  }

  // Handle back button
  const handleBack = () => {
    if (locationId) {
      router.push(`/dashboard/location/${locationId}`)
    } else {
      router.push("/dashboard")
    }
  }

  // Render the appropriate control component based on equipment type
  const renderControlComponent = () => {
    if (!equipment || !equipmentData) {
      return (
        <div className="p-4 text-center">
          <p className="text-muted-foreground">No equipment data available.</p>
        </div>
      )
    }

    const equipmentType = equipment?.type?.toLowerCase() || ""

    // Create a component for the equipment
    const equipmentProps = {
      equipment: {
        ...equipment,
        controls: controlValues,
      },
      values: controlValues,
      onChange: handleControlChange,
      metrics: equipmentData?.metrics || {},
    }

    // Map equipment type to the appropriate control component
    switch (equipmentType) {
      case "air handler":
      case "ahu":
        return <AirHandlerControls {...equipmentProps} />
      case "boiler":
        return <BoilerControls {...equipmentProps} />
      case "chiller":
        return <ChillerControls {...equipmentProps} />
      case "cooling tower":
        return <CoolingTowerControls {...equipmentProps} />
      case "doas":
        return <DOASControls {...equipmentProps} />
      case "exhaust fan":
        return <ExhaustFanControls {...equipmentProps} />
      case "fan coil":
        return <FanCoilControls {...equipmentProps} />
      case "greenhouse":
        return <GreenhouseControls {...equipmentProps} />
      case "pump":
        return <PumpControls {...equipmentProps} />
      case "actuator":
        return <ActuatorControls {...equipmentProps} />
      case "rtu":
        return <RTUControls {...equipmentProps} />
      default:
        // If no specific control component matches, show a message
        return (
          <div className="p-4 text-center">
            <p className="text-muted-foreground">No specific controls available for this equipment type.</p>
            <p className="text-sm text-muted-foreground mt-2">Equipment type: {equipment?.type || "Unknown"}</p>
          </div>
        )
    }
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="mb-4">
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Location
          </Button>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error}
            {!locationId && !equipmentId && (
              <div className="mt-2">
                <p>This page requires both locationId and equipmentId query parameters.</p>
                <p className="text-sm mt-1">Example URL: /dashboard/equipment-details?locationId=6&equipmentId=AHU-1</p>
              </div>
            )}
          </AlertDescription>
        </Alert>

        {equipment && (
          <div className="mt-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Equipment Information</AlertTitle>
              <AlertDescription>
                <p>The equipment was found in Firestore but not in the Realtime Database.</p>
                <div className="mt-2">
                  <p>
                    <strong>Equipment ID:</strong> {equipment.id}
                  </p>
                  <p>
                    <strong>Name:</strong> {equipment.name}
                  </p>
                  <p>
                    <strong>Type:</strong> {equipment.type || "Unknown"}
                  </p>
                  <p>
                    <strong>Status:</strong> {equipment.status || "Unknown"}
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="container mx-auto p-4 space-y-4">
        <div className="mb-4">
          <Skeleton className="h-10 w-[150px]" />
        </div>
        <Skeleton className="h-8 w-[300px] mb-2" />
        <Skeleton className="h-6 w-[250px] mb-6" />

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-[180px]" />
            <Skeleton className="h-4 w-[150px]" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((j) => (
                <Skeleton key={j} className="h-6 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const displayName = equipment?.name || equipmentId

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center mb-6">
        <Button variant="outline" size="sm" onClick={handleBack} className="mr-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{displayName}</h1>
          <p className="text-muted-foreground">{location?.name || locationName}</p>
        </div>
      </div>

      <Tabs defaultValue="metrics" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="controls">Controls</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="space-y-6">
          <Card className="w-full">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>{displayName} Metrics</CardTitle>
                  <CardDescription>
                    {location?.name || locationName} - Last updated: {lastUpdated.toLocaleString()}
                  </CardDescription>
                </div>
                <Button size="sm" onClick={handleRefresh} disabled={refreshing}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {refreshing && (
                <div className="flex items-center justify-center p-6">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                  <span className="ml-3">Refreshing metrics...</span>
                </div>
              )}

              {equipmentData?.alerts && equipmentData.alerts.length > 0 && (
                <div className="mb-4 p-4 bg-yellow-100 border border-yellow-300 rounded-lg">
                  <div className="flex items-center mb-2">
                    <AlertCircle className="h-5 w-5 text-yellow-800 mr-2" />
                    <h3 className="font-medium text-yellow-800">Active Alerts</h3>
                  </div>
                  <ul className="space-y-2">
                    {equipmentData.alerts.map((alert, index) => (
                      <li key={index} className="flex items-start text-yellow-800">
                        <span className="mr-2">•</span>
                        <span>{alert}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {equipmentData?.metrics && !refreshing && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(equipmentData.metrics).map(([key, value]) => (
                    <div key={key} className="bg-muted/10 p-3 rounded-lg border">
                      <div className="text-sm font-medium text-muted-foreground">{key}</div>
                      <div className="text-xl font-bold">{formatMetricValue(key, value)}</div>
                    </div>
                  ))}
                </div>
              )}

              {(!equipmentData || !equipmentData.metrics) && !refreshing && (
                <div className="text-center p-6">
                  <p className="mb-4">No metrics data available for this system.</p>
                  <Button onClick={handleRefresh} className="mx-auto block">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh Data
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>System Information</CardTitle>
                <CardDescription>Details about this equipment</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-1">Equipment Details</h3>
                    <ul className="list-disc list-inside text-sm text-muted-foreground">
                      <li>Location ID: {locationId}</li>
                      <li>Location Name: {location?.name || locationName}</li>
                      <li>Equipment ID: {equipment?.id || equipmentId}</li>
                      <li>Equipment Name: {equipment?.name || equipmentId}</li>
                      <li>Equipment Type: {equipment?.type || "Unknown"}</li>
                      {equipment?.status && <li>Status: {equipment.status}</li>}
                      {equipmentData?.zone && <li>Zone: {equipmentData.zone}</li>}
                      {equipmentData?.source && <li>Source: {equipmentData.source}</li>}
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-medium mb-1">Last Update</h3>
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-2" />
                      <span>{equipmentData?.dateTime ? formatDate(equipmentData.dateTime) : "Unknown"}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Energy Usage</CardTitle>
                <CardDescription>Recent energy consumption stats</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Energy usage visualization will be implemented here.</p>
              </CardContent>
            </Card>
          </div>

          {equipmentData?.metrics && (
            <Card>
              <CardHeader>
                <CardTitle>Metrics by Category</CardTitle>
                <CardDescription>Grouped metrics for easier analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {Object.entries(groupMetrics(equipmentData.metrics)).map(([groupName, metrics]) => (
                    <div key={groupName}>
                      <h3 className="text-lg font-semibold mb-2">{groupName}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Object.entries(metrics).map(([metricName, metricValue]) => (
                          <div key={metricName} className="flex justify-between items-center border-b pb-2">
                            <div className="flex items-center">
                              <span className="text-sm font-medium">{metricName}</span>
                            </div>
                            <div className="flex items-center">
                              <span className="text-sm mr-2">{formatMetricValue(metricName, metricValue)}</span>
                              <div className={`w-2 h-2 rounded-full ${getStatusColor(metricValue, metricName)}`} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="controls" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>System Controls</CardTitle>
                  <CardDescription>Adjust system settings and send control commands</CardDescription>
                </div>
                <Button
                  onClick={saveControlValues}
                  disabled={savingControls}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {savingControls ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Controls
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>{renderControlComponent()}</CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Control History</CardTitle>
              <CardDescription>Recent control commands sent to this equipment</CardDescription>
            </CardHeader>
            <CardContent>
              {controlHistory.length > 0 ? (
                <div className="space-y-4">
                  {controlHistory.map((command, index) => (
                    <div key={index} className="border-b pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{command.command}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(command.timestamp)} • Source: {command.source}
                          </p>
                        </div>
                        <div
                          className={`px-2 py-1 rounded-full text-xs ${
                            command.status === "executed"
                              ? "bg-green-100 text-green-800"
                              : command.status === "failed"
                                ? "bg-red-100 text-red-800"
                                : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {command.status}
                        </div>
                      </div>
                      <div className="mt-2 text-sm">
                        <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                          {JSON.stringify(command.value, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">No control history available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Historical Data</CardTitle>
              <CardDescription>View historical performance</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Historical data charts will be implemented here.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Equipment Settings</CardTitle>
              <CardDescription>Configure equipment parameters</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Equipment settings form will be implemented here.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
