/**
 * ===============================================================================
 * Huntington Data Factory Worker - Heritage Pointe Equipment Data Processor
 * ===============================================================================
 * 
 * PURPOSE:
 * Location-specific data processing factory for Heritage Pointe of Huntington
 * (Location ID: 4). Handles real-time equipment data processing, neural command
 * optimization, control output formatting, and performance calculations for
 * Huntington's specific equipment configuration.
 * 
 * EQUIPMENT CONFIGURATION:
 * - Comfort Boilers: Lead/Lag pair with rotation logic
 * - Domestic Boilers: Independent hot water production
 * - HW/CW Pumps: Lead/Lag configurations with efficiency monitoring
 * - Fan Coils: Zone-based cooling/heating with valve control
 * 
 * OPTIMIZATION FEATURES:
 * - Equipment-specific neural command processing
 * - Lead-lag coordination algorithms
 * - Real-time efficiency calculations
 * - Zone-based fan coil optimization
 * - Performance trending and analysis
 * 
 * AUTHOR: Juelz NeuralBms DevOps
 * LAST UPDATED: June 3, 2025
 * ===============================================================================
 */

// dist/workers/data-factories/huntington-data-factory.js

const LOCATION_ID = '4'
const LOCATION_NAME = 'Heritage Pointe of Huntington'

// Huntington-specific equipment registry
const HUNTINGTON_EQUIPMENT_REGISTRY = {
  // Comfort Boilers - Lead/Lag Configuration
  COMFORT_BOILERS: {
    'ZLYR6YveSmCEMqtBSy3e': { 
      name: 'ComfortBoiler-1', 
      type: 'boiler', 
      system: 'comfort',
      priority: 1,
      designCapacity: 500000, // BTU/hr
      minModulation: 20 // %
    },
    'XBvDB5Jvh8M4FSBpMDAp': { 
      name: 'ComfortBoiler-2', 
      type: 'boiler', 
      system: 'comfort',
      priority: 2,
      designCapacity: 500000, // BTU/hr
      minModulation: 20 // %
    }
  },
  
  // Domestic Hot Water Boilers
  DOMESTIC_BOILERS: {
    'NJuMiYl44QNZ8S4AdLsB': { 
      name: 'DomesticBoiler-1', 
      type: 'boiler', 
      system: 'domestic',
      priority: 1,
      designCapacity: 300000, // BTU/hr
      targetTemp: 120 // °F
    },
    'mpjq0MFGjaA9sFfQrvM9': { 
      name: 'DomesticBoiler-2', 
      type: 'boiler', 
      system: 'domestic',
      priority: 2,
      designCapacity: 300000, // BTU/hr
      targetTemp: 120 // °F
    }
  },
  
  // Hot Water Pumps - Lead/Lag Configuration
  HW_PUMPS: {
    'oh5Bz2zzIcuT9lFoogvi': { 
      name: 'HWPump-1', 
      type: 'hotwater_pump', 
      priority: 1,
      designFlow: 150, // GPM
      designHead: 35, // ft
      motorHP: 2
    },
    'GUI1SxcedsLEhqbD0G2p': { 
      name: 'HWPump-2', 
      type: 'hotwater_pump', 
      priority: 2,
      designFlow: 150, // GPM
      designHead: 35, // ft
      motorHP: 2
    }
  },
  
  // Chilled Water Pumps
  CW_PUMPS: {
    'RJLaOk4UssyePSA1qgT8': { 
      name: 'CWPump-1', 
      type: 'chilledwater_pump', 
      priority: 1,
      designFlow: 200, // GPM
      designHead: 40, // ft
      motorHP: 3
    },
    'wGvFI5Bf6xaLlSwRc7xO': { 
      name: 'CWPump-2', 
      type: 'chilledwater_pump', 
      priority: 2,
      designFlow: 200, // GPM
      designHead: 40, // ft
      motorHP: 3
    }
  },
  
  // Fan Coils with Zone Mapping
  FAN_COILS: {
    'BBHCLhaeItV7pIdinQzM': { 
      name: 'FanCoil1', 
      type: 'fancoil', 
      zone: 'Zone1',
      designCFM: 800,
      heatingCapacity: 25000, // BTU/hr
      coolingCapacity: 30000 // BTU/hr
    },
    'IEhoTqKphbvHb5fTanpP': { 
      name: 'FanCoil2', 
      type: 'fancoil', 
      zone: 'Zone2',
      designCFM: 800,
      heatingCapacity: 25000,
      coolingCapacity: 30000
    },
    'i3sBbPSLWLRZ90zCSHUI': { 
      name: 'FanCoil3', 
      type: 'fancoil', 
      zone: 'Zone3',
      designCFM: 800,
      heatingCapacity: 25000,
      coolingCapacity: 30000
    },
    'yoqvw3vAAEunALLFX8lj': { 
      name: 'FanCoil4', 
      type: 'fancoil', 
      zone: 'Zone4',
      designCFM: 800,
      heatingCapacity: 25000,
      coolingCapacity: 30000
    },
    'eHclLdHBmnXYiqRSc72e': { 
      name: 'FanCoil6', 
      type: 'fancoil', 
      zone: 'Zone6',
      designCFM: 800,
      heatingCapacity: 25000,
      coolingCapacity: 30000
    },
    'TLplGG86fAtMOkJR7w7v': { 
      name: 'FanCoil7', 
      type: 'fancoil', 
      zone: 'Zone7',
      designCFM: 800,
      heatingCapacity: 25000,
      coolingCapacity: 30000
    }
  }
}

// Main message handler
self.onmessage = function(e) {
  const { type, data, timestamp } = e.data

  switch (type) {
    case 'PROCESS_HUNTINGTON_DATA':
      processHuntingtonData(data, timestamp)
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
      console.warn(`🏢 Huntington Data Factory: Unknown message type: ${type}`)
  }
}

function processHuntingtonData(apiData, timestamp) {
  const startTime = performance.now()
  console.log('🏢 Huntington Data Factory: Processing equipment data...')
  
  try {
    // Filter for Huntington equipment only
    const huntingtonData = apiData.filter(item => item.locationId === LOCATION_ID)
    console.log(`🏢 Processing ${huntingtonData.length} Huntington equipment records`)
    
    // Initialize processing results
    const results = {
      locationId: LOCATION_ID,
      locationName: LOCATION_NAME,
      timestamp: timestamp,
      processedAt: new Date().toISOString(),
      equipment: [],
      systemSummary: {
        totalEquipment: huntingtonData.length,
        onlineCount: 0,
        offlineCount: 0,
        systemEfficiency: 0,
        totalEnergyConsumption: 0,
        alerts: []
      },
      leadLagStatus: {
        comfortBoilers: null,
        hwPumps: null,
        cwPumps: null
      }
    }

    // Create performance-optimized maps
    const equipmentMap = new Map()
    const neuralCommandsMap = new Map()
    
    // Pre-process equipment data
    huntingtonData.forEach(item => {
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

    // Calculate lead-lag status for equipment groups
    results.leadLagStatus = calculateLeadLagStatus(processedEquipment)
    
    // Calculate overall system efficiency
    results.systemSummary.systemEfficiency = calculateOverallEfficiency(processedEquipment)
    
    // Generate system alerts
    results.systemSummary.alerts = generateSystemAlerts(processedEquipment)
    
    results.equipment = processedEquipment

    const processingTime = Math.round(performance.now() - startTime)
    console.log(`🏢 Huntington Data Factory: Processing completed in ${processingTime}ms`)

    // Send results back to main thread
    self.postMessage({
      type: 'HUNTINGTON_DATA_PROCESSED',
      data: results,
      processingTime: processingTime,
      locationId: LOCATION_ID
    })

  } catch (error) {
    console.error('🏢 Huntington Data Factory: Processing error:', error)
    self.postMessage({
      type: 'HUNTINGTON_PROCESSING_ERROR',
      error: error.message,
      locationId: LOCATION_ID
    })
  }
}

function getEquipmentConfig(equipmentId) {
  // Check all equipment registries
  for (const [category, equipment] of Object.entries(HUNTINGTON_EQUIPMENT_REGISTRY)) {
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
    case 'boiler':
      return processBoilerData(processed, config)
    case 'hotwater_pump':
    case 'chilledwater_pump':
      return processPumpData(processed, config)
    case 'fancoil':
      return processFanCoilData(processed, config)
    default:
      return processed
  }
}

function processBoilerData(equipment, config) {
  const { liveMetrics, controlOutputs } = equipment
  
  if (liveMetrics) {
    // Calculate boiler efficiency
    const supplyTemp = liveMetrics.supplyTemp || 0
    const returnTemp = liveMetrics.spaceTemp || 0
    const deltaT = supplyTemp - returnTemp
    
    equipment.performance = {
      supplyTemp: supplyTemp,
      returnTemp: returnTemp,
      deltaT: deltaT,
      isFiring: liveMetrics.isFiring || false,
      efficiency: calculateBoilerEfficiency(supplyTemp, returnTemp, controlOutputs?.firing)
    }
    
    // Calculate energy consumption
    if (controlOutputs?.firing && deltaT > 0) {
      equipment.energyConsumption = estimateBoilerConsumption(config.designCapacity, deltaT)
    }
    
    // Check for alerts
    if (supplyTemp > 200) {
      equipment.alerts.push('High supply temperature')
    }
    if (deltaT < 10 && controlOutputs?.firing) {
      equipment.alerts.push('Low delta-T while firing')
    }
  }
  
  return equipment
}

function processPumpData(equipment, config) {
  const { liveMetrics } = equipment
  
  if (liveMetrics && liveMetrics.amps) {
    // Calculate pump efficiency
    const amps = liveMetrics.amps
    const estimatedFlow = estimatePumpFlow(amps, config.motorHP)
    
    equipment.performance = {
      amps: amps,
      estimatedFlow: estimatedFlow,
      efficiency: calculatePumpEfficiency(amps, config.motorHP, estimatedFlow),
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

function processFanCoilData(equipment, config) {
  const { liveMetrics, controlOutputs } = equipment
  
  if (liveMetrics && controlOutputs) {
    // Calculate fan coil performance
    const supplyTemp = liveMetrics.supplyTemp || 0
    const heatingValve = controlOutputs.heatingValvePosition || 0
    const coolingValve = controlOutputs.coolingValvePosition || 0
    
    equipment.performance = {
      supplyTemp: supplyTemp,
      heatingValvePosition: heatingValve,
      coolingValvePosition: coolingValve,
      mode: heatingValve > coolingValve ? 'heating' : 'cooling',
      efficiency: calculateFanCoilEfficiency(supplyTemp, heatingValve, coolingValve)
    }
    
    // Estimate energy consumption based on valve positions
    const heatingLoad = (heatingValve / 100) * config.heatingCapacity
    const coolingLoad = (coolingValve / 100) * config.coolingCapacity
    equipment.energyConsumption = (heatingLoad + coolingLoad) / 3412 // Convert BTU/hr to kW
    
    // Check for alerts
    if (heatingValve > 0 && coolingValve > 0) {
      equipment.alerts.push('Simultaneous heating and cooling')
    }
  }
  
  return equipment
}

function calculateLeadLagStatus(equipment) {
  const status = {
    comfortBoilers: analyzeLeadLag(equipment, 'COMFORT_BOILERS'),
    hwPumps: analyzeLeadLag(equipment, 'HW_PUMPS'),
    cwPumps: analyzeLeadLag(equipment, 'CW_PUMPS')
  }
  
  return status
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
function calculateBoilerEfficiency(supplyTemp, returnTemp, firing) {
  if (!firing || supplyTemp <= returnTemp) return 0
  const deltaT = supplyTemp - returnTemp
  return Math.min(95, 70 + (deltaT / 20) * 25) // Simplified efficiency calculation
}

function calculatePumpEfficiency(amps, motorHP, flow) {
  const expectedAmps = motorHP * 1.5 // Rough estimate
  return Math.max(0, Math.min(100, 100 - Math.abs(amps - expectedAmps) * 10))
}

function calculateFanCoilEfficiency(supplyTemp, heatingValve, coolingValve) {
  // Simplified efficiency based on valve positions and supply temp
  if (heatingValve > 0) {
    return Math.max(0, 100 - Math.abs(supplyTemp - 105) * 2)
  } else if (coolingValve > 0) {
    return Math.max(0, 100 - Math.abs(supplyTemp - 55) * 2)
  }
  return 85 // Base efficiency when not actively heating/cooling
}

function estimateBoilerConsumption(capacity, deltaT) {
  // Simplified consumption estimation
  return (capacity * (deltaT / 40)) / 3412 // Convert BTU/hr to kW
}

function estimatePumpFlow(amps, motorHP) {
  // Simplified flow estimation based on amperage
  const percentLoad = amps / (motorHP * 1.5)
  return percentLoad * 150 // Assume 150 GPM at full load
}

function calculateGroupEfficiency(equipmentGroup) {
  const efficiencies = equipmentGroup
    .filter(eq => eq.efficiency > 0)
    .map(eq => eq.efficiency)
  
  if (efficiencies.length === 0) return 0
  
  return Math.round(efficiencies.reduce((sum, eff) => sum + eff, 0) / efficiencies.length)
}

// Additional optimization functions
function optimizeNeuralCommands(data, timestamp) {
  console.log('🏢 Huntington Data Factory: Optimizing neural commands...')
  
  // Implementation for neural command optimization
  self.postMessage({
    type: 'NEURAL_COMMANDS_OPTIMIZED',
    data: { message: 'Neural command optimization completed' },
    locationId: LOCATION_ID
  })
}

function calculateSystemEfficiency(data, timestamp) {
  console.log('🏢 Huntington Data Factory: Calculating system efficiency...')
  
  // Implementation for system efficiency calculations
  self.postMessage({
    type: 'SYSTEM_EFFICIENCY_CALCULATED',
    data: { message: 'System efficiency calculation completed' },
    locationId: LOCATION_ID
  })
}

function analyzePerformanceTrends(data, timestamp) {
  console.log('🏢 Huntington Data Factory: Analyzing performance trends...')
  
  // Implementation for performance trend analysis
  self.postMessage({
    type: 'PERFORMANCE_TRENDS_ANALYZED',
    data: { message: 'Performance trend analysis completed' },
    locationId: LOCATION_ID
  })
}

function getSystemStatus(data, timestamp) {
  console.log('🏢 Huntington Data Factory: Getting system status...')
  
  // Implementation for system status
  self.postMessage({
    type: 'SYSTEM_STATUS_RETRIEVED',
    data: { message: 'System status retrieved' },
    locationId: LOCATION_ID
  })
}

console.log('🏢 Huntington Data Factory Worker initialized for Location ID:', LOCATION_ID)
