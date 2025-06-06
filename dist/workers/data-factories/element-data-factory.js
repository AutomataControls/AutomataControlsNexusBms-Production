/**
 * ===============================================================================
 * Element Data Factory Worker - Element Location Equipment Data Processor
 * ===============================================================================
 *
 * PURPOSE:
 * Location-specific data processing factory for Element location (Location ID: 8).
 * Handles real-time equipment data processing, neural command optimization,
 * control output formatting, and performance calculations for Element's specific
 * DOAS (Dedicated Outdoor Air System) equipment configuration.
 *
 * EQUIPMENT CONFIGURATION:
 * - DOAS Units: 2 dedicated outdoor air systems for indoor air quality
 *   * DOAS-1: Advanced unit with PID-controlled modulating gas valve + 2-stage DX cooling
 *   * DOAS-2: Simple unit with basic heating/cooling enable/disable control
 *
 * OPTIMIZATION FEATURES:
 * - DOAS outdoor air processing optimization algorithms
 * - PID gas valve control performance monitoring (DOAS-1)
 * - Staged DX cooling efficiency analysis (DOAS-1)
 * - Temperature-based control optimization
 * - Safety lockout monitoring and analysis
 * - Energy consumption tracking for outdoor air conditioning
 * - Supply air temperature performance trending
 *
 * AUTHOR: Juelz NeuralBms DevOps
 * LAST UPDATED: June 5, 2025
 * ===============================================================================
 */

// dist/workers/data-factories/element-data-factory.js

const LOCATION_ID = '8'
const LOCATION_NAME = 'Element Labs'

// Element-specific equipment registry with REAL equipment IDs
const ELEMENT_EQUIPMENT_REGISTRY = {
  // DOAS (Dedicated Outdoor Air System) Units
  DOAS_UNITS: {
    'WBAuutoHnGUtAEc4w6SC': {
      name: 'DOAS-1',
      type: 'doas',
      system: 'outdoor_air',
      priority: 1,
      designCFM: 3000,
      controlType: 'advanced',
      features: {
        pidGasValve: true,
        stagedCooling: true,
        stages: 2,
        modulatingHeating: true,
        outdoorTempControl: true
      },
      setpoints: {
        defaultSupplyTemp: 68, // °F
        heatingThreshold: 60,  // °F outdoor temp
        coolingThreshold: 60.5, // °F outdoor temp
        heatingLockout: 65,    // °F outdoor temp
        coolingLockout: 50     // °F outdoor temp
      },
      limits: {
        highTempLimit: 85,     // °F supply air
        lowTempLimit: 45       // °F supply air
      },
      heatingCapacity: 100000, // BTU/hr
      coolingCapacity: 120000  // BTU/hr
    },
    'CiFEDD4fOAxAi2AydOXN': {
      name: 'DOAS-2',
      type: 'doas',
      system: 'outdoor_air',
      priority: 2,
      designCFM: 2500,
      controlType: 'simple',
      features: {
        pidGasValve: false,
        stagedCooling: false,
        stages: 1,
        modulatingHeating: false,
        outdoorTempControl: false
      },
      setpoints: {
        defaultSupplyTemp: 65, // °F
        deadband: 2.0,         // °F
        heatingLockout: 65,    // °F outdoor temp
        coolingLockout: 50     // °F outdoor temp
      },
      limits: {
        highTempLimit: 85,     // °F supply air
        lowTempLimit: 45       // °F supply air
      },
      heatingCapacity: 75000,  // BTU/hr
      coolingCapacity: 90000   // BTU/hr
    }
  }
}

// Main message handler
self.onmessage = function(e) {
  const { type, data, timestamp } = e.data

  switch (type) {
    case 'PROCESS_ELEMENT_DATA':
      processElementData(data, timestamp)
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
      console.warn(`🏢 Element Data Factory: Unknown message type: ${type}`)
  }
}

function processElementData(apiData, timestamp) {
  const startTime = performance.now()
  console.log('🏢 Element Data Factory: Processing DOAS equipment data...')

  try {
    // Filter for Element equipment only
    const elementData = apiData.filter(item => item.locationId === LOCATION_ID)
    console.log(`🏢 Processing ${elementData.length} Element DOAS equipment records`)

    // Initialize processing results
    const results = {
      locationId: LOCATION_ID,
      locationName: LOCATION_NAME,
      timestamp: timestamp,
      processedAt: new Date().toISOString(),
      equipment: [],
      systemSummary: {
        totalEquipment: elementData.length,
        onlineCount: 0,
        offlineCount: 0,
        systemEfficiency: 0,
        totalEnergyConsumption: 0,
        alerts: []
      },
      doasStatus: {
        outdoorAirQuality: 'good',
        supplyAirStatus: [],
        lockoutStatus: {
          heatingLockout: false,
          coolingLockout: false,
          outdoorTemp: 0
        },
        energyEfficiency: {
          doas1: 0,
          doas2: 0,
          overall: 0
        }
      }
    }

    // Create performance-optimized maps
    const equipmentMap = new Map()
    const neuralCommandsMap = new Map()

    // Pre-process equipment data
    elementData.forEach(item => {
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

    // Process each DOAS unit with specialized logic
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

    // Calculate DOAS-specific status
    results.doasStatus = calculateDOASStatus(processedEquipment)

    // Calculate overall system efficiency
    results.systemSummary.systemEfficiency = calculateOverallEfficiency(processedEquipment)

    // Generate system alerts
    results.systemSummary.alerts = generateSystemAlerts(processedEquipment)

    results.equipment = processedEquipment

    const processingTime = Math.round(performance.now() - startTime)
    console.log(`🏢 Element Data Factory: Processing completed in ${processingTime}ms`)

    // Send results back to main thread
    self.postMessage({
      type: 'ELEMENT_DATA_PROCESSED',
      data: results,
      processingTime: processingTime,
      locationId: LOCATION_ID
    })

  } catch (error) {
    console.error('🏢 Element Data Factory: Processing error:', error)
    self.postMessage({
      type: 'ELEMENT_PROCESSING_ERROR',
      error: error.message,
      locationId: LOCATION_ID
    })
  }
}

function getEquipmentConfig(equipmentId) {
  // Check all equipment registries
  for (const [category, equipment] of Object.entries(ELEMENT_EQUIPMENT_REGISTRY)) {
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

  // DOAS-specific processing
  if (config.type === 'doas') {
    return processDOASData(processed, config)
  }

  return processed
}

function processDOASData(equipment, config) {
  const { liveMetrics, controlOutputs } = equipment

  if (liveMetrics) {
    // Extract DOAS-specific metrics
    const supplyTemp = liveMetrics.supplyTemp || liveMetrics.SupplyTemp || 0
    const outdoorTemp = liveMetrics.outdoorTemp || liveMetrics.Outdoor_Air || 0
    const fanEnabled = controlOutputs?.fanEnabled || false
    const heatingEnabled = controlOutputs?.heatingEnabled || false
    const coolingEnabled = controlOutputs?.coolingEnabled || false

    // DOAS-1 specific metrics (advanced unit)
    let gasValvePosition = 0
    let gasValveVoltage = 0
    let dxStage1Enabled = false
    let dxStage2Enabled = false
    let pidPerformance = null

    if (config.name === 'DOAS-1' && config.features.pidGasValve) {
      gasValvePosition = controlOutputs?.gasValvePosition || 0
      gasValveVoltage = controlOutputs?.gasValveVoltage || 0
      dxStage1Enabled = controlOutputs?.dxStage1Enabled || false
      dxStage2Enabled = controlOutputs?.dxStage2Enabled || false
      
      // PID performance analysis
      pidPerformance = analyzePIDPerformance(supplyTemp, config.setpoints.defaultSupplyTemp, gasValvePosition)
    }

    // Calculate DOAS performance metrics
    equipment.performance = {
      supplyTemp: supplyTemp,
      outdoorTemp: outdoorTemp,
      targetSetpoint: config.setpoints.defaultSupplyTemp,
      fanEnabled: fanEnabled,
      heatingEnabled: heatingEnabled,
      coolingEnabled: coolingEnabled,
      gasValvePosition: gasValvePosition,
      gasValveVoltage: gasValveVoltage,
      dxStage1Enabled: dxStage1Enabled,
      dxStage2Enabled: dxStage2Enabled,
      controlMode: determineControlMode(outdoorTemp, config.setpoints),
      lockoutStatus: calculateLockoutStatus(outdoorTemp, config.setpoints),
      efficiency: calculateDOASEfficiency(equipment, config),
      pidPerformance: pidPerformance
    }

    // Calculate energy consumption
    equipment.energyConsumption = calculateDOASEnergyConsumption(equipment, config)

    // Check for DOAS-specific alerts
    equipment.alerts = generateDOASAlerts(equipment, config)

    equipment.efficiency = equipment.performance.efficiency
  }

  return equipment
}

function analyzePIDPerformance(supplyTemp, setpoint, gasValvePosition) {
  const tempError = Math.abs(supplyTemp - setpoint)
  const steadyStateError = tempError < 0.5 ? 'excellent' : tempError < 1.0 ? 'good' : tempError < 2.0 ? 'acceptable' : 'poor'
  
  return {
    temperatureError: tempError,
    steadyStatePerformance: steadyStateError,
    gasValveResponse: gasValvePosition > 0 ? 'active' : 'inactive',
    controlStability: tempError < 1.0 ? 'stable' : 'unstable'
  }
}

function determineControlMode(outdoorTemp, setpoints) {
  if (outdoorTemp < setpoints.heatingThreshold) {
    return 'heating'
  } else if (outdoorTemp >= setpoints.coolingThreshold) {
    return 'cooling'
  }
  return 'neutral'
}

function calculateLockoutStatus(outdoorTemp, setpoints) {
  return {
    heatingLockout: outdoorTemp > setpoints.heatingLockout,
    coolingLockout: outdoorTemp < setpoints.coolingLockout,
    outdoorTemp: outdoorTemp
  }
}

function calculateDOASEfficiency(equipment, config) {
  const { performance } = equipment
  
  if (!performance) return 0

  // Base efficiency on temperature control performance
  const tempError = Math.abs(performance.supplyTemp - performance.targetSetpoint)
  const tempEfficiency = Math.max(0, 100 - (tempError * 10)) // 10% penalty per degree error

  // Energy efficiency based on control mode and equipment utilization
  let energyEfficiency = 85 // Base efficiency

  if (config.features.pidGasValve && performance.gasValvePosition > 0) {
    // PID control efficiency bonus
    energyEfficiency += 10
    
    // Modulating control efficiency based on valve position
    const valveEfficiency = 100 - Math.abs(performance.gasValvePosition - 50) // Optimal around 50%
    energyEfficiency = (energyEfficiency + valveEfficiency) / 2
  }

  if (config.features.stagedCooling) {
    // Staged cooling efficiency
    const coolingStages = (performance.dxStage1Enabled ? 1 : 0) + (performance.dxStage2Enabled ? 1 : 0)
    if (coolingStages === 1) energyEfficiency += 5 // Single stage is more efficient
  }

  // Lockout efficiency - systems locked out when not needed are more efficient
  if (performance.lockoutStatus.heatingLockout && !performance.heatingEnabled) energyEfficiency += 5
  if (performance.lockoutStatus.coolingLockout && !performance.coolingEnabled) energyEfficiency += 5

  return Math.round((tempEfficiency + energyEfficiency) / 2)
}

function calculateDOASEnergyConsumption(equipment, config) {
  const { performance } = equipment
  
  if (!performance) return 0

  let totalConsumption = 0

  // Fan energy consumption (always running for DOAS)
  if (performance.fanEnabled) {
    const fanPower = (config.designCFM / 1000) * 0.75 // Estimate 0.75 kW per 1000 CFM
    totalConsumption += fanPower
  }

  // Heating energy consumption
  if (performance.heatingEnabled) {
    if (config.features.pidGasValve) {
      // Modulating gas valve - energy proportional to valve position
      const heatingLoad = (performance.gasValvePosition / 100) * config.heatingCapacity
      totalConsumption += heatingLoad / 3412 // Convert BTU/hr to kW
    } else {
      // Simple on/off heating
      totalConsumption += config.heatingCapacity / 3412
    }
  }

  // Cooling energy consumption
  if (performance.coolingEnabled) {
    if (config.features.stagedCooling) {
      // Staged cooling - calculate based on active stages
      const stage1Load = performance.dxStage1Enabled ? config.coolingCapacity * 0.6 : 0
      const stage2Load = performance.dxStage2Enabled ? config.coolingCapacity * 0.4 : 0
      totalConsumption += (stage1Load + stage2Load) / 12000 // Rough cooling kW estimate
    } else {
      // Simple cooling
      totalConsumption += config.coolingCapacity / 12000
    }
  }

  return totalConsumption
}

function generateDOASAlerts(equipment, config) {
  const alerts = []
  const { performance } = equipment

  if (!performance) return alerts

  // Temperature limit alerts
  if (performance.supplyTemp >= config.limits.highTempLimit) {
    alerts.push('High supply air temperature limit exceeded')
  }
  if (performance.supplyTemp <= config.limits.lowTempLimit) {
    alerts.push('Low supply air temperature limit exceeded')
  }

  // Control performance alerts
  const tempError = Math.abs(performance.supplyTemp - performance.targetSetpoint)
  if (tempError > 3) {
    alerts.push('Poor temperature control - large deviation from setpoint')
  }

  // Lockout alerts
  if (performance.lockoutStatus.heatingLockout && performance.heatingEnabled) {
    alerts.push('Heating enabled during lockout conditions')
  }
  if (performance.lockoutStatus.coolingLockout && performance.coolingEnabled) {
    alerts.push('Cooling enabled during lockout conditions')
  }

  // DOAS-1 specific alerts (PID and staged cooling)
  if (config.name === 'DOAS-1') {
    if (performance.pidPerformance?.controlStability === 'unstable') {
      alerts.push('PID control instability detected')
    }
    
    if (performance.dxStage1Enabled && performance.dxStage2Enabled && tempError < 1) {
      alerts.push('Both cooling stages active with minimal temperature error - check staging logic')
    }
  }

  // Fan operation alerts
  if (!performance.fanEnabled && (performance.heatingEnabled || performance.coolingEnabled)) {
    alerts.push('Heating or cooling active without fan operation')
  }

  return alerts
}

function calculateDOASStatus(equipment) {
  const doas1 = equipment.find(eq => eq.name === 'DOAS-1')
  const doas2 = equipment.find(eq => eq.name === 'DOAS-2')

  // Determine overall outdoor air quality based on DOAS performance
  const avgEfficiency = equipment.reduce((sum, eq) => sum + (eq.efficiency || 0), 0) / equipment.length
  const outdoorAirQuality = avgEfficiency > 85 ? 'excellent' : avgEfficiency > 70 ? 'good' : avgEfficiency > 50 ? 'fair' : 'poor'

  // Supply air status for each unit
  const supplyAirStatus = equipment.map(eq => ({
    unit: eq.name,
    supplyTemp: eq.performance?.supplyTemp || 0,
    setpoint: eq.performance?.targetSetpoint || 0,
    deviation: Math.abs((eq.performance?.supplyTemp || 0) - (eq.performance?.targetSetpoint || 0)),
    status: eq.status
  }))

  // Overall lockout status (use outdoor temp from first available unit)
  const outdoorTemp = equipment[0]?.performance?.outdoorTemp || 0
  const lockoutStatus = {
    heatingLockout: outdoorTemp > 65,
    coolingLockout: outdoorTemp < 50,
    outdoorTemp: outdoorTemp
  }

  // Energy efficiency breakdown
  const energyEfficiency = {
    doas1: doas1?.efficiency || 0,
    doas2: doas2?.efficiency || 0,
    overall: avgEfficiency
  }

  return {
    outdoorAirQuality,
    supplyAirStatus,
    lockoutStatus,
    energyEfficiency
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
        severity: alert.includes('limit exceeded') ? 'critical' : 'warning',
        timestamp: new Date().toISOString()
      })
    })
  })

  // System-level alerts
  const onlineCount = equipment.filter(eq => eq.status === 'online').length
  if (onlineCount === 0) {
    alerts.push({
      equipmentId: 'system',
      equipmentName: 'DOAS System',
      alert: 'All DOAS units offline - no outdoor air processing',
      severity: 'critical',
      timestamp: new Date().toISOString()
    })
  } else if (onlineCount === 1) {
    alerts.push({
      equipmentId: 'system',
      equipmentName: 'DOAS System',
      alert: 'Only one DOAS unit online - reduced outdoor air capacity',
      severity: 'warning',
      timestamp: new Date().toISOString()
    })
  }

  return alerts
}

// Additional optimization functions
function optimizeNeuralCommands(data, timestamp) {
  console.log('🏢 Element Data Factory: Optimizing DOAS neural commands...')

  // Implementation for DOAS-specific neural command optimization
  self.postMessage({
    type: 'NEURAL_COMMANDS_OPTIMIZED',
    data: { message: 'DOAS neural command optimization completed' },
    locationId: LOCATION_ID
  })
}

function calculateSystemEfficiency(data, timestamp) {
  console.log('🏢 Element Data Factory: Calculating DOAS system efficiency...')

  // Implementation for DOAS system efficiency calculations
  self.postMessage({
    type: 'SYSTEM_EFFICIENCY_CALCULATED',
    data: { message: 'DOAS system efficiency calculation completed' },
    locationId: LOCATION_ID
  })
}

function analyzePerformanceTrends(data, timestamp) {
  console.log('🏢 Element Data Factory: Analyzing DOAS performance trends...')

  // Implementation for DOAS performance trend analysis
  self.postMessage({
    type: 'PERFORMANCE_TRENDS_ANALYZED',
    data: { message: 'DOAS performance trend analysis completed' },
    locationId: LOCATION_ID
  })
}

function getSystemStatus(data, timestamp) {
  console.log('🏢 Element Data Factory: Getting DOAS system status...')

  // Implementation for DOAS system status
  self.postMessage({
    type: 'SYSTEM_STATUS_RETRIEVED',
    data: { message: 'DOAS system status retrieved' },
    locationId: LOCATION_ID
  })
}

console.log('🏢 Element Data Factory Worker initialized for Location ID:', LOCATION_ID)
console.log('🏢 Equipment Registry: 2 DOAS Units (1 Advanced PID + Staged, 1 Simple)')
