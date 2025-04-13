"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Settings, AlertTriangle, Thermometer, Target, ArrowUpDown, RefreshCw, Loader2 } from "lucide-react"
import { useFirebase } from "@/lib/firebase-context"
import { ref, onValue, off } from "firebase/database"
import { secondaryDb } from "@/lib/secondary-firebase" // Import the RTDB directly
import { getApps } from "firebase/app"
import { useAuth } from "@/lib/auth-context" // Add this import for user role checking

export default function AnalyticsContent() {
    const router = useRouter()
    const { db } = useFirebase() // Only get Firestore from context
    const rtdb = secondaryDb // Use the directly imported RTDB
    const searchParams = useSearchParams()
    const { user } = useAuth() // Get current user

    // Add refs to prevent excessive refreshing and event handlers
    const metricsListenerRef = useRef<any>(null);
    const equipmentListenerRef = useRef<any>(null);
    const locationsListenerRef = useRef<any>(null);

    // Check if user has admin or DevOps privileges
    const isAdminOrDevOps = useMemo(() => {
        return user?.roles && (user.roles.includes("admin") || user.roles.includes("DevOps"));
    }, [user]);

    // State for Firebase initialization
    const [firebaseInitialized, setFirebaseInitialized] = useState(false)
    const [firebaseError, setFirebaseError] = useState<string | null>(null)

    // Check Firebase initialization
    useEffect(() => {
        try {
            // Check if Firebase is initialized
            const apps = getApps()
            if (apps.length === 0) {
                setFirebaseError("Firebase is not initialized. Please refresh the page or contact support.")
            } else {
                setFirebaseInitialized(true)
            }
        } catch (error) {
            console.error("Error checking Firebase initialization:", error)
            setFirebaseError("Error initializing Firebase. Please refresh the page or contact support.")
        }
    }, [])

    // State
    const [locations, setLocations] = useState<any[]>([])
    const [selectedLocation, setSelectedLocation] = useState<string>("")
    const [equipment, setEquipment] = useState<any[]>([])
    const [selectedEquipment, setSelectedEquipment] = useState<string>("")
    const [userSelectedEquipment, setUserSelectedEquipment] = useState<string>("");
    const [metrics, setMetrics] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [timeRange, setTimeRange] = useState("24h")
    const [refreshing, setRefreshing] = useState(false)
    const [historicalData, setHistoricalData] = useState<any>({})
    // Add mapping between Firestore locationId and RTDB location key
    const [locationKeyMapping, setLocationKeyMapping] = useState<Record<string, string>>({})
    // Track the equipment type for temperature range adjustment
    const [currentEquipmentType, setCurrentEquipmentType] = useState<string>("")

    // Initialize states from localStorage or URL
    useEffect(() => {
        if (typeof window !== "undefined") {
            // First try to get equipment ID from localStorage if user had a previous selection
            const savedEquipment = localStorage.getItem("selectedEquipment")

            if (savedEquipment) {
                console.log("Found saved equipment selection:", savedEquipment)
                setUserSelectedEquipment(savedEquipment)
                setSelectedEquipment(savedEquipment)
            }
        }
    }, [])

    // Initialize locationId from URL parameter
    useEffect(() => {
        const locationIdFromUrl = searchParams.get("locationId")
        console.log("Using locationId from URL:", locationIdFromUrl)

        if (locationIdFromUrl) {
            // Check if user has permission to access this location
            if (isAdminOrDevOps || (user?.assignedLocations && user.assignedLocations.includes(locationIdFromUrl))) {
                console.log("Setting selected location from URL:", locationIdFromUrl)
                setSelectedLocation(locationIdFromUrl)
                localStorage.setItem("selectedLocation", locationIdFromUrl)
            } else {
                console.warn("User does not have access to location:", locationIdFromUrl)
                setError("You don't have permission to access this location")

                // If user has assigned locations, redirect to their first location
                if (user?.assignedLocations && user.assignedLocations.length > 0) {
                    const userLocation = user.assignedLocations[0]
                    console.log("Redirecting to user's assigned location:", userLocation)
                    router.replace(`/dashboard/analytics?locationId=${userLocation}`)
                } else {
                    // If no assigned locations, redirect to login
                    console.log("User has no permitted locations, redirecting to login")
                    router.replace("/login")
                }
            }
        }
        // For regular users with assigned locations but no URL parameter
        else if (!isAdminOrDevOps && user?.assignedLocations && user.assignedLocations.length > 0) {
            const userLocation = user.assignedLocations[0]
            console.log("Regular user with assigned location:", userLocation)
            setSelectedLocation(userLocation)
            localStorage.setItem("selectedLocation", userLocation)

            // Update URL without full page reload
            router.replace(`/dashboard/analytics?locationId=${userLocation}`, { scroll: false })
        }
        // For admins with no locationId, try localStorage
        else if (isAdminOrDevOps) {
            const savedLocation = localStorage.getItem("selectedLocation")
            if (savedLocation) {
                setSelectedLocation(savedLocation)
            }
        } else {
            // If user has no assigned locations and is not admin/DevOps, redirect to login
            console.log("User has no assigned locations, redirecting to login")
            router.replace("/login")
        }
    }, [searchParams, user, isAdminOrDevOps, router])

    // Add this check before the first useEffect
    const renderErrorAlert = firebaseError ? (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Analytics</h1>
                {isAdminOrDevOps && (
                    <Button variant="outline" onClick={() => router.push("/dashboard/settings")} className="hover:bg-[#e6f3f1]">
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                    </Button>
                )}
            </div>
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Firebase Error</AlertTitle>
                <AlertDescription>{firebaseError}</AlertDescription>
            </Alert>
            <Button onClick={() => window.location.reload()}>Refresh Page</Button>
        </div>
    ) : null

    // Fetch locations from RTDB - update this useEffect to check for rtdb and firebaseInitialized
    useEffect(() => {
        if (!rtdb || !firebaseInitialized || !user) return

        // Cleanup previous listener if it exists
        if (locationsListenerRef.current) {
            off(locationsListenerRef.current);
        }

        setLoading(true)
        setError(null)

        console.log("Fetching locations from RTDB")

        const locationsRef = ref(rtdb, "/locations")
        locationsListenerRef.current = locationsRef; // Store ref for cleanup

        const handleData = (snapshot: any) => {
            try {
                const data = snapshot.val()
                if (!data) {
                    console.log("No locations found in RTDB")
                    setLocations([])
                    setError("No locations found")
                    setLoading(false)
                    return
                }

                // Convert to array of objects with id and name and build mapping
                const mapping: Record<string, string> = {}
                const locationsArray = Object.entries(data).map(([key, location]: [string, any]) => {
                    // Store mapping between Firestore ID and RTDB key
                    if (location.id) {
                        mapping[location.id] = key
                    }

                    return {
                        id: key,
                        rtdbKey: key,
                        name: location.name || key,
                        firebaseId: location.id || null,
                        ...location
                    }
                })

                setLocationKeyMapping(mapping)
                console.log("Found locations:", locationsArray.length)

                // Filter locations based on user permissions
                let filteredLocations = locationsArray
                if (!isAdminOrDevOps && user?.assignedLocations) {
                    filteredLocations = locationsArray.filter(location =>
                        user.assignedLocations.includes(location.id)
                    )
                    console.log("Filtered to user's assigned locations:", filteredLocations.length)
                }

                setLocations(filteredLocations)

                // Auto-select first location if available
                if (filteredLocations.length > 0 && !selectedLocation) {
                    setSelectedLocation(filteredLocations[0].id)
                    localStorage.setItem("selectedLocation", filteredLocations[0].id)
                }

                setLoading(false)
            } catch (err) {
                console.error("Error processing locations data:", err)
                setError("Error loading locations data")
                setLoading(false)
            }
        }

        const handleError = (err: any) => {
            console.error("Error fetching locations:", err)
            setError("Error loading locations data")
            setLoading(false)
        }

        onValue(locationsRef, handleData, handleError)

        return () => {
            // Clean up listener
            if (locationsListenerRef.current) {
                off(locationsListenerRef.current)
            }
        }
    }, [rtdb, firebaseInitialized, user, isAdminOrDevOps])

    // Fetch equipment for the selected location
    useEffect(() => {
        if (!selectedLocation || !rtdb || !firebaseInitialized) return

        // Cleanup previous listener
        if (equipmentListenerRef.current) {
            off(equipmentListenerRef.current);
        }

        setLoading(true)
        setError(null)
        setMetrics(null)

        console.log("Fetching equipment for location:", selectedLocation)

        // Find the RTDB location key using the mapping
        const locationKey = locationKeyMapping[selectedLocation] || selectedLocation
        if (!locationKey) {
            console.log(`No RTDB key found for location ID ${selectedLocation}. Using direct ID.`)
        }

        // Get systems/equipment from RTDB
        const locationRef = ref(rtdb, `/locations/${locationKey}/systems`)
        equipmentListenerRef.current = locationRef; // Store ref for cleanup

        const handleData = (snapshot: any) => {
            try {
                const data = snapshot.val()
                if (!data) {
                    console.log("No systems found for location:", selectedLocation)
                    setEquipment([])
                    setError("No equipment found for this location")
                    setLoading(false)
                    return
                }

                // Convert to array of objects with id and name
                const equipmentArray = Object.entries(data).map(([id, system]: [string, any]) => ({
                    id,
                    name: system.name || id,
                    type: system.type || getEquipmentTypeFromName(system.name || id)
                }))

                console.log("Found equipment:", equipmentArray.length)
                setEquipment(equipmentArray)

                // Check if we have a user selection that's still valid in the new equipment list
                if (userSelectedEquipment && equipmentArray.some(eq => eq.id === userSelectedEquipment)) {
                    console.log("Restoring user's equipment selection:", userSelectedEquipment)
                    setSelectedEquipment(userSelectedEquipment)

                    // Set the equipment type for temperature range
                    const selectedEq = equipmentArray.find(eq => eq.id === userSelectedEquipment);
                    if (selectedEq) {
                        setCurrentEquipmentType(selectedEq.type || selectedEq.name || "");
                    }
                }
                // Or if there's a previously saved equipment selection that's valid
                else if (selectedEquipment && equipmentArray.some(eq => eq.id === selectedEquipment)) {
                    console.log("Keeping current equipment selection:", selectedEquipment)
                    // Keep the current selection

                    // Set the equipment type for temperature range
                    const selectedEq = equipmentArray.find(eq => eq.id === selectedEquipment);
                    if (selectedEq) {
                        setCurrentEquipmentType(selectedEq.type || selectedEq.name || "");
                    }
                }
                // Otherwise, select the first equipment
                else if (equipmentArray.length > 0) {
                    console.log("Auto-selecting first equipment:", equipmentArray[0].id)
                    setSelectedEquipment(equipmentArray[0].id)

                    // Set the equipment type for temperature range
                    setCurrentEquipmentType(equipmentArray[0].type || equipmentArray[0].name || "");
                } else {
                    setError("No equipment found for this location")
                }

                setLoading(false)
            } catch (err) {
                console.error("Error processing equipment data:", err)
                setError("Error loading equipment data")
                setLoading(false)
            }
        }

        const handleError = (err: any) => {
            console.error("Error fetching equipment:", err)
            setError("Error loading equipment data")
            setLoading(false)
        }

        onValue(locationRef, handleData, handleError)

        return () => {
            // Clean up listener
            if (equipmentListenerRef.current) {
                off(equipmentListenerRef.current)
            }
        }
    }, [selectedLocation, rtdb, firebaseInitialized, locationKeyMapping])

    // Try to determine equipment type from name if not provided
    const getEquipmentTypeFromName = (name: string): string => {
        const lowerName = name.toLowerCase();

        if (lowerName.includes('chiller')) return 'chiller';
        if (lowerName.includes('ahu') || lowerName.includes('air handler')) return 'air handler';
        if (lowerName.includes('boiler')) return 'boiler';
        if (lowerName.includes('cooling')) return 'cooling';
        if (lowerName.includes('pump')) return 'pump';

        return '';
    }

    // Fetch metrics for the selected equipment
    useEffect(() => {
        if (!selectedLocation || !selectedEquipment || !rtdb || !firebaseInitialized) return

        // Cleanup previous listener
        if (metricsListenerRef.current) {
            off(metricsListenerRef.current);
        }

        setLoading(true)
        setError(null)

        // Store the current selection to use in the closure
        const currentEquipmentId = selectedEquipment;

        // Find the RTDB location key using the mapping
        const locationKey = locationKeyMapping[selectedLocation] || selectedLocation

        console.log("Fetching metrics for equipment:", currentEquipmentId, "at location:", locationKey)

        // Get metrics from RTDB
        const metricsRef = ref(rtdb, `/locations/${locationKey}/systems/${currentEquipmentId}/metrics`)
        metricsListenerRef.current = metricsRef; // Store ref for cleanup

        const handleData = (snapshot: any) => {
            try {
                const data = snapshot.val()
                if (!data) {
                    console.log("No metrics found for equipment:", currentEquipmentId)
                    setMetrics(null)
                    setError("No metrics found for this equipment")
                    setLoading(false)
                    return
                }

                // Only update if the selected equipment hasn't changed
                if (selectedEquipment === currentEquipmentId) {
                    console.log("Found metrics:", Object.keys(data).length)
                    setMetrics(data)

                    // Generate historical data for charts
                    generateHistoricalData(data)
                }

                setLoading(false)
            } catch (err) {
                console.error("Error processing metrics data:", err)
                setError("Error loading metrics data")
                setLoading(false)
            }
        }

        const handleError = (err: any) => {
            console.error("Error fetching metrics:", err)
            setError("Error loading metrics data")
            setLoading(false)
        }

        onValue(metricsRef, handleData, handleError)

        return () => {
            // Clean up listener
            if (metricsListenerRef.current) {
                off(metricsListenerRef.current)
            }
        }
    }, [selectedLocation, selectedEquipment, rtdb, firebaseInitialized, locationKeyMapping])

    // Generate mock historical data for charts
    const generateHistoricalData = (currentMetrics: any) => {
        const history: any = {}

        // For each numeric metric, generate historical data
        Object.entries(currentMetrics).forEach(([metricName, currentValue]) => {
            if (typeof currentValue === "number") {
                const data = []
                const now = Date.now()

                // Generate 24 data points (one per hour)
                for (let i = 24; i >= 0; i--) {
                    const timestamp = now - i * 60 * 60 * 1000

                    // Add some random variation to the value
                    const randomVariation = (Math.random() - 0.5) * 5
                    const value = Math.max(0, (currentValue as number) + randomVariation)

                    data.push({
                        timestamp,
                        value: Number.parseFloat(value.toFixed(1)),
                    })
                }

                history[metricName] = data
            }
        })

        setHistoricalData(history)
    }

    // When user manually selects equipment, track it in this state
    const handleEquipmentChange = (equipmentId: string) => {
        console.log(`User manually selected equipment: ${equipmentId}`)
        setSelectedEquipment(equipmentId)
        setUserSelectedEquipment(equipmentId)
        localStorage.setItem("selectedEquipment", equipmentId)

        // Set equipment type for temperature range
        const selectedEq = equipment.find(eq => eq.id === equipmentId);
        if (selectedEq) {
            setCurrentEquipmentType(selectedEq.type || selectedEq.name || "");
        }
    }

    // Function to refresh data
    const refreshData = () => {
        setRefreshing(true)

        // Find the RTDB location key using the mapping
        const locationKey = locationKeyMapping[selectedLocation] || selectedLocation

        // Re-fetch metrics
        if (selectedLocation && selectedEquipment && rtdb) {
            const metricsRef = ref(rtdb, `/locations/${locationKey}/systems/${selectedEquipment}/metrics`)

            onValue(
                metricsRef,
                (snapshot) => {
                    const data = snapshot.val()
                    setMetrics(data)
                    generateHistoricalData(data)
                    setRefreshing(false)
                    // Immediately detach the listener after getting the data
                    off(metricsRef)
                },
                (error) => {
                    console.error("Error refreshing metrics:", error)
                    setRefreshing(false)
                    // Immediately detach the listener after error
                    off(metricsRef)
                },
                { onlyOnce: true },
            )
        } else {
            setRefreshing(false)
        }
    }

    // Format timestamp for chart display in Eastern Time
    const formatTimestampEST = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: 'America/New_York'
        });
    }

    // Helper function to check if specific metrics exist
    const hasTemperatureMetrics = useMemo(() => {
        if (!metrics) return false

        // Check for supply/return temperature metrics
        const metricKeys = Object.keys(metrics).map((key) => key.toLowerCase())
        return metricKeys.some(
            (key) => key.includes("temp") || key.includes("temperature") || key.includes("supply") || key.includes("return"),
        )
    }, [metrics])

    const hasSetpointMetrics = useMemo(() => {
        if (!metrics) return false

        // Check for setpoint/target temperature metrics
        const metricKeys = Object.keys(metrics).map((key) => key.toLowerCase())
        return metricKeys.some((key) => key.includes("setpoint") || key.includes("target") || key.includes("set point"))
    }, [metrics])

    // Determine temperature range based on equipment type
    const getTemperatureRange = () => {
        const equipmentType = currentEquipmentType.toLowerCase();

        if (equipmentType.includes("chiller") || equipmentType.includes("cooling")) {
            return { min: 32, max: 92 }; // Cooling equipment uses lower temperature range
        } else if (equipmentType.includes("boiler") || equipmentType.includes("heating")) {
            return { min: 120, max: 200 }; // Heating equipment uses higher temperature range
        } else {
            // Default range for air handlers and other equipment
            return { min: 50, max: 170 };
        }
    }

    // Get temperature labels for Y-axis
    const getTemperatureLabels = () => {
        const range = getTemperatureRange();
        const step = (range.max - range.min) / 4;
        return [
            range.max,
            Math.round(range.max - step),
            Math.round(range.max - 2 * step),
            Math.round(range.max - 3 * step),
            range.min
        ];
    }

    // Find the appropriate metrics for each chart type
    const getTemperatureMetrics = () => {
        if (!metrics) return null

        const result: any = {}

        // Look for supply temperature
        const supplyKeys = Object.keys(metrics).filter(
            (key) =>
                key.toLowerCase().includes("supply") &&
                (key.toLowerCase().includes("temp") || key.toLowerCase().includes("temperature")),
        )

        if (supplyKeys.length > 0) {
            result.supply = {
                name: supplyKeys[0],
                value: metrics[supplyKeys[0]],
                data: historicalData[supplyKeys[0]] || [],
            }
        }

        // Look for return temperature
        const returnKeys = Object.keys(metrics).filter(
            (key) =>
                key.toLowerCase().includes("return") &&
                (key.toLowerCase().includes("temp") || key.toLowerCase().includes("temperature")),
        )

        if (returnKeys.length > 0) {
            result.return = {
                name: returnKeys[0],
                value: metrics[returnKeys[0]],
                data: historicalData[returnKeys[0]] || [],
            }
        }

        // If we didn't find specific supply/return, look for any temperature
        if (Object.keys(result).length === 0) {
            const tempKeys = Object.keys(metrics).filter(
                (key) => key.toLowerCase().includes("temp") || key.toLowerCase().includes("temperature"),
            )

            if (tempKeys.length > 0) {
                result.temperature = {
                    name: tempKeys[0],
                    value: metrics[tempKeys[0]],
                    data: historicalData[tempKeys[0]] || [],
                }
            }
        }

        return Object.keys(result).length > 0 ? result : null
    }

    const getSetpointMetrics = () => {
        if (!metrics) return null

        const result: any = {}

        // Look for setpoint
        const setpointKeys = Object.keys(metrics).filter(
            (key) => key.toLowerCase().includes("setpoint") || key.toLowerCase().includes("set point"),
        )

        if (setpointKeys.length > 0) {
            result.setpoint = {
                name: setpointKeys[0],
                value: metrics[setpointKeys[0]],
                data: historicalData[setpointKeys[0]] || [],
            }
        }

        // Look for target temperature
        const targetKeys = Object.keys(metrics).filter((key) => key.toLowerCase().includes("target"))

        if (targetKeys.length > 0) {
            result.target = {
                name: targetKeys[0],
                value: metrics[targetKeys[0]],
                data: historicalData[targetKeys[0]] || [],
            }
        }

        return Object.keys(result).length > 0 ? result : null
    }

    // Get temperature and setpoint data together for combined chart
    const getTemperatureAndSetpointData = () => {
        const tempMetrics = getTemperatureMetrics()
        const setpointMetrics = getSetpointMetrics()

        if (!tempMetrics) return null

        // Prioritize supply temperature over other temperature metrics
        const tempMetric = tempMetrics.supply || tempMetrics.temperature || tempMetrics.return

        // If we have both temperature and setpoint, return them together
        if (setpointMetrics && tempMetric) {
            const setpointMetric = setpointMetrics.setpoint || setpointMetrics.target

            return {
                temperature: tempMetric,
                setpoint: setpointMetric,
            }
        }

        return null
    }

    // Prepare data for charts
    const prepareSupplyReturnData = () => {
        const tempMetrics = getTemperatureMetrics()
        if (!tempMetrics?.supply || !tempMetrics?.return) return []

        // Create combined data points
        return tempMetrics.supply.data.map((supplyPoint: any, index: number) => {
            const returnPoint = tempMetrics.return.data[index] || { value: 0 }
            return {
                timestamp: supplyPoint.timestamp,
                supply: supplyPoint.value,
                return: returnPoint.value,
            }
        })
    }

    const prepareTemperatureSetpointData = () => {
        const combined = getTemperatureAndSetpointData()
        if (!combined) return []

        // Create combined data points
        return combined.temperature.data.map((tempPoint: any, index: number) => {
            const setpointPoint = combined.setpoint.data[index] || { value: 0 }
            return {
                timestamp: tempPoint.timestamp,
                temperature: tempPoint.value,
                setpoint: setpointPoint.value,
            }
        })
    }

    // Get current location name
    const getLocationName = () => {
        if (!selectedLocation) return "Unknown Location"

        const location = locations.find(loc => loc.id === selectedLocation)
        return location ? location.name : selectedLocation
    }

    // Get time labels for X-axis in EST
    const getTimeLabelsEST = () => {
        return ['12 AM', '6 AM', '12 PM', '6 PM', '12 AM'];
    }

    return (
        <div className="space-y-6">
            {renderErrorAlert ? (
                renderErrorAlert
            ) : (
                <>
                    <div className="flex items-center justify-between">
                        <h1 className="text-3xl font-bold">Analytics</h1>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={refreshData}
                                disabled={refreshing || loading || !selectedEquipment}
                                className="hover:bg-[#e6f3f1]"
                            >
                                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            </Button>
                            {isAdminOrDevOps && (
                                <Button
                                    variant="outline"
                                    onClick={() => router.push("/dashboard/settings")}
                                    className="hover:bg-[#e6f3f1]"
                                >
                                    <Settings className="mr-2 h-4 w-4" />
                                    Settings
                                </Button>
                            )}
                        </div>
                    </div>

                    {!selectedLocation ? (
                        <Alert>
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>No location selected</AlertTitle>
                            <AlertDescription>Please select a location to view analytics.</AlertDescription>
                        </Alert>
                    ) : (
                        <>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Equipment Analytics</CardTitle>
                                    <CardDescription>View and analyze equipment performance data.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                                        {/* Location Selection - Only allow selection for admin/DevOps, 
                        otherwise just show selected location */}
                                        <div className="w-full md:w-1/3">
                                            <label className="text-sm font-medium mb-2 block">
                                                {isAdminOrDevOps ? "Select Location" : "Location"}
                                            </label>
                                            {isAdminOrDevOps ? (
                                                <Select
                                                    value={selectedLocation}
                                                    onValueChange={(value) => {
                                                        setSelectedLocation(value)
                                                        localStorage.setItem("selectedLocation", value)
                                                        // Clear selected equipment when location changes
                                                        setSelectedEquipment("")
                                                        setUserSelectedEquipment("")
                                                        localStorage.removeItem("selectedEquipment")
                                                        // Update URL without page reload
                                                        router.replace(`/dashboard/analytics?locationId=${value}`, { scroll: false })
                                                    }}
                                                    disabled={loading || locations.length === 0}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select location..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {locations.map((item) => (
                                                            <SelectItem key={item.id} value={item.id}>
                                                                {item.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <div className="p-2 bg-gray-100 rounded-md border border-gray-200">
                                                    <p className="font-medium">{getLocationName()}</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="w-full md:w-1/3">
                                            <label className="text-sm font-medium mb-2 block">Select Equipment</label>
                                            <Select
                                                value={selectedEquipment}
                                                onValueChange={handleEquipmentChange}
                                                disabled={loading || equipment.length === 0}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select equipment..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {equipment.map((item) => (
                                                        <SelectItem key={item.id} value={item.id}>
                                                            {item.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="w-full md:w-1/3">
                                            <label className="text-sm font-medium mb-2 block">Time Range</label>
                                            <Select value={timeRange} onValueChange={setTimeRange} disabled={loading || !metrics}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select time range..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="24h">Last 24 Hours</SelectItem>
                                                    <SelectItem value="7d">Last 7 Days</SelectItem>
                                                    <SelectItem value="30d">Last 30 Days</SelectItem>
                                                    <SelectItem value="1y">Last Year</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {loading ? (
                                        <div className="flex items-center justify-center h-64">
                                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                        </div>
                                    ) : error ? (
                                        <Alert variant="destructive">
                                            <AlertTriangle className="h-4 w-4" />
                                            <AlertTitle>Error</AlertTitle>
                                            <AlertDescription>{error}</AlertDescription>
                                        </Alert>
                                    ) : !metrics ? (
                                        <Alert>
                                            <AlertTriangle className="h-4 w-4" />
                                            <AlertTitle>No metrics available</AlertTitle>
                                            <AlertDescription>No metrics data found for the selected equipment.</AlertDescription>
                                        </Alert>
                                    ) : (
                                        <div className="space-y-8">
                                            {/* Supply/Return Temperature Chart */}
                                            {getTemperatureMetrics()?.supply && getTemperatureMetrics()?.return && (
                                                <Card>
                                                    <CardHeader className="pb-2">
                                                        <div className="flex items-center">
                                                            <Thermometer className="h-5 w-5 mr-2 text-blue-500" />
                                                            <CardTitle className="text-lg">Supply & Return Temperatures</CardTitle>
                                                        </div>
                                                    </CardHeader>
                                                    <CardContent>
                                                        {/* Enhanced SVG Chart for Supply & Return */}
                                                        <div className="relative h-[300px] w-full mb-6">
                                                            {/* Y-axis */}
                                                            <div className="absolute left-0 top-0 bottom-0 w-12 flex flex-col justify-between text-xs text-gray-500 pr-2 border-r border-gray-200">
                                                                {getTemperatureLabels().map((label, index) => (
                                                                    <span key={index}>{label}°F</span>
                                                                ))}
                                                            </div>

                                                            {/* Chart area */}
                                                            <div className="absolute left-12 right-0 top-0 bottom-8 bg-gray-50/50 border border-gray-200 rounded">
                                                                {/* Grid lines */}
                                                                <div className="absolute inset-0 grid grid-cols-1 grid-rows-4">
                                                                    <div className="border-b border-gray-200"></div>
                                                                    <div className="border-b border-gray-200"></div>
                                                                    <div className="border-b border-gray-200"></div>
                                                                    <div className="border-b border-gray-200"></div>
                                                                </div>

                                                                {/* SVG Chart */}
                                                                <svg className="absolute inset-0 w-full h-full">
                                                                    {/* Supply Temperature Line */}
                                                                    <polyline
                                                                        points={prepareSupplyReturnData().map((item, index, arr) => {
                                                                            const x = (index / (arr.length - 1)) * 100
                                                                            // Scale based on dynamic temperature range
                                                                            const range = getTemperatureRange();
                                                                            const min = range.min;
                                                                            const max = range.max;
                                                                            const y = 100 - ((item.supply - min) / (max - min)) * 100
                                                                            return `${x}%,${y}%`
                                                                        }).join(' ')}
                                                                        fill="none"
                                                                        stroke="#0088FE"
                                                                        strokeWidth="3"
                                                                    />

                                                                    {/* Return Temperature Line */}
                                                                    <polyline
                                                                        points={prepareSupplyReturnData().map((item, index, arr) => {
                                                                            const x = (index / (arr.length - 1)) * 100
                                                                            // Scale based on dynamic temperature range
                                                                            const range = getTemperatureRange();
                                                                            const min = range.min;
                                                                            const max = range.max;
                                                                            const y = 100 - ((item.return - min) / (max - min)) * 100
                                                                            return `${x}%,${y}%`
                                                                        }).join(' ')}
                                                                        fill="none"
                                                                        stroke="#FF8042"
                                                                        strokeWidth="3"
                                                                        strokeDasharray="5,5"
                                                                    />

                                                                    {/* Data points for Supply */}
                                                                    {prepareSupplyReturnData().map((item, index, arr) => {
                                                                        const x = (index / (arr.length - 1)) * 100
                                                                        // Scale based on dynamic temperature range
                                                                        const range = getTemperatureRange();
                                                                        const min = range.min;
                                                                        const max = range.max;
                                                                        const y = 100 - ((item.supply - min) / (max - min)) * 100
                                                                        return (
                                                                            <circle
                                                                                key={`supply-${index}`}
                                                                                cx={`${x}%`}
                                                                                cy={`${y}%`}
                                                                                r="4"
                                                                                fill="#0088FE"
                                                                            />
                                                                        )
                                                                    })}

                                                                    {/* Data points for Return */}
                                                                    {prepareSupplyReturnData().map((item, index, arr) => {
                                                                        const x = (index / (arr.length - 1)) * 100
                                                                        // Scale based on dynamic temperature range
                                                                        const range = getTemperatureRange();
                                                                        const min = range.min;
                                                                        const max = range.max;
                                                                        const y = 100 - ((item.return - min) / (max - min)) * 100
                                                                        return (
                                                                            <circle
                                                                                key={`return-${index}`}
                                                                                cx={`${x}%`}
                                                                                cy={`${y}%`}
                                                                                r="4"
                                                                                fill="#FF8042"
                                                                            />
                                                                        )
                                                                    })}
                                                                </svg>

                                                                {/* Hover tooltip container */}
                                                                <div className="absolute inset-0 flex">
                                                                    {prepareSupplyReturnData().map((item, index, arr) => (
                                                                        <div key={index} className="flex-1 group relative">
                                                                            <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                                                                                Supply: {item.supply.toFixed(1)}°F
                                                                                <br />
                                                                                Return: {item.return.toFixed(1)}°F
                                                                                <br />
                                                                                {formatTimestampEST(item.timestamp)}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>

                                                            {/* X-axis */}
                                                            <div className="absolute left-12 right-0 bottom-0 h-8 flex justify-between items-center text-xs text-gray-500 border-t">
                                                                {getTimeLabelsEST().map((label, index) => (
                                                                    <span key={index} className={index === 0 ? "ml-2" : index === 4 ? "mr-2" : ""}>
                                                                        {label}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        <div className="flex justify-between mt-4">
                                                            <div className="flex items-center">
                                                                <div className="w-3 h-3 bg-[#0088FE] rounded-full mr-2"></div>
                                                                <span className="text-sm">
                                                                    Supply: {getTemperatureMetrics()?.supply.value.toFixed(1)}°F
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center">
                                                                <div className="w-3 h-3 bg-[#FF8042] rounded-full mr-2"></div>
                                                                <span className="text-sm">
                                                                    Return: {getTemperatureMetrics()?.return.value.toFixed(1)}°F
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center">
                                                                <ArrowUpDown className="h-4 w-4 mr-1 text-green-500" />
                                                                <span className="text-sm">
                                                                    Δ:{" "}
                                                                    {(
                                                                        getTemperatureMetrics()?.supply.value - getTemperatureMetrics()?.return.value
                                                                    ).toFixed(1)}
                                                                    °F
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            )}

                                            {/* Temperature & Setpoint Chart */}
                                            {getTemperatureAndSetpointData() && (
                                                <Card>
                                                    <CardHeader className="pb-2">
                                                        <div className="flex items-center">
                                                            <Target className="h-5 w-5 mr-2 text-red-500" />
                                                            <CardTitle className="text-lg">Temperature & Setpoint</CardTitle>
                                                        </div>
                                                    </CardHeader>
                                                    <CardContent>
                                                        {/* Enhanced SVG Chart for Temperature & Setpoint */}
                                                        <div className="relative h-[300px] w-full mb-6">
                                                            {/* Y-axis */}
                                                            <div className="absolute left-0 top-0 bottom-0 w-12 flex flex-col justify-between text-xs text-gray-500 pr-2 border-r border-gray-200">
                                                                {getTemperatureLabels().map((label, index) => (
                                                                    <span key={index}>{label}°F</span>
                                                                ))}
                                                            </div>

                                                            {/* Chart area */}
                                                            <div className="absolute left-12 right-0 top-0 bottom-8 bg-gray-50/50 border border-gray-200 rounded">
                                                                {/* Grid lines */}
                                                                <div className="absolute inset-0 grid grid-cols-1 grid-rows-4">
                                                                    <div className="border-b border-gray-200"></div>
                                                                    <div className="border-b border-gray-200"></div>
                                                                    <div className="border-b border-gray-200"></div>
                                                                    <div className="border-b border-gray-200"></div>
                                                                </div>

                                                                {/* SVG Chart */}
                                                                <svg className="absolute inset-0 w-full h-full">
                                                                    {/* Current Temperature Line */}
                                                                    <polyline
                                                                        points={prepareTemperatureSetpointData().map((item, index, arr) => {
                                                                            const x = (index / (arr.length - 1)) * 100
                                                                            // Scale based on dynamic temperature range
                                                                            const range = getTemperatureRange();
                                                                            const min = range.min;
                                                                            const max = range.max;
                                                                            const y = 100 - ((item.temperature - min) / (max - min)) * 100
                                                                            return `${x}%,${y}%`
                                                                        }).join(' ')}
                                                                        fill="none"
                                                                        stroke="#8884d8"
                                                                        strokeWidth="3"
                                                                    />

                                                                    {/* Setpoint Line */}
                                                                    <polyline
                                                                        points={prepareTemperatureSetpointData().map((item, index, arr) => {
                                                                            const x = (index / (arr.length - 1)) * 100
                                                                            // Scale based on dynamic temperature range
                                                                            const range = getTemperatureRange();
                                                                            const min = range.min;
                                                                            const max = range.max;
                                                                            const y = 100 - ((item.setpoint - min) / (max - min)) * 100
                                                                            return `${x}%,${y}%`
                                                                        }).join(' ')}
                                                                        fill="none"
                                                                        stroke="#82ca9d"
                                                                        strokeWidth="3"
                                                                        strokeDasharray="5,5"
                                                                    />

                                                                    {/* Data points for Current Temperature */}
                                                                    {prepareTemperatureSetpointData().map((item, index, arr) => {
                                                                        const x = (index / (arr.length - 1)) * 100
                                                                        // Scale based on dynamic temperature range
                                                                        const range = getTemperatureRange();
                                                                        const min = range.min;
                                                                        const max = range.max;
                                                                        const y = 100 - ((item.temperature - min) / (max - min)) * 100
                                                                        return (
                                                                            <circle
                                                                                key={`temp-${index}`}
                                                                                cx={`${x}%`}
                                                                                cy={`${y}%`}
                                                                                r="4"
                                                                                fill="#8884d8"
                                                                            />
                                                                        )
                                                                    })}

                                                                    {/* Data points for Setpoint */}
                                                                    {prepareTemperatureSetpointData().map((item, index, arr) => {
                                                                        const x = (index / (arr.length - 1)) * 100
                                                                        // Scale based on dynamic temperature range
                                                                        const range = getTemperatureRange();
                                                                        const min = range.min;
                                                                        const max = range.max;
                                                                        const y = 100 - ((item.setpoint - min) / (max - min)) * 100
                                                                        return (
                                                                            <circle
                                                                                key={`set-${index}`}
                                                                                cx={`${x}%`}
                                                                                cy={`${y}%`}
                                                                                r="4"
                                                                                fill="#82ca9d"
                                                                            />
                                                                        )
                                                                    })}
                                                                </svg>

                                                                {/* Hover tooltip container */}
                                                                <div className="absolute inset-0 flex">
                                                                    {prepareTemperatureSetpointData().map((item, index, arr) => (
                                                                        <div key={index} className="flex-1 group relative">
                                                                            <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                                                                                Current: {item.temperature.toFixed(1)}°F
                                                                                <br />
                                                                                Setpoint: {item.setpoint.toFixed(1)}°F
                                                                                <br />
                                                                                {formatTimestampEST(item.timestamp)}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>

                                                            {/* X-axis */}
                                                            <div className="absolute left-12 right-0 bottom-0 h-8 flex justify-between items-center text-xs text-gray-500 border-t">
                                                                {getTimeLabelsEST().map((label, index) => (
                                                                    <span key={index} className={index === 0 ? "ml-2" : index === 4 ? "mr-2" : ""}>
                                                                        {label}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        <div className="flex justify-between mt-4">
                                                            <div className="flex items-center">
                                                                <div className="w-3 h-3 bg-[#8884d8] rounded-full mr-2"></div>
                                                                <span className="text-sm">
                                                                    Current: {getTemperatureAndSetpointData()?.temperature.value.toFixed(1)}°F
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center">
                                                                <div className="w-3 h-3 bg-[#82ca9d] rounded-full mr-2"></div>
                                                                <span className="text-sm">
                                                                    Setpoint: {getTemperatureAndSetpointData()?.setpoint.value.toFixed(1)}°F
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center">
                                                                <ArrowUpDown className="h-4 w-4 mr-1 text-blue-500" />
                                                                <span className="text-sm">
                                                                    Δ:{" "}
                                                                    {(
                                                                        getTemperatureAndSetpointData()?.temperature.value -
                                                                        getTemperatureAndSetpointData()?.setpoint.value
                                                                    ).toFixed(1)}
                                                                    °F
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            )}

                                            {/* Show message if no charts are available */}
                                            {!getTemperatureMetrics() && !getSetpointMetrics() && (
                                                <Alert>
                                                    <AlertTriangle className="h-4 w-4" />
                                                    <AlertTitle>No Chart Data</AlertTitle>
                                                    <AlertDescription>
                                                        No temperature or setpoint metrics found for this equipment.
                                                    </AlertDescription>
                                                </Alert>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </>
                    )}
                </>
            )}
        </div>
    )
}
