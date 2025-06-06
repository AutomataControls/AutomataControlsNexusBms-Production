"use strict";
// @ts-nocheck
// lib/equipment-logic/locations/firstchurchofgod/pumps.ts
//
// Author: Juelz NeuralBms DevOps
// Last Updated: June 4, 2025
//
// ===============================================================================
// FIRSTCHURCHOFGOD PUMP CONTROL LOGIC - INTELLIGENT LEAD-LAG OPERATION
// ===============================================================================
//
// OVERVIEW:
// This file controls the comprehensive pump systems at FirstChurchOfGod location,
// featuring intelligent lead-lag operation for both cooling and heating circulation
// pumps. The system provides redundancy, automatic failover, and optimized energy
// efficiency through demand-based control and automatic pump rotation.
//
// EQUIPMENT SPECIFICATIONS:
// **Cooling Water Pump System:**
// - CW Pump 1: u6gdCAFDKYZ00Dq6j3Pq (Primary/Lead)
//   * Type: Variable speed chilled water circulation pump
//   * Capacity: Sized for full cooling system load
//   * Control: Enable/disable + variable speed (20-100%)
//   * Lead pump in normal operation
//
// - CW Pump 2: uF3dFIwcULobnRTy5R5W (Secondary/Lag)
//   * Type: Variable speed chilled water circulation pump
//   * Capacity: Equal to primary pump for full redundancy
//   * Control: Enable/disable + variable speed (20-100%)
//   * Lag pump for additional capacity and backup
//
// **Heating Water Pump System:**
// - HW Pump 1: b6bcTD5PVO9BBDkJcfQA (Primary/Lead)
//   * Type: Variable speed hot water circulation pump
//   * Capacity: Sized for full heating system load
//   * Control: Enable/disable + variable speed (20-100%)
//   * Lead pump in normal operation
//
// - HW Pump 2: OqwYSV2rnB5sWOWusu6X (Secondary/Lag)
//   * Type: Variable speed hot water circulation pump
//   * Capacity: Equal to primary pump for full redundancy
//   * Control: Enable/disable + variable speed (20-100%)
//   * Lag pump for additional capacity and backup
//
// ADVANCED CONTROL STRATEGY:
// 1. **Lead-Lag Operation**
//    - Primary pump operates first to meet system demand
//    - Secondary pump adds capacity when demand exceeds lead pump capability
//    - Automatic failover if primary pump fails or cannot meet demand
//    - Smooth transitions prevent system pressure fluctuations
//
// 2. **Demand-Based Control**
//    - Cooling pumps respond to chiller staging and cooling load
//    - Heating pumps respond to boiler operation and heating demand
//    - Variable speed control optimizes energy consumption
//    - System pressure and flow monitoring for precise control
//
// 3. **Automatic Pump Rotation**
//    - Weekly rotation of lead/lag roles prevents uneven wear
//    - Runtime hour equalization ensures balanced equipment life
//    - Rotation only occurs during system downtime for safety
//    - Manual override capability for maintenance requirements
//
// 4. **Intelligent Failover Protection**
//    - Continuous monitoring of pump performance and health
//    - Automatic switchover on pump failure or performance degradation
//    - Multiple failure detection methods (pressure, flow, amperage)
//    - Graceful degradation maintains system operation
//
// DETAILED OPERATING LOGIC:
// **Cooling Pump Control:**
// - **Single Pump Operation**: Lead pump at variable speed (20-80%)
// - **Dual Pump Operation**: Both pumps when chiller demand > 70%
// - **Chiller Integration**: Pump speed follows chiller staging
//   * 1 chiller stage: 40% speed, lead pump only
//   * 2-3 chiller stages: 60-80% speed, consider lag pump
//   * 4 chiller stages or Chiller 2: Both pumps, maximum speed
//
// **Heating Pump Control:**
// - **Single Pump Operation**: Lead pump at variable speed (30-80%)
// - **Dual Pump Operation**: Both pumps when boiler demand > 60%
// - **Boiler Integration**: Pump speed follows boiler loading
//   * Primary boiler only: Variable speed based on outdoor temperature
//   * Backup boilers active: Higher speeds, consider lag pump
//   * Multiple backup boilers: Both pumps, maximum capacity
//
// **Speed Control Algorithm:**
// - **Minimum Speed**: 20% (maintains circulation and prevents deadheading)
// - **Maximum Speed**: 100% (full capacity for peak demand)
// - **Speed Ramping**: Gradual increases/decreases (5% per minute)
// - **Pressure Control**: Maintains optimal system pressure differential
// - **Energy Optimization**: Uses lowest speed that meets demand
//
// COMPREHENSIVE SAFETY FEATURES:
// - **Deadheading Protection**: Minimum speed prevents pump damage
// - **Pressure Monitoring**: High/low pressure alarms and protection
// - **Flow Verification**: Low flow detection and pump failure indication
// - **Amperage Monitoring**: Motor overload protection and fault detection
// - **Temperature Protection**: Motor temperature monitoring
// - **Vibration Monitoring**: Mechanical condition assessment
// - **Dry Run Protection**: Prevents operation without adequate water flow
//
// ENERGY EFFICIENCY OPTIMIZATION:
// - **Variable Speed Control**: Reduces energy consumption at part loads
// - **Lead-Lag Staging**: Operates minimum number of pumps needed
// - **Automatic Rotation**: Prevents efficiency loss from uneven wear
// - **Demand Response**: Adjusts operation based on actual system needs
// - **Pressure Optimization**: Maintains minimum pressure for adequate flow
// - **Schedule Integration**: Reduces operation during unoccupied periods
//
// MAINTENANCE AND MONITORING:
// - **Runtime Hour Tracking**: Individual pump runtime for service scheduling
// - **Performance Trending**: Efficiency and capacity monitoring over time
// - **Predictive Maintenance**: Early warning of performance degradation
// - **Fault History**: Comprehensive logging of all pump faults and alarms
// - **Service Mode**: Manual control for testing and maintenance
// - **Rotation Scheduling**: Automatic and manual pump role changes
//
// FIRESTORE INTEGRATION:
// - **Equipment Groups**: FirstChurchofGodCoolingPumps & FirstChurchofGodHeatingPumps
// - **Real-time Status**: Live pump status, speeds, and performance data
// - **Configuration Management**: Setpoints, schedules, and operating parameters
// - **Historical Data**: Performance trends, runtime hours, and maintenance history
// - **Alarm Management**: Real-time fault notification and acknowledgment
// - **Remote Control**: Manual overrides and emergency stop capabilities
//
// FACTORY INTEGRATION:
// - **High Performance**: Returns command objects for 1-2 second processing
// - **BullMQ Compatible**: Designed for smart queue architecture
// - **Error Handling**: Graceful degradation during communication faults
// - **State Persistence**: Maintains pump states between processing cycles
// - **Real-time Response**: Immediate response to system demand changes
//
// ===============================================================================

Object.defineProperty(exports, "__esModule", { value: true });
exports.pumpControl = pumpControl;

// Import lead-lag helpers
const leadLagHelpers = require('./lead-lag-helpers');

// Helper to safely parse numbers
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

// Pump control constants
const PUMP_CONSTANTS = {
    // Speed control
    MIN_PUMP_SPEED: 20,               // Minimum pump speed (%)
    MAX_PUMP_SPEED: 100,              // Maximum pump speed (%)
    SPEED_RAMP_RATE: 5,               // Speed change per minute (%)
    
    // Timing constants
    PUMP_START_DELAY: 30 * 1000,      // 30 seconds start delay
    PUMP_STOP_DELAY: 60 * 1000,       // 60 seconds stop delay
    LAG_PUMP_ENABLE_DELAY: 2 * 60 * 1000,    // 2 minutes lag enable delay
    LAG_PUMP_DISABLE_DELAY: 3 * 60 * 1000,   // 3 minutes lag disable delay
    MINIMUM_RUN_TIME: 5 * 60 * 1000,  // 5 minutes minimum run time
    
    // Performance thresholds
    COOLING_LAG_THRESHOLD: 0.7,       // 70% demand triggers cooling lag pump
    HEATING_LAG_THRESHOLD: 0.6,       // 60% demand triggers heating lag pump
    
    // Pressure and flow limits
    MIN_PRESSURE: 10.0,               // Minimum system pressure (PSI)
    MAX_PRESSURE: 30.0,               // Maximum system pressure (PSI)
    MIN_FLOW_RATE: 50.0,              // Minimum flow rate (GPM)
    MAX_AMPERAGE: 15.0                // Maximum motor amperage
};

async function pumpControl(metricsInput, settingsInput, currentTempArgument, stateStorageInput) {
    const equipmentId = settingsInput.equipmentId;
    const locationId = settingsInput.locationId || "9";
    const equipmentName = settingsInput.equipmentName || "pump";
    
    console.log(`[FirstChurchOfGod Pumps] Starting pump control for ${equipmentName} (${equipmentId})`);

    try {
        // STEP 1: Determine pump type and group
        const pumpType = determinePumpType(equipmentId, equipmentName);
        if (!pumpType) {
            throw new Error(`Unknown pump equipment ID: ${equipmentId}`);
        }
        
        console.log(`[FirstChurchOfGod Pumps] Controlling ${pumpType.type} pump: ${pumpType.name}`);

        // STEP 2: Get appropriate pump group
        let pumpGroupResult;
        if (pumpType.system === 'cooling') {
            pumpGroupResult = await leadLagHelpers.getFirstChurchOfGodCoolingPumpGroup(stateStorageInput);
        } else {
            pumpGroupResult = await leadLagHelpers.getFirstChurchOfGodHeatingPumpGroup(stateStorageInput);
        }

        if (!pumpGroupResult.success) {
            throw new Error(`Failed to get pump group: ${pumpGroupResult.error}`);
        }

        const pumpGroup = pumpGroupResult.group;
        const thisPump = pumpGroup.pumps.find(pump => pump.id === equipmentId);
        
        if (!thisPump) {
            throw new Error(`Pump ${equipmentId} not found in group ${pumpGroup.groupName}`);
        }

        // STEP 3: Check for pump rotation
        const rotationResult = await leadLagHelpers.rotateFCOGPumpLeadership(pumpGroup);
        if (rotationResult.rotated) {
            console.log(`[FirstChurchOfGod Pumps] ${pumpGroup.groupName} rotated: ${rotationResult.newLead} is now lead`);
        }

        // STEP 4: Calculate system demand
        const systemStatus = gatherSystemStatus(metricsInput, pumpType.system);
        const demandResult = await leadLagHelpers.calculateFCOGPumpDemand(
            pumpType.system === 'cooling' ? 'cooling-pumps' : 'heating-pumps',
            metricsInput,
            systemStatus
        );

        console.log(`[FirstChurchOfGod Pumps] System demand: ${(demandResult.demandLevel * 100).toFixed(0)}%, Lag needed: ${demandResult.needsLagPump}, Recommended speed: ${demandResult.recommendedSpeed}%`);

        // STEP 5: Control pump based on lead/lag logic
        const controlResult = await controlPumpLeadLag(
            thisPump, 
            pumpGroup, 
            demandResult, 
            metricsInput, 
            stateStorageInput
        );

        // STEP 6: Check pump health
        const healthResult = await leadLagHelpers.checkFirstChurchOfGodPumpHealth(pumpGroup, metricsInput);
        
        // STEP 7: Build and return result
        const result = {
            // Pump control outputs
            pumpEnable: controlResult.enabled,
            pumpSpeed: controlResult.speed,
            
            // Status information
            pumpRole: thisPump.isLead ? 'lead' : 'lag',
            groupDemand: parseFloat((demandResult.demandLevel * 100).toFixed(1)),
            activePumps: pumpGroup.activePumps,
            
            // Health and performance
            pumpHealth: healthResult.groupHealth,
            pumpStatus: thisPump.status,
            runtimeHours: parseFloat(thisPump.runtimeHours.toFixed(1)),
            
            // System integration
            systemType: pumpType.system,
            equipmentGroup: pumpGroup.groupName,
            
            // Operational data
            lastStartTime: thisPump.lastStartTime,
            faultCount: thisPump.faultCount
        };

        console.log(`[FirstChurchOfGod Pumps] ${pumpType.name} final status: Enabled=${result.pumpEnable}, Speed=${result.pumpSpeed}%, Role=${result.pumpRole}, Health=${result.pumpHealth}`);

        return result;

    } catch (error) {
        console.error(`[FirstChurchOfGod Pumps] Error in pump control:`, error);
        
        // Return safe state on error
        return {
            pumpEnable: false,
            pumpSpeed: 0,
            pumpRole: 'unknown',
            groupDemand: 0,
            activePumps: 0,
            pumpHealth: 'error',
            pumpStatus: 'error',
            systemType: 'unknown',
            error: error.message
        };
    }
}

// Determine pump type and system from equipment ID
function determinePumpType(equipmentId, equipmentName) {
    const pumpMappings = {
        'u6gdCAFDKYZ00Dq6j3Pq': { type: 'primary', system: 'cooling', name: 'CW Pump 1' },
        'uF3dFIwcULobnRTy5R5W': { type: 'secondary', system: 'cooling', name: 'CW Pump 2' },
        'b6bcTD5PVO9BBDkJcfQA': { type: 'primary', system: 'heating', name: 'HW Pump 1' },
        'OqwYSV2rnB5sWOWusu6X': { type: 'secondary', system: 'heating', name: 'HW Pump 2' }
    };
    
    return pumpMappings[equipmentId] || null;
}

// Gather system status for demand calculation
function gatherSystemStatus(metricsInput, systemType) {
    if (systemType === 'cooling') {
        return {
            chillerStages: parseSafeNumber(metricsInput.Chiller1Stages, 0),
            chiller2Enabled: parseSafeBoolean(metricsInput.Chiller2Enabled, false),
            supplyTemp: parseSafeNumber(metricsInput.ChilledWaterSupply, 45),
            returnTemp: parseSafeNumber(metricsInput.ChilledWaterReturn, 55),
            outdoorTemp: parseSafeNumber(metricsInput.Outdoor_Air, 75)
        };
    } else {
        return {
            primaryBoilerEnabled: parseSafeBoolean(metricsInput.PrimaryBoilerEnabled, true),
            activeBackupBoilers: parseSafeNumber(metricsInput.ActiveBackupBoilers, 0),
            supplyTemp: parseSafeNumber(metricsInput.HotWaterSupply, 150),
            returnTemp: parseSafeNumber(metricsInput.HotWaterReturn, 130),
            outdoorTemp: parseSafeNumber(metricsInput.Outdoor_Air, 60)
        };
    }
}

// Control individual pump based on lead-lag logic
async function controlPumpLeadLag(thisPump, pumpGroup, demandResult, metricsInput, stateStorageInput) {
    const now = Date.now();
    
    console.log(`[FirstChurchOfGod Pumps] Controlling ${thisPump.name} - Role: ${thisPump.isLead ? 'Lead' : 'Lag'}, Current: Enabled=${thisPump.enabled}, Speed=${thisPump.speed}%`);
    
    // Initialize pump timing state if needed
    if (!stateStorageInput.pumpTimingState) {
        stateStorageInput.pumpTimingState = {};
    }
    
    if (!stateStorageInput.pumpTimingState[thisPump.id]) {
        stateStorageInput.pumpTimingState[thisPump.id] = {
            lastSpeedChange: 0,
            enableRequestTime: 0,
            disableRequestTime: 0,
            targetSpeed: 0
        };
    }
    
    const timingState = stateStorageInput.pumpTimingState[thisPump.id];
    
    let shouldEnable = false;
    let targetSpeed = PUMP_CONSTANTS.MIN_PUMP_SPEED;
    
    // LEAD PUMP LOGIC
    if (thisPump.isLead) {
        // Lead pump operates when there's any demand
        if (demandResult.demandLevel > 0) {
            shouldEnable = true;
            targetSpeed = Math.max(PUMP_CONSTANTS.MIN_PUMP_SPEED, demandResult.recommendedSpeed);
            console.log(`[FirstChurchOfGod Pumps] Lead pump ${thisPump.name} should run at ${targetSpeed}% (demand: ${(demandResult.demandLevel * 100).toFixed(0)}%)`);
        } else {
            shouldEnable = false;
            targetSpeed = 0;
            console.log(`[FirstChurchOfGod Pumps] Lead pump ${thisPump.name} should stop (no demand)`);
        }
    }
    // LAG PUMP LOGIC
    else {
        // Lag pump operates when demand exceeds threshold AND lead pump is running
        const leadPump = pumpGroup.pumps.find(pump => pump.isLead);
        const leadPumpRunning = leadPump && leadPump.enabled;
        
        if (demandResult.needsLagPump && leadPumpRunning) {
            shouldEnable = true;
            targetSpeed = Math.max(PUMP_CONSTANTS.MIN_PUMP_SPEED, demandResult.recommendedSpeed);
            console.log(`[FirstChurchOfGod Pumps] Lag pump ${thisPump.name} should run at ${targetSpeed}% (high demand + lead running)`);
        } else {
            shouldEnable = false;
            targetSpeed = 0;
            if (!leadPumpRunning) {
                console.log(`[FirstChurchOfGod Pumps] Lag pump ${thisPump.name} should stop (lead pump not running)`);
            } else {
                console.log(`[FirstChurchOfGod Pumps] Lag pump ${thisPump.name} should stop (demand below threshold)`);
            }
        }
    }
    
    // ENABLE/DISABLE LOGIC WITH TIMING
    let actuallyEnabled = thisPump.enabled;
    
    if (shouldEnable && !thisPump.enabled) {
        // Want to enable pump
        if (timingState.enableRequestTime === 0) {
            timingState.enableRequestTime = now;
            console.log(`[FirstChurchOfGod Pumps] ${thisPump.name} enable request started`);
        }
        
        const enableWaitTime = thisPump.isLead ? PUMP_CONSTANTS.PUMP_START_DELAY : PUMP_CONSTANTS.LAG_PUMP_ENABLE_DELAY;
        const waitTime = now - timingState.enableRequestTime;
        
        if (waitTime >= enableWaitTime) {
            actuallyEnabled = true;
            thisPump.enabled = true;
            thisPump.lastStartTime = now;
            timingState.enableRequestTime = 0;
            console.log(`[FirstChurchOfGod Pumps] ${thisPump.name} ENABLED after ${Math.round(waitTime / 1000)}s delay`);
        } else {
            const remainingWait = Math.ceil((enableWaitTime - waitTime) / 1000);
            console.log(`[FirstChurchOfGod Pumps] ${thisPump.name} waiting ${remainingWait}s more to enable`);
        }
    } else if (!shouldEnable && thisPump.enabled) {
        // Want to disable pump
        if (timingState.disableRequestTime === 0) {
            timingState.disableRequestTime = now;
            console.log(`[FirstChurchOfGod Pumps] ${thisPump.name} disable request started`);
        }
        
        // Check minimum run time
        const runTime = now - thisPump.lastStartTime;
        const disableWaitTime = Math.max(
            thisPump.isLead ? PUMP_CONSTANTS.PUMP_STOP_DELAY : PUMP_CONSTANTS.LAG_PUMP_DISABLE_DELAY,
            PUMP_CONSTANTS.MINIMUM_RUN_TIME - runTime
        );
        
        const waitTime = now - timingState.disableRequestTime;
        
        if (waitTime >= disableWaitTime && runTime >= PUMP_CONSTANTS.MINIMUM_RUN_TIME) {
            actuallyEnabled = false;
            thisPump.enabled = false;
            thisPump.lastStopTime = now;
            timingState.disableRequestTime = 0;
            console.log(`[FirstChurchOfGod Pumps] ${thisPump.name} DISABLED after ${Math.round(waitTime / 1000)}s delay (ran for ${Math.round(runTime / 1000)}s)`);
        } else {
            const remainingWait = Math.ceil((disableWaitTime - waitTime) / 1000);
            console.log(`[FirstChurchOfGod Pumps] ${thisPump.name} waiting ${remainingWait}s more to disable`);
        }
    } else {
        // No change requested, clear timing states
        timingState.enableRequestTime = 0;
        timingState.disableRequestTime = 0;
    }
    
    // SPEED CONTROL WITH RAMPING
    let actualSpeed = thisPump.speed;
    
    if (actuallyEnabled && targetSpeed > 0) {
        // Ramp speed to target
        const speedDifference = targetSpeed - thisPump.speed;
        const timeSinceLastChange = now - timingState.lastSpeedChange;
        
        if (Math.abs(speedDifference) > PUMP_CONSTANTS.SPEED_RAMP_RATE && timeSinceLastChange >= 60000) { // 1 minute between speed changes
            if (speedDifference > 0) {
                actualSpeed = Math.min(targetSpeed, thisPump.speed + PUMP_CONSTANTS.SPEED_RAMP_RATE);
            } else {
                actualSpeed = Math.max(targetSpeed, thisPump.speed - PUMP_CONSTANTS.SPEED_RAMP_RATE);
            }
            timingState.lastSpeedChange = now;
            console.log(`[FirstChurchOfGod Pumps] ${thisPump.name} speed ramping: ${thisPump.speed}% → ${actualSpeed}% (target: ${targetSpeed}%)`);
        } else if (Math.abs(speedDifference) <= PUMP_CONSTANTS.SPEED_RAMP_RATE) {
            actualSpeed = targetSpeed;
        }
        
        // Enforce speed limits
        actualSpeed = Math.max(PUMP_CONSTANTS.MIN_PUMP_SPEED, 
                              Math.min(PUMP_CONSTANTS.MAX_PUMP_SPEED, actualSpeed));
        
        thisPump.speed = actualSpeed;
    } else if (!actuallyEnabled) {
        actualSpeed = 0;
        thisPump.speed = 0;
    }
    
    return {
        enabled: actuallyEnabled,
        speed: actualSpeed,
        targetSpeed: targetSpeed,
        timingState: timingState
    };
}
