// lib/equipment-logic/locations/huntington/boiler.ts
import { boilerControl as boilerControlBase } from "../../base/boiler";
import { logLocationEquipment } from "@/lib/logging/location-logger";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Boiler Control Logic specifically for Huntington
 * - Domestic hot water boilers: Fixed setpoint of 134°F
 * - Comfort boilers: OAR curve 32°F → 165°F, 75°F → 85°F
 * - Both boiler types use equipment groups for lead-lag control
 */
export async function boilerControl(metrics: any, settings: any, currentTemp: number, stateStorage: any) {
  // Extract equipment ID and location ID for logging
  const equipmentId = settings.equipmentId || "unknown";
  const locationId = settings.locationId || "4"; // Default to Huntington

  logLocationEquipment(locationId, equipmentId, "boiler", "Starting Huntington-specific boiler control logic");

  // ADDED: Get equipment group configuration from Firestore for the Comfort boilers
  if (isComfortBoiler(equipmentId)) {
    const equipmentGroupId = "HuntingtonHeritageComfortBoilers";

    try {
      const db = getFirestore();
      const equipmentGroupRef = db.collection('equipmentGroups').doc(equipmentGroupId);
      const equipmentGroupDoc = await equipmentGroupRef.get();

      if (equipmentGroupDoc.exists) {
        const equipmentGroupConfig = equipmentGroupDoc.data();
        logLocationEquipment(locationId, equipmentId, "boiler",
          `Retrieved equipment group configuration from Firestore`, equipmentGroupConfig);

        // Add equipment group ID to settings
        settings.boilerGroupId = equipmentGroupId;

        // Determine if this boiler is the lead based on Firestore config
        if (equipmentGroupConfig.useLeadLag && equipmentGroupConfig.leadEquipmentId) {
          const isLead = equipmentId === equipmentGroupConfig.leadEquipmentId;

          // Override the base logic by setting this directly in settings
          settings.forceLeadStatus = isLead;
          settings.isLead = isLead ? 1 : 0;

          logLocationEquipment(locationId, equipmentId, "boiler",
            `Determined lead status from Firestore: ${isLead ? "LEAD" : "LAG"}`);
        }
      } else {
        logLocationEquipment(locationId, equipmentId, "boiler",
          `Equipment group ${equipmentGroupId} not found in Firestore, using base logic`);
      }
    } catch (error) {
      logLocationEquipment(locationId, equipmentId, "boiler",
        `Error retrieving equipment group from Firestore: ${error.message}`);
    }
  }

  // Determine boiler type based on equipment ID or name
  const boilerType = getBoilerType(equipmentId, settings.name);
  
  // Add boiler type to settings for reference
  settings.boilerType = boilerType;
  
  // ADDED: Track boiler runtime in state storage
  if (!stateStorage.boilerRuntime) {
    stateStorage.boilerRuntime = 0;
  }

  // Create a copy of settings to modify with Huntington-specific values
  const huntingtonSettings = { ...settings };

  // DOMESTIC HOT WATER BOILERS - Fixed setpoint of 134°F
  if (boilerType === "domestic") {
    // Huntington-specific domestic water settings - fixed 134°F setpoint
    huntingtonSettings.temperatureSetpoint = 134;
    huntingtonSettings.waterTempSetpoint = 134;

    // Ensure outdoor air reset is disabled for domestic boilers
    if (!huntingtonSettings.outdoorAirReset) {
      huntingtonSettings.outdoorAirReset = {};
    }
    huntingtonSettings.outdoorAirReset.enabled = false;

    logLocationEquipment(locationId, equipmentId, "boiler",
      `Domestic hot water boiler: Using fixed setpoint of 134°F`);

    // Call base implementation with Huntington-specific settings
    const result = boilerControlBase(metrics, huntingtonSettings, currentTemp, stateStorage);

    // Add boilerType to result for downstream processing
    result.boilerType = boilerType;
    
    // ADDED: Add group ID to result if available
    if (huntingtonSettings.boilerGroupId) {
      result.groupId = huntingtonSettings.boilerGroupId;
    }

    // Log the control result
    logLocationEquipment(locationId, equipmentId, "boiler",
      `Control result: unitEnable=${result.unitEnable}, ` +
      `firing=${result.firing}, waterTempSetpoint=${result.waterTempSetpoint}°F`, result);

    return result;
  }

  // COMFORT HEATING BOILERS - OAR settings
  // Set Huntington-specific OAR settings
  if (!huntingtonSettings.outdoorAirReset) {
    huntingtonSettings.outdoorAirReset = {};
  }

  // Huntington-specific OAR parameters
  huntingtonSettings.outdoorAirReset = {
    ...huntingtonSettings.outdoorAirReset,
    enabled: true,
    minTemp: 32,           // Min outdoor temperature: 32°F
    maxTemp: 75,           // Max outdoor temperature: 75°F
    minSetpoint: 85,       // Min supply temperature: 85°F (at maxTemp)
    maxSetpoint: 165       // Max supply temperature: 165°F (at minTemp)
  };

  // Get outdoor temperature for logging
  const outdoorTemp =
    metrics.outdoorTemp ||
    metrics.OutdoorTemp ||
    metrics.OutdoorAirTemp ||
    metrics["Outdoor Air Temperature"] ||
    metrics.Outdoor_Air_Temperature ||
    metrics.outdoorTemperature ||
    metrics.OutdoorTemperature ||
    metrics.Outdoor ||
    metrics.outdoor ||
    metrics.OAT ||
    metrics.oat ||
    50;

  logLocationEquipment(locationId, equipmentId, "boiler",
    `Comfort boiler: Using OAR curve 32°F → 165°F, 75°F → 85°F, current OAT: ${outdoorTemp}°F`);

  // Call base implementation with Huntington-specific settings
  const result = boilerControlBase(metrics, huntingtonSettings, currentTemp, stateStorage);

  // Add boilerType to result for downstream processing
  result.boilerType = boilerType;
  
  // ADDED: Add group ID to result if available
  if (huntingtonSettings.boilerGroupId) {
    result.groupId = huntingtonSettings.boilerGroupId;
  }

  // Log the control result
  logLocationEquipment(locationId, equipmentId, "boiler",
    `Control result: unitEnable=${result.unitEnable}, ` +
    `firing=${result.firing}, waterTempSetpoint=${result.waterTempSetpoint}°F, ` +
    `isLead=${result.isLead}`, result);

  return result;
}

/**
 * ADDED: Determine if equipment ID is a comfort boiler
 */
function isComfortBoiler(equipmentId: string): boolean {
  // Known comfort boiler IDs
  const comfortBoilerIds = [
    "ZLYR6YveSmCEMqtBSy3e", 
    "XBvDBSJvhBM4FSBpMDAp"
  ];
  
  return comfortBoilerIds.includes(equipmentId);
}

/**
 * ADDED: Determine boiler type from equipment ID or name
 */
function getBoilerType(equipmentId: string, name?: string): string {
  // Explicit mapping for known equipment IDs
  const domesticBoilerIds = [
    // Add your domestic boiler IDs here if known
  ];
  
  const comfortBoilerIds = [
    "ZLYR6YveSmCEMqtBSy3e", 
    "XBvDBSJvhBM4FSBpMDAp"
  ];
  
  if (domesticBoilerIds.includes(equipmentId)) {
    return "domestic";
  }
  
  if (comfortBoilerIds.includes(equipmentId)) {
    return "comfort";
  }
  
  // If no explicit mapping, use the name/ID check logic
  const boilerName = name || equipmentId;
  const isDomestic =
    boilerName.toLowerCase().includes("domestic") ||
    equipmentId.toLowerCase().includes("domestic") ||
    equipmentId.toLowerCase().includes("dhw");

  return isDomestic ? "domestic" : "comfort";
}
