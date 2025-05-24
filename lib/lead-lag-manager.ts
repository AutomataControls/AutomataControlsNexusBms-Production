// lib/lead-lag-manager.ts
import { NextResponse } from 'next/server';
import Redis from 'ioredis';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';

// Promisify exec for async/await usage
const exec = promisify(execCallback);

// Redis client setup
const redis = new Redis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 50, 2000)
});

// Cache TTL settings
const GROUP_CACHE_TTL = 5 * 60; // 5 minutes
const EQUIPMENT_STATUS_CACHE_TTL = 30; // 30 seconds
const LEAD_LAG_STATUS_CACHE_TTL = 60; // 1 minute

// Firebase Admin initialization
let admin: any = null;
let firestoreInitialized = false;

function initializeFirebaseAdmin() {
  if (firestoreInitialized) return;

  try {
    admin = require('firebase-admin');

    // Check if app is already initialized
    try {
      admin.app();
      firestoreInitialized = true;
      return; // Already initialized
    } catch (error) {
      // App not initialized yet, continue below
    }

    // Check if we have service account credentials in .env
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        // Parse the service account credentials
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

        // Fix the private key format if needed
        if (serviceAccount.private_key) {
          // Replace escaped newlines with actual newlines
          serviceAccount.private_key = serviceAccount.private_key
            .replace(/\\n/g, '\n')
            .replace(/\\\\/g, '\\');

          console.log("Private key format corrected for Firebase initialization");
        }

        // Initialize with service account credentials
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
        });

        console.log("Firebase Admin initialized with service account credentials");
        firestoreInitialized = true;
      } catch (parseError) {
        console.error("Error parsing service account JSON:", parseError);

        // Fall back to basic initialization
        fallbackInitialization();
      }
    } else {
      // Fallback to using basic project credentials
      fallbackInitialization();
    }
  } catch (error) {
    console.error("Error initializing Firebase Admin:", error);
    firestoreInitialized = false;
  }
}

function fallbackInitialization() {
  try {
    console.log("Using fallback Firebase initialization with basic configuration");

    const firebaseConfig = {
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
    };

    admin.initializeApp(firebaseConfig);
    console.log("Firebase Admin initialized with basic configuration");
    firestoreInitialized = true;
  } catch (fallbackError) {
    console.error("Fallback initialization also failed:", fallbackError);
    firestoreInitialized = false;
  }
}

// Updated InfluxDB configuration - hardcoded for local use
const INFLUXDB_URL = "http://localhost:8181";
const INFLUXDB_DATABASE = "Locations";

// Types
interface EquipmentGroup {
  id: string;
  name: string;
  type: string;
  locationId: string;
  equipmentIds: string[];
  leadEquipmentId: string;
  rotationEnabled: boolean;
  rotationIntervalHours: number;
  lastRotationTimestamp: number;
  failoverEnabled: boolean;
}

interface EquipmentStatus {
  equipmentId: string;
  isHealthy: boolean;
  lastUpdated: number;
}

/**
 * Check for equipment failures and handle failovers if necessary
 */
export async function checkAndHandleFailovers() {
  try {
    console.log("Checking for equipment failures and handling failovers");

    // Initialize Firebase Admin if not initialized
    initializeFirebaseAdmin();

    // Fetch equipment groups from Firestore (primary) or InfluxDB (fallback)
    const groups = await getEquipmentGroups();

    if (!groups || groups.length === 0) {
      console.log("No equipment groups found");
      return { success: true, message: "No equipment groups found" };
    }

    let failoversPerformed = 0;

    for (const group of groups) {
      // Skip groups with failover disabled
      if (!group.failoverEnabled) {
        console.log(`Failover disabled for group ${group.name}, skipping`);
        continue;
      }

      // Get current lead equipment status
      const leadStatus = await getEquipmentStatus(group.leadEquipmentId);

      // Check if lead equipment is unhealthy
      if (!leadStatus.isHealthy) {
        console.log(`Lead equipment ${group.leadEquipmentId} in group ${group.name} is unhealthy`);

        // Find a healthy lag equipment
        let newLeadId = null;
        for (const equipId of group.equipmentIds) {
          if (equipId !== group.leadEquipmentId) {
            const status = await getEquipmentStatus(equipId);
            if (status.isHealthy) {
              newLeadId = equipId;
              break;
            }
          }
        }

        // If we found a healthy lag equipment, promote it to lead
        if (newLeadId) {
          await updateLeadEquipment(group.id, newLeadId, "failover");
          console.log(`Performed failover: Promoted ${newLeadId} to lead in group ${group.name}`);
          failoversPerformed++;
        } else {
          console.log(`No healthy lag equipment available for failover in group ${group.name}`);
        }
      }
    }

    return { success: true, failoversPerformed };
  } catch (error) {
    console.error("Error checking for equipment failures:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Check if it's time for scheduled changeovers and perform them
 */
export async function performScheduledChangeovers() {
  try {
    console.log("Checking for scheduled lead/lag changeovers");

    // Initialize Firebase Admin if not initialized
    initializeFirebaseAdmin();

    // Fetch equipment groups from Firestore (primary) or InfluxDB (fallback)
    const groups = await getEquipmentGroups();

    if (!groups || groups.length === 0) {
      console.log("No equipment groups found");
      return { success: true, message: "No equipment groups found" };
    }

    const now = Date.now();
    let changeoversPerformed = 0;

    for (const group of groups) {
      // Skip groups with rotation disabled
      if (!group.rotationEnabled) {
        console.log(`Rotation disabled for group ${group.name}, skipping`);
        continue;
      }

      // Check if rotation interval has passed
      const lastRotation = group.lastRotationTimestamp || 0;
      const intervalMs = group.rotationIntervalHours * 3600 * 1000; // Convert hours to milliseconds
      const nextRotationTime = lastRotation + intervalMs;

      if (now >= nextRotationTime) {
        console.log(`Rotation interval passed for group ${group.name}`);

        // Get current lead index
        const currentLeadIndex = group.equipmentIds.indexOf(group.leadEquipmentId);
        if (currentLeadIndex === -1) {
          console.error(`Current lead equipment ${group.leadEquipmentId} not found in group ${group.name}`);

          // Fix lead equipment if not found (use first equipment)
          if (group.equipmentIds.length > 0) {
            const newLeadId = group.equipmentIds[0];
            await updateLeadEquipment(group.id, newLeadId, "rotation");
            console.log(`Fixed invalid lead: Changed lead to ${newLeadId} in group ${group.name}`);
            changeoversPerformed++;
          }
          continue;
        }

        // Determine next lead equipment
        const nextLeadIndex = (currentLeadIndex + 1) % group.equipmentIds.length;
        const nextLeadEquipmentId = group.equipmentIds[nextLeadIndex];

        // Perform rotation
        await updateLeadEquipment(group.id, nextLeadEquipmentId, "rotation");
        console.log(`Performed rotation: Changed lead from ${group.leadEquipmentId} to ${nextLeadEquipmentId} in group ${group.name}`);
        changeoversPerformed++;
      } else {
        const timeRemaining = nextRotationTime - now;
        const hoursRemaining = Math.round(timeRemaining / (3600 * 1000) * 10) / 10;
        console.log(`Next rotation for group ${group.name} in ${hoursRemaining} hours`);
      }
    }

    return { success: true, changeoversPerformed };
  } catch (error) {
    console.error("Error performing scheduled changeovers:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get lead-lag status for a specific equipment, optimized with Redis caching
 * @param locationId - Location ID (string)
 * @param equipmentId - Equipment ID to check
 * @returns Promise with lead-lag status and control decision
 */
export async function getLeadLagStatus(locationId: string, equipmentId: string) {
  try {
    // Check Redis cache first
    const cacheKey = `lead-lag-status:${locationId}:${equipmentId}`;
    const cachedStatus = await redis.get(cacheKey);

    if (cachedStatus) {
      return JSON.parse(cachedStatus);
    }

    // Find equipment groups for this equipment
    const groups = await findEquipmentGroups(equipmentId);

    if (!groups || groups.length === 0) {
      // Equipment not in any lead-lag group - should run normally
      const result = {
        isLead: true,
        shouldRun: true,
        reason: "Equipment not in lead-lag group - running independently",
        groupId: null
      };

      // Cache the result (shorter TTL for standalone equipment)
      await redis.set(cacheKey, JSON.stringify(result), 'EX', LEAD_LAG_STATUS_CACHE_TTL);
      return result;
    }

    // Get the first group (equipment should only be in one group)
    const group = groups[0];

    if (!group.equipmentIds || group.equipmentIds.length === 0) {
      const result = {
        isLead: true,
        shouldRun: true,
        reason: "No equipment found in group - running independently",
        groupId: group.id
      };

      await redis.set(cacheKey, JSON.stringify(result), 'EX', LEAD_LAG_STATUS_CACHE_TTL);
      return result;
    }

    // Check if this equipment is the current lead
    const isCurrentLead = group.leadEquipmentId === equipmentId;
    const isMarkedAsLead = group.isLead === true;

    // Determine if equipment should run based on lead-lag logic
    let result;
    if (isCurrentLead && isMarkedAsLead) {
      result = {
        isLead: true,
        shouldRun: true,
        reason: `Lead equipment in group ${group.id}`,
        groupId: group.id
      };
    } else if (!isCurrentLead && !isMarkedAsLead) {
      result = {
        isLead: false,
        shouldRun: false,
        reason: `Lag equipment in standby - group ${group.id}`,
        groupId: group.id
      };
    } else {
      // Mismatch between leadEquipmentId and isLead flag - needs investigation
      console.warn(`Lead-lag mismatch for ${equipmentId}: leadEquipmentId=${group.leadEquipmentId}, isLead=${isMarkedAsLead}`);

      // Default to running if marked as lead OR if it's the leadEquipmentId
      const shouldRun = isCurrentLead || isMarkedAsLead;

      result = {
        isLead: isCurrentLead,
        shouldRun: shouldRun,
        reason: `Lead-lag status mismatch - ${shouldRun ? 'allowing to run' : 'keeping in standby'}`,
        groupId: group.id
      };
    }

    // Cache the result
    await redis.set(cacheKey, JSON.stringify(result), 'EX', LEAD_LAG_STATUS_CACHE_TTL);
    return result;

  } catch (error) {
    console.error(`Error getting lead-lag status for ${equipmentId}:`, error);

    // On error, default to allowing equipment to run to avoid system shutdown
    return {
      isLead: true,
      shouldRun: true,
      reason: `Error checking lead-lag status: ${error.message} - defaulting to run`,
      error: error.message
    };
  }
}

/**
 * Get equipment groups from Firestore with Redis caching
 */
async function getEquipmentGroups(): Promise<EquipmentGroup[]> {
  try {
    // Check Redis cache first
    const cacheKey = 'equipment-groups';
    const cachedGroups = await redis.get(cacheKey);

    if (cachedGroups) {
      return JSON.parse(cachedGroups);
    }

    // Try Firestore if cache miss
    if (firestoreInitialized && admin) {
      console.log("Fetching equipment groups from Firestore");

      // Query the equipmentGroups collection from Firestore
      const groupsSnapshot = await admin.firestore().collection('equipmentGroups').get();

      console.log(`Found ${groupsSnapshot.size} equipment groups in Firestore`);

      if (groupsSnapshot.empty) {
        console.log("No equipment groups found in Firestore");
      } else {
        // Convert Firestore documents to EquipmentGroup objects
        const groups: EquipmentGroup[] = [];

        groupsSnapshot.forEach(doc => {
          const data = doc.data();

          // Get equipment IDs, handling potential spaces in field names
          const equipmentIds = data['equipmentIds'] || data['equipmentIds '] || [];

          // Get lead equipment ID, handling potential spaces
          const leadEquipmentId = data['leadEquipmentId'] || data['leadEquipmentId '] || '';

          // Get other fields, handling spaces in names
          const useLeadLag = data['useLeadLag'] !== undefined
            ? data['useLeadLag']
            : (data['useLeadLag '] !== undefined ? data['useLeadLag '] : true);

          const autoFailover = data['autoFailover'] !== undefined
            ? data['autoFailover']
            : (data['autoFailover '] !== undefined ? data['autoFailover '] : true);

          const changeoverIntervalDays = data['changeoverIntervalDays'] || data['changeoverIntervalDays '] || 7;

          // Get timestamps with fallbacks
          let lastChangeoverTime = 0;
          if (data['lastChangeoverTime']) {
            lastChangeoverTime = typeof data['lastChangeoverTime'] === 'number'
              ? data['lastChangeoverTime']
              : data['lastChangeoverTime']._seconds * 1000;
          } else if (data['lastChangeoverTime ']) {
            lastChangeoverTime = typeof data['lastChangeoverTime '] === 'number'
              ? data['lastChangeoverTime ']
              : data['lastChangeoverTime ']._seconds * 1000;
          }

          let lastFailoverTime = 0;
          if (data['lastFailoverTime']) {
            lastFailoverTime = typeof data['lastFailoverTime'] === 'number'
              ? data['lastFailoverTime']
              : data['lastFailoverTime']._seconds * 1000;
          } else if (data['lastFailoverTime ']) {
            lastFailoverTime = typeof data['lastFailoverTime '] === 'number'
              ? data['lastFailoverTime ']
              : data['lastFailoverTime ']._seconds * 1000;
          }

          // Create a clean equipment group object
          groups.push({
            id: doc.id,
            name: data.name || doc.id,
            type: data.type || 'boiler', // Default to boiler type
            locationId: data.locationId || '',
            equipmentIds: equipmentIds,
            leadEquipmentId: leadEquipmentId,
            rotationEnabled: useLeadLag,
            rotationIntervalHours: changeoverIntervalDays * 24, // Convert days to hours
            lastRotationTimestamp: lastChangeoverTime,
            failoverEnabled: autoFailover
          });
        });

        if (groups.length > 0) {
          console.log(`Successfully retrieved ${groups.length} equipment groups from Firestore`);

          // Cache the groups
          await redis.set(cacheKey, JSON.stringify(groups), 'EX', GROUP_CACHE_TTL);

          return groups;
        }
      }
    } else {
      console.log("Firebase Admin not initialized or available - cannot access Firestore");
    }

    // Fall back to InfluxDB if Firestore failed or returned no results
    console.log("Falling back to InfluxDB for equipment groups");
    const influxGroups = await getEquipmentGroupsFromInfluxDB();

    if (influxGroups.length > 0) {
      // Cache the groups from InfluxDB too
      await redis.set(cacheKey, JSON.stringify(influxGroups), 'EX', GROUP_CACHE_TTL);
    }

    return influxGroups;
  } catch (error) {
    console.error("Error fetching equipment groups from Firestore:", error);

    // If Firestore fails, try the original InfluxDB method as fallback
    console.log("Falling back to InfluxDB for equipment groups");
    return getEquipmentGroupsFromInfluxDB();
  }
}

/**
 * Fallback: Get equipment groups from InfluxDB
 */
async function getEquipmentGroupsFromInfluxDB(): Promise<EquipmentGroup[]> {
  try {
    // Optimized SQL query to get equipment groups - with field selection and smaller time range
    // FIXED: Convert multi-line query to single line if needed
    const sqlQuery = "SELECT group_id, name, type, location_id, equipment_ids, lead_equipment_id, rotation_enabled, rotation_interval_hours, last_rotation_timestamp, failover_enabled FROM \"equipment_groups\" WHERE time > now() - INTERVAL '10 minute' ORDER BY time DESC LIMIT 20";

    // FIXED: Properly format the JSON payload using JSON.stringify
    const payload = JSON.stringify({
      q: sqlQuery,
      db: INFLUXDB_DATABASE
    });

    // Execute the query using the new InfluxDB 3 SQL endpoint directly with curl for better performance
    // FIXED: Use the properly formatted JSON payload
    const { stdout, stderr } = await exec(`curl -s -X POST "${INFLUXDB_URL}/api/v3/query_sql" -H "Content-Type: application/json" -d '${payload}'`);

    if (stderr) {
      console.error(`InfluxDB error: ${stderr}`);
    }

    // Parse the JSON response
    const data = JSON.parse(stdout);
    const groups: EquipmentGroup[] = [];

    if (Array.isArray(data) && data.length > 0) {
      // Process the results and convert to EquipmentGroup objects
      for (const row of data) {
        if (row.group_id) {
          // Extract equipment IDs from the row
          let equipmentIds: string[] = [];
          try {
            if (row.equipment_ids) {
              if (typeof row.equipment_ids === 'string') {
                equipmentIds = JSON.parse(row.equipment_ids);
              } else if (Array.isArray(row.equipment_ids)) {
                equipmentIds = row.equipment_ids;
              }
            }
          } catch (e) {
            console.warn(`Error parsing equipment_ids for group ${row.group_id}: ${e}`);
          }

          // Create the group object
          groups.push({
            id: row.group_id,
            name: row.name || row.group_id,
            type: row.type || 'unknown',
            locationId: row.location_id || '',
            equipmentIds: equipmentIds,
            leadEquipmentId: row.lead_equipment_id || '',
            rotationEnabled: row.rotation_enabled === true || row.rotation_enabled === 'true',
            rotationIntervalHours: parseInt(row.rotation_interval_hours || '168', 10),
            lastRotationTimestamp: parseInt(row.last_rotation_timestamp || '0', 10),
            failoverEnabled: row.failover_enabled === true || row.failover_enabled === 'true'
          });
        }
      }
    }

    console.log(`Retrieved ${groups.length} equipment groups from InfluxDB`);
    return groups;
  } catch (error) {
    console.error("Error fetching equipment groups from InfluxDB:", error);
    return []; // Return empty array if both methods failed
  }
}

/**
 * Get equipment status from InfluxDB with Redis caching
 */
async function getEquipmentStatus(equipmentId: string): Promise<EquipmentStatus> {
  try {
    // Check Redis cache first
    const cacheKey = `equipment-status:${equipmentId}`;
    const cachedStatus = await redis.get(cacheKey);

    if (cachedStatus) {
      return JSON.parse(cachedStatus);
    }

    // Cache miss - need to fetch from InfluxDB
    // FIXED: Use a single-line query without newlines to avoid JSON parsing errors
    const sqlQuery = "SELECT time, system, Fan_Status, HWP1_Status, HWP2_Status, Freezestat, H20Supply FROM \"metrics\" WHERE \"equipmentId\"='" + equipmentId + "' AND time > now() - INTERVAL '5 minutes' ORDER BY time DESC LIMIT 5";

    console.log(`Checking status for equipment: ${equipmentId}`);

    // FIXED: Properly format the JSON payload using JSON.stringify
    const payload = JSON.stringify({
      q: sqlQuery,
      db: INFLUXDB_DATABASE
    });

    // Use curl directly for better performance with local InfluxDB
    // FIXED: Use the properly formatted JSON payload
    const { stdout, stderr } = await exec(`curl -s -X POST "${INFLUXDB_URL}/api/v3/query_sql" -H "Content-Type: application/json" -d '${payload}'`);

    if (stderr) {
      console.error(`InfluxDB error for ${equipmentId}: ${stderr}`);

      // Try a simpler query as fallback
      const simpleQuery = "SELECT time FROM \"metrics\" WHERE time > now() - INTERVAL '5 minutes' LIMIT 1";
      
      // FIXED: Also properly format the fallback JSON payload
      const fallbackPayload = JSON.stringify({
        q: simpleQuery,
        db: INFLUXDB_DATABASE
      });

      const { stdout: altStdout, stderr: altStderr } = await exec(`curl -s -X POST "${INFLUXDB_URL}/api/v3/query_sql" -H "Content-Type: application/json" -d '${fallbackPayload}'`);

      if (altStderr) {
        throw new Error(`Both queries failed: ${altStderr}`);
      }

      const altData = JSON.parse(altStdout);
      const isHealthy = Array.isArray(altData) && altData.length > 0;

      const status = {
        equipmentId,
        isHealthy,
        lastUpdated: Date.now()
      };

      // Cache even the fallback result
      await redis.set(cacheKey, JSON.stringify(status), 'EX', EQUIPMENT_STATUS_CACHE_TTL);
      return status;
    }

    // Parse the JSON response
    const data = JSON.parse(stdout);

    // Check if we got any data back
    if (!Array.isArray(data) || data.length === 0) {
      // Assume equipment is OK if we just don't have status data
      const status = {
        equipmentId,
        isHealthy: true,
        lastUpdated: Date.now()
      };

      await redis.set(cacheKey, JSON.stringify(status), 'EX', EQUIPMENT_STATUS_CACHE_TTL);
      return status;
    }

    // Analyze the data for health indicators
    let isHealthy = true;
    let hasRecentData = false;
    const latestReading = data[0];

    // Check if data is recent enough (within the last hour)
    const oneHourAgo = Date.now() - (60 * 60 * 1000);

    if (latestReading && latestReading.time) {
      const rowTime = new Date(latestReading.time).getTime();
      if (rowTime > oneHourAgo) {
        hasRecentData = true;
      }
    }

    // Look for common status indicators from your field list
    if (latestReading) {
      // Check for known fault/status fields
      const faultIndicators = [
        // Check status indicators
        latestReading.Fan_Status === "Fault" || latestReading.Fan_Status === "Off",
        latestReading.HWP1_Status === "Fault" || latestReading.HWP2_Status === "Fault",
        latestReading.Freezestat === true || latestReading.Freezestat === "true" || latestReading.Freezestat === 1
      ];

      // If any fault indicators are true, equipment is not healthy
      if (faultIndicators.some(indicator => indicator === true)) {
        isHealthy = false;
      }

      // Check for boiler-specific fields
      if (latestReading.system && latestReading.system.toLowerCase().includes('boiler')) {
        // For boilers, check supply temperature
        if (latestReading.H20Supply !== undefined) {
          // Supply temperature should be above freezing
          if (latestReading.H20Supply < 32) {
            isHealthy = false;
          }
        }
      }
    }

    console.log(`Equipment ${equipmentId} status: ${isHealthy && hasRecentData ? 'HEALTHY' : 'UNHEALTHY'}`);
    if (latestReading && latestReading.system) {
      console.log(`  Details: System=${latestReading.system || 'unknown'}, HasRecentData=${hasRecentData}`);
    }

    const status = {
      equipmentId,
      isHealthy: isHealthy && hasRecentData,
      lastUpdated: Date.now()
    };

    // Cache the status
    await redis.set(cacheKey, JSON.stringify(status), 'EX', EQUIPMENT_STATUS_CACHE_TTL);
    return status;
  } catch (error) {
    console.error(`Error getting status for equipment ${equipmentId}:`, error);

    // For safety, default to assuming equipment is healthy if we can't determine status
    return {
      equipmentId,
      isHealthy: true,
      lastUpdated: Date.now()
    };
  }
}

/**
 * Update lead equipment in a group - updates both Firestore and InfluxDB
 * Also invalidates Redis caches to ensure fresh data
 */
async function updateLeadEquipment(groupId: string, newLeadId: string, reason: "failover" | "rotation") {
  try {
    const now = Date.now();
    let updatedFirestore = false;

    // First, update in Firestore
    if (firestoreInitialized && admin) {
      try {
        console.log(`Updating lead equipment in Firestore group ${groupId} to ${newLeadId}`);

        // Get the document first to check which field names to use
        const docRef = admin.firestore().collection('equipmentGroups').doc(groupId);
        const docSnapshot = await docRef.get();

        if (!docSnapshot.exists) {
          console.log(`Group ${groupId} not found in Firestore`);
        } else {
          const data = docSnapshot.data();

          // Determine field names with or without spaces
          const leadIdField = Object.keys(data).find(k => k.trim() === 'leadEquipmentId') || 'leadEquipmentId';
          const lastChangeoverField = Object.keys(data).find(k => k.trim() === 'lastChangeoverTime') || 'lastChangeoverTime';
          const lastFailoverField = Object.keys(data).find(k => k.trim() === 'lastFailoverTime') || 'lastFailoverTime';

          // Create updates object
          const firestoreUpdates: any = {};
          firestoreUpdates[leadIdField] = newLeadId;

          // Update the appropriate timestamp field based on reason
          if (reason === "failover") {
            firestoreUpdates[lastFailoverField] = now;
          } else if (reason === "rotation") {
            firestoreUpdates[lastChangeoverField] = now;
          }

          // Perform the Firestore update
          await docRef.update(firestoreUpdates);

          console.log(`Successfully updated Firestore for group ${groupId}`);
          updatedFirestore = true;
        }
      } catch (firestoreError) {
        console.error(`Error updating Firestore: ${firestoreError}`);
      }
    } else {
      console.log(`Firebase Admin not initialized or available - cannot update Firestore`);
    }

    // Next, update in InfluxDB for history tracking using curl for local efficiency
    const lineProtocol = `equipment_groups,group_id=${groupId},event=lead_change lead_equipment_id="${newLeadId}",last_rotation_timestamp=${now},reason="${reason}"`;

    const { stdout, stderr } = await exec(`curl -s -X POST "${INFLUXDB_URL}/api/v3/write_lp?db=${INFLUXDB_DATABASE}&precision=ns" \
      -H "Content-Type: text/plain" \
      -d "${lineProtocol}"`);

    if (stderr) {
      console.warn(`InfluxDB write warning: ${stderr}`);
      if (!updatedFirestore) {
        throw new Error(`Failed to update both Firestore and InfluxDB: ${stderr}`);
      }
    }

    // Invalidate Redis caches
    console.log('Invalidating Redis caches after lead-lag update');

    // Clear the main equipment groups cache
    await redis.del('equipment-groups');

    // Get group details to find equipment to invalidate
    const group = await admin.firestore().collection('equipmentGroups').doc(groupId).get();
    if (group.exists) {
      const data = group.data();
      const equipmentIds = data['equipmentIds'] || data['equipmentIds '] || [];

      // Invalidate each equipment's cache entries
      for (const equipId of equipmentIds) {
        await redis.del(`equipment-group-mapping:${equipId}`);
        await redis.del(`lead-lag-status:*:${equipId}`);
      }
    }

    return true;
  } catch (error) {
    console.error(`Error updating lead equipment for group ${groupId}:`, error);
    throw error;
  }
}

/**
 * Find equipment groups for a specific equipment with Redis caching
 */
export async function findEquipmentGroups(equipmentId: string) {
  // Check Redis cache first
  const cacheKey = `equipment-group-mapping:${equipmentId}`;
  const cachedMapping = await redis.get(cacheKey);

  if (cachedMapping) {
    return JSON.parse(cachedMapping);
  }

  if (!firestoreInitialized || !admin) return null;

  try {
    // Get all equipment groups
    const groupsSnapshot = await admin.firestore().collection('equipmentGroups').get();

    if (groupsSnapshot.empty) {
      console.log("No equipment groups found in Firestore");
      return null;
    }

    const results = [];

    // Check each group to see if this equipment is included
    for (const doc of groupsSnapshot.docs) {
      const data = doc.data();

      // Get equipment IDs handling both field names
      const equipmentIds = data['equipmentIds'] || data['equipmentIds '] || [];

      // Check if equipment ID is in the array (handle both array and non-array formats)
      const foundInGroup = Array.isArray(equipmentIds)
        ? equipmentIds.includes(equipmentId)
        : equipmentIds === equipmentId;

      if (foundInGroup) {
        console.log(`Found equipment ${equipmentId} in group ${doc.id}`);

        // Get lead ID handling both field names
        const leadEquipmentId = data['leadEquipmentId'] || data['leadEquipmentId '] || '';

        results.push({
          id: doc.id,
          leadEquipmentId: leadEquipmentId,
          isLead: leadEquipmentId === equipmentId,
          equipmentIds: equipmentIds
        });
      }
    }

    if (results.length === 0) {
      return null;
    }

    // Cache the results
    await redis.set(cacheKey, JSON.stringify(results), 'EX', GROUP_CACHE_TTL);
    return results;
  } catch (error) {
    console.error(`Error finding equipment groups: ${error}`);
    return null;
  }
}

/**
 * Clear all caches - use this when debugging or ensuring fresh data
 */
export async function clearLeadLagCaches() {
  try {
    // Get all keys matching our cache patterns
    const equipmentStatusKeys = await redis.keys('equipment-status:*');
    const leadLagStatusKeys = await redis.keys('lead-lag-status:*');
    const mappingKeys = await redis.keys('equipment-group-mapping:*');
    const groupKeys = ['equipment-groups'];

    // Combine all keys
    const allKeys = [...equipmentStatusKeys, ...leadLagStatusKeys, ...mappingKeys, ...groupKeys];

    if (allKeys.length > 0) {
      // Delete all matching keys
      await redis.del(...allKeys);
      console.log(`Cleared ${allKeys.length} lead-lag cache entries`);
    } else {
      console.log('No lead-lag cache entries found to clear');
    }

    return { success: true, clearedEntries: allKeys.length };
  } catch (error) {
    console.error('Error clearing lead-lag caches:', error);
    return { success: false, error: String(error) };
  }
}
