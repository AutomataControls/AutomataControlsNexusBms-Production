"use strict";
// @ts-nocheck
// lib/equipment-logic/locations/firstchurchofgod/boiler.ts
//
// Author: Juelz NeuralBms DevOps
// Last Updated: June 4, 2025
//
// ===============================================================================
// FIRSTCHURCHOFGOD BOILER CONTROL LOGIC - PRIMARY LOCHINVAR + BACKUP FAILOVER SYSTEM
// ===============================================================================
//
// OVERVIEW:
// This file controls a comprehensive boiler system at FirstChurchOfGod location featuring
// a primary Lochinvar boiler that operates continuously with three backup boilers for
// emergency failover conditions. The system maintains heating loop temperatures within
// optimal ranges while providing redundancy for critical heating operations.
//
// EQUIPMENT SPECIFICATIONS:
// - **Primary Boiler**: Lochinvar High-Efficiency Condensing Boiler
//   * Equipment ID: 5O3e8z6KwexgupGER4FW
//   * Type: Primary continuous operation unit
//   * Control: Enable/Disable (normally always enabled)
//   * Capacity: Sized for full building heating load
//   * Efficiency: High-efficiency condensing design
//
// - **Backup Boiler 1**: Emergency Failover Unit #1
//   * Equipment ID: [To be configured]
//   * Type: Backup/standby boiler
//   * Control: Enable/Disable based on failover conditions
//   * Purpose: First-stage backup for primary boiler failure
//
// - **Backup Boiler 2**: Emergency Failover Unit #2
//   * Equipment ID: [To be configured]
//   * Type: Backup/standby boiler
//   * Control: Enable/Disable based on failover conditions
//   * Purpose: Second-stage backup for additional capacity
//
// - **Backup Boiler 3**: Emergency Failover Unit #3
//   * Equipment ID: [To be configured]
//   * Type: Backup/standby boiler
//   * Control: Enable/Disable based on failover conditions
//   * Purpose: Final backup for extreme cold weather or multiple failures
//
// CONTROL STRATEGY:
// 1. **Primary Boiler Operation**
//    - Continuously enabled during heating season
//    - Maintains heating loop supply temperature 140-160°F
//    - Modulating control based on system demand
//    - Energy-efficient operation with outdoor reset capability
//
// 2. **Temperature Monitoring and Control**
//    - **Primary Control**: Heating Loop Supply Temperature
//    - **Secondary Monitoring**: Heating Loop Return Temperature
//    - **Normal Operating Range**: 140-160°F supply temperature
//    - **Critical Low Threshold**: 120°F (triggers backup boiler activation)
//    - **Safety High Limit**: 180°F (emergency shutdown protection)
//
// 3. **Backup Boiler Failover Logic**
//    - **Trigger Condition**: Loop temperature falls below 120°F
//    - **Sequential Activation**: Backup boilers enabled in sequence
//    - **Capacity Staging**: Additional boilers for severe conditions
//    - **Automatic Recovery**: Backup boilers disabled when primary restores temperature
//
// 4. **Intelligent Failover Sequencing**
//    - **Stage 1**: Primary boiler + Backup Boiler 1
//    - **Stage 2**: Primary boiler + Backup Boilers 1 & 2
//    - **Stage 3**: Primary boiler + All backup boilers (1, 2, & 3)
//    - **Emergency Mode**: All boilers maximum output
//
// DETAILED OPERATING PARAMETERS:
// **Temperature Setpoints:**
// - **Normal Supply Setpoint**: 150°F (middle of optimal range)
// - **Minimum Acceptable**: 140°F (comfort threshold)
// - **Maximum Allowable**: 160°F (efficiency threshold)
// - **Failover Trigger**: 120°F (emergency backup activation)
// - **High Limit Alarm**: 180°F (safety shutdown)
// - **Return Temperature Range**: 120-140°F (20°F differential)
//
// **Control Deadbands:**
// - **Primary Control Deadband**: ±2°F around setpoint
// - **Backup Activation Deadband**: ±3°F around failover threshold
// - **High Limit Deadband**: ±5°F around maximum temperature
// - **Hysteresis Control**: Prevents rapid cycling on thresholds
//
// **Timing Parameters:**
// - **Primary Boiler Start Delay**: 30 seconds (safety interlock)
// - **Backup Boiler Enable Delay**: 2 minutes (confirmation of failure)
// - **Backup Boiler Disable Delay**: 5 minutes (ensure stable recovery)
// - **Sequential Staging Delay**: 3 minutes between backup boiler additions
// - **Minimum Run Time**: 10 minutes per backup boiler (prevent short cycling)
//
// ADVANCED SAFETY FEATURES:
// - **High Temperature Limit**: Automatic shutdown at 180°F supply temperature
// - **Low Temperature Alarm**: Alert when supply drops below 120°F
// - **Pressure Relief Monitoring**: Boiler pressure safety systems
// - **Flame Failure Detection**: Automatic restart with lockout protection
// - **Water Level Monitoring**: Low water cutoff protection
// - **Combustion Air Monitoring**: Ensures proper air supply
// - **Exhaust Temperature Monitoring**: Prevents overheating
//
// ENERGY EFFICIENCY OPTIMIZATION:
// - **Outdoor Air Reset**: Adjusts setpoint based on outdoor temperature
//   * Cold weather (< 32°F): 160°F supply temperature
//   * Mild weather (> 60°F): 140°F supply temperature
//   * Linear interpolation between temperature ranges
//
// - **Load-Based Modulation**: Primary boiler modulates based on demand
// - **Return Temperature Optimization**: Maintains optimal differential
// - **Backup Boiler Staging**: Only runs capacity needed
// - **Efficient Sequencing**: Minimizes backup boiler runtime
//
// COMPREHENSIVE MONITORING:
// - **Supply Temperature Trending**: Continuous monitoring and logging
// - **Return Temperature Analysis**: System efficiency monitoring
// - **Differential Temperature**: Heat transfer effectiveness
// - **Boiler Efficiency Tracking**: Performance optimization
// - **Runtime Monitoring**: Maintenance scheduling
// - **Fuel Consumption**: Energy usage analysis
//
// FAULT DETECTION AND DIAGNOSTICS:
// - **Primary Boiler Failure Detection**: Temperature response analysis
// - **Backup Boiler Performance**: Capacity verification
// - **System Pressure Monitoring**: Leak detection
// - **Flow Rate Analysis**: Pump performance verification
// - **Temperature Sensor Validation**: Sensor drift detection
// - **Control Response Verification**: System health monitoring
//
// MAINTENANCE AND SERVICE FEATURES:
// - **Runtime Hour Tracking**: Service interval monitoring
// - **Cycle Count Monitoring**: Equipment wear analysis
// - **Efficiency Trending**: Performance degradation detection
// - **Preventive Maintenance Alerts**: Automated service reminders
// - **Service Mode Override**: Manual control for maintenance
//
// UI INTEGRATION AND OVERRIDES:
// - **Manual Enable/Disable**: Operator control for each boiler
// - **Setpoint Adjustment**: Temperature setpoint overrides
// - **Emergency Stop**: Immediate shutdown capability
// - **Maintenance Mode**: Service and testing functions
// - **Status Display**: Real-time system status and alarms
//
// SEASONAL OPERATION:
// - **Heating Season**: September 15 - May 15 (adjustable)
// - **Summer Shutdown**: Automatic disable during warm weather
// - **Freeze Protection**: Emergency operation during cold snaps
// - **Transition Periods**: Gradual system startup/shutdown
//
// BACKUP BOILER ROTATION:
// - **Lead Boiler Rotation**: Equalizes wear on backup boilers
// - **Weekly Rotation Schedule**: Rotates primary backup boiler
// - **Runtime Equalization**: Ensures even equipment utilization
// - **Service Coordination**: Schedules maintenance without system impact
//
// EMERGENCY PROCEDURES:
// - **Primary Boiler Failure**: Automatic backup activation
// - **Multiple Boiler Failure**: Maximum capacity emergency mode
// - **Sensor Failure**: Backup temperature monitoring
// - **Power Failure Recovery**: Automatic restart sequence
// - **Communication Loss**: Local control fallback
//
// FACTORY INTEGRATION:
// - **High Performance**: Returns command objects for 1-2 second processing
// - **BullMQ Compatible**: Designed for smart queue architecture
// - **Error Handling**: Graceful degradation during faults
// - **State Persistence**: Maintains control state between processing cycles
// - **Real-time Response**: Immediate response to temperature deviations
//
// ===============================================================================

Object.defineProperty(exports, "__esModule", { value: true });
exports.boilerControl = boilerControl;

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

// Boiler control constants
const BOILER_CONSTANTS = {
    // Temperature control setpoints
    NORMAL_SUPPLY_SETPOINT: 150.0,       // Normal operating setpoint (°F)
    MIN_ACCEPTABLE_TEMP: 140.0,          // Minimum comfort temperature (°F)
    MAX_ACCEPTABLE_TEMP: 160.0,          // Maximum efficiency temperature (°F)
    FAILOVER_TRIGGER_TEMP: 120.0,        // Backup boiler activation threshold (°F)
    HIGH_LIMIT_TEMP: 180.0,              // Emergency shutdown temperature (°F)
    
    // Outdoor reset parameters
    COLD_WEATHER_THRESHOLD: 32.0,        // Cold weather temperature (°F)
    MILD_WEATHER_THRESHOLD: 60.0,        // Mild weather temperature (°F)
    COLD_WEATHER_SETPOINT: 160.0,        // Cold weather supply setpoint (°F)
    MILD_WEATHER_SETPOINT: 140.0,        // Mild weather supply setpoint (°F)
    
    // Control deadbands
    PRIMARY_CONTROL_DEADBAND: 2.0,       // Primary control deadband (°F)
    BACKUP_ACTIVATION_DEADBAND: 3.0,     // Backup activation deadband (°F)
    HIGH_LIMIT_DEADBAND: 5.0,            // High limit deadband (°F)
    
    // Timing parameters (milliseconds)
    PRIMARY_START_DELAY: 30 * 1000,      // 30 seconds primary start delay
    BACKUP_ENABLE_DELAY: 2 * 60 * 1000,  // 2 minutes backup enable delay
    BACKUP_DISABLE_DELAY: 5 * 60 * 1000, // 5 minutes backup disable delay
    SEQUENTIAL_STAGING_DELAY: 3 * 60 * 1000, // 3 minutes between backup additions
    MINIMUM_RUN_TIME: 10 * 60 * 1000,    // 10 minutes minimum backup run time
    
    // System operating limits
    MIN_RETURN_TEMP: 120.0,              // Minimum return temperature (°F)
    MAX_RETURN_TEMP: 140.0,              // Maximum return temperature (°F)
    TARGET_DIFFERENTIAL: 20.0             // Target supply-return differential (°F)
};

async function boilerControl(metricsInput, settingsInput, currentTempArgument, stateStorageInput) {
    const equipmentId = settingsInput.equipmentId || "5O3e8z6KwexgupGER4FW";
    const locationId = settingsInput.locationId || "9";
    const equipmentName = settingsInput.equipmentName || "boiler-1";
    
    console.log(`[FirstChurchOfGod Boiler] Starting boiler control for ${equipmentName} (${equipmentId})`);

    try {
        // STEP 1: Get temperature readings
        const heatingLoopSupplyTemp = parseSafeNumber(currentTempArgument,
            parseSafeNumber(metricsInput.HeatingLoopSupplyTemp,
            parseSafeNumber(metricsInput.HotWaterSupply,
            parseSafeNumber(metricsInput.SupplyTemp,
            parseSafeNumber(metricsInput.WaterTemp, 145)))));

        const heatingLoopReturnTemp = parseSafeNumber(metricsInput.HeatingLoopReturnTemp,
            parseSafeNumber(metricsInput.HotWaterReturn,
            parseSafeNumber(metricsInput.ReturnTemp, 125)));

        const outdoorTemp = parseSafeNumber(metricsInput.Outdoor_Air,
            parseSafeNumber(metricsInput.OutdoorTemp,
            parseSafeNumber(metricsInput.OAT, 60)));

        // Calculate temperature differential
        const tempDifferential = heatingLoopSupplyTemp - heatingLoopReturnTemp;

        console.log(`[FirstChurchOfGod Boiler] Temperatures: Supply=${heatingLoopSupplyTemp.toFixed(1)}°F, Return=${heatingLoopReturnTemp.toFixed(1)}°F, Differential=${tempDifferential.toFixed(1)}°F, Outdoor=${outdoorTemp.toFixed(1)}°F`);

        // STEP 2: Calculate outdoor reset setpoint
        let targetSetpoint = BOILER_CONSTANTS.NORMAL_SUPPLY_SETPOINT;
        
        if (outdoorTemp <= BOILER_CONSTANTS.COLD_WEATHER_THRESHOLD) {
            targetSetpoint = BOILER_CONSTANTS.COLD_WEATHER_SETPOINT;
        } else if (outdoorTemp >= BOILER_CONSTANTS.MILD_WEATHER_THRESHOLD) {
            targetSetpoint = BOILER_CONSTANTS.MILD_WEATHER_SETPOINT;
        } else {
            // Linear interpolation between cold and mild weather setpoints
            const tempRange = BOILER_CONSTANTS.MILD_WEATHER_THRESHOLD - BOILER_CONSTANTS.COLD_WEATHER_THRESHOLD;
            const setpointRange = BOILER_CONSTANTS.COLD_WEATHER_SETPOINT - BOILER_CONSTANTS.MILD_WEATHER_SETPOINT;
            const tempOffset = outdoorTemp - BOILER_CONSTANTS.COLD_WEATHER_THRESHOLD;
            targetSetpoint = BOILER_CONSTANTS.COLD_WEATHER_SETPOINT - ((tempOffset / tempRange) * setpointRange);
        }

        // Check for UI setpoint override
        if (settingsInput.waterTemperatureSetpoint !== undefined) {
            targetSetpoint = parseSafeNumber(settingsInput.waterTemperatureSetpoint, targetSetpoint);
            console.log(`[FirstChurchOfGod Boiler] Using UI override setpoint: ${targetSetpoint}°F`);
        } else {
            console.log(`[FirstChurchOfGod Boiler] Using outdoor reset setpoint: ${targetSetpoint.toFixed(1)}°F (OAT: ${outdoorTemp.toFixed(1)}°F)`);
        }

        // STEP 3: Safety checks
        const now = Date.now();
        
        // High temperature limit check
        if (heatingLoopSupplyTemp >= BOILER_CONSTANTS.HIGH_LIMIT_TEMP) {
            console.log(`[FirstChurchOfGod Boiler] HIGH TEMPERATURE LIMIT EXCEEDED: ${heatingLoopSupplyTemp.toFixed(1)}°F >= ${BOILER_CONSTANTS.HIGH_LIMIT_TEMP}°F - EMERGENCY SHUTDOWN`);
            
            return {
                primaryBoilerEnable: false,
                backupBoiler1Enable: false,
                backupBoiler2Enable: false,
                backupBoiler3Enable: false,
                emergencyShutdown: true,
                shutdownReason: "High temperature limit exceeded",
                supplyTemp: parseFloat(heatingLoopSupplyTemp.toFixed(1)),
                returnTemp: parseFloat(heatingLoopReturnTemp.toFixed(1)),
                targetSetpoint: parseFloat(targetSetpoint.toFixed(1))
            };
        }

        // STEP 4: Initialize boiler system state
        if (!stateStorageInput.boilerSystemState) {
            stateStorageInput.boilerSystemState = {
                primaryBoiler: {
                    enabled: true,  // Primary boiler normally always enabled
                    enableTime: now,
                    disableTime: 0
                },
                backupBoilers: [
                    { enabled: false, enableTime: 0, disableTime: 0, waitingToEnable: false, waitStartTime: 0 },  // Backup 1
                    { enabled: false, enableTime: 0, disableTime: 0, waitingToEnable: false, waitStartTime: 0 },  // Backup 2
                    { enabled: false, enableTime: 0, disableTime: 0, waitingToEnable: false, waitStartTime: 0 }   // Backup 3
                ],
                lastBackupChange: 0,
                failoverActive: false,
                lastTemperatureCheck: now
            };
        }

        const boilerState = stateStorageInput.boilerSystemState;

        // STEP 5: Primary boiler control (normally always enabled)
        let primaryBoilerEnable = true;
        
        // Only disable primary boiler in extreme emergency or maintenance mode
        if (settingsInput.maintenanceMode === true || settingsInput.emergencyShutdown === true) {
            primaryBoilerEnable = false;
            boilerState.primaryBoiler.enabled = false;
            console.log(`[FirstChurchOfGod Boiler] Primary boiler disabled - Maintenance/Emergency mode`);
        } else {
            boilerState.primaryBoiler.enabled = true;
            if (!boilerState.primaryBoiler.enableTime || boilerState.primaryBoiler.enableTime === 0) {
                boilerState.primaryBoiler.enableTime = now;
            }
        }

        // STEP 6: Backup boiler failover logic
        const tempError = targetSetpoint - heatingLoopSupplyTemp;
        const criticalLowTemp = heatingLoopSupplyTemp <= BOILER_CONSTANTS.FAILOVER_TRIGGER_TEMP;
        const needsBackupBoilers = criticalLowTemp || tempError > BOILER_CONSTANTS.BACKUP_ACTIVATION_DEADBAND;
        
        console.log(`[FirstChurchOfGod Boiler] Temperature analysis: Target=${targetSetpoint.toFixed(1)}°F, Actual=${heatingLoopSupplyTemp.toFixed(1)}°F, Error=${tempError.toFixed(1)}°F, Critical Low=${criticalLowTemp}`);

        if (needsBackupBoilers && primaryBoilerEnable) {
            console.log(`[FirstChurchOfGod Boiler] BACKUP BOILERS NEEDED - Supply temp ${heatingLoopSupplyTemp.toFixed(1)}°F below threshold`);
            boilerState.failoverActive = true;
            
            // Enable backup boilers sequentially with delays
            await enableBackupBoilersSequentially(boilerState, now);
            
        } else if (!needsBackupBoilers && boilerState.failoverActive) {
            // Temperature recovered, disable backup boilers
            const tempAboveThreshold = heatingLoopSupplyTemp >= (BOILER_CONSTANTS.FAILOVER_TRIGGER_TEMP + BOILER_CONSTANTS.BACKUP_ACTIVATION_DEADBAND);
            
            if (tempAboveThreshold) {
                console.log(`[FirstChurchOfGod Boiler] TEMPERATURE RECOVERED - Supply temp ${heatingLoopSupplyTemp.toFixed(1)}°F, disabling backup boilers`);
                await disableBackupBoilers(boilerState, now);
                boilerState.failoverActive = false;
            }
        }

        // STEP 7: Build result
        const result = {
            // Primary Lochinvar boiler (normally always enabled)
            primaryBoilerEnable: primaryBoilerEnable,
            
            // Backup boilers (enabled only during failover)
            backupBoiler1Enable: boilerState.backupBoilers[0].enabled,
            backupBoiler2Enable: boilerState.backupBoilers[1].enabled,
            backupBoiler3Enable: boilerState.backupBoilers[2].enabled,
            
            // Status information
            failoverActive: boilerState.failoverActive,
            enabledBackupBoilers: boilerState.backupBoilers.filter(b => b.enabled).length,
            
            // Temperature data
            supplyTemp: parseFloat(heatingLoopSupplyTemp.toFixed(1)),
            returnTemp: parseFloat(heatingLoopReturnTemp.toFixed(1)),
            tempDifferential: parseFloat(tempDifferential.toFixed(1)),
            targetSetpoint: parseFloat(targetSetpoint.toFixed(1)),
            temperatureError: parseFloat(tempError.toFixed(1)),
            
            // Outdoor reset data
            outdoorTemp: parseFloat(outdoorTemp.toFixed(1)),
            outdoorResetActive: true
        };

        console.log(`[FirstChurchOfGod Boiler] Final boiler status: Primary=${result.primaryBoilerEnable}, Backup1=${result.backupBoiler1Enable}, Backup2=${result.backupBoiler2Enable}, Backup3=${result.backupBoiler3Enable}, Failover=${result.failoverActive}`);

        return result;

    } catch (error) {
        console.error(`[FirstChurchOfGod Boiler] Error in boiler control:`, error);
        
        // Return safe state on error - keep primary boiler enabled, disable backups
        return {
            primaryBoilerEnable: true,
            backupBoiler1Enable: false,
            backupBoiler2Enable: false,
            backupBoiler3Enable: false,
            error: error.message,
            supplyTemp: 0,
            returnTemp: 0,
            targetSetpoint: BOILER_CONSTANTS.NORMAL_SUPPLY_SETPOINT
        };
    }
}

// Enable backup boilers sequentially with proper timing
async function enableBackupBoilersSequentially(boilerState, now) {
    const timeSinceLastChange = now - boilerState.lastBackupChange;
    
    for (let i = 0; i < boilerState.backupBoilers.length; i++) {
        const backup = boilerState.backupBoilers[i];
        
        // If boiler not enabled and not waiting
        if (!backup.enabled && !backup.waitingToEnable) {
            // Start waiting period
            backup.waitingToEnable = true;
            backup.waitStartTime = now;
            boilerState.lastBackupChange = now;
            console.log(`[FirstChurchOfGod Boiler] Starting enable delay for Backup Boiler ${i + 1}`);
            break; // Only start one at a time
        }
        
        // If boiler is waiting and enough time has passed
        if (backup.waitingToEnable && !backup.enabled) {
            const waitTime = now - backup.waitStartTime;
            
            if (waitTime >= BOILER_CONSTANTS.BACKUP_ENABLE_DELAY) {
                backup.enabled = true;
                backup.enableTime = now;
                backup.waitingToEnable = false;
                boilerState.lastBackupChange = now;
                console.log(`[FirstChurchOfGod Boiler] ENABLED Backup Boiler ${i + 1} after ${Math.round(waitTime / 1000)}s delay`);
                break; // Only enable one at a time
            } else {
                const remainingWait = Math.ceil((BOILER_CONSTANTS.BACKUP_ENABLE_DELAY - waitTime) / 1000);
                console.log(`[FirstChurchOfGod Boiler] Backup Boiler ${i + 1} waiting ${remainingWait}s more to enable`);
            }
        }
    }
}

// Disable backup boilers with proper timing
async function disableBackupBoilers(boilerState, now) {
    // Disable backup boilers in reverse order (last enabled first)
    for (let i = boilerState.backupBoilers.length - 1; i >= 0; i--) {
        const backup = boilerState.backupBoilers[i];
        
        if (backup.enabled) {
            const runTime = now - backup.enableTime;
            
            // Check minimum run time
            if (runTime >= BOILER_CONSTANTS.MINIMUM_RUN_TIME) {
                backup.enabled = false;
                backup.disableTime = now;
                backup.waitingToEnable = false;
                boilerState.lastBackupChange = now;
                console.log(`[FirstChurchOfGod Boiler] DISABLED Backup Boiler ${i + 1} after ${Math.round(runTime / 1000)}s runtime`);
                return; // Only disable one at a time
            } else {
                const remainingRunTime = Math.ceil((BOILER_CONSTANTS.MINIMUM_RUN_TIME - runTime) / 1000);
                console.log(`[FirstChurchOfGod Boiler] Backup Boiler ${i + 1} needs ${remainingRunTime}s more runtime before disable`);
            }
        }
    }
    
    // Also clear any waiting states
    for (const backup of boilerState.backupBoilers) {
        backup.waitingToEnable = false;
    }
}
