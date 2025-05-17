// lib/lead-lag-manager.ts
import { NextResponse } from 'next/server';

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
 * Get equipment groups from Firestore (primary) or InfluxDB (fallback)
 */
async function getEquipmentGroups(): Promise<EquipmentGroup[]> {
  try {
    // Try Firestore first
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
          console.log(`Processing group: ${doc.id}, data:`, data);

          // Get equipment IDs, handling potential spaces in field names
          const equipmentIds = data['equipmentIds'] || data['equipmentIds '] || [];
          console.log(`Group ${doc.id}, equipmentIds:`, equipmentIds);

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
          return groups;
        }
      }
    } else {
      console.log("Firebase Admin not initialized or available - cannot access Firestore");
    }

    // Fall back to InfluxDB if Firestore failed or returned no results
    console.log("Falling back to InfluxDB for equipment groups");
    return getEquipmentGroupsFromInfluxDB();
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
    // Define the SQL query to get equipment groups - UPDATED to use proper INTERVAL syntax
    const sqlQuery = `SELECT * FROM "equipment_groups"
                      WHERE time > now() - INTERVAL '1 hour'
                      ORDER BY time DESC LIMIT 100`;

    // Execute the query using the new InfluxDB 3 SQL endpoint
    const response = await fetch(`${INFLUXDB_URL}/api/v3/query_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: sqlQuery,
        db: INFLUXDB_DATABASE,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`InfluxDB query failed: ${response.status} - ${errorText}`);
    }

    // Parse the JSON response
    const data = await response.json();
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
 * Get equipment status from InfluxDB
 * UPDATED to use InfluxDB 3 SQL API with proper field handling and smaller time range
 */
async function getEquipmentStatus(equipmentId: string): Promise<EquipmentStatus> {
  try {
    // Define the SQL query to get equipment status - UPDATED to use proper INTERVAL syntax
    const sqlQuery = `
      SELECT * FROM "metrics"
      WHERE "equipmentId"='${equipmentId}'
      AND time > now() - INTERVAL '5 minutes'
      ORDER BY time DESC
      LIMIT 10
    `;

    console.log(`Checking status for equipment: ${equipmentId}`);

    // Execute the query using InfluxDB 3 SQL endpoint
    const response = await fetch(`${INFLUXDB_URL}/api/v3/query_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: sqlQuery,
        db: INFLUXDB_DATABASE,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`Query failed for ${equipmentId}: ${response.status} - ${errorText}`);

      // Use alternate query - UPDATED to use proper INTERVAL syntax
      const alternateQuery = `SELECT * FROM "metrics"
                             WHERE time > now() - INTERVAL '5 minutes'
                             LIMIT 1`;

      console.log(`Trying alternate query for ${equipmentId}`);

      const altResponse = await fetch(`${INFLUXDB_URL}/api/v3/query_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: alternateQuery,
          db: INFLUXDB_DATABASE,
        }),
      });

      if (!altResponse.ok) {
        const altErrorText = await altResponse.text();
        throw new Error(`Both queries failed: ${altErrorText}`);
      }

      const altData = await altResponse.json();
      // If we get any data at all from the database, it's likely reachable
      const isHealthy = Array.isArray(altData) && altData.length > 0;

      console.log(`Equipment ${equipmentId} alternate status check: ${isHealthy ? 'HEALTHY (DB is reachable)' : 'UNHEALTHY (no data)'}`);

      return {
        equipmentId,
        isHealthy,
        lastUpdated: Date.now()
      };
    }

    // Parse the JSON response
    const data = await response.json();

    // Check if we got any data back
    if (!Array.isArray(data) || data.length === 0) {
      console.log(`No status data found for equipment ${equipmentId}`);

      // Assume equipment is OK if we just don't have status data
      // This prevents unnecessary failovers due to lack of data
      return {
        equipmentId,
        isHealthy: true,
        lastUpdated: Date.now()
      };
    }

    // Analyze the data for health indicators based on field names in your database
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
    if (latestReading) {
      console.log(`  Details: System=${latestReading.system || 'unknown'}, HasRecentData=${hasRecentData}`);
    }

    return {
      equipmentId,
      isHealthy: isHealthy && hasRecentData,
      lastUpdated: Date.now()
    };
  } catch (error) {
    console.error(`Error getting status for equipment ${equipmentId}:`, error);

    // For safety, default to assuming equipment is healthy if we can't determine status
    // This prevents unnecessary failovers due to query errors
    return {
      equipmentId,
      isHealthy: true,
      lastUpdated: Date.now()
    };
  }
}

/**
 * Update lead equipment in a group - updates both Firestore and InfluxDB
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

    // Next, update in InfluxDB for history tracking
    // Using the line protocol format directly with curl for reliability
    const lineProtocol = `equipment_groups,group_id=${groupId},event=lead_change lead_equipment_id="${newLeadId}",last_rotation_timestamp=${now},reason="${reason}"`;

    // Use curl via child_process for most reliable write
    const { exec } = require('child_process');
    const curlCommand = `curl -s -X POST "${INFLUXDB_URL}/api/v3/write_lp?db=${INFLUXDB_DATABASE}&precision=ns" -H "Content-Type: text/plain" -d "${lineProtocol}"`;

    console.log(`Executing InfluxDB write: ${curlCommand}`);

    await new Promise<void>((resolve, reject) => {
      exec(curlCommand, (execError: any, stdout: string, stderr: string) => {
        if (execError) {
          console.error(`Error writing to InfluxDB: ${execError}`);
          if (!updatedFirestore) {
            reject(new Error(`Failed to update both Firestore and InfluxDB: ${execError}`));
            return;
          }
        }

        if (stderr && stderr.trim().length > 0) {
          console.warn(`InfluxDB write warning: ${stderr}`);
        }

        resolve();
      });
    });

    return true;
  } catch (error) {
    console.error(`Error updating lead equipment for group ${groupId}:`, error);
    throw error;
  }
}

/**
 * Helper function to safely parse JSON
 */
function tryParseJson<T>(jsonString: string | undefined, defaultValue: T): T {
  if (!jsonString) return defaultValue;

  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    console.error("Error parsing JSON:", error);
    return defaultValue;
  }
}

/**
 * Find equipment groups for a specific equipment
 * This can be used by other modules to check if equipment is in a group
 */
export async function findEquipmentGroups(equipmentId: string) {
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
      console.log(`No Firestore equipment group found containing equipment ${equipmentId}`);
      return null;
    }

    return results;
  } catch (error) {
    console.error(`Error finding equipment groups: ${error}`);
    return null;
  }
}
