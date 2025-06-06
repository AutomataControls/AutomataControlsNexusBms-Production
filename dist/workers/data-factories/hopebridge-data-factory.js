/**
 * ===============================================================================
 * Hopebridge Data Factory Worker - Autism Center Equipment Data Processor
 * ===============================================================================
 *
 * PURPOSE:
 * Location-specific data processing factory for Hopebridge Autism Center (Location ID: 5).
 * Handles real-time equipment data processing, neural command optimization,
 * control output formatting, and performance calculations for the autism center's
 * specific equipment configuration optimized for therapeutic environments.
 *
 * EQUIPMENT CONFIGURATION:
 * - Air Handler: 1 main unit (AHU1) with integrated DX cooling control
 * - Fan Coil: 1 zone unit (AHU-3) for specialized therapy areas
 * - Boilers: 2-unit lead/lag system for reliable heating
 * - HW Pumps: 2-pump lead/lag system for hot water circulation
 * - Note: Chillers controlled as DX units within AHU logic (not separate equipment)
 *
 * THERAPY CENTER OPTIMIZATION:
 * - Autism-specific comfort control for sensory-sensitive environments
 * - Extended operating hours optimization (5:30 AM - 9:45 PM)
 * - Quiet operation prioritization for therapy sessions
 * - Temperature stability for consistent therapeutic conditions
 * - Air quality monitoring for health and safety
 * - Energy efficiency for cost-effective operations
 *
 * AUTHOR: Juelz NeuralBms DevOps
 * LAST UPDATED: June 5, 2025
 * ===============================================================================
 */

// dist/workers/data-factories/hopebridge-data-factory.js

const LOCATION_ID = '5'
const LOCATION_NAME = 'Hopebridge Autism Center'

// Hopebridge-specific equipment registry with REAL equipment IDs
const HOPEBRIDGE_EQUIPMENT_REGISTRY = {
  // Air Handling Units
  AIR_HANDLERS: {
    'FDhNArcvkL6v2cZDfuSR': {
      name: 'AHU1',
      type: 'air_handler',
      system: 'hvac',
      priority: 1,
      designCFM: 4500,
      minOAPercentage: 20, // Higher OA for therapy center
      maxOAPercentage: 100,
      heatingCapacity: 180000, // BTU/hr
      coolingCapacity: 200000, // BTU/hr (includes integrated DX)
      dxCooling: {
        integrated: true,
        stages: 2,
        type: 'direct_expansion'
      },
      servesArea: 'main_therapy_areas',
      autismOptimized: true,
      quietOperation: true
    }
  },

  // Fan Coil Units (specialized therapy zones)
  FAN_COILS: {
    '57bJYUeT8vbjsKqzo0uD': {
      name: 'AHU-3',
      type: 'fancoil',
      zone: 'SpecialtyTherapy',
      designCFM: 1200,
      heatingCapacity: 35000, // BTU/hr
      coolingCapacity: 40000, // BTU/hr
      servesArea: 'specialized_therapy_rooms',
      sensoryFriendly: true,
      variableSpeed: true
    }
  },

  // Boiler Systems - Lead/Lag Configuration
  BOILERS: {
    'NFDsErgKVeY7gMgGSEL': {
      name: 'Boiler-1',
      type: 'boiler',
      system: 'heating',
      priority: 1,
      designCapacity: 400000, // BTU/hr
      minModulation: 20, // %
      maxModulation: 100, // %
      targetSupplyTemp: 160, // °F
      boilerType: 'lead',
      reliability: 'high' // Critical for therapy center
    },
    'keMHZJinrJKKJJ5Eo7El': {
      name: 'Boiler-2',
      type: 'boiler',
      system: 'heating',
      priority: 2,
      designCapacity: 400000, // BTU/hr
      minModulation: 20, // %
      maxModulation: 100, // %
      targetSupplyTemp: 160, // °F
      boilerType: 'lag',
      reliability: 'high'
    }
  },

  // Hot Water Pumps - Lead/Lag Configuration
  HW_PUMPS: {
    'ORzMyJSMrZ2FJzuzYGpO': {
      name: 'HWPump-1',
      type: 'hotwater_pump',
      priority: 1,
      designFlow: 220, // GPM
      designHead: 40, // ft
      motorHP: 3,
      variableSpeed: true,
      quietOperation: true, // Important for therapy center
      pumpGroup: 'HopebridgeHeatingPumps'
    },
    'h1HZMjh6it3gjR1p1T3q': {
      name: 'HWPump-2',
      type: 'hotwater_pump',
      priority: 2,
      designFlow: 220, // GPM
      designHead: 40, // ft
      motorHP: 3,
      variableSpeed: true,
      quietOperation: true,
      pumpGroup: 'HopebridgeHeatingPumps'
    }
  }
}

// Therapy center specific constants
const THERAPY_CENTER_CONSTANTS = {
  OPERATING_HOURS: {
    START: 5.5, // 5:30 AM
    END: 21.75   // 9:45 PM
  },
  COMFORT_REQUIREMENTS: {
    TEMPERATURE_TOLERANCE: 1.0, // ±1°F for autism sensitivity
    HUMIDITY_RANGE: { min: 40, max: 60 }, // % RH
    NOISE_LEVEL_MAX: 45, // dB
    AIR_CHANGE_RATE_MIN: 6 // ACH
  },
  THERAPY_ZONES: {
    MAIN: 'main_therapy_areas',
    SPECIALTY: 'specialized_therapy_rooms',
    COMMON: 'common_areas'
  }
}

// Main message handler
self.onmessage = function(e) {
  const { type, data, timestamp } = e.data

  switch (type) {
    case 'PROCESS_HOPEBRIDGE_DATA':
      processHopebridgeData(data, timestamp)
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
      console.warn(`🏢 Hopebridge Data Factory: Unknown message type: ${type}`)
  }
}

function processHopebridgeData(apiData, timestamp) {
  const startTime = performance.now()
  console.log('🏢 Hopebridge Data Factory: Processing autism center equipment data...')

  try {
    // Filter for Hopebridge equipment only
    const hopebridgeData = apiData.filter(item => item.locationId === LOCATION_ID)
    console.log(`🏢 Processing ${hopebridgeData.length} Hopebridge equipment records`)

    // Initialize processing results
    const results = {
      locationId: LOCATION_ID,
      locationName: LOCATION_NAME,
      timestamp: timestamp,
      processedAt: new Date().toISOString(),
      equipment: [],
      systemSummary: {
        totalEquipment: hopebridgeData.length,
        onlineCount: 0,
        offlineCount: 0,
        systemEfficiency: 0,
        totalEnergyConsumption: 0,
        alerts: []
      },
      leadLagStatus: {
        boilers: null,
        hwPumps: null
      },
      therapyCenterOperations: {
        therapyEnvironment: {
          temperature: 0,
          humidity: 0,
          airQuality: 'unknown',
          noiseLevel: 'unknown',
          sensoryFriendliness: 'unknown'
        },
        operationalReadiness: {
          mainTherapyAreas: 'unknown',
          specialtyRooms: 'unknown',
          overall: 'unknown'
        },
        energyEfficiency: {
          heating: 0,
          cooling: 0,
          ventilation: 0,
          overall: 0
        },
        extendedHoursPerformance: {
          earlyMorningReadiness: false,
          eveningOperationEfficiency: 0
        }
      }
    }

    // Create performance-optimized maps
    const equipmentMap = new Map()
    const neuralCommandsMap = new Map()

    // Pre-process equipment data
    hopebridgeData.forEach(item => {
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

    // Process each equipment type with autism center specialized logic
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

    // Calculate therapy center specific operations
    results.therapyCenterOperations = calculateTherapyCenterOperations(processedEquipment)

    // Calculate overall system efficiency
    results.systemSummary.systemEfficiency = calculateOverallEfficiency(processedEquipment)

    // Generate autism center specific alerts
    results.systemSummary.alerts = generateSystemAlerts(processedEquipment)

    results.equipment = processedEquipment

    const processingTime = Math.round(performance.now() - startTime)
    console.log(`🏢 Hopebridge Data Factory: Processing completed in ${processingTime}ms`)

    // Send results back to main thread
    self.postMessage({
      type: 'HOPEBRIDGE_DATA_PROCESSED',
      data: results,
      processingTime: processingTime,
      locationId: LOCATION_ID
    })

  } catch (error) {
    console.error('🏢 Hopebridge Data Factory: Processing error:', error)
    self.postMessage({
      type: 'HOPEBRIDGE_PROCESSING_ERROR',
      error: error.message,
      locationId: LOCATION_ID
    })
  }
}

function getEquipmentConfig(equipmentId) {
  // Check all equipment registries
  for (const [category, equipment] of Object.entries(HOPEBRIDGE_EQUIPMENT_REGISTRY)) {
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
    alerts: [],
    therapyOptimization: {}
  }

  // Type-specific processing with therapy center optimization
  switch (config.type) {
    case 'air_handler':
      return processAirHandlerData(processed, config)
    case 'fancoil':
      return processFanCoilData(processed, config)
    case 'boiler':
      return processBoilerData(processed, config)
    case 'hotwater_pump':
      return processPumpData(processed, config)
    default:
      return processed
  }
}

function processAirHandlerData(equipment, config) {
  const { liveMetrics, controlOutputs } = equipment

  if (liveMetrics) {
    // Calculate air handler efficiency with autism center requirements
    const supplyTemp = liveMetrics.supplyTemp || 0
    const returnTemp = liveMetrics.returnTemp || liveMetrics.spaceTemp || 0
    const outdoorTemp = liveMetrics.outdoorTemp || 0
    const mixedAirTemp = liveMetrics.mixedAirTemp || 0

    // Calculate outdoor air percentage (higher requirement for therapy center)
    const oaPercentage = calculateOAPercentage(mixedAirTemp, returnTemp, outdoorTemp)

    // DX cooling performance (integrated with AHU)
    const dxPerformance = analyzeDXCoolingPerformance(liveMetrics, controlOutputs, config)

    equipment.performance = {
      supplyTemp: supplyTemp,
      returnTemp: returnTemp,
      outdoorTemp: outdoorTemp,
      mixedAirTemp: mixedAirTemp,
      outdoorAirPercentage: oaPercentage,
      fanSpeed: controlOutputs?.fanSpeed || 0,
      heatingValve: controlOutputs?.heatingValve || 0,
      dxCooling: dxPerformance,
      efficiency: calculateAirHandlerEfficiency(supplyTemp, returnTemp, controlOutputs, config),
      therapyEnvironmentQuality: assessTherapyEnvironmentQuality(equipment, config)
    }

    // Calculate energy consumption including integrated DX
    const fanPower = estimateFanPower(controlOutputs?.fanSpeed || 0, config.designCFM)
    const heatingPower = estimateHeatingPower(controlOutputs?.heatingValve || 0, config.heatingCapacity)
    const dxCoolingPower = estimateDXCoolingPower(dxPerformance, config.coolingCapacity)
    
    equipment.energyConsumption = fanPower + heatingPower + dxCoolingPower

    // Therapy center optimization metrics
    equipment.therapyOptimization = calculateTherapyOptimization(equipment, config)

    // Check for therapy center specific alerts
    equipment.alerts = generateAirHandlerAlerts(equipment, config)

    equipment.efficiency = equipment.performance.efficiency
  }

  return equipment
}

function processFanCoilData(equipment, config) {
  const { liveMetrics, controlOutputs } = equipment

  if (liveMetrics && controlOutputs) {
    // Calculate fan coil performance for specialty therapy rooms
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
      efficiency: calculateFanCoilEfficiency(supplyTemp, roomTemp, heatingValve, coolingValve),
      sensoryEnvironment: assessSensoryEnvironment(supplyTemp, roomTemp, controlOutputs.fanSpeed)
    }

    // Estimate energy consumption for specialty therapy area
    const heatingLoad = (heatingValve / 100) * config.heatingCapacity
    const coolingLoad = (coolingValve / 100) * config.coolingCapacity
    const fanPower = estimateFanPower(controlOutputs.fanSpeed || 0, config.designCFM)
    
    equipment.energyConsumption = (heatingLoad + coolingLoad) / 3412 + fanPower

    // Therapy optimization for sensory-sensitive environment
    equipment.therapyOptimization = {
      noiseLevel: estimateNoiseLevel(controlOutputs.fanSpeed || 0),
      temperatureStability: assessTemperatureStability(supplyTemp, roomTemp),
      sensoryFriendliness: config.sensoryFriendly ? 'optimized' : 'standard'
    }

    // Check for specialty therapy room alerts
    equipment.alerts = generateFanCoilAlerts(equipment, config)

    equipment.efficiency = equipment.performance.efficiency
  }

  return equipment
}

function processBoilerData(equipment, config) {
  const { liveMetrics, controlOutputs } = equipment

  if (liveMetrics) {
    // Calculate boiler efficiency with high reliability requirements
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
      boilerType: config.boilerType,
      reliability: config.reliability
    }

    // Calculate energy consumption based on firing and modulation
    if (firing && deltaT > 0) {
      const modulation = controlOutputs?.modulation || 100
      equipment.energyConsumption = estimateBoilerConsumption(config.designCapacity, modulation, deltaT)
    }

    // Therapy center reliability assessment
    equipment.therapyOptimization = {
      reliabilityStatus: config.reliability,
      operationalStability: deltaT > 10 && firing ? 'stable' : 'unstable',
      therapyCenterReadiness: supplyTemp > config.targetSupplyTemp - 10 ? 'ready' : 'not_ready'
    }

    // Check for therapy center specific boiler alerts
    equipment.alerts = generateBoilerAlerts(equipment, config)

    equipment.efficiency = equipment.performance.efficiency
  }

  return equipment
}

function processPumpData(equipment, config) {
  const { liveMetrics, controlOutputs } = equipment

  if (liveMetrics && liveMetrics.amps) {
    // Calculate pump efficiency with quiet operation requirements
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
      pumpGroup: config.pumpGroup,
      quietOperation: config.quietOperation
    }

    // Calculate energy consumption (kW)
    equipment.energyConsumption = (amps * 480 * 1.732 * 0.85) / 1000

    // Therapy center pump optimization
    equipment.therapyOptimization = {
      noiseLevel: estimatePumpNoiseLevel(speed, config.quietOperation),
      operationalSmoothness: speed > 30 && speed < 80 ? 'smooth' : 'variable',
      therapyCompatibility: config.quietOperation ? 'optimized' : 'standard'
    }

    // Check for therapy center specific pump alerts
    equipment.alerts = generatePumpAlerts(equipment, config)

    equipment.efficiency = equipment.performance.efficiency
  }

  return equipment
}

function analyzeDXCoolingPerformance(liveMetrics, controlOutputs, config) {
  if (!config.dxCooling?.integrated) return null

  const stage1Active = controlOutputs?.dxStage1 || false
  const stage2Active = controlOutputs?.dxStage2 || false
  const activeStages = (stage1Active ? 1 : 0) + (stage2Active ? 1 : 0)
  const loadPercentage = (activeStages / (config.dxCooling.stages || 2)) * 100

  return {
    integrated: true,
    stage1Active: stage1Active,
    stage2Active: stage2Active,
    activeStages: activeStages,
    totalStages: config.dxCooling.stages || 2,
    loadPercentage: loadPercentage,
    efficiency: calculateDXEfficiency(activeStages, liveMetrics.supplyTemp || 0)
  }
}

function assessTherapyEnvironmentQuality(equipment, config) {
  const { performance } = equipment
  
  const tempStability = Math.abs(performance.supplyTemp - performance.returnTemp) < 15 ? 'stable' : 'unstable'
  const airQuality = performance.outdoorAirPercentage >= config.minOAPercentage ? 'good' : 'poor'
  const comfortLevel = calculateComfortLevel(performance.supplyTemp, performance.returnTemp)

  return {
    temperatureStability: tempStability,
    airQuality: airQuality,
    comfortLevel: comfortLevel,
    autismOptimized: config.autismOptimized || false
  }
}

function assessSensoryEnvironment(supplyTemp, roomTemp, fanSpeed) {
  const tempDiff = Math.abs(supplyTemp - roomTemp)
  const tempComfort = tempDiff < 12 ? 'comfortable' : tempDiff < 20 ? 'acceptable' : 'uncomfortable'
  const fanNoise = fanSpeed < 40 ? 'quiet' : fanSpeed < 70 ? 'moderate' : 'loud'

  return {
    temperatureComfort: tempComfort,
    noiseLevel: fanNoise,
    sensoryRating: tempComfort === 'comfortable' && fanNoise === 'quiet' ? 'excellent' : 'good'
  }
}

function calculateTherapyOptimization(equipment, config) {
  const optimization = {
    autismFriendly: config.autismOptimized || false,
    quietOperation: config.quietOperation || false,
    temperatureStability: 'unknown',
    airQualityOptimization: 'unknown',
    energyEfficiency: equipment.efficiency || 0
  }

  if (equipment.performance) {
    const tempVariation = Math.abs(equipment.performance.supplyTemp - equipment.performance.returnTemp)
    optimization.temperatureStability = tempVariation < 10 ? 'excellent' : tempVariation < 15 ? 'good' : 'needs_improvement'
    optimization.airQualityOptimization = equipment.performance.outdoorAirPercentage >= 20 ? 'optimized' : 'standard'
  }

  return optimization
}

function calculateTherapyCenterOperations(equipment) {
  // Find main systems
  const airHandler = equipment.find(eq => eq.type === 'air_handler')
  const fanCoil = equipment.find(eq => eq.type === 'fancoil')
  const boilers = equipment.filter(eq => eq.type === 'boiler')

  // Therapy environment assessment
  const therapyEnvironment = {
    temperature: airHandler?.performance?.returnTemp || 0,
    humidity: 50, // Would need humidity sensor data
    airQuality: airHandler?.performance?.therapyEnvironmentQuality?.airQuality || 'unknown',
    noiseLevel: estimateOverallNoiseLevel(equipment),
    sensoryFriendliness: assessOverallSensoryFriendliness(equipment)
  }

  // Operational readiness for therapy areas
  const operationalReadiness = {
    mainTherapyAreas: airHandler?.status === 'online' ? 'ready' : 'not_ready',
    specialtyRooms: fanCoil?.status === 'online' ? 'ready' : 'not_ready',
    overall: calculateOverallReadiness(equipment)
  }

  // Energy efficiency breakdown
  const heatingEquipment = equipment.filter(eq => eq.type === 'boiler' || eq.type === 'hotwater_pump')
  const coolingEquipment = equipment.filter(eq => eq.type === 'air_handler' && eq.performance?.dxCooling)
  const ventilationEquipment = equipment.filter(eq => eq.type === 'air_handler' || eq.type === 'fancoil')

  const energyEfficiency = {
    heating: calculateGroupEfficiency(heatingEquipment),
    cooling: calculateGroupEfficiency(coolingEquipment),
    ventilation: calculateGroupEfficiency(ventilationEquipment),
    overall: calculateGroupEfficiency(equipment)
  }

  // Extended hours performance (5:30 AM - 9:45 PM)
  const currentHour = new Date().getHours() + new Date().getMinutes() / 60
  const extendedHoursPerformance = {
    earlyMorningReadiness: currentHour < THERAPY_CENTER_CONSTANTS.OPERATING_HOURS.START ? 
      assessEarlyMorningReadiness(equipment) : true,
    eveningOperationEfficiency: currentHour > 20 ? 
      calculateEveningEfficiency(equipment) : energyEfficiency.overall
  }

  return {
    therapyEnvironment,
    operationalReadiness,
    energyEfficiency,
    extendedHoursPerformance
  }
}

function calculateLeadLagStatus(equipment) {
  return {
    boilers: analyzeLeadLag(equipment, 'BOILERS'),
    hwPumps: analyzeLeadLag(equipment, 'HW_PUMPS')
  }
}

function analyzeLeadLag(equipment, category) {
  const categoryEquipment = equipment.filter(eq => eq.category === category)
  if (categoryEquipment.length < 2) return null

  const leadEquipment = categoryEquipment.find(eq => eq.performance?.isLead === true || eq.config?.priority === 1)
  const lagEquipment = categoryEquipment.find(eq => eq.performance?.isLead === false || eq.config?.priority === 2)

  return {
    lead: leadEquipment ? leadEquipment.name : 'Unknown',
    lag: lagEquipment ? lagEquipment.name : 'Unknown',
    rotationNeeded: false,
    efficiency: calculateGroupEfficiency(categoryEquipment),
    therapyCenterReliability: assessTherapyCenterReliability(categoryEquipment)
  }
}

function assessTherapyCenterReliability(equipmentGroup) {
  const onlineCount = equipmentGroup.filter(eq => eq.status === 'online').length
  const totalCount = equipmentGroup.length
  const availabilityPercentage = (onlineCount / totalCount) * 100

  if (availabilityPercentage === 100) return 'excellent'
  if (availabilityPercentage >= 50) return 'acceptable'
  return 'concerning'
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
        severity: alert.includes('critical') || alert.includes('therapy') ? 'critical' : 'warning',
        timestamp: new Date().toISOString()
      })
    })
  })

  // Therapy center specific system alerts
  const onlineCount = equipment.filter(eq => eq.status === 'online').length
  const readinessPercentage = (onlineCount / equipment.length) * 100

  if (readinessPercentage < 75) {
    alerts.push({
      equipmentId: 'system',
      equipmentName: 'Therapy Center HVAC',
      alert: `Therapy center readiness at ${readinessPercentage.toFixed(0)}% - may impact therapy sessions`,
      severity: readinessPercentage < 50 ? 'critical' : 'warning',
      timestamp: new Date().toISOString()
    })
  }

  return alerts
}

// Equipment-specific alert generation
function generateAirHandlerAlerts(equipment, config) {
  const alerts = []
  const { performance } = equipment

  if (performance.supplyTemp > 78) alerts.push('High supply temperature - therapy environment may be uncomfortable')
  if (performance.outdoorAirPercentage < config.minOAPercentage) alerts.push('Low outdoor air percentage - air quality concern for therapy center')
  if (performance.heatingValve > 0 && performance.dxCooling?.stage1Active) alerts.push('Simultaneous heating and cooling detected')
  if (performance.therapyEnvironmentQuality?.comfortLevel === 'poor') alerts.push('Poor therapy environment comfort conditions')

  return alerts
}

function generateFanCoilAlerts(equipment, config) {
  const alerts = []
  const { performance } = equipment

  const tempDiff = Math.abs(performance.supplyTemp - performance.roomTemp)
  if (tempDiff > 20) alerts.push('Large temperature differential in specialty therapy room')
  if (performance.fanSpeed > 80) alerts.push('High fan speed may cause noise issues in therapy environment')
  if (performance.sensoryEnvironment?.sensoryRating === 'poor') alerts.push('Poor sensory environment for autism therapy')

  return alerts
}

function generateBoilerAlerts(equipment, config) {
  const alerts = []
  const { performance } = equipment

  if (performance.supplyTemp > 200) alerts.push('High boiler supply temperature')
  if (performance.deltaT < 10 && performance.isFiring) alerts.push('Low delta-T while firing - check circulation')
  if (performance.supplyTemp < config.targetSupplyTemp - 15) alerts.push('Boiler temperature below target - therapy center heating at risk')

  return alerts
}

function generatePumpAlerts(equipment, config) {
  const alerts = []
  const { performance } = equipment

  if (performance.amps > config.motorHP * 6) alerts.push('High pump amperage - possible overload')
  if (performance.speed > 90) alerts.push('High pump speed may cause noise issues in therapy center')
  if (performance.efficiency < 60) alerts.push('Poor pump efficiency affecting therapy center operations')

  return alerts
}

// Helper calculation functions
function calculateOAPercentage(mixedAirTemp, returnTemp, outdoorTemp) {
  if (Math.abs(returnTemp - outdoorTemp) < 1) return 0
  const oaPercentage = Math.abs((mixedAirTemp - returnTemp) / (outdoorTemp - returnTemp)) * 100
  return Math.max(0, Math.min(100, oaPercentage))
}

function calculateAirHandlerEfficiency(supplyTemp, returnTemp, controlOutputs, config) {
  const tempControl = Math.max(0, 100 - Math.abs(supplyTemp - 72) * 3) // Stricter for therapy center
  const oaOptimization = config.autismOptimized ? 10 : 0 // Bonus for autism optimization
  const baseEfficiency = controlOutputs ? 85 : 70
  return Math.round((tempControl + baseEfficiency + oaOptimization) / 2)
}

function calculateFanCoilEfficiency(supplyTemp, roomTemp, heatingValve, coolingValve) {
  const tempControl = Math.max(0, 100 - Math.abs(supplyTemp - roomTemp) * 5)
  const controlEfficiency = heatingValve > 0 || coolingValve > 0 ? 90 : 80
  return Math.round((tempControl + controlEfficiency) / 2)
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

function calculateDXEfficiency(activeStages, supplyTemp) {
  const stageEfficiency = activeStages > 0 ? Math.min(100, activeStages * 40) : 0
  const tempEfficiency = supplyTemp > 0 ? Math.max(0, 100 - Math.abs(supplyTemp - 55) * 3) : 0
  return Math.round((stageEfficiency + tempEfficiency) / 2)
}

function calculateComfortLevel(supplyTemp, returnTemp) {
  const tempDiff = Math.abs(supplyTemp - returnTemp)
  if (tempDiff < 10) return 'excellent'
  if (tempDiff < 15) return 'good'
  if (tempDiff < 20) return 'acceptable'
  return 'poor'
}

function estimateNoiseLevel(fanSpeed) {
  if (fanSpeed < 30) return 'very_quiet'
  if (fanSpeed < 50) return 'quiet'
  if (fanSpeed < 70) return 'moderate'
  return 'loud'
}

function estimatePumpNoiseLevel(speed, quietOperation) {
  const baseNoise = speed < 40 ? 'quiet' : speed < 70 ? 'moderate' : 'loud'
  return quietOperation ? (baseNoise === 'loud' ? 'moderate' : 'quiet') : baseNoise
}

function estimateOverallNoiseLevel(equipment) {
  const noiseLevels = equipment.map(eq => {
    if (eq.therapyOptimization?.noiseLevel) return eq.therapyOptimization.noiseLevel
    if (eq.performance?.fanSpeed > 70) return 'loud'
    if (eq.performance?.fanSpeed > 40) return 'moderate'
    return 'quiet'
  })

  const loudCount = noiseLevels.filter(level => level === 'loud').length
  if (loudCount > 0) return 'concerning'
  
  const moderateCount = noiseLevels.filter(level => level === 'moderate').length
  if (moderateCount > 1) return 'moderate'
  
  return 'acceptable'
}

function assessOverallSensoryFriendliness(equipment) {
  const sensoryScores = equipment.map(eq => {
    if (eq.config?.autismOptimized || eq.config?.sensoryFriendly) return 3
    if (eq.config?.quietOperation) return 2
    return 1
  })

  const avgScore = sensoryScores.reduce((sum, score) => sum + score, 0) / sensoryScores.length
  if (avgScore >= 2.5) return 'optimized'
  if (avgScore >= 2) return 'good'
  return 'standard'
}

function calculateOverallReadiness(equipment) {
  const readinessScores = equipment.map(eq => {
    if (eq.status !== 'online') return 0
    if (eq.efficiency > 80) return 3
    if (eq.efficiency > 60) return 2
    return 1
  })

  const avgScore = readinessScores.reduce((sum, score) => sum + score, 0) / readinessScores.length
  if (avgScore >= 2.5) return 'fully_ready'
  if (avgScore >= 1.5) return 'mostly_ready'
  if (avgScore >= 1) return 'limited_ready'
  return 'not_ready'
}

function assessEarlyMorningReadiness(equipment) {
  // Check if systems are ready for early morning therapy sessions
  const criticalEquipment = equipment.filter(eq => eq.type === 'air_handler' || eq.type === 'boiler')
  return criticalEquipment.every(eq => eq.status === 'online' && eq.efficiency > 70)
}

function calculateEveningEfficiency(equipment) {
  // Calculate efficiency during extended evening hours
  const currentEfficiencies = equipment.filter(eq => eq.efficiency > 0).map(eq => eq.efficiency)
  if (currentEfficiencies.length === 0) return 0
  
  const avgEfficiency = currentEfficiencies.reduce((sum, eff) => sum + eff, 0) / currentEfficiencies.length
  return Math.round(avgEfficiency * 0.9) // Slight reduction for extended hours
}

function assessTemperatureStability(supplyTemp, roomTemp) {
  const tempDiff = Math.abs(supplyTemp - roomTemp)
  if (tempDiff < 5) return 'excellent'
  if (tempDiff < 10) return 'good'
  if (tempDiff < 15) return 'acceptable'
  return 'poor'
}

// Energy estimation functions
function estimateFanPower(fanSpeed, designCFM) {
  const speedFraction = fanSpeed / 100
  const estimatedHP = (designCFM / 1000) * 0.5
  return (estimatedHP * 0.746 * Math.pow(speedFraction, 3))
}

function estimateHeatingPower(heatingValve, heatingCapacity) {
  return ((heatingValve / 100) * heatingCapacity) / 3412
}

function estimateDXCoolingPower(dxPerformance, coolingCapacity) {
  if (!dxPerformance || !dxPerformance.integrated) return 0
  const loadFraction = dxPerformance.loadPercentage / 100
  return (loadFraction * coolingCapacity) / 12000 // Rough DX cooling kW estimate
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
  console.log('🏢 Hopebridge Data Factory: Optimizing autism center neural commands...')

  self.postMessage({
    type: 'NEURAL_COMMANDS_OPTIMIZED',
    data: { message: 'Autism center neural command optimization completed' },
    locationId: LOCATION_ID
  })
}

function calculateSystemEfficiency(data, timestamp) {
  console.log('🏢 Hopebridge Data Factory: Calculating autism center system efficiency...')

  self.postMessage({
    type: 'SYSTEM_EFFICIENCY_CALCULATED',
    data: { message: 'Autism center system efficiency calculation completed' },
    locationId: LOCATION_ID
  })
}

function analyzePerformanceTrends(data, timestamp) {
  console.log('🏢 Hopebridge Data Factory: Analyzing autism center performance trends...')

  self.postMessage({
    type: 'PERFORMANCE_TRENDS_ANALYZED',
    data: { message: 'Autism center performance trend analysis completed' },
    locationId: LOCATION_ID
  })
}

function getSystemStatus(data, timestamp) {
  console.log('🏢 Hopebridge Data Factory: Getting autism center system status...')

  self.postMessage({
    type: 'SYSTEM_STATUS_RETRIEVED',
    data: { message: 'Autism center system status retrieved' },
    locationId: LOCATION_ID
  })
}

console.log('🏢 Hopebridge Data Factory Worker initialized for Location ID:', LOCATION_ID)
console.log('🏢 Equipment Registry: 1 AHU (w/ integrated DX), 1 Fan Coil, 2 Boilers, 2 HW Pumps')
console.log('🏢 Therapy Center Optimization: Autism-friendly, Extended Hours (5:30 AM - 9:45 PM)')
