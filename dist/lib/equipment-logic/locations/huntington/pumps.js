"use strict";
// @ts-nocheck
// lib/equipment-logic/locations/huntington/pumps.ts
//
// ===============================================================================
// HUNTINGTON PUMP CONTROL LOGIC - INTEGRATED LEAD-LAG CIRCULATION PUMPS
// ===============================================================================
//
// OVERVIEW:
// This file controls circulation pumps at the Huntington location with integrated
// lead-lag management, outdoor temperature-based control, and hysteresis to prevent
// short cycling and optimize energy usage. All lead-lag decisions are made locally
// within Huntington equipment only.
//
// EQUIPMENT CONFIGURATION:
// CW Pumps (Chilled Water) - From Firestore screenshot:
// - CW Pump 1: "RJLaOk4UssyePSA1qqT8" (Lead from Firestore)
// - CW Pump 2: "wGvf15Bf6xaLISwhRc7xO" (Lag from Firestore)
//
// HW Pumps (Hot Water) - Estimated IDs:
// - HW Pump 1: "GUI1SxcedsLEhqbD0G2p"
// - HW Pump 2: "oh5Bz2zzIcuT9lFoogvi"
//
// CONTROL STRATEGY:
// 1. Temperature-Based Control - Uses outdoor air temperature for pump enable/disable
// 2. Integrated Lead-Lag Management - Local Huntington-only lead-lag coordination
// 3. Hysteresis Control - Prevents short cycling with separate on/off temperatures
// 4. Automatic Failover - Promotes lag pump if lead pump fails
// 5. Performance Monitoring - Tracks amp draw and status for fault detection
// 6. Runtime Tracking - Monitors operational hours for maintenance scheduling
//
// TEMPERATURE SETPOINTS (Huntington Specific):
// CW (Chilled Water) Pumps:
// - Turn ON when Outdoor Temp ≥ 37°F (cooling season starts)
// - Turn OFF when Outdoor Temp ≤ 36°F (cooling season ends)
// - 1°F hysteresis prevents rapid cycling
//
// HW (Hot Water) Pumps:
// - Turn ON when Outdoor Temp ≤ 74°F (heating season starts)
// - Turn OFF when Outdoor Temp ≥ 75°F (heating season ends)
// - 1°F hysteresis prevents rapid cycling
//
// LEAD-LAG OPERATION (Huntington Internal Only):
// - Lead pump: Always follows temperature-based rules
// - Lag pump: Only runs during extreme conditions or if lead pump fails
// - CW Lag: Activates when outdoor temp ≥ 90°F (extreme cooling load) or lead fails
// - HW Lag: Activates when outdoor temp ≤ 20°F (extreme heating load) or lead fails
// - Automatic failover if lead pump fails (amp reading <0.5A when should be running)
//
// FAILOVER CONDITIONS:
// - Amp draw <0.5A when pump should be running (indicates pump failure)
// - Pump status indicates "fault" or "error"
// - Lead pump not responding to enable commands
//
// PERFORMANCE MONITORING:
// - Amp Draw: Expected >0.5A when running, <0.5A indicates potential failure
// - Status: "running", "off", "fault" - "fault" triggers alarm condition
// - Runtime: Accumulated operational hours for maintenance scheduling
//
// SAFETY FEATURES:
// - Failure Detection: Low amp draw with "enabled" status indicates pump failure
// - Automatic failover to healthy lag pump
// - Manual Override: Settings can force lag pump operation
// - Temperature Fallback: Uses previous state if outdoor temp unavailable
//
// DATA STORAGE:
// - Returns commands as objects to the factory for high-speed database writes
// - No direct InfluxDB operations - all writes handled by factory for performance
// - Lead-lag events logged through factory for monitoring and trending
// - State storage maintains lead-lag coordination and timing sequences
//
// TECHNICIAN NOTES:
// - Only one Huntington pump of each type should run normally (lead-lag operation)
// - Check outdoor temperature sensor if pumps cycle frequently
// - Monitor amp draw - should be >0.5A when pump is enabled and running
// - CW pumps: ON at 37°F, OFF at 36°F with 1°F hysteresis
// - HW pumps: ON at 74°F, OFF at 75°F with 1°F hysteresis
// - Lag pumps activate during extreme weather or lead pump failure
// - Monitor lead-lag events in ControlCommands database for failover history
// - Use Node-RED dashboard to monitor real-time pump performance and sequencing
// - State storage tracks timing to prevent rapid switching during normal operation
//
// ===============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.pumpControl = pumpControl;
const location_logger_1 = require("../../../logging/location-logger");
const lead_lag_helpers_1 = require("./lead-lag-helpers");

// Helper to safely parse numbers
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
 * Get outdoor temperature from metrics with comprehensive fallbacks
 */
function getOutdoorTemperature(metrics) {
    const possibleFields = [
        "outsideTemp", "OutsideTemp", // Primary from Node-RED
        "outdoorTemp", "OutdoorTemp",
        "outdoorTemperature", "OutdoorTemperature",
        "oat", "OAT",
        "outsideAirTemp", "OutsideAirTemp",
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
 * Determine pump type from equipment ID using hardcoded mapping
 */
function getHuntingtonPumpType(equipmentId) {
    // Hardcoded mapping based on Firestore screenshot and known equipment
    switch (equipmentId) {
        case "RJLaOk4UssyePSA1qqT8": // From Firestore - CW Pump 1
        case "wGvf15Bf6xaLISwhRc7xO": // From Firestore - CW Pump 2
            return "CWPump";
        case "GUI1SxcedsLEhqbD0G2p": // HW Pump 1
        case "oh5Bz2zzIcuT9lFoogvi": // HW Pump 2
            return "HWPump";
        default:
            // Fallback logic for unknown equipment IDs
            if (equipmentId.toLowerCase().includes("cw") ||
                equipmentId.toLowerCase().includes("chilled")) {
                return "CWPump";
            }
            else {
                return "HWPump"; // Default to HW pump
            }
    }
}

/**
 * Get pump performance metrics from InfluxDB data
 */
function getHuntingtonPumpMetrics(equipmentId, metrics) {
    let pumpAmps = 0;
    let pumpStatus = "unknown";
    
    // Map equipment IDs to their metric field names
    switch (equipmentId) {
        case "RJLaOk4UssyePSA1qqT8": // CW Pump 1
            pumpAmps = parseSafeNumber(metrics.CWPump1Amps || metrics.CWP1Amps || metrics.cwPump1Amps, 0);
            pumpStatus = metrics.CWPump1Status || metrics.CWP1Status || metrics.cwPump1Status || "unknown";
            break;
        case "wGvf15Bf6xaLISwhRc7xO": // CW Pump 2
            pumpAmps = parseSafeNumber(metrics.CWPump2Amps || metrics.CWP2Amps || metrics.cwPump2Amps, 0);
            pumpStatus = metrics.CWPump2Status || metrics.CWP2Status || metrics.cwPump2Status || "unknown";
            break;
        case "GUI1SxcedsLEhqbD0G2p": // HW Pump 1
            pumpAmps = parseSafeNumber(metrics.HWPump1Amps || metrics.HWP1Amps || metrics.hwPump1Amps, 0);
            pumpStatus = metrics.HWPump1Status || metrics.HWP1Status || metrics.hwPump1Status || "unknown";
            break;
        case "oh5Bz2zzIcuT9lFoogvi": // HW Pump 2
            pumpAmps = parseSafeNumber(metrics.HWPump2Amps || metrics.HWP2Amps || metrics.hwPump2Amps, 0);
            pumpStatus = metrics.HWPump2Status || metrics.HWP2Status || metrics.hwPump2Status || "unknown";
            break;
        default:
            // Generic fallback
            pumpAmps = parseSafeNumber(metrics.pumpAmps || metrics.Amps || metrics.amps, 0);
            pumpStatus = metrics.pumpStatus || metrics.Status || metrics.status || "unknown";
    }
    
    return { amps: pumpAmps, status: pumpStatus };
}

async function pumpControl(metricsInput, settingsInput, currentTempArgument, stateStorageInput) {
    const equipmentId = settingsInput.equipmentId || "unknown";
    const locationId = settingsInput.locationId || "4"; // Huntington location ID
    const currentMetrics = metricsInput;
    const currentSettings = settingsInput;
    
    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", "Starting Huntington pump control with integrated lead-lag logic");
    
    try {
        // Initialize state storage if needed
        if (!stateStorageInput) {
            stateStorageInput = {};
        }
        
        // STEP 1: Determine pump type using hardcoded mapping
        const pumpType = getHuntingtonPumpType(equipmentId);
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `Identified as pump type: ${pumpType}`);
        
        // STEP 2: Get outdoor temperature
        const outdoorTemp = getOutdoorTemperature(currentMetrics);
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `Outdoor temperature: ${outdoorTemp !== null ? outdoorTemp + "°F" : "Not available"}`);
        
        // STEP 3: Get pump performance metrics
        const pumpMetrics = getHuntingtonPumpMetrics(equipmentId, currentMetrics);
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `Pump metrics: Amps=${pumpMetrics.amps}A, Status=${pumpMetrics.status}`);
        
        // STEP 4: Initialize pump-specific state storage
        if (!stateStorageInput.cwOutdoorState) {
            stateStorageInput.cwOutdoorState = { isOn: false };
        }
        if (!stateStorageInput.hwOutdoorState) {
            stateStorageInput.hwOutdoorState = { isOn: false };
        }
        
        const pumpStateKey = `pump_${equipmentId}_state`;
        if (!stateStorageInput[pumpStateKey]) {
            stateStorageInput[pumpStateKey] = {
                lastChecked: Date.now(),
                runtime: 0,
                failureCount: 0
            };
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `Initialized pump-specific state storage for ${equipmentId}`);
        }
        
        // STEP 5: Determine if pump should be enabled based on temperature thresholds
        let temperatureBasedEnable = false;
        
        if (outdoorTemp === null) {
            // Use previous state if no temperature reading
            if (pumpType === "CWPump") {
                temperatureBasedEnable = stateStorageInput.cwOutdoorState.isOn;
            } else {
                temperatureBasedEnable = stateStorageInput.hwOutdoorState.isOn;
            }
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `No outdoor temperature - using previous state: ${temperatureBasedEnable ? "ON" : "OFF"}`);
        } else {
            // Apply temperature thresholds with hysteresis
            if (pumpType === "CWPump") {
                // CW pumps: ON at 37°F, OFF at 36°F
                if (stateStorageInput.cwOutdoorState.isOn) {
                    if (outdoorTemp <= 36) {
                        stateStorageInput.cwOutdoorState.isOn = false;
                        temperatureBasedEnable = false;
                        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `CW Pump: Turning OFF (${outdoorTemp}°F <= 36°F)`);
                    } else {
                        temperatureBasedEnable = true;
                        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `CW Pump: Staying ON (${outdoorTemp}°F > 36°F)`);
                    }
                } else {
                    if (outdoorTemp >= 37) {
                        stateStorageInput.cwOutdoorState.isOn = true;
                        temperatureBasedEnable = true;
                        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `CW Pump: Turning ON (${outdoorTemp}°F >= 37°F)`);
                    } else {
                        temperatureBasedEnable = false;
                        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `CW Pump: Staying OFF (${outdoorTemp}°F < 37°F)`);
                    }
                }
            } else {
                // HW pumps: ON at 74°F, OFF at 75°F
                if (stateStorageInput.hwOutdoorState.isOn) {
                    if (outdoorTemp >= 75) {
                        stateStorageInput.hwOutdoorState.isOn = false;
                        temperatureBasedEnable = false;
                        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `HW Pump: Turning OFF (${outdoorTemp}°F >= 75°F)`);
                    } else {
                        temperatureBasedEnable = true;
                        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `HW Pump: Staying ON (${outdoorTemp}°F < 75°F)`);
                    }
                } else {
                    if (outdoorTemp <= 74) {
                        stateStorageInput.hwOutdoorState.isOn = true;
                        temperatureBasedEnable = true;
                        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `HW Pump: Turning ON (${outdoorTemp}°F <= 74°F)`);
                    } else {
                        temperatureBasedEnable = false;
                        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `HW Pump: Staying OFF (${outdoorTemp}°F > 74°F)`);
                    }
                }
            }
        }
        
        // STEP 6: Get Huntington pump lead-lag status (integrated local decision making)
        const leadLagStatus = await (0, lead_lag_helpers_1.getHuntingtonPumpLeadLagStatus)(equipmentId, pumpType, currentMetrics, stateStorageInput);
        
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `Huntington Pump Lead-Lag Status: ${leadLagStatus.isLead ? "LEAD" : "LAG"}, ` +
            `Should Run: ${leadLagStatus.shouldRun}, Reason: ${leadLagStatus.reason}`);
        
        // STEP 7: Determine final pump operation based on temperature, lead-lag status, and extreme conditions
        let unitEnable = false;
        
        if (!temperatureBasedEnable) {
            // If temperature doesn't call for this pump type, it stays off regardless of lead-lag
            unitEnable = false;
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `Pump OFF: Temperature conditions don't require ${pumpType} operation`);
        } else if (leadLagStatus.isLead && leadLagStatus.shouldRun) {
            // Lead pump runs when temperature conditions are met
            unitEnable = true;
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `LEAD PUMP: Enabled based on temperature conditions`);
        } else if (!leadLagStatus.isLead) {
            // Lag pump logic - only runs in extreme conditions or during failover
            if (currentSettings.overrideLeadLag === true) {
                unitEnable = true;
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `LAG PUMP: Enabled due to manual override`);
            } else if (leadLagStatus.shouldRun) {
                // Lag pump should run due to failover
                unitEnable = true;
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `LAG PUMP: Enabled due to lead pump failure (failover)`);
            } else if (pumpType === "CWPump" && outdoorTemp !== null && outdoorTemp >= 90) {
                // Extreme heat - run both CW pumps
                unitEnable = true;
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `LAG PUMP: Enabled due to extreme heat (${outdoorTemp}°F >= 90°F)`);
            } else if (pumpType === "HWPump" && outdoorTemp !== null && outdoorTemp <= 20) {
                // Extreme cold - run both HW pumps
                unitEnable = true;
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `LAG PUMP: Enabled due to extreme cold (${outdoorTemp}°F <= 20°F)`);
            } else {
                // Normal lag pump operation - stay off
                unitEnable = false;
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `LAG PUMP: Staying OFF (normal lead-lag operation, lead: ${leadLagStatus.leadEquipmentId})`);
            }
        } else {
            // Fallback
            unitEnable = false;
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `FALLBACK: Pump disabled due to unexpected state`);
        }
        
        // STEP 8: Update runtime statistics
        const currentTime = Date.now();
        const timeSinceLastCheck = (currentTime - stateStorageInput[pumpStateKey].lastChecked) / 60000; // minutes
        stateStorageInput[pumpStateKey].lastChecked = currentTime;
        
        if (unitEnable) {
            stateStorageInput[pumpStateKey].runtime = (stateStorageInput[pumpStateKey].runtime || 0) + timeSinceLastCheck;
        }
        
        // STEP 9: Check for pump failure and record in state storage
        if (unitEnable && leadLagStatus.isLead &&
            ((pumpMetrics.amps < 0.5 && pumpMetrics.status !== "off") || pumpMetrics.status === "fault")) {
            stateStorageInput[pumpStateKey].failureCount += 1;
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `WARNING: Pump performance issue detected! Amps=${pumpMetrics.amps}A, ` +
                `Status=${pumpMetrics.status}, Failures=${stateStorageInput[pumpStateKey].failureCount}`);
        }
        
        // STEP 10: Construct result with Huntington-specific data
        const result = {
            unitEnable: unitEnable,
            isLead: leadLagStatus.isLead ? 1 : 0,
            pumpType: pumpType,
            pumpRuntime: stateStorageInput[pumpStateKey].runtime || 0,
            leadLagGroupId: leadLagStatus.groupId,
            leadEquipmentId: leadLagStatus.leadEquipmentId,
            leadLagReason: leadLagStatus.reason,
            outdoorTemperature: outdoorTemp,
            pumpAmps: pumpMetrics.amps,
            pumpStatus: pumpMetrics.status,
            temperatureSource: currentSettings.temperatureSource || "outdoor",
            failureCount: stateStorageInput[pumpStateKey].failureCount || 0
        };
        
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `Final Huntington Pump Controls: Enable=${result.unitEnable ? "ON" : "OFF"}, ` +
            `Type=${result.pumpType}, Lead-Lag=${result.isLead ? "LEAD" : "LAG"}, ` +
            `Amps=${result.pumpAmps}A, Runtime=${result.pumpRuntime.toFixed(1)}min`);
        
        // STEP 11: Return result to factory for high-speed database writes
        // NO INFLUXDB OPERATIONS HERE - Factory handles all database writes for performance
        return result;
        
    } catch (error) {
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "pump", `ERROR in Huntington pump control: ${error.message}`, error.stack);
        
        // Return error state without database operations
        const errorResult = {
            unitEnable: false,
            isLead: 0,
            pumpType: getHuntingtonPumpType(equipmentId),
            pumpRuntime: 0,
            leadLagGroupId: null,
            leadEquipmentId: null,
            leadLagReason: `Error: ${error.message}`,
            outdoorTemperature: null,
            pumpAmps: 0,
            pumpStatus: "error",
            temperatureSource: "outdoor",
            failureCount: 0
        };
        
        return errorResult;
    }
}

// Add worker compatibility exports
exports.default = pumpControl;
exports.processEquipment = pumpControl;
exports.runLogic = pumpControl;
