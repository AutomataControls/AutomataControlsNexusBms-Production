// @ts-nocheck
// lib/equipment-logic/locations/hopebridge/air-handler.ts
//
// ===============================================================================
// HOPEBRIDGE AIR HANDLER CONTROL LOGIC - MULTI-AHU SYSTEM WITH SPECIALIZED COOLING
// ===============================================================================
//
// OVERVIEW:
// This file controls multiple air handler units at the Hopebridge location with
// different cooling strategies, occupancy scheduling, and specialized equipment
// configurations for optimal comfort in autism therapy facility zones.
//
// EQUIPMENT CONFIGURATION:
// - AHU-1 (FDhNArcvkL6v2cZDfuSR): CW actuator + CW circulation pump + Chiller control
// - AHU-2 (XS60eMHH8DJRXmvIv6wU): DX cooling with hysteresis and minimum runtime
// - AHU-3 (57bJYUeT8vbjsKqzo0uD): Simplified CW actuator control only
//
// CONTROL STRATEGIES:
// 1. Supply Air Temperature Control - All AHUs use supply air temperature for control
// 2. Outdoor Air Reset (OAR) - Automatically adjusts setpoints based on outdoor temp
// 3. Occupancy Scheduling - Extended hours for therapy sessions (5:30 AM - 9:45 PM)
// 4. Equipment-Specific Cooling - Different cooling methods per AHU
// 5. Safety Interlocks - Comprehensive freeze protection and operational safety
//
// OCCUPANCY SCHEDULE:
// - Occupied: 5:30 AM to 9:45 PM (extended hours for therapy sessions)
// - Unoccupied: All cooling systems disabled, OA dampers closed
//
// OAR SETPOINTS (Hopebridge Specific):
// - When Outdoor Temp = 32°F → Supply Setpoint = 76°F (Max Heat/Min Cool)
// - When Outdoor Temp = 68°F → Supply Setpoint = 50°F (Min Heat/Max Cool)
// - Temperatures between 32°F-68°F are calculated proportionally
// - Designed for moderate cooling loads typical in therapy environments
//
// DAMPER OPERATION:
// - Opens when outdoor temp ≥ 40°F (free cooling opportunity)
// - Closes when outdoor temp ≤ 38°F (hysteresis prevents cycling)
// - Closes during unoccupied periods and safety conditions
// - Safety override: Closes if supply air < 40°F or > 80°F
//
// COOLING SYSTEM DETAILS:
//
// AHU-1 (Chilled Water System):
// - CW circulation pump must run 2 minutes before chiller starts
// - Chiller operation requires: OAT > 55°F, Mixed air > 38°F, Supply > 38°F
// - Safe shutdown: Pump continues 5 minutes after chiller stops
// - PID control: kp=2.8, ki=0.17, kd=0.01 (enhanced for stable CW control)
//
// AHU-2 (DX Cooling System):
// - 7.5°F hysteresis prevents short cycling
// - 15-minute minimum runtime when enabled
// - ON when: Supply temp > (Setpoint + 3.75°F)
// - OFF when: Supply temp < (Setpoint - 3.75°F) AND minimum runtime met
// - Binary operation: 100% ON or 0% OFF (no modulation)
//
// AHU-3 (Simple CW System):
// - CW valve control only (no pump or chiller)
// - Same PID parameters as AHU-1 for consistency
// - Simpler conditions: OAT > 55°F, Supply > 38°F
//
// SAFETY FEATURES:
// - FreezeStat: Trips when supply OR mixed air < 40°F
// - All cooling systems disabled on freeze protection
// - Fan disabled during freeze protection
// - OA dampers closed on any safety condition
// - Emergency state written to InfluxDB for monitoring
//
// PID TUNING (Enhanced for Hopebridge):
// - Cooling PID: kp=2.8, ki=0.17, kd=0.01 (increased gains for responsive control)
// - Anti-windup: maxIntegral=10 for stable operation
// - Direct acting: Higher output = more cooling
//
// DATA STORAGE:
// - Commands are written directly to both Locations and ControlCommands databases
// - All operations are logged for troubleshooting
// - State storage maintains equipment timers and hysteresis logic
//
// TECHNICIAN NOTES:
// - Check supply air temperature sensor if any AHU control seems erratic
// - Verify outdoor temperature sensor for proper OAR and damper operation
// - AHU-1 chiller requires 2-minute pump warm-up and 5-minute cooldown
// - AHU-2 DX system has 7.5°F hysteresis - normal for temperature swings
// - AHU-2 minimum runtime is 15 minutes - prevents short cycling damage
// - All cooling systems require occupied mode + specific temperature conditions
// - Extended occupancy hours (5:30 AM - 9:45 PM) for therapy scheduling
// - Monitor state storage for timing sequences (pump warm-up, DX runtime, etc.)
// - FreezeStat trips disable all cooling - check mixed air and supply sensors
// - Use Node-RED dashboard to monitor real-time equipment states and timers
//
// ===============================================================================

import { airHandlerControl as airHandlerControlBase } from "../../base/air-handler";
import { pidControllerImproved } from "@/lib/pid-controller";
import { logLocationEquipment } from "@/lib/logging/location-logger";

// Helper to safely parse temperatures from various metric sources or settings
function parseSafeNumber(value: any, defaultValue: number): number {
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
function getAHUNumber(equipmentId: string): number {
  try {
    // Hardcoded mapping for specific equipment IDs
    const equipmentMap = {
      "FDhNArcvkL6v2cZDfuSR": 1,  // AHU-1
      "XS60eMHH8DJRXmvIv6wU": 2,  // AHU-2
      "57bJYUeT8vbjsKqzo0uD": 3   // AHU-3
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

export async function airHandlerControl(
  metricsInput: any,
  settingsInput: any,
  currentTempArgument: number,
  stateStorageInput: any
) {
  const equipmentId = settingsInput.equipmentId || "unknown";
  const locationId = settingsInput.locationId || "5";

  const currentMetrics = metricsInput;
  const currentSettings = settingsInput;

  logLocationEquipment(locationId, equipmentId, "air-handler", "Starting Hopebridge air handler control logic");

  try {
    // Initialize state storage if needed
    if (!stateStorageInput) {
      stateStorageInput = {};
    }

    // Determine which AHU this is (1, 2, or 3)
    const ahuNumber = getAHUNumber(equipmentId);
    logLocationEquipment(locationId, equipmentId, "air-handler", `Identified as AHU-${ahuNumber}`);

    // STEP 1: Get temperatures - Always use supply air temperature for control
    let currentTemp = currentTempArgument;

    if (currentTemp === undefined || isNaN(currentTemp)) {
      currentTemp = parseSafeNumber(currentMetrics.Supply,
        parseSafeNumber(currentMetrics.supplyTemperature,
        parseSafeNumber(currentMetrics.SupplyTemp,
        parseSafeNumber(currentMetrics.supplyTemp,
        parseSafeNumber(currentMetrics.SupplyTemperature,
        parseSafeNumber(currentMetrics.SAT,
        parseSafeNumber(currentMetrics.sat,
        parseSafeNumber(currentMetrics.SupplyAirTemp,
        parseSafeNumber(currentMetrics.supplyAirTemp, 55)))))))));

      logLocationEquipment(locationId, equipmentId, "air-handler", 
        `Using supply air temperature: ${currentTemp}°F`);
    } else {
      logLocationEquipment(locationId, equipmentId, "air-handler", 
        `Using provided supply air temperature: ${currentTemp}°F`);
    }

    // Get outdoor temperature with fallbacks
    const outdoorTemp = parseSafeNumber(currentMetrics.Outdoor_Air,
      parseSafeNumber(currentMetrics.outdoorTemperature,
      parseSafeNumber(currentMetrics.outdoorTemp,
      parseSafeNumber(currentMetrics.Outdoor,
      parseSafeNumber(currentMetrics.outdoor,
      parseSafeNumber(currentMetrics.OutdoorTemp,
      parseSafeNumber(currentMetrics.OAT,
      parseSafeNumber(currentMetrics.oat, 65))))))));

    // Get mixed air temperature for safety checks
    const mixedAirTemp = parseSafeNumber(currentMetrics.Mixed_Air,
      parseSafeNumber(currentMetrics.MixedAir,
      parseSafeNumber(currentMetrics.mixedAir,
      parseSafeNumber(currentMetrics.MAT,
      parseSafeNumber(currentMetrics.mat,
      parseSafeNumber(currentMetrics.MixedAirTemp,
      parseSafeNumber(currentMetrics.mixedAirTemp, 55)))))));

    logLocationEquipment(locationId, equipmentId, "air-handler", 
      `Temperatures: Supply=${currentTemp}°F, Outdoor=${outdoorTemp}°F, Mixed=${mixedAirTemp}°F`);

    // STEP 2: Determine occupancy based on time of day (5:30 AM to 9:45 PM)
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;

    const occupiedStartMinutes = 5 * 60 + 30;  // 5:30 AM
    const occupiedEndMinutes = 21 * 60 + 45;   // 9:45 PM

    const isOccupied = currentTimeInMinutes >= occupiedStartMinutes && 
                       currentTimeInMinutes <= occupiedEndMinutes;

    logLocationEquipment(locationId, equipmentId, "air-handler",
      `Current time: ${currentHour}:${currentMinute.toString().padStart(2, '0')}, ` +
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
        logLocationEquipment(locationId, equipmentId, "air-handler",
          `OAR: OAT ${outdoorTemp}°F <= ${minOAT}°F, using max setpoint: ${supplySetpoint}°F`);
      } else if (outdoorTemp >= maxOAT) {
        supplySetpoint = minSupply;
        logLocationEquipment(locationId, equipmentId, "air-handler",
          `OAR: OAT ${outdoorTemp}°F >= ${maxOAT}°F, using min setpoint: ${supplySetpoint}°F`);
      } else {
        const ratio = (outdoorTemp - minOAT) / (maxOAT - minOAT);
        supplySetpoint = maxSupply - ratio * (maxSupply - minSupply);
        supplySetpoint = parseFloat(supplySetpoint.toFixed(1));
        logLocationEquipment(locationId, equipmentId, "air-handler",
          `OAR: Calculated setpoint: ${supplySetpoint}°F (ratio: ${ratio.toFixed(2)})`);
      }
    } else {
      logLocationEquipment(locationId, equipmentId, "air-handler",
        `Using unoccupied setpoint: ${supplySetpoint}°F`);
    }

    // STEP 4: Check safety conditions
    const freezestatTripped = currentTemp < 40 || mixedAirTemp < 40;

    if (freezestatTripped) {
      logLocationEquipment(locationId, equipmentId, "air-handler", 
        `SAFETY: FREEZESTAT TRIPPED! Supply: ${currentTemp}°F, Mixed: ${mixedAirTemp}°F`);

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

      await writeToInfluxDB(locationId, equipmentId, safetyResult, "airhandler");
      return filterValidCommands(safetyResult);
    }

    // Check for supply temperature out of range for dampers
    const supplyTempOutOfRange = currentTemp < 40 || currentTemp > 80;
    if (supplyTempOutOfRange && !freezestatTripped) {
      logLocationEquipment(locationId, equipmentId, "air-handler",
        `SAFETY: Supply air temperature out of range (${currentTemp}°F), closing outdoor dampers`);
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
        logLocationEquipment(locationId, equipmentId, "air-handler",
          `Initializing OA damper state to OPEN (OAT ${outdoorTemp}°F >= 40°F)`);
      } else {
        logLocationEquipment(locationId, equipmentId, "air-handler",
          `Initializing OA damper state to CLOSED (OAT ${outdoorTemp}°F < 40°F)`);
      }
    }

    if (isOccupied && !freezestatTripped && !supplyTempOutOfRange) {
      if (stateStorageInput.hopebridgeOADamperState.isOpen) {
        if (outdoorTemp <= 38) {
          stateStorageInput.hopebridgeOADamperState.isOpen = false;
          outdoorDamperPosition = 0;
          logLocationEquipment(locationId, equipmentId, "air-handler",
            `OA damper: CLOSING (OAT ${outdoorTemp}°F <= 38°F)`);
        } else {
          outdoorDamperPosition = 100;
          logLocationEquipment(locationId, equipmentId, "air-handler",
            `OA damper: Maintaining OPEN (OAT ${outdoorTemp}°F > 38°F)`);
        }
      } else {
        if (outdoorTemp >= 40) {
          stateStorageInput.hopebridgeOADamperState.isOpen = true;
          outdoorDamperPosition = 100;
          logLocationEquipment(locationId, equipmentId, "air-handler",
            `OA damper: OPENING (OAT ${outdoorTemp}°F >= 40°F)`);
        } else {
          logLocationEquipment(locationId, equipmentId, "air-handler",
            `OA damper: Maintaining CLOSED (OAT ${outdoorTemp}°F < 40°F)`);
        }
      }
    } else {
      outdoorDamperPosition = 0;
      if (stateStorageInput.hopebridgeOADamperState) {
        stateStorageInput.hopebridgeOADamperState.isOpen = false;
      }
      
      if (!isOccupied) {
        logLocationEquipment(locationId, equipmentId, "air-handler", `OA damper: CLOSED (unoccupied mode)`);
      } else {
        logLocationEquipment(locationId, equipmentId, "air-handler", `OA damper: CLOSED (safety protection)`);
      }
    }

    // STEP 6: Determine fan status
    const fanEnabled = isOccupied && !freezestatTripped;
    const fanSpeed = fanEnabled ? "medium" : "off";

    logLocationEquipment(locationId, equipmentId, "air-handler", 
      `Fan: ${fanEnabled ? "ENABLED" : "DISABLED"} (${fanSpeed})`);

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
          logLocationEquipment(locationId, equipmentId, "air-handler",
            `AHU-1: CW circulation pump ENABLED (conditions met)`);

          // Chiller warm-up logic
          if (!stateStorageInput.chillerState.isEnabled) {
            stateStorageInput.chillerState.pumpRunningTime += 1;

            if (stateStorageInput.chillerState.pumpRunningTime >= 2) {
              chillerEnabled = true;
              stateStorageInput.chillerState.isEnabled = true;
              logLocationEquipment(locationId, equipmentId, "air-handler",
                `AHU-1: CHILLER ENABLED after pump warm-up period`);
            } else {
              logLocationEquipment(locationId, equipmentId, "air-handler",
                `AHU-1: Pump warm-up: ${stateStorageInput.chillerState.pumpRunningTime}/2 minutes`);
            }
          } else {
            chillerEnabled = true;
          }

          // PID control for CW valve
          if (!stateStorageInput.pidState) {
            stateStorageInput.pidState = { integral: 0, previousError: 0, lastOutput: 0 };
          }

          const coolingPID = pidControllerImproved({
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
          logLocationEquipment(locationId, equipmentId, "air-handler",
            `AHU-1: CW valve position: ${coolingValvePosition.toFixed(1)}% (PID control)`);
        } else {
          // Chiller shutdown sequence
          if (stateStorageInput.chillerState && stateStorageInput.chillerState.isEnabled) {
            chillerEnabled = false;
            stateStorageInput.chillerState.isEnabled = false;
            stateStorageInput.chillerState.pumpRunningTime = 0;

            if (!stateStorageInput.chillerShutdownTimer) {
              stateStorageInput.chillerShutdownTimer = 5;
              cwCircPumpEnabled = true;
              logLocationEquipment(locationId, equipmentId, "air-handler",
                `AHU-1: CHILLER DISABLED, pump cooldown: 5 minutes`);
            } else if (stateStorageInput.chillerShutdownTimer > 0) {
              stateStorageInput.chillerShutdownTimer -= 1;
              cwCircPumpEnabled = true;
              logLocationEquipment(locationId, equipmentId, "air-handler",
                `AHU-1: Pump cooldown: ${stateStorageInput.chillerShutdownTimer} minutes remaining`);
            } else {
              cwCircPumpEnabled = false;
              stateStorageInput.chillerShutdownTimer = null;
              logLocationEquipment(locationId, equipmentId, "air-handler",
                `AHU-1: CW circulation pump DISABLED after cooldown`);
            }
          } else {
            logLocationEquipment(locationId, equipmentId, "air-handler",
              `AHU-1: CW circulation pump DISABLED (conditions not met)`);
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

              logLocationEquipment(locationId, equipmentId, "air-handler",
                `AHU-2: DX cooling TURNING ON (${currentTemp}°F > ${(supplySetpoint + hysteresis/2).toFixed(1)}°F)`);
            }
          } else {
            stateStorageInput.dxState.runningTime += 1;

            if (currentTemp < stateStorageInput.dxState.hysteresisPoint && 
                stateStorageInput.dxState.runningTime >= 15) {
              stateStorageInput.dxState.isRunning = false;
              stateStorageInput.dxState.runningTime = 0;
              dxEnabled = false;
              coolingValvePosition = 0;

              logLocationEquipment(locationId, equipmentId, "air-handler",
                `AHU-2: DX cooling TURNING OFF (temp satisfied and minimum runtime met)`);
            } else {
              dxEnabled = true;
              coolingValvePosition = 100;

              if (stateStorageInput.dxState.runningTime < 15) {
                logLocationEquipment(locationId, equipmentId, "air-handler",
                  `AHU-2: DX cooling ON (minimum runtime: ${stateStorageInput.dxState.runningTime}/15 min)`);
              } else {
                logLocationEquipment(locationId, equipmentId, "air-handler",
                  `AHU-2: DX cooling ON (running normally)`);
              }
            }
          }
        } else {
          dxEnabled = false;
          coolingValvePosition = 0;
          if (stateStorageInput.dxState.isRunning) {
            stateStorageInput.dxState.isRunning = false;
            stateStorageInput.dxState.runningTime = 0;
            logLocationEquipment(locationId, equipmentId, "air-handler",
              `AHU-2: DX cooling FORCED OFF (conditions not met)`);
          }
        }
      } else if (ahuNumber === 3) {
        // AHU-3: Simplified CW actuator control
        const cwValveConditionsMet = outdoorTemp > 55 && currentTemp > 38 && fanEnabled;

        if (cwValveConditionsMet) {
          if (!stateStorageInput.pidStateAhu3) {
            stateStorageInput.pidStateAhu3 = { integral: 0, previousError: 0, lastOutput: 0 };
          }

          const coolingPID = pidControllerImproved({
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
          logLocationEquipment(locationId, equipmentId, "air-handler",
            `AHU-3: CW valve position: ${coolingValvePosition.toFixed(1)}% (PID control)`);
        } else {
          coolingValvePosition = 0;
          logLocationEquipment(locationId, equipmentId, "air-handler",
            `AHU-3: CW valve CLOSED (conditions not met)`);
        }
      }
    } else {
      logLocationEquipment(locationId, equipmentId, "air-handler", 
        `All cooling disabled (${!isOccupied ? "unoccupied" : "safety protection"})`);
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

    logLocationEquipment(locationId, equipmentId, "air-handler",
      `Final AHU-${ahuNumber} controls: Fan=${result.fanEnabled ? "ON" : "OFF"}, ` +
      `Cooling=${result.coolingValvePosition.toFixed(1)}%, OA damper=${result.outdoorDamperPosition}%, ` +
      `isOccupied=${result.isOccupied}` +
      (ahuNumber === 1 ? `, CW pump=${result.cwCircPumpEnabled ? "ON" : "OFF"}, Chiller=${result.chillerEnabled ? "ON" : "OFF"}` :
       ahuNumber === 2 ? `, DX=${result.dxEnabled ? "ON" : "OFF"}` :
       `, CW valve=${result.coolingValvePosition.toFixed(1)}%`));

    // STEP 9: Write to InfluxDB
    await writeToInfluxDB(locationId, equipmentId, result, "airhandler");

    // STEP 10: Return filtered result
    return filterValidCommands(result);

  } catch (error: any) {
    logLocationEquipment(locationId, equipmentId, "air-handler", 
      `ERROR in Hopebridge air handler control: ${error.message}`, error.stack);

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

    try {
      await writeToInfluxDB(locationId, equipmentId, errorResult, "airhandler");
    } catch (writeError) {
      logLocationEquipment(locationId, equipmentId, "air-handler", 
        `Failed to write emergency state to InfluxDB: ${writeError.message}`);
    }

    return errorResult;
  }
}

/**
 * Helper function to filter result to only include valid control commands
 */
function filterValidCommands(result: any): any {
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

/**
 * Helper function to write AIR HANDLER data to InfluxDB with proper error handling
 */
async function writeToInfluxDB(locationId: string, equipmentId: string, data: any, equipmentType: string): Promise<void> {
  try {
    // AIR HANDLER COMMANDS
    const commandsToSend = [
      { command_type: 'heatingValvePosition', equipment_id: equipmentId, value: data.heatingValvePosition },
      { command_type: 'coolingValvePosition', equipment_id: equipmentId, value: data.coolingValvePosition },
      { command_type: 'fanEnabled', equipment_id: equipmentId, value: data.fanEnabled },
      { command_type: 'fanSpeed', equipment_id: equipmentId, value: data.fanSpeed },
      { command_type: 'outdoorDamperPosition', equipment_id: equipmentId, value: data.outdoorDamperPosition },
      { command_type: 'supplyAirTempSetpoint', equipment_id: equipmentId, value: data.supplyAirTempSetpoint },
      { command_type: 'temperatureSetpoint', equipment_id: equipmentId, value: data.temperatureSetpoint },
      { command_type: 'unitEnable', equipment_id: equipmentId, value: data.unitEnable },
      { command_type: 'isOccupied', equipment_id: equipmentId, value: data.isOccupied }
    ];

    // Add equipment-specific commands
    if (data.dxEnabled !== undefined) {
      commandsToSend.push({ command_type: 'dxEnabled', equipment_id: equipmentId, value: data.dxEnabled });
    }
    if (data.cwCircPumpEnabled !== undefined) {
      commandsToSend.push({ command_type: 'cwCircPumpEnabled', equipment_id: equipmentId, value: data.cwCircPumpEnabled });
    }
    if (data.chillerEnabled !== undefined) {
      commandsToSend.push({ command_type: 'chillerEnabled', equipment_id: equipmentId, value: data.chillerEnabled });
    }

    const numericCommands = [];

    // Process commands with correct data types for InfluxDB schema
    for (const cmd of commandsToSend) {
      // Boolean fields - handle different types based on field
      if (['fanEnabled'].includes(cmd.command_type)) {
        cmd.value = cmd.value ? 1.0 : 0.0; // fanEnabled uses 1/0
      } else if (['unitEnable', 'isOccupied', 'dxEnabled', 'cwCircPumpEnabled', 'chillerEnabled'].includes(cmd.command_type)) {
        cmd.value = cmd.value ? 'true' : 'false'; // Other booleans use true/false
      }
      // Numeric fields
      else if (['heatingValvePosition', 'coolingValvePosition', 'outdoorDamperPosition', 
                'supplyAirTempSetpoint', 'temperatureSetpoint'].includes(cmd.command_type)) {
        if (typeof cmd.value === 'number') {
          // Already numeric
        } else if (cmd.value !== null && cmd.value !== undefined) {
          const numValue = Number(cmd.value);
          if (!isNaN(numValue)) {
            cmd.value = numValue;
          } else {
            continue;
          }
        } else {
          cmd.value = 0.0;
        }
      }
      // String fields
      else if (['fanSpeed'].includes(cmd.command_type)) {
        cmd.value = `"${cmd.value}"`;
      }

      numericCommands.push(cmd);
    }

    if (numericCommands.length > 0) {
      const { execSync } = require('child_process');

      let successCount = 0;
      let errorCount = 0;

      // Send each command individually using synchronous exec
      for (const cmd of numericCommands) {
        const lineProtocol = `update_${cmd.command_type},equipment_id=${cmd.equipment_id},location_id=${locationId},command_type=${cmd.command_type},equipment_type=airhandler,source=server_logic,status=completed value=${cmd.value}`;

        // Write to ControlCommands DB
        const controlCommand = `curl -s -X POST "http://localhost:8181/api/v3/write_lp?db=ControlCommands&precision=nanosecond" -H "Content-Type: text/plain" -d '${lineProtocol}'`;

        try {
          const result = execSync(controlCommand, { encoding: 'utf8', timeout: 5000 });
          if (result && result.trim()) {
            logLocationEquipment(locationId, equipmentId, equipmentType, `ControlCommands response for ${cmd.command_type}: ${result.trim()}`);
          } else {
            successCount++;
            logLocationEquipment(locationId, equipmentId, equipmentType, `ControlCommands SUCCESS: ${cmd.command_type}=${cmd.value}`);
          }
        } catch (error) {
          errorCount++;
          logLocationEquipment(locationId, equipmentId, equipmentType, `ControlCommands ERROR for ${cmd.command_type}: ${error.message}`);
        }

        // Write to Locations DB
        const locationsCommand = `curl -s -X POST "http://localhost:8181/api/v3/write_lp?db=Locations&precision=nanosecond" -H "Content-Type: text/plain" -d '${lineProtocol}'`;

        try {
          const result = execSync(locationsCommand, { encoding: 'utf8', timeout: 5000 });
          if (result && result.trim()) {
            logLocationEquipment(locationId, equipmentId, equipmentType, `Locations response for ${cmd.command_type}: ${result.trim()}`);
          }
        } catch (error) {
          logLocationEquipment(locationId, equipmentId, equipmentType, `Locations ERROR for ${cmd.command_type}: ${error.message}`);
        }
      }

      logLocationEquipment(locationId, equipmentId, equipmentType, 
        `InfluxDB write complete: ${successCount} success, ${errorCount} errors out of ${numericCommands.length} commands`);
    }
  } catch (error) {
    logLocationEquipment(locationId, equipmentId, equipmentType, `Error sending InfluxDB commands: ${error.message}`);
  }
}
