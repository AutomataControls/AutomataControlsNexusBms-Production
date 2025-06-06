/**
 * ===============================================================================
 * Control Data API Route - Neural HVAC System Data Aggregator
 * ===============================================================================
 * 
 * PURPOSE:
 * This API endpoint serves as the central data aggregation service for the Neural
 * HVAC control system dashboard. It fetches and merges real-time equipment data
 * from three distinct InfluxDB databases to provide a unified view of all HVAC
 * equipment across multiple locations.
 * 
 * DATABASES QUERIED:
 * 1. Locations DB - Live sensor metrics (temperatures, pressures, amps, etc.)
 * 2. UIControlCommands DB - User-initiated control commands from the dashboard
 * 3. NeuralControlCommands DB - Automated control outputs from logic factories
 * 
 * DATA FLOW:
 * Dashboard → POST /api/influx/control-data → InfluxDB v3 API → Merged Response
 * 
 * REQUEST FORMAT:
 * POST body: {
 *   locationIds: ['4', '5', '6'],  // Array of location IDs to query
 *   timeRange: '5m'               // Time window (5m, 1h, 24h, etc.)
 * }
 * 
 * RESPONSE FORMAT:
 * {
 *   success: true,
 *   data: [
 *     {
 *       equipmentId: "ZLYR6YveSmCEMqtBSy3e",
 *       locationId: "4",
 *       equipmentName: "ComfortBoiler-1",
 *       equipmentType: "boiler",
 *       liveMetrics: {
 *         spaceTemp: 110.5,
 *         supplyTemp: 108.2,
 *         isFiring: false,
 *         outdoorTemp: 85.3
 *       },
 *       userCommands: {
 *         enabled: true,
 *         supplyTempSetpoint: 80,
 *         isLead: true
 *       },
 *       controlOutputs: {
 *         unitEnable: true,
 *         firing: false,
 *         temperatureSetpoint: 80,
 *         isLead: true
 *       }
 *     }
 *   ],
 *   recordCounts: { locations: 310, uiCommands: 15, neuralCommands: 45 }
 * }
 * 
 * KEY FEATURES:
 * - Parallel database queries for optimal performance
 * - Equipment-type-specific data parsing (boilers, pumps, fan coils, etc.)
 * - Intelligent data merging based on location/equipment ID pairs
 * - Real-time control output mapping from Neural Logic Factory results
 * - Comprehensive error handling and logging
 * - Optimized neural command grouping for complete control outputs
 * 
 * EQUIPMENT TYPES SUPPORTED:
 * - Boilers (comfort & domestic hot water)
 * - Pumps (hot water, chilled water, circulation)
 * - Fan Coils (heating/cooling with dampers)
 * - Air Handlers (supply/return air with mixed air dampers)
 * - Heat Pumps (geothermal, air-source)
 * 
 * NEURAL CONTROL INTEGRATION:
 * This API fetches the actual control decisions made by the Huntington Logic
 * Factory and other neural control workers, displaying what the automated
 * system has decided (enable/disable, firing commands, valve positions, etc.)
 * rather than just sensor readings.
 * 
 * AUTHOR: Juelz NeuralBms DevOps
 * LAST UPDATED: June 3, 2025
 * INFLUXDB VERSION: v3 Core API
 * ===============================================================================
 */

// app/api/influx/control-data/route.ts
import { NextRequest, NextResponse } from 'next/server'

const INFLUXDB_URL = process.env.INFLUXDB_URL || 'http://143.198.162.31:8181'

export async function POST(request: NextRequest) {
  try {
    console.log('=== Control Data API Called ===')
    const body = await request.json()
    const { locationIds, timeRange = '5m' } = body
    console.log('Request body:', { locationIds, timeRange })

    if (!locationIds || locationIds.length === 0) {
      return NextResponse.json({ error: 'locationIds are required' }, { status: 400 })
    }

    console.log('Location filter:', locationIds)
    console.log('🔍 Starting parallel database queries...')

    const [locationsData, uiCommandsData, neuralCommandsData] = await Promise.all([
      // Locations query (this one works fine)
      queryInfluxDB('Locations', `
        SELECT *
        FROM metrics
        WHERE time > now() - INTERVAL '${timeRange === '5m' ? '5 minutes' : timeRange === '1h' ? '1 hour' : '24 hours'}'
        AND (${locationIds.map(id => `location_id = '${id}'`).join(' OR ')})
        ORDER BY time DESC
      `),

      // UI Commands query (fixed with correct field name)
      queryInfluxDB('UIControlCommands', `
        SELECT *
        FROM "UIControlCommands"
        WHERE time > now() - INTERVAL '24 hours'
        AND (${locationIds.map(id => `"locationId" = '${id}'`).join(' OR ')})
        ORDER BY time DESC
      `),

      // Neural Commands query - FIXED!
      queryInfluxDB('NeuralControlCommands', `
        SELECT *
        FROM "NeuralCommands"
        WHERE time > now() - INTERVAL '${timeRange === '5m' ? '5 minutes' : timeRange === '1h' ? '1 hour' : '24 hours'}'
        AND (${locationIds.map(id => `location_id = '${id}'`).join(' OR ')})
        ORDER BY time DESC
      `)
    ])

    console.log('Query results:', {
      locations: locationsData.length,
      uiCommands: uiCommandsData.length,
      neuralCommands: neuralCommandsData.length
    })

    const mergedData = mergeControlData(locationsData, uiCommandsData, neuralCommandsData)
    console.log('Merged data count:', mergedData.length)

    return NextResponse.json({
      success: true,
      data: mergedData,
      timestamp: new Date().toISOString(),
      locationIds,
      recordCounts: {
        locations: locationsData.length,
        uiCommands: uiCommandsData.length,
        neuralCommands: neuralCommandsData.length,
        merged: mergedData.length
      }
    })

  } catch (error) {
    console.error('❌ Error:', error)
    return NextResponse.json({ error: 'Failed to fetch control data' }, { status: 500 })
  }
}

async function queryInfluxDB(database: string, query: string): Promise<any[]> {
  try {
    console.log(`📊 Querying ${database} database...`)
    
    // Use InfluxDB v3 API for all databases
    const response = await fetch(`${INFLUXDB_URL}/api/v3/query_sql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        q: query, 
        db: database 
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ ${database} query failed:`, response.status, errorText)
      return []
    }

    const data = await response.json()
    console.log(`✅ ${database} query returned ${Array.isArray(data) ? data.length : 0} records`)

    // InfluxDB v3 returns array directly
    if (Array.isArray(data)) {
      return data
    }

    return []
  } catch (error) {
    console.error(`❌ Error querying ${database}:`, error)
    return []
  }
}

function mergeControlData(locationsData: any[], uiCommandsData: any[], neuralCommandsData: any[]) {
  console.log('🔄 Merging data:')
  console.log('  - Locations records:', locationsData.length)
  console.log('  - UI Commands records:', uiCommandsData.length)
  console.log('  - Neural Commands records:', neuralCommandsData.length)

  // Pre-build maps for O(1) lookup performance
  const uiCommandsMap = new Map()
  const locationsMap = new Map()
  const neuralCommandsMap = new Map()

  // Build UI commands map (latest command per equipment)
  uiCommandsData.forEach(row => {
    const key = `${row.locationId}-${row.equipmentId}`
    if (!uiCommandsMap.has(key) || new Date(row.time) > new Date(uiCommandsMap.get(key).time)) {
      uiCommandsMap.set(key, row)
    }
  })

  // Build locations map (latest metrics per equipment)
  locationsData.forEach(row => {
    const key = `${row.location_id}-${row.equipmentId}`
    if (!locationsMap.has(key) || new Date(row.time) > new Date(locationsMap.get(key).time)) {
      locationsMap.set(key, row)
    }
  })

  // Build neural commands map - GROUP ALL COMMANDS BY EQUIPMENT
  neuralCommandsData.forEach(row => {
    const key = `${row.location_id}-${row.equipment_id}`
    if (!neuralCommandsMap.has(key)) {
      neuralCommandsMap.set(key, {})
    }
    
    // Store each command type with its value and timestamp
    const equipmentCommands = neuralCommandsMap.get(key)
    if (!equipmentCommands[row.command_type] || new Date(row.time) > new Date(equipmentCommands[row.command_type].time)) {
      equipmentCommands[row.command_type] = {
        value: row.value,
        time: row.time
      }
    }
  })

  console.log(`📊 Unique equipment in Locations: ${locationsMap.size}`)
  console.log(`📊 Unique equipment with UI commands: ${uiCommandsMap.size}`)
  console.log(`📊 Unique equipment with Neural commands: ${neuralCommandsMap.size}`)

  const mergedData: any[] = []

  // Merge data - use Locations as primary source for equipment discovery
  locationsMap.forEach((locationData, key) => {
    const [locationId, equipmentId] = key.split('-')
    const equipmentKey = `${locationId}-${equipmentId}`
    const uiData = uiCommandsMap.get(equipmentKey)
    const neuralCommands = neuralCommandsMap.get(equipmentKey) || {}

    // Extract equipment info
    const equipmentType = locationData.equipment_type || 'unknown'
    const systemName = locationData.system || equipmentId

    // Extract temperatures based on equipment type - optimized with early returns
    let spaceTemp = null
    let supplyTemp = null

    if (equipmentType === 'boiler') {
      spaceTemp = parseFloat(locationData.DMH20Return) || parseFloat(locationData.H20Return) || null
      supplyTemp = parseFloat(locationData.DMH20Supply) || parseFloat(locationData.H20Supply) || null
    } else if (equipmentType.includes('pump')) {
      spaceTemp = parseFloat(locationData.H20Return) || parseFloat(locationData.CW_Return) || null
      supplyTemp = parseFloat(locationData.H20Supply) || parseFloat(locationData.CW_Supply) || parseFloat(locationData.SupplyTemp) || null
    } else {
      spaceTemp = parseFloat(locationData.SpaceTemp) || parseFloat(locationData.Space) || null
      supplyTemp = parseFloat(locationData.Supply) || parseFloat(locationData.SupplyTemp) || null
    }

    // Extract amps/firing based on equipment type
    let amps = null
    let isFiring = null

    if (equipmentType.includes('pump')) {
      amps = parseFloat(locationData.PumpAmps) || parseFloat(locationData.HWPump1Amps) || 
             parseFloat(locationData.HWPump2Amps) || parseFloat(locationData.Pump1Amps) || 
             parseFloat(locationData.Pump2Amps) || null
    } else if (equipmentType.includes('fan') || equipmentType === 'air_handler') {
      amps = parseFloat(locationData.FanAmps) || parseFloat(locationData.fanAmps) || null
    } else if (equipmentType === 'boiler') {
      isFiring = locationData.Firing
    }

    // Build control outputs from neural commands - OPTIMIZED PARSING
    const controlOutputs: any = {}
    let latestTimestamp = null

    // Process all neural commands for this equipment
    Object.entries(neuralCommands).forEach(([commandType, commandData]: [string, any]) => {
      let value = commandData.value
      
      // Convert string values to appropriate types
      if (typeof value === 'string') {
        value = value.replace(/"/g, '') // Remove quotes
      }

      // Update latest timestamp
      if (!latestTimestamp || new Date(commandData.time) > new Date(latestTimestamp)) {
        latestTimestamp = commandData.time
      }

      // Map command types to control outputs - OPTIMIZED with direct assignments
      switch (commandType) {
        case 'unitEnable':
          controlOutputs.unitEnable = value === 'true' || value === true || value === '1'
          break
        case 'firing':
          controlOutputs.firing = value === 'true' || value === true || value === '1'
          break
        case 'fanEnabled':
          controlOutputs.fanEnabled = value === '1' || value === 'true' || value === true
          break
        case 'fanSpeed':
          controlOutputs.fanSpeed = value.toString()
          break
        case 'heatingValvePosition':
          controlOutputs.heatingValvePosition = Number.parseFloat(value) || 0
          break
        case 'coolingValvePosition':
          controlOutputs.coolingValvePosition = Number.parseFloat(value) || 0
          break
        case 'outdoorDamperPosition':
          controlOutputs.outdoorDamperPosition = Number.parseFloat(value) || 0
          break
        case 'waterTempSetpoint':
        case 'temperatureSetpoint':
          controlOutputs.temperatureSetpoint = Number.parseFloat(value) || 0
          break
        case 'pumpSpeed':
          controlOutputs.pumpSpeed = Number.parseFloat(value) || 0
          break
        case 'pumpEnable':
          controlOutputs.pumpEnable = value === 'true' || value === true || value === '1'
          break
        case 'isLead':
          controlOutputs.isLead = value === '1' || value === 'true' || value === true
          break
      }
    })

    // Set timestamp if we have any control outputs
    if (Object.keys(controlOutputs).length > 0) {
      controlOutputs.timestamp = latestTimestamp
    } else {
      controlOutputs.timestamp = null
    }

    // Extract additional metrics
    const outdoorTemp = parseFloat(locationData.Outdoor_Air) || parseFloat(locationData.OutdoorAir) || null
    const oarTemp = parseFloat(locationData.OARTemp) || parseFloat(locationData.OARSetpoint) || null
    const pressure = equipmentType.includes('pump') ? 
      (parseFloat(locationData.DifferentialPressure) || parseFloat(locationData.DuctStaticPressure) || null) : null

    mergedData.push({
      equipmentId,
      locationId,
      equipmentName: systemName,
      equipmentType: equipmentType,
      liveMetrics: {
        spaceTemp,
        supplyTemp,
        amps,
        isFiring,
        pressure,
        outdoorTemp,
        oarTemp,
        timestamp: locationData.time
      },
      userCommands: {
        enabled: uiData?.enabled ?? null,
        supplyTempSetpoint: uiData?.tempSetpoint || uiData?.supplyTempSetpoint || null,
        isLead: uiData?.isLead ?? null,
        modifiedBy: uiData?.userId || uiData?.modifiedBy || null,
        modifiedByName: uiData?.userName || uiData?.modifiedByName || null,
        lastModified: uiData?.time || null
      },
      controlOutputs
    })
  })

  console.log(`✅ Final merged equipment count: ${mergedData.length}`)
  console.log(`🔧 Equipment with control outputs: ${mergedData.filter(eq => Object.keys(eq.controlOutputs).length > 1).length}`)
  
  return mergedData
}
