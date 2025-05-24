// lib/equipment-logic/locations/huntington/boiler.ts
// REMODELED to be self-contained, similar to hopebridge/air-handler.ts pattern.
// Does NOT call base/boiler.ts.
// Handles Huntington-specific OAR, Lead-Lag, and basic on/off control with deadband.
// This version directly determines 'firing' status.

import { logLocationEquipment } from "@/lib/logging/location-logger";
import { getLeadLagStatus } from "@/lib/lead-lag-manager"; // Ensure this is your Firestore-backed manager

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
  // Parameters as received from runEquipmentLogic:
  // metrics_obj, settings_obj, currentTemp_num (supply for boilers), stateStorage_obj (pidState)
  metricsInput: any,     // This will be sandbox.metrics from runEquipmentLogic
  settingsInput: any,    // This will be sandbox.settings from runEquipmentLogic
  currentSelectedTemp: number, // This will be currentTemp (supply) from runEquipmentLogic
  stateStorageInput: any   // This will be pidState from runEquipmentLogic (though less used here)
) {
  // Extract equipmentId and locationId from settingsInput, as runEquipmentLogic prepares it
  const equipmentId = settingsInput.equipmentId || "unknown_huntington_boiler";
  const locationId = settingsInput.locationId || "4"; // Default to 4 for Huntington

  // Use metricsInput directly as it contains all standardized and raw metrics
  const currentMetrics = metricsInput;

  // Use settingsInput directly as it contains all merged control values and config
  const currentSettings = settingsInput;

  logLocationEquipment(locationId, equipmentId, "boiler", "Starting Huntington-specific SELF-CONTAINED boiler control logic");

  try {
    // STEP 1: Get Outdoor Air Temperature for OAR
    const outdoorTemp = parseSafeNumber(currentMetrics.outdoorTemperature, 60); // Standardized field first
    logLocationEquipment(locationId, equipmentId, "boiler", `Outdoor Air Temperature: ${outdoorTemp}°F`);

    // STEP 2: Huntington OAR Parameter Calculation
    // OAR Parameters: 32°F OAT = 160°F SP, 72°F OAT = 85°F SP
    const minOAT = 32;
    const maxOAT = 72;
    const maxSP = 160; // Safe max supply setpoint
    const minSP = 85;  // Min supply setpoint

    let oarSetpoint;
    if (outdoorTemp <= minOAT) {
      oarSetpoint = maxSP;
    } else if (outdoorTemp >= maxOAT) {
      oarSetpoint = minSP;
    } else {
      const ratio = (outdoorTemp - minOAT) / (maxOAT - minOAT);
      oarSetpoint = maxSP - (ratio * (maxSP - minSP));
    }
    oarSetpoint = Math.round(oarSetpoint * 10) / 10;
    oarSetpoint = Math.min(oarSetpoint, 160); // Ensure it never exceeds the absolute safe max

    logLocationEquipment(locationId, equipmentId, "boiler", `OAR Calculation: OAT=${outdoorTemp}°F -> Calculated Setpoint=${oarSetpoint}°F (Safe Max: 160°F)`);

    // STEP 3: Check Lead-Lag Status
    // getLeadLagStatus uses Firestore and should be robust
    const leadLagStatus = await getLeadLagStatus(locationId, equipmentId);
    logLocationEquipment(locationId, equipmentId, "boiler", `Lead-Lag Status: isLead=${leadLagStatus.isLead}, shouldRun=${leadLagStatus.shouldRun}, Reason=${leadLagStatus.reason}`);

    // STEP 4: Determine Boiler Operational State based on Lead-Lag
    if (!leadLagStatus.shouldRun) {
      logLocationEquipment(locationId, equipmentId, "boiler", `LEAD-LAG OVERRIDE: Boiler will be commanded OFF. Reason: ${leadLagStatus.reason}`);
      
      // Create result for boiler that shouldn't run
      const result = {
        boilerEnabled: false,
        pumpEnabled: false, // Assume pump is off if boiler is off due to lead-lag
        unitEnable: false,
        firing: 0,          // Explicitly set firing to 0
        valvePosition: 0,   // Assuming valve control might be part of a general boiler object
        temperatureSetpoint: oarSetpoint, // Still provide the OAR setpoint for informational purposes
        oarSetpoint: oarSetpoint,
        isLead: leadLagStatus.isLead,
        leadLagReason: leadLagStatus.reason,
        outdoorTemp: outdoorTemp,
        // Include other fields expected by runEquipmentLogic if any, with safe defaults
        stateStorage: stateStorageInput // Pass through stateStorage
      };
      
      // Add optimized InfluxDB batch writing for boiler not running
      await writeToInfluxDB(locationId, equipmentId, result, "boiler");
      
      return result;
    }

    // If we reach here, leadLagStatus.shouldRun is TRUE.
    logLocationEquipment(locationId, equipmentId, "boiler", `LEAD-LAG ALLOWS RUN. Boiler is ${leadLagStatus.isLead ? 'LEAD' : 'potential LAG takeover (not fully modeled here)'}.`);

    // STEP 5: Determine Firing Status based on Setpoint and Current Supply Temperature
    // currentSelectedTemp is the supply water temperature passed by runEquipmentLogic
    const supplyWaterTemp = parseSafeNumber(currentSelectedTemp, 140); // Default if undefined/NaN
    const deadband = parseSafeNumber(currentSettings.deadband, 5); // Use deadband from settings or default to 5°F
    const emergencyShutoffTemp = 170; // High limit

    let boilerShouldBeEnabled = false;
    let pumpShouldBeEnabled = false;
    let calculatedFiring = 0;

    logLocationEquipment(locationId, equipmentId, "boiler", `Evaluating ON/OFF: SupplyWaterTemp=${supplyWaterTemp}°F, OAR Setpoint=${oarSetpoint}°F, Deadband=${deadband}°F`);

    if (supplyWaterTemp >= emergencyShutoffTemp) {
      logLocationEquipment(locationId, equipmentId, "boiler", `EMERGENCY SHUTOFF: Supply temp ${supplyWaterTemp}°F >= ${emergencyShutoffTemp}°F. Commanding OFF.`);
      boilerShouldBeEnabled = false;
      pumpShouldBeEnabled = false; // Turn off pump as well
      calculatedFiring = 0;
    } else if (supplyWaterTemp < oarSetpoint - deadband) {
      logLocationEquipment(locationId, equipmentId, "boiler", `Condition MET: Supply ${supplyWaterTemp}°F < (Setpoint ${oarSetpoint}°F - Deadband ${deadband}°F). Commanding ON.`);
      boilerShouldBeEnabled = true;
      pumpShouldBeEnabled = true; // Assume pump runs with boiler
      calculatedFiring = 1; // 1 for ON
    } else if (supplyWaterTemp > oarSetpoint + deadband) {
      logLocationEquipment(locationId, equipmentId, "boiler", `Condition MET: Supply ${supplyWaterTemp}°F > (Setpoint ${oarSetpoint}°F + Deadband ${deadband}°F). Commanding OFF.`);
      boilerShouldBeEnabled = false;
      // For pump, consider if it should remain on for a bit (e.g. post-purge)
      // For simplicity here, linking pump directly to boiler state when turning off via deadband.
      // More complex pump logic (like in base/pump.ts or location-specific pump) would handle this.
      pumpShouldBeEnabled = false;
      calculatedFiring = 0;
    } else {
      // Within deadband - maintain current state (from settings, which reflect last command)
      boilerShouldBeEnabled = currentSettings.boilerEnabled || currentSettings.unitEnable || false;
      pumpShouldBeEnabled = currentSettings.pumpEnabled || false;
      calculatedFiring = currentSettings.firing || 0;
      logLocationEquipment(locationId, equipmentId, "boiler", `WITHIN DEADBAND: Maintaining previous state (Boiler: ${boilerShouldBeEnabled}, Firing: ${calculatedFiring}, Pump: ${pumpShouldBeEnabled}).`);
    }

    // Final check: if lead-lag says run, but deadband logic says off, ensure we respect lead-lag's "shouldRun" for the enable signal
    // if it's a continuous run system. For on/off based on temp, this deadband logic is primary.
    // Here, we assume deadband logic is primary for on/off control.

    logLocationEquipment(locationId, equipmentId, "boiler", `Final Decision: boilerEnabled=${boilerShouldBeEnabled}, pumpEnabled=${pumpShouldBeEnabled}, firing=${calculatedFiring}`);

    // STEP 6: Construct and Return Result Object
    const result = {
      boilerEnabled: boilerShouldBeEnabled,
      pumpEnabled: pumpShouldBeEnabled,
      unitEnable: boilerShouldBeEnabled, // Sync unitEnable with boilerEnabled
      firing: calculatedFiring,        // Explicitly include firing status (0 or 1)
      valvePosition: currentSettings.valvePosition || 0, // Maintain or default
      temperatureSetpoint: oarSetpoint, // The target setpoint for this cycle
      oarSetpoint: oarSetpoint,         // Explicit OAR setpoint field
      isLead: leadLagStatus.isLead,
      leadLagReason: leadLagStatus.reason,
      outdoorTemp: outdoorTemp,
      // Pass through other relevant fields from currentSettings if needed,
      // or fields that runEquipmentLogic expects for command generation.
      // Example: boilerType, groupId might be relevant if used downstream.
      boilerType: currentSettings.boilerType || "comfort",
      groupId: currentSettings.groupId || (leadLagStatus.reason.includes("group") ? leadLagStatus.reason.split("group ")[1] : null),
      stateStorage: stateStorageInput // Pass through stateStorage
    };

    // STEP 7: Write data to InfluxDB using optimized batch method
    await writeToInfluxDB(locationId, equipmentId, result, "boiler");

    logLocationEquipment(locationId, equipmentId, "boiler", `FINAL RESULT for runEquipmentLogic:`, result);
    return result;

  } catch (error: any) {
    logLocationEquipment(locationId, equipmentId, "boiler", `ERROR in Huntington (self-contained) boiler control: ${error.message}`, error.stack);

    // EMERGENCY SAFE DEFAULT STATE on error
    const safeOutdoorTemp = parseSafeNumber(currentMetrics?.outdoorTemperature, 60);
    // A very conservative setpoint if all else fails
    const safeSetpoint = Math.min(85 + Math.max(0, (60 - safeOutdoorTemp)) * 1.5, 160);

    const errorResult = {
      boilerEnabled: false,
      pumpEnabled: false,
      unitEnable: false,
      firing: 0,
      valvePosition: 0,
      temperatureSetpoint: safeSetpoint,
      oarSetpoint: safeSetpoint,
      isLead: false, // Can't determine on error
      leadLagReason: "Error in logic, safe state.",
      outdoorTemp: safeOutdoorTemp,
      error: error.message,
      stateStorage: stateStorageInput
    };
    
    // Try to write emergency state to InfluxDB, but don't fail if this fails
    try {
      await writeToInfluxDB(locationId, equipmentId, errorResult, "boiler");
    } catch (writeError) {
      logLocationEquipment(locationId, equipmentId, "boiler", `Failed to write emergency state to InfluxDB: ${writeError.message}`);
    }
    
    return errorResult;
  }
}

/**
 * Helper function to write boiler data to InfluxDB in an optimized batch
 */
async function writeToInfluxDB(locationId: string, equipmentId: string, data: any, equipmentType: string): Promise<void> {
  try {
    // Create an array of commands to send to InfluxDB
    const commandsToSend = [
      { command_type: 'boilerEnabled', equipment_id: equipmentId, value: data.boilerEnabled },
      { command_type: 'pumpEnabled', equipment_id: equipmentId, value: data.pumpEnabled },
      { command_type: 'unitEnable', equipment_id: equipmentId, value: data.unitEnable },
      { command_type: 'firing', equipment_id: equipmentId, value: data.firing },
      { command_type: 'valvePosition', equipment_id: equipmentId, value: data.valvePosition },
      { command_type: 'temperatureSetpoint', equipment_id: equipmentId, value: data.temperatureSetpoint },
      { command_type: 'oarSetpoint', equipment_id: equipmentId, value: data.oarSetpoint },
      { command_type: 'isLead', equipment_id: equipmentId, value: data.isLead },
      { command_type: 'outdoorTemp', equipment_id: equipmentId, value: data.outdoorTemp }
    ];
    
    // Add boilerType if available
    if (data.boilerType) {
      commandsToSend.push({
        command_type: 'boilerType',
        equipment_id: equipmentId,
        value: 1.0 // Use numeric value for the boiler type indicator
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
      
      logLocationEquipment(locationId, equipmentId, equipmentType,
        `INFLUXDB BATCH: Sent ${numericCommands.length} commands in a single batch`);
    }
  } catch (error) {
    logLocationEquipment(locationId, equipmentId, equipmentType,
      `Error sending InfluxDB commands: ${error.message}`);
    // Don't rethrow - we don't want InfluxDB errors to affect boiler operation
  }
}
