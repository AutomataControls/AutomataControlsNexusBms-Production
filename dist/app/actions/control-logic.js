"use server";
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getQueueStatus = getQueueStatus;
exports.getEquipmentWithCustomLogic = getEquipmentWithCustomLogic;
exports.runEquipmentLogic = runEquipmentLogic;
exports.runAllEquipmentLogic = runAllEquipmentLogic;
const firestore_1 = require("firebase/firestore");
const app_1 = require("firebase/app");
const firestore_2 = require("firebase/firestore");
// Import base implementations
const fan_coil_1 = require("@/lib/equipment-logic/base/fan-coil");
const boiler_1 = require("@/lib/equipment-logic/base/boiler");
const pumps_1 = require("@/lib/equipment-logic/base/pumps");
const chiller_1 = require("@/lib/equipment-logic/base/chiller");
const air_handler_1 = require("@/lib/equipment-logic/base/air-handler");
const steam_bundle_1 = require("@/lib/equipment-logic/base/steam-bundle");
// Import location-specific implementations
// Warren (ID: 1)
const fan_coil_2 = require("@/lib/equipment-logic/locations/warren/fan-coil");
const pumps_2 = require("@/lib/equipment-logic/locations/warren/pumps");
const air_handler_2 = require("@/lib/equipment-logic/locations/warren/air-handler");
const steam_bundle_2 = require("@/lib/equipment-logic/locations/warren/steam-bundle");
// Hopebridge (ID: 5)
const boiler_2 = require("@/lib/equipment-logic/locations/hopebridge/boiler");
const air_handler_3 = require("@/lib/equipment-logic/locations/hopebridge/air-handler");
// Huntington (ID: 4)
const fan_coil_3 = require("@/lib/equipment-logic/locations/huntington/fan-coil");
const boiler_3 = require("@/lib/equipment-logic/locations/huntington/boiler");
const pumps_3 = require("@/lib/equipment-logic/locations/huntington/pumps");
const chiller_2 = require("@/lib/equipment-logic/locations/huntington/chiller");
// Enhanced logging function for equipment-specific debugging
function logEquipment(equipmentId, message, data) {
    const logPrefix = `EQUIPMENT[${equipmentId}]`;
    if (data) {
        console.log(`${logPrefix} ${message}`, typeof data === 'object' ? JSON.stringify(data).substring(0, 500) : data);
    }
    else {
        console.log(`${logPrefix} ${message}`);
    }
}
// Queue system - use a closure to maintain state without exporting variables
// This keeps the queue private but allows functions to access it
const queue = {
    items: [],
    isProcessing: false
};
// Storage for PID state - DON'T EXPORT THIS, it causes "use server" errors
const pidStateStorage = new Map();
// Implement a fallback mechanism for control values when InfluxDB queries fail
async function fetchControlValueWithFallback(table, equipmentId, locationId) {
    try {
        // Use a 5-minute window to get the most recent data
        const query = `
      SELECT *
      FROM "${table}"
      WHERE "equipment_id" = '${equipmentId}'
      AND "location_id" = '${locationId}'
      AND time >= now() - INTERVAL '5 minutes'
      ORDER BY time DESC
      LIMIT 1
    `;
        const result = await queryInfluxDB(query);
        if (!result.success || !result.data || !Array.isArray(result.data) || result.data.length === 0) {
            // Try with a wider timeframe if no data found
            const fallbackQuery = `
        SELECT *
        FROM "${table}"
        WHERE "equipment_id" = '${equipmentId}'
        AND "location_id" = '${locationId}'
        AND time >= now() - INTERVAL '60 minutes'
        ORDER BY time DESC
        LIMIT 1
      `;
            return await queryInfluxDB(fallbackQuery);
        }
        return result;
    }
    catch (error) {
        console.error(`Error in fetchControlValueWithFallback for ${table}:`, error);
        return { success: false, error: String(error) };
    }
}
// Helper function for accessing queue state - these are safe to export as they're async
async function getQueueStatus() {
    return {
        isProcessing: queue.isProcessing,
        queueLength: queue.items.length,
        queuedEquipment: [...queue.items] // Return a copy
    };
}
// Process one item from the queue
async function processNextInQueue() {
    if (queue.isProcessing || queue.items.length === 0) {
        return;
    }
    queue.isProcessing = true;
    const equipmentId = queue.items.shift();
    try {
        console.log(`Processing queued equipment: ${equipmentId}`);
        // Run logic for this equipment
        await runEquipmentLogic(equipmentId);
    }
    catch (error) {
        console.error(`Error processing queued equipment ${equipmentId}:`, error);
    }
    finally {
        queue.isProcessing = false;
        // Process next item if any
        processNextInQueue();
    }
}
// Queue equipment for processing
function queueEquipmentLogic(equipmentId) {
    queue.items.push(equipmentId);
    processNextInQueue(); // Try to start processing
}
// Initialize Firebase if not already initialized
let db;
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
    };
    // Initialize Firebase (will not re-initialize if already initialized)
    const firebaseApps = (0, app_1.getApps)();
    if (firebaseApps.length === 0) {
        const app = (0, app_1.initializeApp)(firebaseConfig);
        db = (0, firestore_2.getFirestore)(app);
        console.log("Firebase initialized successfully");
    }
    else {
        db = (0, firestore_2.getFirestore)(firebaseApps[0]);
        console.log("Firebase already initialized, using existing instance");
    }
}
catch (error) {
    console.error("Error initializing Firebase:", error);
}
// InfluxDB configuration with environment variables
const INFLUXDB_URL = process.env.INFLUXDB_URL || "http://143.198.162.31:8181"; // Use your actual InfluxDB server
const INFLUXDB_DATABASE = process.env.INFLUXDB_DATABASE || "Locations";
const INFLUXDB_TIMEOUT = parseInt(process.env.INFLUXDB_TIMEOUT || "30000"); // 30 seconds timeout
/**
 * Improved InfluxDB query function with retry mechanism and error handling
 */
async function queryInfluxDB(query, options = {}) {
    const maxRetries = options.maxRetries || 3;
    const retryDelay = options.retryDelay || 1000; // 1 second
    // Log the query for debugging
    console.log(`InfluxDB Query: ${query.substring(0, 200)}${query.length > 200 ? '...' : ''}`);
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // Set up timeout with AbortController
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), INFLUXDB_TIMEOUT);
            const response = await fetch(`${INFLUXDB_URL}/api/v3/query_sql`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    q: query,
                    db: INFLUXDB_DATABASE,
                }),
                signal: controller.signal
            });
            // Clear the timeout
            clearTimeout(timeoutId);
            if (response.ok) {
                const data = await response.json();
                return { success: true, data };
            }
            else {
                const errorText = await response.text();
                console.error(`InfluxDB query failed (${response.status}): ${errorText}`);
                // Retry for server errors (500s)
                if (response.status >= 500 && attempt < maxRetries) {
                    console.log(`Retrying in ${retryDelay}ms (Attempt ${attempt}/${maxRetries})...`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                    continue;
                }
                return {
                    success: false,
                    error: `Query failed: ${response.status} ${errorText}`,
                    statusCode: response.status
                };
            }
        }
        catch (error) {
            if (error.name === 'AbortError') {
                console.error(`InfluxDB query timeout after ${INFLUXDB_TIMEOUT}ms`);
            }
            else {
                console.error(`InfluxDB query error:`, error);
            }
            if (attempt < maxRetries) {
                console.log(`Retrying in ${retryDelay}ms (Attempt ${attempt}/${maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                continue;
            }
            return {
                success: false,
                error: error.message || String(error)
            };
        }
    }
    return {
        success: false,
        error: `Query failed after ${maxRetries} attempts`
    };
}
/**
 * Enhanced standardizeMetrics function with zone-specific temperature detection
 */
function standardizeMetrics(rawMetrics) {
    // Define standard field names and their possible source fields
    const standardFields = {
        roomTemperature: [
            'roomTemperature', 'roomTemp', 'Room', 'room', 'RoomTemp',
            'room_temperature', 'room_temp', 'ZoneTemp', 'zoneTemp',
            'zone_temperature', 'zone_temp'
        ],
        supplyTemperature: [
            'supplyTemperature', 'supplyTemp', 'Supply', 'supply', 'SupplyTemp',
            'supply_temperature', 'supply_temp', 'SAT', 'sat', 'DischargeTemp',
            'Discharge', 'discharge', 'dischargeTemp', 'DischargeTemperature',
            'discharge_temperature', 'discharge_temp', 'SupplyAirTemp',
            'supplyAirTemp', 'SupplyAirTemperature', 'supplyAirTemperature'
        ],
        outdoorTemperature: [
            'outdoorTemperature', 'outdoorTemp', 'Outdoor', 'outdoor', 'OutdoorTemp',
            'outdoor_temperature', 'outdoor_temp', 'OAT', 'oat', 'Outdoor_Air',
            'OutdoorAir', 'outdoorAir', 'outdoorAirTemp', 'OutdoorAirTemp',
            'OutdoorAirTemperature', 'outdoorAirTemperature', 'outdoor_air_temp',
            'outdoor_air_temperature', 'OutsideAirTemp', 'outsideAirTemp',
            'OutsideTemp', 'outsideTemp'
        ],
        returnTemperature: [
            'returnTemperature', 'returnTemp', 'Return', 'return', 'ReturnTemp',
            'return_temperature', 'return_temp', 'RAT', 'rat', 'ReturnAirTemp',
            'returnAirTemp', 'ReturnAirTemperature', 'returnAirTemperature'
        ],
        setpoint: [
            'Setpoint', 'setpoint', 'SetPoint', 'set_point', 'temperatureSetpoint',
            'temperature_setpoint', 'TempSetpoint', 'temp_setpoint'
        ],
        waterSupplyTemperature: [
            'waterSupplyTemperature', 'waterSupplyTemp', 'H2OSupply', 'H2O Supply',
            'water_supply_temperature', 'water_supply_temp', 'H2O_Supply',
            'WaterSupply', 'waterSupply', 'BoilerSupply', 'boilerSupply'
        ],
        waterReturnTemperature: [
            'waterReturnTemperature', 'waterReturnTemp', 'H2OReturn', 'H2O Return',
            'water_return_temperature', 'water_return_temp', 'H2O_Return',
            'WaterReturn', 'waterReturn', 'BoilerReturn', 'boilerReturn'
        ],
        mixedAirTemperature: [
            'mixedAirTemperature', 'mixedAirTemp', 'Mixed_Air', 'MixedAir', 'mixed_air',
            'mixedAir', 'Mixed', 'mixed', 'MixedTemp', 'mixed_temp'
        ]
    };
    const standardized = {};
    // Process each standard field
    for (const [standardName, sourceFields] of Object.entries(standardFields)) {
        // Find the first matching field that exists in the raw metrics
        for (const field of sourceFields) {
            if (rawMetrics[field] !== undefined && rawMetrics[field] !== null) {
                // Try to convert to number if it's a string number
                let value = rawMetrics[field];
                if (typeof value === 'string' && !isNaN(Number(value))) {
                    value = Number(value);
                }
                standardized[standardName] = value;
                break;
            }
        }
    }
    // Add a zoneTemperatures object to collect all zone-specific temps
    standardized.zoneTemperatures = {};
    // Common areas that might have dedicated temperature sensors
    const commonAreas = [
        'cove', 'mailRoom', 'mail_room', 'kitchen', 'lobby', 'office', 'gym',
        'conference', 'conference_room', 'dining', 'living', 'bedroom', 'bathroom',
        'hallway', 'entrance', 'reception', 'waiting', 'cafeteria', 'break_room',
        'breakRoom', 'server', 'server_room', 'storage', 'basement', 'attic',
        'garage', 'laundry', 'mechanical', 'electrical', 'boiler_room', 'boilerRoom',
        'north', 'south', 'east', 'west', 'northwest', 'northeast', 'southwest', 'southeast',
        // Add more common areas as needed
    ];
    // Look for fields that might be zone-specific temperatures
    for (const [key, value] of Object.entries(rawMetrics)) {
        // Skip if not a valid temperature value
        if (value === null || value === undefined ||
            (typeof value !== 'number' && (typeof value === 'string' && isNaN(Number(value))))) {
            continue;
        }
        // Convert string numbers to actual numbers
        const tempValue = typeof value === 'string' ? Number(value) : value;
        // Check if it's a temperature field
        let isTemperature = false;
        let zoneName = '';
        // Case 1: Fields ending with Temp, Temperature, or _temp
        if (key.endsWith('Temp') || key.endsWith('Temperature') || key.endsWith('_temp') || key.endsWith('_temperature')) {
            isTemperature = true;
            // Extract zone name (e.g., from 'coveTemp' to 'cove')
            zoneName = key.replace(/Temp(erature)?$|_temp(erature)?$/i, '').toLowerCase();
        }
        // Case 2: Fields with area name followed by 'Temperature' or 'Temp'
        else {
            for (const area of commonAreas) {
                const lowercaseKey = key.toLowerCase();
                const lowercaseArea = area.toLowerCase();
                if (lowercaseKey.includes(lowercaseArea)) {
                    // Check if it's likely a temperature
                    if (lowercaseKey.includes('temp') || lowercaseKey.includes('temperature')) {
                        isTemperature = true;
                        zoneName = lowercaseArea;
                        break;
                    }
                }
            }
        }
        // Skip if it's one of our standard fields
        if (isTemperature && zoneName) {
            if (['room', 'supply', 'return', 'outdoor', 'mixed', 'water', 'setpoint'].includes(zoneName)) {
                continue;
            }
            // Add to zone temperatures
            standardized.zoneTemperatures[zoneName] = tempValue;
        }
    }
    // Also add any fields that have numeric values and contain 'temp' in their name
    for (const [key, value] of Object.entries(rawMetrics)) {
        const lowercaseKey = key.toLowerCase();
        // Skip if already processed or not a valid temperature
        if (standardized.zoneTemperatures[key.toLowerCase()] !== undefined ||
            value === null || value === undefined ||
            (typeof value !== 'number' && (typeof value === 'string' && isNaN(Number(value))))) {
            continue;
        }
        // If it has 'temp' in the name but wasn't caught by the above rules, add it
        if (lowercaseKey.includes('temp') && !lowercaseKey.includes('setpoint')) {
            // Convert to number if string
            const tempValue = typeof value === 'string' ? Number(value) : value;
            // Use the full field name as the zone name
            standardized.zoneTemperatures[lowercaseKey] = tempValue;
        }
    }
    return standardized;
}
/**
 * Process InfluxDB query results into a metrics object
 */
function processInfluxDBResults(data, equipmentId) {
    // Process the results
    const metrics = {};
    // Process the data from InfluxDB - only need the most recent value for each field
    // This reduces data volume and processing time
    const processedFields = new Set();
    for (const row of data) {
        Object.entries(row).forEach(([key, value]) => {
            // Skip time field, internal fields, and already processed fields
            if (key !== 'time' && !key.startsWith('_') && !processedFields.has(key) &&
                value !== null && value !== undefined) {
                // Mark this field as processed
                processedFields.add(key);
                // Convert types appropriately
                if (typeof value === 'string') {
                    if (value === 'true' || value === 'false') {
                        metrics[key] = value === 'true';
                    }
                    else if (!isNaN(Number(value))) {
                        metrics[key] = Number(value);
                    }
                    else {
                        metrics[key] = value;
                    }
                }
                else {
                    metrics[key] = value;
                }
            }
        });
    }
    // Log key temperature values for debugging
    if (metrics.Supply !== undefined)
        logEquipment(equipmentId, `Supply temperature: ${metrics.Supply}`);
    if (metrics.supplyTemp !== undefined)
        logEquipment(equipmentId, `supplyTemp: ${metrics.supplyTemp}`);
    if (metrics.Outdoor_Air !== undefined)
        logEquipment(equipmentId, `Outdoor_Air: ${metrics.Outdoor_Air}`);
    if (metrics.Mixed_Air !== undefined)
        logEquipment(equipmentId, `Mixed_Air: ${metrics.Mixed_Air}`);
    return metrics;
}
/**
 * Helper function to fetch metrics from InfluxDB for a specific equipment
 * FIXED: Use INTERVAL syntax for time range
 */
async function fetchMetricsFromInfluxDB(locationId, equipmentId, equipmentType) {
    try {
        logEquipment(equipmentId, `Fetching metrics from InfluxDB (last 5 minutes)`);
        // Use a 5-minute window to get the most recent data
        const query = `
      SELECT *
      FROM "metrics"
      WHERE "equipmentId" = '${equipmentId}'
      AND time >= now() - INTERVAL '5 minutes'
      ORDER BY time DESC
      LIMIT 10
    `;
        const result = await queryInfluxDB(query);
        if (!result.success || !result.data || !Array.isArray(result.data) || result.data.length === 0) {
            logEquipment(equipmentId, `No recent metrics found in InfluxDB, trying last hour`);
            // Fallback to last hour with proper INTERVAL syntax
            const fallbackQuery = `
        SELECT *
        FROM "metrics"
        WHERE "equipmentId" = '${equipmentId}'
        AND time >= now() - INTERVAL '1 hour'
        ORDER BY time DESC
        LIMIT 5
      `;
            const fallbackResult = await queryInfluxDB(fallbackQuery);
            if (!fallbackResult.success || !fallbackResult.data || !Array.isArray(fallbackResult.data) || fallbackResult.data.length === 0) {
                logEquipment(equipmentId, `No metrics found in InfluxDB in the last hour`);
                return {};
            }
            // Process the fallback data
            return processInfluxDBResults(fallbackResult.data, equipmentId);
        }
        // Process the results
        return processInfluxDBResults(result.data, equipmentId);
    }
    catch (error) {
        console.error(`Error fetching metrics from InfluxDB:`, error);
        return {};
    }
}
/**
 * Helper function to fetch control values from InfluxDB
 * IMPROVED: Uses individual queries with type-aware processing to handle mixed data types
 */
async function fetchControlValuesFromInfluxDB(locationId, equipmentId) {
    try {
        logEquipment(equipmentId, `Fetching control values from InfluxDB`);
        // Use a cached list of tables if available (static variable shared between calls)
        if (!fetchControlValuesFromInfluxDB.tableCache) {
            // First get all tables that contain control values
            const tablesQuery = `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_name LIKE 'update\\_%'
      `;
            const tablesResult = await queryInfluxDB(tablesQuery);
            if (!tablesResult.success || !Array.isArray(tablesResult.data) || tablesResult.data.length === 0) {
                logEquipment(equipmentId, `No control value tables found in InfluxDB`);
                return {};
            }
            // Extract table names and cache them
            fetchControlValuesFromInfluxDB.tableCache = tablesResult.data.map((row) => row.table_name);
            logEquipment(equipmentId, `Cached ${fetchControlValuesFromInfluxDB.tableCache.length} control tables`);
        }
        // Initialize control values
        const controlValues = {};
        // Get tables from cache
        const tables = fetchControlValuesFromInfluxDB.tableCache;
        // Since UNION ALL doesn't work well with mixed data types (boolean/float/string),
        // we'll use individual queries for each table, but process them in parallel for better performance
        const promises = tables.map(async (table) => {
            try {
                const controlType = table.replace('update_', '');
                // Use a 5-minute window first for the most recent data
                const query = `
          SELECT *
          FROM "${table}"
          WHERE "equipment_id" = '${equipmentId}'
          AND "location_id" = '${locationId}'
          AND time >= now() - INTERVAL '5 minutes'
          ORDER BY time DESC
          LIMIT 1
        `;
                const result = await queryInfluxDB(query);
                if (result.success && Array.isArray(result.data) && result.data.length > 0) {
                    let value = result.data[0].value;
                    // Convert value types
                    if (typeof value === 'string') {
                        if (value === 'true' || value === 'false') {
                            value = value === 'true';
                        }
                        else if (!isNaN(Number(value))) {
                            value = Number(value);
                        }
                        else if (value.startsWith('{') || value.startsWith('[')) {
                            try {
                                value = JSON.parse(value);
                            }
                            catch (e) {
                                // Keep as string if parsing fails
                            }
                        }
                    }
                    return { controlType, value };
                }
                else {
                    // Try with a wider timeframe if no data found
                    const fallbackQuery = `
            SELECT *
            FROM "${table}"
            WHERE "equipment_id" = '${equipmentId}'
            AND "location_id" = '${locationId}'
            AND time >= now() - INTERVAL '60 minutes'
            ORDER BY time DESC
            LIMIT 1
          `;
                    const fallbackResult = await queryInfluxDB(fallbackQuery);
                    if (fallbackResult.success && Array.isArray(fallbackResult.data) && fallbackResult.data.length > 0) {
                        let value = fallbackResult.data[0].value;
                        // Convert value types
                        if (typeof value === 'string') {
                            if (value === 'true' || value === 'false') {
                                value = value === 'true';
                            }
                            else if (!isNaN(Number(value))) {
                                value = Number(value);
                            }
                            else if (value.startsWith('{') || value.startsWith('[')) {
                                try {
                                    value = JSON.parse(value);
                                }
                                catch (e) {
                                    // Keep as string if parsing fails
                                }
                            }
                        }
                        return { controlType, value };
                    }
                }
                return null;
            }
            catch (error) {
                console.error(`Error fetching control value for ${table}:`, error);
                return null;
            }
        });
        // Wait for all promises to resolve
        const results = await Promise.all(promises);
        // Process results
        for (const result of results) {
            if (result && result.controlType && result.value !== undefined) {
                controlValues[result.controlType] = result.value;
            }
        }
        // Check for specific fields
        if (!controlValues.temperatureSetpoint) {
            // Try to get setpoint from metrics with a single query approach
            try {
                const setpointQuery = `
          SELECT "Setpoint"
          FROM "metrics"
          WHERE "equipmentId" = '${equipmentId}'
          AND time >= now() - INTERVAL '5 minutes'
          ORDER BY time DESC
          LIMIT 1
        `;
                const setpointResult = await queryInfluxDB(setpointQuery);
                if (setpointResult.success && Array.isArray(setpointResult.data) && setpointResult.data.length > 0 &&
                    setpointResult.data[0].Setpoint !== undefined) {
                    controlValues.temperatureSetpoint = Number(setpointResult.data[0].Setpoint);
                }
                else {
                    // Try with a wider time window
                    const fallbackQuery = `
            SELECT "Setpoint"
            FROM "metrics"
            WHERE "equipmentId" = '${equipmentId}'
            AND time >= now() - INTERVAL '60 minutes'
            ORDER BY time DESC
            LIMIT 1
          `;
                    const fallbackResult = await queryInfluxDB(fallbackQuery);
                    if (fallbackResult.success && Array.isArray(fallbackResult.data) && fallbackResult.data.length > 0 &&
                        fallbackResult.data[0].Setpoint !== undefined) {
                        controlValues.temperatureSetpoint = Number(fallbackResult.data[0].Setpoint);
                    }
                    else {
                        // Default setpoint
                        controlValues.temperatureSetpoint = 72;
                    }
                }
            }
            catch (error) {
                console.error(`Error getting setpoint from metrics:`, error);
                // Default setpoint
                controlValues.temperatureSetpoint = 72;
            }
        }
        // Set default values for required fields if missing
        if (controlValues.temperatureSource === undefined) {
            // Use supply for Huntington, space for others
            controlValues.temperatureSource = locationId === "4" ? "supply" : "space";
        }
        if (controlValues.customLogicEnabled === undefined) {
            controlValues.customLogicEnabled = true;
        }
        return controlValues;
    }
    catch (error) {
        console.error(`Error fetching control values from InfluxDB:`, error);
        // Return minimal defaults needed
        return {
            temperatureSetpoint: 72,
            temperatureSource: locationId === "4" ? "supply" : "space",
            customLogicEnabled: true
        };
    }
}
/**
 * Send control command to the API
 */
async function sendControlCommand(command, commandData) {
    try {
        logEquipment(commandData.equipmentId, `Sending control command: ${command} with value: ${commandData.value}`);
        // Use environment variable for API URL with fallback
        const baseUrl = process.env.API_BASE_URL || "https://neuralbms.automatacontrols.com";
        const response = await fetch(`${baseUrl}/api/control-commands`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                command,
                ...commandData,
            }),
            // Add timeout to prevent hanging
            signal: AbortSignal.timeout(10000) // 10 second timeout
        });
        if (!response.ok) {
            // Get error details
            let errorText = "";
            try {
                const errorJson = await response.json();
                errorText = errorJson.error || response.statusText;
            }
            catch (_a) {
                errorText = await response.text() || response.statusText;
            }
            throw new Error(`Failed to send command: ${response.status} ${errorText}`);
        }
        return await response.json();
    }
    catch (error) {
        console.error(`Error sending control command:`, error);
        return { success: false, error: String(error) };
    }
}
/**
 * Helper function to get the base implementation for a given equipment type
 */
function getBaseImplementation(normalizedType) {
    console.log(`Using base implementation for ${normalizedType}`);
    if (normalizedType === "fan-coil")
        return fan_coil_1.fanCoilControl;
    if (normalizedType === "boiler")
        return boiler_1.boilerControl;
    if (normalizedType === "pump" || normalizedType === "hwpump" || normalizedType === "cwpump")
        return pumps_1.pumpControl;
    if (normalizedType === "chiller")
        return chiller_1.chillerControl;
    if (normalizedType === "air-handler")
        return air_handler_1.airHandlerControl;
    if (normalizedType === "steam-bundle")
        return steam_bundle_1.steamBundleControl;
    return null;
}
// Get equipment with custom logic enabled - OPTIMIZED: Uses caching and efficient query
async function getEquipmentWithCustomLogic() {
    try {
        if (!db) {
            throw new Error("Firestore DB is not initialized");
        }
        // Use cache with 30 second TTL to avoid frequent queries
        if (!getEquipmentWithCustomLogic.cache ||
            !getEquipmentWithCustomLogic.cacheTime ||
            (Date.now() - getEquipmentWithCustomLogic.cacheTime) > 30000) {
            // First try to get equipment with CustomLogicEnabled from InfluxDB - ONLY LAST 30 MINUTES
            try {
                console.log("Querying InfluxDB for equipment with CustomLogicEnabled=true (last 30 minutes)");
                // Use proper INTERVAL syntax for time range with single query approach
                // Only select the necessary fields to reduce data transfer
                const sqlQuery = `
          SELECT DISTINCT("equipmentId")
          FROM "metrics"
          WHERE (CAST("CustomLogicEnabled" AS TEXT) = 'true')
          AND time >= now() - INTERVAL '30 minutes'
        `;
                const result = await queryInfluxDB(sqlQuery);
                if (result.success && Array.isArray(result.data) && result.data.length > 0) {
                    console.log(`Found ${result.data.length} equipment with CustomLogicEnabled=true in InfluxDB`);
                    // Extract equipment IDs
                    const equipmentIds = new Set();
                    for (const row of result.data) {
                        if (row.equipmentId) {
                            equipmentIds.add(row.equipmentId);
                        }
                    }
                    // Get equipment details from Firestore in bulk when possible
                    if (equipmentIds.size > 0) {
                        console.log(`Found ${equipmentIds.size} unique equipment IDs in InfluxDB, fetching details from Firestore`);
                        const equipmentList = [];
                        // Process in batches to avoid too many concurrent Firestore reads
                        const idArray = Array.from(equipmentIds);
                        const batchSize = 10;
                        for (let i = 0; i < idArray.length; i += batchSize) {
                            const idBatch = idArray.slice(i, i + batchSize);
                            const batchPromises = idBatch.map(async (id) => {
                                try {
                                    const equipRef = (0, firestore_1.doc)(db, "equipment", id);
                                    const equipSnap = await (0, firestore_1.getDoc)(equipRef);
                                    if (equipSnap.exists()) {
                                        // Equipment exists in Firestore, use its data
                                        const equipData = equipSnap.data();
                                        // Ensure required fields exist
                                        if (!equipData.controls) {
                                            equipData.controls = {};
                                        }
                                        // Set customLogicEnabled to true
                                        equipData.controls.customLogicEnabled = true;
                                        return {
                                            ...equipData,
                                            id: equipSnap.id,
                                        };
                                    }
                                    else {
                                        // Equipment not in Firestore, create basic record
                                        console.log(`Equipment ${id} found in InfluxDB but not in Firestore, creating basic record`);
                                        // Default values
                                        const basicEquipment = {
                                            id: id,
                                            locationId: "4", // Default to location 4 (Huntington)
                                            type: "Fan Coil", // Default type
                                            name: `Equipment ${id}`,
                                            controls: {
                                                customLogicEnabled: true
                                            }
                                        };
                                        // Optionally create in Firestore (in background)
                                        try {
                                            (0, firestore_1.setDoc)((0, firestore_1.doc)(db, "equipment", id), basicEquipment).catch((createError) => {
                                                console.error(`Error creating equipment in Firestore:`, createError);
                                            });
                                        }
                                        catch (createError) {
                                            console.error(`Error creating equipment in Firestore:`, createError);
                                        }
                                        return basicEquipment;
                                    }
                                }
                                catch (firestoreError) {
                                    console.error(`Error fetching equipment ${id} from Firestore:`, firestoreError);
                                    // Still add a basic record
                                    return {
                                        id: id,
                                        locationId: "4", // Default to location 4 (Huntington)
                                        type: "Fan Coil", // Default type
                                        name: `Equipment ${id}`,
                                        controls: {
                                            customLogicEnabled: true
                                        }
                                    };
                                }
                            });
                            // Wait for this batch to complete and add to the list
                            const batchResults = await Promise.all(batchPromises);
                            equipmentList.push(...batchResults);
                        }
                        console.log(`FOUND ${equipmentList.length} EQUIPMENT WITH CUSTOM LOGIC ENABLED`);
                        // Update cache
                        getEquipmentWithCustomLogic.cache = equipmentList;
                        getEquipmentWithCustomLogic.cacheTime = Date.now();
                        return equipmentList;
                    }
                }
            }
            catch (influxError) {
                console.error("Error checking InfluxDB for equipment with custom logic:", influxError);
            }
            // Fall back to Firestore if no equipment found in InfluxDB
            console.log("No equipment found in InfluxDB with CustomLogicEnabled=true, checking Firestore");
            const equipmentRef = (0, firestore_1.collection)(db, "equipment");
            const equipmentSnap = await (0, firestore_1.getDocs)(equipmentRef);
            console.log(`FOUND ${equipmentSnap.docs.length} TOTAL EQUIPMENT RECORDS IN FIRESTORE`);
            const equipmentList = [];
            // Filter for equipment with customLogicEnabled=true
            equipmentSnap.forEach((doc) => {
                var _a;
                const data = doc.data();
                if ((_a = data.controls) === null || _a === void 0 ? void 0 : _a.customLogicEnabled) {
                    equipmentList.push({
                        ...data,
                        id: doc.id,
                    });
                }
            });
            console.log(`FOUND ${equipmentList.length} EQUIPMENT WITH CUSTOM LOGIC ENABLED IN FIRESTORE`);
            // Update cache
            getEquipmentWithCustomLogic.cache = equipmentList;
            getEquipmentWithCustomLogic.cacheTime = Date.now();
            return equipmentList;
        }
        else {
            // Return cached result
            console.log(`Using cached equipment list (${getEquipmentWithCustomLogic.cache.length} items, ${Math.floor((Date.now() - getEquipmentWithCustomLogic.cacheTime) / 1000)}s old)`);
            return [...getEquipmentWithCustomLogic.cache]; // Return a copy
        }
    }
    catch (error) {
        console.error("Error fetching equipment with custom logic:", error);
        return [];
    }
}
// Run logic for specific equipment - IMPROVED VERSION
async function runEquipmentLogic(equipmentId) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
    const startTime = Date.now();
    try {
        logEquipment(equipmentId, "Starting equipment logic processing");
        // STEP 1: Get equipment data from Firestore
        let equipment;
        try {
            if (db) {
                const equipRef = (0, firestore_1.doc)(db, "equipment", equipmentId);
                const equipSnap = await (0, firestore_1.getDoc)(equipRef);
                if (equipSnap.exists()) {
                    equipment = {
                        ...equipSnap.data(),
                        id: equipSnap.id,
                    };
                }
            }
        }
        catch (firebaseError) {
            console.error(`Error getting equipment from Firestore: ${firebaseError}`);
        }
        // If equipment not found in Firestore, check if it's in InfluxDB and create a basic record
        if (!equipment) {
            try {
                logEquipment(equipmentId, "Equipment not found in Firestore, checking InfluxDB");
                // Query InfluxDB for this equipment - ONLY LATEST DATA with shorter time constraint
                const query = `
          SELECT *
          FROM "metrics"
          WHERE "equipmentId" = '${equipmentId}'
          AND time >= now() - INTERVAL '60 minutes'
          ORDER BY time DESC
          LIMIT 1
        `;
                const result = await queryInfluxDB(query);
                if (result.success && Array.isArray(result.data) && result.data.length > 0) {
                    logEquipment(equipmentId, "Found in InfluxDB but not in Firestore, creating basic record");
                    // Extract system name if available
                    let systemName = "unknown";
                    if (result.data[0].system) {
                        systemName = result.data[0].system;
                    }
                    // Create a basic equipment record
                    equipment = {
                        id: equipmentId,
                        locationId: "4", // Default to location 4 (Huntington)
                        type: "Fan Coil", // Default type
                        name: `Equipment ${equipmentId}`,
                        system: systemName,
                        controls: {
                            customLogicEnabled: true // Set to true since we're creating it for control purposes
                        }
                    };
                    // Optionally create in Firestore
                    if (db) {
                        try {
                            await (0, firestore_1.setDoc)((0, firestore_1.doc)(db, "equipment", equipmentId), equipment);
                            logEquipment(equipmentId, "Created new equipment record in Firestore");
                        }
                        catch (createError) {
                            console.error(`Error creating equipment in Firestore:`, createError);
                        }
                    }
                }
                else {
                    throw new Error(`Equipment ${equipmentId} not found in InfluxDB`);
                }
            }
            catch (error) {
                console.error(`Error checking equipment in InfluxDB: ${error}`);
                throw new Error(`Equipment ${equipmentId} not found in Firestore or InfluxDB`);
            }
        }
        // Check equipment type and location
        const equipmentType = equipment.type || "Fan Coil";
        const locationId = equipment.locationId || "4"; // Default to Huntington
        logEquipment(equipmentId, `Starting logic execution - type=${equipmentType}, location=${locationId}`);
        // STEP 2: Check if custom logic is enabled
        let customLogicEnabled = (_a = equipment.controls) === null || _a === void 0 ? void 0 : _a.customLogicEnabled;
        // If not enabled in Firestore, check InfluxDB directly
        if (!customLogicEnabled) {
            try {
                logEquipment(equipmentId, "Custom logic not enabled in Firestore, checking InfluxDB");
                // Query InfluxDB - ONLY LATEST DATA with a single query approach
                const query = `
          SELECT "CustomLogicEnabled"
          FROM "metrics"
          WHERE "equipmentId" = '${equipmentId}'
          AND (CAST("CustomLogicEnabled" AS TEXT) = 'true')
          AND time >= now() - INTERVAL '60 minutes'
          ORDER BY time DESC
          LIMIT 1
        `;
                const result = await queryInfluxDB(query);
                if (result.success && Array.isArray(result.data) && result.data.length > 0) {
                    const customLogicEnabledValue = result.data[0].CustomLogicEnabled;
                    if (customLogicEnabledValue === true ||
                        customLogicEnabledValue === 'true' ||
                        customLogicEnabledValue === 't' ||
                        customLogicEnabledValue === '1') {
                        customLogicEnabled = true;
                        logEquipment(equipmentId, "CustomLogicEnabled is true in InfluxDB, overriding Firestore value");
                        // Update the equipment object as well
                        if (!equipment.controls) {
                            equipment.controls = {};
                        }
                        equipment.controls.customLogicEnabled = true;
                    }
                }
            }
            catch (error) {
                console.error(`Error checking CustomLogicEnabled in InfluxDB: ${error}`);
            }
        }
        // Check if custom logic is enabled
        if (!customLogicEnabled) {
            logEquipment(equipmentId, "Custom logic disabled for equipment");
            return {
                success: false,
                message: "Custom logic is disabled for this equipment",
                equipmentId,
                name: equipment.name || "Unknown",
                timestamp: Date.now(),
            };
        }
        // STEP 3: Get metrics from InfluxDB
        logEquipment(equipmentId, "Fetching metrics from InfluxDB");
        const metrics = await fetchMetricsFromInfluxDB(locationId, equipmentId);
        // Log the raw metrics for detailed debugging
        logEquipment(equipmentId, `Retrieved ${Object.keys(metrics).length} metrics from InfluxDB`);
        // Standardize metrics to reduce field mapping
        const standardizedMetrics = standardizeMetrics(metrics);
        logEquipment(equipmentId, "Standardized metrics:", standardizedMetrics);
        // Log zone temperatures if any were found
        if (standardizedMetrics.zoneTemperatures && Object.keys(standardizedMetrics.zoneTemperatures).length > 0) {
            logEquipment(equipmentId, "Zone-specific temperatures found:", standardizedMetrics.zoneTemperatures);
        }
        // STEP 4: Get control values from InfluxDB
        logEquipment(equipmentId, "Fetching control values from InfluxDB");
        const controlValuesFromDB = await fetchControlValuesFromInfluxDB(locationId, equipmentId);
        logEquipment(equipmentId, "Control values from InfluxDB:", controlValuesFromDB);
        // STEP 5: Merge with equipment.controls for any values not in InfluxDB
        const controlValues = {
            fanSpeed: controlValuesFromDB.fanSpeed || ((_b = equipment.controls) === null || _b === void 0 ? void 0 : _b.fanSpeed) || "low",
            fanMode: controlValuesFromDB.fanMode || ((_c = equipment.controls) === null || _c === void 0 ? void 0 : _c.fanMode) || "auto",
            fanEnabled: controlValuesFromDB.fanEnabled !== undefined
                ? controlValuesFromDB.fanEnabled
                : ((_d = equipment.controls) === null || _d === void 0 ? void 0 : _d.fanEnabled) !== undefined
                    ? equipment.controls.fanEnabled
                    : true,
            heatingValvePosition: controlValuesFromDB.heatingValvePosition || ((_e = equipment.controls) === null || _e === void 0 ? void 0 : _e.heatingValvePosition) || 0,
            coolingValvePosition: controlValuesFromDB.coolingValvePosition || ((_f = equipment.controls) === null || _f === void 0 ? void 0 : _f.coolingValvePosition) || 0,
            heatingValveMode: controlValuesFromDB.heatingValveMode || ((_g = equipment.controls) === null || _g === void 0 ? void 0 : _g.heatingValveMode) || "auto",
            coolingValveMode: controlValuesFromDB.coolingValveMode || ((_h = equipment.controls) === null || _h === void 0 ? void 0 : _h.coolingValveMode) || "auto",
            temperatureSetpoint: controlValuesFromDB.temperatureSetpoint || ((_j = equipment.controls) === null || _j === void 0 ? void 0 : _j.temperatureSetpoint) || 72,
            temperatureSource: controlValuesFromDB.temperatureSource || ((_k = equipment.controls) === null || _k === void 0 ? void 0 : _k.temperatureSource) ||
                (locationId === "4" ? "supply" : "space"), // Default to supply for Huntington
            operationMode: controlValuesFromDB.operationMode || ((_l = equipment.controls) === null || _l === void 0 ? void 0 : _l.operationMode) || "auto",
            unitEnable: controlValuesFromDB.unitEnable !== undefined
                ? controlValuesFromDB.unitEnable
                : ((_m = equipment.controls) === null || _m === void 0 ? void 0 : _m.unitEnable) !== undefined
                    ? equipment.controls.unitEnable
                    : true,
            outdoorDamperPosition: controlValuesFromDB.outdoorDamperPosition || ((_o = equipment.controls) === null || _o === void 0 ? void 0 : _o.outdoorDamperPosition) || 0,
            pidControllers: ((_p = equipment.controls) === null || _p === void 0 ? void 0 : _p.pidControllers) || {
                heating: {
                    kp: 1.0,
                    ki: 0.1,
                    kd: 0.01,
                    enabled: true,
                    outputMin: 0,
                    outputMax: 100,
                    sampleTime: 1000,
                    reverseActing: true,
                    maxIntegral: 10,
                },
                cooling: {
                    kp: 1.0,
                    ki: 0.1,
                    kd: 0.01,
                    enabled: true,
                    outputMin: 0,
                    outputMax: 100,
                    sampleTime: 1000,
                    reverseActing: false,
                    maxIntegral: 10,
                },
                outdoorDamper: {
                    kp: 1.0,
                    ki: 0.1,
                    kd: 0.01,
                    outputMin: 0,
                    outputMax: 100,
                    sampleTime: 1000,
                    reverseActing: false,
                    maxIntegral: 10,
                },
            },
            customLogicEnabled: true, // Always set to true since we've verified it above
            waterTempSetpoint: controlValuesFromDB.waterTempSetpoint || ((_q = equipment.controls) === null || _q === void 0 ? void 0 : _q.waterTempSetpoint) || 180, // For boilers
            ...controlValuesFromDB, // Include any additional values from InfluxDB
        };
        // Log important control values
        logEquipment(equipmentId, `Using temperature setpoint: ${controlValues.temperatureSetpoint}°F`);
        logEquipment(equipmentId, `Using temperature source: ${controlValues.temperatureSource}`);
        // STEP 6: Get PID state from storage or initialize if not exists
        const pidStateKey = `${locationId}_${equipmentId}`;
        let pidState = pidStateStorage.get(pidStateKey);
        if (!pidState) {
            pidState = {
                heating: { integral: 0, previousError: 0, lastOutput: 0 },
                cooling: { integral: 0, previousError: 0, lastOutput: 0 },
                outdoorDamper: { integral: 0, previousError: 0, lastOutput: 0 },
                boiler: { integral: 0, previousError: 0, lastOutput: 0 },
            };
            pidStateStorage.set(pidStateKey, pidState);
        }
        // STEP 7: Create sandbox for logic evaluation
        const sandbox = {
            metrics: {
                ...metrics,
                ...standardizedMetrics,
            },
            settings: {
                temperatureSetpoint: controlValues.temperatureSetpoint,
                temperatureSource: controlValues.temperatureSource || "space",
                operationMode: controlValues.operationMode,
                fanEnabled: controlValues.fanEnabled,
                fanSpeed: controlValues.fanSpeed,
                heatingValvePosition: controlValues.heatingValvePosition,
                coolingValvePosition: controlValues.coolingValvePosition,
                heatingValveMode: controlValues.heatingValveMode,
                coolingValveMode: controlValues.coolingValveMode,
                unitEnable: controlValues.unitEnable,
                pidControllers: controlValues.pidControllers,
                equipmentType: equipment.type,
                waterTempSetpoint: controlValues.waterTempSetpoint || 180,
                locationId: equipment.locationId,
                equipmentId: equipmentId,
                system: equipment.system || metrics.system || "",
            },
        };
        // STEP 8: Determine which temperature to use
        let currentTemp;
        let temperatureSourceType = controlValues.temperatureSource || (locationId === "4" ? "supply" : "space");
        if (equipmentType.toLowerCase() === "boiler") {
            // For boilers, use water temperature
            currentTemp = standardizedMetrics.waterSupplyTemperature || metrics.H2OSupply || metrics.Supply || 180;
            logEquipment(equipmentId, `Using water supply temperature: ${currentTemp}°F`);
        }
        else if (temperatureSourceType === "supply") {
            // Use supply temperature
            currentTemp = standardizedMetrics.supplyTemperature || metrics.Supply || 55;
            logEquipment(equipmentId, `Using supply temperature: ${currentTemp}°F`);
        }
        else {
            // Use room temperature
            currentTemp = standardizedMetrics.roomTemperature || metrics.Room || 72;
            logEquipment(equipmentId, `Using room temperature: ${currentTemp}°F`);
        }
        // STEP 9: Evaluate custom logic for this equipment type
        logEquipment(equipmentId, `Evaluating custom logic for equipment type: ${equipmentType}, location: ${locationId}`);
        // Normalize the equipment type for lookup
        const normalizedType = equipmentType.toLowerCase().replace(/[^a-z0-9]/g, "-");
        // Select the appropriate control function based on location and equipment type
        let controlFunction;
        // Huntington (ID: 4)
        if (locationId === "4") {
            logEquipment(equipmentId, `Using Huntington-specific implementation for ${normalizedType}`);
            if (normalizedType === "fan-coil")
                controlFunction = fan_coil_3.fanCoilControl;
            else if (normalizedType === "boiler")
                controlFunction = boiler_3.boilerControl;
            else if (normalizedType === "pump" || normalizedType === "hwpump" || normalizedType === "cwpump")
                controlFunction = pumps_3.pumpControl;
            else if (normalizedType === "chiller")
                controlFunction = chiller_2.chillerControl;
            else
                controlFunction = getBaseImplementation(normalizedType);
        }
        // Warren (ID: 1)
        else if (locationId === "1") {
            logEquipment(equipmentId, `Using Warren-specific implementation for ${normalizedType}`);
            if (normalizedType === "fan-coil")
                controlFunction = fan_coil_2.fanCoilControl;
            else if (normalizedType === "pump" || normalizedType === "hwpump" || normalizedType === "cwpump")
                controlFunction = pumps_2.pumpControl;
            else if (normalizedType === "air-handler")
                controlFunction = air_handler_2.airHandlerControl;
            else if (normalizedType === "steam-bundle")
                controlFunction = steam_bundle_2.steamBundleControl;
            else
                controlFunction = getBaseImplementation(normalizedType);
        }
        // Hopebridge (ID: 5)
        else if (locationId === "5") {
            logEquipment(equipmentId, `Using Hopebridge-specific implementation for ${normalizedType}`);
            if (normalizedType === "boiler")
                controlFunction = boiler_2.boilerControl;
            else if (normalizedType === "air-handler")
                controlFunction = air_handler_3.airHandlerControl;
            else
                controlFunction = getBaseImplementation(normalizedType);
        }
        // Fall back to base implementation 
        else {
            controlFunction = getBaseImplementation(normalizedType);
        }
        if (!controlFunction) {
            return {
                success: false,
                error: `No control function found for equipment type: ${equipmentType}`,
                equipmentId,
                name: equipment.name || "Unknown",
                timestamp: Date.now(),
            };
        }
        // Execute the control function with timeout protection
        let evalResult;
        try {
            // Set timeout for logic execution
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error("Logic execution timed out after 5 seconds")), 5000);
            });
            // Execute control function
            const logicPromise = Promise.resolve(controlFunction(sandbox.metrics, sandbox.settings, currentTemp, pidState));
            // Wait for the first to complete (logic or timeout)
            const result = await Promise.race([logicPromise, timeoutPromise]);
            evalResult = {
                result,
                hasChanges: true,
                timestamp: Date.now(),
            };
        }
        catch (error) {
            console.error(`Error in control logic:`, error);
            return {
                success: false,
                error: String(error),
                equipmentId,
                name: equipment.name || "Unknown",
                timestamp: Date.now(),
            };
        }
        // STEP 10: Process the result
        const result = evalResult.result;
        const timestamp = Date.now();
        const promises = [];
        const failedCommands = [];
        let hasUpdates = false;
        // STEP 11: Validate and process control values
        if (result && typeof result === "object") {
            logEquipment(equipmentId, `Logic evaluation result:`, result);
            // Validate each control value before sending
            for (const [key, value] of Object.entries(result)) {
                // Skip if value hasn't changed
                if (controlValues[key] === value) {
                    continue;
                }
                // Validate the value based on its type
                let validValue = value;
                let isValid = true;
                switch (key) {
                    case 'heatingValvePosition':
                    case 'coolingValvePosition':
                    case 'outdoorDamperPosition':
                    case 'firingRate':
                        // Ensure values are between 0-100
                        if (typeof value !== 'number' || value < 0 || value > 100) {
                            validValue = typeof value === 'number' ? Math.max(0, Math.min(100, value)) : 0;
                            isValid = false;
                        }
                        break;
                    case 'temperatureSetpoint':
                    case 'waterTempSetpoint':
                        // Ensure temperature is in reasonable range
                        if (typeof value !== 'number' || value < 50 || value > 200) {
                            validValue = typeof value === 'number' ? Math.max(50, Math.min(200, value)) : 72;
                            isValid = false;
                        }
                        break;
                    case 'fanSpeed':
                        // Validate fan speed values
                        if (typeof value !== 'string' || !['low', 'medium', 'high', 'off'].includes(value)) {
                            validValue = 'low'; // Default to low
                            isValid = false;
                        }
                        break;
                    case 'fanEnabled':
                    case 'unitEnable':
                        // Ensure boolean values
                        if (typeof value !== 'boolean') {
                            validValue = !!value; // Convert to boolean
                            isValid = false;
                        }
                        break;
                }
                if (!isValid) {
                    logEquipment(equipmentId, `Invalid value for ${key}: ${value}, using ${validValue} instead`);
                }
                // Create command data for the API
                const commandData = {
                    command: `update_${key}`,
                    commandType: key,
                    equipmentId,
                    locationId: equipment.locationId,
                    timestamp,
                    value: validValue,
                    previousValue: (_r = controlValues[key]) !== null && _r !== void 0 ? _r : null,
                    source: "server_logic",
                    status: "completed",
                    userId: "neuralbms",
                    userName: "DevOps",
                    details: `${key} updated to ${validValue} by automated logic`,
                };
                logEquipment(equipmentId, `Sending control command: ${key} = ${validValue}`);
                // Send command to API
                const promise = sendControlCommand(`update_${key}`, commandData).then((result) => {
                    if (!result.success) {
                        failedCommands.push({ key, value: validValue, error: result.error });
                        logEquipment(equipmentId, `Command failed: ${key} = ${validValue}, error: ${result.error}`);
                    }
                    else {
                        logEquipment(equipmentId, `Command succeeded: ${key} = ${validValue}`);
                    }
                    return result;
                });
                promises.push(promise);
                // Update local control values
                controlValues[key] = validValue;
                hasUpdates = true;
            }
        }
        // STEP 12: Wait for all commands to be sent
        if (promises.length > 0) {
            logEquipment(equipmentId, `Updating control values with:`, controlValues);
            await Promise.all(promises);
            // STEP 13: If any commands failed, try to update Firestore directly as a fallback
            if (failedCommands.length > 0) {
                logEquipment(equipmentId, `Some commands failed, updating Firestore directly as fallback`);
                try {
                    if (db && !equipmentId.startsWith("test-")) {
                        const equipRef = (0, firestore_1.doc)(db, "equipment", equipmentId);
                        // Update controls in Firestore
                        await (0, firestore_1.updateDoc)(equipRef, {
                            controls: controlValues,
                            lastUpdated: new Date(),
                        });
                        logEquipment(equipmentId, `Updated equipment controls in Firestore as fallback`);
                    }
                }
                catch (firestoreError) {
                    console.error(`Error updating equipment in Firestore:`, firestoreError);
                }
            }
        }
        // Calculate total processing time
        const processingTime = Date.now() - startTime;
        logEquipment(equipmentId, `Logic processing complete, took ${processingTime}ms`);
        return {
            success: true,
            result: evalResult.result,
            equipmentId,
            name: equipment.name || "Unknown",
            timestamp: evalResult.timestamp,
            hasUpdates: hasUpdates,
            processingTime,
            commandCount: promises.length,
        };
    }
    catch (error) {
        console.error(`Error running logic for equipment ${equipmentId}:`, error);
        return {
            success: false,
            error: String(error),
            equipmentId,
            timestamp: Date.now(),
        };
    }
}
// Run logic for all equipment with custom logic enabled
async function runAllEquipmentLogic() {
    try {
        // Get start time to measure overall performance
        const startTime = Date.now();
        // Get the equipment list with custom logic enabled (uses caching internally)
        const equipmentList = await getEquipmentWithCustomLogic();
        console.log(`Found ${equipmentList.length} equipment with custom logic enabled`);
        // Initialize results array with pending status for all equipment
        const results = equipmentList.map(equipment => ({
            equipmentId: equipment.id,
            name: equipment.name || "Unknown",
            status: "queued",
            timestamp: Date.now(),
        }));
        // Clear existing queue
        queue.items.length = 0;
        // Prioritize equipment processing:
        // 1. Process boilers and lead equipment first (they control other equipment)
        // 2. Process fan coils and other equipment after
        // Create prioritized list
        const prioritizedEquipment = [...equipmentList].sort((a, b) => {
            var _a, _b, _c, _d;
            // First priority: Boilers
            if ((a.type || '').toLowerCase().includes('boiler') && !(b.type || '').toLowerCase().includes('boiler')) {
                return -1;
            }
            if (!(a.type || '').toLowerCase().includes('boiler') && (b.type || '').toLowerCase().includes('boiler')) {
                return 1;
            }
            // Second priority: Lead equipment (isLead === 1 or isLead === true)
            const aIsLead = ((_a = a.controls) === null || _a === void 0 ? void 0 : _a.isLead) === 1 || ((_b = a.controls) === null || _b === void 0 ? void 0 : _b.isLead) === true;
            const bIsLead = ((_c = b.controls) === null || _c === void 0 ? void 0 : _c.isLead) === 1 || ((_d = b.controls) === null || _d === void 0 ? void 0 : _d.isLead) === true;
            if (aIsLead && !bIsLead) {
                return -1;
            }
            if (!aIsLead && bIsLead) {
                return 1;
            }
            return 0;
        });
        // Process first few equipment immediately and in parallel (limited batch), and queue the rest
        const initialBatchSize = 3; // Process the 3 highest priority equipment immediately
        const initialBatch = prioritizedEquipment.slice(0, Math.min(initialBatchSize, prioritizedEquipment.length));
        if (initialBatch.length > 0) {
            try {
                console.log(`Processing initial batch of ${initialBatch.length} equipment immediately`);
                // Create promises for initial batch
                const initialPromises = initialBatch.map(async (equipment) => {
                    try {
                        console.log(`Processing high-priority equipment: ${equipment.id}`);
                        const result = await runEquipmentLogic(equipment.id);
                        // Update results for this equipment
                        const index = results.findIndex(r => r.equipmentId === equipment.id);
                        if (index >= 0) {
                            results[index] = result;
                        }
                        return result;
                    }
                    catch (error) {
                        console.error(`Error running logic for equipment ${equipment.id}:`, error);
                        return {
                            equipmentId: equipment.id,
                            name: equipment.name || "Unknown",
                            success: false,
                            error: String(error),
                            timestamp: Date.now(),
                        };
                    }
                });
                // Wait for all initial equipment to be processed
                await Promise.all(initialPromises);
            }
            catch (error) {
                console.error(`Error processing initial equipment batch:`, error);
            }
            // Queue the rest for sequential processing
            if (prioritizedEquipment.length > initialBatchSize) {
                console.log(`Queueing ${prioritizedEquipment.length - initialBatchSize} additional equipment for sequential processing`);
                for (let i = initialBatchSize; i < prioritizedEquipment.length; i++) {
                    queueEquipmentLogic(prioritizedEquipment[i].id);
                }
            }
        }
        // Calculate total time and expected completion time
        const initialBatchTime = Date.now() - startTime;
        const avgTimePerEquipment = initialBatch.length > 0 ? initialBatchTime / initialBatch.length : 2000; // default 2s if no data
        const expectedRemainingTime = avgTimePerEquipment * (equipmentList.length - initialBatchSize);
        console.log(`Initial batch processed in ${initialBatchTime}ms, avg ${Math.round(avgTimePerEquipment)}ms per equipment`);
        console.log(`Expected completion time for remaining equipment: ~${Math.round(expectedRemainingTime / 1000)}s`);
        // Return results for the initial batch immediately, the rest will process in the background
        return {
            success: true,
            message: `Server logic execution completed for ${initialBatch.length} equipment, ${equipmentList.length - initialBatch.length} more queued for processing`,
            results,
            queuedCount: equipmentList.length - initialBatch.length,
            timestamp: Date.now(),
            stats: {
                initialBatchTime,
                avgTimePerEquipment: Math.round(avgTimePerEquipment),
                expectedRemainingTime: Math.round(expectedRemainingTime),
                totalEquipment: equipmentList.length
            }
        };
    }
    catch (error) {
        console.error("Error running logic for all equipment:", error);
        return {
            success: false,
            message: String(error),
            results: [],
            timestamp: Date.now(),
        };
    }
}
