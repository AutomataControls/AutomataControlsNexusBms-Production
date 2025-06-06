"use strict";
// ===============================================================================
// Warren Logic Factory Worker
// ===============================================================================
//
// PURPOSE:
// Consumes equipment jobs from the BullMQ queue and processes Warren location
// equipment logic using the 4-parameter interface.
//
// ARCHITECTURE:
// Queue Consumer → Equipment Logic → InfluxDB Results
//
// WARREN EQUIPMENT PROCESSED:
// - 4x Air Handlers (complex economizer control)
// - 9x Fan Coils (zone control)
// - 2x HW Pumps (circulation control)
// - 1x Steam Bundle (heating control)
//
// ===============================================================================

const { Worker } = require('bullmq');
const fs = require('fs');
const path = require('path');
const Redis = require('ioredis');

// Redis connection for BullMQ
const connection = new Redis({
    host: 'localhost',
    port: 6379,
    maxRetriesPerRequest: null,
});

// Clear require cache on startup
Object.keys(require.cache).forEach(key => {
    if (key.includes('/warren/') || key.includes('equipment-logic')) {
        delete require.cache[key];
    }
});

// Clear Redis cache synchronously on startup
const clearCache = async () => {
    try {
        const keys = await connection.keys('*warren*');
        const locationKeys = await connection.keys('*location-1*');
        const equipmentKeys = await connection.keys('*equipment-logic-1*');
        const queueKeys = await connection.keys('*already-queued*');

        const allKeys = [...keys, ...locationKeys, ...equipmentKeys, ...queueKeys];
        if (allKeys.length > 0) {
            await connection.del(...allKeys);
            console.log(`[Warren Logic Factory] Cleared ${allKeys.length} cache keys`);
        }
    } catch (error) {
        console.error('[Warren Logic Factory] Cache clear error:', error);
    }
};

// Clear cache before starting worker
clearCache();

// Warren equipment logic path
const EQUIPMENT_PATH = '/opt/productionapp/dist/lib/equipment-logic/locations/warren';

// Warren Logic Factory Worker
const warrenLogicWorker = new Worker(
    'equipment-logic-1',
    async (job) => {
        const { equipmentId, locationId, type: equipmentType } = job.data;

        // Only process Warren equipment (location ID = 1)
        if (locationId !== '1') {
            console.log(`[Warren Logic Factory] Skipping non-Warren equipment: ${equipmentId}`);
            return;
        }

        console.log(`[Warren Logic Factory] Processing ${equipmentType} (${equipmentId})...`);

        try {
            // Determine equipment file based on type
            const equipmentFile = getEquipmentFile(equipmentType);
            if (!equipmentFile) {
                throw new Error(`Unknown equipment type: ${equipmentType}`);
            }

            // Execute equipment logic with 4-parameter interface
            const results = await executeEquipmentLogic(equipmentFile, equipmentId, equipmentType);

            // Write results to InfluxDB
            await writeEquipmentResults(equipmentType, results, equipmentId);

            console.log(`[Warren Logic Factory] Completed ${equipmentType} (${equipmentId}) successfully`);
            return { success: true, equipmentId, results: results.length };

        } catch (error) {
            console.error(`[Warren Logic Factory] Error processing ${equipmentType} (${equipmentId}):`, error);
            throw error;
        }
    },
    {
        connection,
        concurrency: 4, // Warren has more equipment types, increase concurrency
        removeOnComplete: 10,
        removeOnFail: 5,
        settings: {
            stalledInterval: 300000,    // 300 seconds before job considered stalled
            maxStalledCount: 3,        // Max times job can stall before failing
            retryProcessDelay: 5000,   // 5 second delay between retries
        }
    }
);

// Map equipment types to files - WARREN EQUIPMENT IDs
function getEquipmentFile(equipmentType) {
    const typeMapping = {
        // WARREN AIR HANDLERS (4 units with complex economizer control)
        'air-handler-1': 'air-handler.js',
        'air-handler-2': 'air-handler.js',
        'air-handler-4': 'air-handler.js',
        'air-handler-7': 'air-handler.js',

        // WARREN FAN COILS (9 units for zone control)
        'fan-coil-1': 'fan-coil.js',
        'fan-coil-2': 'fan-coil.js',
        'fan-coil-3': 'fan-coil.js',
        'fan-coil-4': 'fan-coil.js',
        'fan-coil-5': 'fan-coil.js',
        'fan-coil-6': 'fan-coil.js',
        'fan-coil-8': 'fan-coil.js',
        'fan-coil-10': 'fan-coil.js',
        'fan-coil-11': 'fan-coil.js',

        // WARREN HW PUMPS (2 units for circulation)
        'hw-pump-1': 'pumps.js',
        'hw-pump-2': 'pumps.js',

        // WARREN STEAM BUNDLE (1 unit for heating)
        'steam-bundle': 'steam-bundle.js'
    };

    const mappedFile = typeMapping[equipmentType];

    if (!mappedFile) {
        console.log(`[Warren Logic Factory] Unknown equipment type: ${equipmentType}`);
        console.log(`[Warren Logic Factory] Available types:`, Object.keys(typeMapping));
        return null;
    }

    console.log(`[Warren Logic Factory] Mapping ${equipmentType} → ${mappedFile}`);
    return mappedFile;
}

// Execute equipment logic with proper 4-parameter interface
async function executeEquipmentLogic(fileName, equipmentId, equipmentType) {
    try {
        const filePath = path.join(EQUIPMENT_PATH, fileName);

        // Dynamic import the equipment module
        delete require.cache[require.resolve(filePath)];
        const equipmentModule = require(filePath);

        // Find the appropriate equipment function
        let equipmentFunction = null;

        if (typeof equipmentModule.default === 'function') {
            equipmentFunction = equipmentModule.default;
        } else if (typeof equipmentModule.processEquipment === 'function') {
            equipmentFunction = equipmentModule.processEquipment;
        } else if (typeof equipmentModule.runLogic === 'function') {
            equipmentFunction = equipmentModule.runLogic;
        } else if (typeof equipmentModule.airHandlerControl === 'function') {
            equipmentFunction = equipmentModule.airHandlerControl;
        } else if (typeof equipmentModule.fanCoilControl === 'function') {
            equipmentFunction = equipmentModule.fanCoilControl;
        } else if (typeof equipmentModule.pumpControl === 'function') {
            equipmentFunction = equipmentModule.pumpControl;
        } else if (typeof equipmentModule.steamBundleControl === 'function') {
            equipmentFunction = equipmentModule.steamBundleControl;
        }

        if (!equipmentFunction) {
            throw new Error(`No equipment function found in ${fileName}`);
        }

        // STEP 1: Gather metricsInput from InfluxDB for THIS specific equipment
        const metricsInput = await gatherMetricsData(equipmentId);

        // STEP 2: Gather settingsInput using the real equipment ID
        const settingsInput = await gatherSettingsData(fileName, equipmentId, equipmentType);

        // STEP 3: Get currentTempArgument from metrics based on equipment type
        const currentTempArgument = getCurrentTemperature(metricsInput, equipmentType);

        // STEP 4: Get state storage
        const stateStorageInput = await gatherStateStorage();

        console.log(`[Warren Logic Factory] Calling ${fileName} with 4 parameters:`);
        console.log(`  - metricsInput: ${Object.keys(metricsInput).length} metrics for ${equipmentId}`);
        console.log(`  - settingsInput: equipmentId=${settingsInput.equipmentId}`);
        console.log(`  - currentTempArgument: ${currentTempArgument}`);
        console.log(`  - stateStorageInput: ${Object.keys(stateStorageInput).length} state items`);

        // Execute the equipment logic with proper 4 parameters
        const results = await equipmentFunction(metricsInput, settingsInput, currentTempArgument, stateStorageInput);

        // Ensure results is an array and log what we got back
        const resultsArray = Array.isArray(results) ? results : [results];
        console.log(`[Warren Logic Factory] Equipment logic returned:`, resultsArray);

        return resultsArray;

    } catch (error) {
        console.error(`[Warren Logic Factory] Logic execution error:`, error);
        return [];
    }
}

// Helper function to gather current metrics from InfluxDB
async function gatherMetricsData(equipmentId) {
    try {
        const database = process.env.INFLUXDB_DATABASE || 'Locations';
        const influxUrl = process.env.INFLUXDB_URL || 'http://143.198.162.31:8181';

        const query = `
            SELECT *
            FROM metrics
            WHERE "equipmentId" = '${equipmentId}'
            AND location_id = '1'
            AND time >= now() - INTERVAL '15 minutes'
            ORDER BY time DESC
            LIMIT 100
        `;

        const response = await fetch(`${influxUrl}/api/v3/query_sql`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: query, db: database })
        });

        if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data) && data.length > 0) {
                const metricsObject = {};
                const skipFields = ['equipmentId', 'location_id', 'time', 'equipment_type', 'system', 'zone'];

                for (const metric of data) {
                    Object.entries(metric).forEach(([key, value]) => {
                        if (!skipFields.includes(key) && value !== null && value !== undefined && value !== '') {
                            if (!metricsObject[key]) {
                                metricsObject[key] = value;
                            }
                        }
                    });

                    if (metric.equipmentId) metricsObject.equipmentId = metric.equipmentId;
                    if (metric.location_id) metricsObject.locationId = metric.location_id;
                }

                console.log(`[Warren Logic Factory] Gathered ${Object.keys(metricsObject).length} metrics for equipment ${equipmentId}`);
                return metricsObject;
            }
        }

        console.log(`[Warren Logic Factory] No recent metrics found for equipment ${equipmentId}, using defaults`);
        return {
            Outdoor_Air: 50,
            RoomTemp: 72,
            SupplyTemp: 55,
            equipmentId: equipmentId,
            locationId: '1'
        };

    } catch (error) {
        console.error(`[Warren Logic Factory] Error gathering metrics for ${equipmentId}:`, error);
        return {
            Outdoor_Air: 50,
            RoomTemp: 72,
            SupplyTemp: 55,
            equipmentId: equipmentId,
            locationId: '1'
        };
    }
}

// Helper function to gather settings data
async function gatherSettingsData(fileName, equipmentId, equipmentType) {
    try {
        const settingsInput = {
            equipmentId: equipmentId,
            locationId: '1', // Warren location ID
            locationName: 'warren',
            equipmentType: fileName.replace(/\.js$/, ''),
            enabled: true,
            tempSetpoint: 72,
            heatingSetpoint: 70,
            coolingSetpoint: 74,
            fanMinSpeed: 20,
            fanMaxSpeed: 100,
            pumpMinSpeed: 20,
            pumpMaxSpeed: 100,
            steamMinTemp: 120,
            steamMaxTemp: 180,
            // Air handler specific settings
            economizer: true,
            minOutdoorAir: 15,
            maxOutdoorAir: 100,
            economizer_lockout: 65
        };

        console.log(`[Warren Logic Factory] Settings for ${fileName}: equipmentId=${equipmentId}`);
        return settingsInput;

    } catch (error) {
        console.error(`[Warren Logic Factory] Error gathering settings:`, error);
        return {
            equipmentId: equipmentId,
            locationId: '1',
            locationName: 'warren'
        };
    }
}

// Helper function to extract current temperature based on equipment type
function getCurrentTemperature(metricsInput, equipmentType) {
    // For air handlers, use space/zone temperature for control decisions
    if (equipmentType && equipmentType.includes('air-handler')) {
        const airHandlerTempSources = [
            'SpaceTemp', 'Space_Temp', 'ZoneTemp', 'Zone_Temp',
            'RoomTemp', 'Room_Temp', 'ReturnTemp', 'Return_Temp'
        ];
        for (const source of airHandlerTempSources) {
            if (metricsInput[source] !== undefined && !isNaN(parseFloat(metricsInput[source]))) {
                const temp = parseFloat(metricsInput[source]);
                console.log(`[Warren Logic Factory] Using air handler space temp from metrics.${source}: ${temp}°F`);
                return temp;
            }
        }
    }

    // For fan coils, use zone/room temperature
    if (equipmentType && equipmentType.includes('fan-coil')) {
        const fanCoilTempSources = [
            'ZoneTemp', 'Zone_Temp', 'RoomTemp', 'Room_Temp',
            'SpaceTemp', 'Space_Temp', 'currentTemp'
        ];
        for (const source of fanCoilTempSources) {
            if (metricsInput[source] !== undefined && !isNaN(parseFloat(metricsInput[source]))) {
                const temp = parseFloat(metricsInput[source]);
                console.log(`[Warren Logic Factory] Using fan coil zone temp from metrics.${source}: ${temp}°F`);
                return temp;
            }
        }
    }

    // For steam bundle, use supply/heating temperature
    if (equipmentType && equipmentType.includes('steam')) {
        const steamTempSources = [
            'SteamTemp', 'Steam_Temp', 'SupplyTemp', 'Supply_Temp',
            'HeatingTemp', 'Heating_Temp', 'SteamSupply'
        ];
        for (const source of steamTempSources) {
            if (metricsInput[source] !== undefined && !isNaN(parseFloat(metricsInput[source]))) {
                const temp = parseFloat(metricsInput[source]);
                console.log(`[Warren Logic Factory] Using steam supply temp from metrics.${source}: ${temp}°F`);
                return temp;
            }
        }
    }

    // For pumps and all other equipment, use outdoor temperature for control
    const outdoorTempSources = [
        'Outdoor_Air', 'outdoorTemperature', 'outdoorTemp', 'Outdoor', 'outdoor',
        'OutdoorTemp', 'OAT', 'oat', 'OutdoorAir', 'Outdoor Air'
    ];

    for (const source of outdoorTempSources) {
        if (metricsInput[source] !== undefined && !isNaN(parseFloat(metricsInput[source]))) {
            const temp = parseFloat(metricsInput[source]);
            console.log(`[Warren Logic Factory] Using outdoor temperature from metrics.${source}: ${temp}°F for ${equipmentType}`);
            return temp;
        }
    }

    console.log(`[Warren Logic Factory] No temperature found for ${equipmentType}, using default: 72°F`);
    return 72;
}

// Helper function to gather state storage
async function gatherStateStorage() {
    try {
        return {
            lastControlUpdate: Date.now(),
            pidIntegral: 0,
            pidDerivative: 0,
            lastError: 0
        };
    } catch (error) {
        console.error(`[Warren Logic Factory] Error gathering state storage:`, error);
        return {};
    }
}

// Extract actionable commands from results - Warren Equipment Commands
function extractActionableCommands(result) {
    const actionable = {};

    // AIR HANDLER COMMANDS (from warren/air-handler.js)
    if (result.fanEnable !== undefined) actionable.fanEnable = result.fanEnable;
    if (result.fanSpeed !== undefined) actionable.fanSpeed = result.fanSpeed;
    if (result.heatingValve !== undefined) actionable.heatingValve = result.heatingValve;
    if (result.coolingValve !== undefined) actionable.coolingValve = result.coolingValve;
    if (result.outdoorDamper !== undefined) actionable.outdoorDamper = result.outdoorDamper;
    if (result.returnDamper !== undefined) actionable.returnDamper = result.returnDamper;
    if (result.mixedAirDamper !== undefined) actionable.mixedAirDamper = result.mixedAirDamper;
    if (result.supplyTempSetpoint !== undefined) actionable.supplyTempSetpoint = result.supplyTempSetpoint;
    if (result.economizer !== undefined) actionable.economizer = result.economizer;
    if (result.unitEnable !== undefined) actionable.unitEnable = result.unitEnable;
    if (result.temperatureSetpoint !== undefined) actionable.temperatureSetpoint = result.temperatureSetpoint;

    // FAN COIL COMMANDS (from warren/fan-coil.js)
    if (result.fanEnabled !== undefined) actionable.fanEnabled = result.fanEnabled;
    if (result.heatingValvePosition !== undefined) actionable.heatingValvePosition = result.heatingValvePosition;
    if (result.coolingValvePosition !== undefined) actionable.coolingValvePosition = result.coolingValvePosition;
    if (result.heatingEnable !== undefined) actionable.heatingEnable = result.heatingEnable;
    if (result.coolingEnable !== undefined) actionable.coolingEnable = result.coolingEnable;

    // PUMP COMMANDS (from warren/pumps.js)
    if (result.pumpEnable !== undefined) actionable.pumpEnable = result.pumpEnable;
    if (result.pumpSpeed !== undefined) actionable.pumpSpeed = result.pumpSpeed;
    if (result.pumpCommand !== undefined) actionable.pumpCommand = result.pumpCommand;
    if (result.leadLagStatus !== undefined) actionable.leadLagStatus = result.leadLagStatus;
    if (result.isLead !== undefined) actionable.isLead = result.isLead;
    if (result.leadLagGroupId !== undefined) actionable.leadLagGroupId = result.leadLagGroupId;
    if (result.leadEquipmentId !== undefined) actionable.leadEquipmentId = result.leadEquipmentId;
    if (result.leadLagReason !== undefined) actionable.leadLagReason = result.leadLagReason;

    // STEAM BUNDLE COMMANDS (from warren/steam-bundle.js)
    if (result.steamValve !== undefined) actionable.steamValve = result.steamValve;
    if (result.steamEnable !== undefined) actionable.steamEnable = result.steamEnable;
    if (result.steamTempSetpoint !== undefined) actionable.steamTempSetpoint = result.steamTempSetpoint;
    if (result.steamPressure !== undefined) actionable.steamPressure = result.steamPressure;

    return actionable;
}

// Write equipment results to NeuralControlCommands - Convert all to strings with debug
async function writeEquipmentResults(equipmentType, results, equipmentId) {
    try {
        const database = 'NeuralControlCommands';
        const influxUrl = process.env.INFLUXDB_URL || 'http://143.198.162.31:8181';

        console.log(`[Warren Logic Factory] Writing results to ${database} for ${equipmentType} (${equipmentId})`);
        console.log(`[DEBUG] writeEquipmentResults called with ${results.length} results`);

        for (const result of results) {
            console.log(`[DEBUG] Processing result:`, result);

            if (!result || typeof result !== 'object') {
                console.log(`[Warren Logic Factory] Skipping invalid result:`, result);
                continue;
            }

            const actionableCommands = extractActionableCommands(result);
            if (Object.keys(actionableCommands).length === 0) {
                console.log(`[Warren Logic Factory] No actionable commands found in result:`, result);
                continue;
            }

            console.log(`[Warren Logic Factory] Extracted ${Object.keys(actionableCommands).length} commands:`,
                Object.keys(actionableCommands).join(', '));

            // Create individual line protocol entries for each command
            const lineProtocolEntries = [];

            for (const [commandType, value] of Object.entries(actionableCommands)) {
                // Convert all values to strings for the Boolean column
                const formattedValue = `"${String(value)}"`;

                // Create line protocol entry
                const lineProtocol = `NeuralCommands,equipment_id=${equipmentId},location_id=1,command_type=${commandType},equipment_type=${equipmentType},source=warren-logic-factory,status=active value=${formattedValue}`;
                console.log(`[DEBUG] Line protocol: ${lineProtocol}`);
                lineProtocolEntries.push(lineProtocol);
            }

            // Send all commands in one batch
            if (lineProtocolEntries.length > 0) {
                console.log(`[DEBUG] About to send ${lineProtocolEntries.length} entries to InfluxDB`);
                const batchData = lineProtocolEntries.join('\n');

                try {
                    const response = await fetch(`${influxUrl}/api/v3/write_lp?db=${database}&precision=nanosecond`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'text/plain' },
                        body: batchData
                    });

                    if (response.ok) {
                        console.log(`[Warren Logic Factory] Successfully wrote ${lineProtocolEntries.length} commands to ${database}`);
                    } else {
                        const errorText = await response.text();
                        console.error(`[Warren Logic Factory] Write failed: ${response.status} - ${errorText}`);
                    }
                } catch (fetchError) {
                    console.error(`[Warren Logic Factory] Fetch error writing to ${database}:`, fetchError);
                }
            }
        }
    } catch (error) {
        console.error(`[Warren Logic Factory] Write error:`, error);
    }
}

// Worker event handlers
warrenLogicWorker.on('completed', (job) => {
    console.log(`[Warren Logic Factory] Job ${job.id} completed successfully`);
});

warrenLogicWorker.on('failed', (job, err) => {
    console.error(`[Warren Logic Factory] Job ${job.id} failed:`, err);
});

warrenLogicWorker.on('error', (err) => {
    console.error('[Warren Logic Factory] Worker error:', err);
});

// Graceful shutdown
async function shutdown() {
    console.log('[Warren Logic Factory] Shutting down...');
    await warrenLogicWorker.close();
    await connection.quit();
    process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log('[Warren Logic Factory] Warren Logic Factory Worker started and waiting for jobs...');
console.log('[Warren Logic Factory] Concurrency: 4 workers');
console.log('[Warren Logic Factory] Processing Warren equipment (location ID: 1)');
