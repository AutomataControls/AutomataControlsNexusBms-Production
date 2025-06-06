"use strict";
// @ts-nocheck
// lib/equipment-logic/locations/warren/fan-coil.ts
//
// Author: Juelz NeuralBms DevOps
// Last Updated: June 4, 2025
//
// ===============================================================================
// WARREN FAN COIL CONTROL LOGIC - SPACE TEMPERATURE CONTROL WITH OAR
// ===============================================================================
//
// OVERVIEW:
// This file controls fan coil units at the Warren location using Space Temperature
// as the primary control source with Outdoor Air Reset (OAR) and specialized
// damper control for optimal comfort in various facility zones.
//
// CONTROL STRATEGY:
// 1. Space Temperature Control - Uses room/zone temperature sensors for control
// 2. Outdoor Air Reset (OAR) - Automatically adjusts setpoint based on outdoor temp
// 3. Temperature-Based Damper Control - Opens/closes based on outdoor conditions
// 4. User Override System - UI settings take priority over OAR calculations
// 5. Zone-Specific Sensor Mapping - Supports multiple room temperature sensors
// 6. HIGH-SPEED FACTORY INTEGRATION - Returns results instantly for batch database writes
//
// OAR SETPOINTS (Warren Specific):
// - When Outdoor Temp = 32°F → Space Setpoint = 75°F (Max Heat)
// - When Outdoor Temp = 73°F → Space Setpoint = 72°F (Min Heat)
// - Temperatures between 32°F-73°F are calculated proportionally
// - User-set temperatures from UI override OAR calculations
//
// DAMPER OPERATION:
// - Opens when outdoor temp > 40°F AND outdoor temp ≤ 80°F
// - Closes when outdoor temp ≤ 40°F (too cold) or > 80°F (too hot)
// - Provides free cooling/ventilation in moderate outdoor conditions
//
// VALVE CONTROL:
// - Cooling: Direct acting (0V closed, 10V open) - 0-100% range
// - Heating: Reverse acting (10V closed, 0V open) - 0-100% range
// - Warren-specific PID tuning for stable control
//
// TEMPERATURE SENSOR MAPPING:
// Primary sensors: Space, spaceTemperature, SpaceTemp, roomTemp
// Warren-specific zones: coveTemp, kitchenTemp, mailRoomTemp, chapelTemp,
// office1Temp, office2Temp, office3Temp, itRoomTemp, beautyShopTemp,
// natatoriumTemp, hall1Temp, hall2Temp
// Fallback: 72°F if no sensor data available
//
// PID TUNING (Warren Optimized):
// Cooling: kp=0.6, ki=0.05, kd=0.01 (conservative for stability)
// Heating: kp=0.7, ki=0.04, kd=0.02 (slightly more aggressive)
// Anti-windup: maxIntegral=15 for both heating and cooling
//
// SAFETY FEATURES:
// - FreezeStat and Hi-Limit protection
// - Valve position validation and clamping
// - Fan safety interlocks
//
// DATA STORAGE:
// - Returns commands as objects to the factory for high-speed database writes
// - NO DIRECT INFLUXDB OPERATIONS - all writes handled by factory for performance
// - All operations are logged for troubleshooting
// - PID states maintained for smooth control transitions
//
// TECHNICIAN NOTES:
// - Check space temperature sensor mapping if control seems erratic
// - Verify outdoor temperature sensor for proper OAR and damper operation
// - OA dampers have dual temperature limits (40°F min, 80°F max)
// - User setpoints from UI always override OAR calculations
// - Zone temperature sensors provide extensive fallback options
// - PID tuning is conservative for Warren's stable building characteristics
// - Damper operation is binary (0% or 100%) not modulating
// - Use Node-RED dashboard to monitor real-time sensor readings
// - NO DATABASE OPERATIONS - Factory handles all writes for 1-2 second performance
//
// ===============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.fanCoilControl = fanCoilControl;
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

async function fanCoilControl(metricsInput, settingsInput, currentTempArgument, stateStorageInput) {
    const equipmentId = settingsInput.equipmentId || "unknown";
    const locationId = settingsInput.locationId || "1";
    const currentMetrics = metricsInput;
    const currentSettings = settingsInput;

    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil", "Starting Warren fan coil control logic");

    try {
        // Initialize state storage if needed
        if (!stateStorageInput) {
            stateStorageInput = {};
        }

        // Initialize PID states
        if (!stateStorageInput.heatingPIDState) {
            stateStorageInput.heatingPIDState = { integral: 0, previousError: 0, lastOutput: 0 };
        }
        if (!stateStorageInput.coolingPIDState) {
            stateStorageInput.coolingPIDState = { integral: 0, previousError: 0, lastOutput: 0 };
        }

        // STEP 1: Determine current space temperature with Warren-specific sensor mapping
        let currentTemp = currentTempArgument;
        if (currentTemp === undefined || isNaN(currentTemp)) {
            // Warren-specific space temperature sensor mapping with extensive fallbacks
            currentTemp = parseSafeNumber(currentMetrics.Space, parseSafeNumber(currentMetrics.spaceTemperature, parseSafeNumber(currentMetrics.SpaceTemp, parseSafeNumber(currentMetrics.spaceTemp, parseSafeNumber(currentMetrics.SpaceTemperature, parseSafeNumber(currentMetrics.roomTemp, parseSafeNumber(currentMetrics.RoomTemp, parseSafeNumber(currentMetrics.roomTemperature, parseSafeNumber(currentMetrics.RoomTemperature, parseSafeNumber(currentMetrics.temperature, parseSafeNumber(currentMetrics.Temperature, parseSafeNumber(currentMetrics.coveTemp, parseSafeNumber(currentMetrics.kitchenTemp, parseSafeNumber(currentMetrics.mailRoomTemp, parseSafeNumber(currentMetrics.chapelTemp, parseSafeNumber(currentMetrics.office1Temp, parseSafeNumber(currentMetrics.office2Temp, parseSafeNumber(currentMetrics.office3Temp, parseSafeNumber(currentMetrics.itRoomTemp, parseSafeNumber(currentMetrics.beautyShopTemp, parseSafeNumber(currentMetrics.natatoriumTemp, parseSafeNumber(currentMetrics.hall1Temp, parseSafeNumber(currentMetrics.hall2Temp, 72)))))))))))))))))))))));
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil", `Using space temperature: ${currentTemp}°F`);
        } else {
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil", `Using provided current temperature: ${currentTemp}°F`);
        }

        // STEP 2: Get outdoor temperature with fallbacks
        const outdoorTemp = parseSafeNumber(currentMetrics.Outdoor_Air, parseSafeNumber(currentMetrics.outdoorTemperature, parseSafeNumber(currentMetrics.outdoorTemp, parseSafeNumber(currentMetrics.Outdoor, parseSafeNumber(currentMetrics.outdoor, parseSafeNumber(currentMetrics.OutdoorTemp, parseSafeNumber(currentMetrics.OAT, parseSafeNumber(currentMetrics.oat, 65))))))));
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil", `Outdoor temperature: ${outdoorTemp}°F`);

        // STEP 3: Determine temperature setpoint with user override priority
        let temperatureSetpoint = parseSafeNumber(currentSettings.temperatureSetpoint, undefined);

        // Check if temperatureSetpoint is available in metrics (from UI) - HIGHEST PRIORITY
        const userSetpoint = parseSafeNumber(currentMetrics.temperatureSetpoint, parseSafeNumber(currentMetrics.temperature_setpoint, parseSafeNumber(currentMetrics.control_value, parseSafeNumber(currentMetrics.command, undefined))));

        if (userSetpoint !== undefined) {
            temperatureSetpoint = userSetpoint;
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil", `Using user-set temperature setpoint from UI: ${temperatureSetpoint}°F (HIGHEST PRIORITY)`);
        }
        // If not available from UI or settings, apply Outdoor Air Reset (OAR)
        else if (temperatureSetpoint === undefined) {
            // Warren OAR: Min OAT 32°F → SP 75°F, Max OAT 73°F → SP 72°F
            const minOAT = 32;
            const maxOAT = 73;
            const maxSetpoint = 75;
            const minSetpoint = 72;

            if (outdoorTemp <= minOAT) {
                temperatureSetpoint = maxSetpoint;
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil", `OAR: OAT ${outdoorTemp}°F <= ${minOAT}°F, using max setpoint: ${temperatureSetpoint}°F`);
            } else if (outdoorTemp >= maxOAT) {
                temperatureSetpoint = minSetpoint;
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil", `OAR: OAT ${outdoorTemp}°F >= ${maxOAT}°F, using min setpoint: ${temperatureSetpoint}°F`);
            } else {
                // Linear interpolation between the two points
                const ratio = (outdoorTemp - minOAT) / (maxOAT - minOAT);
                temperatureSetpoint = maxSetpoint - ratio * (maxSetpoint - minSetpoint);
                temperatureSetpoint = parseFloat(temperatureSetpoint.toFixed(1));
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil", `OAR: Calculated setpoint: ${temperatureSetpoint}°F (ratio: ${ratio.toFixed(2)})`);
            }
        } else {
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil", `Using settings temperatureSetpoint: ${temperatureSetpoint}°F`);
        }

        // STEP 4: Determine outdoor damper position with Warren-specific logic
        let outdoorDamperPosition = 0;
        // Warren damper logic: Open when 40°F < OAT ≤ 80°F
        if (outdoorTemp > 40 && outdoorTemp <= 80) {
            outdoorDamperPosition = 100; // Fully open (maps to 10V)
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil", `OA damper: OPEN (OAT ${outdoorTemp}°F is between 40°F and 80°F)`);
        } else {
            outdoorDamperPosition = 0; // Closed (maps to 0V)
            if (outdoorTemp <= 40) {
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil", `OA damper: CLOSED (OAT ${outdoorTemp}°F <= 40°F - too cold)`);
            } else {
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil", `OA damper: CLOSED (OAT ${outdoorTemp}°F > 80°F - too hot)`);
            }
        }

        // STEP 5: Safety checks
        const supplyTemp = parseSafeNumber(currentMetrics.Supply, parseSafeNumber(currentMetrics.supplyTemperature, parseSafeNumber(currentMetrics.SupplyTemp, currentTemp)));
        const mixedAirTemp = parseSafeNumber(currentMetrics.Mixed_Air, parseSafeNumber(currentMetrics.MixedAir, parseSafeNumber(currentMetrics.mixedAir, 55)));

        const freezestatTripped = supplyTemp < 40 || mixedAirTemp < 40;
        const highLimitTripped = supplyTemp > 115;

        if (freezestatTripped || highLimitTripped) {
            const safetyReason = freezestatTripped ? "freezestat" : "highlimit";
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil", `SAFETY: ${safetyReason.toUpperCase()} TRIPPED!`);

            const safetyResult = {
                fanEnabled: safetyReason !== "freezestat",
                outdoorDamperPosition: 0,
                heatingValvePosition: safetyReason === "freezestat" ? 100 : 0,
                coolingValvePosition: safetyReason === "highlimit" ? 100 : 0,
                temperatureSetpoint: temperatureSetpoint,
                unitEnable: true,
                fanSpeed: safetyReason === "freezestat" ? "off" : "medium",
                fanMode: "auto",
                heatingValveMode: "auto",
                coolingValveMode: "auto",
                operationMode: "auto"
            };

            // FIXED: NO DATABASE OPERATIONS - Return result to factory
            return safetyResult;
        }

        // STEP 6: Fan control logic
        const fanEnabled = true; // Warren fan coils typically run continuously
        const fanSpeed = "medium"; // Default speed

        // STEP 7: PID control for heating and cooling valves
        const temperatureError = currentTemp - temperatureSetpoint;
        const deadband = 1.0; // 1°F deadband

        let heatingValvePosition = 0;
        let coolingValvePosition = 0;

        // Warren-specific PID parameters
        const heatingPIDParams = {
            kp: 0.7, ki: 0.04, kd: 0.02,
            enabled: true, outputMin: 0, outputMax: 100,
            reverseActing: true, maxIntegral: 15
        };

        const coolingPIDParams = {
            kp: 0.6, ki: 0.05, kd: 0.01,
            enabled: true, outputMin: 0, outputMax: 100,
            reverseActing: false, maxIntegral: 15
        };

        if (temperatureError < -deadband) {
            // Need heating
            const heatingPID = (0, pid_controller_1.pidControllerImproved)({
                input: currentTemp,
                setpoint: temperatureSetpoint,
                pidParams: heatingPIDParams,
                dt: 1,
                controllerType: "heating",
                pidState: stateStorageInput.heatingPIDState
            });

            heatingValvePosition = Math.max(0, Math.min(100, heatingPID.output));
            coolingValvePosition = 0;

            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil",
                `HEATING: Current=${currentTemp}°F, Setpoint=${temperatureSetpoint}°F, Error=${temperatureError.toFixed(1)}°F, Output=${heatingValvePosition.toFixed(1)}%`);

        } else if (temperatureError > deadband) {
            // Need cooling
            const coolingPID = (0, pid_controller_1.pidControllerImproved)({
                input: currentTemp,
                setpoint: temperatureSetpoint,
                pidParams: coolingPIDParams,
                dt: 1,
                controllerType: "cooling",
                pidState: stateStorageInput.coolingPIDState
            });

            coolingValvePosition = Math.max(0, Math.min(100, coolingPID.output));
            heatingValvePosition = 0;

            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil",
                `COOLING: Current=${currentTemp}°F, Setpoint=${temperatureSetpoint}°F, Error=${temperatureError.toFixed(1)}°F, Output=${coolingValvePosition.toFixed(1)}%`);

        } else {
            // Within deadband - no action needed
            heatingValvePosition = 0;
            coolingValvePosition = 0;

            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil",
                `DEADBAND: Current=${currentTemp}°F, Setpoint=${temperatureSetpoint}°F, Error=${temperatureError.toFixed(1)}°F - no action needed`);
        }

        // STEP 8: Construct result - MATCH HUNTINGTON FORMAT
        const result = {
            fanEnabled: fanEnabled,
            outdoorDamperPosition: outdoorDamperPosition,
            heatingValvePosition: heatingValvePosition,
            coolingValvePosition: coolingValvePosition,
            temperatureSetpoint: temperatureSetpoint,
            unitEnable: true,
            fanSpeed: fanSpeed,
            fanMode: "auto",
            heatingValveMode: "auto",
            coolingValveMode: "auto",
            operationMode: "auto"
        };

        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil",
            `Final control values: Fan=${result.fanEnabled ? "ON" : "OFF"}, ` +
            `Heating=${result.heatingValvePosition}%, Cooling=${result.coolingValvePosition}%, ` +
            `Damper=${result.outdoorDamperPosition}%, Unit=${result.unitEnable ? "ON" : "OFF"}`);

        // STEP 9: Return result to factory for high-speed database writes
        // NO INFLUXDB OPERATIONS HERE - Factory handles all database writes for performance
        return result;

    } catch (error) {
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil",
            `ERROR in Warren fan coil control: ${error.message}`, error.stack);

        const errorResult = {
            fanEnabled: false,
            outdoorDamperPosition: 0,
            heatingValvePosition: 0,
            coolingValvePosition: 0,
            temperatureSetpoint: 72,
            unitEnable: false,
            fanSpeed: "off",
            fanMode: "auto",
            heatingValveMode: "auto",
            coolingValveMode: "auto",
            operationMode: "auto"
        };

        // FIXED: NO DATABASE OPERATIONS - Return error state to factory
        return errorResult;
    }
}

// Add worker compatibility exports (match Huntington)
exports.default = fanCoilControl;
exports.processEquipment = fanCoilControl;
exports.runLogic = fanCoilControl;
