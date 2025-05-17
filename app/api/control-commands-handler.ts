// app/api/control-commands-handler.ts
'use server'

// Import the command logger
import { logCommand } from '../../lib/logging/command-logger';

// Don't export dynamic directly, make it a local constant
const dynamicConfig = 'force-dynamic';

// InfluxDB 3 Core configuration
const INFLUXDB_URL = "http://localhost:8181"  // Force local InfluxDB URL
const INFLUXDB_DATABASE = process.env.INFLUXDB_DATABASE || "Locations"
const INFLUXDB_DATABASE2 = process.env.INFLUXDB_DATABASE2 || "ControlCommands"

// Equipment type mappings - used to determine the correct protocol
const EQUIPMENT_TYPE_MAPPINGS = {
  // Map from system name patterns to equipment types
  PUMP_PATTERNS: ['pump', 'hwpump', 'cwpump', 'hwp', 'cwp'],
  BOILER_PATTERNS: ['boiler', 'hot water gen', 'hwg'],
  FAN_COIL_PATTERNS: ['fan coil', 'fancoil', 'fcu', 'vav'],
  CHILLER_PATTERNS: ['chiller', 'cwg', 'cold water gen'],
  AHU_PATTERNS: ['ahu', 'air handler', 'rtu', 'rooftop']
};

// Handler function for control commands
export async function handleControlCommand(commandData: any) {
  try {
    // Validate the command data
    if (!commandData || !commandData.equipmentId || !commandData.command) {
      return {
        success: false,
        error: "Invalid command data: missing required fields"
      }
    }

    // Log the command for debugging
    logCommand(`Processing control command: ${commandData.command} for ${commandData.equipmentId}`);

    // Check for equipment group-related commands
    if (commandData.command.includes('equipmentGroup') ||
        commandData.command.includes('boilerGroup') ||
        commandData.command.includes('pumpGroup')) {

      // Generate specialized line protocol for equipment groups
      const groupProtocol = generateEquipmentGroupProtocol(commandData);

      // Send to InfluxDB
      const groupResponse = await sendToInfluxDB(groupProtocol);

      if (groupResponse.success) {
        return {
          success: true,
          command: commandData.command,
          equipmentId: commandData.equipmentId,
          note: "Equipment group event processed successfully"
        };
      } else {
        // Fall back to Firebase for group data
        try {
          await updateFirebaseDirectly(commandData);
          return {
            success: true,
            command: commandData.command,
            equipmentId: commandData.equipmentId,
            note: "Equipment group processed via Firebase after InfluxDB error"
          };
        } catch (fbError) {
          logCommand(`Firebase fallback for group also failed: ${fbError}`, 'error');
          return groupResponse; // Return the original InfluxDB error
        }
      }
    }

    // Determine equipment type based on system name or command
    const equipmentType = determineEquipmentType(commandData);
    logCommand(`Determined equipment type: ${equipmentType} for command: ${commandData.command}`);

    // Skip state storage commands completely - they're only for internal state tracking
    if (commandData.command === 'update_stateStorage' || commandData.commandType === 'stateStorage') {
      logCommand(`Skipping InfluxDB write for state storage command: ${commandData.command}`);

      // Still need to update Firebase for state persistence
      try {
        await updateFirebaseDirectly(commandData);
        return {
          success: true,
          command: commandData.command,
          equipmentId: commandData.equipmentId,
          note: "Command processed via Firebase only (state storage)"
        };
      } catch (fbError) {
        logCommand(`Error with Firebase update for state storage: ${fbError}`, 'error');
        return {
          success: false,
          error: String(fbError)
        };
      }
    }

    // Generate line protocol based on equipment type
    let lineProtocol;
    switch (equipmentType) {
      case 'pump':
        lineProtocol = generatePumpProtocol(commandData);
        break;
      case 'boiler':
        lineProtocol = generateBoilerProtocol(commandData);
        break;
      case 'fancoil':
        lineProtocol = generateFanCoilProtocol(commandData);
        break;
      case 'chiller':
        lineProtocol = generateChillerProtocol(commandData);
        break;
      case 'ahu':
        lineProtocol = generateAHUProtocol(commandData);
        break;
      default:
        // For unknown equipment types, use the generic protocol
        lineProtocol = generateGenericProtocol(commandData);
    }

    // If we couldn't generate a valid line protocol, fall back to Firebase
    if (!lineProtocol) {
      logCommand(`No valid line protocol generated for ${commandData.command}, falling back to Firebase direct update`);
      try {
        await updateFirebaseDirectly(commandData);
        return {
          success: true,
          command: commandData.command,
          equipmentId: commandData.equipmentId,
          note: "Command processed via Firebase fallback"
        };
      } catch (fbError) {
        logCommand(`Error with Firebase fallback: ${fbError}`, 'error');
        return {
          success: false,
          error: String(fbError)
        };
      }
    }

    // Send data to InfluxDB
    const result = await sendToInfluxDB(lineProtocol);

    if (result.success) {
      return {
        success: true,
        command: commandData.command,
        equipmentId: commandData.equipmentId
      };
    } else {
      // Try fallback to Firebase if InfluxDB fails
      try {
        logCommand("InfluxDB write failed, attempting Firebase fallback");
        await updateFirebaseDirectly(commandData);
        return {
          success: true,
          command: commandData.command,
          equipmentId: commandData.equipmentId,
          note: "Command processed via Firebase fallback after InfluxDB error"
        };
      } catch (fbError) {
        logCommand(`Firebase fallback also failed: ${fbError}`, 'error');
        return {
          success: false,
          error: `InfluxDB: ${result.error}. Firebase: ${fbError}`
        };
      }
    }
  } catch (error) {
    logCommand(`Error processing control command: ${error}`, 'error');

    // Try fallback to Firebase if there's an overall error
    try {
      logCommand("Processing error, attempting Firebase fallback");
      await updateFirebaseDirectly(commandData);
      return {
        success: true,
        command: commandData.command,
        equipmentId: commandData.equipmentId,
        note: "Command processed via Firebase fallback after error"
      };
    } catch (fbError) {
      logCommand(`Firebase fallback also failed: ${fbError}`, 'error');
      return {
        success: false,
        error: `Processing: ${error}. Firebase: ${fbError}`
      };
    }
  }
}

// Set the dynamic property on the exported function
(handleControlCommand as any).dynamic = dynamicConfig;

/**
 * Helper function to send data to InfluxDB 3
 */
async function sendToInfluxDB(lineProtocol: string): Promise<{ success: boolean, error?: string }> {
  try {
    // Log the line protocol for debugging
    logCommand(`InfluxDB Line Protocol: ${lineProtocol}`);

    // FORCE the local InfluxDB URL
    const LOCAL_INFLUXDB_URL = "http://localhost:8181";

    // Write to both databases
    let locationsSuccess = false;
    let controlCommandsSuccess = false;
    let locationsError: string | undefined;
    let controlCommandsError: string | undefined;

    try {
      // Write to primary Locations database
      const locationsResult = await writeToDatabase(lineProtocol, INFLUXDB_DATABASE, LOCAL_INFLUXDB_URL);
      locationsSuccess = locationsResult.success;
      locationsError = locationsResult.error;
    } catch (locationError) {
      logCommand(`Error writing to ${INFLUXDB_DATABASE}: ${locationError}`, 'error');
      locationsError = String(locationError);
    }

    try {
      // Write to ControlCommands database
      const controlCommandsResult = await writeToDatabase(lineProtocol, INFLUXDB_DATABASE2, LOCAL_INFLUXDB_URL);
      controlCommandsSuccess = controlCommandsResult.success;
      controlCommandsError = controlCommandsResult.error;
    } catch (controlError) {
      logCommand(`Error writing to ${INFLUXDB_DATABASE2}: ${controlError}`, 'error');
      controlCommandsError = String(controlError);
    }

    // Consider overall success if at least one write succeeded
    const overallSuccess = locationsSuccess || controlCommandsSuccess;

    // Log the results
    if (overallSuccess) {
      logCommand(`InfluxDB write successful to at least one database`);
      if (!locationsSuccess) {
        logCommand(`Note: Write to ${INFLUXDB_DATABASE} failed: ${locationsError}`, 'warn');
      }
      if (!controlCommandsSuccess) {
        logCommand(`Note: Write to ${INFLUXDB_DATABASE2} failed: ${controlCommandsError}`, 'warn');
      }
    } else {
      logCommand(`InfluxDB write failed to both databases`, 'error');
      logCommand(`${INFLUXDB_DATABASE} error: ${locationsError}`, 'error');
      logCommand(`${INFLUXDB_DATABASE2} error: ${controlCommandsError}`, 'error');
    }

    return {
      success: overallSuccess,
      error: overallSuccess ? undefined : `${INFLUXDB_DATABASE}: ${locationsError}, ${INFLUXDB_DATABASE2}: ${controlCommandsError}`
    };
  } catch (error) {
    logCommand(`Error in sendToInfluxDB: ${error}`, 'error');
    return {
      success: false,
      error: String(error)
    };
  }
}

// Helper function to write to a specific database
async function writeToDatabase(lineProtocol: string, database: string, url: string): Promise<{ success: boolean, error?: string }> {
  try {
    // Prepare the request URL for InfluxDB 3
    const writeUrl = `${url}/api/v3/write_lp?db=${database}&precision=nanosecond`;
    logCommand(`Sending to InfluxDB URL: ${writeUrl}`);

    // Replace any problematic characters in the line protocol for command-line safety
    const escapedLineProtocol = lineProtocol
      .replace(/\\/g, '\\\\')  // Double escape backslashes
      .replace(/"/g, '\\"')    // Escape double quotes
      .replace(/'/g, "\\'")    // Escape single quotes
      .replace(/`/g, '\\`')    // Escape backticks
      .replace(/\$/g, '\\$')   // Escape dollar signs
      .replace(/!/g, '\\!')    // Escape exclamations
      .replace(/\n/g, ' ');    // Replace newlines with spaces

    // Use a simplified curl command format that matches your working version
    const curlCommand = `curl -s -X POST "${writeUrl}" -H "Content-Type: text/plain" -d "${escapedLineProtocol}"`;

    // For debugging: log the exact curl command we're about to execute
    logCommand(`Executing curl command for ${database}: ${curlCommand}`);

    // Use the promise-based exec from child_process
    return new Promise((resolve) => {
      const { exec } = require('child_process');

      // Execute the curl command with proper timeout
      exec(curlCommand, { timeout: 5000 }, (execError, stdout, stderr) => {
        // If there's an execution error (process failure)
        if (execError) {
          logCommand(`curl execution error for ${database}: ${execError}`, 'error');
          resolve({ success: false, error: String(execError) });
          return;
        }

        // Check for error output
        if (stderr && stderr.trim().length > 0 && stderr.includes('error')) {
          logCommand(`curl stderr for ${database}: ${stderr}`, 'error');
          resolve({ success: false, error: stderr });
          return;
        }

        // An empty stdout with no stderr error indicates success (204 No Content)
        logCommand(`InfluxDB write to ${database} successful`);
        resolve({ success: true });
        return;
      });
    });
  } catch (error) {
    logCommand(`Error in writeToDatabase for ${database}: ${error}`, 'error');
    return {
      success: false,
      error: String(error)
    };
  }
}

/**
 * Generate specialized protocol for equipment group events
 */
function generateEquipmentGroupProtocol(commandData: any): string {
  const groupType = commandData.command.includes('boiler') ? 'boilerGroup' :
                   commandData.command.includes('pump') ? 'pumpGroup' : 'equipmentGroup';

  // Start with the measurement (command) and common tags
  let protocol = `${commandData.command},`;
  protocol += `equipment_id=${commandData.equipmentId},`;
  protocol += `location_id=${commandData.locationId || "unknown"},`;
  protocol += `command_type=${commandData.commandType || "group_event"},`;
  protocol += `group_id=${commandData.groupId || commandData.equipmentId},`;
  protocol += `equipment_type=${groupType},`; // Added comma
  protocol += `source=${commandData.source || "server_logic"},`; // Added source
  protocol += `status=${commandData.status || "completed"} `; // Added status

  // Add appropriate fields based on the event type
  const eventType = commandData.eventType || 'update';

  switch (eventType) {
    case 'changeover':
      protocol += `value="changeover",`;
      protocol += `lead_equipment="${commandData.leadEquipmentId || ''}",`;
      protocol += `previous_lead="${commandData.previousLeadEquipmentId || ''}"`;
      break;
    case 'failover':
      protocol += `value="failover",`;
      protocol += `lead_equipment="${commandData.leadEquipmentId || ''}",`;
      protocol += `failed_equipment="${commandData.failedEquipmentId || ''}"`;
      break;
    case 'groupUpdate':
      protocol += `value="update",`;
      protocol += `lead_equipment="${commandData.leadEquipmentId || ''}",`;
      protocol += `group_size=${commandData.groupSize || 0}`;
      break;
    default:
      // For general group updates or unknown events
      protocol += `value="${commandData.value || eventType}",`;

      // Add lead equipment if available
      if (commandData.leadEquipmentId) {
        protocol += `lead_equipment="${commandData.leadEquipmentId}",`;
      }

      // Add additional details if available
      if (commandData.details) {
        protocol += `details="${commandData.details}"`;
      } else {
        // Remove trailing comma if no details added
        protocol = protocol.endsWith(',') ? protocol.slice(0, -1) : protocol;
      }
  }

  // Remove timestamp - let InfluxDB 3 assign it
  return protocol;
}

/**
 * Determine equipment type based on system name and command data
 */
function determineEquipmentType(commandData: any): string {
  const systemName = commandData.system?.toLowerCase() || '';
  const equipmentId = commandData.equipmentId?.toLowerCase() || '';
  const command = commandData.command?.toLowerCase() || '';

  // Check for pump-specific indicators
  if (
    command.includes('pump') ||
    EQUIPMENT_TYPE_MAPPINGS.PUMP_PATTERNS.some(pattern =>
      systemName.includes(pattern) || equipmentId.includes(pattern)
    )
  ) {
    return 'pump';
  }

  // Check for boiler-specific indicators
  if (
    command.includes('boiler') ||
    command.includes('firing') ||
    EQUIPMENT_TYPE_MAPPINGS.BOILER_PATTERNS.some(pattern =>
      systemName.includes(pattern) || equipmentId.includes(pattern)
    )
  ) {
    return 'boiler';
  }

  // Check for fan coil indicators
  if (
    command.includes('fan') ||
    command.includes('damper') ||
    EQUIPMENT_TYPE_MAPPINGS.FAN_COIL_PATTERNS.some(pattern =>
      systemName.includes(pattern) || equipmentId.includes(pattern)
    )
  ) {
    return 'fancoil';
  }

  // Check for chiller indicators
  if (
    command.includes('chiller') ||
    EQUIPMENT_TYPE_MAPPINGS.CHILLER_PATTERNS.some(pattern =>
      systemName.includes(pattern) || equipmentId.includes(pattern)
    )
  ) {
    return 'chiller';
  }

  // Check for AHU indicators
  if (
    command.includes('ahu') ||
    EQUIPMENT_TYPE_MAPPINGS.AHU_PATTERNS.some(pattern =>
      systemName.includes(pattern) || equipmentId.includes(pattern)
    )
  ) {
    return 'ahu';
  }

  // Default - generic equipment type
  return 'generic';
}

/**
 * Generate line protocol for pumps
 */
function generatePumpProtocol(commandData: any): string {
  // Get the command type from the command string or commandType field
  const commandType = commandData.commandType || commandData.command.replace('update_', '');

  // Special case: If this is a complex object, simplify it
  if (isComplexValue(commandData.value)) {
    return generateSimplifiedProtocol(commandData);
  }

  // Start with the measurement (command) and common tags
  let protocol = `${commandData.command},`;
  protocol += `equipment_id=${commandData.equipmentId},`;
  protocol += `location_id=${commandData.locationId || "unknown"},`;
  protocol += `command_type=${commandType},`;
  protocol += `equipment_type=pump,`; // Added comma
  protocol += `source=${commandData.source || "server_logic"},`; // Added source
  protocol += `status=${commandData.status || "completed"} `; // Added status

  // For pumps, only include specific fields based on command type
  switch (commandType) {
    case 'unitEnable':
      // Boolean field for pump enable status
      protocol += `value=${commandData.value ? 'true' : 'false'}`;
      break;
    case 'temperatureSource':
    case 'temperatureMode':
      // String field for temperature source/mode
      protocol += `value="${commandData.value}"`;
      break;
    case 'pumpRuntime':
    case 'runtime':
    case 'pumpRuntimeHours':
    case 'runtimeHours':
    case 'pumpRuntimeMinutes':
    case 'runtimeMinutes':
    case 'isLeadPump':
    case 'leadPumpNumber':
    case 'isLead':
    case 'leadNumber':
      // Number fields for pump metrics
      protocol += `value=${formatNumericValue(commandData.value)}`;
      break;
    default:
      // For any other fields, use generic formatting
      protocol += `value=${formatValueForInfluxDB(commandData.value)}`;
  }

  // Remove timestamp - let InfluxDB 3 assign it
  return protocol;
}

/**
 * Generate line protocol for boilers
 */
function generateBoilerProtocol(commandData: any): string {
  // Get the command type from the command string or commandType field
  const commandType = commandData.commandType || commandData.command.replace('update_', '');

  // Special handling for firing rate
  if (commandType === 'firingRate') {
    return `${commandData.command},equipment_id=${commandData.equipmentId},location_id=${commandData.locationId || "unknown"},command_type=firingRate,equipment_type=boiler,source=${commandData.source || "server_logic"},status=${commandData.status || "completed"} value=${formatNumericValue(commandData.value)}`;
  }

  // Special case: If this is a complex object, simplify it
  if (isComplexValue(commandData.value)) {
    return generateSimplifiedProtocol(commandData);
  }

  // Start with the measurement (command) and common tags
  let protocol = `${commandData.command},`;
  protocol += `equipment_id=${commandData.equipmentId},`;
  protocol += `location_id=${commandData.locationId || "unknown"},`;
  protocol += `command_type=${commandType},`;
  protocol += `equipment_type=boiler,`; // Added comma
  protocol += `source=${commandData.source || "server_logic"},`; // Added source
  protocol += `status=${commandData.status || "completed"} `; // Added status

  // For boilers, handle specific fields based on command type
  switch (commandType) {
    case 'unitEnable':
      // Boolean field for boiler enable status
      protocol += `value=${commandData.value ? 'true' : 'false'}`;
      break;
    case 'waterTempSetpoint':
    case 'temperatureSetpoint':
      // Number field for temperature setpoint
      protocol += `value=${formatNumericValue(commandData.value)}`;
      break;
    case 'runtime':
    case 'runtimeHours':
    case 'runtimeMinutes':
    case 'boilerRuntime':
    case 'boilerRuntimeHours':
    case 'boilerRuntimeMinutes':
      // Runtime tracking metrics for boilers
      protocol += `value=${formatNumericValue(commandData.value)}`;
      break;
    case 'isLead':
    case 'isLeadBoiler':
    case 'leadBoilerNumber':
    case 'leadNumber':
      // Lead/lag fields for boilers that support it
      protocol += `value=${formatNumericValue(commandData.value)}`;
      break;
    default:
      // For any other fields, use generic formatting
      protocol += `value=${formatValueForInfluxDB(commandData.value)}`;
  }

  // Remove timestamp - let InfluxDB 3 assign it
  return protocol;
}

/**
 * Generate line protocol for fan coil units
 */
function generateFanCoilProtocol(commandData: any): string {
  // Get the command type from the command string or commandType field
  const commandType = commandData.commandType || commandData.command.replace('update_', '');

  // Special handling for PID controllers and other complex objects
  if (commandType === 'pidControllers' || isComplexValue(commandData.value)) {
    return generateSimplifiedProtocol(commandData);
  }

  // Start with the measurement (command) and common tags
  let protocol = `${commandData.command},`;
  protocol += `equipment_id=${commandData.equipmentId},`;
  protocol += `location_id=${commandData.locationId || "unknown"},`;
  protocol += `command_type=${commandType},`;
  protocol += `equipment_type=fancoil,`; // Added comma
  protocol += `source=${commandData.source || "server_logic"},`; // Added source
  protocol += `status=${commandData.status || "completed"} `; // Added status

  // For fan coils, handle specific fields based on command type
  switch (commandType) {
    case 'unitEnable':
    case 'fanEnabled':
      // Boolean fields for enable status
      protocol += `value=${commandData.value ? 'true' : 'false'}`;
      break;
    case 'temperatureSetpoint':
    case 'heatingValvePosition':
    case 'coolingValvePosition':
    case 'outdoorDamperPosition':
      // Number fields for setpoints and positions
      protocol += `value=${formatNumericValue(commandData.value)}`;
      break;
    case 'fanMode':
    case 'fanSpeed':
    case 'operationMode':
    case 'temperatureSource':
      // String fields for modes and sources
      protocol += `value="${commandData.value}"`;
      break;
    default:
      // For any other fields, use generic formatting
      protocol += `value=${formatValueForInfluxDB(commandData.value)}`;
  }

  // Remove timestamp - let InfluxDB 3 assign it
  return protocol;
}

/**
 * Generate line protocol for chillers
 */
function generateChillerProtocol(commandData: any): string {
  // Get the command type from the command string or commandType field
  const commandType = commandData.commandType || commandData.command.replace('update_', '');

  // Special case: If this is a complex object, simplify it
  if (isComplexValue(commandData.value)) {
    return generateSimplifiedProtocol(commandData);
  }

  // Start with the measurement (command) and common tags
  let protocol = `${commandData.command},`;
  protocol += `equipment_id=${commandData.equipmentId},`;
  protocol += `location_id=${commandData.locationId || "unknown"},`;
  protocol += `command_type=${commandType},`;
  protocol += `equipment_type=chiller,`; // Added comma
  protocol += `source=${commandData.source || "server_logic"},`; // Added source
  protocol += `status=${commandData.status || "completed"} `; // Added status

  // For chillers, handle specific fields based on command type
  switch (commandType) {
    case 'unitEnable':
      // Boolean field for chiller enable status
      protocol += `value=${commandData.value ? 'true' : 'false'}`;
      break;
    case 'waterTempSetpoint':
    case 'temperatureSetpoint':
    case 'capacitySetpoint':
      // Number fields for setpoints
      protocol += `value=${formatNumericValue(commandData.value)}`;
      break;
    case 'operationMode':
      // String field for operation mode
      protocol += `value="${commandData.value}"`;
      break;
    case 'runtime':
    case 'runtimeHours':
    case 'runtimeMinutes':
    case 'chillerRuntime':
    case 'chillerRuntimeHours':
    case 'chillerRuntimeMinutes':
      // Runtime tracking metrics for chillers
      protocol += `value=${formatNumericValue(commandData.value)}`;
      break;
    case 'isLead':
    case 'isLeadChiller':
    case 'leadChillerNumber':
    case 'leadNumber':
      // Lead/lag fields for chillers
      protocol += `value=${formatNumericValue(commandData.value)}`;
      break;
    default:
      // For any other fields, use generic formatting
      protocol += `value=${formatValueForInfluxDB(commandData.value)}`;
  }

  // Remove timestamp - let InfluxDB 3 assign it
  return protocol;
}

/**
 * Generate line protocol for air handling units
 */
function generateAHUProtocol(commandData: any): string {
  // Get the command type from the command string or commandType field
  const commandType = commandData.commandType || commandData.command.replace('update_', '');

  // Special handling for PID controllers and other complex objects
  if (commandType === 'pidControllers' || isComplexValue(commandData.value)) {
    return generateSimplifiedProtocol(commandData);
  }

  // Start with the measurement (command) and common tags
  let protocol = `${commandData.command},`;
  protocol += `equipment_id=${commandData.equipmentId},`;
  protocol += `location_id=${commandData.locationId || "unknown"},`;
  protocol += `command_type=${commandType},`;
  protocol += `equipment_type=ahu,`; // Added comma
  protocol += `source=${commandData.source || "server_logic"},`; // Added source
  protocol += `status=${commandData.status || "completed"} `; // Added status

  // For AHUs, handle specific fields based on command type
  switch (commandType) {
    case 'unitEnable':
    case 'fanEnabled':
    case 'economizer':
      // Boolean fields for enable status
      protocol += `value=${commandData.value ? 'true' : 'false'}`;
      break;
    case 'temperatureSetpoint':
    case 'heatingValvePosition':
    case 'coolingValvePosition':
    case 'outdoorDamperPosition':
    case 'staticPressureSetpoint':
      // Number fields for setpoints and positions
      protocol += `value=${formatNumericValue(commandData.value)}`;
      break;
    case 'fanMode':
    case 'fanSpeed':
    case 'operationMode':
    case 'temperatureSource':
      // String fields for modes and sources
      protocol += `value="${commandData.value}"`;
      break;
    case 'runtime':
    case 'runtimeHours':
    case 'fanRuntime':
    case 'ahuRuntime':
      // Runtime tracking for AHUs
      protocol += `value=${formatNumericValue(commandData.value)}`;
      break;
    default:
      // For any other fields, use generic formatting
      protocol += `value=${formatValueForInfluxDB(commandData.value)}`;
  }

  // Remove timestamp - let InfluxDB 3 assign it
  return protocol;
}

/**
 * Generate generic line protocol for unknown equipment types
 */
function generateGenericProtocol(commandData: any): string {
  // If this is a complex object, use simplified protocol
  if (isComplexValue(commandData.value)) {
    return generateSimplifiedProtocol(commandData);
  }

  // Start with the measurement (command) and common tags
  let protocol = `${commandData.command},`;
  protocol += `equipment_id=${commandData.equipmentId},`;
  protocol += `location_id=${commandData.locationId || "unknown"},`;
  protocol += `command_type=${commandData.commandType || commandData.command.replace('update_', '')},`;
  protocol += `source=${commandData.source || "server_logic"},`;
  protocol += `status=${commandData.status || "completed"} `;

  // Add a single value field with proper formatting
  protocol += `value=${formatValueForInfluxDB(commandData.value)}`;

  // Remove timestamp - let InfluxDB 3 assign it
  return protocol;
}

/**
 * Generate simplified protocol for complex objects
 */
function generateSimplifiedProtocol(commandData: any): string {
  // Get the command type
  const commandType = commandData.commandType || commandData.command.replace('update_', '');

  // Determine equipment type for tagging
  const equipmentType = determineEquipmentType(commandData);

  // Format the value appropriately
  let valueStr = '';

  if (Array.isArray(commandData.value)) {
    valueStr = `"array_${commandData.value.length}_items"`;
  } else if (commandData.value === null || commandData.value === undefined) {
    valueStr = '0';
  } else if (typeof commandData.value === 'object') {
    valueStr = `"object"`;
  } else if (typeof commandData.value === 'string') {
    valueStr = `"${commandData.value}"`;
  } else {
    valueStr = String(commandData.value);
  }

  // Create the simplified protocol without timestamp - added source and status
  return `${commandData.command},equipment_id=${commandData.equipmentId},location_id=${commandData.locationId || "unknown"},command_type=${commandType},equipment_type=${equipmentType},source=${commandData.source || "server_logic"},status=${commandData.status || "completed"} value=${valueStr}`;
}

/**
 * Helper function to check if a value is complex (object/array)
 */
function isComplexValue(value: any): boolean {
  return value !== null &&
         typeof value === 'object' &&
         !(value instanceof Date);
}

/**
 * Format a numeric value for InfluxDB, handling edge cases
 */
function formatNumericValue(value: any): string {
  if (value === null || value === undefined) {
    return '0';
  }

  const numValue = Number(value);
  if (isNaN(numValue)) {
    return '0';
  }

  return String(numValue);
}

/**
 * Format a value for InfluxDB line protocol
 */
function formatValueForInfluxDB(value: any): string {
  if (value === null || value === undefined) {
    return '0'; // Default value for null/undefined
  }

  if (typeof value === 'string') {
    return `"${value}"`; // Strings need to be quoted
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (value instanceof Date) {
    return `"${value.toISOString()}"`;
  }

  if (Array.isArray(value)) {
    return `"array_${value.length}_items"`;
  }

  if (typeof value === 'object') {
    return '"object"'; // Generic placeholder for objects
  }

  // Default case - convert to string
  return `"${String(value)}"`;
}

/**
 * Helper function to update Firebase RTDB directly
 */
async function updateFirebaseDirectly(commandData: any) {
  // Get RTDB instance
  const getSecondaryDb = async () => {
    try {
      const { getDatabase } = await import("firebase/database");
      const { getApps } = await import("firebase/app");
      const firebaseApps = getApps();
      if (firebaseApps.length > 0) {
        return getDatabase(firebaseApps[0]);
      }
      return null;
    } catch (error) {
      logCommand("Error initializing Firebase RTDB:", 'error');
      return null;
    }
  };

  // Directly update Firebase RTDB
  const { ref, set } = await import("firebase/database");
  const rtdb = await getSecondaryDb();

  if (rtdb) {
    // Handle special case for equipment groups
    if (commandData.command && (
        commandData.command.includes('equipmentGroup') ||
        commandData.command.includes('boilerGroup') ||
        commandData.command.includes('pumpGroup'))) {

      // For group events, update the appropriate group document in Firestore
      try {
        const { getFirestore, doc, setDoc, updateDoc } = await import("firebase/firestore");
        const { getApps, initializeApp } = await import("firebase/app");

        // Get Firestore instance
        let firestore;
        if (getApps().length > 0) {
          firestore = getFirestore(getApps()[0]);
        } else {
          logCommand("No Firebase app initialized for Firestore", 'error');
          throw new Error("No Firebase app initialized");
        }

        // Determine the document path
        const groupId = commandData.groupId || commandData.equipmentId;
        const docRef = doc(firestore, "equipmentGroups", groupId);

        // Update or create the document
        if (commandData.eventType === 'changeover') {
          await updateDoc(docRef, {
            leadEquipmentId: commandData.leadEquipmentId,
            lastChangeoverTime: Date.now()
          });
        } else if (commandData.eventType === 'failover') {
          await updateDoc(docRef, {
            leadEquipmentId: commandData.leadEquipmentId,
            lastFailoverTime: Date.now(),
            failedEquipmentId: commandData.failedEquipmentId
          });
        } else {
          // For general updates, just set what we have
          const updateData = { ...commandData };
          delete updateData.command; // Remove the command field
          await setDoc(docRef, updateData, { merge: true });
        }

        logCommand(`Successfully updated equipment group document in Firestore: ${groupId}`);
        return true;
      } catch (firestoreError) {
        logCommand(`Error updating Firestore for equipment group: ${firestoreError}`, 'error');

        // Fall back to RTDB if Firestore fails
        const groupPath = `equipmentGroups/${commandData.groupId || commandData.equipmentId}`;
        const groupRef = ref(rtdb, groupPath);
        await set(groupRef, {
          ...commandData,
          lastUpdated: Date.now()
        });
        logCommand(`Successfully updated equipment group in RTDB as fallback: ${groupPath}`);
        return true;
      }
    }

    // For regular commands, update the control value
    // Determine the path based on command type
    const commandType = commandData.commandType || commandData.command?.replace('update_', '') || 'unknown';
    const path = `control_values/${commandData.locationId}/${commandData.equipmentId}/${commandType}`;

    logCommand(`Updating Firebase at path: ${path}`);

    const valueRef = ref(rtdb, path);
    await set(valueRef, commandData.value);
    logCommand(`Successfully updated ${commandType}=${JSON.stringify(commandData.value)} directly in Firebase RTDB`);
    return true;
  }

  throw new Error("Firebase RTDB not available");
}
