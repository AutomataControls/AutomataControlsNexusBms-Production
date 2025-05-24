// lib/equipment-logic/locations/hopebridge/boiler.ts
import { boilerControl as boilerControlBase } from "../../base/boiler";
import { logLocationEquipment } from "@/lib/logging/location-logger";

/**
 * Boiler Control Logic specifically for Hopebridge
 * - Part of equipmentGroup for lead/lag control
 * - Boiler 1 currently disconnected for repairs
 * - OAR: Min OAT 32°F → SP 155°F, Max OAT 72°F → SP 80°F
 * - Control source: Supply temperature
 * - No occupancy schedules (run continuously)
 */
export function boilerControl(metrics: any, settings: any, currentTemp: number, stateStorage: any) {
  // Extract equipment ID and location ID for logging
  const equipmentId = settings.equipmentId || "unknown";
  const locationId = settings.locationId || "6"; // Default to Hopebridge (ID: 6)
  
  logLocationEquipment(locationId, equipmentId, "boiler", "Starting Hopebridge-specific boiler control logic");

  // STEP 1: Handle boiler 1 being disconnected for repairs
  const boilerNumber = getBoilerNumber(equipmentId);
  
  if (boilerNumber === 1) {
    logLocationEquipment(locationId, equipmentId, "boiler", 
      "WARNING: Boiler 1 is currently disconnected for repairs, system should be using Boiler 2");
  }
  
  // STEP 2: Always use supply temperature for control
  if (currentTemp === undefined) {
    // Try to get supply temperature from various possible field names
    currentTemp = metrics.H20Supply || 
                 metrics.H2OSupply || 
                 metrics["H2O Supply"] || 
                 metrics.H2O_Supply || 
                 metrics.Supply ||
                 metrics.supplyTemperature ||
                 metrics.SupplyTemp || 
                 metrics.supplyTemp || 
                 metrics.SupplyTemperature ||
                 metrics.waterSupplyTemp ||
                 metrics.WaterSupplyTemp ||
                 metrics.boilerSupplyTemp ||
                 140; // Default if not found
    
    logLocationEquipment(locationId, equipmentId, "boiler", `Using supply temperature: ${currentTemp}°F`);
  }
  
  // STEP 3: Get outdoor temperature with fallbacks
  const outdoorTemp = metrics.Outdoor_Air || 
                     metrics.outdoorTemperature ||
                     metrics.outdoorTemp ||
                     metrics.Outdoor ||
                     metrics.outdoor ||
                     metrics.OutdoorTemp ||
                     metrics.OAT || 
                     metrics.oat || 
                     50;
  
  logLocationEquipment(locationId, equipmentId, "boiler", `Outdoor temperature: ${outdoorTemp}°F`);
  
  // STEP 4: Create modified settings with Hopebridge-specific values
  const hopebridgeSettings = { ...settings };
  
  // Set Hopebridge-specific OAR settings
  if (!hopebridgeSettings.outdoorAirReset) {
    hopebridgeSettings.outdoorAirReset = {};
  }
  
  // Hopebridge OAR parameters:
  // - Min OAT 32°F → SP 155°F
  // - Max OAT 72°F → SP 80°F
  hopebridgeSettings.outdoorAirReset = {
    ...hopebridgeSettings.outdoorAirReset,
    enabled: true,
    minTemp: 32,           // Min outdoor temperature: 32°F
    maxTemp: 72,           // Max outdoor temperature: 72°F 
    minSetpoint: 80,       // Min supply temperature: 80°F (at maxTemp)
    maxSetpoint: 155       // Max supply temperature: 155°F (at minTemp)
  };
  
  // STEP 5: Calculate setpoint based on OAR curve
  let setpoint = 155; // Default to max setpoint
  
  if (outdoorTemp <= 32) {
    setpoint = 155;
    logLocationEquipment(locationId, equipmentId, "boiler", 
      `OAR: OAT ${outdoorTemp}°F <= 32°F, using max setpoint: ${setpoint}°F`);
  } else if (outdoorTemp >= 72) {
    setpoint = 80;
    logLocationEquipment(locationId, equipmentId, "boiler", 
      `OAR: OAT ${outdoorTemp}°F >= 72°F, using min setpoint: ${setpoint}°F`);
  } else {
    // Linear interpolation for values between min and max
    const ratio = (outdoorTemp - 32) / (72 - 32);
    setpoint = 155 - ratio * (155 - 80);
    logLocationEquipment(locationId, equipmentId, "boiler", 
      `OAR: Calculated setpoint: ${setpoint.toFixed(1)}°F (ratio: ${ratio.toFixed(2)})`);
  }
  
  // STEP 6: Update settings with our calculated setpoint
  hopebridgeSettings.temperatureSetpoint = setpoint;
  hopebridgeSettings.waterTempSetpoint = setpoint;
  
  // STEP 7: Check if this boiler is lead or lag
  let isLeadBoiler = false;
  const groupId = settings.boilerGroupId || settings.groupId || settings.systemGroupId || null;
  
  // Adjust if boiler 1 is in the group (it should be disabled since it's disconnected)
  if (groupId) {
    logLocationEquipment(locationId, equipmentId, "boiler", `Boiler is part of group ${groupId}`);
    
    if (settings.isLeadBoiler !== undefined) {
      isLeadBoiler = settings.isLeadBoiler;
      logLocationEquipment(locationId, equipmentId, "boiler", 
        `Boiler is ${isLeadBoiler ? "LEAD" : "LAG"} based on settings`);
    } else if (metrics.isLeadBoiler !== undefined) {
      isLeadBoiler = metrics.isLeadBoiler;
      logLocationEquipment(locationId, equipmentId, "boiler", 
        `Boiler is ${isLeadBoiler ? "LEAD" : "LAG"} based on metrics`);
    } else if (boilerNumber === 1) {
      // Boiler 1 is disconnected, so it shouldn't be lead
      isLeadBoiler = false;
      logLocationEquipment(locationId, equipmentId, "boiler", 
        "Boiler 1 should not be lead since it's disconnected for repairs");
    } else {
      // Boiler 2 should be lead since Boiler 1 is disconnected
      isLeadBoiler = true;
      logLocationEquipment(locationId, equipmentId, "boiler", 
        "Boiler 2 should be lead since Boiler 1 is disconnected for repairs");
    }
    
    // Update settings to make sure lead/lag is correctly set
    hopebridgeSettings.isLeadBoiler = isLeadBoiler;
  } else {
    // If not in a group, default to lead
    isLeadBoiler = true;
    hopebridgeSettings.isLeadBoiler = true;
    logLocationEquipment(locationId, equipmentId, "boiler", 
      "Boiler not part of a group, defaulting to LEAD");
  }
  
  // STEP 8: Call base implementation with our modified settings
  logLocationEquipment(locationId, equipmentId, "boiler", 
    "Calling base implementation with Hopebridge-specific settings");
  
  const result = boilerControlBase(metrics, hopebridgeSettings, currentTemp, stateStorage);
  
  // STEP 9: Log the final result
  logLocationEquipment(locationId, equipmentId, "boiler", 
    `Control result: unitEnable=${result.unitEnable}, ` +
    `firing=${result.firing}, waterTempSetpoint=${result.waterTempSetpoint}°F, ` +
    `isLead=${result.isLead}`, result);
  
  return result;
}

/**
 * Extract boiler number from equipment ID
 */
function getBoilerNumber(equipmentId: string): number {
  try {
    // Check for "Boiler 1" or "Boiler 2" in the ID
    if (equipmentId.includes("Boiler 1") || equipmentId.includes("Boiler-1") || equipmentId.includes("Boiler1")) {
      return 1;
    }
    if (equipmentId.includes("Boiler 2") || equipmentId.includes("Boiler-2") || equipmentId.includes("Boiler2")) {
      return 2;
    }
    
    // Try to extract the number from the ID
    const match = equipmentId.match(/(\d+)/);
    if (match) {
      return parseInt(match[0], 10);
    }
    
    // Default to boiler 2 if we can't determine (since boiler 1 is disconnected)
    return 2;
  } catch (error) {
    console.error(`Error determining boiler number: ${error}`);
    return 2; // Default to boiler 2 since boiler 1 is disconnected
  }
}
