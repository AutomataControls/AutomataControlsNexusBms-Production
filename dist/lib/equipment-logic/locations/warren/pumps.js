"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pumpControl = pumpControl;
// lib/equipment-logic/locations/warren/pumps.ts
const pumps_1 = require("../../base/pumps");
const location_logger_1 = require("@/lib/logging/location-logger");
/**
 * Pump Control Logic specifically for Warren
 * - Only HW (Hot Water) pumps
 * - Part of equipmentGroup for lead/lag/changeover
 * - Enable when OAT < 74°F, disable when OAT ≥ 75°F
 * - Only one pump enabled at a time
 * - Amp reading > 10 indicates pump is actually running
 */
function pumpControl(metrics, settings, currentTemp, stateStorage) {
    // Extract equipment ID and location ID for logging
    const equipmentId = settings.equipmentId || "unknown";
    const locationId = settings.locationId || "1"; // Default to Warren (ID: 1)
    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", "Starting Warren-specific pump control logic");
    // STEP 1: Determine pump type and verify it's a HW pump
    const pumpType = getPumpType(equipmentId, settings.equipmentType);
    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `Identified as pump type: ${pumpType}`);
    // Warren only has HW pumps - if somehow a CW pump is identified, log warning and use base logic
    if (pumpType !== "HWPump") {
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `WARNING: Non-HW pump detected (${pumpType}), using base implementation`);
        return (0, pumps_1.pumpControl)(metrics, settings, currentTemp, stateStorage);
    }
    // STEP 2: Get outdoor temperature with fallbacks
    const outdoorTemp = getOutdoorTemperature(metrics);
    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `Outdoor temperature: ${outdoorTemp !== null ? outdoorTemp + "°F" : "Not available"}`);
    // If outdoor temperature is not available, default to running the pump
    if (outdoorTemp === null) {
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", "WARNING: Outdoor temperature not available, defaulting to safety mode (pump enabled)");
        return {
            unitEnable: true,
            pumpRunning: true,
            temperatureSource: "default",
            stateStorage: stateStorage,
            isLead: settings.isLeadPump ? 1 : 0,
            pumpType: pumpType,
            pumpGroupId: settings.pumpGroupId || settings.groupId || settings.systemGroupId || null,
            outdoorTemp: "unknown"
        };
    }
    // STEP 3: Initialize state storage for HW outdoor temperature control
    if (!stateStorage.hwOutdoorState) {
        stateStorage.hwOutdoorState = {
            isOn: false
        };
        // Initialize state based on current outdoor temperature
        if (outdoorTemp < 74) {
            stateStorage.hwOutdoorState.isOn = true;
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `Initializing HW pump state to ON (${outdoorTemp}°F < 74°F)`);
        }
        else {
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `Initializing HW pump state to OFF (${outdoorTemp}°F >= 74°F)`);
        }
    }
    // STEP 4: Apply Warren-specific temperature thresholds with hysteresis
    // Enable when OAT < 74°F, disable when OAT ≥ 75°F
    if (stateStorage.hwOutdoorState.isOn) {
        // If currently on, turn off at 75°F or higher
        if (outdoorTemp >= 75) {
            stateStorage.hwOutdoorState.isOn = false;
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `HW Pump: Turning OFF (${outdoorTemp}°F >= 75°F)`);
        }
        else {
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `HW Pump: Staying ON (${outdoorTemp}°F < 75°F)`);
        }
    }
    else {
        // If currently off, turn on at less than 74°F
        if (outdoorTemp < 74) {
            stateStorage.hwOutdoorState.isOn = true;
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `HW Pump: Turning ON (${outdoorTemp}°F < 74°F)`);
        }
        else {
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `HW Pump: Staying OFF (${outdoorTemp}°F >= 74°F)`);
        }
    }
    // STEP 5: Check if this pump is lead or lag based on settings
    let isLead = false;
    const groupId = settings.pumpGroupId || settings.groupId || settings.systemGroupId || null;
    if (groupId) {
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `Pump is part of group ${groupId}`);
        if (settings.isLeadPump !== undefined) {
            isLead = settings.isLeadPump;
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `Pump is ${isLead ? "LEAD" : "LAG"} based on settings`);
        }
        else if (metrics.isLeadPump !== undefined) {
            isLead = metrics.isLeadPump;
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `Pump is ${isLead ? "LEAD" : "LAG"} based on metrics`);
        }
        else {
            // Default to pump 1 as lead if not specified
            isLead = equipmentId.includes("1") || equipmentId.includes("HWPump-1");
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `Pump lead/lag status not specified, defaulting to ${isLead ? "LEAD" : "LAG"} based on ID`);
        }
    }
    else {
        // If not in a group, consider it a lead pump
        isLead = true;
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", "Pump not part of a group, defaulting to LEAD");
    }
    // STEP 6: Check amp readings to see if pump is actually running
    const pumpAmps = getPumpAmps(metrics, equipmentId);
    const pumpActuallyRunning = pumpAmps > 10;
    if (pumpAmps !== null) {
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `Pump amp reading: ${pumpAmps}A (${pumpActuallyRunning ? "RUNNING" : "NOT RUNNING"})`);
    }
    // STEP 7: Determine if the pump should be enabled
    // Only enable if:
    // 1. Temperature conditions allow (hwOutdoorState.isOn is true)
    // 2. Either this is the lead pump OR the lead pump is not running (based on amp reading)
    let unitEnable = false;
    const leadPumpFailed = checkLeadPumpFailure(metrics, settings, equipmentId);
    if (stateStorage.hwOutdoorState.isOn) {
        if (isLead) {
            // Lead pump - enable when temperature allows
            unitEnable = true;
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", "LEAD pump enabled based on temperature conditions");
        }
        else if (leadPumpFailed) {
            // Lag pump - enable only if lead pump has failed
            unitEnable = true;
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", "LAG pump enabled because lead pump has failed");
        }
        else {
            // Lag pump - don't enable if lead pump is working
            unitEnable = false;
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", "LAG pump disabled because lead pump is operational");
        }
    }
    else {
        // Temperature conditions don't allow operation
        unitEnable = false;
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", "Pump disabled based on temperature conditions");
    }
    // STEP 8: Return the final control values
    const result = {
        unitEnable: unitEnable,
        pumpRunning: pumpActuallyRunning,
        temperatureSource: "outdoor",
        stateStorage: stateStorage,
        isLead: isLead ? 1 : 0,
        pumpType: pumpType,
        pumpGroupId: groupId,
        outdoorTemp: outdoorTemp,
        ampReading: pumpAmps
    };
    // Log the final control state
    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `Final control values: unitEnable=${result.unitEnable}, ` +
        `pumpActuallyRunning=${result.pumpRunning}, ` +
        `isLead=${result.isLead}`, result);
    return result;
}
/**
 * Determine pump type from equipment ID or type
 */
function getPumpType(equipmentId, equipmentType) {
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
    if (equipmentId.toLowerCase().includes("hwpump") ||
        equipmentId.toLowerCase().includes("heat") ||
        equipmentId.toLowerCase().includes("hot")) {
        return "HWPump";
    }
    // Default to HW for Warren since they only have HW pumps
    return "HWPump";
}
/**
 * Get outdoor temperature from metrics
 */
function getOutdoorTemperature(metrics) {
    // Check various possible field names for outdoor temperature
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
        "Outdoor_Air",
        "Outdoor",
        "outdoor"
    ];
    for (const field of possibleFields) {
        if (metrics[field] !== undefined && !isNaN(Number(metrics[field]))) {
            return Number(metrics[field]);
        }
    }
    return null;
}
/**
 * Get pump amp reading from metrics
 */
function getPumpAmps(metrics, equipmentId) {
    var _a;
    // Try to get amp reading specific to this pump
    const pumpNumber = ((_a = equipmentId.match(/\d+/)) === null || _a === void 0 ? void 0 : _a[0]) || "";
    // Check various possible field names for amp readings
    const possibleFields = [
        `HWPump${pumpNumber}Amps`,
        `hwPump${pumpNumber}Amps`,
        `HWPump-${pumpNumber}_Amps`,
        `hwPump-${pumpNumber}_Amps`,
        `HWPump-${pumpNumber}Amps`,
        `hwPump-${pumpNumber}Amps`,
        `HW${pumpNumber}Amps`,
        `hw${pumpNumber}Amps`,
        "pumpAmps",
        "PumpAmps",
        "amps",
        "Amps"
    ];
    for (const field of possibleFields) {
        if (metrics[field] !== undefined && !isNaN(Number(metrics[field]))) {
            return Number(metrics[field]);
        }
    }
    return null;
}
/**
 * Check if the lead pump has failed based on amp readings
 */
function checkLeadPumpFailure(metrics, settings, equipmentId) {
    var _a;
    // Determine which pump is the lead pump
    let leadPumpId = "";
    const groupId = settings.pumpGroupId || settings.groupId || settings.systemGroupId || null;
    if (!groupId) {
        return false; // No group, can't determine lead pump
    }
    // Try to identify the lead pump from metrics
    if (metrics.leadPumpId) {
        leadPumpId = metrics.leadPumpId;
    }
    else if (metrics.HWPumpLeadId || metrics.hwPumpLeadId) {
        leadPumpId = metrics.HWPumpLeadId || metrics.hwPumpLeadId;
    }
    else {
        // Default assumption: HWPump-1 is lead unless specified otherwise
        leadPumpId = "HWPump-1";
    }
    // If this is the lead pump, it can't be checking if the lead pump failed
    if (equipmentId.includes(leadPumpId)) {
        return false;
    }
    // Check amp reading of lead pump
    const leadPumpNumber = ((_a = leadPumpId.match(/\d+/)) === null || _a === void 0 ? void 0 : _a[0]) || "1";
    const leadPumpAmpsFields = [
        `HWPump${leadPumpNumber}Amps`,
        `hwPump${leadPumpNumber}Amps`,
        `HWPump-${leadPumpNumber}_Amps`,
        `hwPump-${leadPumpNumber}_Amps`,
        `HWPump-${leadPumpNumber}Amps`,
        `hwPump-${leadPumpNumber}Amps`,
        `HW${leadPumpNumber}Amps`,
        `hw${leadPumpNumber}Amps`,
        `${leadPumpId}Amps`
    ];
    // Check all possible fields for lead pump amps
    for (const field of leadPumpAmpsFields) {
        if (metrics[field] !== undefined && !isNaN(Number(metrics[field]))) {
            // If lead pump amps are <= 10, it's considered failed
            return Number(metrics[field]) <= 10;
        }
    }
    // If we can't determine lead pump status, default to false (don't assume failure)
    return false;
}
