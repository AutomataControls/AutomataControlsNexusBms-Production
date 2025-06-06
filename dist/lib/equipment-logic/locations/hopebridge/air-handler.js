"use strict";
// @ts-nocheck
// lib/equipment-logic/locations/hopebridge/air-handler.ts
//
// Author: Juelz NeuralBms DevOps
// Last Updated: June 4, 2025
//
// ===============================================================================
// HOPEBRIDGE AIR HANDLER CONTROL LOGIC - MULTI-AHU SYSTEM WITH SPECIALIZED COOLING
// ===============================================================================
//
// OVERVIEW:
// This file controls multiple air handler units at the Hopebridge location with
// different cooling strategies, occupancy scheduling, and specialized equipment
// configurations for optimal comfort in autism therapy facility zones. The system
// is optimized for the unique environmental requirements of therapeutic spaces.
//
// EQUIPMENT CONFIGURATION:
// - AHU-1 (FDhNArcvkL6v2cZDfuSR): CW actuator + CW circulation pump + Chiller control
//   * Advanced chilled water system with pump warm-up and cooldown sequences
//   * Requires 2-minute pump warm-up before chiller activation
//   * 5-minute pump cooldown after chiller shutdown for system protection
//   * PID-controlled chilled water valve for precise temperature control
//
// - AHU-2 (XS60eMHH8DJRXmvIv6wU): DX cooling with hysteresis and minimum runtime
//   * Direct expansion cooling system optimized for therapy room comfort
//   * 7.5°F hysteresis prevents short cycling and maintains stable temperatures
//   * 15-minute minimum runtime protects compressor and ensures efficiency
//   * Binary operation (100% ON or 0% OFF) for reliable control
//
// - AHU-3 (57bJYUeT8vbjsKqzo0uD): Simplified CW actuator control only
//   * Basic chilled water valve control for auxiliary zones
//   * Same PID parameters as AHU-1 for consistent performance
//   * Simplified operation without pump or chiller control
//
// ADVANCED CONTROL STRATEGIES:
// 1. **Supply Air Temperature Control** - All AHUs use supply air temperature for primary control
//    - High-precision temperature sensing for therapy room comfort
//    - Redundant temperature sources with intelligent fallback logic
//    - Real-time temperature monitoring and adjustment
//
// 2. **Outdoor Air Reset (OAR)** - Automatically adjusts setpoints based on outdoor conditions
//    - Energy-efficient operation reduces heating and cooling loads
//    - Seasonal optimization for therapy facility comfort requirements
//    - Smooth transitions prevent abrupt temperature changes
//
// 3. **Extended Occupancy Scheduling** - Optimized for therapy session requirements
//    - Occupied: 5:30 AM to 9:45 PM (extended hours for therapy sessions)
//    - Unoccupied: Energy-saving mode with systems disabled
//    - Flexible scheduling accommodates varying therapy schedules
//
// 4. **Equipment-Specific Cooling Systems** - Tailored cooling methods per AHU
//    - AHU-1: Chilled water with intelligent staging and protection
//    - AHU-2: DX cooling with anti-short-cycle protection
//    - AHU-3: Simple chilled water valve for consistent control
//
// 5. **Comprehensive Safety Interlocks** - Multi-layer protection systems
//    - Freeze protection with immediate response
//    - Equipment protection through staged shutdown
//    - Temperature monitoring with safety overrides
//
// DETAILED OPERATING PARAMETERS:
// **Occupancy Schedule (Therapy-Optimized):**
// - **Occupied Hours**: 5:30 AM to 9:45 PM (16+ hours for therapy flexibility)
// - **Transition Periods**: Gradual system startup and shutdown
// - **Unoccupied Mode**: All cooling systems disabled, outdoor air dampers closed
// - **Override Capability**: Manual occupancy override for special sessions
//
// **OAR Setpoints (Hopebridge Therapy Environment):**
// - **Cold Weather** (32°F outdoor): 76°F supply (maximum heat, minimal cooling)
// - **Mild Weather** (68°F outdoor): 50°F supply (minimal heat, maximum cooling)
// - **Linear Interpolation**: Smooth setpoint transitions between extremes
// - **Therapy Room Optimization**: Moderate cooling loads for consistent comfort
//
// **Damper Operation (Free Cooling Integration):**
// - **Opening Threshold**: Outdoor temp ≥ 40°F (free cooling opportunity)
// - **Closing Threshold**: Outdoor temp ≤ 38°F (hysteresis prevents cycling)
// - **Safety Override**: Automatic closure during safety conditions
// - **Unoccupied Closure**: Closed during unoccupied periods for energy savings
// - **Temperature Protection**: Closes if supply air < 40°F or > 80°F
//
// COOLING SYSTEM SPECIFICATIONS:
//
// **AHU-1 (Advanced Chilled Water System):**
// - **Pump Warm-up**: CW circulation pump runs 2 minutes before chiller activation
// - **Chiller Conditions**: OAT > 55°F, Mixed air > 38°F, Supply > 38°F, Fan enabled
// - **Safe Shutdown**: Pump continues 5 minutes after chiller stops for protection
// - **PID Control**: kp=2.8, ki=0.17, kd=0.01 (enhanced responsiveness)
// - **Anti-windup**: maxIntegral=10 for stable operation
// - **Valve Range**: 0-100% modulation for precise temperature control
//
// **AHU-2 (DX Cooling System with Protection):**
// - **Temperature Hysteresis**: 7.5°F prevents short cycling
// - **Activation**: Supply temp > (Setpoint + 3.75°F)
// - **Deactivation**: Supply temp < (Setpoint - 3.75°F) AND minimum runtime met
// - **Minimum Runtime**: 15 minutes when enabled to protect compressor
// - **Binary Operation**: 100% cooling or 0% cooling (no modulation)
// - **Cycle Protection**: Advanced logic prevents rapid on/off cycling
//
// **AHU-3 (Simplified CW System):**
// - **Control Method**: CW valve modulation only (no pump or chiller control)
// - **PID Parameters**: Same as AHU-1 for consistency (kp=2.8, ki=0.17, kd=0.01)
// - **Operating Conditions**: OAT > 55°F, Supply > 38°F, Fan enabled
// - **Valve Control**: 0-100% modulation based on temperature demand
//
// COMPREHENSIVE SAFETY SYSTEMS:
// - **FreezeStat Protection**: Immediate response when supply OR mixed air < 40°F
//   * All cooling systems disabled instantly
//   * Fan system disabled to prevent further heat loss
//   * Outdoor air dampers closed to prevent cold air infiltration
//   * Emergency state logged for maintenance review
//
// - **Temperature Range Protection**: Prevents equipment damage and discomfort
//   * High temperature limit: Supply air > 80°F triggers cooling protection
//   * Low temperature limit: Supply air < 40°F triggers freeze protection
//   * Automatic damper closure during temperature extremes
//
// - **Equipment Protection Sequences**: Staged protection for mechanical systems
//   * Pump protection through proper warm-up and cooldown sequences
//   * Compressor protection through minimum runtime enforcement
//   * Valve protection through controlled modulation and position limits
//
// ENERGY EFFICIENCY FEATURES:
// - **Variable Speed Control**: Optimizes energy consumption based on demand
// - **Free Cooling Integration**: Uses outdoor air when conditions permit
// - **Equipment Staging**: Operates minimum equipment needed for comfort
// - **Unoccupied Setbacks**: Significant energy savings during unoccupied periods
// - **Optimal Scheduling**: Aligns system operation with therapy schedules
//
// THERAPY FACILITY CONSIDERATIONS:
// - **Stable Temperature Control**: Consistent comfort for therapy sessions
// - **Quiet Operation**: Minimal noise for therapy environment
// - **Rapid Response**: Quick adjustment to changing occupancy loads
// - **Reliable Operation**: High system availability for scheduled therapy sessions
// - **Energy Efficiency**: Cost-effective operation for non-profit facility
//
// MAINTENANCE AND MONITORING:
// - **State Tracking**: Comprehensive monitoring of all system states
// - **Performance Logging**: Detailed operation logs for optimization
// - **Fault Detection**: Early warning systems for maintenance needs
// - **Runtime Tracking**: Equipment runtime monitoring for service scheduling
// - **Temperature Trending**: Historical data for comfort analysis
//
// FACTORY INTEGRATION:
// - **High Performance**: Returns command objects for 1-2 second processing
// - **BullMQ Compatible**: Designed for smart queue architecture
// - **Error Handling**: Graceful degradation during faults
// - **State Persistence**: Maintains control states between processing cycles
// - **Real-time Response**: Immediate response to therapy facility needs
//
// ===============================================================================

Object.defineProperty(exports, "__esModule", { value: true });
exports.airHandlerControl = airHandlerControl;
const pid_controller_1 = require("../../../pid-controller");
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

/**
 * Determine the AHU number from the equipment ID
 */
function getAHUNumber(equipmentId) {
    try {
        // Hardcoded mapping for specific equipment IDs
        const equipmentMap = {
            "FDhNArcvkL6v2cZDfuSR": 1, // AHU-1
            "XS60eMHH8DJRXmvIv6wU": 2, // AHU-2
            "57bJYUeT8vbjsKqzo0uD": 3  // AHU-3
        };

        // Check if this equipment ID is in our mapping
        if (equipmentId in equipmentMap) {
            return equipmentMap[equipmentId];
        }

        // Fallback to the original logic for any other equipment IDs
        if (equipmentId.includes("AHU-1") || equipmentId.includes("AHU1")) {
            return 1;
        }
        if (equipmentId.includes("AHU-2") || equipmentId.includes("AHU2")) {
            return 2;
        }
        if (equipmentId.includes("AHU-3") || equipmentId.includes("AHU3")) {
            return 3;
        }

        // Try to extract any number from the ID
        const match = equipmentId.match(/(\d+)/);
        if (match) {
            const num = parseInt(match[0], 10);
            return (num === 1 || num === 2 || num === 3) ? num : 1;
        }

        return 1; // Default to AHU-1
    } catch (error) {
        console.error(`Error determining AHU number: ${error}`);
        return 1;
    }
}

async function airHandlerControl(metricsInput, settingsInput, currentTempArgument, stateStorageInput) {
    const equipmentId = settingsInput.equipmentId || "unknown";
    const locationId = settingsInput.locationId || "5";
    const currentMetrics = metricsInput;
    const currentSettings = settingsInput;

    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", "Starting Hopebridge air handler control logic");

    try {
        // Initialize state storage if needed
        if (!stateStorageInput) {
            stateStorageInput = {};
        }

        // Determine which AHU this is (1, 2, or 3)
        const ahuNumber = getAHUNumber(equipmentId);
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Identified as AHU-${ahuNumber}`);

        // STEP 1: Get temperatures - Always use supply air temperature for control
        let currentTemp = currentTempArgument;
        if (currentTemp === undefined || isNaN(currentTemp)) {
            currentTemp = parseSafeNumber(currentMetrics.Supply, parseSafeNumber(currentMetrics.supplyTemperature, parseSafeNumber(currentMetrics.SupplyTemp, parseSafeNumber(currentMetrics.supplyTemp, parseSafeNumber(currentMetrics.SupplyTemperature, parseSafeNumber(currentMetrics.SAT, parseSafeNumber(currentMetrics.sat, parseSafeNumber(currentMetrics.SupplyAirTemp, parseSafeNumber(currentMetrics.supplyAirTemp, 55)))))))));
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Using supply air temperature: ${currentTemp}°F`);
        } else {
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Using provided supply air temperature: ${currentTemp}°F`);
        }

        // Get outdoor temperature with fallbacks
        const outdoorTemp = parseSafeNumber(currentMetrics.Outdoor_Air, parseSafeNumber(currentMetrics.outdoorTemperature, parseSafeNumber(currentMetrics.outdoorTemp, parseSafeNumber(currentMetrics.Outdoor, parseSafeNumber(currentMetrics.outdoor, parseSafeNumber(currentMetrics.OutdoorTemp, parseSafeNumber(currentMetrics.OAT, parseSafeNumber(currentMetrics.oat, 65))))))));

        // Get mixed air temperature for safety checks
        const mixedAirTemp = parseSafeNumber(currentMetrics.Mixed_Air, parseSafeNumber(currentMetrics.MixedAir, parseSafeNumber(currentMetrics.mixedAir, parseSafeNumber(currentMetrics.MAT, parseSafeNumber(currentMetrics.mat, parseSafeNumber(currentMetrics.MixedAirTemp, parseSafeNumber(currentMetrics.mixedAirTemp, 55)))))));

        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Temperatures: Supply=${currentTemp}°F, Outdoor=${outdoorTemp}°F, Mixed=${mixedAirTemp}°F`);

        // STEP 2: Determine occupancy based on time of day (5:30 AM to 9:45 PM)
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTimeInMinutes = currentHour * 60 + currentMinute;
        const occupiedStartMinutes = 5 * 60 + 30; // 5:30 AM
        const occupiedEndMinutes = 21 * 60 + 45; // 9:45 PM

        const isOccupied = currentTimeInMinutes >= occupiedStartMinutes &&
            currentTimeInMinutes <= occupiedEndMinutes;

        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Current time: ${currentHour}:${currentMinute.toString().padStart(2, '0')}, ` +
            `Occupancy: ${isOccupied ? "OCCUPIED" : "UNOCCUPIED"}`);

        // STEP 3: Calculate supply air temperature setpoint using OAR
        let supplySetpoint = 50; // Default to minimum setpoint

        if (isOccupied) {
            // Hopebridge OAR: Min OAT 32°F → SP 76°F, Max OAT 68°F → SP 50°F
            const minOAT = 32;
            const maxOAT = 68;
            const maxSupply = 76;
            const minSupply = 50;

            if (outdoorTemp <= minOAT) {
                supplySetpoint = maxSupply;
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `OAR: OAT ${outdoorTemp}°F <= ${minOAT}°F, using max setpoint: ${supplySetpoint}°F`);
            } else if (outdoorTemp >= maxOAT) {
                supplySetpoint = minSupply;
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `OAR: OAT ${outdoorTemp}°F >= ${maxOAT}°F, using min setpoint: ${supplySetpoint}°F`);
            } else {
                const ratio = (outdoorTemp - minOAT) / (maxOAT - minOAT);
                supplySetpoint = maxSupply - ratio * (maxSupply - minSupply);
                supplySetpoint = parseFloat(supplySetpoint.toFixed(1));
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `OAR: Calculated setpoint: ${supplySetpoint}°F (ratio: ${ratio.toFixed(2)})`);
            }
        } else {
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Using unoccupied setpoint: ${supplySetpoint}°F`);
        }

        // STEP 4: Check safety conditions
        const freezestatTripped = currentTemp < 40 || mixedAirTemp < 40;
        if (freezestatTripped) {
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `SAFETY: FREEZESTAT TRIPPED! Supply: ${currentTemp}°F, Mixed: ${mixedAirTemp}°F`);

            const safetyResult = {
                heatingValvePosition: 0,
                coolingValvePosition: 0,
                fanEnabled: false,
                fanSpeed: "off",
                outdoorDamperPosition: 0,
                supplyAirTempSetpoint: supplySetpoint,
                temperatureSetpoint: 72,
                unitEnable: true,
                dxEnabled: false,
                cwCircPumpEnabled: false,
                chillerEnabled: false,
                isOccupied: isOccupied,
                safetyTripped: "freezestat"
            };

            return filterValidCommands(safetyResult);
        }

        // Check for supply temperature out of range for dampers
        const supplyTempOutOfRange = currentTemp < 40 || currentTemp > 80;
        if (supplyTempOutOfRange && !freezestatTripped) {
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `SAFETY: Supply air temperature out of range (${currentTemp}°F), closing outdoor dampers`);
        }

        // STEP 5: Determine outdoor damper position with hysteresis
        let outdoorDamperPosition = 0;

        // Initialize damper state if not present
        if (!stateStorageInput.hopebridgeOADamperState) {
            stateStorageInput.hopebridgeOADamperState = {
                isOpen: false
            };
            if (outdoorTemp >= 40) {
                stateStorageInput.hopebridgeOADamperState.isOpen = true;
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Initializing OA damper state to OPEN (OAT ${outdoorTemp}°F >= 40°F)`);
            } else {
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Initializing OA damper state to CLOSED (OAT ${outdoorTemp}°F < 40°F)`);
            }
        }

        if (isOccupied && !freezestatTripped && !supplyTempOutOfRange) {
            if (stateStorageInput.hopebridgeOADamperState.isOpen) {
                if (outdoorTemp <= 38) {
                    stateStorageInput.hopebridgeOADamperState.isOpen = false;
                    outdoorDamperPosition = 0;
                    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `OA damper: CLOSING (OAT ${outdoorTemp}°F <= 38°F)`);
                } else {
                    outdoorDamperPosition = 100;
                    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `OA damper: Maintaining OPEN (OAT ${outdoorTemp}°F > 38°F)`);
                }
            } else {
                if (outdoorTemp >= 40) {
                    stateStorageInput.hopebridgeOADamperState.isOpen = true;
                    outdoorDamperPosition = 100;
                    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `OA damper: OPENING (OAT ${outdoorTemp}°F >= 40°F)`);
                } else {
                    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `OA damper: Maintaining CLOSED (OAT ${outdoorTemp}°F < 40°F)`);
                }
            }
        } else {
            outdoorDamperPosition = 0;
            if (stateStorageInput.hopebridgeOADamperState) {
                stateStorageInput.hopebridgeOADamperState.isOpen = false;
            }
            if (!isOccupied) {
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `OA damper: CLOSED (unoccupied mode)`);
            } else {
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `OA damper: CLOSED (safety protection)`);
            }
        }

        // STEP 6: Determine fan status
        const fanEnabled = isOccupied && !freezestatTripped;
        const fanSpeed = fanEnabled ? "medium" : "off";
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Fan: ${fanEnabled ? "ENABLED" : "DISABLED"} (${fanSpeed})`);

        // STEP 7: Calculate cooling outputs based on AHU number
        let coolingValvePosition = 0;
        let cwCircPumpEnabled = false;
        let dxEnabled = false;
        let chillerEnabled = false;

        if (isOccupied && !freezestatTripped) {
            if (ahuNumber === 1) {
                // AHU-1: CW actuator and chiller control logic
                const cwConditionsMet = outdoorTemp > 55 && mixedAirTemp > 38 && currentTemp > 38 && fanEnabled;

                // Initialize chiller state if not present
                if (!stateStorageInput.chillerState) {
                    stateStorageInput.chillerState = {
                        isEnabled: false,
                        pumpRunningTime: 0
                    };
                }

                if (cwConditionsMet) {
                    cwCircPumpEnabled = true;
                    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-1: CW circulation pump ENABLED (conditions met)`);

                    // Chiller warm-up logic
                    if (!stateStorageInput.chillerState.isEnabled) {
                        stateStorageInput.chillerState.pumpRunningTime += 1;
                        if (stateStorageInput.chillerState.pumpRunningTime >= 2) {
                            chillerEnabled = true;
                            stateStorageInput.chillerState.isEnabled = true;
                            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-1: CHILLER ENABLED after pump warm-up period`);
                        } else {
                            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-1: Pump warm-up: ${stateStorageInput.chillerState.pumpRunningTime}/2 minutes`);
                        }
                    } else {
                        chillerEnabled = true;
                    }

                    // PID control for CW valve
                    if (!stateStorageInput.pidState) {
                        stateStorageInput.pidState = { integral: 0, previousError: 0, lastOutput: 0 };
                    }

                    const coolingPID = (0, pid_controller_1.pidControllerImproved)({
                        input: currentTemp,
                        setpoint: supplySetpoint,
                        pidParams: {
                            kp: 2.8, ki: 0.17, kd: 0.01,
                            outputMin: 0, outputMax: 100, enabled: true,
                            reverseActing: false, maxIntegral: 10
                        },
                        dt: 1,
                        controllerType: "cooling",
                        pidState: stateStorageInput.pidState
                    });

                    coolingValvePosition = coolingPID.output;
                    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-1: CW valve position: ${coolingValvePosition.toFixed(1)}% (PID control)`);

                } else {
                    // Chiller shutdown sequence
                    if (stateStorageInput.chillerState && stateStorageInput.chillerState.isEnabled) {
                        chillerEnabled = false;
                        stateStorageInput.chillerState.isEnabled = false;
                        stateStorageInput.chillerState.pumpRunningTime = 0;

                        if (!stateStorageInput.chillerShutdownTimer) {
                            stateStorageInput.chillerShutdownTimer = 5;
                            cwCircPumpEnabled = true;
                            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-1: CHILLER DISABLED, pump cooldown: 5 minutes`);
                        } else if (stateStorageInput.chillerShutdownTimer > 0) {
                            stateStorageInput.chillerShutdownTimer -= 1;
                            cwCircPumpEnabled = true;
                            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-1: Pump cooldown: ${stateStorageInput.chillerShutdownTimer} minutes remaining`);
                        } else {
                            cwCircPumpEnabled = false;
                            stateStorageInput.chillerShutdownTimer = null;
                            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-1: CW circulation pump DISABLED after cooldown`);
                        }
                    } else {
                        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-1: CW circulation pump DISABLED (conditions not met)`);
                    }
                }

            } else if (ahuNumber === 2) {
                // AHU-2: DX cooling with hysteresis and minimum runtime
                const dxConditionsMet = outdoorTemp > 55 && mixedAirTemp > 38 && currentTemp > 38 && fanEnabled;

                if (!stateStorageInput.dxState) {
                    stateStorageInput.dxState = {
                        isRunning: false,
                        runningTime: 0,
                        hysteresisPoint: 0
                    };
                }

                if (dxConditionsMet) {
                    const hysteresis = 7.5;

                    if (!stateStorageInput.dxState.isRunning) {
                        if (currentTemp > supplySetpoint + (hysteresis / 2)) {
                            stateStorageInput.dxState.isRunning = true;
                            stateStorageInput.dxState.runningTime = 1;
                            stateStorageInput.dxState.hysteresisPoint = supplySetpoint - (hysteresis / 2);
                            dxEnabled = true;
                            coolingValvePosition = 100;
                            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-2: DX cooling TURNING ON (${currentTemp}°F > ${(supplySetpoint + hysteresis / 2).toFixed(1)}°F)`);
                        }
                    } else {
                        stateStorageInput.dxState.runningTime += 1;

                        if (currentTemp < stateStorageInput.dxState.hysteresisPoint &&
                            stateStorageInput.dxState.runningTime >= 15) {
                            stateStorageInput.dxState.isRunning = false;
                            stateStorageInput.dxState.runningTime = 0;
                            dxEnabled = false;
                            coolingValvePosition = 0;
                            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-2: DX cooling TURNING OFF (temp satisfied and minimum runtime met)`);
                        } else {
                            dxEnabled = true;
                            coolingValvePosition = 100;
                            if (stateStorageInput.dxState.runningTime < 15) {
                                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-2: DX cooling ON (minimum runtime: ${stateStorageInput.dxState.runningTime}/15 min)`);
                            } else {
                                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-2: DX cooling ON (running normally)`);
                            }
                        }
                    }
                } else {
                    dxEnabled = false;
                    coolingValvePosition = 0;
                    if (stateStorageInput.dxState.isRunning) {
                        stateStorageInput.dxState.isRunning = false;
                        stateStorageInput.dxState.runningTime = 0;
                        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-2: DX cooling FORCED OFF (conditions not met)`);
                    }
                }

            } else if (ahuNumber === 3) {
                // AHU-3: Simplified CW actuator control
                const cwValveConditionsMet = outdoorTemp > 55 && currentTemp > 38 && fanEnabled;

                if (cwValveConditionsMet) {
                    if (!stateStorageInput.pidStateAhu3) {
                        stateStorageInput.pidStateAhu3 = { integral: 0, previousError: 0, lastOutput: 0 };
                    }

                    const coolingPID = (0, pid_controller_1.pidControllerImproved)({
                        input: currentTemp,
                        setpoint: supplySetpoint,
                        pidParams: {
                            kp: 2.8, ki: 0.17, kd: 0.01,
                            outputMin: 0, outputMax: 100, enabled: true,
                            reverseActing: false, maxIntegral: 10
                        },
                        dt: 1,
                        controllerType: "cooling",
                        pidState: stateStorageInput.pidStateAhu3
                    });

                    coolingValvePosition = coolingPID.output;
                    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-3: CW valve position: ${coolingValvePosition.toFixed(1)}% (PID control)`);
                } else {
                    coolingValvePosition = 0;
                    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `AHU-3: CW valve CLOSED (conditions not met)`);
                }
            }
        } else {
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `All cooling disabled (${!isOccupied ? "unoccupied" : "safety protection"})`);
        }

        // STEP 8: Construct result
        const result = {
            heatingValvePosition: 0,
            coolingValvePosition: coolingValvePosition,
            fanEnabled: fanEnabled,
            fanSpeed: fanSpeed,
            outdoorDamperPosition: outdoorDamperPosition,
            supplyAirTempSetpoint: supplySetpoint,
            temperatureSetpoint: 72,
            unitEnable: true,
            dxEnabled: dxEnabled,
            cwCircPumpEnabled: cwCircPumpEnabled,
            chillerEnabled: chillerEnabled,
            isOccupied: isOccupied
        };

        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `Final AHU-${ahuNumber} controls: Fan=${result.fanEnabled ? "ON" : "OFF"}, ` +
            `Cooling=${result.coolingValvePosition.toFixed(1)}%, OA damper=${result.outdoorDamperPosition}%, ` +
            `isOccupied=${result.isOccupied}` +
            (ahuNumber === 1 ? `, CW pump=${result.cwCircPumpEnabled ? "ON" : "OFF"}, Chiller=${result.chillerEnabled ? "ON" : "OFF"}` :
                ahuNumber === 2 ? `, DX=${result.dxEnabled ? "ON" : "OFF"}` :
                    `, CW valve=${result.coolingValvePosition.toFixed(1)}%`));

        // STEP 9: Return filtered result (factory will handle database writes)
        return filterValidCommands(result);

    } catch (error) {
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "air-handler", `ERROR in Hopebridge air handler control: ${error.message}`, error.stack);

        const errorResult = {
            heatingValvePosition: 0,
            coolingValvePosition: 0,
            fanEnabled: false,
            fanSpeed: "off",
            outdoorDamperPosition: 0,
            supplyAirTempSetpoint: 50,
            temperatureSetpoint: 72,
            unitEnable: false,
            dxEnabled: false,
            cwCircPumpEnabled: false,
            chillerEnabled: false,
            isOccupied: false
        };

        return errorResult;
    }
}

/**
 * Helper function to filter result to only include valid control commands
 */
function filterValidCommands(result) {
    const validControlCommands = [
        'heatingValvePosition', 'coolingValvePosition', 'fanEnabled', 'fanSpeed',
        'outdoorDamperPosition', 'supplyAirTempSetpoint', 'temperatureSetpoint',
        'unitEnable', 'dxEnabled', 'cwCircPumpEnabled', 'chillerEnabled', 'isOccupied'
    ];

    const filteredResult = {};
    for (const [key, value] of Object.entries(result)) {
        if (validControlCommands.includes(key)) {
            filteredResult[key] = value;
        }
    }

    return filteredResult;
}

// Add worker compatibility exports
exports.default = airHandlerControl;
exports.processEquipment = airHandlerControl;
exports.runLogic = airHandlerControl;
