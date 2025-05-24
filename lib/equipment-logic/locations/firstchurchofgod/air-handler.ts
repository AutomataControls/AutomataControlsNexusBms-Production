// lib/equipment-logic/locations/firstchurchofgod/air-handler.ts
import { pidControllerImproved } from "@/lib/pid-controller";
import { logLocationEquipment } from "@/lib/logging/location-logger";

/**
 * Air Handler Control Logic specifically for FirstChurchofGod
 * - Equipment ID: WAg6mWpJneM2zLMDu11b (AHU-1)
 * - Control source: Supply air temperature for heating/cooling.
 * - Static Pressure Control: VFD modulates to maintain static pressure setpoint.
 *   - Occupied: Target 4.0" WC
 *   - Unoccupied Cycle: Target 3.0" WC
 * - Occupied hours: 6:30 AM to 6:30 PM
 * - OAR setpoint (Supply Air): Min OAT 32°F → SP 74°F, Max OAT 72°F → SP 50°F
 * - Sensors: SupplyTemp, MixedAir, ReturnAir, DuctStaticPressure
 * - Controls:
 *   - CW valve (0-10V, REVERSE ACTING: 0V opens, 10V closes)
 *   - HW valve (0-10V, REVERSE ACTING: 0V opens, 10V closes)
 *   - Linked OA/RA damper (0-10V, assume direct: 0V closed, 10V open)
 * - Supply fan: Enable relay + VFD speed (0-10V, modulated by static pressure PID)
 * - Unoccupied Fan Cycle: 15 minutes every hour, maintains unoccupied static & OAR setpoints.
 * - Safety: Close OA dampers if supply air < 40°F or > 80°F
 * - Freezestat: Trips when mixed/supply air < 40°F
 */

const UNOCCUPIED_CYCLE_DURATION_MINUTES = 15;
const UNOCCUPIED_CYCLE_INTERVAL_MINUTES = 60; // Total interval between starts of cycles

// --- Default PID Parameters Defined In-File for FirstChurchOfGod AHU-1 ---
// These values are starting points and will likely need tuning based on system response.
const FCOG_AHU1_HEATING_PID_PARAMS = {
  kp: 2.0, ki: 0.15, kd: 0.01,
  outputMin: 0, outputMax: 100,
  enabled: true, reverseActing: true, // Heating valve is reverse acting
  maxIntegral: 10
};
const FCOG_AHU1_COOLING_PID_PARAMS = {
  kp: 2.5, ki: 0.18, kd: 0.01,
  outputMin: 0, outputMax: 100,
  enabled: true, reverseActing: true, // Cooling valve is ALSO reverse acting
  maxIntegral: 10
};
const FCOG_AHU1_STATIC_PRESSURE_PID_PARAMS = {
  kp: 5.0, ki: 5.0, kd: 0.5,
  outputMin: 15, // Min VFD speed (e.g., 15% = 1.5V, adjust as needed)
  outputMax: 50, // Max VFD speed
  enabled: true,
  reverseActing: false, // VFD is direct acting: low pressure -> increase speed
  maxIntegral: 50
};
// --- End Default PID Parameters ---

export function airHandlerControl(metrics: any, settings: any, currentTempArgument: number, stateStorage: any): any {
  const equipmentId = settings.equipmentId || "WAg6mWpJneM2zLMDu11b"; // Default to FCOG AHU-1 ID
  const locationId = settings.locationId || "9"; // Default to FCOG Location ID

  logLocationEquipment(locationId, equipmentId, "air-handler", "Starting FirstChurchOfGod AHU logic (V3.3 - Internal PIDs, Unoccupied Cycle Timer)");

  // Helper to parse numbers safely
  function parseSafeNumber(value: any, defaultValue: number): number {
    const num = parseFloat(value);
    return isNaN(num) ? defaultValue : num;
  }

  // Initialize/Clean PID states and other stateStorage items
  function ensurePidState(stateKey: string) {
    stateStorage[stateKey] = stateStorage[stateKey] || { integral: 0, previousError: 0, lastOutput: 0, lastSetpoint: 0 };
    stateStorage[stateKey].integral = parseSafeNumber(stateStorage[stateKey].integral, 0);
    stateStorage[stateKey].previousError = parseSafeNumber(stateStorage[stateKey].previousError, 0);
  }
  ensurePidState('heatingPidState');
  ensurePidState('coolingPidState');
  ensurePidState('staticPressurePidState');

  stateStorage.firstChurchOADamperState = stateStorage.firstChurchOADamperState || { isOpen: false };

  if (!stateStorage.unoccupiedFanCycle ||
      typeof stateStorage.unoccupiedFanCycle.isCycling === 'undefined' ||
      typeof stateStorage.unoccupiedFanCycle.cycleStartTime === 'undefined' ||
      typeof stateStorage.unoccupiedFanCycle.nextCycleEligibleTime === 'undefined') {
    logLocationEquipment(locationId, equipmentId, "air-handler", "Initializing unoccupiedFanCycle state.");
    stateStorage.unoccupiedFanCycle = {
        isCycling: false,
        cycleStartTime: 0,
        nextCycleEligibleTime: Date.now() - (UNOCCUPIED_CYCLE_INTERVAL_MINUTES * 60 * 1000 * 2),
    };
  }

  // STEP 1: Get temperatures and static pressure
  let currentSupplyTemp = parseSafeNumber(metrics.SupplyTemp, parseSafeNumber(metrics.supplyTemperature, 55));
  if (settings.temperatureSource === "supply" && typeof currentTempArgument === 'number' && !isNaN(currentTempArgument)) {
      currentSupplyTemp = currentTempArgument;
  } else if (settings.temperatureSource && settings.temperatureSource !== "supply" && (metrics.SupplyTemp !== undefined || metrics.supplyTemperature !== undefined)) {
      logLocationEquipment(locationId, equipmentId, "air-handler", `INFO: Control source from settings was '${settings.temperatureSource}', FCOG AHU forces 'supply'. Using detected supply: ${currentSupplyTemp.toFixed(1)}°F`);
  }
  if (typeof currentSupplyTemp !== 'number' || isNaN(currentSupplyTemp)) currentSupplyTemp = 55;

  const outdoorTemp = parseSafeNumber(metrics.Outdoor_Air, parseSafeNumber(metrics.outdoorTemperature, 65));
  const mixedAirTemp = parseSafeNumber(metrics.MixedAir, parseSafeNumber(metrics.Mixed_Air, 55));
  const returnAirTemp = parseSafeNumber(metrics.ReturnAir, parseSafeNumber(metrics.Return_Air, 72));
  const ductStaticPressure = parseSafeNumber(metrics.DuctStaticPressure, parseSafeNumber(settings.defaultStaticPressureFallback, 1.0));

  logLocationEquipment(locationId, equipmentId, "air-handler", `Temps: Supply=${currentSupplyTemp.toFixed(1)}°F, Outdoor=${outdoorTemp.toFixed(1)}°F, Mixed=${mixedAirTemp.toFixed(1)}°F, Return=${returnAirTemp.toFixed(1)}°F, Static=${ductStaticPressure.toFixed(2)}"WC`);

  // STEP 2: Occupancy
  const now = new Date();
  const currentHour = now.getHours(), currentMinute = now.getMinutes();
  const currentTimeInMinutes = currentHour * 60 + currentMinute;
  const occupiedStartMinutes = 6 * 60 + 30;
  const occupiedEndMinutes = 18 * 60 + 30;
  const isOccupied = currentTimeInMinutes >= occupiedStartMinutes && currentTimeInMinutes <= occupiedEndMinutes;
  logLocationEquipment(locationId, equipmentId, "air-handler", `Occupancy: ${isOccupied ? "OCCUPIED" : "UNOCCUPIED"}`);

  // STEP 3: Unoccupied Fan Cycling Logic (Revised Timer Logic)
  const nowMs = Date.now();
  if (!isOccupied) {
    if (stateStorage.unoccupiedFanCycle.isCycling) {
      if (nowMs >= (stateStorage.unoccupiedFanCycle.cycleStartTime + (UNOCCUPIED_CYCLE_DURATION_MINUTES * 60 * 1000))) {
        stateStorage.unoccupiedFanCycle.isCycling = false;
        stateStorage.unoccupiedFanCycle.nextCycleEligibleTime = stateStorage.unoccupiedFanCycle.cycleStartTime + (UNOCCUPIED_CYCLE_INTERVAL_MINUTES * 60 * 1000);
        logLocationEquipment(locationId, equipmentId, "air-handler", `Unoccupied fan ON cycle ENDED. Next eligible at ${new Date(stateStorage.unoccupiedFanCycle.nextCycleEligibleTime).toLocaleTimeString()}`);
      } else {
        logLocationEquipment(locationId, equipmentId, "air-handler", `Unoccupied fan ON cycle active. ${Math.round(((stateStorage.unoccupiedFanCycle.cycleStartTime + (UNOCCUPIED_CYCLE_DURATION_MINUTES * 60 * 1000)) - nowMs)/60000)} mins remaining.`);
      }
    } else {
      if (nowMs >= stateStorage.unoccupiedFanCycle.nextCycleEligibleTime) {
        stateStorage.unoccupiedFanCycle.isCycling = true;
        stateStorage.unoccupiedFanCycle.cycleStartTime = nowMs;
        logLocationEquipment(locationId, equipmentId, "air-handler", "Unoccupied fan ON cycle STARTED.");
      }
    }
  } else {
    if (stateStorage.unoccupiedFanCycle.isCycling) {
      stateStorage.unoccupiedFanCycle.isCycling = false;
      logLocationEquipment(locationId, equipmentId, "air-handler", "Switched to OCCUPIED, ensuring unoccupied fan cycle is OFF.");
    }
    stateStorage.unoccupiedFanCycle.nextCycleEligibleTime = nowMs;
  }

  const tempControlActive = (isOccupied || stateStorage.unoccupiedFanCycle.isCycling);

  // STEP 4: OAR Supply Setpoint
  let supplySetpoint = parseSafeNumber(settings.unoccupiedSupplySetpoint, 65.0);
  if (tempControlActive) {
    const minOAT = 32, maxOAT = 72, maxSupply = 74, minSupply = 50;
    if (outdoorTemp <= minOAT) supplySetpoint = maxSupply;
    else if (outdoorTemp >= maxOAT) supplySetpoint = minSupply;
    else supplySetpoint = maxSupply - ((outdoorTemp - minOAT) / (maxOAT - minOAT)) * (maxSupply - minSupply);
    logLocationEquipment(locationId, equipmentId, "air-handler", `OAR Supply Setpoint: ${supplySetpoint.toFixed(1)}°F`);
  } else {
    logLocationEquipment(locationId, equipmentId, "air-handler", `Unoccupied & Not Cycling: Using standby supply setpoint: ${supplySetpoint.toFixed(1)}°F`);
  }

  // STEP 5: Safety Checks
  const freezestatTripped = currentSupplyTemp < 40 || mixedAirTemp < 40;
  if (freezestatTripped) {
    logLocationEquipment(locationId, equipmentId, "air-handler", `SAFETY: FREEZESTAT TRIPPED! Supply: ${currentSupplyTemp.toFixed(1)}°F, Mixed: ${mixedAirTemp.toFixed(1)}°F`);
    return {
      heatingValvePosition: 0, coolingValvePosition: 100,
      fanEnabled: false, fanVFDSpeed: 0, outdoorDamperPosition: 0,
      supplyAirTempSetpoint: supplySetpoint, temperatureSetpoint: parseSafeNumber(settings.temperatureSetpoint, 72),
      unitEnable: true, safetyTripped: "freezestat", stateStorage
    };
  }
  const supplyTempOutOfRangeForDamper = currentSupplyTemp < 40 || currentSupplyTemp > 80;

  // STEP 6: Outdoor Damper Position
  let outdoorDamperPosition = 0;
  if (tempControlActive && !freezestatTripped && !supplyTempOutOfRangeForDamper) {
    if (stateStorage.firstChurchOADamperState.isOpen) {
      if (outdoorTemp <= 38) { stateStorage.firstChurchOADamperState.isOpen = false; outdoorDamperPosition = 0; }
      else { outdoorDamperPosition = 100; }
    } else {
      if (outdoorTemp >= 40) { stateStorage.firstChurchOADamperState.isOpen = true; outdoorDamperPosition = 100; }
      else { outdoorDamperPosition = 0; }
    }
  } else {
    outdoorDamperPosition = 0;
    if (stateStorage.firstChurchOADamperState) stateStorage.firstChurchOADamperState.isOpen = false;
  }
  logLocationEquipment(locationId, equipmentId, "air-handler", `OA Damper: ${outdoorDamperPosition}%`);

  // STEP 7: Fan Control
  let fanEnabled = false;
  let fanVFDSpeed = 0;
  let staticPressureSetpoint = 0;
  const fanShouldRunBasedOnMode = (isOccupied || stateStorage.unoccupiedFanCycle.isCycling);

  if (fanShouldRunBasedOnMode && !freezestatTripped) {
    fanEnabled = true;
    if (isOccupied) {
      staticPressureSetpoint = parseSafeNumber(settings.occupiedStaticPressureSetpoint, 4.0);
    } else {
      staticPressureSetpoint = parseSafeNumber(settings.unoccupiedStaticPressureSetpoint, 3.0);
    }
    logLocationEquipment(locationId, equipmentId, "air-handler", `Target Static Pressure: ${staticPressureSetpoint.toFixed(2)}"WC`);

    const baseStaticPidParams = { ...FCOG_AHU1_STATIC_PRESSURE_PID_PARAMS };
    const settingP_static = settings.pidControllers?.staticPressure;
    const staticPidParams = {
        kp: parseSafeNumber(settingP_static?.kp, baseStaticPidParams.kp),
        ki: parseSafeNumber(settingP_static?.ki, baseStaticPidParams.ki),
        kd: parseSafeNumber(settingP_static?.kd, baseStaticPidParams.kd),
        outputMin: parseSafeNumber(settingP_static?.outputMin, baseStaticPidParams.outputMin),
        outputMax: parseSafeNumber(settingP_static?.outputMax, baseStaticPidParams.outputMax),
        enabled: settingP_static?.enabled !== undefined ? settingP_static.enabled : baseStaticPidParams.enabled,
        reverseActing: baseStaticPidParams.reverseActing, // Fixed for this PID type
        maxIntegral: parseSafeNumber(settingP_static?.maxIntegral, baseStaticPidParams.maxIntegral),
    };

    if (stateStorage.staticPressurePidState.lastSetpoint !== staticPressureSetpoint) {
        logLocationEquipment(locationId, equipmentId, "air-handler", `Static Pressure SP changed from ${stateStorage.staticPressurePidState.lastSetpoint} to ${staticPressureSetpoint}. Resetting PID integral.`);
        stateStorage.staticPressurePidState.integral = 0;
        stateStorage.staticPressurePidState.lastSetpoint = staticPressureSetpoint;
    }

    const staticPressurePID = pidControllerImproved({
      input: ductStaticPressure, setpoint: staticPressureSetpoint, pidParams: staticPidParams,
      dt: 1, controllerType: "staticPressure", pidState: stateStorage.staticPressurePidState,
    });

    if (isNaN(staticPressurePID.output)) {
        logLocationEquipment(locationId, equipmentId, "air-handler", `ERROR: Static Pressure PID output is NaN. Defaulting VFD to min speed (${staticPidParams.outputMin}%).`);
        fanVFDSpeed = staticPidParams.outputMin;
    } else {
        fanVFDSpeed = staticPressurePID.output;
    }
    logLocationEquipment(locationId, equipmentId, "air-handler", `Static Pressure PID: Actual=${ductStaticPressure.toFixed(2)}", Setpoint=${staticPressureSetpoint.toFixed(2)}", VFD Out=${fanVFDSpeed.toFixed(1)}%`);
  } else {
    fanEnabled = false; fanVFDSpeed = 0;
    logLocationEquipment(locationId, equipmentId, "air-handler", `Fan DISABLED. Reason: Occupied=${isOccupied}, Cycling=${stateStorage.unoccupiedFanCycle?.isCycling}, Freezestat=${freezestatTripped}`);
    if (stateStorage.staticPressurePidState) {
        stateStorage.staticPressurePidState.integral = 0;
        stateStorage.staticPressurePidState.previousError = 0;
    }
  }

  // STEP 8: Heating and Cooling Valve Control
  let heatingValvePosition = 100;
  let coolingValvePosition = 100;

  if (fanEnabled && tempControlActive && !freezestatTripped) {
    const tempError = currentSupplyTemp - supplySetpoint;
    const heatingDeadband = parseSafeNumber(settings.heatingDeadband, 2.0);
    const coolingDeadband = parseSafeNumber(settings.coolingDeadband, 2.0);

    // Heating Logic
    if (tempError < -heatingDeadband) {
      const baseHeatingPidParams = { ...FCOG_AHU1_HEATING_PID_PARAMS };
      const settingP_heating = settings.pidControllers?.heating;
      const heatingPidParams = {
        kp: parseSafeNumber(settingP_heating?.kp, baseHeatingPidParams.kp),
        ki: parseSafeNumber(settingP_heating?.ki, baseHeatingPidParams.ki),
        kd: parseSafeNumber(settingP_heating?.kd, baseHeatingPidParams.kd),
        outputMin: parseSafeNumber(settingP_heating?.outputMin, baseHeatingPidParams.outputMin),
        outputMax: parseSafeNumber(settingP_heating?.outputMax, baseHeatingPidParams.outputMax),
        enabled: settingP_heating?.enabled !== undefined ? settingP_heating.enabled : baseHeatingPidParams.enabled,
        reverseActing: baseHeatingPidParams.reverseActing, // True from constant
        maxIntegral: parseSafeNumber(settingP_heating?.maxIntegral, baseHeatingPidParams.maxIntegral),
      };
      const heatingPID = pidControllerImproved({
        input: currentSupplyTemp, setpoint: supplySetpoint, pidParams: heatingPidParams,
        dt: 1, controllerType: "heating", pidState: stateStorage.heatingPidState,
      });
      if (isNaN(heatingPID.output)) {
          logLocationEquipment(locationId, equipmentId, "air-handler", `ERROR: Heating PID output is NaN. Defaulting valve to closed (100%).`);
          heatingValvePosition = 100;
      } else {
          heatingValvePosition = 100 - heatingPID.output;
      }
      coolingValvePosition = 100;
      logLocationEquipment(locationId, equipmentId, "air-handler", `HEATING: Target ${supplySetpoint.toFixed(1)}°F, Actual ${currentSupplyTemp.toFixed(1)}°F. Valve ${heatingValvePosition.toFixed(1)}%`);
    }
    // Cooling Logic
    else if (tempError > coolingDeadband) {
      const baseCoolingPidParams = { ...FCOG_AHU1_COOLING_PID_PARAMS };
      const settingP_cooling = settings.pidControllers?.cooling;
      const coolingPidParams = {
        kp: parseSafeNumber(settingP_cooling?.kp, baseCoolingPidParams.kp),
        ki: parseSafeNumber(settingP_cooling?.ki, baseCoolingPidParams.ki),
        kd: parseSafeNumber(settingP_cooling?.kd, baseCoolingPidParams.kd),
        outputMin: parseSafeNumber(settingP_cooling?.outputMin, baseCoolingPidParams.outputMin),
        outputMax: parseSafeNumber(settingP_cooling?.outputMax, baseCoolingPidParams.outputMax),
        enabled: settingP_cooling?.enabled !== undefined ? settingP_cooling.enabled : baseCoolingPidParams.enabled,
        reverseActing: baseCoolingPidParams.reverseActing, // True from constant
        maxIntegral: parseSafeNumber(settingP_cooling?.maxIntegral, baseCoolingPidParams.maxIntegral),
      };
      const coolingPID = pidControllerImproved({
        input: currentSupplyTemp, setpoint: supplySetpoint, pidParams: coolingPidParams,
        dt: 1, controllerType: "cooling", pidState: stateStorage.coolingPidState,
      });
      if (isNaN(coolingPID.output)) {
          logLocationEquipment(locationId, equipmentId, "air-handler", `ERROR: Cooling PID output is NaN. Defaulting valve to closed (100%).`);
          coolingValvePosition = 100;
      } else {
          coolingValvePosition = 100 - coolingPID.output;
      }
      heatingValvePosition = 100;
      logLocationEquipment(locationId, equipmentId, "air-handler", `COOLING: Target ${supplySetpoint.toFixed(1)}°F, Actual ${currentSupplyTemp.toFixed(1)}°F. Valve ${coolingValvePosition.toFixed(1)}%`);
    } else {
      logLocationEquipment(locationId, equipmentId, "air-handler", `TEMP DEADBAND: Valves closed. Actual ${currentSupplyTemp.toFixed(1)}°F, Target ${supplySetpoint.toFixed(1)}°F, Error ${tempError.toFixed(1)}°F`);
      // heatingValvePosition and coolingValvePosition remain 100 (closed)
    }
    stateStorage.heatingPidState.lastSetpoint = supplySetpoint;
    stateStorage.coolingPidState.lastSetpoint = supplySetpoint;
  } else {
    logLocationEquipment(locationId, equipmentId, "air-handler", `Temp control (valves) INACTIVE. Valves closed. FanEnabled=${fanEnabled}, TempControlActive=${tempControlActive}, Freezestat=${freezestatTripped}`);
    if(freezestatTripped) {
        heatingValvePosition = 0;
        logLocationEquipment(locationId, equipmentId, "air-handler", `FREEZE PROTECT: Heating valve fully open (0%).`);
    }
  }

  // STEP 9: Construct and Return Result
  const result = {
    // Core values that should ALWAYS be sent every control cycle
    heatingValvePosition: Math.max(0, Math.min(100, heatingValvePosition)),
    coolingValvePosition: Math.max(0, Math.min(100, coolingValvePosition)),
    fanEnabled: fanEnabled,
    fanSpeed: fanEnabled ? "low" : "off", // Changed to "low" instead of custom values
    fanVFDSpeed: Math.max(0, Math.min(100, fanVFDSpeed)),
    outdoorDamperPosition: outdoorDamperPosition,
    supplyAirTempSetpoint: parseFloat(supplySetpoint.toFixed(1)),
    unitEnable: true, // ALWAYS set to true rather than conditional
    isOccupied: isOccupied,

    // Additional values that can be sent conditionally
    temperatureSetpoint: parseSafeNumber(settings.temperatureSetpoint, 72),
    actualDuctStaticPressure: parseFloat(ductStaticPressure.toFixed(2)),
    targetDuctStaticPressure: fanEnabled ? parseFloat(staticPressureSetpoint.toFixed(2)) : 0,
    returnAirTemp: parseFloat(returnAirTemp.toFixed(1)),
    mixedAirTemp: parseFloat(mixedAirTemp.toFixed(1)),
    outdoorTemp: parseFloat(outdoorTemp.toFixed(1)),
    currentSupplyAirTemp: parseFloat(currentSupplyTemp.toFixed(1)),
    stateStorage: stateStorage,
  };

  // ADDED CODE: Force explicit commands to be stored in InfluxDB
  try {
    // Create an array of commands that need to be sent to InfluxDB
    const commandsToSend = [
      { command_type: 'unitEnable', equipment_id: equipmentId, value: true },
      { command_type: 'fanEnabled', equipment_id: equipmentId, value: fanEnabled },
      { command_type: 'fanSpeed', equipment_id: equipmentId, value: fanEnabled ? "low" : "off" },
      { command_type: 'fanVFDSpeed', equipment_id: equipmentId, value: fanVFDSpeed },
      { command_type: 'coolingValvePosition', equipment_id: equipmentId, value: coolingValvePosition },
      { command_type: 'heatingValvePosition', equipment_id: equipmentId, value: heatingValvePosition },
      { command_type: 'outdoorDamperPosition', equipment_id: equipmentId, value: outdoorDamperPosition },
      { command_type: 'supplyAirTempSetpoint', equipment_id: equipmentId, value: parseFloat(supplySetpoint.toFixed(1)) },
      { command_type: 'isOccupied', equipment_id: equipmentId, value: isOccupied }
    ];

    // Store the commands for processing by the command handler
    if (settings && typeof settings.forceInfluxCommands === 'function') {
      settings.forceInfluxCommands(commandsToSend);
      logLocationEquipment(locationId, equipmentId, "air-handler", 
        `FORCED INFLUXDB COMMANDS: unitEnable, fanEnabled, valves, dampers`);
    } else if (settings && settings.context) {
      // Alternative approach using context
      settings.context.forcedInfluxCommands = commandsToSend;
      logLocationEquipment(locationId, equipmentId, "air-handler", 
        `STORED COMMANDS IN CONTEXT: unitEnable, fanEnabled, valves, dampers`);
    } else if (global && typeof global.set === 'function') {
      // If Node-RED's global context is available
      global.set(`fcog_commands_${equipmentId}`, commandsToSend);
      logLocationEquipment(locationId, equipmentId, "air-handler", 
        `STORED COMMANDS IN GLOBAL: unitEnable, fanEnabled, valves, dampers`);
    } else {
      logLocationEquipment(locationId, equipmentId, "air-handler", 
        `WARNING: No mechanism available to force InfluxDB commands. Commands may be stored only in Firebase.`);
    }
  } catch (cmdError) {
    logLocationEquipment(locationId, equipmentId, "air-handler",
      `Error forcing InfluxDB commands: ${cmdError.message}`);
  }

  logLocationEquipment(locationId, equipmentId, "air-handler",
    `FINAL CONTROLS: fan=${result.fanEnabled}, fanVFD=${result.fanVFDSpeed.toFixed(1)}%, ` +
    `heatV=${result.heatingValvePosition.toFixed(1)}% (${(10 - result.heatingValvePosition/10).toFixed(1)}V R), ` +
    `coolV=${result.coolingValvePosition.toFixed(1)}% (${(10 - result.coolingValvePosition/10).toFixed(1)}V R), ` +
    `damper=${result.outdoorDamperPosition}%, SATsp=${result.supplyAirTempSetpoint.toFixed(1)}°F, ` +
    `Occ=${result.isOccupied}, StaticActual=${result.actualDuctStaticPressure.toFixed(2)}\", StaticTarget=${result.targetDuctStaticPressure.toFixed(2)}\"`,
    {...result, stateStorage: "{pidStates_and_cycleState_hidden}" }
  );

  return result;
}
