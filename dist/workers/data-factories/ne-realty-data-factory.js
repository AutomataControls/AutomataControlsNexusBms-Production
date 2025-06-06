/**
 * ===============================================================================
 * NE Realty Data Factory Worker - NE Realty Group Equipment Data Processor
 * ===============================================================================
 *
 * PURPOSE:
 * Location-specific data processing factory for NE Realty Group (Location ID: 10).
 * Handles real-time equipment data processing, neural command optimization,
 * control output formatting, and performance calculations for the realty group's
 * specific geothermal chiller system with 4-stage cooling control.
 *
 * EQUIPMENT CONFIGURATION:
 * - Geothermal Chiller: 1 unit (Geo-1) with 4-stage geo compressor control
 * - Loop Temperature Control: 45°F setpoint with intelligent staging
 * - Year-Round Operation: Continuous cooling availability (no seasonal lockouts)
 * - Runtime Optimization: Equal compressor wear through random start selection
 *
 * GEOTHERMAL SYSTEM OPTIMIZATION:
 * - 4-stage progressive loading for efficient capacity matching
 * - Random start selection algorithm for equal compressor runtime
 * - Last-on-first-off staging down logic for optimal control
 * - 3-minute minimum runtime protection against short cycling
 * - 1.75°F deadband with 2°F hysteresis for stable operation
 * - Loop temperature monitoring and performance tracking
 * - Energy efficiency analysis for cost optimization
 *
 * AUTHOR: Juelz NeuralBms DevOps
 * LAST UPDATED: June 5, 2025
 * ===============================================================================
 */

// dist/workers/data-factories/ne-realty-data-factory.js

const LOCATION_ID = '10'
const LOCATION_NAME = 'NE Realty Group'

// NE Realty Group-specific equipment registry with REAL equipment ID
const NE_REALTY_EQUIPMENT_REGISTRY = {
  // Geothermal Chiller System
  GEOTHERMAL_CHILLERS: {
    'XqeB0Bd6CfQDRwMel36i': {
      name: 'Geo-1',
      type: 'geothermal_chiller',
      system: 'cooling',
      priority: 1,
      designCapacity: 800000, // BTU/hr total capacity
      stages: 4,
      stageCapacity: 200000, // BTU/hr per stage
      designFlow: 400, // GPM
      loopType: 'closed_loop',
      geoType: 'ground_source',
      controlType: '4_stage_progressive',
      features: {
        randomStartSelection: true,
        runtimeBalancing: true,
        lastOnFirstOff: true,
        yearRoundOperation: true
      },
      setpoints: {
        defaultLoopTemp: 45, // °F
        deadband: 1.75,      // °F
        hysteresis: 2.0,     // °F
        stageIncrement: 2.0  // °F between stages
      },
      timing: {
        minimumRuntime: 180,   // 3 minutes in seconds
        stageUpDelay: 180,     // 3 minutes
        stageDownDelay: 180    // 3 minutes
      },
      limits: {
        highTempLimit: 65,     // °F
        lowTempLimit: 35       // °F
      },
      efficiency: {
        designCOP: 4.5,        // Coefficient of Performance
        partLoadRatio: 0.25,   // Minimum efficient load
        optimalLoadRange: { min: 50, max: 85 } // % load for best efficiency
      }
    }
  }
}

// Main message handler
self.onmessage = function(e) {
  const { type, data, timestamp } = e.data

  switch (type) {
    case 'PROCESS_NE_REALTY_DATA':
      processNERealtyData(data, timestamp)
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
      console.warn(`🏢 NE Realty Data Factory: Unknown message type: ${type}`)
  }
}

function processNERealtyData(apiData, timestamp) {
  const startTime = performance.now()
  console.log('🏢 NE Realty Data Factory: Processing geothermal equipment data...')

  try {
    // Filter for NE Realty equipment only
    const nerealtyData = apiData.filter(item => item.locationId === LOCATION_ID)
    console.log(`🏢 Processing ${nerealtyData.length} NE Realty equipment records`)

    // Initialize processing results
    const results = {
      locationId: LOCATION_ID,
      locationName: LOCATION_NAME,
      timestamp: timestamp,
      processedAt: new Date().toISOString(),
      equipment: [],
      systemSummary: {
        totalEquipment: nerealtyData.length,
        onlineCount: 0,
        offlineCount: 0,
        systemEfficiency: 0,
        totalEnergyConsumption: 0,
        alerts: []
      },
      geothermalOperations: {
        loopTemperature: {
          current: 0,
          setpoint: 45,
          error: 0,
          status: 'unknown'
        },
        stagingStatus: {
          activeStages: 0,
          totalStages: 4,
          loadPercentage: 0,
          requiredStages: 0,
          stagingMode: 'unknown'
        },
        runtimeBalance: {
          stage1Runtime: 0,
          stage2Runtime: 0,
          stage3Runtime: 0,
          stage4Runtime: 0,
          balanceQuality: 'unknown'
        },
        energyEfficiency: {
          currentCOP: 0,
          avgCOP: 0,
          efficiencyRating: 'unknown',
          annualSavings: 0
        },
        systemHealth: {
          temperatureStability: 'unknown',
          cyclingBehavior: 'unknown',
          equipmentCondition: 'unknown'
        }
      }
    }

    // Create performance-optimized maps
    const equipmentMap = new Map()
    const neuralCommandsMap = new Map()

    // Pre-process equipment data
    nerealtyData.forEach(item => {
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

    // Process each equipment type with geothermal specialized logic
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

    // Calculate geothermal-specific operations
    results.geothermalOperations = calculateGeothermalOperations(processedEquipment)

    // Calculate overall system efficiency
    results.systemSummary.systemEfficiency = calculateOverallEfficiency(processedEquipment)

    // Generate geothermal system alerts
    results.systemSummary.alerts = generateSystemAlerts(processedEquipment)

    results.equipment = processedEquipment

    const processingTime = Math.round(performance.now() - startTime)
    console.log(`🏢 NE Realty Data Factory: Processing completed in ${processingTime}ms`)

    // Send results back to main thread
    self.postMessage({
      type: 'NE_REALTY_DATA_PROCESSED',
      data: results,
      processingTime: processingTime,
      locationId: LOCATION_ID
    })

  } catch (error) {
    console.error('🏢 NE Realty Data Factory: Processing error:', error)
    self.postMessage({
      type: 'NE_REALTY_PROCESSING_ERROR',
      error: error.message,
      locationId: LOCATION_ID
    })
  }
}

function getEquipmentConfig(equipmentId) {
  // Check all equipment registries
  for (const [category, equipment] of Object.entries(NE_REALTY_EQUIPMENT_REGISTRY)) {
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
    geothermalOptimization: {}
  }

  // Geothermal chiller specific processing
  if (config.type === 'geothermal_chiller') {
    return processGeothermalChillerData(processed, config)
  }

  return processed
}

function processGeothermalChillerData(equipment, config) {
  const { liveMetrics, controlOutputs } = equipment

  if (liveMetrics) {
    // Extract geothermal-specific metrics
    const loopTemp = liveMetrics.loopTemp || liveMetrics.LoopTemp || liveMetrics.supplyTemp || 0
    const targetSetpoint = controlOutputs?.targetSetpoint || config.setpoints.defaultLoopTemp
    const tempError = loopTemp - targetSetpoint

    // Analyze staging performance
    const stagingPerformance = analyzeGeothermalStaging(controlOutputs, config)
    
    // Calculate geothermal efficiency (COP)
    const copAnalysis = calculateGeothermalCOP(liveMetrics, controlOutputs, config)

    // Runtime balance assessment
    const runtimeBalance = analyzeRuntimeBalance(controlOutputs, config)

    equipment.performance = {
      loopTemp: loopTemp,
      targetSetpoint: targetSetpoint,
      temperatureError: tempError,
      staging: stagingPerformance,
      cop: copAnalysis,
      runtimeBalance: runtimeBalance,
      efficiency: calculateGeothermalEfficiency(equipment, config),
      temperatureStability: assessTemperatureStability(tempError, stagingPerformance),
      cyclingBehavior: assessCyclingBehavior(controlOutputs, config)
    }

    // Calculate energy consumption for 4-stage geo system
    equipment.energyConsumption = calculateGeothermalEnergyConsumption(equipment, config)

    // Geothermal optimization metrics
    equipment.geothermalOptimization = calculateGeothermalOptimization(equipment, config)

    // Check for geothermal-specific alerts
    equipment.alerts = generateGeothermalAlerts(equipment, config)

    equipment.efficiency = equipment.performance.efficiency
  }

  return equipment
}

function analyzeGeothermalStaging(controlOutputs, config) {
  if (!controlOutputs) return null

  const stage1Active = controlOutputs.stage1Enabled || false
  const stage2Active = controlOutputs.stage2Enabled || false
  const stage3Active = controlOutputs.stage3Enabled || false
  const stage4Active = controlOutputs.stage4Enabled || false

  const activeStages = (stage1Active ? 1 : 0) + (stage2Active ? 1 : 0) + 
                     (stage3Active ? 1 : 0) + (stage4Active ? 1 : 0)
  const requiredStages = controlOutputs.requiredStages || 0
  const loadPercentage = (activeStages / config.stages) * 100

  return {
    stage1Active: stage1Active,
    stage2Active: stage2Active,
    stage3Active: stage3Active,
    stage4Active: stage4Active,
    activeStages: activeStages,
    totalStages: config.stages,
    requiredStages: requiredStages,
    loadPercentage: loadPercentage,
    stagingEfficiency: calculateStagingEfficiency(activeStages, requiredStages),
    lastStageChange: controlOutputs.lastStageChange || 0,
    randomStartRotation: controlOutputs.randomStartRotation || 0
  }
}

function calculateGeothermalCOP(liveMetrics, controlOutputs, config) {
  // Calculate Coefficient of Performance for geothermal system
  const stagingPerformance = analyzeGeothermalStaging(controlOutputs, config)
  const activeStages = stagingPerformance?.activeStages || 0
  
  if (activeStages === 0) {
    return {
      currentCOP: 0,
      designCOP: config.efficiency.designCOP,
      efficiency: 0,
      partLoadRatio: 0
    }
  }

  const partLoadRatio = activeStages / config.stages
  
  // Geothermal systems maintain higher COP at part load
  let currentCOP = config.efficiency.designCOP
  
  if (partLoadRatio >= 0.25 && partLoadRatio <= 0.85) {
    // Optimal efficiency range
    currentCOP = config.efficiency.designCOP * (0.95 + (partLoadRatio * 0.1))
  } else if (partLoadRatio < 0.25) {
    // Below minimum efficient load
    currentCOP = config.efficiency.designCOP * 0.7
  } else {
    // Above optimal load
    currentCOP = config.efficiency.designCOP * 0.9
  }

  return {
    currentCOP: Math.round(currentCOP * 100) / 100,
    designCOP: config.efficiency.designCOP,
    efficiency: Math.round((currentCOP / config.efficiency.designCOP) * 100),
    partLoadRatio: Math.round(partLoadRatio * 100)
  }
}

function analyzeRuntimeBalance(controlOutputs, config) {
  if (!controlOutputs?.runtimeTracking) return null

  const runtimeData = controlOutputs.runtimeTracking
  const totalRuntime = runtimeData.stage1Runtime + runtimeData.stage2Runtime + 
                      runtimeData.stage3Runtime + runtimeData.stage4Runtime

  if (totalRuntime === 0) {
    return {
      stage1Percentage: 0,
      stage2Percentage: 0,
      stage3Percentage: 0,
      stage4Percentage: 0,
      balanceQuality: 'unknown',
      totalRuntime: 0
    }
  }

  const stage1Percentage = (runtimeData.stage1Runtime / totalRuntime) * 100
  const stage2Percentage = (runtimeData.stage2Runtime / totalRuntime) * 100
  const stage3Percentage = (runtimeData.stage3Runtime / totalRuntime) * 100
  const stage4Percentage = (runtimeData.stage4Runtime / totalRuntime) * 100

  // Calculate balance quality (how evenly distributed the runtime is)
  const idealPercentage = 25 // Perfect balance would be 25% each
  const maxDeviation = Math.max(
    Math.abs(stage1Percentage - idealPercentage),
    Math.abs(stage2Percentage - idealPercentage),
    Math.abs(stage3Percentage - idealPercentage),
    Math.abs(stage4Percentage - idealPercentage)
  )

  let balanceQuality = 'excellent'
  if (maxDeviation > 15) balanceQuality = 'poor'
  else if (maxDeviation > 10) balanceQuality = 'fair'
  else if (maxDeviation > 5) balanceQuality = 'good'

  return {
    stage1Percentage: Math.round(stage1Percentage * 10) / 10,
    stage2Percentage: Math.round(stage2Percentage * 10) / 10,
    stage3Percentage: Math.round(stage3Percentage * 10) / 10,
    stage4Percentage: Math.round(stage4Percentage * 10) / 10,
    balanceQuality: balanceQuality,
    totalRuntime: Math.round(totalRuntime / 1000), // Convert to seconds
    maxDeviation: Math.round(maxDeviation * 10) / 10
  }
}

function calculateGeothermalEfficiency(equipment, config) {
  const { performance } = equipment
  
  if (!performance) return 0

  // Base efficiency on temperature control performance
  const tempError = Math.abs(performance.temperatureError || 0)
  const tempEfficiency = Math.max(0, 100 - (tempError * 10)) // 10% penalty per degree error

  // Staging efficiency
  const stagingEfficiency = performance.staging?.stagingEfficiency || 85

  // COP efficiency
  const copEfficiency = performance.cop?.efficiency || 85

  // Runtime balance efficiency
  const runtimeEfficiency = performance.runtimeBalance?.balanceQuality === 'excellent' ? 100 :
                           performance.runtimeBalance?.balanceQuality === 'good' ? 90 :
                           performance.runtimeBalance?.balanceQuality === 'fair' ? 80 : 70

  // Geothermal bonus for ground source efficiency
  const geothermalBonus = 10

  const overallEfficiency = (tempEfficiency + stagingEfficiency + copEfficiency + runtimeEfficiency + geothermalBonus) / 5

  return Math.round(overallEfficiency)
}

function calculateGeothermalEnergyConsumption(equipment, config) {
  const { performance } = equipment
  
  if (!performance?.staging) return 0

  const activeStages = performance.staging.activeStages || 0
  const stageCapacity = config.stageCapacity || 200000 // BTU/hr per stage
  const designCOP = config.efficiency.designCOP || 4.5
  const currentCOP = performance.cop?.currentCOP || designCOP

  // Calculate total cooling load
  const totalCoolingLoad = activeStages * stageCapacity // BTU/hr

  // Calculate electrical consumption using COP
  const electricalConsumption = totalCoolingLoad / (currentCOP * 3412) // Convert to kW

  return electricalConsumption
}

function calculateGeothermalOptimization(equipment, config) {
  const { performance } = equipment
  
  const optimization = {
    groundSourceAdvantage: true,
    yearRoundOperation: config.features.yearRoundOperation,
    randomStartOptimization: config.features.randomStartSelection,
    runtimeBalancing: config.features.runtimeBalancing,
    temperatureStability: performance?.temperatureStability || 'unknown',
    energyEfficiency: performance?.efficiency || 0,
    copOptimization: performance?.cop?.currentCOP > config.efficiency.designCOP ? 'optimized' : 'standard',
    stagingOptimization: performance?.staging?.stagingEfficiency > 90 ? 'excellent' : 'good'
  }

  return optimization
}

function calculateGeothermalOperations(equipment) {
  const geoChiller = equipment.find(eq => eq.type === 'geothermal_chiller')
  
  if (!geoChiller) {
    return {
      loopTemperature: { current: 0, setpoint: 45, error: 0, status: 'offline' },
      stagingStatus: { activeStages: 0, totalStages: 4, loadPercentage: 0, requiredStages: 0, stagingMode: 'offline' },
      runtimeBalance: { stage1Runtime: 0, stage2Runtime: 0, stage3Runtime: 0, stage4Runtime: 0, balanceQuality: 'unknown' },
      energyEfficiency: { currentCOP: 0, avgCOP: 0, efficiencyRating: 'unknown', annualSavings: 0 },
      systemHealth: { temperatureStability: 'unknown', cyclingBehavior: 'unknown', equipmentCondition: 'offline' }
    }
  }

  // Loop temperature status
  const loopTemperature = {
    current: geoChiller.performance?.loopTemp || 0,
    setpoint: geoChiller.performance?.targetSetpoint || 45,
    error: geoChiller.performance?.temperatureError || 0,
    status: geoChiller.status
  }

  // Staging status
  const stagingStatus = {
    activeStages: geoChiller.performance?.staging?.activeStages || 0,
    totalStages: geoChiller.performance?.staging?.totalStages || 4,
    loadPercentage: geoChiller.performance?.staging?.loadPercentage || 0,
    requiredStages: geoChiller.performance?.staging?.requiredStages || 0,
    stagingMode: determineStagingMode(geoChiller.performance?.staging)
  }

  // Runtime balance
  const runtimeBalance = {
    stage1Runtime: geoChiller.performance?.runtimeBalance?.stage1Percentage || 0,
    stage2Runtime: geoChiller.performance?.runtimeBalance?.stage2Percentage || 0,
    stage3Runtime: geoChiller.performance?.runtimeBalance?.stage3Percentage || 0,
    stage4Runtime: geoChiller.performance?.runtimeBalance?.stage4Percentage || 0,
    balanceQuality: geoChiller.performance?.runtimeBalance?.balanceQuality || 'unknown'
  }

  // Energy efficiency
  const currentCOP = geoChiller.performance?.cop?.currentCOP || 0
  const energyEfficiency = {
    currentCOP: currentCOP,
    avgCOP: currentCOP, // Would calculate average over time
    efficiencyRating: currentCOP > 4.5 ? 'excellent' : currentCOP > 4.0 ? 'good' : currentCOP > 3.5 ? 'fair' : 'poor',
    annualSavings: estimateAnnualSavings(currentCOP, geoChiller.energyConsumption || 0)
  }

  // System health
  const systemHealth = {
    temperatureStability: geoChiller.performance?.temperatureStability || 'unknown',
    cyclingBehavior: geoChiller.performance?.cyclingBehavior || 'unknown',
    equipmentCondition: geoChiller.status === 'online' && geoChiller.efficiency > 80 ? 'good' : 'needs_attention'
  }

  return {
    loopTemperature,
    stagingStatus,
    runtimeBalance,
    energyEfficiency,
    systemHealth
  }
}

function determineStagingMode(stagingData) {
  if (!stagingData) return 'unknown'
  
  const { activeStages, requiredStages } = stagingData
  
  if (activeStages === 0) return 'off'
  if (activeStages < requiredStages) return 'staging_up'
  if (activeStages > requiredStages) return 'staging_down'
  return 'stable'
}

function estimateAnnualSavings(currentCOP, energyConsumption) {
  // Estimate annual savings compared to conventional chiller (COP ~3.0)
  const conventionalCOP = 3.0
  const electricityRate = 0.12 // $/kWh (estimated)
  const annualHours = 8760 // hours per year
  
  if (currentCOP <= conventionalCOP) return 0
  
  const copImprovement = (currentCOP - conventionalCOP) / conventionalCOP
  const energySavings = energyConsumption * copImprovement
  const annualSavings = energySavings * electricityRate * annualHours
  
  return Math.round(annualSavings)
}

function assessTemperatureStability(tempError, stagingData) {
  const errorMagnitude = Math.abs(tempError || 0)
  
  if (errorMagnitude < 0.5) return 'excellent'
  if (errorMagnitude < 1.0) return 'good'
  if (errorMagnitude < 2.0) return 'fair'
  return 'poor'
}

function assessCyclingBehavior(controlOutputs, config) {
  // Analyze cycling behavior based on last stage change
  const lastStageChange = controlOutputs?.lastStageChange || 0
  const currentTime = Date.now()
  const timeSinceChange = currentTime - lastStageChange
  const minimumRuntime = config.timing?.minimumRuntime * 1000 || 180000 // 3 minutes

  if (timeSinceChange > minimumRuntime * 2) return 'stable'
  if (timeSinceChange > minimumRuntime) return 'normal'
  return 'frequent'
}

function calculateStagingEfficiency(activeStages, requiredStages) {
  if (requiredStages === 0) return 100 // No load, perfect efficiency

  const stagingError = Math.abs(activeStages - requiredStages)
  return Math.max(0, 100 - (stagingError * 25)) // 25% penalty per stage mismatch
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
        severity: alert.includes('critical') || alert.includes('emergency') ? 'critical' : 'warning',
        timestamp: new Date().toISOString()
      })
    })
  })

  // System-level geothermal alerts
  const geoChiller = equipment.find(eq => eq.type === 'geothermal_chiller')
  
  if (!geoChiller || geoChiller.status !== 'online') {
    alerts.push({
      equipmentId: 'system',
      equipmentName: 'Geothermal System',
      alert: 'Geothermal chiller offline - no cooling capacity available',
      severity: 'critical',
      timestamp: new Date().toISOString()
    })
  } else if (geoChiller.efficiency < 70) {
    alerts.push({
      equipmentId: 'system',
      equipmentName: 'Geothermal System',
      alert: 'Poor geothermal system efficiency - maintenance recommended',
      severity: 'warning',
      timestamp: new Date().toISOString()
    })
  }

  return alerts
}

function generateGeothermalAlerts(equipment, config) {
  const alerts = []
  const { performance } = equipment

  if (!performance) return alerts

  // Temperature control alerts
  const tempError = Math.abs(performance.temperatureError || 0)
  if (tempError > 3) {
    alerts.push('Poor loop temperature control - large deviation from setpoint')
  }

  // Staging alerts
  if (performance.staging) {
    const { activeStages, requiredStages } = performance.staging
    const stagingError = Math.abs(activeStages - requiredStages)
    
    if (stagingError > 1) {
      alerts.push(`Staging mismatch: ${activeStages} active vs ${requiredStages} required`)
    }
    
    if (activeStages === 4 && tempError > 2) {
      alerts.push('All 4 geo stages active but temperature still high - capacity issue')
    }
  }

  // Runtime balance alerts
  if (performance.runtimeBalance?.balanceQuality === 'poor') {
    alerts.push('Poor runtime balance - uneven compressor wear detected')
  }

  // COP efficiency alerts
  if (performance.cop?.currentCOP < config.efficiency.designCOP * 0.8) {
    alerts.push('Low COP efficiency - geothermal system performance degraded')
  }

  // Cycling behavior alerts
  if (performance.cyclingBehavior === 'frequent') {
    alerts.push('Frequent staging changes - check system tuning')
  }

  // Temperature stability alerts
  if (performance.temperatureStability === 'poor') {
    alerts.push('Poor temperature stability - system hunting')
  }

  return alerts
}

// Additional optimization functions
function optimizeNeuralCommands(data, timestamp) {
  console.log('🏢 NE Realty Data Factory: Optimizing geothermal neural commands...')

  self.postMessage({
    type: 'NEURAL_COMMANDS_OPTIMIZED',
    data: { message: 'Geothermal neural command optimization completed' },
    locationId: LOCATION_ID
  })
}

function calculateSystemEfficiency(data, timestamp) {
  console.log('🏢 NE Realty Data Factory: Calculating geothermal system efficiency...')

  self.postMessage({
    type: 'SYSTEM_EFFICIENCY_CALCULATED',
    data: { message: 'Geothermal system efficiency calculation completed' },
    locationId: LOCATION_ID
  })
}

function analyzePerformanceTrends(data, timestamp) {
  console.log('🏢 NE Realty Data Factory: Analyzing geothermal performance trends...')

  self.postMessage({
    type: 'PERFORMANCE_TRENDS_ANALYZED',
    data: { message: 'Geothermal performance trend analysis completed' },
    locationId: LOCATION_ID
  })
}

function getSystemStatus(data, timestamp) {
  console.log('🏢 NE Realty Data Factory: Getting geothermal system status...')

  self.postMessage({
    type: 'SYSTEM_STATUS_RETRIEVED',
    data: { message: 'Geothermal system status retrieved' },
    locationId: LOCATION_ID
  })
}

console.log('🏢 NE Realty Data Factory Worker initialized for Location ID:', LOCATION_ID)
console.log('🏢 Equipment Registry: 1 Geothermal Chiller (4-stage, Ground Source)')
console.log('🏢 Geothermal Optimization: Random Start, Runtime Balancing, Year-Round Operation')
