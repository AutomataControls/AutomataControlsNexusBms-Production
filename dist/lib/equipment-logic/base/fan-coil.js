"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fanCoilControl = fanCoilControl;
/**
 * Fan Coil Control Logic
 * This function implements control logic for fan coil units with location-based temperature source selection
 */
const pid_controller_1 = require("@/lib/pid-controller");
function fanCoilControl(metrics, settings, currentTemp, pidState) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15, _16, _17, _18, _19, _20, _21, _22, _23, _24;
    // If currentTemp is provided (from location-based selection), use it
    // Otherwise fall back to the extensive fallback chain
    if (currentTemp === undefined) {
        // Get current temperatures with proper fallbacks - expanded to include more naming variations
        // First check for Supply temperature which is the primary source for Huntington
        if (metrics.Supply !== undefined) {
            currentTemp = metrics.Supply;
            console.log(`Using Supply temperature: ${currentTemp}°F from metrics.Supply`);
        }
        // Then check for measurement which contains the temperature in the database view
        else if (metrics.measurement !== undefined) {
            currentTemp = metrics.measurement;
            console.log(`Using measurement temperature: ${currentTemp}°F from metrics.measurement`);
        }
        // Then try all the other possible field names
        else {
            currentTemp =
                metrics.SupplyTemp ||
                    metrics.supplyTemp ||
                    metrics.supplyTemperature ||
                    metrics.SupplyTemperature ||
                    metrics.discharge ||
                    metrics.Discharge ||
                    metrics.dischargeTemp ||
                    metrics.DischargeTemp ||
                    metrics.dischargeTemperature ||
                    metrics.DischargeTemperature ||
                    metrics.SAT ||
                    metrics.sat ||
                    metrics.SupplyAirTemp ||
                    metrics.supplyAirTemp ||
                    metrics.roomTemp ||
                    metrics.RoomTemp ||
                    metrics.roomTemperature ||
                    metrics.RoomTemperature ||
                    metrics.coveTemp ||
                    metrics.chapelTemp ||
                    metrics.kitchenTemp ||
                    metrics.mailRoomTemp ||
                    metrics.spaceTemp ||
                    metrics.SpaceTemp ||
                    metrics.zoneTemp ||
                    metrics.ZoneTemp ||
                    metrics.ZoneTemperature ||
                    metrics.zone_temperature ||
                    metrics.room_temperature ||
                    72;
            // Log which temperature field was actually used
            const usedField = Object.keys(metrics).find((key) => metrics[key] === currentTemp &&
                key !== "outdoorTemperature" &&
                key !== "outdoorTemp" &&
                key !== "OutdoorTemp" &&
                key !== "OAT");
            console.log(`Temperature source field: ${usedField || "default value"}, Value: ${currentTemp}°F`);
        }
    }
    // Log equipment ID and system for debugging
    console.log(`Fan Coil Control for Equipment ID: ${settings.equipmentId}, System: ${metrics.system || "unknown"}`);
    console.log(`Current temperature: ${currentTemp}°F, Supply: ${metrics.Supply || "N/A"}°F, Measurement: ${metrics.measurement || "N/A"}°F`);
    // Validate temperature values
    if (isNaN(currentTemp) || !isFinite(currentTemp)) {
        console.error(`Invalid current temperature: ${currentTemp} - using default of 72°F`);
        currentTemp = 72;
    }
    // Get and validate setpoint
    let setpoint = settings.temperatureSetpoint || 72; // Use existing setpoint or default to 72
    if (isNaN(setpoint) || !isFinite(setpoint)) {
        console.error(`Invalid temperature setpoint: ${setpoint} - using default of 72°F`);
        setpoint = 72;
    }
    // Check for unreasonable setpoint values
    if (setpoint < 55 || setpoint > 85) {
        console.warn(`Temperature setpoint outside normal range: ${setpoint}°F - clamping to reasonable range`);
        setpoint = Math.max(55, Math.min(85, setpoint));
    }
    const deadband = 1; // Deadband of 1°F for responsive control
    console.log("Current temp:", currentTemp, "Setpoint:", setpoint);
    // Determine if we need heating or cooling based on the temperature difference
    let operationMode = settings.operationMode;
    // If in auto mode, determine whether to heat or cool
    if (operationMode === "auto") {
        if (currentTemp < setpoint - deadband) {
            operationMode = "heating";
            console.log("Auto mode selected heating");
        }
        else if (currentTemp > setpoint + deadband) {
            operationMode = "cooling";
            console.log("Auto mode selected cooling");
        }
        else {
            console.log("Auto mode - within deadband, maintaining current state");
        }
    }
    console.log("Operating in mode:", operationMode);
    // Get outdoor temperature with fallbacks
    const outdoorTemp = metrics.Outdoor_Air || // From the database view
        metrics.outdoorTemperature ||
        metrics.outdoorTemp ||
        metrics.Outdoor ||
        metrics.outdoor ||
        metrics.OutdoorTemp ||
        metrics.OutdoorAir ||
        metrics.outdoorAir ||
        metrics.outdoorAirTemp ||
        metrics.OutdoorAirTemp ||
        metrics.OutdoorAirTemperature ||
        metrics.outdoorAirTemperature ||
        metrics.outdoor_temperature ||
        metrics.outdoor_temp ||
        metrics.outdoor_air_temp ||
        metrics.outdoor_air_temperature ||
        metrics.OAT ||
        metrics.oat ||
        metrics.OutsideAirTemp ||
        metrics.outsideAirTemp ||
        metrics.OutsideTemp ||
        metrics.outsideTemp ||
        85;
    // Set outdoor damper position
    let outdoorDamperPosition = 0;
    // Determine outdoor damper position based on temperature
    if (outdoorTemp > 40 && outdoorTemp < 80) {
        outdoorDamperPosition = 20; // 20% open when temp is moderate
    }
    // Get PID settings from the settings object if available, otherwise use defaults
    const pidSettings = {
        cooling: {
            kp: (_c = (_b = (_a = settings.pidControllers) === null || _a === void 0 ? void 0 : _a.cooling) === null || _b === void 0 ? void 0 : _b.kp) !== null && _c !== void 0 ? _c : 0.5, // Proportional gain
            ki: (_f = (_e = (_d = settings.pidControllers) === null || _d === void 0 ? void 0 : _d.cooling) === null || _e === void 0 ? void 0 : _e.ki) !== null && _f !== void 0 ? _f : 0.03, // Integral gain - REDUCED to prevent windup
            kd: (_j = (_h = (_g = settings.pidControllers) === null || _g === void 0 ? void 0 : _g.cooling) === null || _h === void 0 ? void 0 : _h.kd) !== null && _j !== void 0 ? _j : 0.05, // Derivative gain
            outputMin: (_m = (_l = (_k = settings.pidControllers) === null || _k === void 0 ? void 0 : _k.cooling) === null || _l === void 0 ? void 0 : _l.outputMin) !== null && _m !== void 0 ? _m : 0,
            outputMax: (_q = (_p = (_o = settings.pidControllers) === null || _o === void 0 ? void 0 : _o.cooling) === null || _p === void 0 ? void 0 : _p.outputMax) !== null && _q !== void 0 ? _q : 100,
            enabled: (_t = (_s = (_r = settings.pidControllers) === null || _r === void 0 ? void 0 : _r.cooling) === null || _s === void 0 ? void 0 : _s.enabled) !== null && _t !== void 0 ? _t : true,
            reverseActing: (_w = (_v = (_u = settings.pidControllers) === null || _u === void 0 ? void 0 : _u.cooling) === null || _v === void 0 ? void 0 : _v.reverseActing) !== null && _w !== void 0 ? _w : false, // Default to direct acting for cooling
            maxIntegral: (_z = (_y = (_x = settings.pidControllers) === null || _x === void 0 ? void 0 : _x.cooling) === null || _y === void 0 ? void 0 : _y.maxIntegral) !== null && _z !== void 0 ? _z : 10, // FIXED maximum integral value
        },
        heating: {
            kp: (_2 = (_1 = (_0 = settings.pidControllers) === null || _0 === void 0 ? void 0 : _0.heating) === null || _1 === void 0 ? void 0 : _1.kp) !== null && _2 !== void 0 ? _2 : 0.5, // Proportional gain
            ki: (_5 = (_4 = (_3 = settings.pidControllers) === null || _3 === void 0 ? void 0 : _3.heating) === null || _4 === void 0 ? void 0 : _4.ki) !== null && _5 !== void 0 ? _5 : 0.03, // Integral gain - REDUCED to prevent windup
            kd: (_8 = (_7 = (_6 = settings.pidControllers) === null || _6 === void 0 ? void 0 : _6.heating) === null || _7 === void 0 ? void 0 : _7.kd) !== null && _8 !== void 0 ? _8 : 0.05, // Derivative gain
            outputMin: (_11 = (_10 = (_9 = settings.pidControllers) === null || _9 === void 0 ? void 0 : _9.heating) === null || _10 === void 0 ? void 0 : _10.outputMin) !== null && _11 !== void 0 ? _11 : 0,
            outputMax: (_14 = (_13 = (_12 = settings.pidControllers) === null || _12 === void 0 ? void 0 : _12.heating) === null || _13 === void 0 ? void 0 : _13.outputMax) !== null && _14 !== void 0 ? _14 : 100,
            enabled: (_17 = (_16 = (_15 = settings.pidControllers) === null || _15 === void 0 ? void 0 : _15.heating) === null || _16 === void 0 ? void 0 : _16.enabled) !== null && _17 !== void 0 ? _17 : true,
            reverseActing: (_20 = (_19 = (_18 = settings.pidControllers) === null || _18 === void 0 ? void 0 : _18.heating) === null || _19 === void 0 ? void 0 : _19.reverseActing) !== null && _20 !== void 0 ? _20 : true, // Default to reverse acting for heating
            maxIntegral: (_23 = (_22 = (_21 = settings.pidControllers) === null || _21 === void 0 ? void 0 : _21.heating) === null || _22 === void 0 ? void 0 : _22.maxIntegral) !== null && _23 !== void 0 ? _23 : 10, // FIXED maximum integral value
        },
    };
    // Check for setpoint changes that would require resetting the integral term
    const controllerKey = operationMode === "cooling" ? "cooling" : "heating";
    const previousSetpoint = (_24 = pidState === null || pidState === void 0 ? void 0 : pidState[controllerKey]) === null || _24 === void 0 ? void 0 : _24.lastSetpoint;
    const setpointChanged = previousSetpoint !== undefined && Math.abs(setpoint - previousSetpoint) > 0.5;
    if (setpointChanged) {
        console.log(`Setpoint changed from ${previousSetpoint}°F to ${setpoint}°F - resetting integral term`);
        if (pidState === null || pidState === void 0 ? void 0 : pidState[controllerKey]) {
            pidState[controllerKey].integral = 0;
        }
    }
    // Use PID controller for cooling valve
    if (operationMode === "cooling") {
        // Only use PID if enabled
        if (pidSettings.cooling.enabled) {
            // For cooling, we want:
            // - Higher temp than setpoint -> MORE cooling -> valve MORE open
            // - Lower temp than setpoint -> LESS cooling -> valve LESS open
            const coolingPID = (0, pid_controller_1.pidControllerImproved)({
                input: currentTemp,
                setpoint: setpoint,
                pidParams: pidSettings.cooling,
                dt: 1, // FIXED: Reduced from 5 to 1 to prevent excessive integral accumulation
                controllerType: "cooling",
                pidState: pidState,
            });
            // Log the relationship for clarity
            const tempDiff = currentTemp - setpoint;
            console.log(`Cooling: Temp diff (current - setpoint) = ${tempDiff.toFixed(2)}°F, Valve position = ${coolingPID.output.toFixed(2)}%`);
            if (tempDiff > 0) {
                console.log(`Room too warm (${currentTemp}°F > ${setpoint}°F): Opening cooling valve to ${coolingPID.output.toFixed(2)}%`);
            }
            else if (tempDiff < 0) {
                console.log(`Room too cool (${currentTemp}°F < ${setpoint}°F): Closing cooling valve to ${coolingPID.output.toFixed(2)}%`);
            }
            // Store the current setpoint for change detection
            if (pidState === null || pidState === void 0 ? void 0 : pidState.cooling) {
                pidState.cooling.lastSetpoint = setpoint;
            }
            return {
                coolingValvePosition: coolingPID.output,
                heatingValvePosition: 0,
                fanEnabled: true,
                fanSpeed: "medium",
                outdoorDamperPosition: outdoorDamperPosition,
                temperatureSetpoint: setpoint,
                unitEnable: true,
            };
        }
        else {
            // Simple proportional control if PID disabled
            // For cooling: higher temp = more cooling needed = higher output
            const error = currentTemp - setpoint;
            const coolingOutput = Math.max(0, Math.min(100, error * 10));
            console.log(`Simple cooling control: Temp diff = ${error.toFixed(2)}°F, Valve position = ${coolingOutput.toFixed(2)}%`);
            return {
                coolingValvePosition: coolingOutput,
                heatingValvePosition: 0,
                fanEnabled: true,
                fanSpeed: "medium",
                outdoorDamperPosition: outdoorDamperPosition,
                temperatureSetpoint: setpoint,
                unitEnable: true,
            };
        }
    }
    else if (operationMode === "heating") {
        // Use PID for heating if enabled
        if (pidSettings.heating.enabled) {
            // For heating, we want:
            // - Lower temp than setpoint -> MORE heating -> valve MORE open
            // - Higher temp than setpoint -> LESS heating -> valve LESS open
            const heatingPID = (0, pid_controller_1.pidControllerImproved)({
                input: currentTemp,
                setpoint: setpoint,
                pidParams: pidSettings.heating,
                dt: 1, // FIXED: Reduced from 5 to 1 to prevent excessive integral accumulation
                controllerType: "heating",
                pidState: pidState,
            });
            // Log the relationship for clarity
            const tempDiff = setpoint - currentTemp;
            console.log(`Heating: Temp diff (setpoint - current) = ${tempDiff.toFixed(2)}°F, Valve position = ${heatingPID.output.toFixed(2)}%`);
            if (tempDiff > 0) {
                console.log(`Room too cool (${currentTemp}°F < ${setpoint}°F): Opening heating valve to ${heatingPID.output.toFixed(2)}%`);
            }
            else if (tempDiff < 0) {
                console.log(`Room too warm (${currentTemp}°F > ${setpoint}°F): Closing heating valve to ${heatingPID.output.toFixed(2)}%`);
            }
            // Store the current setpoint for change detection
            if (pidState === null || pidState === void 0 ? void 0 : pidState.heating) {
                pidState.heating.lastSetpoint = setpoint;
            }
            return {
                coolingValvePosition: 0,
                heatingValvePosition: heatingPID.output,
                fanEnabled: true,
                fanSpeed: "medium",
                outdoorDamperPosition: outdoorDamperPosition,
                temperatureSetpoint: setpoint,
                unitEnable: true,
            };
        }
        else {
            // Simple proportional control if PID disabled
            // For heating: lower temp = more heating needed = higher output
            const error = setpoint - currentTemp;
            const heatingOutput = Math.max(0, Math.min(100, error * 10));
            console.log(`Simple heating control: Temp diff = ${error.toFixed(2)}°F, Valve position = ${heatingOutput.toFixed(2)}%`);
            return {
                coolingValvePosition: 0,
                heatingValvePosition: heatingOutput,
                fanEnabled: true,
                fanSpeed: "medium",
                outdoorDamperPosition: outdoorDamperPosition,
                temperatureSetpoint: setpoint,
                unitEnable: true,
            };
        }
    }
    // Default return for within deadband
    return {
        coolingValvePosition: 0,
        heatingValvePosition: 0,
        fanEnabled: true,
        fanSpeed: "low",
        outdoorDamperPosition: outdoorDamperPosition,
        temperatureSetpoint: setpoint,
        unitEnable: true,
    };
}
