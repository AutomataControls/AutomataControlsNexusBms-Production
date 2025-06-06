// @ts-nocheck
// lib/equipment-logic/locations/huntington/chiller.ts
import { chillerControl as chillerControlBase } from "../../base/chiller";
import { logLocationEquipment } from "@/lib/logging/location-logger";

/**
 * Chiller Control Logic specifically for Huntington
 * - Enable at 40°F outdoor temperature
 * - Disable at 38°F outdoor temperature
 * - Single chiller implementation (no lead-lag needed)
 */
export function chillerControl(metrics: any, settings: any, currentTemp: number, stateStorage: any): any {
  // Extract equipment ID and location ID for logging
  const equipmentId = settings.equipmentId || "unknown";
  const locationId = settings.locationId || "4"; // Default to Huntington
  
  logLocationEquipment(locationId, equipmentId, "chiller", "Starting Huntington-specific chiller control logic");

  // Get outdoor temperature with fallbacks
  const outdoorTemp = getOutdoorTemperature(metrics);
  logLocationEquipment(locationId, equipmentId, "chiller", 
    `Outdoor temperature: ${outdoorTemp !== null ? outdoorTemp + "°F" : "Not available"}`);

  // Initialize Huntington-specific state if it doesn't exist
  if (!stateStorage.huntingtonChillerState) {
    stateStorage.huntingtonChillerState = {
      isEnabled: false
    };

    // Initialize state based on current outdoor temperature
    if (outdoorTemp !== null) {
      if (outdoorTemp >= 40) {
        stateStorage.huntingtonChillerState.isEnabled = true;
        logLocationEquipment(locationId, equipmentId, "chiller", 
          `Initial state ENABLED (${outdoorTemp}°F >= 40°F)`);
      } else {
        logLocationEquipment(locationId, equipmentId, "chiller", 
          `Initial state DISABLED (${outdoorTemp}°F < 40°F)`);
      }
    }
  }

  // Apply Huntington-specific temperature thresholds with hysteresis
  if (outdoorTemp !== null) {
    if (stateStorage.huntingtonChillerState.isEnabled) {
      // If currently enabled, disable at 38°F or lower
      if (outdoorTemp <= 38) {
        stateStorage.huntingtonChillerState.isEnabled = false;
        logLocationEquipment(locationId, equipmentId, "chiller", 
          `DISABLING (${outdoorTemp}°F <= 38°F)`);
      } else {
        logLocationEquipment(locationId, equipmentId, "chiller", 
          `Remaining ENABLED (${outdoorTemp}°F > 38°F)`);
      }
    } else {
      // If currently disabled, enable at 40°F or higher
      if (outdoorTemp >= 40) {
        stateStorage.huntingtonChillerState.isEnabled = true;
        logLocationEquipment(locationId, equipmentId, "chiller", 
          `ENABLING (${outdoorTemp}°F >= 40°F)`);
      } else {
        logLocationEquipment(locationId, equipmentId, "chiller", 
          `Remaining DISABLED (${outdoorTemp}°F < 40°F)`);
      }
    }
  }

  // If outdoor temperature is too low, disable the chiller regardless of other factors
  if (!stateStorage.huntingtonChillerState.isEnabled) {
    logLocationEquipment(locationId, equipmentId, "chiller", "Disabled due to outdoor temperature");
    
    return {
      unitEnable: false,
      waterTempSetpoint: settings.temperatureSetpoint || 44, // Keep the setpoint even when disabled
      stateStorage: stateStorage
    };
  }

  // If we're above the temperature threshold, use the base control logic
  logLocationEquipment(locationId, equipmentId, "chiller", 
    "Temperature threshold met, calling base implementation");
  
  const result = chillerControlBase(metrics, settings, currentTemp, stateStorage);
  
  // Log the final result
  logLocationEquipment(locationId, equipmentId, "chiller", 
    `Control result: unitEnable=${result.unitEnable}, ` +
    `waterTempSetpoint=${result.waterTempSetpoint}°F`, 
    result);
  
  return result;
}

/**
 * Get outdoor temperature from metrics
 * Similar to the base implementation but with added Huntington-specific fields
 */
function getOutdoorTemperature(metrics: any): number | null {
  // Check various possible field names for outdoor temperature
  const possibleFields = [
    "outdoorTemp",
    "OutdoorTemp",
    "outdoorTemperature",
    "OutdoorTemperature",
    "outsideTemp",
    "OutsideTemp",
    "outsideTemperature", 
    "OutsideTemperature",
    "OAT",
    "oat",
    "OA_Temp",
    "oa_temp",
    "Outdoor_Air", // Huntington-specific field
    "Outdoor",
    "outdoor"
  ];

  for (const field of possibleFields) {
    if (metrics[field] !== undefined && metrics[field] !== null) {
      const temp = Number(metrics[field]);
      if (!isNaN(temp)) {
        return temp;
      }
    }
  }

  return null;
}
