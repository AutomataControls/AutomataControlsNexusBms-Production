// @ts-nocheck
// lib/hooks/use-location-metrics.ts - Enhanced Hook with Zone Support & Performance Optimization
import { useState, useEffect, useCallback, useRef } from 'react'

export interface MetricValue {
  value: number | string | boolean
  timestamp: string
  unit?: string
  status?: 'normal' | 'warning' | 'alarm'
}

export interface EquipmentMetrics {
  equipmentId: string
  equipmentName: string
  equipmentType: string
  zone?: string  // *** ADDED ZONE FIELD ***
  isOnline: boolean
  lastUpdated: string
  metrics: Record<string, MetricValue>
  alarms?: string[]
}

export interface LocationMetricsData {
  locationId: string
  locationName: string
  equipment: EquipmentMetrics[]
  summary: {
    totalEquipment: number
    onlineEquipment: number
    activeAlarms: number
    lastUpdated: string
  }
}

export function useLocationMetrics(locationId: string, refreshInterval = 30000) {
  const [data, setData] = useState<LocationMetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Add concurrency control to prevent infinite loops
  const isLoadingRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const fetchLocationMetrics = useCallback(async () => {
    // Prevent multiple simultaneous calls
    if (isLoadingRef.current) {
      console.log('⏭️ Skipping fetch - already in progress')
      return
    }

    // Cancel previous request if still running
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    isLoadingRef.current = true
    abortControllerRef.current = new AbortController()
    
    try {
      setError(null)
      
      // Get recent equipment for this location from metrics table - BROADER QUERY
      const equipmentQuery = `
        SELECT DISTINCT
          "equipmentId",
          equipment_type,
          location_id,
          system,
          zone,
          time
        FROM metrics
        WHERE location_id = '${locationId}'
        AND time >= now() - INTERVAL '1 hour'
        ORDER BY time DESC
        LIMIT 50
      `

      // Use Next.js API proxy
      const equipmentResponse = await fetch('/api/influx', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: equipmentQuery }),
        signal: abortControllerRef.current.signal
      })

      const equipmentResult = await equipmentResponse.json()
      
      if (!equipmentResult.success) {
        throw new Error(equipmentResult.error || 'Failed to fetch equipment list')
      }

      const equipmentList = equipmentResult.data || []
      console.log('🔧 Found equipment:', equipmentList.length)

      // Group by equipmentId to get unique equipment
      const uniqueEquipment = new Map()
      equipmentList.forEach((row: any) => {
        if (row.equipmentId && !uniqueEquipment.has(row.equipmentId)) {
          uniqueEquipment.set(row.equipmentId, row)
        }
      })

      // PERFORMANCE FIX: Process equipment in controlled batches
      const equipmentArray = Array.from(uniqueEquipment.values())
      const batchSize = 8 // Optimal batch size for performance
      const equipmentMetrics: EquipmentMetrics[] = []

      for (let i = 0; i < equipmentArray.length; i += batchSize) {
        // Check if request was cancelled
        if (abortControllerRef.current?.signal.aborted) {
          throw new Error('Request cancelled')
        }

        const batch = equipmentArray.slice(i, i + batchSize)
        
        // Process batch concurrently with Promise.all
        const batchPromises = batch.map(async (equipment: any) => {
          try {
            // Get ALL metrics for this equipment - ENHANCED QUERY
            const metricsQuery = `
              SELECT *
              FROM metrics
              WHERE "equipmentId" = '${equipment.equipmentId}'
              AND location_id = '${locationId}'
              AND time >= now() - INTERVAL '15 minutes'
              ORDER BY time DESC
              LIMIT 1
            `

            const metricsResponse = await fetch('/api/influx', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ query: metricsQuery }),
              signal: abortControllerRef.current?.signal
            })

            const metricsResult = await metricsResponse.json()

            if (metricsResult.success && metricsResult.data && metricsResult.data.length > 0) {
              const latestData = metricsResult.data[0]
              
              // Process ALL available metrics dynamically
              const processedMetrics: Record<string, MetricValue> = {}
              
              // Skip system fields and process everything else - ADDED ZONE TO SKIP LIST
              const skipFields = ['equipmentId', 'location_id', 'time', 'equipment_type', 'system', 'zone']
              
              Object.entries(latestData).forEach(([key, value]) => {
                if (!skipFields.includes(key) && value !== null && value !== undefined && value !== '') {
                  // Smart unit detection
                  const keyLower = key.toLowerCase()
                  let unit = ''
                  
                  if (keyLower.includes('temp') || keyLower.includes('air')) {
                    unit = '°F'
                  } else if (keyLower.includes('current') || keyLower.includes('amp')) {
                    unit = 'A'
                  } else if (keyLower.includes('firing') || keyLower.includes('rate')) {
                    unit = '%'
                  } else if (keyLower.includes('pressure')) {
                    unit = 'PSI'
                  } else if (keyLower.includes('humidity') || keyLower.includes('rh')) {
                    unit = '%'
                  } else if (keyLower.includes('runtime')) {
                    unit = 'sec'
                  } else if (keyLower.includes('setpoint')) {
                    unit = '°F'
                  }

                  processedMetrics[key] = {
                    value: value,
                    timestamp: latestData.time || new Date().toISOString(),
                    unit: unit,
                    status: 'normal'
                  }
                }
              })

              const isOnline = Object.keys(processedMetrics).length > 0

              return {
                equipmentId: equipment.equipmentId,
                equipmentName: latestData.system || equipment.equipmentId,
                equipmentType: latestData.equipment_type || equipment.equipment_type || 'Unknown',
                zone: latestData.zone || equipment.zone || undefined, // *** EXTRACT ZONE FROM INFLUXDB ***
                isOnline,
                lastUpdated: latestData.time || new Date().toISOString(),
                metrics: processedMetrics,
                alarms: isOnline ? [] : ['Communication timeout']
              }
            }
            return null
          } catch (err: any) {
            if (err.name === 'AbortError') return null
            console.warn(`Failed to fetch metrics for equipment ${equipment.equipmentId}:`, err)
            return null
          }
        })

        // Wait for batch to complete
        const batchResults = await Promise.all(batchPromises)
        equipmentMetrics.push(...batchResults.filter(Boolean))

        // Add small delay between batches to prevent API overload
        if (i + batchSize < equipmentArray.length) {
          await new Promise(resolve => setTimeout(resolve, 150))
        }
      }

      // Create summary - MAINTAIN EXACT INTERFACE
      const onlineEquipment = equipmentMetrics.filter(eq => eq.isOnline).length
      const totalAlarms = equipmentMetrics.reduce((sum, eq) => sum + (eq.alarms?.length || 0), 0)

      const locationData: LocationMetricsData = {
        locationId,
        locationName: `Location ${locationId}`,
        equipment: equipmentMetrics,
        summary: {
          totalEquipment: equipmentMetrics.length,
          onlineEquipment,
          activeAlarms: totalAlarms,
          lastUpdated: new Date().toISOString()
        }
      }

      console.log(`✅ Loaded metrics for ${equipmentMetrics.length} equipment at location ${locationId}`)
      setData(locationData)
      
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('🚫 Request aborted')
        return
      }
      console.error('❌ Error fetching location metrics:', err)
      setError(err.message || 'Failed to fetch location metrics')
    } finally {
      isLoadingRef.current = false
      setLoading(false)
    }
  }, [locationId])

  useEffect(() => {
    if (!locationId) {
      setLoading(false)
      setError('Location ID is required')
      return
    }

    let intervalId: NodeJS.Timeout

    // Initial fetch
    fetchLocationMetrics()

    // Set up polling interval
    if (refreshInterval > 0) {
      intervalId = setInterval(() => {
        if (!isLoadingRef.current) {
          fetchLocationMetrics()
        }
      }, refreshInterval)
    }

    // Cleanup
    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      isLoadingRef.current = false
    }
  }, [locationId, refreshInterval, fetchLocationMetrics])

  const refetch = useCallback(() => {
    if (!isLoadingRef.current) {
      setLoading(true)
      fetchLocationMetrics()
    }
  }, [fetchLocationMetrics])

  return {
    data,
    loading,
    error,
    refetch
  }
}

// Helper hook for individual equipment metrics - ALSO ENHANCED WITH ZONE
export function useEquipmentMetrics(equipmentId: string, locationId: string, refreshInterval = 15000) {
  const [metrics, setMetrics] = useState<Record<string, MetricValue>>({})
  const [zone, setZone] = useState<string | null>(null) // *** ADDED ZONE STATE ***
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const isLoadingRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const fetchMetrics = useCallback(async () => {
    if (isLoadingRef.current) return

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    isLoadingRef.current = true
    abortControllerRef.current = new AbortController()

    try {
      setError(null)
      
      // Get ALL metrics for this equipment - BROADER QUERY
      const metricsQuery = `
        SELECT *
        FROM metrics
        WHERE "equipmentId" = '${equipmentId}'
        AND location_id = '${locationId}'
        AND time >= now() - INTERVAL '15 minutes'
        ORDER BY time DESC
        LIMIT 1
      `

      const response = await fetch('/api/influx', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: metricsQuery }),
        signal: abortControllerRef.current.signal
      })

      const result = await response.json()

      if (result.success && result.data && result.data.length > 0) {
        const latestData = result.data[0]
        const processedMetrics: Record<string, MetricValue> = {}

        // Skip system fields and process everything else - ADDED ZONE
        const skipFields = ['equipmentId', 'location_id', 'time', 'equipment_type', 'system', 'zone']
        
        // *** EXTRACT ZONE ***
        setZone(latestData.zone || null)

        Object.entries(latestData).forEach(([key, value]) => {
          if (!skipFields.includes(key) && value !== null && value !== undefined && value !== '') {
            // Smart unit detection
            const keyLower = key.toLowerCase()
            let unit = ''
            
            if (keyLower.includes('temp') || keyLower.includes('air')) {
              unit = '°F'
            } else if (keyLower.includes('current') || keyLower.includes('amp')) {
              unit = 'A'
            } else if (keyLower.includes('firing') || keyLower.includes('rate')) {
              unit = '%'
            } else if (keyLower.includes('pressure')) {
              unit = 'PSI'
            } else if (keyLower.includes('humidity') || keyLower.includes('rh')) {
              unit = '%'
            } else if (keyLower.includes('runtime')) {
              unit = 'sec'
            } else if (keyLower.includes('setpoint')) {
              unit = '°F'
            }

            processedMetrics[key] = {
              value: value,
              timestamp: latestData.time || new Date().toISOString(),
              unit: unit,
              status: 'normal'
            }
          }
        })

        setMetrics(processedMetrics)
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return
      console.error('❌ Error fetching equipment metrics:', err)
      setError(err.message || 'Failed to fetch equipment metrics')
    } finally {
      isLoadingRef.current = false
      setLoading(false)
    }
  }, [equipmentId, locationId])

  useEffect(() => {
    if (!equipmentId || !locationId) {
      setLoading(false)
      setError('Equipment ID and Location ID are required')
      return
    }

    let intervalId: NodeJS.Timeout

    // Initial fetch
    fetchMetrics()

    // Set up polling
    if (refreshInterval > 0) {
      intervalId = setInterval(() => {
        if (!isLoadingRef.current) {
          fetchMetrics()
        }
      }, refreshInterval)
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      isLoadingRef.current = false
    }
  }, [equipmentId, locationId, refreshInterval, fetchMetrics])

  return { metrics, zone, loading, error } // *** RETURN ZONE ***
}
