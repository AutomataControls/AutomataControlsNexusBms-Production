"use strict";
// @ts-nocheck
// lib/equipment-logic/locations/warren/steam-bundle.ts
//
// Author: Juelz NeuralBms DevOps
// Last Updated: June 4, 2025
//
// ===============================================================================
// WARREN STEAM BUNDLE CONTROL LOGIC - DUAL-VALVE HEATING SYSTEM
// ===============================================================================
//
// OVERVIEW:
// This file controls the steam bundle heating system at Warren location using
// dual-valve staging with outdoor air reset (OAR) for optimal efficiency and
// precise temperature control in the facility's heating distribution system.
//
// SYSTEM CONFIGURATION:
// - Primary Valve: 1/3 capacity steam control valve (Stage 1 heating)
// - Secondary Valve: 2/3 capacity steam control valve (Stage 2 heating)
// - Temperature Control: Supply air or bundle temperature feedback
// - Safety Systems: High temperature limit protection
// - Dependency: HW pump operation verification via amp readings
//
// CONTROL STRATEGY:
// 1. Outdoor Air Reset (OAR) - Temperature setpoint based on outdoor conditions
// 2. Staged Valve Control - Sequential operation for optimal efficiency
// 3. PID Temperature Control - Precise modulation for stable temperatures
// 4. Pump Dependency - Only operates when HW pumps are running
// 5. Safety Interlocks - High temperature shutoff protection
// 6. HIGH-SPEED FACTORY INTEGRATION - Returns results instantly for batch database writes
//
// OAR SETPOINTS (Warren Specific):
// - When Outdoor Temp ≤ 32°F → Steam Setpoint = 155°F (Maximum heating)
// - When Outdoor Temp ≥ 70°F → Steam System = OFF (No heating needed)
// - Temperatures between 32°F-70°F are calculated proportionally
// - Linear interpolation: 155°F at 32°F, scaling to 0°F at 70°F
//
// VALVE STAGING OPERATION:
// Stage 1 (0-33% demand): Primary valve only (0-100% modulation)
// Stage 2 (33-100% demand): Primary valve 100% + Secondary valve (0-100% modulation)
// - Primary valve provides base heating capacity
// - Secondary valve adds additional capacity for high demand
// - Smooth transition between stages prevents temperature swings
//
// PUMP DEPENDENCY:
// - Requires HW Pump 1 OR HW Pump 2 amp reading > 10A
// - Steam bundle disabled if no pump circulation detected
// - Prevents steam injection without proper circulation
// - Safety feature to prevent overheating or steam accumulation
//
// VALVE CONTROL:
// - Both valves: Direct acting (0V closed, 10V open) - 0-100% range
// - PID control with Warren-specific tuning for stable operation
// - Anti-windup protection prevents integral saturation
// - Smooth modulation prevents valve cycling
//
// SAFETY FEATURES:
// - High Temperature Limit: 165°F emergency shutoff
// - Pump Interlock: No operation without circulation
// - OAR Limits: Automatic system disable at high outdoor temperatures
// - Valve Position Validation: 0-100% range enforcement
//
// PID TUNING (Warren Optimized):
// - Proportional (kp): 2.0 - Responsive but stable
// - Integral (ki): 0.1 - Slow integration to prevent overshoot
// - Derivative (kd): 0.1 - Minimal derivative action for stability
// - Anti-windup: 20% maximum integral to prevent saturation
//
// TEMPERATURE SOURCES:
// Primary: Supply, supplyTemperature, SupplyTemp
// Secondary: bundleTemp, steamBundleTemp, heatExchangerTemp
// Fallback: 140°F default for safe operation
//
// MONITORING FEATURES:
// - Real-time valve position feedback
// - Pump amp reading verification
// - Safety status reporting
// - PID performance logging
// - Temperature source identification
//
// DATA STORAGE:
// - Returns commands as objects to the factory for high-speed database writes
// - NO DIRECT INFLUXDB OPERATIONS - all writes handled by factory for performance
// - All operations are logged for troubleshooting
// - PID states maintained for smooth control transitions
//
// TECHNICIAN NOTES:
// - Check HW pump amp sensors if steam bundle won't operate (>10A required)
// - Verify outdoor temperature sensor for proper OAR operation
// - Primary valve should modulate first (0-33% demand), then secondary
// - High temp safety activates at 165°F - check for steam leaks or control issues
// - System automatically disables when outdoor temp ≥ 70°F (no heating needed)
// - PID integral windup limited to 20% to prevent overshoot
// - Use Node-RED dashboard to monitor real-time valve positions and temperatures
// - NO DATABASE OPERATIONS - Factory handles all writes for 1-2 second performance
//
// ===============================================================================

Object.defineProperty(exports, "__esModule", { value: true });
exports.steamBundleControl = steamBundleControl;
const location_logger_1 = require("../../../logging/location-logger");
const pid_controller_1 = require("../../../pid-controller");

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
 * Steam Bundle Control Logic for Warren
 * - Two valves: Primary (1/3) and Secondary (2/3)
 * - OAR: Min OAT 32°F → SP 155°F, Max OAT 70°F → All valves OFF
 * - Valves: Direct acting 0-10V with PID control
 * - Safety shutoff: 165°F
 * - Operation dependency: Amp reading > 10 from HWPump-1 OR HWPump-2
 * - HIGH-SPEED: No database operations, returns objects to factory
 */
function steamBundleControl(metrics, settings, currentTemp, pidState) {
    // Extract equipment ID and location ID for logging
    const equipmentId = settings.equipmentId || "unknown";
    const locationId = settings.locationId || "1"; // Default to Warren (ID: 1)

    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "steam-bundle", "Starting Warren steam bundle control logic");

    try {
        // STEP 1: Get supply temperature if not provided
        if (currentTemp === undefined) {
            currentTemp = parseSafeNumber(metrics.Supply,
                parseSafeNumber(metrics.supplyTemperature,
                parseSafeNumber(metrics.SupplyTemp,
                parseSafeNumber(metrics.supplyTemp,
                parseSafeNumber(metrics.SupplyTemperature,
                parseSafeNumber(metrics.bundleTemp,
                parseSafeNumber(metrics.BundleTemp,
                parseSafeNumber(metrics.steamBundleTemp,
                parseSafeNumber(metrics.SteamBundleTemp,
                parseSafeNumber(metrics.heatExchangerTemp,
                parseSafeNumber(metrics.HeatExchangerTemp, 140))))))))))); // FIXED: Correct number of closing parentheses

            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "steam-bundle", `Using supply temperature: ${currentTemp}°F`);
        }

        // STEP 2: Get outdoor temperature with fallbacks
        const outdoorTemp = parseSafeNumber(metrics.Outdoor_Air,
            parseSafeNumber(metrics.outdoorTemperature,
            parseSafeNumber(metrics.outdoorTemp,
            parseSafeNumber(metrics.Outdoor,
            parseSafeNumber(metrics.outdoor,
            parseSafeNumber(metrics.OutdoorTemp,
            parseSafeNumber(metrics.OAT,
            parseSafeNumber(metrics.oat, 50))))))); // Default fallback

        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "steam-bundle", `Outdoor temperature: ${outdoorTemp}°F`);

        // STEP 3: Check HW pump amp readings
        const hwPump1Amps = parseSafeNumber(metrics.HWPump1Amps,
            parseSafeNumber(metrics.hwPump1Amps,
            parseSafeNumber(metrics["HWPump-1 Amps"],
            parseSafeNumber(metrics["hwPump-1 Amps"],
            parseSafeNumber(metrics.hwPump1_Amps, 0)))));

        const hwPump2Amps = parseSafeNumber(metrics.HWPump2Amps,
            parseSafeNumber(metrics.hwPump2Amps,
            parseSafeNumber(metrics["HWPump-2 Amps"],
            parseSafeNumber(metrics["hwPump-2 Amps"],
            parseSafeNumber(metrics.hwPump2_Amps, 0)))));

        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "steam-bundle", `HW Pump amp readings: Pump 1: ${hwPump1Amps}A, Pump 2: ${hwPump2Amps}A`);

        const pumpRunning = hwPump1Amps > 10 || hwPump2Amps > 10;

        if (!pumpRunning) {
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "steam-bundle", "No HW pump with amps > 10 detected, disabling steam bundle");

            const noPumpResult = {
                primaryValvePosition: 0, // Close primary valve (0%)
                secondaryValvePosition: 0, // Close secondary valve (0%)
                temperatureSetpoint: 0, // No setpoint when disabled
                unitEnable: false, // Unit disabled
                pumpStatus: "off", // Pumps not running
                safetyStatus: "no_pump" // Reason for shutdown
            };

            // FIXED: NO DATABASE OPERATIONS - Return result to factory
            return noPumpResult;
        }

        // STEP 4: Apply Outdoor Air Reset logic
        // OAR: Min OAT 32°F → SP 155°F, Max OAT 70°F → All valves OFF
        let setpoint = 0;
        let systemEnabled = false;

        if (outdoorTemp <= 32) {
            // At or below minimum OAT: Maximum setpoint
            setpoint = 155;
            systemEnabled = true;
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "steam-bundle", `OAR: OAT ${outdoorTemp}°F <= 32°F, using max setpoint: ${setpoint}°F`);
        } else if (outdoorTemp >= 70) {
            // At or above maximum OAT: System off
            setpoint = 0;
            systemEnabled = false;
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "steam-bundle", `OAR: OAT ${outdoorTemp}°F >= 70°F, system disabled`);
        } else {
            // Linear interpolation for values between min and max
            // Calculate how far we are between 32°F and 70°F
            const ratio = (outdoorTemp - 32) / (70 - 32);
            // Interpolate between 155°F and 0°F
            setpoint = 155 * (1 - ratio);
            systemEnabled = true;
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "steam-bundle", `OAR: Calculated setpoint: ${setpoint.toFixed(1)}°F (ratio: ${ratio.toFixed(2)})`);
        }

        // STEP 5: Apply safety check - shut off if temperature exceeds 165°F
        if (currentTemp >= 165) {
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "steam-bundle", `SAFETY: High temperature shutdown at ${currentTemp}°F >= 165°F`);

            const safetyResult = {
                primaryValvePosition: 0, // Close primary valve (0%)
                secondaryValvePosition: 0, // Close secondary valve (0%)
                temperatureSetpoint: setpoint, // Keep calculated setpoint for reference
                unitEnable: false, // Unit disabled
                pumpStatus: pumpRunning ? "running" : "off",
                safetyStatus: "high_temp" // Reason for shutdown
            };

            // FIXED: NO DATABASE OPERATIONS - Return result to factory
            return safetyResult;
        }

        // STEP 6: If system disabled due to OAR, return all valves closed
        if (!systemEnabled) {
            const oarDisabledResult = {
                primaryValvePosition: 0, // Close primary valve (0%)
                secondaryValvePosition: 0, // Close secondary valve (0%)
                temperatureSetpoint: setpoint, // Keep calculated setpoint for reference
                unitEnable: false, // Unit disabled
                pumpStatus: pumpRunning ? "running" : "off",
                safetyStatus: "oar_disabled" // Reason for shutdown
            };

            // FIXED: NO DATABASE OPERATIONS - Return result to factory
            return oarDisabledResult;
        }

        // STEP 7: Calculate valve positions using PID
        // Initialize PID state if needed
        if (!pidState.steamBundleControl) {
            pidState.steamBundleControl = { integral: 0, previousError: 0, lastOutput: 0 };
        }

        // Calculate error (setpoint - current temp)
        const error = setpoint - currentTemp;
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "steam-bundle", `PID Input: setpoint=${setpoint}°F, current=${currentTemp}°F, error=${error}°F`);

        // Only run PID if error is positive (need more heat)
        let primaryValvePosition = 0;
        let secondaryValvePosition = 0;

        if (error > 0) {
            // Configure PID parameters
            const pidParams = {
                kp: 2.0, // Proportional gain
                ki: 0.1, // Integral gain
                kd: 0.1, // Derivative gain
                outputMin: 0, // Minimum output (0%)
                outputMax: 100, // Maximum output (100%)
                enabled: true,
                reverseActing: false, // Direct acting (more output = more heat)
                maxIntegral: 20 // Anti-windup
            };

            // Calculate PID output
            const pidOutput = (0, pid_controller_1.pidControllerImproved)({
                input: currentTemp,
                setpoint: setpoint,
                pidParams: pidParams,
                dt: 1,
                controllerType: "steamBundle",
                pidState: pidState.steamBundleControl
            });

            // Log PID details
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "steam-bundle", `PID Output: ${pidOutput.output.toFixed(1)}%, P=${pidOutput.p.toFixed(1)}, ` +
                `I=${pidOutput.i.toFixed(1)}, D=${pidOutput.d.toFixed(1)}`);

            // Stage the valves based on PID output
            // Primary valve (1/3 capacity) operates in the 0-33% range
            // Secondary valve (2/3 capacity) operates in the 33-100% range
            // Calculate valve positions
            if (pidOutput.output <= 33) {
                // Only use primary valve (up to 100% of primary)
                primaryValvePosition = (pidOutput.output / 33) * 100;
                secondaryValvePosition = 0;
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "steam-bundle", `Using primary valve only: ${primaryValvePosition.toFixed(1)}%`);
            } else {
                // Primary valve at 100%, modulate secondary valve
                primaryValvePosition = 100;
                // Map 33% to 100% PID output to 0% to 100% secondary valve
                secondaryValvePosition = ((pidOutput.output - 33) / 67) * 100;
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "steam-bundle", `Primary valve: 100%, Secondary valve: ${secondaryValvePosition.toFixed(1)}%`);
            }

            // Ensure valve positions are within bounds (0-100%)
            primaryValvePosition = Math.max(0, Math.min(100, primaryValvePosition));
            secondaryValvePosition = Math.max(0, Math.min(100, secondaryValvePosition));
        } else {
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "steam-bundle", `Temperature above setpoint (${currentTemp}°F > ${setpoint}°F), closing valves`);
        }

        // STEP 8: Return the final control values
        const result = {
            primaryValvePosition: primaryValvePosition, // Primary valve position (0-100%)
            secondaryValvePosition: secondaryValvePosition, // Secondary valve position (0-100%)
            temperatureSetpoint: setpoint, // Calculated setpoint
            unitEnable: true, // Unit enabled
            pumpStatus: pumpRunning ? "running" : "off", // Pump status
            safetyStatus: "normal" // Normal operation
        };

        // Log the final control values
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "steam-bundle", `Final control values: primary valve=${result.primaryValvePosition.toFixed(1)}%, ` +
            `secondary valve=${result.secondaryValvePosition.toFixed(1)}%, ` +
            `setpoint=${result.temperatureSetpoint}°F`);

        // STEP 9: Return result to factory for high-speed database writes
        // NO INFLUXDB OPERATIONS HERE - Factory handles all database writes for performance
        return result;

    } catch (error) {
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "steam-bundle", `ERROR in Warren steam bundle control: ${error.message}`, error.stack);

        const errorResult = {
            primaryValvePosition: 0,
            secondaryValvePosition: 0,
            temperatureSetpoint: 0,
            unitEnable: false,
            pumpStatus: "error",
            safetyStatus: "error"
        };

        // FIXED: NO DATABASE OPERATIONS - Return error state to factory
        return errorResult;
    }
}

// Add worker compatibility exports (match Huntington)
exports.default = steamBundleControl;
exports.processEquipment = steamBundleControl;
exports.runLogic = steamBundleControl;
