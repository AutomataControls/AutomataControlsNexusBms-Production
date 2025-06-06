// app/dashboard/controls/page.tsx - Dynamic Equipment Controls Router
"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { useState, useEffect, Suspense, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  AlertTriangle,
  Loader2,
  Wind,
  Thermometer,
  Gauge
} from "lucide-react"
import { useFirebase } from "@/lib/firebase-context"
import { useAuth } from "@/lib/auth-context"
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore"
import { useLocationMetrics } from "@/lib/hooks/use-location-metrics"

// Import control components (we'll create these next)
import { BoilerControls } from "@/components/controls/boiler-controls"
import { AirHandlerControls } from "@/components/controls/air-handler-controls"
import { FanCoilControls } from "@/components/controls/fan-coil-controls"
import { PumpControls } from "@/components/controls/pump-controls"
import { ChillerControls } from "@/components/controls/chiller-controls"
import { ActuatorControls } from "@/components/controls/actuator-controls"
import { ExhaustFanControls } from "@/components/controls/exhaust-fan-controls"
import { HeatingSystemControls } from "@/components/controls/heating-system-controls"
import { CoolingSystemControls } from "@/components/controls/cooling-system-controls"
import { DOASControls } from "@/components/controls/doas-controls"
import { RTUControls } from "@/components/controls/rtu-controls"
import { SpecializedControls } from "@/components/controls/specialized-controls"
import { DefaultControls } from "@/components/controls/default-controls"

interface EquipmentInfo {
  id: string
  name: string
  type: string
  system: string
  locationId: string
  locationName: string
  [key: string]: any
}

interface EquipmentMetrics {
  [key: string]: {
    value: any
    unit?: string
    timestamp?: string
  }
}

function ControlsPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { db } = useFirebase()
  const { user } = useAuth()

  const locationId = searchParams.get("locationId")
  const equipmentId = searchParams.get("equipmentId")

  const [equipmentInfo, setEquipmentInfo] = useState<EquipmentInfo | null>(null)
  const [equipmentMetrics, setEquipmentMetrics] = useState<EquipmentMetrics>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>("")
  const [refreshKey, setRefreshKey] = useState(0) // Force re-fetch without page reload

  // Get live metrics for this location
  const { data: locationData, loading: metricsLoading, refetch } = useLocationMetrics(locationId || "", refreshKey)

  // *** FIXED: Prevent double triggering that causes 9000+ API calls ***
  const handleUpdate = useCallback(() => {
    console.log('handleUpdate called - refreshing data without page reload')
    // Use ONLY refetch to avoid creating multiple hook instances
    if (refetch) {
      refetch()
    } else {
      console.warn('refetch not available, falling back to refreshKey')
      setRefreshKey(prev => prev + 1)
    }
  }, [refetch])

  // Fetch equipment information from Firestore
  useEffect(() => {
    async function fetchEquipmentInfo() {
      if (!db || !equipmentId || !locationId) {
        setError("Missing required parameters")
        setLoading(false)
        return
      }

      try {
        setLoading(true)

        // Get equipment document
        const equipmentDoc = await getDoc(doc(db, "equipment", equipmentId))

        if (!equipmentDoc.exists()) {
          setError("Equipment not found")
          setLoading(false)
          return
        }

        const equipmentData = equipmentDoc.data()

        // Get location name
        const locationsQuery = query(
          collection(db, "locations"),
          where("id", "==", locationId)
        )
        const locationSnapshot = await getDocs(locationsQuery)
        const locationName = locationSnapshot.empty ?
          `Location ${locationId}` :
          locationSnapshot.docs[0].data().name

        // Combine equipment info
        const info: EquipmentInfo = {
          id: equipmentId,
          name: equipmentData.name || equipmentData.system || equipmentId,
          type: equipmentData.type || "Equipment",
          system: equipmentData.system || equipmentData.name || equipmentId,
          locationId: locationId,
          locationName: locationName,
          ...equipmentData
        }

        setEquipmentInfo(info)

      } catch (error) {
        console.error("Error fetching equipment info:", error)
        setError("Failed to load equipment information")
      } finally {
        setLoading(false)
      }
    }

    fetchEquipmentInfo()
  }, [db, equipmentId, locationId])

  // Extract metrics for this specific equipment
  useEffect(() => {
    if (locationData?.equipment && equipmentId) {
      const equipment = locationData.equipment.find(eq => eq.equipmentId === equipmentId)
      if (equipment?.metrics) {
        setEquipmentMetrics(equipment.metrics)
      }
    }
  }, [locationData, equipmentId])

  // Determine equipment type and return appropriate icon
  const getEquipmentIcon = (type: string, name: string) => {
    const combined = `${type} ${name}`.toLowerCase()

    // Heating Systems (Boilers, Baseboard, Steam)
    if (combined.includes('boiler') || combined.includes('comfort') ||
        combined.includes('baseboard') || combined.includes('steam') ||
        combined.includes('heating')) {
      return <Flame className="w-6 h-6 text-orange-600" />
    }

    // Air Handlers
    if (combined.includes('air handler') || combined.includes('ahu')) {
      return <Wind className="w-6 h-6 text-blue-600" />
    }

    // DOAS (Dedicated Outdoor Air Systems)
    if (combined.includes('doas') || combined.includes('dedicated outdoor air')) {
      return <Wind className="w-6 h-6 text-green-600" />
    }

    // RTU (Roof Top Units)
    if (combined.includes('rtu') || combined.includes('roof top') ||
        combined.includes('rooftop')) {
      return <Building className="w-6 h-6 text-purple-600" />
    }

    // Fan Coils
    if (combined.includes('fan coil') || combined.includes('fancoil')) {
      return <Fan className="w-6 h-6 text-blue-600" />
    }

    // Exhaust Fans
    if (combined.includes('exhaust') && combined.includes('fan')) {
      return <Fan className="w-6 h-6 text-gray-600" />
    }

    // Cooling Systems (Chillers, Cooling Towers)
    if (combined.includes('chiller') || combined.includes('cooling tower') ||
        combined.includes('cooling')) {
      return <Snowflake className="w-6 h-6 text-blue-600" />
    }

    // Pumps
    if (combined.includes('pump')) {
      const isHotWater = combined.includes('hw') || combined.includes('hot') ||
                        combined.includes('comfort') || combined.includes('heating')
      return <Droplets className={`w-6 h-6 ${isHotWater ? 'text-red-600' : 'text-cyan-600'}`} />
    }

    // Actuators
    if (combined.includes('actuator') || combined.includes('valve') ||
        combined.includes('damper')) {
      return <Settings className="w-6 h-6 text-purple-600" />
    }

    // Specialized (Greenhouse, etc.)
    if (combined.includes('greenhouse') || combined.includes('special')) {
      return <Thermometer className="w-6 h-6 text-green-600" />
    }

    return <Building className="w-6 h-6 text-gray-600" />
  }

  // Determine which control component to render
  const renderControls = () => {
    if (!equipmentInfo) return null

    const type = equipmentInfo.type.toLowerCase()
    const name = equipmentInfo.name.toLowerCase()
    const combined = `${type} ${name}`

    console.log(`Rendering controls for equipment type: "${type}", name: "${name}"`)

    // Heating Systems (Boilers, Baseboard, Steam Bundles)
    if (combined.includes('boiler')) {
      return (
        <BoilerControls
          equipmentInfo={equipmentInfo}
          metrics={equipmentMetrics}
          onUpdate={handleUpdate} // *** FIXED: Use new update handler ***
        />
      )
    }

    if (combined.includes('baseboard') || combined.includes('steam') ||
        (combined.includes('heating') && !combined.includes('air handler'))) {
      return (
        <HeatingSystemControls
          equipmentInfo={equipmentInfo}
          metrics={equipmentMetrics}
          onUpdate={handleUpdate} // *** FIXED: Use new update handler ***
        />
      )
    }

    // Air Handlers
    if (combined.includes('air handler') || combined.includes('ahu')) {
      return (
        <AirHandlerControls
          equipmentInfo={equipmentInfo}
          metrics={equipmentMetrics}
          onUpdate={handleUpdate} // *** FIXED: Use new update handler ***
        />
      )
    }

    // DOAS (Dedicated Outdoor Air Systems)
    if (combined.includes('doas') || combined.includes('dedicated outdoor air')) {
      return (
        <DOASControls
          equipmentInfo={equipmentInfo}
          metrics={equipmentMetrics}
          onUpdate={handleUpdate} // *** FIXED: Use new update handler ***
        />
      )
    }

    // RTU (Roof Top Units)
    if (combined.includes('rtu') || combined.includes('roof top') ||
        combined.includes('rooftop')) {
      return (
        <RTUControls
          equipmentInfo={equipmentInfo}
          metrics={equipmentMetrics}
          onUpdate={handleUpdate} // *** FIXED: Use new update handler ***
        />
      )
    }

    // Fan Coils
    if (combined.includes('fan coil') || combined.includes('fancoil')) {
      return (
        <FanCoilControls
          equipmentInfo={equipmentInfo}
          metrics={equipmentMetrics}
          onUpdate={handleUpdate} // *** FIXED: Use new update handler ***
        />
      )
    }

    // Exhaust Fans
    if (combined.includes('exhaust') && combined.includes('fan')) {
      return (
        <ExhaustFanControls
          equipmentInfo={equipmentInfo}
          metrics={equipmentMetrics}
          onUpdate={handleUpdate} // *** FIXED: Use new update handler ***
        />
      )
    }

    // Cooling Systems (Chillers, Cooling Towers)
    if (combined.includes('chiller') || combined.includes('cooling tower')) {
      return (
        <CoolingSystemControls
          equipmentInfo={equipmentInfo}
          metrics={equipmentMetrics}
          onUpdate={handleUpdate} // *** FIXED: Use new update handler ***
        />
      )
    }

    // Pumps
    if (combined.includes('pump')) {
      return (
        <PumpControls
          equipmentInfo={equipmentInfo}
          metrics={equipmentMetrics}
          onUpdate={handleUpdate} // *** FIXED: Use new update handler ***
        />
      )
    }

    // Actuators
    if (combined.includes('actuator') || combined.includes('valve') ||
        combined.includes('damper')) {
      return (
        <ActuatorControls
          equipmentInfo={equipmentInfo}
          metrics={equipmentMetrics}
          onUpdate={handleUpdate} // *** FIXED: Use new update handler ***
        />
      )
    }

    // Specialized Controls (Greenhouse, etc.)
    if (combined.includes('greenhouse') || combined.includes('special')) {
      return (
        <SpecializedControls
          equipmentInfo={equipmentInfo}
          metrics={equipmentMetrics}
          onUpdate={handleUpdate} // *** FIXED: Use new update handler ***
        />
      )
    }

    // Default controls for unknown equipment types
    return (
      <DefaultControls
        equipmentInfo={equipmentInfo}
        metrics={equipmentMetrics}
        onUpdate={handleUpdate} // *** FIXED: Use new update handler ***
      />
    )
  }

  // Get equipment status
  const getEquipmentStatus = () => {
    const equipment = locationData?.equipment?.find(eq => eq.equipmentId === equipmentId)
    const isOnline = equipment?.isOnline !== false

    return {
      online: isOnline,
      badge: isOnline ? 'Online' : 'Offline',
      className: isOnline
        ? 'bg-teal-50 text-teal-800 border border-teal-200'
        : 'bg-red-50 text-red-800 border border-red-200'
    }
  }

  // Loading state
  if (loading || metricsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading equipment controls...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !equipmentInfo) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Controls</h3>
          <p className="text-gray-600 mb-4">{error || "Equipment not found"}</p>
          <div className="space-x-2">
            <Button
              onClick={() => router.back()}
              variant="outline"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
            <Button onClick={handleUpdate}> {/* *** FIXED: Use handleUpdate instead of page reload *** */}
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const status = getEquipmentStatus()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/dashboard/location/${locationId}`)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to {equipmentInfo.locationName}
            </Button>
          </div>

          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleUpdate} // *** FIXED: Use handleUpdate instead of page reload ***
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Equipment Header Card */}
        <Card className="mb-8 border-l-4 border-l-teal-400">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {getEquipmentIcon(equipmentInfo.type, equipmentInfo.name)}
                <div>
                  <CardTitle className="text-2xl font-bold text-gray-900">
                    {equipmentInfo.name}
                  </CardTitle>
                  <div className="flex items-center gap-3 mt-2">
                    <Badge variant="outline" className="text-sm">
                      {equipmentInfo.type}
                    </Badge>
                    <Badge className={`${status.className} text-sm flex items-center gap-1`}>
                      <div className={`w-2 h-2 rounded-full ${status.online ? 'bg-teal-500 animate-pulse' : 'bg-red-500'}`}></div>
                      {status.badge}
                    </Badge>
                    <span className="text-sm text-gray-500">
                      ID: {equipmentInfo.id}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <p className="text-sm text-gray-500">Location</p>
                <p className="font-semibold text-gray-900">{equipmentInfo.locationName}</p>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Dynamic Controls Content */}
        <div className="space-y-6">
          {renderControls()}
        </div>

        {/* Debug Info (remove in production) */}
        {process.env.NODE_ENV === 'development' && (
          <Card className="mt-8 bg-gray-50">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-gray-700">Debug Info</CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-2">
              <p><strong>Equipment Type:</strong> {equipmentInfo.type}</p>
              <p><strong>Equipment Name:</strong> {equipmentInfo.name}</p>
              <p><strong>Combined String:</strong> {`${equipmentInfo.type} ${equipmentInfo.name}`.toLowerCase()}</p>
              <p><strong>Location ID:</strong> {equipmentInfo.locationId}</p>
              <p><strong>Equipment ID:</strong> {equipmentInfo.id}</p>
              <p><strong>Metrics Count:</strong> {Object.keys(equipmentMetrics).length}</p>
              <p><strong>Refresh Key:</strong> {refreshKey}</p>
              <details className="mt-2">
                <summary className="cursor-pointer font-medium">Available Metrics</summary>
                <pre className="mt-2 text-xs bg-white p-2 rounded border overflow-auto max-h-40">
                  {JSON.stringify(equipmentMetrics, null, 2)}
                </pre>
              </details>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

// Main component with Suspense wrapper
export default function ControlsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading controls...</p>
        </div>
      </div>
    }>
      <ControlsPageContent />
    </Suspense>
  )
}
