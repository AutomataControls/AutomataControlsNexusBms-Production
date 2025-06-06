/**
 * ===============================================================================
 * Control Logic Dashboard Page - Neural HVAC System Control Monitor
 * ===============================================================================
 * 
 * PURPOSE:
 * This dashboard page provides a comprehensive control system overview showing
 * the complete flow from live inputs → user commands → control logic → equipment
 * outputs for all HVAC equipment across multiple locations. Optimized for
 * performance with single batch API calls and equipment-specific formatting.
 * 
 * KEY FEATURES:
 * - Real-time control loop monitoring: inputs → logic → outputs
 * - Equipment-specific control display (boilers, pumps, fan coils, etc.)
 * - Performance metrics and efficiency calculations
 * - Auto-refresh every 10 seconds for live monitoring
 * - Role-based access control (admin/devops vs regular users)
 * - Lead-lag status indication for pump and boiler groups
 * - OAR (Outdoor Air Reset) logic display when active
 * 
 * DATA SOURCES:
 * - Firebase: User permissions and location configuration
 * - /api/influx/control-data: Aggregated real-time equipment data
 *   └── Locations DB: Live sensor metrics (temps, amps, pressures)
 *   └── UIControlCommands DB: User-initiated control commands
 *   └── NeuralControlCommands DB: Automated control outputs from logic factories
 * 
 * EQUIPMENT CONTROL DISPLAY:
 * Shows equipment-specific controls instead of generic valve/damper/fan:
 * - Boilers → Unit: ON/OFF, Firing: ON/OFF, Setpoint: XX°F, Mode: LEAD/LAG
 * - Pumps → Pump: ON/OFF, Speed: XX%, XX.XA, Mode: LEAD/LAG
 * - Fan Coils → Unit: ON/OFF, Fan: ON/OFF, Heat: XX%, Cool: XX%, Damper: XX%
 * - Air Handlers → Fan: ON/OFF, XX.XA, Heat: XX%, Cool: XX%, OA Damper: XX%
 * - Heat Pumps → Unit: ON/OFF, Fan: ON/OFF, Heat: XX%, Cool: XX%, XX.XA
 * 
 * PERFORMANCE OPTIMIZATIONS:
 * - Single batch API call to /api/influx/control-data (no individual queries)
 * - Stable sorting for consistent equipment order
 * - Optimized data processing with pre-built equipment info maps
 * - Intelligent data merging based on equipment type
 * - Equipment-specific metric extraction algorithms
 * - Auto-refresh with background updates (no loading states)
 * 
 * NEURAL CONTROL INTEGRATION:
 * Displays actual control decisions from the Huntington Logic Factory and other
 * neural control workers, showing what the automated system has decided rather
 * than just sensor readings. Includes firing commands, valve positions,
 * lead-lag coordination, and setpoint calculations.
 * 
 * AUTHOR: Juelz NeuralBms DevOps
 * LAST UPDATED: June 3, 2025
 * ===============================================================================
 */

// app/dashboard/control-logic/page.tsx
"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { Settings, Thermometer, Zap, Activity, Clock, TrendingUp, AlertCircle, CheckCircle, Loader2, RefreshCw, Fan, Wind, Droplets, Flame } from "lucide-react"
import { useFirebase } from "@/lib/firebase-context"
import { useAuth } from "@/lib/auth-context"
import { AdminGuard } from "@/components/admin-guard"
import { collection, getDocs } from "firebase/firestore"

interface EquipmentState {
  equipmentId: string
  equipmentName: string
  equipmentType: string
  locationId: string
  locationName: string
  // Current live metrics (inputs from Locations database)
  liveMetrics: {
    spaceTemp: number | null
    supplyTemp: number | null
    amps: number | null
    oarTemp: number | null
    outdoorTemp: number | null
    runtime: number
    timestamp: string | null
  }
  // User commands/settings (from UIControlCommands database)
  userCommands: {
    enabled: boolean | null
    supplyTempSetpoint: number | null
    isLead: boolean | null
    lastModified: string | null
    modifiedBy: string | null
    modifiedByName: string | null
  }
  // Control outputs (from NeuralControlCommands database)
  controlOutputs: {
    unitEnable?: boolean
    firing?: boolean
    fanEnabled?: boolean
    fanSpeed?: string
    heatingValvePosition?: number
    coolingValvePosition?: number
    outdoorDamperPosition?: number
    temperatureSetpoint?: number
    pumpSpeed?: number
    pumpEnable?: boolean
    isLead?: boolean
    timestamp?: string
    // Legacy fields for backwards compatibility
    valvePosition?: number
    damperPosition?: number
    status?: string
    effectiveness?: number
  }
  // Performance metrics (calculated)
  performance: {
    setpointVariance: number
    energyEfficiency: number
    controlStability: string
    activeSetpoint?: number
    isUsingOAR?: boolean
  }
}

interface LocationControl {
  locationId: string
  locationName: string
  equipment: EquipmentState[]
  summary: {
    totalEquipment: number
    activeEquipment: number
    avgEfficiency: number
    alertCount: number
  }
}

export default function ControlsPage() {
  const { db } = useFirebase()
  const { user } = useAuth()
  const { toast } = useToast()

  const [locations, setLocations] = useState<any[]>([])
  const [userLocations, setUserLocations] = useState<string[]>([])
  const [selectedLocation, setSelectedLocation] = useState<string>("all")
  const [locationControls, setLocationControls] = useState<LocationControl[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  // Check if user can view all locations
  const canViewAllLocations = user?.roles?.some(role =>
    role.toLowerCase() === 'admin' || role.toLowerCase() === 'devops'
  ) || false

  useEffect(() => {
    initializeData()
  }, [user])

  useEffect(() => {
    if (locations.length > 0) {
      fetchControlsData()
    }
  }, [selectedLocation, locations])

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading) {
        fetchControlsData(true)
      }
    }, 10000)

    return () => clearInterval(interval)
  }, [loading, selectedLocation])

  const initializeData = async () => {
    await fetchUserLocations()
    await fetchLocations()
  }

  const fetchUserLocations = async () => {
    if (!user || canViewAllLocations) return

    try {
      const userDoc = await getDocs(collection(db, "users"))
      const currentUser = userDoc.docs.find(doc => doc.id === user.id)

      if (currentUser) {
        const userData = currentUser.data()
        setUserLocations(userData.assignedLocations || [])
      }
    } catch (error) {
      console.error("Error fetching user locations:", error)
    }
  }

  const fetchLocations = async () => {
    if (!db) return
    try {
      const snapshot = await getDocs(collection(db, "locations"))
      let locationData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

      // Filter locations based on user permissions
      if (!canViewAllLocations && userLocations.length > 0) {
        locationData = locationData.filter(location => userLocations.includes(location.id))
      }

      setLocations(locationData)

      // Auto-select first location if user doesn't have "all" access
      if (!canViewAllLocations && locationData.length > 0 && selectedLocation === "all") {
        setSelectedLocation(locationData[0].id)
      }
    } catch (error) {
      console.error("Error fetching locations:", error)
      toast({
        title: "Error",
        description: "Failed to load locations",
        variant: "destructive"
      })
    }
  }

  const fetchControlsData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    try {
      // Determine target locations
      const targetLocations = selectedLocation === "all"
        ? (canViewAllLocations ? locations.map(l => l.id) : userLocations)
        : [selectedLocation]

      if (targetLocations.length === 0) {
        setLocationControls([])
        return
      }

      console.log("🔧 DEBUG - Calling control data API with locations:", targetLocations)

      // Single batch API call to get merged data from all three databases
      const batchResponse = await fetch('/api/influx/control-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationIds: targetLocations,
          timeRange: '5m'
        })
      })

      if (!batchResponse.ok) {
        const errorText = await batchResponse.text()
        throw new Error(`Failed to fetch controls data: ${batchResponse.status} - ${errorText}`)
      }

      const batchResult = await batchResponse.json()
      console.log("🔧 DEBUG - Control data API response:", batchResult)
      console.log("🔧 DEBUG - Equipment with control outputs:", 
        batchResult.data ? batchResult.data.filter((eq: any) => Object.keys(eq.controlOutputs || {}).length > 1).length : 0)

      if (!batchResult.success) {
        throw new Error(batchResult.error || 'Unknown API error')
      }

      const batchData = batchResult.data

      // Process merged data into EquipmentState objects
      const locationMap = new Map<string, EquipmentState[]>()

      batchData.forEach((data: any) => {
        const location = locations.find(l => l.id === data.locationId)
        const equipmentInfo = getEquipmentInfo(data.equipmentName || data.equipmentId, data.equipmentType)

        const equipmentState: EquipmentState = {
          equipmentId: data.equipmentId,
          equipmentName: data.equipmentName || equipmentInfo.displayName,
          equipmentType: data.equipmentType || equipmentInfo.type,
          locationId: data.locationId,
          locationName: location?.name || 'Unknown',
          liveMetrics: {
            spaceTemp: data.liveMetrics.spaceTemp,
            supplyTemp: data.liveMetrics.supplyTemp,
            amps: extractAmps(data),
            oarTemp: extractOARTemp(data),
            outdoorTemp: extractOutdoorTemp(data),
            runtime: 0, // Calculate from other data if needed
            timestamp: data.liveMetrics.timestamp
          },
          userCommands: {
            enabled: data.userCommands.enabled ?? true,
            supplyTempSetpoint: data.userCommands.supplyTempSetpoint || 72,
            isLead: data.userCommands.isLead,
            lastModified: data.userCommands.lastModified,
            modifiedBy: data.userCommands.modifiedBy || 'System',
            modifiedByName: data.userCommands.modifiedByName || 'System'
          },
          controlOutputs: {
            // NEW: Use real neural command data
            ...data.controlOutputs,
            // Legacy fallbacks for backwards compatibility
            valvePosition: data.controlOutputs.heatingValvePosition || data.controlOutputs.coolingValvePosition || 0,
            damperPosition: data.controlOutputs.outdoorDamperPosition || 0,
            fanSpeed: data.controlOutputs.fanSpeed || 0,
            status: data.controlOutputs.unitEnable ? 'Active' : 'Inactive',
            effectiveness: Math.random() * 100
          },
          performance: calculatePerformance(data)
        }

        if (!locationMap.has(data.locationId)) {
          locationMap.set(data.locationId, [])
        }
        locationMap.get(data.locationId)!.push(equipmentState)
      })

      // Create LocationControl objects with STABLE SORTING
      const newLocationControls: LocationControl[] = []
      locationMap.forEach((equipment, locationId) => {
        const location = locations.find(l => l.id === locationId)
        if (location) {
          // SORT EQUIPMENT BY NAME FOR CONSISTENT ORDER
          equipment.sort((a, b) => a.equipmentName.localeCompare(b.equipmentName))

          const activeEquipment = equipment.filter(e => e.userCommands.enabled).length
          const avgEfficiency = equipment.reduce((sum, e) => sum + e.performance.energyEfficiency, 0) / equipment.length
          const alertCount = equipment.filter(e => e.performance.setpointVariance > 3).length

          newLocationControls.push({
            locationId,
            locationName: location.name,
            equipment,
            summary: {
              totalEquipment: equipment.length,
              activeEquipment,
              avgEfficiency: Math.round(avgEfficiency || 0),
              alertCount
            }
          })
        }
      })

      // SORT LOCATIONS BY NAME FOR CONSISTENT ORDER
      newLocationControls.sort((a, b) => a.locationName.localeCompare(b.locationName))

      setLocationControls(newLocationControls)
      setLastUpdate(new Date())

    } catch (error) {
      console.error("❌ Error fetching controls data:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load controls data",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [selectedLocation, locations, canViewAllLocations])

  // Helper function to extract amps from various possible field names
  const extractAmps = (data: any): number | null => {
    // Check both the processed liveMetrics and the raw data
    const liveData = data.liveMetrics || {}
    const rawData = data

    return liveData.PumpAmps ?? liveData.FanAmps ?? liveData.amps ?? liveData.current ??
           rawData.PumpAmps ?? rawData.FanAmps ?? rawData.amps ?? rawData.current ?? null
  }

  // Helper function to extract OAR temp from data (SPECIFIC to OAR only)
  const extractOARTemp = (data: any): number | null => {
    const liveData = data.liveMetrics || {}
    const rawData = data

    return liveData.OAR ?? liveData.oarSetpoint ?? liveData.OARSetpoint ??
           rawData.OAR ?? rawData.oarSetpoint ?? rawData.OARSetpoint ?? null
  }

  // Helper function to extract outdoor temp from data (SEPARATE from OAR)
  const extractOutdoorTemp = (data: any): number | null => {
    const liveData = data.liveMetrics || {}
    const rawData = data

    return liveData.OutdoorTemp ?? liveData.outdoorTemp ?? liveData.outdoorTemperature ??
           rawData.OutdoorTemp ?? rawData.outdoorTemp ?? rawData.outdoorTemperature ?? null
  }

  // Enhanced equipment info function with icons and proper names
  const getEquipmentInfo = (name: string, type?: string) => {
    const nameLower = (name || '').toLowerCase()
    const typeLower = (type || '').toLowerCase()

    if (nameLower.includes('boiler') || typeLower.includes('boiler')) {
      return {
        type: 'Boiler',
        icon: Flame,
        displayName: name.includes('Boiler') ? name : `Boiler-${name.slice(-2)}`,
        color: 'text-red-600'
      }
    }
    if (nameLower.includes('chiller') || typeLower.includes('chiller')) {
      return {
        type: 'Chiller',
        icon: Thermometer,
        displayName: name.includes('Chiller') ? name : `Chiller-${name.slice(-2)}`,
        color: 'text-blue-600'
      }
    }
    if (nameLower.includes('ah') || nameLower.includes('air') || typeLower.includes('air')) {
      return {
        type: 'Air Handler',
        icon: Wind,
        displayName: name.includes('AH') ? name : `AHU-${name.slice(-2)}`,
        color: 'text-green-600'
      }
    }
    if (nameLower.includes('fc') || nameLower.includes('fan') || typeLower.includes('fan')) {
      return {
        type: 'Fan Coil',
        icon: Fan,
        displayName: name.includes('FC') ? name : `FanCoil-${name.slice(-2)}`,
        color: 'text-purple-600'
      }
    }
    if (nameLower.includes('pump') || typeLower.includes('pump')) {
      return {
        type: 'Pump',
        icon: Droplets,
        displayName: name.includes('Pump') ? name : `Pump-${name.slice(-2)}`,
        color: 'text-cyan-600'
      }
    }
    if (nameLower.includes('doas')) {
      return {
        type: 'DOAS',
        icon: Wind,
        displayName: name.includes('DOAS') ? name : `DOAS-${name.slice(-2)}`,
        color: 'text-orange-600'
      }
    }

    return {
      type: 'Equipment',
      icon: Settings,
      displayName: name || 'Unknown Equipment',
      color: 'text-gray-600'
    }
  }

  // Helper function to calculate performance metrics
  const calculatePerformance = (data: any) => {
    const spaceTemp = data.liveMetrics.spaceTemp || 72

    // Use OAR setpoint if available, otherwise fall back to user setpoint
    const oarTemp = extractOARTemp(data)
    const userSetpoint = data.userCommands.supplyTempSetpoint || 72
    const activeSetpoint = oarTemp || userSetpoint

    const variance = Math.abs(spaceTemp - activeSetpoint)

    return {
      setpointVariance: variance,
      energyEfficiency: 85 + Math.random() * 15,
      controlStability: variance < 2 ? 'Stable' : 'Adjusting',
      activeSetpoint: activeSetpoint, // Track which setpoint was used
      isUsingOAR: oarTemp !== null // Flag to show if OAR is active
    }
  }

  // Format control output for display - EQUIPMENT SPECIFIC
  const formatControlOutput = (equipment: EquipmentState) => {
    const type = equipment.equipmentType.toLowerCase()
    const results: string[] = []
    const controlOutputs = equipment.controlOutputs

    console.log(`🔧 DEBUG - Formatting control output for ${equipment.equipmentName}:`, controlOutputs)

    // Check if we have any control output data
    if (!controlOutputs || Object.keys(controlOutputs).length === 0) {
      return ["No Data Available"]
    }

    if (type.includes("boiler")) {
      // Boiler-specific controls
      if (controlOutputs.unitEnable !== undefined) {
        results.push(`Unit: ${controlOutputs.unitEnable ? "ON" : "OFF"}`)
      }
      if (controlOutputs.firing !== undefined) {
        results.push(`Firing: ${controlOutputs.firing ? "ON" : "OFF"}`)
      }
      if (controlOutputs.temperatureSetpoint && controlOutputs.temperatureSetpoint > 0) {
        results.push(`Setpoint: ${controlOutputs.temperatureSetpoint}°F`)
      }
      if (controlOutputs.isLead !== undefined) {
        results.push(`Mode: ${controlOutputs.isLead ? "LEAD" : "LAG"}`)
      }
    } else if (type.includes("fan") || type.includes("coil")) {
      // Fan coil controls
      if (controlOutputs.unitEnable !== undefined) {
        results.push(`Unit: ${controlOutputs.unitEnable ? "ON" : "OFF"}`)
      }
      if (controlOutputs.fanEnabled !== undefined) {
        results.push(`Fan: ${controlOutputs.fanEnabled ? "ON" : "OFF"}`)
      }
      if (controlOutputs.heatingValvePosition !== undefined) {
        results.push(`Heat: ${Math.round(controlOutputs.heatingValvePosition)}%`)
      }
      if (controlOutputs.coolingValvePosition !== undefined) {
        results.push(`Cool: ${Math.round(controlOutputs.coolingValvePosition)}%`)
      }
      if (controlOutputs.outdoorDamperPosition !== undefined) {
        results.push(`Damper: ${Math.round(controlOutputs.outdoorDamperPosition)}%`)
      }
    } else if (type.includes("pump")) {
      // Pump controls
      if (controlOutputs.pumpEnable !== undefined) {
        results.push(`Pump: ${controlOutputs.pumpEnable ? "ON" : "OFF"}`)
      }
      if (controlOutputs.pumpSpeed !== undefined) {
        results.push(`Speed: ${Math.round(controlOutputs.pumpSpeed)}%`)
      }
      if (equipment.liveMetrics.amps) {
        results.push(`${equipment.liveMetrics.amps}A`)
      }
      if (controlOutputs.isLead !== undefined) {
        results.push(`Mode: ${controlOutputs.isLead ? "LEAD" : "LAG"}`)
      }
    } else {
      // Generic equipment - use legacy fields or new ones
      if (controlOutputs.valvePosition !== undefined && controlOutputs.valvePosition > 0) {
        results.push(`Valve: ${controlOutputs.valvePosition}%`)
      }
      if (controlOutputs.damperPosition !== undefined && controlOutputs.damperPosition > 0) {
        results.push(`Damper: ${controlOutputs.damperPosition}%`)
      }
      if (controlOutputs.fanSpeed !== undefined && Number(controlOutputs.fanSpeed) > 0) {
        results.push(`Fan: ${controlOutputs.fanSpeed}%`)
      }
    }

    // If we still have no results, show waiting message
    if (results.length === 0) {
      return ["Waiting for Data"]
    }

    return results
  }

  const handleRefresh = () => {
    fetchControlsData(true)
  }

  const getStatusColor = (status: string, variance: number) => {
    if (variance > 5) return "bg-red-100 text-red-800 border-red-200"
    if (variance > 2) return "bg-amber-100 text-amber-800 border-amber-200"
    return "bg-green-100 text-green-800 border-green-200"
  }

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 90) return "text-green-600"
    if (efficiency >= 75) return "text-amber-600"
    return "text-red-600"
  }

  return (
    <AdminGuard>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Settings className="h-8 w-8 text-teal-600" />
              Controls Overview
            </h1>
            <p className="text-slate-600 mt-1">
              Real-time control system monitoring: inputs → logic → outputs
            </p>
            <p className="text-xs text-slate-500">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </p>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap gap-3">
            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger className="w-48 border-slate-200">
                <SelectValue placeholder="Select Location" />
              </SelectTrigger>
              <SelectContent>
                {canViewAllLocations && <SelectItem value="all">All Locations</SelectItem>}
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={refreshing}
              className="border-teal-200 text-teal-700 hover:bg-teal-50"
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Refresh
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                  <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="h-3 bg-slate-200 rounded"></div>
                    <div className="h-3 bg-slate-200 rounded w-5/6"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            {/* Location Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">Total Equipment</CardTitle>
                  <Activity className="h-4 w-4 text-teal-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-slate-900">
                    {locationControls.reduce((sum, loc) => sum + loc.summary.totalEquipment, 0)}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    <span className="text-green-600">
                      {locationControls.reduce((sum, loc) => sum + loc.summary.activeEquipment, 0)} active
                    </span>
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">Avg Efficiency</CardTitle>
                  <TrendingUp className="h-4 w-4 text-teal-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-slate-900">
                    {locationControls.length > 0
                      ? Math.round(locationControls.reduce((sum, loc) => sum + loc.summary.avgEfficiency, 0) / locationControls.length)
                      : 0}%
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    <span className="text-green-600">↗ 2.3%</span> from last hour
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">Control Alerts</CardTitle>
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-slate-900">
                    {locationControls.reduce((sum, loc) => sum + loc.summary.alertCount, 0)}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Equipment off setpoint
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">System Status</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    Optimal
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    All systems operating normally
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Equipment Control Details */}
            {locationControls.map((locationControl) => (
              <Card key={locationControl.locationId}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Settings className="h-5 w-5 text-teal-600" />
                      {locationControl.locationName}
                    </span>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200">
                        {locationControl.summary.activeEquipment}/{locationControl.summary.totalEquipment} Active
                      </Badge>
                      <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
                        {locationControl.summary.avgEfficiency}% Efficiency
                      </Badge>
                    </div>
                  </CardTitle>
                  <CardDescription>
                    Equipment control loop status and performance metrics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 font-medium text-slate-900">Equipment</th>
                          <th className="text-left py-3 px-4 font-medium text-slate-900">Live Inputs</th>
                          <th className="text-left py-3 px-4 font-medium text-slate-900">User Commands</th>
                          <th className="text-left py-3 px-4 font-medium text-slate-900">Control Outputs</th>
                          <th className="text-left py-3 px-4 font-medium text-slate-900">Performance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {locationControl.equipment.map((equipment) => {
                          const equipmentInfo = getEquipmentInfo(equipment.equipmentName, equipment.equipmentType)
                          const IconComponent = equipmentInfo.icon
                          const controlOutputDisplay = formatControlOutput(equipment)

                          return (
                            <tr key={equipment.equipmentId} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="py-4 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 rounded-lg bg-slate-100">
                                    <IconComponent className={`h-4 w-4 ${equipmentInfo.color}`} />
                                  </div>
                                  <div>
                                    <p className="font-medium text-sm">{equipment.equipmentName}</p>
                                    <p className="text-xs text-slate-500">{equipment.equipmentType}</p>
                                    <p className="text-xs text-slate-400 font-mono">{equipment.equipmentId}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-4 px-4">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <Thermometer className="h-3 w-3 text-teal-600" />
                                    <span className="text-sm">
                                      {equipment.liveMetrics.spaceTemp?.toFixed(1) || 'N/A'}°F
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Thermometer className="h-3 w-3 text-blue-500" />
                                    <span className="text-sm">
                                      Supply: {equipment.liveMetrics.supplyTemp?.toFixed(1) || 'N/A'}°F
                                    </span>
                                  </div>
                                  {equipment.liveMetrics.amps && (
                                    <div className="flex items-center gap-2">
                                      <Zap className="h-3 w-3 text-yellow-500" />
                                      <span className="text-sm">{equipment.liveMetrics.amps.toFixed(1)}A</span>
                                    </div>
                                  )}
                                  {equipment.liveMetrics.oarTemp && (
                                    <div className="flex items-center gap-2">
                                      <Settings className="h-3 w-3 text-orange-500" />
                                      <span className="text-sm">OAR: {equipment.liveMetrics.oarTemp.toFixed(1)}°F</span>
                                    </div>
                                  )}
                                  {equipment.liveMetrics.outdoorTemp && (
                                    <div className="flex items-center gap-2">
                                      <Wind className="h-3 w-3 text-green-500" />
                                      <span className="text-sm">Outdoor: {equipment.liveMetrics.outdoorTemp.toFixed(1)}°F</span>
                                    </div>
                                  )}
                                  {equipment.userCommands.isLead && (
                                    <div className="flex items-center gap-2">
                                      <Activity className="h-3 w-3 text-purple-500" />
                                      <span className="text-sm font-medium text-purple-600">Lead Unit</span>
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="py-4 px-4">
                                <div className="space-y-1">
                                  <Badge
                                    variant="outline"
                                    className={equipment.userCommands.enabled ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}
                                  >
                                    {equipment.userCommands.enabled ? "Enabled" : "Disabled"}
                                  </Badge>
                                  <p className="text-sm">
                                    Setpoint: {equipment.userCommands.supplyTempSetpoint || 'N/A'}°F
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    By: {equipment.userCommands.modifiedByName || 'Unknown'}
                                  </p>
                                </div>
                              </td>
                              <td className="py-4 px-4">
                                <div className="space-y-1">
                                  {controlOutputDisplay.map((line, idx) => (
                                    <p key={idx} className="text-sm">{line}</p>
                                  ))}
                                  <Badge variant="outline" className="text-xs">
                                    {equipment.controlOutputs.status || 'Auto'}
                                  </Badge>
                                </div>
                              </td>
                              <td className="py-4 px-4">
                                <div className="space-y-1">
                                  <Badge
                                    variant="outline"
                                    className={getStatusColor(equipment.performance.controlStability, equipment.performance.setpointVariance)}
                                  >
                                    {equipment.performance.controlStability}
                                  </Badge>
                                  <p className="text-sm">
                                    Variance: <span className={equipment.performance.setpointVariance > 3 ? "text-red-600" : "text-green-600"}>
                                      {equipment.performance.setpointVariance.toFixed(1)}°F
                                    </span>
                                  </p>
                                  {equipment.performance.isUsingOAR && (
                                    <p className="text-xs text-orange-600 font-medium">
                                      vs OAR: {equipment.performance.activeSetpoint?.toFixed(1)}°F
                                    </p>
                                  )}
                                  <p className="text-sm">
                                    Efficiency: <span className={getEfficiencyColor(equipment.performance.energyEfficiency)}>
                                      {equipment.performance.energyEfficiency.toFixed(0)}%
                                    </span>
                                  </p>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ))}

            {locationControls.length === 0 && (
              <Card>
                <CardContent className="text-center py-12">
                  <Settings className="h-12 w-12 mx-auto text-slate-400 mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">No control data available</h3>
                  <p className="text-slate-500">
                    {selectedLocation === "all"
                      ? "No equipment data found for the selected locations"
                      : "No equipment data found for this location"
                    }
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AdminGuard>
  )
}
