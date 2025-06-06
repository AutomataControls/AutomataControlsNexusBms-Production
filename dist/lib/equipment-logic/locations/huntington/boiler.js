"use strict";
// @ts-nocheck
// lib/equipment-logic/locations/huntington/boiler.ts
//
// ===============================================================================
// HUNTINGTON BOILER CONTROL LOGIC - INTEGRATED LEAD-LAG BOILER SYSTEM
// ===============================================================================
//
// OVERVIEW:
// This file controls both Comfort and Domestic boiler systems specifically for the
// Huntington location with integrated lead-lag management, failover detection, and
// scheduled rotation. All lead-lag decisions are made locally within Huntington equipment only.
//
// EQUIPMENT CONFIGURATION:
// Comfort Boilers (OAR Control):
// - Group: HuntingtonHeritageComfortBoilers
// - Equipment IDs: ["ZLYR6YveSmCEMqtBSy3e", "XbvDB5Jvh8M4FSBpMDAp"]
// - Control Source: Supply water temperature (H20Supply)
// - Setpoint: Outdoor Air Reset (OAR) - 80°F to 155°F based on outdoor temp
//
// Domestic Boilers (Fixed Setpoint):
// - Group: HuntingtonHeritageDomesticBoilers
// - Equipment IDs: ["NJuMiYl44QNZ8S4AdLsB", "mpjq0MFGjaA9sFfQrvM9"]
// - Control Source: Domestic hot water temperature (DMH20Supply)
// - Setpoint: Fixed 134°F year-round (no OAR)
//
// CONTROL STRATEGY:
// 1. Supply Water Temperature Control - Uses actual supply water temperature
// 2. Comfort Boilers: Outdoor Air Reset (OAR) - Automatically adjusts setpoints based on outdoor temp
// 3. Domestic Boilers: Fixed 134°F setpoint year-round
// 4. Integrated Lead-Lag Management - Local Huntington-only lead-lag coordination
// 5. Automatic Failover - Promotes lag boiler if lead boiler fails
// 6. Scheduled Rotation - Weekly changeover between boilers for even wear
// 7. Safety Monitoring - Comprehensive protection and fault detection
//
// OAR SETPOINTS (Comfort Boilers Only):
// - When Outdoor Temp = 30°F → Supply Setpoint = 155°F (Max Heat)
// - When Outdoor Temp = 75°F → Supply Setpoint = 80°F (Min Heat)
// - Temperatures between 30°F-75°F are calculated proportionally
// - Designed for Huntington facility heating loads and building characteristics
//
// DOMESTIC BOILER SETPOINTS:
// - Fixed 134°F year-round regardless of outdoor temperature
// - No OAR calculation - maintains constant temperature for domestic hot water
//
// LEAD-LAG OPERATION (Huntington Internal Only):
// - Lead boiler operates and handles heating load
// - Lag boiler remains in standby mode (unitEnable=false, firing=0)
// - Automatic failover if lead boiler fails (supply temp >170°F, freezestat, fault status)
// - Weekly rotation between boilers (configurable interval)
// - Health monitoring every 30 seconds, rotation check every 5 minutes
//
// FAILOVER CONDITIONS:
// - Supply temperature exceeds 170°F (emergency shutoff condition)
// - Freezestat condition detected
// - Boiler status indicates fault or error
// - Lead boiler not responding to heating demand
//
// SUPPLY TEMPERATURE SOURCES:
// Comfort Boilers:
// - Primary: H20Supply, H20Supply
// - Secondary: H20 Supply, H20_Supply, Supply
// - Fallbacks: supplyTemperature, SupplyTemp, supplyTemp, SupplyTemperature
// - Additional: waterSupplyTemp, WaterSupplyTemp, boilerSupplyTemp
// - Default: 140°F if no temperature reading available
//
// Domestic Boilers:
// - Primary: DMH20Supply, DMH2OSupply
// - Secondary: DMH20_Supply, DomesticSupply
// - Fallbacks: domesticSupplyTemp, domesticTemp
// - Default: 120°F if no temperature reading available
//
// SAFETY FEATURES:
// - Emergency shutoff at 170°F supply temperature
// - Freezestat protection
// - Automatic failover to healthy boiler
// - Lag boiler monitoring and promotion
// - Comprehensive error handling and logging
//
// ROTATION SCHEDULE:
// - Default: Weekly rotation (7 days)
// - Configurable via HUNTINGTON_EQUIPMENT_GROUPS configuration
// - Automatic tracking of last changeover time
// - Prevents excessive switching during normal operation
//
// DATA STORAGE:
// - Returns commands as objects to the factory for high-speed database writes
// - No direct InfluxDB operations - all writes handled by factory for performance
// - Lead-lag events logged through factory for monitoring and trending
// - State storage maintains lead-lag coordination and timing sequences
//
// TECHNICIAN NOTES:
// - Only one Huntington boiler should be firing at a time under normal conditions
// - Comfort boilers use OAR (80°F-155°F based on outdoor temp)
// - Domestic boilers maintain fixed 134°F setpoint year-round
// - Check supply water temperature sensor if lead-lag switching seems erratic
// - Verify outdoor temperature sensor for proper OAR operation (comfort boilers only)
// - Monitor lead-lag events in ControlCommands database for failover history
// - Weekly rotation is normal - prevents single boiler from excessive wear
// - Emergency shutoff at 170°F is safety feature - check for overheating issues
// - Lag boiler in standby shows unitEnable=false but remains ready for failover
// - State storage tracks timing to prevent rapid switching during normal operation
// - Use Node-RED dashboard to monitor Huntington boiler sequencing and temperatures
// - Check Huntington lead-lag events for failover frequency and rotation timing
//
// ===============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.boilerControl = boilerControl;
const location_logger_1 = require("../../../logging/location-logger");
const lead_lag_helpers_1 = require("./lead-lag-helpers");

// Lead-lag group mappings for Huntington
const HUNTINGTON_BOILER_GROUPS = {
    "HuntingtonHeritageComfortBoilers": ["ZLYR6YveSmCEMqtBSy3e", "XbvDB5Jvh8M4FSBpMDAp"],
    "HuntingtonHeritageDomesticBoilers": ["NJuMiYl44QNZ8S4AdLsB", "mpjq0MFGjaA9sFfQrvM9"]
};

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
 * Determine boiler type based on equipment ID
 */
function getBoilerType(equipmentId) {
    // Check comfort boilers
    if (HUNTINGTON_BOILER_GROUPS.HuntingtonHeritageComfortBoilers.includes(equipmentId)) {
        return "comfort";
    }
    // Check domestic boilers
    if (HUNTINGTON_BOILER_GROUPS.HuntingtonHeritageDomesticBoilers.includes(equipmentId)) {
        return "domestic";
    }
    // Fallback based on equipment type naming
    if (equipmentId.toLowerCase().includes("domestic")) {
        return "domestic";
    }
    return "comfort"; // Default to comfort boiler
}

/**
 * Get supply temperature based on boiler type
 */
function getSupplyTemperature(equipmentId, metrics, currentTempArgument) {
    const boilerType = getBoilerType(equipmentId);

    // Use provided temperature argument if available
    if (currentTempArgument !== undefined && !isNaN(currentTempArgument)) {
        return currentTempArgument;
    }

    if (boilerType === "domestic") {
        // Domestic boilers use DMH20Supply sources
        return parseSafeNumber(
            metrics.DMH20Supply,
            parseSafeNumber(metrics.DMH2OSupply,
            parseSafeNumber(metrics.DMH20_Supply,
            parseSafeNumber(metrics.DomesticSupply,
            parseSafeNumber(metrics.domesticSupplyTemp,
            parseSafeNumber(metrics.domesticTemp, 120)))))
        );
    } else {
        // Comfort boilers use H20Supply sources
        return parseSafeNumber(
            metrics.H20Supply,
            parseSafeNumber(metrics.H20_Supply,
            parseSafeNumber(metrics["H20 Supply"],
            parseSafeNumber(metrics.H20_Supply,
            parseSafeNumber(metrics.Supply,
            parseSafeNumber(metrics.supplyTemperature,
            parseSafeNumber(metrics.SupplyTemp,
            parseSafeNumber(metrics.supplyTemp,
            parseSafeNumber(metrics.SupplyTemperature,
            parseSafeNumber(metrics.waterSupplyTemp,
            parseSafeNumber(metrics.WaterSupplyTemp,
            parseSafeNumber(metrics.boilerSupplyTemp, 140))))))))))))
    }
}

async function boilerControl(metricsInput, settingsInput, currentTempArgument, stateStorageInput) {
    const equipmentId = settingsInput.equipmentId || "unknown";
    const locationId = settingsInput.locationId || "4"; // Huntington location ID
    const currentMetrics = metricsInput;
    const currentSettings = settingsInput;

    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "boiler", "Starting Huntington boiler control with integrated lead-lag logic");

    try {
        // Initialize state storage if needed
        if (!stateStorageInput) {
            stateStorageInput = {};
        }

        // STEP 1: Determine boiler type and get appropriate supply temperature
        const boilerType = getBoilerType(equipmentId);
        const currentTemp = getSupplyTemperature(equipmentId, currentMetrics, currentTempArgument);

        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "boiler",
            `Boiler type: ${boilerType}, Using supply temperature: ${currentTemp}°F`);

        // STEP 2: Get outdoor temperature (needed for comfort boilers only)
        const outdoorTemp = parseSafeNumber(
            currentMetrics.Outdoor_Air,
            parseSafeNumber(currentMetrics.outdoorTemperature,
            parseSafeNumber(currentMetrics.outdoorTemp,
            parseSafeNumber(currentMetrics.Outdoor,
            parseSafeNumber(currentMetrics.outdoor,
            parseSafeNumber(currentMetrics.OutdoorTemp,
            parseSafeNumber(currentMetrics.OAT,
            parseSafeNumber(currentMetrics.oat, 50)))))))
        );

        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "boiler", `Outdoor temperature: ${outdoorTemp}°F`);

        // STEP 3: Calculate setpoint based on boiler type
        let setpoint;

        if (boilerType === "domestic") {
            // Domestic boilers: Fixed 134°F year-round
            setpoint = 134;
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "boiler",
                `Domestic boiler: Fixed setpoint ${setpoint}°F (no OAR)`);
        } else {
            // Comfort boilers: Use Huntington-specific OAR curve
            const minOAT = 30;
            const maxOAT = 75;
            const maxSupply = 155;
            const minSupply = 80;

            if (outdoorTemp <= minOAT) {
                setpoint = maxSupply;
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "boiler",
                    `Huntington OAR: OAT ${outdoorTemp}°F <= ${minOAT}°F, using max setpoint: ${setpoint}°F`);
            } else if (outdoorTemp >= maxOAT) {
                setpoint = minSupply;
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "boiler",
                    `Huntington OAR: OAT ${outdoorTemp}°F >= ${maxOAT}°F, using min setpoint: ${setpoint}°F`);
            } else {
                // Linear interpolation for values between min and max
                const ratio = (outdoorTemp - minOAT) / (maxOAT - minOAT);
                setpoint = maxSupply - ratio * (maxSupply - minSupply);
                setpoint = parseFloat(setpoint.toFixed(1));
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "boiler",
                    `Huntington OAR: Calculated setpoint: ${setpoint}°F (ratio: ${ratio.toFixed(2)})`);
            }
        }

        // STEP 4: Get Huntington lead-lag status (integrated local decision making)
        const leadLagStatus = await (0, lead_lag_helpers_1.getHuntingtonLeadLagStatus)(equipmentId, currentMetrics, stateStorageInput);

        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "boiler",
            `Huntington Lead-Lag Status: ${leadLagStatus.isLead ? "LEAD" : "LAG"}, ` +
            `Should Run: ${leadLagStatus.shouldRun}, Reason: ${leadLagStatus.reason}`);

        // STEP 5: Safety checks (always apply regardless of lead-lag status)
        let safetyShutoff = false;
        let safetyReason = "";

        // Emergency shutoff if supply temperature too high
        if (currentTemp > 170) {
            safetyShutoff = true;
            safetyReason = `Emergency shutoff: Supply temperature ${currentTemp}°F exceeds safe limit (170°F)`;
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "boiler", `SAFETY: ${safetyReason}`);
        }

        // Check for freezestat condition
        const freezestat = currentMetrics.Freezestat || currentMetrics.freezestat || false;
        if (freezestat === true || freezestat === "true" || freezestat === 1) {
            safetyShutoff = true;
            safetyReason = `Freezestat condition detected`;
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "boiler", `SAFETY: ${safetyReason}`);
        }

        // STEP 6: Determine boiler operation based on lead-lag status and safety
        let unitEnable = false;
        let firing = false;

        if (safetyShutoff) {
            // Safety override - shut down regardless of lead-lag status
            unitEnable = false;
            firing = false;
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "boiler",
                `SAFETY OVERRIDE: Boiler disabled - ${safetyReason}`);
        } else if (leadLagStatus.shouldRun && leadLagStatus.isLead) {
            // Lead boiler - operate based on temperature demand
            unitEnable = true;
            const temperatureError = setpoint - currentTemp;
            firing = temperatureError > 2.0; // Fire when more than 2°F below setpoint
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "boiler",
                `LEAD BOILER: unitEnable=${unitEnable}, firing=${firing} ` +
                `(temp error: ${temperatureError.toFixed(1)}°F, threshold: 2.0°F)`);
        } else if (!leadLagStatus.shouldRun && !leadLagStatus.isLead) {
            // Lag boiler - remain in standby
            unitEnable = false; // Disabled but ready for failover
            firing = false;
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "boiler",
                `LAG BOILER: In standby mode - unitEnable=${unitEnable}, firing=${firing} ` +
                `(lead boiler: ${leadLagStatus.leadEquipmentId})`);
        } else {
            // Fallback - shouldn't normally reach here
            unitEnable = true;
            firing = false;
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "boiler",
                `FALLBACK MODE: Unexpected lead-lag state - defaulting to enabled but not firing`);
        }

        // STEP 7: Construct result with Huntington-specific data
        const result = {
            unitEnable: unitEnable,
            firing: firing,
            waterTempSetpoint: setpoint,
            temperatureSetpoint: setpoint,
            isLead: leadLagStatus.isLead ? 1 : 0,
            leadLagGroupId: leadLagStatus.groupId,
            leadEquipmentId: leadLagStatus.leadEquipmentId,
            leadLagReason: leadLagStatus.reason,
            outdoorTemp: outdoorTemp,
            supplyTemp: currentTemp,
            safetyShutoff: safetyShutoff,
            safetyReason: safetyReason || "No safety issues",
            boilerType: boilerType
        };

        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "boiler",
            `Final Huntington Boiler Controls: Type=${result.boilerType}, Enable=${result.unitEnable ? "ON" : "OFF"}, ` +
            `Firing=${result.firing ? "ON" : "OFF"}, Setpoint=${result.waterTempSetpoint}°F, ` +
            `Lead-Lag=${result.isLead ? "LEAD" : "LAG"}, Safety=${result.safetyShutoff ? "SHUTDOWN" : "OK"}`);

        // STEP 8: Return result to factory for high-speed database writes
        // NO INFLUXDB OPERATIONS HERE - Factory handles all database writes for performance
        return result;

    } catch (error) {
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "boiler",
            `ERROR in Huntington boiler control: ${error.message}`, error.stack);

        // Return error state without database operations
        const errorResult = {
            unitEnable: false,
            firing: false,
            waterTempSetpoint: 80,
            temperatureSetpoint: 80,
            isLead: 0,
            leadLagGroupId: null,
            leadEquipmentId: null,
            leadLagReason: `Error: ${error.message}`,
            outdoorTemp: 50,
            supplyTemp: 140,
            safetyShutoff: true,
            safetyReason: `Control logic error: ${error.message}`,
            boilerType: getBoilerType(equipmentId)
        };

        return errorResult;
    }
}

// Add worker compatibility exports
exports.default = boilerControl;
exports.processEquipment = boilerControl;
exports.runLogic = boilerControl;
