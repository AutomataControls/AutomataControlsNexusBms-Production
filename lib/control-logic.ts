// lib/control-logic.ts
// Note: No 'use server' directive at the top - this is a regular library file

import { initializeApp, getApps } from "firebase/app"
import { getFirestore } from "firebase/firestore"
import { doc, getDoc } from "firebase/firestore"

// Import base implementations
import { fanCoilControl as fanCoilControlBase } from "./equipment-logic/base/fan-coil";
import { boilerControl as boilerControlBase } from "./equipment-logic/base/boiler";
import { pumpControl as pumpControlBase } from "./equipment-logic/base/pumps";
import { chillerControl as chillerControlBase } from "./equipment-logic/base/chiller";
import { airHandlerControl as airHandlerControlBase } from "./equipment-logic/base/air-handler";
import { steamBundleControl as steamBundleControlBase } from "./equipment-logic/base/steam-bundle";

// Import location-specific implementations
// Warren (ID: 1)
import { fanCoilControl as fanCoilControlWarren } from "./equipment-logic/locations/warren/fan-coil";
import { pumpControl as pumpControlWarren } from "./equipment-logic/locations/warren/pumps";
import { airHandlerControl as airHandlerControlWarren } from "./equipment-logic/locations/warren/air-handler";
import { steamBundleControl as steamBundleControlWarren } from "./equipment-logic/locations/warren/steam-bundle";

// Hopebridge (ID: 5)
import { boilerControl as boilerControlHopebridge } from "./equipment-logic/locations/hopebridge/boiler";
import { airHandlerControl as airHandlerControlHopebridge } from "./equipment-logic/locations/hopebridge/air-handler";

// Huntington (ID: 4)
import { fanCoilControl as fanCoilControlHuntington } from "./equipment-logic/locations/huntington/fan-coil";
import { boilerControl as boilerControlHuntington } from "./equipment-logic/locations/huntington/boiler";
import { pumpControl as pumpControlHuntington } from "./equipment-logic/locations/huntington/pumps";
import { chillerControl as chillerControlHuntington } from "./equipment-logic/locations/huntington/chiller";

// Enhanced logging function for equipment-specific debugging
function logEquipment(equipmentId: string, message: string, data?: any) {
  const logPrefix = `EQUIPMENT[${equipmentId}]`;
  if (data) {
    console.log(`${logPrefix} ${message}`, typeof data === 'object' ? JSON.stringify(data).substring(0, 500) : data);
  } else {
    console.log(`${logPrefix} ${message}`);
  }
}

// Queue system for sequential processing
export const equipmentQueue: string[] = [];
export let isProcessingQueue = false;

// Process one item from the queue
async function processNextInQueue() {
  if (isProcessingQueue || equipmentQueue.length === 0) {
    return;
  }

  isProcessingQueue = true;
  const equipmentId = equipmentQueue.shift();

  try {
    console.log(`Processing queued equipment: ${equipmentId}`);
    // Run logic for this equipment
    await runEquipmentLogic(equipmentId);
  } catch (error) {
    console.error(`Error processing queued equipment ${equipmentId}:`, error);
  } finally {
    isProcessingQueue = false;
    // Process next item if any
    processNextInQueue();
  }
}

// Queue equipment for processing
function queueEquipmentLogic(equipmentId: string) {
  equipmentQueue.push(equipmentId);
  processNextInQueue(); // Try to start processing
}

// Define the necessary interfaces
export interface LogicEvaluation {
  result: any
  error?: string
  hasChanges: boolean
  timestamp: number
}

// PID settings interface
export interface PIDSettings {
  kp: number
  ki: number
  kd: number
  enabled: boolean
  outputMin: number
  outputMax: number
  sampleTime: number
  setpoint?: number
  reverseActing: boolean
}

// Control values interface
export interface ControlValues {
  fanSpeed: string
  fanMode: string
  fanEnabled: boolean
  heatingValvePosition: number
  coolingValvePosition: number
  heatingValveMode: string
  coolingValveMode: string
  temperatureSetpoint: number
  operationMode: string
  unitEnable: boolean
  customLogicEnabled?: boolean
  customLogic?: string
  outdoorDamperPosition?: number
  temperatureSource?: string // Added for temperature source toggle
  pidControllers?: {
    heating?: PIDSettings
    cooling?: PIDSettings
    outdoorDamper?: PIDSettings
  }
  outdoorAirReset?: {
    enabled: boolean
    outdoorTempLow: number
    outdoorTempHigh: number
    setpointLow: number
    setpointHigh: number
  }
  // Boiler specific controls
  firing?: number
  firingRate?: number // ADDED: Include firingRate as separate property
  waterTempSetpoint?: number
}

// Default PID settings
export const defaultPIDSettings = {
  kp: 1.0,
  ki: 0.1,
  kd: 0.01,
  enabled: true,
  outputMin: 0,
  outputMax: 100,
  sampleTime: 1000,
  reverseActing: false,
}

// Helper function to determine if custom logic should run for this equipment
function shouldRunCustomLogic(equipmentId, equipmentType, locationId) {
  // Equipment types we've implemented custom logic for
  const supportedTypes = [
    "fan-coil",
    "fan coil", 
    "Fan Coil",
    "boiler",
    "Boiler",
    "pump",
    "Pump",
    "hwpump",
    "cwpump",
    "air-handler",
    "air handler",
    "Air Handler",
    "chiller",
    "Chiller",
    "steam-bundle",
    "Steam Bundle"
  ]

  // Check if equipment type is supported
  const normalizedType = equipmentType?.toLowerCase().replace(/-/g, ' ') || "";
  const typeSupported = supportedTypes.some(type => {
    const normalizedSupportedType = type.toLowerCase().replace(/-/g, ' ');
    return normalizedType === normalizedSupportedType ||
           normalizedType.includes(normalizedSupportedType) ||
           normalizedSupportedType.includes(normalizedType);
  });

  // Debug logging
  console.log(`shouldRunCustomLogic check for ${equipmentId} (${equipmentType}): ${typeSupported}`);

  // Run for all locations now, with equipment type as the only criteria
  return typeSupported;
}

// Initialize Firebase if not already initialized
let db: any
let secondaryDb: any

try {
  // Firebase configuration from environment variables
  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  }

  // Initialize Firebase (will not re-initialize if already initialized)
  const firebaseApps = getApps()
  if (firebaseApps.length === 0) {
    const app = initializeApp(firebaseConfig)
    db = getFirestore(app)
    console.log("Firebase initialized successfully")
  } else {
    db = getFirestore(firebaseApps[0])
    console.log("Firebase already initialized, using existing instance")
  }
} catch (error) {
  console.error("Error initializing Firebase:", error)
}

// Import RTDB dynamically to avoid server/client mismatch
export async function getSecondaryDb() {
  if (!secondaryDb) {
    try {
      const { getDatabase } = await import("firebase/database")
      const firebaseApps = getApps()
      if (firebaseApps.length > 0) {
        secondaryDb = getDatabase(firebaseApps[0])
        console.log("Firebase RTDB initialized successfully")
      } else {
        console.error("Cannot initialize RTDB: Firebase app not initialized")
      }
    } catch (error) {
      console.error("Error initializing Firebase RTDB:", error)
    }
  }
  return secondaryDb
}

// PID state storage - maintains state between runs
export const pidStateStorage = new Map()

// Cache for storing last known control values
export const controlValuesCache = new Map<string, {
  values: any,
  timestamp: number
}>();

// Initialize with default values for known equipment
export function initializeControlValuesCache() {
  try {
    // Location 4 equipment (Huntington) - set correct temperature source
    const huntingtonEquipment = ["BBHCLhaeItV7pIdinQzM", "IEhoTqKphbvHb5fTanpP", "ZLYR6YveSmCEMqtBSy3e"]

    // Set default values for Huntington equipment with SUPPLY as temperature source
    for (const equipmentId of huntingtonEquipment) {
      const cacheKey = `4_${equipmentId}`

      // Only set if not already in cache
      if (!controlValuesCache.has(cacheKey)) {
        controlValuesCache.set(cacheKey, {
          values: {
            fanSpeed: "medium",
            fanMode: "auto",
            fanEnabled: true,
            heatingValvePosition: 0,
            coolingValvePosition: 0,
            heatingValveMode: "auto",
            coolingValveMode: "auto",
            temperatureSetpoint: 72,
            temperatureSource: "supply", // IMPORTANT: Set to supply for Huntington
            operationMode: "auto",
            unitEnable: true,
            outdoorDamperPosition: 20,
            customLogicEnabled: true,
            pidControllers: {
              cooling: {
                enabled: true,
                kd: 0.01,
                ki: 0.03,
                kp: 1,
                outputMax: 100,
                outputMin: 0,
                reverseActing: false,
                maxIntegral: 10,
              },
              heating: {
                enabled: true,
                kd: 0.01,
                ki: 0.03,
                kp: 1,
                outputMax: 100,
                outputMin: 0,
                reverseActing: true,
                maxIntegral: 10,
              },
              outdoorDamper: {
                enabled: false,
                kd: 0.01,
                ki: 0.1,
                kp: 1,
                outputMax: 100,
                outputMin: 0,
                reverseActing: false,
                maxIntegral: 10,
              },
            },
            waterTempSetpoint: 120,
            firing: 0,
            firingRate: 0, // ADDED: Initialize firingRate to 0
          },
          timestamp: Date.now(),
        })
        console.log(`Initialized cache for ${equipmentId} with supply temperature source`)
      }
    }
  } catch (error) {
    console.error("Error initializing control values cache:", error)
  }
}

// Function to save cache to disk
export async function saveControlValuesCache() {
  try {
    // Only run on server
    if (typeof window !== "undefined") return

    const cacheData = Object.fromEntries(Array.from(controlValuesCache.entries()).map(([key, data]) => [key, data]))

    // Use Node.js fs module
    const fs = require("fs")
    const path = require("path")

    // Create cache directory if it doesn't exist
    const cacheDir = path.join(process.cwd(), ".cache")
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true })
    }

    // Write cache to disk
    fs.writeFileSync(path.join(cacheDir, "control-values-cache.json"), JSON.stringify(cacheData, null, 2))

    console.log(`Saved control values cache with ${controlValuesCache.size} entries`)
  } catch (error) {
    console.error("Error saving control values cache:", error)
  }
}

// Function to load cache from disk on startup
export async function loadControlValuesCache() {
  try {
    // Only run on server
    if (typeof window !== "undefined") return

    const fs = require("fs")
    const path = require("path")

    const cacheDir = path.join(process.cwd(), ".cache")
    const cacheFile = path.join(cacheDir, "control-values-cache.json")

    let cacheLoaded = false

    if (fs.existsSync(cacheFile)) {
      try {
        const cacheData = JSON.parse(fs.readFileSync(cacheFile, "utf8"))

        // Populate the cache Map
        Object.entries(cacheData).forEach(([key, data]: [string, any]) => {
          controlValuesCache.set(key, data)
        })

        cacheLoaded = true
        console.log(`Loaded control values cache with ${controlValuesCache.size} entries`)
      } catch (parseError) {
        console.error("Error parsing cache file:", parseError)
      }
    }

    // Initialize with defaults if cache wasn't loaded or is empty
    if (!cacheLoaded || controlValuesCache.size === 0) {
      console.log("No cache file found or empty cache, initializing with defaults")
      initializeControlValuesCache()
    }
  } catch (error) {
    console.error("Error loading control values cache:", error)
    // Still initialize with defaults if loading fails
    initializeControlValuesCache()
  }
}

// Call this on startup
loadControlValuesCache()

// Updated InfluxDB configuration with hardcoded values
export const INFLUXDB_URL = "http://localhost:8181"
export const INFLUXDB_DATABASE = "Locations"

// Helper function to fetch metrics from Firebase RTDB
export async function fetchMetricsFromFirebase(locationId: string, equipmentId: string) {
  try {
    logEquipment(equipmentId, `Fetching metrics from Firebase RTDB`);

    // Get RTDB instance
    const rtdb = await getSecondaryDb()
    if (!rtdb) {
      throw new Error("Firebase RTDB not initialized")
    }

    // Import Firebase RTDB functions
    const { ref, get } = await import("firebase/database")

    // First try the traditional metrics path
    const metricsRef = ref(rtdb, `metrics/${locationId}/${equipmentId}`)
    let metricsSnap = await get(metricsRef)

    // If not found, try with the locations path structure
    if (!metricsSnap.exists()) {
      logEquipment(equipmentId, `No metrics found at metrics/${locationId}/${equipmentId}, trying alternate path`);

      // Try to get the equipment document from Firestore to find its system name
      try {
        const equipRef = doc(db, "equipment", equipmentId)
        const equipSnap = await getDoc(equipRef)

        if (equipSnap.exists()) {
          const equipData = equipSnap.data()
          const systemName = equipData.system || equipData.type || ""

          if (systemName) {
            // Try the locations path for metrics
            const locationsMetricsRef = ref(rtdb, `locations/${locationId}/systems/${systemName}/metrics`)
            metricsSnap = await get(locationsMetricsRef)

            if (metricsSnap.exists()) {
              logEquipment(equipmentId, `Found metrics at alternate path: locations/${locationId}/systems/${systemName}/metrics`);
            }
          } else {
            // If no system name, directly search locations for this equipment
            const locationsPath = `locations/${locationId}`
            const locationsRef = ref(rtdb, locationsPath)
            const locationsSnap = await get(locationsRef)

            if (locationsSnap.exists()) {
              const locationsData = locationsSnap.val()

              // Look for systems that might contain the equipment
              if (locationsData.systems) {
                for (const [systemName, systemData] of Object.entries(locationsData.systems)) {
                  // Check if this system has metrics
                  if (systemData.metrics) {
                    logEquipment(equipmentId, `Found metrics for system: ${systemName}`);
                    metricsSnap = { exists: () => true, val: () => systemData.metrics }
                    break
                  }
                }
              }
            }
          }
        }
      } catch (firestoreError) {
        console.error(`Error getting equipment from Firestore: ${firestoreError}`)
      }
    }

    const metrics = metricsSnap.exists() ? metricsSnap.val() : {}
    logEquipment(equipmentId, `Retrieved ${Object.keys(metrics).length} metrics from Firebase RTDB`);
    return metrics;
  } catch (error) {
    console.error(`Error fetching metrics from Firebase RTDB: ${error}`)
    return {}
  }
}

// Helper function to fetch control values from Firebase RTDB
export async function fetchControlValuesFromFirebase(locationId: string, equipmentId: string) {
  try {
    logEquipment(equipmentId, `Fetching control values from Firebase RTDB`);

    // Get RTDB instance
    const rtdb = await getSecondaryDb()
    if (!rtdb) {
      throw new Error("Firebase RTDB not initialized")
    }

    // Import Firebase RTDB functions
    const { ref, get } = await import("firebase/database")

    // First try the traditional path
    const controlValuesRef = ref(rtdb, `control_values/${locationId}/${equipmentId}`)
    let controlValuesSnap = await get(controlValuesRef)

    // If not found, try with the locations path structure
    if (!controlValuesSnap.exists()) {
      logEquipment(equipmentId, `No control values found at control_values/${locationId}/${equipmentId}, trying alternate path`);

      // Try to get the equipment document from Firestore to find its system name
      try {
        const equipRef = doc(db, "equipment", equipmentId)
        const equipSnap = await getDoc(equipRef)

        if (equipSnap.exists()) {
          const equipData = equipSnap.data()
          const systemName = equipData.system || equipData.type || ""

          if (systemName) {
            // Try to get control values from the system itself (not in a "control_values" subpath)
            const locationSystemRef = ref(rtdb, `locations/${locationId}/systems/${systemName}`)
            controlValuesSnap = await get(locationSystemRef)

            if (controlValuesSnap.exists()) {
              logEquipment(equipmentId, `Found control values at alternate path: locations/${locationId}/systems/${systemName}`);
            }
          } else {
            // If no system name, directly search locations for this equipment
            const locationsPath = `locations/${locationId}`
            const locationsRef = ref(rtdb, locationsPath)
            const locationsSnap = await get(locationsRef)

            if (locationsSnap.exists()) {
              const locationsData = locationsSnap.val()

              // Look for systems that might contain the equipment
              if (locationsData.systems) {
                for (const [systemName, systemData] of Object.entries(locationsData.systems)) {
                  // Check if this system matches what we're looking for
                  logEquipment(equipmentId, `Found system: ${systemName}`);
                  controlValuesSnap = { exists: () => true, val: () => systemData }
                  break
                }
              }
            }
          }
        }
      } catch (firestoreError) {
        console.error(`Error getting equipment from Firestore: ${firestoreError}`)
      }
    }

    const controlValues = controlValuesSnap.exists() ? controlValuesSnap.val() : {}

    // Remove customLogic field if present
    if (controlValues.customLogic) {
      logEquipment(equipmentId, `Removing customLogic field from Firebase results as requested`);
      delete controlValues.customLogic
    }

    logEquipment(equipmentId, `Retrieved ${Object.keys(controlValues).length} control values from Firebase RTDB`);
    return controlValues
  } catch (error) {
    console.error(`Error fetching control values from Firebase RTDB: ${error}`)
    return {}
  }
}

// Helper function to fetch metrics from InfluxDB "Locations" bucket
export async function fetchMetricsFromLocationsInfluxDB(
  locationId: string,
  equipmentId: string,
  equipmentType?: string,
) {
  try {
    logEquipment(equipmentId, `Fetching metrics from InfluxDB Locations bucket`);

    // Use SQL query for InfluxDB 3 with proper time constraints
    const sqlQuery = `SELECT * FROM "metrics"
                     WHERE "equipmentId"='${equipmentId}'
                     AND time > now() - INTERVAL '5 minutes'
                     ORDER BY time DESC LIMIT 10`;

    const response = await fetch(`${INFLUXDB_URL}/api/v3/query_sql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: sqlQuery,
        db: INFLUXDB_DATABASE
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch metrics from Locations bucket: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    // If no data found, try with a longer time range as a fallback
    let fallbackData = []
    if (!data || data.length === 0) {
      const fallbackQuery = `SELECT * FROM "metrics"
                            WHERE "equipmentId"='${equipmentId}'
                            AND time > now() - INTERVAL '1 hour'
                            ORDER BY time DESC LIMIT 5`;

      const fallbackResponse = await fetch(`${INFLUXDB_URL}/api/v3/query_sql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: fallbackQuery,
          db: INFLUXDB_DATABASE
        }),
      });

      if (fallbackResponse.ok) {
        fallbackData = await fallbackResponse.json();
        if (fallbackData && fallbackData.length > 0) {
          data.push(...fallbackData);
        }
      }
    }

    // Process the JSON data from InfluxDB 3
    const metrics = {}

    if (Array.isArray(data) && data.length > 0) {
      // Extract all fields from the response
      for (const row of data) {
        // Get each field from the row and add it to the metrics object
        Object.entries(row).forEach(([key, value]) => {
          // Skip time field and internal fields
          if (key !== 'time' && !key.startsWith('_')) {
            // Try to convert numeric values
            if (typeof value === 'string' && !isNaN(Number(value))) {
              metrics[key] = Number(value)
            } else if (value === 'true' || value === 'false') {
              metrics[key] = value === 'true'
            } else {
              metrics[key] = value
            }
          }
        })

        // Extract system name if available
        if (row.system) {
          metrics.system = row.system
        }

        // Extract location name if available
        if (row.location) {
          metrics.locationName = row.location
        }
      }
    }

    // If we got metrics from InfluxDB, return them
    if (Object.keys(metrics).length > 0) {
      logEquipment(equipmentId, `Retrieved ${Object.keys(metrics).length} metrics from InfluxDB Locations bucket`);
      return metrics
    }

    // If no metrics from InfluxDB Locations, fall back to Firebase
    logEquipment(equipmentId, `No metrics found in InfluxDB Locations bucket, falling back to Firebase RTDB`);
    return await fetchMetricsFromFirebase(locationId, equipmentId)
  } catch (error) {
    console.error(`Error fetching metrics from InfluxDB Locations bucket: ${error}`)
    logEquipment(equipmentId, `Falling back to Firebase RTDB`);
    return await fetchMetricsFromFirebase(locationId, equipmentId)
  }
}

// Helper function to fetch metrics from InfluxDB with fallback to Firebase
export async function fetchMetricsFromInfluxDB(locationId: string, equipmentId: string) {
  try {
    logEquipment(equipmentId, `Fetching metrics from InfluxDB`);

    // Use SQL query for InfluxDB 3 with proper time constraints
    const sqlQuery = `SELECT * FROM "metrics"
                      WHERE "location"='${locationId}'
                      AND "equipmentId"='${equipmentId}'
                      AND time > now() - INTERVAL '5 minutes'
                      ORDER BY time DESC LIMIT 10`;

    // Use the SQL API endpoint
    const response = await fetch(`${INFLUXDB_URL}/api/v3/query_sql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: sqlQuery,
        db: INFLUXDB_DATABASE
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch metrics from InfluxDB: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    // Process the JSON data from InfluxDB 3
    const metrics = {}

    if (Array.isArray(data) && data.length > 0) {
      // Extract all fields from the response
      for (const row of data) {
        // Get each field from the row and add it to the metrics object
        Object.entries(row).forEach(([key, value]) => {
          // Skip time field and internal fields
          if (key !== 'time' && !key.startsWith('_')) {
            // Try to convert numeric values
            if (typeof value === 'string' && !isNaN(Number(value))) {
              metrics[key] = Number(value)
            } else if (value === 'true' || value === 'false') {
              metrics[key] = value === 'true'
            } else {
              metrics[key] = value
            }
          }
        })
      }
    }

    // If we got metrics from InfluxDB, return them
    if (Object.keys(metrics).length > 0) {
      logEquipment(equipmentId, `Retrieved ${Object.keys(metrics).length} metrics from InfluxDB`);
      return metrics
    }

    // If no metrics from InfluxDB, fall back to Firebase RTDB
    logEquipment(equipmentId, `No metrics found in InfluxDB, falling back to Firebase RTDB`);
    return await fetchMetricsFromFirebase(locationId, equipmentId)
  } catch (error) {
    console.error(`Error fetching metrics from InfluxDB: ${error}`)
    logEquipment(equipmentId, `Falling back to Firebase RTDB for metrics`);
    return await fetchMetricsFromFirebase(locationId, equipmentId)
  }
}

// Helper function to fetch control values from InfluxDB - OPTIMIZED
export async function fetchControlValuesFromInfluxDB(locationId: string, equipmentId: string) {
  try {
    // First try to determine the equipment type to guide our optimization
    let equipmentType = await determineEquipmentType(locationId, equipmentId);
    logEquipment(equipmentId, `Determined equipment type for query optimization: ${equipmentType}`);

    // Create an object to store the control settings
    const controlSettings: any = {};

    // Get core metrics data first (which is efficient - one query for many fields)
    const metricsQuery = `SELECT * FROM "metrics"
                          WHERE "equipmentId"='${equipmentId}'
                          AND time > now() - INTERVAL '5 minutes'
                          ORDER BY time DESC LIMIT 1`;

    const metricsResponse = await fetch(`${INFLUXDB_URL}/api/v3/query_sql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: metricsQuery,
        db: INFLUXDB_DATABASE
      }),
    });

    if (metricsResponse.ok) {
      const metricsData = await metricsResponse.json();

      if (Array.isArray(metricsData) && metricsData.length > 0) {
        const metrics = metricsData[0];

        // Process common fields from metrics
        processCommonMetricsFields(metrics, controlSettings, equipmentId);

        // Also extract equipment_type if available but not already determined
        if (!equipmentType && metrics.equipment_type) {
          equipmentType = metrics.equipment_type;
          logEquipment(equipmentId, `Updated equipment type from metrics: ${equipmentType}`);
        }
      }
    }

    // Only query for control command records that are relevant to this equipment type
    const normalizedType = equipmentType ? equipmentType.toLowerCase() : "";
    let relevantCommands = getRelevantCommandsForType(normalizedType);

    logEquipment(equipmentId, `Querying only for ${relevantCommands.length} relevant commands for ${normalizedType}`);

    // Fetch the relevant command history
    for (const command of relevantCommands) {
      await fetchCommandHistory(locationId, equipmentId, command, controlSettings);
    }

    // Apply appropriate defaults for any missing fields
    applyDefaults(controlSettings, normalizedType, locationId);

    return controlSettings;
  } catch (error) {
    console.error(`Error fetching control values from InfluxDB: ${error}`);

    // Return minimal default values needed for the logic to work
    return {
      temperatureSetpoint: 72,
      temperatureSource: locationId === "4" ? "supply" : "space",
      customLogicEnabled: true,
    };
  }
}

// Helper function to process common fields from metrics
function processCommonMetricsFields(metrics: any, controlSettings: any, equipmentId: string) {
  // Process temperature setpoint
  if (metrics.temperature_setpoint !== undefined) {
    controlSettings.temperatureSetpoint = parseFloat(metrics.temperature_setpoint);
    logEquipment(equipmentId, `Using user-defined temperature setpoint: ${controlSettings.temperatureSetpoint}°F`);
  } else if (metrics.Setpoint !== undefined) {
    controlSettings.temperatureSetpoint = metrics.Setpoint;
    logEquipment(equipmentId, `Using temperature setpoint from database: ${controlSettings.temperatureSetpoint}°F`);
  }

  // Get custom logic enabled flag
  let customLogicEnabled = metrics.CustomLogicEnabled || metrics.custom_logic_enabled;
  if (customLogicEnabled !== undefined) {
    if (typeof customLogicEnabled === "string") {
      customLogicEnabled = customLogicEnabled === "true";
    }
    controlSettings.customLogicEnabled = customLogicEnabled;
  }

  // Get temperature source
  let temperatureSource = metrics.TemperatureSource || metrics.temperature_source;
  if (temperatureSource !== undefined) {
    controlSettings.temperatureSource = temperatureSource;
  }

  // Process equipment-specific fields from metrics
  if (metrics.IsLead !== undefined) controlSettings.isLead = metrics.IsLead ? 1 : 0;
  if (metrics.PumpAmps !== undefined) controlSettings.pumpAmps = metrics.PumpAmps;
  if (metrics.Pump_Status !== undefined) controlSettings.pumpStatus = metrics.Pump_Status;

  // Check for fan-coil specific fields
  if (metrics.fanEnabled !== undefined) controlSettings.fanEnabled = metrics.fanEnabled === true;
  if (metrics.fanSpeed !== undefined) controlSettings.fanSpeed = metrics.fanSpeed;
  if (metrics.fanMode !== undefined) controlSettings.fanMode = metrics.fanMode;
}

// Helper function to determine equipment type
async function determineEquipmentType(locationId: string, equipmentId: string): Promise<string> {
  try {
    // Try from Firestore first (should be cached for most equipment)
    try {
      const equipRef = doc(db, "equipment", equipmentId);
      const equipSnap = await getDoc(equipRef);
      if (equipSnap.exists()) {
        const equipData = equipSnap.data();
        return equipData.type || equipData.equipmentType || "";
      }
    } catch (firestoreError) {
      console.error(`Error getting equipment from Firestore: ${firestoreError}`);
    }

    // If not in Firestore, try metrics
    const metricsQuery = `SELECT equipment_type FROM "metrics"
                          WHERE "equipmentId"='${equipmentId}'
                          AND time > now() - INTERVAL '5 minutes'
                          ORDER BY time DESC LIMIT 1`;

    const response = await fetch(`${INFLUXDB_URL}/api/v3/query_sql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: metricsQuery,
        db: INFLUXDB_DATABASE
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0 && data[0].equipment_type) {
        return data[0].equipment_type;
      }
    }

    // Return empty string if not found
    return "";
  } catch (error) {
    console.error(`Error determining equipment type: ${error}`);
    return "";
  }
}

// Helper function to get relevant command history for equipment type
function getRelevantCommandsForType(equipmentType: string): string[] {
  // Common commands needed for all equipment types
  const commonCommands = ["temperatureSetpoint", "temperature_setpoint", "unitEnable", "temperatureSource", "customLogicEnabled"];

  // Pump-specific commands
  if (equipmentType.includes("pump")) {
    return [
      ...commonCommands,
      "isLead",
      "pumpRuntime",
      "groupId"
    ];
  }

  // Fan coil specific commands
  else if (equipmentType.includes("fan-coil") || equipmentType.includes("fancoil")) {
    return [
      ...commonCommands,
      "fanSpeed",
      "fanMode",
      "fanEnabled",
      "heatingValvePosition",
      "coolingValvePosition",
      "heatingValveMode",
      "coolingValveMode",
      "operationMode",
      "outdoorDamperPosition"
    ];
  }

  // Boiler specific commands
  else if (equipmentType.includes("boiler")) {
    return [
      ...commonCommands,
      "firing",
      "firingRate",
      "waterTempSetpoint",
      "boilerRuntime",
      "boilerType",
      "isLead",
      "groupId"
    ];
  }

  // Chiller specific commands
  else if (equipmentType.includes("chiller")) {
    return [
      ...commonCommands,
      "waterTempSetpoint",
      "isLead",
      "chillerRuntime",
      "groupId",
      "operationMode"
    ];
  }

  // If equipment type not recognized or empty, return essential commands
  // This ensures we always get at least the basic necessary fields
  return [
    "temperatureSetpoint",
    "temperatureSource",
    "unitEnable",
    "isLead",
    "groupId"
  ];
}

// Helper function to fetch a single command's history
async function fetchCommandHistory(locationId: string, equipmentId: string, command: string, controlSettings: any) {
  try {
    const commandQuery = `SELECT * FROM "update_${command}"
                          WHERE "equipment_id"='${equipmentId}'
                          AND "location_id"='${locationId}'
                          AND time > now() - INTERVAL '5 minutes'
                          ORDER BY time DESC LIMIT 1`;

    const commandResponse = await fetch(`${INFLUXDB_URL}/api/v3/query_sql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: commandQuery,
        db: INFLUXDB_DATABASE
      }),
    });

    if (commandResponse.ok) {
      const commandData = await commandResponse.json();
      if (Array.isArray(commandData) && commandData.length > 0 && commandData[0].value !== undefined) {
        // Convert numeric strings to numbers
        let value = commandData[0].value;
        if (typeof value === 'string' && !isNaN(Number(value))) {
          value = parseFloat(value);
        }

        controlSettings[command] = value;
        logEquipment(equipmentId, `Found command value for ${command}: ${value}`);
      }
    }
  } catch (error) {
    console.error(`Error querying for command ${command}: ${error}`);
  }
}

// Helper function to apply default values for missing fields
function applyDefaults(controlSettings: any, equipmentType: string, locationId: string) {
  // Apply common defaults
  if (!controlSettings.temperatureSetpoint) {
    controlSettings.temperatureSetpoint = 72;
  }

  if (!controlSettings.temperatureSource) {
    controlSettings.temperatureSource = locationId === "4" ? "supply" : "space";
  }

  if (controlSettings.customLogicEnabled === undefined) {
    controlSettings.customLogicEnabled = true;
  }

  if (controlSettings.unitEnable === undefined) {
    controlSettings.unitEnable = true;
  }

  // Apply equipment-specific defaults based on type
  if (equipmentType.includes("pump")) {
    if (controlSettings.isLead === undefined) {
      controlSettings.isLead = 0; // Default to not lead
    }

    if (controlSettings.pumpRuntime === undefined) {
      controlSettings.pumpRuntime = 0;
    }
  }

  else if (equipmentType.includes("fan-coil") || equipmentType.includes("fancoil")) {
    if (controlSettings.fanEnabled === undefined) {
      controlSettings.fanEnabled = true;
    }

    if (controlSettings.fanSpeed === undefined) {
      controlSettings.fanSpeed = "low";
    }

    if (controlSettings.fanMode === undefined) {
      controlSettings.fanMode = "auto";
    }

    if (controlSettings.heatingValvePosition === undefined) {
      controlSettings.heatingValvePosition = 0;
    }

    if (controlSettings.coolingValvePosition === undefined) {
      controlSettings.coolingValvePosition = 0;
    }
  }

  else if (equipmentType.includes("boiler")) {
    if (controlSettings.firing === undefined) {
      controlSettings.firing = 0;
    }

    if (controlSettings.firingRate === undefined) {
      controlSettings.firingRate = 0;
    }

    if (controlSettings.waterTempSetpoint === undefined) {
      controlSettings.waterTempSetpoint = 120;
    }
  }
}

// Also modify the sendControlCommand function to update the cache when sending commands
export async function sendControlCommand(command: string, commandData: any) {
  try {
    const equipId = commandData.equipmentId;
    logEquipment(equipId, `Sending control command: ${command} with value: ${commandData.value}`);

    // Use your production URL from the environment variables
    const baseUrl = "https://neuralbms.automatacontrols.com"
    const response = await fetch(`${baseUrl}/api/control-commands`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        command,
        ...commandData,
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to send command: ${response.status} ${response.statusText}`)
    }

    // Update the cache with the new command value - use renamed variables to avoid redeclaration
    const { equipmentId: eqId, locationId, value, commandType } = commandData
    if (eqId && locationId && commandType) {
      const cacheKey = `${locationId}_${eqId}`
      const cachedData = controlValuesCache.get(cacheKey)

      if (cachedData) {
        // Update the specific field in the cached values
        cachedData.values[commandType] = value
        cachedData.timestamp = Date.now()
        controlValuesCache.set(cacheKey, cachedData)
        logEquipment(equipId, `Updated cache for ${eqId} with new ${commandType} = ${value}`);
      }
    }

    return await response.json()
  } catch (error) {
    console.error(`Error sending control command: ${error}`)
    return { success: false, error: String(error) }
  }
}

/**
 * Helper function to get the base implementation for a given equipment type
 * @param normalizedType The normalized equipment type
 * @returns The base implementation for the equipment type
 */
function getBaseImplementation(normalizedType: string) {
  console.log(`Using base implementation for ${normalizedType}`);
  if (normalizedType === "fan-coil") return fanCoilControlBase;
  if (normalizedType === "boiler") return boilerControlBase;
  if (normalizedType === "pump" || normalizedType === "hwpump" || normalizedType === "cwpump") return pumpControlBase;
  if (normalizedType === "chiller") return chillerControlBase;
  if (normalizedType === "air-handler") return airHandlerControlBase;
  if (normalizedType === "steam-bundle") return steamBundleControlBase;
  return null;
}

// Helper function for evaluating custom logic - DIRECT IMPLEMENTATION SELECTION
export function evaluateCustomLogic(sandbox: any, pidState: any, equipmentType?: string): LogicEvaluation | null {
  try {
    const equipmentId = sandbox.settings.equipmentId || "unknown";

    // Log the equipment type we received from settings
    logEquipment(equipmentId, `Initial equipment type from settings: ${equipmentType || "unknown"}`);

    // IMPORTANT FIX: Check if metrics has equipment_type field - prioritize this over settings
    if (sandbox.metrics && sandbox.metrics.equipment_type) {
      const metricsType = sandbox.metrics.equipment_type;
      logEquipment(equipmentId, `Found equipment_type in metrics: ${metricsType}, overriding settings type`);
      equipmentType = metricsType;
    }

    // Log the final equipment type after checking metrics
    logEquipment(equipmentId, `Final equipment type after checking metrics: ${equipmentType || "unknown"}`);

    // Get the location ID and equipment ID for location-based control
    const locationId = sandbox.settings.locationId; // Don't default to any location

    logEquipment(equipmentId, `Processing equipment ID: ${equipmentId}, type: ${equipmentType}, location: ${locationId}`);

    // DIRECTLY SELECT THE CONTROL FUNCTION HERE INSTEAD OF CALLING OUT TO equipment-logic/index.ts
    // Normalize the equipment type
    let normalizedType = equipmentType ? equipmentType.toLowerCase().replace(/[^a-z0-9]/g, "-") : "";

    // IMPORTANT: Better pump type normalization to handle both "pump" and "hotwater_pump"
    if (normalizedType === "pump" ||
        normalizedType === "hotwater-pump" ||
        normalizedType.includes("hwpump") ||
        normalizedType.includes("hot-water")) {
      logEquipment(equipmentId, `Normalizing pump type: ${normalizedType} -> "pump"`);
      normalizedType = "pump";
    }

    // Select the appropriate control function based on location and equipment type
    let controlFunction;

    // First check if we have a valid locationId
    if (!locationId) {
      logEquipment(equipmentId, `WARNING: No location ID provided. Using base implementation for ${normalizedType}`);
      // Fallback to base implementation when locationId is missing
      controlFunction = getBaseImplementation(normalizedType);
    } else {
      // Now we have a locationId, use it to select the correct implementation
      logEquipment(equipmentId, `Looking for implementation for ${normalizedType} at location ${locationId}`);

      // Warren (ID: 1)
      if (locationId === "1") {
        logEquipment(equipmentId, `Using Warren-specific implementation for ${normalizedType}`);
        if (normalizedType === "fan-coil") controlFunction = fanCoilControlWarren;
        else if (normalizedType === "pump" || normalizedType === "hwpump" || normalizedType === "cwpump") controlFunction = pumpControlWarren;
        else if (normalizedType === "air-handler") controlFunction = airHandlerControlWarren;
        else if (normalizedType === "steam-bundle") controlFunction = steamBundleControlWarren;
        else controlFunction = getBaseImplementation(normalizedType);
      }
      // Hopebridge (ID: 5)
      else if (locationId === "5") {
        logEquipment(equipmentId, `Using Hopebridge-specific implementation for ${normalizedType}`);
        if (normalizedType === "boiler") controlFunction = boilerControlHopebridge;
        else if (normalizedType === "air-handler") controlFunction = airHandlerControlHopebridge;
        else controlFunction = getBaseImplementation(normalizedType);
      }
      // Huntington (ID: 4)
      else if (locationId === "4") {
        logEquipment(equipmentId, `Using Huntington-specific implementation for ${normalizedType}`);
        if (normalizedType === "fan-coil") controlFunction = fanCoilControlHuntington;
        else if (normalizedType === "boiler") controlFunction = boilerControlHuntington;
        else if (normalizedType === "pump" || normalizedType === "hwpump" || normalizedType === "cwpump") controlFunction = pumpControlHuntington;
        else if (normalizedType === "chiller") controlFunction = chillerControlHuntington;
        else controlFunction = getBaseImplementation(normalizedType);
      }
      // Other locations - use base implementation
      else {
        logEquipment(equipmentId, `No specific implementation for ${normalizedType} at location ${locationId}, using base implementation`);
        controlFunction = getBaseImplementation(normalizedType);
      }
    }

    if (!controlFunction) {
      logEquipment(equipmentId, `ERROR: No control function found for equipment type: ${equipmentType}`);
      return {
        error: `No control function available for equipment type: ${equipmentType}`,
        result: null,
        hasChanges: false,
        timestamp: Date.now(),
      }
    }

    // Force temperatureSource to "supply" for location 4
    if (locationId === "4" && sandbox.settings) {
      sandbox.settings.temperatureSource = "supply"
    }

    // Determine which temperature to use based on location
    let currentTemp;
    let temperatureSourceLabel;
    let temperatureSourceField;

    // First check if we have the Supply field from the database view
    if (sandbox.metrics.H2OSupply !== undefined) {
      currentTemp = sandbox.metrics.H2OSupply
      temperatureSourceField = "H2OSupply"
      temperatureSourceLabel = "SUPPLY"
    } else if (sandbox.metrics.H2OReturn !== undefined) {
      currentTemp = sandbox.metrics.H2OReturn
      temperatureSourceField = "H2OReturn"
      temperatureSourceLabel = "RETURN"
    } else if (sandbox.metrics.Supply !== undefined) {
      currentTemp = sandbox.metrics.Supply
      temperatureSourceField = "Supply"
      temperatureSourceLabel = "SUPPLY"
    }
    // Then check if we have the measurement field from the database view
    else if (sandbox.metrics.measurement !== undefined) {
      currentTemp = sandbox.metrics.measurement
      temperatureSourceField = "measurement"
      temperatureSourceLabel = "MEASUREMENT"
    }

    // Otherwise use location-based fallbacks
    else if (locationId === "4") {
      // Heritage Pointe of Huntington - use supply temperature
      const tempFields = [
        "SupplyTemp",
        "supplyTemp",
        "supplyTemperature",
        "SupplyTemperature",
        "discharge",
        "Discharge",
        "dischargeTemp",
        "DischargeTemp",
        "dischargeTemperature",
        "DischargeTemperature",
        "SAT",
        "sat",
      ]

      // Find the first field that exists in metrics
      temperatureSourceField = tempFields.find((field) => sandbox.metrics[field] !== undefined)
      currentTemp = temperatureSourceField ? sandbox.metrics[temperatureSourceField] : 55
      temperatureSourceLabel = "SUPPLY"
    } else {
      // Warren (locationId: "1") or other locations - use zone temperature
      const tempFields = [
        "roomTemp",
        "RoomTemp",
        "roomTemperature",
        "RoomTemperature",
        "spaceTemp",
        "SpaceTemp",
        "zoneTemp",
        "ZoneTemp",
        "ZoneTemperature",
        "zone_temperature",
        "room_temperature",
      ]

      // Find the first field that exists in metrics
      temperatureSourceField = tempFields.find((field) => sandbox.metrics[field] !== undefined)
      currentTemp = temperatureSourceField ? sandbox.metrics[temperatureSourceField] : 72
      temperatureSourceLabel = "SPACE"
    }

    // Try to get system name from multiple possible sources
    const systemName =
      sandbox.metrics.system ||
      sandbox.metrics.System ||
      sandbox.metrics.systemName ||
      sandbox.metrics.SystemName ||
      (sandbox.settings.system ? sandbox.settings.system : "unknown")

    // Fix the "Measurement: N/A°F" issue
    const measurementTemp = sandbox.metrics.measurement || sandbox.metrics.Measurement || "N/A"
    const measurementDisplay = measurementTemp === "N/A" ? "N/A" : `${measurementTemp}°F`
    const supplyTemp = sandbox.metrics.Supply || "N/A"
    const supplyDisplay = supplyTemp === "N/A" ? "N/A" : `${supplyTemp}°F`

    logEquipment(equipmentId, `Using ${temperatureSourceLabel} temperature: ${currentTemp}°F, Supply: ${supplyDisplay}, Measurement: ${measurementDisplay}`);

    // Make sure we pass the equipment ID and location ID in the settings
    if (!sandbox.settings.equipmentId) {
      sandbox.settings.equipmentId = equipmentId
    }

    if (!sandbox.settings.locationId) {
      sandbox.settings.locationId = locationId
    }

    // Try to get the result, handling both synchronous and asynchronous cases
    let result

    try {
      // Call the control function
      const controlResult = controlFunction(sandbox.metrics, sandbox.settings, currentTemp, pidState)

      // Check if the result is a Promise
      if (controlResult instanceof Promise) {
        // If it's a Promise, we have to use a fallback approach since we can't await here
        logEquipment(
          equipmentId,
          "WARNING: Control function returned a Promise but evaluateCustomLogic isn't async. Using fallback values.",
        );
        result = {
          firing: 0,
          firingRate: 0,
          waterTempSetpoint: 70, // Safe default temperature
          unitEnable: false, // Default to off for safety
        }
      } else {
        // It's a synchronous result, use it directly
        result = controlResult
      }
    } catch (error) {
      console.error("Error calling control function:", error)
      result = {
        firing: 0,
        firingRate: 0,
        waterTempSetpoint: 70,
        unitEnable: false,
      }
    }

    // If this is a boiler, only return the specific fields needed for boiler control
    if (equipmentType?.toLowerCase() === "boiler") {
      // Extract only the boiler-specific fields, ensuring no undefined values
      const boilerResult = {
        firingRate: result.firing || result.firingRate || 0,
        waterTempSetpoint: typeof result.waterTempSetpoint === "number" ? result.waterTempSetpoint : 70,
        unitEnable: result.unitEnable === true ? true : false,
      }

      logEquipment(equipmentId, `Boiler control result (filtered):`, boilerResult);
      result = boilerResult
    }

    logEquipment(equipmentId, `Logic evaluation result:`, result);

    return {
      result,
      hasChanges: true,
      timestamp: Date.now(),
    }
  } catch (error) {
    console.error("Error in evaluateCustomLogic:", error)
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      result: null,
      hasChanges: false,
      timestamp: Date.now(),
    }
  }
}

// Helper function to get all equipment with custom logic enabled
export async function getEquipmentWithCustomLogic() {
  try {
    console.log("Fetching all equipment with custom logic enabled from Firestore");
    const equipmentList = [];

    // Use Firestore collection query to get all equipment
    const { collection, query, where, getDocs } = await import("firebase/firestore");

    // Get all equipment (we'll filter for custom logic later)
    const equipmentRef = collection(db, "equipment");
    const equipmentSnap = await getDocs(equipmentRef);

    // Filter for equipment that should have custom logic based on our criteria
    for (const doc of equipmentSnap.docs) {
      const equipment = {
        id: doc.id,
        ...doc.data()
      };

      // Use our helper function to determine if this equipment should run custom logic
      const shouldRun = shouldRunCustomLogic(
        equipment.id,
        equipment.type || equipment.equipmentType,
        equipment.locationId
      );

      if (shouldRun) {
        console.log(`Equipment ${equipment.id} (${equipment.name || "Unnamed"}) should run custom logic`);
        equipmentList.push(equipment);
      }
    }

    console.log(`Found ${equipmentList.length} equipment that should run custom logic`);
    return equipmentList;
  } catch (error) {
    console.error("Error getting equipment with custom logic:", error);
    return [];
  }
}

// Run logic for a specific piece of equipment
export async function runEquipmentLogic(equipmentId: string) {
  try {
    logEquipment(equipmentId, `Starting equipment logic processing`);

    // Get the equipment document from Firestore to determine its type and location
    const equipmentRef = doc(db, "equipment", equipmentId);
    const equipmentSnap = await getDoc(equipmentRef);

    if (!equipmentSnap.exists()) {
      logEquipment(equipmentId, `ERROR: Equipment not found in Firestore`);
      return {
        equipmentId,
        success: false,
        error: "Equipment not found",
        timestamp: Date.now(),
      };
    }

    const equipment = {
      id: equipmentId,
      ...equipmentSnap.data()
    };

    const equipmentType = equipment.type || equipment.equipmentType || "unknown";
    const locationId = equipment.locationId || "4"; // Default to Huntington

    logEquipment(equipmentId, `Starting logic execution - type=${equipmentType}, location=${locationId}`);

    // Check if custom logic should run for this equipment
    const shouldRun = shouldRunCustomLogic(equipmentId, equipmentType, locationId);

    if (!shouldRun) {
      logEquipment(equipmentId, `Custom logic not enabled for this equipment`);
      return {
        equipmentId,
        name: equipment.name || "Unknown",
        success: true,
        message: "Custom logic not enabled for this equipment",
        noChanges: true,
        timestamp: Date.now(),
      };
    }

    // Fetch metrics for this equipment from InfluxDB (with Firebase fallback)
    const metrics = await fetchMetricsFromLocationsInfluxDB(locationId, equipmentId, equipmentType);

    // Fetch control settings for this equipment from InfluxDB (with defaults)
    const controlSettings = await fetchControlValuesFromInfluxDB(locationId, equipmentId);

    // Get PID state from global storage or initialize empty
    const cacheKey = `${locationId}_${equipmentId}`;
    let pidState = pidStateStorage.get(cacheKey) || {};

    // Use cached settings if available
    const cachedData = controlValuesCache.get(cacheKey);
    let settings = {
      ...cachedData?.values,
      ...controlSettings,
      equipmentId,
      locationId,
      equipmentType,
    };

    // Check if custom logic is enabled from metrics or settings
    const customLogicEnabled =
      (metrics.CustomLogicEnabled !== undefined ? !!metrics.CustomLogicEnabled :
       settings.customLogicEnabled !== undefined ? !!settings.customLogicEnabled : true);

    if (!customLogicEnabled) {
      logEquipment(equipmentId, `Custom logic explicitly disabled for equipment`);
      return {
        equipmentId,
        name: equipment.name || "Unknown",
        success: true,
        message: "Custom logic explicitly disabled for this equipment",
        noChanges: true,
        timestamp: Date.now(),
      };
    }

    // Create sandbox environment for logic execution
    const sandbox = {
      metrics,
      settings,
      // Include any other necessary context
    };

    // Execute the custom logic
    logEquipment(equipmentId, `Evaluating custom logic for equipment type: ${equipmentType}`);
    const logicResult = evaluateCustomLogic(sandbox, pidState, equipmentType);

    // Check if there was an error in the logic
    if (logicResult?.error) {
      logEquipment(equipmentId, `Error in custom logic: ${logicResult.error}`);
      return {
        equipmentId,
        name: equipment.name || "Unknown",
        success: false,
        error: logicResult.error,
        timestamp: Date.now(),
      };
    }

    // Check if there were any changes from the logic
    if (!logicResult?.hasChanges) {
      logEquipment(equipmentId, `No changes from custom logic`);
      return {
        equipmentId,
        name: equipment.name || "Unknown",
        success: true,
        message: "No changes needed",
        noChanges: true,
        timestamp: Date.now(),
      };
    }

    // Apply the changes from the logic result
    const commands = [];
    const result = logicResult.result || {};

    // Store the PID state for the next run
    pidStateStorage.set(cacheKey, pidState);

    // Update cache with the new values
    if (cachedData) {
      Object.assign(cachedData.values, result);
      cachedData.timestamp = Date.now();
      controlValuesCache.set(cacheKey, cachedData);
    }

    // Process each command based on equipment type
    if (equipmentType.toLowerCase() === "boiler") {
      // Special handling for boilers
      if (result.firingRate !== undefined) {
        commands.push({
          command: "update_firingRate",
          equipmentId,
          locationId,
          commandType: "firingRate",
          value: result.firingRate,
        });
      }

      if (result.waterTempSetpoint !== undefined) {
        commands.push({
          command: "update_waterTempSetpoint",
          equipmentId,
          locationId,
          commandType: "waterTempSetpoint",
          value: result.waterTempSetpoint,
        });
      }

      if (result.unitEnable !== undefined) {
        commands.push({
          command: "update_unitEnable",
          equipmentId,
          locationId,
          commandType: "unitEnable",
          value: result.unitEnable,
        });
      }
    } else {
      // Fan coil units and other equipment
      for (const [key, value] of Object.entries(result)) {
        commands.push({
          command: `update_${key}`,
          equipmentId,
          locationId,
          commandType: key,
          value,
        });
      }
    }

    // Send all commands to the control API
    logEquipment(equipmentId, `Sending ${commands.length} commands`);
    const commandResults = [];

    for (const cmd of commands) {
      try {
        const cmdResult = await sendControlCommand(cmd.command, cmd);
        commandResults.push({
          command: cmd.command,
          success: cmdResult.success,
          error: cmdResult.error,
        });
      } catch (cmdError) {
        console.error(`Error sending command ${cmd.command}: ${cmdError}`);
        commandResults.push({
          command: cmd.command,
          success: false,
          error: String(cmdError),
        });
      }
    }

    // Return success or failure based on commands
    const allCommandsSucceeded = commandResults.every(cmd => cmd.success);

    logEquipment(equipmentId, `Logic processing complete, took ${Date.now() - logicResult.timestamp}ms`);

    return {
      equipmentId,
      name: equipment.name || "Unknown",
      success: allCommandsSucceeded,
      commands: commandResults,
      changes: Object.keys(result).length,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error(`Error running logic for equipment ${equipmentId}:`, error);
    return {
      equipmentId,
      success: false,
      error: String(error),
      timestamp: Date.now(),
    };
  }
}

// Run logic for all equipment with custom logic enabled
export async function runAllEquipmentLogic() {
  try {
    const equipmentList = await getEquipmentWithCustomLogic();
    console.log(`Found ${equipmentList.length} equipment that should run custom logic`);

    // Initialize results array with pending status for all equipment
    const results: any[] = equipmentList.map(equipment => ({
      equipmentId: equipment.id,
      name: equipment.name || "Unknown",
      status: "queued",
      timestamp: Date.now(),
    }));

    // Clear existing queue to prevent duplication
   equipmentQueue.length = 0;

   // Process first equipment immediately, and queue the rest
   if (equipmentList.length > 0) {
     // Process first equipment immediately to get quick feedback
     try {
       console.log(`Processing first equipment immediately: ${equipmentList[0].id}`);
       const result = await runEquipmentLogic(equipmentList[0].id);
       // Update results for the first equipment
       const index = results.findIndex(r => r.equipmentId === equipmentList[0].id);
       if (index >= 0) {
         results[index] = result;
       }
     } catch (error) {
       console.error(`Error running logic for first equipment ${equipmentList[0].id}:`, error);
       const index = results.findIndex(r => r.equipmentId === equipmentList[0].id);
       if (index >= 0) {
         results[index] = {
           equipmentId: equipmentList[0].id,
           name: equipmentList[0].name || "Unknown",
           success: false,
           error: String(error),
           timestamp: Date.now(),
         };
       }
     }

     // Queue the rest for sequential processing
     if (equipmentList.length > 1) {
       console.log(`Queueing ${equipmentList.length - 1} additional equipment for sequential processing`);
       for (let i = 1; i < equipmentList.length; i++) {
         queueEquipmentLogic(equipmentList[i].id);
       }
     }
   }

   // Return results for the first equipment immediately, the rest will process in the background
   return {
     success: true,
     message: `Server logic execution completed for first equipment, ${equipmentList.length - 1} more queued for processing`,
     results,
     queuedCount: equipmentList.length - 1,
     timestamp: Date.now(),
   };
 } catch (error) {
   console.error("Error running logic for all equipment:", error);
   return {
     success: false,
     message: String(error),
     results: [],
     timestamp: Date.now(),
   };
 }
}

// Export the previously imported control functions for backward compatibility
export {
 fanCoilControlBase as fanCoilControl,
 boilerControlBase as boilerControl,
 pumpControlBase as pumpControl,
 chillerControlBase as chillerControl,
 airHandlerControlBase as airHandlerControl,
 steamBundleControlBase as steamBundleControl
};
