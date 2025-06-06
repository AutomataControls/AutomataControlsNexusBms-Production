"use strict";
// ===============================================================================
// FirstChurchOfGod Logic Factory Worker
// ===============================================================================
//
// Author: Juelz NeuralBms DevOps
// Last Updated: June 5, 2025
//
// PURPOSE:
// Consumes equipment jobs from the BullMQ queue and processes FirstChurchOfGod location
// equipment logic using the 4-parameter interface.
//
// ARCHITECTURE:
// Queue Consumer → Equipment Logic → InfluxDB Results
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
    if (key.includes('/firstchurchofgod/') || key.includes('equipment-logic')) {
        delete require.cache[key];
    }
});

// Clear Redis cache synchronously on startup
const clearCache = async () => {
    try {
        const keys = await connection.keys('*firstchurchofgod*');
        const locationKeys = await connection.keys('*location-9*');
        const equipmentKeys = await connection.keys('*equipment-logic-9*');
        const queueKeys = await connection.keys('*already-queued*');

        const allKeys = [...keys, ...locationKeys, ...equipmentKeys, ...queueKeys];
        if (allKeys.length > 0) {
            await connection.del(...allKeys);
            console.log(`[FirstChurchOfGod Logic Factory] Cleared ${allKeys.length} cache keys`);
        }
    } catch (error) {
        console.error('[FirstChurchOfGod Logic Factory] Cache clear error:', error);
    }
};

// Clear cache before starting worker
clearCache();

// FirstChurchOfGod equipment logic path
const EQUIPMENT_PATH = '/opt/productionapp/dist/lib/equipment-logic/locations/firstchurchofgod';

// FirstChurchOfGod Logic Factory Worker
const firstchurchofgodLogicWorker = new Worker(
    'equipment-logic-9',
    async (job) => {
        const { equipmentId, locationId, type: equipmentType } = job.data;

        // Only process FirstChurchOfGod equipment (location ID = 9)
        if (locationId !== '9') {
            console.log(`[FirstChurchOfGod Logic Factory] Skipping non-FirstChurchOfGod equipment: ${equipmentId}`);
            return;
        }

        console.log(`[FirstChurchOfGod Logic Factory] Processing ${equipmentType} (${equipmentId})...`);

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

            console.log(`[FirstChurchOfGod Logic Factory] Completed ${equipmentType} (${equipmentId}) successfully`);
            return { success: true, equipmentId, results: results.length };

        } catch (error) {
            console.error(`[FirstChurchOfGod Logic Factory] Error processing ${equipmentType} (${equipmentId}):`, error);
            throw error;
        }
    },
    {
        connection,
        concurrency: 5,
        removeOnComplete: 50,
        removeOnFail: 25,
        settings: {
            stalledInterval: 300000,
            maxStalledCount: 3,
            retryProcessDelay: 5000,
        }
    }
);

// Map equipment types to files - FIRSTCHURCHOFGOD EQUIPMENT
function getEquipmentFile(equipmentType) {
    const typeMapping = {
        // FIRSTCHURCHOFGOD EQUIPMENT
        'air-handler-1': 'air-handler.js',
        'boiler-1': 'boiler.js',
        'chiller-1': 'chiller.js',
        'chiller-2': 'chiller.js',
        'cw-pump-1': 'pumps.js',
        'cw-pump-2': 'pumps.js',
        'hw-pump-1': 'pumps.js',
        'hw-pump-2': 'pumps.js'
    };

    const mappedFile = typeMapping[equipmentType];

    if (!mappedFile) {
        console.log(`[FirstChurchOfGod Logic Factory] Unknown equipment type: ${equipmentType}`);
        console.log(`[FirstChurchOfGod Logic Factory] Available types:`, Object.keys(typeMapping));
        return null;
    }

    console.log(`[FirstChurchOfGod Logic Factory] Mapping ${equipmentType} → ${mappedFile}`);
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
        } else if (typeof equipmentModule.boilerControl === 'function') {
            equipmentFunction = equipmentModule.boilerControl;
        } else if (typeof equipmentModule.chillerControl === 'function') {
            equipmentFunction = equipmentModule.chillerControl;
        } else if (typeof equipmentModule.pumpControl === 'function') {
            equipmentFunction = equipmentModule.pumpControl;
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

        console.log(`[FirstChurchOfGod Logic Factory] Calling ${fileName} with 4 parameters:`);
        console.log(`  - metricsInput: ${Object.keys(metricsInput).length} metrics for ${equipmentId}`);
        console.log(`  - settingsInput: equipmentId=${settingsInput.equipmentId}`);
        console.log(`  - currentTempArgument: ${currentTempArgument}`);
        console.log(`  - stateStorageInput: ${Object.keys(stateStorageInput).length} state items`);

        // Execute the equipment logic with proper 4 parameters
        const results = await equipmentFunction(metricsInput, settingsInput, currentTempArgument, stateStorageInput);

        // Ensure results is an array and log what we got back
        const resultsArray = Array.isArray(results) ? results : [results];
        console.log(`[FirstChurchOfGod Logic Factory] Equipment logic returned:`, resultsArray);

        return resultsArray;

    } catch (error) {
        console.error(`[FirstChurchOfGod Logic Factory] Logic execution error:`, error);
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
            AND location_id = '9'
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

                console.log(`[FirstChurchOfGod Logic Factory] Gathered ${Object.keys(metricsObject).length} metrics for equipment ${equipmentId}`);
                return metricsObject;
            }
        }

        console.log(`[FirstChurchOfGod Logic Factory] No recent metrics found for equipment ${equipmentId}, using defaults`);
        return {
            Outdoor_Air: 50,
            RoomTemp: 72,
            SupplyTemp: 55,
            ReturnTemp: 70,
            equipmentId: equipmentId,
            locationId: '9'
        };

    } catch (error) {
        console.error(`[FirstChurchOfGod Logic Factory] Error gathering metrics for ${equipmentId}:`, error);
        return {
            Outdoor_Air: 50,
            RoomTemp: 72,
            SupplyTemp: 55,
            ReturnTemp: 70,
            equipmentId: equipmentId,
            locationId: '9'
        };
    }
}

// Helper function to gather settings data
async function gatherSettingsData(fileName, equipmentId, equipmentType) {
    try {
        const settingsInput = {
            equipmentId: equipmentId,
            locationId: '9',
            locationName: 'firstchurchofgod',
            equipmentType: fileName.replace(/\.js$/, ''),
            enabled: true,
            tempSetpoint: 72,
            heatingSetpoint: 70,
            coolingSetpoint: 74,
            fanMinSpeed: 20,
            fanMaxSpeed: 100,
            boilerMinTemp: 80,
            boilerMaxTemp: 180,
            chillerMinTemp: 40,
            chillerMaxTemp: 60,
            pumpMinSpeed: 20,
            pumpMaxSpeed: 100
        };

        console.log(`[FirstChurchOfGod Logic Factory] Settings for ${fileName}: equipmentId=${equipmentId}`);
        return settingsInput;

    } catch (error) {
        console.error(`[FirstChurchOfGod Logic Factory] Error gathering settings:`, error);
        return {
            equipmentId: equipmentId,
            locationId: '9',
            locationName: 'firstchurchofgod'
        };
    }
}

// Helper function to extract current temperature based on equipment type
function getCurrentTemperature(metricsInput, equipmentType) {
    // Different temperature sources based on equipment type
    if (equipmentType && equipmentType.includes('chiller')) {
        // For chillers, use outdoor temperature for lockout decisions
        const chillerTempSources = ['Outdoor_Air', 'outdoorTemperature', 'outdoorTemp', 'Outdoor'];
        for (const source of chillerTempSources) {
            if (metricsInput[source] !== undefined && !isNaN(parseFloat(metricsInput[source]))) {
                const temp = parseFloat(metricsInput[source]);
                console.log(`[FirstChurchOfGod Logic Factory] Using outdoor temperature from metrics.${source}: ${temp}°F for ${equipmentType}`);
                return temp;
            }
        }
    } else {
        // For other equipment, use room/space temperature
        const tempSources = [
            'RoomTemp', 'Room_Temp', 'Room Temperature', 'ZoneTemp',
            'SupplyTemp', 'Supply_Temp', 'Supply Temperature',
            'ReturnTemp', 'Return_Temp', 'Return Temperature',
            'SpaceTemp', 'Space_Temp', 'currentTemp'
        ];
        
        for (const source of tempSources) {
            if (metricsInput[source] !== undefined && !isNaN(parseFloat(metricsInput[source]))) {
                const temp = parseFloat(metricsInput[source]);
                console.log(`[FirstChurchOfGod Logic Factory] Using temperature from metrics.${source}: ${temp}°F for ${equipmentType}`);
                return temp;
            }
        }
    }

    console.log(`[FirstChurchOfGod Logic Factory] No temperature found for ${equipmentType}, using default: 72°F`);
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
        console.error(`[FirstChurchOfGod Logic Factory] Error gathering state storage:`, error);
        return {};
    }
}

// Extract actionable commands from results - FirstChurchOfGod specific
function extractActionableCommands(result) {
    const actionable = {};

    // AIR HANDLER COMMANDS
    if (result.heatingValve !== undefined) actionable.heatingValve = result.heatingValve;
    if (result.heatingValvePosition !== undefined) actionable.heatingValvePosition = result.heatingValvePosition;
    if (result.coolingValve !== undefined) actionable.coolingValve = result.coolingValve;
    if (result.coolingValvePosition !== undefined) actionable.coolingValvePosition = result.coolingValvePosition;
    if (result.fanEnable !== undefined) actionable.fanEnable = result.fanEnable;
    if (result.fanEnabled !== undefined) actionable.fanEnabled = result.fanEnabled;
    if (result.fanSpeed !== undefined) actionable.fanSpeed = result.fanSpeed;
    if (result.outdoorDamper !== undefined) actionable.outdoorDamper = result.outdoorDamper;
    if (result.outdoorDamperPosition !== undefined) actionable.outdoorDamperPosition = result.outdoorDamperPosition;
    if (result.unitEnable !== undefined) actionable.unitEnable = result.unitEnable;
    if (result.supplyTempSetpoint !== undefined) actionable.supplyTempSetpoint = result.supplyTempSetpoint;
    if (result.temperatureSetpoint !== undefined) actionable.temperatureSetpoint = result.temperatureSetpoint;

    // BOILER COMMANDS
    if (result.boilerEnable !== undefined) actionable.boilerEnable = result.boilerEnable;
    if (result.boilerFiring !== undefined) actionable.boilerFiring = result.boilerFiring;
    if (result.waterTempSetpoint !== undefined) actionable.waterTempSetpoint = result.waterTempSetpoint;
    if (result.firing !== undefined) actionable.firing = result.firing;
    if (result.isLead !== undefined) actionable.isLead = result.isLead;
    if (result.leadLagGroupId !== undefined) actionable.leadLagGroupId = result.leadLagGroupId;

    // CHILLER COMMANDS
    if (result.chillerEnable !== undefined) actionable.chillerEnable = result.chillerEnable;
    if (result.chillerSetpoint !== undefined) actionable.chillerSetpoint = result.chillerSetpoint;
    if (result.cwPumpEnable !== undefined) actionable.cwPumpEnable = result.cwPumpEnable;
    if (result.compressorStage !== undefined) actionable.compressorStage = result.compressorStage;
    if (result.stage1Enabled !== undefined) actionable.stage1Enabled = result.stage1Enabled;
    if (result.stage2Enabled !== undefined) actionable.stage2Enabled = result.stage2Enabled;

    // PUMP COMMANDS
    if (result.pumpEnable !== undefined) actionable.pumpEnable = result.pumpEnable;
    if (result.pumpSpeed !== undefined) actionable.pumpSpeed = result.pumpSpeed;
    if (result.pumpCommand !== undefined) actionable.pumpCommand = result.pumpCommand;
    if (result.leadLagStatus !== undefined) actionable.leadLagStatus = result.leadLagStatus;

    return actionable;
}

// Write equipment results to NeuralControlCommands - HUNTINGTON PATTERN
async function writeEquipmentResults(equipmentType, results, equipmentId) {
    try {
        const database = 'NeuralControlCommands';
        const influxUrl = process.env.INFLUXDB_URL || 'http://143.198.162.31:8181';

        console.log(`[FirstChurchOfGod Logic Factory] Writing results to ${database} for ${equipmentType} (${equipmentId})`);
        console.log(`[DEBUG] writeEquipmentResults called with ${results.length} results`);

        for (const result of results) {
            console.log(`[DEBUG] Processing result:`, result);

            if (!result || typeof result !== 'object') {
                console.log(`[FirstChurchOfGod Logic Factory] Skipping invalid result:`, result);
                continue;
            }

            const actionableCommands = extractActionableCommands(result);
            if (Object.keys(actionableCommands).length === 0) {
                console.log(`[FirstChurchOfGod Logic Factory] No actionable commands found in result:`, result);
                continue;
            }

            console.log(`[FirstChurchOfGod Logic Factory] Extracted ${Object.keys(actionableCommands).length} commands:`,
                Object.keys(actionableCommands).join(', '));

            // Create individual line protocol entries for each command
            const lineProtocolEntries = [];

            for (const [commandType, value] of Object.entries(actionableCommands)) {
                // Convert all values to strings for the Boolean column
                const formattedValue = `"${String(value)}"`;

                // Create line protocol entry - MATCH HUNTINGTON FORMAT
                const lineProtocol = `NeuralCommands,equipment_id=${equipmentId},location_id=9,command_type=${commandType},equipment_type=${equipmentType},source=firstchurchofgod-logic-factory,status=active value=${formattedValue}`;
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
                        console.log(`[FirstChurchOfGod Logic Factory] Successfully wrote ${lineProtocolEntries.length} commands to ${database}`);
                    } else {
                        const errorText = await response.text();
                        console.error(`[FirstChurchOfGod Logic Factory] Write failed: ${response.status} - ${errorText}`);
                    }
                } catch (fetchError) {
                    console.error(`[FirstChurchOfGod Logic Factory] Fetch error writing to ${database}:`, fetchError);
                }
            }
        }
    } catch (error) {
        console.error(`[FirstChurchOfGod Logic Factory] Write error:`, error);
    }
}

// Worker event handlers
firstchurchofgodLogicWorker.on('completed', (job) => {
    console.log(`[FirstChurchOfGod Logic Factory] Job ${job.id} completed successfully`);
});

firstchurchofgodLogicWorker.on('failed', (job, err) => {
    console.error(`[FirstChurchOfGod Logic Factory] Job ${job.id} failed:`, err);
});

firstchurchofgodLogicWorker.on('error', (err) => {
    console.error('[FirstChurchOfGod Logic Factory] Worker error:', err);
});

// Graceful shutdown
async function shutdown() {
    console.log('[FirstChurchOfGod Logic Factory] Shutting down...');
    await firstchurchofgodLogicWorker.close();
    await connection.quit();
    process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log('[FirstChurchOfGod Logic Factory] FirstChurchOfGod Logic Factory Worker started - Processing church equipment');
console.log('[FirstChurchOfGod Logic Factory] Equipment supported: air-handler-1, boiler-1, chiller-1, chiller-2, cw-pump-1, cw-pump-2, hw-pump-1, hw-pump-2');
console.log('[FirstChurchOfGod Logic Factory] Queue: equipment-logic-9, Concurrency: 5, Location ID: 9');
console.log('[FirstChurchOfGod Logic Factory] Redis connected');
