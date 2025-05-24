/**
 * Chiller Control Logic
 *
 * Handles both single and dual chiller configurations with lead-lag for dual setups.
 * Features:
 * - Outdoor air temperature lockout (default 50°F)
 * - Weekly changeover for dual chiller setups
 * - Lead-lag operation with failover
 * - Support for chillers with and without water temperature control
 */

import type { LogicEvaluation } from "../control-logic"

// Locations with dual chiller setup (add your location IDs here)
const DUAL_CHILLER_LOCATIONS = ["3", "5", "8", "10"]

// State storage keys
const CHANGEOVER_KEY = "chiller_changeover"
const RUNTIME_KEY = "chiller_runtime"

/**
 * Main control function for chillers
 */
export function chillerControl(metrics: any, settings: any, currentTemp: number, stateStorage: any): LogicEvaluation {
  // Initialize result
  const result: LogicEvaluation = {
    unitEnable: false,
    waterTempSetpoint: settings.temperatureSetpoint || 44, // Default chilled water setpoint
    stateStorage: stateStorage || {},
  }

  try {
    // Get equipment ID and location ID
    const equipmentId = settings.equipmentId || "unknown"
    const locationId = settings.locationId || "unknown"

    console.log(`Processing chiller control for ${equipmentId} at location ${locationId}`)

    // Determine if this is a dual chiller location
    const isDualChillerLocation = DUAL_CHILLER_LOCATIONS.includes(locationId)
    console.log(`Location ${locationId} has dual chiller setup: ${isDualChillerLocation}`)

    // Get chiller number from equipment ID (for lead-lag determination)
    const chillerNumber = getChillerNumber(equipmentId)
    console.log(`Chiller number: ${chillerNumber}`)

    // Get outdoor temperature
    const outdoorTemp = getOutdoorTemperature(metrics)
    console.log(`Outdoor temperature: ${outdoorTemp !== null ? outdoorTemp + "°F" : "unknown"}`)

    // Get custom lockout temperature if available, otherwise use default
    const lockoutTemp = getCustomLockoutTemperature(metrics) || 50
    console.log(`Using lockout temperature: ${lockoutTemp}°F`)

    // Check if chiller should be locked out due to outdoor temperature
    const isLockedOut = outdoorTemp !== null && outdoorTemp < lockoutTemp
    if (isLockedOut) {
      console.log(`Chiller locked out: outdoor temp ${outdoorTemp}°F < lockout temp ${lockoutTemp}°F`)
      result.unitEnable = false
      return result
    }

    // Check if this is a water temperature controlled chiller
    const hasWaterTempControl = hasWaterTemperatureControl(metrics, settings)
    console.log(`Chiller has water temperature control: ${hasWaterTempControl}`)

    // For dual chiller locations, implement lead-lag logic
    if (isDualChillerLocation) {
      // Handle lead-lag logic for dual chiller setup
      const { isLead, timeUntilChangeover } = determineLeadLag(locationId, chillerNumber, stateStorage)
      console.log(`Chiller ${chillerNumber} is ${isLead ? "lead" : "lag"}, changeover in ${timeUntilChangeover} hours`)

      // Update runtime tracking
      updateRuntimeTracking(equipmentId, stateStorage, result.unitEnable)

      if (isLead) {
        // Lead chiller logic
        if (hasWaterTempControl) {
          // For chillers with water temp control
          result.unitEnable = determineEnableBasedOnWaterTemp(currentTemp, settings.temperatureSetpoint)
        } else {
          // For chillers without water temp control, enable based on outdoor temp
          result.unitEnable = true // Already passed the lockout check
        }
        console.log(`Lead chiller ${equipmentId} enable: ${result.unitEnable}`)
      } else {
        // Lag chiller logic - only run if lead is running but needs help or has issues
        const leadChillerHasIssues = checkForLeadChillerIssues(metrics, locationId, stateStorage)
        const needsAdditionalCooling = checkIfNeedsAdditionalCooling(currentTemp, settings.temperatureSetpoint)

        result.unitEnable = leadChillerHasIssues || needsAdditionalCooling
        console.log(
          `Lag chiller ${equipmentId} enable: ${result.unitEnable}, lead issues: ${leadChillerHasIssues}, needs additional cooling: ${needsAdditionalCooling}`,
        )
      }
    } else {
      // Single chiller location - simpler logic
      if (hasWaterTempControl) {
        // For chillers with water temp control
        result.unitEnable = determineEnableBasedOnWaterTemp(currentTemp, settings.temperatureSetpoint)
      } else {
        // For chillers without water temp control, enable based on outdoor temp
        result.unitEnable = true // Already passed the lockout check
      }
      console.log(`Single chiller ${equipmentId} enable: ${result.unitEnable}`)

      // Update runtime tracking
      updateRuntimeTracking(equipmentId, stateStorage, result.unitEnable)
    }

    // Check for alarms
    const hasAlarm = checkForAlarms(metrics)
    if (hasAlarm) {
      console.log(`Chiller ${equipmentId} has alarm, disabling`)
      result.unitEnable = false
    }

    // Return the final result
    return result
  } catch (error) {
    console.error(`Error in chiller control for ${settings.equipmentId}: ${error}`)
    return {
      unitEnable: false,
      waterTempSetpoint: settings.temperatureSetpoint || 44,
      stateStorage: stateStorage || {},
    }
  }
}

/**
 * Extract chiller number from equipment ID
 */
function getChillerNumber(equipmentId: string): number {
  try {
    // Try to extract number from the end of the ID
    const match = equipmentId.match(/(\d+)$/)
    if (match) {
      return Number.parseInt(match[1], 10)
    }

    // If no match, check if it contains a number anywhere
    const numMatch = equipmentId.match(/\d+/)
    if (numMatch) {
      return Number.parseInt(numMatch[0], 10)
    }

    // Default to 1 if no number found
    return 1
  } catch (error) {
    console.error(`Error extracting chiller number: ${error}`)
    return 1
  }
}

/**
 * Get outdoor temperature from metrics
 */
function getOutdoorTemperature(metrics: any): number | null {
  // Check various possible field names for outdoor temperature
  const possibleFields = [
    "OutdoorTemp",
    "outdoorTemp",
    "OutdoorTemperature",
    "outdoorTemperature",
    "OutsideTemp",
    "outsideTemp",
    "OutsideTemperature",
    "outsideTemperature",
    "OAT",
    "oat",
    "OA_Temp",
    "oa_temp",
  ]

  for (const field of possibleFields) {
    if (metrics[field] !== undefined && metrics[field] !== null) {
      const temp = Number(metrics[field])
      if (!isNaN(temp)) {
        return temp
      }
    }
  }

  return null
}

/**
 * Get custom lockout temperature if available
 */
function getCustomLockoutTemperature(metrics: any): number | null {
  // Check various possible field names for custom lockout temperature
  const possibleFields = [
    "LockoutTemp",
    "lockoutTemp",
    "ChillerLockoutTemp",
    "chillerLockoutTemp",
    "OutdoorLockout",
    "outdoorLockout",
    "OALockout",
    "oaLockout",
  ]

  for (const field of possibleFields) {
    if (metrics[field] !== undefined && metrics[field] !== null) {
      const temp = Number(metrics[field])
      if (!isNaN(temp)) {
        return temp
      }
    }
  }

  return null
}

/**
 * Determine if chiller has water temperature control
 */
function hasWaterTemperatureControl(metrics: any, settings: any): boolean {
  // Check if water temperature setpoint is specified
  if (settings.temperatureSetpoint) {
    return true
  }

  // Check if supply water temperature is available
  const possibleFields = [
    "SupplyTemp",
    "supplyTemp",
    "ChilledWaterTemp",
    "chilledWaterTemp",
    "ChilledWaterSupply",
    "chilledWaterSupply",
    "CHWS",
    "chws",
  ]

  for (const field of possibleFields) {
    if (metrics[field] !== undefined && metrics[field] !== null) {
      return true
    }
  }

  return false
}

/**
 * Determine lead/lag status and handle weekly changeover
 */
function determineLeadLag(
  locationId: string,
  chillerNumber: number,
  stateStorage: any,
): { isLead: boolean; timeUntilChangeover: number } {
  const now = Date.now()
  const storageKey = `${locationId}_${CHANGEOVER_KEY}`

  // Initialize changeover data if not present
  if (!stateStorage[storageKey]) {
    stateStorage[storageKey] = {
      lastChangeover: now,
      leadChiller: 1, // Start with chiller 1 as lead
    }
  }

  const changeoverData = stateStorage[storageKey]

  // Check if it's time for weekly changeover (7 days = 604800000 ms)
  const weekInMs = 7 * 24 * 60 * 60 * 1000
  const timeSinceLastChangeover = now - changeoverData.lastChangeover

  if (timeSinceLastChangeover >= weekInMs) {
    // Time to change lead/lag roles
    changeoverData.lastChangeover = now
    changeoverData.leadChiller = changeoverData.leadChiller === 1 ? 2 : 1
    console.log(`Weekly changeover: Chiller ${changeoverData.leadChiller} is now lead`)
  }

  // Calculate time until next changeover in hours
  const timeUntilChangeover = Math.max(0, (weekInMs - timeSinceLastChangeover) / (60 * 60 * 1000))

  // Determine if this chiller is lead
  const isLead = chillerNumber === changeoverData.leadChiller

  return { isLead, timeUntilChangeover }
}

/**
 * Update runtime tracking
 */
function updateRuntimeTracking(equipmentId: string, stateStorage: any, isRunning: boolean): void {
  const now = Date.now()
  const storageKey = `${equipmentId}_${RUNTIME_KEY}`

  // Initialize runtime data if not present
  if (!stateStorage[storageKey]) {
    stateStorage[storageKey] = {
      totalRuntime: 0,
      lastStatusChange: now,
      isRunning: false,
    }
  }

  const runtimeData = stateStorage[storageKey]

  // If status changed, update tracking
  if (runtimeData.isRunning !== isRunning) {
    // If was running, add to total runtime
    if (runtimeData.isRunning) {
      const runTime = (now - runtimeData.lastStatusChange) / (60 * 60 * 1000) // hours
      runtimeData.totalRuntime += runTime
    }

    // Update status
    runtimeData.lastStatusChange = now
    runtimeData.isRunning = isRunning
  }

  // Log total runtime occasionally
  if (Math.random() < 0.1) {
    // ~10% chance to log
    console.log(`Chiller ${equipmentId} total runtime: ${runtimeData.totalRuntime.toFixed(1)} hours`)
  }
}

/**
 * Check for issues with the lead chiller
 */
function checkForLeadChillerIssues(metrics: any, locationId: string, stateStorage: any): boolean {
  // Get lead chiller number
  const storageKey = `${locationId}_${CHANGEOVER_KEY}`
  if (!stateStorage[storageKey]) {
    return false
  }

  const leadChillerNumber = stateStorage[storageKey].leadChiller

  // Check for alarms in metrics that might indicate lead chiller issues
  const possibleAlarmFields = [
    `Chiller${leadChillerNumber}Alarm`,
    `chiller${leadChillerNumber}Alarm`,
    `Chiller${leadChillerNumber}Fault`,
    `chiller${leadChillerNumber}Fault`,
    `Chiller${leadChillerNumber}Offline`,
    `chiller${leadChillerNumber}Offline`,
  ]

  for (const field of possibleAlarmFields) {
    if (metrics[field] === true || metrics[field] === 1 || metrics[field] === "true") {
      console.log(`Lead chiller ${leadChillerNumber} has issue: ${field}`)
      return true
    }
  }

  return false
}

/**
 * Check if additional cooling is needed
 */
function checkIfNeedsAdditionalCooling(currentTemp: number, setpoint: number): boolean {
  // If current temperature is significantly above setpoint, need additional cooling
  const threshold = 3 // 3°F above setpoint
  return currentTemp > setpoint + threshold
}

/**
 * Determine if chiller should be enabled based on water temperature
 */
function determineEnableBasedOnWaterTemp(currentTemp: number, setpoint: number): boolean {
  // Add a small deadband to prevent short cycling
  const deadband = 1.5 // 1.5°F deadband

  // If temperature is above setpoint + deadband, enable cooling
  // If temperature is below setpoint - deadband, disable cooling
  // Otherwise, maintain current state (not implemented here, will default to off)
  return currentTemp > setpoint + deadband
}

/**
 * Check for alarms that would prevent chiller operation
 */
function checkForAlarms(metrics: any): boolean {
  // Check various possible alarm fields
  const possibleAlarmFields = [
    "ChillerAlarm",
    "chillerAlarm",
    "Alarm",
    "alarm",
    "ChillerFault",
    "chillerFault",
    "Fault",
    "fault",
    "ChillerOffline",
    "chillerOffline",
    "Offline",
    "offline",
  ]

  for (const field of possibleAlarmFields) {
    if (metrics[field] === true || metrics[field] === 1 || metrics[field] === "true") {
      console.log(`Chiller has alarm: ${field}`)
      return true
    }
  }

  return false
}
