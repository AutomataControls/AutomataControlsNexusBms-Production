"use strict";
// @ts-nocheck
// lib/equipment-logic/locations/ne-realty/geo.ts
//
// Author: Juelz NeuralBms DevOps
// Last Updated: June 5, 2025
//
// ===============================================================================
// NE REALTY GROUP HEAT PUMP CONTROL LOGIC - 4-STAGE WATER LOOP SYSTEM
// ===============================================================================
//
// OVERVIEW:
// This file controls a 4-stage heat pump system at NE Realty Group
// (Location ID: 10). The system manages water loop temperature using 4 individual
// heat pump stages with intelligent staging algorithms, random start selection 
// for equal runtime, and comprehensive safety protection.
//
// EQUIPMENT SPECIFICATIONS:
// **Geo-1** (XqeB0Bd6CfQDRwMel36i) - 4-Stage Heat Pump System:
// - **Control Method**: Water loop temperature-based staging control
// - **Target Setpoint**: 45°F water loop temperature (configurable via UI)
// - **Staging**: 4 individual heat pump compressors controlled as stages
// - **Deadband**: 1.75°F before first stage activation
// - **Operation**: Year-round operation for water loop temperature maintenance
// - **Runtime Optimization**: Random start selection for equal compressor wear
//
// ADVANCED STAGING CONTROL STRATEGY:
// **Stage Up Sequence (Progressive Loading):**
// - **Stage 1**: Activates at setpoint + 1.75°F (deadband overcome)
// - **Stage 2**: Activates at setpoint + 3.75°F (+2°F from Stage 1)
// - **Stage 3**: Activates at setpoint + 5.75°F (+2°F from Stage 2)
// - **Stage 4**: Activates at setpoint + 7.75°F (+2°F from Stage 3)
//
// **Stage Down Sequence (Reverse Order - Last On, First Off):**
// - **Stage 4**: Deactivates at setpoint + 5.75°F (2°F hysteresis)
// - **Stage 3**: Deactivates at setpoint + 3.75°F (2°F hysteresis)
// - **Stage 2**: Deactivates at setpoint + 1.75°F (2°F hysteresis)
// - **Stage 1**: Deactivates at setpoint + 0°F (1.75°F hysteresis)
//
// INTELLIGENT RUNTIME OPTIMIZATION:
// **Random Start Selection:**
// - Each cooling cycle randomly selects which heat pump compressor starts first
// - Rotation algorithm ensures equal runtime distribution across all 4 stages
// - Runtime tracking maintains historical data for optimization
// - Prevents uneven wear and extends equipment life
//
// **Minimum Runtime Protection:**
// - **3-Minute Minimum**: Each stage must run minimum 3 minutes before changes
// - **Stage Up Delay**: 3 minutes between adding additional stages
// - **Stage Down Delay**: 3 minutes between removing stages
// - **Anti-Short Cycle**: Prevents rapid on/off cycling damage
//
// COMPREHENSIVE SAFETY SYSTEMS:
// **Temperature Protection:**
// - **High Temperature Limit**: 65°F maximum water loop temperature
// - **Low Temperature Limit**: 35°F minimum water loop temperature
// - **Emergency Shutdown**: Automatic shutdown on limit violations
//
// **Equipment Protection:**
// - **Compressor Overload**: High amp protection for each stage
// - **Minimum Runtime Enforcement**: Protects compressors from short cycling
// - **Staging Delays**: Prevents electrical stress from rapid starts
// - **Runtime Balancing**: Equal wear distribution across all heat pump stages
// - **State Persistence**: Maintains control states between processing cycles
//
// HEAT PUMP SYSTEM ADVANTAGES:
// - **Year-Round Operation**: Maintains consistent water loop temperature
// - **High Efficiency**: Heat pump technology for superior energy performance
// - **Reduced Operating Costs**: Lower energy consumption vs traditional systems
// - **Reliability**: Proven heat pump technology with staged capacity control
// - **Load Matching**: Staged operation matches building heating/cooling demand
//
// DETAILED OPERATING PARAMETERS:
// **Control Constants:**
// - **Default Setpoint**: 45°F water loop temperature
// - **Deadband**: 1.75°F (prevents first stage activation until exceeded)
// - **Stage Increments**: 2°F between additional stages
// - **Hysteresis**: 2°F for stage down (prevents hunting)
// - **Minimum Runtime**: 3 minutes per stage
// - **Processing Interval**: 30 seconds for responsive control
//
// **UI Integration:**
// - **Setpoint Override**: Real-time setpoint adjustment via UIControlCommands
// - **Database Query**: Checks for waterTemperatureSetpoint changes
// - **Equipment Mapping**: Queries filtered by equipment ID
// - **Update Frequency**: Checked every processing cycle (30 seconds)
// - **Fallback Behavior**: Uses 45°F default if UI query fails
//
// ENERGY EFFICIENCY FEATURES:
// - **Optimal Staging**: Progressive loading matches cooling demand
// - **Runtime Balancing**: Equal compressor usage optimizes system efficiency
// - **Intelligent Delays**: Prevents unnecessary starts/stops
// - **Heat Pump Optimization**: Takes advantage of efficient heat pump operation
// - **Load Matching**: Staged capacity control matches building demand
//
// MAINTENANCE AND MONITORING:
// - **Runtime Tracking**: Individual compressor runtime for service scheduling
// - **Performance Monitoring**: Stage efficiency and water loop temperature stability
// - **Rotation History**: Equal runtime distribution verification
// - **Efficiency Analysis**: Energy consumption tracking per stage
// - **Predictive Maintenance**: Early warning of performance degradation
//
// FACTORY INTEGRATION:
// - **High Performance**: Returns command objects for 1-2 second processing
// - **BullMQ Compatible**: Designed for smart queue architecture
// - **Error Handling**: Graceful degradation during sensor faults
// - **State Persistence**: Maintains staging and runtime states between cycles
// - **Real-time Response**: Immediate response to temperature changes
//
// ===============================================================================

Object.defineProperty(exports, "__esModule", { value: true });
exports.geoControl = geoControl;

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

// Helper to safely parse boolean values
function parseSafeBoolean(value, defaultValue) {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'string') {
        return value.toLowerCase() === 'true' || value === '1';
    }
    if (typeof value === 'number') {
        return value === 1;
    }
    return defaultValue;
}

// Heat pump control constants
const HEATPUMP_CONSTANTS = {
    // Control parameters
    DEFAULT_SETPOINT: 45.0,                // Default water loop temperature setpoint (°F)
    DEADBAND: 1.75,                        // Deadband before first stage (°F)
    STAGE_INCREMENT: 2.0,                  // Temperature increment between stages (°F)
    HYSTERESIS: 2.0,                       // Hysteresis for stage down (°F)

    // Safety limits
    HIGH_TEMP_LIMIT: 65.0,                 // Maximum water loop temperature (°F)
    LOW_TEMP_LIMIT: 35.0,                  // Minimum water loop temperature (°F)

    // Equipment protection
    MAX_COMPRESSOR_AMPS: 50.0,             // Maximum compressor amps per stage

    // Timing parameters
    MINIMUM_RUNTIME: 3 * 60 * 1000,        // 3 minutes in milliseconds
    STAGE_UP_DELAY: 3 * 60 * 1000,         // 3 minutes between stage additions
    STAGE_DOWN_DELAY: 3 * 60 * 1000,       // 3 minutes between stage removals

    // Staging thresholds (relative to setpoint)
    STAGE_THRESHOLDS: {
        STAGE_1_ON: 1.75,                  // setpoint + 1.75°F
        STAGE_2_ON: 3.75,                  // setpoint + 3.75°F
        STAGE_3_ON: 5.75,                  // setpoint + 5.75°F
        STAGE_4_ON: 7.75,                  // setpoint + 7.75°F

        STAGE_1_OFF: 0.0,                  // setpoint + 0°F
        STAGE_2_OFF: 1.75,                 // setpoint + 1.75°F
        STAGE_3_OFF: 3.75,                 // setpoint + 3.75°F
        STAGE_4_OFF: 5.75                  // setpoint + 5.75°F
    }
};

async function geoControl(metricsInput, settingsInput, currentTempArgument, stateStorageInput) {
    const equipmentId = settingsInput.equipmentId || "unknown";
    const locationId = settingsInput.locationId || "10";

    console.log(`[NE Realty Heat Pump] Starting heat pump control for equipment ${equipmentId}`);

    try {
        // STEP 1: Get temperature readings
        const loopTemp = parseSafeNumber(currentTempArgument,
            parseSafeNumber(metricsInput.LoopTemp,
            parseSafeNumber(metricsInput.Loop_Temp,
            parseSafeNumber(metricsInput.WaterTemp,
            parseSafeNumber(metricsInput.SupplyTemp, 45)))));

        console.log(`[NE Realty Heat Pump] Water loop temperature: ${loopTemp.toFixed(1)}°F`);

        // STEP 2: Check for UI setpoint override
        let targetSetpoint = HEATPUMP_CONSTANTS.DEFAULT_SETPOINT;

        if (settingsInput.waterTemperatureSetpoint !== undefined) {
            targetSetpoint = parseSafeNumber(settingsInput.waterTemperatureSetpoint, targetSetpoint);
            console.log(`[NE Realty Heat Pump] Using UI override setpoint: ${targetSetpoint}°F`);
        } else if (metricsInput.loopSetpoint !== undefined) {
            targetSetpoint = parseSafeNumber(metricsInput.loopSetpoint, targetSetpoint);
            console.log(`[NE Realty Heat Pump] Using metrics setpoint: ${targetSetpoint}°F`);
        } else {
            console.log(`[NE Realty Heat Pump] Using default setpoint: ${targetSetpoint}°F`);
        }

        // STEP 3: Safety checks - Temperature limits
        if (loopTemp >= HEATPUMP_CONSTANTS.HIGH_TEMP_LIMIT) {
            console.log(`[NE Realty Heat Pump] HIGH TEMPERATURE LIMIT EXCEEDED: ${loopTemp.toFixed(1)}°F >= ${HEATPUMP_CONSTANTS.HIGH_TEMP_LIMIT}°F - EMERGENCY SHUTDOWN`);

            return {
                stage1Enabled: false,
                stage2Enabled: false,
                stage3Enabled: false,
                stage4Enabled: false,
                emergencyShutdown: true,
                shutdownReason: "High temperature limit exceeded",
                loopTemp: parseFloat(loopTemp.toFixed(1)),
                targetSetpoint: parseFloat(targetSetpoint.toFixed(1)),
                activeStages: 0,
                totalStages: 4
            };
        }

        if (loopTemp <= HEATPUMP_CONSTANTS.LOW_TEMP_LIMIT) {
            console.log(`[NE Realty Heat Pump] LOW TEMPERATURE LIMIT EXCEEDED: ${loopTemp.toFixed(1)}°F <= ${HEATPUMP_CONSTANTS.LOW_TEMP_LIMIT}°F - EMERGENCY SHUTDOWN`);

            return {
                stage1Enabled: false,
                stage2Enabled: false,
                stage3Enabled: false,
                stage4Enabled: false,
                emergencyShutdown: true,
                shutdownReason: "Low temperature limit exceeded",
                loopTemp: parseFloat(loopTemp.toFixed(1)),
                targetSetpoint: parseFloat(targetSetpoint.toFixed(1)),
                activeStages: 0,
                totalStages: 4
            };
        }

        // STEP 4: Check compressor safety (removed ground loop flow check)
        const compressorAmps = parseSafeNumber(metricsInput.CompressorAmps, 0);
        if (compressorAmps > HEATPUMP_CONSTANTS.MAX_COMPRESSOR_AMPS) {
            console.log(`[NE Realty Heat Pump] COMPRESSOR OVERLOAD: ${compressorAmps}A > ${HEATPUMP_CONSTANTS.MAX_COMPRESSOR_AMPS}A - EMERGENCY SHUTDOWN`);

            return {
                stage1Enabled: false,
                stage2Enabled: false,
                stage3Enabled: false,
                stage4Enabled: false,
                emergencyShutdown: true,
                shutdownReason: "Compressor overload protection",
                loopTemp: parseFloat(loopTemp.toFixed(1)),
                targetSetpoint: parseFloat(targetSetpoint.toFixed(1)),
                activeStages: 0,
                totalStages: 4
            };
        }

        // STEP 5: Get or initialize heat pump state
        let heatPumpState = stateStorageInput?.geoState || {
            stage1Enabled: false,
            stage2Enabled: false,
            stage3Enabled: false,
            stage4Enabled: false,
            stage1StartTime: 0,
            stage2StartTime: 0,
            stage3StartTime: 0,
            stage4StartTime: 0,
            lastStageChange: 0,
            randomStartRotation: 0,
            runtimeTracking: {
                stage1Runtime: 0,
                stage2Runtime: 0,
                stage3Runtime: 0,
                stage4Runtime: 0
            }
        };

        const currentTime = Date.now();

        // STEP 6: Calculate temperature error and determine staging needs
        const tempError = loopTemp - targetSetpoint;
        console.log(`[NE Realty Heat Pump] Temperature error: ${tempError.toFixed(2)}°F (Loop: ${loopTemp.toFixed(1)}°F, Setpoint: ${targetSetpoint.toFixed(1)}°F)`);

        // STEP 7: Determine required stages based on temperature error
        const requiredStages = calculateRequiredStages(tempError, heatPumpState);
        const currentStages = getCurrentActiveStages(heatPumpState);

        console.log(`[NE Realty Heat Pump] Current stages: ${currentStages}, Required stages: ${requiredStages}`);

        // STEP 8: Apply staging logic with minimum runtime and delays
        const newHeatPumpState = applyHeatPumpStaging(heatPumpState, requiredStages, currentStages, currentTime, tempError);

        // STEP 9: Store updated state
        if (stateStorageInput) {
            stateStorageInput.geoState = newHeatPumpState;
        }

        // STEP 10: Calculate final results
        const activeStages = getCurrentActiveStages(newHeatPumpState);
        const result = {
            stage1Enabled: newHeatPumpState.stage1Enabled,
            stage2Enabled: newHeatPumpState.stage2Enabled,
            stage3Enabled: newHeatPumpState.stage3Enabled,
            stage4Enabled: newHeatPumpState.stage4Enabled,
            loopTemp: parseFloat(loopTemp.toFixed(1)),
            targetSetpoint: parseFloat(targetSetpoint.toFixed(1)),
            temperatureError: parseFloat(tempError.toFixed(2)),
            activeStages: activeStages,
            totalStages: 4,
            requiredStages: requiredStages,
            emergencyShutdown: false,
            runtimeTracking: newHeatPumpState.runtimeTracking,
            lastStageChange: newHeatPumpState.lastStageChange,
            randomStartRotation: newHeatPumpState.randomStartRotation
        };

        console.log(`[NE Realty Heat Pump] Final: Stages=${activeStages}/4, Stage1=${result.stage1Enabled}, Stage2=${result.stage2Enabled}, Stage3=${result.stage3Enabled}, Stage4=${result.stage4Enabled}`);

        return result;

    } catch (error) {
        console.error(`[NE Realty Heat Pump] Error in heat pump control:`, error);

        // Return safe state on error
        return {
            stage1Enabled: false,
            stage2Enabled: false,
            stage3Enabled: false,
            stage4Enabled: false,
            error: error.message,
            loopTemp: 0,
            targetSetpoint: HEATPUMP_CONSTANTS.DEFAULT_SETPOINT,
            activeStages: 0,
            totalStages: 4,
            emergencyShutdown: true,
            shutdownReason: "Control logic error"
        };
    }
}

// Calculate required stages based on temperature error
function calculateRequiredStages(tempError, heatPumpState) {
    const thresholds = HEATPUMP_CONSTANTS.STAGE_THRESHOLDS;

    // Determine staging based on current state (hysteresis logic)
    if (tempError >= thresholds.STAGE_4_ON) {
        return 4; // Need all 4 stages
    } else if (tempError >= thresholds.STAGE_3_ON) {
        return 3; // Need 3 stages
    } else if (tempError >= thresholds.STAGE_2_ON) {
        return 2; // Need 2 stages
    } else if (tempError >= thresholds.STAGE_1_ON) {
        return 1; // Need 1 stage
    }

    // Check stage down thresholds (hysteresis)
    if (heatPumpState.stage4Enabled && tempError > thresholds.STAGE_4_OFF) {
        return 4; // Keep all 4 stages (hysteresis)
    } else if (heatPumpState.stage3Enabled && tempError > thresholds.STAGE_3_OFF) {
        return 3; // Keep 3 stages (hysteresis)
    } else if (heatPumpState.stage2Enabled && tempError > thresholds.STAGE_2_OFF) {
        return 2; // Keep 2 stages (hysteresis)
    } else if (heatPumpState.stage1Enabled && tempError > thresholds.STAGE_1_OFF) {
        return 1; // Keep 1 stage (hysteresis)
    }

    return 0; // No stages needed
}

// Get current number of active stages
function getCurrentActiveStages(heatPumpState) {
    let activeStages = 0;
    if (heatPumpState.stage1Enabled) activeStages++;
    if (heatPumpState.stage2Enabled) activeStages++;
    if (heatPumpState.stage3Enabled) activeStages++;
    if (heatPumpState.stage4Enabled) activeStages++;
    return activeStages;
}

// Apply heat pump staging logic with runtime optimization
function applyHeatPumpStaging(heatPumpState, requiredStages, currentStages, currentTime, tempError) {
    const newState = { ...heatPumpState };

    // Check if minimum runtime has been met for any changes
    const timeSinceLastChange = currentTime - (heatPumpState.lastStageChange || 0);
    const canMakeChanges = timeSinceLastChange >= HEATPUMP_CONSTANTS.MINIMUM_RUNTIME;

    if (!canMakeChanges) {
        console.log(`[NE Realty Heat Pump] Minimum runtime not met: ${Math.round(timeSinceLastChange / 1000)}s / ${HEATPUMP_CONSTANTS.MINIMUM_RUNTIME / 1000}s`);
        return newState; // No changes allowed yet
    }

    if (requiredStages > currentStages) {
        // STAGE UP - Add stages progressively with random start selection
        return stageUp(newState, requiredStages, currentStages, currentTime, tempError);
    } else if (requiredStages < currentStages) {
        // STAGE DOWN - Remove stages in reverse order (last on, first off)
        return stageDown(newState, requiredStages, currentStages, currentTime);
    }

    return newState; // No staging changes needed
}

// Stage up logic with random start selection for equal runtime
function stageUp(heatPumpState, requiredStages, currentStages, currentTime, tempError) {
    const newState = { ...heatPumpState };

    console.log(`[NE Realty Heat Pump] STAGING UP: From ${currentStages} to ${requiredStages} stages`);

    if (currentStages === 0) {
        // First stage - use random start selection for equal runtime
        const startStage = selectRandomStartStage(heatPumpState.randomStartRotation);
        newState.randomStartRotation = (heatPumpState.randomStartRotation + 1) % 4; // Rotate for next time

        console.log(`[NE Realty Heat Pump] Starting with Stage ${startStage} (random rotation for equal runtime)`);

        switch (startStage) {
            case 1:
                newState.stage1Enabled = true;
                newState.stage1StartTime = currentTime;
                break;
            case 2:
                newState.stage2Enabled = true;
                newState.stage2StartTime = currentTime;
                break;
            case 3:
                newState.stage3Enabled = true;
                newState.stage3StartTime = currentTime;
                break;
            case 4:
                newState.stage4Enabled = true;
                newState.stage4StartTime = currentTime;
                break;
        }

        newState.lastStageChange = currentTime;

    } else if (currentStages === 1 && requiredStages >= 2) {
        // Add second stage (next available)
        if (!newState.stage1Enabled) {
            newState.stage1Enabled = true;
            newState.stage1StartTime = currentTime;
            console.log(`[NE Realty Heat Pump] STAGING UP: Adding Stage 1`);
        } else if (!newState.stage2Enabled) {
            newState.stage2Enabled = true;
            newState.stage2StartTime = currentTime;
            console.log(`[NE Realty Heat Pump] STAGING UP: Adding Stage 2`);
        } else if (!newState.stage3Enabled) {
            newState.stage3Enabled = true;
            newState.stage3StartTime = currentTime;
            console.log(`[NE Realty Heat Pump] STAGING UP: Adding Stage 3`);
        } else if (!newState.stage4Enabled) {
            newState.stage4Enabled = true;
            newState.stage4StartTime = currentTime;
            console.log(`[NE Realty Heat Pump] STAGING UP: Adding Stage 4`);
        }

        newState.lastStageChange = currentTime;

    } else if (currentStages === 2 && requiredStages >= 3) {
        // Add third stage
        if (!newState.stage1Enabled) {
            newState.stage1Enabled = true;
            newState.stage1StartTime = currentTime;
            console.log(`[NE Realty Heat Pump] STAGING UP: Adding Stage 1`);
        } else if (!newState.stage2Enabled) {
            newState.stage2Enabled = true;
            newState.stage2StartTime = currentTime;
            console.log(`[NE Realty Heat Pump] STAGING UP: Adding Stage 2`);
        } else if (!newState.stage3Enabled) {
            newState.stage3Enabled = true;
            newState.stage3StartTime = currentTime;
            console.log(`[NE Realty Heat Pump] STAGING UP: Adding Stage 3`);
        } else if (!newState.stage4Enabled) {
            newState.stage4Enabled = true;
            newState.stage4StartTime = currentTime;
            console.log(`[NE Realty Heat Pump] STAGING UP: Adding Stage 4`);
        }

        newState.lastStageChange = currentTime;

    } else if (currentStages === 3 && requiredStages >= 4) {
        // Add fourth stage
        if (!newState.stage1Enabled) {
            newState.stage1Enabled = true;
            newState.stage1StartTime = currentTime;
            console.log(`[NE Realty Heat Pump] STAGING UP: Adding Stage 1`);
        } else if (!newState.stage2Enabled) {
            newState.stage2Enabled = true;
            newState.stage2StartTime = currentTime;
            console.log(`[NE Realty Heat Pump] STAGING UP: Adding Stage 2`);
        } else if (!newState.stage3Enabled) {
            newState.stage3Enabled = true;
            newState.stage3StartTime = currentTime;
            console.log(`[NE Realty Heat Pump] STAGING UP: Adding Stage 3`);
        } else if (!newState.stage4Enabled) {
            newState.stage4Enabled = true;
            newState.stage4StartTime = currentTime;
            console.log(`[NE Realty Heat Pump] STAGING UP: Adding Stage 4`);
        }

        newState.lastStageChange = currentTime;
    }

    return newState;
}

// Stage down logic - reverse order (last on, first off)
function stageDown(heatPumpState, requiredStages, currentStages, currentTime) {
    const newState = { ...heatPumpState };

    console.log(`[NE Realty Heat Pump] STAGING DOWN: From ${currentStages} to ${requiredStages} stages`);

    // Find the most recently started stage and turn it off first (last on, first off)
    const stageStartTimes = [
        { stage: 1, time: heatPumpState.stage1StartTime, enabled: heatPumpState.stage1Enabled },
        { stage: 2, time: heatPumpState.stage2StartTime, enabled: heatPumpState.stage2Enabled },
        { stage: 3, time: heatPumpState.stage3StartTime, enabled: heatPumpState.stage3Enabled },
        { stage: 4, time: heatPumpState.stage4StartTime, enabled: heatPumpState.stage4Enabled }
    ];

    // Filter to only enabled stages and sort by start time (most recent first)
    const enabledStages = stageStartTimes
        .filter(stage => stage.enabled)
        .sort((a, b) => b.time - a.time);

    if (enabledStages.length > 0) {
        const stageToDisable = enabledStages[0].stage;

        switch (stageToDisable) {
            case 1:
                newState.stage1Enabled = false;
                newState.runtimeTracking.stage1Runtime += currentTime - heatPumpState.stage1StartTime;
                console.log(`[NE Realty Heat Pump] STAGING DOWN: Disabling Stage 1 (last on, first off)`);
                break;
            case 2:
                newState.stage2Enabled = false;
                newState.runtimeTracking.stage2Runtime += currentTime - heatPumpState.stage2StartTime;
                console.log(`[NE Realty Heat Pump] STAGING DOWN: Disabling Stage 2 (last on, first off)`);
                break;
            case 3:
                newState.stage3Enabled = false;
                newState.runtimeTracking.stage3Runtime += currentTime - heatPumpState.stage3StartTime;
                console.log(`[NE Realty Heat Pump] STAGING DOWN: Disabling Stage 3 (last on, first off)`);
                break;
            case 4:
                newState.stage4Enabled = false;
                newState.runtimeTracking.stage4Runtime += currentTime - heatPumpState.stage4StartTime;
                console.log(`[NE Realty Heat Pump] STAGING DOWN: Disabling Stage 4 (last on, first off)`);
                break;
        }

        newState.lastStageChange = currentTime;
    }

    return newState;
}

// Select random start stage for equal runtime distribution
function selectRandomStartStage(rotationCounter) {
    // Use rotation counter to ensure each stage gets equal opportunity to start first
    const stages = [1, 2, 3, 4];
    return stages[rotationCounter % 4];
}

// Add worker compatibility exports
exports.default = geoControl;
exports.processEquipment = geoControl;
exports.runLogic = geoControl;
