"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Settings, AlertCircle, Save, RefreshCw } from "lucide-react"
import { useFirebase } from "@/lib/firebase-context"
import { useToast } from "@/hooks/use-toast"
import { collection, doc, getDoc } from "firebase/firestore"
import { ref, onValue, set, update } from "firebase/database"
import { secondaryDb } from "@/lib/secondary-firebase"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

// Import control components
import { AirHandlerControls } from "@/components/equipment-controls/air-handler-controls"
import { FanCoilControls } from "@/components/equipment-controls/fan-coil-controls"
import { ChillerControls } from "@/components/equipment-controls/chiller-controls"
import { PumpControls } from "@/components/equipment-controls/pump-controls"
import { BoilerControls } from "@/components/equipment-controls/boiler-controls"
import { ExhaustFanControls } from "@/components/equipment-controls/exhaust-fan-controls"
import { ActuatorControls } from "@/components/equipment-controls/actuator-controls"
import { CoolingTowerControls } from "@/components/equipment-controls/cooling-tower-controls"
import { GreenhouseControls } from "@/components/equipment-controls/greenhouse-controls"
import { SteamBundleControls } from "@/components/equipment-controls/steam-bundle-controls"
import { DOASControls } from "@/components/equipment-controls/doas-controls"

export default function EquipmentTypeControls({ type, id }: { type?: string; id?: string }) {
  // Add explicit console log to verify component is being loaded
  console.log("EquipmentTypeControls component loaded", { type, id })

  const [equipmentData, setEquipmentData] = useState<any | null>(null)
  const [location, setLocation] = useState<any | null>(null)
  const [realtimeData, setRealtimeData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [controlValues, setControlValues] = useState<{ [key: string]: any }>({})
  const [savingControls, setSavingControls] = useState<boolean>(false)
  const [availableSystems, setAvailableSystems] = useState<{ id: string; name: string }[]>([])
  const [selectedSystem, setSelectedSystem] = useState<string | null>(null)
  const [locationKey, setLocationKey] = useState<string | null>(null)

  const { db } = useFirebase()
  const router = useRouter()
  const { toast } = useToast()
  const searchParams = useSearchParams()

  // Get locationId from URL query parameters or localStorage
  const locationIdFromUrl = searchParams.get("locationId")
  const [locationId, setLocationId] = useState<string | null>(null)

  // Add a state for available locations
  const [availableLocations, setAvailableLocations] = useState<any[]>([])

  // Initialize locationId from URL or localStorage
  useEffect(() => {
    console.log("Initializing locationId", { locationIdFromUrl })

    // First try URL parameter
    if (locationIdFromUrl) {
      console.log("Using locationId from URL:", locationIdFromUrl)
      setLocationId(locationIdFromUrl)

      // Update localStorage to match URL parameter
      localStorage.setItem("selectedLocation", locationIdFromUrl)
      return
    }

    // Then try localStorage
    const savedLocation = localStorage.getItem("selectedLocation")
    if (savedLocation) {
      console.log("Using locationId from localStorage:", savedLocation)
      setLocationId(savedLocation)
      return
    }

    // If we reach here, we need to fetch available locations from RTDB
    if (secondaryDb) {
      const locationsRef = ref(secondaryDb, "locations")
      onValue(
        locationsRef,
        (snapshot) => {
          const data = snapshot.val()
          if (data) {
            const locationsList = Object.keys(data).map((key) => ({
              id: data[key].id || key,
              key: key,
              name: data[key].name || key,
            }))
            setAvailableLocations(locationsList)
          }
        },
        (error) => {
          console.error("Error fetching locations:", error)
        },
      )
    }
  }, [locationIdFromUrl, secondaryDb])

  // Add a useEffect to handle equipment ID from URL
  useEffect(() => {
    const equipmentIdFromUrl = searchParams.get("equipmentId")

    if (equipmentIdFromUrl && locationId) {
      console.log(`Looking for equipment with id: ${equipmentIdFromUrl}`)
      // Only redirect if the current ID doesn't match the URL ID
      if (id !== equipmentIdFromUrl) {
        router.replace(`/dashboard/controls/equipment/${equipmentIdFromUrl}?locationId=${locationId}`)
      }
    }
  }, [searchParams, locationId, router, id])

  // Add a function to handle location selection
  const handleLocationSelect = (locId: string) => {
    console.log(`Location selected: ${locId}`)
    setLocationId(locId)
    localStorage.setItem("selectedLocation", locId)
  }

  // Add this function after handleLocationSelect
  const clearLocationSelection = () => {
    setLocationId(null)
    setSelectedSystem(null)
    localStorage.removeItem("selectedLocation")
    router.push("/dashboard/controls")
  }

  // Fetch location data and available systems from RTDB
  useEffect(() => {
    if (!secondaryDb) {
      console.log("Secondary DB not initialized")
      setLoading(false)
      setError("Realtime Database not initialized")
      return
    }

    if (!locationId) {
      console.log("No locationId available")
      setLoading(false)
      setError("Please select a location")
      return
    }

    setLoading(true)
    setError(null)
    console.log(`Fetching data for location ID: ${locationId}`)

    try {
      // Get all locations from RTDB
      const locationsRef = ref(secondaryDb, "locations")

      onValue(
        locationsRef,
        (snapshot) => {
          const data = snapshot.val()
          if (!data) {
            console.log("No locations found in RTDB")
            setLoading(false)
            setError("No locations found in Realtime Database")
            return
          }

          console.log("RTDB locations:", Object.keys(data))

          // Find location with matching ID
          let foundLocationData = null
          let foundLocationKey = null

          for (const [key, value] of Object.entries(data)) {
            const locationData = value as any
            if (locationData.id === locationId) {
              foundLocationData = locationData
              foundLocationKey = key
              break
            }
          }

          if (!foundLocationData) {
            console.log(`Location with ID ${locationId} not found in RTDB`)
            setLoading(false)
            setError(`Location with ID ${locationId} not found in Realtime Database`)
            return
          }

          console.log(`Found location in RTDB: ${foundLocationKey}`)
          setLocationKey(foundLocationKey)
          setLocation(foundLocationData)

          // Get available systems for this location
          if (foundLocationData.systems) {
            const systems = Object.entries(foundLocationData.systems).map(([key, value]) => ({
              id: key,
              name: key,
              ...(value as any),
            }))

            console.log(
              `Found ${systems.length} systems for location ${foundLocationKey}:`,
              systems.map((s) => s.name).join(", "),
            )

            setAvailableSystems(systems)

            // If id is provided, try to find it in the systems
            if (id) {
              console.log(`Looking for system with id: ${id}`)
              const matchingSystem = systems.find((s) => s.id === id || s.name.toLowerCase() === id.toLowerCase())

              if (matchingSystem) {
                console.log(`Found matching system for id ${id}: ${matchingSystem.name}`)
                setSelectedSystem(matchingSystem.id)

                // Also set the realtime data for this system
                setRealtimeData(foundLocationData.systems[matchingSystem.id])

                // Initialize control values if available
                if (foundLocationData.systems[matchingSystem.id].controls) {
                  setControlValues(foundLocationData.systems[matchingSystem.id].controls)
                }
              } else {
                console.log(`No matching system found for id ${id}`)
              }
            } else if (systems.length > 0) {
              // If no id provided, select the first system
              console.log(`No id provided, selecting first system: ${systems[0].name}`)
              setSelectedSystem(systems[0].id)
              setRealtimeData(foundLocationData.systems[systems[0].id])

              // Initialize control values if available
              if (foundLocationData.systems[systems[0].id].controls) {
                setControlValues(foundLocationData.systems[systems[0].id].controls)
              }
            }
          } else {
            console.log(`No systems found for location ${foundLocationKey}`)
          }

          setLoading(false)
        },
        (error) => {
          console.error("Error fetching RTDB data:", error)
          setLoading(false)
          setError("Failed to fetch data from Realtime Database")
        },
      )
    } catch (error) {
      console.error("Error setting up RTDB listener:", error)
      setLoading(false)
      setError("Failed to connect to Realtime Database")
    }
  }, [secondaryDb, locationId, id])

  // Fetch equipment data from Firestore if needed
  useEffect(() => {
    if (!db || !id) return

    const fetchEquipmentData = async () => {
      try {
        console.log(`Fetching equipment data from Firestore for id: ${id}`)
        const equipmentRef = doc(collection(db, "equipment"), id)
        const equipmentSnapshot = await getDoc(equipmentRef)

        if (equipmentSnapshot.exists()) {
          const data = { id: equipmentSnapshot.id, ...equipmentSnapshot.data() }
          console.log("Found equipment data in Firestore:", data)
          setEquipmentData(data)
        } else {
          console.log(`No equipment found in Firestore with id: ${id}`)
        }
      } catch (error) {
        console.error("Error fetching equipment data from Firestore:", error)
      }
    }

    fetchEquipmentData()
  }, [db, id])

  // Handle system selection change
  const handleSystemChange = (systemId: string) => {
    console.log(`System selection changed to: ${systemId}`)
    setSelectedSystem(systemId)

    // Update the URL to include the selected system ID
    if (locationId) {
      router.replace(`/dashboard/controls/equipment/${systemId}?locationId=${locationId}`, { scroll: false })
    }

    if (location?.systems && location.systems[systemId]) {
      setRealtimeData(location.systems[systemId])

      // Initialize control values if available
      if (location.systems[systemId].controls) {
        setControlValues(location.systems[systemId].controls)
      } else {
        setControlValues({})
      }
    }
  }

  // Handle control value changes
  const handleControlChange = (key: string, value: any) => {
    console.log(`Control value changed: ${key} = ${value}`)
    setControlValues((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  // Save control values to RTDB
  const saveControlValues = async () => {
    if (!secondaryDb || !locationKey || !selectedSystem) {
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
      const controlsPath = `locations/${locationKey}/systems/${selectedSystem}/controls`
      console.log(`Saving controls to path: ${controlsPath}`, controlValues)
      const controlsRef = ref(secondaryDb, controlsPath)

      // Update controls
      await update(controlsRef, controlValues)

      // Add to control history
      const historyRef = ref(secondaryDb, `control_history/${locationKey}/${selectedSystem}/${Date.now()}`)

      const command = {
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
      })
    } catch (error) {
      console.error("Error saving control values:", error)
      toast({
        title: "Error",
        description: `Failed to save control values: ${error.message}`,
        variant: "destructive",
      })
    } finally {
      setSavingControls(false)
    }
  }

  // Determine equipment type from selected system
  const getEquipmentType = () => {
    // First try from props
    if (type) {
      console.log(`Using equipment type from props: ${type}`)
      return type
    }

    // Then try from Firestore data
    if (equipmentData?.type) {
      console.log(`Using equipment type from Firestore: ${equipmentData.type}`)
      return equipmentData.type
    }

    // Then try to infer from system name
    if (selectedSystem) {
      const systemName = selectedSystem.toLowerCase()

      if (systemName.includes("ahu") || systemName.includes("air handler")) return "air handler"
      if (systemName.includes("chiller")) return "chiller"
      if (systemName.includes("boiler")) return "boiler"
      if (systemName.includes("pump")) return "pump"
      if (systemName.includes("fan")) return "fan"
      if (systemName.includes("tower")) return "cooling tower"
      if (systemName.includes("doas")) return "doas"
      if (systemName.includes("vav")) return "vav"
      if (systemName.includes("rtu")) return "rtu"

      console.log(`Inferred equipment type from system name: ${systemName}`)
    }

    // Default
    console.log("Using default equipment type: unknown")
    return "unknown"
  }

  // Render the appropriate control component based on equipment type
  const renderControlComponent = () => {
    if (!selectedSystem || !realtimeData) {
      return (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Select a system to view controls</p>
          </CardContent>
        </Card>
      )
    }

    // Get the equipment type
    const equipmentType = getEquipmentType().toLowerCase()
    console.log(`Rendering control component for type: ${equipmentType}`)

    // Create the equipment object with the structure expected by the control components
    const equipmentData = {
      id: selectedSystem,
      name: selectedSystem,
      type: equipmentType,
      controls: controlValues, // This is the key property needed by the components
      metrics: realtimeData.metrics || {},
    }

    // Return the appropriate component based on type
    if (equipmentType.includes("air handler") || equipmentType.includes("ahu")) {
      return <AirHandlerControls equipment={equipmentData} />
    } else if (equipmentType.includes("doas")) {
      return <DOASControls equipment={equipmentData} />
    } else if (equipmentType.includes("fan coil")) {
      return <FanCoilControls equipment={equipmentData} />
    } else if (equipmentType.includes("chiller")) {
      return <ChillerControls equipment={equipmentData} />
    } else if (equipmentType.includes("pump")) {
      return <PumpControls equipment={equipmentData} />
    } else if (equipmentType.includes("boiler")) {
      return <BoilerControls equipment={equipmentData} />
    } else if (equipmentType.includes("exhaust fan") || equipmentType.includes("fan")) {
      return <ExhaustFanControls equipment={equipmentData} />
    } else if (equipmentType.includes("actuator")) {
      return <ActuatorControls equipment={equipmentData} />
    } else if (equipmentType.includes("cooling tower")) {
      return <CoolingTowerControls equipment={equipmentData} />
    } else if (equipmentType.includes("greenhouse")) {
      return <GreenhouseControls equipment={equipmentData} />
    } else if (equipmentType.includes("steam")) {
      return <SteamBundleControls equipment={equipmentData} />
    } else {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Generic Controls</CardTitle>
            <CardDescription>
              Specific controls for {selectedSystem} ({equipmentType}) are not available. Using generic controls
              instead.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {realtimeData.metrics &&
                Object.entries(realtimeData.metrics).map(([key, value]) => (
                  <div key={key} className="flex justify-between items-center p-2 border-b">
                    <span className="font-medium">{key}</span>
                    <span>{value?.toString()}</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-[250px]" />
          <Skeleton className="h-10 w-[120px]" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-[180px]" />
            <Skeleton className="h-4 w-[250px]" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Failed to load equipment controls</AlertTitle>
            <AlertDescription>
              {error}
              <Button variant="outline" className="mt-2" onClick={() => router.push("/dashboard")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Return to Dashboard
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  // Modify the render method to show location selection UI when no locationId is provided
  // Replace the error return when no locationId is available with this:
  if (!locationId && availableLocations.length > 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="mr-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">Equipment Controls</h1>
        </div>
        <Button variant="outline" onClick={() => router.push("/dashboard/settings")} className="hover:bg-[#e6f3f1]">
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Select Location</CardTitle>
            <CardDescription>Choose a location to view equipment controls</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {availableLocations.map((loc) => (
                <Card
                  key={loc.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleLocationSelect(loc.id)}
                >
                  <CardHeader className="p-4">
                    <CardTitle className="text-lg">{loc.name}</CardTitle>
                    <CardDescription>{loc.address || "No address"}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="mr-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">Equipment Controls</h1>
        </div>
        <Button variant="outline" onClick={() => router.push("/dashboard/settings")} className="hover:bg-[#e6f3f1]">
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System Selection</CardTitle>
          <CardDescription>
            Select a system from {location?.name || "this location"} to view and modify controls
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="system-select" className="text-sm font-medium">
              Available Systems
            </label>
            <Select
              value={selectedSystem || ""}
              onValueChange={handleSystemChange}
              disabled={availableSystems.length === 0}
            >
              <SelectTrigger id="system-select" className="w-full">
                <SelectValue placeholder={availableSystems.length === 0 ? "No systems available" : "Select a system"} />
              </SelectTrigger>
              <SelectContent>
                {availableSystems.map((system) => (
                  <SelectItem key={system.id} value={system.id}>
                    {system.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedSystem && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{selectedSystem}</CardTitle>
                <CardDescription>
                  Location: {location?.name || locationKey || "Unknown"}
                  {realtimeData?.dateTime && ` • Last updated: ${new Date(realtimeData.dateTime).toLocaleString()}`}
                </CardDescription>
              </div>
              <Button onClick={saveControlValues} disabled={savingControls} className="bg-green-600 hover:bg-green-700">
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
            </CardHeader>
          </Card>

          {renderControlComponent()}
        </>
      )}

      {!selectedSystem && availableSystems.length > 0 && (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground mb-4">
              Please select a system from the dropdown above to view controls
            </p>
          </CardContent>
        </Card>
      )}

      {availableSystems.length === 0 && !loading && (
        <Card>
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
            <h3 className="text-lg font-medium mb-2">No Systems Available</h3>
            <p className="text-muted-foreground mb-4">
              No systems were found for this location in the Realtime Database.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
