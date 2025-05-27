// lib/equipment-logic/locations/warren/pumps.ts
//
// ===============================================================================
// WARREN PUMP CONTROL LOGIC - HOT WATER CIRCULATION SYSTEM
// ===============================================================================
//
// OVERVIEW:
// This file controls hot water circulation pumps at the Warren location using
// outdoor temperature-based control with lead-lag management for optimal
// efficiency and equipment longevity in the heating system.
//
// SYSTEM CONFIGURATION:
// - Hot Water (HW) pumps only - no chilled water pumps at Warren
// - Lead-lag management with automatic changeover on pump failure
// - Outdoor temperature-based enable/disable control
// - Current sensor monitoring for actual pump operation verification
//
// CONTROL STRATEGY:
// 1. Outdoor Temperature Control - Pumps enabled based on heating demand
// 2. Lead-Lag Management - Only one pump runs at a time under normal conditions
// 3. Failure Detection - Automatic switchover if lead pump fails
// 4. Current Monitoring - Amp readings verify actual pump operation
// 5. Hysteresis Control - Prevents short cycling on temperature changes
//
// TEMPERATURE THRESHOLDS (Warren Specific):
// - Enable when Outdoor Temp < 74°F (heating season start)
// - Disable when Outdoor Temp ≥ 75°F (heating season end)
// - 1°F hysteresis prevents short cycling around threshold
//
// LEAD-LAG OPERATION:
// - Lead pump operates first when temperature conditions require pumping
// - Lag pump only operates if lead pump fails (amp reading ≤ 10A)
// - Automatic identification: Pump with "1" in ID defaults to lead
// - Group management allows manual lead/lag designation
//
// CURRENT MONITORING:
// - Amp reading > 10A indicates pump is actually running
// - Amp reading ≤ 10A indicates pump failure or not running
// - Used for lead-lag switchover logic and operational verification
//
// PUMP IDENTIFICATION:
// - Equipment Type: "HWPump" (Hot Water Pump)
// - Group ID: Used for lead-lag coordination between multiple pumps
// - Lead/Lag Status: Determined by settings or equipment ID
//
// SAFETY FEATURES:
// - Safety mode if outdoor temperature unavailable (pumps enabled)
// - Failure detection with automatic lag pump activation
// - State persistence to prevent erratic switching
//
// DATA STORAGE:
// - Commands are written directly to both Locations and ControlCommands databases
// - All operations are logged for troubleshooting
// - State storage maintains pump status and prevents oscillation
//
// TECHNICIAN NOTES:
// - Check outdoor temperature sensor if pumps cycling unexpectedly
// - Verify amp sensors if lead-lag switching seems incorrect (>10A threshold)
// - Only HW pumps supported - CW pumps will use base implementation
// - Hysteresis prevents cycling: ON at <74°F, OFF at ≥75°F
// - Lead pump determination: Check isLeadPump setting or equipment ID for "1"
// - Group ID required for proper lead-lag operation
// - Monitor amp readings to verify actual pump operation vs commanded state
// - State storage prevents rapid switching - check hwOutdoorState in logs
// - Use Node-RED dashboard to monitor real-time pump currents and outdoor temp
//
// ===============================================================================

import { pumpControl as pumpControlBase } from "../../base/pumps";
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
 * Determine pump type from equipment ID or type
 */
function getPumpType(equipmentId: string, equipmentType?: string): string {
  // First check equipment type if available
  if (equipmentType) {
    if (equipmentType.toLowerCase().includes("cw") || equipmentType.toLowerCase().includes("chilled")) {
      return "CWPump";
    }
    if (equipmentType.toLowerCase().includes("hw") || equipmentType.toLowerCase().includes("heat")) {
      return "HWPump";
    }
  }

  // Otherwise check equipment ID
  if (equipmentId.toLowerCase().includes("cwpump") || equipmentId.toLowerCase().includes("chilled")) {
    return "CWPump";
  }
  if (equipmentId.toLowerCase().includes("hwpump") ||
      equipmentId.toLowerCase().includes("heat") ||
      equipmentId.toLowerCase().includes("hot")) {
    return "HWPump";
  }

  // Default to HW for Warren since they only have HW pumps
  return "HWPump";
}

/**
 * Get outdoor temperature from metrics
 */
function getOutdoorTemperature(metrics: any): number | null {
  const possibleFields = [
    "outdoorTemp", "OutdoorTemp", "outdoorTemperature", "OutdoorTemperature",
    "oat", "OAT", "outsideAirTemp", "OutsideAirTemp", "outsideTemp", "OutsideTemp",
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
 * Get pump amp reading from metrics
 */
function getPumpAmps(metrics: any, equipmentId: string): number | null {
  const pumpNumber = equipmentId.match(/\d+/)?.[0] || "";

  const possibleFields = [
    `HWPump${pumpNumber}Amps`, `hwPump${pumpNumber}Amps`,
    `HWPump-${pumpNumber}_Amps`, `hwPump-${pumpNumber}_Amps`,
    `HWPump-${pumpNumber}Amps`, `hwPump-${pumpNumber}Amps`,
    `HW${pumpNumber}Amps`, `hw${pumpNumber}Amps`,
    "pumpAmps", "PumpAmps", "amps", "Amps"
  ];

  for (const field of possibleFields) {
    if (metrics[field] !== undefined && !isNaN(Number(metrics[field]))) {
      return Number(metrics[field]);
    }
  }

  return null;
}

/**
 * Check if the lead pump has failed based on amp readings
 */
function checkLeadPumpFailure(metrics: any, settings: any, equipmentId: string): boolean {
  let leadPumpId = "";
  const groupId = settings.pumpGroupId || settings.groupId || settings.systemGroupId || null;

  if (!groupId) {
    return false; // No group, can't determine lead pump
  }

  // Try to identify the lead pump from metrics
  if (metrics.leadPumpId) {
    leadPumpId = metrics.leadPumpId;
  } else if (metrics.HWPumpLeadId || metrics.hwPumpLeadId) {
    leadPumpId = metrics.HWPumpLeadId || metrics.hwPumpLeadId;
  } else {
    // Default assumption: HWPump-1 is lead unless specified otherwise
    leadPumpId = "HWPump-1";
  }

  // If this is the lead pump, it can't be checking if the lead pump failed
  if (equipmentId.includes(leadPumpId)) {
    return false;
  }

  // Check amp reading of lead pump
  const leadPumpNumber = leadPumpId.match(/\d+/)?.[0] || "1";
  const leadPumpAmpsFields = [
    `HWPump${leadPumpNumber}Amps`, `hwPump${leadPumpNumber}Amps`,
    `HWPump-${leadPumpNumber}_Amps`, `hwPump-${leadPumpNumber}_Amps`,
    `HWPump-${leadPumpNumber}Amps`, `hwPump-${leadPumpNumber}Amps`,
    `HW${leadPumpNumber}Amps`, `hw${leadPumpNumber}Amps`,
    `${leadPumpId}Amps`
  ];

  // Check all possible fields for lead pump amps
  for (const field of leadPumpAmpsFields) {
    if (metrics[field] !== undefined && !isNaN(Number(metrics[field]))) {
      // If lead pump amps are <= 10, it's considered failed
      return Number(metrics[field]) <= 10;
    }
  }

  // If we can't determine lead pump status, default to false (don't assume failure)
  return false;
}

export async function pumpControl(
  metricsInput: any,
  settingsInput: any,
  currentTempArgument: number,
  stateStorageInput: any
) {
  const equipmentId = settingsInput.equipmentId || "unknown";
  const locationId = settingsInput.locationId || "1";

  const currentMetrics = metricsInput;
  const currentSettings = settingsInput;

  logLocationEquipment(locationId, equipmentId, "pump", "Starting Warren pump control logic");

  try {
    // STEP 1: Determine pump type and verify it's a HW pump
    const pumpType = getPumpType(equipmentId, currentSettings.equipmentType);
    logLocationEquipment(locationId, equipmentId, "pump", `Identified as pump type: ${pumpType}`);

    // Warren only has HW pumps - if somehow a CW pump is identified, log warning and use base logic
    if (pumpType !== "HWPump") {
      logLocationEquipment(locationId, equipmentId, "pump",
        `WARNING: Non-HW pump detected (${pumpType}), using base implementation`);

      const baseResult = pumpControlBase(currentMetrics, currentSettings, currentTempArgument, stateStorageInput);
      await writeToInfluxDB(locationId, equipmentId, baseResult, "pump");
      return filterValidCommands(baseResult);
    }

    // STEP 2: Get outdoor temperature with fallbacks
    const outdoorTemp = getOutdoorTemperature(currentMetrics);
    logLocationEquipment(locationId, equipmentId, "pump",
      `Outdoor temperature: ${outdoorTemp !== null ? outdoorTemp + "°F" : "Not available"}`);

    // If outdoor temperature is not available, default to running the pump (safety mode)
    if (outdoorTemp === null) {
      logLocationEquipment(locationId, equipmentId, "pump",
        "WARNING: Outdoor temperature not available, defaulting to safety mode (pump enabled)");

      const safetyResult = {
        unitEnable: true,
        pumpEnabled: true,
        pumpRunning: true,
        pumpSpeed: 100,
        leadLagStatus: currentSettings.isLeadPump ? "lead" : "lag",
        isLead: currentSettings.isLeadPump ? 1 : 0,
        pumpType: pumpType,
        pumpGroupId: currentSettings.pumpGroupId || currentSettings.groupId || currentSettings.systemGroupId || null,
        outdoorTemp: "unknown"
      };

      await writeToInfluxDB(locationId, equipmentId, safetyResult, "pump");
      return filterValidCommands(safetyResult);
    }

    // STEP 3: Initialize state storage for HW outdoor temperature control
    if (!stateStorageInput.hwOutdoorState) {
      stateStorageInput.hwOutdoorState = {
        isOn: false
      };

      // Initialize state based on current outdoor temperature
      if (outdoorTemp < 74) {
        stateStorageInput.hwOutdoorState.isOn = true;
        logLocationEquipment(locationId, equipmentId, "pump",
          `Initializing HW pump state to ON (${outdoorTemp}°F < 74°F)`);
      } else {
        logLocationEquipment(locationId, equipmentId, "pump",
          `Initializing HW pump state to OFF (${outdoorTemp}°F >= 74°F)`);
      }
    }

    // STEP 4: Apply Warren-specific temperature thresholds with hysteresis
    // Enable when OAT < 74°F, disable when OAT ≥ 75°F
    if (stateStorageInput.hwOutdoorState.isOn) {
      // If currently on, turn off at 75°F or higher
      if (outdoorTemp >= 75) {
        stateStorageInput.hwOutdoorState.isOn = false;
        logLocationEquipment(locationId, equipmentId, "pump",
          `HW Pump: Turning OFF (${outdoorTemp}°F >= 75°F)`);
      } else {
        logLocationEquipment(locationId, equipmentId, "pump",
          `HW Pump: Staying ON (${outdoorTemp}°F < 75°F)`);
      }
    } else {
      // If currently off, turn on at less than 74°F
      if (outdoorTemp < 74) {
        stateStorageInput.hwOutdoorState.isOn = true;
        logLocationEquipment(locationId, equipmentId, "pump",
          `HW Pump: Turning ON (${outdoorTemp}°F < 74°F)`);
      } else {
        logLocationEquipment(locationId, equipmentId, "pump",
          `HW Pump: Staying OFF (${outdoorTemp}°F >= 74°F)`);
      }
    }

    // STEP 5: Check if this pump is lead or lag based on settings
    let isLead = false;
    const groupId = currentSettings.pumpGroupId || currentSettings.groupId ||
                   currentSettings.systemGroupId || null;

    if (groupId) {
      logLocationEquipment(locationId, equipmentId, "pump", `Pump is part of group ${groupId}`);

      if (currentSettings.isLeadPump !== undefined) {
        isLead = currentSettings.isLeadPump;
        logLocationEquipment(locationId, equipmentId, "pump",
          `Pump is ${isLead ? "LEAD" : "LAG"} based on settings`);
      } else if (currentMetrics.isLeadPump !== undefined) {
        isLead = currentMetrics.isLeadPump;
        logLocationEquipment(locationId, equipmentId, "pump",
          `Pump is ${isLead ? "LEAD" : "LAG"} based on metrics`);
      } else {
        // Default to pump 1 as lead if not specified
        isLead = equipmentId.includes("1") || equipmentId.includes("HWPump-1");
        logLocationEquipment(locationId, equipmentId, "pump",
          `Pump lead/lag status not specified, defaulting to ${isLead ? "LEAD" : "LAG"} based on ID`);
      }
    } else {
      // If not in a group, consider it a lead pump
      isLead = true;
      logLocationEquipment(locationId, equipmentId, "pump",
        "Pump not part of a group, defaulting to LEAD");
    }

    // STEP 6: Check amp readings to see if pump is actually running
    const pumpAmps = getPumpAmps(currentMetrics, equipmentId);
    const pumpActuallyRunning = pumpAmps !== null ? pumpAmps > 10 : false;

    if (pumpAmps !== null) {
      logLocationEquipment(locationId, equipmentId, "pump",
        `Pump amp reading: ${pumpAmps}A (${pumpActuallyRunning ? "RUNNING" : "NOT RUNNING"})`);
    } else {
      logLocationEquipment(locationId, equipmentId, "pump", "Pump amp reading: Not available");
    }

    // STEP 7: Determine if the pump should be enabled
    let unitEnable = false;
    let pumpEnabled = false;
    const leadPumpFailed = checkLeadPumpFailure(currentMetrics, currentSettings, equipmentId);

    if (stateStorageInput.hwOutdoorState.isOn) {
      if (isLead) {
        // Lead pump - enable when temperature allows
        unitEnable = true;
        pumpEnabled = true;
        logLocationEquipment(locationId, equipmentId, "pump",
          "LEAD pump enabled based on temperature conditions");
      } else if (leadPumpFailed) {
        // Lag pump - enable only if lead pump has failed
        unitEnable = true;
        pumpEnabled = true;
        logLocationEquipment(locationId, equipmentId, "pump",
          "LAG pump enabled because lead pump has failed");
      } else {
        // Lag pump - don't enable if lead pump is working
        unitEnable = false;
        pumpEnabled = false;
        logLocationEquipment(locationId, equipmentId, "pump",
          "LAG pump disabled because lead pump is operational");
      }
    } else {
      // Temperature conditions don't allow operation
      unitEnable = false;
      pumpEnabled = false;
      logLocationEquipment(locationId, equipmentId, "pump",
        "Pump disabled based on temperature conditions");
    }

    // STEP 8: Construct result
    const result = {
      unitEnable: unitEnable,
      pumpEnabled: pumpEnabled,
      pumpRunning: pumpActuallyRunning,
      pumpSpeed: pumpEnabled ? 100 : 0,
      leadLagStatus: isLead ? "lead" : "lag",
      isLead: isLead ? 1 : 0,
      pumpType: pumpType,
      pumpGroupId: groupId,
      outdoorTemp: outdoorTemp,
      ampReading: pumpAmps || 0,
      temperatureControlActive: stateStorageInput.hwOutdoorState.isOn
    };

    logLocationEquipment(locationId, equipmentId, "pump",
      `Final control values: unitEnable=${result.unitEnable}, ` +
      `pumpEnabled=${result.pumpEnabled}, actuallyRunning=${result.pumpRunning}, ` +
      `leadLag=${result.leadLagStatus}, outdoorTemp=${result.outdoorTemp}°F`);

    // STEP 9: Write to InfluxDB
    await writeToInfluxDB(locationId, equipmentId, result, "pump");

    // STEP 10: Return filtered result
    return filterValidCommands(result);

  } catch (error: any) {
    logLocationEquipment(locationId, equipmentId, "pump",
      `ERROR in Warren pump control: ${error.message}`, error.stack);

    const errorResult = {
      unitEnable: false,
      pumpEnabled: false,
      pumpRunning: false,
      pumpSpeed: 0,
      leadLagStatus: "error",
      isLead: 0
    };

    try {
      await writeToInfluxDB(locationId, equipmentId, errorResult, "pump");
    } catch (writeError) {
      logLocationEquipment(locationId, equipmentId, "pump",
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
    'unitEnable', 'pumpEnabled', 'pumpRunning', 'pumpSpeed',
    'leadLagStatus', 'isLead', 'pumpType'
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
 * Helper function to write PUMP data to InfluxDB with proper error handling
 */
async function writeToInfluxDB(locationId: string, equipmentId: string, data: any, equipmentType: string): Promise<void> {
  try {
    // PUMP COMMANDS
    const commandsToSend = [
      { command_type: 'unitEnable', equipment_id: equipmentId, value: data.unitEnable },
      { command_type: 'pumpEnabled', equipment_id: equipmentId, value: data.pumpEnabled },
      { command_type: 'pumpSpeed', equipment_id: equipmentId, value: data.pumpSpeed },
      { command_type: 'leadLagStatus', equipment_id: equipmentId, value: data.leadLagStatus },
      { command_type: 'isLead', equipment_id: equipmentId, value: data.isLead },
      { command_type: 'pumpType', equipment_id: equipmentId, value: data.pumpType || "HWPump" }
    ];

    const validCommands = [];

    // Process commands with correct data types for InfluxDB schema
    for (const cmd of commandsToSend) {
      // Boolean fields - send as true/false
      if (['unitEnable', 'pumpEnabled'].includes(cmd.command_type)) {
        cmd.value = cmd.value ? 'true' : 'false';
      }
      // isLead - convert to numeric (InfluxDB expects float for this field)
      else if (cmd.command_type === 'isLead') {
        cmd.value = cmd.value ? 1.0 : 0.0;
      }
      // Numeric fields - send as numbers
      else if (['pumpSpeed'].includes(cmd.command_type)) {
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
      else if (['leadLagStatus', 'pumpType'].includes(cmd.command_type)) {
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
