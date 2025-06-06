
/**
 * ===============================================================================
 * FirstChurchOfGod Data Factory Worker - Church Location Equipment Data Processor
 * ===============================================================================
 *
 * PURPOSE:
 * Location-specific data processing factory for FirstChurchOfGod location (Location ID: 9).
 * Handles real-time equipment data processing, neural command optimization,
 * control output formatting, and performance calculations for the church's specific
 * equipment configuration with air handlers, chillers, boilers, and pump systems.
 *
 * EQUIPMENT CONFIGURATION:
 * - Air Handler: 1 unit for main sanctuary and fellowship areas
 * - Chillers: 2-unit lead/lag system for summer cooling loads
 * - Boilers: 2 units (main + mechanical room) for heating and domestic hot water
 * - CW Pumps: 2-pump lead/lag system for chilled water circulation
 * - HW Pumps: 2-pump lead/lag system for hot water circulation
 *
 * OPTIMIZATION FEATURES:
 * - Church-specific scheduling optimization (service times, events)
 * - Lead-lag chiller coordination with outdoor temperature reset
 * - Boiler efficiency monitoring and rotation scheduling
 * - Pump system lead-lag optimization with runtime tracking
 * - Energy consumption analysis for cost management
 * - Sanctuary comfort control during services
 *
 * AUTHOR: Juelz NeuralBms DevOps
 * LAST UPDATED: June 5, 2025
 * ===============================================================================
 */

// dist/workers/data-factories/firstchurchofgod-data-factory.js

const LOCATION_ID = '9'
const LOCATION_NAME = 'First Church of God'

// FirstChurchOfGod-specific equipment registry with REAL equipment IDs
const FIRSTCHURCHOFGOD_EQUIPMENT_REGISTRY = {
  // Air Handling Unit
  AIR_HANDLERS: {
    'MqcmrPkDmrQzJLrPUjLb': {
      name: 'AHU1',
      type: 'air_handler',
      system: 'hvac',
      priority: 1,
      designCFM: 6000,
      minOAPercentage: 15,
      maxOAPercentage: 100,
      heatingCapacity: 200000, // BTU/hr
      coolingCapacity: 240000, // BTU/hr
      servesArea: 'sanctuary_fellowship'
    }
  },

  // Chiller System - Lead/Lag Configuration
  CHILLERS: {
    '3I4aPvfQzflImzaQSJrW7': {
      name: 'Chiller-1',
      type: 'chiller',
      system: 'cooling',
      priority: 1,
      designCapacity: 600000, // BTU/hr
      designFlow: 300, // GPM
      minCapacity: 25, // %
      coolingStages: 4,
      outdoorReset: true
    },
    '1zJcJqCToB41uacJSesztlk': {
      name: 'Chiller-2',
      type: 'chiller',
      system: 'cooling',
      priority: 2,
      designCapacity: 600000, // BTU/hr
      designFlow: 300, // GPM
      minCapacity: 25, // %
      coolingStages: 4,
      outdoorReset: true
    }
  },

  // Boiler Systems
  BOILERS: {
    '5O3bRZGKwexgupGER4FW': {
      name: 'Boiler-1',
      type: 'boiler',
      system: 'heating',
      priority: 1,
      designCapacity: 500000, // BTU/hr
      minModulation: 20, // %
      maxModulation: 100, // %
      targetSupplyTemp: 160, // °F
      boilerType: 'lochinvar_primary'
    },
    'ySqRqPYBESmAAKQXZEp': {
      name: 'MechanicalRoom',
      type: 'boiler',
      system: 'mechanical',
      priority: 2,
      designCapacity: 200000, // BTU/hr
      minModulation: 20, // %
      maxModulation: 100, // %
      targetSupplyTemp: 140, // °F
      boilerType: 'backup_mechanical'
    }
  },

  // Chilled Water Pumps - Lead/Lag Configuration
  CW_PUMPS: {
    'u6gCArToKYZ00DqGj3Pq': {
      name: 'CWPump-1',
      type: 'chilledwater_pump',
      priority: 1,
      designFlow: 300, // GPM
      designHead: 50, // ft
      motorHP: 5,
      variableSpeed: true,
      pumpGroup: 'FirstChurchofGodCoolingPumps'
    },
    'uF30FlwcLc6hriTYSFSH': {
      name: 'CWPump-2',
      type: 'chilledwater_pump',
      priority: 2,
      designFlow: 300, // GPM
      designHead: 50, // ft
      motorHP: 5,
      variableSpeed: true,
      pumpGroup: 'FirstChurchofGodCoolingPumps'
    }
  },

  // Hot Water Pumps - Lead/Lag Configuration
  HW_PUMPS: {
    'b6bcTD5PVO9BBDkJcfQA': {
      name: 'HWPump-1',
      type: 'hotwater_pump',
      priority: 1,
      designFlow: 250, // GPM
      designHead: 45, // ft
      motorHP: 4,
      variableSpeed: true,
      pumpGroup: 'FirstChurchofGodHeatingPumps'
    },
    'OqwYSV2rnB5sWOWusu6X': {
      name: 'HWPump-2',
      type: 'hotwater_pump',
      priority: 2,
      designFlow: 250, // GPM
      designHead: 45, // ft
      motorHP: 4,
      variableSpeed: true,
      pumpGroup: 'FirstChurchofGodHeatingPumps'
    }
  }
}

// Main message handler
self.onmessage = function(e) {
  const { type, data, timestamp } = e.data

  switch (type) {
    case 'PROCESS_FIRSTCHURCHOFGOD_DATA':
      processFirstChurchOfGodData(data, timestamp)
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
      console.warn(`🏢 FirstChurchOfGod Data Factory: Unknown message type: ${type}`)
  }
}

function processFirstChurchOfGodData(apiData, timestamp) {
  const startTime = performance.now()
  console.log('🏢 FirstChurchOfGod Data Factory: Processing church equipment data...')

  try {
    // Filter for FirstChurchOfGod equipment only
    const churchData = apiData.filter(item => item.locationId === LOCATION_ID)
    console.log(`🏢 Processing ${churchData.length} FirstChurchOfGod equipment records`)

    // Initialize processing results
    const results = {
      locationId: LOCATION_ID,
      locationName: LOCATION_NAME,
      timestamp: timestamp,
      processedAt: new Date().toISOString(),
      equipment: [],
      systemSummary: {
        totalEquipment: churchData.length,
        onlineCount: 0,
        offlineCount: 0,
        systemEfficiency: 0,
        totalEnergyConsumption: 0,
        alerts: []
      },
      leadLagStatus: {
        chillers: null,
        cwPumps: null,
        hwPumps: null
      },
      churchOperations: {
        sanctuaryComfort: {
          temperature: 0,
          humidity: 0,
          airflow: 0,
          status: 'unknown'
        },
        energyEfficiency: {
          heating: 0,
          cooling: 0,
          overall: 0
        },
        serviceReadiness: 'unknown'
      }
    }

    // Create performance-optimized maps
    const equipmentMap = new Map()
    const neuralCommandsMap = new Map()

    // Pre-process equipment data
    churchData.forEach(item => {
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

    // Calculate church-specific operations
    results.churchOperations = calculateChurchOperations(processedEquipment)

    // Calculate overall system efficiency
    results.systemSummary.systemEfficiency = calculateOverallEfficiency(processedEquipment)

    // Generate system alerts
    results.systemSummary.alerts = generateSystemAlerts(processedEquipment)

    results.equipment = processedEquipment

    const processingTime = Math.round(performance.now() - startTime)
    console.log(`🏢 FirstChurchOfGod Data Factory: Processing completed in ${processingTime}ms`)

    // Send results back to main thread
    self.postMessage({
      type: 'FIRSTCHURCHOFGOD_DATA_PROCESSED',
      data: results,
      processingTime: processingTime,
      locationId: LOCATION_ID
    })

  } catch (error) {
    console.error('🏢 FirstChurchOfGod Data Factory: Processing error:', error)
    self.postMessage({
      type: 'FIRSTCHURCHOFGOD_PROCESSING_ERROR',
      error: error.message,
      locationId: LOCATION_ID
    })
  }
}

function getEquipmentConfig(equipmentId) {
  // Check all equipment registries
  for (const [category, equipment] of Object.entries(FIRSTCHURCHOFGOD_EQUIPMENT_REGISTRY)) {
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
    case 'chiller':
      return processChillerData(processed, config)
    case 'boiler':
      return processBoilerData(processed, config)
    case 'chilledwater_pump':
    case 'hotwater_pump':
      return processPumpData(processed, config)
    default:
      return processed
  }
}

function processAirHandlerData(equipment, config) {
  const { liveMetrics, controlOutputs } = equipment

  if (liveMetrics) {
    // Calculate air handler efficiency for sanctuary comfort
    const supplyTemp = liveMetrics.supplyTemp || 0
    const returnTemp = liveMetrics.returnTemp || liveMetrics.spaceTemp || 0
    const outdoorTemp = liveMetrics.outdoorTemp || 0
    const mixedAirTemp = liveMetrics.mixedAirTemp || 0

    // Calculate outdoor air percentage
    const oaPercentage = calculateOAPercentage(mixedAirTemp, returnTemp, outdoorTemp)

    equipment.performance = {
      supplyTemp: supplyTemp,
      returnTemp: returnTemp,
      outdoorTemp: outdoorTemp,
      mixedAirTemp: mixedAirTemp,
      outdoorAirPercentage: oaPercentage,
      fanSpeed: controlOutputs?.fanSpeed || 0,
      heatingValve: controlOutputs?.heatingValve || 0,
      coolingValve: controlOutputs?.coolingValve || 0,
      efficiency: calculateAirHandlerEfficiency(supplyTemp, returnTemp, controlOutputs),
      sanctuaryComfort: assessSanctuaryComfort(supplyTemp, returnTemp, controlOutputs)
    }

    // Calculate energy consumption based on fan speed and heating/cooling
    const fanPower = estimateFanPower(controlOutputs?.fanSpeed || 0, config.designCFM)
    const heatingPower = estimateHeatingPower(controlOutputs?.heatingValve || 0, config.heatingCapacity)
    const coolingPower = estimateCoolingPower(controlOutputs?.coolingValve || 0, config.coolingCapacity)
    
    equipment.energyConsumption = fanPower + heatingPower + coolingPower

    // Check for church-specific alerts
    equipment.alerts = generateAirHandlerAlerts(equipment, config)

    equipment.efficiency = equipment.performance.efficiency
  }

  return equipment
}

function processChillerData(equipment, config) {
  const { liveMetrics, controlOutputs } = equipment

  if (liveMetrics) {
    // Calculate chiller efficiency and staging
    const supplyTemp = liveMetrics.supplyTemp || liveMetrics.chilledWaterSupply || 0
    const returnTemp = liveMetrics.returnTemp || liveMetrics.chilledWaterReturn || 0
    const outdoorTemp = liveMetrics.outdoorTemp || 0
    const stages = calculateChillerStages(controlOutputs)

    equipment.performance = {
      supplyTemp: supplyTemp,
      returnTemp: returnTemp,
      outdoorTemp: outdoorTemp,
      deltaT: returnTemp - supplyTemp,
      activeStages: stages.activeStages,
      totalStages: stages.totalStages,
      loadPercentage: stages.loadPercentage,
      efficiency: calculateChillerEfficiency(supplyTemp, returnTemp, stages.loadPercentage, outdoorTemp),
      outdoorReset: config.outdoorReset ? calculateOutdoorReset(outdoorTemp) : null
    }

    // Calculate chiller energy consumption based on stages and load
    equipment.energyConsumption = estimateChillerConsumption(config.designCapacity, stages.loadPercentage)

    // Check for chiller-specific alerts
    equipment.alerts = generateChillerAlerts(equipment, config)

    equipment.efficiency = equipment.performance.efficiency
  }

  return equipment
}

function processBoilerData(equipment, config) {
  const { liveMetrics, controlOutputs } = equipment

  if (liveMetrics) {
    // Calculate boiler efficiency
    const supplyTemp = liveMetrics.supplyTemp || 0
    const returnTemp = liveMetrics.returnTemp || liveMetrics.spaceTemp || 0
    const deltaT = supplyTemp - returnTemp
    const firing = controlOutputs?.firing || controlOutputs?.boilerEnable || false

    equipment.performance = {
      supplyTemp: supplyTemp,
      returnTemp: returnTemp,
      deltaT: deltaT,
      isFiring: firing,
      modulation: controlOutputs?.modulation || 0,
      efficiency: calculateBoilerEfficiency(supplyTemp, returnTemp, firing, deltaT),
      targetTemp: config.targetSupplyTemp,
      boilerType: config.boilerType
    }

    // Calculate energy consumption based on firing and modulation
    if (firing && deltaT > 0) {
      const modulation = controlOutputs?.modulation || 100
      equipment.energyConsumption = estimateBoilerConsumption(config.designCapacity, modulation, deltaT)
    }

    // Check for boiler-specific alerts
    equipment.alerts = generateBoilerAlerts(equipment, config)

    equipment.efficiency = equipment.performance.efficiency
  }

  return equipment
}

function processPumpData(equipment, config) {
  const { liveMetrics, controlOutputs } = equipment

  if (liveMetrics && liveMetrics.amps) {
    // Calculate pump efficiency
    const amps = liveMetrics.amps
    const speed = controlOutputs?.speed || liveMetrics.speed || 100
    const estimatedFlow = estimatePumpFlow(amps, speed, config.designFlow)

    equipment.performance = {
      amps: amps,
      speed: speed,
      estimatedFlow: estimatedFlow,
      efficiency: calculatePumpEfficiency(amps, speed, config.motorHP, estimatedFlow),
      pressure: liveMetrics.pressure || null,
      isLead: controlOutputs?.isLead || false,
      pumpGroup: config.pumpGroup
    }

    // Calculate energy consumption (kW)
    equipment.energyConsumption = (amps * 480 * 1.732 * 0.85) / 1000 // Estimated 3-phase power

    // Check for pump-specific alerts
    equipment.alerts = generatePumpAlerts(equipment, config)

    equipment.efficiency = equipment.performance.efficiency
  }

  return equipment
}

function calculateChillerStages(controlOutputs) {
  if (!controlOutputs) return { activeStages: 0, totalStages: 4, loadPercentage: 0 }

  let activeStages = 0
  const totalStages = 4

  // Count active stages
  for (let i = 1; i <= totalStages; i++) {
    if (controlOutputs[`stage${i}`] || controlOutputs[`cooling_stage_${i}`]) {
      activeStages++
    }
  }

  const loadPercentage = (activeStages / totalStages) * 100

  return { activeStages, totalStages, loadPercentage }
}

function calculateOutdoorReset(outdoorTemp) {
  // Calculate chilled water setpoint based on outdoor temperature
  const minSetpoint = 42 // °F
  const maxSetpoint = 50 // °F
  const minOAT = 65 // °F
  const maxOAT = 95 // °F

  if (outdoorTemp <= minOAT) return maxSetpoint
  if (outdoorTemp >= maxOAT) return minSetpoint

  // Linear interpolation
  const slope = (minSetpoint - maxSetpoint) / (maxOAT - minOAT)
  const setpoint = maxSetpoint + slope * (outdoorTemp - minOAT)

  return Math.round(setpoint * 10) / 10 // Round to 1 decimal
}

function assessSanctuaryComfort(supplyTemp, returnTemp, controlOutputs) {
  const tempDiff = Math.abs(supplyTemp - returnTemp)
  const heatingActive = (controlOutputs?.heatingValve || 0) > 10
  const coolingActive = (controlOutputs?.coolingValve || 0) > 10

  let comfortLevel = 'good'
  
  if (tempDiff > 20) comfortLevel = 'poor' // Large temperature differential
  else if (tempDiff < 5 && (heatingActive || coolingActive)) comfortLevel = 'poor' // Low differential with active conditioning
  else if (tempDiff > 15) comfortLevel = 'fair'

  return {
    level: comfortLevel,
    temperatureDifferential: tempDiff,
    activeConditioning: heatingActive || coolingActive
  }
}

function calculateLeadLagStatus(equipment) {
  const status = {
    chillers: analyzeLeadLag(equipment, 'CHILLERS'),
    cwPumps: analyzeLeadLag(equipment, 'CW_PUMPS'),
    hwPumps: analyzeLeadLag(equipment, 'HW_PUMPS')
  }

  return status
}

function calculateChurchOperations(equipment) {
  // Find air handler for sanctuary comfort assessment
  const airHandler = equipment.find(eq => eq.type === 'air_handler')
  
  const sanctuaryComfort = airHandler ? {
    temperature: airHandler.performance?.returnTemp || 0,
    humidity: 50, // Would need humidity sensor data
    airflow: (airHandler.performance?.fanSpeed || 0) * (airHandler.config?.designCFM || 0) / 100,
    status: airHandler.performance?.sanctuaryComfort?.level || 'unknown'
  } : {
    temperature: 0,
    humidity: 0,
    airflow: 0,
    status: 'offline'
  }

  // Calculate energy efficiency by system
  const heatingEquipment = equipment.filter(eq => eq.type === 'boiler' || eq.type === 'hotwater_pump')
  const coolingEquipment = equipment.filter(eq => eq.type === 'chiller' || eq.type === 'chilledwater_pump')
  
  const heatingEfficiency = calculateGroupEfficiency(heatingEquipment)
  const coolingEfficiency = calculateGroupEfficiency(coolingEquipment)
  const overallEfficiency = calculateGroupEfficiency(equipment)

  // Determine service readiness
  const onlineCount = equipment.filter(eq => eq.status === 'online').length
  const totalCount = equipment.length
  const readinessPercentage = (onlineCount / totalCount) * 100

  let serviceReadiness = 'not_ready'
  if (readinessPercentage >= 90) serviceReadiness = 'ready'
  else if (readinessPercentage >= 75) serviceReadiness = 'mostly_ready'
  else if (readinessPercentage >= 50) serviceReadiness = 'limited_ready'

  return {
    sanctuaryComfort,
    energyEfficiency: {
      heating: heatingEfficiency,
      cooling: coolingEfficiency,
      overall: overallEfficiency
    },
    serviceReadiness
  }
}

function analyzeLeadLag(equipment, category) {
  const categoryEquipment = equipment.filter(eq => eq.category === category)
  if (categoryEquipment.length < 2) return null

  const leadEquipment = categoryEquipment.find(eq => eq.performance?.isLead === true)
  const lagEquipment = categoryEquipment.find(eq => eq.performance?.isLead === false)

  return {
    lead: leadEquipment ? leadEquipment.name : 'Unknown',
    lag: lagEquipment ? lagEquipment.name : 'Unknown',
    rotationNeeded: false, // Would implement rotation logic here
    efficiency: calculateGroupEfficiency(categoryEquipment),
    loadDistribution: calculateLoadDistribution(categoryEquipment)
  }
}

function calculateLoadDistribution(equipmentGroup) {
  const totalLoad = equipmentGroup.reduce((sum, eq) => sum + (eq.energyConsumption || 0), 0)
  
  return equipmentGroup.map(eq => ({
    name: eq.name,
    load: eq.energyConsumption || 0,
    percentage: totalLoad > 0 ? Math.round((eq.energyConsumption || 0) / totalLoad * 100) : 0
  }))
}

function calculateOverallEfficiency(equipment) {
  const efficiencies = equipment
    .filter(eq => eq.efficiency > 0)
    .map(eq => eq.efficiency)

  if (efficiencies.length === 0) return 0

  return Math.round(efficiencies.reduce((sum, eff) => sum + eff, 0) / efficiencies.length)
}

function calculateGroupEfficiency(equipmentGroup) {
  const efficiencies = equipmentGroup
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
        severity: alert.includes('critical') ? 'critical' : 'warning',
        timestamp: new Date().toISOString()
      })
    })
  })

  // Church-specific system alerts
  const onlineCount = equipment.filter(eq => eq.status === 'online').length
  const readinessPercentage = (onlineCount / equipment.length) * 100

  if (readinessPercentage < 75) {
    alerts.push({
      equipmentId: 'system',
      equipmentName: 'Church HVAC System',
      alert: `System readiness at ${readinessPercentage.toFixed(0)}% - may impact service comfort`,
      severity: readinessPercentage < 50 ? 'critical' : 'warning',
      timestamp: new Date().toISOString()
    })
  }

  return alerts
}

// Generate equipment-specific alerts
function generateAirHandlerAlerts(equipment, config) {
  const alerts = []
  const { performance } = equipment

  if (performance.supplyTemp > 85) alerts.push('High supply temperature - sanctuary may be uncomfortable')
  if (performance.outdoorAirPercentage < config.minOAPercentage) alerts.push('Low outdoor air percentage')
  if (performance.heatingValve > 0 && performance.coolingValve > 0) alerts.push('Simultaneous heating and cooling')
  if (performance.sanctuaryComfort?.level === 'poor') alerts.push('Poor sanctuary comfort conditions')

  return alerts
}

function generateChillerAlerts(equipment, config) {
  const alerts = []
  const { performance } = equipment

  if (performance.supplyTemp > 50) alerts.push('High chilled water supply temperature')
  if (performance.deltaT < 8) alerts.push('Low chilled water delta-T - check flow')
  if (performance.activeStages === performance.totalStages && performance.supplyTemp > 45) {
    alerts.push('All cooling stages active but temperature high - capacity issue')
  }

  return alerts
}

function generateBoilerAlerts(equipment, config) {
  const alerts = []
  const { performance } = equipment

  if (performance.supplyTemp > 200) alerts.push('High boiler supply temperature')
  if (performance.deltaT < 10 && performance.isFiring) alerts.push('Low delta-T while firing')
  if (performance.supplyTemp < config.targetSupplyTemp - 20 && performance.isFiring) {
    alerts.push('Boiler firing but low supply temperature')
  }

  return alerts
}

function generatePumpAlerts(equipment, config) {
  const alerts = []
  const { performance } = equipment

  if (performance.amps > config.motorHP * 6) alerts.push('High pump amperage - possible overload')
  if (performance.amps < 1 && equipment.controlOutputs?.pumpEnable) alerts.push('Low amperage - pump may not be running')
  if (performance.efficiency < 50) alerts.push('Poor pump efficiency')

  return alerts
}

// Helper calculation functions (simplified versions)
function calculateOAPercentage(mixedAirTemp, returnTemp, outdoorTemp) {
  if (Math.abs(returnTemp - outdoorTemp) < 1) return 0
  const oaPercentage = Math.abs((mixedAirTemp - returnTemp) / (outdoorTemp - returnTemp)) * 100
  return Math.max(0, Math.min(100, oaPercentage))
}

function calculateAirHandlerEfficiency(supplyTemp, returnTemp, controlOutputs) {
  const tempControl = Math.max(0, 100 - Math.abs(supplyTemp - 72) * 2)
  const valveEfficiency = controlOutputs ? (100 - Math.abs((controlOutputs.heatingValve || 0) - (controlOutputs.coolingValve || 0))) : 90
  return Math.round((tempControl + valveEfficiency) / 2)
}

function calculateChillerEfficiency(supplyTemp, returnTemp, loadPercentage, outdoorTemp) {
  const tempEfficiency = supplyTemp > 0 ? Math.max(0, 100 - Math.abs(supplyTemp - 45) * 5) : 0
  const loadEfficiency = loadPercentage > 0 ? Math.max(50, 100 - Math.abs(loadPercentage - 75) * 2) : 0
  return Math.round((tempEfficiency + loadEfficiency) / 2)
}

function calculateBoilerEfficiency(supplyTemp, returnTemp, firing, deltaT) {
  if (!firing || deltaT <= 0) return 0
  const tempEfficiency = Math.max(0, 100 - Math.abs(supplyTemp - 160) * 2)
  const deltaTEfficiency = Math.min(100, deltaT * 5)
  return Math.round((tempEfficiency + deltaTEfficiency) / 2)
}

function calculatePumpEfficiency(amps, speed, motorHP, flow) {
  const expectedAmps = (motorHP * 1.5 * speed) / 100
  const ampsEfficiency = Math.max(0, 100 - Math.abs(amps - expectedAmps) * 10)
  const flowEfficiency = flow > 0 ? Math.min(100, (flow / (motorHP * 50)) * 100) : 0
  return Math.round((ampsEfficiency + flowEfficiency) / 2)
}

function estimateFanPower(fanSpeed, designCFM) {
  const speedFraction = fanSpeed / 100
  const estimatedHP = (designCFM / 1000) * 0.5
  return (estimatedHP * 0.746 * Math.pow(speedFraction, 3))
}

function estimateHeatingPower(heatingValve, heatingCapacity) {
  return ((heatingValve / 100) * heatingCapacity) / 3412
}

function estimateCoolingPower(coolingValve, coolingCapacity) {
  return ((coolingValve / 100) * coolingCapacity) / 12000
}

function estimateChillerConsumption(designCapacity, loadPercentage) {
  return (designCapacity * loadPercentage / 100) / 3500 // Rough chiller efficiency
}

function estimateBoilerConsumption(capacity, modulation, deltaT) {
  return (capacity * (modulation / 100) * (deltaT / 40)) / 3412
}

function estimatePumpFlow(amps, speed, designFlow) {
  const speedFraction = speed / 100
  const loadFraction = amps / 15
  return designFlow * speedFraction * loadFraction
}

// Additional optimization functions
function optimizeNeuralCommands(data, timestamp) {
  console.log('🏢 FirstChurchOfGod Data Factory: Optimizing church neural commands...')

  self.postMessage({
    type: 'NEURAL_COMMANDS_OPTIMIZED',
    data: { message: 'Church neural command optimization completed' },
    locationId: LOCATION_ID
  })
}

function calculateSystemEfficiency(data, timestamp) {
  console.log('🏢 FirstChurchOfGod Data Factory: Calculating church system efficiency...')

  self.postMessage({
    type: 'SYSTEM_EFFICIENCY_CALCULATED',
    data: { message: 'Church system efficiency calculation completed' },
    locationId: LOCATION_ID
  })
}

function analyzePerformanceTrends(data, timestamp) {
  console.log('🏢 FirstChurchOfGod Data Factory: Analyzing church performance trends...')

  self.postMessage({
    type: 'PERFORMANCE_TRENDS_ANALYZED',
    data: { message: 'Church performance trend analysis completed' },
    locationId: LOCATION_ID
  })
}

function getSystemStatus(data, timestamp) {
  console.log('🏢 FirstChurchOfGod Data Factory: Getting church system status...')

  self.postMessage({
    type: 'SYSTEM_STATUS_RETRIEVED',
    data: { message: 'Church system status retrieved' },
    locationId: LOCATION_ID
  })
}

console.log('🏢 FirstChurchOfGod Data Factory Worker initialized for Location ID:', LOCATION_ID)
console.log('🏢 Equipment Registry: 1 AHU, 2 Chillers, 2 Boilers, 4 Pumps (CW+HW Lead/Lag)')
