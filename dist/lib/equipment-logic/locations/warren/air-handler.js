"use strict";
// @ts-nocheck
// lib/equipment-logic/locations/warren/air-handler.ts
//
// Author: Juelz NeuralBms DevOps
// Last Updated: June 4, 2025
//
// ===============================================================================
// WARREN AIR HANDLER CONTROL LOGIC - MULTI-AHU SYSTEM WITH SPECIALIZED CONTROLS
// ===============================================================================
//
// OVERVIEW:
// This file controls multiple air handler units at the Warren location with
// different control strategies, occupancy schedules, and specialized equipment
// configurations for optimal comfort in various facility zones.
//
// EQUIPMENT CONFIGURATION:
// - AHU-1 (2JFzwQkC1XwJhUvm09rE): Supply air temperature control
// - AHU-2 (upkoHEsD5zVaiLFhGfs5): Space temperature control + Electric baseboard heat
// - AHU-4 (3zJm0Nkl1c7EiANkQOay): Space temperature control
// - AHU-7 (BeZOBmanKJ8iYJESMIYr): Space temperature control (Natatorium - always occupied)
//
// CONTROL STRATEGIES:
// 1. Temperature Control Source Selection - Supply vs Space based on AHU type
// 2. Outdoor Air Reset (OAR) - Automatically adjusts setpoints based on outdoor temp
// 3. Occupancy Scheduling - Different schedules for different AHUs
// 4. Electric Heat Staging - AHU-2 has two-stage electric baseboard heating
// 5. Fan Cycling - Unoccupied mode runs fan 15 minutes per hour
// 6. Safety Interlocks - Freeze protection and high limit controls
// 7. HIGH-SPEED FACTORY INTEGRATION - Returns results instantly for batch database writes
//
// OCCUPANCY SCHEDULES:
// - AHU-1, AHU-2, AHU-4: 5:30 AM to 8:30 PM (follow schedule)
// - AHU-7 (Natatorium): Always occupied (no scheduling)
// - Unoccupied Mode: Setpoint +3.5°F, fan cycles 15 min/hour
//
// OAR SETPOINTS (Warren Specific):
// Supply Temperature Control (AHU-1):
// - When Outdoor Temp = 32°F → Supply Setpoint = 76°F (Max Heat)
// - When Outdoor Temp = 74°F → Supply Setpoint = 65-70°F (Min Heat, varies by AHU)
// Space Temperature Control (AHU-2, AHU-4, AHU-7):
// - When Outdoor Temp = 32°F → Space Setpoint = 76°F (Max Heat)
// - When Outdoor Temp = 74°F → Space Setpoint = 71°F (Min Heat)
// - Natatorium (AHU-7): 87°F max, 83°F min (specialized pool area control)
//
// ELECTRIC HEATING (AHU-2 Only):
// - Stage 1: Activates when heating demand > 30% and OAT < 65°F
// - Stage 2: Activates when heating demand > 75% and OAT < 65°F
// - Requires: Occupied mode + Fan running + Outdoor temp < 65°F
// - Hydronic heating automatically reduced when electric heat is active
//
// VALVE CONTROL:
// - Cooling: Direct acting (0V closed, 10V open) - 0-100% range
// - Heating: Reverse acting (10V closed, 0V open) - 0-100% range
//
// DAMPER OPERATION:
// - Opens when outdoor temp > 40°F AND occupied AND no safety trips
// - Closes for freeze protection, unoccupied mode, or safety conditions
//
// SAFETY FEATURES:
// - FreezeStat: 40°F supply/mixed air (opens heating, closes cooling, stops fan)
// - Hi-Limit: 115°F supply air (closes heating, opens cooling)
// - Electric heat safety shutoff on any safety trip
//
// PID TUNING BY AHU:
// - AHU-1: Standard tuning (kp=2.8/1.7, ki=0.14/0.15)
// - AHU-4: Conservative tuning (kp=1.0, ki=0.1) for stable space control
// - AHU-7: Pool-optimized (kp=1.2, ki=0.2) with preheat/reheat control
//
// MONITORING FEATURES:
// - Fan status via current sensors (>0.5A = running)
// - Electric heat stage monitoring with current feedback
// - Temperature source auto-detection with fallbacks
// - Comprehensive space temperature sensor mapping
//
// DATA STORAGE:
// - Returns commands as objects to the factory for high-speed database writes
// - NO DIRECT INFLUXDB OPERATIONS - all writes handled by factory for performance
// - All operations are logged for troubleshooting
// - PID states maintained for smooth control transitions
//
// TECHNICIAN NOTES:
// - Check fan current sensors if fan status seems incorrect (>0.5A threshold)
// - AHU-2 electric heat requires all three conditions: occupied + fan running + OAT < 65°F
// - Natatorium (AHU-7) uses specialized high temperature setpoints for pool area
// - Space temperature sensors have extensive fallback mapping - check all possible fields
// - OA dampers close automatically in unoccupied mode regardless of outdoor temp
// - PID integral terms reset when setpoints change to prevent windup
// - Electric heat stages reduce hydronic heating proportionally (50% stage 1, 75% stage 2)
// - Use Node-RED dashboard to monitor real-time fan currents and heating stages
// - NO DATABASE OPERATIONS - Factory handles all writes for 1-2 second performance
//
// ===============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.airHandlerControl = airHandlerControl;
const pid_controller_1 = require("../../../pid-controller");
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
 * Determine the AHU number from the equipment ID
 */
function getAHUNumber(equipmentId) {
    // Direct mapping of equipment IDs to AHU numbers
    const equipmentMap = {
        "2JFzwQkC1XwJhUvm09rE": 1, // AHU-1
        "upkoHEsD5zVaiLFhGfs5": 2, // AHU-2
        "3zJm0Nkl1c7EiANkQOay": 4, // AHU-4
        "BeZOBmanKJ8iYJESMIYr": 7  // AHU-7 (Natatorium)
    };

    // Check if the equipment ID exists in our map
    if (equipmentMap[equipmentId] !== undefined) {
        return equipmentMap[equipmentId];
    }

    try {
        // Fallback to the original logic if equipment ID is not in our map
        if (equipmentId.includes("AHU-1") || equipmentId.includes("AHU1")) {
            return 1;
        }
        if (equipmentId.includes("AHU-2") || equipmentId.includes("AHU2")) {
            return 2;
        }
        if (equipmentId.includes("AHU-4") || equipmentId.includes("AHU4")) {
            return 4;
        }
        if (equipmentId.includes("AHU-7") || equipmentId.includes("AHU7") ||
            equipmentId.toLowerCase().includes("natatorium")) {
            return 7;
        }

        // Try to extract any number from the ID
        const match = equipmentId.match(/(\d+)/);
        if (match) {
            const num = parseInt(match[0], 10);
            return [1, 2, 4, 7].includes(num) ? num : 1;
        }

        return 1; // Default to AHU-1
    } catch (error) {
        console.error(`Error determining AHU number: ${error}`);
        return 1;
    }
}

async function airHandlerControl(metricsInput, settingsInput, currentTempArgument, stateStorageInput) {
    const equipmentId = settingsInput.equipmentId || "unknown";
    const locationId = settingsInput.locationId || "1";
    const currentMetrics = metricsInput;
    const currentSettings = settingsInput;

    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", "Starting Warren air handler control logic");

    try {
        // Initialize state storage if needed
        if (!stateStorageInput) {
            stateStorageInput = {};
        }

        // Initialize PID states and other storage items
        if (!stateStorageInput.preheatPIDState) stateStorageInput.preheatPIDState = {};
        if (!stateStorageInput.reheatPIDState) stateStorageInput.reheatPIDState = {};
        if (!stateStorageInput.heatingPIDState) stateStorageInput.heatingPIDState = {};
        if (!stateStorageInput.coolingPIDState) stateStorageInput.coolingPIDState = {};

        // Initialize other state variables
        stateStorageInput.lastFanCycleTime = stateStorageInput.lastFanCycleTime || 0;
        stateStorageInput.fanCycleState = stateStorageInput.fanCycleState || false;
        stateStorageInput.stage1HeatState = stateStorageInput.stage1HeatState || false;
        stateStorageInput.stage2HeatState = stateStorageInput.stage2HeatState || false;
        stateStorageInput.stage1HeatTimer = stateStorageInput.stage1HeatTimer || 0;
        stateStorageInput.stage2HeatTimer = stateStorageInput.stage2HeatTimer || 0;

        // STEP 1: Determine which AHU this is
        const ahuNumber = getAHUNumber(equipmentId);
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Identified as AHU-${ahuNumber}`);

        // STEP 2: Select appropriate temperature source based on equipment ID
        const controlSourceMap = {
            "2JFzwQkC1XwJhUvm09rE": "supply", // AHU-1: supply controlled
            "upkoHEsD5zVaiLFhGfs5": "space",  // AHU-2: space controlled
            "3zJm0Nkl1c7EiANkQOay": "space",  // AHU-4: space controlled
            "BeZOBmanKJ8iYJESMIYr": "space"   // AHU-7: space controlled
        };

        let controlSource = controlSourceMap[equipmentId];
        if (!controlSource) {
            controlSource = (ahuNumber === 2 || ahuNumber === 4 || ahuNumber === 7) ? "space" : "supply";
        }

        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Using ${controlSource} control for equipment ID ${equipmentId} (AHU-${ahuNumber})`);

        // STEP 3: Get fan status from amp sensors
        const fanAmps = parseSafeNumber(currentMetrics.FanAmps, parseSafeNumber(currentMetrics.fan_amps, parseSafeNumber(currentMetrics.fanAmps, parseSafeNumber(currentMetrics.fan_current, parseSafeNumber(currentMetrics.fanCurrent, 0)))));
        const fanRunningAmpsThreshold = 0.5;
        const fanActuallyRunning = fanAmps > fanRunningAmpsThreshold;

        // Get AHU-2 specific heating stage information
        let heatingStage1Status = false;
        let heatingStage1Amps = 0;
        let heatingStage2Status = false;
        let heatingStage2Amps = 0;

        if (ahuNumber === 2) {
            heatingStage1Status = currentMetrics["Heating_Stage_1_Status"] ||
                currentMetrics["Heating Stage 1 Status"] || false;
            heatingStage1Amps = parseSafeNumber(currentMetrics["Heating_Stage_1_Amps"], parseSafeNumber(currentMetrics["Heating Stage 1 Amps"], 0));
            heatingStage2Status = currentMetrics["Heating_Stage_2_Status"] ||
                currentMetrics["Heating Stage 2 Status"] || false;
            heatingStage2Amps = parseSafeNumber(currentMetrics["Heating_Stage_2_Amps"], parseSafeNumber(currentMetrics["Heating Stage 2 Amps"], 0));

            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-2 Electric Heat: Stage 1 ${heatingStage1Status ? "ON" : "OFF"} (${heatingStage1Amps.toFixed(1)}A), ` +
                `Stage 2 ${heatingStage2Status ? "ON" : "OFF"} (${heatingStage2Amps.toFixed(1)}A)`);
        }

        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Fan status: ${fanActuallyRunning ? "RUNNING" : "NOT RUNNING"} (${fanAmps.toFixed(2)} Amps)`);

        // STEP 4: Determine current temperature based on control source
        let currentTemp = currentTempArgument;
        if (currentTemp === undefined || isNaN(currentTemp)) {
            if (controlSource === "supply") {
                // For supply-controlled AHUs: Use supply temperature
                currentTemp = parseSafeNumber(currentMetrics.Supply, parseSafeNumber(currentMetrics.supplyTemperature, parseSafeNumber(currentMetrics.SupplyTemp, parseSafeNumber(currentMetrics.supplyTemp, parseSafeNumber(currentMetrics.SupplyTemperature, parseSafeNumber(currentMetrics.SAT, parseSafeNumber(currentMetrics.sat, parseSafeNumber(currentMetrics.SupplyAirTemp, parseSafeNumber(currentMetrics.supplyAirTemp, 55)))))))));
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Using supply air temperature: ${currentTemp}°F (for AHU-${ahuNumber})`);
            } else {
                // For space-controlled AHUs: Use space temperature with extensive fallbacks
                currentTemp = parseSafeNumber(currentMetrics.Space, parseSafeNumber(currentMetrics.spaceTemperature, parseSafeNumber(currentMetrics.SpaceTemp, parseSafeNumber(currentMetrics.spaceTemp, parseSafeNumber(currentMetrics.SpaceTemperature, parseSafeNumber(currentMetrics.roomTemp, parseSafeNumber(currentMetrics.RoomTemp, parseSafeNumber(currentMetrics.roomTemperature, parseSafeNumber(currentMetrics.RoomTemperature, parseSafeNumber(currentMetrics.temperature, parseSafeNumber(currentMetrics.Temperature, parseSafeNumber(currentMetrics.coveTemp, parseSafeNumber(currentMetrics.kitchenTemp, parseSafeNumber(currentMetrics.mailRoomTemp, parseSafeNumber(currentMetrics.chapelTemp, parseSafeNumber(currentMetrics.office1Temp, parseSafeNumber(currentMetrics.office2Temp, parseSafeNumber(currentMetrics.office3Temp, parseSafeNumber(currentMetrics.itRoomTemp, parseSafeNumber(currentMetrics.beautyShopTemp, parseSafeNumber(currentMetrics.natatoriumTemp, parseSafeNumber(currentMetrics.hall1Temp, parseSafeNumber(currentMetrics.hall2Temp, 72)))))))))))))))))))))));
                if (ahuNumber === 2) {
                    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-2 DEBUG: Final currentTemp = ${currentTemp}°F`);
                }
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Using space temperature: ${currentTemp}°F (for AHU-${ahuNumber})`);
            }
        }

        // STEP 5: Get outdoor and other temperatures
        const outdoorTemp = parseSafeNumber(currentMetrics.Outdoor_Air, parseSafeNumber(currentMetrics.outdoorTemperature, parseSafeNumber(currentMetrics.outdoorTemp, parseSafeNumber(currentMetrics.Outdoor, parseSafeNumber(currentMetrics.outdoor, parseSafeNumber(currentMetrics.OutdoorTemp, parseSafeNumber(currentMetrics.OAT, parseSafeNumber(currentMetrics.oat, 65))))))));
        const mixedAirTemp = parseSafeNumber(currentMetrics.Mixed_Air, parseSafeNumber(currentMetrics.MixedAir, parseSafeNumber(currentMetrics.mixedAir, parseSafeNumber(currentMetrics.MAT, parseSafeNumber(currentMetrics.mat, parseSafeNumber(currentMetrics.MixedAirTemp, parseSafeNumber(currentMetrics.mixedAirTemp, 55)))))));
        const supplyTemp = parseSafeNumber(currentMetrics.Supply, parseSafeNumber(currentMetrics.supplyTemperature, parseSafeNumber(currentMetrics.SupplyTemp, parseSafeNumber(currentMetrics.supplyTemp, parseSafeNumber(currentMetrics.SupplyTemperature, parseSafeNumber(currentMetrics.SAT, parseSafeNumber(currentMetrics.sat, parseSafeNumber(currentMetrics.SupplyAirTemp, parseSafeNumber(currentMetrics.supplyAirTemp, 55)))))))));

        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Temperatures: Current=${currentTemp}°F, Outdoor=${outdoorTemp}°F, Mixed=${mixedAirTemp}°F, Supply=${supplyTemp}°F`);

        // STEP 6: Determine occupancy state
        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();
        const currentTimeMinutes = hour * 60 + minute;
        const occupiedStartMinutes = 5 * 60 + 30; // 5:30 AM
        const occupiedEndMinutes = 20 * 60 + 30; // 8:30 PM

        const followsSchedule = ahuNumber === 1 || ahuNumber === 2 || ahuNumber === 4;
        let isOccupied = true;

        if (followsSchedule) {
            isOccupied = currentTimeMinutes >= occupiedStartMinutes &&
                currentTimeMinutes < occupiedEndMinutes;
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Occupancy: ${isOccupied ? "OCCUPIED" : "UNOCCUPIED"} (Current time: ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')})`);
        } else {
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", "Occupancy: Always OCCUPIED (This AHU does not follow occupancy schedule)");
        }

        // STEP 7: Handle fan cycling in unoccupied mode
        let fanEnabled = true;
        let fanSpeed = "medium";

        if (!isOccupied && followsSchedule) {
            const currentTimeMs = now.getTime();
            const hourInMs = 60 * 60 * 1000;
            const cycleTimeMs = currentTimeMs % hourInMs;
            const fifteenMinutesMs = 15 * 60 * 1000;

            fanEnabled = cycleTimeMs < fifteenMinutesMs;
            const remainingTime = fanEnabled ? fifteenMinutesMs - cycleTimeMs : hourInMs - cycleTimeMs;
            const remainingMinutes = Math.floor(remainingTime / (60 * 1000));

            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Unoccupied fan cycling: Fan ${fanEnabled ? "ON" : "OFF"} (${remainingMinutes} minutes until next change)`);

            stateStorageInput.fanCycleState = fanEnabled;
            stateStorageInput.lastFanCycleTime = currentTimeMs;
        }

        // STEP 8: Calculate setpoint using OAR
        let setpoint = parseSafeNumber(currentSettings.temperatureSetpoint, 72);

        // Check for user-modified setpoint
        const userSetpoint = parseSafeNumber(currentMetrics.temperatureSetpoint, parseSafeNumber(currentMetrics.temperature_setpoint, parseSafeNumber(currentMetrics.control_value, parseSafeNumber(currentMetrics.command, undefined))));

        if (userSetpoint !== undefined) {
            setpoint = userSetpoint;
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Using user-modified setpoint: ${setpoint}°F (overriding OAR setpoint)`);
        } else {
            // OAR calculation
            const minOAT = 32;
            const maxOAT = 74;
            let maxSetpoint, minSetpoint;

            if (controlSource === "supply") {
                maxSetpoint = 76;
                minSetpoint = 65;
                if (ahuNumber === 2) {
                    minSetpoint = 70;
                }
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `OAR parameters for supply control: Max=${maxSetpoint}°F at ${minOAT}°F OAT, Min=${minSetpoint}°F at ${maxOAT}°F OAT`);
            } else {
                maxSetpoint = 76;
                minSetpoint = 71;
                if (ahuNumber === 7) {
                    maxSetpoint = 87;
                    minSetpoint = 83;
                }
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `OAR parameters for space control: Max=${maxSetpoint}°F at ${minOAT}°F OAT, Min=${minSetpoint}°F at ${maxOAT}°F OAT`);
            }

            if (outdoorTemp <= minOAT) {
                setpoint = maxSetpoint;
            } else if (outdoorTemp >= maxOAT) {
                setpoint = minSetpoint;
            } else {
                const ratio = (outdoorTemp - minOAT) / (maxOAT - minOAT);
                setpoint = maxSetpoint - ratio * (maxSetpoint - minSetpoint);
                setpoint = parseFloat(setpoint.toFixed(1));
            }

            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `OAR: Calculated ${controlSource} setpoint: ${setpoint}°F`);
        }

        // Apply unoccupied offset
        if (!isOccupied && followsSchedule) {
            const unoccupiedOffset = 3.5;
            const originalSetpoint = setpoint;
            setpoint += unoccupiedOffset;
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Applied unoccupied offset: ${originalSetpoint}°F + ${unoccupiedOffset}°F = ${setpoint}°F`);
        }

        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Current ${controlSource} temperature: ${currentTemp}°F (Setpoint: ${setpoint}°F, Error: ${(setpoint - currentTemp).toFixed(1)}°F)`);

        // STEP 9: Safety checks
        let safetyTripped = false;
        let safetyReason = "";

        const freezestatTripped = supplyTemp < 40 || mixedAirTemp < 40;
        const highLimitTripped = supplyTemp > 115;

        if (freezestatTripped) {
            safetyTripped = true;
            safetyReason = "freezestat";
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `SAFETY: FREEZESTAT TRIPPED! Supply: ${supplyTemp}°F, Mixed: ${mixedAirTemp}°F`);
        } else if (highLimitTripped) {
            safetyTripped = true;
            safetyReason = "highlimit";
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `SAFETY: HIGH LIMIT TRIPPED! Supply: ${supplyTemp}°F`);
        }

        // STEP 10: Handle safety conditions
        if (safetyTripped) {
            const safetyResult = {
                heatingValvePosition: safetyReason === "freezestat" ? 100 : 0,
                coolingValvePosition: safetyReason === "highlimit" ? 100 : 0,
                fanEnabled: safetyReason !== "freezestat",
                fanSpeed: safetyReason === "freezestat" ? "off" : "medium",
                outdoorDamperPosition: 0,
                supplyAirTempSetpoint: setpoint,
                temperatureSetpoint: setpoint,
                unitEnable: true,
                safetyTripped: safetyReason,
                isOccupied: isOccupied,
                heatingStage1Command: false,
                heatingStage2Command: false
            };

            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `${safetyReason.toUpperCase()} response: HW valve ${safetyResult.heatingValvePosition}%, ` +
                `CW valve ${safetyResult.coolingValvePosition}%, Fan ${safetyResult.fanEnabled ? "ON" : "OFF"}`);

            // FIXED: NO DATABASE OPERATIONS - Return result to factory
            return safetyResult;
        }

        // STEP 11: Determine outdoor damper position
        let outdoorDamperPosition = 0;
        if (outdoorTemp > 40 && !safetyTripped && isOccupied) {
            outdoorDamperPosition = 100;
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `OA damper: OPEN (OAT ${outdoorTemp}°F > 40°F and safeties OK)`);
        } else {
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `OA damper: CLOSED (OAT ${outdoorTemp}°F <= 40°F or unoccupied or safety)`);
        }

        // STEP 12: PID control setup
        const pidSettings = {
            cooling: {
                kp: ahuNumber === 4 ? 1.0 : 1.7,
                ki: ahuNumber === 4 ? 0.1 : 0.15,
                kd: 0.01,
                enabled: true,
                outputMin: 0,
                outputMax: 100,
                reverseActing: false,
                maxIntegral: 15
            },
            heating: {
                kp: ahuNumber === 4 ? 1.0 : (ahuNumber === 7 ? 1.2 : 2.8),
                ki: ahuNumber === 4 ? 0.1 : (ahuNumber === 7 ? 0.2 : 0.14),
                kd: ahuNumber === 7 ? 0.02 : 0.02,
                enabled: true,
                outputMin: 0,
                outputMax: 100,
                reverseActing: true,
                maxIntegral: 15
            }
        };

        // STEP 13: Handle AHU-7 (Natatorium) special case
        if (ahuNumber === 7) {
            // Initialize preheat/reheat PID states
            if (!stateStorageInput.preheatPIDState) {
                stateStorageInput.preheatPIDState = { integral: 0, previousError: 0, lastOutput: 0 };
            }
            if (!stateStorageInput.reheatPIDState) {
                stateStorageInput.reheatPIDState = { integral: 0, previousError: 0, lastOutput: 0 };
            }

            const preheatPID = (0, pid_controller_1.pidControllerImproved)({
                input: currentTemp,
                setpoint: setpoint,
                pidParams: {
                    kp: 1.2, ki: 0.2, kd: 0.02, enabled: true,
                    outputMin: 0, outputMax: 100, reverseActing: true, maxIntegral: 15
                },
                dt: 1,
                controllerType: "heating",
                pidState: stateStorageInput.preheatPIDState
            });

            const reheatPID = (0, pid_controller_1.pidControllerImproved)({
                input: currentTemp,
                setpoint: setpoint,
                pidParams: {
                    kp: 0.8, ki: 0.15, kd: 0.01, enabled: true,
                    outputMin: 0, outputMax: 100, reverseActing: true, maxIntegral: 15
                },
                dt: 1,
                controllerType: "heating",
                pidState: stateStorageInput.reheatPIDState
            });

            const maxHeatingOutput = Math.max(preheatPID.output, reheatPID.output);

            const ahu7Result = {
                heatingValvePosition: maxHeatingOutput,
                coolingValvePosition: 0,
                fanEnabled: true,
                fanSpeed: "medium",
                outdoorDamperPosition: outdoorDamperPosition,
                supplyAirTempSetpoint: setpoint,
                temperatureSetpoint: setpoint,
                unitEnable: true,
                isOccupied: isOccupied,
                controlSource: controlSource,
                temperatureSource: controlSource
            };

            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-7: Preheat=${preheatPID.output.toFixed(1)}%, Reheat=${reheatPID.output.toFixed(1)}%, ` +
                `Final heating=${maxHeatingOutput.toFixed(1)}%`);

            // FIXED: NO DATABASE OPERATIONS - Return result to factory
            return ahu7Result;
        }

        // STEP 14: Handle AHU-2 with electric baseboard heaters
        if (ahuNumber === 2) {
            // Initialize PID states for AHU-2
            if (!stateStorageInput.heatingPIDState) {
                stateStorageInput.heatingPIDState = { integral: 0, previousError: 0, lastOutput: 0 };
            }
            if (!stateStorageInput.coolingPIDState) {
                stateStorageInput.coolingPIDState = { integral: 0, previousError: 0, lastOutput: 0 };
            }

            const heatingPID = (0, pid_controller_1.pidControllerImproved)({
                input: currentTemp,
                setpoint: setpoint,
                pidParams: pidSettings.heating,
                dt: 1,
                controllerType: "heating",
                pidState: stateStorageInput.heatingPIDState
            });

            const coolingPID = (0, pid_controller_1.pidControllerImproved)({
                input: currentTemp,
                setpoint: setpoint,
                pidParams: pidSettings.cooling,
                dt: 1,
                controllerType: "cooling",
                pidState: stateStorageInput.coolingPIDState
            });

            let heatingValvePosition = heatingPID.output;
            let coolingValvePosition = coolingPID.output;

            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-2 PID: Space temp=${currentTemp}°F, Setpoint=${setpoint}°F, ` +
                `Error=${(setpoint - currentTemp).toFixed(1)}°F, ` +
                `Heating output=${heatingValvePosition.toFixed(1)}%, Cooling output=${coolingValvePosition.toFixed(1)}%`);

            // Electric heat staging
            const shouldEnableElectricHeat = outdoorTemp < 65 && isOccupied && fanActuallyRunning;
            let heatingStage1Command = false;
            let heatingStage2Command = false;

            if (shouldEnableElectricHeat) {
                heatingStage1Command = heatingValvePosition > 30;
                heatingStage2Command = heatingValvePosition > 75;

                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-2 Electric Heat: Stage 1 ${heatingStage1Command ? "ON" : "OFF"}, ` +
                    `Stage 2 ${heatingStage2Command ? "ON" : "OFF"} (Heating demand: ${heatingValvePosition.toFixed(1)}%)`);

                // Reduce hydronic heating when electric heat is active
                if (heatingStage1Command || heatingStage2Command) {
                    const reductionFactor = heatingStage2Command ? 0.75 : 0.5;
                    const originalHeatingValve = heatingValvePosition;
                    heatingValvePosition = heatingValvePosition * (1 - reductionFactor);
                    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Reducing hydronic heating: ${originalHeatingValve.toFixed(1)}% → ${heatingValvePosition.toFixed(1)}%`);
                }
            } else {
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-2 Electric Heat: DISABLED (OAT: ${outdoorTemp.toFixed(1)}°F, Occupied: ${isOccupied}, Fan running: ${fanActuallyRunning})`);
            }

            const ahu2Result = {
                heatingValvePosition: heatingValvePosition,
                coolingValvePosition: coolingValvePosition,
                fanEnabled: fanEnabled,
                fanSpeed: fanEnabled ? "medium" : "off",
                outdoorDamperPosition: outdoorDamperPosition,
                supplyAirTempSetpoint: setpoint,
                temperatureSetpoint: setpoint,
                unitEnable: true,
                isOccupied: isOccupied,
                controlSource: controlSource,
                temperatureSource: controlSource,
                heatingStage1Command: heatingStage1Command,
                heatingStage2Command: heatingStage2Command,
                actualFanRunning: fanActuallyRunning
            };

            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Final AHU-2 controls: Fan=${ahu2Result.fanEnabled ? "ON" : "OFF"} (${fanAmps.toFixed(2)}A), ` +
                `Heating=${ahu2Result.heatingValvePosition.toFixed(1)}%, Cooling=${ahu2Result.coolingValvePosition.toFixed(1)}%, ` +
                `Elec heat 1=${heatingStage1Command ? "ON" : "OFF"}, Elec heat 2=${heatingStage2Command ? "ON" : "OFF"}, ` +
                `Damper=${ahu2Result.outdoorDamperPosition}%`);

            // FIXED: NO DATABASE OPERATIONS - Return result to factory
            return ahu2Result;
        }

        // STEP 15: Handle unoccupied mode with fan off
        if (!fanEnabled) {
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", "Fan off in unoccupied mode, implementing direct control logic");

            const unoccupiedResult = {
                heatingValvePosition: 0,
                coolingValvePosition: 0,
                fanEnabled: false,
                fanSpeed: "off",
                outdoorDamperPosition: 0,
                supplyAirTempSetpoint: setpoint,
                temperatureSetpoint: setpoint,
                unitEnable: true,
                isOccupied: isOccupied,
                controlSource: controlSource,
                temperatureSource: controlSource,
                actualFanRunning: fanActuallyRunning
            };

            // FIXED: NO DATABASE OPERATIONS - Return result to factory
            return unoccupiedResult;
        }

        // STEP 16: Handle AHU-1 and AHU-4 with direct PID control implementation
        // Initialize PID states
        if (!stateStorageInput.heatingPIDState) {
            stateStorageInput.heatingPIDState = { integral: 0, previousError: 0, lastOutput: 0 };
        }
        if (!stateStorageInput.coolingPIDState) {
            stateStorageInput.coolingPIDState = { integral: 0, previousError: 0, lastOutput: 0 };
        }

        const heatingPID = (0, pid_controller_1.pidControllerImproved)({
            input: currentTemp,
            setpoint: setpoint,
            pidParams: pidSettings.heating,
            dt: 1,
            controllerType: "heating",
            pidState: stateStorageInput.heatingPIDState
        });

        const coolingPID = (0, pid_controller_1.pidControllerImproved)({
            input: currentTemp,
            setpoint: setpoint,
            pidParams: pidSettings.cooling,
            dt: 1,
            controllerType: "cooling",
            pidState: stateStorageInput.coolingPIDState
        });

        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-${ahuNumber} PID: ${controlSource} temp=${currentTemp}°F, Setpoint=${setpoint}°F, ` +
            `Error=${(setpoint - currentTemp).toFixed(1)}°F, ` +
            `Heating output=${heatingPID.output.toFixed(1)}%, Cooling output=${coolingPID.output.toFixed(1)}%`);

        const result = {
            heatingValvePosition: heatingPID.output,
            coolingValvePosition: coolingPID.output,
            fanEnabled: fanEnabled,
            fanSpeed: fanEnabled ? fanSpeed : "off",
            outdoorDamperPosition: outdoorDamperPosition,
            supplyAirTempSetpoint: setpoint,
            temperatureSetpoint: setpoint,
            unitEnable: true,
            isOccupied: isOccupied,
            controlSource: controlSource,
            temperatureSource: controlSource,
            actualFanRunning: fanActuallyRunning
        };

        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Final AHU-${ahuNumber} controls: Fan=${result.fanEnabled ? "ON" : "OFF"} (${fanAmps.toFixed(2)}A), ` +
            `Heating=${result.heatingValvePosition.toFixed(1)}%, Cooling=${result.coolingValvePosition.toFixed(1)}%, ` +
            `Damper=${result.outdoorDamperPosition}%`);

        // STEP 17: Return result to factory for high-speed database writes
        // NO INFLUXDB OPERATIONS HERE - Factory handles all database writes for performance
        return result;

    } catch (error) {
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `ERROR in Warren air handler control: ${error.message}`, error.stack);

        const errorResult = {
            heatingValvePosition: 0,
            coolingValvePosition: 0,
            fanEnabled: false,
            fanSpeed: "off",
            outdoorDamperPosition: 0,
            supplyAirTempSetpoint: 72,
            temperatureSetpoint: 72,
            unitEnable: false,
            isOccupied: false
        };

        // FIXED: NO DATABASE OPERATIONS - Return error state to factory
        return errorResult;
    }
}

// Add worker compatibility exports (match Huntington)
exports.default = airHandlerControl;
exports.processEquipment = airHandlerControl;
exports.runLogic = airHandlerControl;
