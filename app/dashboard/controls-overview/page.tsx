/**
 * ===============================================================================
 * Equipment Controls Overview Dashboard Page
 * ===============================================================================
 * 
 * PURPOSE:
 * This dashboard page provides a comprehensive overview of all HVAC equipment
 * across multiple locations, showing real-time status, user commands, and
 * automated control outputs from the Neural HVAC system.
 * 
 * KEY FEATURES:
 * - Real-time equipment status and metrics
 * - User command display (manual overrides)
 * - Neural control outputs (automated decisions)
 * - Equipment-specific formatting (boilers, pumps, fan coils, etc.)
 * - Multi-location support with role-based access
 * - Performance monitoring and alarm status
 * 
 * DATA SOURCES:
 * - Firebase: Location and equipment configuration data
 * - /api/influx/control-data: Aggregated control data from InfluxDB
 *   └── Locations DB: Live sensor metrics
 *   └── UIControlCommands DB: User-initiated commands
 *   └── NeuralControlCommands DB: Automated control outputs
 * 
 * EQUIPMENT TYPES SUPPORTED:
 * - Boilers: Unit status, firing, setpoint, lead/lag mode
 * - Pumps: Pump status, speed, amps, lead/lag mode
 * - Fan Coils: Unit status, fan, valve positions, dampers
 * - Air Handlers: Fan status, valve positions, dampers, amps
 * - Geothermal Heat Pumps: Unit status, fan, heating/cooling modes
 * - Chillers: Unit status, setpoint, amps
 * 
 * CONTROL OUTPUT DISPLAY:
 * Equipment types show specific controls instead of generic valve/damper/fan:
 * - Boilers → Unit: ON/OFF, Firing: ON/OFF, Setpoint: XX°F, Mode: LEAD/LAG
 * - Pumps → Pump: ON/OFF, Speed: XX%, XX.XA, Mode: LEAD/LAG
 * - Fan Coils → Unit: ON/OFF, Fan: ON/OFF, Heat: XX%, Cool: XX%, Damper: XX%
 * 
 * AUTHOR: Juelz NeuralBms DevOps
 * LAST UPDATED: June 3, 2025
 * ===============================================================================
 */

// app/dashboard/controls-overview/page.tsx - Equipment-Focused Location Cards
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Building,
  Settings,
  RefreshCw,
  ChevronRight,
  Thermometer,
  AlertTriangle,
  CheckCircle,
  Fan,
  Flame,
  Droplets,
  Gauge,
  TrendingUp,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useFirebase } from "@/lib/firebase-context"
import { collection, query, where, getDocs } from "firebase/firestore"

interface Location {
  id: string
  name: string
  address?: string
  city?: string
  state?: string
  equipmentCount?: number
}

interface Equipment {
  id: string
  locationId: string
  name: string
  system: string
  type: string
  equipmentType?: string  // Alternative field name
  lastUpdated: string | Date
}

interface EquipmentData {
  equipmentId: string
  locationId: string
  equipmentName: string
  equipmentType: string
  liveMetrics: {
    spaceTemp?: number
    supplyTemp?: number
    amps?: number
    isFiring?: boolean
    pressure?: number
    outdoorTemp?: number
    oarTemp?: number
    timestamp: string
  }
  userCommands: {
    enabled?: boolean
    supplyTempSetpoint?: number
    isLead?: boolean
    modifiedBy?: string
    modifiedByName?: string
    lastModified?: string
  }
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
  }
}

interface EquipmentSummary {
  locationId: string
  locationName: string
  totalEquipment: number
  equipmentByType: Record<string, number>
  onlineCount: number
  offlineCount: number
  alarmCount: number
  avgSupplyTemp?: number
  avgSpaceTemp?: number
  totalAmps?: number
  equipment: Equipment[]
  equipmentData: Record<string, EquipmentData>
}

export default function ControlsOverviewPage() {
  const { user } = useAuth()
  const { db } = useFirebase()
  const router = useRouter()

  const [locations, setLocations] = useState<Location[]>([])
  const [equipmentSummaries, setEquipmentSummaries] = useState<EquipmentSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>("")

  // Fetch control data from the fixed API route with optional worker processing
  const fetchControlData = async (locationIds: string[]) => {
    try {
      console.log("🔧 DEBUG - Calling control data API with locations:", locationIds)
      
      const response = await fetch('/api/influx/control-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationIds,
          timeRange: '5m'
        })
      })

      if (!response.ok) {
        throw new Error(`API call failed: ${response.status}`)
      }

      const result = await response.json()
      console.log("🔧 DEBUG - Control data API response:", result)
      console.log("🔧 DEBUG - Record counts:", result.recordCounts)
      console.log("🔧 DEBUG - Equipment with control outputs:", 
        result.data.filter((eq: any) => Object.keys(eq.controlOutputs).length > 1).length)

      if (result.success && result.data) {
        // Optional: Process data with location-specific workers for enhanced optimization
        // TODO: Integrate with dataFactoryManager when ready
        // const processedData = await dataFactoryManager.processAllLocations(groupByLocation(result.data))
        
        // Convert array to map by equipmentId for easy lookup
        const equipmentDataMap: Record<string, EquipmentData> = {}
        result.data.forEach((item: EquipmentData) => {
          equipmentDataMap[item.equipmentId] = item
          
          // Debug log for key equipment
          if (item.equipmentId === 'ZLYR6YveSmCEMqtBSy3e' || item.equipmentId === 'XBvDB5Jvh8M4FSBpMDAp') {
            console.log(`🔧 DEBUG - ${item.equipmentName} control outputs:`, item.controlOutputs)
          }
        })
        
        console.log("🔧 DEBUG - Equipment data map size:", Object.keys(equipmentDataMap).length)
        return equipmentDataMap
      }

      return {}
    } catch (error) {
      console.error("🔧 DEBUG - Error fetching control data:", error)
      return {}
    }
  }

  // Format control output for display - FIXED TypeError
  const formatControlOutput = (equipment: Equipment, equipmentData?: EquipmentData) => {
    // FIXED: Safely get equipment type with multiple fallbacks
    const type = (equipment?.type || equipment?.equipmentType || equipmentData?.equipmentType || "unknown").toLowerCase()
    const results: string[] = []
    const controlOutputs = equipmentData?.controlOutputs || {}

    console.log(`🔧 DEBUG - Formatting control output for ${equipment?.name || 'Unknown'}:`, controlOutputs)

    // Check if we have any control output data
    if (!controlOutputs || Object.keys(controlOutputs).length === 0) {
      console.log(`🔧 DEBUG - No control output data for ${equipment.name}`)
      return ["No Data Available"]
    }

    // All equipment shows enabled/disabled status first
    if (controlOutputs.unitEnable !== undefined) {
      results.push(`Unit: ${controlOutputs.unitEnable ? "ON" : "OFF"}`)
    }

    if (type.includes("boiler")) {
      // Boiler-specific controls
      if (controlOutputs.firing !== undefined) {
        results.push(`Firing: ${controlOutputs.firing ? "ON" : "OFF"}`)
      }
      if (controlOutputs.temperatureSetpoint !== undefined && controlOutputs.temperatureSetpoint > 0) {
        results.push(`Setpoint: ${controlOutputs.temperatureSetpoint}°F`)
      }
      if (controlOutputs.isLead !== undefined) {
        results.push(`Mode: ${controlOutputs.isLead ? "LEAD" : "LAG"}`)
      }
    } else if (type.includes("fan") || type.includes("coil")) {
      // Fan coil controls
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
      if (equipmentData?.liveMetrics?.amps !== undefined) {
        results.push(`${equipmentData.liveMetrics.amps}A`)
      }
      if (controlOutputs.isLead !== undefined) {
        results.push(`Mode: ${controlOutputs.isLead ? "LEAD" : "LAG"}`)
      }
    } else if (type.includes("air") || type.includes("ahu") || type.includes("handler")) {
      // Air Handler controls
      if (controlOutputs.fanEnabled !== undefined) {
        results.push(`Fan: ${controlOutputs.fanEnabled ? "ON" : "OFF"}`)
      }
      if (equipmentData?.liveMetrics?.amps !== undefined) {
        results.push(`${equipmentData.liveMetrics.amps}A`)
      }
      if (controlOutputs.heatingValvePosition !== undefined) {
        results.push(`Heat: ${Math.round(controlOutputs.heatingValvePosition)}%`)
      }
      if (controlOutputs.coolingValvePosition !== undefined) {
        results.push(`Cool: ${Math.round(controlOutputs.coolingValvePosition)}%`)
      }
      if (controlOutputs.outdoorDamperPosition !== undefined) {
        results.push(`OA Damper: ${Math.round(controlOutputs.outdoorDamperPosition)}%`)
      }
    } else if (type.includes("geothermal") || type.includes("heat pump")) {
      // Geothermal Heat Pump controls
      if (controlOutputs.unitEnable !== undefined) {
        results.push(`Unit: ${controlOutputs.unitEnable ? "ON" : "OFF"}`)
      }
      if (controlOutputs.fanEnabled !== undefined) {
        results.push(`Fan: ${controlOutputs.fanEnabled ? "ON" : "OFF"}`)
      }
      if (controlOutputs.temperatureSetpoint !== undefined) {
        results.push(`Setpoint: ${controlOutputs.temperatureSetpoint}°F`)
      }
      if (controlOutputs.heatingValvePosition !== undefined) {
        results.push(`Heat: ${Math.round(controlOutputs.heatingValvePosition)}%`)
      }
      if (controlOutputs.coolingValvePosition !== undefined) {
        results.push(`Cool: ${Math.round(controlOutputs.coolingValvePosition)}%`)
      }
      if (equipmentData?.liveMetrics?.amps !== undefined) {
        results.push(`${equipmentData.liveMetrics.amps}A`)
      }
    } else {
      // Generic equipment - show whatever data we have
      if (controlOutputs.heatingValvePosition !== undefined) {
        results.push(`Heat: ${Math.round(controlOutputs.heatingValvePosition)}%`)
      }
      if (controlOutputs.coolingValvePosition !== undefined) {
        results.push(`Cool: ${Math.round(controlOutputs.coolingValvePosition)}%`)
      }
      if (controlOutputs.outdoorDamperPosition !== undefined) {
        results.push(`Damper: ${Math.round(controlOutputs.outdoorDamperPosition)}%`)
      }
      if (controlOutputs.fanEnabled !== undefined) {
        results.push(`Fan: ${controlOutputs.fanEnabled ? "ON" : "OFF"}`)
      }
      if (controlOutputs.pumpSpeed !== undefined) {
        results.push(`Pump: ${Math.round(controlOutputs.pumpSpeed)}%`)
      }
    }

    // If we still have no results after processing real data, show waiting message
    if (results.length === 0) {
      console.log(`🔧 DEBUG - No results generated for ${equipment.name}, showing waiting message`)
      return ["Waiting for Data"]
    }

    console.log(`🔧 DEBUG - Formatted results for ${equipment.name}:`, results)
    return results
  }

  // Fetch locations and equipment data with 60-second auto-refresh
  useEffect(() => {
    const fetchControlsData = async () => {
      if (!db || !user) return

      try {
        setLoading(true)

        // Get user's accessible locations
        let locationData: Location[] = []

        if (user.roles?.includes("admin") || user.roles?.includes("devops")) {
          // Admin users see all locations
          const locationsQuery = query(collection(db, "locations"))
          const snapshot = await getDocs(locationsQuery)
          locationData = snapshot.docs.map((doc) => ({
            id: doc.data().id || doc.id,
            ...doc.data(),
          })) as Location[]
        } else {
          // Regular users see only assigned locations
          if (user.assignedLocations && user.assignedLocations.length > 0) {
            const locationsQuery = query(collection(db, "locations"))
            const snapshot = await getDocs(locationsQuery)
            locationData = snapshot.docs
              .filter((doc) => user.assignedLocations?.includes(doc.data().id))
              .map((doc) => ({
                id: doc.data().id || doc.id,
                ...doc.data(),
              })) as Location[]
          }
        }

        setLocations(locationData)

        // Fetch control data for all locations at once using the fixed API
        const locationIds = locationData.map(loc => loc.id)
        const allEquipmentData = await fetchControlData(locationIds)

        // Fetch equipment summaries for each location
        const summaries: EquipmentSummary[] = []

        for (const location of locationData) {
          try {
            // Get equipment for this location
            const equipmentQuery = query(collection(db, "equipment"), where("locationId", "==", location.id))
            const equipmentSnapshot = await getDocs(equipmentQuery)
            const equipment = equipmentSnapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            })) as Equipment[]

            // Filter equipment data for this location
            const locationEquipmentData: Record<string, EquipmentData> = {}
            Object.entries(allEquipmentData).forEach(([equipmentId, data]) => {
              if (data.locationId === location.id) {
                locationEquipmentData[equipmentId] = data
              }
            })

            // Calculate metrics from equipment data
            let onlineCount = 0
            let totalSupplyTemp = 0
            let supplyTempCount = 0
            let totalAmps = 0
            let ampsCount = 0

            Object.values(locationEquipmentData).forEach(data => {
              if (data.liveMetrics) {
                onlineCount++
                
                if (data.liveMetrics.supplyTemp) {
                  totalSupplyTemp += data.liveMetrics.supplyTemp
                  supplyTempCount++
                }
                
                if (data.liveMetrics.amps) {
                  totalAmps += data.liveMetrics.amps
                  ampsCount++
                }
              }
            })

            // Get alarms for this location
            const alarmsQuery = query(
              collection(db, "alarms"),
              where("locationId", "==", location.id),
              where("active", "==", true),
            )
            const alarmsSnapshot = await getDocs(alarmsQuery)

            // Calculate equipment by type - FIXED: Safe type access
            const equipmentByType: Record<string, number> = {}
            equipment.forEach((eq) => {
              const type = eq.type || eq.equipmentType || "Other"
              equipmentByType[type] = (equipmentByType[type] || 0) + 1
            })

            summaries.push({
              locationId: location.id,
              locationName: location.name,
              totalEquipment: equipment.length,
              equipmentByType,
              onlineCount,
              offlineCount: equipment.length - onlineCount,
              alarmCount: alarmsSnapshot.docs.length,
              avgSupplyTemp: supplyTempCount > 0 ? Math.round((totalSupplyTemp / supplyTempCount) * 10) / 10 : undefined,
              avgSpaceTemp: 70 + Math.random() * 6, // Still mock - would need zone temp sensors
              totalAmps: ampsCount > 0 ? Math.round(totalAmps * 10) / 10 : undefined,
              equipment,
              equipmentData: locationEquipmentData,
            })
          } catch (error) {
            console.error(`Error fetching data for location ${location.id}:`, error)
          }
        }

        setEquipmentSummaries(summaries)
      } catch (error) {
        console.error("Error fetching controls data:", error)
        setError("Failed to load controls data")
      } finally {
        setLoading(false)
      }
    }

    // Initial fetch
    fetchControlsData()

    // Set up 60-second auto-refresh
    const refreshInterval = setInterval(() => {
      console.log("🔄 Auto-refreshing equipment data...")
      fetchControlsData()
    }, 60000) // 60 seconds

    // Cleanup interval on component unmount
    return () => {
      clearInterval(refreshInterval)
    }
  }, [db, user])

  // Get equipment type icon - FIXED: Safe type access
  const getEquipmentTypeIcon = (type: string) => {
    const typeLower = (type || "").toLowerCase()
    if (typeLower.includes("boiler") || typeLower.includes("heating")) return Flame
    if (
      typeLower.includes("fan") ||
      typeLower.includes("air") ||
      typeLower.includes("ahu") ||
      typeLower.includes("handler")
    )
      return Fan
    if (typeLower.includes("pump") || typeLower.includes("geothermal") || typeLower.includes("heat pump"))
      return Droplets
    if (typeLower.includes("chiller") || typeLower.includes("cooling")) return Gauge
    return Building
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#14b8a6] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading equipment controls...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Controls</h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Equipment Controls</h1>
            <p className="text-gray-600 mt-1">Manage and monitor HVAC equipment across all locations</p>
          </div>
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            className="border-[#14b8a6] text-[#14b8a6] hover:bg-[#14b8a6]/10"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Equipment Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-[#14b8a6]/20 bg-[#14b8a6]/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#14b8a6]">Total Equipment</p>
                  <p className="text-2xl font-bold text-[#14b8a6]">
                    {equipmentSummaries.reduce((sum, loc) => sum + loc.totalEquipment, 0)}
                  </p>
                </div>
                <Building className="w-8 h-8 text-[#14b8a6]" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-700">Online</p>
                  <p className="text-2xl font-bold text-green-700">
                    {equipmentSummaries.reduce((sum, loc) => sum + loc.onlineCount, 0)}
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-700">Active Alarms</p>
                  <p className="text-2xl font-bold text-red-700">
                    {equipmentSummaries.reduce((sum, loc) => sum + loc.alarmCount, 0)}
                  </p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-700">Avg Supply Temp</p>
                  <p className="text-2xl font-bold text-blue-700">
                    {Math.round(
                      (equipmentSummaries.reduce((sum, loc) => sum + (loc.avgSupplyTemp || 0), 0) /
                        equipmentSummaries.length) *
                        10,
                    ) / 10}
                    °F
                  </p>
                </div>
                <Thermometer className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Equipment Details Table */}
        {equipmentSummaries.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Building className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Equipment Found</h3>
              <p className="text-gray-500">No equipment data available for your assigned locations.</p>
            </CardContent>
          </Card>
        ) : (
          equipmentSummaries.map((summary) => (
            <Card key={summary.locationId} className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5 text-[#14b8a6]" />
                  {summary.locationName}
                  <Badge
                    className={`ml-2 ${
                      summary.alarmCount > 0 ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"
                    }`}
                  >
                    {summary.alarmCount > 0 ? `${summary.alarmCount} Alarms` : "Normal"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Equipment</th>
                        <th className="text-left p-2">Live Inputs</th>
                        <th className="text-left p-2">User Commands</th>
                        <th className="text-left p-2">Control Outputs</th>
                        <th className="text-left p-2">Performance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.equipment.map((equipment) => {
                        const equipmentData = summary.equipmentData[equipment.id]
                        const controlOutputDisplay = formatControlOutput(equipment, equipmentData)
                        const Icon = getEquipmentTypeIcon(equipment.type || equipment.equipmentType)

                        return (
                          <tr key={equipment.id} className="border-b hover:bg-gray-50">
                            <td className="p-2">
                              <div className="flex items-center gap-2">
                                <Icon className="w-4 h-4 text-gray-500" />
                                <div>
                                  <div className="font-medium">{equipment.name}</div>
                                  <div className="text-xs text-gray-500">{equipment.type || equipment.equipmentType}</div>
                                  <div className="text-xs text-gray-400">{equipment.id}</div>
                                </div>
                              </div>
                            </td>
                            <td className="p-2">
                              <div className="space-y-1 text-xs">
                                {equipmentData?.liveMetrics?.supplyTemp && (
                                  <div>Supply: {equipmentData.liveMetrics.supplyTemp}°F</div>
                                )}
                                {equipmentData?.liveMetrics?.outdoorTemp && (
                                  <div>Outdoor: {equipmentData.liveMetrics.outdoorTemp}°F</div>
                                )}
                                <div className="text-green-600">
                                  {equipmentData?.liveMetrics ? "Online" : "Offline"}
                                </div>
                              </div>
                            </td>
                            <td className="p-2">
                              <div className="space-y-1 text-xs">
                                <div className="text-green-600">
                                  {equipmentData?.userCommands?.enabled !== false ? "Enabled" : "Disabled"}
                                </div>
                                {equipmentData?.userCommands?.supplyTempSetpoint && (
                                  <div>Setpoint: {equipmentData.userCommands.supplyTempSetpoint}°F</div>
                                )}
                                <div>Auto</div>
                              </div>
                            </td>
                            <td className="p-2">
                              <div className="space-y-1 text-xs">
                                {controlOutputDisplay.map((line, idx) => (
                                  <div key={idx}>{line}</div>
                                ))}
                              </div>
                            </td>
                            <td className="p-2">
                              <div className="space-y-1 text-xs">
                                <div>Efficiency: {85 + Math.floor(Math.random() * 15)}%</div>
                                <div className="text-green-600">Normal</div>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                  <Button
                    onClick={() => router.push(`/dashboard/location/${summary.locationId}`)}
                    className="bg-[#14b8a6] hover:bg-[#14b8a6]/90 text-white"
                    size="sm"
                  >
                    Control Systems
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                  <Button
                    onClick={() => router.push(`/dashboard/controls?locationId=${summary.locationId}`)}
                    variant="outline"
                    className="border-[#14b8a6] text-[#14b8a6] hover:bg-[#14b8a6]/10"
                    size="sm"
                  >
                    <Settings className="w-4 h-4 mr-1" />
                    Settings
                  </Button>
                  <Button
                    onClick={() => router.push(`/dashboard/analytics?locationId=${summary.locationId}`)}
                    variant="outline"
                    className="text-xs"
                    size="sm"
                  >
                    <TrendingUp className="w-3 h-3 mr-1" />
                    Analytics
                  </Button>
                  <Button
                    onClick={() => router.push(`/dashboard/alarms?locationId=${summary.locationId}`)}
                    variant="outline"
                    className="text-xs"
                    size="sm"
                  >
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Alarms
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
