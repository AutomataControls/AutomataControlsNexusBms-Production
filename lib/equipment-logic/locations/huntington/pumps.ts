// lib/equipment-logic/locations/huntington/pumps.ts
//
// ===============================================================================
// HUNTINGTON PUMP CONTROL LOGIC - INTEGRATED LEAD-LAG CIRCULATION PUMPS
// ===============================================================================
//
// OVERVIEW:
// This file controls circulation pumps at the Huntington location with integrated
// lead-lag management, outdoor temperature-based control, and hysteresis to prevent
// short cycling and optimize energy usage. All lead-lag decisions are made locally
// within Huntington equipment only.
//
// EQUIPMENT CONFIGURATION:
// CW Pumps (Chilled Water) - From Firestore screenshot:
// - CW Pump 1: "RJLaOk4UssyePSA1qqT8" (Lead from Firestore)
// - CW Pump 2: "wGvf15Bf6xaLISwhRc7xO" (Lag from Firestore)
//
// HW Pumps (Hot Water) - Estimated IDs:
// - HW Pump 1: "GUI1SxcedsLEhqbD0G2p" 
// - HW Pump 2: "oh5Bz2zzIcuT9lFoogvi"
//
// CONTROL STRATEGY:
// 1. Temperature-Based Control - Uses outdoor air temperature for pump enable/disable
// 2. Integrated Lead-Lag Management - Local Huntington-only lead-lag coordination
// 3. Hysteresis Control - Prevents short cycling with separate on/off temperatures
// 4. Automatic Failover - Promotes lag pump if lead pump fails
// 5. Performance Monitoring - Tracks amp draw and status for fault detection
// 6. Runtime Tracking - Monitors operational hours for maintenance scheduling
//
// TEMPERATURE SETPOINTS (Huntington Specific):
// CW (Chilled Water) Pumps:
// - Turn ON when Outdoor Temp ≥ 37°F (cooling season starts)
// - Turn OFF when Outdoor Temp ≤ 36°F (cooling season ends)
// - 1°F hysteresis prevents rapid cycling
//
// HW (Hot Water) Pumps:
// - Turn ON when Outdoor Temp ≤ 74°F (heating season starts)
// - Turn OFF when Outdoor Temp ≥ 75°F (heating season ends)
// - 1°F hysteresis prevents rapid cycling
//
// LEAD-LAG OPERATION (Huntington Internal Only):
// - Lead pump: Always follows temperature-based rules
// - Lag pump: Only runs during extreme conditions or if lead pump fails
// - CW Lag: Activates when outdoor temp ≥ 90°F (extreme cooling load) or lead fails
// - HW Lag: Activates when outdoor temp ≤ 20°F (extreme heating load) or lead fails
// - Automatic failover if lead pump fails (amp reading <0.5A when should be running)
//
// FAILOVER CONDITIONS:
// - Amp draw <0.5A when pump should be running (indicates pump failure)
// - Pump status indicates "fault" or "error"
// - Lead pump not responding to enable commands
//
// PERFORMANCE MONITORING:
// - Amp Draw: Expected >0.5A when running, <0.5A indicates potential failure
// - Status: "running", "off", "fault" - "fault" triggers alarm condition
// - Runtime: Accumulated operational hours for maintenance scheduling
//
// SAFETY FEATURES:
// - Failure Detection: Low amp draw with "enabled" status indicates pump failure
// - Automatic failover to healthy lag pump
// - Manual Override: Settings can force lag pump operation
// - Temperature Fallback: Uses previous state if outdoor temp unavailable
//
// DATA STORAGE:
// - Commands are written directly to both Locations and ControlCommands databases
// - Lead-lag events logged to ControlCommands for monitoring and trending
// - State storage maintains lead-lag coordination and timing sequences
// - All operations logged for troubleshooting and maintenance scheduling
//
// TECHNICIAN NOTES:
// - Only one Huntington pump of each type should run normally (lead-lag operation)
// - Check outdoor temperature sensor if pumps cycle frequently
// - Monitor amp draw - should be >0.5A when pump is enabled and running
// - CW pumps: ON at 37°F, OFF at 36°F with 1°F hysteresis
// - HW pumps: ON at 74°F, OFF at 75°F with 1°F hysteresis
// - Lag pumps activate during extreme weather or lead pump failure
// - Monitor lead-lag events in ControlCommands database for failover history
// - Use Node-RED dashboard to monitor real-time pump performance and sequencing
// - State storage tracks timing to prevent rapid switching during normal operation
//
// ===============================================================================

import { logLocationEquipment } from "@/lib/logging/location-logger";
import { getHuntingtonPumpLeadLagStatus } from "./lead-lag-helpers";

// Helper to safely parse numbers
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
 * Get outdoor temperature from metrics with comprehensive fallbacks
 */
function getOutdoorTemperature(metrics: any): number | null {
  const possibleFields = [
    "outsideTemp", "OutsideTemp", // Primary from Node-RED
    "outdoorTemp", "OutdoorTemp", 
    "outdoorTemperature", "OutdoorTemperature",
    "oat", "OAT",
    "outsideAirTemp", "OutsideAirTemp",
    "Outdoor_Air", "Outdoor", "outdoor"
  ];

  for (const field of possibleFields) {
    if (metrics[field] !== undefined && !isNaN(Number(metrics[field]))) {
      return Number(metrics[field]);
    }
  }

  return null;
}

/**
 * Determine pump type from equipment ID using hardcoded mapping
 */
function getHuntingtonPumpType(equipmentId: string): "CWPump" | "HWPump" {
  // Hardcoded mapping based on Firestore screenshot and known equipment
  switch(equipmentId) {
    case "RJLaOk4UssyePSA1qqT8":  // From Firestore - CW Pump 1
    case "wGvf15Bf6xaLISwhRc7xO":  // From Firestore - CW Pump 2
      return "CWPump";
    case "GUI1SxcedsLEhqbD0G2p":   // HW Pump 1
    case "oh5Bz2zzIcuT9lFoogvi":   // HW Pump 2
      return "HWPump";
    default:
      // Fallback logic for unknown equipment IDs
      if (equipmentId.toLowerCase().includes("cw") || 
          equipmentId.toLowerCase().includes("chilled")) {
        return "CWPump";
      } else {
        return "HWPump"; // Default to HW pump
      }
  }
}

/**
 * Get pump performance metrics from InfluxDB data
 */
function getHuntingtonPumpMetrics(equipmentId: string, metrics: any): { amps: number, status: string } {
  let pumpAmps = 0;
  let pumpStatus = "unknown";

  // Map equipment IDs to their metric field names
  switch(equipmentId) {
    case "RJLaOk4UssyePSA1qqT8":  // CW Pump 1
      pumpAmps = parseSafeNumber(metrics.CWPump1Amps || metrics.CWP1Amps || metrics.cwPump1Amps, 0);
      pumpStatus = metrics.CWPump1Status || metrics.CWP1Status || metrics.cwPump1Status || "unknown";
      break;
    case "wGvf15Bf6xaLISwhRc7xO":  // CW Pump 2
      pumpAmps = parseSafeNumber(metrics.CWPump2Amps || metrics.CWP2Amps || metrics.cwPump2Amps, 0);
      pumpStatus = metrics.CWPump2Status || metrics.CWP2Status || metrics.cwPump2Status || "unknown";
      break;
    case "GUI1SxcedsLEhqbD0G2p":   // HW Pump 1
      pumpAmps = parseSafeNumber(metrics.HWPump1Amps || metrics.HWP1Amps || metrics.hwPump1Amps, 0);
      pumpStatus = metrics.HWPump1Status || metrics.HWP1Status || metrics.hwPump1Status || "unknown";
      break;
    case "oh5Bz2zzIcuT9lFoogvi":   // HW Pump 2
      pumpAmps = parseSafeNumber(metrics.HWPump2Amps || metrics.HWP2Amps || metrics.hwPump2Amps, 0);
      pumpStatus = metrics.HWPump2Status || metrics.HWP2Status || metrics.hwPump2Status || "unknown";
      break;
    default:
      // Generic fallback
      pumpAmps = parseSafeNumber(metrics.pumpAmps || metrics.Amps || metrics.amps, 0);
      pumpStatus = metrics.pumpStatus || metrics.Status || metrics.status || "unknown";
  }

  return { amps: pumpAmps, status: pumpStatus };
}

export async function pumpControl(
  metricsInput: any,
  settingsInput: any,
  currentTempArgument: number,
  stateStorageInput: any
) {
  const equipmentId = settingsInput.equipmentId || "unknown";
  const locationId = settingsInput.locationId || "4"; // Huntington location ID

  const currentMetrics = metricsInput;
  const currentSettings = settingsInput;

  logLocationEquipment(locationId, equipmentId, "pump", "Starting Huntington pump control with integrated lead-lag logic");

  try {
    // Initialize state storage if needed
    if (!stateStorageInput) {
      stateStorageInput = {};
    }

    // STEP 1: Determine pump type using hardcoded mapping
    const pumpType = getHuntingtonPumpType(equipmentId);
    logLocationEquipment(locationId, equipmentId, "pump", `Identified as pump type: ${pumpType}`);

    // STEP 2: Get outdoor temperature
    const outdoorTemp = getOutdoorTemperature(currentMetrics);
    logLocationEquipment(locationId, equipmentId, "pump",
      `Outdoor temperature: ${outdoorTemp !== null ? outdoorTemp + "°F" : "Not available"}`);

    // STEP 3: Get pump performance metrics
    const pumpMetrics = getHuntingtonPumpMetrics(equipmentId, currentMetrics);
    logLocationEquipment(locationId, equipmentId, "pump",
      `Pump metrics: Amps=${pumpMetrics.amps}A, Status=${pumpMetrics.status}`);

    // STEP 4: Initialize pump-specific state storage
    if (!stateStorageInput.cwOutdoorState) {
      stateStorageInput.cwOutdoorState = { isOn: false };
    }
    if (!stateStorageInput.hwOutdoorState) {
      stateStorageInput.hwOutdoorState = { isOn: false };
    }

    const pumpStateKey = `pump_${equipmentId}_state`;
    if (!stateStorageInput[pumpStateKey]) {
      stateStorageInput[pumpStateKey] = {
        lastChecked: Date.now(),
        runtime: 0,
        failureCount: 0
      };
      logLocationEquipment(locationId, equipmentId, "pump",
        `Initialized pump-specific state storage for ${equipmentId}`);
    }

    // STEP 5: Determine if pump should be enabled based on temperature thresholds
    let temperatureBasedEnable = false;

    if (outdoorTemp === null) {
      // Use previous state if no temperature reading
      if (pumpType === "CWPump") {
        temperatureBasedEnable = stateStorageInput.cwOutdoorState.isOn;
      } else {
        temperatureBasedEnable = stateStorageInput.hwOutdoorState.isOn;
      }
      logLocationEquipment(locationId, equipmentId, "pump",
        `No outdoor temperature - using previous state: ${temperatureBasedEnable ? "ON" : "OFF"}`);
    } else {
      // Apply temperature thresholds with hysteresis
      if (pumpType === "CWPump") {
        // CW pumps: ON at 37°F, OFF at 36°F
        if (stateStorageInput.cwOutdoorState.isOn) {
          if (outdoorTemp <= 36) {
            stateStorageInput.cwOutdoorState.isOn = false;
            temperatureBasedEnable = false;
            logLocationEquipment(locationId, equipmentId, "pump",
              `CW Pump: Turning OFF (${outdoorTemp}°F <= 36°F)`);
          } else {
            temperatureBasedEnable = true;
            logLocationEquipment(locationId, equipmentId, "pump",
              `CW Pump: Staying ON (${outdoorTemp}°F > 36°F)`);
          }
        } else {
          if (outdoorTemp >= 37) {
            stateStorageInput.cwOutdoorState.isOn = true;
            temperatureBasedEnable = true;
            logLocationEquipment(locationId, equipmentId, "pump",
              `CW Pump: Turning ON (${outdoorTemp}°F >= 37°F)`);
          } else {
            temperatureBasedEnable = false;
            logLocationEquipment(locationId, equipmentId, "pump",
              `CW Pump: Staying OFF (${outdoorTemp}°F < 37°F)`);
          }
        }
      } else {
        // HW pumps: ON at 74°F, OFF at 75°F
        if (stateStorageInput.hwOutdoorState.isOn) {
          if (outdoorTemp >= 75) {
            stateStorageInput.hwOutdoorState.isOn = false;
            temperatureBasedEnable = false;
            logLocationEquipment(locationId, equipmentId, "pump",
              `HW Pump: Turning OFF (${outdoorTemp}°F >= 75°F)`);
          } else {
            temperatureBasedEnable = true;
            logLocationEquipment(locationId, equipmentId, "pump",
              `HW Pump: Staying ON (${outdoorTemp}°F < 75°F)`);
          }
        } else {
          if (outdoorTemp <= 74) {
            stateStorageInput.hwOutdoorState.isOn = true;
            temperatureBasedEnable = true;
            logLocationEquipment(locationId, equipmentId, "pump",
              `HW Pump: Turning ON (${outdoorTemp}°F <= 74°F)`);
          } else {
            temperatureBasedEnable = false;
            logLocationEquipment(locationId, equipmentId, "pump",
              `HW Pump: Staying OFF (${outdoorTemp}°F > 74°F)`);
          }
        }
      }
    }

    // STEP 6: Get Huntington pump lead-lag status (integrated local decision making)
    const leadLagStatus = await getHuntingtonPumpLeadLagStatus(equipmentId, pumpType, currentMetrics, stateStorageInput);
    
    logLocationEquipment(locationId, equipmentId, "pump",
      `Huntington Pump Lead-Lag Status: ${leadLagStatus.isLead ? "LEAD" : "LAG"}, ` +
      `Should Run: ${leadLagStatus.shouldRun}, Reason: ${leadLagStatus.reason}`);

    // STEP 7: Determine final pump operation based on temperature, lead-lag status, and extreme conditions
    let unitEnable = false;

    if (!temperatureBasedEnable) {
      // If temperature doesn't call for this pump type, it stays off regardless of lead-lag
      unitEnable = false;
      logLocationEquipment(locationId, equipmentId, "pump",
        `Pump OFF: Temperature conditions don't require ${pumpType} operation`);
    } else if (leadLagStatus.isLead && leadLagStatus.shouldRun) {
      // Lead pump runs when temperature conditions are met
      unitEnable = true;
      logLocationEquipment(locationId, equipmentId, "pump",
        `LEAD PUMP: Enabled based on temperature conditions`);
    } else if (!leadLagStatus.isLead) {
      // Lag pump logic - only runs in extreme conditions or during failover
      if (currentSettings.overrideLeadLag === true) {
        unitEnable = true;
        logLocationEquipment(locationId, equipmentId, "pump",
          `LAG PUMP: Enabled due to manual override`);
      } else if (leadLagStatus.shouldRun) {
        // Lag pump should run due to failover
        unitEnable = true;
        logLocationEquipment(locationId, equipmentId, "pump",
          `LAG PUMP: Enabled due to lead pump failure (failover)`);
      } else if (pumpType === "CWPump" && outdoorTemp !== null && outdoorTemp >= 90) {
        // Extreme heat - run both CW pumps
        unitEnable = true;
        logLocationEquipment(locationId, equipmentId, "pump",
          `LAG PUMP: Enabled due to extreme heat (${outdoorTemp}°F >= 90°F)`);
      } else if (pumpType === "HWPump" && outdoorTemp !== null && outdoorTemp <= 20) {
        // Extreme cold - run both HW pumps
        unitEnable = true;
        logLocationEquipment(locationId, equipmentId, "pump",
          `LAG PUMP: Enabled due to extreme cold (${outdoorTemp}°F <= 20°F)`);
      } else {
        // Normal lag pump operation - stay off
        unitEnable = false;
        logLocationEquipment(locationId, equipmentId, "pump",
          `LAG PUMP: Staying OFF (normal lead-lag operation, lead: ${leadLagStatus.leadEquipmentId})`);
      }
    } else {
      // Fallback
      unitEnable = false;
      logLocationEquipment(locationId, equipmentId, "pump",
        `FALLBACK: Pump disabled due to unexpected state`);
    }

    // STEP 8: Update runtime statistics
    const currentTime = Date.now();
    const timeSinceLastCheck = (currentTime - stateStorageInput[pumpStateKey].lastChecked) / 60000; // minutes
    stateStorageInput[pumpStateKey].lastChecked = currentTime;

    if (unitEnable) {
      stateStorageInput[pumpStateKey].runtime = (stateStorageInput[pumpStateKey].runtime || 0) + timeSinceLastCheck;
    }

    // STEP 9: Check for pump failure and record in state storage
    if (unitEnable && leadLagStatus.isLead &&
        ((pumpMetrics.amps < 0.5 && pumpMetrics.status !== "off") || pumpMetrics.status === "fault")) {

      stateStorageInput[pumpStateKey].failureCount += 1;
      
      logLocationEquipment(locationId, equipmentId, "pump",
        `WARNING: Pump performance issue detected! Amps=${pumpMetrics.amps}A, ` +
        `Status=${pumpMetrics.status}, Failures=${stateStorageInput[pumpStateKey].failureCount}`);
    }

    // STEP 10: Construct result with Huntington-specific data
    const result = {
      unitEnable: unitEnable,
      isLead: leadLagStatus.isLead ? 1 : 0,
      pumpType: pumpType,
      pumpRuntime: stateStorageInput[pumpStateKey].runtime || 0,
      leadLagGroupId: leadLagStatus.groupId,
      leadEquipmentId: leadLagStatus.leadEquipmentId,
      leadLagReason: leadLagStatus.reason,
      outdoorTemperature: outdoorTemp,
      pumpAmps: pumpMetrics.amps,
      pumpStatus: pumpMetrics.status,
      temperatureSource: currentSettings.temperatureSource || "outdoor",
      failureCount: stateStorageInput[pumpStateKey].failureCount || 0
    };

    logLocationEquipment(locationId, equipmentId, "pump",
      `Final Huntington Pump Controls: Enable=${result.unitEnable ? "ON" : "OFF"}, ` +
      `Type=${result.pumpType}, Lead-Lag=${result.isLead ? "LEAD" : "LAG"}, ` +
      `Amps=${result.pumpAmps}A, Runtime=${result.pumpRuntime.toFixed(1)}min`);

    // STEP 11: Write to InfluxDB with Huntington-specific fields
    await writeToInfluxDB(locationId, equipmentId, result, "pump");

    // STEP 12: Return filtered result
    return filterValidCommands(result);

  } catch (error: any) {
    logLocationEquipment(locationId, equipmentId, "pump",
      `ERROR in Huntington pump control: ${error.message}`, error.stack);

    const errorResult = {
      unitEnable: false,
      isLead: 0,
      pumpType: getHuntingtonPumpType(equipmentId),
      pumpRuntime: 0,
      leadLagGroupId: null,
      leadEquipmentId: null,
      leadLagReason: `Error: ${error.message}`,
      outdoorTemperature: null,
      pumpAmps: 0,
      pumpStatus: "error",
      temperatureSource: "outdoor",
      failureCount: 0
    };

    try {
      await writeToInfluxDB(locationId, equipmentId, errorResult, "pump");
    } catch (writeError) {
      logLocationEquipment(locationId, equipmentId, "pump",
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
    'unitEnable', 'isLead', 'pumpType', 'pumpRuntime', 'leadLagGroupId',
    'leadEquipmentId', 'leadLagReason', 'outdoorTemperature', 'pumpAmps',
    'pumpStatus', 'temperatureSource', 'failureCount'
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
 * Helper function to write HUNTINGTON PUMP data to InfluxDB with proper error handling
 */
async function writeToInfluxDB(locationId: string, equipmentId: string, data: any, equipmentType: string): Promise<void> {
  try {
    // HUNTINGTON PUMP COMMANDS with lead-lag information
    const commandsToSend = [
      { command_type: 'unitEnable', equipment_id: equipmentId, value: data.unitEnable },
      { command_type: 'isLead', equipment_id: equipmentId, value: data.isLead },
      { command_type: 'pumpType', equipment_id: equipmentId, value: data.pumpType },
      { command_type: 'pumpRuntime', equipment_id: equipmentId, value: data.pumpRuntime },
      { command_type: 'outdoorTemperature', equipment_id: equipmentId, value: data.outdoorTemperature },
      { command_type: 'pumpAmps', equipment_id: equipmentId, value: data.pumpAmps },
      { command_type: 'pumpStatus', equipment_id: equipmentId, value: data.pumpStatus },
      { command_type: 'temperatureSource', equipment_id: equipmentId, value: data.temperatureSource },
      { command_type: 'failureCount', equipment_id: equipmentId, value: data.failureCount }
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

    const validCommands = [];

    // Process commands with correct data types for InfluxDB schema
    for (const cmd of commandsToSend) {
      // Boolean fields - unitEnable uses 1/0 for compatibility
      if (['unitEnable'].includes(cmd.command_type)) {
        cmd.value = cmd.value ? 1.0 : 0.0;
      }
      // Numeric fields
      else if (['isLead', 'pumpRuntime', 'outdoorTemperature', 'pumpAmps', 'failureCount'].includes(cmd.command_type)) {
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
      else if (['pumpType', 'pumpStatus', 'temperatureSource', 'leadLagGroupId', 'leadEquipmentId', 'leadLagReason'].includes(cmd.command_type)) {
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
        const lineProtocol = `update_${cmd.command_type},equipment_id=${cmd.equipment_id},location_id=${locationId},command_type=${cmd.command_type},equipment_type=pump,source=server_logic,status=completed value=${cmd.value}`;

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
