// lib/control-logic.ts
// Note: No 'use server' directive at the top - this is a regular library file

import { initializeApp, getApps } from "firebase/app"
import { getFirestore } from "firebase/firestore"
import { doc, getDoc } from "firebase/firestore"
import { getControlFunction } from "./equipment-logic"

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
  // Only run custom logic for specific equipment types we've completed
  const supportedTypes = ["fan-coil", "boiler"]

  // Only run for specific locations
  const supportedLocations = ["4"] // Huntington

  // Only run for specific equipment IDs (if you want to whitelist specific units)
  const supportedEquipment = [
    "BBHCLhaeItV7pIdinQzM", // Huntington Fan Coil
    "IEhoTqKphbvHb5fTanpP", // Huntington Fan Coil
    "ZLYR6YveSmCEMqtBSy3e", // Huntington Boiler - EXACT ID from screenshot
  ]

  // Check if equipment is in our supported lists
  const typeSupported = supportedTypes.includes(equipmentType?.toLowerCase())
  const locationSupported = supportedLocations.includes(locationId)
  const equipmentSupported = supportedEquipment.includes(equipmentId)

  // Only run if ALL conditions are met: supported type, location, and either all equipment of that type or specific IDs
  return (
    typeSupported &&
    locationSupported &&
    (equipmentSupported ||
      equipmentId.includes("FCU") ||
      equipmentId.toLowerCase().includes("fancoil") ||
      equipmentId.toLowerCase().includes("boiler"))
  )
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
    if (Object.keys(metrics).length > 0) {
      // Log key temperature metrics if they exist
      if (metrics.Supply !== undefined) logEquipment(equipmentId, `Firebase RTDB - Supply temperature: ${metrics.Supply}`);
      if (metrics.supplyTemp !== undefined) logEquipment(equipmentId, `Firebase RTDB - supplyTemp: ${metrics.supplyTemp}`);
      if (metrics.Outdoor_Air !== undefined) logEquipment(equipmentId, `Firebase RTDB - Outdoor_Air: ${metrics.Outdoor_Air}`);
      if (metrics.Mixed_Air !== undefined) logEquipment(equipmentId, `Firebase RTDB - Mixed_Air: ${metrics.Mixed_Air}`);
    }

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
// UPDATED to use InfluxDB 3 SQL API with proper time constraints
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

    // Log the query for debugging
    logEquipment(equipmentId, `Querying InfluxDB with: ${sqlQuery}`);

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
      throw new Error(`Failed to fetch metrics from Locations bucket: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    // Log first 200 chars for debugging
    if (data && data.length > 0) {
      logEquipment(equipmentId, `InfluxDB Locations response: Found ${data.length} rows`);

      // Log the first row to see what fields are available
      if (data[0]) {
        logEquipment(equipmentId, "First row data sample:", data[0]);
      }
    } else {
      logEquipment(equipmentId, `InfluxDB Locations response is empty, trying a broader time range`);
      
      // Try with a longer time range as a fallback
      const fallbackQuery = `SELECT * FROM "metrics" 
                            WHERE "equipmentId"='${equipmentId}' 
                            AND time > now() - INTERVAL '1 hour'
                            ORDER BY time DESC LIMIT 5`;
                            
      logEquipment(equipmentId, `Retry InfluxDB with broader time range: ${fallbackQuery}`);
      
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
        const fallbackData = await fallbackResponse.json();
        if (fallbackData && fallbackData.length > 0) {
          logEquipment(equipmentId, `Found ${fallbackData.length} metrics using broader time range`);
          data.push(...fallbackData);
        } else {
          logEquipment(equipmentId, `No metrics found in InfluxDB in the last hour`);
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

    // Log key temperature values if available
    if (metrics.Supply !== undefined) logEquipment(equipmentId, `InfluxDB - Supply temperature: ${metrics.Supply}`);
    if (metrics.supplyTemp !== undefined) logEquipment(equipmentId, `InfluxDB - supplyTemp: ${metrics.supplyTemp}`);
    if (metrics.Outdoor_Air !== undefined) logEquipment(equipmentId, `InfluxDB - Outdoor_Air: ${metrics.Outdoor_Air}`);
    if (metrics.Mixed_Air !== undefined) logEquipment(equipmentId, `InfluxDB - Mixed_Air: ${metrics.Mixed_Air}`);

    // If we got metrics from InfluxDB, return them
    if (Object.keys(metrics).length > 0) {
      logEquipment(equipmentId, `Retrieved ${Object.keys(metrics).length} metrics from InfluxDB Locations bucket`);
      logEquipment(equipmentId, `System name from database: ${metrics.system || "unknown"}`);
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
// UPDATED to use InfluxDB 3 SQL API with proper time constraints
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

// Helper function to fetch control values from InfluxDB
// UPDATED to use proper time constraint to avoid file limit errors
export async function fetchControlValuesFromInfluxDB(locationId: string, equipmentId: string) {
  try {
    // Use SQL query for InfluxDB 3 with proper time constraint
    const sqlQuery = `SELECT * FROM "metrics" 
                      WHERE "equipmentId"='${equipmentId}' 
                      AND time > now() - INTERVAL '5 minutes'
                      ORDER BY time DESC LIMIT 1`;

    logEquipment(equipmentId, `Querying metrics and settings from Locations bucket: ${sqlQuery}`);

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
      throw new Error(`Failed to fetch data from InfluxDB: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    logEquipment(equipmentId, `InfluxDB response:`, data);

    // Process the JSON data from InfluxDB 3
    const metrics = {}

    if (Array.isArray(data) && data.length > 0) {
      // Take the first row (most recent)
      const row = data[0]

      // Extract all fields from the response
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

    // Get temperature setpoint from the Setpoint field
    let temperatureSetpoint = metrics.Setpoint
    if (temperatureSetpoint !== undefined) {
      logEquipment(equipmentId, `Found temperature setpoint in metrics: ${temperatureSetpoint}°F`);
    } else {
      // Default setpoint if not found
      temperatureSetpoint = 72
      logEquipment(equipmentId, `No setpoint found in metrics, using default: ${temperatureSetpoint}°F`);
    }

    // Get temperature source from the TemperatureSource field
    let temperatureSource = metrics.TemperatureSource
    if (temperatureSource !== undefined) {
      logEquipment(equipmentId, `Found temperature source in metrics: ${temperatureSource}`);
    } else {
      // Default based on location
      temperatureSource = locationId === "4" ? "supply" : "space"
      logEquipment(
        equipmentId,
        `No temperature source found in metrics, using default for location ${locationId}: ${temperatureSource}`,
      )
    }

    // Get custom logic enabled flag from the CustomLogicEnabled field
    let customLogicEnabled = metrics.CustomLogicEnabled
    if (customLogicEnabled !== undefined) {
      // Make sure it's a boolean
      if (typeof customLogicEnabled === "string") {
        customLogicEnabled = customLogicEnabled === "true"
      }
      logEquipment(equipmentId, `Found custom logic enabled setting in metrics: ${customLogicEnabled}`);
    } else {
      // Default to true if not found
      customLogicEnabled = true
      logEquipment(equipmentId, `No custom logic enabled setting found in metrics, using default: ${customLogicEnabled}`);
    }

    // Return only the settings needed for control logic
    return {
      temperatureSetpoint,
      temperatureSource,
      customLogicEnabled,
    }
  } catch (error) {
    console.error(`Error fetching data from InfluxDB: ${error}`)

    // Return minimal default values needed for the logic to work
    return {
      temperatureSetpoint: 72,
      temperatureSource: locationId === "4" ? "supply" : "space",
      customLogicEnabled: true,
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

// Helper function for evaluating custom logic - SIMPLIFIED TO USE EQUIPMENT-SPECIFIC FUNCTIONS
export function evaluateCustomLogic(sandbox: any, pidState: any, equipmentType?: string): LogicEvaluation | null {
  try {
    const equipmentId = sandbox.settings.equipmentId || "unknown";
    // Log the equipment type we received
    logEquipment(equipmentId, `Evaluating logic for equipment type: ${equipmentType || "unknown"}`);

    // Get the control function for this equipment type
    const controlFunction = getControlFunction(equipmentType || "")

    if (!controlFunction) {
      logEquipment(equipmentId, `ERROR: No control function found for equipment type: ${equipmentType}`);
      return {
        error: `No control function available for equipment type: ${equipmentType}`,
        result: null,
        hasChanges: false,
        timestamp: Date.now(),
      }
    }

    // Get the location ID and equipment ID for location-based control
    const locationId = sandbox.settings.locationId || "4" // Default to Huntington if not specified

    logEquipment(equipmentId, `Processing equipment ID: ${equipmentId}, type: ${equipmentType}, location: ${locationId}`);

    // Force temperatureSource to "supply" for location 4
    if (locationId === "4" && sandbox.settings) {
      sandbox.settings.temperatureSource = "supply"
    }

    // Determine which temperature to use based on location
    let currentTemp;
    let temperatureSourceLabel;
    let temperatureSourceField;

    // Log all available temperature fields for debugging
    const tempFields = [
      "H2OSupply", "H2OReturn", "Supply", "measurement",
      "SupplyTemp", "supplyTemp", "supplyTemperature", "SupplyTemperature",
      "discharge", "Discharge", "dischargeTemp", "DischargeTemp",
      "roomTemp", "RoomTemp", "roomTemperature", "RoomTemperature",
      "spaceTemp", "SpaceTemp", "zoneTemp", "ZoneTemp"
    ];

    // Log which temperature fields are available
    for (const field of tempFields) {
      if (sandbox.metrics[field] !== undefined) {
        logEquipment(equipmentId, `Available temperature field: ${field} = ${sandbox.metrics[field]}`);
      }
    }

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

    logEquipment(equipmentId, `Equipment ID: ${equipmentId}, Type: ${equipmentType}, Location: ${locationId}, System: ${systemName}`);
    logEquipment(
      equipmentId,
      `Using ${temperatureSourceLabel} temperature from field "${temperatureSourceField || "default"}" with value: ${currentTemp}°F`,
    );
    logEquipment(equipmentId, `Supply: ${supplyDisplay}, Measurement: ${measurementDisplay}`);

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
    logEquipment(equipmentId, `Running logic for equipment`);

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

    logEquipment(equipmentId, `Equipment info: ${equipment.name || "Unnamed"}, Type: ${equipmentType}, Location: ${locationId}`);

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
    logEquipment(equipmentId, `Retrieved metrics - key fields:`, {
      Supply: metrics.Supply,
      supplyTemp: metrics.supplyTemp,
      Outdoor_Air: metrics.Outdoor_Air,
      Mixed_Air: metrics.Mixed_Air,
      Setpoint: metrics.Setpoint
    });

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
    logEquipment(equipmentId, `Evaluating custom logic with ${Object.keys(metrics).length} metrics`);
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
    console.log(`Found ${equipmentList.length} equipment with custom logic enabled`);

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
