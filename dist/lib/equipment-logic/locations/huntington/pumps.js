"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pumpControl = pumpControl;
// lib/equipment-logic/locations/huntington/pumps.ts
const pumps_1 = require("../../base/pumps");
const location_logger_1 = require("@/lib/logging/location-logger");
const firestore_1 = require("firebase-admin/firestore");
/**
 * Pump Control Logic specifically for Huntington
 * - CW pumps: ON at 37°F, OFF at 36°F
 * - HW pumps: OFF at 75°F, ON at 74°F (same as base)
 * - Works with existing lead-lag manager and equipment groups
 */
async function pumpControl(metrics, settings, currentTemp, stateStorage) {
    // Extract equipment ID and location ID for logging
    const equipmentId = settings.equipmentId || "unknown";
    const locationId = settings.locationId || "4"; // Default to Huntington
    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", "Starting Huntington-specific pump control logic");
    // CRITICAL FIX: Get equipment group configuration from Firestore for the HW pumps
    if (equipmentId === "oh5Bz2zzIcuT9lFoogvi" || equipmentId === "GUI1SxcedsLEhqbD0G2p") {
        const equipmentGroupId = "HuntingtonHeritageHeatingPumps";
        try {
            const db = (0, firestore_1.getFirestore)();
            const equipmentGroupRef = db.collection('equipmentGroups').doc(equipmentGroupId);
            const equipmentGroupDoc = await equipmentGroupRef.get();
            if (equipmentGroupDoc.exists) {
                const equipmentGroupConfig = equipmentGroupDoc.data();
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `Retrieved equipment group configuration from Firestore`, equipmentGroupConfig);
                // Add equipment group ID to settings
                settings.pumpGroupId = equipmentGroupId;
                // Determine if this pump is the lead based on Firestore config
                if (equipmentGroupConfig.useLeadLag && equipmentGroupConfig.leadEquipmentId) {
                    const isLead = equipmentId === equipmentGroupConfig.leadEquipmentId;
                    // Override the base logic by setting this directly in settings
                    settings.forceLeadStatus = isLead;
                    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `Determined lead status from Firestore: ${isLead ? "LEAD" : "LAG"}`);
                }
            }
            else {
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `Equipment group ${equipmentGroupId} not found in Firestore, using base logic`);
            }
        }
        catch (error) {
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `Error retrieving equipment group from Firestore: ${error.message}`);
        }
    }
    // ADDED: Get equipment group configuration from Firestore for the CW pumps
    else if (equipmentId === "RJLaOk4UssyePSA1qgT8" || equipmentId === "wGvFI5Bf6xaLlSwRc7xO") {
        const equipmentGroupId = "HuntingtonHeritageChillerPumps";
        try {
            const db = (0, firestore_1.getFirestore)();
            const equipmentGroupRef = db.collection('equipmentGroups').doc(equipmentGroupId);
            const equipmentGroupDoc = await equipmentGroupRef.get();
            if (equipmentGroupDoc.exists) {
                const equipmentGroupConfig = equipmentGroupDoc.data();
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `Retrieved equipment group configuration from Firestore`, equipmentGroupConfig);
                // Add equipment group ID to settings
                settings.pumpGroupId = equipmentGroupId;
                // Determine if this pump is the lead based on Firestore config
                if (equipmentGroupConfig.useLeadLag && equipmentGroupConfig.leadEquipmentId) {
                    const isLead = equipmentId === equipmentGroupConfig.leadEquipmentId;
                    // Override the base logic by setting this directly in settings
                    settings.forceLeadStatus = isLead;
                    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `Determined lead status from Firestore: ${isLead ? "LEAD" : "LAG"}`);
                }
            }
            else {
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `Equipment group ${equipmentGroupId} not found in Firestore, using base logic`);
            }
        }
        catch (error) {
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `Error retrieving equipment group from Firestore: ${error.message}`);
        }
    }
    // Determine pump type
    const pumpType = getPumpType(equipmentId, settings.equipmentType);
    // Get outdoor temperature
    const outdoorTemp = getOutdoorTemperature(metrics);
    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `${pumpType}: Outdoor temperature: ${outdoorTemp !== null ? outdoorTemp + "°F" : "Not available"}`);
    // Only modify base stateStorage if needed
    if (pumpType === "CWPump" && !stateStorage.cwOutdoorState) {
        stateStorage.cwOutdoorState = {
            isOn: false
        };
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", "Initialized CW pump state storage");
    }
    else if (pumpType === "HWPump" && !stateStorage.hwOutdoorState) {
        stateStorage.hwOutdoorState = {
            isOn: false
        };
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", "Initialized HW pump state storage");
    }
    // Override the base temperature thresholds
    // For CW pumps: ON at 37°F instead of 37.5°F (base)
    if (pumpType === "CWPump" && outdoorTemp !== null) {
        // Apply Huntington-specific logic for CW pumps
        if (stateStorage.cwOutdoorState.isOn) {
            // If currently on, turn off at 36°F or lower (same as base)
            if (outdoorTemp <= 36) {
                stateStorage.cwOutdoorState.isOn = false;
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `CW Pump: Turning OFF (${outdoorTemp}°F <= 36°F)`);
            }
            else {
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `CW Pump: Staying ON (${outdoorTemp}°F > 36°F)`);
            }
        }
        else {
            // If currently off, turn on at 37°F or higher (Huntington-specific, base is 37.5°F)
            if (outdoorTemp >= 37) {
                stateStorage.cwOutdoorState.isOn = true;
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `CW Pump: Turning ON (${outdoorTemp}°F >= 37°F)`);
            }
            else {
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `CW Pump: Staying OFF (${outdoorTemp}°F < 37°F)`);
            }
        }
    }
    // For HW pumps: OFF at 75°F, ON at 74°F (same as base)
    else if (pumpType === "HWPump" && outdoorTemp !== null) {
        // The base implementation already has the correct thresholds for Huntington HW pumps,
        // but we'll log it with Huntington-specific labels
        if (stateStorage.hwOutdoorState.isOn) {
            if (outdoorTemp >= 75) {
                stateStorage.hwOutdoorState.isOn = false;
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `HW Pump: Turning OFF (${outdoorTemp}°F >= 75°F)`);
            }
            else {
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `HW Pump: Staying ON (${outdoorTemp}°F < 75°F)`);
            }
        }
        else {
            if (outdoorTemp <= 74) {
                stateStorage.hwOutdoorState.isOn = true;
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `HW Pump: Turning ON (${outdoorTemp}°F <= 74°F)`);
            }
            else {
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `HW Pump: Staying OFF (${outdoorTemp}°F > 74°F)`);
            }
        }
    }
    // CRITICAL FIX: Use separate state storage per pump
    // This ensures that pumps don't share the same state tracking
    const pumpStateKey = `pump_${equipmentId}_state`;
    if (!stateStorage[pumpStateKey]) {
        stateStorage[pumpStateKey] = {
            lastChecked: Date.now()
        };
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `Initialized pump-specific state storage for ${equipmentId}`);
    }
    // Call the base implementation with our modified settings and state storage
    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", "Calling base implementation with Huntington-specific configuration");
    const baseResult = (0, pumps_1.pumpControl)(metrics, settings, currentTemp, stateStorage);
    // Log the final result
    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `Control result: unitEnable=${baseResult.unitEnable}, ` +
        `isLead=${baseResult.isLead}, temperatureSource=${baseResult.temperatureSource}`, baseResult);
    // Return the result from the base implementation
    return baseResult;
}
/**
 * Determine pump type from equipment ID or type
 * UPDATED: Added explicit mapping for Huntington equipment IDs
 */
function getPumpType(equipmentId, equipmentType) {
    // ADDED: Explicit equipment ID mapping for Huntington pumps
    const cwPumpIds = ["RJLaOk4UssyePSA1qgT8", "wGvFI5Bf6xaLlSwRc7xO"];
    if (cwPumpIds.includes(equipmentId)) {
        return "CWPump";
    }
    const hwPumpIds = ["oh5Bz2zzIcuT9lFoogvi", "GUI1SxcedsLEhqbD0G2p"];
    if (hwPumpIds.includes(equipmentId)) {
        return "HWPump";
    }
    // First check equipment type if available
    if (equipmentType) {
        if (equipmentType.toLowerCase().includes("cw") || equipmentType.toLowerCase().includes("chilled")) {
            return "CWPump";
        }
        if (equipmentType.toLowerCase().includes("hw") || equipmentType.toLowerCase().includes("heat")) {
            return "HWPump";
        }
    }
    // Otherwise check equipment ID
    if (equipmentId.toLowerCase().includes("cwpump") || equipmentId.toLowerCase().includes("chilled")) {
        return "CWPump";
    }
    if (equipmentId.toLowerCase().includes("hwpump") || equipmentId.toLowerCase().includes("heat")) {
        return "HWPump";
    }
    // Default to HW if we can't determine
    return "HWPump";
}
/**
 * Get outdoor temperature from metrics
 * (Copy of the function from base implementation)
 */
function getOutdoorTemperature(metrics) {
    // First check 'outsideTemp' which is used in your Node-RED function
    if (metrics.outsideTemp !== undefined && !isNaN(Number(metrics.outsideTemp))) {
        return Number(metrics.outsideTemp);
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
        "Outdoor_Air"
    ];
    for (const field of possibleFields) {
        if (metrics[field] !== undefined && !isNaN(Number(metrics[field]))) {
            return Number(metrics[field]);
        }
    }
    return null;
}
