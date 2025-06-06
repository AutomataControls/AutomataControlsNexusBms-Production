// @ts-nocheck
// lib/lead-lag-manager.ts
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';
import Redis from 'ioredis';

// Corrected logging function
function logLeadLag(message: string, level: 'info' | 'warn' | 'error' = 'info', data?: any) {
  const prefix = `[LEAD-LAG][${level.toUpperCase()}]`;
  // Combine message and data into a single string for console methods
  const logMessage = data ? `${prefix} ${message} ${typeof data === 'object' ? JSON.stringify(data).substring(0, 500) : data}` : `${prefix} ${message}`;

  switch (level) {
    case 'info':
      console.log(logMessage);
      break;
    case 'warn':
      console.warn(logMessage);
      break;
    case 'error':
      console.error(logMessage);
      break;
    default:
      console.log(logMessage); // Fallback to console.log for unknown levels
  }
}

const exec = promisify(execCallback);

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);

logLeadLag(`Initializing Redis client for ${redisHost}:${redisPort}`);
const redis = new Redis({
  host: redisHost,
  port: redisPort,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    logLeadLag(`Redis retrying connection (attempt ${times}, delay ${delay}ms)`, 'warn');
    return delay;
  },
  reconnectOnError: (err) => {
    logLeadLag(`Redis connection error: ${err.message}. Attempting to reconnect.`, 'error');
    return true;
  }
});

redis.on('connect', () => logLeadLag('Redis client connected.'));
redis.on('error', (err) => logLeadLag(`Redis client error: ${err.message}`, 'error'));

const GROUP_CACHE_TTL = 5 * 60; // 5 minutes
const EQUIPMENT_STATUS_CACHE_TTL = 30; // 30 seconds
const LEAD_LAG_STATUS_CACHE_TTL = 1 * 60; // 1 minute

const INFLUXDB_URL = process.env.INFLUXDB_URL || "http://localhost:8181";
const INFLUXDB_DATABASE = process.env.INFLUXDB_DATABASE || "Locations";
const INFLUXDB_EVENTS_DATABASE = process.env.INFLUXDB_DATABASE2 || "ControlCommands";

// --- Self-Contained Firebase Admin SDK Initialization ---
let admin: any = null;
let firestore: any = null;
let firebaseAdminInitialized = false;

function initializeFirebaseAdminSdk() {
  if (firebaseAdminInitialized) {
    logLeadLag('Firebase Admin SDK already initialized.');
    return;
  }
  logLeadLag('Attempting to initialize Firebase Admin SDK...');
  try {
    admin = require('firebase-admin');
    if (admin.apps.length > 0) {
        logLeadLag('Firebase Admin SDK: Default app already exists.');
        firestore = admin.firestore();
        firebaseAdminInitialized = true;
        logLeadLag('Firebase Admin SDK initialized using existing default app.');
        return;
    }
    const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
    const databaseURLEnv = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
    const projectIdEnv = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (serviceAccountEnv) {
      logLeadLag('Service account environment variable found.');
      try {
        const serviceAccount = JSON.parse(serviceAccountEnv);
        if (serviceAccount.private_key) {
          serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
          logLeadLag('Private key format corrected.');
        }
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount), databaseURL: databaseURLEnv });
        logLeadLag('Firebase Admin SDK initialized with service account.');
      } catch (parseError: any) {
        logLeadLag(`Error parsing service account JSON: ${parseError.message}. Falling back.`, 'error', parseError);
        if (projectIdEnv) {
            admin.initializeApp({ projectId: projectIdEnv, databaseURL: databaseURLEnv });
            logLeadLag('Firebase Admin SDK initialized with basic config (Project ID) after SA parse error.');
        } else {
            logLeadLag('Cannot initialize Firebase Admin: No Project ID for fallback after SA parse error.', 'error');
            return;
        }
      }
    } else if (projectIdEnv) {
      logLeadLag('No service account env var. Initializing with basic config (Project ID).');
      admin.initializeApp({ projectId: projectIdEnv, databaseURL: databaseURLEnv });
      logLeadLag('Firebase Admin SDK initialized with basic config (Project ID).');
    } else {
      logLeadLag('Cannot initialize Firebase Admin SDK: No service account or Project ID found in env variables.', 'error');
      return;
    }
    firestore = admin.firestore();
    firebaseAdminInitialized = true;
    logLeadLag('Firebase Admin SDK initialization complete. Firestore instance obtained.');
  } catch (error: any) {
    logLeadLag(`CRITICAL: Error initializing Firebase Admin SDK: ${error.message}`, 'error', error);
    firebaseAdminInitialized = false;
  }
}
initializeFirebaseAdminSdk();
// --- End of Self-Contained Firebase Admin SDK Initialization ---

interface EquipmentGroup {
  id: string; name: string; type: string; locationId: string; equipmentIds: string[];
  leadEquipmentId: string; rotationEnabled: boolean; rotationIntervalHours: number;
  lastRotationTimestamp: number; failoverEnabled: boolean;
}
interface EquipmentStatus {
  equipmentId: string; isHealthy: boolean; lastUpdated: number;
}

function isFirebaseReady(): boolean {
    if (firebaseAdminInitialized && firestore) return true;
    logLeadLag('Firebase Admin SDK (self-initialized) NOT READY.', 'warn', { initialized: firebaseAdminInitialized, firestoreInstanceExists: !!firestore });
    return false;
}

export async function checkAndHandleFailovers() {
  logLeadLag("Checking for equipment failures and handling failovers...");
  if (!isFirebaseReady()) {
    logLeadLag("Aborting checkAndHandleFailovers: Firebase Admin not ready.", 'error');
    return { success: false, error: "Firebase Admin not ready" };
  }
  try {
    const groups = await getEquipmentGroups();
    if (!groups || groups.length === 0) {
      logLeadLag("No equipment groups found for failover check.");
      return { success: true, message: "No equipment groups found" };
    }
    let failoversPerformed = 0;
    for (const group of groups) {
      if (!group.failoverEnabled) continue;
      if (!group.leadEquipmentId) {
        logLeadLag(`Group ${group.name} (${group.id}) has failover enabled but no leadEquipmentId. Skipping.`, 'warn');
        continue;
      }
      const leadStatus = await getEquipmentStatus(group.leadEquipmentId);
      if (!leadStatus.isHealthy) {
        logLeadLag(`Lead equipment ${group.leadEquipmentId} in group ${group.name} is unhealthy.`, 'warn');
        let newLeadId = null;
        if (Array.isArray(group.equipmentIds) && group.equipmentIds.length > 0) {
            for (const equipId of group.equipmentIds) {
              if (equipId !== group.leadEquipmentId) {
                const status = await getEquipmentStatus(equipId);
                if (status.isHealthy) { newLeadId = equipId; break; }
              }
            }
        } else {
            logLeadLag(`Group ${group.name} (${group.id}) has no equipment IDs for failover.`, 'warn');
        }
        if (newLeadId) {
          await updateLeadEquipment(group.id, newLeadId, "failover");
          logLeadLag(`Performed failover: Promoted ${newLeadId} to lead in group ${group.name}.`);
          failoversPerformed++;
        } else {
          logLeadLag(`No healthy lag equipment for failover in group ${group.name}.`, 'warn');
        }
      }
    }
    logLeadLag(`Failover check completed. Performed ${failoversPerformed} failovers.`);
    return { success: true, failoversPerformed };
  } catch (error: any) {
    logLeadLag(`Error in checkAndHandleFailovers: ${error.message}`, 'error', { stack: error.stack });
    return { success: false, error: String(error.message) };
  }
}

export async function performScheduledChangeovers() {
  logLeadLag("Checking for scheduled lead/lag changeovers...");
  if (!isFirebaseReady()) {
    logLeadLag("Aborting performScheduledChangeovers: Firebase Admin not ready.", 'error');
    return { success: false, error: "Firebase Admin not ready" };
  }
  try {
    const groups = await getEquipmentGroups();
    if (!groups || groups.length === 0) {
      logLeadLag("No equipment groups found for scheduled changeovers.");
      return { success: true, message: "No equipment groups found" };
    }
    const now = Date.now();
    let changeoversPerformed = 0;
    for (const group of groups) {
      if (!group.rotationEnabled || !Array.isArray(group.equipmentIds) || group.equipmentIds.length < 2) continue;
      const lastRotation = group.lastRotationTimestamp || 0;
      const intervalMs = (group.rotationIntervalHours || 168) * 3600 * 1000;
      const nextRotationTime = lastRotation + intervalMs;
      if (now >= nextRotationTime) {
        logLeadLag(`Rotation interval passed for group ${group.name}. Last: ${new Date(lastRotation).toISOString()}, Next: ${new Date(nextRotationTime).toISOString()}`);
        let currentLeadIndex = group.equipmentIds.indexOf(group.leadEquipmentId);
        if (currentLeadIndex === -1 || !group.leadEquipmentId) {
          logLeadLag(`Current lead ${group.leadEquipmentId || '(none)'} not in group ${group.name} or undefined. Setting first as lead.`, 'warn');
          currentLeadIndex = -1;
        }
        const nextLeadIndex = (currentLeadIndex + 1) % group.equipmentIds.length;
        const nextLeadEquipmentId = group.equipmentIds[nextLeadIndex];
        if (nextLeadEquipmentId && nextLeadEquipmentId !== group.leadEquipmentId) {
            await updateLeadEquipment(group.id, nextLeadEquipmentId, "rotation");
            logLeadLag(`Performed rotation: ${group.leadEquipmentId || 'PreviousN/A'} -> ${nextLeadEquipmentId} in group ${group.name}.`);
            changeoversPerformed++;
        } else if (nextLeadEquipmentId && nextLeadEquipmentId === group.leadEquipmentId) {
            logLeadLag(`Rotation for group ${group.name} resulted in same lead. Updating timestamp.`, 'info');
            await updateLeadEquipment(group.id, group.leadEquipmentId, "rotation");
        } else {
            logLeadLag(`Could not determine next lead for rotation in group ${group.name}. ID: ${nextLeadEquipmentId}`, 'warn');
        }
      }
    }
    logLeadLag(`Scheduled changeovers completed. Performed ${changeoversPerformed} changeovers.`);
    return { success: true, changeoversPerformed };
  } catch (error: any) {
    logLeadLag(`Error in performScheduledChangeovers: ${error.message}`, 'error', { stack: error.stack });
    return { success: false, error: String(error.message) };
  }
}

export async function getLeadLagStatus(locationId: string, equipmentId: string): Promise<{isLead: boolean, shouldRun: boolean, reason: string, groupId: string | null, error?: string}> {
  const cacheKey = `lead-lag-status:${locationId}:${equipmentId}`;
  try {
    const cachedStatus = await redis.get(cacheKey);
    if (cachedStatus) return JSON.parse(cachedStatus);
    if (!isFirebaseReady()) {
        logLeadLag(`Firebase not ready in getLeadLagStatus for ${equipmentId}. Defaulting to run.`, 'warn');
        const defaultResult = { isLead: true, shouldRun: true, reason: "Error checking lead-lag (Firebase not ready) - defaulting to run", groupId: null };
        await redis.set(cacheKey, JSON.stringify(defaultResult), 'EX', LEAD_LAG_STATUS_CACHE_TTL);
        return defaultResult;
    }
    const groupsContainingEquipment = await findEquipmentGroups(equipmentId);
    let result;
    if (!groupsContainingEquipment || groupsContainingEquipment.length === 0) {
      result = { isLead: true, shouldRun: true, reason: "Equipment not in lead-lag group - running independently", groupId: null };
    } else {
      const group = groupsContainingEquipment[0];
      if (!Array.isArray(group.equipmentIds) || group.equipmentIds.length === 0) {
        result = { isLead: true, shouldRun: true, reason: "No equipment IDs found in its group - running independently", groupId: group.id };
      } else {
        const isCurrentLead = group.leadEquipmentId === equipmentId;
        result = isCurrentLead ?
          { isLead: true, shouldRun: true, reason: `Lead equipment in group ${group.id}`, groupId: group.id } :
          { isLead: false, shouldRun: false, reason: `Lag equipment in standby - group ${group.id}`, groupId: group.id };
      }
    }
    await redis.set(cacheKey, JSON.stringify(result), 'EX', LEAD_LAG_STATUS_CACHE_TTL);
    return result;
  } catch (error: any) {
    logLeadLag(`Error getting lead-lag status for ${equipmentId}: ${error.message}. Defaulting to run.`, 'error', { stack: error.stack });
    const errorResult = { isLead: true, shouldRun: true, reason: `Error checking lead-lag: ${error.message} - defaulting to run`, error: error.message, groupId: null };
    await redis.set(cacheKey, JSON.stringify(errorResult), 'EX', 15);
    return errorResult;
  }
}

async function getEquipmentGroups(): Promise<EquipmentGroup[]> {
  const cacheKey = 'equipment-groups:all';
  try {
    const cachedGroups = await redis.get(cacheKey);
    if (cachedGroups) return JSON.parse(cachedGroups);
    if (isFirebaseReady() && firestore) {
      logLeadLag("Fetching equipment groups from Firestore.");
      const groupsSnapshot = await firestore.collection('equipmentGroups').get();
      if (!groupsSnapshot.empty) {
        const groups: EquipmentGroup[] = groupsSnapshot.docs.map((doc: any) => {
          const data = doc.data();
          const equipmentIds = data.equipmentIds || data['equipmentIds '] || [];
          let leadEquipmentId = data.leadEquipmentId || data['leadEquipmentId '] || '';
          if (!leadEquipmentId && equipmentIds.length > 0) leadEquipmentId = equipmentIds[0];
          let lastRotation = data.lastRotationTimestamp || data.lastChangeoverTime || data['lastChangeoverTime '] || 0;
          if (lastRotation && typeof lastRotation === 'object' && lastRotation.seconds !== undefined && typeof lastRotation.toMillis === 'function') {
            lastRotation = lastRotation.toMillis();
          } else if (typeof lastRotation !== 'number') { lastRotation = 0; }
          let lastFailover = data.lastFailoverTime || data['lastFailoverTime '] || 0;
           if (lastFailover && typeof lastFailover === 'object' && lastFailover.seconds !== undefined && typeof lastFailover.toMillis === 'function') {
            lastFailover = lastFailover.toMillis();
          } else if (typeof lastFailover !== 'number') { lastFailover = 0; }
          return {
            id: doc.id, name: data.name || data['name '] || doc.id, type: data.type || data['type '] || 'unknown',
            locationId: data.locationId || data['locationId '] || '', equipmentIds, leadEquipmentId,
            rotationEnabled: data.rotationEnabled !== undefined ? data.rotationEnabled : (data.useLeadLag !== undefined ? data.useLeadLag : (data['useLeadLag '] !== undefined ? data['useLeadLag '] : true)),
            rotationIntervalHours: Number(data.rotationIntervalHours || data['rotationIntervalHours '] || data.changeoverIntervalDays * 24 || data['changeoverIntervalDays '] * 24 || 168),
            lastRotationTimestamp: Number(lastRotation),
            failoverEnabled: data.failoverEnabled !== undefined ? data.failoverEnabled : (data.autoFailover !== undefined ? data.autoFailover : (data['autoFailover '] !== undefined ? data['autoFailover '] : true)),
          };
        });
        logLeadLag(`Fetched ${groups.length} groups from Firestore.`);
        await redis.set(cacheKey, JSON.stringify(groups), 'EX', GROUP_CACHE_TTL);
        return groups;
      } else { logLeadLag('No equipment groups found in Firestore.'); }
    } else { logLeadLag('Firestore not available for getEquipmentGroups. Trying InfluxDB fallback.', 'warn'); }
    logLeadLag("Falling back to InfluxDB for equipment groups.");
    const influxGroups = await getEquipmentGroupsFromInfluxDB();
    if (influxGroups.length > 0) await redis.set(cacheKey, JSON.stringify(influxGroups), 'EX', GROUP_CACHE_TTL);
    return influxGroups;
  } catch (error: any) {
    logLeadLag(`Error fetching equipment groups: ${error.message}. Trying InfluxDB.`, 'error', { stack: error.stack });
    const influxGroups = await getEquipmentGroupsFromInfluxDB();
    if (influxGroups.length > 0) await redis.set(cacheKey, JSON.stringify(influxGroups), 'EX', GROUP_CACHE_TTL);
    return influxGroups;
  }
}

async function getEquipmentGroupsFromInfluxDB(): Promise<EquipmentGroup[]> {
  try {
    const sqlQuery = `SELECT "group_id", "name", "type", "location_id", "equipment_ids", "lead_equipment_id", "rotation_enabled", "rotation_interval_hours", "last_rotation_timestamp", "failover_enabled" FROM "equipment_groups" WHERE "time" > now() - INTERVAL '10 minute' ORDER BY "time" DESC LIMIT 20`;
    const payload = JSON.stringify({ q: sqlQuery, db: INFLUXDB_DATABASE });
    const escapedPayload = payload.replace(/'/g, "'\\''");
    const { stdout, stderr } = await exec(`curl -s -X POST "${INFLUXDB_URL}/api/v3/query_sql" -H "Content-Type: application/json" -d '${escapedPayload}'`);
    if (stderr && stderr.trim().length > 0) logLeadLag(`InfluxDB curl for groups stderr: ${stderr}`, 'warn');
    let data;
    try { data = JSON.parse(stdout); }
    catch (parseError: any) {
        logLeadLag(`Failed to parse InfluxDB response for groups. Stdout: ${stdout.substring(0,200)}`, 'error', {parseError, stdout});
        return [];
    }
    const groups: EquipmentGroup[] = [];
    if (Array.isArray(data) && data.length > 0) {
      for (const row of data) {
        if (row.group_id) {
          let equipmentIds: string[] = [];
          try {
            if (row.equipment_ids) {
              if (typeof row.equipment_ids === 'string') equipmentIds = JSON.parse(row.equipment_ids);
              else if (Array.isArray(row.equipment_ids)) equipmentIds = row.equipment_ids;
            }
          } catch (e: any) { logLeadLag(`Error parsing equipment_ids for Influx group ${row.group_id}: ${e.message}`, 'warn'); }
          groups.push({
            id: row.group_id, name: row.name || row.group_id, type: row.type || 'unknown',
            locationId: row.location_id || '', equipmentIds: equipmentIds,
            leadEquipmentId: row.lead_equipment_id || (equipmentIds.length > 0 ? equipmentIds[0] : ''),
            rotationEnabled: row.rotation_enabled === true || String(row.rotation_enabled).toLowerCase() === 'true',
            rotationIntervalHours: parseInt(row.rotation_interval_hours || '168', 10),
            lastRotationTimestamp: parseInt(row.last_rotation_timestamp || '0', 10),
            failoverEnabled: row.failover_enabled === true || String(row.failover_enabled).toLowerCase() === 'true'
          });
        }
      }
    }
    logLeadLag(`Retrieved ${groups.length} groups from InfluxDB.`);
    return groups;
  } catch (error: any) {
    logLeadLag(`Error fetching groups from InfluxDB: ${error.message}`, 'error', { stack: error.stack });
    return [];
  }
}

async function getEquipmentStatus(equipmentId: string): Promise<EquipmentStatus> {
  const cacheKey = `equipment-status:${equipmentId}`;
  try {
    const cachedStatus = await redis.get(cacheKey);
    if (cachedStatus) return JSON.parse(cachedStatus);
    const sqlQuery = `SELECT "time", "system", "Fan_Status", "HWP1_Status", "HWP2_Status", "Freezestat", "H20Supply" FROM "metrics" WHERE "equipmentId"='${equipmentId}' AND "time" > now() - INTERVAL '5 minutes' ORDER BY "time" DESC LIMIT 5`;
    let payload = JSON.stringify({ q: sqlQuery, db: INFLUXDB_DATABASE });
    let escapedPayload = payload.replace(/'/g, "'\\''");
    logLeadLag(`Checking InfluxDB status for equipment: ${equipmentId}`);
    const { stdout, stderr } = await exec(`curl -s -X POST "${INFLUXDB_URL}/api/v3/query_sql" -H "Content-Type: application/json" -d '${escapedPayload}'`);
    if (stderr && stderr.trim().length > 0) {
      logLeadLag(`InfluxDB curl stderr for status of ${equipmentId}: ${stderr}`, 'warn');
      const simpleQuery = `SELECT "time" FROM "metrics" WHERE "equipmentId"='${equipmentId}' AND "time" > now() - INTERVAL '5 minutes' LIMIT 1`;
      payload = JSON.stringify({ q: simpleQuery, db: INFLUXDB_DATABASE });
      escapedPayload = payload.replace(/'/g, "'\\''");
      const { stdout: altStdout, stderr: altStderr } = await exec(`curl -s -X POST "${INFLUXDB_URL}/api/v3/query_sql" -H "Content-Type: application/json" -d '${escapedPayload}'`);
      if (altStderr && altStderr.trim().length > 0) {
         logLeadLag(`Both InfluxDB status queries failed for ${equipmentId}. Primary: ${stderr}, Fallback: ${altStderr}`, 'error');
         throw new Error(`InfluxDB status queries failed for ${equipmentId}`);
      }
      let altData;
      try { altData = JSON.parse(altStdout); }
      catch (e:any) {
        logLeadLag(`InfluxDB non-JSON fallback status for ${equipmentId}: ${altStdout.substring(0,200)}`, 'error', {error: e.message});
        throw new Error(`InfluxDB non-JSON fallback status for ${equipmentId}`);
      }
      const isHealthy = Array.isArray(altData) && altData.length > 0 && altData[0].time;
      const status = { equipmentId, isHealthy, lastUpdated: Date.now() };
      await redis.set(cacheKey, JSON.stringify(status), 'EX', EQUIPMENT_STATUS_CACHE_TTL);
      return status;
    }
    let data;
    try { data = JSON.parse(stdout); }
    catch (e:any) {
      logLeadLag(`InfluxDB non-JSON status for ${equipmentId}: ${stdout.substring(0,200)}`, 'error', {error: e.message});
      throw new Error(`InfluxDB non-JSON status for ${equipmentId}`);
    }
    if (!Array.isArray(data) || data.length === 0) {
      const status = { equipmentId, isHealthy: true, lastUpdated: Date.now() };
      await redis.set(cacheKey, JSON.stringify(status), 'EX', EQUIPMENT_STATUS_CACHE_TTL);
      return status;
    }
    let isHealthy = true; let hasRecentData = false;
    const latestReading = data[0];
    if (latestReading && latestReading.time) {
      if (new Date(latestReading.time).getTime() > (Date.now() - (60 * 60 * 1000))) hasRecentData = true;
    }
    if (latestReading) {
      if (["Fault", "Off"].includes(latestReading.Fan_Status) ||
          ["Fault"].includes(latestReading.HWP1_Status) || ["Fault"].includes(latestReading.HWP2_Status) ||
          [true, "true", 1, "1"].includes(latestReading.Freezestat)) isHealthy = false;
      if (String(latestReading.system).toLowerCase().includes('boiler') && latestReading.H20Supply !== undefined && latestReading.H20Supply < 32) isHealthy = false;
    }
    if (!hasRecentData) { isHealthy = false; logLeadLag(`Equipment ${equipmentId} has no recent data. Marking unhealthy.`, 'warn'); }
    const finalStatus = { equipmentId, isHealthy, lastUpdated: Date.now() };
    logLeadLag(`Status for ${equipmentId}: Healthy=${finalStatus.isHealthy}, RecentData=${hasRecentData}, Details: ${JSON.stringify(latestReading).substring(0,200)}`);
    await redis.set(cacheKey, JSON.stringify(finalStatus), 'EX', EQUIPMENT_STATUS_CACHE_TTL);
    return finalStatus;
  } catch (error: any) {
    logLeadLag(`Error getting status for ${equipmentId}: ${error.message}. Defaulting to healthy.`, 'error', { stack: error.stack });
    return { equipmentId, isHealthy: true, lastUpdated: Date.now() };
  }
}

async function updateLeadEquipment(groupId: string, newLeadId: string, reason: "failover" | "rotation") {
  logLeadLag(`Updating lead for group ${groupId} to ${newLeadId}, reason: ${reason}`);
  if (!isFirebaseReady() || !firestore) {
    logLeadLag(`Aborting updateLeadEquipment for ${groupId}: Firebase Admin (Firestore) not ready.`, 'error');
    throw new Error("Firebase Admin (Firestore) not ready.");
  }
  try {
    const now = Date.now();
    const docRef = firestore.collection('equipmentGroups').doc(groupId);
    const firestoreUpdates:any = {};
    const docSnapshot = await docRef.get();
    let leadIdField = 'leadEquipmentId';
    let lastChangeoverField = 'lastRotationTimestamp';
    let lastFailoverField = 'lastFailoverTime';
    if (docSnapshot.exists) {
        const data = docSnapshot.data() || {};
        leadIdField = Object.keys(data).find(k => k.trim().toLowerCase() === 'leadequipmentid') || 'leadEquipmentId';
        lastChangeoverField = Object.keys(data).find(k => k.trim().toLowerCase() === 'lastrotationtimestamp' || k.trim().toLowerCase() === 'lastchangeovertime') || 'lastRotationTimestamp';
        lastFailoverField = Object.keys(data).find(k => k.trim().toLowerCase() === 'lastfailovertime') || 'lastFailoverTime';
    } else { logLeadLag(`Group doc ${groupId} not found. Update will create it.`, 'warn'); }
    firestoreUpdates[leadIdField] = newLeadId;
    if (admin && admin.firestore && admin.firestore.FieldValue) {
        if (reason === "failover") firestoreUpdates[lastFailoverField] = admin.firestore.FieldValue.serverTimestamp();
        else if (reason === "rotation") firestoreUpdates[lastChangeoverField] = admin.firestore.FieldValue.serverTimestamp();
    } else {
        logLeadLag('admin.firestore.FieldValue unavailable, using client-side timestamp for update.', 'warn');
        if (reason === "failover") firestoreUpdates[lastFailoverField] = now;
        else if (reason === "rotation") firestoreUpdates[lastChangeoverField] = now;
    }
    await docRef.set(firestoreUpdates, { merge: true });
    logLeadLag(`Firestore updated for group ${groupId}. New lead: ${newLeadId}.`);
    const lineProtocol = `equipment_group_events,group_id=${groupId},event_type=${reason} lead_equipment_id="${newLeadId}",timestamp_ms=${now}i,reason="${reason}"`;
    const escapedLineProtocol = lineProtocol.replace(/"/g, '\\"').replace(/'/g, "'\\''");
    const { stderr: influxErr } = await exec(`curl -s -X POST "${INFLUXDB_URL}/api/v3/write_lp?db=${INFLUXDB_EVENTS_DATABASE}&precision=ms" -H "Content-Type: text/plain" -d "${escapedLineProtocol}"`);
    if (influxErr && influxErr.trim().length > 0) {
      logLeadLag(`InfluxDB write warning for lead event (group ${groupId}): ${influxErr}`, 'warn');
    }
    logLeadLag(`Invalidating Redis caches after lead update for group ${groupId}.`);
    await redis.del('equipment-groups:all');
    const updatedGroupSnapshot = await docRef.get();
    if (updatedGroupSnapshot.exists) {
        const groupData = updatedGroupSnapshot.data();
        if (groupData) {
            const currentEquipmentIds = groupData.equipmentIds || groupData['equipmentIds '] || [];
            const currentLocationId = groupData.locationId || groupData['locationId '];
            if (Array.isArray(currentEquipmentIds)) {
                for (const equipId of currentEquipmentIds) {
                    await redis.del(`equipment-group-mapping:${equipId}`);
                    if (currentLocationId) await redis.del(`lead-lag-status:${currentLocationId}:${equipId}`);
                    else await redis.del(`lead-lag-status::${equipId}`);
                    await redis.del(`equipment-status:${equipId}`);
                }
            }
        }
    }
    return true;
  } catch (error: any) {
    logLeadLag(`Error updating lead equipment for group ${groupId}: ${error.message}`, 'error', { stack: error.stack });
    throw error;
  }
}

export async function findEquipmentGroups(equipmentId: string): Promise<({ id: string; leadEquipmentId: string; isLead: boolean; equipmentIds: string[]; locationId?: string; }[]) | null> {
  const cacheKey = `equipment-group-mapping:${equipmentId}`;
  try {
    const cachedMapping = await redis.get(cacheKey);
    if (cachedMapping) {
      logLeadLag(`Cache HIT for equipment-group-mapping:${equipmentId}`);
      return JSON.parse(cachedMapping);
    }
    logLeadLag(`Cache MISS for equipment-group-mapping:${equipmentId}`);

    logLeadLag(`[FIND_GROUPS for ${equipmentId}] Checking Firebase readiness.`);
    if (!isFirebaseReady() || !firestore) {
      logLeadLag(`[FIND_GROUPS for ${equipmentId}] Firebase NOT READY or firestore is null/undefined. Initialized: ${firebaseAdminInitialized}, Firestore instance: ${!!firestore}. Returning null.`, 'error');
      return null;
    }
    logLeadLag(`[FIND_GROUPS for ${equipmentId}] Firebase IS READY. Proceeding with Firestore query.`);

    // Added detailed logging for the equipmentId being queried
    logLeadLag(`[FIND_GROUPS for ${equipmentId}] Using equipmentId for 'array-contains' query (length ${equipmentId.length}): '${equipmentId}'`);

    const groupsSnapshot = await firestore.collection('equipmentGroups').where('equipmentIds', 'array-contains', equipmentId).get();
    logLeadLag(`[FIND_GROUPS for ${equipmentId}] Firestore query executed. Snapshot empty: ${groupsSnapshot.empty}, Size: ${groupsSnapshot.size}`);

    if (groupsSnapshot.empty) {
      logLeadLag(`[FIND_GROUPS for ${equipmentId}] No groups found containing this ID via array-contains.`);
      await redis.set(cacheKey, JSON.stringify(null), 'EX', GROUP_CACHE_TTL); // Cache the null result
      return null;
    }

    const results = groupsSnapshot.docs.map((doc:any) => {
      const data = doc.data();
      logLeadLag(`[FIND_GROUPS for ${equipmentId}] Found in group: ${doc.id}, Data: ${JSON.stringify(data).substring(0, 300)}`);
      const equipmentIdsList = data.equipmentIds || data['equipmentIds '] || [];
      const leadEquipmentIdVal = data.leadEquipmentId || data['leadEquipmentId '] || (equipmentIdsList.length > 0 ? equipmentIdsList[0] : '');
      return {
        id: doc.id,
        leadEquipmentId: leadEquipmentIdVal,
        isLead: leadEquipmentIdVal === equipmentId,
        equipmentIds: equipmentIdsList,
        locationId: data.locationId || data['locationId ']
      };
    });

    logLeadLag(`[FIND_GROUPS for ${equipmentId}] Mapped results: ${JSON.stringify(results)}`);
    await redis.set(cacheKey, JSON.stringify(results), 'EX', GROUP_CACHE_TTL);
    return results;
  } catch (error: any) {
    logLeadLag(`[FIND_GROUPS for ${equipmentId}] CRITICAL ERROR: ${error.message}`, 'error', { stack: error.stack });
    return null;
  }
}

export async function clearLeadLagCaches() {
  try {
    const patterns = ['equipment-status:*', 'lead-lag-status:*', 'equipment-group-mapping:*', 'equipment-groups:all'];
    let clearedCount = 0;
    for (const pattern of patterns) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) { clearedCount += await redis.del(keys); }
    }
    logLeadLag(`Cleared ${clearedCount} cache entries.`);
    return { success: true, clearedEntries: clearedCount };
  } catch (error: any) {
    logLeadLag(`Error clearing caches: ${error.message}`, 'error', { stack: error.stack });
    return { success: false, error: String(error.message) };
  }
}
