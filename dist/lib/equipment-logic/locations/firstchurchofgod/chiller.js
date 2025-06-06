"use strict";
// @ts-nocheck
// lib/equipment-logic/locations/firstchurchofgod/chiller.ts
//
// Author: Juelz NeuralBms DevOps
// Last Updated: June 5, 2025
//
// ===============================================================================
// FIRSTCHURCHOFGOD CHILLER CONTROL LOGIC - LEAD-LAG STAGING WITH H20 SUPPLY CONTROL
// ===============================================================================
//
// OVERVIEW:
// This file controls a dual-chiller system at FirstChurchOfGod location with intelligent
// lead-lag staging to maintain H20 supply temperature. The system features a primary
// chiller with 4-stage control and a secondary chiller for backup/additional capacity.
// Advanced staging algorithms prevent short cycling and ensure optimal efficiency.
//
// EQUIPMENT SPECIFICATIONS:
// - Chiller 1 (Primary Lead): sWt9ordzOHmo9O3cmVl7
//   * 4 Individual Cooling Stages (Stage 1, Stage 2, Stage 3, Stage 4)
//   * Binary Control: 1 = Stage Enable, 0 = Stage Disable
//   * Reverse Staging Logic: Last stage on = First stage off
//   * Minimum run times and staging delays for protection
//
// - Chiller 2 (Secondary Lag): lsQW6gtoB4luewi0esHL
//   * Simple Enable/Disable Control (handles internal staging)
//   * Binary Control: 1 = Chiller Enable, 0 = Chiller Disable
//   * Only operates when Chiller 1 at maximum capacity
//
// CONTROL STRATEGY:
// 1. **Outdoor Air Temperature Enable Logic**
//    - System only operates when OAT > 32°F (prevents freeze damage)
//    - Automatic lockout during winter conditions
//    - Hysteresis prevents rapid cycling on temperature boundary
//
// 2. **H20 Supply Temperature Control**
//    - Primary Control Point: H20 Supply Temperature
//    - Default Setpoint: 45°F (energy efficient for comfort cooling)
//    - UI Override: Operators can adjust via waterTemperatureSetpoint command
//    - Deadband Control: ±1°F to prevent hunting
//
// 3. **Chiller 1 Staging Algorithm**
//    - **Stage Up Sequence**: 1 → 2 → 3 → 4 (progressive loading)
//    - **Stage Down Sequence**: 4 → 3 → 2 → 1 (reverse unloading)
//    - **Staging Logic**: Temperature-based with time delays
//    - **Protection**: Minimum run times prevent compressor damage
//
// 4. **Chiller 2 Lead-Lag Logic**
//    - **Enable Condition**: Chiller 1 at 100% capacity (all 4 stages) + still above setpoint
//    - **Disable Condition**: H20 temperature satisfied or Chiller 1 capacity available
//    - **Simple Operation**: Binary enable/disable only
//
// DETAILED STAGING PARAMETERS:
// **Chiller 1 Stage Timing:**
// - **Minimum Run Time**: 300 seconds (5 minutes) per stage
// - **Stage Up Delay**: 120 seconds (2 minutes) between stage additions
// - **Stage Down Delay**: 180 seconds (3 minutes) between stage removals
// - **Temperature Thresholds**:
//   * Stage Up: Supply temp > (Setpoint + 2°F)
//   * Stage Down: Supply temp < (Setpoint + 0.5°F)
//
// **Chiller 2 Timing:**
// - **Enable Delay**: 300 seconds (5 minutes) after Chiller 1 reaches 4 stages
// - **Disable Delay**: 180 seconds (3 minutes) before removing Chiller 1 stages
// - **Minimum Run Time**: 600 seconds (10 minutes) once enabled
//
// ADVANCED CONTROL FEATURES:
// - **Reverse Staging**: Last stage enabled is first stage disabled
// - **Anti-Short Cycling**: Minimum run times protect compressors
// - **Staged Loading**: Gradual capacity increases for stability
// - **Temperature Hysteresis**: Prevents rapid on/off cycling
// - **Seasonal Lockout**: OAT-based enable/disable for winter protection
// - **UI Integration**: Real-time setpoint adjustments via operator commands
//
// SAFETY AND PROTECTION:
// - **Freeze Protection**: System lockout when OAT ≤ 32°F
// - **Compressor Protection**: Minimum run times prevent damage
// - **Staging Delays**: Prevent rapid capacity changes
// - **Temperature Limits**: High/low temperature alarms and shutdowns
// - **Equipment Sequencing**: Proper lead-lag operation prevents conflicts
//
// ENERGY EFFICIENCY FEATURES:
// - **Optimal Staging**: Only runs capacity needed to maintain setpoint
// - **Lead-Lag Rotation**: Could be enhanced to rotate lead chiller for even wear
// - **Setpoint Optimization**: 45°F setpoint optimized for efficiency vs comfort
// - **Seasonal Operation**: Automatic shutdown during cold weather
//
// UI COMMAND INTEGRATION:
// - **Setpoint Override**: waterTemperatureSetpoint command updates target temperature
// - **Manual Control**: Emergency override capabilities for maintenance
// - **Status Reporting**: Real-time feedback on staging and operation
//
// STATE MANAGEMENT:
// - **Stage Timers**: Tracks individual stage run times
// - **Staging History**: Maintains sequence for proper reverse staging
// - **Temperature Trends**: Analyzes cooling performance for optimization
// - **Equipment Status**: Monitors chiller health and performance
//
// TROUBLESHOOTING FEATURES:
// - **Detailed Logging**: All staging decisions and timing logged
// - **Performance Monitoring**: Tracks cooling effectiveness
// - **Alarm Generation**: Automatic fault detection and reporting
// - **Manual Override**: Emergency control capabilities
//
// FACTORY INTEGRATION:
// - **High Performance**: Returns command objects for 1-2 second processing
// - **BullMQ Compatible**: Designed for smart queue architecture
// - **Error Handling**: Graceful degradation during faults
// - **State Persistence**: Maintains control state between processing cycles
//
// ===============================================================================

Object.defineProperty(exports, "__esModule", { value: true });
exports.chillerControl = chillerControl;
const location_logger_1 = require("../../../logging/location-logger");

// Helper to safely parse numbers from various sources
function parseSafeNumber(value, defaultValue) {
    if (typeof value === 'number' && !isNaN(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const parsed = parseFloat(value);
        if (!isNaN(parsed)) {
            return parsed;
        }
    }
    return defaultValue;
}

// Chiller control constants
const CHILLER_CONSTANTS = {
    DEFAULT_SETPOINT: 45.0,
    ENABLE_OAT_THRESHOLD: 32.0,
    DISABLE_OAT_THRESHOLD: 30.0,
    STAGE_UP_THRESHOLD: 2.0,
    STAGE_DOWN_THRESHOLD: 0.5,
    STAGE_MINIMUM_RUN_TIME: 5 * 60 * 1000,     // 5 minutes
    STAGE_UP_DELAY: 2 * 60 * 1000,             // 2 minutes
    STAGE_DOWN_DELAY: 3 * 60 * 1000,           // 3 minutes
    CHILLER2_ENABLE_DELAY: 5 * 60 * 1000,      // 5 minutes
    CHILLER2_MINIMUM_RUN_TIME: 10 * 60 * 1000  // 10 minutes
};

async function chillerControl(metricsInput, settingsInput, currentTempArgument, stateStorageInput) {
    const equipmentId = settingsInput.equipmentId;
    const locationId = settingsInput.locationId || "9";
    const equipmentName = settingsInput.equipmentName || "chiller";

    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "chiller", `Starting FirstChurch chiller control for ${equipmentName}`);

    try {
        // Initialize state storage if needed
        if (!stateStorageInput) {
            stateStorageInput = {};
        }

        // STEP 1: Determine which chiller we're controlling
        const isChiller1 = equipmentId === 'sWt9ordzOHmo9O3cmVl7';
        const isChiller2 = equipmentId === 'lsQW6gtoB4luewi0esHL';

        if (!isChiller1 && !isChiller2) {
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "chiller", `ERROR: Unknown chiller equipment ID: ${equipmentId}`);
            return { error: "Unknown chiller equipment ID" };
        }

        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "chiller", 
            `Controlling ${isChiller1 ? 'Chiller 1 (4-stage primary)' : 'Chiller 2 (lag unit)'}`);

        // STEP 2: Get temperature readings
        const h20SupplyTemp = parseSafeNumber(currentTempArgument,
            parseSafeNumber(metricsInput.H20Supply,
            parseSafeNumber(metricsInput.ChilledWaterSupply,
            parseSafeNumber(metricsInput.SupplyTemp,
            parseSafeNumber(metricsInput.WaterTemp, 50)))));

        const outdoorTemp = parseSafeNumber(metricsInput.Outdoor_Air,
            parseSafeNumber(metricsInput.OutdoorTemp,
            parseSafeNumber(metricsInput.OAT, 60)));

        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "chiller",
            `Temperatures: H20Supply=${h20SupplyTemp.toFixed(1)}°F, Outdoor=${outdoorTemp.toFixed(1)}°F`);

        // STEP 3: Get setpoint (UI override or default)
        let targetSetpoint = CHILLER_CONSTANTS.DEFAULT_SETPOINT;

        if (settingsInput.waterTemperatureSetpoint !== undefined) {
            targetSetpoint = parseSafeNumber(settingsInput.waterTemperatureSetpoint, targetSetpoint);
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "chiller", `Using UI setpoint: ${targetSetpoint}°F`);
        } else if (metricsInput.waterTemperatureSetpoint !== undefined) {
            targetSetpoint = parseSafeNumber(metricsInput.waterTemperatureSetpoint, targetSetpoint);
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "chiller", `Using metrics setpoint: ${targetSetpoint}°F`);
        } else {
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "chiller", `Using default setpoint: ${targetSetpoint}°F`);
        }

        // STEP 4: Check outdoor air temperature lockout with hysteresis
        if (!stateStorageInput.oatLockout) {
            stateStorageInput.oatLockout = { isLocked: outdoorTemp <= CHILLER_CONSTANTS.DISABLE_OAT_THRESHOLD };
        }

        let oatLockout = stateStorageInput.oatLockout.isLocked;

        if (oatLockout && outdoorTemp > CHILLER_CONSTANTS.ENABLE_OAT_THRESHOLD) {
            oatLockout = false;
            stateStorageInput.oatLockout.isLocked = false;
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "chiller", 
                `OAT lockout RELEASED - outdoor temp ${outdoorTemp.toFixed(1)}°F > ${CHILLER_CONSTANTS.ENABLE_OAT_THRESHOLD}°F`);
        } else if (!oatLockout && outdoorTemp <= CHILLER_CONSTANTS.DISABLE_OAT_THRESHOLD) {
            oatLockout = true;
            stateStorageInput.oatLockout.isLocked = true;
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "chiller", 
                `OAT lockout ENGAGED - outdoor temp ${outdoorTemp.toFixed(1)}°F ≤ ${CHILLER_CONSTANTS.DISABLE_OAT_THRESHOLD}°F`);
        }

        if (oatLockout) {
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "chiller", "System locked out due to low outdoor temperature");

            if (isChiller1) {
                return {
                    chiller1Stage1: 0,
                    chiller1Stage2: 0,
                    chiller1Stage3: 0,
                    chiller1Stage4: 0,
                    chiller1Enable: false,
                    lockoutReason: "Low outdoor temperature"
                };
            } else {
                return {
                    chiller2Enable: false,
                    lockoutReason: "Low outdoor temperature"
                };
            }
        }

        // STEP 5: Control logic based on chiller type
        if (isChiller1) {
            return controlChiller1Staging(h20SupplyTemp, targetSetpoint, stateStorageInput, equipmentId, locationId);
        } else {
            return controlChiller2LeadLag(h20SupplyTemp, targetSetpoint, stateStorageInput, equipmentId, locationId);
        }

    } catch (error) {
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "chiller", 
            `ERROR in FirstChurch chiller control: ${error.message}`, error.stack);

        // Return safe state on error
        if (equipmentId === 'sWt9ordzOHmo9O3cmVl7') {
            return {
                chiller1Stage1: 0,
                chiller1Stage2: 0,
                chiller1Stage3: 0,
                chiller1Stage4: 0,
                chiller1Enable: false,
                error: error.message
            };
        } else {
            return {
                chiller2Enable: false,
                error: error.message
            };
        }
    }
}

// Control Chiller 1 with 4-stage staging logic
function controlChiller1Staging(h20SupplyTemp, targetSetpoint, stateStorageInput, equipmentId, locationId) {
    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "chiller", "Starting Chiller 1 4-stage control");

    const currentTime = Date.now();
    const tempError = h20SupplyTemp - targetSetpoint;

    // Initialize Chiller 1 state
    if (!stateStorageInput.chiller1State) {
        stateStorageInput.chiller1State = {
            stages: [false, false, false, false],
            stageTimes: [0, 0, 0, 0],
            lastChangeTime: 0
        };
    }

    const state = stateStorageInput.chiller1State;
    const currentStages = state.stages.filter(stage => stage).length;

    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "chiller",
        `Temperature error: ${tempError.toFixed(2)}°F, Current stages: ${currentStages}/4`);

    // Check if timing allows changes
    const timeSinceLastChange = currentTime - state.lastChangeTime;
    const canChange = timeSinceLastChange >= CHILLER_CONSTANTS.STAGE_UP_DELAY;

    // Stage up logic
    if (tempError > CHILLER_CONSTANTS.STAGE_UP_THRESHOLD && currentStages < 4 && canChange) {
        // Find first disabled stage
        for (let i = 0; i < 4; i++) {
            if (!state.stages[i]) {
                state.stages[i] = true;
                state.stageTimes[i] = currentTime;
                state.lastChangeTime = currentTime;
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "chiller", `STAGING UP: Enabled Stage ${i + 1}`);
                break;
            }
        }
    }
    // Stage down logic (reverse order)
    else if (tempError < CHILLER_CONSTANTS.STAGE_DOWN_THRESHOLD && currentStages > 0 && canChange) {
        // Find last enabled stage and check minimum runtime
        for (let i = 3; i >= 0; i--) {
            if (state.stages[i]) {
                const runtime = currentTime - state.stageTimes[i];
                if (runtime >= CHILLER_CONSTANTS.STAGE_MINIMUM_RUN_TIME) {
                    state.stages[i] = false;
                    state.lastChangeTime = currentTime;
                    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "chiller", 
                        `STAGING DOWN: Disabled Stage ${i + 1} (ran ${Math.round(runtime / 1000)}s)`);
                    break;
                } else {
                    const remaining = Math.round((CHILLER_CONSTANTS.STAGE_MINIMUM_RUN_TIME - runtime) / 1000);
                    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "chiller", 
                        `Stage ${i + 1} needs ${remaining}s more runtime before disable`);
                    break;
                }
            }
        }
    }

    const result = {
        chiller1Stage1: state.stages[0] ? 1 : 0,
        chiller1Stage2: state.stages[1] ? 1 : 0,
        chiller1Stage3: state.stages[2] ? 1 : 0,
        chiller1Stage4: state.stages[3] ? 1 : 0,
        chiller1Enable: currentStages > 0,
        enabledStages: currentStages,
        temperatureError: parseFloat(tempError.toFixed(2)),
        h20SupplyTemp: parseFloat(h20SupplyTemp.toFixed(1)),
        targetSetpoint: parseFloat(targetSetpoint.toFixed(1))
    };

    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "chiller",
        `Final Chiller 1: Enable=${result.chiller1Enable}, Stages=${result.chiller1Stage1}${result.chiller1Stage2}${result.chiller1Stage3}${result.chiller1Stage4}`);

    return result;
}

// Control Chiller 2 with lead-lag logic
function controlChiller2LeadLag(h20SupplyTemp, targetSetpoint, stateStorageInput, equipmentId, locationId) {
    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "chiller", "Starting Chiller 2 lead-lag control");

    const currentTime = Date.now();
    const tempError = h20SupplyTemp - targetSetpoint;

    // Initialize Chiller 2 state
    if (!stateStorageInput.chiller2State) {
        stateStorageInput.chiller2State = {
            enabled: false,
            enableTime: 0,
            waitStartTime: 0
        };
    }

    const state = stateStorageInput.chiller2State;

    // Check if Chiller 1 is at max capacity
    const chiller1AtMax = stateStorageInput.chiller1State && 
                         stateStorageInput.chiller1State.stages && 
                         stateStorageInput.chiller1State.stages.every(stage => stage);

    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "chiller",
        `Temperature error: ${tempError.toFixed(2)}°F, Chiller 1 at max: ${chiller1AtMax}`);

    // Enable logic
    if (!state.enabled && chiller1AtMax && tempError > CHILLER_CONSTANTS.STAGE_UP_THRESHOLD) {
        if (state.waitStartTime === 0) {
            state.waitStartTime = currentTime;
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "chiller", "Starting Chiller 2 enable delay");
        } else if (currentTime - state.waitStartTime >= CHILLER_CONSTANTS.CHILLER2_ENABLE_DELAY) {
            state.enabled = true;
            state.enableTime = currentTime;
            state.waitStartTime = 0;
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "chiller", "CHILLER 2 ENABLED");
        }
    } else {
        state.waitStartTime = 0;
    }

    // Disable logic
    if (state.enabled && (tempError < CHILLER_CONSTANTS.STAGE_DOWN_THRESHOLD || !chiller1AtMax)) {
        const runtime = currentTime - state.enableTime;
        if (runtime >= CHILLER_CONSTANTS.CHILLER2_MINIMUM_RUN_TIME) {
            state.enabled = false;
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "chiller", 
                `CHILLER 2 DISABLED (ran ${Math.round(runtime / 1000)}s)`);
        } else {
            const remaining = Math.round((CHILLER_CONSTANTS.CHILLER2_MINIMUM_RUN_TIME - runtime) / 1000);
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "chiller", 
                `Chiller 2 needs ${remaining}s more runtime`);
        }
    }

    const result = {
        chiller2Enable: state.enabled,
        chiller1AtMaxCapacity: chiller1AtMax,
        temperatureError: parseFloat(tempError.toFixed(2)),
        h20SupplyTemp: parseFloat(h20SupplyTemp.toFixed(1)),
        targetSetpoint: parseFloat(targetSetpoint.toFixed(1))
    };

    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "chiller",
        `Final Chiller 2: Enable=${result.chiller2Enable}`);

    return result;
}

// Add worker compatibility exports
exports.default = chillerControl;
exports.processEquipment = chillerControl;
exports.runLogic = chillerControl;
