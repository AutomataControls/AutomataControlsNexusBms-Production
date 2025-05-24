"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.boilerControl = boilerControl;
// lib/equipment-logic/locations/huntington/boiler.ts
const boiler_1 = require("../../base/boiler");
const location_logger_1 = require("@/lib/logging/location-logger");
/**
 * Boiler Control Logic specifically for Huntington
 * - Domestic hot water boilers: Fixed setpoint of 134°F
 * - Comfort boilers: OAR curve 32°F → 165°F, 75°F → 85°F
 * - Both boiler types use equipment groups for lead-lag control
 */
function boilerControl(metrics, settings, currentTemp, stateStorage) {
    // Extract equipment ID and location ID for logging
    const equipmentId = settings.equipmentId || "unknown";
    const locationId = settings.locationId || "4"; // Default to Huntington
    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "boiler", "Starting Huntington-specific boiler control logic");
    // Determine boiler type based on equipment ID or name
    const boilerName = settings.name || equipmentId;
    const isDomestic = boilerName.toLowerCase().includes("domestic") ||
        equipmentId.toLowerCase().includes("domestic") ||
        equipmentId.toLowerCase().includes("dhw");
    const boilerType = isDomestic ? "domestic" : "comfort";
    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "boiler", `Controlling ${boilerType} boiler`);
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
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "boiler", `Domestic hot water boiler: Using fixed setpoint of 134°F`);
        // Call base implementation with Huntington-specific settings
        const result = (0, boiler_1.boilerControl)(metrics, huntingtonSettings, currentTemp, stateStorage);
        // Log the control result
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "boiler", `Control result: unitEnable=${result.unitEnable}, ` +
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
        minTemp: 32, // Min outdoor temperature: 32°F
        maxTemp: 75, // Max outdoor temperature: 75°F 
        minSetpoint: 90, // Min supply temperature: 85°F (at maxTemp)
        maxSetpoint: 165 // Max supply temperature: 165°F (at minTemp)
    };
    // Get outdoor temperature for logging
    const outdoorTemp = metrics.outdoorTemp ||
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
    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "boiler", `Comfort boiler: Using OAR curve 32°F → 165°F, 75°F → 85°F, current OAT: ${outdoorTemp}°F`);
    // Call base implementation with Huntington-specific settings
    const result = (0, boiler_1.boilerControl)(metrics, huntingtonSettings, currentTemp, stateStorage);
    // Log the control result
    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "boiler", `Control result: unitEnable=${result.unitEnable}, ` +
        `firing=${result.firing}, waterTempSetpoint=${result.waterTempSetpoint}°F, ` +
        `isLead=${result.isLead}`, result);
    return result;
}
