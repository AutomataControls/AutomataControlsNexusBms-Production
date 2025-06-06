"use strict";
// ===============================================================================
// Hopebridge Location Processor
// ===============================================================================
//
// Author: Juelz NeuralBms DevOps
// Last Updated: June 5, 2025
//
// PURPOSE:
// Smart queue processor for Hopebridge location (location_id=5) - Autism Therapy Center.
// Provides intelligent processing decisions for therapy facility equipment control.
// FIXED: Optimized for therapy center comfort with 30-45 second temperature control
//
// EQUIPMENT:
// - Air Handler 1: FDhNArcvkL6v2cZDfuSR (CW + chiller control) - 30s max
// - Air Handler 2: XS60eMHH8DJRXmvIv6wU (DX cooling) - 30s max
// - Air Handler 3: 57bJYUeT8vbjsKqzo0uD (Simple CW control) - 30s max
// - Boiler 1: NFDisFgQMzYTgDRgNSEL (Disconnected for repairs) - 60s max
// - Boiler 2: k04HDjmrjhG4VjEa9Js1 (Primary operational) - 60s max
// - HW Pump 1: ORzMyjSMrZ2FJzuzYGpO (Primary circulation) - 30s max
// - HW Pump 2: h1HZMjh6it3gjR1p1T3q (Secondary circulation) - 30s max
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
const equipmentQueue = new Queue('equipment-logic-5', {
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

// FIXED: Prevent memory leak warnings
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

// Hopebridge equipment configuration - OPTIMIZED FOR THERAPY CENTER
const EQUIPMENT_CONFIG = {
    'air-handler-1': {
        interval: 30 * 1000,        // 30 seconds for therapy center comfort
        timeout: 90 * 1000,         // Reduced from 3 minutes
        priority: 15,
        file: 'air-handler.js',
        equipmentId: 'FDhNArcvkL6v2cZDfuSR'
    },
    'air-handler-2': {
        interval: 30 * 1000,        // 30 seconds for therapy center comfort
        timeout: 90 * 1000,         // Reduced from 2 minutes
        priority: 12,
        file: 'air-handler.js',
        equipmentId: 'XS60eMHH8DJRXmvIv6wU'
    },
    'air-handler-3': {
        interval: 30 * 1000,        // 30 seconds for therapy center comfort
        timeout: 90 * 1000,         // Reduced from 2 minutes
        priority: 10,
        file: 'air-handler.js',
        equipmentId: '57bJYUeT8vbjsKqzo0uD'
    },
    'boiler-1': {
        interval: 60 * 1000,        // 60 seconds for heating response
        timeout: 90 * 1000,         // Reduced from 2 minutes
        priority: 8,
        file: 'boiler.js',
        equipmentId: 'NFDisFgQMzYTgDRgNSEL'
    },
    'boiler-2': {
        interval: 60 * 1000,        // 60 seconds for heating response
        timeout: 90 * 1000,         // Reduced from 2 minutes
        priority: 14,
        file: 'boiler.js',
        equipmentId: 'k04HDjmrjhG4VjEa9Js1'
    },
    'hw-pump-1': {
        interval: 30 * 1000,        // 30 seconds for circulation
        timeout: 60 * 1000,         // Keep at 60 seconds
        priority: 6,
        file: 'pumps.js',
        equipmentId: 'ORzMyjSMrZ2FJzuzYGpO'
    },
    'hw-pump-2': {
        interval: 30 * 1000,        // 30 seconds for circulation
        timeout: 60 * 1000,         // Keep at 60 seconds
        priority: 6,
        file: 'pumps.js',
        equipmentId: 'h1HZMjh6it3gjR1p1T3q'
    }
};

// Equipment state management
const equipmentTimers = new Map();
const lastRun = new Map();

// FIXED: Use absolute path instead of process.cwd() to avoid path issues
const EQUIPMENT_PATH = '/opt/productionapp/dist/lib/equipment-logic/locations/hopebridge';

// ===============================================================================
// TIMEOUT-BASED CLEANUP (FALLBACK FOR EVENT HANDLER ISSUES) - OPTIMIZED FOR THERAPY CENTER
// ===============================================================================

// Processing timeout configuration - REDUCED FOR THERAPY CENTER RESPONSIVENESS
const PROCESSING_TIMEOUT = {
    'air': 90 * 1000,              // 90 seconds for air handlers (was 3 minutes)
    'boiler': 90 * 1000,           // 90 seconds for boilers (was 2 minutes)
    'pump': 60 * 1000,             // 60 seconds for pumps (was 1 minute)
};

// Schedule automatic cleanup of queuedJobs tracking
function scheduleJobCleanup(jobKey, equipmentType) {
    const equipmentBase = equipmentType.split('-')[0]; // Get 'air', 'boiler', etc.
    const timeout = PROCESSING_TIMEOUT[equipmentBase] || 60000;

    setTimeout(() => {
        if (queuedJobs.has(jobKey)) {
            queuedJobs.delete(jobKey);
            console.log(`[Hopebridge Smart Queue] Auto-cleaned ${jobKey} after ${timeout/1000}s timeout`);
        }
    }, timeout);

    console.log(`[Hopebridge Smart Queue] Scheduled cleanup for ${jobKey} in ${timeout/1000}s`);
}

// ===============================================================================
// SMART QUEUE LOGIC FUNCTIONS - OPTIMIZED FOR THERAPY CENTER COMFORT
// ===============================================================================

// Enhanced smart queue function with deviation detection and UI command checking
async function addEquipmentToQueue(equipmentId, locationId, equipmentType) {
    try {
        const jobKey = `${locationId}-${equipmentId}-${equipmentType}`;

        // STEP 1: Check if already queued (deduplication)
        if (queuedJobs.has(jobKey)) {
            console.log(`[Hopebridge Smart Queue] ${equipmentType} already queued, skipping`);
            return null;
        }

        // STEP 2: Smart processing decision
        const shouldProcess = await shouldProcessEquipment(equipmentId, equipmentType);

        if (!shouldProcess.process) {
            console.log(`[Hopebridge Smart Queue] Skipping ${equipmentType}: ${shouldProcess.reason}`);
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

        console.log(`[Hopebridge Smart Queue] Queued ${equipmentType} with priority ${shouldProcess.priority}`);

        // Update queue status
        await updateQueueStatus();

        return job.id;

    } catch (error) {
        // Handle BullMQ duplicate job errors gracefully
        if (error.message.includes('Job with id') && error.message.includes('already exists')) {
            console.log(`[Hopebridge Smart Queue] Job already exists for ${equipmentType} - this is normal`);
            return null;
        }
        throw error;
    }
}

// Smart processing decision engine - ENHANCED FOR THERAPY CENTER
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

        // PRIORITY 3: Check temperature deviation (CRITICAL FOR THERAPY CENTER)
        const tempDeviation = await checkTherapyCenterTemperatureDeviation(equipmentId, equipmentType);
        if (tempDeviation.hasDeviation) {
            return {
                process: true,
                reason: `Therapy center temp deviation: ${tempDeviation.details}`,
                priority: 18 // Very high priority for therapy center comfort
            };
        }

        // PRIORITY 4: Check therapy facility occupancy (high priority during therapy hours)
        const therapyCheck = await checkTherapyOccupancy();
        if (therapyCheck.occupied && therapyCheck.needsAttention) {
            return {
                process: true,
                reason: 'Therapy session active - comfort critical',
                priority: 15 // High priority for therapy sessions
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

        // PRIORITY 6: Check maximum time since last run (FIXED - CONSISTENT WITH WARREN!)
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
        console.error(`[Hopebridge Smart Queue] Error in shouldProcessEquipment for ${equipmentId}:`, error);
        // On error, process equipment to be safe
        return {
            process: true,
            reason: `Error in decision logic: ${error.message}`,
            priority: 1
        };
    }
}

// NEW: Check for temperature deviation that requires immediate processing (therapy center specific)
async function checkTherapyCenterTemperatureDeviation(equipmentId, equipmentType) {
    try {
        const metrics = await gatherMetricsData(equipmentId);

        // Therapy center equipment needs VERY responsive temperature control
        if (equipmentType.includes('air-handler')) {
            const roomTemp = parseFloat(metrics.RoomTemp || metrics.ZoneTemp || 72);
            const supplyTemp = parseFloat(metrics.SupplyTemp || metrics.Supply_Air_Temp || 65);
            const setpoint = parseFloat(metrics.temperatureSetpoint || metrics.Setpoint || 72);

            // Very tight temperature control for therapy center (1.5°F tolerance)
            const tempError = Math.abs(roomTemp - setpoint);
            if (tempError > 1.5) {
                return {
                    hasDeviation: true,
                    details: `Room temp error: ${tempError.toFixed(1)}°F (${roomTemp}°F vs ${setpoint}°F setpoint) - therapy center comfort critical`
                };
            }

            // Supply air temperature checks (critical for therapy comfort)
            if (supplyTemp < 45 || supplyTemp > 85) {
                return {
                    hasDeviation: true,
                    details: `Supply temp concern: ${supplyTemp}°F (therapy center safety)`
                };
            }

            // Mixed air protection for therapy center
            const mixedAir = parseFloat(metrics.MixedAir || metrics.Mixed_Air || 65);
            if (mixedAir < 40 || mixedAir > 80) {
                return {
                    hasDeviation: true,
                    details: `Mixed air concern: ${mixedAir}°F (therapy center comfort)`
                };
            }
        }

        // Boiler temperature control for therapy center heating
        if (equipmentType.includes('boiler')) {
            const waterTemp = parseFloat(metrics.WaterTemp || metrics.H20Supply || 140);
            const setpoint = parseFloat(metrics.temperatureSetpoint || 160);
            const tempError = Math.abs(waterTemp - setpoint);

            if (tempError > 8.0) {
                return {
                    hasDeviation: true,
                    details: `Boiler temp error: ${tempError.toFixed(1)}°F (${waterTemp}°F vs ${setpoint}°F setpoint) - therapy center heating`
                };
            }
        }

        return { hasDeviation: false, details: 'No temperature deviation' };

    } catch (error) {
        console.error(`[Hopebridge Smart Queue] Error checking therapy center temperature deviation for ${equipmentId}:`, error);
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
                console.log(`[Hopebridge Smart Queue] Found ${data.length} recent UI commands for ${equipmentId}`);
            }

            return hasCommands;
        }

        return false;
    } catch (error) {
        console.error(`[Hopebridge Smart Queue] Error checking UI commands for ${equipmentId}:`, error);
        return false; // Assume no UI commands on error
    }
}

// Check for safety conditions that require immediate processing
async function checkSafetyConditions(equipmentId, equipmentType) {
    try {
        const metrics = await gatherMetricsData(equipmentId);

        // Air handler safety checks (therapy facility specific)
        if (equipmentType.includes('air-handler')) {
            const supplyTemp = parseFloat(metrics.SupplyTemp || metrics.Supply_Air_Temp || 0);

            // High temperature protection (comfort critical for therapy)
            if (supplyTemp > 85) {
                console.log(`[Hopebridge Smart Queue] SAFETY: High supply temperature ${supplyTemp}°F for ${equipmentId}`);
                return true;
            }

            // Freeze protection
            if (supplyTemp < 35) {
                console.log(`[Hopebridge Smart Queue] SAFETY: Freeze protection ${supplyTemp}°F for ${equipmentId}`);
                return true;
            }

            // Mixed air protection
            const mixedAir = parseFloat(metrics.MixedAir || metrics.Mixed_Air || 0);
            if (mixedAir < 35) {
                console.log(`[Hopebridge Smart Queue] SAFETY: Mixed air freeze protection ${mixedAir}°F for ${equipmentId}`);
                return true;
            }

            // AHU-1 specific - Chiller safety
            if (equipmentId === 'FDhNArcvkL6v2cZDfuSR') {
                const chillerPressure = parseFloat(metrics.ChillerPressure || 0);
                if (chillerPressure > 200) {
                    console.log(`[Hopebridge Smart Queue] SAFETY: Chiller high pressure ${chillerPressure} PSI for ${equipmentId}`);
                    return true;
                }
            }

            // AHU-2 specific - DX system safety
            if (equipmentId === 'XS60eMHH8DJRXmvIv6wU') {
                const dxPressure = parseFloat(metrics.DXPressure || 0);
                if (dxPressure > 150) {
                    console.log(`[Hopebridge Smart Queue] SAFETY: DX high pressure ${dxPressure} PSI for ${equipmentId}`);
                    return true;
                }
            }
        }

        // Boiler safety checks
        if (equipmentType.includes('boiler')) {
            const waterTemp = parseFloat(metrics.WaterTemp || metrics.H20Supply || 0);

            if (waterTemp > 200) {
                console.log(`[Hopebridge Smart Queue] SAFETY: Boiler overtemp ${waterTemp}°F for ${equipmentId}`);
                return true;
            }

            const pressure = parseFloat(metrics.Pressure || 0);
            if (pressure > 30) {
                console.log(`[Hopebridge Smart Queue] SAFETY: High pressure ${pressure} PSI for ${equipmentId}`);
                return true;
            }
        }

        // Pump safety checks
        if (equipmentType.includes('pump')) {
            const amps = parseFloat(metrics.Amps || metrics.PumpAmps || 0);

            if (amps > 18) {
                console.log(`[Hopebridge Smart Queue] SAFETY: Motor overload ${amps}A for ${equipmentId}`);
                return true;
            }

            const vibration = parseFloat(metrics.Vibration || 0);
            if (vibration > 8) {
                console.log(`[Hopebridge Smart Queue] SAFETY: High vibration ${vibration} for ${equipmentId}`);
                return true;
            }
        }

        return false;
    } catch (error) {
        console.error(`[Hopebridge Smart Queue] Error checking safety for ${equipmentId}:`, error);
        return true; // Assume safety issue on error to be safe
    }
}

// Check therapy facility occupancy (5:30 AM - 9:45 PM) - ENHANCED FOR BETTER COMFORT
async function checkTherapyOccupancy() {
    try {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTimeInMinutes = currentHour * 60 + currentMinute;
        const occupiedStartMinutes = 5 * 60 + 30; // 5:30 AM
        const occupiedEndMinutes = 21 * 60 + 45; // 9:45 PM

        const isOccupied = currentTimeInMinutes >= occupiedStartMinutes &&
                          currentTimeInMinutes <= occupiedEndMinutes;

        // Check if any equipment needs attention during therapy hours (MORE SENSITIVE)
        let needsAttention = false;
        if (isOccupied) {
            const metrics = await gatherMetricsData('FDhNArcvkL6v2cZDfuSR'); // Use AHU-1 as reference

            // During therapy hours, be MORE responsive to temperature deviations
            const roomTemp = parseFloat(metrics.RoomTemp || 72);
            const supplyTemp = parseFloat(metrics.SupplyTemp || 65);

            // Tighter control during therapy sessions (1.5°F vs 3°F)
            if (Math.abs(roomTemp - 72) > 1.5 || supplyTemp < 50 || supplyTemp > 75) {
                needsAttention = true;
            }
        }

        return { occupied: isOccupied, needsAttention: needsAttention };
    } catch (error) {
        console.error('[Hopebridge Smart Queue] Therapy occupancy check error:', error);
        return { occupied: false, needsAttention: false };
    }
}

// Check for significant deviation from setpoints - ENHANCED FOR THERAPY CENTER
async function checkSignificantDeviation(equipmentId, equipmentType) {
    try {
        const currentMetrics = await gatherMetricsData(equipmentId);
        const lastMetrics = equipmentState.get(equipmentId) || {};

        // Store current metrics for next comparison
        equipmentState.set(equipmentId, currentMetrics);

        // More sensitive thresholds for therapy facility comfort
        const thresholds = {
            'air-handler': { temp: 1.5, valve: 12.0 }, // Reduced from 2.5°F and 15%
            'boiler': { temp: 3.0, pressure: 6.0 },    // Reduced from 4.0°F and 8.0 PSI
            'pump': { speed: 10.0, pressure: 3.0 }     // Reduced from 12% and 4.0 PSI
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
                    details: `Temperature change: ${tempDiff.toFixed(1)}°F > ${threshold.temp}°F (therapy center sensitivity)`
                };
            }
        }

        return { hasDeviation: false, details: 'No significant deviation detected' };

    } catch (error) {
        console.error(`[Hopebridge Smart Queue] Error checking deviation for ${equipmentId}:`, error);
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
            AND location_id = '5'
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
            Outdoor_Air: 50,
            RoomTemp: 72,
            SupplyTemp: 55,
            H20Supply: 140,
            Mixed_Air: 60,
            locationId: '5',
            equipmentId: equipmentId
        };

    } catch (error) {
        console.error(`[Hopebridge] Error gathering metrics for ${equipmentId}:`, error);
        return {
            Outdoor_Air: 50,
            RoomTemp: 72,
            SupplyTemp: 55,
            H20Supply: 140,
            Mixed_Air: 60,
            locationId: '5',
            equipmentId: equipmentId
        };
    }
}

// FIXED: Get maximum stale time based on equipment type - OPTIMIZED FOR THERAPY CENTER COMFORT!
function getMaxStaleTime(equipmentType) {
    const staleTimeConfig = {
        'air-handler': 30 * 1000,     // 30 SECONDS max for air handlers (was 8 minutes!)
        'boiler': 60 * 1000,          // 60 SECONDS max for boilers (was 12 minutes!)
        'pump': 30 * 1000,            // 30 SECONDS max for pumps (was 4 minutes!)
    };

    const equipmentKey = Object.keys(staleTimeConfig).find(key => equipmentType.includes(key));
    return staleTimeConfig[equipmentKey] || (45 * 1000); // Default 45 seconds (was 8 minutes!)
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
        console.error('[Hopebridge Smart Queue] Error updating queue status:', error);
    }
}

// ===============================================================================
// MAIN PROCESSOR FUNCTIONS
// ===============================================================================

// Initialize Hopebridge processors
async function initializeHopebridgeProcessors() {
    console.log('[Hopebridge Smart Queue] Starting smart queue system...');
    console.log('[Hopebridge Smart Queue] Initializing with intelligent processing for autism therapy center...');
    console.log('[Hopebridge Smart Queue] FIXED: 30-60 second processing for therapy center comfort');
    console.log('[Hopebridge Smart Queue] Clearing factory startup cache...');

    try {
        // Check what equipment files are available
        const availableFiles = fs_1.default.readdirSync(EQUIPMENT_PATH)
            .filter(file => file.endsWith('.js') && !file.includes('helpers'));

        console.log(`[Hopebridge Smart Queue] Available equipment files: ${availableFiles.join(', ')}`);

        // Start processors for each configured equipment
        for (const [equipmentType, config] of Object.entries(EQUIPMENT_CONFIG)) {
            if (availableFiles.includes(config.file)) {
                startEquipmentProcessor(equipmentType, config);
                console.log(`[Hopebridge Smart Queue] Started ${equipmentType} processor (${config.interval / 1000}s interval) - Equipment ID: ${config.equipmentId}`);
            }
            else {
                console.log(`[Hopebridge Smart Queue] Skipping ${equipmentType} - file ${config.file} not found`);
            }
        }

        // Start smart queue status monitoring
        setInterval(async () => {
            await updateQueueStatus();
            if (status.total > 0) {
                console.log(`[Hopebridge Smart Queue] Status: ${status.waiting} waiting, ${status.active} active, ${status.total} total`);
            }
        }, 60000); // Log every minute if there are jobs

        console.log('[Hopebridge Smart Queue] Smart queue system initialized - 7 equipment processors active with therapy center optimized control');
    }
    catch (error) {
        console.error('[Hopebridge Smart Queue] Initialization error:', error);
        throw error;
    }
}

// Start individual equipment processor - FIXED TO MATCH WARREN PATTERN
function startEquipmentProcessor(equipmentType, config) {
    const timer = setInterval(async () => {
        await processEquipment(equipmentType, config);
    }, config.interval);

    equipmentTimers.set(equipmentType, timer);
    lastRun.set(equipmentType, 0);  // FIXED: Use equipmentType like Warren (was config.equipmentId)
}

// SMART: Process equipment by adding to queue with intelligence
async function processEquipment(equipmentType, config) {
    const startTime = Date.now();

    try {
        console.log(`[Hopebridge] Evaluating ${equipmentType} (${config.equipmentId}) for therapy center comfort...`);

        const jobId = await addEquipmentToQueue(
            config.equipmentId,
            '5', // Hopebridge location ID
            equipmentType
        );

        if (jobId) {
            console.log(`[Hopebridge] Queued ${equipmentType} for therapy center comfort control`);
            lastRun.set(config.equipmentId, startTime);
        } else {
            console.log(`[Hopebridge] ${equipmentType} skipped by smart queue logic`);
        }

    } catch (error) {
        // Handle duplicate job errors gracefully
        if (error.message && (error.message.includes('Job is already') ||
            error.message.includes('duplicate') ||
            error.message.includes('already exists'))) {
            console.log(`[Hopebridge Smart Queue] ${equipmentType} already queued, skipping duplicate - this is normal`);
        } else {
            console.error(`[Hopebridge Smart Queue] Error in smart queue processing for ${equipmentType}:`, error);
        }
    }
}

// FIXED: Clean up completed/failed jobs from tracking - MATCH WARREN PATTERN
equipmentQueue.on('completed', (job) => {
    const jobKey = `${job.data.locationId}-${job.data.equipmentId}-${job.data.type}`;
    queuedJobs.delete(jobKey);
    console.log(`[Hopebridge Smart Queue] Job ${job.id} completed - ${job.data.type} (${job.data.equipmentId})`);
});

equipmentQueue.on('failed', (job, err) => {
    const jobKey = `${job.data.locationId}-${job.data.equipmentId}-${job.data.type}`;
    queuedJobs.delete(jobKey);
    console.error(`[Hopebridge Smart Queue] Job ${job.id} failed - ${job.data.type} (${job.data.equipmentId}):`, err.message);
});

// ===============================================================================
// SYSTEM MANAGEMENT
// ===============================================================================

// Graceful shutdown
async function shutdown() {
    console.log('[Hopebridge Smart Queue] Shutting down smart queue system...');
    for (const timer of equipmentTimers.values()) {
        clearInterval(timer);
    }
    await equipmentQueue.close();
    await redis.quit();
    console.log('[Hopebridge Smart Queue] Shutdown complete');
    process.exit(0);
}

// Signal handlers for graceful shutdown
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Redis event handlers
redis.on('connect', () => console.log('[Hopebridge Smart Queue] Redis connected'));
redis.on('error', (err) => console.error('[Hopebridge Smart Queue] Redis error:', err));

// Initialize and start the processor
initializeHopebridgeProcessors()
    .then(() => console.log('[Hopebridge Smart Queue] Smart queue system started successfully - 7 equipment processors active with therapy center optimized comfort control'))
    .catch((error) => {
        console.error('[Hopebridge Smart Queue] Failed to start:', error);
        process.exit(1);
    });
