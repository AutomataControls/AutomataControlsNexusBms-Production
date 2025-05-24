// lib/equipment-logic/locations/huntington/pumps.ts
import type { LogicEvaluation } from "@/lib/control-logic";
import { logLocationEquipment } from "@/lib/logging/location-logger";
import { getLeadLagStatus } from "@/lib/lead-lag-manager"; // Using optimized lead-lag-manager

/**
 * Pump Control Logic specifically for Huntington
 * - CW pumps: ON at 37°F, OFF at 36°F
 * - HW pumps: OFF at 75°F, ON at 74°F
 * - Supports lead-lag configuration from Firestore
 *
 * Equipment IDs:
 * - CW Pumps: "RJLaOk4UssyePSA1qgT8", "wGvFI5Bf6xaLlSwRc7xO"
 * - HW Pumps: "GUI1SxcedsLEhqbD0G2p", "oh5Bz2zzIcuT9lFoogvi"
 */
export async function pumpControl(metrics: any, settings: any, currentTemp: number, stateStorage: any): Promise<any> {
  // Extract equipment ID and location ID for logging
  const equipmentId = settings.equipmentId || "unknown";
  const locationId = settings.locationId || "4"; // Default to Huntington

  logLocationEquipment(locationId, equipmentId, "pump", "Starting Huntington-specific pump control logic");

  // Initialize state storage if not present
  stateStorage = stateStorage || {};
  if (!stateStorage.cwOutdoorState) {
    stateStorage.cwOutdoorState = { isOn: false };
  }
  if (!stateStorage.hwOutdoorState) {
    stateStorage.hwOutdoorState = { isOn: false };
  }

  // STEP 1: Determine pump type directly from equipment ID
  let pumpType: string;

  // Explicitly map equipment IDs to their correct types using a hardcoded approach
  switch(equipmentId) {
    case "RJLaOk4UssyePSA1qgT8":
    case "wGvFI5Bf6xaLlSwRc7xO":
      pumpType = "CWPump";
      break;
    case "GUI1SxcedsLEhqbD0G2p":
    case "oh5Bz2zzIcuT9lFoogvi":
      pumpType = "HWPump";
      break;
    default:
      // Fallback to checking equipment type or ID strings
      if (settings.equipmentType) {
        if (settings.equipmentType.toLowerCase().includes("cw") ||
            settings.equipmentType.toLowerCase().includes("chilled")) {
          pumpType = "CWPump";
        } else if (settings.equipmentType.toLowerCase().includes("hw") ||
                  settings.equipmentType.toLowerCase().includes("heat")) {
          pumpType = "HWPump";
        } else {
          pumpType = "HWPump"; // Default to HWPump if can't determine
        }
      } else if (equipmentId.toLowerCase().includes("cwpump") ||
                equipmentId.toLowerCase().includes("chilled")) {
        pumpType = "CWPump";
      } else {
        pumpType = "HWPump"; // Default to HWPump if can't determine
      }
  }

  logLocationEquipment(locationId, equipmentId, "pump", `Determined pump type: ${pumpType} (hardcoded mapping)`);

  // STEP 2: Get lead-lag status using optimized function
  let isLead = false;
  let equipmentGroupId = "";

  // Set expected group ID for logging
  if (pumpType === "CWPump") {
    equipmentGroupId = "HuntingtonHeritageChillerPumps";
  } else if (pumpType === "HWPump") {
    equipmentGroupId = "HuntingtonHeritageHeatingPumps";
  }

  try {
    // Use the optimized getLeadLagStatus function that now has Redis caching
    const leadLagStatus = await getLeadLagStatus(locationId, equipmentId);
    
    // Extract lead status and group info
    isLead = leadLagStatus.isLead;
    equipmentGroupId = leadLagStatus.groupId || equipmentGroupId;
    
    logLocationEquipment(locationId, equipmentId, "pump",
      `Lead-Lag Status: isLead=${isLead}, shouldRun=${leadLagStatus.shouldRun}, Reason=${leadLagStatus.reason}`);
    
  } catch (error) {
    logLocationEquipment(locationId, equipmentId, "pump",
      `Error retrieving lead-lag status: ${error.message}`);
  }

  // STEP 3: Get outdoor temperature
  const outdoorTemp = getOutdoorTemperature(metrics);
  logLocationEquipment(locationId, equipmentId, "pump",
    `${pumpType}: Outdoor temperature: ${outdoorTemp !== null ? outdoorTemp + "°F" : "Not available"}`);

  // Create pump state key for this specific pump
  const pumpStateKey = `pump_${equipmentId}_state`;
  if (!stateStorage[pumpStateKey]) {
    stateStorage[pumpStateKey] = {
      lastChecked: Date.now(),
      runtime: 0
    };
    logLocationEquipment(locationId, equipmentId, "pump",
      `Initialized pump-specific state storage for ${equipmentId}`);
  }

  // STEP 4: Determine if pump should be enabled based on temperature thresholds
  let unitEnable = false;

  // First check if we have a valid outdoor temperature reading
  if (outdoorTemp === null) {
    logLocationEquipment(locationId, equipmentId, "pump",
      "WARNING: No valid outdoor temperature reading. Defaulting to previous state.");

    // Default to previous state if we can't determine temperature
    if (pumpType === "CWPump") {
      unitEnable = stateStorage.cwOutdoorState.isOn;
    } else {
      unitEnable = stateStorage.hwOutdoorState.isOn;
    }
  } else {
    // Apply pump-specific temperature thresholds with hysteresis
    if (pumpType === "CWPump") {
      // For CW pumps: ON at 37°F, OFF at 36°F
      if (stateStorage.cwOutdoorState.isOn) {
        // If currently on, turn off at 36°F or lower
        if (outdoorTemp <= 36) {
          stateStorage.cwOutdoorState.isOn = false;
          unitEnable = false;
          logLocationEquipment(locationId, equipmentId, "pump",
            `CW Pump: Turning OFF (${outdoorTemp}°F <= 36°F)`);
        } else {
          unitEnable = true;
          logLocationEquipment(locationId, equipmentId, "pump",
            `CW Pump: Staying ON (${outdoorTemp}°F > 36°F)`);
        }
      } else {
        // If currently off, turn on at 37°F or higher
        if (outdoorTemp >= 37) {
          stateStorage.cwOutdoorState.isOn = true;
          unitEnable = true;
          logLocationEquipment(locationId, equipmentId, "pump",
            `CW Pump: Turning ON (${outdoorTemp}°F >= 37°F)`);
        } else {
          unitEnable = false;
          logLocationEquipment(locationId, equipmentId, "pump",
            `CW Pump: Staying OFF (${outdoorTemp}°F < 37°F)`);
        }
      }
    } else if (pumpType === "HWPump") {
      // For HW pumps: OFF at 75°F, ON at 74°F
      if (stateStorage.hwOutdoorState.isOn) {
        // If currently on, turn off at 75°F or higher
        if (outdoorTemp >= 75) {
          stateStorage.hwOutdoorState.isOn = false;
          unitEnable = false;
          logLocationEquipment(locationId, equipmentId, "pump",
            `HW Pump: Turning OFF (${outdoorTemp}°F >= 75°F)`);
        } else {
          unitEnable = true;
          logLocationEquipment(locationId, equipmentId, "pump",
            `HW Pump: Staying ON (${outdoorTemp}°F < 75°F)`);
        }
      } else {
        // If currently off, turn on at 74°F or lower
        if (outdoorTemp <= 74) {
          stateStorage.hwOutdoorState.isOn = true;
          unitEnable = true;
          logLocationEquipment(locationId, equipmentId, "pump",
            `HW Pump: Turning ON (${outdoorTemp}°F <= 74°F)`);
        } else {
          unitEnable = false;
          logLocationEquipment(locationId, equipmentId, "pump",
            `HW Pump: Staying OFF (${outdoorTemp}°F > 74°F)`);
        }
      }
    }
  }

  // STEP 5: Apply lead-lag logic - only enable if lead or if both should run
  let finalUnitEnable = unitEnable;

  // Logic for lead-lag system:
  // 1. Lead pump always follows temperature-based enable/disable rules
  // 2. Lag pump only turns on if temperature is very high/low and lead is already on

  // Only apply lead-lag if we determined a definitive lead pump
  if (isLead) {
    // This is the lead pump - follow standard temperature rules
    finalUnitEnable = unitEnable;
    logLocationEquipment(locationId, equipmentId, "pump",
      `LEAD pump - following standard temperature rules: ${finalUnitEnable ? "ON" : "OFF"}`);
  } else {
    // This is the lag pump - only enable in extreme conditions or if settings override
    if (settings.overrideLeadLag === true) {
      finalUnitEnable = unitEnable;
      logLocationEquipment(locationId, equipmentId, "pump",
        `LAG pump with OVERRIDE - turning ${finalUnitEnable ? "ON" : "OFF"}`);
    } else if (pumpType === "CWPump" && outdoorTemp !== null && outdoorTemp >= 90 && unitEnable) {
      // For very hot days (90°F+), enable both CW pumps
      finalUnitEnable = true;
      logLocationEquipment(locationId, equipmentId, "pump",
        `LAG pump - enabling due to extreme heat (${outdoorTemp}°F >= 90°F)`);
    } else if (pumpType === "HWPump" && outdoorTemp !== null && outdoorTemp <= 20 && unitEnable) {
      // For very cold days (20°F-), enable both HW pumps
      finalUnitEnable = true;
      logLocationEquipment(locationId, equipmentId, "pump",
        `LAG pump - enabling due to extreme cold (${outdoorTemp}°F <= 20°F)`);
    } else {
      // Otherwise, lag pump stays off
      finalUnitEnable = false;
      logLocationEquipment(locationId, equipmentId, "pump",
        `LAG pump - staying OFF (standard lead-lag operation)`);
    }
  }

  // STEP 6: Update runtime statistics
  const currentTime = Date.now();
  const timeSinceLastCheck = (currentTime - stateStorage[pumpStateKey].lastChecked) / 60000; // minutes
  stateStorage[pumpStateKey].lastChecked = currentTime;

  if (finalUnitEnable) {
    // If pump is running, increment runtime
    stateStorage[pumpStateKey].runtime = (stateStorage[pumpStateKey].runtime || 0) + timeSinceLastCheck;
  }

  // Get pump performance metrics from InfluxDB data
  let pumpAmps = 0;
  let pumpStatus = "unknown";

  // Determine which metrics to check based on pump type and ID
  if (pumpType === "CWPump") {
    if (equipmentId === "RJLaOk4UssyePSA1qgT8") { // CW Pump 1
      pumpAmps = Number(metrics.CWPump1Amps) || 0;
      pumpStatus = metrics.CWPump1Status || "unknown";
      logLocationEquipment(locationId, equipmentId, "pump",
        `CW Pump 1 metrics: Amps=${pumpAmps}, Status=${pumpStatus}`);
    } else if (equipmentId === "wGvFI5Bf6xaLlSwRc7xO") { // CW Pump 2
      pumpAmps = Number(metrics.CWPump2Amps) || 0;
      pumpStatus = metrics.CWPump2Status || "unknown";
      logLocationEquipment(locationId, equipmentId, "pump",
        `CW Pump 2 metrics: Amps=${pumpAmps}, Status=${pumpStatus}`);
    }
  } else if (pumpType === "HWPump") {
    if (equipmentId === "GUI1SxcedsLEhqbD0G2p") { // HW Pump 1
      pumpAmps = Number(metrics.HWPump1Amps) || 0;
      pumpStatus = metrics.HWPump1Status || "unknown";
      logLocationEquipment(locationId, equipmentId, "pump",
        `HW Pump 1 metrics: Amps=${pumpAmps}, Status=${pumpStatus}`);
    } else if (equipmentId === "oh5Bz2zzIcuT9lFoogvi") { // HW Pump 2
      pumpAmps = Number(metrics.HWPump2Amps) || 0;
      pumpStatus = metrics.HWPump2Status || "unknown";
      logLocationEquipment(locationId, equipmentId, "pump",
        `HW Pump 2 metrics: Amps=${pumpAmps}, Status=${pumpStatus}`);
    }
  }

  // Check for potential pump failure (enabled but low/no amps or bad status)
  if (finalUnitEnable && isLead &&
      ((pumpAmps < 0.5 && pumpStatus !== "off") || pumpStatus === "fault")) {

    logLocationEquipment(locationId, equipmentId, "pump",
      `WARNING: Pump performance issue detected! Amps=${pumpAmps}, Status=${pumpStatus}, while unitEnable=${finalUnitEnable}`);

    // Record the potential failure in state storage for tracking
    if (!stateStorage.pumpFailureDetections) {
      stateStorage.pumpFailureDetections = [];
    }
    stateStorage.pumpFailureDetections.push({
      timestamp: Date.now(),
      equipmentId: equipmentId,
      pumpType: pumpType,
      amps: pumpAmps,
      status: pumpStatus
    });

    // Limit the array size to prevent unbounded growth
    if (stateStorage.pumpFailureDetections.length > 20) {
      stateStorage.pumpFailureDetections.shift();
    }
  }

  // STEP 7: Prepare final result
  const result = {
    unitEnable: finalUnitEnable,
    isLead: isLead ? 1 : 0,
    pumpRuntime: stateStorage[pumpStateKey].runtime || 0,
    temperatureSource: settings.temperatureSource || "supply",
    stateStorage: stateStorage
  };

  // Log the final result
  logLocationEquipment(locationId, equipmentId, "pump",
    `Control result: unitEnable=${result.unitEnable}, ` +
    `isLead=${result.isLead}, temperatureSource=${result.temperatureSource}`,
    result);

  // STEP 8: Optimized InfluxDB batch writing
  try {
    // Create an array of commands that need to be sent to InfluxDB
    const commandsToSend = [
      { command_type: 'unitEnable', equipment_id: equipmentId, value: result.unitEnable },
      { command_type: 'isLead', equipment_id: equipmentId, value: result.isLead },
      { command_type: 'pumpType', equipment_id: equipmentId, value: pumpType },
      { command_type: 'outdoorTemperature', equipment_id: equipmentId, value: outdoorTemp },
      { command_type: 'pumpRuntime', equipment_id: equipmentId, value: result.pumpRuntime || 0 },
      { command_type: 'pumpAmps', equipment_id: equipmentId, value: pumpAmps },
      { command_type: 'pumpStatus', equipment_id: equipmentId, value: pumpStatus }
    ];

    // Add state-specific commands based on pump type
    if (pumpType === "CWPump") {
      commandsToSend.push({
        command_type: 'cwPumpEnabled',
        equipment_id: equipmentId,
        value: stateStorage.cwOutdoorState.isOn
      });
    } else if (pumpType === "HWPump") {
      commandsToSend.push({
        command_type: 'hwPumpEnabled',
        equipment_id: equipmentId,
        value: stateStorage.hwOutdoorState.isOn
      });
    }

    // Prepare numeric commands for batching
    const numericCommands = [];
    
    // Process all commands to ensure they're numeric
    for (const cmd of commandsToSend) {
      // Convert boolean to number
      if (typeof cmd.value === 'boolean') {
        cmd.value = cmd.value ? 1.0 : 0.0; // Use explicit float format
      } else if (typeof cmd.value === 'number') {
        // Value is already numeric, just make sure it's treated as float
        // No change needed
      } else if (cmd.value !== null && cmd.value !== undefined) {
        // Try to convert to number
        const numValue = Number(cmd.value);
        if (!isNaN(numValue)) {
          cmd.value = numValue;
        } else {
          // Skip any values that can't be converted to numbers
          continue;
        }
      } else {
        // Handle null/undefined - use 0.0
        cmd.value = 0.0;
      }
      
      numericCommands.push(cmd);
    }
    
    if (numericCommands.length > 0) {
      // Build the batch line protocol string
      let batchLineProtocol = '';
      for (const cmd of numericCommands) {
        batchLineProtocol += `${cmd.command_type},equipment_id=${cmd.equipment_id},location_id=${locationId},command_type=${cmd.command_type},source=server_logic,status=completed value=${cmd.value}\n`;
      }
      
      // Remove trailing newline
      batchLineProtocol = batchLineProtocol.trim();
      
      // Use child_process.exec for curl commands
      const { exec } = require('child_process');
      
      // Write to Locations DB
      const locationsCommand = `curl -s -X POST "http://localhost:8181/api/v3/write_lp?db=Locations&precision=nanosecond" -H "Content-Type: text/plain" -d "${batchLineProtocol}"`;
      exec(locationsCommand);
      
      // Write to ControlCommands DB
      const controlCommand = `curl -s -X POST "http://localhost:8181/api/v3/write_lp?db=ControlCommands&precision=nanosecond" -H "Content-Type: text/plain" -d "${batchLineProtocol}"`;
      exec(controlCommand);
      
      logLocationEquipment(locationId, equipmentId, "pump",
        `INFLUXDB BATCH: Sent ${numericCommands.length} commands in a single batch`);
    }
  } catch (error) {
    logLocationEquipment(locationId, equipmentId, "pump",
      `Error forcing InfluxDB commands: ${error.message}`);
  }

  // Return the final result
  return result;
}

/**
 * Get outdoor temperature from metrics
 */
function getOutdoorTemperature(metrics: any): number | null {
  // First check 'outsideTemp' which is used in your Node-RED function
  if (metrics.outsideTemp !== undefined && !isNaN(Number(metrics.outsideTemp))) {
    return Number(metrics.outsideTemp);
  }

  // Then check various other possible field names for outdoor temperature
  const possibleFields = [
    "outdoorTemp",
    "OutdoorTemp",
    "outdoorTemperature",
    "OutdoorTemperature",
    "oat",
    "OAT",
    "outsideAirTemp",
    "OutsideAirTemp",
    "outsideTemp",
    "OutsideTemp",
    "Outdoor_Air"
  ];

  for (const field of possibleFields) {
    if (metrics[field] !== undefined && !isNaN(Number(metrics[field]))) {
      return Number(metrics[field]);
    }
  }

  return null;
}
