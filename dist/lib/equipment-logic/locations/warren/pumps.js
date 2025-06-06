"use strict";
// @ts-nocheck
// lib/equipment-logic/locations/warren/pumps.ts
//
// Author: Juelz NeuralBms DevOps
// Last Updated: June 4, 2025
//
// ===============================================================================
// WARREN PUMP CONTROL LOGIC - HOT WATER CIRCULATION SYSTEM
// ===============================================================================
//
// OVERVIEW:
// This file controls hot water circulation pumps at the Warren location using
// outdoor temperature-based control with lead-lag management for optimal
// efficiency and equipment longevity in the heating system.
//
// SYSTEM CONFIGURATION:
// - Hot Water (HW) pumps only - no chilled water pumps at Warren
// - Lead-lag management with automatic changeover on pump failure
// - Outdoor temperature-based enable/disable control
// - Current sensor monitoring for actual pump operation verification
// - HIGH-SPEED FACTORY INTEGRATION - Returns results instantly for batch database writes
//
// CONTROL STRATEGY:
// 1. Outdoor Temperature Control - Pumps enabled based on heating demand
// 2. Lead-Lag Management - Only one pump runs at a time under normal conditions
// 3. Failure Detection - Automatic switchover if lead pump fails
// 4. Current Monitoring - Amp readings verify actual pump operation
// 5. Hysteresis Control - Prevents short cycling on temperature changes
// 6. High-Speed Processing - No database operations, returns objects to factory
//
// TEMPERATURE THRESHOLDS (Warren Specific):
// - Enable when Outdoor Temp < 74°F (heating season start)
// - Disable when Outdoor Temp ≥ 75°F (heating season end)
// - 1°F hysteresis prevents short cycling around threshold
//
// LEAD-LAG OPERATION:
// - Lead pump operates first when temperature conditions require pumping
// - Lag pump only operates if lead pump fails (amp reading ≤ 10A)
// - Automatic identification: Pump with "1" in ID defaults to lead
// - Group management allows manual lead/lag designation
//
// CURRENT MONITORING:
// - Amp reading > 10A indicates pump is actually running
// - Amp reading ≤ 10A indicates pump failure or not running
// - Used for lead-lag switchover logic and operational verification
//
// PUMP IDENTIFICATION:
// - Equipment Type: "HWPump" (Hot Water Pump)
// - Group ID: Used for lead-lag coordination between multiple pumps
// - Lead/Lag Status: Determined by settings or equipment ID
//
// SAFETY FEATURES:
// - Safety mode if outdoor temperature unavailable (pumps enabled)
// - Failure detection with automatic lag pump activation
// - State persistence to prevent erratic switching
//
// DATA STORAGE:
// - Returns commands as objects to the factory for high-speed database writes
// - NO DIRECT INFLUXDB OPERATIONS - all writes handled by factory for performance
// - All operations are logged for troubleshooting
// - State storage maintains pump status and prevents oscillation
//
// TECHNICIAN NOTES:
// - Check outdoor temperature sensor if pumps cycling unexpectedly
// - Verify amp sensors if lead-lag switching seems incorrect (>10A threshold)
// - Only HW pumps supported - CW pumps will use base implementation
// - Hysteresis prevents cycling: ON at <74°F, OFF at ≥75°F
// - Lead pump determination: Check isLeadPump setting or equipment ID for "1"
// - Group ID required for proper lead-lag operation
// - Monitor amp readings to verify actual pump operation vs commanded state
// - State storage prevents rapid switching - check hwOutdoorState in logs
// - Use Node-RED dashboard to monitor real-time pump currents and outdoor temp
// - NO DATABASE OPERATIONS - Factory handles all writes for 1-2 second performance
//
// ===============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.pumpControl = pumpControl;
const pumps_1 = require("../../base/pumps");
const location_logger_1 = require("../../../logging/location-logger");

// Helper to safely parse temperatures from various metric sources or settings
function parseSafeNumber(value, defaultValue) {
    if (typeof value === 'number' && !isNaN(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const parsed = parseFloat(value);
        if (!isNaN(parsed)) {
            return parsed;
        }
    }
    return defaultValue;
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
    const possibleFields = [
        "outdoorTemp", "OutdoorTemp", "outdoorTemperature", "OutdoorTemperature",
        "oat", "OAT", "outsideAirTemp", "OutsideAirTemp", "outsideTemp", "OutsideTemp",
        "Outdoor_Air", "Outdoor", "outdoor"
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
    const pumpNumber = equipmentId.match(/\d+/)?.[0] || "";
    const possibleFields = [
        `HWPump${pumpNumber}Amps`, `hwPump${pumpNumber}Amps`,
        `HWPump-${pumpNumber}_Amps`, `hwPump-${pumpNumber}_Amps`,
        `HWPump-${pumpNumber}Amps`, `hwPump-${pumpNumber}Amps`,
        `HW${pumpNumber}Amps`, `hw${pumpNumber}Amps`,
        "pumpAmps", "PumpAmps", "amps", "Amps"
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
    const leadPumpNumber = leadPumpId.match(/\d+/)?.[0] || "1";
    const leadPumpAmpsFields = [
        `HWPump${leadPumpNumber}Amps`, `hwPump${leadPumpNumber}Amps`,
        `HWPump-${leadPumpNumber}_Amps`, `hwPump-${leadPumpNumber}_Amps`,
        `HWPump-${leadPumpNumber}Amps`, `hwPump-${leadPumpNumber}Amps`,
        `HW${leadPumpNumber}Amps`, `hw${leadPumpNumber}Amps`,
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

async function pumpControl(metricsInput, settingsInput, currentTempArgument, stateStorageInput) {
    const equipmentId = settingsInput.equipmentId || "unknown";
    const locationId = settingsInput.locationId || "1";
    const currentMetrics = metricsInput;
    const currentSettings = settingsInput;

    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", "Starting Warren pump control logic");

    try {
        // STEP 1: Determine pump type and verify it's a HW pump
        const pumpType = getPumpType(equipmentId, currentSettings.equipmentType);
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `Identified as pump type: ${pumpType}`);

        // Warren only has HW pumps - if somehow a CW pump is identified, log warning and use base logic
        if (pumpType !== "HWPump") {
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `WARNING: Non-HW pump detected (${pumpType}), using base implementation`);
            const baseResult = (0, pumps_1.pumpControl)(currentMetrics, currentSettings, currentTempArgument, stateStorageInput);
            // FIXED: NO DATABASE OPERATIONS - Return result to factory
            return baseResult;
        }

        // STEP 2: Get outdoor temperature with fallbacks
        const outdoorTemp = getOutdoorTemperature(currentMetrics);
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `Outdoor temperature: ${outdoorTemp !== null ? outdoorTemp + "°F" : "Not available"}`);

        // If outdoor temperature is not available, default to running the pump (safety mode)
        if (outdoorTemp === null) {
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", "WARNING: Outdoor temperature not available, defaulting to safety mode (pump enabled)");
            const safetyResult = {
                unitEnable: true,
                pumpEnabled: true,
                pumpRunning: true,
                pumpSpeed: 100,
                leadLagStatus: currentSettings.isLeadPump ? "lead" : "lag",
                isLead: currentSettings.isLeadPump ? 1 : 0,
                pumpType: pumpType,
                pumpGroupId: currentSettings.pumpGroupId || currentSettings.groupId || currentSettings.systemGroupId || null,
                outdoorTemp: "unknown"
            };
            // FIXED: NO DATABASE OPERATIONS - Return result to factory
            return safetyResult;
        }

        // STEP 3: Initialize state storage for HW outdoor temperature control
        if (!stateStorageInput.hwOutdoorState) {
            stateStorageInput.hwOutdoorState = {
                isOn: false
            };
            // Initialize state based on current outdoor temperature
            if (outdoorTemp < 74) {
                stateStorageInput.hwOutdoorState.isOn = true;
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `Initializing HW pump state to ON (${outdoorTemp}°F < 74°F)`);
            }
            else {
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `Initializing HW pump state to OFF (${outdoorTemp}°F >= 74°F)`);
            }
        }

        // STEP 4: Apply Warren-specific temperature thresholds with hysteresis
        // Enable when OAT < 74°F, disable when OAT ≥ 75°F
        if (stateStorageInput.hwOutdoorState.isOn) {
            // If currently on, turn off at 75°F or higher
            if (outdoorTemp >= 75) {
                stateStorageInput.hwOutdoorState.isOn = false;
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `HW Pump: Turning OFF (${outdoorTemp}°F >= 75°F)`);
            }
            else {
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `HW Pump: Staying ON (${outdoorTemp}°F < 75°F)`);
            }
        }
        else {
            // If currently off, turn on at less than 74°F
            if (outdoorTemp < 74) {
                stateStorageInput.hwOutdoorState.isOn = true;
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `HW Pump: Turning ON (${outdoorTemp}°F < 74°F)`);
            }
            else {
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `HW Pump: Staying OFF (${outdoorTemp}°F >= 74°F)`);
            }
        }

        // STEP 5: Check if this pump is lead or lag based on settings
        let isLead = false;
        const groupId = currentSettings.pumpGroupId || currentSettings.groupId ||
            currentSettings.systemGroupId || null;

        if (groupId) {
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `Pump is part of group ${groupId}`);
            if (currentSettings.isLeadPump !== undefined) {
                isLead = currentSettings.isLeadPump;
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `Pump is ${isLead ? "LEAD" : "LAG"} based on settings`);
            }
            else if (currentMetrics.isLeadPump !== undefined) {
                isLead = currentMetrics.isLeadPump;
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
        const pumpAmps = getPumpAmps(currentMetrics, equipmentId);
        const pumpActuallyRunning = pumpAmps !== null ? pumpAmps > 10 : false;
        if (pumpAmps !== null) {
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `Pump amp reading: ${pumpAmps}A (${pumpActuallyRunning ? "RUNNING" : "NOT RUNNING"})`);
        }
        else {
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", "Pump amp reading: Not available");
        }

        // STEP 7: Determine if the pump should be enabled
        let unitEnable = false;
        let pumpEnabled = false;
        const leadPumpFailed = checkLeadPumpFailure(currentMetrics, currentSettings, equipmentId);

        if (stateStorageInput.hwOutdoorState.isOn) {
            if (isLead) {
                // Lead pump - enable when temperature allows
                unitEnable = true;
                pumpEnabled = true;
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", "LEAD pump enabled based on temperature conditions");
            }
            else if (leadPumpFailed) {
                // Lag pump - enable only if lead pump has failed
                unitEnable = true;
                pumpEnabled = true;
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", "LAG pump enabled because lead pump has failed");
            }
            else {
                // Lag pump - don't enable if lead pump is working
                unitEnable = false;
                pumpEnabled = false;
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", "LAG pump disabled because lead pump is operational");
            }
        }
        else {
            // Temperature conditions don't allow operation
            unitEnable = false;
            pumpEnabled = false;
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", "Pump disabled based on temperature conditions");
        }

        // STEP 8: Construct result - MATCH HUNTINGTON FORMAT
        const result = {
            unitEnable: unitEnable,
            pumpEnabled: pumpEnabled,
            pumpRunning: pumpActuallyRunning,
            pumpSpeed: pumpEnabled ? 100 : 0,
            leadLagStatus: isLead ? "lead" : "lag",
            isLead: isLead ? 1 : 0,
            pumpType: pumpType,
            pumpGroupId: groupId,
            outdoorTemp: outdoorTemp,
            ampReading: pumpAmps || 0,
            temperatureControlActive: stateStorageInput.hwOutdoorState.isOn
        };

        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", 
            `Final control values: unitEnable=${result.unitEnable}, ` +
            `pumpEnabled=${result.pumpEnabled}, actuallyRunning=${result.pumpRunning}, ` +
            `leadLag=${result.leadLagStatus}, outdoorTemp=${result.outdoorTemp}°F`);

        // STEP 9: Return result to factory for high-speed database writes
        // NO INFLUXDB OPERATIONS HERE - Factory handles all database writes for performance
        return result;

    } catch (error) {
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", 
            `ERROR in Warren pump control: ${error.message}`, error.stack);

        const errorResult = {
            unitEnable: false,
            pumpEnabled: false,
            pumpRunning: false,
            pumpSpeed: 0,
            leadLagStatus: "error",
            isLead: 0,
            pumpType: getPumpType(equipmentId, currentSettings.equipmentType),
            pumpGroupId: null,
            outdoorTemp: null,
            ampReading: 0,
            temperatureControlActive: false
        };

        // FIXED: NO DATABASE OPERATIONS - Return error state to factory
        return errorResult;
    }
}

// Add worker compatibility exports (match Huntington)
exports.default = pumpControl;
exports.processEquipment = pumpControl;
exports.runLogic = pumpControl;
