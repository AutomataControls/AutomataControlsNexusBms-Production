// @ts-nocheck
// lib/equipment-logic/locations/huntington/boiler.ts
//
// ===============================================================================
// HUNTINGTON BOILER CONTROL LOGIC - INTEGRATED LEAD-LAG COMFORT BOILER SYSTEM
// ===============================================================================
//
// OVERVIEW:
// This file controls the lead-lag boiler system specifically for the Huntington location
// with integrated lead-lag management, failover detection, and scheduled rotation.
// All lead-lag decisions are made locally within Huntington equipment only.
//
// EQUIPMENT CONFIGURATION:
// - Huntington Comfort Boilers: Multiple units with lead-lag coordination
// - Equipment IDs: ZLYR6YveSmCEMqtBSy3e (primary), ZLb2FhwIlSmxBoIlEr2R (secondary)
// - Lead-Lag Operation: Only one boiler runs at a time under normal conditions
// - Control Source: Supply water temperature (H20 Supply)
//
// CONTROL STRATEGY:
// 1. Supply Water Temperature Control - Uses actual supply water temperature
// 2. Outdoor Air Reset (OAR) - Automatically adjusts setpoints based on outdoor temp
// 3. Integrated Lead-Lag Management - Local Huntington-only lead-lag coordination
// 4. Automatic Failover - Promotes lag boiler if lead boiler fails
// 5. Scheduled Rotation - Weekly changeover between boilers for even wear
// 6. Safety Monitoring - Comprehensive protection and fault detection
//
// OAR SETPOINTS (Huntington Specific):
// - When Outdoor Temp = 30°F → Supply Setpoint = 155°F (Max Heat)
// - When Outdoor Temp = 75°F → Supply Setpoint = 80°F (Min Heat)
// - Temperatures between 30°F-75°F are calculated proportionally
// - Designed for Huntington facility heating loads and building characteristics
//
// LEAD-LAG OPERATION (Huntington Internal Only):
// - Lead boiler operates and handles heating load
// - Lag boiler remains in standby mode (unitEnable=false, firing=0)
// - Automatic failover if lead boiler fails (supply temp >170°F, freezestat, fault status)
// - Weekly rotation between boilers (configurable interval)
// - Health monitoring every 30 seconds, rotation check every 5 minutes
//
// FAILOVER CONDITIONS:
// - Supply temperature exceeds 170°F (emergency shutoff condition)
// - Freezestat condition detected
// - Boiler status indicates fault or error
// - Lead boiler not responding to heating demand
//
// SUPPLY TEMPERATURE SOURCES:
// - Primary: H20Supply, H20Supply
// - Secondary: H20 Supply, H20_Supply, Supply
// - Fallbacks: supplyTemperature, SupplyTemp, supplyTemp, SupplyTemperature
// - Additional: waterSupplyTemp, WaterSupplyTemp, boilerSupplyTemp
// - Default: 140°F if no temperature reading available
//
// SAFETY FEATURES:
// - Emergency shutoff at 170°F supply temperature
// - Freezestat protection
// - Automatic failover to healthy boiler
// - Lag boiler monitoring and promotion
// - Comprehensive error handling and logging
//
// ROTATION SCHEDULE:
// - Default: Weekly rotation (7 days)
// - Configurable via HUNTINGTON_EQUIPMENT_GROUPS configuration
// - Automatic tracking of last changeover time
// - Prevents excessive switching during normal operation
//
// DATA STORAGE:
// - Commands are written directly to both Locations and ControlCommands databases
// - Lead-lag events logged to ControlCommands for monitoring and trending
// - State storage maintains lead-lag coordination and timing sequences
// - All operations logged for troubleshooting and maintenance scheduling
//
// TECHNICIAN NOTES:
// - Only one Huntington boiler should be firing at a time under normal conditions
// - Check supply water temperature sensor if lead-lag switching seems erratic
// - Verify outdoor temperature sensor for proper OAR operation
// - Monitor lead-lag events in ControlCommands database for failover history
// - Weekly rotation is normal - prevents single boiler from excessive wear
// - Emergency shutoff at 170°F is safety feature - check for overheating issues
// - Lag boiler in standby shows unitEnable=false but remains ready for failover
// - State storage tracks timing to prevent rapid switching during normal operation
// - Use Node-RED dashboard to monitor Huntington boiler sequencing and temperatures
// - Check Huntington lead-lag events for failover frequency and rotation timing
//
// ===============================================================================

import { logLocationEquipment } from "@/lib/logging/location-logger";
import { getHuntingtonLeadLagStatus } from "./lead-lag-helpers";

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

export async function boilerControl(
  metricsInput: any,
  settingsInput: any,
  currentTempArgument: number,
  stateStorageInput: any
) {
  const equipmentId = settingsInput.equipmentId || "unknown";
  const locationId = settingsInput.locationId || "4"; // Huntington location ID

  const currentMetrics = metricsInput;
  const currentSettings = settingsInput;

  logLocationEquipment(locationId, equipmentId, "boiler", "Starting Huntington boiler control with integrated lead-lag logic");

  try {
    // Initialize state storage if needed
    if (!stateStorageInput) {
      stateStorageInput = {};
    }

    // STEP 1: Get supply temperature with comprehensive fallbacks
    let currentTemp = currentTempArgument;

    if (currentTemp === undefined || isNaN(currentTemp)) {
      currentTemp = parseSafeNumber(currentMetrics.H20Supply,
        parseSafeNumber(currentMetrics.H20Supply,
        parseSafeNumber(currentMetrics["H20 Supply"],
        parseSafeNumber(currentMetrics.H20_Supply,
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

    // STEP 2: Get outdoor temperature with fallbacks
    const outdoorTemp = parseSafeNumber(currentMetrics.Outdoor_Air,
      parseSafeNumber(currentMetrics.outdoorTemperature,
      parseSafeNumber(currentMetrics.outdoorTemp,
      parseSafeNumber(currentMetrics.Outdoor,
      parseSafeNumber(currentMetrics.outdoor,
      parseSafeNumber(currentMetrics.OutdoorTemp,
      parseSafeNumber(currentMetrics.OAT,
      parseSafeNumber(currentMetrics.oat, 50))))))));

    logLocationEquipment(locationId, equipmentId, "boiler", `Outdoor temperature: ${outdoorTemp}°F`);

    // STEP 3: Calculate setpoint based on Huntington-specific OAR curve
    let setpoint = 155; // Default to max setpoint

    // Huntington OAR parameters: Min OAT 30°F → SP 155°F, Max OAT 75°F → SP 80°F
    const minOAT = 30;
    const maxOAT = 75;
    const maxSupply = 155;
    const minSupply = 80;

    if (outdoorTemp <= minOAT) {
      setpoint = maxSupply;
      logLocationEquipment(locationId, equipmentId, "boiler",
        `Huntington OAR: OAT ${outdoorTemp}°F <= ${minOAT}°F, using max setpoint: ${setpoint}°F`);
    } else if (outdoorTemp >= maxOAT) {
      setpoint = minSupply;
      logLocationEquipment(locationId, equipmentId, "boiler",
        `Huntington OAR: OAT ${outdoorTemp}°F >= ${maxOAT}°F, using min setpoint: ${setpoint}°F`);
    } else {
      // Linear interpolation for values between min and max
      const ratio = (outdoorTemp - minOAT) / (maxOAT - minOAT);
      setpoint = maxSupply - ratio * (maxSupply - minSupply);
      setpoint = parseFloat(setpoint.toFixed(1));
      logLocationEquipment(locationId, equipmentId, "boiler",
        `Huntington OAR: Calculated setpoint: ${setpoint}°F (ratio: ${ratio.toFixed(2)})`);
    }

    // STEP 4: Get Huntington lead-lag status (integrated local decision making)
    const leadLagStatus = await getHuntingtonLeadLagStatus(equipmentId, currentMetrics, stateStorageInput);
    
    logLocationEquipment(locationId, equipmentId, "boiler",
      `Huntington Lead-Lag Status: ${leadLagStatus.isLead ? "LEAD" : "LAG"}, ` +
      `Should Run: ${leadLagStatus.shouldRun}, Reason: ${leadLagStatus.reason}`);

    // STEP 5: Safety checks (always apply regardless of lead-lag status)
    let safetyShutoff = false;
    let safetyReason = "";

    // Emergency shutoff if supply temperature too high
    if (currentTemp > 170) {
      safetyShutoff = true;
      safetyReason = `Emergency shutoff: Supply temperature ${currentTemp}°F exceeds safe limit (170°F)`;
      logLocationEquipment(locationId, equipmentId, "boiler", `SAFETY: ${safetyReason}`);
    }

    // Check for freezestat condition
    const freezestat = currentMetrics.Freezestat || currentMetrics.freezestat || false;
    if (freezestat === true || freezestat === "true" || freezestat === 1) {
      safetyShutoff = true;
      safetyReason = `Freezestat condition detected`;
      logLocationEquipment(locationId, equipmentId, "boiler", `SAFETY: ${safetyReason}`);
    }

    // STEP 6: Determine boiler operation based on lead-lag status and safety
    let unitEnable = false;
    let firing = false;

    if (safetyShutoff) {
      // Safety override - shut down regardless of lead-lag status
      unitEnable = false;
      firing = false;
      logLocationEquipment(locationId, equipmentId, "boiler", `SAFETY OVERRIDE: Boiler disabled - ${safetyReason}`);
    } else if (leadLagStatus.shouldRun && leadLagStatus.isLead) {
      // Lead boiler - operate based on temperature demand
      unitEnable = true;
      
      const temperatureError = setpoint - currentTemp;
      firing = temperatureError > 2.0; // Fire when more than 2°F below setpoint
      
      logLocationEquipment(locationId, equipmentId, "boiler",
        `LEAD BOILER: unitEnable=${unitEnable}, firing=${firing} ` +
        `(temp error: ${temperatureError.toFixed(1)}°F, threshold: 2.0°F)`);
    } else if (!leadLagStatus.shouldRun && !leadLagStatus.isLead) {
      // Lag boiler - remain in standby
      unitEnable = false; // Disabled but ready for failover
      firing = false;
      
      logLocationEquipment(locationId, equipmentId, "boiler",
        `LAG BOILER: In standby mode - unitEnable=${unitEnable}, firing=${firing} ` +
        `(lead boiler: ${leadLagStatus.leadEquipmentId})`);
    } else {
      // Fallback - shouldn't normally reach here
      unitEnable = true;
      firing = false;
      logLocationEquipment(locationId, equipmentId, "boiler",
        `FALLBACK MODE: Unexpected lead-lag state - defaulting to enabled but not firing`);
    }

    // STEP 7: Construct result with Huntington-specific data
    const result = {
      unitEnable: unitEnable,
      firing: firing,
      waterTempSetpoint: setpoint,
      temperatureSetpoint: setpoint,
      isLead: leadLagStatus.isLead ? 1 : 0,
      leadLagGroupId: leadLagStatus.groupId,
      leadEquipmentId: leadLagStatus.leadEquipmentId,
      leadLagReason: leadLagStatus.reason,
      outdoorTemp: outdoorTemp,
      supplyTemp: currentTemp,
      safetyShutoff: safetyShutoff,
      safetyReason: safetyReason || "No safety issues"
    };

    logLocationEquipment(locationId, equipmentId, "boiler",
      `Final Huntington Boiler Controls: Enable=${result.unitEnable ? "ON" : "OFF"}, ` +
      `Firing=${result.firing ? "ON" : "OFF"}, Setpoint=${result.waterTempSetpoint}°F, ` +
      `Lead-Lag=${result.isLead ? "LEAD" : "LAG"}, Safety=${result.safetyShutoff ? "SHUTDOWN" : "OK"}`);

    // STEP 8: Write to InfluxDB with Huntington-specific fields
    await writeToInfluxDB(locationId, equipmentId, result, "boiler");

    // STEP 9: Return filtered result
    return filterValidCommands(result);

  } catch (error: any) {
    logLocationEquipment(locationId, equipmentId, "boiler",
      `ERROR in Huntington boiler control: ${error.message}`, error.stack);

    const errorResult = {
      unitEnable: false,
      firing: false,
      waterTempSetpoint: 80,
      temperatureSetpoint: 80,
      isLead: 0,
      leadLagGroupId: null,
      leadEquipmentId: null,
      leadLagReason: `Error: ${error.message}`,
      outdoorTemp: 50,
      supplyTemp: 140,
      safetyShutoff: true,
      safetyReason: `Control logic error: ${error.message}`
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
    'isLead', 'leadLagGroupId', 'leadEquipmentId', 'leadLagReason',
    'outdoorTemp', 'supplyTemp', 'safetyShutoff', 'safetyReason'
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
 * Helper function to write HUNTINGTON BOILER data to InfluxDB with proper error handling
 */
async function writeToInfluxDB(locationId: string, equipmentId: string, data: any, equipmentType: string): Promise<void> {
  try {
    // HUNTINGTON BOILER COMMANDS with lead-lag information
    const commandsToSend = [
      { command_type: 'unitEnable', equipment_id: equipmentId, value: data.unitEnable },
      { command_type: 'firing', equipment_id: equipmentId, value: data.firing },
      { command_type: 'waterTempSetpoint', equipment_id: equipmentId, value: data.waterTempSetpoint },
      { command_type: 'temperatureSetpoint', equipment_id: equipmentId, value: data.temperatureSetpoint },
      { command_type: 'isLead', equipment_id: equipmentId, value: data.isLead },
      { command_type: 'outdoorTemp', equipment_id: equipmentId, value: data.outdoorTemp },
      { command_type: 'supplyTemp', equipment_id: equipmentId, value: data.supplyTemp },
      { command_type: 'safetyShutoff', equipment_id: equipmentId, value: data.safetyShutoff }
    ];

    // Add optional commands with lead-lag information
    if (data.leadLagGroupId !== null && data.leadLagGroupId !== undefined) {
      commandsToSend.push({ command_type: 'leadLagGroupId', equipment_id: equipmentId, value: data.leadLagGroupId });
    }
    if (data.leadEquipmentId !== null && data.leadEquipmentId !== undefined) {
      commandsToSend.push({ command_type: 'leadEquipmentId', equipment_id: equipmentId, value: data.leadEquipmentId });
    }
    if (data.leadLagReason !== null && data.leadLagReason !== undefined) {
      commandsToSend.push({ command_type: 'leadLagReason', equipment_id: equipmentId, value: data.leadLagReason });
    }
    if (data.safetyReason !== null && data.safetyReason !== undefined) {
      commandsToSend.push({ command_type: 'safetyReason', equipment_id: equipmentId, value: data.safetyReason });
    }

    const validCommands = [];

    // Process commands with correct data types for InfluxDB schema
    for (const cmd of commandsToSend) {
      // Boolean fields - firing expects float (1.0/0.0), others use true/false
      if (cmd.command_type === 'firing') {
        cmd.value = cmd.value ? 1.0 : 0.0; // firing uses numeric boolean
      }
      else if (['unitEnable', 'safetyShutoff'].includes(cmd.command_type)) {
        cmd.value = cmd.value ? 'true' : 'false'; // Other booleans use true/false
      }
      // Numeric fields (including isLead which uses 1/0)
      else if (['waterTempSetpoint', 'temperatureSetpoint', 'isLead', 'outdoorTemp', 'supplyTemp'].includes(cmd.command_type)) {
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
      else if (['leadLagGroupId', 'leadEquipmentId', 'leadLagReason', 'safetyReason'].includes(cmd.command_type)) {
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
