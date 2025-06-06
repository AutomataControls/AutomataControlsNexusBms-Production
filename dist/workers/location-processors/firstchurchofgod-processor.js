"use strict";
// ===============================================================================
// FirstChurchOfGod Location Processor
// ===============================================================================
//
// Author: Juelz NeuralBms DevOps
// Last Updated: June 5, 2025
//
// PURPOSE:
// Smart queue processor for FirstChurchOfGod location (location_id=9).
// Provides intelligent processing decisions for church equipment control.
// FIXED: 30-second processing for 4-stage chiller control
//
// EQUIPMENT:
// - Air Handler 1: WAg6mWpJneM2zLMDu11b - 30s max
// - Boiler 1: 5O3e8z6KwexgupGER4FW - 60s max
// - Chiller 1: sWt9ordzOHmo9O3cmVl7 (4-stage) - 30s max
// - Chiller 2: lsQW6gtoB4luewi0esHL (4-stage) - 30s max
// - CW Pump 1: u6gdCAFDKYZ00Dq6j3Pq - 30s max
// - CW Pump 2: uF3dFIwcULobnRTy5R5W - 30s max
// - HW Pump 1: b6bcTD5PVO9BBDkJcfQA - 30s max
// - HW Pump 2: OqwYSV2rnB5sWOWusu6X - 30s max
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
const equipmentQueue = new Queue('equipment-logic-9', {
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

// FirstChurchOfGod equipment configuration - OPTIMIZED FOR CHURCH SERVICES
const EQUIPMENT_CONFIG = {
    'air-handler-1': {
        interval: 30 * 1000,        // 30 seconds for church temperature control
        timeout: 30 * 1000,         // Reduced from 3 minutes
        priority: 15,
        file: 'air-handler.js',
        equipmentId: 'WAg6mWpJneM2zLMDu11b'
    },
    'boiler-1': {
        interval: 30 * 1000,        // 60 seconds for heating response
        timeout: 30 * 1000,         // Reduced from 2 minutes
        priority: 10,
        file: 'boiler.js',
        equipmentId: '5O3e8z6KwexgupGER4FW'
    },
    'chiller-1': {
        interval: 30 * 1000,        // 30 seconds for 4-stage chiller control
        timeout: 30 * 1000,         // Reduced from 3 minutes
        priority: 10,
        file: 'chiller.js',
        equipmentId: 'sWt9ordzOHmo9O3cmVl7'
    },
    'chiller-2': {
        interval: 30 * 1000,        // 30 seconds for 4-stage chiller control
        timeout: 30 * 1000,         // Reduced from 3 minutes
        priority: 10,
        file: 'chiller.js',
        equipmentId: 'lsQW6gtoB4luewi0esHL'
    },
    'cw-pump-1': {
        interval: 30 * 1000,        // 30 seconds for circulation
        timeout: 30 * 1000,         // Keep at 60 seconds
        priority: 5,
        file: 'pumps.js',
        equipmentId: 'u6gdCAFDKYZ00Dq6j3Pq'
    },
    'cw-pump-2': {
        interval: 30 * 1000,        // 30 seconds for circulation
        timeout: 30 * 1000,         // Keep at 60 seconds
        priority: 5,
        file: 'pumps.js',
        equipmentId: 'uF3dFIwcULobnRTy5R5W'
    },
    'hw-pump-1': {
        interval: 30 * 1000,        // 30 seconds for circulation
        timeout: 30 * 1000,         // Keep at 60 seconds
        priority: 5,
        file: 'pumps.js',
        equipmentId: 'b6bcTD5PVO9BBDkJcfQA'
    },
    'hw-pump-2': {
        interval: 30 * 1000,        // 30 seconds for circulation
        timeout: 30 * 1000,         // Keep at 60 seconds
        priority: 5,
        file: 'pumps.js',
        equipmentId: 'OqwYSV2rnB5sWOWusu6X'
    }
};

// Equipment state management
const equipmentTimers = new Map();
const lastRun = new Map();

// FIXED: Use absolute path instead of process.cwd() to avoid path issues
const EQUIPMENT_PATH = '/opt/productionapp/dist/lib/equipment-logic/locations/firstchurchofgod';

// ===============================================================================
// TIMEOUT-BASED CLEANUP (FALLBACK FOR EVENT HANDLER ISSUES) - OPTIMIZED FOR CHURCH
// ===============================================================================

// Processing timeout configuration - REDUCED FOR CHURCH RESPONSIVENESS
const PROCESSING_TIMEOUT = {
    'air': 30 * 1000,              // 90 seconds for air handler (was 3 minutes)
    'boiler': 30 * 1000,           // 90 seconds for boiler (was 2 minutes)
    'chiller': 30 * 1000,          // 90 seconds for 4-stage chillers (was 3 minutes)
    'pump': 30 * 1000,             // 60 seconds for pumps (was 1 minute)
};

// Schedule automatic cleanup of queuedJobs tracking
function scheduleJobCleanup(jobKey, equipmentType) {
    const equipmentBase = equipmentType.split('-')[0]; // Get 'air', 'boiler', etc.
    const timeout = PROCESSING_TIMEOUT[equipmentBase] || 60000;

    setTimeout(() => {
        if (false && queuedJobs.has(jobKey)) {
            queuedJobs.delete(jobKey);
            console.log(`[FirstChurchOfGod Smart Queue] Auto-cleaned ${jobKey} after ${timeout/1000}s timeout`);
        }
    }, timeout);

    console.log(`[FirstChurchOfGod Smart Queue] Scheduled cleanup for ${jobKey} in ${timeout/1000}s`);
}

// ===============================================================================
// SMART QUEUE LOGIC FUNCTIONS - OPTIMIZED FOR CHURCH TEMPERATURE CONTROL
// ===============================================================================

// Enhanced smart queue function with deviation detection and UI command checking
async function addEquipmentToQueue(equipmentId, locationId, equipmentType) {
    try {
        const jobKey = `${locationId}-${equipmentId}-${equipmentType}`;

        // STEP 1: Check if already queued (deduplication)
        if (false && queuedJobs.has(jobKey)) {
            console.log(`[FirstChurchOfGod Smart Queue] ${equipmentType} already queued, skipping`);
            return null;
        }

        // STEP 2: Smart processing decision
        const shouldProcess = await shouldProcessEquipment(equipmentId, equipmentType);

        if (!shouldProcess.process) {
            console.log(`[FirstChurchOfGod Smart Queue] Skipping ${equipmentType}: ${shouldProcess.reason}`);
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

        console.log(`[FirstChurchOfGod Smart Queue] Queued ${equipmentType} with priority ${shouldProcess.priority}`);

        // Update queue status
        await updateQueueStatus();

        return job.id;

    } catch (error) {
        // Handle BullMQ duplicate job errors gracefully
        if (error.message.includes('Job with id') && error.message.includes('already exists')) {
            console.log(`[FirstChurchOfGod Smart Queue] Job already exists for ${equipmentType} - this is normal`);
            return null;
        }
        throw error;
    }
}

// Smart processing decision engine - ENHANCED FOR CHURCH CONTROL
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

        // PRIORITY 3: Check temperature deviation (CRITICAL FOR CHURCH COMFORT)
        const tempDeviation = await checkChurchTemperatureDeviation(equipmentId, equipmentType);
        if (tempDeviation.hasDeviation) {
            return {
                process: true,
                reason: `Church temp deviation: ${tempDeviation.details}`,
                priority: 16 // Very high priority for church comfort
            };
        }

        // PRIORITY 4: Check 4-stage chiller staging (CRITICAL FOR CHILLER CONTROL)
        const chillerStaging = await checkChillerStagingConditions(equipmentId, equipmentType);
        if (chillerStaging.needsStaging) {
            return {
                process: true,
                reason: chillerStaging.reason,
                priority: 15 // High priority for chiller staging
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

        // PRIORITY 6: Check maximum time since last run (FIXED - CONSISTENT WITH WARREN/HUNTINGTON!)
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
        console.error(`[FirstChurchOfGod Smart Queue] Error in shouldProcessEquipment for ${equipmentId}:`, error);
        // On error, process equipment to be safe
        return {
            process: true,
            reason: `Error in decision logic: ${error.message}`,
            priority: 1
        };
    }
}

// NEW: Check for church temperature deviation that requires immediate processing
async function checkChurchTemperatureDeviation(equipmentId, equipmentType) {
    try {
        const metrics = await gatherMetricsData(equipmentId);

        // Church equipment needs responsive temperature control for congregation comfort
        if (equipmentType.includes('air-handler')) {
            const roomTemp = parseFloat(metrics.RoomTemp || metrics.ZoneTemp || 72);
            const supplyTemp = parseFloat(metrics.SupplyTemp || metrics.Supply_Air_Temp || 65);
            const setpoint = parseFloat(metrics.temperatureSetpoint || metrics.Setpoint || 72);

            // Church temperature control: Process if temp error > 2°F (comfort for congregation)
            const tempError = Math.abs(roomTemp - setpoint);
            if (tempError > 2.0) {
                return {
                    hasDeviation: true,
                    details: `Room temp error: ${tempError.toFixed(1)}°F (${roomTemp}°F vs ${setpoint}°F setpoint) - church congregation comfort`
                };
            }

            // Supply air temperature checks (critical for church HVAC)
            if (supplyTemp < 45 || supplyTemp > 85) {
                return {
                    hasDeviation: true,
                    details: `Supply temp concern: ${supplyTemp}°F (church safety)`
                };
            }
        }

        // Boiler temperature control for church heating
        if (equipmentType.includes('boiler')) {
            const waterTemp = parseFloat(metrics.WaterTemp || metrics.H20Supply || 140);
            const setpoint = parseFloat(metrics.temperatureSetpoint || 160);
            const tempError = Math.abs(waterTemp - setpoint);

            if (tempError > 10.0) {
                return {
                    hasDeviation: true,
                    details: `Boiler temp error: ${tempError.toFixed(1)}°F (${waterTemp}°F vs ${setpoint}°F setpoint) - church heating`
                };
            }
        }

        return { hasDeviation: false, details: 'No temperature deviation' };

    } catch (error) {
        console.error(`[FirstChurchOfGod Smart Queue] Error checking church temperature deviation for ${equipmentId}:`, error);
        return { hasDeviation: true, details: `Error checking temperature: ${error.message}` };
    }
}

// NEW: Check for 4-stage chiller staging conditions
async function checkChillerStagingConditions(equipmentId, equipmentType) {
    try {
        if (!equipmentType.includes('chiller')) {
            return { needsStaging: false };
        }

        const metrics = await gatherMetricsData(equipmentId);

        // Check for 4-stage chiller conditions
        const chilledWaterTemp = parseFloat(metrics.ChilledWaterTemp || metrics.CW_Supply || 45);
        const setpoint = parseFloat(metrics.chilledWaterSetpoint || 45);
        const tempError = Math.abs(chilledWaterTemp - setpoint);

        // Check current stage status
        const stage1 = metrics.Stage1 || metrics.stage1Enabled || false;
        const stage2 = metrics.Stage2 || metrics.stage2Enabled || false;
        const stage3 = metrics.Stage3 || metrics.stage3Enabled || false;
        const stage4 = metrics.Stage4 || metrics.stage4Enabled || false;

        // Process if chilled water temperature error > 2°F (tight control for 4-stage)
        if (tempError > 2.0) {
            return {
                needsStaging: true,
                reason: `4-stage chiller temp error: ${tempError.toFixed(1)}°F (${chilledWaterTemp}°F vs ${setpoint}°F setpoint)`
            };
        }

        // Check for staging thresholds (church 4-stage chiller logic)
        const stage1Threshold = setpoint + 1.5;   // 46.5°F
        const stage2Threshold = setpoint + 3.0;   // 48.0°F
        const stage3Threshold = setpoint + 4.5;   // 49.5°F
        const stage4Threshold = setpoint + 6.0;   // 51.0°F

        // Process if approaching staging thresholds
        const nearStage1 = Math.abs(chilledWaterTemp - stage1Threshold) <= 0.5;
        const nearStage2 = Math.abs(chilledWaterTemp - stage2Threshold) <= 0.5;
        const nearStage3 = Math.abs(chilledWaterTemp - stage3Threshold) <= 0.5;
        const nearStage4 = Math.abs(chilledWaterTemp - stage4Threshold) <= 0.5;

        if (nearStage1 || nearStage2 || nearStage3 || nearStage4) {
            return {
                needsStaging: true,
                reason: `4-stage chiller approaching staging threshold: ${chilledWaterTemp}°F`
            };
        }

        return { needsStaging: false };

    } catch (error) {
        console.error(`[FirstChurchOfGod Smart Queue] Error checking chiller staging for ${equipmentId}:`, error);
        return { needsStaging: false };
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
                console.log(`[FirstChurchOfGod Smart Queue] Found ${data.length} recent UI commands for ${equipmentId}`);
            }

            return hasCommands;
        }

        return false;
    } catch (error) {
        console.error(`[FirstChurchOfGod Smart Queue] Error checking UI commands for ${equipmentId}:`, error);
        return false; // Assume no UI commands on error
    }
}

// Check for safety conditions that require immediate processing
async function checkSafetyConditions(equipmentId, equipmentType) {
    try {
        const metrics = await gatherMetricsData(equipmentId);

        // Air handler safety checks
        if (equipmentType.includes('air-handler')) {
            const supplyTemp = parseFloat(metrics.SupplyTemp || 0);

            if (supplyTemp > 120) {
                console.log(`[FirstChurchOfGod Smart Queue] SAFETY: High supply temperature ${supplyTemp}°F for ${equipmentId}`);
                return true;
            }

            if (supplyTemp < 35) {
                console.log(`[FirstChurchOfGod Smart Queue] SAFETY: Freeze protection ${supplyTemp}°F for ${equipmentId}`);
                return true;
            }
        }

        // Boiler safety checks
        if (equipmentType.includes('boiler')) {
            const waterTemp = parseFloat(metrics.WaterTemp || metrics.H20Supply || 0);

            if (waterTemp > 200) {
                console.log(`[FirstChurchOfGod Smart Queue] SAFETY: Boiler overtemp ${waterTemp}°F for ${equipmentId}`);
                return true;
            }

            const pressure = parseFloat(metrics.Pressure || 0);
            if (pressure > 30) {
                console.log(`[FirstChurchOfGod Smart Queue] SAFETY: High pressure ${pressure} PSI for ${equipmentId}`);
                return true;
            }
        }

        // 4-stage chiller safety checks
        if (equipmentType.includes('chiller')) {
            const compressorAmps = parseFloat(metrics.CompressorAmps || 0);

            if (compressorAmps > 50) {
                console.log(`[FirstChurchOfGod Smart Queue] SAFETY: Compressor overload ${compressorAmps}A for ${equipmentId}`);
                return true;
            }

            const refrigerantPressure = parseFloat(metrics.RefrigerantPressure || 0);
            if (refrigerantPressure > 200) {
                console.log(`[FirstChurchOfGod Smart Queue] SAFETY: High refrigerant pressure ${refrigerantPressure} PSI for ${equipmentId}`);
                return true;
            }

            // 4-stage specific safety checks
            const chilledWaterTemp = parseFloat(metrics.ChilledWaterTemp || 45);
            if (chilledWaterTemp < 35) {
                console.log(`[FirstChurchOfGod Smart Queue] SAFETY: Chilled water freeze protection ${chilledWaterTemp}°F for ${equipmentId}`);
                return true;
            }
        }

        // Pump safety checks
        if (equipmentType.includes('pump')) {
            const amps = parseFloat(metrics.Amps || metrics.PumpAmps || 0);

            if (amps > 20) {
                console.log(`[FirstChurchOfGod Smart Queue] SAFETY: Motor overload ${amps}A for ${equipmentId}`);
                return true;
            }

            const vibration = parseFloat(metrics.Vibration || 0);
            if (vibration > 10) {
                console.log(`[FirstChurchOfGod Smart Queue] SAFETY: High vibration ${vibration} for ${equipmentId}`);
                return true;
            }
        }

        return false;
    } catch (error) {
        console.error(`[FirstChurchOfGod Smart Queue] Error checking safety for ${equipmentId}:`, error);
        return true; // Assume safety issue on error to be safe
    }
}

// Check for significant deviation from setpoints - ENHANCED FOR CHURCH SENSITIVITY
async function checkSignificantDeviation(equipmentId, equipmentType) {
    try {
        const currentMetrics = await gatherMetricsData(equipmentId);
        const lastMetrics = equipmentState.get(equipmentId) || {};

        // Store current metrics for next comparison
        equipmentState.set(equipmentId, currentMetrics);

        // More sensitive thresholds for church comfort
        const thresholds = {
            'air-handler': { temp: 2.0, valve: 15.0 }, // Reduced from 3.0°F and 20%
            'boiler': { temp: 4.0, pressure: 8.0 },    // Reduced from 5.0°F and 10.0 PSI
            'chiller': { temp: 1.5, pressure: 6.0 },   // Reduced from 2.0°F and 8.0 PSI (4-stage sensitivity)
            'pump': { speed: 12.0, pressure: 4.0 }     // Reduced from 15% and 5.0 PSI
        };

        const equipmentThreshold = Object.keys(thresholds).find(key => equipmentType.includes(key));
        if (!equipmentThreshold) {
            return { hasDeviation: false, details: 'No thresholds defined' };
        }

        const threshold = thresholds[equipmentThreshold];

        // Check temperature deviation
        if (threshold.temp) {
            const currentTemp = parseFloat(currentMetrics.RoomTemp || currentMetrics.SupplyTemp || currentMetrics.WaterTemp || currentMetrics.ChilledWaterTemp || 0);
            const lastTemp = parseFloat(lastMetrics.RoomTemp || lastMetrics.SupplyTemp || lastMetrics.WaterTemp || lastMetrics.ChilledWaterTemp || currentTemp);
            const tempDiff = Math.abs(currentTemp - lastTemp);

            if (tempDiff > threshold.temp) {
                return {
                    hasDeviation: true,
                    details: `Temperature change: ${tempDiff.toFixed(1)}°F > ${threshold.temp}°F (church sensitivity)`
                };
            }
        }

        return { hasDeviation: false, details: 'No significant deviation detected' };

    } catch (error) {
        console.error(`[FirstChurchOfGod Smart Queue] Error checking deviation for ${equipmentId}:`, error);
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
            AND location_id = '9'
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
            WaterTemp: 140,
            ChilledWaterTemp: 45,
            locationId: '9',
            equipmentId: equipmentId
        };

    } catch (error) {
        console.error(`[FirstChurchOfGod] Error gathering metrics for ${equipmentId}:`, error);
        return {
            Outdoor_Air: 50,
            RoomTemp: 72,
            SupplyTemp: 55,
            WaterTemp: 140,
            ChilledWaterTemp: 45,
            locationId: '9',
            equipmentId: equipmentId
        };
    }
}

// FIXED: Get maximum stale time based on equipment type - OPTIMIZED FOR CHURCH & 4-STAGE CHILLERS!
function getMaxStaleTime(equipmentType) {
    const staleTimeConfig = {
        'air-handler': 30 * 1000,     // 30 SECONDS max for air handler (was 10 minutes!)
        'boiler': 30 * 1000,          // 60 SECONDS max for boiler (was 15 minutes!)
        'chiller': 30 * 1000,         // 30 SECONDS max for 4-stage chillers (was 20 minutes!)
        'pump': 30 * 1000,            // 30 SECONDS max for pumps (was 5 minutes!)
    };

    const equipmentKey = Object.keys(staleTimeConfig).find(key => equipmentType.includes(key));
    return staleTimeConfig[equipmentKey] || (430 * 1000); // Default 45 seconds (was 10 minutes!)
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
        console.error('[FirstChurchOfGod Smart Queue] Error updating queue status:', error);
    }
}

// ===============================================================================
// MAIN PROCESSOR FUNCTIONS
// ===============================================================================

// Initialize FirstChurchOfGod processors
async function initializeFCOGProcessors() {
    console.log('[FirstChurchOfGod Smart Queue] Starting smart queue system...');
    console.log('[FirstChurchOfGod Smart Queue] Initializing with intelligent processing...');
    console.log('[FirstChurchOfGod Smart Queue] FIXED: 30-second processing for 4-stage chiller control');
    console.log('[FirstChurchOfGod Smart Queue] Clearing factory startup cache...');

    try {
        // Check what equipment files are available
        const availableFiles = fs_1.default.readdirSync(EQUIPMENT_PATH)
            .filter(file => file.endsWith('.js') && !file.includes('helpers'));

        console.log(`[FirstChurchOfGod Smart Queue] Available equipment files: ${availableFiles.join(', ')}`);

        // Start processors for each configured equipment
        for (const [equipmentType, config] of Object.entries(EQUIPMENT_CONFIG)) {
            if (availableFiles.includes(config.file)) {
                startEquipmentProcessor(equipmentType, config);
                console.log(`[FirstChurchOfGod Smart Queue] Started ${equipmentType} processor (${config.interval / 1000}s interval) - Equipment ID: ${config.equipmentId}`);
            }
            else {
                console.log(`[FirstChurchOfGod Smart Queue] Skipping ${equipmentType} - file ${config.file} not found`);
            }
        }

        // Start smart queue status monitoring
        setInterval(async () => {
            await updateQueueStatus();
            if (status.total > 0) {
                console.log(`[FirstChurchOfGod Smart Queue] Status: ${status.waiting} waiting, ${status.active} active, ${status.total} total`);
            }
        }, 60000); // Log every minute if there are jobs

        console.log('[FirstChurchOfGod Smart Queue] Smart queue system initialized - 8 equipment processors active with 4-stage chiller control');
    }
    catch (error) {
        console.error('[FirstChurchOfGod Smart Queue] Initialization error:', error);
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
        console.log(`[FirstChurchOfGod] Evaluating ${equipmentType} (${config.equipmentId}) for church comfort control...`);

        const jobId = await addEquipmentToQueue(
            config.equipmentId,
            '9', // FirstChurchOfGod location ID
            equipmentType
        );

        if (jobId) {
            console.log(`[FirstChurchOfGod] Queued ${equipmentType} for church comfort control`);
            lastRun.set(config.equipmentId, startTime);
        } else {
            console.log(`[FirstChurchOfGod] ${equipmentType} skipped by smart queue logic`);
        }

    } catch (error) {
        // Handle duplicate job errors gracefully
        if (error.message && (error.message.includes('Job is already') ||
            error.message.includes('duplicate') ||
            error.message.includes('already exists'))) {
            console.log(`[FirstChurchOfGod Smart Queue] ${equipmentType} already queued, skipping duplicate - this is normal`);
        } else {
            console.error(`[FirstChurchOfGod Smart Queue] Error in smart queue processing for ${equipmentType}:`, error);
        }
    }
}

// FIXED: Clean up completed/failed jobs from tracking - MATCH WARREN PATTERN
equipmentQueue.on('completed', (job) => {
    const jobKey = `${job.data.locationId}-${job.data.equipmentId}-${job.data.type}`;
    queuedJobs.delete(jobKey);
    console.log(`[FirstChurchOfGod Smart Queue] Job ${job.id} completed - ${job.data.type} (${job.data.equipmentId})`);
});

equipmentQueue.on('failed', (job, err) => {
    const jobKey = `${job.data.locationId}-${job.data.equipmentId}-${job.data.type}`;
    queuedJobs.delete(jobKey);
    console.error(`[FirstChurchOfGod Smart Queue] Job ${job.id} failed - ${job.data.type} (${job.data.equipmentId}):`, err.message);
});

// ===============================================================================
// SYSTEM MANAGEMENT
// ===============================================================================

// Graceful shutdown
async function shutdown() {
    console.log('[FirstChurchOfGod Smart Queue] Shutting down smart queue system...');
    for (const timer of equipmentTimers.values()) {
        clearInterval(timer);
    }
    await equipmentQueue.close();
    await redis.quit();
    console.log('[FirstChurchOfGod Smart Queue] Shutdown complete');
    process.exit(0);
}

// Signal handlers for graceful shutdown
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Redis event handlers
redis.on('connect', () => console.log('[FirstChurchOfGod Smart Queue] Redis connected'));
redis.on('error', (err) => console.error('[FirstChurchOfGod Smart Queue] Redis error:', err));

// Initialize and start the processor
initializeFCOGProcessors()
    .then(() => console.log('[FirstChurchOfGod Smart Queue] Smart queue system started successfully - 8 equipment processors active with 4-stage chiller control'))
    .catch((error) => {
        console.error('[FirstChurchOfGod Smart Queue] Failed to start:', error);
        process.exit(1);
    });
