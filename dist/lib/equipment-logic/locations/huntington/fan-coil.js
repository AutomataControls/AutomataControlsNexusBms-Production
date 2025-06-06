"use strict";
// @ts-nocheck
// lib/equipment-logic/locations/huntington/fan-coil.ts
//
// ===============================================================================
// HUNTINGTON FAN COIL CONTROL LOGIC - INTEGRATED SUPPLY AIR TEMPERATURE CONTROL
// ===============================================================================
//
// OVERVIEW:
// This file controls fan coil units at the Huntington location using integrated
// control logic with Supply Air Temperature as the primary control source,
// Outdoor Air Reset (OAR), and binary damper control for optimal comfort and efficiency.
// All control decisions are made locally without calling base implementations.
//
// EQUIPMENT CONFIGURATION:
// - Control Source: Supply Air Temperature (discharge air temperature)
// - Damper Type: Binary control (0=Closed, 1=Open)
// - Valve Control: PID-based with enhanced tuning for Huntington
// - Safety Systems: FreezeStat and Hi-Limit protection
//
// CONTROL STRATEGY:
// 1. Supply Air Temperature Control - Uses discharge air temperature for control
// 2. Outdoor Air Reset (OAR) - Automatically adjusts setpoint based on outdoor temp
// 3. Binary Damper Control - Simple open/close based on outdoor temperature
// 4. Enhanced PID Control - Tuned specifically for Huntington equipment
// 5. User Priority System - UI settings override database, database overrides OAR
// 6. High-Speed Factory Integration - Returns results instantly for batch database writes
//
// OAR SETPOINTS (Huntington Specific):
// - When Outdoor Temp = 32°F → Supply Setpoint = 76°F (Max Heat)
// - When Outdoor Temp = 74°F → Supply Setpoint = 71.5°F (Min Heat)
// - Temperatures between 32°F-74°F are calculated proportionally
// - Linear slope: -0.107°F per degree outdoor temperature change
//
// DAMPER OPERATION:
// - Binary Control: 1 = Open, 0 = Closed
// - Opens when outdoor temp > 40°F for free cooling
// - Closes when outdoor temp ≤ 40°F to prevent cold drafts
// - Manual override available through UI settings
//
// VALVE CONTROL:
// - Cooling: Direct acting (0% = 0V closed, 100% = 10V open)
// - Heating: Reverse acting (0% = 10V closed, 100% = 0V open)
// - Enhanced PID tuning for stable Huntington operation
// - Manual mode available for both heating and cooling valves
//
// SAFETY FEATURES:
// - FreezeStat: Activates at 40°F supply air temperature (heating full, damper closed)
// - Hi-Limit: Activates at 115°F supply air temperature (damper open, heating off)
// - Manual overrides available for all controls through UI
// - Emergency states logged through factory for monitoring
//
// USER PRIORITY SYSTEM:
// 1. UI Settings (Highest Priority) - Direct user inputs from interface
// 2. Database Settings (Medium Priority) - Stored configuration values
// 3. OAR Calculated (Lowest Priority) - Automatic outdoor air reset
//
// PID TUNING (Huntington Optimized):
// - Cooling PID: kp=3.5, ki=0.2, kd=0.02 (enhanced responsiveness)
// - Heating PID: kp=1.7, ki=0.13, kd=0.02 (stable control)
// - Anti-windup limits prevent integral saturation
//
// DATA STORAGE:
// - Returns commands as objects to the factory for high-speed database writes
// - No direct InfluxDB operations - all writes handled by factory for performance
// - State storage maintains PID controllers and operational history
// - Supports Node-RED monitoring and control interfaces
//
// TECHNICIAN NOTES:
// - Check supply air temperature sensor if control seems erratic
// - Verify outdoor temperature sensor for proper OAR and damper operation
// - Manual valve positions only active when valve mode is set to "manual"
// - fanEnabled field outputs as 1/0 (not true/false) for equipment compatibility
// - UI settings take highest priority - check interface for manual overrides
// - Binary damper control: 1=Open, 0=Closed (no modulation)
// - Safety conditions (FreezeStat/Hi-Limit) override all user settings
// - Use Node-RED dashboard to monitor real-time PID performance and valve positions
// - PID controllers maintain state between control cycles for stable operation
//
// ===============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.fanCoilControl = fanCoilControl;
const pid_controller_1 = require("../../../pid-controller");
const location_logger_1 = require("../../../logging/location-logger");

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
 * Fan Coil Control Logic specifically for Huntington with integrated control
 * - Uses Supply temperature as control source
 * - Binary damper control (1/0)
 * - OAR: 32°F outdoor -> 76°F setpoint, 74°F outdoor -> 71.5°F setpoint
 * - Enhanced PID tuning for Huntington equipment
 * - High-speed factory integration without direct InfluxDB operations
 */
async function fanCoilControl(metricsInput, settingsInput, currentTempArgument, stateStorageInput) {
    const equipmentId = settingsInput.equipmentId || "unknown";
    const locationId = settingsInput.locationId || "4"; // Huntington location ID
    const currentMetrics = metricsInput;
    const currentSettings = settingsInput;
    
    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil", "Starting Huntington fan-coil control with integrated logic");
    
    try {
        // Initialize state storage if needed
        if (!stateStorageInput) {
            stateStorageInput = {};
        }
        
        // STEP 1: Get supply temperature with comprehensive fallbacks
        let currentTemp = currentTempArgument;
        if (currentTemp === undefined || isNaN(currentTemp)) {
            currentTemp = parseSafeNumber(
                currentMetrics.Supply,
                parseSafeNumber(currentMetrics.supplyTemp,
                parseSafeNumber(currentMetrics.SupplyTemp,
                parseSafeNumber(currentMetrics.supplyTemperature,
                parseSafeNumber(currentMetrics.SupplyTemperature,
                parseSafeNumber(currentMetrics.discharge,
                parseSafeNumber(currentMetrics.Discharge, 55))))))
            );
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil", `Using supply temperature: ${currentTemp}°F`);
        } else {
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil", `Using provided supply temperature: ${currentTemp}°F`);
        }
        
        // STEP 2: Get outdoor temperature with fallbacks
        const outdoorTemp = parseSafeNumber(
            currentMetrics.Outdoor_Air,
            parseSafeNumber(currentMetrics.outdoorTemperature,
            parseSafeNumber(currentMetrics.outdoorTemp,
            parseSafeNumber(currentMetrics.Outdoor,
            parseSafeNumber(currentMetrics.OAT,
            parseSafeNumber(currentMetrics.oat, 70)))))
        );
        
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil", `Outdoor temperature: ${outdoorTemp}°F`);
        
        // STEP 3: Extract user controls from UI (highest priority)
        const userControlsFromUI = {
            temperatureSetpoint: currentSettings.temperature_setpoint !== undefined ?
                parseSafeNumber(currentSettings.temperature_setpoint, undefined) : undefined,
            unitEnable: currentSettings.unit_enable !== undefined ?
                (currentSettings.unit_enable === true || currentSettings.unit_enable === "true" || currentSettings.unit_enable === 1) : undefined,
            fanEnabled: currentSettings.fan_enabled !== undefined ?
                (currentSettings.fan_enabled === true || currentSettings.fan_enabled === "true" || currentSettings.fan_enabled === 1) : undefined,
            fanSpeed: currentSettings.fan_speed,
            fanMode: currentSettings.fan_mode,
            heatingValveMode: currentSettings.heating_valve_mode,
            coolingValveMode: currentSettings.cooling_valve_mode,
            heatingValvePosition: currentSettings.heating_valve_position !== undefined ?
                parseSafeNumber(currentSettings.heating_valve_position, undefined) : undefined,
            coolingValvePosition: currentSettings.cooling_valve_position !== undefined ?
                parseSafeNumber(currentSettings.cooling_valve_position, undefined) : undefined,
            outdoorDamperPosition: currentSettings.outdoor_damper_position !== undefined ?
                parseSafeNumber(currentSettings.outdoor_damper_position, undefined) : undefined,
            operationMode: currentSettings.operation_mode
        };
        
        // Get database values (medium priority)
        const controlsFromDB = {
            temperatureSetpoint: currentSettings.temperatureSetpoint,
            unitEnable: currentSettings.unitEnable,
            fanEnabled: currentSettings.fanEnabled,
            fanSpeed: currentSettings.fanSpeed,
            fanMode: currentSettings.fanMode,
            heatingValveMode: currentSettings.heatingValveMode,
            coolingValveMode: currentSettings.coolingValveMode,
            heatingValvePosition: currentSettings.heatingValvePosition,
            coolingValvePosition: currentSettings.coolingValvePosition,
            outdoorDamperPosition: currentSettings.outdoorDamperPosition,
            operationMode: currentSettings.operationMode
        };
        
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil", 
            `User settings found: ${JSON.stringify(userControlsFromUI, (k, v) => v === undefined ? "N/A" : v)}`);
        
        // STEP 4: Calculate OAR setpoint (lowest priority)
        let oarSetpointValue = 72; // Default fallback
        if (currentSettings.outdoorAirReset?.enabled !== false) {
            // Huntington OAR: 32°F→76°F, 74°F→71.5°F
            // Slope: (71.5 - 76) / (74 - 32) = -4.5 / 42 = -0.107
            const slope = -0.107;
            oarSetpointValue = 76 + slope * (outdoorTemp - 32);
            oarSetpointValue = Math.max(68, Math.min(78, oarSetpointValue)); // Clamp to reasonable range
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil", 
                `Huntington OAR calculation: Outdoor ${outdoorTemp}°F → OAR setpoint ${oarSetpointValue.toFixed(1)}°F`);
        }
        
        // STEP 5: Apply priority logic for temperature setpoint
        let finalSetpoint;
        let setpointSource;
        if (userControlsFromUI.temperatureSetpoint !== undefined) {
            finalSetpoint = userControlsFromUI.temperatureSetpoint;
            setpointSource = "UI";
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil", 
                `Using UI setpoint: ${finalSetpoint}°F (HIGHEST PRIORITY)`);
        } else if (controlsFromDB.temperatureSetpoint !== undefined) {
            finalSetpoint = controlsFromDB.temperatureSetpoint;
            setpointSource = "Database";
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil", 
                `Using database setpoint: ${finalSetpoint}°F (MEDIUM PRIORITY)`);
        } else {
            finalSetpoint = oarSetpointValue;
            setpointSource = "OAR";
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil", 
                `Using OAR setpoint: ${finalSetpoint.toFixed(1)}°F (LOWEST PRIORITY)`);
        }
        
        // STEP 6: Apply priority logic for other controls
        const finalUnitEnable = userControlsFromUI.unitEnable !== undefined ?
            userControlsFromUI.unitEnable : (controlsFromDB.unitEnable !== undefined ? controlsFromDB.unitEnable : true);
        
        const finalFanEnabled = userControlsFromUI.fanEnabled !== undefined ?
            userControlsFromUI.fanEnabled : (controlsFromDB.fanEnabled !== undefined ? controlsFromDB.fanEnabled : true);
        
        const finalFanSpeed = userControlsFromUI.fanSpeed !== undefined ?
            userControlsFromUI.fanSpeed : (controlsFromDB.fanSpeed || "medium");
        
        const finalFanMode = userControlsFromUI.fanMode !== undefined ?
            userControlsFromUI.fanMode : (controlsFromDB.fanMode || "auto");
        
        const finalOperationMode = userControlsFromUI.operationMode !== undefined ?
            userControlsFromUI.operationMode : (controlsFromDB.operationMode || "auto");
        
        const finalHeatingValveMode = userControlsFromUI.heatingValveMode !== undefined ?
            userControlsFromUI.heatingValveMode : (controlsFromDB.heatingValveMode || "auto");
        
        const finalCoolingValveMode = userControlsFromUI.coolingValveMode !== undefined ?
            userControlsFromUI.coolingValveMode : (controlsFromDB.coolingValveMode || "auto");
        
        // STEP 7: Check for safety conditions (always overrides user settings)
        if (currentTemp <= 40) {
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil", 
                `FREEZESTAT ACTIVATED at ${currentTemp}°F supply - Emergency heating mode`);
            
            const freezestatResult = {
                fanEnabled: 0, // Turn off fan
                outdoorDamperPosition: 0, // Close damper
                heatingValvePosition: 100, // Open heating valve fully
                coolingValvePosition: 0, // Close cooling valve
                temperatureSetpoint: finalSetpoint,
                unitEnable: finalUnitEnable,
                fanSpeed: finalFanSpeed,
                fanMode: finalFanMode,
                heatingValveMode: finalHeatingValveMode,
                coolingValveMode: finalCoolingValveMode,
                operationMode: finalOperationMode
            };
            
            return freezestatResult;
        }
        
        if (currentTemp >= 115) {
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil", 
                `HI-LIMIT ACTIVATED at ${currentTemp}°F supply - Emergency cooling mode`);
            
            const hiLimitResult = {
                fanEnabled: 1, // Keep fan running
                outdoorDamperPosition: 1, // Open damper
                heatingValvePosition: 0, // Close heating valve
                coolingValvePosition: 0, // Close cooling valve (safety)
                temperatureSetpoint: finalSetpoint,
                unitEnable: finalUnitEnable,
                fanSpeed: finalFanSpeed,
                fanMode: finalFanMode,
                heatingValveMode: finalHeatingValveMode,
                coolingValveMode: finalCoolingValveMode,
                operationMode: finalOperationMode
            };
            
            return hiLimitResult;
        }
        
        // STEP 8: Determine outdoor damper position (binary control)
        let outdoorDamperPosition = 0;
        if (userControlsFromUI.outdoorDamperPosition !== undefined) {
            // User manual override
            outdoorDamperPosition = userControlsFromUI.outdoorDamperPosition > 0 ? 1 : 0;
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil", 
                `Using user-defined outdoor damper position: ${outdoorDamperPosition}`);
        } else if (outdoorTemp > 40) {
            outdoorDamperPosition = 1; // Open for free cooling
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil", 
                `Outdoor temp ${outdoorTemp}°F > 40°F, damper OPEN (1)`);
        } else {
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil", 
                `Outdoor temp ${outdoorTemp}°F ≤ 40°F, damper CLOSED (0)`);
        }
        
        // STEP 9: Initialize PID controllers if not present
        if (!stateStorageInput.huntingtonFanCoilPID) {
            stateStorageInput.huntingtonFanCoilPID = {
                heating: { integral: 0, previousError: 0, lastOutput: 0 },
                cooling: { integral: 0, previousError: 0, lastOutput: 0 }
            };
        }
        
        // STEP 10: Calculate valve positions based on mode
        let finalHeatingValvePosition = 0;
        let finalCoolingValvePosition = 0;
        
        // Calculate temperature error
        const temperatureError = finalSetpoint - currentTemp;
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil", 
            `Temperature control: Setpoint=${finalSetpoint}°F, Current=${currentTemp}°F, Error=${temperatureError.toFixed(1)}°F`);
        
        // Heating valve control
        if (finalHeatingValveMode === "manual") {
            finalHeatingValvePosition = userControlsFromUI.heatingValvePosition !== undefined ?
                userControlsFromUI.heatingValvePosition : (controlsFromDB.heatingValvePosition || 0);
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil", 
                `Heating valve MANUAL mode: ${finalHeatingValvePosition}%`);
        } else {
            // Automatic PID control for heating
            if (temperatureError > 1.0) { // Need heating
                const heatingPID = (0, pid_controller_1.pidControllerImproved)({
                    input: currentTemp,
                    setpoint: finalSetpoint,
                    pidParams: {
                        kp: 1.7, ki: 0.13, kd: 0.02,
                        outputMin: 0, outputMax: 100, enabled: true,
                        reverseActing: true, maxIntegral: 15
                    },
                    dt: 1,
                    controllerType: "heating",
                    pidState: stateStorageInput.huntingtonFanCoilPID.heating
                });
                finalHeatingValvePosition = heatingPID.output;
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil", 
                    `Heating valve PID: ${finalHeatingValvePosition.toFixed(1)}% (error: +${temperatureError.toFixed(1)}°F)`);
            } else {
                finalHeatingValvePosition = 0;
                stateStorageInput.huntingtonFanCoilPID.heating.integral = 0; // Reset integral
            }
        }
        
        // Cooling valve control
        if (finalCoolingValveMode === "manual") {
            finalCoolingValvePosition = userControlsFromUI.coolingValvePosition !== undefined ?
                userControlsFromUI.coolingValvePosition : (controlsFromDB.coolingValvePosition || 0);
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil", 
                `Cooling valve MANUAL mode: ${finalCoolingValvePosition}%`);
        } else {
            // Automatic PID control for cooling
            if (temperatureError < -1.0) { // Need cooling
                const coolingPID = (0, pid_controller_1.pidControllerImproved)({
                    input: currentTemp,
                    setpoint: finalSetpoint,
                    pidParams: {
                        kp: 3.5, ki: 0.2, kd: 0.02,
                        outputMin: 0, outputMax: 100, enabled: true,
                        reverseActing: false, maxIntegral: 20
                    },
                    dt: 1,
                    controllerType: "cooling",
                    pidState: stateStorageInput.huntingtonFanCoilPID.cooling
                });
                finalCoolingValvePosition = coolingPID.output;
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil", 
                    `Cooling valve PID: ${finalCoolingValvePosition.toFixed(1)}% (error: ${temperatureError.toFixed(1)}°F)`);
            } else {
                finalCoolingValvePosition = 0;
                stateStorageInput.huntingtonFanCoilPID.cooling.integral = 0; // Reset integral
            }
        }
        
        // STEP 11: Construct final result
        const result = {
            fanEnabled: finalFanEnabled && finalUnitEnable ? 1 : 0, // Must be 1/0 for compatibility
            outdoorDamperPosition: outdoorDamperPosition,
            heatingValvePosition: finalHeatingValvePosition,
            coolingValvePosition: finalCoolingValvePosition,
            temperatureSetpoint: finalSetpoint,
            unitEnable: finalUnitEnable,
            fanSpeed: finalFanSpeed,
            fanMode: finalFanMode,
            heatingValveMode: finalHeatingValveMode,
            coolingValveMode: finalCoolingValveMode,
            operationMode: finalOperationMode
        };
        
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil", 
            `Final Huntington Fan-Coil Controls: Unit=${result.unitEnable ? "ON" : "OFF"}, ` +
            `Fan=${result.fanEnabled ? "ON" : "OFF"} (${result.fanSpeed}), ` +
            `Heating=${result.heatingValvePosition.toFixed(1)}% (${result.heatingValveMode}), ` +
            `Cooling=${result.coolingValvePosition.toFixed(1)}% (${result.coolingValveMode}), ` +
            `Damper=${result.outdoorDamperPosition}, Setpoint=${result.temperatureSetpoint}°F (${setpointSource})`);
        
        // STEP 12: Return result to factory for high-speed database writes
        // NO INFLUXDB OPERATIONS HERE - Factory handles all database writes for performance
        return result;
        
    } catch (error) {
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil", 
            `ERROR in Huntington fan-coil control: ${error.message}`, error.stack);
        
        // Return error state without database operations
        const errorResult = {
            fanEnabled: 0,
            outdoorDamperPosition: 0,
            heatingValvePosition: 0,
            coolingValvePosition: 0,
            temperatureSetpoint: 72,
            unitEnable: false,
            fanSpeed: "low",
            fanMode: "auto",
            heatingValveMode: "auto",
            coolingValveMode: "auto",
            operationMode: "auto"
        };
        
        return errorResult;
    }
}

// Add worker compatibility exports
exports.default = fanCoilControl;
exports.processEquipment = fanCoilControl;
exports.runLogic = fanCoilControl;
