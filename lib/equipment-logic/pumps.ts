// @ts-nocheck
import type { LogicEvaluation } from "../control-logic"

/**
 * Control function for pumps (both chilled water and heated water)
 * Implements lead-lag with weekly changeover and outdoor temperature lockouts
 */
export function pumpControl(metrics: any, settings: any, currentTemp: number, stateStorage: any): LogicEvaluation {
  // Extract equipment ID and location ID
  const equipmentId = settings.equipmentId || "unknown"
  const locationId = settings.locationId || "unknown"

  // Get the temperature source configuration - make it case-insensitive
  // Check metrics first, then settings
  let temperatureSource = "outdoor"; // Default

  // Check metrics first
  if (metrics.temperatureSource !== undefined) {
    temperatureSource = String(metrics.temperatureSource).toLowerCase();
    console.log("DEBUG - Found temperatureSource in metrics:", metrics.temperatureSource)
  } else if (metrics.TemperatureSource !== undefined) {
    temperatureSource = String(metrics.TemperatureSource).toLowerCase();
    console.log("DEBUG - Found TemperatureSource in metrics:", metrics.TemperatureSource)
  }
  // Only check settings if nothing was found in metrics
  else if (settings.temperatureSource !== undefined) {
    temperatureSource = String(settings.temperatureSource).toLowerCase();
    console.log("DEBUG - Found temperatureSource in settings:", settings.temperatureSource)
  } else if (settings.TemperatureSource !== undefined) {
    temperatureSource = String(settings.TemperatureSource).toLowerCase();
    console.log("DEBUG - Found TemperatureSource in settings:", settings.TemperatureSource)
  }

  console.log(`Using temperature source: ${temperatureSource} for equipment ${equipmentId}${settings.systemName || ""}`)

  // Check if custom logic is enabled
  const customLogicEnabled = settings.customLogicEnabled !== false
  if (!customLogicEnabled) {
    console.log(`Custom logic is disabled for ${equipmentId}, skipping pump control logic`)
    // Return current settings without changes when logic is disabled
    return {
      unitEnable: settings.unitEnable || false,
      stateStorage: stateStorage,
    }
  }

  // Determine pump type (CW or HW)
  const pumpType = getPumpType(equipmentId, settings.equipmentType)

  // Get pump number from equipment ID
  const pumpNumber = getPumpNumber(equipmentId)

  // Get current amps if available
  const currentAmps = getAmpReading(metrics, pumpType, pumpNumber)

  console.log(`Processing ${pumpType} pump #${pumpNumber}, ID: ${equipmentId}, Location: ${locationId}`)
  console.log(`Current amps: ${currentAmps !== null ? currentAmps + "A" : "Not available"}`)

  // ---- LEAD/LAG CONFIGURATION ----
  // Check if this pump is part of a lead/lag system
  const pumpGroupId = settings.pumpGroupId || settings.systemGroupId || null

  // If not part of a pump group, use the legacy logic with per-location changeover
  let isLeadPump = false

  if (pumpGroupId) {
    console.log(`Pump ${equipmentId} is part of pump group ${pumpGroupId}`)

    // Initialize state storage for this pump group if not exists
    const groupStorageKey = `pumpGroup_${pumpGroupId}`
    if (!stateStorage[groupStorageKey]) {
      stateStorage[groupStorageKey] = {
        lastChangeoverTime: Date.now(),
        leadPumpId: equipmentId, // Default to this pump as lead initially
        leadPumpNumber: pumpNumber,
        runtimeHours: {},
      }
      console.log(`Initialized new pump group ${pumpGroupId} with ${equipmentId} as lead pump`)
      
      // Log the initialization event
      console.log(`GROUP EVENT: Initialized new pump group ${pumpGroupId} with ${equipmentId} as lead pump`)
    }

    // Get the changeover state for this pump group
    const groupState = stateStorage[groupStorageKey]

    // Initialize runtime tracking for this pump
    if (!groupState.runtimeHours[equipmentId]) {
      groupState.runtimeHours[equipmentId] = 0
    }

    // If pump is currently running, update runtime
    if (settings.unitEnable) {
      // Assume this function runs every minute, add runtime in hours
      groupState.runtimeHours[equipmentId] += 1 / 60
    }

    // Check if it's time for weekly changeover
    const now = Date.now()
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000
    const timeSinceLastChangeover = now - groupState.lastChangeoverTime
    const isTimeForChangeover = timeSinceLastChangeover >= oneWeekMs

    if (isTimeForChangeover) {
      // Perform changeover to the next pump in the group
      // We identify all pumps that belong to this group and rotate
      const pumpsInGroup = Object.keys(groupState.runtimeHours)

      // If this is the only pump in the group so far, keep it as lead
      if (pumpsInGroup.length <= 1) {
        groupState.leadPumpId = equipmentId
        groupState.leadPumpNumber = pumpNumber
      } else {
        // Find the current lead pump index
        const currentLeadIndex = pumpsInGroup.indexOf(groupState.leadPumpId)
        const previousLeadPumpId = groupState.leadPumpId;

        // Determine the next lead pump (rotate to the next pump)
        const nextLeadIndex = (currentLeadIndex + 1) % pumpsInGroup.length
        const nextLeadPumpId = pumpsInGroup[nextLeadIndex]

        // Extract pump number from the ID or use a default
        const nextLeadMatch = nextLeadPumpId.match(/(\d+)$/)
        const nextLeadPumpNumber = nextLeadMatch && nextLeadMatch[1]
          ? Number.parseInt(nextLeadMatch[1], 10)
          : 1

        groupState.leadPumpId = nextLeadPumpId
        groupState.leadPumpNumber = nextLeadPumpNumber
        
        // Log the changeover event 
        console.log(`GROUP EVENT: Pump group ${pumpGroupId} changed lead pump from ${previousLeadPumpId} to ${nextLeadPumpId}`)
      }

      // Reset the changeover timer
      groupState.lastChangeoverTime = now

      console.log(`Performing weekly changeover for pump group ${pumpGroupId}. New lead pump: ${groupState.leadPumpId} (#${groupState.leadPumpNumber})`)
    }

    // Determine if this pump is lead or lag
    isLeadPump = equipmentId === groupState.leadPumpId
    const role = isLeadPump ? "LEAD" : "LAG"

    // Calculate time until next changeover
    const timeUntilChangeover = oneWeekMs - timeSinceLastChangeover
    const daysUntilChangeover = Math.floor(timeUntilChangeover / (24 * 60 * 60 * 1000))
    const hoursUntilChangeover = Math.floor((timeUntilChangeover % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))

    console.log(`Pump ${equipmentId} is ${role} in group ${pumpGroupId}. Next changeover in ${daysUntilChangeover} days, ${hoursUntilChangeover} hours`)
    console.log(`Total runtime: ${groupState.runtimeHours[equipmentId].toFixed(1)} hours`)
  } else {
    // Legacy logic - use per-location changeover
    // Initialize state storage for this pump type if not exists
    const storageKey = `${locationId}_${pumpType.toLowerCase()}_changeover`
    if (!stateStorage[storageKey]) {
      stateStorage[storageKey] = {
        lastChangeoverTime: Date.now(),
        leadPumpNumber: 1, // Default to pump 1 as lead
        runtimeHours: {},
      }
    }

    // Get the changeover state
    const changeoverState = stateStorage[storageKey]

    // Update runtime tracking
    if (!changeoverState.runtimeHours[pumpNumber]) {
      changeoverState.runtimeHours[pumpNumber] = 0
    }

    // If pump is currently running, update runtime
    if (settings.unitEnable) {
      // Assume this function runs every minute, add runtime in hours
      changeoverState.runtimeHours[pumpNumber] += 1 / 60
    }

    // Check if it's time for weekly changeover
    const now = Date.now()
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000
    const timeSinceLastChangeover = now - changeoverState.lastChangeoverTime
    const isTimeForChangeover = timeSinceLastChangeover >= oneWeekMs

    if (isTimeForChangeover) {
      // Find the highest pump number for this type to determine rotation
      const pumpNumbers = Object.keys(changeoverState.runtimeHours).map(Number)
      const maxPumpNumber = Math.max(...pumpNumbers, pumpNumber)
      
      // Save the previous lead pump number
      const previousLeadPumpNumber = changeoverState.leadPumpNumber;

      // Rotate to next pump
      changeoverState.leadPumpNumber = (changeoverState.leadPumpNumber % maxPumpNumber) + 1
      changeoverState.lastChangeoverTime = now

      console.log(`Performing weekly changeover for ${pumpType} pumps. New lead pump: ${changeoverState.leadPumpNumber}`)
      
      // Log the changeover event
      console.log(`GROUP EVENT: Location ${locationId} ${pumpType} pumps changed lead pump from ${previousLeadPumpNumber} to ${changeoverState.leadPumpNumber}`)
    }

    // Determine if this pump is lead or lag
    isLeadPump = pumpNumber === changeoverState.leadPumpNumber
    const role = isLeadPump ? "LEAD" : "LAG"

    // Calculate time until next changeover
    const timeUntilChangeover = oneWeekMs - timeSinceLastChangeover
    const daysUntilChangeover = Math.floor(timeUntilChangeover / (24 * 60 * 60 * 1000))
    const hoursUntilChangeover = Math.floor((timeUntilChangeover % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))

    console.log(`Pump ${equipmentId} is ${role}. Next changeover in ${daysUntilChangeover} days, ${hoursUntilChangeover} hours`)
    console.log(`Total runtime: ${changeoverState.runtimeHours[pumpNumber].toFixed(1)} hours`)
  }

  // Get outdoor temperature
  const outdoorTemp = getOutdoorTemperature(metrics)
  console.log(`Outdoor temperature: ${outdoorTemp !== null ? outdoorTemp + "°F" : "Not available"}`)

  // Determine if pump should be running based on temperature source and pump type
  let shouldRun = false
  let reason = ""

  // Check if partner pump has failed
  const leadPumpFailed = metrics.leadPumpFailed || false
  if (!isLeadPump && leadPumpFailed) {
    console.log(`FAILOVER: Lead pump has failed, this lag pump will take over`)
    
    // Log the failover event
    if (pumpGroupId) {
      console.log(`GROUP EVENT: Pump group ${pumpGroupId} failover - lag pump ${equipmentId} taking over due to lead pump failure`)
    }
  }

  // Special handling based on temperature source
  if (temperatureSource === "supply" || temperatureSource === "space") {
    // For supply or space temperature source, pumps always run (subject to lead/lag)
    // Lead pump always runs, lag pump only runs if lead pump has issues or has failed
    shouldRun = isLeadPump || leadPumpFailed || checkLeadPumpIssue(metrics, pumpType, pumpGroupId || locationId)

    if (isLeadPump) {
      reason = `${temperatureSource} mode: Lead pump always ON`
    } else if (leadPumpFailed) {
      reason = `${temperatureSource} mode: Lag pump running due to lead pump failure`
    } else if (shouldRun) {
      reason = `${temperatureSource} mode: Lag pump running due to lead pump issue`
    } else {
      reason = `${temperatureSource} mode: Lag pump standby (lead pump OK)`
    }

    console.log(`Using ${temperatureSource} mode - pump runs continuously (subject to lead/lag controls)`)
  } else if (temperatureSource === "outdoor") {
    // Using outdoor temperature to directly control the pump
    if (outdoorTemp === null) {
      // Default to off if outdoor temperature is not available
      shouldRun = false
      reason = "Outdoor temperature not available, defaulting to OFF"
    } else {
      // Use different temperature thresholds based on pump type
      if (pumpType === "CWPump") {
        // COOLING WATER PUMPS: ON at 37.5°F, OFF at 36°F

        // Initialize outdoor control state with hysteresis if it doesn't exist
        if (!stateStorage.cwOutdoorState) {
          stateStorage.cwOutdoorState = {
            isOn: false
          }

          // Initial state based on outdoor temp
          if (outdoorTemp >= 37.5) {
            stateStorage.cwOutdoorState.isOn = true
            shouldRun = true
            reason = `Outdoor mode (CW): Initial ON state (${outdoorTemp}°F >= 37.5°F)`
          } else {
            shouldRun = false
            reason = `Outdoor mode (CW): Initial OFF state (${outdoorTemp}°F < 37.5°F)`
          }
        } else {
          // Apply hysteresis logic (to prevent rapid cycling)
          if (stateStorage.cwOutdoorState.isOn) {
            // If currently on, turn off at 36°F or lower
            if (outdoorTemp <= 36) {
              stateStorage.cwOutdoorState.isOn = false
              shouldRun = false
              reason = `Outdoor mode (CW): Turning OFF (${outdoorTemp}°F <= 36°F)`
            } else {
              shouldRun = true
              reason = `Outdoor mode (CW): Staying ON (${outdoorTemp}°F > 36°F)`
            }
          } else {
            // If currently off, turn on at 37.5°F or higher
            if (outdoorTemp >= 37.5) {
              stateStorage.cwOutdoorState.isOn = true
              shouldRun = true
              reason = `Outdoor mode (CW): Turning ON (${outdoorTemp}°F >= 37.5°F)`
            } else {
              shouldRun = false
              reason = `Outdoor mode (CW): Staying OFF (${outdoorTemp}°F < 37.5°F)`
            }
          }
        }
      } else {
        // HEATED WATER PUMPS: ON at 74°F, OFF at 75°F

        // Initialize outdoor control state with hysteresis if it doesn't exist
        if (!stateStorage.hwOutdoorState) {
          stateStorage.hwOutdoorState = {
            isOn: false
          }

          // Initial state based on outdoor temp
          if (outdoorTemp <= 74) {
            stateStorage.hwOutdoorState.isOn = true
            shouldRun = true
            reason = `Outdoor mode (HW): Initial ON state (${outdoorTemp}°F <= 74°F)`
          } else {
            shouldRun = false
            reason = `Outdoor mode (HW): Initial OFF state (${outdoorTemp}°F > 74°F)`
          }
        } else {
          // Apply hysteresis logic (to prevent rapid cycling)
          if (stateStorage.hwOutdoorState.isOn) {
            // If currently on, turn off at 75°F or higher
            if (outdoorTemp >= 75) {
              stateStorage.hwOutdoorState.isOn = false
              shouldRun = false
              reason = `Outdoor mode (HW): Turning OFF (${outdoorTemp}°F >= 75°F)`
            } else {
              shouldRun = true
              reason = `Outdoor mode (HW): Staying ON (${outdoorTemp}°F < 75°F)`
            }
          } else {
            // If currently off, turn on at 74°F or lower
            if (outdoorTemp <= 74) {
              stateStorage.hwOutdoorState.isOn = true
              shouldRun = true
              reason = `Outdoor mode (HW): Turning ON (${outdoorTemp}°F <= 74°F)`
            } else {
              shouldRun = false
              reason = `Outdoor mode (HW): Staying OFF (${outdoorTemp}°F > 74°F)`
            }
          }
        }
      }
    }

    // For lag pumps, only run if lead pump has issues or has failed
    if (!isLeadPump && !leadPumpFailed && shouldRun) {
      const leadHasIssue = checkLeadPumpIssue(metrics, pumpType, pumpGroupId || locationId)
      if (!leadHasIssue) {
        shouldRun = false
        reason = `Outdoor mode: Lag pump standby (lead pump OK)`
      } else {
        reason = `Outdoor mode: Lag pump running due to lead pump issue`
      }
    }
  } else {
    // Default mode - use standard logic based on pump type and outdoor temperature lockouts
    // Check if location is exempt from outdoor temperature lockouts
    const isExemptFromLockout = checkLocationExemptFromLockout(locationId)
    if (isExemptFromLockout) {
      console.log(`Location ${locationId} is exempt from outdoor temperature lockouts`)
    }

    if (pumpType === "CWPump") {
      // For chilled water pumps, check outdoor temperature lockout (enable at 45°F)
      const outdoorTempLockout = !isExemptFromLockout && outdoorTemp !== null && outdoorTemp < 45

      if (outdoorTempLockout) {
        shouldRun = false
        reason = `Outdoor temperature (${outdoorTemp}°F) below 45°F lockout threshold`
      } else {
        // Lead/lag logic - lead pump runs, lag pump only runs if lead has issues or has failed
        shouldRun = isLeadPump || leadPumpFailed || checkLeadPumpIssue(metrics, pumpType, pumpGroupId || locationId)
        reason = isLeadPump ? "Lead pump running" :
                leadPumpFailed ? "Lag pump running due to lead pump failure" :
                shouldRun ? "Lag pump running due to lead pump issue" : "Lag pump standby"
      }
    } else {
      // For heated water pumps, check outdoor temperature lockout (enable at 75°F)
      // FIXED: Changed from 68°F to 75°F to match the outdoor mode threshold
      const outdoorTempLockout = !isExemptFromLockout && outdoorTemp !== null && outdoorTemp > 75

      if (outdoorTempLockout) {
        shouldRun = false
        reason = `Outdoor temperature (${outdoorTemp}°F) above 75°F lockout threshold`
      } else {
        // Lead/lag logic - lead pump runs, lag pump only runs if lead has issues or has failed
        shouldRun = isLeadPump || leadPumpFailed || checkLeadPumpIssue(metrics, pumpType, pumpGroupId || locationId)
        reason = isLeadPump ? "Lead pump running" :
                leadPumpFailed ? "Lag pump running due to lead pump failure" :
                shouldRun ? "Lag pump running due to lead pump issue" : "Lag pump standby"
      }
    }
  }

  // Check for alarm conditions
  const hasAlarm = checkPumpAlarm(metrics)
  if (hasAlarm) {
    shouldRun = false
    reason = `Pump disabled due to alarm: ${hasAlarm}`
  }

  // Check for amp issues
  if (shouldRun && currentAmps !== null) {
    if (currentAmps < 1) {
      console.log(`WARNING: Pump ${equipmentId} shows low amps (${currentAmps}A) while running`)
    } else if (currentAmps > getMaxAmps(pumpType)) {
      console.log(`WARNING: Pump ${equipmentId} shows high amps (${currentAmps}A)`)
    }
  }

  console.log(`Pump control decision: ${shouldRun ? "RUNNING" : "OFF"} - ${reason}`)

  // Get changeover state
  let pumpRuntime = 0;

  // Determine which changeover state to use based on whether we're using pump groups or not
  if (pumpGroupId) {
    const groupStorageKey = `pumpGroup_${pumpGroupId}`;
    const changeoverState = stateStorage[groupStorageKey];
    if (changeoverState) {
      pumpRuntime = changeoverState.runtimeHours[equipmentId] || 0;
    }
  } else {
    const storageKey = `${locationId}_${pumpType.toLowerCase()}_changeover`;
    const changeoverState = stateStorage[storageKey];
    if (changeoverState) {
      pumpRuntime = changeoverState.runtimeHours[pumpNumber] || 0;
    }
  }

  // Return simplified structure based on what was working in the logs
  return {
    unitEnable: shouldRun,
    // Keep stateStorage for the internal logic to track state
    stateStorage: stateStorage,
    // Add a simple string field for temperature source - since this works in logs
    temperatureSource: temperatureSource,
    // Add lead/lag info since it works with our updated handler
    isLead: isLeadPump ? 1 : 0,
    pumpRuntime: pumpRuntime
  };
}

/**
 * Determine pump type from equipment ID or type
 */
function getPumpType(equipmentId: string, equipmentType?: string): string {
  // First check equipment type if available
  if (equipmentType) {
    if (equipmentType.toLowerCase().includes("cw") || equipmentType.toLowerCase().includes("chilled")) {
      return "CWPump"
    }
    if (equipmentType.toLowerCase().includes("hw") || equipmentType.toLowerCase().includes("heat")) {
      return "HWPump"
    }
  }

  // Otherwise check equipment ID
  if (equipmentId.toLowerCase().includes("cwpump") || equipmentId.toLowerCase().includes("chilled")) {
    return "CWPump"
  }
  if (equipmentId.toLowerCase().includes("hwpump") || equipmentId.toLowerCase().includes("heat")) {
    return "HWPump"
  }

  // Default to HW if we can't determine
  console.log(`Could not determine pump type from ID: ${equipmentId}, defaulting to HWPump`)
  return "HWPump"
}

/**
 * Extract pump number from equipment ID
 */
function getPumpNumber(equipmentId: string): number {
  // Try to extract number from the end of the ID
  const match = equipmentId.match(/(\d+)$/)
  if (match && match[1]) {
    return Number.parseInt(match[1], 10)
  }

  // If no match, default to 1
  return 1
}

/**
 * Get amp reading from metrics - updated to check for specific pump amp fields
 */
function getAmpReading(metrics: any, pumpType: string, pumpNumber: number): number | null {
  // First check for pump-specific fields
  const pumpSpecificFields = [
    // Format: HWP1Amps, HWP2Amps, CWP1Amps, CWP2Amps
    `${pumpType.substring(0, 2)}P${pumpNumber}Amps`,

    // Format with lowercase: hwp1amps, hwp2amps, cwp1amps, cwp2amps
    `${pumpType.substring(0, 2).toLowerCase()}p${pumpNumber}amps`,

    // Alternative formats
    `${pumpType}${pumpNumber}Amps`,
    `${pumpType.toLowerCase()}${pumpNumber}amps`
  ]

  // Add standard formats
  const standardFields = ["amps", "Amps", "current", "Current", "amperage", "Amperage", "motorAmps", "MotorAmps"]

  // Combine all possible field names
  const allPossibleFields = [...pumpSpecificFields, ...standardFields]

  // Check each field
  for (const field of allPossibleFields) {
    if (metrics[field] !== undefined && !isNaN(Number(metrics[field]))) {
      console.log(`Found amp reading in field: ${field} = ${metrics[field]}`)
      return Number(metrics[field])
    }
  }

  // If no exact match, try a more flexible approach by iterating through all metrics
  const keys = Object.keys(metrics)
  for (const key of keys) {
    // Look for fields containing both pump number and "amp"
    if (
      (key.toLowerCase().includes(String(pumpNumber)) ||
       key.toLowerCase().includes(`pump${pumpNumber}`)) &&
      key.toLowerCase().includes("amp")
    ) {
      console.log(`Found amp reading in field with flexible match: ${key} = ${metrics[key]}`)
      return Number(metrics[key])
    }
  }

  return null
}

/**
 * Get outdoor temperature from metrics
 */
function getOutdoorTemperature(metrics: any): number | null {
  // First check 'outsideTemp' which is used in your Node-RED function
  if (metrics.outsideTemp !== undefined && !isNaN(Number(metrics.outsideTemp))) {
    console.log("DEBUG - Found outdoor temp in outsideTemp:", metrics.outsideTemp)
    return Number(metrics.outsideTemp)
  }

  // Then check various other possible field names for outdoor temperature
  const possibleFields = [
    "outdoorTemp",
    "OutdoorTemp",
    "outdoorTemperature",
    "OutdoorTemperature",
    "oat",
    "OAT",
    "outsideAirTemp",
    "OutsideAirTemp",
    "outsideTemp",
    "OutsideTemp",
  ]

  for (const field of possibleFields) {
    if (metrics[field] !== undefined && !isNaN(Number(metrics[field]))) {
      console.log(`DEBUG - Found outdoor temp in ${field}:`, metrics[field])
      return Number(metrics[field])
    }
  }

  return null
}

/**
 * Check if location is exempt from outdoor temperature lockouts
 */
function checkLocationExemptFromLockout(locationId: string): boolean {
  // List of location IDs that are exempt from outdoor temperature lockouts
  const exemptLocations = [
    "2", // Example location ID that runs year-round
    "7", // Another example location
    "12", // Another example location
  ]

  return exemptLocations.includes(locationId)
}

/**
 * Check for issues with the lead pump
 * Updated to handle both pumpGroupId and locationId based configurations
 */
function checkLeadPumpIssue(metrics: any, pumpType: string, groupOrLocationId: string): boolean {
  // Look for fields that might indicate lead pump status
  const keys = Object.keys(metrics)

  for (const key of keys) {
    if (
      (key.toLowerCase().includes("lead") || key.toLowerCase().includes("pump1") || key.toLowerCase().includes("pump_1")) &&
      (key.toLowerCase().includes("alarm") || key.toLowerCase().includes("fault"))
    ) {
      const value = metrics[key]
      if (typeof value === "boolean") {
        return value
      }
      if (typeof value === "number") {
        return value > 0
      }
      if (typeof value === "string") {
        return value.toLowerCase() === "true" || value === "1" || value.toLowerCase() === "on"
      }
    }
  }

  // Check if lead pump amps are too low (indicating it's not running properly)
  for (const key of keys) {
    if (
      (key.toLowerCase().includes("lead") || key.toLowerCase().includes("pump1") || key.toLowerCase().includes("pump_1")) &&
      key.toLowerCase().includes("amp")
    ) {
      const value = Number(metrics[key])
      if (!isNaN(value) && value < 1) {
        return true
      }
    }
  }

  return false
}

/**
 * Check for pump alarms
 */
function checkPumpAlarm(metrics: any): string | null {
  // Check for various alarm conditions
  const alarmFields = ["alarm", "Alarm", "fault", "Fault", "overload", "Overload", "failure", "Failure"]

  for (const field of alarmFields) {
    if (metrics[field] !== undefined) {
      const value = metrics[field]
      if (
        (typeof value === "boolean" && value) ||
        (typeof value === "number" && value > 0) ||
        (typeof value === "string" && (value.toLowerCase() === "true" || value === "1" || value.toLowerCase() === "on"))
      ) {
        return field
      }
    }
  }

  return null
}

/**
 * Get maximum expected amps for pump type
 */
function getMaxAmps(pumpType: string): number {
  // Default max amps by pump type
  if (pumpType === "CWPump") {
    return 30 // Example value for chilled water pumps
  } else {
    return 25 // Example value for heated water pumps
  }
}
