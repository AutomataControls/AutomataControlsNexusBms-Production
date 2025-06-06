"use strict";
// ===============================================================================
// NE Realty Group Logic Factory Worker
// ===============================================================================
//
// Author: Juelz NeuralBms DevOps
// Last Updated: June 5, 2025
//
// PURPOSE:
// Consumes equipment jobs from the BullMQ queue (equipment-logic-10) and processes
// NE Realty Group equipment logic using the 4-parameter interface. Based on the
// proven Huntington factory pattern with geothermal-specific optimizations.
//
// EQUIPMENT SUPPORTED (1 piece total):
// - 1x Geothermal Chiller:
//   * Geo-1: XqeB0Bd6CfQDRwMel36i (4-stage progressive cooling control)
//
// ARCHITECTURE:
// Queue Consumer → Equipment Logic → InfluxDB Results (Huntington Pattern)
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
    if (key.includes('/ne-realty/') || key.includes('equipment-logic')) {
        delete require.cache[key];
    }
});

// Clear Redis cache synchronously on startup
const clearCache = async () => {
    try {
        const keys = await connection.keys('*ne-realty*');
        const locationKeys = await connection.keys('*location-10*');
        const equipmentKeys = await connection.keys('*equipment-logic-10*');
        const queueKeys = await connection.keys('*already-queued*');

        const allKeys = [...keys, ...locationKeys, ...equipmentKeys, ...queueKeys];
        if (allKeys.length > 0) {
            await connection.del(...allKeys);
            console.log(`[NE Realty Logic Factory] Cleared ${allKeys.length} cache keys`);
        }
    } catch (error) {
        console.error('[NE Realty Logic Factory] Cache clear error:', error);
    }
};

// Clear cache before starting worker
clearCache();

// NE Realty Group equipment logic path
const EQUIPMENT_PATH = '/opt/productionapp/dist/lib/equipment-logic/locations/ne-realty';

// NE Realty Group Logic Factory Worker
const nerealtyLogicWorker = new Worker(
    'equipment-logic-10',
    async (job) => {
        const { equipmentId, locationId, type: equipmentType } = job.data;

        // Only process NE Realty Group equipment (location ID = 10)
        if (locationId !== '10') {
            console.log(`[NE Realty Logic Factory] Skipping non-NE Realty equipment: ${equipmentId}`);
            return;
        }

        console.log(`[NE Realty Logic Factory] Processing ${equipmentType} (${equipmentId})...`);

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

            console.log(`[NE Realty Logic Factory] Completed ${equipmentType} (${equipmentId}) successfully`);
            return { success: true, equipmentId, results: results.length };

        } catch (error) {
            console.error(`[NE Realty Logic Factory] Error processing ${equipmentType} (${equipmentId}):`, error);
            throw error;
        }
    },
    {
        connection,
        concurrency: 2,
        removeOnComplete: 50,
        removeOnFail: 25,
        settings: {
            stalledInterval: 300000,
            maxStalledCount: 3,
            retryProcessDelay: 5000,
        }
    }
);

// Map equipment types to files - NE REALTY EQUIPMENT
function getEquipmentFile(equipmentType) {
    const typeMapping = {
        // NE REALTY GEOTHERMAL CHILLER
        'geo-1': 'geo.js'
    };

    const mappedFile = typeMapping[equipmentType];

    if (!mappedFile) {
        console.log(`[NE Realty Logic Factory] Unknown equipment type: ${equipmentType}`);
        console.log(`[NE Realty Logic Factory] Available types:`, Object.keys(typeMapping));
        return null;
    }

    console.log(`[NE Realty Logic Factory] Mapping ${equipmentType} → ${mappedFile}`);
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
        } else if (typeof equipmentModule.geoControl === 'function') {
            equipmentFunction = equipmentModule.geoControl;
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

        console.log(`[NE Realty Logic Factory] Calling ${fileName} with 4 parameters:`);
        console.log(`  - metricsInput: ${Object.keys(metricsInput).length} metrics for ${equipmentId}`);
        console.log(`  - settingsInput: equipmentId=${settingsInput.equipmentId}`);
        console.log(`  - currentTempArgument: ${currentTempArgument}`);
        console.log(`  - stateStorageInput: ${Object.keys(stateStorageInput).length} state items`);

        // Execute the equipment logic with proper 4 parameters
        const results = await equipmentFunction(metricsInput, settingsInput, currentTempArgument, stateStorageInput);

        // Ensure results is an array and log what we got back
        const resultsArray = Array.isArray(results) ? results : [results];
        console.log(`[NE Realty Logic Factory] Equipment logic returned:`, resultsArray);

        return resultsArray;

    } catch (error) {
        console.error(`[NE Realty Logic Factory] Logic execution error:`, error);
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
            AND location_id = '10'
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

                console.log(`[NE Realty Logic Factory] Gathered ${Object.keys(metricsObject).length} metrics for equipment ${equipmentId}`);
                return metricsObject;
            }
        }

        console.log(`[NE Realty Logic Factory] No recent metrics found for equipment ${equipmentId}, using defaults`);
        return {
            LoopTemp: 45,
            Loop_Temp: 45,
            SupplyTemp: 45,
            equipmentId: equipmentId,
            locationId: '10'
        };

    } catch (error) {
        console.error(`[NE Realty Logic Factory] Error gathering metrics for ${equipmentId}:`, error);
        return {
            LoopTemp: 45,
            Loop_Temp: 45,
            SupplyTemp: 45,
            equipmentId: equipmentId,
            locationId: '10'
        };
    }
}

// Helper function to gather settings data
async function gatherSettingsData(fileName, equipmentId, equipmentType) {
    try {
        // Check for UI setpoint overrides for geothermal system
        let uiSetpoint = null;
        try {
            const database = 'UIControlCommands';
            const influxUrl = process.env.INFLUXDB_URL || 'http://143.198.162.31:8181';

            const query = `
                SELECT waterTemperatureSetpoint
                FROM UIControlCommands
                WHERE equipmentId = '${equipmentId}'
                AND time >= now() - INTERVAL '1 hour'
                ORDER BY time DESC
                LIMIT 1
            `;

            const uiResponse = await fetch(`${influxUrl}/api/v3/query_sql`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ q: query, db: database })
            });

            if (uiResponse.ok) {
                const uiData = await uiResponse.json();
                if (Array.isArray(uiData) && uiData.length > 0 && uiData[0].waterTemperatureSetpoint) {
                    uiSetpoint = parseFloat(uiData[0].waterTemperatureSetpoint);
                    console.log(`[NE Realty Logic Factory] Found UI setpoint override: ${uiSetpoint}°F for geo-1`);
                }
            }
        } catch (uiError) {
            console.log(`[NE Realty Logic Factory] No UI setpoint found for geo-1`);
        }

        const settingsInput = {
            equipmentId: equipmentId,
            locationId: '10',
            locationName: 'ne-realty',
            equipmentType: fileName.replace(/\.js$/, ''),
            enabled: true,
            loopSetpoint: uiSetpoint || 45,
            waterTemperatureSetpoint: uiSetpoint,
            deadband: 1.75,
            stageIncrement: 2.0,
            hysteresis: 2.0,
            highTempLimit: 65,
            lowTempLimit: 35,
            minimumRuntime: 180,
            yearRoundOperation: true,
            stages: 4
        };

        console.log(`[NE Realty Logic Factory] Settings for ${fileName}: equipmentId=${equipmentId}`);
        return settingsInput;

    } catch (error) {
        console.error(`[NE Realty Logic Factory] Error gathering settings:`, error);
        return {
            equipmentId: equipmentId,
            locationId: '10',
            locationName: 'ne-realty'
        };
    }
}

// Helper function to extract current temperature (loop temperature for geothermal)
function getCurrentTemperature(metricsInput, equipmentType) {
    // For geothermal chiller, use loop temperature
    const geoTempSources = [
        'LoopTemp', 'Loop_Temp', 'LoopTemperature', 'Loop Temperature',
        'SupplyTemp', 'Supply_Temp', 'currentTemp'
    ];

    for (const source of geoTempSources) {
        if (metricsInput[source] !== undefined && !isNaN(parseFloat(metricsInput[source]))) {
            const temp = parseFloat(metricsInput[source]);
            console.log(`[NE Realty Logic Factory] Using loop temperature from metrics.${source}: ${temp}°F for ${equipmentType}`);
            return temp;
        }
    }

    console.log(`[NE Realty Logic Factory] No loop temperature found for ${equipmentType}, using default: 45°F`);
    return 45;
}

// Helper function to gather state storage
async function gatherStateStorage() {
    try {
        return {
            lastControlUpdate: Date.now(),
            pidIntegral: 0,
            pidDerivative: 0,
            lastError: 0,
            geoState: null,
            stagingHistory: {
                stage1StartTime: 0,
                stage2StartTime: 0,
                stage3StartTime: 0,
                stage4StartTime: 0,
                lastStageChange: 0,
                randomStartRotation: 0
            },
            runtimeTracking: {
                stage1Runtime: 0,
                stage2Runtime: 0,
                stage3Runtime: 0,
                stage4Runtime: 0
            }
        };
    } catch (error) {
        console.error(`[NE Realty Logic Factory] Error gathering state storage:`, error);
        return {};
    }
}

// Extract actionable commands from results - Geothermal specific
function extractActionableCommands(result) {
    const actionable = {};

    // GEOTHERMAL 4-STAGE COMMANDS
    if (result.stage1Enabled !== undefined) actionable.stage1Enabled = result.stage1Enabled;
    if (result.stage2Enabled !== undefined) actionable.stage2Enabled = result.stage2Enabled;
    if (result.stage3Enabled !== undefined) actionable.stage3Enabled = result.stage3Enabled;
    if (result.stage4Enabled !== undefined) actionable.stage4Enabled = result.stage4Enabled;

    // TEMPERATURE AND STATUS
    if (result.loopTemp !== undefined) actionable.loopTemp = result.loopTemp;
    if (result.targetSetpoint !== undefined) actionable.targetSetpoint = result.targetSetpoint;
    if (result.temperatureError !== undefined) actionable.temperatureError = result.temperatureError;

    // STAGING INFORMATION
    if (result.activeStages !== undefined) actionable.activeStages = result.activeStages;
    if (result.totalStages !== undefined) actionable.totalStages = result.totalStages;
    if (result.requiredStages !== undefined) actionable.requiredStages = result.requiredStages;

    // CONTROL STATE
    if (result.lastStageChange !== undefined) actionable.lastStageChange = result.lastStageChange;
    if (result.randomStartRotation !== undefined) actionable.randomStartRotation = result.randomStartRotation;

    // SAFETY STATUS
    if (result.emergencyShutdown !== undefined) actionable.emergencyShutdown = result.emergencyShutdown;
    if (result.shutdownReason !== undefined) actionable.shutdownReason = result.shutdownReason;

    return actionable;
}

// Write equipment results to NeuralControlCommands - HUNTINGTON PATTERN
async function writeEquipmentResults(equipmentType, results, equipmentId) {
    try {
        const database = 'NeuralControlCommands';
        const influxUrl = process.env.INFLUXDB_URL || 'http://143.198.162.31:8181';

        console.log(`[NE Realty Logic Factory] Writing results to ${database} for ${equipmentType} (${equipmentId})`);
        console.log(`[DEBUG] writeEquipmentResults called with ${results.length} results`);

        for (const result of results) {
            console.log(`[DEBUG] Processing result:`, result);

            if (!result || typeof result !== 'object') {
                console.log(`[NE Realty Logic Factory] Skipping invalid result:`, result);
                continue;
            }

            const actionableCommands = extractActionableCommands(result);
            if (Object.keys(actionableCommands).length === 0) {
                console.log(`[NE Realty Logic Factory] No actionable commands found in result:`, result);
                continue;
            }

            console.log(`[NE Realty Logic Factory] Extracted ${Object.keys(actionableCommands).length} commands:`,
                Object.keys(actionableCommands).join(', '));

            // Create individual line protocol entries for each command
            const lineProtocolEntries = [];

            for (const [commandType, value] of Object.entries(actionableCommands)) {
                // Convert all values to strings for the Boolean column
                const formattedValue = `"${String(value)}"`;

                // Create line protocol entry - MATCH HUNTINGTON FORMAT
                const lineProtocol = `NeuralCommands,equipment_id=${equipmentId},location_id=10,command_type=${commandType},equipment_type=${equipmentType},source=ne-realty-logic-factory,status=active value=${formattedValue}`;
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
                        console.log(`[NE Realty Logic Factory] Successfully wrote ${lineProtocolEntries.length} commands to ${database}`);
                    } else {
                        const errorText = await response.text();
                        console.error(`[NE Realty Logic Factory] Write failed: ${response.status} - ${errorText}`);
                    }
                } catch (fetchError) {
                    console.error(`[NE Realty Logic Factory] Fetch error writing to ${database}:`, fetchError);
                }
            }
        }
    } catch (error) {
        console.error(`[NE Realty Logic Factory] Write error:`, error);
    }
}

// Worker event handlers
nerealtyLogicWorker.on('completed', (job) => {
    console.log(`[NE Realty Logic Factory] Job ${job.id} completed successfully`);
});

nerealtyLogicWorker.on('failed', (job, err) => {
    console.error(`[NE Realty Logic Factory] Job ${job.id} failed:`, err);
});

nerealtyLogicWorker.on('error', (err) => {
    console.error('[NE Realty Logic Factory] Worker error:', err);
});

// Graceful shutdown
async function shutdown() {
    console.log('[NE Realty Logic Factory] Shutting down...');
    await nerealtyLogicWorker.close();
    await connection.quit();
    process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log('[NE Realty Logic Factory] NE Realty Group Logic Factory Worker started - Processing geothermal equipment');
console.log('[NE Realty Logic Factory] Equipment supported: Geo-1 (XqeB0Bd6CfQDRwMel36i) - 4-Stage Geothermal Chiller');
console.log('[NE Realty Logic Factory] Queue: equipment-logic-10, Concurrency: 2, Location ID: 10');
console.log('[NE Realty Logic Factory] Redis connected');
