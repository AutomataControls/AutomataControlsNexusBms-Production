// @ts-nocheck
// lib/equipment-logic/locations/warren/fan-coil.ts
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
// - Same base safety conditions as other locations
// - FreezeStat and Hi-Limit protection
// - Valve position validation and clamping
//
// DATA STORAGE:
// - Commands are written directly to both Locations and ControlCommands databases
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
//
// ===============================================================================

import { fanCoilControl as fanCoilControlBase } from "../../base/fan-coil";
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

export async function fanCoilControl(
  metricsInput: any,
  settingsInput: any,
  currentTempArgument: number,
  stateStorageInput: any
) {
  const equipmentId = settingsInput.equipmentId || "unknown";
  const locationId = settingsInput.locationId || "1";

  const currentMetrics = metricsInput;
  const currentSettings = settingsInput;

  logLocationEquipment(locationId, equipmentId, "fan-coil", "Starting Warren fan coil control logic");

  try {
    // STEP 1: Determine current space temperature with Warren-specific sensor mapping
    let currentTemp = currentTempArgument;

    if (currentTemp === undefined || isNaN(currentTemp)) {
      // Warren-specific space temperature sensor mapping with extensive fallbacks
      currentTemp = parseSafeNumber(currentMetrics.Space,
        parseSafeNumber(currentMetrics.spaceTemperature,
        parseSafeNumber(currentMetrics.SpaceTemp,
        parseSafeNumber(currentMetrics.spaceTemp,
        parseSafeNumber(currentMetrics.SpaceTemperature,
        parseSafeNumber(currentMetrics.roomTemp,
        parseSafeNumber(currentMetrics.RoomTemp,
        parseSafeNumber(currentMetrics.roomTemperature,
        parseSafeNumber(currentMetrics.RoomTemperature,
        parseSafeNumber(currentMetrics.temperature,
        parseSafeNumber(currentMetrics.Temperature,
        parseSafeNumber(currentMetrics.coveTemp,
        parseSafeNumber(currentMetrics.kitchenTemp,
        parseSafeNumber(currentMetrics.mailRoomTemp,
        parseSafeNumber(currentMetrics.chapelTemp,
        parseSafeNumber(currentMetrics.office1Temp,
        parseSafeNumber(currentMetrics.office2Temp,
        parseSafeNumber(currentMetrics.office3Temp,
        parseSafeNumber(currentMetrics.itRoomTemp,
        parseSafeNumber(currentMetrics.beautyShopTemp,
        parseSafeNumber(currentMetrics.natatoriumTemp,
        parseSafeNumber(currentMetrics.hall1Temp,
        parseSafeNumber(currentMetrics.hall2Temp, 72)))))))))))))))))))))));

      logLocationEquipment(locationId, equipmentId, "fan-coil", 
        `Using space temperature: ${currentTemp}°F`);
    } else {
      logLocationEquipment(locationId, equipmentId, "fan-coil", 
        `Using provided current temperature: ${currentTemp}°F`);
    }

    // STEP 2: Get outdoor temperature with fallbacks
    const outdoorTemp = parseSafeNumber(currentMetrics.Outdoor_Air,
      parseSafeNumber(currentMetrics.outdoorTemperature,
      parseSafeNumber(currentMetrics.outdoorTemp,
      parseSafeNumber(currentMetrics.Outdoor,
      parseSafeNumber(currentMetrics.outdoor,
      parseSafeNumber(currentMetrics.OutdoorTemp,
      parseSafeNumber(currentMetrics.OAT,
      parseSafeNumber(currentMetrics.oat, 65))))))));

    logLocationEquipment(locationId, equipmentId, "fan-coil", 
      `Outdoor temperature: ${outdoorTemp}°F`);

    // STEP 3: Determine temperature setpoint with user override priority
    let temperatureSetpoint = parseSafeNumber(currentSettings.temperatureSetpoint, undefined);

    // Check if temperatureSetpoint is available in metrics (from UI) - HIGHEST PRIORITY
    const userSetpoint = parseSafeNumber(currentMetrics.temperatureSetpoint,
      parseSafeNumber(currentMetrics.temperature_setpoint,
      parseSafeNumber(currentMetrics.control_value,
      parseSafeNumber(currentMetrics.command, undefined))));

    if (userSetpoint !== undefined) {
      temperatureSetpoint = userSetpoint;
      logLocationEquipment(locationId, equipmentId, "fan-coil",
        `Using user-set temperature setpoint from UI: ${temperatureSetpoint}°F (HIGHEST PRIORITY)`);
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
        logLocationEquipment(locationId, equipmentId, "fan-coil",
          `OAR: OAT ${outdoorTemp}°F <= ${minOAT}°F, using max setpoint: ${temperatureSetpoint}°F`);
      } else if (outdoorTemp >= maxOAT) {
        temperatureSetpoint = minSetpoint;
        logLocationEquipment(locationId, equipmentId, "fan-coil",
          `OAR: OAT ${outdoorTemp}°F >= ${maxOAT}°F, using min setpoint: ${temperatureSetpoint}°F`);
      } else {
        // Linear interpolation between the two points
        const ratio = (outdoorTemp - minOAT) / (maxOAT - minOAT);
        temperatureSetpoint = maxSetpoint - ratio * (maxSetpoint - minSetpoint);
        temperatureSetpoint = parseFloat(temperatureSetpoint.toFixed(1));
        logLocationEquipment(locationId, equipmentId, "fan-coil",
          `OAR: Calculated setpoint: ${temperatureSetpoint}°F (ratio: ${ratio.toFixed(2)})`);
      }
    } else {
      logLocationEquipment(locationId, equipmentId, "fan-coil",
        `Using settings temperatureSetpoint: ${temperatureSetpoint}°F`);
    }

    // STEP 4: Determine outdoor damper position with Warren-specific logic
    let outdoorDamperPosition = 0;

    // Warren damper logic: Open when 40°F < OAT ≤ 80°F
    if (outdoorTemp > 40 && outdoorTemp <= 80) {
      outdoorDamperPosition = 100; // Fully open (maps to 10V)
      logLocationEquipment(locationId, equipmentId, "fan-coil",
        `OA damper: OPEN (OAT ${outdoorTemp}°F is between 40°F and 80°F)`);
    } else {
      outdoorDamperPosition = 0; // Closed (maps to 0V)
      if (outdoorTemp <= 40) {
        logLocationEquipment(locationId, equipmentId, "fan-coil",
          `OA damper: CLOSED (OAT ${outdoorTemp}°F <= 40°F - too cold)`);
      } else {
        logLocationEquipment(locationId, equipmentId, "fan-coil",
          `OA damper: CLOSED (OAT ${outdoorTemp}°F > 80°F - too hot)`);
      }
    }

    // STEP 5: Check for safety conditions
    // Use base safety logic - no Warren-specific overrides needed

    // STEP 6: Set up Warren-specific PID parameters and settings
    const warrenSettings = {
      ...currentSettings,
      temperatureSetpoint: temperatureSetpoint,
      pidControllers: {
        cooling: {
          ...(currentSettings.pidControllers?.cooling || {}),
          // Warren-specific cooling settings - conservative tuning
          kp: 0.6,        // Proportional gain
          ki: 0.05,       // Integral gain  
          kd: 0.01,       // Derivative gain
          enabled: true,  // Ensure PID is enabled
          outputMin: 0,   // 0% = 0V (valve closed) - Direct acting
          outputMax: 100, // 100% = 10V (valve open) - Direct acting
          reverseActing: false, // Direct acting for cooling
          maxIntegral: 15 // Anti-windup parameter
        },
        heating: {
          ...(currentSettings.pidControllers?.heating || {}),
          // Warren-specific heating settings - slightly more responsive
          kp: 0.7,        // Proportional gain
          ki: 0.04,       // Integral gain
          kd: 0.02,       // Derivative gain
          enabled: true,  // Ensure PID is enabled
          outputMin: 0,   // 0% = 10V (valve closed) - Reverse acting
          outputMax: 100, // 100% = 0V (valve open) - Reverse acting
          reverseActing: true, // Reverse acting for heating
          maxIntegral: 15 // Anti-windup parameter
        }
      }
    };

    // STEP 7: Call base implementation with Warren-specific settings
    logLocationEquipment(locationId, equipmentId, "fan-coil",
      `Calling base implementation with Warren settings - Setpoint: ${temperatureSetpoint}°F, Current: ${currentTemp}°F, Error: ${(temperatureSetpoint - currentTemp).toFixed(1)}°F`);

    const baseResult = fanCoilControlBase(currentMetrics, warrenSettings, currentTemp, stateStorageInput);

    // STEP 8: Override result with Warren-specific values
    const result = {
      ...baseResult,
      outdoorDamperPosition: outdoorDamperPosition, // Use our calculated OA damper position
      temperatureSetpoint: temperatureSetpoint // Ensure our setpoint is preserved
    };

    // Log control calculation details
    logLocationEquipment(locationId, equipmentId, "fan-coil",
      `Control calculation: Space temp=${currentTemp}°F, Setpoint=${temperatureSetpoint}°F, ` +
      `Error=${(temperatureSetpoint - currentTemp).toFixed(1)}°F, ` +
      `Heating=${result.heatingValvePosition}%, Cooling=${result.coolingValvePosition}%`);

    // STEP 9: Write data to InfluxDB
    await writeToInfluxDB(locationId, equipmentId, result, "fancoil");

    // STEP 10: Return filtered result
    const filteredResult = filterValidCommands(result);

    logLocationEquipment(locationId, equipmentId, "fan-coil",
      `Final control values: Fan=${filteredResult.fanEnabled ? "ON" : "OFF"}, ` +
      `Heating=${filteredResult.heatingValvePosition}%, Cooling=${filteredResult.coolingValvePosition}%, ` +
      `Damper=${filteredResult.outdoorDamperPosition}%, Unit=${filteredResult.unitEnable ? "ON" : "OFF"}`);

    return filteredResult;

  } catch (error: any) {
    logLocationEquipment(locationId, equipmentId, "fan-coil", 
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

    try {
      await writeToInfluxDB(locationId, equipmentId, errorResult, "fancoil");
    } catch (writeError) {
      logLocationEquipment(locationId, equipmentId, "fan-coil", 
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
    'fanEnabled', 'outdoorDamperPosition', 'heatingValvePosition',
    'coolingValvePosition', 'temperatureSetpoint', 'unitEnable',
    'fanSpeed', 'fanMode', 'heatingValveMode', 'coolingValveMode', 'operationMode'
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
 * Helper function to write FAN COIL data to InfluxDB with proper error handling
 */
async function writeToInfluxDB(locationId: string, equipmentId: string, data: any, equipmentType: string): Promise<void> {
  try {
    // FAN COIL COMMANDS
    const commandsToSend = [
      { command_type: 'fanEnabled', equipment_id: equipmentId, value: data.fanEnabled },
      { command_type: 'outdoorDamperPosition', equipment_id: equipmentId, value: data.outdoorDamperPosition },
      { command_type: 'heatingValvePosition', equipment_id: equipmentId, value: data.heatingValvePosition },
      { command_type: 'coolingValvePosition', equipment_id: equipmentId, value: data.coolingValvePosition },
      { command_type: 'temperatureSetpoint', equipment_id: equipmentId, value: data.temperatureSetpoint },
      { command_type: 'unitEnable', equipment_id: equipmentId, value: data.unitEnable },
      { command_type: 'fanSpeed', equipment_id: equipmentId, value: data.fanSpeed },
      { command_type: 'fanMode', equipment_id: equipmentId, value: data.fanMode },
      { command_type: 'heatingValveMode', equipment_id: equipmentId, value: data.heatingValveMode },
      { command_type: 'coolingValveMode', equipment_id: equipmentId, value: data.coolingValveMode },
      { command_type: 'operationMode', equipment_id: equipmentId, value: data.operationMode }
    ];

    const numericCommands = [];

    // Process commands with correct data types for InfluxDB schema
    for (const cmd of commandsToSend) {
      // Special handling for fanEnabled - MUST be 1/0 not true/false
      if (cmd.command_type === 'fanEnabled') {
        cmd.value = cmd.value ? 1.0 : 0.0;
      }
      // Boolean fields - send as true/false (except fanEnabled)
      else if (['unitEnable'].includes(cmd.command_type)) {
        cmd.value = cmd.value ? 'true' : 'false';
      }
      // Numeric fields - send as numbers
      else if (['outdoorDamperPosition', 'heatingValvePosition', 'coolingValvePosition', 'temperatureSetpoint'].includes(cmd.command_type)) {
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
      else if (['fanSpeed', 'fanMode', 'heatingValveMode', 'coolingValveMode', 'operationMode'].includes(cmd.command_type)) {
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
        const lineProtocol = `update_${cmd.command_type},equipment_id=${cmd.equipment_id},location_id=${locationId},command_type=${cmd.command_type},equipment_type=fancoil,source=server_logic,status=completed value=${cmd.value}`;

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
