"use strict";
// ===============================================================================
// Huntington Logic Factory Worker
// ===============================================================================
//
// PURPOSE:
// Consumes equipment jobs from the BullMQ queue and processes Huntington location
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
    if (key.includes('/huntington/') || key.includes('equipment-logic')) {
        delete require.cache[key];
    }
});

// Clear Redis cache synchronously on startup
const clearCache = async () => {
    try {
        const keys = await connection.keys('*huntington*');
        const locationKeys = await connection.keys('*location-4*');
        const equipmentKeys = await connection.keys('*equipment-logic-4*');
        const queueKeys = await connection.keys('*already-queued*');
        
        const allKeys = [...keys, ...locationKeys, ...equipmentKeys, ...queueKeys];
        if (allKeys.length > 0) {
            await connection.del(...allKeys);
            console.log(`[Huntington Logic Factory] Cleared ${allKeys.length} cache keys`);
        }
    } catch (error) {
        console.error('[Huntington Logic Factory] Cache clear error:', error);
    }
};

// Clear cache before starting worker
clearCache();

// Huntington equipment logic path
const EQUIPMENT_PATH = '/opt/productionapp/dist/lib/equipment-logic/locations/huntington';

// Huntington Logic Factory Worker
const huntingtonLogicWorker = new Worker(
    'equipment-logic-4',
    async (job) => {
        const { equipmentId, locationId, type: equipmentType } = job.data;

        // Only process Huntington equipment (location ID = 4)
        if (locationId !== '4') {
            console.log(`[Huntington Logic Factory] Skipping non-Huntington equipment: ${equipmentId}`);
            return;
        }

        console.log(`[Huntington Logic Factory] Processing ${equipmentType} (${equipmentId})...`);

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

            console.log(`[Huntington Logic Factory] Completed ${equipmentType} (${equipmentId}) successfully`);
            return { success: true, equipmentId, results: results.length };

        } catch (error) {
            console.error(`[Huntington Logic Factory] Error processing ${equipmentType} (${equipmentId}):`, error);
            throw error;
        }
    },
    {
        connection,
        concurrency: 3, // Reduce concurrency to prevent lock issues
        removeOnComplete: 10,
        removeOnFail: 5,
        settings: {
            stalledInterval: 300000,    // 300 seconds before job considered stalled
            maxStalledCount: 3,        // Max times job can stall before failing
            retryProcessDelay: 5000,   // 5 second delay between retries
        }
    }
);

// Map equipment types to files - ORIGINAL HUNTINGTON EQUIPMENT IDs
function getEquipmentFile(equipmentType) {
    const typeMapping = {
        // HUNTINGTON PUMPS
        'cw-pump-1': 'pumps.js',
        'cw-pump-2': 'pumps.js',
        'hw-pump-1': 'pumps.js',
        'hw-pump-2': 'pumps.js',

        // HUNTINGTON BOILERS
        'comfort-boiler-1': 'boiler.js',
        'comfort-boiler-2': 'boiler.js',
        'domestic-boiler-1': 'boiler.js',
        'domestic-boiler-2': 'boiler.js',

        // HUNTINGTON FAN COILS - 1,2,3,4,6,7 (no 5!)
        'fan-coil-1': 'fan-coil.js',
        'fan-coil-2': 'fan-coil.js',
        'fan-coil-3': 'fan-coil.js',
        'fan-coil-4': 'fan-coil.js',
        'fan-coil-6': 'fan-coil.js',
        'fan-coil-7': 'fan-coil.js',

        // HUNTINGTON CHILLER
        'chiller-1': 'chiller.js'
    };

    const mappedFile = typeMapping[equipmentType];

    if (!mappedFile) {
        console.log(`[Huntington Logic Factory] Unknown equipment type: ${equipmentType}`);
        console.log(`[Huntington Logic Factory] Available types:`, Object.keys(typeMapping));
        return null;
    }

    console.log(`[Huntington Logic Factory] Mapping ${equipmentType} → ${mappedFile}`);
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
        } else if (typeof equipmentModule.pumpControl === 'function') {
            equipmentFunction = equipmentModule.pumpControl;
        } else if (typeof equipmentModule.boilerControl === 'function') {
            equipmentFunction = equipmentModule.boilerControl;
        } else if (typeof equipmentModule.fanCoilControl === 'function') {
            equipmentFunction = equipmentModule.fanCoilControl;
        } else if (typeof equipmentModule.chillerControl === 'function') {
            equipmentFunction = equipmentModule.chillerControl;
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

        console.log(`[Huntington Logic Factory] Calling ${fileName} with 4 parameters:`);
        console.log(`  - metricsInput: ${Object.keys(metricsInput).length} metrics for ${equipmentId}`);
        console.log(`  - settingsInput: equipmentId=${settingsInput.equipmentId}`);
        console.log(`  - currentTempArgument: ${currentTempArgument}`);
        console.log(`  - stateStorageInput: ${Object.keys(stateStorageInput).length} state items`);

        // Execute the equipment logic with proper 4 parameters
        const results = await equipmentFunction(metricsInput, settingsInput, currentTempArgument, stateStorageInput);

        // Ensure results is an array and log what we got back
        const resultsArray = Array.isArray(results) ? results : [results];
        console.log(`[Huntington Logic Factory] Equipment logic returned:`, resultsArray);

        return resultsArray;

    } catch (error) {
        console.error(`[Huntington Logic Factory] Logic execution error:`, error);
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
            AND location_id = '4'
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

                console.log(`[Huntington Logic Factory] Gathered ${Object.keys(metricsObject).length} metrics for equipment ${equipmentId}`);
                return metricsObject;
            }
        }

        console.log(`[Huntington Logic Factory] No recent metrics found for equipment ${equipmentId}, using defaults`);
        return {
            Outdoor_Air: 50,
            RoomTemp: 72,
            SupplyTemp: 55,
            equipmentId: equipmentId,
            locationId: '4'
        };

    } catch (error) {
        console.error(`[Huntington Logic Factory] Error gathering metrics for ${equipmentId}:`, error);
        return {
            Outdoor_Air: 50,
            RoomTemp: 72,
            SupplyTemp: 55,
            equipmentId: equipmentId,
            locationId: '4'
        };
    }
}

// Helper function to gather settings data
async function gatherSettingsData(fileName, equipmentId, equipmentType) {
    try {
        const settingsInput = {
            equipmentId: equipmentId,
            locationId: '4', // Huntington location ID
            locationName: 'huntington',
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

        console.log(`[Huntington Logic Factory] Settings for ${fileName}: equipmentId=${equipmentId}`);
        return settingsInput;

    } catch (error) {
        console.error(`[Huntington Logic Factory] Error gathering settings:`, error);
        return {
            equipmentId: equipmentId,
            locationId: '4',
            locationName: 'huntington'
        };
    }
}

// Helper function to extract current temperature based on equipment type
function getCurrentTemperature(metricsInput, equipmentType) {
    // For boilers, use water supply temperature based on type
    if (equipmentType && equipmentType.includes('boiler')) {
        // Comfort boilers use H20Supply, domestic boilers use DMH20Supply
        if (equipmentType.includes('comfort')) {
            // Comfort boiler temperature sources
            const comfortTempSources = ['H20Supply', 'H20_Supply', 'H2O_Supply'];
            for (const source of comfortTempSources) {
                if (metricsInput[source] !== undefined && !isNaN(parseFloat(metricsInput[source]))) {
                    const temp = parseFloat(metricsInput[source]);
                    console.log(`[Huntington Logic Factory] Using comfort boiler supply temp from metrics.${source}: ${temp}°F`);
                    return temp;
                }
            }
        } else if (equipmentType.includes('domestic')) {
            // Domestic boiler temperature sources
            const domesticTempSources = ['DMH20Supply', 'DMH2OSupply', 'DMH20_Supply'];
            for (const source of domesticTempSources) {
                if (metricsInput[source] !== undefined && !isNaN(parseFloat(metricsInput[source]))) {
                    const temp = parseFloat(metricsInput[source]);
                    console.log(`[Huntington Logic Factory] Using domestic boiler supply temp from metrics.${source}: ${temp}°F`);
                    return temp;
                }
            }
        }
        
        // Fallback for any boiler - try generic water temperature sources
        const boilerFallbackSources = ['SupplyTemp', 'Supply_Temp', 'Supply Temperature', 'WaterTemp', 'Water_Temp'];
        for (const source of boilerFallbackSources) {
            if (metricsInput[source] !== undefined && !isNaN(parseFloat(metricsInput[source]))) {
                const temp = parseFloat(metricsInput[source]);
                console.log(`[Huntington Logic Factory] Using boiler fallback temp from metrics.${source}: ${temp}°F`);
                return temp;
            }
        }
    }

    // For all other equipment (fan coils, pumps, chillers), use outdoor temperature for control
    const outdoorTempSources = [
        'Outdoor_Air', 'outdoorTemperature', 'outdoorTemp', 'Outdoor', 'outdoor', 
        'OutdoorTemp', 'OAT', 'oat', 'OutdoorAir', 'Outdoor Air'
    ];

    for (const source of outdoorTempSources) {
        if (metricsInput[source] !== undefined && !isNaN(parseFloat(metricsInput[source]))) {
            const temp = parseFloat(metricsInput[source]);
            console.log(`[Huntington Logic Factory] Using outdoor temperature from metrics.${source}: ${temp}°F for ${equipmentType}`);
            return temp;
        }
    }

    console.log(`[Huntington Logic Factory] No temperature found for ${equipmentType}, using default: 72°F`);
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
        console.error(`[Huntington Logic Factory] Error gathering state storage:`, error);
        return {};
    }
}

// Extract actionable commands from results - Updated for Huntington Equipment
function extractActionableCommands(result) {
    const actionable = {};

    // BOILER COMMANDS (from huntington/boiler.js)
    if (result.unitEnable !== undefined) actionable.unitEnable = result.unitEnable;
    if (result.firing !== undefined) actionable.firing = result.firing;
    if (result.waterTempSetpoint !== undefined) actionable.waterTempSetpoint = result.waterTempSetpoint;
    if (result.temperatureSetpoint !== undefined) actionable.temperatureSetpoint = result.temperatureSetpoint;
    if (result.isLead !== undefined) actionable.isLead = result.isLead;
    if (result.leadLagGroupId !== undefined) actionable.leadLagGroupId = result.leadLagGroupId;
    if (result.leadEquipmentId !== undefined) actionable.leadEquipmentId = result.leadEquipmentId;
    if (result.leadLagReason !== undefined) actionable.leadLagReason = result.leadLagReason;
    if (result.outdoorTemp !== undefined) actionable.outdoorTemp = result.outdoorTemp;
    if (result.supplyTemp !== undefined) actionable.supplyTemp = result.supplyTemp;
    if (result.safetyShutoff !== undefined) actionable.safetyShutoff = result.safetyShutoff;
    if (result.safetyReason !== undefined) actionable.safetyReason = result.safetyReason;

    // PUMP COMMANDS (for huntington/pumps.js)
    if (result.pumpEnable !== undefined) actionable.pumpEnable = result.pumpEnable;
    if (result.pumpSpeed !== undefined) actionable.pumpSpeed = result.pumpSpeed;
    if (result.pumpCommand !== undefined) actionable.pumpCommand = result.pumpCommand;
    if (result.leadLagStatus !== undefined) actionable.leadLagStatus = result.leadLagStatus;

    // FAN COIL COMMANDS (for huntington/fan-coil.js)
    if (result.fanEnabled !== undefined) actionable.fanEnabled = result.fanEnabled;
    if (result.fanSpeed !== undefined) actionable.fanSpeed = result.fanSpeed;
    if (result.heatingValvePosition !== undefined) actionable.heatingValvePosition = result.heatingValvePosition;
    if (result.coolingValvePosition !== undefined) actionable.coolingValvePosition = result.coolingValvePosition;
    if (result.heatingEnable !== undefined) actionable.heatingEnable = result.heatingEnable;
    if (result.coolingEnable !== undefined) actionable.coolingEnable = result.coolingEnable;

    // CHILLER COMMANDS (for huntington/chiller.js)
    if (result.chillerEnable !== undefined) actionable.chillerEnable = result.chillerEnable;
    if (result.chillerSetpoint !== undefined) actionable.chillerSetpoint = result.chillerSetpoint;
    if (result.cwPumpEnable !== undefined) actionable.cwPumpEnable = result.cwPumpEnable;
    if (result.compressorStage !== undefined) actionable.compressorStage = result.compressorStage;

    return actionable;
}

// Write equipment results to NeuralControlCommands - Convert all to strings with debug
async function writeEquipmentResults(equipmentType, results, equipmentId) {
    try {
        const database = 'NeuralControlCommands';
        const influxUrl = process.env.INFLUXDB_URL || 'http://143.198.162.31:8181';

        console.log(`[Huntington Logic Factory] Writing results to ${database} for ${equipmentType} (${equipmentId})`);
        console.log(`[DEBUG] writeEquipmentResults called with ${results.length} results`);

        for (const result of results) {
            console.log(`[DEBUG] Processing result:`, result);

            if (!result || typeof result !== 'object') {
                console.log(`[Huntington Logic Factory] Skipping invalid result:`, result);
                continue;
            }

            const actionableCommands = extractActionableCommands(result);
            if (Object.keys(actionableCommands).length === 0) {
                console.log(`[Huntington Logic Factory] No actionable commands found in result:`, result);
                continue;
            }

            console.log(`[Huntington Logic Factory] Extracted ${Object.keys(actionableCommands).length} commands:`,
                Object.keys(actionableCommands).join(', '));

            // Create individual line protocol entries for each command
            const lineProtocolEntries = [];

            for (const [commandType, value] of Object.entries(actionableCommands)) {
                // Convert all values to strings for the Boolean column
                const formattedValue = `"${String(value)}"`;

                // Create line protocol entry
                const lineProtocol = `NeuralCommands,equipment_id=${equipmentId},location_id=4,command_type=${commandType},equipment_type=${equipmentType},source=huntington-logic-factory,status=active value=${formattedValue}`;
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
                        console.log(`[Huntington Logic Factory] Successfully wrote ${lineProtocolEntries.length} commands to ${database}`);
                    } else {
                        const errorText = await response.text();
                        console.error(`[Huntington Logic Factory] Write failed: ${response.status} - ${errorText}`);
                    }
                } catch (fetchError) {
                    console.error(`[Huntington Logic Factory] Fetch error writing to ${database}:`, fetchError);
                }
            }
        }
    } catch (error) {
        console.error(`[Huntington Logic Factory] Write error:`, error);
    }
}

// Worker event handlers
huntingtonLogicWorker.on('completed', (job) => {
    console.log(`[Huntington Logic Factory] Job ${job.id} completed successfully`);
});

huntingtonLogicWorker.on('failed', (job, err) => {
    console.error(`[Huntington Logic Factory] Job ${job.id} failed:`, err);
});

huntingtonLogicWorker.on('error', (err) => {
    console.error('[Huntington Logic Factory] Worker error:', err);
});

// Graceful shutdown
async function shutdown() {
    console.log('[Huntington Logic Factory] Shutting down...');
    await huntingtonLogicWorker.close();
    await connection.quit();
    process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log('[Huntington Logic Factory] Huntington Logic Factory Worker started and waiting for jobs...');
console.log('[Huntington Logic Factory] Concurrency: 3 workers');
console.log('[Huntington Logic Factory] Processing Huntington equipment (location ID: 4)');
