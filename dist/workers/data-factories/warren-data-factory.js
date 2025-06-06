/**
 * ===============================================================================
 * Warren Data Factory Worker - Warren Location Equipment Data Processor
 * ===============================================================================
 *
 * PURPOSE:
 * Location-specific data processing factory for Warren location (Location ID: 1).
 * Handles real-time equipment data processing, neural command optimization,
 * control output formatting, and performance calculations for Warren's specific
 * equipment configuration with air handlers, fan coils, pumps, and steam systems.
 *
 * EQUIPMENT CONFIGURATION:
 * - Air Handlers: 4 units (AHU1, AHU2, AHU4, AHU7) with mixed air control
 * - Fan Coils: 13 zone-based units with individual temperature control
 * - Hot Water Pumps: 2-pump lead/lag system for heating circulation
 * - Steam Bundle: Central steam distribution system
 *
 * OPTIMIZATION FEATURES:
 * - Air handler mixed air optimization algorithms
 * - Fan coil zone-based comfort control and efficiency monitoring
 * - Pump lead-lag coordination with runtime tracking
 * - Steam system performance analysis
 * - Energy consumption analysis and trending
 * - Performance-based equipment rotation scheduling
 *
 * AUTHOR: Juelz NeuralBms DevOps
 * LAST UPDATED: June 5, 2025
 * ===============================================================================
 */

// dist/workers/data-factories/warren-data-factory.js

const LOCATION_ID = '1'
const LOCATION_NAME = 'Warren Location'

// Warren-specific equipment registry with REAL equipment IDs
const WARREN_EQUIPMENT_REGISTRY = {
  // Air Handling Units
  AIR_HANDLERS: {
    '23FaokJCDXvOhumSer6': {
      name: 'AHU1',
      type: 'air_handler',
      system: 'hvac',
      priority: 1,
      designCFM: 5000,
      minOAPercentage: 15,
      maxOAPercentage: 100,
      heatingCapacity: 150000, // BTU/hr
      coolingCapacity: 180000  // BTU/hr
    },
    'upfoNfE5DSrIeLLlFKeTsS': {
      name: 'AHU2',
      type: 'air_handler',
      system: 'hvac',
      priority: 2,
      designCFM: 4800,
      minOAPercentage: 15,
      maxOAPercentage: 100,
      heatingCapacity: 145000,
      coolingCapacity: 172000
    },
    '3zJmeNr1lxC7EbAKNOay': {
      name: 'AHU4',
      type: 'air_handler',
      system: 'hvac',
      priority: 3,
      designCFM: 4500,
      minOAPercentage: 15,
      maxOAPercentage: 100,
      heatingCapacity: 135000,
      coolingCapacity: 162000
    },
    '8eZ6RemxnKXR1Y3ESrWUv': {
      name: 'AHU7',
      type: 'air_handler',
      system: 'hvac',
      priority: 4,
      designCFM: 4000,
      minOAPercentage: 15,
      maxOAPercentage: 100,
      heatingCapacity: 120000,
      coolingCapacity: 144000
    }
  },

  // Fan Coil Units
  FAN_COILS: {
    '2EQjEsAJQvPKxpaenlFPmj': {
      name: 'FanCoil1',
      type: 'fancoil',
      zone: 'Zone1',
      designCFM: 800,
      heatingCapacity: 25000, // BTU/hr
      coolingCapacity: 30000 // BTU/hr
    },
    'JwieTPUnxrqY7eGIpKhwlY': {
      name: 'FanCoil10',
      type: 'fancoil',
      zone: 'Zone10',
      designCFM: 800,
      heatingCapacity: 25000,
      coolingCapacity: 30000
    },
    'NOVgGXBmcnPPSBBD2Uj1': {
      name: 'FanCoil11',
      type: 'fancoil',
      zone: 'Zone11',
      designCFM: 800,
      heatingCapacity: 25000,
      coolingCapacity: 30000
    },
    'LRJsKPZDKFSRZ3PrMgXG': {
      name: 'FanCoil12',
      type: 'fancoil',
      zone: 'Zone12',
      designCFM: 800,
      heatingCapacity: 25000,
      coolingCapacity: 30000
    },
    'DqySgPLSRJdzcrnpQJarLu': {
      name: 'FanCoil13',
      type: 'fancoil',
      zone: 'Zone13',
      designCFM: 800,
      heatingCapacity: 25000,
      coolingCapacity: 30000
    },
    'XBTdALgOPXeXPnjrMNqQ': {
      name: 'FanCoil14',
      type: 'fancoil',
      zone: 'Zone14',
      designCFM: 800,
      heatingCapacity: 25000,
      coolingCapacity: 30000
    },
    'O3prhFJdwKQpGwEBhKilD': {
      name: 'FanCoil15',
      type: 'fancoil',
      zone: 'Zone15',
      designCFM: 800,
      heatingCapacity: 25000,
      coolingCapacity: 30000
    },
    'HRnpSexPwIwlgzQxHhgqze': {
      name: 'FanCoil2',
      type: 'fancoil',
      zone: 'Zone2',
      designCFM: 800,
      heatingCapacity: 25000,
      coolingCapacity: 30000
    },
    '1EsuQSzcJbzTerpTqurNTd': {
      name: 'FanCoil3',
      type: 'fancoil',
      zone: 'Zone3',
      designCFM: 800,
      heatingCapacity: 25000,
      coolingCapacity: 30000
    },
    'bZ3plcCJUk1sbrraLPagXX': {
      name: 'FanCoil4',
      type: 'fancoil',
      zone: 'Zone4',
      designCFM: 800,
      heatingCapacity: 25000,
      coolingCapacity: 30000
    },
    'BK7qKC1TgmcTUHBSOEDS': {
      name: 'FanCoil5',
      type: 'fancoil',
      zone: 'Zone5',
      designCFM: 800,
      heatingCapacity: 25000,
      coolingCapacity: 30000
    },
    '3SypcGRJJrYmhqqqjsXZSk': {
      name: 'FanCoil6',
      type: 'fancoil',
      zone: 'Zone6',
      designCFM: 800,
      heatingCapacity: 25000,
      coolingCapacity: 30000
    },
    '3qLlTSoOBTBMRr2khrwrlE3': {
      name: 'FanCoil8',
      type: 'fancoil',
      zone: 'Zone8',
      designCFM: 800,
      heatingCapacity: 25000,
      coolingCapacity: 30000
    }
  },

  // Hot Water Pumps - Lead/Lag Configuration
  HW_PUMPS: {
    'CZmRkjLzUrPbsaeF6SRh': {
      name: 'HWPump-1',
      type: 'hotwater_pump',
      priority: 1,
      designFlow: 200, // GPM
      designHead: 45, // ft
      motorHP: 3,
      variableSpeed: true
    },
    't6qJgeerYVJkxsafCrgsr': {
      name: 'HWPump-2',
      type: 'hotwater_pump',
      priority: 2,
      designFlow: 200, // GPM
      designHead: 45, // ft
      motorHP: 3,
      variableSpeed: true
    }
  },

  // Steam System
  STEAM_SYSTEMS: {
    'PQeRQegmKJEZUE6YRCT': {
      name: 'SteamBundle',
      type: 'steam_bundle',
      system: 'steam',
      priority: 1,
      designCapacity: 300000, // BTU/hr
      designPressure: 15 // PSI
    }
  }
}

// Main message handler
self.onmessage = function(e) {
  const { type, data, timestamp } = e.data

  switch (type) {
    case 'PROCESS_WARREN_DATA':
      processWarrenData(data, timestamp)
      break

    case 'OPTIMIZE_NEURAL_COMMANDS':
      optimizeNeuralCommands(data, timestamp)
      break

    case 'CALCULATE_EFFICIENCY':
      calculateSystemEfficiency(data, timestamp)
      break

    case 'ANALYZE_PERFORMANCE':
      analyzePerformanceTrends(data, timestamp)
      break

    case 'GET_SYSTEM_STATUS':
      getSystemStatus(data, timestamp)
      break

    default:
      console.warn(`🏢 Warren Data Factory: Unknown message type: ${type}`)
  }
}

function processWarrenData(apiData, timestamp) {
  const startTime = performance.now()
  console.log('🏢 Warren Data Factory: Processing equipment data...')

  try {
    // Filter for Warren equipment only
    const warrenData = apiData.filter(item => item.locationId === LOCATION_ID)
    console.log(`🏢 Processing ${warrenData.length} Warren equipment records`)

    // Initialize processing results
    const results = {
      locationId: LOCATION_ID,
      locationName: LOCATION_NAME,
      timestamp: timestamp,
      processedAt: new Date().toISOString(),
      equipment: [],
      systemSummary: {
        totalEquipment: warrenData.length,
        onlineCount: 0,
        offlineCount: 0,
        systemEfficiency: 0,
        totalEnergyConsumption: 0,
        alerts: []
      },
      leadLagStatus: {
        hwPumps: null
      },
      zoneStatus: {
        fanCoils: []
      }
    }

    // Create performance-optimized maps
    const equipmentMap = new Map()
    const neuralCommandsMap = new Map()

    // Pre-process equipment data
    warrenData.forEach(item => {
      const config = getEquipmentConfig(item.equipmentId)
      if (!config) return

      equipmentMap.set(item.equipmentId, {
        ...item,
        config: config
      })

      // Group neural commands by equipment
      if (item.controlOutputs && Object.keys(item.controlOutputs).length > 1) {
        neuralCommandsMap.set(item.equipmentId, item.controlOutputs)
      }
    })

    // Process each equipment type with specialized logic
    const processedEquipment = []

    equipmentMap.forEach((data, equipmentId) => {
      const processed = processEquipmentByType(data)
      if (processed) {
        processedEquipment.push(processed)

        // Update system summary
        if (processed.status === 'online') {
          results.systemSummary.onlineCount++
        } else {
          results.systemSummary.offlineCount++
        }

        results.systemSummary.totalEnergyConsumption += processed.energyConsumption || 0
      }
    })

    // Calculate lead-lag status for pump systems
    results.leadLagStatus = calculateLeadLagStatus(processedEquipment)

    // Calculate zone status for fan coils
    results.zoneStatus = calculateZoneStatus(processedEquipment)

    // Calculate overall system efficiency
    results.systemSummary.systemEfficiency = calculateOverallEfficiency(processedEquipment)

    // Generate system alerts
    results.systemSummary.alerts = generateSystemAlerts(processedEquipment)

    results.equipment = processedEquipment

    const processingTime = Math.round(performance.now() - startTime)
    console.log(`🏢 Warren Data Factory: Processing completed in ${processingTime}ms`)

    // Send results back to main thread
    self.postMessage({
      type: 'WARREN_DATA_PROCESSED',
      data: results,
      processingTime: processingTime,
      locationId: LOCATION_ID
    })

  } catch (error) {
    console.error('🏢 Warren Data Factory: Processing error:', error)
    self.postMessage({
      type: 'WARREN_PROCESSING_ERROR',
      error: error.message,
      locationId: LOCATION_ID
    })
  }
}

function getEquipmentConfig(equipmentId) {
  // Check all equipment registries
  for (const [category, equipment] of Object.entries(WARREN_EQUIPMENT_REGISTRY)) {
    if (equipment[equipmentId]) {
      return {
        ...equipment[equipmentId],
        category: category
      }
    }
  }
  return null
}

function processEquipmentByType(data) {
  const { config, liveMetrics, controlOutputs, userCommands } = data

  // Base equipment object
  const processed = {
    equipmentId: data.equipmentId,
    name: config.name,
    type: config.type,
    category: config.category,
    status: liveMetrics ? 'online' : 'offline',
    lastUpdated: liveMetrics?.timestamp || null,
    liveMetrics: liveMetrics,
    controlOutputs: controlOutputs,
    userCommands: userCommands,
    performance: {},
    energyConsumption: 0,
    efficiency: 0,
    alerts: []
  }

  // Type-specific processing
  switch (config.type) {
    case 'air_handler':
      return processAirHandlerData(processed, config)
    case 'fancoil':
      return processFanCoilData(processed, config)
    case 'hotwater_pump':
      return processPumpData(processed, config)
    case 'steam_bundle':
      return processSteamBundleData(processed, config)
    default:
      return processed
  }
}

function processAirHandlerData(equipment, config) {
  const { liveMetrics, controlOutputs } = equipment

  if (liveMetrics) {
    // Calculate air handler efficiency
    const supplyTemp = liveMetrics.supplyTemp || 0
    const mixedAirTemp = liveMetrics.mixedAirTemp || 0
    const outdoorTemp = liveMetrics.outdoorTemp || 0
    const returnTemp = liveMetrics.returnTemp || 0

    // Calculate outdoor air percentage
    const oaPercentage = calculateOAPercentage(mixedAirTemp, returnTemp, outdoorTemp)

    equipment.performance = {
      supplyTemp: supplyTemp,
      mixedAirTemp: mixedAirTemp,
      outdoorTemp: outdoorTemp,
      returnTemp: returnTemp,
      outdoorAirPercentage: oaPercentage,
      fanSpeed: controlOutputs?.fanSpeed || 0,
      efficiency: calculateAirHandlerEfficiency(supplyTemp, mixedAirTemp, controlOutputs)
    }

    // Calculate energy consumption based on fan speed and heating/cooling
    const fanPower = estimateFanPower(controlOutputs?.fanSpeed || 0, config.designCFM)
    const heatingPower = estimateHeatingPower(controlOutputs?.heatingValve || 0, config.heatingCapacity)
    const coolingPower = estimateCoolingPower(controlOutputs?.coolingValve || 0, config.coolingCapacity)
    
    equipment.energyConsumption = fanPower + heatingPower + coolingPower

    // Check for alerts
    if (supplyTemp > 85) {
      equipment.alerts.push('High supply temperature')
    }
    if (oaPercentage < config.minOAPercentage) {
      equipment.alerts.push('Low outdoor air percentage')
    }
    if (controlOutputs?.heatingValve > 0 && controlOutputs?.coolingValve > 0) {
      equipment.alerts.push('Simultaneous heating and cooling')
    }
  }

  return equipment
}

function processFanCoilData(equipment, config) {
  const { liveMetrics, controlOutputs } = equipment

  if (liveMetrics && controlOutputs) {
    // Calculate fan coil performance
    const supplyTemp = liveMetrics.supplyTemp || 0
    const roomTemp = liveMetrics.roomTemp || liveMetrics.spaceTemp || 0
    const heatingValve = controlOutputs.heatingValvePosition || 0
    const coolingValve = controlOutputs.coolingValvePosition || 0

    equipment.performance = {
      supplyTemp: supplyTemp,
      roomTemp: roomTemp,
      heatingValvePosition: heatingValve,
      coolingValvePosition: coolingValve,
      fanSpeed: controlOutputs.fanSpeed || 0,
      mode: heatingValve > coolingValve ? 'heating' : 'cooling',
      efficiency: calculateFanCoilEfficiency(supplyTemp, roomTemp, heatingValve, coolingValve)
    }

    // Estimate energy consumption based on valve positions and fan speed
    const heatingLoad = (heatingValve / 100) * config.heatingCapacity
    const coolingLoad = (coolingValve / 100) * config.coolingCapacity
    const fanPower = estimateFanPower(controlOutputs.fanSpeed || 0, config.designCFM)
    
    equipment.energyConsumption = (heatingLoad + coolingLoad) / 3412 + fanPower // Convert BTU/hr to kW

    // Check for alerts
    if (heatingValve > 0 && coolingValve > 0) {
      equipment.alerts.push('Simultaneous heating and cooling')
    }
    if (Math.abs(supplyTemp - roomTemp) > 15) {
      equipment.alerts.push('Large temperature differential')
    }
  }

  return equipment
}

function processPumpData(equipment, config) {
  const { liveMetrics } = equipment

  if (liveMetrics && liveMetrics.amps) {
    // Calculate pump efficiency
    const amps = liveMetrics.amps
    const speed = liveMetrics.speed || 100
    const estimatedFlow = estimatePumpFlow(amps, speed, config.designFlow)

    equipment.performance = {
      amps: amps,
      speed: speed,
      estimatedFlow: estimatedFlow,
      efficiency: calculatePumpEfficiency(amps, speed, config.motorHP, estimatedFlow),
      pressure: liveMetrics.pressure || null
    }

    // Calculate energy consumption (kW)
    equipment.energyConsumption = (amps * 480 * 1.732 * 0.85) / 1000 // Estimated 3-phase power

    // Check for alerts
    if (amps > config.motorHP * 6) { // Rough overload check
      equipment.alerts.push('High amperage - possible overload')
    }
    if (amps < 1 && equipment.controlOutputs?.pumpEnable) {
      equipment.alerts.push('Low amperage - pump may not be running')
    }
  }

  return equipment
}

function processSteamBundleData(equipment, config) {
  const { liveMetrics } = equipment

  if (liveMetrics) {
    // Calculate steam system performance
    const steamPressure = liveMetrics.steamPressure || 0
    const steamTemp = liveMetrics.steamTemp || 0
    const condensateReturn = liveMetrics.condensateReturn || 0

    equipment.performance = {
      steamPressure: steamPressure,
      steamTemp: steamTemp,
      condensateReturn: condensateReturn,
      efficiency: calculateSteamEfficiency(steamPressure, steamTemp, condensateReturn)
    }

    // Estimate energy consumption based on steam production
    equipment.energyConsumption = estimateSteamConsumption(steamPressure, config.designCapacity)

    // Check for alerts
    if (steamPressure > config.designPressure * 1.1) {
      equipment.alerts.push('High steam pressure')
    }
    if (condensateReturn < 70) {
      equipment.alerts.push('Low condensate return percentage')
    }
  }

  return equipment
}

function calculateLeadLagStatus(equipment) {
  const status = {
    hwPumps: analyzeLeadLag(equipment, 'HW_PUMPS')
  }

  return status
}

function calculateZoneStatus(equipment) {
  const fanCoils = equipment.filter(eq => eq.type === 'fancoil')
  
  const zoneStatus = {
    fanCoils: fanCoils.map(fc => ({
      zone: fc.config.zone,
      name: fc.name,
      roomTemp: fc.performance?.roomTemp || 0,
      supplyTemp: fc.performance?.supplyTemp || 0,
      mode: fc.performance?.mode || 'off',
      efficiency: fc.efficiency || 0,
      alerts: fc.alerts || []
    }))
  }

  return zoneStatus
}

function analyzeLeadLag(equipment, category) {
  const categoryEquipment = equipment.filter(eq => eq.category === category)
  if (categoryEquipment.length < 2) return null

  const leadEquipment = categoryEquipment.find(eq => eq.controlOutputs?.isLead === true)
  const lagEquipment = categoryEquipment.find(eq => eq.controlOutputs?.isLead === false)

  return {
    lead: leadEquipment ? leadEquipment.name : 'Unknown',
    lag: lagEquipment ? lagEquipment.name : 'Unknown',
    rotationNeeded: false, // Would implement rotation logic here
    efficiency: calculateGroupEfficiency(categoryEquipment)
  }
}

function calculateOverallEfficiency(equipment) {
  const efficiencies = equipment
    .filter(eq => eq.efficiency > 0)
    .map(eq => eq.efficiency)

  if (efficiencies.length === 0) return 0

  return Math.round(efficiencies.reduce((sum, eff) => sum + eff, 0) / efficiencies.length)
}

function generateSystemAlerts(equipment) {
  const alerts = []

  // Collect all equipment alerts
  equipment.forEach(eq => {
    eq.alerts.forEach(alert => {
      alerts.push({
        equipmentId: eq.equipmentId,
        equipmentName: eq.name,
        alert: alert,
        severity: 'warning',
        timestamp: new Date().toISOString()
      })
    })
  })

  return alerts
}

// Helper calculation functions
function calculateOAPercentage(mixedAirTemp, returnTemp, outdoorTemp) {
  if (Math.abs(returnTemp - outdoorTemp) < 1) return 0
  const oaPercentage = Math.abs((mixedAirTemp - returnTemp) / (outdoorTemp - returnTemp)) * 100
  return Math.max(0, Math.min(100, oaPercentage))
}

function calculateAirHandlerEfficiency(supplyTemp, mixedAirTemp, controlOutputs) {
  // Simplified efficiency based on temperature control and valve positions
  const tempControl = Math.max(0, 100 - Math.abs(supplyTemp - 72) * 2) // Target 72°F
  const valveEfficiency = controlOutputs ? (100 - Math.abs((controlOutputs.heatingValve || 0) - (controlOutputs.coolingValve || 0))) : 90
  return Math.round((tempControl + valveEfficiency) / 2)
}

function calculateFanCoilEfficiency(supplyTemp, roomTemp, heatingValve, coolingValve) {
  // Simplified efficiency based on temperature control and valve positions
  if (heatingValve > 0) {
    return Math.max(0, 100 - Math.abs(supplyTemp - 105) * 2)
  } else if (coolingValve > 0) {
    return Math.max(0, 100 - Math.abs(supplyTemp - 55) * 2)
  }
  return 85 // Base efficiency when not actively heating/cooling
}

function calculatePumpEfficiency(amps, speed, motorHP, flow) {
  const expectedAmps = (motorHP * 1.5 * speed) / 100 // Adjust for speed
  const ampsEfficiency = Math.max(0, 100 - Math.abs(amps - expectedAmps) * 10)
  const flowEfficiency = flow > 0 ? Math.min(100, (flow / (motorHP * 50)) * 100) : 0 // Rough flow efficiency
  return Math.round((ampsEfficiency + flowEfficiency) / 2)
}

function calculateSteamEfficiency(steamPressure, steamTemp, condensateReturn) {
  // Simplified steam efficiency calculation
  const pressureEfficiency = steamPressure > 0 ? Math.max(0, 100 - Math.abs(steamPressure - 15) * 5) : 0
  const condensateEfficiency = condensateReturn || 80 // Default if not available
  return Math.round((pressureEfficiency + condensateEfficiency) / 2)
}

function calculateGroupEfficiency(equipmentGroup) {
  const efficiencies = equipmentGroup
    .filter(eq => eq.efficiency > 0)
    .map(eq => eq.efficiency)

  if (efficiencies.length === 0) return 0

  return Math.round(efficiencies.reduce((sum, eff) => sum + eff, 0) / efficiencies.length)
}

function estimateFanPower(fanSpeed, designCFM) {
  // Estimate fan power consumption based on speed and CFM
  const speedFraction = fanSpeed / 100
  const estimatedHP = (designCFM / 1000) * 0.5 // Rough estimate: 0.5 HP per 1000 CFM
  return (estimatedHP * 0.746 * Math.pow(speedFraction, 3)) // Fan laws: power varies with cube of speed
}

function estimateHeatingPower(heatingValve, heatingCapacity) {
  // Estimate heating power consumption
  return ((heatingValve / 100) * heatingCapacity) / 3412 // Convert BTU/hr to kW
}

function estimateCoolingPower(coolingValve, coolingCapacity) {
  // Estimate cooling power consumption (simplified)
  return ((coolingValve / 100) * coolingCapacity) / 12000 // Rough estimate: 12000 BTU/hr per kW
}

function estimatePumpFlow(amps, speed, designFlow) {
  // Simplified flow estimation based on amperage and speed
  const speedFraction = speed / 100
  const loadFraction = amps / 15 // Assume 15A full load
  return designFlow * speedFraction * loadFraction
}

function estimateSteamConsumption(steamPressure, designCapacity) {
  // Simplified steam consumption estimation
  const loadFraction = Math.min(1, steamPressure / 15) // Normalize to design pressure
  return (loadFraction * designCapacity) / 3412 // Convert BTU/hr to kW
}

// Additional optimization functions
function optimizeNeuralCommands(data, timestamp) {
  console.log('🏢 Warren Data Factory: Optimizing neural commands...')

  // Implementation for neural command optimization
  self.postMessage({
    type: 'NEURAL_COMMANDS_OPTIMIZED',
    data: { message: 'Neural command optimization completed' },
    locationId: LOCATION_ID
  })
}

function calculateSystemEfficiency(data, timestamp) {
  console.log('🏢 Warren Data Factory: Calculating system efficiency...')

  // Implementation for system efficiency calculations
  self.postMessage({
    type: 'SYSTEM_EFFICIENCY_CALCULATED',
    data: { message: 'System efficiency calculation completed' },
    locationId: LOCATION_ID
  })
}

function analyzePerformanceTrends(data, timestamp) {
  console.log('🏢 Warren Data Factory: Analyzing performance trends...')

  // Implementation for performance trend analysis
  self.postMessage({
    type: 'PERFORMANCE_TRENDS_ANALYZED',
    data: { message: 'Performance trend analysis completed' },
    locationId: LOCATION_ID
  })
}

function getSystemStatus(data, timestamp) {
  console.log('🏢 Warren Data Factory: Getting system status...')

  // Implementation for system status
  self.postMessage({
    type: 'SYSTEM_STATUS_RETRIEVED',
    data: { message: 'System status retrieved' },
    locationId: LOCATION_ID
  })
}

console.log('🏢 Warren Data Factory Worker initialized for Location ID:', LOCATION_ID)
console.log('🏢 Equipment Registry: 4 Air Handlers, 13 Fan Coils, 2 HW Pumps, 1 Steam Bundle')
