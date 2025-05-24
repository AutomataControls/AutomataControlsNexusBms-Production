"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.airHandlerControl = airHandlerControl;
// lib/equipment-logic/locations/warren/air-handler.ts
const air_handler_1 = require("../../base/air-handler");
const pid_controller_1 = require("@/lib/pid-controller");
const location_logger_1 = require("@/lib/logging/location-logger");
/**
 * Air Handler Control Logic specifically for Warren
 * - All AHUs have CW and HW heating/cooling
 * - AHU-1: Control source is supply temperature
 * - AHU-2, AHU-4 and AHU-7 (Natatorium): Control source is space temperature
 * - AHU-2: Has two stages of electric baseboard heat enabled when OAT < 65°F
 * - AHU-1, AHU-2, AHU-4: Occupied between 5:30 AM and 8:30 PM, unoccupied mode otherwise
 * - AHU-7 (Natatorium): Constant occupied (no scheduling needed)
 * - In unoccupied mode: Setpoint offset +3.5°F, fan cycles 15 min/hour
 * - Safety trips: 40°F supply/mixed (freezestat) or 115°F supply (high limit)
 * - OA/RA dampers open if OAT > 40°F and safeties are OK
 * - Fan status monitored via current sensors (amps)
 * - Outdoor Air Reset (OAR) for temperature setpoints:
 *   - Supply temp: 76°F at min OAT (32°F), 65-70°F at max OAT (74°F)
 *   - Space temp: 76°F at min OAT (32°F), 71°F at max OAT (74°F)
 */
function airHandlerControl(metrics, settings, currentTemp, pidState) {
    var _a, _b;
    // Initialize state storage if needed
    if (!pidState) {
        pidState = {
            preheatPIDState: {},
            reheatPIDState: {},
            heatingPIDState: {},
            coolingPIDState: {},
            lastFanCycleTime: 0,
            fanCycleState: false,
            // AHU-2 specific state
            stage1HeatState: false,
            stage2HeatState: false,
            stage1HeatTimer: 0,
            stage2HeatTimer: 0
        };
    }
    // Extract equipment ID and location ID for logging
    const equipmentId = settings.equipmentId || "unknown";
    const locationId = settings.locationId || "1"; // Default to Warren (ID: 1)
    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", "Starting Warren-specific air handler control logic");
    // STEP 1: Determine which AHU this is
    const ahuNumber = getAHUNumber(equipmentId);
    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Identified as AHU-${ahuNumber}`);
    // STEP 2: Select appropriate temperature source based on equipment ID
    // Map of equipment IDs to their control sources
    const controlSourceMap = {
        "2JFzwQkC1XwJhUvm09rE": "supply", // AHU-1: supply controlled
        "upkoHEsD5zVaiLFhGfs5": "space", // AHU-2: space controlled
        "3zJm0Nkl1c7EiANkQOay": "space", // AHU-4: space controlled
        "BeZOBmanKJ8iYJESMIYr": "space" // AHU-7: space controlled
    };
    // Determine control source from the map or fall back to AHU-based logic
    let controlSource = controlSourceMap[equipmentId];
    if (!controlSource) {
        // Fallback to AHU-based determination if equipment ID not in map
        controlSource = (ahuNumber === 2 || ahuNumber === 4 || ahuNumber === 7) ? "space" : "supply";
    }
    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Using ${controlSource} control for equipment ID ${equipmentId} (AHU-${ahuNumber})`);
    // Check if there's an inconsistency between controlSource and temperatureSource
    if (settings.controlSource !== settings.temperatureSource) {
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `WARNING: Control source (${settings.controlSource}) doesn't match temperature source (${settings.temperatureSource}). Overriding with ${controlSource} for AHU-${ahuNumber}.`);
    }
    // STEP 3: Get fan status from amp sensors
    const fanAmps = metrics.FanAmps ||
        metrics.fan_amps ||
        metrics.fanAmps ||
        metrics.fan_current ||
        metrics.fanCurrent ||
        0;
    // Check if fan is actually running based on current draw
    const fanRunningAmpsThreshold = 0.5; // Amps threshold to consider fan running
    const fanActuallyRunning = fanAmps > fanRunningAmpsThreshold;
    // Get AHU-2 specific heating stage information
    let heatingStage1Status = false;
    let heatingStage1Amps = 0;
    let heatingStage2Status = false;
    let heatingStage2Amps = 0;
    if (ahuNumber === 2) {
        // Get electric baseboard heater status and amps for AHU-2
        heatingStage1Status = metrics["Heating Stage 1 Status"] || false;
        heatingStage1Amps = metrics["Heating Stage 1 Amps"] || 0;
        heatingStage2Status = metrics["Heating Stage 2 Status"] || false;
        heatingStage2Amps = metrics["Heating Stage 2 Amps"] || 0;
        // Log current heater status
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-2 Electric Heat: Stage 1 ${heatingStage1Status ? "ON" : "OFF"} (${heatingStage1Amps.toFixed(1)}A), ` +
            `Stage 2 ${heatingStage2Status ? "ON" : "OFF"} (${heatingStage2Amps.toFixed(1)}A)`);
    }
    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Fan status: ${fanActuallyRunning ? "RUNNING" : "NOT RUNNING"} (${fanAmps.toFixed(2)} Amps)`);
    if (currentTemp === undefined) {
        if (controlSource === "supply") {
            // For supply-controlled AHUs: Use supply temperature
            let tempSource = "default";
            if (metrics.Supply !== undefined) {
                currentTemp = metrics.Supply;
                tempSource = "Supply";
            }
            else if (metrics.supplyTemperature !== undefined) {
                currentTemp = metrics.supplyTemperature;
                tempSource = "supplyTemperature";
            }
            else if (metrics.SupplyTemp !== undefined) {
                currentTemp = metrics.SupplyTemp;
                tempSource = "SupplyTemp";
            }
            else if (metrics.supplyTemp !== undefined) {
                currentTemp = metrics.supplyTemp;
                tempSource = "supplyTemp";
            }
            else if (metrics.SupplyTemperature !== undefined) {
                currentTemp = metrics.SupplyTemperature;
                tempSource = "SupplyTemperature";
            }
            else if (metrics.SAT !== undefined) {
                currentTemp = metrics.SAT;
                tempSource = "SAT";
            }
            else if (metrics.sat !== undefined) {
                currentTemp = metrics.sat;
                tempSource = "sat";
            }
            else if (metrics.SupplyAirTemp !== undefined) {
                currentTemp = metrics.SupplyAirTemp;
                tempSource = "SupplyAirTemp";
            }
            else if (metrics.supplyAirTemp !== undefined) {
                currentTemp = metrics.supplyAirTemp;
                tempSource = "supplyAirTemp";
            }
            else {
                currentTemp = 55; // Default fallback temperature
                tempSource = "default (55°F)";
            }
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Using supply air temperature: ${currentTemp}°F from source "${tempSource}" (for AHU-${ahuNumber})`);
        }
        else {
            // For space-controlled AHUs: Use space temperature with all Warren-specific room sensors
            let tempSource = "default";
            if (metrics.Space !== undefined) {
                currentTemp = metrics.Space;
                tempSource = "Space";
            }
            else if (metrics.spaceTemperature !== undefined) {
                currentTemp = metrics.spaceTemperature;
                tempSource = "spaceTemperature";
            }
            else if (metrics.SpaceTemp !== undefined) {
                currentTemp = metrics.SpaceTemp;
                tempSource = "SpaceTemp";
            }
            else if (metrics.spaceTemp !== undefined) {
                currentTemp = metrics.spaceTemp;
                tempSource = "spaceTemp";
            }
            else if (metrics.SpaceTemperature !== undefined) {
                currentTemp = metrics.SpaceTemperature;
                tempSource = "SpaceTemperature";
            }
            else if (metrics.roomTemp !== undefined) {
                currentTemp = metrics.roomTemp;
                tempSource = "roomTemp";
            }
            else if (metrics.RoomTemp !== undefined) {
                currentTemp = metrics.RoomTemp;
                tempSource = "RoomTemp";
            }
            else if (metrics.roomTemperature !== undefined) {
                currentTemp = metrics.roomTemperature;
                tempSource = "roomTemperature";
            }
            else if (metrics.RoomTemperature !== undefined) {
                currentTemp = metrics.RoomTemperature;
                tempSource = "RoomTemperature";
            }
            else if (metrics.temperature !== undefined) {
                currentTemp = metrics.temperature;
                tempSource = "temperature";
            }
            else if (metrics.Temperature !== undefined) {
                currentTemp = metrics.Temperature;
                tempSource = "Temperature";
            }
            else if (metrics.coveTemp !== undefined) {
                currentTemp = metrics.coveTemp;
                tempSource = "coveTemp";
            }
            else if (metrics.kitchenTemp !== undefined) {
                currentTemp = metrics.kitchenTemp;
                tempSource = "kitchenTemp";
            }
            else if (metrics.mailRoomTemp !== undefined) {
                currentTemp = metrics.mailRoomTemp;
                tempSource = "mailRoomTemp";
            }
            else if (metrics.chapelTemp !== undefined) {
                currentTemp = metrics.chapelTemp;
                tempSource = "chapelTemp";
            }
            else if (metrics.office1Temp !== undefined) {
                currentTemp = metrics.office1Temp;
                tempSource = "office1Temp";
            }
            else if (metrics.office2Temp !== undefined) {
                currentTemp = metrics.office2Temp;
                tempSource = "office2Temp";
            }
            else if (metrics.office3Temp !== undefined) {
                currentTemp = metrics.office3Temp;
                tempSource = "office3Temp";
            }
            else if (metrics.itRoomTemp !== undefined) {
                currentTemp = metrics.itRoomTemp;
                tempSource = "itRoomTemp";
            }
            else if (metrics.beautyShopTemp !== undefined) {
                currentTemp = metrics.beautyShopTemp;
                tempSource = "beautyShopTemp";
            }
            else if (metrics.natatoriumTemp !== undefined) {
                currentTemp = metrics.natatoriumTemp;
                tempSource = "natatoriumTemp";
            }
            else if (metrics.hall1Temp !== undefined) {
                currentTemp = metrics.hall1Temp;
                tempSource = "hall1Temp";
            }
            else if (metrics.hall2Temp !== undefined) {
                currentTemp = metrics.hall2Temp;
                tempSource = "hall2Temp";
            }
            else {
                currentTemp = 72; // Default fallback temperature for space control
                tempSource = "default (72°F)";
            }
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Using space temperature: ${currentTemp}°F from source "${tempSource}" (for AHU-${ahuNumber})`);
        }
    }
    // STEP 4: Get outdoor and mixed air temperatures with fallbacks
    const outdoorTemp = metrics.Outdoor_Air ||
        metrics.outdoorTemperature ||
        metrics.outdoorTemp ||
        metrics.Outdoor ||
        metrics.outdoor ||
        metrics.OutdoorTemp ||
        metrics.OAT ||
        metrics.oat ||
        65; // Default fallback
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
    // Get supply temperature even if we're using space temperature for control
    // This is needed for safety checks
    const supplyTemp = metrics.Supply ||
        metrics.supplyTemperature ||
        metrics.SupplyTemp ||
        metrics.supplyTemp ||
        metrics.SupplyTemperature ||
        metrics.SAT ||
        metrics.sat ||
        metrics.SupplyAirTemp ||
        metrics.supplyAirTemp ||
        55;
    // STEP 5: Determine occupancy state based on schedule
    // Get current time (converted to Eastern Time for Warren location)
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const currentTimeMinutes = hour * 60 + minute;
    // Define schedule times (5:30 AM to 8:30 PM in minutes)
    const occupiedStartMinutes = 5 * 60 + 30; // 5:30 AM
    const occupiedEndMinutes = 20 * 60 + 30; // 8:30 PM
    // Check if AHU should follow occupancy schedule
    const followsSchedule = ahuNumber === 1 || ahuNumber === 2 || ahuNumber === 4;
    // Determine if currently occupied
    let isOccupied = true; // Default to occupied
    if (followsSchedule) {
        isOccupied = currentTimeMinutes >= occupiedStartMinutes &&
            currentTimeMinutes < occupiedEndMinutes;
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Occupancy: ${isOccupied ? "OCCUPIED" : "UNOCCUPIED"} (Current time: ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')})`);
    }
    else {
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", "Occupancy: Always OCCUPIED (This AHU does not follow occupancy schedule)");
    }
    // STEP 6: Handle fan cycling in unoccupied mode
    let fanEnabled = true; // Default to enabled
    let fanSpeed = "medium"; // Default fan speed
    if (!isOccupied && followsSchedule) {
        // Fan cycling in unoccupied mode (15 minutes on, 45 minutes off)
        const currentTimeMs = now.getTime();
        const hourInMs = 60 * 60 * 1000;
        const cycleTimeMs = currentTimeMs % hourInMs;
        const fifteenMinutesMs = 15 * 60 * 1000;
        // Fan on for first 15 minutes of each hour
        fanEnabled = cycleTimeMs < fifteenMinutesMs;
        // Calculate remaining time
        const remainingTime = fanEnabled
            ? fifteenMinutesMs - cycleTimeMs
            : hourInMs - cycleTimeMs;
        const remainingMinutes = Math.floor(remainingTime / (60 * 1000));
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Unoccupied fan cycling: Fan ${fanEnabled ? "ON" : "OFF"} (${remainingMinutes} minutes until next change)`);
        // Store fan state for next cycle
        pidState.fanCycleState = fanEnabled;
        pidState.lastFanCycleTime = currentTimeMs;
    }
    // STEP 7: Calculate setpoint using Outdoor Air Reset (OAR) and apply occupancy offset
    let setpoint = settings.temperatureSetpoint;
    // Check for user-modified setpoint in metrics
    const userSetpoint = metrics.temperatureSetpoint ||
        metrics.temperature_setpoint ||
        metrics.control_value ||
        metrics.command;
    if (userSetpoint !== undefined) {
        setpoint = userSetpoint;
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Using user-modified setpoint: ${setpoint}°F (overriding OAR setpoint)`);
    }
    else {
        // Get OAR setpoints based on control source
        const minOAT = 32; // Minimum outdoor air temperature
        const maxOAT = 74; // Maximum outdoor air temperature
        // Default setpoint ranges - will be adjusted based on AHU
        let maxSetpoint, minSetpoint;
        if (controlSource === "supply") {
            // Supply temperature OAR defaults
            maxSetpoint = 76; // Maximum supply air setpoint (when OAT = minOAT)
            minSetpoint = 65; // Minimum supply air setpoint (when OAT = maxOAT)
            // Adjust setpoints based on AHU number
            if (ahuNumber === 2) {
                minSetpoint = 70; // AHU-2 needs higher minimum setpoint
            }
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `OAR parameters for supply control: Max=${maxSetpoint}°F at ${minOAT}°F OAT, Min=${minSetpoint}°F at ${maxOAT}°F OAT`);
        }
        else {
            // Space temperature OAR defaults
            maxSetpoint = 76; // Maximum space temperature setpoint (when OAT = minOAT)
            minSetpoint = 71; // Minimum space temperature setpoint (when OAT = maxOAT)
            // Adjust setpoints for Natatorium (AHU-7)
            if (ahuNumber === 7) {
                maxSetpoint = 87; // Natatorium needs higher maximum setpoint
                minSetpoint = 83; // Natatorium needs higher minimum setpoint
            }
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `OAR parameters for space control: Max=${maxSetpoint}°F at ${minOAT}°F OAT, Min=${minSetpoint}°F at ${maxOAT}°F OAT`);
        }
        // Calculate setpoint based on outdoor temperature
        if (outdoorTemp <= minOAT) {
            setpoint = maxSetpoint;
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `OAR: OAT ${outdoorTemp}°F <= ${minOAT}°F, using max ${controlSource} setpoint: ${setpoint}°F`);
        }
        else if (outdoorTemp >= maxOAT) {
            setpoint = minSetpoint;
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `OAR: OAT ${outdoorTemp}°F >= ${maxOAT}°F, using min ${controlSource} setpoint: ${setpoint}°F`);
        }
        else {
            // Linear interpolation for values between min and max
            const ratio = (outdoorTemp - minOAT) / (maxOAT - minOAT);
            setpoint = maxSetpoint - ratio * (maxSetpoint - minSetpoint);
            setpoint = parseFloat(setpoint.toFixed(1)); // Round to 1 decimal place
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `OAR: Calculated ${controlSource} setpoint: ${setpoint}°F (ratio: ${ratio.toFixed(2)})`);
        }
    }
    // Apply unoccupied offset if applicable
    if (!isOccupied && followsSchedule) {
        const unoccupiedOffset = 3.5; // Raise setpoint by 3.5°F in unoccupied mode
        const originalSetpoint = setpoint;
        setpoint += unoccupiedOffset;
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Applied unoccupied offset: ${originalSetpoint}°F + ${unoccupiedOffset}°F = ${setpoint}°F`);
    }
    // Log current temperature vs setpoint for control purposes
    if (controlSource === "space") {
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Current space temperature: ${currentTemp}°F (Current setpoint: ${setpoint}°F, Error: ${(setpoint - currentTemp).toFixed(1)}°F)`);
    }
    else {
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Current supply temperature: ${currentTemp}°F (Current setpoint: ${setpoint}°F, Error: ${(setpoint - currentTemp).toFixed(1)}°F)`);
    }
    // STEP 8: Check safety conditions
    let safetyTripped = false;
    let safetyReason = "";
    // SAFETY CHECK 1: Freezestat (supply or mixed air < 40°F)
    const freezestatTripped = supplyTemp < 40 || mixedAirTemp < 40;
    if (freezestatTripped) {
        safetyTripped = true;
        safetyReason = "freezestat";
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `SAFETY: FREEZESTAT TRIPPED! Supply: ${supplyTemp}°F, Mixed: ${mixedAirTemp}°F`);
    }
    // SAFETY CHECK 2: High limit (supply air > 115°F)
    const highLimitTripped = supplyTemp > 115;
    if (highLimitTripped) {
        safetyTripped = true;
        safetyReason = "highlimit";
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `SAFETY: HIGH LIMIT TRIPPED! Supply: ${supplyTemp}°F`);
    }
    // STEP 9: Apply safety controls if needed
    if (safetyTripped) {
        // Turn off electric heat stages for AHU-2 safety
        let heatingStage1Command = false;
        let heatingStage2Command = false;
        let result = {
            heatingValvePosition: 0,
            coolingValvePosition: 0,
            fanEnabled: true,
            fanSpeed: "medium",
            outdoorDamperPosition: 0, // Close OA dampers on safety trip
            supplyAirTempSetpoint: setpoint,
            temperatureSetpoint: setpoint,
            unitEnable: true,
            safetyTripped: safetyReason,
            pidState: pidState,
            isOccupied: isOccupied,
            // AHU-2 specific outputs
            heatingStage1Command: heatingStage1Command,
            heatingStage2Command: heatingStage2Command
        };
        // For freezestat: Open heating valve, close cooling valve, turn off fan
        if (safetyReason === "freezestat") {
            result.heatingValvePosition = 100; // Open HW valve fully
            result.fanEnabled = false; // Turn off fan on freezestat
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", "Freezestat response: HW valve open, fan disabled, OA dampers closed");
        }
        // For high limit: Close heating valve, open cooling valve if needed
        if (safetyReason === "highlimit") {
            result.heatingValvePosition = 0; // Close HW valve
            result.coolingValvePosition = 100; // Open CW valve fully
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", "High limit response: HW valve closed, CW valve open");
        }
        return result;
    }
    // STEP 10: Determine outdoor damper position
    let outdoorDamperPosition = 0;
    // Open dampers if OAT > 40°F and no safety issues - but close if unoccupied
    if (outdoorTemp > 40 && !safetyTripped && isOccupied) {
        outdoorDamperPosition = 100; // Fully open
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `OA damper: OPEN (OAT ${outdoorTemp}°F > 40°F and safeties OK)`);
    }
    else {
        if (outdoorTemp <= 40) {
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `OA damper: CLOSED (OAT ${outdoorTemp}°F <= 40°F)`);
        }
        else if (!isOccupied) {
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `OA damper: CLOSED (unoccupied mode)`);
        }
        else {
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `OA damper: CLOSED (safety tripped: ${safetyReason})`);
        }
    }
    // STEP 11: Set up AHU-specific PID controllers and parameters
    let pidSettings = {
        cooling: {
            kp: 1.7, // Proportional gain
            ki: 0.15, // Integral gain
            kd: 0.01, // Derivative gain
            enabled: true, // Ensure PID is enabled
            outputMin: 0, // 0% = 0V (valve closed)
            outputMax: 100, // 100% = 10V (valve open)
            reverseActing: false, // Direct acting for cooling
            maxIntegral: 15 // Anti-windup parameter
        },
        heating: {
            kp: 0.8, // Proportional gain
            ki: 0.14, // Integral gain
            kd: 0.02, // Derivative gain
            enabled: true, // Ensure PID is enabled
            outputMin: 0, // 0% = 0V (valve closed)
            outputMax: 100, // 100% = 10V (valve open)
            reverseActing: true, // Reverse acting for heating
            maxIntegral: 15 // Anti-windup parameter
        }
    };
    // AHU-specific PID tuning
    if (ahuNumber === 4) {
        // AHU-4 (Space-controlled): Adjust PID parameters
        pidSettings.heating.kp = 1.0;
        pidSettings.heating.ki = 0.1;
        pidSettings.cooling.kp = 1.0;
        pidSettings.cooling.ki = 0.1;
    }
    else if (ahuNumber === 7) {
        // AHU-7 (Natatorium): Specialized settings
        pidSettings.heating.kp = 1.2;
        pidSettings.heating.ki = 0.2;
        pidSettings.heating.kd = 0.02;
        // Optional: Custom PID settings for preheat/reheat if needed
        if (!pidState.preheatPIDState) {
            pidState.preheatPIDState = {};
        }
        if (!pidState.reheatPIDState) {
            pidState.reheatPIDState = {};
        }
        // For AHU-7 specific logic with multiple heating stages
        if (ahuNumber === 7) {
            // Calculate preheat output using PID controller
            const preheatOutput = (0, pid_controller_1.pidControllerImproved)({
                input: currentTemp,
                setpoint: setpoint,
                pidParams: {
                    kp: 1.2,
                    ki: 0.2,
                    kd: 0.02,
                    enabled: true,
                    outputMin: 0,
                    outputMax: 100,
                    reverseActing: true,
                    maxIntegral: 15
                },
                dt: 1,
                controllerType: "heating",
                pidState: pidState.preheatPIDState
            });
            // Calculate reheat output using PID controller
            const reheatOutput = (0, pid_controller_1.pidControllerImproved)({
                input: currentTemp,
                setpoint: setpoint,
                pidParams: {
                    kp: 0.8,
                    ki: 0.15,
                    kd: 0.01,
                    enabled: true,
                    outputMin: 0,
                    outputMax: 100,
                    reverseActing: true,
                    maxIntegral: 15
                },
                dt: 1,
                controllerType: "heating",
                pidState: pidState.reheatPIDState
            });
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-7: Preheat output: ${preheatOutput.output.toFixed(1)}%, Reheat output: ${reheatOutput.output.toFixed(1)}%`);
            // Use maximum of preheat and reheat outputs
            const maxHeatingOutput = Math.max(preheatOutput.output, reheatOutput.output);
            // Create a base result for AHU-7
            const ahu7Result = {
                heatingValvePosition: maxHeatingOutput,
                coolingValvePosition: 0, // No cooling for natatorium
                fanEnabled: true,
                fanSpeed: "medium",
                outdoorDamperPosition: outdoorDamperPosition,
                supplyAirTempSetpoint: setpoint,
                temperatureSetpoint: setpoint,
                unitEnable: true,
                pidState: pidState,
                controlSource: controlSource,
                temperatureSource: controlSource,
                isOccupied: isOccupied // Always occupied for AHU-7
            };
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Final control values for AHU-7: fan=${ahu7Result.fanEnabled ? "ON" : "OFF"} (${fanAmps.toFixed(2)}A), ` +
                `heating=${ahu7Result.heatingValvePosition.toFixed(1)}%, cooling=${ahu7Result.coolingValvePosition}%, ` +
                `damper=${ahu7Result.outdoorDamperPosition}%`, ahu7Result);
            return ahu7Result;
        }
    }
    // STEP 12: Handle AHU-2 with electric baseboard heaters
    let heatingStage1Command = false;
    let heatingStage2Command = false;
    let heatingValvePosition = 0;
    let coolingValvePosition = 0;
    if (ahuNumber === 2) {
        // Calculate heating and cooling demand using PID
        const heatingPID = (0, pid_controller_1.pidControllerImproved)({
            input: currentTemp,
            setpoint: setpoint,
            pidParams: pidSettings.heating,
            dt: 1,
            controllerType: "heating",
            pidState: pidState.heatingPIDState
        });
        const coolingPID = (0, pid_controller_1.pidControllerImproved)({
            input: currentTemp,
            setpoint: setpoint,
            pidParams: pidSettings.cooling,
            dt: 1,
            controllerType: "cooling",
            pidState: pidState.coolingPIDState
        });
        heatingValvePosition = heatingPID.output;
        coolingValvePosition = coolingPID.output;
        // Add detailed PID logging
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-2 PID: Space temp=${currentTemp}°F, Setpoint=${setpoint}°F, ` +
            `Error=${(setpoint - currentTemp).toFixed(1)}°F, ` +
            `Heating output=${heatingValvePosition.toFixed(1)}%, Cooling output=${coolingValvePosition.toFixed(1)}%`);
        // Determine if electric heat should be enabled (when OAT < 65°F)
        const shouldEnableElectricHeat = outdoorTemp < 65 && isOccupied && fanActuallyRunning;
        if (shouldEnableElectricHeat) {
            // Stage 1 electric heat: Activate when heating demand > 30%
            heatingStage1Command = heatingValvePosition > 30;
            // Stage 2 electric heat: Activate when heating demand > 75%
            heatingStage2Command = heatingValvePosition > 75;
            // Log electric heat staging
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-2 Electric Heat: Stage 1 ${heatingStage1Command ? "ON" : "OFF"}, ` +
                `Stage 2 ${heatingStage2Command ? "ON" : "OFF"} (Heating demand: ${heatingValvePosition.toFixed(1)}%)`);
            // If electric heat is active, reduce heating valve position proportionally
            // This prevents overheating when both hydronic and electric heat are active
            if (heatingStage1Command || heatingStage2Command) {
                // Determine how much to reduce hydronic heating
                const reductionFactor = heatingStage2Command ? 0.75 : 0.5; // 75% reduction if stage 2 is on, 50% if only stage 1
                const originalHeatingValve = heatingValvePosition;
                heatingValvePosition = heatingValvePosition * (1 - reductionFactor);
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Reducing hydronic heating due to active electric heat: ${originalHeatingValve.toFixed(1)}% → ${heatingValvePosition.toFixed(1)}%`);
            }
        }
        else {
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-2 Electric Heat: DISABLED (OAT: ${outdoorTemp.toFixed(1)}°F, Occupied: ${isOccupied}, Fan running: ${fanActuallyRunning})`);
        }
        // Create AHU-2 specific result
        const ahu2Result = {
            heatingValvePosition: heatingValvePosition,
            coolingValvePosition: coolingValvePosition,
            fanEnabled: fanEnabled,
            fanSpeed: fanEnabled ? "medium" : "off",
            outdoorDamperPosition: outdoorDamperPosition,
            supplyAirTempSetpoint: setpoint,
            temperatureSetpoint: setpoint,
            unitEnable: true,
            pidState: pidState,
            controlSource: controlSource,
            temperatureSource: controlSource,
            isOccupied: isOccupied,
            // AHU-2 specific outputs
            heatingStage1Command: heatingStage1Command,
            heatingStage2Command: heatingStage2Command,
            actualFanRunning: fanActuallyRunning
        };
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Final control values for AHU-2: fan=${ahu2Result.fanEnabled ? "ON" : "OFF"} (${fanAmps.toFixed(2)}A), ` +
            `heating=${ahu2Result.heatingValvePosition.toFixed(1)}%, cooling=${ahu2Result.coolingValvePosition.toFixed(1)}%, ` +
            `elec heat 1=${heatingStage1Command ? "ON" : "OFF"}, elec heat 2=${heatingStage2Command ? "ON" : "OFF"}, ` +
            `damper=${ahu2Result.outdoorDamperPosition}%`, ahu2Result);
        // If this is AHU-2, return the specialized result
        if (ahuNumber === 2) {
            return ahu2Result;
        }
    }
    // STEP 13: Create Warren-specific settings
    const warrenSettings = {
        ...settings,
        temperatureSetpoint: setpoint,
        // Force both control source and temperature source to be consistent
        controlSource: controlSource,
        temperatureSource: controlSource, // Make this match controlSource
        pidControllers: {
            cooling: {
                ...(((_a = settings.pidControllers) === null || _a === void 0 ? void 0 : _a.cooling) || {}),
                ...pidSettings.cooling
            },
            heating: {
                ...(((_b = settings.pidControllers) === null || _b === void 0 ? void 0 : _b.heating) || {}),
                ...pidSettings.heating
            }
        }
    };
    // If this is AHU-1 or AHU-2 but we're getting room temperature rather than supply,
    // log a warning and adjust the control temp to use the supply temperature
    if (controlSource === "supply" && currentTemp !== supplyTemp) {
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `WARNING: AHU-${ahuNumber} should use supply temp but is using ${currentTemp}°F. Correcting to supply temp ${supplyTemp}°F`);
        currentTemp = supplyTemp;
    }
    // Don't call base implementation if fan is off in unoccupied mode
    if (!fanEnabled) {
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", "Fan off in unoccupied mode, skipping base implementation");
        const unoccupiedResult = {
            heatingValvePosition: 0,
            coolingValvePosition: 0,
            fanEnabled: false,
            fanSpeed: "off",
            outdoorDamperPosition: 0, // Close dampers when fan is off
            supplyAirTempSetpoint: setpoint,
            temperatureSetpoint: setpoint,
            unitEnable: true,
            pidState: pidState,
            controlSource: controlSource,
            temperatureSource: controlSource,
            isOccupied: isOccupied,
            actualFanRunning: fanActuallyRunning
        };
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Final control values (unoccupied): fan=OFF, heating=0%, cooling=0%, damper=0%`, unoccupiedResult);
        return unoccupiedResult;
    }
    // STEP 14: Call base implementation with Warren-specific settings
    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", "Calling base implementation with Warren-specific settings");
    const baseResult = (0, air_handler_1.airHandlerControl)(metrics, warrenSettings, currentTemp, pidState);
    // STEP 15: Override the result with our calculated OA damper position and ensure control source is consistent
    const result = {
        ...baseResult,
        outdoorDamperPosition: outdoorDamperPosition,
        controlSource: controlSource,
        temperatureSource: controlSource, // Ensure this is consistent with controlSource
        pidState: pidState,
        fanEnabled: fanEnabled, // Override with our fan status
        fanSpeed: fanEnabled ? baseResult.fanSpeed : "off", // Set fan speed to "off" if fan is disabled
        isOccupied: isOccupied, // Add occupancy state to result
        actualFanRunning: fanActuallyRunning // Add actual fan status based on current sensor
    };
    // Log final control values
    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Final control values: fan=${result.fanEnabled ? "ON" : "OFF"} (${fanAmps.toFixed(2)}A), ` +
        `heating=${result.heatingValvePosition}%, cooling=${result.coolingValvePosition}%, ` +
        `damper=${result.outdoorDamperPosition}%`, result);
    return result;
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
        "BeZOBmanKJ8iYJESMIYr": 7 // AHU-7 (Natatorium)
    };
    // Check if the equipment ID exists in our map
    if (equipmentMap[equipmentId] !== undefined) {
        return equipmentMap[equipmentId];
    }
    try {
        // Fallback to the original logic if equipment ID is not in our map
        // Check for AHU-1, AHU-2, AHU-4, or AHU-7 in the ID
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
            // If the number is 1, 2, 4, or 7, use it; otherwise default to 1
            return [1, 2, 4, 7].includes(num) ? num : 1;
        }
        // Default to AHU-1 if no number found
        return 1;
    }
    catch (error) {
        console.error(`Error determining AHU number: ${error}`);
        return 1;
    }
}
