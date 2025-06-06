"use strict";
// ===============================================================================
// NE Realty Group Location Processor
// ===============================================================================
//
// Author: Juelz NeuralBms DevOps
// Last Updated: June 5, 2025
//
// PURPOSE:
// Smart queue processor for NE Realty Group's geothermal chiller system.
// Provides intelligent processing decisions for 4-stage geothermal control.
// FIXED: 30-second processing for proper staging control
//
// EQUIPMENT:
// - Geo-1: XqeB0Bd6CfQDRwMel36i (4-stage geothermal chiller) - 30s intervals
//
// ===============================================================================

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const ioredis_1 = __importDefault(require("ioredis"));

// SMART QUEUE: Add BullMQ for intelligent queue management
const { Queue } = require('bullmq');

// Redis connection for BullMQ job management
const redis = new ioredis_1.default({
    host: 'localhost',
    port: 6379,
    maxRetriesPerRequest: null,
});

// BullMQ Queue instance with smart defaults
const equipmentQueue = new Queue('equipment-logic-10', {
    connection: redis,
    defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 25,
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000,
        },
    },
});

// FIXED: Set max listeners to prevent memory leak warnings
equipmentQueue.setMaxListeners(20);

// Smart queue status tracking
const status = {
    waiting: 0,
    active: 0,
    total: 0,
    lastUpdate: Date.now()
};

// Smart queue state management
const equipmentState = new Map(); // Track last metrics for deviation detection
const queuedJobs = new Set(); // Track currently queued jobs to prevent duplicates
const lastUICheck = new Map(); // Track last UI command check per equipment

// NE Realty Group equipment configuration - FIXED FOR PROPER GEOTHERMAL CONTROL
const EQUIPMENT_CONFIG = {
    'geo-1': {
        interval: 30 * 1000,    // 30 seconds for geothermal staging control
        timeout: 90 * 1000,     // Reduced from 120s to 90s
        priority: 15,
        file: 'geo.js',
        equipmentId: 'XqeB0Bd6CfQDRwMel36i'
    }
};

// Equipment state management
const equipmentTimers = new Map();
const lastRun = new Map();

// FIXED: Use absolute path instead of process.cwd() to avoid path issues
const EQUIPMENT_PATH = '/opt/productionapp/dist/lib/equipment-logic/locations/ne-realty';

// ===============================================================================
// TIMEOUT-BASED CLEANUP (FALLBACK FOR EVENT HANDLER ISSUES) - OPTIMIZED
// ===============================================================================

// Processing timeout configuration based on equipment complexity - REDUCED FOR TEMPERATURE CONTROL
const PROCESSING_TIMEOUT = {
    'geo': 90000,          // 90 seconds for geothermal chiller (reduced from 120s)
};

// Schedule automatic cleanup of queuedJobs tracking
function scheduleJobCleanup(jobKey, equipmentType) {
    const equipmentBase = equipmentType.split('-')[0]; // Get 'geo'
    const timeout = PROCESSING_TIMEOUT[equipmentBase] || 90000;

    setTimeout(() => {
        if (queuedJobs.has(jobKey)) {
            queuedJobs.delete(jobKey);
            console.log(`[NE Realty Smart Queue] Auto-cleaned ${jobKey} after ${timeout/1000}s timeout`);
        }
    }, timeout);

    console.log(`[NE Realty Smart Queue] Scheduled cleanup for ${jobKey} in ${timeout/1000}s`);
}

// ===============================================================================
// SMART QUEUE LOGIC FUNCTIONS - FIXED FOR GEOTHERMAL STAGING CONTROL
// ===============================================================================

// Enhanced smart queue function with deviation detection and UI command checking
async function addEquipmentToQueue(equipmentId, locationId, equipmentType) {
    try {
        const jobKey = `${locationId}-${equipmentId}-${equipmentType}`;

        // STEP 1: Check if already queued (deduplication)
        if (queuedJobs.has(jobKey)) {
            console.log(`[NE Realty Smart Queue] ${equipmentType} already queued, skipping`);
            return null;
        }

        // STEP 2: Smart processing decision
        const shouldProcess = await shouldProcessEquipment(equipmentId, equipmentType);

        if (!shouldProcess.process) {
            console.log(`[NE Realty Smart Queue] Skipping ${equipmentType}: ${shouldProcess.reason}`);
            return null;
        }

        // STEP 3: Add to queue with priority
        const jobData = {
            equipmentId: equipmentId,
            locationId: locationId,
            type: equipmentType,
            timestamp: Date.now(),
            reason: shouldProcess.reason,
            priority: shouldProcess.priority || 0
        };

        const job = await equipmentQueue.add(
            `process-${equipmentType}`,
            jobData,
            {
                priority: shouldProcess.priority || 0,
                jobId: jobKey, // Use consistent job ID for deduplication
            }
        );

        // Track queued job AND schedule automatic cleanup
        queuedJobs.add(jobKey);
        scheduleJobCleanup(jobKey, equipmentType);

        console.log(`[NE Realty Smart Queue] Queued ${equipmentType} with priority ${shouldProcess.priority}`);

        // Update queue status
        await updateQueueStatus();

        return job.id;

    } catch (error) {
        // Handle BullMQ duplicate job errors gracefully
        if (error.message.includes('Job with id') && error.message.includes('already exists')) {
            console.log(`[NE Realty Smart Queue] Job already exists for ${equipmentType} - this is normal`);
            return null;
        }
        throw error;
    }
}

// Smart processing decision engine - FIXED FOR GEOTHERMAL STAGING
async function shouldProcessEquipment(equipmentId, equipmentType) {
    try {
        // Get equipment configuration
        const config = Object.values(EQUIPMENT_CONFIG).find(c => c.equipmentId === equipmentId);
        if (!config) {
            return { process: false, reason: 'Equipment not configured' };
        }

        // PRIORITY 1: Check for recent UI commands (force processing if found)
        const hasRecentUICommands = await checkRecentUICommands(equipmentId, equipmentType);
        if (hasRecentUICommands) {
            return {
                process: true,
                reason: 'Recent UI commands detected',
                priority: 10 // High priority for user commands
            };
        }

        // PRIORITY 2: Check for safety conditions (always process)
        const hasSafetyCondition = await checkSafetyConditions(equipmentId, equipmentType);
        if (hasSafetyCondition) {
            return {
                process: true,
                reason: 'Safety condition detected',
                priority: 20 // Highest priority for safety
            };
        }

        // PRIORITY 3: Check loop temperature conditions (CRITICAL FOR GEOTHERMAL STAGING)
        const loopTempCheck = await checkLoopTemperatureConditions(equipmentId);
        if (loopTempCheck.needsAttention) {
            return {
                process: true,
                reason: loopTempCheck.reason,
                priority: 15 // High priority for geothermal loop staging
            };
        }

        // PRIORITY 4: Check for significant deviation from setpoints
        const deviationCheck = await checkSignificantDeviation(equipmentId, equipmentType);
        if (deviationCheck.hasDeviation) {
            return {
                process: true,
                reason: `Significant deviation: ${deviationCheck.details}`,
                priority: 5 // Medium priority for deviation
            };
        }

        // PRIORITY 5: Check maximum time since last run (FIXED - CONSISTENT WITH WARREN!)
        const timeSinceLastRun = Date.now() - (lastRun.get(equipmentId) || 0);
        const maxStaleTime = getMaxStaleTime(equipmentType);

        if (timeSinceLastRun > maxStaleTime) {
            return {
                process: true,
                reason: `Maximum time exceeded: ${Math.round(timeSinceLastRun / 1000)}s > ${Math.round(maxStaleTime / 1000)}s`,
                priority: 1 // Low priority for maintenance
            };
        }

        // Default: Skip processing
        return {
            process: false,
            reason: `No significant changes detected (last run: ${Math.round(timeSinceLastRun / 1000)}s ago)`
        };

    } catch (error) {
        console.error(`[NE Realty Smart Queue] Error in shouldProcessEquipment for ${equipmentId}:`, error);
        // On error, process equipment to be safe
        return {
            process: true,
            reason: `Error in decision logic: ${error.message}`,
            priority: 1
        };
    }
}

// Check for recent UI commands (last 5 minutes)
async function checkRecentUICommands(equipmentId, equipmentType) {
    try {
        const lastCheck = lastUICheck.get(equipmentId) || 0;
        const now = Date.now();

        // Only check UI commands every 30 seconds to reduce load
        if (now - lastCheck < 30000) {
            return false;
        }

        lastUICheck.set(equipmentId, now);

        const database = 'UIControlCommands';
        const influxUrl = process.env.INFLUXDB_URL || 'http://143.198.162.31:8181';

        const query = `
            SELECT * FROM UIControlCommands
            WHERE equipmentId = '${equipmentId}'
            AND time >= now() - INTERVAL '5 minutes'
            ORDER BY time DESC
            LIMIT 5
        `;

        const response = await fetch(`${influxUrl}/api/v3/query_sql`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: query, db: database })
        });

        if (response.ok) {
            const data = await response.json();
            const hasCommands = Array.isArray(data) && data.length > 0;

            if (hasCommands) {
                console.log(`[NE Realty Smart Queue] Found ${data.length} recent UI commands for ${equipmentId}`);
            }

            return hasCommands;
        }

        return false;
    } catch (error) {
        console.error(`[NE Realty Smart Queue] Error checking UI commands for ${equipmentId}:`, error);
        return false; // Assume no UI commands on error
    }
}

// Check for safety conditions that require immediate processing
async function checkSafetyConditions(equipmentId, equipmentType) {
    try {
        const metrics = await gatherMetricsData(equipmentId);

        // Geothermal chiller safety checks
        if (equipmentType.includes('geo')) {
            const loopTemp = parseFloat(metrics.LoopTemp || metrics.Loop_Temp || 0);

            // High loop temperature alarm
            if (loopTemp > 65) {
                console.log(`[NE Realty Smart Queue] SAFETY: High loop temperature ${loopTemp}°F for ${equipmentId}`);
                return true;
            }

            // Low loop temperature alarm
            if (loopTemp < 35) {
                console.log(`[NE Realty Smart Queue] SAFETY: Low loop temperature ${loopTemp}°F for ${equipmentId}`);
                return true;
            }

            // Compressor overload protection
            const compressorAmps = parseFloat(metrics.CompressorAmps || 0);
            if (compressorAmps > 50) {
                console.log(`[NE Realty Smart Queue] SAFETY: High compressor amps ${compressorAmps}A for ${equipmentId}`);
                return true;
            }

            // COP performance monitoring
            const cop = parseFloat(metrics.COP || 0);
            if (cop > 0 && cop < 2.0) {
                console.log(`[NE Realty Smart Queue] SAFETY: Low COP performance ${cop} for ${equipmentId}`);
                return true;
            }
        }

        return false;
    } catch (error) {
        console.error(`[NE Realty Smart Queue] Error checking safety for ${equipmentId}:`, error);
        return true; // Assume safety issue on error to be safe
    }
}

// Check loop temperature conditions for geothermal staging - ENHANCED FOR 30-SECOND CONTROL
async function checkLoopTemperatureConditions(equipmentId) {
    try {
        const metrics = await gatherMetricsData(equipmentId);
        const loopTemp = parseFloat(metrics.LoopTemp || metrics.Loop_Temp || 45);

        // Check for temperature deviation from 45°F setpoint
        const setpoint = 45.0;
        const deadband = 1.75;
        const tempError = Math.abs(loopTemp - setpoint);

        // ENHANCED: More sensitive thresholds for 30-second control
        const stage1Threshold = setpoint + deadband;           // 46.75°F
        const stage2Threshold = setpoint + deadband + 2.0;     // 48.75°F
        const stage3Threshold = setpoint + deadband + 4.0;     // 50.75°F
        const stage4Threshold = setpoint + deadband + 6.0;     // 52.75°F

        // More sensitive staging detection for frequent processing
        const nearStage1 = Math.abs(loopTemp - stage1Threshold) <= 1.0;  // Within 1°F of stage 1
        const nearStage2 = Math.abs(loopTemp - stage2Threshold) <= 1.0;  // Within 1°F of stage 2
        const nearStage3 = Math.abs(loopTemp - stage3Threshold) <= 1.0;  // Within 1°F of stage 3
        const nearStage4 = Math.abs(loopTemp - stage4Threshold) <= 1.0;  // Within 1°F of stage 4

        // Process if temperature error > 1.5°F (tighter control for geothermal)
        if (tempError > 1.5) {
            return {
                needsAttention: true,
                reason: `Loop temp error: ${tempError.toFixed(1)}°F (${loopTemp}°F vs ${setpoint}°F setpoint)`
            };
        }

        // Process if approaching any staging threshold
        if (nearStage1 || nearStage2 || nearStage3 || nearStage4) {
            return {
                needsAttention: true,
                reason: `Loop temp: ${loopTemp}°F approaching staging threshold`
            };
        }

        return { needsAttention: false };

    } catch (error) {
        console.error(`[NE Realty Smart Queue] Error checking loop temperature for ${equipmentId}:`, error);
        return { needsAttention: false };
    }
}

// Check for significant deviation from setpoints
async function checkSignificantDeviation(equipmentId, equipmentType) {
    try {
        const currentMetrics = await gatherMetricsData(equipmentId);
        const lastMetrics = equipmentState.get(equipmentId) || {};

        // Store current metrics for next comparison
        equipmentState.set(equipmentId, currentMetrics);

        // Geothermal deviation thresholds - MORE SENSITIVE FOR 30-SECOND CONTROL
        const threshold = { temp: 1.5, cop: 0.3 }; // Reduced from 2.5°F and 0.5 COP

        // Check loop temperature deviation
        const currentTemp = parseFloat(currentMetrics.LoopTemp || currentMetrics.Loop_Temp || 45);
        const lastTemp = parseFloat(lastMetrics.LoopTemp || lastMetrics.Loop_Temp || currentTemp);
        const tempDiff = Math.abs(currentTemp - lastTemp);

        if (tempDiff > threshold.temp) {
            return {
                hasDeviation: true,
                details: `Loop temperature change: ${tempDiff.toFixed(1)}°F > ${threshold.temp}°F`
            };
        }

        // Check COP deviation
        const currentCOP = parseFloat(currentMetrics.COP || 0);
        const lastCOP = parseFloat(lastMetrics.COP || currentCOP);
        const copDiff = Math.abs(currentCOP - lastCOP);

        if (currentCOP > 0 && lastCOP > 0 && copDiff > threshold.cop) {
            return {
                hasDeviation: true,
                details: `COP change: ${copDiff.toFixed(1)} > ${threshold.cop}`
            };
        }

        return { hasDeviation: false, details: 'No significant deviation detected' };

    } catch (error) {
        console.error(`[NE Realty Smart Queue] Error checking deviation for ${equipmentId}:`, error);
        return { hasDeviation: true, details: `Error checking deviation: ${error.message}` };
    }
}

// Helper function to gather current metrics from InfluxDB for specific equipment
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
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                q: query,
                db: database
            })
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

                return metricsObject;
            }
        }

        return {
            LoopTemp: 45,
            Loop_Temp: 45,
            COP: 4.5,
            locationId: '10',
            equipmentId: equipmentId
        };

    } catch (error) {
        console.error(`[NE Realty] Error gathering metrics for ${equipmentId}:`, error);
        return {
            LoopTemp: 45,
            Loop_Temp: 45,
            COP: 4.5,
            locationId: '10',
            equipmentId: equipmentId
        };
    }
}

// FIXED: Get maximum stale time based on equipment type - 30 SECONDS FOR GEOTHERMAL!
function getMaxStaleTime(equipmentType) {
    const staleTimeConfig = {
        'geo': 30 * 1000,      // 30 SECONDS max for geothermal (was 5 minutes!)
    };

    const equipmentKey = Object.keys(staleTimeConfig).find(key => equipmentType.includes(key));
    return staleTimeConfig[equipmentKey] || (30 * 1000); // Default 30 seconds (was 5 minutes!)
}

// Update queue status for monitoring
async function updateQueueStatus() {
    try {
        const waiting = await equipmentQueue.getWaiting();
        const active = await equipmentQueue.getActive();

        status.waiting = waiting.length;
        status.active = active.length;
        status.total = status.waiting + status.active;
        status.lastUpdate = Date.now();

    } catch (error) {
        console.error('[NE Realty Smart Queue] Error updating queue status:', error);
    }
}

// ===============================================================================
// MAIN PROCESSOR FUNCTIONS
// ===============================================================================

// Initialize NE Realty processors
async function initializeNERealtyProcessors() {
    console.log('[NE Realty Smart Queue] Starting smart queue system...');
    console.log('[NE Realty Smart Queue] Initializing with intelligent processing for geothermal systems...');
    console.log('[NE Realty Smart Queue] FIXED: 30-second processing for proper geothermal staging control');
    console.log('[NE Realty Smart Queue] Clearing factory startup cache...');

    try {
        // Check what equipment files are available
        const availableFiles = fs_1.default.readdirSync(EQUIPMENT_PATH)
            .filter(file => file.endsWith('.js') && !file.includes('helpers'));

        console.log(`[NE Realty Smart Queue] Available equipment files: ${availableFiles.join(', ')}`);

        // Start processors for each configured equipment
        for (const [equipmentType, config] of Object.entries(EQUIPMENT_CONFIG)) {
            if (availableFiles.includes(config.file)) {
                startEquipmentProcessor(equipmentType, config);
                console.log(`[NE Realty Smart Queue] Started ${equipmentType} processor (${config.interval / 1000}s interval) - Equipment ID: ${config.equipmentId}`);
            }
            else {
                console.log(`[NE Realty Smart Queue] Skipping ${equipmentType} - file ${config.file} not found`);
            }
        }

        // Start smart queue status monitoring
        setInterval(async () => {
            await updateQueueStatus();
            if (status.total > 0) {
                console.log(`[NE Realty Smart Queue] Status: ${status.waiting} waiting, ${status.active} active, ${status.total} total`);
            }
        }, 60000); // Log every minute if there are jobs

        console.log('[NE Realty Smart Queue] Smart queue system initialized - 1 Geothermal processor active with 30-second control');
    }
    catch (error) {
        console.error('[NE Realty Smart Queue] Initialization error:', error);
        throw error;
    }
}

// Start individual equipment processor - FIXED TO MATCH WARREN PATTERN
function startEquipmentProcessor(equipmentType, config) {
    const timer = setInterval(async () => {
        await processEquipment(equipmentType, config);
    }, config.interval);

    equipmentTimers.set(equipmentType, timer);
    lastRun.set(equipmentType, 0);  // FIXED: Use equipmentType like Warren (was equipmentType already)
}

// SMART: Process equipment by adding to queue with intelligence
async function processEquipment(equipmentType, config) {
    const startTime = Date.now();

    try {
        console.log(`[NE Realty] Evaluating ${equipmentType} (${config.equipmentId}) for geothermal staging...`);

        const jobId = await addEquipmentToQueue(
            config.equipmentId,
            '10', // NE Realty Group location ID
            equipmentType
        );

        if (jobId) {
            console.log(`[NE Realty] Queued ${equipmentType} for geothermal staging control`);
            lastRun.set(config.equipmentId, startTime);
        } else {
            console.log(`[NE Realty] ${equipmentType} skipped by smart queue logic`);
        }

    } catch (error) {
        // Handle duplicate job errors gracefully
        if (error.message && (error.message.includes('Job is already') ||
            error.message.includes('duplicate') ||
            error.message.includes('already exists'))) {
            console.log(`[NE Realty Smart Queue] ${equipmentType} already queued, skipping duplicate - this is normal`);
        } else {
            console.error(`[NE Realty Smart Queue] Error in smart queue processing for ${equipmentType}:`, error);
        }
    }
}

// FIXED: Clean up completed/failed jobs from tracking - MATCH WARREN PATTERN
equipmentQueue.on('completed', (job) => {
    const jobKey = `${job.data.locationId}-${job.data.equipmentId}-${job.data.type}`;
    queuedJobs.delete(jobKey);
    console.log(`[NE Realty Smart Queue] Job ${job.id} completed - ${job.data.type} (${job.data.equipmentId})`);
});

equipmentQueue.on('failed', (job, err) => {
    const jobKey = `${job.data.locationId}-${job.data.equipmentId}-${job.data.type}`;
    queuedJobs.delete(jobKey);
    console.error(`[NE Realty Smart Queue] Job ${job.id} failed - ${job.data.type} (${job.data.equipmentId}):`, err.message);
});

// ===============================================================================
// SYSTEM MANAGEMENT
// ===============================================================================

// Graceful shutdown
async function shutdown() {
    console.log('[NE Realty Smart Queue] Shutting down smart queue system...');
    for (const timer of equipmentTimers.values()) {
        clearInterval(timer);
    }
    await equipmentQueue.close();
    await redis.quit();
    console.log('[NE Realty Smart Queue] Shutdown complete');
    process.exit(0);
}

// Signal handlers for graceful shutdown
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Redis event handlers
redis.on('connect', () => console.log('[NE Realty Smart Queue] Redis connected'));
redis.on('error', (err) => console.error('[NE Realty Smart Queue] Redis error:', err));

// Initialize and start the processor
initializeNERealtyProcessors()
    .then(() => console.log('[NE Realty Smart Queue] Smart queue system started successfully - 1 Geothermal processor active with 30-second staging control'))
    .catch((error) => {
        console.error('[NE Realty Smart Queue] Failed to start:', error);
        process.exit(1);
    });
