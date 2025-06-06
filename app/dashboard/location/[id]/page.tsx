// app/dashboard/location/[id]/page.tsx - Enhanced Location Details with Priority Ordering and EST Time
"use client"

import { useParams, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    ChevronLeft,
    RefreshCw,
    Building,
    Fan,
    Flame,
    Droplets,
    Settings,
    Snowflake,
    Thermometer,
    Zap,
    Gauge,
    Clock,
    Sliders,
    ToggleLeft,
    AlertTriangle,
    Wind,
    ExternalLink
} from "lucide-react"
import { useLocationMetrics } from "@/lib/hooks/use-location-metrics"
import { useFirebase } from "@/lib/firebase-context"
import { collection, query, where, getDocs } from "firebase/firestore"

// Define proper types for equipment metrics
interface EquipmentMetrics {
    equipmentId: string
    isOnline?: boolean
    lastUpdated?: string
    metrics?: Record<string, { value: any; unit?: string }>
    zone?: string
    IsLead?: boolean | number | string
    isLead?: boolean | number | string
    Lead?: boolean | number | string
    [key: string]: any // Allow additional properties
}

export default function LocationDetailPage() {
    const params = useParams()
    const router = useRouter()
    const locationId = params?.id as string
    const { db } = useFirebase()

    // State for location and equipment data
    const [locationName, setLocationName] = useState<string>("")
    const [equipmentNames, setEquipmentNames] = useState<Record<string, { name: string; type: string }>>({})
    const [loading, setLoading] = useState(true)

    // Fetch location name and equipment names
    useEffect(() => {
        async function fetchLocationAndEquipmentData() {
            if (!db || !locationId) return

            try {
                // Fetch location name
                const locationsQuery = query(
                    collection(db, "locations"),
                    where("id", "==", locationId)
                )
                const locationSnapshot = await getDocs(locationsQuery)

                if (!locationSnapshot.empty) {
                    const locationDoc = locationSnapshot.docs[0]
                    setLocationName(locationDoc.data().name || `Location ${locationId}`)
                }

                // Fetch equipment names for this location using numeric locationId
                const equipmentQuery = query(
                    collection(db, "equipment"),
                    where("locationId", "==", locationId)
                )
                const equipmentSnapshot = await getDocs(equipmentQuery)

                const equipmentMap: Record<string, { name: string; type: string }> = {}
                equipmentSnapshot.docs.forEach(doc => {
                    const data = doc.data()
                    equipmentMap[doc.id] = {
                        name: data.name || data.system || doc.id,
                        type: data.type || "Equipment"
                    }
                })
                setEquipmentNames(equipmentMap)

            } catch (error) {
                console.error("Error fetching location/equipment data:", error)
            } finally {
                setLoading(false)
            }
        }

        fetchLocationAndEquipmentData()
    }, [db, locationId])

    const { data, loading: isLoading, error } = useLocationMetrics(locationId)
    const equipment: EquipmentMetrics[] = data?.equipment || []
    const lastUpdated = data?.summary?.lastUpdated

    if (isLoading || loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading location details...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-red-600 text-lg font-semibold mb-2">Error Loading Data</div>
                    <p className="text-gray-600 mb-4">{error}</p>
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
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push("/dashboard")}
                            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Back
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                {locationName || `Location ${locationId}`}
                            </h1>
                            <p className="text-gray-500">Real-time Equipment Metrics</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {lastUpdated && (
                            <div className="text-sm text-gray-500">
                                Last updated: {new Date(lastUpdated).toLocaleTimeString()}
                            </div>
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.location.reload()}
                            className="flex items-center gap-2"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Refresh
                        </Button>
                    </div>
                </div>

                {equipment.length === 0 ? (
                    <div className="mt-8 text-center py-12">
                        <Building className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No Equipment Found</h3>
                        <p className="text-gray-500">No equipment data available for this location.</p>
                        <div className="mt-4 text-sm text-gray-400">
                            <p>Location ID: {locationId}</p>
                            <p>Equipment loaded: {equipment.length}</p>
                        </div>
                    </div>
                ) : (
                    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {equipment
                            .sort((a, b) => {
                                // Get display names for sorting - use equipmentNames lookup or equipmentId as fallback
                                const nameA = equipmentNames[a.equipmentId]?.name || a.equipmentId
                                const nameB = equipmentNames[b.equipmentId]?.name || b.equipmentId

                                // Sort alphabetically by equipment name
                                return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' })
                            })
                            .map((item) => (
                                <EquipmentCard
                                    key={item.equipmentId}
                                    equipment={item}
                                    equipmentInfo={equipmentNames[item.equipmentId]}
                                    locationId={locationId}
                                />
                            ))}
                    </div>
                )}
            </div>
        </div>
    )
}

interface EquipmentCardProps {
    equipment: EquipmentMetrics
    equipmentInfo?: { name: string; type: string }
    locationId: string
}

function EquipmentCard({ equipment, equipmentInfo, locationId }: EquipmentCardProps) {
    const router = useRouter()

    // Debug log to see what metrics are actually available
    console.log('Equipment metrics for', equipment.equipmentId, ':', equipment.metrics)

    // Get equipment name and type from Firestore data or fallback to equipmentId
    const equipmentName = equipmentInfo?.name || equipment.equipmentId

    const equipmentType = equipmentInfo?.type || "Equipment"

    // *** GET ZONE FROM EQUIPMENT DATA ***
    const equipmentZone = equipment.zone

    // Handle view controls click
    const handleViewControls = () => {
        router.push(`/dashboard/controls?locationId=${locationId}&equipmentId=${equipment.equipmentId}`)
    }

    // Priority ordering for metrics display - UPDATED TO EXCLUDE LEAD/LAG/ENABLED/CUSTOM LOGIC
    const getSortedMetrics = (metrics: Record<string, any>) => {
        const metricPriorities = [
            // 1. Firing Rate (highest priority)
            'firing', 'firingrate', 'firing_rate',

            // 2. Running/Status
            'status', 'running', 'fanstatus', 'pumpstatus', 'pump_status', 'fan_status', 'hwpump1status',

            // 3. Current (Amps)
            'current', 'amps', 'fanamps', 'pumpamps', 'fan_amps', 'pump_amps', 'hwpump1amps',

            // 4. Outdoor Temperature
            'outdoor', 'outdoortemp', 'outdoor_temp', 'outdoorair', 'outdoor_air', 'outdoorairtemp', 'outdoorairtemperature',

            // 5. Supply Temperature
            'supply', 'supplytemp', 'supply_temp', 'supplytemperature', 'h20supply', 'h2osupply', 'h2o_supply',

            // 6. Setpoints (Temperature, Water Temperature)
            'setpoint', 'temperaturesetpoint', 'temperature_setpoint', 'watertemperaturesetpoint', 'water_temperature_setpoint', 'tempsetpoint', 'temp_setpoint',

            // 7. Space Temperature (all room types)
            'spacetemp', 'space_temp', 'spacetemperature', 'covetemp', 'kitchentemp', 'mailroomtemp', 'chapeltemp', 'vestibuletemp', 'natatoriumtemp', 'beautytemp',

            // 8. Return Temperature
            'return', 'returntemp', 'return_temp', 'returntemperature', 'h20return', 'h2oreturn', 'h2o_return', 'cw_return', 'cwreturn',

            // 9. Mixed Air
            'mixed', 'mixedair', 'mixed_air', 'mixedairtemp', 'mixed_air_temp',

            // 10. OA Actuator
            'oa', 'oaactuator', 'oa_actuator', 'oadamper', 'oa_damper',

            // 11. HW Actuator
            'hw', 'hwactuator', 'hw_actuator',

            // 12. CW Actuator
            'cw', 'cwactuator', 'cw_actuator', 'cw_supply', 'cwsupply',

            // 13. Static Pressure
            'pressure', 'staticpressure', 'static_pressure', 'buildingpressure', 'building_pressure', 'ductpressure', 'duct_pressure', 'ductstatic', 'duct_static',

            // 14. Temperature Source
            'temperaturesource', 'temperature_source', 'tempsource', 'temp_source',

            // 15. Runtime
            'runtime', 'run_time', 'totalruntime', 'total_runtime'
        ]

        // Filter out Lead/Lag, Enabled, and Custom Logic metrics
        const excludedKeys = [
            'islead', 'lead', 'islag', 'lag', 
            'enabled', 'isenabled', 'enable',
            'customlogicenabled', 'custom_logic_enabled', 'customlogic', 'custom_logic'
        ]

        return Object.entries(metrics)
            .filter(([key]) => !excludedKeys.some(excluded => key.toLowerCase().includes(excluded)))
            .sort(([keyA], [keyB]) => {
                const keyALower = keyA.toLowerCase()
                const keyBLower = keyB.toLowerCase()

                const priorityA = metricPriorities.findIndex(p => keyALower.includes(p))
                const priorityB = metricPriorities.findIndex(p => keyBLower.includes(p))

                // If both found in priority list, sort by priority
                if (priorityA !== -1 && priorityB !== -1) {
                    return priorityA - priorityB
                }

                // If only one found in priority list, prioritize it
                if (priorityA !== -1) return -1
                if (priorityB !== -1) return 1

                // If neither found, maintain original order
                return 0
            })
    }

    // Get equipment icon based on name and type
    const getEquipmentIcon = () => {
        const nameType = `${equipmentName} ${equipmentType}`.toLowerCase()

        if (nameType.includes('fancoil') || nameType.includes('fan coil') || nameType.includes('ahu') || nameType.includes('air handler')) {
            return <Fan className="w-5 h-5 text-blue-600" />
        }
        if (nameType.includes('boiler') || nameType.includes('comfort')) {
            return <Flame className="w-5 h-5 text-orange-600" />
        }
        if (nameType.includes('pump') && (nameType.includes('hw') || nameType.includes('hot') || nameType.includes('comfort'))) {
            return <Droplets className="w-5 h-5 text-red-600" />
        }
        if (nameType.includes('pump')) {
            return <Settings className="w-5 h-5 text-cyan-600" />
        }
        if (nameType.includes('chiller')) {
            return <Snowflake className="w-5 h-5 text-blue-600" />
        }
        return <Building className="w-5 h-5 text-gray-600" />
    }

    // Get metric icon based on metric key and equipment type
    const getMetricIcon = (key: string, value: any) => {
        const keyLower = key.toLowerCase()
        const equipmentTypeLower = `${equipmentName} ${equipmentType}`.toLowerCase()

        // Firing rate with animation (for boilers)
        if (keyLower.includes('firing')) {
            const isActive = value === true || value === 1 || value === "on" || value === "true" || (typeof value === 'number' && value > 0)
            return (
                <Flame
                    className={`w-4 h-4 ${isActive ? 'text-orange-500 animate-pulse' : 'text-gray-400'}`}
                    style={isActive ? { animationDuration: '1000ms' } : {}}
                />
            )
        }

        // Status icons based on equipment type
        if (keyLower.includes('status')) {
            const isRunning = value === true || value === 1 || value === "on" || value === "true" || value === "running"

            // Pump Status - spinning cog
            if (keyLower.includes('pump')) {
                return (
                    <Settings
                        className={`w-4 h-4 ${isRunning ? 'text-blue-500 animate-spin' : 'text-gray-400'}`}
                        style={isRunning ? { animationDuration: '2000ms' } : {}}
                    />
                )
            }

            // Fan Status - animated WIND icon for air handlers and fan coils
            if (keyLower.includes('fan') || equipmentTypeLower.includes('fancoil') || equipmentTypeLower.includes('fan coil') || equipmentTypeLower.includes('ahu') || equipmentTypeLower.includes('air handler')) {
                return (
                    <Wind
                        className={`w-4 h-4 ${isRunning ? 'text-blue-500 animate-pulse' : 'text-gray-400'}`}
                        style={isRunning ? { animationDuration: '1500ms' } : {}}
                    />
                )
            }

            // Default status for other equipment
            return (
                <Settings
                    className={`w-4 h-4 ${isRunning ? 'text-blue-500 animate-spin' : 'text-gray-400'}`}
                    style={isRunning ? { animationDuration: '2000ms' } : {}}
                />
            )
        }

        // Temperature fields
        if (keyLower.includes('temp') || keyLower.includes('air') ||
            keyLower.includes('h2o') || keyLower.includes('h20') ||
            keyLower.includes('supply') || keyLower.includes('return') ||
            keyLower.includes('mixed') || keyLower.includes('setpoint')) {
            return <Thermometer className="w-4 h-4 text-orange-500" />
        }

        // Current/Amps
        if (keyLower.includes('current') || keyLower.includes('amp')) {
            return <Zap className="w-4 h-4 text-yellow-500" />
        }

        // Pressure
        if (keyLower.includes('pressure')) {
            return <Gauge className="w-4 h-4 text-blue-500" />
        }

        // Runtime
        if (keyLower.includes('runtime')) {
            return <Clock className="w-4 h-4 text-blue-500" />
        }

        // Actuators and Dampers
        if (keyLower.includes('actuator') || keyLower.includes('damper')) {
            return <Sliders className="w-4 h-4 text-purple-500" />
        }

        // Humidity
        if (keyLower.includes('humidity') || keyLower.includes('rh')) {
            return <Droplets className="w-4 h-4 text-blue-500" />
        }

        return <Gauge className="w-4 h-4 text-gray-500" />
    }

    // Get readable metric label
    const getMetricLabel = (key: string) => {
        const keyLower = key.toLowerCase()

        // Setpoint mappings
        if (keyLower === 'setpoint') return 'Setpoint'
        if (keyLower === 'temperaturesetpoint') return 'Temperature Setpoint'
        if (keyLower === 'watertemperaturesetpoint') return 'Water Temperature Setpoint'
        if (keyLower === 'tempsetpoint') return 'Temp Setpoint'

        // Temperature mappings
        if (key === 'H20Supply' || key === 'H2OSupply') return 'H20 Supply'
        if (key === 'H20Return' || key === 'H2OReturn') return 'H20 Return'
        if (keyLower === 'supplytemp') return 'Supply Temp'
        if (keyLower === 'spacetemp') return 'Space Temp'
        if (keyLower === 'covetemp') return 'Cove Temp'
        if (keyLower === 'kitchentemp') return 'Kitchen Temp'
        if (keyLower === 'mailroomtemp') return 'Mail Room Temp'
        if (keyLower === 'chapeltemp') return 'Chapel Temp'
        if (keyLower === 'vestibuletemp') return 'Vestibule Temp'
        if (keyLower === 'natatoriumtemp') return 'Natatorium Temp'
        if (keyLower === 'beautytemp') return 'Beauty Temp'
        if (keyLower === 'averagetemp') return 'Average Temp'

        // Actuator mappings
        if (keyLower === 'oadamper') return 'OA Damper'
        if (keyLower === 'hwactuator') return 'HW Actuator'
        if (keyLower === 'cwactuator') return 'CW Actuator'
        if (keyLower === 'oaactuator') return 'OA Actuator'

        // Humidity
        if (keyLower === 'humidity' || keyLower === 'rh') return 'Humidity'

        // Convert camelCase to readable format
        return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).replace(/_/g, ' ')
    }

    // Format metric values
    const formatValue = (key: string, value: any) => {
        if (value === null || value === undefined) return 'N/A'

        if (typeof value === 'number') {
            // Runtime formatting
            if (key.toLowerCase().includes('runtime') && value > 3600) {
                const hours = Math.floor(value / 3600)
                const minutes = Math.floor((value % 3600) / 60)
                return `${hours}h ${minutes}m`
            }
            return value.toFixed(1)
        }
        if (typeof value === 'boolean') {
            return value ? 'On' : 'Off'
        }
        return String(value)
    }

    // Get status info
    const getStatusInfo = () => {
        const online = equipment.isOnline !== false
        return {
            online,
            badge: online ? 'Online' : 'Offline',
            className: online
                ? 'bg-teal-50 text-teal-800 border border-teal-200'
                : 'bg-orange-50 text-orange-800 border border-orange-200'
        }
    }

    const statusInfo = getStatusInfo()

    // *** NEW: Check for Lead/Lag status ***
    const getLeadLagStatus = () => {
        // Debug logging
        console.log('Checking Lead/Lag for', equipment.equipmentId, {
            IsLead: equipment.IsLead,
            isLead: equipment.isLead,
            Lead: equipment.Lead,
            metrics: equipment.metrics
        })

        // Check equipment-level properties first
        const isLead = equipment.IsLead === true || equipment.isLead === true ||
            equipment.Lead === true || equipment.IsLead === 1 ||
            equipment.isLead === 1 || equipment.Lead === 1 ||
            equipment.IsLead === "on" || equipment.isLead === "on" || equipment.Lead === "on" ||
            equipment.IsLead === "true" || equipment.isLead === "true" || equipment.Lead === "true"

        if (isLead) {
            return { status: 'Lead', className: 'bg-yellow-50 text-yellow-800 border border-yellow-200' }
        }

        // Check for lead in metrics
        if (equipment.metrics) {
            const leadKeys = ['islead', 'lead', 'IsLead', 'Lead']
            const foundLeadKey = leadKeys.find(key => equipment.metrics![key] !== undefined)
            
            if (foundLeadKey) {
                const leadValue = equipment.metrics[foundLeadKey].value
                const isLeadFromMetrics = leadValue === true || leadValue === 1 || leadValue === "on" || leadValue === "true"
                
                if (isLeadFromMetrics) {
                    return { status: 'Lead', className: 'bg-yellow-50 text-yellow-800 border border-yellow-200' }
                }
            }
        }

        // Check for lag in metrics
        if (equipment.metrics) {
            const lagKeys = ['islag', 'lag', 'IsLag', 'Lag']
            const foundLagKey = lagKeys.find(key => equipment.metrics![key] !== undefined)
            
            if (foundLagKey) {
                const lagValue = equipment.metrics[foundLagKey].value
                const isLag = lagValue === true || lagValue === 1 || lagValue === "on" || lagValue === "true"
                
                if (isLag) {
                    return { status: 'Lag', className: 'bg-purple-50 text-purple-800 border border-purple-200' }
                }
            }
        }

        return null
    }

    const leadLagStatus = getLeadLagStatus()

    // *** NEW: Check for Is Enabled status ***
    const getEnabledStatus = () => {
        // Debug logging
        console.log('Checking Enabled for', equipment.equipmentId, 'metrics:', equipment.metrics)
        
        if (!equipment.metrics) return null

        const enabledKeys = ['enabled', 'isenabled', 'enable', 'Enabled', 'IsEnabled', 'Enable']
        const foundKey = enabledKeys.find(key => equipment.metrics![key] !== undefined)

        console.log('Found enabled key:', foundKey, 'value:', foundKey ? equipment.metrics![foundKey] : 'none')

        if (!foundKey) return null

        const enabledValue = equipment.metrics[foundKey].value
        const isEnabled = enabledValue === true || enabledValue === 1 || enabledValue === "on" || enabledValue === "true"

        return {
            status: isEnabled ? 'Enabled' : 'Disabled',
            className: isEnabled 
                ? 'bg-green-50 text-green-800 border border-green-200' 
                : 'bg-gray-50 text-gray-800 border border-gray-200'
        }
    }

    const enabledStatus = getEnabledStatus()

    // Check for FreezeStat status
    const getFreezeStat = () => {
        if (!equipment.metrics) {
            return { status: 'Normal', className: 'bg-teal-50 text-teal-800 border border-teal-200' }
        }

        const freezeStatKeys = ['freezestat', 'freeze_stat', 'freezealarm', 'freeze_alarm']
        const foundKey = freezeStatKeys.find(key => equipment.metrics![key] !== undefined)

        if (!foundKey) {
            return { status: 'Normal', className: 'bg-teal-50 text-teal-800 border border-teal-200' }
        }

        const freezeStatValue = equipment.metrics[foundKey].value

        if (freezeStatValue === true || freezeStatValue === 1 || freezeStatValue === "alarm" || freezeStatValue === "active") {
            return { status: 'Alarm', className: 'bg-orange-50 text-orange-800 border border-orange-200' }
        }
        return { status: 'Normal', className: 'bg-teal-50 text-teal-800 border border-teal-200' }
    }

    const freezeStat = getFreezeStat()

    return (
        <Card className="hover:shadow-lg hover:scale-[1.02] transition-all duration-200 border-l-4 border-l-teal-400">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {getEquipmentIcon()}
                        <div>
                            <CardTitle className="text-lg font-semibold text-gray-900">
                                {equipmentName}
                            </CardTitle>
                            <CardDescription className="text-sm text-gray-600">
                                {equipmentType} • {equipment.equipmentId}
                            </CardDescription>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* *** NEW: Lead/Lag Status Pill *** */}
                        {leadLagStatus && (
                            <Badge className={`${leadLagStatus.className} text-xs`}>
                                {leadLagStatus.status}
                            </Badge>
                        )}
                        
                        {/* *** NEW: Enabled Status Pill *** */}
                        {enabledStatus && (
                            <Badge className={`${enabledStatus.className} text-xs`}>
                                {enabledStatus.status}
                            </Badge>
                        )}
                        
                        {/* *** ZONE INDICATOR PILL *** */}
                        {equipmentZone && (
                            <Badge className="bg-blue-50 text-blue-800 border border-blue-200 text-xs flex items-center gap-1">
                                <Building className="w-3 h-3" />
                                {equipmentZone}
                            </Badge>
                        )}
                        
                        <Badge className={`${freezeStat.className} text-xs flex items-center gap-1`}>
                            <AlertTriangle className="w-3 h-3" />
                            {freezeStat.status}
                        </Badge>
                        
                        <Badge className={`${statusInfo.className} text-xs flex items-center gap-1`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${statusInfo.online ? 'bg-teal-500 animate-pulse' : 'bg-orange-500'}`}></div>
                            {statusInfo.badge}
                        </Badge>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="pt-0">
                <div className="space-y-3">
                    {getSortedMetrics(equipment.metrics || {})
                        .slice(0, 10) // *** INCREASED FROM 8 TO 10 ***
                        .map(([key, metricValue]) => (
                            <div key={key} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 px-2 rounded transition-colors">
                                <div className="flex items-center gap-2">
                                    {getMetricIcon(key, metricValue.value)}
                                    <span className="text-sm font-medium text-gray-700">
                                        {getMetricLabel(key)}
                                    </span>
                                </div>
                                <span className="text-sm font-semibold text-gray-900 hover:text-teal-600 transition-colors">
                                    {formatValue(key, metricValue.value)}
                                    {metricValue.unit && ` ${metricValue.unit}`}
                                </span>
                            </div>
                        ))}
                </div>

                {/* View Controls Button */}
                <div className="mt-4 pt-3 border-t border-gray-100">
                    <Button
                        onClick={handleViewControls}
                        className="w-full bg-[#14b8a6] hover:bg-[#14b8a6]/90 text-white font-medium transition-all duration-200 flex items-center justify-center gap-2"
                    >
                        <Settings className="w-4 h-4" />
                        View Controls
                        <ExternalLink className="w-3 h-3" />
                    </Button>
                </div>

                {equipment.lastUpdated && (
                    <div className="mt-3">
                        <p className="text-xs text-gray-500">
                            Last updated: {new Date(equipment.lastUpdated).toLocaleString('en-US', {
                                timeZone: 'America/New_York',
                                month: 'numeric',
                                day: 'numeric',
                                year: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true
                            })}
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
