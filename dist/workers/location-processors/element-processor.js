"use strict";
// ===============================================================================
// Element Location Processor
// ===============================================================================
//
// Author: Juelz NeuralBms DevOps
// Last Updated: June 5, 2025
//
// PURPOSE:
// Smart queue processor for Element location (location_id=8) - DOAS System Control.
// Provides intelligent processing decisions for DOAS equipment control.
// FIXED: 30-second processing for proper DOAS outdoor air control
//
// EQUIPMENT:
// - DOAS-1: WBAuutoHnGUtAEc4w6SC (Advanced: mod gas valve + 2-stage DX) - 30s max
// - DOAS-2: CiFEDD4fOAxAi2AydOXN (Simple: basic heating/cooling) - 30s max
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
const equipmentQueue = new Queue('equipment-logic-8', {
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

// Element equipment configuration - OPTIMIZED FOR DOAS OUTDOOR AIR CONTROL
const EQUIPMENT_CONFIG = {
    'doas-1': {
        interval: 30 * 1000,        // 30 seconds for DOAS outdoor air control
        timeout: 75 * 1000,         // Reduced from 90 seconds
        priority: 15,
        file: 'doas.js',
        equipmentId: 'WBAuutoHnGUtAEc4w6SC'
    },
    'doas-2': {
        interval: 30 * 1000,        // 30 seconds for DOAS outdoor air control
        timeout: 60 * 1000,         // Keep at 60 seconds
        priority: 10,
        file: 'doas.js',
        equipmentId: 'CiFEDD4fOAxAi2AydOXN'
    }
};

// Equipment state management
const equipmentTimers = new Map();
const lastRun = new Map();

// FIXED: Use absolute path instead of process.cwd() to avoid path issues
const EQUIPMENT_PATH = '/opt/productionapp/dist/lib/equipment-logic/locations/element';

// ===============================================================================
// TIMEOUT-BASED CLEANUP (FALLBACK FOR EVENT HANDLER ISSUES) - OPTIMIZED FOR DOAS
// ===============================================================================

// Processing timeout configuration - REDUCED FOR DOAS RESPONSIVENESS
const PROCESSING_TIMEOUT = {
    'doas': 75000,          // 75 seconds for DOAS units (reduced from 90s)
};

// Schedule automatic cleanup of queuedJobs tracking
function scheduleJobCleanup(jobKey, equipmentType) {
    const equipmentBase = equipmentType.split('-')[0]; // Get 'doas'
    const timeout = PROCESSING_TIMEOUT[equipmentBase] || 75000;

    setTimeout(() => {
        if (queuedJobs.has(jobKey)) {
            queuedJobs.delete(jobKey);
            console.log(`[Element Smart Queue] Auto-cleaned ${jobKey} after ${timeout/1000}s timeout`);
        }
    }, timeout);
}

// ===============================================================================
// SMART QUEUE LOGIC FUNCTIONS - OPTIMIZED FOR DOAS OUTDOOR AIR CONTROL
// ===============================================================================

// Enhanced smart queue function with deviation detection and UI command checking
async function addEquipmentToQueue(equipmentId, locationId, equipmentType) {
    try {
        const jobKey = `${locationId}-${equipmentId}-${equipmentType}`;

        // STEP 1: Check if already queued (deduplication)
        if (queuedJobs.has(jobKey)) {
            console.log(`[Element Smart Queue] ${equipmentType} already queued, skipping`);
            return null;
        }

        // STEP 2: Smart processing decision
        const shouldProcess = await shouldProcessEquipment(equipmentId, equipmentType);

        if (!shouldProcess.process) {
            console.log(`[Element Smart Queue] Skipping ${equipmentType}: ${shouldProcess.reason}`);
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

        console.log(`[Element Smart Queue] Queued ${equipmentType} with priority ${shouldProcess.priority}`);

        // Update queue status
        await updateQueueStatus();

        return job.id;

    } catch (error) {
        // Handle BullMQ duplicate job errors gracefully
        if (error.message.includes('Job with id') && error.message.includes('already exists')) {
            console.log(`[Element Smart Queue] Job already exists for ${equipmentType} - this is normal`);
            return null;
        }
        throw error;
    }
}

// Smart processing decision engine - ENHANCED FOR DOAS CONTROL
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

        // PRIORITY 3: Check DOAS temperature deviation (CRITICAL FOR DOAS CONTROL)
        const doasDeviation = await checkDOASTemperatureDeviation(equipmentId, equipmentType);
        if (doasDeviation.hasDeviation) {
            return {
                process: true,
                reason: `DOAS temp deviation: ${doasDeviation.details}`,
                priority: 16 // Very high priority for DOAS temperature control
            };
        }

        // PRIORITY 4: Check outdoor temperature conditions for DOAS (ENHANCED)
        const outdoorTempCheck = await checkOutdoorTemperatureConditions(equipmentId);
        if (outdoorTempCheck.needsAttention) {
            return {
                process: true,
                reason: outdoorTempCheck.reason,
                priority: 12 // High priority for DOAS outdoor air
            };
        }

        // PRIORITY 5: Check for significant deviation from setpoints
        const deviationCheck = await checkSignificantDeviation(equipmentId, equipmentType);
        if (deviationCheck.hasDeviation) {
            return {
                process: true,
                reason: `Significant deviation: ${deviationCheck.details}`,
                priority: 5 // Medium priority for deviation
            };
        }

        // PRIORITY 6: Check maximum time since last run (FIXED - 30 SECONDS FOR DOAS!)
        const timeSinceLastRun = Date.now() - (lastRun.get(equipmentType) || 0);
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
        console.error(`[Element Smart Queue] Error in shouldProcessEquipment for ${equipmentId}:`, error);
        // On error, process equipment to be safe
        return {
            process: true,
            reason: `Error in decision logic: ${error.message}`,
            priority: 1
        };
    }
}

// NEW: Check for DOAS temperature deviation that requires immediate processing
async function checkDOASTemperatureDeviation(equipmentId, equipmentType) {
    try {
        const metrics = await gatherMetricsData(equipmentId);

        // DOAS systems need responsive temperature control for outdoor air handling
        if (equipmentType.includes('doas')) {
            const supplyTemp = parseFloat(metrics.SupplyTemp || metrics.Supply_Air_Temp || 65);
            const setpoint = parseFloat(metrics.temperatureSetpoint || metrics.Setpoint || 65);
            const tempError = Math.abs(supplyTemp - setpoint);

            // DOAS temperature control: Process if temp error > 2°F (tight control for outdoor air)
            if (tempError > 2.0) {
                return {
                    hasDeviation: true,
                    details: `Supply temp error: ${tempError.toFixed(1)}°F (${supplyTemp}°F vs ${setpoint}°F setpoint) - DOAS outdoor air control`
                };
            }

            // Check for extreme supply temperatures that need immediate attention
            if (supplyTemp < 50 || supplyTemp > 80) {
                return {
                    hasDeviation: true,
                    details: `Extreme DOAS supply temp: ${supplyTemp}°F (outdoor air safety)`
                };
            }

            // DOAS-1 specific: Modulating gas valve control
            if (equipmentId === 'WBAuutoHnGUtAEc4w6SC') {
                const gasValve = parseFloat(metrics.GasValvePosition || 0);
                const outdoorTemp = parseFloat(metrics.Outdoor_Air || 65);

                // Process if gas valve is modulating significantly (indicating active heating)
                if (gasValve > 20 && outdoorTemp < 55) {
                    return {
                        hasDeviation: true,
                        details: `DOAS-1 gas valve active: ${gasValve}% with ${outdoorTemp}°F outdoor (mod gas control)`
                    };
                }
            }
        }

        return { hasDeviation: false, details: 'No DOAS temperature deviation' };

    } catch (error) {
        console.error(`[Element Smart Queue] Error checking DOAS temperature deviation for ${equipmentId}:`, error);
        return { hasDeviation: true, details: `Error checking DOAS temperature: ${error.message}` };
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
                console.log(`[Element Smart Queue] Found ${data.length} recent UI commands for ${equipmentId}`);
            }

            return hasCommands;
        }

        return false;
    } catch (error) {
        console.error(`[Element Smart Queue] Error checking UI commands for ${equipmentId}:`, error);
        return false; // Assume no UI commands on error
    }
}

// Check for safety conditions that require immediate processing
async function checkSafetyConditions(equipmentId, equipmentType) {
    try {
        const metrics = await gatherMetricsData(equipmentId);

        // DOAS safety checks
        if (equipmentType.includes('doas')) {
            const supplyTemp = parseFloat(metrics.SupplyTemp || metrics.Supply_Air_Temp || 0);

            // High supply air temperature alarm
            if (supplyTemp > 85) {
                console.log(`[Element Smart Queue] SAFETY: High supply temperature ${supplyTemp}°F for ${equipmentId}`);
                return true;
            }

            // Low supply air temperature alarm
            if (supplyTemp < 45) {
                console.log(`[Element Smart Queue] SAFETY: Low supply temperature ${supplyTemp}°F for ${equipmentId}`);
                return true;
            }

            // Fan overload protection
            const fanAmps = parseFloat(metrics.FanAmps || 0);
            if (fanAmps > 15) {
                console.log(`[Element Smart Queue] SAFETY: Fan overload ${fanAmps}A for ${equipmentId}`);
                return true;
            }

            // Gas pressure safety (DOAS-1 only)
            if (equipmentId === 'WBAuutoHnGUtAEc4w6SC') {
                const gasPressure = parseFloat(metrics.GasPressure || 0);
                if (gasPressure > 50) {
                    console.log(`[Element Smart Queue] SAFETY: High gas pressure ${gasPressure} PSI for ${equipmentId}`);
                    return true;
                }
            }
        }

        return false;
    } catch (error) {
        console.error(`[Element Smart Queue] Error checking safety for ${equipmentId}:`, error);
        return true; // Assume safety issue on error to be safe
    }
}

// Check outdoor temperature conditions for DOAS control - ENHANCED FOR 30-SECOND CONTROL
async function checkOutdoorTemperatureConditions(equipmentId) {
    try {
        const metrics = await gatherMetricsData(equipmentId);
        const outdoorTemp = parseFloat(metrics.Outdoor_Air || metrics.OutdoorTemp || 70);

        // Check for temperature changes that affect DOAS operation
        const lastTemp = equipmentState.get(`${equipmentId}_outdoor`) || outdoorTemp;
        const tempChange = Math.abs(outdoorTemp - lastTemp);

        // Store current temp for next comparison
        equipmentState.set(`${equipmentId}_outdoor`, outdoorTemp);

        // ENHANCED: More sensitive thresholds for 30-second control
        const nearHeatingLockout = Math.abs(outdoorTemp - 65) <= 2;    // Within 2°F of heating lockout
        const nearCoolingLockout = Math.abs(outdoorTemp - 50) <= 2;    // Within 2°F of cooling lockout

        // Process if temperature change > 2°F (more sensitive for DOAS)
        if (tempChange > 2.0) {
            return {
                needsAttention: true,
                reason: `Outdoor temp change: ${tempChange.toFixed(1)}°F (${lastTemp}°F → ${outdoorTemp}°F) - DOAS adjustment needed`
            };
        }

        // Process if approaching lockout thresholds
        if (nearHeatingLockout || nearCoolingLockout) {
            return {
                needsAttention: true,
                reason: `Outdoor temp: ${outdoorTemp}°F approaching DOAS lockout threshold`
            };
        }

        return { needsAttention: false };

    } catch (error) {
        console.error(`[Element Smart Queue] Error checking outdoor temperature for ${equipmentId}:`, error);
        return { needsAttention: false };
    }
}

// Check for significant deviation from setpoints - ENHANCED FOR DOAS SENSITIVITY
async function checkSignificantDeviation(equipmentId, equipmentType) {
    try {
        const currentMetrics = await gatherMetricsData(equipmentId);
        const lastMetrics = equipmentState.get(equipmentId) || {};

        // Store current metrics for next comparison
        equipmentState.set(equipmentId, currentMetrics);

        // More sensitive DOAS deviation thresholds for 30-second control
        const threshold = { temp: 2.0, valve: 12.0 }; // Reduced from 3.0°F and 15%

        // Check supply air temperature deviation
        const currentTemp = parseFloat(currentMetrics.SupplyTemp || currentMetrics.Supply_Air_Temp || 65);
        const lastTemp = parseFloat(lastMetrics.SupplyTemp || lastMetrics.Supply_Air_Temp || currentTemp);
        const tempDiff = Math.abs(currentTemp - lastTemp);

        if (tempDiff > threshold.temp) {
            return {
                hasDeviation: true,
                details: `Supply temperature change: ${tempDiff.toFixed(1)}°F > ${threshold.temp}°F (DOAS sensitivity)`
            };
        }

        // Check gas valve position deviation (DOAS-1 only) - MORE SENSITIVE
        if (equipmentId === 'WBAuutoHnGUtAEc4w6SC') {
            const currentValve = parseFloat(currentMetrics.GasValvePosition || 0);
            const lastValve = parseFloat(lastMetrics.GasValvePosition || currentValve);
            const valveDiff = Math.abs(currentValve - lastValve);

            if (valveDiff > threshold.valve) {
                return {
                    hasDeviation: true,
                    details: `Gas valve change: ${valveDiff.toFixed(1)}% > ${threshold.valve}% (DOAS-1 mod gas control)`
                };
            }
        }

        // Check cooling stage changes (DOAS-1 2-stage DX)
        if (equipmentId === 'WBAuutoHnGUtAEc4w6SC') {
            const currentStage1 = currentMetrics.CoolingStage1 || false;
            const currentStage2 = currentMetrics.CoolingStage2 || false;
            const lastStage1 = lastMetrics.CoolingStage1 || false;
            const lastStage2 = lastMetrics.CoolingStage2 || false;

            if (currentStage1 !== lastStage1 || currentStage2 !== lastStage2) {
                return {
                    hasDeviation: true,
                    details: `DOAS-1 cooling stage change detected (2-stage DX control)`
                };
            }
        }

        return { hasDeviation: false, details: 'No significant deviation detected' };

    } catch (error) {
        console.error(`[Element Smart Queue] Error checking deviation for ${equipmentId}:`, error);
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
            AND location_id = '8'
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
            Outdoor_Air: 65,
            SupplyTemp: 65,
            Supply_Air_Temp: 65,
            locationId: '8',
            equipmentId: equipmentId
        };

    } catch (error) {
        console.error(`[Element] Error gathering metrics for ${equipmentId}:`, error);
        return {
            Outdoor_Air: 65,
            SupplyTemp: 65,
            Supply_Air_Temp: 65,
            locationId: '8',
            equipmentId: equipmentId
        };
    }
}

// FIXED: Get maximum stale time based on equipment type - 30 SECONDS FOR DOAS!
function getMaxStaleTime(equipmentType) {
    const staleTimeConfig = {
        'doas': 30 * 1000,      // 30 SECONDS max for DOAS (was 3 minutes!)
    };

    const equipmentKey = Object.keys(staleTimeConfig).find(key => equipmentType.includes(key));
    return staleTimeConfig[equipmentKey] || (30 * 1000); // Default 30 seconds (was 3 minutes!)
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
        console.error('[Element Smart Queue] Error updating queue status:', error);
    }
}

// ===============================================================================
// MAIN PROCESSOR FUNCTIONS
// ===============================================================================

// Initialize Element processors
async function initializeElementProcessors() {
    console.log('[Element Smart Queue] Starting smart queue system...');
    console.log('[Element Smart Queue] Initializing with intelligent processing for DOAS systems...');
    console.log('[Element Smart Queue] FIXED: 30-second processing for DOAS outdoor air control');
    console.log('[Element Smart Queue] Clearing factory startup cache...');

    try {
        // Check what equipment files are available
        const availableFiles = fs_1.default.readdirSync(EQUIPMENT_PATH)
            .filter(file => file.endsWith('.js') && !file.includes('helpers'));

        console.log(`[Element Smart Queue] Available equipment files: ${availableFiles.join(', ')}`);

        // Start processors for each configured equipment
        for (const [equipmentType, config] of Object.entries(EQUIPMENT_CONFIG)) {
            if (availableFiles.includes(config.file)) {
                startEquipmentProcessor(equipmentType, config);
                console.log(`[Element Smart Queue] Started ${equipmentType} processor (${config.interval / 1000}s interval) - Equipment ID: ${config.equipmentId}`);
            }
            else {
                console.log(`[Element Smart Queue] Skipping ${equipmentType} - file ${config.file} not found`);
            }
        }

        // Start smart queue status monitoring
        setInterval(async () => {
            await updateQueueStatus();
            if (status.total > 0) {
                console.log(`[Element Smart Queue] Status: ${status.waiting} waiting, ${status.active} active, ${status.total} total`);
            }
        }, 60000); // Log every minute if there are jobs

        console.log('[Element Smart Queue] Smart queue system initialized - 2 DOAS processors active with 30-second outdoor air control');
    }
    catch (error) {
        console.error('[Element Smart Queue] Initialization error:', error);
        throw error;
    }
}

// Start individual equipment processor
function startEquipmentProcessor(equipmentType, config) {
    const timer = setInterval(async () => {
        await processEquipment(equipmentType, config);
    }, config.interval);

    equipmentTimers.set(equipmentType, timer);
    lastRun.set(equipmentType, 0);
}

// SMART: Process equipment by adding to queue with intelligence
async function processEquipment(equipmentType, config) {
    const startTime = Date.now();

    try {
        console.log(`[Element] Evaluating ${equipmentType} (${config.equipmentId}) for DOAS outdoor air control...`);

        const jobId = await addEquipmentToQueue(
            config.equipmentId,
            '8', // Element location ID
            equipmentType
        );

        if (jobId) {
            console.log(`[Element] Queued ${equipmentType} for DOAS outdoor air control`);
            lastRun.set(equipmentType, startTime);
        } else {
            console.log(`[Element] ${equipmentType} skipped by smart queue logic`);
        }

    } catch (error) {
        // Handle duplicate job errors gracefully
        if (error.message && (error.message.includes('Job is already') ||
            error.message.includes('duplicate') ||
            error.message.includes('already exists'))) {
            console.log(`[Element Smart Queue] ${equipmentType} already queued, skipping duplicate - this is normal`);
        } else {
            console.error(`[Element Smart Queue] Error in smart queue processing for ${equipmentType}:`, error);
        }
    }
}

// FIXED: Clean up completed/failed jobs from tracking - MATCH HUNTINGTON PATTERN
equipmentQueue.on('completed', (job) => {
    const jobKey = `${job.data.locationId}-${job.data.equipmentId}-${job.data.type}`;
    queuedJobs.delete(jobKey);
    console.log(`[Element Smart Queue] Job ${job.id} completed - ${job.data.type} (${job.data.equipmentId})`);
});

equipmentQueue.on('failed', (job, err) => {
    const jobKey = `${job.data.locationId}-${job.data.equipmentId}-${job.data.type}`;
    queuedJobs.delete(jobKey);
    console.error(`[Element Smart Queue] Job ${job.id} failed - ${job.data.type} (${job.data.equipmentId}):`, err.message);
});

// ===============================================================================
// SYSTEM MANAGEMENT
// ===============================================================================

// Graceful shutdown
async function shutdown() {
    console.log('[Element Smart Queue] Shutting down smart queue system...');
    for (const timer of equipmentTimers.values()) {
        clearInterval(timer);
    }
    await equipmentQueue.close();
    await redis.quit();
    console.log('[Element Smart Queue] Shutdown complete');
    process.exit(0);
}

// Signal handlers for graceful shutdown
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Redis event handlers
redis.on('connect', () => console.log('[Element Smart Queue] Redis connected'));
redis.on('error', (err) => console.error('[Element Smart Queue] Redis error:', err));

// Initialize and start the processor
initializeElementProcessors()
    .then(() => console.log('[Element Smart Queue] Smart queue system started successfully - 2 DOAS processors active with 30-second outdoor air control'))
    .catch((error) => {
        console.error('[Element Smart Queue] Failed to start:', error);
        process.exit(1);
    });
