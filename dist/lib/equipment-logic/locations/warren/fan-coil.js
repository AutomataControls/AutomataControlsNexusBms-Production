"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fanCoilControl = fanCoilControl;
// lib/equipment-logic/locations/warren/fan-coil.ts
const fan_coil_1 = require("../../base/fan-coil");
const location_logger_1 = require("@/lib/logging/location-logger");
/**
 * Fan Coil Control Logic specifically for Warren
 * - Control source: Space temperature
 * - OA dampers: Open when OAT > 40°F, closed when OAT > 80°F or < 40°F
 * - CW actuator: Direct acting 0-10V
 * - HW actuator: Reverse acting 0-10V
 * - Setpoint: Use temperatureSetpoint from UI if available
 * - OAR fallback: Min OAT 32°F → SP 75°F, Max OAT 73°F → SP 72°F
 */
function fanCoilControl(metrics, settings, currentTemp, pidState) {
    var _a, _b;
    // Extract equipment ID and location ID for logging
    const equipmentId = settings.equipmentId || "unknown";
    const locationId = settings.locationId || "1"; // Default to Warren (ID: 1)
    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil", "Starting Warren-specific fan coil control logic");
    // STEP 1: Always use space temperature for control (with added Warren-specific sensors)
    if (currentTemp === undefined) {
        currentTemp = metrics.Space ||
            metrics.spaceTemperature ||
            metrics.SpaceTemp ||
            metrics.spaceTemp ||
            metrics.SpaceTemperature ||
            metrics.roomTemp ||
            metrics.RoomTemp ||
            metrics.roomTemperature ||
            metrics.RoomTemperature ||
            metrics.temperature ||
            metrics.Temperature ||
            // Added Warren-specific room temperature sensors
            metrics.coveTemp ||
            metrics.kitchenTemp ||
            metrics.mailRoomTemp ||
            metrics.chapelTemp ||
            metrics.office1Temp ||
            metrics.office2Temp ||
            metrics.office3Temp ||
            metrics.itRoomTemp ||
            metrics.beautyShopTemp ||
            metrics.natatoriumTemp ||
            metrics.hall1Temp ||
            metrics.hall2Temp ||
            72; // Default fallback temperature
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil", `Using space temperature: ${currentTemp}°F`);
    }
    // STEP 2: Get outdoor temperature with fallbacks
    const outdoorTemp = metrics.Outdoor_Air ||
        metrics.outdoorTemperature ||
        metrics.outdoorTemp ||
        metrics.Outdoor ||
        metrics.outdoor ||
        metrics.OutdoorTemp ||
        metrics.OAT ||
        metrics.oat ||
        65; // Default fallback
    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil", `Outdoor temperature: ${outdoorTemp}°F`);
    // STEP 3: Determine temperature setpoint
    let temperatureSetpoint = settings.temperatureSetpoint;
    // Check if temperatureSetpoint is available in metrics (from UI)
    if (metrics.temperatureSetpoint !== undefined) {
        temperatureSetpoint = metrics.temperatureSetpoint;
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil", `Using user-set temperature setpoint from UI: ${temperatureSetpoint}°F`);
    }
    // If not available, apply outdoor air reset (OAR)
    else if (temperatureSetpoint === undefined) {
        // OAR: Min OAT 32°F → SP 75°F, Max OAT 73°F → SP 72°F
        if (outdoorTemp <= 32) {
            temperatureSetpoint = 75;
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil", `OAR: OAT ${outdoorTemp}°F <= 32°F, using max setpoint: ${temperatureSetpoint}°F`);
        }
        else if (outdoorTemp >= 73) {
            temperatureSetpoint = 72;
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil", `OAR: OAT ${outdoorTemp}°F >= 73°F, using min setpoint: ${temperatureSetpoint}°F`);
        }
        else {
            // Linear interpolation between the two points
            const ratio = (outdoorTemp - 32) / (73 - 32);
            temperatureSetpoint = 75 - ratio * (75 - 72);
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil", `OAR: Calculated setpoint: ${temperatureSetpoint.toFixed(1)}°F (ratio: ${ratio.toFixed(2)})`);
        }
    }
    // STEP 4: Determine outdoor damper position
    let outdoorDamperPosition = 0;
    // For OA dampers: Open when OAT > 40°F, closed when OAT > 80°F or < 40°F
    if (outdoorTemp > 40 && outdoorTemp <= 80) {
        outdoorDamperPosition = 100; // Fully open (maps to 10V)
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil", `OA damper: OPEN (OAT ${outdoorTemp}°F is between 40°F and 80°F)`);
    }
    else {
        outdoorDamperPosition = 0; // Closed (maps to 0V)
        if (outdoorTemp <= 40) {
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil", `OA damper: CLOSED (OAT ${outdoorTemp}°F <= 40°F)`);
        }
        else {
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil", `OA damper: CLOSED (OAT ${outdoorTemp}°F > 80°F)`);
        }
    }
    // STEP 5: Check for safety conditions (freezestat, etc.)
    // For Warren, apply the same safety conditions as in the base implementation
    // STEP 6: Set up PID parameters for Warren-specific actuator behavior
    const warrenSettings = {
        ...settings,
        temperatureSetpoint: temperatureSetpoint,
        pidControllers: {
            cooling: {
                ...(((_a = settings.pidControllers) === null || _a === void 0 ? void 0 : _a.cooling) || {}),
                // Warren-specific cooling settings
                kp: 0.6, // Proportional gain
                ki: 0.05, // Integral gain
                kd: 0.01, // Derivative gain
                enabled: true, // Ensure PID is enabled
                outputMin: 0, // 0% = 0V (valve closed) - Direct acting
                outputMax: 100, // 100% = 10V (valve open) - Direct acting
                reverseActing: false, // Direct acting for cooling
                maxIntegral: 15 // Anti-windup parameter
            },
            heating: {
                ...(((_b = settings.pidControllers) === null || _b === void 0 ? void 0 : _b.heating) || {}),
                // Warren-specific heating settings
                kp: 0.7, // Proportional gain
                ki: 0.04, // Integral gain 
                kd: 0.02, // Derivative gain
                enabled: true, // Ensure PID is enabled
                outputMin: 0, // 0% = 10V (valve closed) - Reverse acting
                outputMax: 100, // 100% = 0V (valve open) - Reverse acting
                reverseActing: true, // Reverse acting for heating
                maxIntegral: 15 // Anti-windup parameter
            }
        }
    };
    // STEP 7: Call base implementation with Warren-specific settings
    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil", "Calling base implementation with Warren-specific settings");
    const baseResult = (0, fan_coil_1.fanCoilControl)(metrics, warrenSettings, currentTemp, pidState);
    // STEP 8: Override the result with any Warren-specific changes
    const result = {
        ...baseResult,
        outdoorDamperPosition: outdoorDamperPosition, // Use our calculated OA damper position
        temperatureSetpoint: temperatureSetpoint // Ensure our setpoint is preserved
    };
    // Log the final control values
    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "fan-coil", `Final control values: fan=${result.fanEnabled ? "ON" : "OFF"}, ` +
        `heating=${result.heatingValvePosition}%, cooling=${result.coolingValvePosition}%, ` +
        `damper=${result.outdoorDamperPosition}%`, result);
    return result;
}
