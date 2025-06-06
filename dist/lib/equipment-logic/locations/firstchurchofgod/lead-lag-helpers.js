"use strict";
// @ts-nocheck
// lib/equipment-logic/locations/firstchurchofgod/lead-lag-helpers.ts
//
// Author: Juelz NeuralBms DevOps
// Last Updated: June 4, 2025
//
// ===============================================================================
// FIRSTCHURCHOFGOD LEAD-LAG PUMP CONTROL HELPERS
// ===============================================================================
//
// PURPOSE:
// Provides intelligent lead-lag control for FirstChurchOfGod pump groups with
// automatic rotation, failover protection, and optimized runtime distribution.
// Manages both cooling and heating pump groups with independent control logic.
//
// EQUIPMENT GROUPS:
// - FirstChurchofGodCoolingPumps: Chilled water circulation pumps
//   * CW Pump 1: u6gdCAFDKYZ00Dq6j3Pq (Primary/Lead)
//   * CW Pump 2: uF3dFIwcULobnRTy5R5W (Secondary/Lag)
//
// - FirstChurchofGodHeatingPumps: Hot water circulation pumps  
//   * HW Pump 1: b6bcTD5PVO9BBDkJcfQA (Primary/Lead)
//   * HW Pump 2: OqwYSV2rnB5sWOWusu6X (Secondary/Lag)
//
// CONTROL STRATEGY:
// - Lead-Lag Operation: Primary pump runs first, secondary adds capacity
// - Automatic Rotation: Weekly rotation prevents uneven wear
// - Failover Protection: Backup pump activates on primary failure
// - Runtime Equalization: Balances operating hours between pumps
// - Demand-Based Control: Operates pumps based on system requirements
//
// FIRESTORE INTEGRATION:
// - Equipment group configurations stored in Firestore
// - Real-time status updates and control commands
// - Historical runtime and performance data
// - Maintenance scheduling and alerts
//
// ===============================================================================

Object.defineProperty(exports, "__esModule", { value: true });
exports.getFirstChurchOfGodCoolingPumpGroup = getFirstChurchOfGodCoolingPumpGroup;
exports.getFirstChurchOfGodHeatingPumpGroup = getFirstChurchOfGodHeatingPumpGroup;
exports.checkFirstChurchOfGodPumpHealth = checkFirstChurchOfGodPumpHealth;
exports.rotateFCOGPumpLeadership = rotateFCOGPumpLeadership;
exports.calculateFCOGPumpDemand = calculateFCOGPumpDemand;

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

// FirstChurchOfGod pump control constants
const FCOG_PUMP_CONSTANTS = {
    // Lead-lag timing
    LAG_PUMP_ENABLE_DELAY: 2 * 60 * 1000,     // 2 minutes before enabling lag pump
    LAG_PUMP_DISABLE_DELAY: 3 * 60 * 1000,    // 3 minutes before disabling lag pump
    PUMP_MINIMUM_RUN_TIME: 5 * 60 * 1000,     // 5 minutes minimum run time
    
    // Rotation timing
    WEEKLY_ROTATION_INTERVAL: 7 * 24 * 60 * 60 * 1000,  // 7 days
    ROTATION_CHECK_INTERVAL: 24 * 60 * 60 * 1000,       // Daily check
    
    // Performance thresholds
    COOLING_DEMAND_THRESHOLD: 0.7,    // 70% demand triggers lag pump
    HEATING_DEMAND_THRESHOLD: 0.6,    // 60% demand triggers lag pump
    PUMP_FAILURE_THRESHOLD: 5 * 60 * 1000,  // 5 minutes to detect failure
    
    // Pressure and flow thresholds
    MIN_PRESSURE_DIFFERENTIAL: 5.0,   // Minimum pressure differential (PSI)
    MAX_PRESSURE_DIFFERENTIAL: 25.0,  // Maximum pressure differential (PSI)
    MIN_FLOW_RATE: 50.0,             // Minimum flow rate (GPM)
    
    // Speed control
    MIN_PUMP_SPEED: 20,               // Minimum pump speed (%)
    MAX_PUMP_SPEED: 100,              // Maximum pump speed (%)
    SPEED_INCREMENT: 5                // Speed change increment (%)
};

/**
 * Get FirstChurchOfGod Cooling Pump Group configuration and status
 */
async function getFirstChurchOfGodCoolingPumpGroup(stateStorage) {
    try {
        console.log('[FirstChurchOfGod Lead-Lag] Getting cooling pump group configuration');
        
        // Initialize cooling pump group state if needed
        if (!stateStorage.coolingPumpGroup) {
            stateStorage.coolingPumpGroup = {
                groupName: 'FirstChurchofGodCoolingPumps',
                pumps: [
                    {
                        id: 'u6gdCAFDKYZ00Dq6j3Pq',
                        name: 'CW Pump 1',
                        isLead: true,
                        enabled: false,
                        speed: 0,
                        runtimeHours: 0,
                        lastStartTime: 0,
                        lastStopTime: 0,
                        faultCount: 0,
                        status: 'standby'
                    },
                    {
                        id: 'uF3dFIwcULobnRTy5R5W',
                        name: 'CW Pump 2',
                        isLead: false,
                        enabled: false,
                        speed: 0,
                        runtimeHours: 0,
                        lastStartTime: 0,
                        lastStopTime: 0,
                        faultCount: 0,
                        status: 'standby'
                    }
                ],
                lastRotationTime: Date.now(),
                nextRotationDue: Date.now() + FCOG_PUMP_CONSTANTS.WEEKLY_ROTATION_INTERVAL,
                demandLevel: 0,
                systemPressure: 0,
                systemFlow: 0,
                groupEnabled: false
            };
        }
        
        const group = stateStorage.coolingPumpGroup;
        
        // Update group status
        group.groupEnabled = group.pumps.some(pump => pump.enabled);
        group.activePumps = group.pumps.filter(pump => pump.enabled).length;
        group.leadPump = group.pumps.find(pump => pump.isLead);
        group.lagPump = group.pumps.find(pump => !pump.isLead);
        
        console.log(`[FirstChurchOfGod Lead-Lag] Cooling pump group: ${group.activePumps} active, Lead: ${group.leadPump?.name}, Lag: ${group.lagPump?.name}`);
        
        return {
            success: true,
            group: group,
            equipmentType: 'cooling-pumps',
            location: 'FirstChurchOfGod'
        };
        
    } catch (error) {
        console.error('[FirstChurchOfGod Lead-Lag] Error getting cooling pump group:', error);
        return {
            success: false,
            error: error.message,
            group: null
        };
    }
}

/**
 * Get FirstChurchOfGod Heating Pump Group configuration and status
 */
async function getFirstChurchOfGodHeatingPumpGroup(stateStorage) {
    try {
        console.log('[FirstChurchOfGod Lead-Lag] Getting heating pump group configuration');
        
        // Initialize heating pump group state if needed
        if (!stateStorage.heatingPumpGroup) {
            stateStorage.heatingPumpGroup = {
                groupName: 'FirstChurchofGodHeatingPumps',
                pumps: [
                    {
                        id: 'b6bcTD5PVO9BBDkJcfQA',
                        name: 'HW Pump 1',
                        isLead: true,
                        enabled: false,
                        speed: 0,
                        runtimeHours: 0,
                        lastStartTime: 0,
                        lastStopTime: 0,
                        faultCount: 0,
                        status: 'standby'
                    },
                    {
                        id: 'OqwYSV2rnB5sWOWusu6X',
                        name: 'HW Pump 2',
                        isLead: false,
                        enabled: false,
                        speed: 0,
                        runtimeHours: 0,
                        lastStartTime: 0,
                        lastStopTime: 0,
                        faultCount: 0,
                        status: 'standby'
                    }
                ],
                lastRotationTime: Date.now(),
                nextRotationDue: Date.now() + FCOG_PUMP_CONSTANTS.WEEKLY_ROTATION_INTERVAL,
                demandLevel: 0,
                systemPressure: 0,
                systemFlow: 0,
                groupEnabled: false
            };
        }
        
        const group = stateStorage.heatingPumpGroup;
        
        // Update group status
        group.groupEnabled = group.pumps.some(pump => pump.enabled);
        group.activePumps = group.pumps.filter(pump => pump.enabled).length;
        group.leadPump = group.pumps.find(pump => pump.isLead);
        group.lagPump = group.pumps.find(pump => !pump.isLead);
        
        console.log(`[FirstChurchOfGod Lead-Lag] Heating pump group: ${group.activePumps} active, Lead: ${group.leadPump?.name}, Lag: ${group.lagPump?.name}`);
        
        return {
            success: true,
            group: group,
            equipmentType: 'heating-pumps',
            location: 'FirstChurchOfGod'
        };
        
    } catch (error) {
        console.error('[FirstChurchOfGod Lead-Lag] Error getting heating pump group:', error);
        return {
            success: false,
            error: error.message,
            group: null
        };
    }
}

/**
 * Check pump health and performance for FirstChurchOfGod systems
 */
async function checkFirstChurchOfGodPumpHealth(pumpGroup, metricsInput) {
    try {
        console.log(`[FirstChurchOfGod Lead-Lag] Checking pump health for ${pumpGroup.groupName}`);
        
        const healthResults = {
            groupHealth: 'healthy',
            issues: [],
            recommendations: [],
            pumpStatuses: []
        };
        
        const now = Date.now();
        
        for (const pump of pumpGroup.pumps) {
            const pumpHealth = {
                pumpId: pump.id,
                pumpName: pump.name,
                status: 'healthy',
                issues: [],
                metrics: {}
            };
            
            // Check if pump is enabled but not performing
            if (pump.enabled) {
                const runTime = now - pump.lastStartTime;
                
                // Check for failure to start
                if (runTime > FCOG_PUMP_CONSTANTS.PUMP_FAILURE_THRESHOLD && pump.speed === 0) {
                    pumpHealth.status = 'failed';
                    pumpHealth.issues.push('Pump enabled but not running');
                    healthResults.issues.push(`${pump.name}: Failed to start`);
                }
                
                // Check pressure and flow if available
                if (metricsInput) {
                    const pressure = parseSafeNumber(metricsInput[`${pump.name}Pressure`], 0);
                    const flow = parseSafeNumber(metricsInput[`${pump.name}Flow`], 0);
                    const amps = parseSafeNumber(metricsInput[`${pump.name}Amps`], 0);
                    
                    pumpHealth.metrics = { pressure, flow, amps };
                    
                    // Check for low pressure
                    if (pressure > 0 && pressure < FCOG_PUMP_CONSTANTS.MIN_PRESSURE_DIFFERENTIAL) {
                        pumpHealth.issues.push('Low pressure differential');
                        healthResults.issues.push(`${pump.name}: Low pressure (${pressure} PSI)`);
                    }
                    
                    // Check for low flow
                    if (flow > 0 && flow < FCOG_PUMP_CONSTANTS.MIN_FLOW_RATE) {
                        pumpHealth.issues.push('Low flow rate');
                        healthResults.issues.push(`${pump.name}: Low flow (${flow} GPM)`);
                    }
                    
                    // Check for high amperage (potential mechanical issue)
                    if (amps > 15) {  // Typical pump amp limit
                        pumpHealth.issues.push('High amperage draw');
                        healthResults.issues.push(`${pump.name}: High amps (${amps}A)`);
                    }
                }
                
                // Update pump status
                if (pumpHealth.issues.length > 0) {
                    pump.status = 'warning';
                    pump.faultCount++;
                } else {
                    pump.status = 'running';
                    pump.faultCount = Math.max(0, pump.faultCount - 1); // Gradually clear fault count
                }
                
                // Update runtime
                if (pump.lastStartTime > 0) {
                    pump.runtimeHours += (now - pump.lastStartTime) / (1000 * 60 * 60);
                    pump.lastStartTime = now; // Reset for next calculation
                }
            } else {
                pump.status = 'standby';
            }
            
            healthResults.pumpStatuses.push(pumpHealth);
        }
        
        // Determine overall group health
        const failedPumps = healthResults.pumpStatuses.filter(p => p.status === 'failed').length;
        const warningPumps = healthResults.pumpStatuses.filter(p => p.status === 'warning').length;
        
        if (failedPumps > 0) {
            healthResults.groupHealth = 'critical';
        } else if (warningPumps > 0) {
            healthResults.groupHealth = 'warning';
        }
        
        // Generate recommendations
        if (failedPumps > 0) {
            healthResults.recommendations.push('Immediate service required for failed pumps');
        }
        
        const runtimeDifference = Math.abs(pumpGroup.pumps[0].runtimeHours - pumpGroup.pumps[1].runtimeHours);
        if (runtimeDifference > 100) { // More than 100 hours difference
            healthResults.recommendations.push('Consider pump rotation to balance runtime hours');
        }
        
        console.log(`[FirstChurchOfGod Lead-Lag] ${pumpGroup.groupName} health: ${healthResults.groupHealth}, Issues: ${healthResults.issues.length}`);
        
        return healthResults;
        
    } catch (error) {
        console.error('[FirstChurchOfGod Lead-Lag] Error checking pump health:', error);
        return {
            groupHealth: 'unknown',
            issues: [`Health check error: ${error.message}`],
            recommendations: ['Manual inspection recommended'],
            pumpStatuses: []
        };
    }
}

/**
 * Rotate pump leadership for FirstChurchOfGod groups
 */
async function rotateFCOGPumpLeadership(pumpGroup) {
    try {
        const now = Date.now();
        
        // Check if rotation is due
        if (now < pumpGroup.nextRotationDue) {
            const daysUntilRotation = Math.ceil((pumpGroup.nextRotationDue - now) / (24 * 60 * 60 * 1000));
            console.log(`[FirstChurchOfGod Lead-Lag] ${pumpGroup.groupName} rotation in ${daysUntilRotation} days`);
            return { rotated: false, reason: 'Not due for rotation' };
        }
        
        // Only rotate if no pumps are currently running
        const runningPumps = pumpGroup.pumps.filter(pump => pump.enabled);
        if (runningPumps.length > 0) {
            console.log(`[FirstChurchOfGod Lead-Lag] ${pumpGroup.groupName} rotation deferred - pumps running`);
            // Defer rotation by 1 hour
            pumpGroup.nextRotationDue = now + (60 * 60 * 1000);
            return { rotated: false, reason: 'Pumps currently running' };
        }
        
        // Perform rotation
        const currentLead = pumpGroup.pumps.find(pump => pump.isLead);
        const currentLag = pumpGroup.pumps.find(pump => !pump.isLead);
        
        if (currentLead && currentLag) {
            // Swap lead and lag roles
            currentLead.isLead = false;
            currentLag.isLead = true;
            
            // Update rotation timing
            pumpGroup.lastRotationTime = now;
            pumpGroup.nextRotationDue = now + FCOG_PUMP_CONSTANTS.WEEKLY_ROTATION_INTERVAL;
            
            console.log(`[FirstChurchOfGod Lead-Lag] ${pumpGroup.groupName} rotation complete: ${currentLag.name} is now lead, ${currentLead.name} is now lag`);
            
            return {
                rotated: true,
                newLead: currentLag.name,
                newLag: currentLead.name,
                nextRotationDue: pumpGroup.nextRotationDue
            };
        }
        
        return { rotated: false, reason: 'Unable to identify lead/lag pumps' };
        
    } catch (error) {
        console.error('[FirstChurchOfGod Lead-Lag] Error rotating pump leadership:', error);
        return { rotated: false, reason: `Rotation error: ${error.message}` };
    }
}

/**
 * Calculate pump demand for FirstChurchOfGod systems
 */
async function calculateFCOGPumpDemand(equipmentType, metricsInput, systemStatus) {
    try {
        console.log(`[FirstChurchOfGod Lead-Lag] Calculating demand for ${equipmentType}`);
        
        let demandLevel = 0;
        let needsLagPump = false;
        let recommendedSpeed = FCOG_PUMP_CONSTANTS.MIN_PUMP_SPEED;
        
        if (equipmentType === 'cooling-pumps') {
            // Calculate cooling demand based on chiller operation and temperature differential
            const chillerStages = parseSafeNumber(systemStatus?.chillerStages, 0);
            const chiller2Enabled = parseSafeBoolean(systemStatus?.chiller2Enabled, false);
            const tempDifferential = parseSafeNumber(metricsInput?.ChilledWaterDifferential, 0);
            
            // Base demand on chiller loading
            if (chiller2Enabled) {
                demandLevel = 1.0; // Maximum demand - both chillers running
                needsLagPump = true;
                recommendedSpeed = FCOG_PUMP_CONSTANTS.MAX_PUMP_SPEED;
            } else if (chillerStages >= 3) {
                demandLevel = 0.8; // High demand - chiller 1 at 3+ stages
                needsLagPump = true;
                recommendedSpeed = 80;
            } else if (chillerStages >= 2) {
                demandLevel = 0.6; // Medium demand - chiller 1 at 2+ stages
                needsLagPump = demandLevel >= FCOG_PUMP_CONSTANTS.COOLING_DEMAND_THRESHOLD;
                recommendedSpeed = 60;
            } else if (chillerStages >= 1) {
                demandLevel = 0.4; // Low demand - chiller 1 at 1 stage
                needsLagPump = false;
                recommendedSpeed = 40;
            }
            
            console.log(`[FirstChurchOfGod Lead-Lag] Cooling demand: ${(demandLevel * 100).toFixed(0)}% (${chillerStages} stages, Chiller2: ${chiller2Enabled})`);
            
        } else if (equipmentType === 'heating-pumps') {
            // Calculate heating demand based on boiler operation and temperature differential
            const primaryBoilerEnabled = parseSafeBoolean(systemStatus?.primaryBoilerEnabled, false);
            const backupBoilers = parseSafeNumber(systemStatus?.activeBackupBoilers, 0);
            const tempDifferential = parseSafeNumber(metricsInput?.HotWaterDifferential, 0);
            const outdoorTemp = parseSafeNumber(metricsInput?.Outdoor_Air, 60);
            
            // Base demand on boiler loading and outdoor temperature
            if (backupBoilers >= 2) {
                demandLevel = 1.0; // Maximum demand - multiple backup boilers
                needsLagPump = true;
                recommendedSpeed = FCOG_PUMP_CONSTANTS.MAX_PUMP_SPEED;
            } else if (backupBoilers >= 1) {
                demandLevel = 0.8; // High demand - one backup boiler
                needsLagPump = true;
                recommendedSpeed = 80;
            } else if (primaryBoilerEnabled && outdoorTemp < 40) {
                demandLevel = 0.7; // Medium-high demand - cold weather
                needsLagPump = demandLevel >= FCOG_PUMP_CONSTANTS.HEATING_DEMAND_THRESHOLD;
                recommendedSpeed = 70;
            } else if (primaryBoilerEnabled) {
                demandLevel = 0.5; // Medium demand - normal heating
                needsLagPump = false;
                recommendedSpeed = 50;
            }
            
            console.log(`[FirstChurchOfGod Lead-Lag] Heating demand: ${(demandLevel * 100).toFixed(0)}% (Primary: ${primaryBoilerEnabled}, Backups: ${backupBoilers}, OAT: ${outdoorTemp}°F)`);
        }
        
        return {
            demandLevel: parseFloat(demandLevel.toFixed(2)),
            needsLagPump: needsLagPump,
            recommendedSpeed: Math.max(FCOG_PUMP_CONSTANTS.MIN_PUMP_SPEED, 
                                     Math.min(FCOG_PUMP_CONSTANTS.MAX_PUMP_SPEED, recommendedSpeed)),
            calculationBasis: equipmentType === 'cooling-pumps' ? 'chiller-loading' : 'boiler-loading'
        };
        
    } catch (error) {
        console.error('[FirstChurchOfGod Lead-Lag] Error calculating pump demand:', error);
        return {
            demandLevel: 0,
            needsLagPump: false,
            recommendedSpeed: FCOG_PUMP_CONSTANTS.MIN_PUMP_SPEED,
            calculationBasis: 'error-fallback'
        };
    }
}
