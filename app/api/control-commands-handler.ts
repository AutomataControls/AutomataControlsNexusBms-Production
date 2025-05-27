// app/api/control-commands-handler.ts
'use server'

import { logCommand } from '../../lib/logging/command-logger'; // Adjust path as needed

// Import shared Firebase Admin SDK instances
import {
   adminApp as adminAppInstance, // Renaming for consistency with how it was used locally
   firestoreAdmin as firestoreDbInstance,
   rtdbAdmin as realtimeDbInstance,
   adminSdk // Import the admin namespace itself if needed for things like FieldValue
} from '../../lib/firebase-admin-init'; // Adjust path to your firebase-admin-init.ts

const dynamicConfig = 'force-dynamic';

const INFLUXDB_URL = process.env.INFLUXDB_URL || "http://localhost:8181";
const INFLUXDB_DATABASE = process.env.INFLUXDB_DATABASE || "Locations";
const INFLUXDB_DATABASE2 = process.env.INFLUXDB_DATABASE2 || "ControlCommands";

const EQUIPMENT_TYPE_MAPPINGS = {
 PUMP_PATTERNS: ['pump', 'hwpump', 'cwpump', 'hwp', 'cwp', 'pumps'],
 BOILER_PATTERNS: ['boiler', 'boilers', 'hot water gen', 'hwg', 'comfortboiler', 'comfort-boiler', 'domesticboiler', 'domestic-boiler'],
 FAN_COIL_PATTERNS: ['fan coil', 'fancoil', 'fcu', 'fan-coil', 'vav', 'fan coils', 'fancoils', 'fcus'],
 CHILLER_PATTERNS: ['chiller', 'chillers', 'cwg', 'cold water gen'],
 AHU_PATTERNS: ['ahu', 'ahus', 'air handler', 'air-handler', 'air handlers', 'air-handlers', 'rtu', 'rtus', 'rooftop', 'rooftops']
};

function formatInfluxValue(value: any): string {
 if (typeof value === 'string') {
   return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
 }
 if (typeof value === 'boolean') {
   return value ? 'true' : 'false';
 }
 if (typeof value === 'number') {
//   if (Number.isInteger(value)) return `${value}i`;
   return String(value);
 }
 if (value === null || value === undefined) {
   return 'null';
 }
 if (typeof value === 'object') {
   return `"object_data_type"`;
 }
 return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export async function handleControlCommand(commandData: any) {
 const handlerStartTime = Date.now();
 try {
   // Check if shared Firebase Admin instances are available
   if (!adminAppInstance || !firestoreDbInstance || !realtimeDbInstance) {
       logCommand('Firebase Admin SDK instances not available from shared init module. Critical failure.', 'error', commandData);
       // The init module should have logged detailed errors if this happens.
       return { success: false, error: "Internal Server Error: Firebase Admin services not ready." };
   }

   if (!commandData || !commandData.equipmentId || !commandData.command) {
     logCommand('Invalid command data: missing equipmentId or command', 'error', commandData);
     return { success: false, error: "Invalid command data: missing equipmentId or command" };
   }

   logCommand(`Processing command: ${commandData.command} for ${commandData.equipmentId}`, 'info', { equipmentId: commandData.equipmentId, command: commandData.command, type: commandData.commandType });

   if (commandData.command.toLowerCase().includes('group') || commandData.commandType?.toLowerCase().includes('group')) {
     logCommand(`Handling as equipment group command: ${commandData.command}`, 'info', commandData);
     const groupProtocol = generateEquipmentGroupProtocol(commandData);
     let influxSuccess = false;
     let influxError;

     if (groupProtocol) {
       const groupInfluxResponse = await sendToInfluxDB(groupProtocol);
       influxSuccess = groupInfluxResponse.success;
       influxError = groupInfluxResponse.error;
       if (!influxSuccess) {
           logCommand(`InfluxDB write for group command ${commandData.command} failed: ${influxError}`, 'warn', commandData);
       }
     } else {
       logCommand(`Could not generate Influx protocol for group command: ${commandData.command}.`, 'warn', commandData);
     }

     try {
       // Pass the imported admin instances
       await updateFirebaseDirectly(commandData, firestoreDbInstance, realtimeDbInstance);
       logCommand(`Group command ${commandData.command} processed in Firebase.`, 'info', commandData);
       const duration = Date.now() - handlerStartTime;
       return { success: true, command: commandData.command, equipmentId: commandData.equipmentId, influxSuccess, influxError, note: "Group command processed.", durationMs: duration };
     } catch (fbError: any) {
       logCommand(`Firebase update for group command ${commandData.command} failed: ${fbError.message}`, 'error', commandData);
       const duration = Date.now() - handlerStartTime;
       return { success: false, error: `Firebase group update failed: ${fbError.message}`, influxSuccess, influxError, durationMs: duration };
     }
   }

   if (commandData.command === 'update_stateStorage' || commandData.commandType === 'stateStorage') {
     logCommand(`Skipping InfluxDB for stateStorage command: ${commandData.command}`, 'info', {equipmentId: commandData.equipmentId});
     try {
       await updateFirebaseDirectly(commandData, firestoreDbInstance, realtimeDbInstance);
       const duration = Date.now() - handlerStartTime;
       return { success: true, note: "stateStorage updated in Firebase", command: commandData.command, equipmentId: commandData.equipmentId, durationMs: duration };
     } catch (fbError: any) {
       logCommand(`Firebase update for stateStorage failed: ${fbError.message}`, 'error', commandData);
       const duration = Date.now() - handlerStartTime;
       return { success: false, error: `Firebase stateStorage update failed: ${fbError.message}`, durationMs: duration };
     }
   }

   const equipmentType = determineEquipmentType(commandData);
   const commonTags = `equipment_id=${commandData.equipmentId},location_id=${commandData.locationId || "unknown"},command_type=${commandData.commandType || commandData.command.replace('update_', '')},equipment_type=${equipmentType},source=${commandData.source || "server_logic"},status=${commandData.status || "completed"}`;
   let lineProtocol;

   switch (equipmentType) {
     case 'pump': lineProtocol = generatePumpProtocol(commandData, commonTags); break;
     case 'boiler': lineProtocol = generateBoilerProtocol(commandData, commonTags); break;
     case 'fancoil': lineProtocol = generateFanCoilProtocol(commandData, commonTags); break;
     case 'chiller': lineProtocol = generateChillerProtocol(commandData, commonTags); break;
     case 'ahu': lineProtocol = generateAHUProtocol(commandData, commonTags); break;
     default: lineProtocol = generateGenericProtocol(commandData, commonTags);
   }

   if (!lineProtocol) {
     logCommand(`No valid Influx line protocol for ${commandData.command}, attempting Firebase only.`, 'warn', commandData);
     await updateFirebaseDirectly(commandData, firestoreDbInstance, realtimeDbInstance);
     const duration = Date.now() - handlerStartTime;
     return { success: true, note: "Command processed via Firebase (no Influx protocol)", command: commandData.command, equipmentId: commandData.equipmentId, durationMs: duration };
   }

   const result = await sendToInfluxDB(lineProtocol);

   if (!result.success) {
     logCommand(`InfluxDB write failed for ${commandData.command}, attempting Firebase fallback. Error: ${result.error}`, 'warn', commandData);
     await updateFirebaseDirectly(commandData, firestoreDbInstance, realtimeDbInstance);
     const duration = Date.now() - handlerStartTime;
     return { success: true, note: "Command processed via Firebase after InfluxDB error", command: commandData.command, equipmentId: commandData.equipmentId, durationMs: duration };
   }

   const duration = Date.now() - handlerStartTime;
   return { success: true, command: commandData.command, equipmentId: commandData.equipmentId, influxResult: result, durationMs: duration };

 } catch (error: any) {
   const duration = Date.now() - handlerStartTime;
   logCommand(`Unhandled error in handleControlCommand: ${error.message}`, 'error', { error: error.toString(), stack: error.stack, commandData });
   try {
       if (firestoreDbInstance && realtimeDbInstance) {
           await updateFirebaseDirectly(commandData, firestoreDbInstance, realtimeDbInstance);
           return { success: true, note: "Command processed via Firebase after unhandled error", command: commandData.command, equipmentId: commandData.equipmentId, durationMs: duration };
       } else {
           return { success: false, error: `Processing Error: ${error.message}. Firebase Admin SDK instances not available for fallback.`, durationMs: duration};
       }
   } catch (fbError: any) {
       logCommand(`Firebase fallback also failed after unhandled error: ${fbError.message}`, 'error', commandData);
       return { success: false, error: `Processing Error: ${error.message}. Firebase Fallback Error: ${fbError.message}`, durationMs: duration};
   }
 }
}
(handleControlCommand as any).dynamic = dynamicConfig;

async function sendToInfluxDB(lineProtocol: string): Promise<{ success: boolean, error?: string, details?: any[] }> {
 if (!lineProtocol || lineProtocol.trim() === '') {
   logCommand('sendToInfluxDB: Called with empty line protocol.', 'warn');
   return { success: false, error: 'Empty line protocol provided' };
 }
 // logCommand(`sendToInfluxDB: Protocol to send: ${lineProtocol}`, 'info');

 const results = [];
 const databasesToWrite = [
   { name: INFLUXDB_DATABASE, label: "Locations" },
   { name: INFLUXDB_DATABASE2, label: "ControlCommands" }
 ];

 const writePromises = databasesToWrite.map(dbInfo => {
   if (!dbInfo.name) {
     logCommand(`sendToInfluxDB: Skipping write for undefined database name (label: ${dbInfo.label})`, 'warn');
     return Promise.resolve({ database: dbInfo.label, success: false, error: "Database name undefined" });
   }
   return writeToDatabase(lineProtocol, dbInfo.name, INFLUXDB_URL)
     .then(result => ({ database: dbInfo.label, ...result }))
     .catch(dbError => {
       logCommand(`sendToInfluxDB: Exception during writeToDatabase call for ${dbInfo.label}: ${dbError.message}`, 'error');
       return { database: dbInfo.label, success: false, error: dbError.message };
     });
 });

 const settledResults = await Promise.all(writePromises);
 results.push(...settledResults);

 const overallSuccess = results.some(r => r.success);
 let errorMessageCombined = overallSuccess ? undefined : results.filter(r => !r.success).map(r => `${r.database}: ${r.error || 'Unknown error'}`).join('; ');

 if (!overallSuccess && results.length > 0) {
     logCommand('sendToInfluxDB: Write failed to all/some target databases.', 'error', { results });
 } else if (results.some(r => !r.success && r.error !== "Database name undefined")) {
     logCommand('sendToInfluxDB: Write had partial success (some failures).', 'warn', { results });
 }

 return { success: overallSuccess, error: errorMessageCombined, details: results };
}

async function writeToDatabase(lineProtocol: string, database: string, baseUrl: string): Promise<{ success: boolean, error?: string }> {
 try {
   const writeUrl = `${baseUrl}/api/v3/write_lp?db=${database}&precision=nanosecond`;
   
   // Use fetch instead of curl for better performance and connection pooling
   const response = await fetch(writeUrl, {
     method: 'POST',
     headers: {
       'Content-Type': 'text/plain',
     },
     body: lineProtocol,
     signal: AbortSignal.timeout(5000) // 5 second timeout
   });

   if (!response.ok) {
     const errorText = await response.text();
     logCommand(`writeToDatabase: HTTP error ${response.status} for ${database} DB: ${errorText}`, 'error');
     return { success: false, error: `HTTP ${response.status}: ${errorText}` };
   }

   return { success: true };
 } catch (error: any) {
   if (error.name === 'AbortError') {
     logCommand(`writeToDatabase: Timeout for ${database} DB`, 'error');
     return { success: false, error: 'Request timeout' };
   }
   logCommand(`writeToDatabase: Exception for ${database} DB: ${error.message}`, 'error');
   return { success: false, error: error.message };
 }
}

function generateEquipmentGroupProtocol(commandData: any): string {
 const commandName = commandData.command || 'unknown_group_command';
 const commandType = commandData.commandType || commandName.replace('update_', '');
 const groupId = commandData.groupId || commandData.equipmentId || 'unknownGroup';
 const equipmentIdTag = commandData.equipmentId || groupId;

 let protocol = `${commandName},equipment_id=${equipmentIdTag},location_id=${commandData.locationId || "unknown"},command_type=${commandType},group_id=${groupId},source=${commandData.source || "server_logic"},status=${commandData.status || "completed"} `;
 const eventType = commandData.eventType || 'update';
 let fields = `event_type="${eventType}"`;

 if (commandData.leadEquipmentId) fields += `,lead_equipment_id="${commandData.leadEquipmentId}"`;
 if (commandData.previousLeadEquipmentId) fields += `,previous_lead_id="${commandData.previousLeadEquipmentId}"`;
 if (commandData.failedEquipmentId) fields += `,failed_equipment_id="${commandData.failedEquipmentId}"`;
 if (typeof commandData.groupSize === 'number') fields += `,group_size=${formatInfluxValue(commandData.groupSize)}`;
 if (commandData.value !== undefined) fields += `,value=${formatInfluxValue(commandData.value)}`;
 if (commandData.details) fields += `,details=${formatInfluxValue(commandData.details)}`;

 return protocol + fields.trim();
}

function determineEquipmentType(commandData: any): string {
 const sourcesToTest = [
   commandData.system, commandData.equipmentId, commandData.command, commandData.equipmentType
 ].map(s => String(s || '').toLowerCase());

 for (const pattern of EQUIPMENT_TYPE_MAPPINGS.PUMP_PATTERNS) if (sourcesToTest.some(s => s.includes(pattern))) return 'pump';
 for (const pattern of EQUIPMENT_TYPE_MAPPINGS.BOILER_PATTERNS) if (sourcesToTest.some(s => s.includes(pattern))) return 'boiler';
 for (const pattern of EQUIPMENT_TYPE_MAPPINGS.FAN_COIL_PATTERNS) if (sourcesToTest.some(s => s.includes(pattern))) return 'fancoil';
 for (const pattern of EQUIPMENT_TYPE_MAPPINGS.CHILLER_PATTERNS) if (sourcesToTest.some(s => s.includes(pattern))) return 'chiller';
 for (const pattern of EQUIPMENT_TYPE_MAPPINGS.AHU_PATTERNS) if (sourcesToTest.some(s => s.includes(pattern))) return 'ahu';
 return commandData.equipmentType?.toLowerCase() || 'generic';
}

function generatePumpProtocol(commandData: any, commonTags: string): string {
 const command = commandData.command; const value = commandData.value;
 let fieldKey = 'value'; let fieldValue = formatInfluxValue(value);
 if (command.toLowerCase().endsWith('enable') || command.toLowerCase().endsWith('enabled') || command.toLowerCase().includes('status')) {
   fieldKey = 'status'; fieldValue = formatInfluxValue(typeof value === 'boolean' ? value : String(value).toLowerCase() === 'true');
 }
 return `${command},${commonTags} ${fieldKey}=${fieldValue}`;
}

function generateBoilerProtocol(commandData: any, commonTags: string): string {
 const command = commandData.command; const value = commandData.value;
 let fieldKey = 'value'; let fieldValue = formatInfluxValue(value);
 const lowerCommand = command.toLowerCase(); const lowerCommandType = commandData.commandType?.toLowerCase();
 if (lowerCommand.includes('firing') || lowerCommand.includes('isfiring') || lowerCommandType?.includes('firing')) {
   fieldKey = 'firing'; fieldValue = formatInfluxValue(typeof value === 'boolean' ? value : (parseInt(String(value)) === 1 || String(value).toLowerCase() === 'true'));
 } else if (lowerCommand.endsWith('enable') || lowerCommand.endsWith('enabled') || lowerCommand.includes('status')) {
   fieldKey = 'status'; fieldValue = formatInfluxValue(typeof value === 'boolean' ? value : String(value).toLowerCase() === 'true');
 }
 return `${command},${commonTags} ${fieldKey}=${fieldValue}`;
}

function generateFanCoilProtocol(commandData: any, commonTags: string): string {
 const command = commandData.command; const value = commandData.value;
 let fieldKey = 'value'; let fieldValue = formatInfluxValue(value);
 const lowerCommand = command.toLowerCase(); const lowerCommandType = commandData.commandType?.toLowerCase();
 if (lowerCommand.includes('freezestat') || lowerCommandType?.includes('freezestat')) {
   fieldKey = 'freezestat'; fieldValue = formatInfluxValue(typeof value === 'boolean' ? value : String(value).toLowerCase() === 'true');
 } else if (lowerCommand.endsWith('enable') || lowerCommand.endsWith('enabled') || lowerCommand.includes('status')) {
   fieldKey = 'status'; fieldValue = formatInfluxValue(typeof value === 'boolean' ? value : String(value).toLowerCase() === 'true');
 } else if (lowerCommand.includes('fanspeed')) fieldKey = 'fan_speed';
 else if (lowerCommand.includes('valveposition')) {
   if (lowerCommand.includes('cooling')) fieldKey = 'cooling_valve_position';
   else if (lowerCommand.includes('heating')) fieldKey = 'heating_valve_position';
   else fieldKey = 'valve_position';
 } else if (lowerCommand.includes('damperposition')) fieldKey = 'damper_position';
 return `${command},${commonTags} ${fieldKey}=${fieldValue}`;
}

function generateChillerProtocol(commandData: any, commonTags: string): string {
 const command = commandData.command; const value = commandData.value;
 let fieldKey = 'value'; let fieldValue = formatInfluxValue(value);
 if (command.toLowerCase().endsWith('enable') || command.toLowerCase().endsWith('enabled') || command.toLowerCase().includes('status')) {
   fieldKey = 'status'; fieldValue = formatInfluxValue(typeof value === 'boolean' ? value : String(value).toLowerCase() === 'true');
 }
 return `${command},${commonTags} ${fieldKey}=${fieldValue}`;
}

function generateAHUProtocol(commandData: any, commonTags: string): string {
 const command = commandData.command; const value = commandData.value;
 let fieldKey = 'value'; let fieldValue = formatInfluxValue(value);
 const lowerCommand = command.toLowerCase(); const lowerCommandType = commandData.commandType?.toLowerCase();
 if (lowerCommand.includes('freezestat') || lowerCommandType?.includes('freezestat')) {
   fieldKey = 'freezestat'; fieldValue = formatInfluxValue(typeof value === 'boolean' ? value : String(value).toLowerCase() === 'true');
 } else if (lowerCommand.endsWith('enable') || lowerCommand.endsWith('enabled') || lowerCommand.includes('status')) {
   fieldKey = 'status'; fieldValue = formatInfluxValue(typeof value === 'boolean' ? value : String(value).toLowerCase() === 'true');
 } else if (lowerCommand.includes('damperposition')) {
    if (lowerCommand.includes('outdoor')) fieldKey = 'outdoor_damper_position';
    else if (lowerCommand.includes('return')) fieldKey = 'return_damper_position';
    else fieldKey = 'damper_position';
 } else if (lowerCommand.includes('valveposition')) {
   if (lowerCommand.includes('cooling')) fieldKey = 'cooling_valve_position';
   else if (lowerCommand.includes('heating')) fieldKey = 'heating_valve_position';
   else fieldKey = 'valve_position';
 } else if (lowerCommand.includes('fanspeed')) fieldKey = 'fan_speed';
 return `${command},${commonTags} ${fieldKey}=${fieldValue}`;
}

function generateGenericProtocol(commandData: any, commonTags: string): string {
 return `${commandData.command},${commonTags} value=${formatInfluxValue(commandData.value)}`;
}

async function updateFirebaseDirectly(
   commandData: any,
   fsAdmin: admin.firestore.Firestore,
   rtdbAdmin: admin.database.Database
) {
 // logCommand(`Firebase Direct Update (Admin): Cmd=${commandData.command}, EquipID=${commandData.equipmentId}`, 'info', commandData);
 try {
   if (commandData.command?.toLowerCase().includes('group') || commandData.commandType?.toLowerCase().includes('group')) {
     const groupId = commandData.groupId || commandData.equipmentId || 'unknown_group_fallback';
     const groupDocRef = fsAdmin.collection("equipmentGroups").doc(groupId);
     const updateData: any = { lastUpdated: adminSdk.firestore.FieldValue.serverTimestamp() }; // Use adminSdk for FieldValue

     if (commandData.eventType === 'changeover') {
       if(commandData.leadEquipmentId !== undefined) updateData.leadEquipmentId = commandData.leadEquipmentId;
       updateData.lastChangeoverTime = Date.now();
       if(commandData.previousLeadEquipmentId !== undefined) updateData.previousLeadEquipmentId = commandData.previousLeadEquipmentId;
     } else if (commandData.eventType === 'failover') {
       if(commandData.leadEquipmentId !== undefined) updateData.leadEquipmentId = commandData.leadEquipmentId;
       updateData.lastFailoverTime = Date.now();
       if(commandData.failedEquipmentId !== undefined) updateData.failedEquipmentId = commandData.failedEquipmentId;
     } else {
       if(commandData.leadEquipmentId !== undefined) updateData.leadEquipmentId = commandData.leadEquipmentId;
       if(typeof commandData.groupSize === 'number') updateData.groupSize = commandData.groupSize;
       if(commandData.details !== undefined) updateData.details = commandData.details;
       if(commandData.value !== undefined) updateData.value = commandData.value;
     }
     await groupDocRef.set(updateData, { merge: true });
     logCommand(`Firestore (Admin): Updated equipmentGroup ${groupId}`, 'info', {groupId, keysUpdated: Object.keys(updateData)});
     return;
   }

   const commandType = commandData.commandType || commandData.command?.replace('update_', '') || 'unknown_command_type';
   const firebasePath = `control_values/${commandData.locationId || 'unknown_location'}/${commandData.equipmentId}/${commandType}`;

   await rtdbAdmin.ref(firebasePath).set(commandData.value);
   // logCommand(`Firebase RTDB (Admin): Updated ${firebasePath} to ${JSON.stringify(commandData.value)}`, 'info');

 } catch (error: any) {
   logCommand(`Firebase direct update (Admin SDK) failed: ${error.message}`, 'error', { error: error.toString(), stack: error.stack, commandData });
   throw error;
 }
}
