// @ts-nocheck
// lib/equipment-logic/locations/firstchurchofgod/air-handler.ts
//
// ===============================================================================
// FIRSTCHURCHOFGOD AIR HANDLER CONTROL LOGIC - SUPPLY AIR TEMPERATURE CONTROL
// ===============================================================================
//
// OVERVIEW:
// This file controls air handler units at the FirstChurchofGod location using Supply Air
// Temperature as the primary control source with Outdoor Air Reset (OAR), static pressure
// control, and unoccupied cycling for optimal comfort and efficiency.
//
// CONTROL STRATEGY:
// 1. Supply Air Temperature Control - Uses supply air temperature for control
// 2. Outdoor Air Reset (OAR) - Automatically adjusts setpoint based on outdoor temp
// 3. Static Pressure Control - VFD modulates to maintain static pressure setpoint
// 4. Unoccupied Fan Cycling - 15 minutes every hour when unoccupied
// 5. Binary Damper Control - Open/close based on outdoor temperature and safety
//
// OAR SETPOINTS (FirstChurchofGod Specific):
// - When Outdoor Temp = 32°F → Supply Setpoint = 74°F (Max Heat)
// - When Outdoor Temp = 72°F → Supply Setpoint = 50°F (Min Heat)
// - Temperatures between 32°F-72°F are calculated proportionally
//
// OCCUPANCY SCHEDULE:
// - Occupied hours: 6:30 AM to 6:30 PM
// - Unoccupied Fan Cycle: 15 minutes every hour
//
// STATIC PRESSURE CONTROL:
// - Occupied: Target 4.0" WC
// - Unoccupied Cycle: Target 3.0" WC
//
// VALVE CONTROL:
// - Cooling: Reverse acting (10V closed, 0V open) - 0-100% range
// - Heating: Reverse acting (10V closed, 0V open) - 0-100% range
//
// SAFETY FEATURES:
// - FreezeStat: 40°F supply/mixed air temperature (activates heating, closes damper)
// - Damper Safety: Closes dampers if supply air < 40°F or > 80°F
//
// DATA STORAGE:
// - Commands are written directly to both Locations and ControlCommands databases
// - All operations are logged for troubleshooting
//
// ===============================================================================

import { pidControllerImproved } from "@/lib/pid-controller";
import { logLocationEquipment } from "@/lib/logging/location-logger";

// Helper to safely parse temperatures from various metric sources or settings
function parseSafeNumber(value: any, defaultValue: number): number {
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

// Unoccupied cycling constants
const UNOCCUPIED_CYCLE_DURATION_MINUTES = 15;
const UNOCCUPIED_CYCLE_INTERVAL_MINUTES = 60;

// Default PID Parameters for FirstChurchofGod AHU
const FCOG_HEATING_PID_PARAMS = {
  kp: 2.0, ki: 0.15, kd: 0.01,
  outputMin: 0, outputMax: 100,
  enabled: true, reverseActing: true,
  maxIntegral: 10
};

const FCOG_COOLING_PID_PARAMS = {
  kp: 2.5, ki: 0.18, kd: 0.01,
  outputMin: 0, outputMax: 100,
  enabled: true, reverseActing: true,
  maxIntegral: 10
};

const FCOG_STATIC_PRESSURE_PID_PARAMS = {
  kp: 5.0, ki: 5.0, kd: 0.5,
  outputMin: 15, outputMax: 50,
  enabled: true, reverseActing: false,
  maxIntegral: 50
};

export async function airHandlerControl(
  metricsInput: any,
  settingsInput: any,
  currentTempArgument: number,
  stateStorageInput: any
) {
  const equipmentId = settingsInput.equipmentId || "WAg6mWpJneM2zLMDu11b";
  const locationId = settingsInput.locationId || "9";

  const currentMetrics = metricsInput;
  const currentSettings = settingsInput;

  logLocationEquipment(locationId, equipmentId, "air-handler", "Starting FirstChurchofGod air handler logic");

  try {
    // STEP 1: Get temperatures and static pressure
    let currentSupplyTemp = parseSafeNumber(currentTempArgument, 55);
    if (!currentSupplyTemp || currentSupplyTemp === 55) {
      currentSupplyTemp = parseSafeNumber(currentMetrics.SupplyTemp, 
        parseSafeNumber(currentMetrics.supplyTemperature, 55));
    }

    const outdoorTemp = parseSafeNumber(currentMetrics.Outdoor_Air, 
      parseSafeNumber(currentMetrics.outdoorTemperature, 65));
    const mixedAirTemp = parseSafeNumber(currentMetrics.MixedAir, 
      parseSafeNumber(currentMetrics.Mixed_Air, 55));
    const returnAirTemp = parseSafeNumber(currentMetrics.ReturnAir, 
      parseSafeNumber(currentMetrics.Return_Air, 72));
    const ductStaticPressure = parseSafeNumber(currentMetrics.DuctStaticPressure, 1.0);

    logLocationEquipment(locationId, equipmentId, "air-handler", 
      `Temps: Supply=${currentSupplyTemp.toFixed(1)}°F, Outdoor=${outdoorTemp.toFixed(1)}°F, ` +
      `Mixed=${mixedAirTemp.toFixed(1)}°F, Return=${returnAirTemp.toFixed(1)}°F, ` +
      `Static=${ductStaticPressure.toFixed(2)}"WC`);

    // STEP 2: Determine occupancy
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    const occupiedStartMinutes = 6 * 60 + 30; // 6:30 AM
    const occupiedEndMinutes = 18 * 60 + 30;  // 6:30 PM
    const isOccupied = currentTimeInMinutes >= occupiedStartMinutes && 
                       currentTimeInMinutes <= occupiedEndMinutes;

    logLocationEquipment(locationId, equipmentId, "air-handler", 
      `Occupancy: ${isOccupied ? "OCCUPIED" : "UNOCCUPIED"}`);

    // STEP 3: Handle unoccupied fan cycling
    const nowMs = Date.now();
    
    // Initialize unoccupied cycling state if needed
    if (!stateStorageInput.unoccupiedFanCycle) {
      stateStorageInput.unoccupiedFanCycle = {
        isCycling: false,
        cycleStartTime: 0,
        nextCycleEligibleTime: nowMs - (UNOCCUPIED_CYCLE_INTERVAL_MINUTES * 60 * 1000 * 2)
      };
    }

    let isFanCycling = false;

    if (!isOccupied) {
      if (stateStorageInput.unoccupiedFanCycle.isCycling) {
        // Check if cycle should end
        const cycleEndTime = stateStorageInput.unoccupiedFanCycle.cycleStartTime + 
                            (UNOCCUPIED_CYCLE_DURATION_MINUTES * 60 * 1000);
        if (nowMs >= cycleEndTime) {
          stateStorageInput.unoccupiedFanCycle.isCycling = false;
          stateStorageInput.unoccupiedFanCycle.nextCycleEligibleTime = 
            stateStorageInput.unoccupiedFanCycle.cycleStartTime + 
            (UNOCCUPIED_CYCLE_INTERVAL_MINUTES * 60 * 1000);
          logLocationEquipment(locationId, equipmentId, "air-handler", "Unoccupied fan cycle ENDED");
        } else {
          isFanCycling = true;
          const remainingMinutes = Math.round((cycleEndTime - nowMs) / 60000);
          logLocationEquipment(locationId, equipmentId, "air-handler", 
            `Unoccupied fan cycle active, ${remainingMinutes} mins remaining`);
        }
      } else {
        // Check if new cycle should start
        if (nowMs >= stateStorageInput.unoccupiedFanCycle.nextCycleEligibleTime) {
          stateStorageInput.unoccupiedFanCycle.isCycling = true;
          stateStorageInput.unoccupiedFanCycle.cycleStartTime = nowMs;
          isFanCycling = true;
          logLocationEquipment(locationId, equipmentId, "air-handler", "Unoccupied fan cycle STARTED");
        }
      }
    } else {
      // Reset cycling when occupied
      if (stateStorageInput.unoccupiedFanCycle.isCycling) {
        stateStorageInput.unoccupiedFanCycle.isCycling = false;
        logLocationEquipment(locationId, equipmentId, "air-handler", "Occupied mode - fan cycle reset");
      }
      stateStorageInput.unoccupiedFanCycle.nextCycleEligibleTime = nowMs;
    }

    const tempControlActive = isOccupied || isFanCycling;

    // STEP 4: Calculate OAR setpoint
    let supplySetpoint = 65.0; // Default unoccupied setpoint

    if (tempControlActive) {
      const minOAT = 32;
      const maxOAT = 72; 
      const maxSupply = 74;
      const minSupply = 50;

      if (outdoorTemp <= minOAT) {
        supplySetpoint = maxSupply;
      } else if (outdoorTemp >= maxOAT) {
        supplySetpoint = minSupply;
      } else {
        supplySetpoint = maxSupply - ((outdoorTemp - minOAT) / (maxOAT - minOAT)) * (maxSupply - minSupply);
      }
      
      logLocationEquipment(locationId, equipmentId, "air-handler", 
        `OAR calculation: Outdoor ${outdoorTemp}°F -> Supply setpoint ${supplySetpoint.toFixed(1)}°F`);
    } else {
      logLocationEquipment(locationId, equipmentId, "air-handler", 
        `Using unoccupied setpoint: ${supplySetpoint.toFixed(1)}°F`);
    }

    // STEP 5: Safety checks
    const freezestatTripped = currentSupplyTemp < 40 || mixedAirTemp < 40;
    
    if (freezestatTripped) {
      logLocationEquipment(locationId, equipmentId, "air-handler", 
        `FREEZESTAT TRIP: Supply=${currentSupplyTemp.toFixed(1)}°F, Mixed=${mixedAirTemp.toFixed(1)}°F`);

      const safetyResult = {
        heatingValvePosition: 0,    // Fully open (0V)
        coolingValvePosition: 100,  // Fully closed (10V)
        fanEnabled: false,
        fanSpeed: "off",
        fanVFDSpeed: 0,
        outdoorDamperPosition: 0,   // Closed
        supplyAirTempSetpoint: supplySetpoint,
        temperatureSetpoint: parseSafeNumber(currentSettings.temperatureSetpoint, 72),
        unitEnable: true,
        isOccupied: isOccupied
      };

      await writeToInfluxDB(locationId, equipmentId, safetyResult, "airhandler");
      return filterValidCommands(safetyResult);
    }

    // STEP 6: Outdoor damper control
    let outdoorDamperPosition = 0;
    const supplyTempOutOfRange = currentSupplyTemp < 40 || currentSupplyTemp > 80;

    if (tempControlActive && !freezestatTripped && !supplyTempOutOfRange) {
      // Initialize damper state if needed
      if (!stateStorageInput.firstChurchOADamperState) {
        stateStorageInput.firstChurchOADamperState = { isOpen: false };
      }

      // Hysteresis logic for damper
      if (stateStorageInput.firstChurchOADamperState.isOpen) {
        if (outdoorTemp <= 38) {
          stateStorageInput.firstChurchOADamperState.isOpen = false;
          outdoorDamperPosition = 0;
        } else {
          outdoorDamperPosition = 100;
        }
      } else {
        if (outdoorTemp >= 40) {
          stateStorageInput.firstChurchOADamperState.isOpen = true;
          outdoorDamperPosition = 100;
        } else {
          outdoorDamperPosition = 0;
        }
      }
    } else {
      outdoorDamperPosition = 0;
      if (stateStorageInput.firstChurchOADamperState) {
        stateStorageInput.firstChurchOADamperState.isOpen = false;
      }
    }

    logLocationEquipment(locationId, equipmentId, "air-handler", `OA Damper: ${outdoorDamperPosition}%`);

    // STEP 7: Fan and static pressure control
    let fanEnabled = false;
    let fanVFDSpeed = 0;
    let staticPressureSetpoint = 0;

    const fanShouldRun = tempControlActive && !freezestatTripped;

    if (fanShouldRun) {
      fanEnabled = true;
      staticPressureSetpoint = isOccupied ? 4.0 : 3.0;

      logLocationEquipment(locationId, equipmentId, "air-handler", 
        `Target static pressure: ${staticPressureSetpoint.toFixed(2)}"WC`);

      // Initialize static pressure PID state if needed
      if (!stateStorageInput.staticPressurePidState) {
        stateStorageInput.staticPressurePidState = {
          integral: 0,
          previousError: 0,
          lastOutput: 0,
          lastSetpoint: 0
        };
      }

      // Reset integral if setpoint changed
      if (stateStorageInput.staticPressurePidState.lastSetpoint !== staticPressureSetpoint) {
        stateStorageInput.staticPressurePidState.integral = 0;
        stateStorageInput.staticPressurePidState.lastSetpoint = staticPressureSetpoint;
      }

      // Static pressure PID control
      const staticPidParams = { ...FCOG_STATIC_PRESSURE_PID_PARAMS };
      const staticPressurePID = pidControllerImproved({
        input: ductStaticPressure,
        setpoint: staticPressureSetpoint,
        pidParams: staticPidParams,
        dt: 1,
        controllerType: "staticPressure",
        pidState: stateStorageInput.staticPressurePidState
      });

      if (isNaN(staticPressurePID.output)) {
        fanVFDSpeed = staticPidParams.outputMin;
        logLocationEquipment(locationId, equipmentId, "air-handler", 
          `ERROR: Static pressure PID output is NaN, using min speed ${fanVFDSpeed}%`);
      } else {
        fanVFDSpeed = Math.max(staticPidParams.outputMin, 
          Math.min(staticPidParams.outputMax, staticPressurePID.output));
      }

      logLocationEquipment(locationId, equipmentId, "air-handler", 
        `Static pressure PID: Actual=${ductStaticPressure.toFixed(2)}", ` +
        `Setpoint=${staticPressureSetpoint.toFixed(2)}", VFD=${fanVFDSpeed.toFixed(1)}%`);
    } else {
      fanEnabled = false;
      fanVFDSpeed = 0;
      logLocationEquipment(locationId, equipmentId, "air-handler", 
        `Fan disabled - TempControl=${tempControlActive}, Freezestat=${freezestatTripped}`);
      
      // Reset static pressure PID
      if (stateStorageInput.staticPressurePidState) {
        stateStorageInput.staticPressurePidState.integral = 0;
        stateStorageInput.staticPressurePidState.previousError = 0;
      }
    }

    // STEP 8: Heating and cooling valve control
    let heatingValvePosition = 100; // Closed (10V)
    let coolingValvePosition = 100; // Closed (10V)

    if (fanEnabled && tempControlActive && !freezestatTripped) {
      const tempError = currentSupplyTemp - supplySetpoint;
      const heatingDeadband = parseSafeNumber(currentSettings.heatingDeadband, 2.0);
      const coolingDeadband = parseSafeNumber(currentSettings.coolingDeadband, 2.0);

      // Initialize PID states if needed
      if (!stateStorageInput.heatingPidState) {
        stateStorageInput.heatingPidState = {
          integral: 0, previousError: 0, lastOutput: 0, lastSetpoint: 0
        };
      }
      if (!stateStorageInput.coolingPidState) {
        stateStorageInput.coolingPidState = {
          integral: 0, previousError: 0, lastOutput: 0, lastSetpoint: 0
        };
      }

      // Heating logic
      if (tempError < -heatingDeadband) {
        const heatingPidParams = { ...FCOG_HEATING_PID_PARAMS };
        const heatingPID = pidControllerImproved({
          input: currentSupplyTemp,
          setpoint: supplySetpoint,
          pidParams: heatingPidParams,
          dt: 1,
          controllerType: "heating",
          pidState: stateStorageInput.heatingPidState
        });

        if (isNaN(heatingPID.output)) {
          heatingValvePosition = 100; // Closed
          logLocationEquipment(locationId, equipmentId, "air-handler", 
            "ERROR: Heating PID output is NaN, valve closed");
        } else {
          heatingValvePosition = 100 - heatingPID.output; // Reverse acting
        }
        
        coolingValvePosition = 100; // Ensure cooling is closed
        
        logLocationEquipment(locationId, equipmentId, "air-handler", 
          `HEATING: Target=${supplySetpoint.toFixed(1)}°F, Actual=${currentSupplyTemp.toFixed(1)}°F, ` +
          `Valve=${heatingValvePosition.toFixed(1)}%`);
      }
      // Cooling logic
      else if (tempError > coolingDeadband) {
        const coolingPidParams = { ...FCOG_COOLING_PID_PARAMS };
        const coolingPID = pidControllerImproved({
          input: currentSupplyTemp,
          setpoint: supplySetpoint,
          pidParams: coolingPidParams,
          dt: 1,
          controllerType: "cooling",
          pidState: stateStorageInput.coolingPidState
        });

        if (isNaN(coolingPID.output)) {
          coolingValvePosition = 100; // Closed
          logLocationEquipment(locationId, equipmentId, "air-handler", 
            "ERROR: Cooling PID output is NaN, valve closed");
        } else {
          coolingValvePosition = 100 - coolingPID.output; // Reverse acting
        }
        
        heatingValvePosition = 100; // Ensure heating is closed
        
        logLocationEquipment(locationId, equipmentId, "air-handler", 
          `COOLING: Target=${supplySetpoint.toFixed(1)}°F, Actual=${currentSupplyTemp.toFixed(1)}°F, ` +
          `Valve=${coolingValvePosition.toFixed(1)}%`);
      } else {
        logLocationEquipment(locationId, equipmentId, "air-handler", 
          `DEADBAND: Actual=${currentSupplyTemp.toFixed(1)}°F, Target=${supplySetpoint.toFixed(1)}°F, ` +
          `Error=${tempError.toFixed(1)}°F - valves closed`);
      }

      // Update setpoints in PID state
      stateStorageInput.heatingPidState.lastSetpoint = supplySetpoint;
      stateStorageInput.coolingPidState.lastSetpoint = supplySetpoint;
    } else {
      logLocationEquipment(locationId, equipmentId, "air-handler", 
        `Valve control inactive - Fan=${fanEnabled}, TempControl=${tempControlActive}, Freezestat=${freezestatTripped}`);
      
      if (freezestatTripped) {
        heatingValvePosition = 0; // Fully open for freeze protection
        logLocationEquipment(locationId, equipmentId, "air-handler", "FREEZE PROTECT: Heating valve fully open");
      }
    }

    // STEP 9: Construct result
    const result = {
      heatingValvePosition: Math.max(0, Math.min(100, heatingValvePosition)),
      coolingValvePosition: Math.max(0, Math.min(100, coolingValvePosition)),
      fanEnabled: fanEnabled,
      fanSpeed: fanEnabled ? "low" : "off",
      fanVFDSpeed: Math.max(0, Math.min(100, fanVFDSpeed)),
      outdoorDamperPosition: outdoorDamperPosition,
      supplyAirTempSetpoint: parseFloat(supplySetpoint.toFixed(1)),
      temperatureSetpoint: parseSafeNumber(currentSettings.temperatureSetpoint, 72),
      unitEnable: true,
      isOccupied: isOccupied,
      actualDuctStaticPressure: parseFloat(ductStaticPressure.toFixed(2)),
      targetDuctStaticPressure: fanEnabled ? parseFloat(staticPressureSetpoint.toFixed(2)) : 0,
      returnAirTemp: parseFloat(returnAirTemp.toFixed(1)),
      mixedAirTemp: parseFloat(mixedAirTemp.toFixed(1)),
      outdoorTemp: parseFloat(outdoorTemp.toFixed(1)),
      currentSupplyAirTemp: parseFloat(currentSupplyTemp.toFixed(1)),
      stateStorage: stateStorageInput
    };

    logLocationEquipment(locationId, equipmentId, "air-handler",
      `FINAL CONTROLS: Fan=${result.fanEnabled}, VFD=${result.fanVFDSpeed.toFixed(1)}%, ` +
      `Heat=${result.heatingValvePosition.toFixed(1)}%, Cool=${result.coolingValvePosition.toFixed(1)}%, ` +
      `Damper=${result.outdoorDamperPosition}%, Setpoint=${result.supplyAirTempSetpoint.toFixed(1)}°F, ` +
      `Occupied=${result.isOccupied}`);

    // STEP 10: Write to InfluxDB
    await writeToInfluxDB(locationId, equipmentId, result, "airhandler");

    // STEP 11: Return filtered result
    return filterValidCommands(result);

  } catch (error: any) {
    logLocationEquipment(locationId, equipmentId, "air-handler", 
      `ERROR in FirstChurchofGod air handler control: ${error.message}`, error.stack);

    const errorResult = {
      heatingValvePosition: 0,
      coolingValvePosition: 100,
      fanEnabled: false,
      fanSpeed: "off",
      fanVFDSpeed: 0,
      outdoorDamperPosition: 0,
      supplyAirTempSetpoint: 65,
      temperatureSetpoint: 72,
      unitEnable: false,
      isOccupied: false
    };

    try {
      await writeToInfluxDB(locationId, equipmentId, errorResult, "airhandler");
    } catch (writeError) {
      logLocationEquipment(locationId, equipmentId, "air-handler", 
        `Failed to write emergency state to InfluxDB: ${writeError.message}`);
    }

    return errorResult;
  }
}

/**
 * Helper function to filter result to only include valid control commands
 */
function filterValidCommands(result: any): any {
  const validControlCommands = [
    'heatingValvePosition', 'coolingValvePosition', 'fanEnabled', 'fanSpeed',
    'fanVFDSpeed', 'outdoorDamperPosition', 'supplyAirTempSetpoint',
    'temperatureSetpoint', 'unitEnable', 'isOccupied'
  ];

  const filteredResult = {};
  for (const [key, value] of Object.entries(result)) {
    if (validControlCommands.includes(key)) {
      filteredResult[key] = value;
    }
  }

  return filteredResult;
}

/**
 * Helper function to write AIR HANDLER data to InfluxDB with proper error handling
 */
async function writeToInfluxDB(locationId: string, equipmentId: string, data: any, equipmentType: string): Promise<void> {
  try {
    // AIR HANDLER COMMANDS
    const commandsToSend = [
      { command_type: 'heatingValvePosition', equipment_id: equipmentId, value: data.heatingValvePosition },
      { command_type: 'coolingValvePosition', equipment_id: equipmentId, value: data.coolingValvePosition },
      { command_type: 'fanEnabled', equipment_id: equipmentId, value: data.fanEnabled },
      { command_type: 'fanSpeed', equipment_id: equipmentId, value: data.fanSpeed },
      { command_type: 'fanVFDSpeed', equipment_id: equipmentId, value: data.fanVFDSpeed },
      { command_type: 'outdoorDamperPosition', equipment_id: equipmentId, value: data.outdoorDamperPosition },
      { command_type: 'supplyAirTempSetpoint', equipment_id: equipmentId, value: data.supplyAirTempSetpoint },
      { command_type: 'temperatureSetpoint', equipment_id: equipmentId, value: data.temperatureSetpoint },
      { command_type: 'unitEnable', equipment_id: equipmentId, value: data.unitEnable },
      { command_type: 'isOccupied', equipment_id: equipmentId, value: data.isOccupied }
    ];

    const numericCommands = [];

    // Process commands with correct data types for InfluxDB schema
    for (const cmd of commandsToSend) {
      // Boolean fields - send as true/false or 1/0 based on field type
      if (['fanEnabled'].includes(cmd.command_type)) {
        cmd.value = cmd.value ? 1.0 : 0.0; // fanEnabled uses 1/0
      } else if (['unitEnable', 'isOccupied'].includes(cmd.command_type)) {
        cmd.value = cmd.value ? 'true' : 'false'; // Other booleans use true/false
      }
      // Numeric fields - send as numbers
      else if (['heatingValvePosition', 'coolingValvePosition', 'fanVFDSpeed', 
                'outdoorDamperPosition', 'supplyAirTempSetpoint', 'temperatureSetpoint'].includes(cmd.command_type)) {
        if (typeof cmd.value === 'number') {
          // Already numeric
        } else if (cmd.value !== null && cmd.value !== undefined) {
          const numValue = Number(cmd.value);
          if (!isNaN(numValue)) {
            cmd.value = numValue;
          } else {
            continue;
          }
        } else {
          cmd.value = 0.0;
        }
      }
      // String fields
      else if (['fanSpeed'].includes(cmd.command_type)) {
        cmd.value = `"${cmd.value}"`;
      }

      numericCommands.push(cmd);
    }

    if (numericCommands.length > 0) {
      const { execSync } = require('child_process');

      let successCount = 0;
      let errorCount = 0;

      // Send each command individually using synchronous exec
      for (const cmd of numericCommands) {
        const lineProtocol = `update_${cmd.command_type},equipment_id=${cmd.equipment_id},location_id=${locationId},command_type=${cmd.command_type},equipment_type=airhandler,source=server_logic,status=completed value=${cmd.value}`;

        // Write to ControlCommands DB
        const controlCommand = `curl -s -X POST "http://localhost:8181/api/v3/write_lp?db=ControlCommands&precision=nanosecond" -H "Content-Type: text/plain" -d '${lineProtocol}'`;

        try {
          const result = execSync(controlCommand, { encoding: 'utf8', timeout: 5000 });
          if (result && result.trim()) {
            logLocationEquipment(locationId, equipmentId, equipmentType, `ControlCommands response for ${cmd.command_type}: ${result.trim()}`);
          } else {
            successCount++;
            logLocationEquipment(locationId, equipmentId, equipmentType, `ControlCommands SUCCESS: ${cmd.command_type}=${cmd.value}`);
          }
        } catch (error) {
          errorCount++;
          logLocationEquipment(locationId, equipmentId, equipmentType, `ControlCommands ERROR for ${cmd.command_type}: ${error.message}`);
        }

        // Write to Locations DB
        const locationsCommand = `curl -s -X POST "http://localhost:8181/api/v3/write_lp?db=Locations&precision=nanosecond" -H "Content-Type: text/plain" -d '${lineProtocol}'`;

        try {
          const result = execSync(locationsCommand, { encoding: 'utf8', timeout: 5000 });
          if (result && result.trim()) {
            logLocationEquipment(locationId, equipmentId, equipmentType, `Locations response for ${cmd.command_type}: ${result.trim()}`);
          }
        } catch (error) {
          logLocationEquipment(locationId, equipmentId, equipmentType, `Locations ERROR for ${cmd.command_type}: ${error.message}`);
        }
      }

      logLocationEquipment(locationId, equipmentId, equipmentType, 
        `InfluxDB write complete: ${successCount} success, ${errorCount} errors out of ${numericCommands.length} commands`);
    }
  } catch (error) {
    logLocationEquipment(locationId, equipmentId, equipmentType, `Error sending InfluxDB commands: ${error.message}`);
  }
}
