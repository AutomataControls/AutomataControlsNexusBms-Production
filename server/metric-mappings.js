/**
 * Metric mappings for the monitoring service
 * Updated on 2025-04-10
 *
 * This file contains improved mappings for metrics across different locations and equipment
 * to enhance the reliability of metric lookups in the monitoring service.
 */

// Specific location-based mappings
const specificLocationMappings = {
  // FirstChurchOfGod specific mappings
  FirstChurchOfGod: {
    "Water Supply Temperature": ["H2O Supply Temperature"],
    "Water Return Temperature": ["H2O Return Temperature"],
    "Boiler Temperature": ["Heating Loop Supply Temperature"],
    "Boiler Return Temperature": ["Heating Loop Return Temperature"],
    // Add these specific mappings for the chiller temperatures
    "Chiller Supply Temperature": ["H2O Supply Temperature"],
    "Chiller Return Temperature": ["H2O Return Temperature"],
    // The key issue - we need to map the exact metric name being searched for
    "Water Supply temperature": ["H2O Supply Temperature"],
  },

  // NERealtyGroup specific mappings
  NERealtyGroup: {
    "Water Supply Temperature": ["H20SupplyTemp", "H2O Supply Temperature"],
    "Water Return Temperature": ["H20ReturnTemp", "H2O Return Temperature"],
    "Ambient Temperature": ["AmbientTemp"],
    "Outdoor Air Temperature": ["OutdoorAirTemp"],
    "Target Temperature": ["TargetTemp"],
    "Freeze Status": ["FreezeStat"],
    "Alarm Status": ["AlarmStatus"],
    "HVAC State": ["HvacState"],
    "Active Switch State": ["ActiveSwitchState"],
  },
}

// Specific metric mappings for temperature metrics
const temperatureMetricMappings = {
  // Supply air temperature mappings
  "Supply Air Temperature": [
    "SupplyTemp",
    "Supply Temperature",
    "supply",
    "supplyTemp",
    "DischargeAir",
    "Discharge Air",
    "DischargeAIr",
    "Supply",
    "SupplyAIr",
    "Supply Air Temperature",
  ],

  // Return air temperature mappings
  "Return Air Temperature": [
    "ReturnTemp",
    "Return Temperature",
    "return",
    "ReturnAir",
    "ReturnAIr",
    "Return Air Temperature",
  ],

  // Mixed air temperature mappings
  "Mixed Air Temperature": ["MixedAirTemp", "Mixed Air Temperature", "mixedAir", "MixedAir", "Mixed Air"],

  // Outdoor air temperature mappings
  "Outdoor Air Temperature": [
    "OutdoorTemp",
    "Outdoor Temperature",
    "outdoorTemp",
    "OutdoorAirTemp",
    "outsideTemp",
    "Outdoor Air Temperature",
    "IntakeAir",
    "Outside Temperature",
  ],

  // Space/Zone temperature mappings
  "Zone Temperature": [
    "SpaceTemp",
    "Space Temperature",
    "spaceTemp",
    "ZoneTemp",
    "Zone Temperature",
    "indoorTemp",
    "ambient_temperature",
    "temp1",
    "temp2",
    "zones/zone1/temp",
    "zones/zone2/temp",
    "spaceTemp1",
    "spaceTemp2",
    "SouthOffice",
    "NorthUpstairs",
    "SouthDropRoomTemp",
    "NorthDropRoomTemp",
    "Average Temperature",
    "Zone 1 Temperature",
    "Zone 2 Temperature",
    "Temperature 1",
    "Temperature 2",
    "Thermostat Ambient Temperature",
    "Lab Temperature",
    "AmbientTemp",
  ],

  // Water temperature mappings
  "Water Supply Temperature": [
    "H20Supply",
    "Water Supply Temperature",
    "H20SupplyTemp",
    "HeatingLoopSupplyTemp",
    "CoolingLoopSupplyTemp",
    "Supply", // For boiler-only systems
    "BoilerLoopTemp",
    "H2O Supply",
    "H2O Supply Alt",
    "Boiler Loop Temperature",
  ],

  "Water Return Temperature": [
    "H20Return",
    "Water Return Temperature",
    "H20ReturnTemp",
    "HeatingLoopReturnTemp",
    "CoolingLoopReturnTemp",
    "Return", // For boiler-only systems
    "H2O Return",
  ],

  // Boiler temperature mappings
  "Boiler Temperature": [
    "BoilerTemp",
    "Boiler Temperature",
    "boilerTemp",
    "Boiler Loop Temperature",
    "Supply Temperature", // For boiler systems
    "H2O Supply",
    "H20Supply",
    "Supply", // For boiler-only systems
    "HeatingLoopSupplyTemp", // Added for FirstChurchOfGod
  ],

  // Steam temperature mappings
  "Steam Temperature": [
    "SteamTemp",
    "Steam Temperature",
    "steamTemp",
    "Supply Temperature", // For steam systems
    "Supply",
  ],
}

// Specific metric mappings for humidity metrics
const humidityMetricMappings = {
  Humidity: [
    "humidity",
    "Humidity",
    "spaceHumidity",
    "spaceRH",
    "spaceRH1",
    "spaceRH2",
    "LabRH",
    "OutdoorHumidity",
    "zones/zone1/humidity",
    "zones/zone2/humidity",
    "humidity1",
    "humidity2",
    "averagehumidity",
  ],

  // Added specific Zone humidity mappings
  "Zone Humidity": [
    "Zone Humidity",
    "Zone 1 Humidity",
    "Zone 2 Humidity",
    "Average Humidity",
    "Humidity 1",
    "Humidity 2",
    "Space Humidity",
    "Space RH",
    "Space RH 1",
    "Space RH 2",
    "Space RH 3",
    "Space RH 4",
    "Space RH 5",
    "Lab RH",
  ],
}

// Specific metric mappings for actuator positions
const actuatorMetricMappings = {
  "Cooling Actuator": ["ClgAct", "Cooling Actuator", "cwActuator", "CoolingActuator", "cwActuator", "CW Actuator"],

  "Heating Actuator": [
    "HtgAct",
    "Heating Actuator",
    "hwActuator",
    "HeatingActuator",
    "htg_Actuator",
    "preheatValve",
    "reheatValve",
    "HW Actuator",
    "Preheat Valve",
    "Reheat Valve",
  ],

  "Outdoor Air Actuator": [
    "OAAct",
    "Outdoor Air Actuator",
    "oaActuator",
    "OutdoorAct",
    "OA_Actuator",
    "oa_Actuator",
    "OA Actuator",
    "Outdoor Actuator",
    "Outdoor Air Actuator",
  ],

  "Return Air Actuator": ["ReturnAct", "Return Air Actuator", "ra_Actuator", "RA_Actuator", "Return Actuator"],

  "Valve Position": [
    "Valve1Percent",
    "Valve2Percent",
    "Valve Position",
    "ValvePosition",
    "1/3Act",
    "2/3Act",
    "OneThird Actuator",
    "TwoThirds Actuator",
  ],
}

// Specific metric mappings for status metrics
const statusMetricMappings = {
  "Fan Status": [
    "FanStatus",
    "Fan Status",
    "FanRunning",
    "FanEnabled",
    "VFDStatus",
    "VFDEnable",
    "VFDspeed",
    "VFDSpeed",
    "vfd",
    "Fan Running",
    "Fan Enabled",
    "VFD Speed",
  ],

  "Pump Status": [
    "PumpStatus",
    "Pump Status",
    "PumpRunning",
    "hwp1_status",
    "hwp2_status",
    "cwp1_status",
    "cwp2_status",
    "HWPump1Status",
    "HWPump2Status",
    "Pump1Status",
    "Pump2Status",
    "activePump",
    "Pump Running",
    "HW Pump 1 Status",
    "HW Pump 2 Status",
    "Aux Pump Status",
    "VAV Pump Status",
    "Pump 1 Status",
    "Pump 2 Status",
    "Pump 3 Status",
    "Pump 4 Status",
  ],

  "Freeze Status": [
    "FreezeStat",
    "Freeze Status",
    "Freezestat",
    "freezeStatus",
    "freezeTrip",
    "FreezeTrip",
    "Freeze Stat",
    "Freeze Trip",
  ],

  "Compressor Status": [
    "CompStatus",
    "Compressor Status",
    "stage1Enabled",
    "stage2Enabled",
    "Stage1Enabled",
    "Stage2Enabled",
    "Stage 1 Enabled",
    "Stage 2 Enabled",
  ],

  "Boiler Status": [
    "Boiler1Status",
    "Boiler2Status",
    "b1boiler_status",
    "b2boiler_status",
    "boiler1Enable",
    "boiler2Enable",
    "boiler3Enable",
    "boiler4Enable",
    "Boiler 1 Enabled",
    "Boiler 2 Enabled",
    "Boiler 2 Status",
    "Boiler Enable",
  ],

  "Chiller Status": ["chiller1Enable", "chiller2Enable", "Chiller 1 Status", "Chiller 2 Status", "Chiller Status"],

  "Alarm Status": ["AlarmStatus", "Alarm Status", "alarmStatus"],

  "HVAC State": ["HvacState", "HVAC State", "HVACState", "hvacState"],

  "Active Switch State": ["ActiveSwitchState", "Active Switch State", "activeSwitchState"],
}

// Specific metric mappings for setpoint metrics
const setpointMetricMappings = {
  Setpoint: [
    "Setpoint",
    "setpoint",
    "TargetTemp",
    "target_temperature",
    "GlobalSetpoint",
    "TempDifferential",
    "SetpointDifferential",
    "CoolingDifferential",
    "HeatingDifferential",
    "Global Setpoint",
    "Target Temperature",
    "Thermostat Target Temperature",
  ],
}

// Combine all specific mappings
const specificMetricMappings = {
  ...temperatureMetricMappings,
  ...humidityMetricMappings,
  ...actuatorMetricMappings,
  ...statusMetricMappings,
  ...setpointMetricMappings,
}

// Generic type mappings (used as fallback)
const metricTypeMapping = {
  temperature: ["temp", "temperature", "Temperature"],
  humidity: ["humidity", "Humidity", "RH"],
  actuator: ["actuator", "Actuator", "valve", "Valve", "Act"],
  status: ["status", "Status", "state", "State", "Running", "Enabled", "enabled"],
  setpoint: ["setpoint", "Setpoint", "target", "Target"],
}

// System name mappings to handle mismatched system names
const systemNameMappings = {
  // HeritageHuntington systems - all in MechanicalRoom1 except rehab boilers
  "ComfortBoiler-1": ["MechanicalRoom1"],
  "ComfortBoiler-2": ["MechanicalRoom1"],
  "DomesticBoiler-1": ["MechanicalRoom1"],
  DomesticBoiler2: ["MechanicalRoom1"],
  "Pump-1": ["MechanicalRoom1"],
  "Pump-2": ["MechanicalRoom1"],
  "Pump-3": ["MechanicalRoom1"],
  "Pump-4": ["MechanicalRoom1"],
  Chiller: ["MechanicalRoom1"],
  RehabBoilers: ["MechanicalRoom2"],
  "FCU-1": ["FanCoil1"],
  "FCU-2": ["FanCoil1"],
  "FCU-3": ["FanCoil1"],
  "FCU-6": ["FanCoil1"],
  "FCU-7": ["FanCoil1"],

  // HopbridgeAutismCenter systems
  "Boiler-1": ["Boilers"],
  "Boiler-2": ["Boilers"],

  // FirstChurchOfGod systems - all in MechanicalRoom
  Boilers: ["MechanicalRoom"],
  "Chiller-1": ["MechanicalRoom"],
  "Chiller-2": ["MechanicalRoom"],
  "Pump-1": ["MechanicalRoom"],
  "Pump-2": ["MechanicalRoom"],

  // Residential systems - all in RRCottage
  Boiler: ["RRCottage"],
  "AHU-1": ["RRCottage"],

  // AkronCarnegiePublicLibrary systems
  "Boiler-1": ["Boilers"],
  "Boiler-2": ["Boilers"],

  // NERealtyGroup systems
  "Geo-1": ["GeoLoop"],
}

/**
 * Get a metric value using the mappings
 * @param {string} locationId - The location ID
 * @param {string} systemId - The system/equipment ID
 * @param {string} metricName - The metric name to look for
 * @param {Object} rtdbData - The RTDB data
 * @returns {number|null} - The metric value or null if not found
 */
function getMetricValue(locationId, systemId, metricName, rtdbData) {
  if (!rtdbData) {
    console.log("No RTDB data available")
    return null
  }

  try {
    // First, find the location key that matches the locationId
    let locationKey = null

    // Try direct match first
    if (rtdbData[locationId]) {
      locationKey = locationId
    } else {
      // If not found directly, search through all locations
      console.log(`Location ${locationId} not found directly, searching through all locations`)

      // Try to find a location with a matching ID property
      for (const [key, value] of Object.entries(rtdbData)) {
        if (value.id === locationId) {
          locationKey = key
          console.log(`Found location with matching ID: ${key}`)
          break
        }
      }

      if (!locationKey) {
        console.log(`No location found for ID: ${locationId}`)
        return null
      }
    }

    // Check if location has systems
    if (!rtdbData[locationKey].systems) {
      console.log(`No systems found for location ${locationKey}`)
      return null
    }

    // Check if system exists
    if (!rtdbData[locationKey].systems[systemId]) {
      console.log(`System ${systemId} not found in location ${locationKey}`)

      // Try to find a system with a similar name
      const systemKeys = Object.keys(rtdbData[locationKey].systems)
      console.log(`Available systems in ${locationKey}: ${systemKeys.join(", ")}`)

      // Check if we have a mapping for this system
      let alternativeSystems = []
      if (systemNameMappings[systemId]) {
        alternativeSystems = systemNameMappings[systemId]
        console.log(`Found system name mapping for ${systemId}: ${alternativeSystems.join(", ")}`)
      }

      // Try mapped systems first
      let systemMatch = null
      for (const altSystem of alternativeSystems) {
        if (systemKeys.includes(altSystem)) {
          systemMatch = altSystem
          console.log(`Found mapped system: ${systemMatch}`)
          break
        }
      }

      // If no mapped system found, try case-insensitive match with more flexible matching
      if (!systemMatch) {
        systemMatch = systemKeys.find((key) => {
          // Try exact match first (case insensitive)
          if (key.toLowerCase() === systemId.toLowerCase()) {
            return true
          }

          // Try partial matches
          if (
            key.toLowerCase().includes(systemId.toLowerCase()) ||
            systemId.toLowerCase().includes(key.toLowerCase())
          ) {
            return true
          }

          // Try matching by type (if systemId contains a type like "Boiler", "AHU", etc.)
          const commonTypes = ["boiler", "ahu", "chiller", "pump", "fan", "vav", "rtu", "fcu", "doas", "mua"]
          for (const type of commonTypes) {
            if (systemId.toLowerCase().includes(type) && key.toLowerCase().includes(type)) {
              return true
            }
          }

          return false
        })
      }

      if (systemMatch) {
        console.log(`Using system: ${systemMatch}`)
        systemId = systemMatch
      } else {
        return null
      }
    }

    // Check if system has metrics
    if (!rtdbData[locationKey].systems[systemId].metrics) {
      console.log(`No metrics found for system ${systemId} in location ${locationKey}`)
      return null
    }

    // Get the metrics object
    const metrics = rtdbData[locationKey].systems[systemId].metrics
    console.log(`Available metrics for ${locationKey}/${systemId}:`, Object.keys(metrics))

    // NEW STEP: Check for location-specific mappings first (highest priority)
    if (specificLocationMappings[locationKey]) {
      // Check if we have a specific mapping for this metric in this location
      const locationSpecificMappings = specificLocationMappings[locationKey][metricName]
      if (locationSpecificMappings) {
        // Try each location-specific mapping
        for (const mappedName of locationSpecificMappings) {
          if (metrics[mappedName] !== undefined) {
            const value = metrics[mappedName]
            console.log(`Found location-specific mapping for ${locationKey}/${metricName} -> ${mappedName}: ${value}`)
            return typeof value === "number" ? value : Number.parseFloat(value)
          }
        }
      }
    }

    // STEP 1: Try exact match first (highest priority)
    if (metrics[metricName] !== undefined) {
      const value = metrics[metricName]
      console.log(`Found exact match for metric ${metricName}: ${value}`)
      return typeof value === "number" ? value : Number.parseFloat(value)
    }

    // STEP 2: Try case-insensitive match
    const metricNameLower = metricName.toLowerCase()
    for (const key of Object.keys(metrics)) {
      if (key.toLowerCase() === metricNameLower) {
        const value = metrics[key]
        console.log(`Found case-insensitive match for metric ${metricName} -> ${key}: ${value}`)
        return typeof value === "number" ? value : Number.parseFloat(value)
      }
    }

    // STEP 3: Try specific mappings (high priority)
    // First, check if we have a specific mapping for this metric
    for (const [mappedMetricName, possibleNames] of Object.entries(specificMetricMappings)) {
      // Check if the requested metric name matches any of the mapped metric names
      if (
        mappedMetricName.toLowerCase() === metricNameLower ||
        possibleNames.some((name) => name.toLowerCase() === metricNameLower)
      ) {
        // If it matches, try all possible names for this metric
        for (const possibleName of possibleNames) {
          if (metrics[possibleName] !== undefined) {
            const value = metrics[possibleName]
            console.log(`Found specific mapping match: ${metricName} -> ${possibleName}: ${value}`)
            return typeof value === "number" ? value : Number.parseFloat(value)
          }
        }
      }
    }

    // STEP 4: Try partial match (if metric name contains the search term or vice versa)
    for (const key of Object.keys(metrics)) {
      if (key.toLowerCase().includes(metricNameLower) || metricNameLower.includes(key.toLowerCase())) {
        // Skip if the match is too generic (e.g., "temp" matching "setpoint")
        if (key.toLowerCase() === "temp" && metricNameLower !== "temp") continue
        if (key.toLowerCase() === "temperature" && metricNameLower !== "temperature") continue

        const value = metrics[key]
        console.log(`Found partial match for metric ${metricName} -> ${key}: ${value}`)
        return typeof value === "number" ? value : Number.parseFloat(value)
      }
    }

    // STEP 5: Try to find by type (lowest priority)
    // Determine the likely type of the metric
    const metricType = getMetricType(metricName)
    if (metricType && metricTypeMapping[metricType]) {
      // Try each metric of this type
      for (const typedMetricName of metricTypeMapping[metricType]) {
        for (const key of Object.keys(metrics)) {
          if (key.toLowerCase().includes(typedMetricName.toLowerCase())) {
            // Skip if the match is too generic
            if (typedMetricName.toLowerCase() === "temp" && key.toLowerCase() !== "temp") continue
            if (typedMetricName.toLowerCase() === "temperature" && key.toLowerCase() !== "temperature") continue

            const value = metrics[key]
            console.log(`Found metric by type (${metricType}): ${metricName} -> ${key}: ${value}`)
            return typeof value === "number" ? value : Number.parseFloat(value)
          }
        }
      }
    }

    // STEP 6: Special case for St. John Catholic School - try H20Supply/H20Return
    if (locationId === "StJohnCatholicSchool" && metricName.toLowerCase().includes("temperature")) {
      if (metricName.toLowerCase().includes("supply") && metrics["H20Supply"] !== undefined) {
        const value = metrics["H20Supply"]
        console.log(`Found St. John special case for supply: ${value}`)
        return typeof value === "number" ? value : Number.parseFloat(value)
      }
      if (metricName.toLowerCase().includes("return") && metrics["H20Return"] !== undefined) {
        const value = metrics["H20Return"]
        console.log(`Found St. John special case for return: ${value}`)
        return typeof value === "number" ? value : Number.parseFloat(value)
      }
    }

    console.log(`Metric ${metricName} not found in system ${systemId} in location ${locationKey}`)
    return null
  } catch (error) {
    console.error(`Error getting metric value for ${locationId}/${systemId}/${metricName}:`, error)
    return null
  }
}

/**
 * Determine the likely type of a metric based on its name
 * @param {string} metricName - The metric name
 * @returns {string|null} - The likely metric type or null if unknown
 */
function getMetricType(metricName) {
  const nameLower = metricName.toLowerCase()

  // Check for temperature metrics
  if (
    nameLower.includes("temp") ||
    nameLower.includes("discharge") ||
    (nameLower.includes("air") && !nameLower.includes("actuator")) ||
    (nameLower.includes("supply") && !nameLower.includes("actuator")) ||
    (nameLower.includes("return") && !nameLower.includes("actuator")) ||
    nameLower.includes("h20") ||
    nameLower.includes("loop") ||
    nameLower.includes("boiler") ||
    nameLower.includes("steam")
  ) {
    return "temperature"
  }
  // Check for humidity metrics
  else if (nameLower.includes("humid") || nameLower.includes("rh")) {
    return "humidity"
  }
  // Check for actuator metrics
  else if (
    nameLower.includes("actuator") ||
    nameLower.includes("valve") ||
    (nameLower.includes("act") && !nameLower.includes("active"))
  ) {
    return "actuator"
  }
  // Check for status metrics
  else if (
    nameLower.includes("status") ||
    nameLower.includes("state") ||
    nameLower.includes("enabled") ||
    nameLower.includes("running")
  ) {
    return "status"
  }
  // Check for setpoint metrics
  else if (nameLower.includes("setpoint") || nameLower.includes("target")) {
    return "setpoint"
  }

  return null
}

module.exports = {
  specificLocationMappings,
  specificMetricMappings,
  metricTypeMapping,
  systemNameMappings,
  getMetricValue,
  getMetricType,
}
