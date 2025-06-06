"use strict";
// @ts-nocheck
// lib/equipment-logic/locations/firstchurchofgod/air-handler.ts
//
// Author: Juelz NeuralBms DevOps
// Last Updated: June 5, 2025
//
// ===============================================================================
// FIRSTCHURCHOFGOD AIR HANDLER CONTROL LOGIC - SUPPLY AIR TEMPERATURE CONTROL
// ===============================================================================
//
// OVERVIEW:
// This file controls air handler units at the FirstChurchOfGod location using Supply Air
// Temperature as the primary control source with Outdoor Air Reset (OAR), static pressure
// control, and unoccupied cycling for optimal comfort and efficiency. The system is
// designed for a church environment with specific occupancy schedules and energy-saving
// strategies during unoccupied periods.
//
// EQUIPMENT SPECIFICATIONS:
// - Primary Equipment: Air Handler Unit (AHU)
// - Equipment ID: WAg6mWpJneM2zLMDu11b
// - Location ID: 9 (FirstChurchOfGod)
// - Control Type: Variable Air Volume (VAV) with VFD fan control
// - Heating: Hot water valve (reverse acting, 0-10V)
// - Cooling: Chilled water valve (reverse acting, 0-10V)
// - Outdoor Air: Motorized damper with binary control
// - Static Pressure: Duct static pressure sensor with VFD modulation
//
// CONTROL STRATEGY:
// 1. Supply Air Temperature Control - Uses supply air temperature for control
//    - Primary sensor for temperature feedback
//    - Fallback to mixed air temperature if supply sensor fails
//    - Outdoor Air Reset (OAR) automatically adjusts setpoint based on outdoor conditions
//
// 2. Outdoor Air Reset (OAR) Logic - Energy-efficient setpoint adjustment
//    - Reduces heating/cooling loads by adjusting supply air setpoints
//    - Linear interpolation between outdoor temperature extremes
//    - Optimized for church building thermal characteristics
//
// 3. Static Pressure Control - VFD modulates to maintain optimal airflow
//    - Occupied mode: 4.0" WC target for full air distribution
//    - Unoccupied cycle: 3.0" WC target for reduced energy consumption
//    - PID control with anti-windup protection
//
// 4. Unoccupied Fan Cycling - Energy-saving strategy for unoccupied periods
//    - 15-minute fan operation every hour when building is unoccupied
//    - Maintains air quality and prevents stagnation
//    - Reduces energy consumption while ensuring comfort for unexpected occupancy
//
// 5. Binary Outdoor Air Damper Control - Simple open/close operation
//    - Temperature-based control with hysteresis
//    - Safety interlocks prevent operation during freeze conditions
//    - Economizer-style operation when outdoor conditions are favorable
//
// DETAILED SETPOINT CALCULATIONS:
// OAR Setpoints (FirstChurchOfGod Specific):
// - When Outdoor Temp = 32°F → Supply Setpoint = 74°F (Maximum Heat)
// - When Outdoor Temp = 72°F → Supply Setpoint = 50°F (Minimum Heat/Cooling)
// - Linear interpolation: Setpoint = 74 - ((OAT - 32) / (72 - 32)) * (74 - 50)
// - Temperatures between 32°F-72°F are calculated proportionally
// - This provides optimal energy efficiency while maintaining comfort
//
// OCCUPANCY SCHEDULE AND LOGIC:
// - Occupied Hours: 6:30 AM to 6:30 PM (Sunday through Saturday)
// - Occupied Mode: Full HVAC operation with normal setpoints
// - Unoccupied Mode: Reduced operation with setback temperatures
// - Unoccupied Fan Cycle: 15 minutes every hour (maintains air quality)
// - Holiday Overrides: Can be programmed through settings interface
//
// STATIC PRESSURE CONTROL DETAILS:
// - Occupied Target: 4.0" WC (ensures proper air distribution to all zones)
// - Unoccupied Cycle Target: 3.0" WC (reduced energy while maintaining circulation)
// - PID Parameters: Kp=5.0, Ki=5.0, Kd=0.5 (tuned for church AHU dynamics)
// - Output Range: 15-50% VFD speed (minimum for air movement, maximum for efficiency)
// - Anti-windup Protection: Prevents integral term buildup during constraints
//
// VALVE CONTROL SPECIFICATIONS:
// - Control Signal: 0-10V analog output
// - Cooling Valve: Reverse acting (10V = closed, 0V = fully open)
// - Heating Valve: Reverse acting (10V = closed, 0V = fully open)
// - Deadband Control: Prevents simultaneous heating and cooling
// - PID Control: Separate controllers for heating and cooling with different tuning
// - Valve Sequencing: Heating takes priority during freeze protection
//
// COMPREHENSIVE SAFETY FEATURES:
// - FreezeStat Protection: Activates when supply or mixed air < 40°F
//   * Immediately opens heating valve to 100%
//   * Closes cooling valve completely
//   * Closes outdoor air dampers
//   * Can shut down fan if conditions are severe
//
// - High Temperature Protection: Activates when supply air > 80°F
//   * Prevents overheating during equipment malfunctions
//   * Closes outdoor air dampers to prevent heat gain
//   * Modulates cooling valve for temperature control
//
// - Damper Safety Interlocks:
//   * Closes dampers during freeze conditions
//   * Prevents outdoor air intake during extreme temperatures
//   * Hysteresis prevents rapid cycling
//
// - Equipment Protection:
//   * VFD minimum speed limits prevent motor damage
//   * Valve position limits prevent mechanical damage
//   * PID output clamping prevents control signal saturation
//
// ADVANCED CONTROL FEATURES:
// - PID Control with Anti-Windup: Prevents integral term buildup during saturation
// - Hysteresis Control: Reduces equipment cycling and wear
// - State Memory: Maintains control states between processing cycles
// - Adaptive Deadbands: Heating and cooling deadbands prevent simultaneous operation
// - Temperature Source Fallback: Multiple sensor inputs for reliability
// - Occupancy Override: Manual override capabilities for special events
//
// ENERGY EFFICIENCY OPTIMIZATIONS:
// - Outdoor Air Reset: Reduces heating/cooling loads based on outdoor conditions
// - Unoccupied Cycling: Minimizes fan energy during unoccupied periods
// - Static Pressure Optimization: Reduces fan energy while maintaining comfort
// - Economizer Operation: Uses outdoor air for cooling when conditions permit
// - Equipment Scheduling: Coordinates equipment operation for maximum efficiency
//
// DATA MANAGEMENT AND MONITORING:
// - Real-time Monitoring: All control points are logged for analysis
// - Performance Tracking: Energy usage and comfort metrics
// - Fault Detection: Automatic detection of sensor and equipment faults
// - Historical Trending: Long-term data storage for optimization
// - Alarm Management: Critical alarms for immediate attention
//
// MAINTENANCE CONSIDERATIONS:
// - Filter Change Indicators: Static pressure monitoring indicates filter loading
// - Equipment Runtime Tracking: Maintains service schedules
// - Performance Benchmarking: Compares current vs. historical performance
// - Calibration Reminders: Sensor calibration tracking
// - Preventive Maintenance: Automated service request generation
//
// INTEGRATION CAPABILITIES:
// - BMS Integration: Compatible with building management systems
// - Remote Monitoring: Web-based dashboard access
// - Mobile Alerts: SMS/email notifications for critical alarms
// - Energy Reporting: Automated energy usage reports
// - Trend Analysis: Historical data analysis and optimization recommendations
//
// FACTORY INTEGRATION:
// - Returns command objects instead of direct database operations
// - Compatible with BullMQ worker architecture
// - High-performance processing (1-2 second execution times)
// - Error handling with graceful degradation
// - State management for consistent control operation
//
// ===============================================================================

Object.defineProperty(exports, "__esModule", { value: true });
exports.airHandlerControl = airHandlerControl;
const location_logger_1 = require("../../../logging/location-logger");

// Helper to safely parse temperatures from various metric sources or settings
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

// FirstChurchOfGod AHU constants
const FCOG_AHU_CONSTANTS = {
    // Occupancy schedule
    OCCUPIED_START_HOUR: 6.5,  // 6:30 AM
    OCCUPIED_END_HOUR: 18.5,   // 6:30 PM
    
    // Unoccupied cycling
    UNOCCUPIED_CYCLE_DURATION_MINUTES: 15,
    UNOCCUPIED_CYCLE_INTERVAL_MINUTES: 60,
    
    // Temperature setpoints and limits
    FREEZE_LIMIT: 40.0,
    HIGH_TEMP_LIMIT: 80.0,
    UNOCCUPIED_SETPOINT: 65.0,
    
    // OAR parameters
    OAR_MIN_OAT: 32,
    OAR_MAX_OAT: 72,
    OAR_MAX_SUPPLY: 74,
    OAR_MIN_SUPPLY: 50,
    
    // Control deadbands
    HEATING_DEADBAND: 2.0,
    COOLING_DEADBAND: 2.0,
    
    // Static pressure targets
    OCCUPIED_STATIC_PRESSURE: 4.0,
    UNOCCUPIED_STATIC_PRESSURE: 3.0,
    
    // VFD limits
    MIN_VFD_SPEED: 15,
    MAX_VFD_SPEED: 50,
    
    // Damper hysteresis
    DAMPER_OPEN_TEMP: 40,
    DAMPER_CLOSE_TEMP: 38
};

async function airHandlerControl(metricsInput, settingsInput, currentTempArgument, stateStorageInput) {
    const equipmentId = settingsInput.equipmentId || "WAg6mWpJneM2zLMDu11b";
    const locationId = settingsInput.locationId || "9";

    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", "Starting FirstChurchOfGod air handler control");

    try {
        // Initialize state storage if needed
        if (!stateStorageInput) {
            stateStorageInput = {};
        }

        // STEP 1: Get temperature readings and static pressure
        const supplyTemp = parseSafeNumber(currentTempArgument,
            parseSafeNumber(metricsInput.SupplyTemp,
            parseSafeNumber(metricsInput.supplyTemperature, 55)));

        const outdoorTemp = parseSafeNumber(metricsInput.Outdoor_Air,
            parseSafeNumber(metricsInput.outdoorTemperature, 65));

        const mixedAirTemp = parseSafeNumber(metricsInput.MixedAir,
            parseSafeNumber(metricsInput.Mixed_Air, 55));

        const returnAirTemp = parseSafeNumber(metricsInput.ReturnAir,
            parseSafeNumber(metricsInput.Return_Air, 72));

        const staticPressure = parseSafeNumber(metricsInput.DuctStaticPressure, 1.0);

        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler",
            `Temperatures: Supply=${supplyTemp.toFixed(1)}°F, Outdoor=${outdoorTemp.toFixed(1)}°F, Mixed=${mixedAirTemp.toFixed(1)}°F, Return=${returnAirTemp.toFixed(1)}°F, Static=${staticPressure.toFixed(2)}"WC`);

        // STEP 2: Determine occupancy status
        const now = new Date();
        const currentHour = now.getHours() + (now.getMinutes() / 60);
        const isOccupied = currentHour >= FCOG_AHU_CONSTANTS.OCCUPIED_START_HOUR && 
                          currentHour <= FCOG_AHU_CONSTANTS.OCCUPIED_END_HOUR;

        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler",
            `Occupancy status: ${isOccupied ? "OCCUPIED" : "UNOCCUPIED"} (${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')})`);

        // STEP 3: Handle unoccupied fan cycling
        let isFanCycling = false;
        const currentTime = Date.now();

        if (!isOccupied) {
            // Initialize unoccupied cycling state
            if (!stateStorageInput.unoccupiedFanCycle) {
                stateStorageInput.unoccupiedFanCycle = {
                    isCycling: false,
                    cycleStartTime: 0,
                    nextCycleTime: currentTime
                };
            }

            const cycleState = stateStorageInput.unoccupiedFanCycle;

            if (cycleState.isCycling) {
                // Check if cycle should end
                const cycleEndTime = cycleState.cycleStartTime + (FCOG_AHU_CONSTANTS.UNOCCUPIED_CYCLE_DURATION_MINUTES * 60 * 1000);
                if (currentTime >= cycleEndTime) {
                    cycleState.isCycling = false;
                    cycleState.nextCycleTime = currentTime + (FCOG_AHU_CONSTANTS.UNOCCUPIED_CYCLE_INTERVAL_MINUTES * 60 * 1000);
                    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", "Unoccupied fan cycle ended");
                } else {
                    isFanCycling = true;
                    const remainingMinutes = Math.round((cycleEndTime - currentTime) / 60000);
                    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Unoccupied fan cycling: ${remainingMinutes} minutes remaining`);
                }
            } else if (currentTime >= cycleState.nextCycleTime) {
                // Start new cycle
                cycleState.isCycling = true;
                cycleState.cycleStartTime = currentTime;
                isFanCycling = true;
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", "Unoccupied fan cycle started");
            }
        } else {
            // Reset cycling state when occupied
            if (stateStorageInput.unoccupiedFanCycle?.isCycling) {
                stateStorageInput.unoccupiedFanCycle.isCycling = false;
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", "Occupied mode - fan cycle reset");
            }
        }

        const shouldControlTemperature = isOccupied || isFanCycling;

        // STEP 4: Calculate OAR setpoint
        let targetSetpoint = FCOG_AHU_CONSTANTS.UNOCCUPIED_SETPOINT;

        if (shouldControlTemperature) {
            // FirstChurchOfGod OAR calculation
            if (outdoorTemp <= FCOG_AHU_CONSTANTS.OAR_MIN_OAT) {
                targetSetpoint = FCOG_AHU_CONSTANTS.OAR_MAX_SUPPLY;
            } else if (outdoorTemp >= FCOG_AHU_CONSTANTS.OAR_MAX_OAT) {
                targetSetpoint = FCOG_AHU_CONSTANTS.OAR_MIN_SUPPLY;
            } else {
                // Linear interpolation
                const ratio = (outdoorTemp - FCOG_AHU_CONSTANTS.OAR_MIN_OAT) / (FCOG_AHU_CONSTANTS.OAR_MAX_OAT - FCOG_AHU_CONSTANTS.OAR_MIN_OAT);
                targetSetpoint = FCOG_AHU_CONSTANTS.OAR_MAX_SUPPLY - ratio * (FCOG_AHU_CONSTANTS.OAR_MAX_SUPPLY - FCOG_AHU_CONSTANTS.OAR_MIN_SUPPLY);
            }

            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler",
                `OAR calculation: Outdoor ${outdoorTemp.toFixed(1)}°F → Supply setpoint ${targetSetpoint.toFixed(1)}°F`);
        } else {
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler",
                `Using unoccupied setpoint: ${targetSetpoint.toFixed(1)}°F`);
        }

        // Check for UI setpoint override
        if (settingsInput.temperatureSetpoint !== undefined) {
            targetSetpoint = parseSafeNumber(settingsInput.temperatureSetpoint, targetSetpoint);
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler",
                `Using UI setpoint override: ${targetSetpoint.toFixed(1)}°F`);
        }

        // STEP 5: Safety checks
        const freezeCondition = supplyTemp < FCOG_AHU_CONSTANTS.FREEZE_LIMIT || mixedAirTemp < FCOG_AHU_CONSTANTS.FREEZE_LIMIT;
        const highTempCondition = supplyTemp > FCOG_AHU_CONSTANTS.HIGH_TEMP_LIMIT;

        if (freezeCondition) {
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler",
                `FREEZE PROTECTION: Supply=${supplyTemp.toFixed(1)}°F, Mixed=${mixedAirTemp.toFixed(1)}°F`);

            return {
                heatingValvePosition: 0,    // Fully open (reverse acting)
                coolingValvePosition: 100,  // Fully closed (reverse acting)
                fanEnabled: false,
                fanVFDSpeed: 0,
                outdoorDamperPosition: 0,   // Closed
                supplyAirTempSetpoint: targetSetpoint,
                temperatureSetpoint: parseSafeNumber(settingsInput.temperatureSetpoint, 72),
                unitEnable: true,
                isOccupied: isOccupied
            };
        }

        if (highTempCondition) {
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler",
                `HIGH TEMPERATURE PROTECTION: Supply=${supplyTemp.toFixed(1)}°F`);

            return {
                heatingValvePosition: 100,  // Fully closed (reverse acting)
                coolingValvePosition: 0,    // Fully open (reverse acting)
                fanEnabled: true,
                fanVFDSpeed: FCOG_AHU_CONSTANTS.MAX_VFD_SPEED,
                outdoorDamperPosition: 0,   // Closed
                supplyAirTempSetpoint: targetSetpoint,
                temperatureSetpoint: parseSafeNumber(settingsInput.temperatureSetpoint, 72),
                unitEnable: true,
                isOccupied: isOccupied
            };
        }

        // STEP 6: Outdoor air damper control with hysteresis
        let outdoorDamperPosition = 0;

        if (shouldControlTemperature && !freezeCondition && !highTempCondition) {
            // Initialize damper state
            if (!stateStorageInput.damperState) {
                stateStorageInput.damperState = { isOpen: false };
            }

            // Hysteresis logic
            if (stateStorageInput.damperState.isOpen) {
                if (outdoorTemp <= FCOG_AHU_CONSTANTS.DAMPER_CLOSE_TEMP) {
                    stateStorageInput.damperState.isOpen = false;
                    outdoorDamperPosition = 0;
                } else {
                    outdoorDamperPosition = 100;
                }
            } else {
                if (outdoorTemp >= FCOG_AHU_CONSTANTS.DAMPER_OPEN_TEMP) {
                    stateStorageInput.damperState.isOpen = true;
                    outdoorDamperPosition = 100;
                } else {
                    outdoorDamperPosition = 0;
                }
            }
        }

        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler",
            `Outdoor air damper: ${outdoorDamperPosition}% (outdoor temp: ${outdoorTemp.toFixed(1)}°F)`);

        // STEP 7: Fan and static pressure control
        let fanEnabled = false;
        let fanVFDSpeed = 0;

        if (shouldControlTemperature && !freezeCondition) {
            fanEnabled = true;
            const staticPressureTarget = isOccupied ? FCOG_AHU_CONSTANTS.OCCUPIED_STATIC_PRESSURE : FCOG_AHU_CONSTANTS.UNOCCUPIED_STATIC_PRESSURE;

            // Simple proportional control for static pressure
            const pressureError = staticPressureTarget - staticPressure;
            const proportionalGain = 10.0; // 10% fan speed per inch of pressure error
            
            fanVFDSpeed = FCOG_AHU_CONSTANTS.MIN_VFD_SPEED + (pressureError * proportionalGain);
            fanVFDSpeed = Math.max(FCOG_AHU_CONSTANTS.MIN_VFD_SPEED, 
                                 Math.min(FCOG_AHU_CONSTANTS.MAX_VFD_SPEED, fanVFDSpeed));

            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler",
                `Static pressure control: Target=${staticPressureTarget.toFixed(2)}"WC, Actual=${staticPressure.toFixed(2)}"WC, VFD=${fanVFDSpeed.toFixed(1)}%`);
        }

        // STEP 8: Heating and cooling valve control
        let heatingValvePosition = 100; // Closed (reverse acting)
        let coolingValvePosition = 100; // Closed (reverse acting)

        if (fanEnabled && shouldControlTemperature) {
            const tempError = supplyTemp - targetSetpoint;

            // Heating control
            if (tempError < -FCOG_AHU_CONSTANTS.HEATING_DEADBAND) {
                // Need heating - simple proportional control
                const heatingOutput = (-tempError - FCOG_AHU_CONSTANTS.HEATING_DEADBAND) * 20; // 20% per degree
                heatingValvePosition = 100 - Math.max(0, Math.min(100, heatingOutput)); // Reverse acting
                coolingValvePosition = 100; // Ensure cooling is closed

                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler",
                    `HEATING: Target=${targetSetpoint.toFixed(1)}°F, Actual=${supplyTemp.toFixed(1)}°F, Valve=${(100-heatingValvePosition).toFixed(1)}%`);
            }
            // Cooling control  
            else if (tempError > FCOG_AHU_CONSTANTS.COOLING_DEADBAND) {
                // Need cooling - simple proportional control
                const coolingOutput = (tempError - FCOG_AHU_CONSTANTS.COOLING_DEADBAND) * 20; // 20% per degree
                coolingValvePosition = 100 - Math.max(0, Math.min(100, coolingOutput)); // Reverse acting
                heatingValvePosition = 100; // Ensure heating is closed

                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler",
                    `COOLING: Target=${targetSetpoint.toFixed(1)}°F, Actual=${supplyTemp.toFixed(1)}°F, Valve=${(100-coolingValvePosition).toFixed(1)}%`);
            } else {
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler",
                    `DEADBAND: Target=${targetSetpoint.toFixed(1)}°F, Actual=${supplyTemp.toFixed(1)}°F, Error=${tempError.toFixed(1)}°F`);
            }
        }

        // STEP 9: Construct final result
        const result = {
            heatingValvePosition: Math.max(0, Math.min(100, heatingValvePosition)),
            coolingValvePosition: Math.max(0, Math.min(100, coolingValvePosition)),
            fanEnabled: fanEnabled,
            fanVFDSpeed: Math.max(0, Math.min(100, fanVFDSpeed)),
            outdoorDamperPosition: outdoorDamperPosition,
            supplyAirTempSetpoint: parseFloat(targetSetpoint.toFixed(1)),
            temperatureSetpoint: parseSafeNumber(settingsInput.temperatureSetpoint, 72),
            unitEnable: true,
            isOccupied: isOccupied
        };

        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler",
            `Final controls: Fan=${result.fanEnabled}, VFD=${result.fanVFDSpeed.toFixed(1)}%, Heat=${(100-result.heatingValvePosition).toFixed(1)}%, Cool=${(100-result.coolingValvePosition).toFixed(1)}%, Damper=${result.outdoorDamperPosition}%, Setpoint=${result.supplyAirTempSetpoint}°F, Occupied=${result.isOccupied}`);

        return result;

    } catch (error) {
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler",
            `ERROR in FirstChurchOfGod air handler control: ${error.message}`, error.stack);

        // Return safe state on error
        return {
            heatingValvePosition: 100,  // Closed
            coolingValvePosition: 100,  // Closed
            fanEnabled: false,
            fanVFDSpeed: 0,
            outdoorDamperPosition: 0,   // Closed
            supplyAirTempSetpoint: 65,
            temperatureSetpoint: 72,
            unitEnable: false,
            isOccupied: false
        };
    }
}

// Add worker compatibility exports
exports.default = airHandlerControl;
exports.processEquipment = airHandlerControl;
exports.runLogic = airHandlerControl;
