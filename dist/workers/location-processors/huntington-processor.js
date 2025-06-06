"use strict";
// ===============================================================================
// Huntington Location Processor (Heritage Pointe of Huntington)
// ===============================================================================
//
// PURPOSE:
// Independent equipment processor for Huntington location (location_id=4).
// Manages HVAC equipment control logic with proper 4-parameter interface.
// HYBRID TIMER + QUEUE SYSTEM for optimal performance with SMART QUEUE LOGIC.
//
// EQUIPMENT MANAGED:
// - 4x Pumps (2 CW + 2 HW) - 30s intervals
//   • CW Pump 1: RJLaOk4UssyePSA1qqT8
//   • CW Pump 2: wGvf15Bf6xaLISwhRc7xO
//   • HW Pump 1: GUI1SxcedsLEhqbD0G2p
//   • HW Pump 2: oh5Bz2zzIcuT9lFoogvi
// - 4x Boilers (2 comfort + 2 domestic) - 2min intervals
//   • Comfort Boiler 1: ZLYR6YveSmCEMqtBSy3e
//   • Comfort Boiler 2: XBvDB5Jvh8M4FSBpMDAp
//   • Domestic Boiler 1: NJuMiYl44QNZ8S4AdLsB
//   • Domestic Boiler 2: mpjq0MFGjaA9sFfQrvM9
// - 6x Fan Coils (1,2,3,4,6,7) - 30s intervals
//   • Fan Coil 1: BBHCLhaeItV7pIdinQzM
//   • Fan Coil 2: IEhoTqKphbvHb5fTanpP
//   • Fan Coil 3: i3sBbPSLWLRZ90zCSHUI
//   • Fan Coil 4: yoqvw3vAAEunALLFX8lj
//   • Fan Coil 6: eHclLdHBmnXYiqRSc72e
//   • Fan Coil 7: TLplGG86fAtMOkJR7w7v
// - 1x Chiller - 5min intervals
//   • Chiller: huntington_chiller_001
//
// ARCHITECTURE:
// Timer → Smart Queue Logic → Queue → Worker → Equipment Logic → InfluxDB
//
// SMART QUEUE FEATURES:
// - UI Command Detection (5min window)
// - Safety Condition Monitoring
// - Deviation Detection & Thresholds
// - Job Deduplication
// - Priority-based Processing
// - FIXED: Temperature Control Priority (Fan coils run every 30-60s for PID)
// - Timeout-based Cleanup (FIXED)
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
const equipmentQueue = new Queue('equipment-logic-4', {
    connection: redis,
    defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 5,
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

// Huntington equipment configuration - ALL EQUIPMENT WITH REAL IDs
const EQUIPMENT_CONFIG = {
    'cw-pump-1': {
        interval: 30 * 1000,
        file: 'pumps.js',
        equipmentId: 'RJLaOk4UssyePSA1qqT8'
    },
    'cw-pump-2': {
        interval: 30 * 1000,
        file: 'pumps.js',
        equipmentId: 'wGvf15Bf6xaLISwhRc7xO'
    },
    'hw-pump-1': {
        interval: 30 * 1000,
        file: 'pumps.js',
        equipmentId: 'GUI1SxcedsLEhqbD0G2p'
    },
    'hw-pump-2': {
        interval: 30 * 1000,
        file: 'pumps.js',
        equipmentId: 'oh5Bz2zzIcuT9lFoogvi'
    },
    'comfort-boiler-1': {
        interval: 2 * 60 * 1000,
        file: 'boiler.js',
        equipmentId: 'ZLYR6YveSmCEMqtBSy3e'
    },
    'comfort-boiler-2': {
        interval: 2 * 60 * 1000,
        file: 'boiler.js',
        equipmentId: 'XBvDB5Jvh8M4FSBpMDAp'
    },
    'domestic-boiler-1': {
        interval: 2 * 60 * 1000,
        file: 'boiler.js',
        equipmentId: 'NJuMiYl44QNZ8S4AdLsB'
    },
    'domestic-boiler-2': {
        interval: 2 * 60 * 1000,
        file: 'boiler.js',
        equipmentId: 'mpjq0MFGjaA9sFfQrvM9'
    },
    'fan-coil-1': {
        interval: 30 * 1000,
        file: 'fan-coil.js',
        equipmentId: 'BBHCLhaeItV7pIdinQzM'
    },
    'fan-coil-2': {
        interval: 30 * 1000,
        file: 'fan-coil.js',
        equipmentId: 'IEhoTqKphbvHb5fTanpP'
    },
    'fan-coil-3': {
        interval: 30 * 1000,
        file: 'fan-coil.js',
        equipmentId: 'i3sBbPSLWLRZ90zCSHUI'
    },
    'fan-coil-4': {
        interval: 30 * 1000,
        file: 'fan-coil.js',
        equipmentId: 'yoqvw3vAAEunALLFX8lj'
    },
    'fan-coil-6': {
        interval: 30 * 1000,
        file: 'fan-coil.js',
        equipmentId: 'eHclLdHBmnXYiqRSc72e'
    },
    'fan-coil-7': {
        interval: 30 * 1000,
        file: 'fan-coil.js',
        equipmentId: 'TLplGG86fAtMOkJR7w7v'
    },
    'chiller-1': {
        interval: 5 * 60 * 1000,
        file: 'chiller.js',
        equipmentId: 'huntington_chiller_001'
    }
};

// Equipment state management
const equipmentTimers = new Map();
const lastRun = new Map();

// FIXED: Use absolute path instead of process.cwd() to avoid path issues
const EQUIPMENT_PATH = '/opt/productionapp/dist/lib/equipment-logic/locations/huntington';

// ===============================================================================
// TIMEOUT-BASED CLEANUP (FALLBACK FOR EVENT HANDLER ISSUES)
// ===============================================================================

// Processing timeout configuration based on equipment complexity
const PROCESSING_TIMEOUT = {
    'fan': 60000,          // 60 seconds for fan coils
    'pump': 90000,         // 90 seconds for pumps
    'boiler': 120000,      // 120 seconds for boilers
    'chiller': 180000      // 180 seconds for chillers
};

// Schedule automatic cleanup of queuedJobs tracking
function scheduleJobCleanup(jobKey, equipmentType) {
    const equipmentBase = equipmentType.split('-')[0]; // Get 'fan', 'pump', 'boiler', etc.
    const timeout = PROCESSING_TIMEOUT[equipmentBase] || 60000;

    setTimeout(() => {
        if (queuedJobs.has(jobKey)) {
            queuedJobs.delete(jobKey);
            console.log(`[Huntington Smart Queue] Auto-cleaned ${jobKey} after ${timeout/1000}s timeout`);
        }
    }, timeout);

    console.log(`[Huntington Smart Queue] Scheduled cleanup for ${jobKey} in ${timeout/1000}s`);
}

// ===============================================================================
// SMART QUEUE LOGIC FUNCTIONS
// ===============================================================================

// Enhanced smart queue function with deviation detection and UI command checking
async function addEquipmentToQueue(equipmentId, locationId, equipmentType) {
    try {
        const jobKey = `${locationId}-${equipmentId}-${equipmentType}`;

        // STEP 1: Check if already queued (deduplication)
        if (queuedJobs.has(jobKey)) {
            console.log(`[Huntington Smart Queue] ${equipmentType} (${equipmentId}) already queued, skipping`);
            return null;
        }

        // STEP 2: Smart processing decision
        const shouldProcess = await shouldProcessEquipment(equipmentId, equipmentType);

        if (!shouldProcess.process) {
            console.log(`[Huntington Smart Queue] Skipping ${equipmentType} (${equipmentId}): ${shouldProcess.reason}`);
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
        scheduleJobCleanup(jobKey, equipmentType); // NEW: Add timeout-based cleanup

        console.log(`[Huntington Smart Queue] Queued ${equipmentType} (${equipmentId}) - Reason: ${shouldProcess.reason}, Priority: ${shouldProcess.priority}`);

        // Update queue status
        await updateQueueStatus();

        return job.id;

    } catch (error) {
        // Handle BullMQ duplicate job errors gracefully
        if (error.message.includes('Job with id') && error.message.includes('already exists')) {
            console.log(`[Huntington Smart Queue] Job already exists for ${equipmentType} (${equipmentId}) - this is normal`);
            return null;
        }
        throw error;
    }
}

// Smart processing decision engine
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

        // PRIORITY 3: Check for significant temperature deviation (CRITICAL FOR PID CONTROL)
        const temperatureCheck = await checkTemperatureDeviation(equipmentId, equipmentType);
        if (temperatureCheck.hasDeviation) {
            return {
                process: true,
                reason: `Temperature deviation: ${temperatureCheck.details}`,
                priority: 15 // High priority for temperature control
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

        // PRIORITY 5: Check maximum time since last run (prevent stale data)
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
        console.error(`[Huntington Smart Queue] Error in shouldProcessEquipment for ${equipmentId}:`, error);
        // On error, process equipment to be safe
        return {
            process: true,
            reason: `Error in decision logic: ${error.message}`,
            priority: 1
        };
    }
}

// NEW: Check for temperature deviation that requires immediate PID control
async function checkTemperatureDeviation(equipmentId, equipmentType) {
    try {
        // Only check temperature-controlled equipment
        if (!equipmentType.includes('fan-coil') && !equipmentType.includes('boiler')) {
            return { hasDeviation: false, details: 'Not temperature controlled equipment' };
        }

        const currentMetrics = await gatherMetricsData(equipmentId);

        // Fan coil temperature control check
        if (equipmentType.includes('fan-coil')) {
            const roomTemp = parseFloat(currentMetrics.RoomTemp || currentMetrics.roomTemperature || 0);
            const setpoint = parseFloat(currentMetrics.temperatureSetpoint || 72);
            const tempError = Math.abs(roomTemp - setpoint);

            // Force processing if temperature error > 2°F for fan coils
            if (tempError > 2.0 && roomTemp > 0) {
                return {
                    hasDeviation: true,
                    details: `Fan coil temp error: ${tempError.toFixed(1)}°F (Room: ${roomTemp.toFixed(1)}°F, Setpoint: ${setpoint.toFixed(1)}°F)`
                };
            }
        }

        // Boiler temperature control check
        if (equipmentType.includes('boiler')) {
            const supplyTemp = parseFloat(currentMetrics.H20Supply || currentMetrics.supplyTemperature || 0);
            const targetTemp = parseFloat(currentMetrics.waterTempSetpoint || 140);
            const tempError = Math.abs(supplyTemp - targetTemp);

            // Force processing if temperature error > 5°F for boilers
            if (tempError > 5.0 && supplyTemp > 0) {
                return {
                    hasDeviation: true,
                    details: `Boiler temp error: ${tempError.toFixed(1)}°F (Supply: ${supplyTemp.toFixed(1)}°F, Target: ${targetTemp.toFixed(1)}°F)`
                };
            }
        }

        return { hasDeviation: false, details: 'Temperature within acceptable range' };

    } catch (error) {
        console.error(`[Huntington Smart Queue] Error checking temperature deviation for ${equipmentId}:`, error);
        return { hasDeviation: true, details: `Error checking temperature: ${error.message}` };
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
                console.log(`[Huntington Smart Queue] Found ${data.length} recent UI commands for ${equipmentId}`);
            }

            return hasCommands;
        }

        return false;
    } catch (error) {
        console.error(`[Huntington Smart Queue] Error checking UI commands for ${equipmentId}:`, error);
        return false; // Assume no UI commands on error
    }
}

// Check for safety conditions that require immediate processing
async function checkSafetyConditions(equipmentId, equipmentType) {
    try {
        const metrics = await gatherMetricsData(equipmentId);

        // Boiler safety checks
        if (equipmentType.includes('boiler')) {
            const supplyTemp = parseFloat(metrics.H20Supply || metrics.supplyTemp || 0);
            if (supplyTemp > 170) { // Emergency shutoff temperature
                console.log(`[Huntington Smart Queue] SAFETY: High supply temperature ${supplyTemp}°F for ${equipmentId}`);
                return true;
            }

            const freezestat = metrics.Freezestat || metrics.freezestat;
            if (freezestat === true || freezestat === 'true' || freezestat === 1) {
                console.log(`[Huntington Smart Queue] SAFETY: Freezestat condition for ${equipmentId}`);
                return true;
            }
        }

        // Fan coil safety checks
        if (equipmentType.includes('fan-coil')) {
            const roomTemp = parseFloat(metrics.RoomTemp || 0);
            if (roomTemp > 85 || roomTemp < 60) { // Extreme temperature conditions
                console.log(`[Huntington Smart Queue] SAFETY: Extreme room temperature ${roomTemp}°F for ${equipmentId}`);
                return true;
            }
        }

        return false;
    } catch (error) {
        console.error(`[Huntington Smart Queue] Error checking safety for ${equipmentId}:`, error);
        return true; // Assume safety issue on error to be safe
    }
}

// Check for significant deviation from setpoints
async function checkSignificantDeviation(equipmentId, equipmentType) {
    try {
        const currentMetrics = await gatherMetricsData(equipmentId);
        const lastMetrics = equipmentState.get(equipmentId) || {};

        // Store current metrics for next comparison
        equipmentState.set(equipmentId, currentMetrics);

        // Different deviation thresholds by equipment type
        const thresholds = {
            'boiler': { temp: 5.0, pressure: 10.0 },
            'pump': { speed: 15.0, pressure: 5.0 },
            'fan-coil': { temp: 3.0, valve: 20.0 },
            'chiller-1': { temp: 2.0, pressure: 8.0 }
        };

        const equipmentThreshold = Object.keys(thresholds).find(key => equipmentType.includes(key));
        if (!equipmentThreshold) {
            return { hasDeviation: false, details: 'No thresholds defined' };
        }

        const threshold = thresholds[equipmentThreshold];

        // Check temperature deviation
        if (threshold.temp) {
            const currentTemp = parseFloat(currentMetrics.RoomTemp || currentMetrics.SupplyTemp || currentMetrics.H20Supply || 0);
            const lastTemp = parseFloat(lastMetrics.RoomTemp || lastMetrics.SupplyTemp || lastMetrics.H20Supply || currentTemp);
            const tempDiff = Math.abs(currentTemp - lastTemp);

            if (tempDiff > threshold.temp) {
                return {
                    hasDeviation: true,
                    details: `Temperature change: ${tempDiff.toFixed(1)}°F > ${threshold.temp}°F`
                };
            }
        }

        // Add other deviation checks (pressure, valve positions, etc.)

        return { hasDeviation: false, details: 'No significant deviation detected' };

    } catch (error) {
        console.error(`[Huntington Smart Queue] Error checking deviation for ${equipmentId}:`, error);
        return { hasDeviation: true, details: `Error checking deviation: ${error.message}` };
    }
}

// Helper function to gather current metrics from InfluxDB for specific equipment
async function gatherMetricsData(equipmentId) {
    try {
        const database = process.env.INFLUXDB_DATABASE || 'Locations';
        const influxUrl = process.env.INFLUXDB_URL || 'http://143.198.162.31:8181';

        // Query recent metrics for THIS specific equipment from the metrics table
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
                // Convert array of metrics to single object with latest values
                const metricsObject = {};

                for (const metric of data) {
                    // Process all metric fields dynamically (like the hook does)
                    const skipFields = ['equipmentId', 'location_id', 'time', 'equipment_type', 'system', 'zone'];

                    Object.entries(metric).forEach(([key, value]) => {
                        if (!skipFields.includes(key) && value !== null && value !== undefined && value !== '') {
                            // Use latest value for each metric
                            if (!metricsObject[key]) {
                                metricsObject[key] = value;
                            }
                        }
                    });

                    // Also add common equipment fields
                    if (metric.equipmentId) metricsObject.equipmentId = metric.equipmentId;
                    if (metric.location_id) metricsObject.locationId = metric.location_id;
                }

                console.log(`[Huntington] Gathered ${Object.keys(metricsObject).length} metrics for equipment ${equipmentId}`);
                return metricsObject;
            }
        }

        console.log(`[Huntington] No recent metrics found for equipment ${equipmentId}, using defaults`);
        return {
            Outdoor_Air: 50,
            RoomTemp: 72,
            SupplyTemp: 55,
            H20Supply: 140,
            locationId: '4',
            equipmentId: equipmentId
        };

    } catch (error) {
        console.error(`[Huntington] Error gathering metrics for ${equipmentId}:`, error);
        return {
            Outdoor_Air: 50,
            RoomTemp: 72,
            SupplyTemp: 55,
            H20Supply: 140,
            locationId: '4',
            equipmentId: equipmentId
        };
    }
}

// FIXED: Get maximum stale time based on equipment type - TEMPERATURE CONTROL PRIORITY
function getMaxStaleTime(equipmentType) {
    const staleTimeConfig = {
        'pump': 2 * 60 * 1000,      // 2 minutes max for pumps
        'boiler': 3 * 60 * 1000,    // 3 minutes max for boilers
        'fan-coil': 45 * 1000,      // 45 SECONDS max for fan coils (CRITICAL FOR PID CONTROL!)
        'chiller': 8 * 60 * 1000    // 8 minutes max for chiller
    };

    const equipmentKey = Object.keys(staleTimeConfig).find(key => equipmentType.includes(key));
    return staleTimeConfig[equipmentKey] || (2 * 60 * 1000); // Default 2 minutes
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
        console.error('[Huntington Smart Queue] Error updating queue status:', error);
    }
}

// ===============================================================================
// MAIN PROCESSOR FUNCTIONS
// ===============================================================================

// Initialize Huntington processors
async function initializeHuntingtonProcessors() {
    console.log('[Huntington] Initializing equipment processors with SMART queue integration...');
    console.log(`[Huntington] Equipment path: ${EQUIPMENT_PATH}`);

    try {
        // Check what equipment files are available
        const availableFiles = fs_1.default.readdirSync(EQUIPMENT_PATH)
            .filter(file => file.endsWith('.js') && !file.includes('helpers'));

        console.log(`[Huntington] Available equipment files: ${availableFiles.join(', ')}`);

        // Start processors for each configured equipment
        for (const [equipmentType, config] of Object.entries(EQUIPMENT_CONFIG)) {
            if (availableFiles.includes(config.file)) {
                startEquipmentProcessor(equipmentType, config);
                console.log(`[Huntington] Started ${equipmentType} processor (${config.interval / 1000}s interval) - Equipment ID: ${config.equipmentId}`);
            }
            else {
                console.log(`[Huntington] Skipping ${equipmentType} - file ${config.file} not found`);
            }
        }

        // Start smart queue status monitoring
        setInterval(async () => {
            await updateQueueStatus();
            if (status.total > 0) {
                console.log(`[Huntington Smart Queue] Status: ${status.waiting} waiting, ${status.active} active, ${status.total} total`);
            }
        }, 60000); // Log every minute if there are jobs

        console.log('[Huntington] All equipment processors initialized with SMART queue integration');
    }
    catch (error) {
        console.error('[Huntington] Initialization error:', error);
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
        console.log(`[Huntington] Evaluating ${equipmentType} (${config.equipmentId}) for smart processing...`);

        // Add equipment to BullMQ queue with smart logic
        const jobId = await addEquipmentToQueue(
            config.equipmentId,
            '4', // Huntington location ID
            equipmentType
        );

        if (jobId) {
            console.log(`[Huntington] Queued ${equipmentType} with job ID ${jobId}`);
            lastRun.set(config.equipmentId, startTime);
        } else {
            console.log(`[Huntington] ${equipmentType} skipped by smart queue logic`);
        }

    } catch (error) {
        // Handle duplicate job errors gracefully
        if (error.message && (error.message.includes('Job is already') ||
            error.message.includes('duplicate') ||
            error.message.includes('already exists'))) {
            console.log(`[Huntington] ${equipmentType} already queued, skipping duplicate - this is normal`);
        } else {
            console.error(`[Huntington] Error in smart queue processing for ${equipmentType}:`, error);
        }
    }
}

// Clean up completed/failed jobs from tracking (Event handlers - may not work)
equipmentQueue.on('completed', (job) => {
    const jobKey = `${job.data.locationId}-${job.data.equipmentId}-${job.data.type}`;
    queuedJobs.delete(jobKey);
    console.log(`[Huntington Smart Queue] Job ${job.id} completed - ${job.data.type} (${job.data.equipmentId})`);
});

equipmentQueue.on('failed', (job, err) => {
    const jobKey = `${job.data.locationId}-${job.data.equipmentId}-${job.data.type}`;
    queuedJobs.delete(jobKey);
    console.error(`[Huntington Smart Queue] Job ${job.id} failed - ${job.data.type} (${job.data.equipmentId}):`, err.message);
});

// ===============================================================================
// SYSTEM MANAGEMENT
// ===============================================================================

// Graceful shutdown
async function shutdown() {
    console.log('[Huntington] Shutting down equipment processors with SMART queue integration...');
    for (const timer of equipmentTimers.values()) {
        clearInterval(timer);
    }
    await equipmentQueue.close();
    await redis.quit();
    process.exit(0);
}

// Signal handlers for graceful shutdown
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Redis event handlers
redis.on('connect', () => console.log('[Huntington] Redis connected'));
redis.on('error', (err) => console.error('[Huntington] Redis error:', err));

// Initialize and start the processor
console.log('[Huntington] Starting Huntington processor with SMART queue integration...');
initializeHuntingtonProcessors()
    .then(() => console.log('[Huntington] Huntington processor started successfully with SMART queue integration'))
    .catch((error) => {
        console.error('[Huntington] Failed to start:', error);
        process.exit(1);
    });
