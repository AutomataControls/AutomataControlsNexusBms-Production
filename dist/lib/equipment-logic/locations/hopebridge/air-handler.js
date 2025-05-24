"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.airHandlerControl = airHandlerControl;
const pid_controller_1 = require("@/lib/pid-controller");
const location_logger_1 = require("@/lib/logging/location-logger");
/**
 * Air Handler Control Logic specifically for Hopebridge
 * - Control source: Supply air temperature
 * - Occupied hours: 5:30 AM to 9:30 PM
 * - OAR setpoint: Min OAT 32°F → SP 76°F, Max OAT 68°F → SP 50°F
 * - OA dampers: Open at OAT 40°F, close at 38°F
 * - Safety: Close OA dampers if supply air < 40°F or > 80°F
 * - AHU-1: CW actuator, OA/RA dampers, CW circ pump, Chiller control
 * - AHU-2: DX cooling, OA/RA dampers, Hysteresis 7.5°F, 15-min min runtime
 * - AHU-3: CW actuator only, simplified control
 * - Safety: Freezestat trips when mixed/supply air < 40°F
 */
function airHandlerControl(metrics, settings, currentTemp, stateStorage) {
    // Extract equipment ID and location ID for logging
    const equipmentId = settings.equipmentId || "unknown";
    const locationId = settings.locationId || "5"; // Hopebridge is location ID 5
    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", "Starting Hopebridge-specific air handler control logic");
    // Determine which AHU this is (1, 2, or 3)
    const ahuNumber = getAHUNumber(equipmentId);
    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Identified as AHU-${ahuNumber}`);
    // STEP 1: Get temperatures
    // Always use supply air temperature for control
    if (currentTemp === undefined) {
        currentTemp = metrics.Supply ||
            metrics.supplyTemperature ||
            metrics.SupplyTemp ||
            metrics.supplyTemp ||
            metrics.SupplyTemperature ||
            metrics.SAT ||
            metrics.sat ||
            metrics.SupplyAirTemp ||
            metrics.supplyAirTemp ||
            55;
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Using supply air temperature: ${currentTemp}°F`);
    }
    // Get outdoor temperature with fallbacks
    const outdoorTemp = metrics.Outdoor_Air ||
        metrics.outdoorTemperature ||
        metrics.outdoorTemp ||
        metrics.Outdoor ||
        metrics.outdoor ||
        metrics.OutdoorTemp ||
        metrics.OAT ||
        metrics.oat ||
        65;
    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Outdoor temperature: ${outdoorTemp}°F`);
    // Get mixed air temperature for safety checks
    const mixedAirTemp = metrics.Mixed_Air ||
        metrics.MixedAir ||
        metrics.mixedAir ||
        metrics.MAT ||
        metrics.mat ||
        metrics.MixedAirTemp ||
        metrics.mixedAirTemp ||
        55;
    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Mixed air temperature: ${mixedAirTemp}°F`);
    // STEP 2: Determine occupancy based on time of day
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    // Convert 5:30 AM to minutes (5 * 60 + 30 = 330)
    const occupiedStartMinutes = 5 * 60 + 30;
    // Convert 9:30 PM to minutes (23 * 60 + 1 = 1290) - UPDATED
    const occupiedEndMinutes = 23 * 60 + 1;
    const isOccupied = currentTimeInMinutes >= occupiedStartMinutes && currentTimeInMinutes <= occupiedEndMinutes;
    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Current time: ${currentHour}:${currentMinute.toString().padStart(2, '0')}, Occupancy: ${isOccupied ? "OCCUPIED" : "UNOCCUPIED"}`);
    // STEP 3: Calculate supply air temperature setpoint using OAR
    // Updated OAR: Min OAT 32°F → SP 76°F, Max OAT 68°F → SP 50°F
    let supplySetpoint = 50; // Default to minimum setpoint
    if (isOccupied) {
        // Apply outdoor air reset for all AHUs
        const minOAT = 32; // Minimum outdoor air temperature
        const maxOAT = 68; // Maximum outdoor air temperature
        const maxSupply = 76; // Maximum supply air setpoint (when OAT = minOAT)
        const minSupply = 50; // Minimum supply air setpoint (when OAT = maxOAT)
        if (outdoorTemp <= minOAT) {
            supplySetpoint = maxSupply;
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `OAR: OAT ${outdoorTemp}°F <= ${minOAT}°F, using max setpoint: ${supplySetpoint}°F`);
        }
        else if (outdoorTemp >= maxOAT) {
            supplySetpoint = minSupply;
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `OAR: OAT ${outdoorTemp}°F >= ${maxOAT}°F, using min setpoint: ${supplySetpoint}°F`);
        }
        else {
            // Linear interpolation for values between min and max
            const ratio = (outdoorTemp - minOAT) / (maxOAT - minOAT);
            supplySetpoint = maxSupply - ratio * (maxSupply - minSupply);
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `OAR: Calculated setpoint: ${supplySetpoint.toFixed(1)}°F (ratio: ${ratio.toFixed(2)})`);
        }
    }
    // STEP 4: Check safety conditions
    // SAFETY CHECK 1: Freezestat (mixed or supply air < 40°F)
    const freezestatTripped = currentTemp < 40 || mixedAirTemp < 40;
    if (freezestatTripped) {
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `SAFETY: FREEZESTAT TRIPPED! Supply: ${currentTemp}°F, Mixed: ${mixedAirTemp}°F`);
        // Emergency shutdown
        return {
            heatingValvePosition: 0, // No heating for Hopebridge AHUs
            coolingValvePosition: 0, // Close cooling valve/disable DX
            fanEnabled: false, // Disable fan
            fanSpeed: "off",
            outdoorDamperPosition: 0, // Close outdoor air damper
            supplyAirTempSetpoint: supplySetpoint,
            temperatureSetpoint: 72, // Standard room temp setpoint
            unitEnable: true, // Keep unit enabled for control
            dxEnabled: false, // Disable DX cooling
            cwCircPumpEnabled: false, // Disable CW circulation pump
            chillerEnabled: false, // Disable chiller
            safetyTripped: "freezestat", // Record the safety trip
        };
    }
    // SAFETY CHECK 2: Supply air temperature too high or low for dampers
    const supplyTempOutOfRange = currentTemp < 40 || currentTemp > 80;
    if (supplyTempOutOfRange && !freezestatTripped) {
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `SAFETY: Supply air temperature out of range (${currentTemp}°F), closing outdoor dampers`);
    }
    // STEP 5: Determine outdoor damper position
    // Initialize damper state if not present
    if (!stateStorage.hopebridgeOADamperState) {
        stateStorage.hopebridgeOADamperState = {
            isOpen: false
        };
        // Set initial state based on outdoor temperature
        if (outdoorTemp >= 40) {
            stateStorage.hopebridgeOADamperState.isOpen = true;
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Initializing OA damper state to OPEN (OAT ${outdoorTemp}°F >= 40°F)`);
        }
        else {
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Initializing OA damper state to CLOSED (OAT ${outdoorTemp}°F < 40°F)`);
        }
    }
    // Apply hysteresis logic to outdoor damper
    let outdoorDamperPosition = 0;
    if (isOccupied && !freezestatTripped && !supplyTempOutOfRange) {
        if (stateStorage.hopebridgeOADamperState.isOpen) {
            // If currently open, close at 38°F or lower
            if (outdoorTemp <= 38) {
                stateStorage.hopebridgeOADamperState.isOpen = false;
                outdoorDamperPosition = 0;
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `OA damper: CLOSING (OAT ${outdoorTemp}°F <= 38°F)`);
            }
            else {
                outdoorDamperPosition = 100; // 0-10V maps to 0-100%
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `OA damper: Maintaining OPEN (OAT ${outdoorTemp}°F > 38°F)`);
            }
        }
        else {
            // If currently closed, open at 40°F or higher
            if (outdoorTemp >= 40) {
                stateStorage.hopebridgeOADamperState.isOpen = true;
                outdoorDamperPosition = 100;
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `OA damper: OPENING (OAT ${outdoorTemp}°F >= 40°F)`);
            }
            else {
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `OA damper: Maintaining CLOSED (OAT ${outdoorTemp}°F < 40°F)`);
            }
        }
    }
    else if (!isOccupied) {
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `OA damper: CLOSED (unoccupied mode)`);
    }
    else if (freezestatTripped || supplyTempOutOfRange) {
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `OA damper: CLOSED (safety protection)`);
    }
    // STEP 6: Determine fan status (moved up from Step 7)
    const fanEnabled = isOccupied && !freezestatTripped;
    const fanSpeed = fanEnabled ? "medium" : "off";
    if (fanEnabled) {
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Fan ENABLED (occupied mode)`);
    }
    else if (!isOccupied) {
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Fan DISABLED (unoccupied mode)`);
    }
    else if (freezestatTripped) {
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Fan DISABLED (safety protection)`);
    }
    // STEP 7: Calculate cooling outputs based on AHU number
    let coolingValvePosition = 0;
    let cwCircPumpEnabled = false;
    let dxEnabled = false;
    let chillerEnabled = false; // New control for chiller
    if (isOccupied && !freezestatTripped) {
        if (ahuNumber === 1) {
            // AHU-1: CW actuator and chiller control logic
            // First check if conditions meet for pump operation
            cwCircPumpEnabled = outdoorTemp > 55 && mixedAirTemp > 38 && currentTemp > 38 && fanEnabled;
            // Initialize chiller state if not present
            if (!stateStorage.chillerState) {
                stateStorage.chillerState = {
                    isEnabled: false,
                    pumpRunningTime: 0
                };
            }
            if (cwCircPumpEnabled) {
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-1: CW circulation pump ENABLED (OAT ${outdoorTemp}°F > 55°F, Mixed Air ${mixedAirTemp}°F > 38°F, Supply ${currentTemp}°F > 38°F)`);
                // Ensure pump runs for at least 2 minutes before enabling chiller
                if (!stateStorage.chillerState.isEnabled) {
                    stateStorage.chillerState.pumpRunningTime += 1; // Increment by 1 minute
                    if (stateStorage.chillerState.pumpRunningTime >= 2) {
                        // Enable chiller after pump has been running for 2 minutes
                        chillerEnabled = true;
                        stateStorage.chillerState.isEnabled = true;
                        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-1: CHILLER ENABLED after pump warm-up period`);
                    }
                    else {
                        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-1: Pump warm-up period: ${stateStorage.chillerState.pumpRunningTime}/2 minutes before chiller enable`);
                    }
                }
                else {
                    // Chiller already running
                    chillerEnabled = true;
                }
                // Calculate cooling valve position using PID with updated gains
                const coolingPID = (0, pid_controller_1.pidControllerImproved)({
                    input: currentTemp,
                    setpoint: supplySetpoint,
                    pidParams: {
                        kp: 2.8, // Increased from 1.0 to 2.8
                        ki: 0.17, // Increased from 0.1 to 0.17
                        kd: 0.01, // Unchanged
                        outputMin: 0,
                        outputMax: 100,
                        enabled: true,
                        reverseActing: false, // Direct acting for cooling
                        maxIntegral: 10, // Maximum integral value
                    },
                    dt: 1,
                    controllerType: "cooling",
                    pidState: stateStorage.pidState, // Use state storage for PID
                });
                coolingValvePosition = coolingPID.output;
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-1: CW valve position: ${coolingValvePosition.toFixed(1)}% (PID control)`);
            }
            else {
                // Not meeting conditions for pump operation
                if (stateStorage.chillerState && stateStorage.chillerState.isEnabled) {
                    // If chiller was running, disable it first before turning off pump
                    chillerEnabled = false;
                    stateStorage.chillerState.isEnabled = false;
                    stateStorage.chillerState.pumpRunningTime = 0;
                    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-1: CHILLER DISABLED (Safe shutdown sequence initiated)`);
                    // Keep pump running for 5 more minutes after chiller shutdown
                    if (!stateStorage.chillerShutdownTimer) {
                        stateStorage.chillerShutdownTimer = 5; // 5 minute cooldown period
                        cwCircPumpEnabled = true; // Keep pump running during cooldown
                        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-1: Pump cooldown period: ${stateStorage.chillerShutdownTimer} minutes remaining`);
                    }
                    else if (stateStorage.chillerShutdownTimer > 0) {
                        stateStorage.chillerShutdownTimer -= 1;
                        cwCircPumpEnabled = true; // Keep pump running during cooldown
                        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-1: Pump cooldown period: ${stateStorage.chillerShutdownTimer} minutes remaining`);
                    }
                    else {
                        // Safe to turn off pump now
                        cwCircPumpEnabled = false;
                        stateStorage.chillerShutdownTimer = null;
                        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-1: CW circulation pump DISABLED after safe cooldown period`);
                    }
                }
                else {
                    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-1: CW circulation pump DISABLED (conditions not met)`);
                }
            }
        }
        else if (ahuNumber === 2) {
            // AHU-2: DX cooling with longer hysteresis and minimum runtime
            // Check if conditions meet for DX operation - same as AHU-1 chiller
            const dxConditionsMet = outdoorTemp > 55 && mixedAirTemp > 38 && currentTemp > 38 && fanEnabled && isOccupied;
            // Initialize DX state if not present
            if (!stateStorage.dxState) {
                stateStorage.dxState = {
                    isRunning: false,
                    runningTime: 0,
                    lastState: false,
                    hysteresisPoint: 0
                };
            }
            if (dxConditionsMet) {
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-2: DX conditions met (OAT ${outdoorTemp}°F > 55°F, Mixed Air ${mixedAirTemp}°F > 38°F, Supply ${currentTemp}°F > 38°F, Fan Enabled)`);
                // Calculate if DX should be on or off based on temperature and hysteresis
                const hysteresis = 7.5; // 7.5°F hysteresis
                // If DX is currently off, turn on when temp exceeds setpoint + (hysteresis/2)
                // If DX is currently on, turn off when temp drops below setpoint - (hysteresis/2)
                if (!stateStorage.dxState.isRunning) {
                    if (currentTemp > supplySetpoint + (hysteresis / 2)) {
                        // Time to turn on DX
                        stateStorage.dxState.isRunning = true;
                        stateStorage.dxState.runningTime = 1; // Start the running timer (in minutes)
                        stateStorage.dxState.hysteresisPoint = supplySetpoint - (hysteresis / 2); // Point at which to turn off
                        dxEnabled = true;
                        coolingValvePosition = 100; // Fully on for DX
                        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-2: DX cooling TURNING ON (${currentTemp}°F > ${supplySetpoint + (hysteresis / 2)}°F), will turn off at ${stateStorage.dxState.hysteresisPoint}°F`);
                    }
                    else {
                        dxEnabled = false;
                        coolingValvePosition = 0;
                        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-2: DX cooling OFF (waiting for ${currentTemp}°F to exceed ${supplySetpoint + (hysteresis / 2)}°F)`);
                    }
                }
                else {
                    // DX is currently running
                    stateStorage.dxState.runningTime += 1; // Increment runtime by 1 minute
                    if (currentTemp < stateStorage.dxState.hysteresisPoint && stateStorage.dxState.runningTime >= 15) {
                        // OK to turn off - below hysteresis point and met minimum runtime
                        stateStorage.dxState.isRunning = false;
                        stateStorage.dxState.runningTime = 0;
                        dxEnabled = false;
                        coolingValvePosition = 0;
                        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-2: DX cooling TURNING OFF (${currentTemp}°F < ${stateStorage.dxState.hysteresisPoint}°F and minimum runtime met)`);
                    }
                    else {
                        // Keep running
                        dxEnabled = true;
                        coolingValvePosition = 100;
                        if (stateStorage.dxState.runningTime < 15) {
                            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-2: DX cooling ON (minimum runtime: ${stateStorage.dxState.runningTime}/15 minutes)`);
                        }
                        else if (currentTemp < stateStorage.dxState.hysteresisPoint) {
                            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-2: DX cooling ON (ready to turn off, waiting for temperature ${currentTemp}°F to drop below ${stateStorage.dxState.hysteresisPoint}°F)`);
                        }
                        else {
                            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-2: DX cooling ON (running normally, current temp: ${currentTemp}°F, will turn off at ${stateStorage.dxState.hysteresisPoint}°F)`);
                        }
                    }
                }
            }
            else {
                // DX conditions not met - ensure DX is off
                dxEnabled = false;
                coolingValvePosition = 0;
                // Reset running state
                if (stateStorage.dxState.isRunning) {
                    stateStorage.dxState.isRunning = false;
                    stateStorage.dxState.runningTime = 0;
                    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-2: DX cooling FORCED OFF (conditions no longer met)`);
                }
                else {
                    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-2: DX cooling OFF (conditions not met)`);
                }
            }
        }
        else if (ahuNumber === 3) {
            // AHU-3: Simplified CW actuator control with PID
            // Only checks supply temperature and outdoor temperature
            // Check if conditions meet for CW valve operation
            const cwValveConditionsMet = outdoorTemp > 55 && currentTemp > 38 && fanEnabled;
            if (cwValveConditionsMet) {
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-3: CW valve control ENABLED (OAT ${outdoorTemp}°F > 55°F, Supply ${currentTemp}°F > 38°F)`);
                // Calculate cooling valve position using PID with same parameters as AHU-1
                const coolingPID = (0, pid_controller_1.pidControllerImproved)({
                    input: currentTemp,
                    setpoint: supplySetpoint,
                    pidParams: {
                        kp: 2.8, // Same as AHU-1
                        ki: 0.17, // Same as AHU-1
                        kd: 0.01, // Same as AHU-1
                        outputMin: 0,
                        outputMax: 100,
                        enabled: true,
                        reverseActing: false,
                        maxIntegral: 10,
                    },
                    dt: 1,
                    controllerType: "cooling",
                    pidState: stateStorage.pidStateAhu3, // Separate PID state for AHU-3
                });
                coolingValvePosition = coolingPID.output;
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-3: CW valve position: ${coolingValvePosition.toFixed(1)}% (PID control)`);
            }
            else {
                // Not meeting conditions for CW valve operation
                coolingValvePosition = 0;
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-3: CW valve CLOSED (conditions not met)`);
            }
        }
    }
    else if (!isOccupied) {
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Cooling disabled (unoccupied mode)`);
    }
    else if (freezestatTripped) {
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Cooling disabled (safety protection)`);
    }
    // No need for step 7 fan determination since we moved it to step 6
    // Return the final control values
    const result = {
        heatingValvePosition: 0, // No heating for Hopebridge AHUs
        coolingValvePosition: coolingValvePosition,
        fanEnabled: fanEnabled,
        fanSpeed: fanSpeed,
        outdoorDamperPosition: outdoorDamperPosition,
        supplyAirTempSetpoint: supplySetpoint,
        temperatureSetpoint: 72, // Standard room temp setpoint
        unitEnable: true, // Keep unit enabled for control
        dxEnabled: dxEnabled, // DX cooling status (AHU-2 only)
        cwCircPumpEnabled: cwCircPumpEnabled, // CW circulation pump status (AHU-1 only)
        chillerEnabled: chillerEnabled, // Chiller status (AHU-1 only)
        isOccupied: isOccupied, // Return occupancy state
        stateStorage: stateStorage // Return the updated state storage
    };
    // ADDED CODE: Force explicit fan command to be stored in the database for AHU-2 and AHU-3
    if (ahuNumber === 2 || ahuNumber === 3) {
        // Explicitly create a command to ensure fan state is persisted in the database
        try {
            // Use Node-RED global context to store a command that should be sent to the database
            if (global && typeof global.set === 'function') {
                const fanCommand = {
                    command_type: 'fanEnabled',
                    equipment_id: equipmentId,
                    value: fanEnabled,
                    timestamp: new Date().toISOString()
                };
                // Store the command in a well-known location that your command processing can access
                global.set(`fanCommand_${equipmentId}`, fanCommand);
                // Add message to the environment to ensure this gets processed
                if (settings && settings.context) {
                    settings.context.fanCommand = fanCommand;
                }
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `FORCED FAN COMMAND for AHU-${ahuNumber}: fanEnabled=${fanEnabled ? "ON" : "OFF"}`);
            }
        }
        catch (cmdError) {
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Error forcing fan command: ${cmdError.message}`);
        }
    }
    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Final control values: fan=${result.fanEnabled ? "ON" : "OFF"}, ` +
        `cooling=${result.coolingValvePosition}%, OA damper=${result.outdoorDamperPosition}%, ` +
        `isOccupied=${result.isOccupied}, ` +
        (ahuNumber === 1 ?
            `CW pump=${result.cwCircPumpEnabled ? "ON" : "OFF"}, Chiller=${result.chillerEnabled ? "ON" : "OFF"}` :
            (ahuNumber === 2 ?
                `DX=${result.dxEnabled ? "ON" : "OFF"}` :
                `CW valve=${result.coolingValvePosition}%`)), result);
    return result;
}
/**
 * Determine the AHU number from the equipment ID
 */
function getAHUNumber(equipmentId) {
    try {
        // Hardcoded mapping for specific equipment IDs
        const equipmentMap = {
            "FDhNArcvkL6v2cZDfuSR": 1, // AHU-1
            "XS60eMHH8DJRXmvIv6wU": 2, // AHU-2
            "57bJYUeT8vbjsKqzo0uD": 3 // AHU-3
        };
        // Check if this equipment ID is in our mapping
        if (equipmentId in equipmentMap) {
            return equipmentMap[equipmentId];
        }
        // Fallback to the original logic for any other equipment IDs
        // Check for AHU-1, AHU-2, or AHU-3 in the ID
        if (equipmentId.includes("AHU-1") || equipmentId.includes("AHU1")) {
            return 1;
        }
        if (equipmentId.includes("AHU-2") || equipmentId.includes("AHU2")) {
            return 2;
        }
        if (equipmentId.includes("AHU-3") || equipmentId.includes("AHU3")) {
            return 3;
        }
        // Try to extract any number from the ID
        const match = equipmentId.match(/(\d+)/);
        if (match) {
            const num = parseInt(match[0], 10);
            // If the number is 1, 2, or 3 use it; otherwise default to 1
            return (num === 1 || num === 2 || num === 3) ? num : 1;
        }
        // Default to AHU-1 if no number found
        return 1;
    }
    catch (error) {
        console.error(`Error determining AHU number: ${error}`);
        return 1;
    }
}
