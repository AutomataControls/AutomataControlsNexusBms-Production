"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.airHandlerControl = airHandlerControl;
/**
 * Air Handler Control Logic
 * This function implements control logic for air handling units with temperature control, damper control, and economizer logic
 */
const pid_controller_1 = require("@/lib/pid-controller");
function airHandlerControl(metrics, settings, currentTemp, pidState) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15, _16, _17, _18, _19, _20, _21, _22, _23, _24, _25, _26, _27, _28, _29, _30, _31, _32, _33, _34, _35, _36, _37, _38, _39, _40, _41, _42, _43, _44, _45, _46, _47, _48, _49, _50, _51, _52, _53, _54, _55, _56, _57;
    // If currentTemp is provided (from location-based selection), use it
    // Otherwise fall back to extensive fallback chain
    if (currentTemp === undefined) {
        // First check for supply temperature
        if (metrics.Supply !== undefined) {
            currentTemp = metrics.Supply;
            console.log(`Using Supply temperature: ${currentTemp}°F from metrics.Supply`);
        }
        // Then check for measurement which contains the temperature in the database view
        else if (metrics.measurement !== undefined) {
            currentTemp = metrics.measurement;
            console.log(`Using measurement temperature: ${currentTemp}°F from metrics.measurement`);
        }
        // Then try all other possible field names
        else {
            currentTemp =
                metrics.supplyTemperature ||
                    metrics.SupplyTemp ||
                    metrics.supplyTemp ||
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
                    metrics.DischargeAir ||
                    metrics.dischargeAir ||
                    55;
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
    console.log(`Air Handler Control for Equipment ID: ${settings.equipmentId}, System: ${metrics.system || "unknown"}`);
    console.log(`Current temperature: ${currentTemp}°F, Supply: ${metrics.Supply || "N/A"}°F, Measurement: ${metrics.measurement || "N/A"}°F`);
    // Validate temperature values
    if (isNaN(currentTemp) || !isFinite(currentTemp)) {
        console.error(`Invalid current temperature: ${currentTemp} - using default of 55°F`);
        currentTemp = 55;
    }
    // Get and validate supply air temperature setpoint
    let supplySetpoint = settings.supplyAirTempSetpoint || 55; // Use existing setpoint or default to 55°F
    if (isNaN(supplySetpoint) || !isFinite(supplySetpoint)) {
        console.error(`Invalid supply air temperature setpoint: ${supplySetpoint} - using default of 55°F`);
        supplySetpoint = 55;
    }
    // Get room temperature setpoint (used for mode selection in auto mode)
    let roomSetpoint = settings.temperatureSetpoint || 72; // Use existing setpoint or default to 72°F
    if (isNaN(roomSetpoint) || !isFinite(roomSetpoint)) {
        console.error(`Invalid room temperature setpoint: ${roomSetpoint} - using default of 72°F`);
        roomSetpoint = 72;
    }
    // Check for unreasonable setpoint values
    if (supplySetpoint < 45 || supplySetpoint > 80) {
        console.warn(`Supply temperature setpoint outside normal range: ${supplySetpoint}°F - clamping to reasonable range`);
        supplySetpoint = Math.max(45, Math.min(80, supplySetpoint));
    }
    const deadband = 1; // Deadband of 1°F for responsive control
    // Log current temperature and setpoint
    console.log("Current supply temp:", currentTemp, "Supply setpoint:", supplySetpoint);
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
    // Get zone/room temperature with fallbacks
    const roomTemp = metrics.roomTemperature ||
        metrics.roomTemp ||
        metrics.RoomTemp ||
        metrics.RoomTemperature ||
        metrics.Zone ||
        metrics.zone ||
        metrics.ZoneTemp ||
        metrics.zoneTemp ||
        metrics.ZoneTemperature ||
        metrics.zoneTemperature ||
        metrics.space ||
        metrics.spaceTemp ||
        metrics.SpaceTemp ||
        metrics.spaceTemperature ||
        metrics.SpaceTemperature ||
        72; // Default to 72°F if not found
    // High and Low Limit Protection
    const HIGH_LIMIT = 120; // High limit protection temperature
    const LOW_LIMIT = 45; // Low limit protection temperature
    // Safety checks
    if (currentTemp > HIGH_LIMIT) {
        console.log("HIGH LIMIT PROTECTION ACTIVATED");
        // Emergency shutdown
        return {
            heatingValvePosition: 0,
            coolingValvePosition: 100,
            fanEnabled: true,
            fanSpeed: "high",
            outdoorDamperPosition: 100, // Full outdoor air to cool the system
            unitEnable: true, // Keep the unit running to cool down
        };
    }
    if (currentTemp < LOW_LIMIT) {
        console.log("LOW LIMIT PROTECTION ACTIVATED");
        // Emergency heating
        return {
            heatingValvePosition: 100,
            coolingValvePosition: 0,
            fanEnabled: true,
            fanSpeed: "medium",
            outdoorDamperPosition: 0, // Close outdoor air damper
            unitEnable: true, // Keep the unit running to warm up
        };
    }
    // Determine operation mode
    let operationMode = settings.operationMode;
    // FIXED: Check for controlSource setting and use appropriate logic for auto mode
    if (operationMode === "auto") {
        // Check if we should use supply or room temperature for control
        const controlSource = settings.controlSource || "space";
        if (controlSource === "supply") {
            // SUPPLY TEMPERATURE CONTROL
            if (currentTemp < supplySetpoint - deadband) {
                operationMode = "heating";
                console.log(`Auto mode selected heating based on supply temperature: ${currentTemp}°F < ${supplySetpoint - deadband}°F`);
            }
            else if (currentTemp > supplySetpoint + deadband) {
                operationMode = "cooling";
                console.log(`Auto mode selected cooling based on supply temperature: ${currentTemp}°F > ${supplySetpoint + deadband}°F`);
            }
            else {
                // If supply temperature is within deadband, maintain current state
                console.log(`Auto mode - supply temperature within deadband (${supplySetpoint - deadband}°F to ${supplySetpoint + deadband}°F), maintaining current state`);
            }
        }
        else {
            // ROOM TEMPERATURE CONTROL (original logic)
            if (roomTemp < roomSetpoint - deadband) {
                operationMode = "heating";
                console.log(`Auto mode selected heating based on room temperature: ${roomTemp}°F < ${roomSetpoint - deadband}°F`);
            }
            else if (roomTemp > roomSetpoint + deadband) {
                operationMode = "cooling";
                console.log(`Auto mode selected cooling based on room temperature: ${roomTemp}°F > ${roomSetpoint + deadband}°F`);
            }
            else {
                // If room temperature is within deadband, maintain current state
                console.log(`Auto mode - room temperature within deadband (${roomSetpoint - deadband}°F to ${roomSetpoint + deadband}°F), maintaining current state`);
            }
        }
    }
    console.log("Operating in mode:", operationMode);
    // Get unit operating settings
    const unitEnable = settings.unitEnable !== undefined ? settings.unitEnable : true;
    const fanEnabled = settings.fanEnabled !== undefined ? settings.fanEnabled : true;
    const fanSpeed = settings.fanSpeed || "medium";
    const economizerEnabled = settings.economizerEnable || false;
    // Get PID settings from the settings object if available, otherwise use defaults
    const pidSettings = {
        cooling: {
            kp: (_c = (_b = (_a = settings.pidControllers) === null || _a === void 0 ? void 0 : _a.cooling) === null || _b === void 0 ? void 0 : _b.kp) !== null && _c !== void 0 ? _c : 1.0, // Proportional gain
            ki: (_f = (_e = (_d = settings.pidControllers) === null || _d === void 0 ? void 0 : _d.cooling) === null || _e === void 0 ? void 0 : _e.ki) !== null && _f !== void 0 ? _f : 0.1, // Integral gain
            kd: (_j = (_h = (_g = settings.pidControllers) === null || _g === void 0 ? void 0 : _g.cooling) === null || _h === void 0 ? void 0 : _h.kd) !== null && _j !== void 0 ? _j : 0.01, // Derivative gain
            outputMin: (_m = (_l = (_k = settings.pidControllers) === null || _k === void 0 ? void 0 : _k.cooling) === null || _l === void 0 ? void 0 : _l.outputMin) !== null && _m !== void 0 ? _m : 0,
            outputMax: (_q = (_p = (_o = settings.pidControllers) === null || _o === void 0 ? void 0 : _o.cooling) === null || _p === void 0 ? void 0 : _p.outputMax) !== null && _q !== void 0 ? _q : 100,
            enabled: (_t = (_s = (_r = settings.pidControllers) === null || _r === void 0 ? void 0 : _r.cooling) === null || _s === void 0 ? void 0 : _s.enabled) !== null && _t !== void 0 ? _t : true,
            reverseActing: (_w = (_v = (_u = settings.pidControllers) === null || _u === void 0 ? void 0 : _u.cooling) === null || _v === void 0 ? void 0 : _v.reverseActing) !== null && _w !== void 0 ? _w : false, // Direct acting for cooling
            maxIntegral: (_z = (_y = (_x = settings.pidControllers) === null || _x === void 0 ? void 0 : _x.cooling) === null || _y === void 0 ? void 0 : _y.maxIntegral) !== null && _z !== void 0 ? _z : 10, // Maximum integral value
        },
        heating: {
            kp: (_2 = (_1 = (_0 = settings.pidControllers) === null || _0 === void 0 ? void 0 : _0.heating) === null || _1 === void 0 ? void 0 : _1.kp) !== null && _2 !== void 0 ? _2 : 1.0, // Proportional gain
            ki: (_5 = (_4 = (_3 = settings.pidControllers) === null || _3 === void 0 ? void 0 : _3.heating) === null || _4 === void 0 ? void 0 : _4.ki) !== null && _5 !== void 0 ? _5 : 0.1, // Integral gain
            kd: (_8 = (_7 = (_6 = settings.pidControllers) === null || _6 === void 0 ? void 0 : _6.heating) === null || _7 === void 0 ? void 0 : _7.kd) !== null && _8 !== void 0 ? _8 : 0.01, // Derivative gain
            outputMin: (_11 = (_10 = (_9 = settings.pidControllers) === null || _9 === void 0 ? void 0 : _9.heating) === null || _10 === void 0 ? void 0 : _10.outputMin) !== null && _11 !== void 0 ? _11 : 0,
            outputMax: (_14 = (_13 = (_12 = settings.pidControllers) === null || _12 === void 0 ? void 0 : _12.heating) === null || _13 === void 0 ? void 0 : _13.outputMax) !== null && _14 !== void 0 ? _14 : 100,
            enabled: (_17 = (_16 = (_15 = settings.pidControllers) === null || _15 === void 0 ? void 0 : _15.heating) === null || _16 === void 0 ? void 0 : _16.enabled) !== null && _17 !== void 0 ? _17 : true,
            reverseActing: (_20 = (_19 = (_18 = settings.pidControllers) === null || _18 === void 0 ? void 0 : _18.heating) === null || _19 === void 0 ? void 0 : _19.reverseActing) !== null && _20 !== void 0 ? _20 : true, // Reverse acting for heating
            maxIntegral: (_23 = (_22 = (_21 = settings.pidControllers) === null || _21 === void 0 ? void 0 : _21.heating) === null || _22 === void 0 ? void 0 : _22.maxIntegral) !== null && _23 !== void 0 ? _23 : 10, // Maximum integral value
        },
        outdoorDamper: {
            kp: (_26 = (_25 = (_24 = settings.pidControllers) === null || _24 === void 0 ? void 0 : _24.outdoorDamper) === null || _25 === void 0 ? void 0 : _25.kp) !== null && _26 !== void 0 ? _26 : 1.0, // Proportional gain
            ki: (_29 = (_28 = (_27 = settings.pidControllers) === null || _27 === void 0 ? void 0 : _27.outdoorDamper) === null || _28 === void 0 ? void 0 : _28.ki) !== null && _29 !== void 0 ? _29 : 0.1, // Integral gain
            kd: (_32 = (_31 = (_30 = settings.pidControllers) === null || _30 === void 0 ? void 0 : _30.outdoorDamper) === null || _31 === void 0 ? void 0 : _31.kd) !== null && _32 !== void 0 ? _32 : 0.01, // Derivative gain
            outputMin: (_35 = (_34 = (_33 = settings.pidControllers) === null || _33 === void 0 ? void 0 : _33.outdoorDamper) === null || _34 === void 0 ? void 0 : _34.outputMin) !== null && _35 !== void 0 ? _35 : 0,
            outputMax: (_38 = (_37 = (_36 = settings.pidControllers) === null || _36 === void 0 ? void 0 : _36.outdoorDamper) === null || _37 === void 0 ? void 0 : _37.outputMax) !== null && _38 !== void 0 ? _38 : 100,
            enabled: (_41 = (_40 = (_39 = settings.pidControllers) === null || _39 === void 0 ? void 0 : _39.outdoorDamper) === null || _40 === void 0 ? void 0 : _40.enabled) !== null && _41 !== void 0 ? _41 : false,
            reverseActing: (_44 = (_43 = (_42 = settings.pidControllers) === null || _42 === void 0 ? void 0 : _42.outdoorDamper) === null || _43 === void 0 ? void 0 : _43.reverseActing) !== null && _44 !== void 0 ? _44 : false,
            maxIntegral: (_47 = (_46 = (_45 = settings.pidControllers) === null || _45 === void 0 ? void 0 : _45.outdoorDamper) === null || _46 === void 0 ? void 0 : _46.maxIntegral) !== null && _47 !== void 0 ? _47 : 10,
        },
    };
    // Check for setpoint changes that would require resetting the integral term
    const controllerKey = operationMode === "cooling" ? "cooling" : "heating";
    const previousSetpoint = (_48 = pidState === null || pidState === void 0 ? void 0 : pidState[controllerKey]) === null || _48 === void 0 ? void 0 : _48.lastSetpoint;
    const setpointChanged = previousSetpoint !== undefined && Math.abs(supplySetpoint - previousSetpoint) > 0.5;
    if (setpointChanged) {
        console.log(`Setpoint changed from ${previousSetpoint}°F to ${supplySetpoint}°F - resetting integral term`);
        if (pidState === null || pidState === void 0 ? void 0 : pidState[controllerKey]) {
            pidState[controllerKey].integral = 0;
        }
    }
    // Default values
    let heatingValvePosition = 0;
    let coolingValvePosition = 0;
    let outdoorDamperPosition = 20; // Minimum outdoor air by default
    // Economizer logic (if enabled)
    if (economizerEnabled) {
        if (outdoorTemp < roomTemp - 5) {
            // Outdoor air is at least 5°F cooler than indoor, use economizer
            console.log("Economizer enabled and beneficial");
            outdoorDamperPosition = 100; // Fully open outdoor air damper
        }
        else {
            // Economizer enabled but not beneficial
            console.log("Economizer enabled but not beneficial");
            outdoorDamperPosition = 20; // Minimum outdoor air
        }
    }
    else {
        // If economizer is disabled, use outdoor air reset if available
        if ((_49 = settings.outdoorAirReset) === null || _49 === void 0 ? void 0 : _49.enabled) {
            const oar = settings.outdoorAirReset;
            console.log("Outdoor Air Reset enabled:", oar);
            // Outdoor Air Reset logic
            if (outdoorTemp <= oar.outdoorTempLow) {
                // Below low temperature limit - use high setpoint
                supplySetpoint = oar.setpointLow;
                console.log("OAR: Outdoor temp below low limit, using setpoint:", supplySetpoint);
            }
            else if (outdoorTemp >= oar.outdoorTempHigh) {
                // Above high temperature limit - use low setpoint
                supplySetpoint = oar.setpointHigh;
                console.log("OAR: Outdoor temp above high limit, using setpoint:", supplySetpoint);
            }
            else {
                // Linear interpolation between limits
                const ratio = (outdoorTemp - oar.outdoorTempLow) / (oar.outdoorTempHigh - oar.outdoorTempLow);
                supplySetpoint = oar.setpointLow - ratio * (oar.setpointLow - oar.setpointHigh);
                console.log(`OAR: Interpolated setpoint: ${supplySetpoint.toFixed(1)}°F (ratio: ${ratio.toFixed(2)})`);
            }
        }
    }
    // Get damper mode and position
    const outdoorDamperMode = settings.outdoorDamperMode || 'auto';
    if (outdoorDamperMode === 'manual') {
        outdoorDamperPosition = settings.outdoorDamperPosition || 20;
        console.log(`Outdoor damper in manual mode, position set to: ${outdoorDamperPosition}%`);
    }
    // Calculate control outputs based on mode and temperature
    if (operationMode === "cooling") {
        // Cooling mode - manage cooling valve
        if (pidSettings.cooling.enabled) {
            // Use PID for cooling
            const coolingPID = (0, pid_controller_1.pidControllerImproved)({
                input: currentTemp,
                setpoint: supplySetpoint,
                pidParams: pidSettings.cooling,
                dt: 1,
                controllerType: "cooling",
                pidState: pidState,
            });
            // FIXED: Added optional chaining and fallbacks to avoid "cannot read property of undefined" errors
            console.log(`PID Controller (cooling): Input=${currentTemp.toFixed(2)}, Setpoint=${supplySetpoint.toFixed(2)}, Error=${(currentTemp - supplySetpoint).toFixed(2)}, P=${((_50 = coolingPID.p) === null || _50 === void 0 ? void 0 : _50.toFixed(2)) || "N/A"}, I=${((_51 = coolingPID.i) === null || _51 === void 0 ? void 0 : _51.toFixed(2)) || "N/A"} (max=${pidSettings.cooling.maxIntegral}), D=${((_52 = coolingPID.d) === null || _52 === void 0 ? void 0 : _52.toFixed(2)) || "N/A"}, Output=${((_53 = coolingPID.output) === null || _53 === void 0 ? void 0 : _53.toFixed(2)) || coolingPID.output || "N/A"}`);
            coolingValvePosition = coolingPID.output;
            heatingValvePosition = 0; // Ensure heating valve is closed
            // Log the relationship for clarity
            const tempDiff = currentTemp - supplySetpoint;
            console.log(`Cooling: Temp diff (current - setpoint) = ${tempDiff.toFixed(2)}°F, Valve position = ${(coolingValvePosition === null || coolingValvePosition === void 0 ? void 0 : coolingValvePosition.toFixed(2)) || coolingValvePosition || "N/A"}%`);
            if (tempDiff > 0) {
                console.log(`Supply temp too warm (${currentTemp}°F > ${supplySetpoint}°F): Opening cooling valve to ${(coolingValvePosition === null || coolingValvePosition === void 0 ? void 0 : coolingValvePosition.toFixed(2)) || coolingValvePosition || "N/A"}%`);
            }
            else if (tempDiff < 0) {
                console.log(`Supply temp too cool (${currentTemp}°F < ${supplySetpoint}°F): Closing cooling valve to ${(coolingValvePosition === null || coolingValvePosition === void 0 ? void 0 : coolingValvePosition.toFixed(2)) || coolingValvePosition || "N/A"}%`);
            }
            // Store the current setpoint for change detection
            if (pidState === null || pidState === void 0 ? void 0 : pidState.cooling) {
                pidState.cooling.lastSetpoint = supplySetpoint;
            }
        }
        else {
            // Simple proportional control if PID disabled
            const error = currentTemp - supplySetpoint;
            coolingValvePosition = Math.max(0, Math.min(100, error * 10)); // 10% per degree of error
            heatingValvePosition = 0; // Ensure heating valve is closed
            console.log(`Simple cooling control: Temp diff = ${error.toFixed(2)}°F, Valve position = ${coolingValvePosition.toFixed(2)}%`);
        }
    }
    else if (operationMode === "heating") {
        // Heating mode - manage heating valve
        if (pidSettings.heating.enabled) {
            // Use PID for heating
            const heatingPID = (0, pid_controller_1.pidControllerImproved)({
                input: currentTemp,
                setpoint: supplySetpoint,
                pidParams: pidSettings.heating,
                dt: 1,
                controllerType: "heating",
                pidState: pidState,
            });
            // FIXED: Added optional chaining and fallbacks to avoid "cannot read property of undefined" errors
            console.log(`PID Controller (heating): Input=${currentTemp.toFixed(2)}, Setpoint=${supplySetpoint.toFixed(2)}, Error=${(supplySetpoint - currentTemp).toFixed(2)}, P=${((_54 = heatingPID.p) === null || _54 === void 0 ? void 0 : _54.toFixed(2)) || "N/A"}, I=${((_55 = heatingPID.i) === null || _55 === void 0 ? void 0 : _55.toFixed(2)) || "N/A"} (max=${pidSettings.heating.maxIntegral}), D=${((_56 = heatingPID.d) === null || _56 === void 0 ? void 0 : _56.toFixed(2)) || "N/A"}, Output=${((_57 = heatingPID.output) === null || _57 === void 0 ? void 0 : _57.toFixed(2)) || heatingPID.output || "N/A"}`);
            heatingValvePosition = heatingPID.output;
            coolingValvePosition = 0; // Ensure cooling valve is closed
            // Log the relationship for clarity
            const tempDiff = supplySetpoint - currentTemp;
            console.log(`Heating: Temp diff (setpoint - current) = ${tempDiff.toFixed(2)}°F, Valve position = ${(heatingValvePosition === null || heatingValvePosition === void 0 ? void 0 : heatingValvePosition.toFixed(2)) || heatingValvePosition || "N/A"}%`);
            if (tempDiff > 0) {
                console.log(`Supply temp too cool (${currentTemp}°F < ${supplySetpoint}°F): Opening heating valve to ${(heatingValvePosition === null || heatingValvePosition === void 0 ? void 0 : heatingValvePosition.toFixed(2)) || heatingValvePosition || "N/A"}%`);
            }
            else if (tempDiff < 0) {
                console.log(`Supply temp too warm (${currentTemp}°F > ${supplySetpoint}°F): Closing heating valve to ${(heatingValvePosition === null || heatingValvePosition === void 0 ? void 0 : heatingValvePosition.toFixed(2)) || heatingValvePosition || "N/A"}%`);
            }
            // Store the current setpoint for change detection
            if (pidState === null || pidState === void 0 ? void 0 : pidState.heating) {
                pidState.heating.lastSetpoint = supplySetpoint;
            }
        }
        else {
            // Simple proportional control if PID disabled
            const error = supplySetpoint - currentTemp;
            heatingValvePosition = Math.max(0, Math.min(100, error * 10)); // 10% per degree of error
            coolingValvePosition = 0; // Ensure cooling valve is closed
            console.log(`Simple heating control: Temp diff = ${error.toFixed(2)}°F, Valve position = ${heatingValvePosition.toFixed(2)}%`);
        }
    }
    else {
        // Off mode or within deadband
        heatingValvePosition = 0;
        coolingValvePosition = 0;
        console.log("System in off mode or within deadband, both valves closed");
    }
    // Return the calculated control values
    return {
        heatingValvePosition,
        coolingValvePosition,
        fanEnabled,
        fanSpeed,
        outdoorDamperPosition,
        supplyAirTempSetpoint: supplySetpoint,
        temperatureSetpoint: roomSetpoint,
        unitEnable,
        operationMode
    };
}
