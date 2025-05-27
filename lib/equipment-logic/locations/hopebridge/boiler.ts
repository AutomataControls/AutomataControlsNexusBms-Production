// lib/equipment-logic/locations/hopebridge/boiler.ts
//
// ===============================================================================
// HOPEBRIDGE BOILER CONTROL LOGIC - LEAD/LAG HOT WATER SYSTEM
// ===============================================================================
//
// OVERVIEW:
// This file controls the lead/lag boiler system at the Hopebridge location for
// hot water heating throughout the facility. The system provides consistent
// hot water temperatures for optimal comfort in autism therapy environments.
//
// EQUIPMENT CONFIGURATION:
// - Boiler 1: Currently disconnected for repairs (should not be enabled)
// - Boiler 2: Primary operating unit (should be lead while Boiler 1 is down)
// - Lead/Lag Operation: Only one boiler runs at a time under normal conditions
// - Control Source: Supply water temperature (H2O Supply)
//
// CONTROL STRATEGY:
// 1. Supply Water Temperature Control - Uses actual supply water temperature
// 2. Outdoor Air Reset (OAR) - Automatically adjusts setpoints based on outdoor temp
// 3. Lead/Lag Management - Coordinates multiple boilers for efficiency
// 4. Continuous Operation - No occupancy schedules (runs 24/7)
// 5. Safety Monitoring - Comprehensive protection and fault detection
//
// OAR SETPOINTS (Hopebridge Specific):
// - When Outdoor Temp = 32°F → Supply Setpoint = 155°F (Max Heat)
// - When Outdoor Temp = 72°F → Supply Setpoint = 80°F (Min Heat)
// - Temperatures between 32°F-72°F are calculated proportionally
// - Designed for moderate heating loads typical in therapy environments
//
// LEAD/LAG OPERATION:
// - Lead boiler operates first and handles base load
// - Lag boiler only operates if lead boiler fails or cannot meet demand
// - Automatic changeover based on equipment status and performance
// - Only one boiler enabled at a time under normal conditions
//
// BOILER DETAILS:
//
// Boiler 1 (Disconnected):
// - Currently offline for repairs
// - Should not be enabled or selected as lead
// - System should automatically use Boiler 2 as primary
// - Monitor for when repairs are completed and unit can return to service
//
// Boiler 2 (Primary):
// - Main operating unit while Boiler 1 is down
// - Should be set as lead boiler automatically
// - Handles all heating load until Boiler 1 returns to service
// - Standard hot water boiler operation with firing control
//
// SUPPLY TEMPERATURE SOURCES:
// - Primary: H20Supply or H2OSupply
// - Secondary: H2O Supply, H2O_Supply, Supply
// - Fallbacks: supplyTemperature, SupplyTemp, supplyTemp, SupplyTemperature
// - Additional: waterSupplyTemp, WaterSupplyTemp, boilerSupplyTemp
// - Default: 140°F if no temperature reading available
//
// SAFETY FEATURES:
// - Supply temperature monitoring and validation
// - Lead/lag coordination prevents both boilers running simultaneously
// - OAR limits prevent overheating in mild weather
// - Continuous operation ensures consistent therapy environment temperatures
// - Emergency shutdown procedures with proper state logging
//
// OPERATIONAL NOTES:
// - No occupancy schedules - boilers run continuously as needed
// - Supply temperature setpoint varies from 80°F to 155°F based on outdoor conditions
// - System automatically adjusts to single-boiler operation while Boiler 1 is down
// - Lead/lag changeover occurs automatically based on equipment status
// - Monitor both boilers for proper sequencing and fault conditions
//
// DATA STORAGE:
// - Commands are written directly to both Locations and ControlCommands databases
// - All operations are logged for troubleshooting and maintenance scheduling
// - State storage maintains lead/lag coordination and equipment status
//
// TECHNICIAN NOTES:
// - Check supply water temperature sensor if boiler control seems erratic
// - Verify outdoor temperature sensor for proper OAR operation
// - Monitor lead/lag operation - only one boiler should run at a time normally
// - Boiler 1 is currently disconnected - check repair status regularly
// - System should automatically use Boiler 2 as lead while Boiler 1 is down
// - OAR setpoints are optimized for therapy facility comfort requirements
// - Continuous operation is normal - no occupancy-based shutdowns
// - Use Node-RED dashboard to monitor boiler sequencing and water temperatures
// - Check firing rates and efficiency during normal operation cycles
// - Coordinate with facilities team when Boiler 1 repairs are completed
//
// ===============================================================================

import { boilerControl as boilerControlBase } from "../../base/boiler";
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

/**
 * Extract boiler number from equipment ID
 */
function getBoilerNumber(equipmentId: string): number {
  try {
    // Check for "Boiler 1" or "Boiler 2" in the ID
    if (equipmentId.includes("Boiler 1") || equipmentId.includes("Boiler-1") || equipmentId.includes("Boiler1")) {
      return 1;
    }
    if (equipmentId.includes("Boiler 2") || equipmentId.includes("Boiler-2") || equipmentId.includes("Boiler2")) {
      return 2;
    }

    // Try to extract the number from the ID
    const match = equipmentId.match(/(\d+)/);
    if (match) {
      return parseInt(match[0], 10);
    }

    // Default to boiler 2 if we can't determine (since boiler 1 is disconnected)
    return 2;
  } catch (error) {
    console.error(`Error determining boiler number: ${error}`);
    return 2; // Default to boiler 2 since boiler 1 is disconnected
  }
}

export async function boilerControl(
  metricsInput: any,
  settingsInput: any,
  currentTempArgument: number,
  stateStorageInput: any
) {
  const equipmentId = settingsInput.equipmentId || "unknown";
  const locationId = settingsInput.locationId || "5"; // Hopebridge location ID

  const currentMetrics = metricsInput;
  const currentSettings = settingsInput;

  logLocationEquipment(locationId, equipmentId, "boiler", "Starting Hopebridge boiler control logic");

  try {
    // Initialize state storage if needed
    if (!stateStorageInput) {
      stateStorageInput = {};
    }

    // STEP 1: Handle boiler identification and repair status
    const boilerNumber = getBoilerNumber(equipmentId);
    logLocationEquipment(locationId, equipmentId, "boiler", `Identified as Boiler ${boilerNumber}`);

    if (boilerNumber === 1) {
      logLocationEquipment(locationId, equipmentId, "boiler",
        "WARNING: Boiler 1 is currently disconnected for repairs, system should be using Boiler 2");
    }

    // STEP 2: Get supply temperature with comprehensive fallbacks
    let currentTemp = currentTempArgument;

    if (currentTemp === undefined || isNaN(currentTemp)) {
      currentTemp = parseSafeNumber(currentMetrics.H20Supply,
        parseSafeNumber(currentMetrics.H2OSupply,
        parseSafeNumber(currentMetrics["H2O Supply"],
        parseSafeNumber(currentMetrics.H2O_Supply,
        parseSafeNumber(currentMetrics.Supply,
        parseSafeNumber(currentMetrics.supplyTemperature,
        parseSafeNumber(currentMetrics.SupplyTemp,
        parseSafeNumber(currentMetrics.supplyTemp,
        parseSafeNumber(currentMetrics.SupplyTemperature,
        parseSafeNumber(currentMetrics.waterSupplyTemp,
        parseSafeNumber(currentMetrics.WaterSupplyTemp,
        parseSafeNumber(currentMetrics.boilerSupplyTemp, 140))))))))))));

      logLocationEquipment(locationId, equipmentId, "boiler", `Using supply temperature: ${currentTemp}°F`);
    } else {
      logLocationEquipment(locationId, equipmentId, "boiler", `Using provided supply temperature: ${currentTemp}°F`);
    }

    // STEP 3: Get outdoor temperature with fallbacks
    const outdoorTemp = parseSafeNumber(currentMetrics.Outdoor_Air,
      parseSafeNumber(currentMetrics.outdoorTemperature,
      parseSafeNumber(currentMetrics.outdoorTemp,
      parseSafeNumber(currentMetrics.Outdoor,
      parseSafeNumber(currentMetrics.outdoor,
      parseSafeNumber(currentMetrics.OutdoorTemp,
      parseSafeNumber(currentMetrics.OAT,
      parseSafeNumber(currentMetrics.oat, 50))))))));

    logLocationEquipment(locationId, equipmentId, "boiler", `Outdoor temperature: ${outdoorTemp}°F`);

    // STEP 4: Calculate setpoint based on OAR curve
    let setpoint = 155; // Default to max setpoint

    // Hopebridge OAR parameters: Min OAT 32°F → SP 155°F, Max OAT 72°F → SP 80°F
    const minOAT = 32;
    const maxOAT = 72;
    const maxSupply = 155;
    const minSupply = 80;

    if (outdoorTemp <= minOAT) {
      setpoint = maxSupply;
      logLocationEquipment(locationId, equipmentId, "boiler",
        `OAR: OAT ${outdoorTemp}°F <= ${minOAT}°F, using max setpoint: ${setpoint}°F`);
    } else if (outdoorTemp >= maxOAT) {
      setpoint = minSupply;
      logLocationEquipment(locationId, equipmentId, "boiler",
        `OAR: OAT ${outdoorTemp}°F >= ${maxOAT}°F, using min setpoint: ${setpoint}°F`);
    } else {
      // Linear interpolation for values between min and max
      const ratio = (outdoorTemp - minOAT) / (maxOAT - minOAT);
      setpoint = maxSupply - ratio * (maxSupply - minSupply);
      setpoint = parseFloat(setpoint.toFixed(1));
      logLocationEquipment(locationId, equipmentId, "boiler",
        `OAR: Calculated setpoint: ${setpoint}°F (ratio: ${ratio.toFixed(2)})`);
    }

    // STEP 5: Determine lead/lag status
    let isLeadBoiler = false;
    const groupId = currentSettings.boilerGroupId || currentSettings.groupId || currentSettings.systemGroupId || null;

    if (groupId) {
      logLocationEquipment(locationId, equipmentId, "boiler", `Boiler is part of group ${groupId}`);

      if (currentSettings.isLeadBoiler !== undefined) {
        isLeadBoiler = currentSettings.isLeadBoiler;
        logLocationEquipment(locationId, equipmentId, "boiler",
          `Boiler is ${isLeadBoiler ? "LEAD" : "LAG"} based on settings`);
      } else if (currentMetrics.isLeadBoiler !== undefined) {
        isLeadBoiler = currentMetrics.isLeadBoiler;
        logLocationEquipment(locationId, equipmentId, "boiler",
          `Boiler is ${isLeadBoiler ? "LEAD" : "LAG"} based on metrics`);
      } else if (boilerNumber === 1) {
        // Boiler 1 is disconnected, so it shouldn't be lead
        isLeadBoiler = false;
        logLocationEquipment(locationId, equipmentId, "boiler",
          "Boiler 1 should not be lead since it's disconnected for repairs");
      } else {
        // Boiler 2 should be lead since Boiler 1 is disconnected
        isLeadBoiler = true;
        logLocationEquipment(locationId, equipmentId, "boiler",
          "Boiler 2 should be lead since Boiler 1 is disconnected for repairs");
      }
    } else {
      // If not in a group, default to lead (unless it's the disconnected Boiler 1)
      isLeadBoiler = boilerNumber !== 1;
      logLocationEquipment(locationId, equipmentId, "boiler",
        `Boiler not part of a group, defaulting to ${isLeadBoiler ? "LEAD" : "LAG (disconnected)"}`);
    }

    // STEP 6: Determine if boiler should be enabled
    let unitEnable = true;
    let firing = false;

    // Boiler 1 should never be enabled since it's disconnected
    if (boilerNumber === 1) {
      unitEnable = false;
      firing = false;
      logLocationEquipment(locationId, equipmentId, "boiler",
        "Boiler 1 DISABLED - disconnected for repairs");
    } else {
      // For other boilers, determine firing based on temperature and lead/lag status
      if (isLeadBoiler) {
        // Lead boiler fires based on temperature demand
        const temperatureError = setpoint - currentTemp;
        firing = temperatureError > 2.0; // Fire when more than 2°F below setpoint

        logLocationEquipment(locationId, equipmentId, "boiler",
          `Lead boiler firing: ${firing ? "YES" : "NO"} (error: ${temperatureError.toFixed(1)}°F)`);
      } else {
        // Lag boiler only fires if lead boiler cannot meet demand (not implemented here)
        firing = false;
        logLocationEquipment(locationId, equipmentId, "boiler",
          "Lag boiler not firing (lead boiler handling load)");
      }
    }

    // STEP 7: Construct result
    const result = {
      unitEnable: unitEnable,
      firing: firing,
      waterTempSetpoint: setpoint,
      temperatureSetpoint: setpoint,
      isLead: isLeadBoiler ? 1 : 0,
      boilerNumber: boilerNumber,
      boilerGroupId: groupId,
      outdoorTemp: outdoorTemp,
      supplyTemp: currentTemp
    };

    logLocationEquipment(locationId, equipmentId, "boiler",
      `Final Boiler ${boilerNumber} controls: Enable=${result.unitEnable ? "ON" : "OFF"}, ` +
      `Firing=${result.firing ? "ON" : "OFF"}, Setpoint=${result.waterTempSetpoint}°F, ` +
      `Lead=${result.isLead ? "YES" : "NO"}`);

    // STEP 8: Write to InfluxDB
    await writeToInfluxDB(locationId, equipmentId, result, "boiler");

    // STEP 9: Return filtered result
    return filterValidCommands(result);

  } catch (error: any) {
    logLocationEquipment(locationId, equipmentId, "boiler",
      `ERROR in Hopebridge boiler control: ${error.message}`, error.stack);

    const errorResult = {
      unitEnable: false,
      firing: false,
      waterTempSetpoint: 80,
      temperatureSetpoint: 80,
      isLead: 0,
      boilerNumber: getBoilerNumber(equipmentId),
      boilerGroupId: null,
      outdoorTemp: 50,
      supplyTemp: 140
    };

    try {
      await writeToInfluxDB(locationId, equipmentId, errorResult, "boiler");
    } catch (writeError) {
      logLocationEquipment(locationId, equipmentId, "boiler",
        `Failed to write emergency state to InfluxDB: ${writeError.message}`);
    }

    return filterValidCommands(errorResult);
  }
}

/**
 * Helper function to filter result to only include valid control commands
 */
function filterValidCommands(result: any): any {
  const validControlCommands = [
    'unitEnable', 'firing', 'waterTempSetpoint', 'temperatureSetpoint',
    'isLead', 'boilerNumber', 'boilerGroupId', 'outdoorTemp', 'supplyTemp'
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
 * Helper function to write BOILER data to InfluxDB with proper error handling
 */
async function writeToInfluxDB(locationId: string, equipmentId: string, data: any, equipmentType: string): Promise<void> {
  try {
    // BOILER COMMANDS
    const commandsToSend = [
      { command_type: 'unitEnable', equipment_id: equipmentId, value: data.unitEnable },
      { command_type: 'firing', equipment_id: equipmentId, value: data.firing },
      { command_type: 'waterTempSetpoint', equipment_id: equipmentId, value: data.waterTempSetpoint },
      { command_type: 'temperatureSetpoint', equipment_id: equipmentId, value: data.temperatureSetpoint },
      { command_type: 'isLead', equipment_id: equipmentId, value: data.isLead },
      { command_type: 'boilerNumber', equipment_id: equipmentId, value: data.boilerNumber },
      { command_type: 'outdoorTemp', equipment_id: equipmentId, value: data.outdoorTemp },
      { command_type: 'supplyTemp', equipment_id: equipmentId, value: data.supplyTemp }
    ];

    // Add optional commands
    if (data.boilerGroupId !== null && data.boilerGroupId !== undefined) {
      commandsToSend.push({ command_type: 'boilerGroupId', equipment_id: equipmentId, value: data.boilerGroupId });
    }

    const validCommands = [];

    // Process commands with correct data types for InfluxDB schema
    for (const cmd of commandsToSend) {
      // Boolean fields
      if (['unitEnable', 'firing'].includes(cmd.command_type)) {
        cmd.value = cmd.value ? 'true' : 'false'; // Boolean fields use true/false
      }
      // Numeric fields (including isLead which uses 1/0)
      else if (['waterTempSetpoint', 'temperatureSetpoint', 'isLead', 'boilerNumber', 
                'outdoorTemp', 'supplyTemp'].includes(cmd.command_type)) {
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
      else if (['boilerGroupId'].includes(cmd.command_type)) {
        cmd.value = `"${cmd.value}"`;
      }

      validCommands.push(cmd);
    }

    if (validCommands.length > 0) {
      const { execSync } = require('child_process');

      let successCount = 0;
      let errorCount = 0;

      // Send each command individually using synchronous exec
      for (const cmd of validCommands) {
        const lineProtocol = `update_${cmd.command_type},equipment_id=${cmd.equipment_id},location_id=${locationId},command_type=${cmd.command_type},equipment_type=boiler,source=server_logic,status=completed value=${cmd.value}`;

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
        `InfluxDB write complete: ${successCount} success, ${errorCount} errors out of ${validCommands.length} commands`);
    }
  } catch (error) {
    logLocationEquipment(locationId, equipmentId, equipmentType, `Error sending InfluxDB commands: ${error.message}`);
  }
}
