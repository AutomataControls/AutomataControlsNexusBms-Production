"use strict";
// ===============================================================================
// Warren Location Processor (Heritage Pointe of Warren)
// ===============================================================================
//
// PURPOSE:
// Independent equipment processor for Warren location (location_id=1).
// Manages HVAC equipment control logic with proper 4-parameter interface.
// HYBRID TIMER + QUEUE SYSTEM for optimal performance with SMART QUEUE LOGIC.
//
// EQUIPMENT MANAGED:
// - 4x Air Handlers - 30s intervals (optimized for temperature control)
//   • Air Handler 1: 2JFzwQkC1XwJhUvm09rE
//   • Air Handler 2: upkoHEsD5zVaiLFhGfs5
//   • Air Handler 4: 3zJm0Nkl1c7EiANkQOay
//   • Air Handler 7: BeZOBmanKJ8iYJESMIYr
// - 9x Fan Coils (1,2,3,4,5,6,8,10,11) - 30s intervals
//   • Fan Coil 1: 2EQESAvOpM6pA0rUFFmq
//   • Fan Coil 2: HRvqbeF7wBKgCXoHpage
//   • Fan Coil 3: l6SuQ5ECib9TGpfqukTd
//   • Fan Coil 4: bZJpvcJU4sb9faUPaq3X
//   • Fan Coil 5: BK7qKclTgmQTuNRSOEDS
//   • Fan Coil 6: 3SypccBnjrnHqcguXZ9k
//   • Fan Coil 8: qLLLHHjDDLNvQd9AqD8u
//   • Fan Coil 10: Jwv0TBurMi7Y09HQnwmY
//   • Fan Coil 11: NSVXgX8mzcmPP58RJ2ui
// - 2x HW Pumps - 30s intervals
//   • HW Pump 1: cZmHxji6UMnseaEY8SRb
//   • HW Pump 2: t6Ajqe0TYIlXz9LC7gBF
// - 1x Steam Bundle - 20s intervals
//   • Steam Bundle: pQeFoogngCqEZUI6YRCT
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
// - Maximum Stale Time Prevention
// - Timeout-based Cleanup (FIXED)
//
// ===============================================================================

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const ioredis_1 = __importDefault(require("ioredis"));
const influxdb_client_1 = require("../../influxdb-client");

// SMART QUEUE: Add BullMQ for intelligent queue management
const { Queue } = require('bullmq');

// Redis connection for BullMQ job management
const redis = new ioredis_1.default({
    host: 'localhost',
    port: 6379,
    maxRetriesPerRequest: null,
});

// BullMQ Queue instance with smart defaults
const equipmentQueue = new Queue('equipment-logic-1', {
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

// Warren equipment configuration - ALL EQUIPMENT WITH REAL IDs INCLUDING ALL 4 AIR HANDLERS
// FIXED INTERVALS: All equipment optimized for proper temperature control
const EQUIPMENT_CONFIG = {
    'air-handler-1': {
        interval: 30 * 1000, // 30 seconds for temperature control
        file: 'air-handler.js',
        equipmentId: '2JFzwQkC1XwJhUvm09rE'
    },
    'air-handler-2': {
        interval: 30 * 1000, // 30 seconds for temperature control
        file: 'air-handler.js',
        equipmentId: 'upkoHEsD5zVaiLFhGfs5'
    },
    'air-handler-4': {
        interval: 30 * 1000, // 30 seconds for temperature control
        file: 'air-handler.js',
        equipmentId: '3zJm0Nkl1c7EiANkQOay'
    },
    'air-handler-7': {
        interval: 30 * 1000, // 30 seconds for temperature control
        file: 'air-handler.js',
        equipmentId: 'BeZOBmanKJ8iYJESMIYr'
    },
    'fan-coil-1': {
        interval: 30 * 1000, // 30 seconds for zone control
        file: 'fan-coil.js',
        equipmentId: '2EQESAvOpM6pA0rUFFmq'
    },
    'fan-coil-2': {
        interval: 30 * 1000, // 30 seconds for zone control
        file: 'fan-coil.js',
        equipmentId: 'HRvqbeF7wBKgCXoHpage'
    },
    'fan-coil-3': {
        interval: 30 * 1000, // 30 seconds for zone control
        file: 'fan-coil.js',
        equipmentId: 'l6SuQ5ECib9TGpfqukTd'
    },
    'fan-coil-4': {
        interval: 30 * 1000, // 30 seconds for zone control
        file: 'fan-coil.js',
        equipmentId: 'bZJpvcJU4sb9faUPaq3X'
    },
    'fan-coil-5': {
        interval: 30 * 1000, // 30 seconds for zone control
        file: 'fan-coil.js',
        equipmentId: 'BK7qKclTgmQTuNRSOEDS'
    },
    'fan-coil-6': {
        interval: 30 * 1000, // 30 seconds for zone control
        file: 'fan-coil.js',
        equipmentId: '3SypccBnjrnHqcguXZ9k'
    },
    'fan-coil-8': {
        interval: 30 * 1000, // 30 seconds for zone control
        file: 'fan-coil.js',
        equipmentId: 'qLLLHHjDDLNvQd9AqD8u'
    },
    'fan-coil-10': {
        interval: 30 * 1000, // 30 seconds for zone control
        file: 'fan-coil.js',
        equipmentId: 'Jwv0TBurMi7Y09HQnwmY'
    },
    'fan-coil-11': {
        interval: 30 * 1000, // 30 seconds for zone control
        file: 'fan-coil.js',
        equipmentId: 'NSVXgX8mzcmPP58RJ2ui'
    },
    'hw-pump-1': {
        interval: 30 * 1000, // 30 seconds for circulation control
        file: 'pumps.js',
        equipmentId: 'cZmHxji6UMnseaEY8SRb'
    },
    'hw-pump-2': {
        interval: 30 * 1000, // 30 seconds for circulation control
        file: 'pumps.js',
        equipmentId: 't6Ajqe0TYIlXz9LC7gBF'
    },
    'steam-bundle': {
        interval: 20 * 1000, // 20 seconds for heating control (per your request)
        file: 'steam-bundle.js',
        equipmentId: 'pQeFoogngCqEZUI6YRCT'
    }
};

// Equipment state management
const equipmentTimers = new Map();
const lastRun = new Map();

// FIXED: Use absolute path instead of process.cwd() to avoid path issues
const EQUIPMENT_PATH = '/opt/productionapp/dist/lib/equipment-logic/locations/warren';

// ===============================================================================
// TIMEOUT-BASED CLEANUP (FALLBACK FOR EVENT HANDLER ISSUES)
// ===============================================================================

// Processing timeout configuration based on equipment complexity
const PROCESSING_TIMEOUT = {
    'air': 60000,          // 60 seconds for air handlers (simplified from 180s)
    'fan': 45000,          // 45 seconds for fan coils (simplified from 60s)
    'pump': 60000,         // 60 seconds for pumps
    'steam': 45000         // 45 seconds for steam bundle (simplified from 120s)
};

// Schedule automatic cleanup of queuedJobs tracking
function scheduleJobCleanup(jobKey, equipmentType) {
    const equipmentBase = equipmentType.split('-')[0]; // Get 'air', 'fan', 'pump', 'steam'
    const timeout = PROCESSING_TIMEOUT[equipmentBase] || 60000;

    setTimeout(() => {
        if (queuedJobs.has(jobKey)) {
            queuedJobs.delete(jobKey);
            console.log(`[Warren Smart Queue] Auto-cleaned ${jobKey} after ${timeout/1000}s timeout`);
        }
    }, timeout);

    console.log(`[Warren Smart Queue] Scheduled cleanup for ${jobKey} in ${timeout/1000}s`);
}

// ===============================================================================
// SMART QUEUE LOGIC FUNCTIONS - FIXED FOR TEMPERATURE CONTROL
// ===============================================================================

// Enhanced smart queue function with deviation detection and UI command checking
async function addEquipmentToQueue(equipmentId, locationId, equipmentType) {
    try {
        const jobKey = `${locationId}-${equipmentId}-${equipmentType}`;

        // STEP 1: Check if already queued (deduplication)
        if (queuedJobs.has(jobKey)) {
            console.log(`[Warren Smart Queue] ${equipmentType} (${equipmentId}) already queued, skipping`);
            return null;
        }

        // STEP 2: Smart processing decision
        const shouldProcess = await shouldProcessEquipment(equipmentId, equipmentType);

        if (!shouldProcess.process) {
            console.log(`[Warren Smart Queue] Skipping ${equipmentType} (${equipmentId}): ${shouldProcess.reason}`);
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

        console.log(`[Warren Smart Queue] Queued ${equipmentType} (${equipmentId}) - Reason: ${shouldProcess.reason}, Priority: ${shouldProcess.priority}`);

        // Update queue status
        await updateQueueStatus();

        return job.id;

    } catch (error) {
        // Handle BullMQ duplicate job errors gracefully
        if (error.message.includes('Job with id') && error.message.includes('already exists')) {
            console.log(`[Warren Smart Queue] Job already exists for ${equipmentType} (${equipmentId}) - this is normal`);
            return null;
        }
        throw error;
    }
}

// Smart processing decision engine - FIXED FOR TEMPERATURE CONTROL
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

        // PRIORITY 3: Check for temperature deviation (CRITICAL FOR TEMPERATURE CONTROL)
        const tempDeviation = await checkTemperatureDeviation(equipmentId, equipmentType);
        if (tempDeviation.hasDeviation) {
            return {
                process: true,
                reason: `Temperature deviation: ${tempDeviation.details}`,
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

        // PRIORITY 5: Check maximum time since last run (FIXED - MUCH SHORTER FOR TEMPERATURE CONTROL)
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
        console.error(`[Warren Smart Queue] Error in shouldProcessEquipment for ${equipmentId}:`, error);
        // On error, process equipment to be safe
        return {
            process: true,
            reason: `Error in decision logic: ${error.message}`,
            priority: 1
        };
    }
}

// NEW: Check for temperature deviation that requires immediate processing
async function checkTemperatureDeviation(equipmentId, equipmentType) {
    try {
        const metrics = await gatherMetricsData(equipmentId);

        // Temperature control equipment needs immediate processing for deviations
        if (equipmentType.includes('fan-coil') || equipmentType.includes('air-handler')) {
            const currentTemp = parseFloat(metrics.RoomTemp || metrics.SupplyTemp || metrics.ZoneTemp || 72);
            const setpoint = parseFloat(metrics.temperatureSetpoint || metrics.Setpoint || 72);
            const tempError = Math.abs(currentTemp - setpoint);

            // Fan coils: Process if temp error > 2°F (tight control for comfort)
            if (equipmentType.includes('fan-coil') && tempError > 2.0) {
                return {
                    hasDeviation: true,
                    details: `Fan coil temp error: ${tempError.toFixed(1)}°F (${currentTemp}°F vs ${setpoint}°F setpoint)`
                };
            }

            // Air handlers: Process if temp error > 3°F
            if (equipmentType.includes('air-handler') && tempError > 3.0) {
                return {
                    hasDeviation: true,
                    details: `Air handler temp error: ${tempError.toFixed(1)}°F (${currentTemp}°F vs ${setpoint}°F setpoint)`
                };
            }

            // Check for extreme temperatures that need immediate attention
            if (currentTemp < 60 || currentTemp > 85) {
                return {
                    hasDeviation: true,
                    details: `Extreme temperature: ${currentTemp}°F (safety concern)`
                };
            }
        }

        // Steam bundle temperature control
        if (equipmentType.includes('steam')) {
            const currentTemp = parseFloat(metrics.SupplyTemp || metrics.SteamTemp || 72);
            const setpoint = parseFloat(metrics.temperatureSetpoint || 180);
            const tempError = Math.abs(currentTemp - setpoint);

            if (tempError > 5.0) {
                return {
                    hasDeviation: true,
                    details: `Steam temp error: ${tempError.toFixed(1)}°F (${currentTemp}°F vs ${setpoint}°F setpoint)`
                };
            }
        }

        return { hasDeviation: false, details: 'No temperature deviation' };

    } catch (error) {
        console.error(`[Warren Smart Queue] Error checking temperature deviation for ${equipmentId}:`, error);
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

        // FIXED: Use same database as Huntington
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
                console.log(`[Warren Smart Queue] Found ${data.length} recent UI commands for ${equipmentId}`);
            }

            return hasCommands;
        }

        return false;
    } catch (error) {
        console.error(`[Warren Smart Queue] Error checking UI commands for ${equipmentId}:`, error);
        return false; // Assume no UI commands on error
    }
}

// Check for safety conditions that require immediate processing
async function checkSafetyConditions(equipmentId, equipmentType) {
    try {
        const metrics = await gatherMetricsData(equipmentId);

        // Air Handler safety checks
        if (equipmentType.includes('air-handler')) {
            const supplyTemp = parseFloat(metrics.SupplyTemp || metrics.supplyTemp || 0);
            if (supplyTemp > 85) { // High supply air temperature
                console.log(`[Warren Smart Queue] SAFETY: High supply temperature ${supplyTemp}°F for ${equipmentId}`);
                return true;
            }

            const outdoorDamper = parseFloat(metrics.OutdoorDamper || metrics.outdoorDamper || 0);
            if (outdoorDamper > 95) { // Damper stuck open in winter
                const outdoor = parseFloat(metrics.Outdoor_Air || 32);
                if (outdoor < 32) {
                    console.log(`[Warren Smart Queue] SAFETY: Outdoor damper ${outdoorDamper}% open with ${outdoor}°F outdoor for ${equipmentId}`);
                    return true;
                }
            }

            const freezestat = metrics.Freezestat || metrics.freezestat;
            if (freezestat === true || freezestat === 'true' || freezestat === 1) {
                console.log(`[Warren Smart Queue] SAFETY: Freezestat condition for ${equipmentId}`);
                return true;
            }
        }

        // Steam Bundle safety checks
        if (equipmentType.includes('steam')) {
            const steamPressure = parseFloat(metrics.SteamPressure || metrics.steamPressure || 0);
            if (steamPressure > 15) { // High steam pressure
                console.log(`[Warren Smart Queue] SAFETY: High steam pressure ${steamPressure} psi for ${equipmentId}`);
                return true;
            }
        }

        // Pump safety checks
        if (equipmentType.includes('pump')) {
            const pumpVibration = parseFloat(metrics.Vibration || metrics.vibration || 0);
            if (pumpVibration > 5) { // High vibration
                console.log(`[Warren Smart Queue] SAFETY: High pump vibration ${pumpVibration} for ${equipmentId}`);
                return true;
            }
        }

        return false;
    } catch (error) {
        console.error(`[Warren Smart Queue] Error checking safety for ${equipmentId}:`, error);
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
            'air-handler': { temp: 3.0, damper: 20.0, valve: 15.0 },
            'fan-coil': { temp: 2.0, valve: 20.0, speed: 15.0 },
            'pump': { speed: 15.0, pressure: 5.0 },
            'steam': { temp: 5.0, valve: 25.0 }
        };

        const equipmentThreshold = Object.keys(thresholds).find(key => equipmentType.includes(key));
        if (!equipmentThreshold) {
            return { hasDeviation: false, details: 'No thresholds defined' };
        }

        const threshold = thresholds[equipmentThreshold];

        // Check temperature deviation
        if (threshold.temp) {
            const currentTemp = parseFloat(currentMetrics.RoomTemp || currentMetrics.SupplyTemp || currentMetrics.ZoneTemp || 0);
            const lastTemp = parseFloat(lastMetrics.RoomTemp || lastMetrics.SupplyTemp || lastMetrics.ZoneTemp || currentTemp);
            const tempDiff = Math.abs(currentTemp - lastTemp);

            if (tempDiff > threshold.temp) {
                return {
                    hasDeviation: true,
                    details: `Temperature change: ${tempDiff.toFixed(1)}°F > ${threshold.temp}°F`
                };
            }
        }

        // Check damper deviation (air handlers)
        if (threshold.damper && equipmentType.includes('air-handler')) {
            const currentDamper = parseFloat(currentMetrics.OutdoorDamper || currentMetrics.outdoorDamper || 0);
            const lastDamper = parseFloat(lastMetrics.OutdoorDamper || lastMetrics.outdoorDamper || currentDamper);
            const damperDiff = Math.abs(currentDamper - lastDamper);

            if (damperDiff > threshold.damper) {
                return {
                    hasDeviation: true,
                    details: `Damper change: ${damperDiff.toFixed(1)}% > ${threshold.damper}%`
                };
            }
        }

        // Check valve deviation
        if (threshold.valve) {
            const currentValve = parseFloat(currentMetrics.HeatingValve || currentMetrics.CoolingValve || currentMetrics.SteamValve || 0);
            const lastValve = parseFloat(lastMetrics.HeatingValve || lastMetrics.CoolingValve || lastMetrics.SteamValve || currentValve);
            const valveDiff = Math.abs(currentValve - lastValve);

            if (valveDiff > threshold.valve) {
                return {
                    hasDeviation: true,
                    details: `Valve change: ${valveDiff.toFixed(1)}% > ${threshold.valve}%`
                };
            }
        }

        return { hasDeviation: false, details: 'No significant deviation detected' };

    } catch (error) {
        console.error(`[Warren Smart Queue] Error checking deviation for ${equipmentId}:`, error);
        return { hasDeviation: true, details: `Error checking deviation: ${error.message}` };
    }
}

// Helper function to gather current metrics from InfluxDB for specific equipment
async function gatherMetricsData(equipmentId) {
    try {
        // FIXED: Use same database as Huntington
        const database = process.env.INFLUXDB_DATABASE || 'Locations';
        const influxUrl = process.env.INFLUXDB_URL || 'http://143.198.162.31:8181';

        // Query recent metrics for THIS specific equipment from the metrics table
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

                console.log(`[Warren] Gathered ${Object.keys(metricsObject).length} metrics for equipment ${equipmentId}`);
                return metricsObject;
            }
        }

        console.log(`[Warren] No recent metrics found for equipment ${equipmentId}, using defaults`);
        return {
            Outdoor_Air: 50,
            RoomTemp: 72,
            SupplyTemp: 55,
            locationId: '1',
            equipmentId: equipmentId
        };

    } catch (error) {
        console.error(`[Warren] Error gathering metrics for ${equipmentId}:`, error);
        return {
            Outdoor_Air: 50,
            RoomTemp: 72,
            SupplyTemp: 55,
            locationId: '1',
            equipmentId: equipmentId
        };
    }
}

// FIXED: Get maximum stale time based on equipment type - OPTIMIZED FOR TEMPERATURE CONTROL
function getMaxStaleTime(equipmentType) {
    const staleTimeConfig = {
        'air-handler': 45 * 1000,      // 45 SECONDS max for air handlers (was 15 minutes!)
        'fan-coil': 30 * 1000,         // 30 SECONDS max for fan coils (was 3 minutes!)
        'pump': 60 * 1000,             // 60 seconds max for pumps (was 5 minutes)
        'steam': 30 * 1000             // 30 SECONDS max for steam bundle (was 10 minutes!)
    };

    const equipmentKey = Object.keys(staleTimeConfig).find(key => equipmentType.includes(key));
    return staleTimeConfig[equipmentKey] || (45 * 1000); // Default 45 seconds (was 10 minutes!)
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
        console.error('[Warren Smart Queue] Error updating queue status:', error);
    }
}

// ===============================================================================
// MAIN PROCESSOR FUNCTIONS
// ===============================================================================

// Initialize Warren processors
async function initializeWarrenProcessors() {
    console.log('[Warren] Initializing equipment processors with SMART queue integration...');
    console.log(`[Warren] Equipment path: ${EQUIPMENT_PATH}`);

    try {
        // Check what equipment files are available
        const availableFiles = fs_1.default.readdirSync(EQUIPMENT_PATH)
            .filter(file => file.endsWith('.js') && !file.includes('helpers'));

        console.log(`[Warren] Available equipment files: ${availableFiles.join(', ')}`);

        // Start processors for each configured equipment
        for (const [equipmentType, config] of Object.entries(EQUIPMENT_CONFIG)) {
            if (availableFiles.includes(config.file)) {
                startEquipmentProcessor(equipmentType, config);
                console.log(`[Warren] Started ${equipmentType} processor (${config.interval / 1000}s interval) - Equipment ID: ${config.equipmentId}`);
            }
            else {
                console.log(`[Warren] Skipping ${equipmentType} - file ${config.file} not found`);
            }
        }

        // Start smart queue status monitoring
        setInterval(async () => {
            await updateQueueStatus();
            if (status.total > 0) {
                console.log(`[Warren Smart Queue] Status: ${status.waiting} waiting, ${status.active} active, ${status.total} total`);
            }
        }, 60000); // Log every minute if there are jobs

        console.log('[Warren] All equipment processors initialized with SMART queue integration');
    }
    catch (error) {
        console.error('[Warren] Initialization error:', error);
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
        console.log(`[Warren] Evaluating ${equipmentType} (${config.equipmentId}) for smart processing...`);

        // Add equipment to BullMQ queue with smart logic
        const jobId = await addEquipmentToQueue(
            config.equipmentId,
            '1', // Warren location ID
            equipmentType
        );

        if (jobId) {
            console.log(`[Warren] Queued ${equipmentType} with job ID ${jobId}`);
            lastRun.set(config.equipmentId, startTime);
        } else {
            console.log(`[Warren] ${equipmentType} skipped by smart queue logic`);
        }

    } catch (error) {
        // Handle duplicate job errors gracefully
        if (error.message && (error.message.includes('Job is already') ||
            error.message.includes('duplicate') ||
            error.message.includes('already exists'))) {
            console.log(`[Warren] ${equipmentType} already queued, skipping duplicate - this is normal`);
        } else {
            console.error(`[Warren] Error in smart queue processing for ${equipmentType}:`, error);
        }
    }
}

// Helper function to gather settings data using the real equipment ID from config
async function gatherSettingsData(fileName, config) {
    try {
        const equipmentId = config.equipmentId || `warren_${fileName.replace(/\.js$/, '')}_001`;

        const settingsInput = {
            equipmentId: equipmentId,
            locationId: '1', // Warren location ID
            locationName: 'warren',
            equipmentType: fileName.replace(/\.js$/, ''),
            enabled: true,
            // Add any equipment-specific settings here
            tempSetpoint: 72,
            heatingSetpoint: 70,
            coolingSetpoint: 74,
            fanMinSpeed: 20,
            fanMaxSpeed: 100,
            pumpMinSpeed: 20,
            pumpMaxSpeed: 100
        };

        console.log(`[Warren] Settings for ${fileName}: equipmentId=${equipmentId}`);
        return settingsInput;

    } catch (error) {
        console.error(`[Warren] Error gathering settings:`, error);
        return {
            equipmentId: 'unknown',
            locationId: '1',
            locationName: 'warren'
        };
    }
}

// Helper function to extract current temperature
function getCurrentTemperature(metricsInput, uiCommands) {
    // Try to get temperature from metrics first
    const tempSources = [
        'RoomTemp', 'Room_Temp', 'Room Temperature', 'ZoneTemp',
        'SupplyTemp', 'Supply_Temp', 'Supply Temperature',
        'ReturnTemp', 'Return_Temp', 'Return Temperature',
        'SpaceTemp', 'Space_Temp', 'currentTemp'
    ];

    for (const source of tempSources) {
        if (metricsInput[source] !== undefined && !isNaN(parseFloat(metricsInput[source]))) {
            const temp = parseFloat(metricsInput[source]);
            console.log(`[Warren] Using temperature from metrics.${source}: ${temp}°F`);
            return temp;
        }
    }

    // Try to get temperature from UI commands as fallback
    for (const command of uiCommands || []) {
        if (command.temperature !== undefined && !isNaN(parseFloat(command.temperature))) {
            const temp = parseFloat(command.temperature);
            console.log(`[Warren] Using temperature from UI commands: ${temp}°F`);
            return temp;
        }
    }

    console.log(`[Warren] No temperature found, using default: 72°F`);
    return 72; // Default temperature
}

// Helper function to gather state storage
async function gatherStateStorage() {
    try {
        // For now, return basic state storage
        // In a full implementation, this would read from Redis or another state store
        const stateStorage = {
            lastControlUpdate: Date.now(),
            pidIntegral: 0,
            pidDerivative: 0,
            lastError: 0,
            // Add other state variables as needed
        };

        return stateStorage;

    } catch (error) {
        console.error(`[Warren] Error gathering state storage:`, error);
        return {};
    }
}

// Write equipment results to InfluxDB
async function writeEquipmentResults(equipmentType, results) {
    try {
        // FIXED: Use same database as Huntington
        const database = process.env.INFLUXDB_DATABASE5 || 'NeuralControlCommands';
        const influxUrl = process.env.INFLUXDB_URL || 'http://143.198.162.31:8181';

        for (const result of results) {
            if (!result || typeof result !== 'object')
                continue;

            const actionableCommands = extractActionableCommands(result);
            if (Object.keys(actionableCommands).length === 0)
                continue;

            const tags = {
                locationName: 'warren',
                equipmentType,
                equipmentId: result.equipmentId || 'unknown',
                source: 'warren-processor'
            };

            const fields = {
                timestamp: Date.now(),
                ...actionableCommands
            };

            const lineProtocol = (0, influxdb_client_1.formatLineProtocol)('NeuralControlCommands', tags, fields);
            const response = await fetch(`${influxUrl}/api/v3/write_lp?db=${database}&precision=nanosecond`, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: lineProtocol
            });

            if (!response.ok) {
                console.error(`[Warren] Write failed: ${response.status}`);
            }
        }
    }
    catch (error) {
        console.error(`[Warren] Write error:`, error);
    }
}

// Extract actionable commands from results
function extractActionableCommands(result) {
    const actionable = {};

    // Air Handler + Fan Coil commands
    if (result.heatingValve !== undefined)
        actionable.heatingValve = result.heatingValve;
    if (result.coolingValve !== undefined)
        actionable.coolingValve = result.coolingValve;
    if (result.fanEnable !== undefined)
        actionable.fanEnable = result.fanEnable;
    if (result.fanSpeed !== undefined)
        actionable.fanSpeed = result.fanSpeed;
    if (result.unitEnable !== undefined)
        actionable.unitEnable = result.unitEnable;
    if (result.outdoorDamper !== undefined)
        actionable.outdoorDamper = result.outdoorDamper;
    if (result.temperatureSetpoint !== undefined)
        actionable.temperatureSetpoint = result.temperatureSetpoint;

    // Pump commands
    if (result.pumpEnable !== undefined)
        actionable.pumpEnable = result.pumpEnable;
    if (result.pumpSpeed !== undefined)
        actionable.pumpSpeed = result.pumpSpeed;

    // Steam Bundle commands
    if (result.steamValve !== undefined)
        actionable.steamValve = result.steamValve;
    if (result.steamEnable !== undefined)
        actionable.steamEnable = result.steamEnable;

    return actionable;
}

// Clean up completed/failed jobs from tracking (Event handlers - may not work)
equipmentQueue.on('completed', (job) => {
    const jobKey = `${job.data.locationId}-${job.data.equipmentId}-${job.data.type}`;
    queuedJobs.delete(jobKey);
    console.log(`[Warren Smart Queue] Job ${job.id} completed - ${job.data.type} (${job.data.equipmentId})`);
});

equipmentQueue.on('failed', (job, err) => {
    const jobKey = `${job.data.locationId}-${job.data.equipmentId}-${job.data.type}`;
    queuedJobs.delete(jobKey);
    console.error(`[Warren Smart Queue] Job ${job.id} failed - ${job.data.type} (${job.data.equipmentId}):`, err.message);
});

// ===============================================================================
// SYSTEM MANAGEMENT
// ===============================================================================

// Graceful shutdown
async function shutdown() {
    console.log('[Warren] Shutting down equipment processors with SMART queue integration...');
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
redis.on('connect', () => console.log('[Warren] Redis connected'));
redis.on('error', (err) => console.error('[Warren] Redis error:', err));

// Initialize and start the processor
console.log('[Warren] Starting Warren processor with SMART queue integration...');
initializeWarrenProcessors()
    .then(() => console.log('[Warren] Warren processor started successfully with SMART queue integration'))
    .catch((error) => {
        console.error('[Warren] Failed to start:', error);
        process.exit(1);
    });
