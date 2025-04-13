"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Settings, AlertTriangle, Thermometer, Droplets, Target, ArrowUpDown, RefreshCw, Loader2 } from "lucide-react"
import { useFirebase } from "@/lib/firebase-context"
import { ref, onValue, off } from "firebase/database"
import { secondaryDb } from "@/lib/secondary-firebase" // Import the RTDB directly
import { getApps } from "firebase/app"

export default function AnalyticsContent() {
  const router = useRouter()
  const { db } = useFirebase() // Only get Firestore from context
  const rtdb = secondaryDb // Use the directly imported RTDB

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
  const [metrics, setMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState("24h")
  const [refreshing, setRefreshing] = useState(false)
  const [historicalData, setHistoricalData] = useState<any>({})

  // Load saved selections from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedLocation = localStorage.getItem("selectedLocation")
      const savedEquipment = localStorage.getItem("selectedEquipment")

      if (savedLocation) {
        setSelectedLocation(savedLocation)
      }

      if (savedEquipment) {
        setSelectedEquipment(savedEquipment)
      }
    }
  }, [])

  // Add this check before the first useEffect
  const renderErrorAlert = firebaseError ? (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Analytics</h1>
        <Button variant="outline" onClick={() => router.push("/dashboard/settings")} className="hover:bg-[#e6f3f1]">
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </Button>
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
    if (!rtdb || !firebaseInitialized) return

    setLoading(true)
    setError(null)

    console.log("Fetching locations from RTDB")

    const locationsRef = ref(rtdb, "/locations")

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

        // Convert to array of objects with id and name
        const locationsArray = Object.entries(data).map(([id, location]: [string, any]) => ({
          id,
          name: location.name || id,
        }))

        console.log("Found locations:", locationsArray.length)
        setLocations(locationsArray)

        // Auto-select first location if available
        if (locationsArray.length > 0 && !selectedLocation) {
          setSelectedLocation(locationsArray[0].id)
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
      off(locationsRef)
    }
  }, [rtdb, selectedLocation, firebaseInitialized])

  // Fetch equipment for the selected location
  useEffect(() => {
    if (!selectedLocation || !rtdb || !firebaseInitialized) return

    setLoading(true)
    setError(null)
    setSelectedEquipment("")
    setMetrics(null)

    console.log("Fetching equipment for location:", selectedLocation)

    // Get systems/equipment from RTDB
    const locationRef = ref(rtdb, `/locations/${selectedLocation}/systems`)

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
        }))

        console.log("Found equipment:", equipmentArray.length)
        setEquipment(equipmentArray)

        // Auto-select first equipment if available
        if (equipmentArray.length > 0) {
          setSelectedEquipment(equipmentArray[0].id)
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
      off(locationRef)
    }
  }, [selectedLocation, rtdb, firebaseInitialized])

  // Fetch metrics for the selected equipment
  useEffect(() => {
    if (!selectedLocation || !selectedEquipment || !rtdb || !firebaseInitialized) return

    setLoading(true)
    setError(null)
    setMetrics(null)

    console.log("Fetching metrics for equipment:", selectedEquipment, "at location:", selectedLocation)

    // Get metrics from RTDB
    const metricsRef = ref(rtdb, `/locations/${selectedLocation}/systems/${selectedEquipment}/metrics`)

    const handleData = (snapshot: any) => {
      try {
        const data = snapshot.val()
        if (!data) {
          console.log("No metrics found for equipment:", selectedEquipment)
          setMetrics(null)
          setError("No metrics found for this equipment")
          setLoading(false)
          return
        }

        console.log("Found metrics:", Object.keys(data).length)
        setMetrics(data)

        // Generate historical data for charts
        generateHistoricalData(data)

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
      off(metricsRef)
    }
  }, [selectedLocation, selectedEquipment, rtdb, firebaseInitialized])

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

  // Function to refresh data
  const refreshData = () => {
    setRefreshing(true)

    // Re-fetch metrics
    if (selectedLocation && selectedEquipment && rtdb) {
      const metricsRef = ref(rtdb, `/locations/${selectedLocation}/systems/${selectedEquipment}/metrics`)

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

  // Format timestamp for chart display
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    return `${date.getHours()}:${date.getMinutes().toString().padStart(2, "0")}`
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

  const hasHumidityMetrics = useMemo(() => {
    if (!metrics) return false

    // Check for humidity metrics
    const metricKeys = Object.keys(metrics).map((key) => key.toLowerCase())
    return metricKeys.some((key) => key.includes("humid") || key.includes("rh"))
  }, [metrics])

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

  const getHumidityMetrics = () => {
    if (!metrics) return null

    const result: any = {}

    // Look for humidity
    const humidityKeys = Object.keys(metrics).filter(
      (key) => key.toLowerCase().includes("humid") || key.toLowerCase().includes("rh"),
    )

    if (humidityKeys.length > 0) {
      humidityKeys.forEach((key, index) => {
        result[`humidity${index > 0 ? index + 1 : ""}`] = {
          name: key,
          value: metrics[key],
          data: historicalData[key] || [],
        }
      })
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

  // Render a simple chart using div elements
  const renderSimpleChart = (data: any[], valueKey: string, color: string) => {
    if (!data || data.length === 0) return null

    const maxValue = Math.max(...data.map((item) => item[valueKey]))
    const minValue = Math.min(...data.map((item) => item[valueKey]))
    const range = maxValue - minValue || 1

    return (
      <div className="h-[200px] w-full flex items-end">
        {data.map((item, index) => {
          const height = ((item[valueKey] - minValue) / range) * 100
          return (
            <div key={index} className="flex-1 mx-[1px] relative group" style={{ height: `${Math.max(5, height)}%` }}>
              <div
                className="absolute bottom-0 w-full rounded-t"
                style={{ height: "100%", backgroundColor: color }}
              ></div>
              <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-1 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                {item[valueKey].toFixed(1)}
                <br />
                {formatTimestamp(item.timestamp)}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Render a dual chart for comparing two metrics
  const renderDualChart = (data: any[], key1: string, key2: string, color1: string, color2: string) => {
    if (!data || data.length === 0) return null

    const allValues = [...data.map((item) => item[key1]), ...data.map((item) => item[key2])]
    const maxValue = Math.max(...allValues)
    const minValue = Math.min(...allValues)
    const range = maxValue - minValue || 1

    return (
      <div className="h-[200px] w-full relative">
        <div className="absolute inset-0 flex items-end">
          {data.map((item, index) => {
            const height1 = ((item[key1] - minValue) / range) * 100
            return (
              <div key={`${index}-1`} className="flex-1 mx-[1px] relative group">
                <div
                  className="absolute bottom-0 w-full rounded-t"
                  style={{ height: `${Math.max(5, height1)}%`, backgroundColor: color1 }}
                ></div>
                <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-1 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                  {item[key1].toFixed(1)}
                  <br />
                  {formatTimestamp(item.timestamp)}
                </div>
              </div>
            )
          })}
        </div>
        <div className="absolute inset-0 flex items-end opacity-90">
          {data.map((item, index) => {
            const height2 = ((item[key2] - minValue) / range) * 100
            return (
              <div key={`${index}-2`} className="flex-1 mx-[1px] relative group">
                <div
                  className="absolute bottom-0 w-full rounded-t border-2"
                  style={{ height: `${Math.max(5, height2)}%`, borderColor: color2, backgroundColor: "transparent" }}
                ></div>
                <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-1 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                  {item[key2].toFixed(1)}
                  <br />
                  {formatTimestamp(item.timestamp)}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
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
              <Button
                variant="outline"
                onClick={() => router.push("/dashboard/settings")}
                className="hover:bg-[#e6f3f1]"
              >
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Button>
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
                    <div className="w-full md:w-1/3">
                      <label className="text-sm font-medium mb-2 block">Select Location</label>
                      <Select
                        value={selectedLocation}
                        onValueChange={(value) => {
                          setSelectedLocation(value)
                          localStorage.setItem("selectedLocation", value)
                          // Clear selected equipment when location changes
                          setSelectedEquipment("")
                          localStorage.removeItem("selectedEquipment")
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
                    </div>

                    <div className="w-full md:w-1/3">
                      <label className="text-sm font-medium mb-2 block">Select Equipment</label>
                      <Select
                        value={selectedEquipment}
                        onValueChange={(value) => {
                          setSelectedEquipment(value)
                          localStorage.setItem("selectedEquipment", value)
                        }}
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
                            {renderDualChart(prepareSupplyReturnData(), "supply", "return", "#0088FE", "#FF8042")}
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
                            {renderDualChart(
                              prepareTemperatureSetpointData(),
                              "temperature",
                              "setpoint",
                              "#8884d8",
                              "#82ca9d",
                            )}
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

                      {/* Humidity Chart */}
                      {getHumidityMetrics() && (
                        <Card>
                          <CardHeader className="pb-2">
                            <div className="flex items-center">
                              <Droplets className="h-5 w-5 mr-2 text-blue-400" />
                              <CardTitle className="text-lg">Humidity Levels</CardTitle>
                            </div>
                          </CardHeader>
                          <CardContent>
                            {renderSimpleChart(Object.values(getHumidityMetrics())[0].data, "value", "#00C49F")}
                            <div className="flex flex-wrap gap-4 mt-4">
                              {Object.values(getHumidityMetrics()).map((metric, index) => (
                                <div key={metric.name} className="flex items-center">
                                  <div
                                    className="w-3 h-3 rounded-full mr-2"
                                    style={{ backgroundColor: index === 0 ? "#00C49F" : "#FFBB28" }}
                                  ></div>
                                  <span className="text-sm">
                                    {metric.name}: {metric.value.toFixed(1)}%
                                  </span>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Show message if no charts are available */}
                      {!getTemperatureMetrics() && !getSetpointMetrics() && !getHumidityMetrics() && (
                        <Alert>
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle>No Chart Data</AlertTitle>
                          <AlertDescription>
                            No temperature, setpoint, or humidity metrics found for this equipment.
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
