// lib/equipment-logic/base/steam-bundle.ts
// Import the correct function name from location-logger
import { logLocationEquipment } from "@/lib/logging/location-logger";
import { pidControllerImproved } from "@/lib/pid-controller";

// Create a compatibility wrapper to maintain existing code
function logEquipment(equipmentId: string, message: string, data?: any) {
  // Get locationId from the calling context or default to unknown
  // The actual locationId will be available from the settings parameter in steamBundleControl
  const locationId = "4"; // Default to Huntington
  const equipmentType = "steam-bundle";
  logLocationEquipment(locationId, equipmentId, equipmentType, message, data);
}

/**
 * Base Steam Bundle Control Logic
 * - Standard implementation for dual valve control (primary/secondary)
 * - Configurable OAR (Outdoor Air Reset)
 * - Supply temperature PID control
 * - Pump dependency check
 * - High temperature safety cutoff
 */
export function steamBundleControl(metrics: any, settings: any, currentTemp: number, pidState: any): any {
  // Extract equipment ID and location ID for logging
  const equipmentId = settings.equipmentId || "unknown";
  const locationId = settings.locationId || "unknown";

  logEquipment(equipmentId, "Starting base steam bundle control logic");

  // STEP 1: Get supply temperature if not provided
  if (currentTemp === undefined) {
    currentTemp = metrics.Supply ||
                 metrics.supplyTemperature ||
                 metrics.SupplyTemp ||
                 metrics.supplyTemp ||
                 metrics.SupplyTemperature ||
                 metrics.bundleTemp ||
                 metrics.BundleTemp ||
                 metrics.steamBundleTemp ||
                 metrics.SteamBundleTemp ||
                 metrics.heatExchangerTemp ||
                 metrics.HeatExchangerTemp ||
                 140; // Default fallback temperature

    logEquipment(equipmentId, `Using supply temperature: ${currentTemp}°F`);
  }

  // STEP 2: Get outdoor temperature with fallbacks
  const outdoorTemp = metrics.Outdoor_Air ||
                     metrics.outdoorTemperature ||
                     metrics.outdoorTemp ||
                     metrics.Outdoor ||
                     metrics.outdoor ||
                     metrics.OutdoorTemp ||
                     metrics.OAT ||
                     metrics.oat ||
                     50; // Default fallback

  logEquipment(equipmentId, `Outdoor temperature: ${outdoorTemp}°F`);

  // STEP 3: Check pump operation (if metrics available)
  // Different locations might have different pump naming conventions
  const pumpRunning = checkPumpOperation(metrics);

  // Log pump status
  if (pumpRunning) {
    logEquipment(equipmentId, "Pump operation confirmed");
  } else {
    logEquipment(equipmentId, "No active pump detected");
  }

  // If pump dependency is enabled and no pump is running, disable the steam bundle
  if (settings.requirePump !== false && !pumpRunning) {
    logEquipment(equipmentId, "Steam bundle disabled due to no pump operation");

    return {
      primaryValvePosition: 0,     // Close primary valve (0%)
      secondaryValvePosition: 0,   // Close secondary valve (0%)
      temperatureSetpoint: 0,      // No setpoint when disabled
      unitEnable: false,           // Unit disabled
      pumpStatus: "off",           // Pumps not running
      safetyStatus: "no_pump"      // Reason for shutdown
    };
  }

  // STEP 4: Apply Outdoor Air Reset logic
  // Get OAR parameters from settings with defaults
  const oarEnabled = settings.outdoorAirReset?.enabled !== false;

  // OAR configuration with defaults
  const minOAT = settings.outdoorAirReset?.minOutdoorTemp || 32; // Below this, use max setpoint
  const maxOAT = settings.outdoorAirReset?.maxOutdoorTemp || 70; // Above this, system off
  const minSetpoint = 0;                                         // Minimum setpoint (system off)
  const maxSetpoint = settings.outdoorAirReset?.maxSetpoint || 155; // Maximum setpoint at min OAT

  let setpoint = 0;
  let systemEnabled = false;

  if (oarEnabled) {
    if (outdoorTemp <= minOAT) {
      // At or below minimum OAT: Maximum setpoint
      setpoint = maxSetpoint;
      systemEnabled = true;
      logEquipment(equipmentId, `OAR: OAT ${outdoorTemp}°F <= ${minOAT}°F, using max setpoint: ${setpoint}°F`);
    } else if (outdoorTemp >= maxOAT) {
      // At or above maximum OAT: System off
      setpoint = minSetpoint;
      systemEnabled = false;
      logEquipment(equipmentId, `OAR: OAT ${outdoorTemp}°F >= ${maxOAT}°F, system disabled`);
    } else {
      // Linear interpolation for values between min and max
      // Calculate how far we are between minOAT and maxOAT
      const ratio = (outdoorTemp - minOAT) / (maxOAT - minOAT);
      // Interpolate between maxSetpoint and minSetpoint
      setpoint = maxSetpoint * (1 - ratio);
      systemEnabled = true;
      logEquipment(equipmentId, `OAR: Calculated setpoint: ${setpoint.toFixed(1)}°F (ratio: ${ratio.toFixed(2)})`);
    }
  } else {
    // If OAR is disabled, use fixed setpoint from settings
    setpoint = settings.temperatureSetpoint || 150;
    systemEnabled = true;
    logEquipment(equipmentId, `OAR disabled: Using fixed setpoint: ${setpoint}°F`);
  }

  // STEP 5: Apply safety check - configurable high temperature shutoff
  const safetyShutoffTemp = settings.safetyShutoffTemp || 165;

  if (currentTemp >= safetyShutoffTemp) {
    logEquipment(equipmentId, `SAFETY: High temperature shutdown at ${currentTemp}°F >= ${safetyShutoffTemp}°F`);

    return {
      primaryValvePosition: 0,     // Close primary valve (0%)
      secondaryValvePosition: 0,   // Close secondary valve (0%)
      temperatureSetpoint: setpoint, // Keep calculated setpoint for reference
      unitEnable: false,           // Unit disabled
      pumpStatus: pumpRunning ? "running" : "off",
      safetyStatus: "high_temp"    // Reason for shutdown
    };
  }

  // STEP 6: If system disabled due to OAR, return all valves closed
  if (!systemEnabled) {
    return {
      primaryValvePosition: 0,     // Close primary valve (0%)
      secondaryValvePosition: 0,   // Close secondary valve (0%)
      temperatureSetpoint: setpoint, // Keep calculated setpoint for reference
      unitEnable: false,           // Unit disabled
      pumpStatus: pumpRunning ? "running" : "off",
      safetyStatus: "oar_disabled" // Reason for shutdown
    };
  }

  // STEP 7: Calculate valve positions using PID
  // Initialize PID state if needed
  if (!pidState.steamBundleControl) {
    pidState.steamBundleControl = {};
  }

  // Calculate error (setpoint - current temp)
  const error = setpoint - currentTemp;
  logEquipment(equipmentId, `PID Input: setpoint=${setpoint}°F, current=${currentTemp}°F, error=${error}°F`);

  // Only run PID if error is positive (need more heat)
  let primaryValvePosition = 0;
  let secondaryValvePosition = 0;

  if (error > 0) {
    // Configure PID parameters - use settings if available, otherwise use defaults
    const pidParams = {
      kp: settings.pidControllers?.heating?.kp || 2.0,      // Proportional gain
      ki: settings.pidControllers?.heating?.ki || 0.1,      // Integral gain
      kd: settings.pidControllers?.heating?.kd || 0.1,      // Derivative gain
      outputMin: 0,                                         // Minimum output (0%)
      outputMax: 100,                                       // Maximum output (100%)
      enabled: true,
      reverseActing: false,                                // Direct acting (more output = more heat)
      maxIntegral: settings.pidControllers?.heating?.maxIntegral || 20  // Anti-windup
    };

    // Calculate PID output
    const pidOutput = pidControllerImproved({
      input: currentTemp,
      setpoint: setpoint,
      pidParams: pidParams,
      dt: 1,
      controllerType: "steamBundle",
      pidState: pidState.steamBundleControl
    });

    // Log PID details
    logEquipment(equipmentId, `PID Output: ${pidOutput.output.toFixed(1)}%, P=${pidOutput.p.toFixed(1)}, ` +
      `I=${pidOutput.i.toFixed(1)}, D=${pidOutput.d.toFixed(1)}`);

    // Get valve configuration (defaults to primary 1/3, secondary 2/3 capacity)
    const primaryValveRatio = settings.primaryValveRatio || 0.33;  // Default: primary valve is 1/3 of total capacity
    const primaryThreshold = primaryValveRatio * 100;              // % of total output where secondary valve starts

    // Stage the valves based on PID output and valve configuration
    if (pidOutput.output <= primaryThreshold) {
      // Only use primary valve until we reach its capacity
      primaryValvePosition = (pidOutput.output / primaryThreshold) * 100;
      secondaryValvePosition = 0;

      logEquipment(equipmentId, `Using primary valve only: ${primaryValvePosition.toFixed(1)}%`);
    } else {
      // Primary valve at 100%, modulate secondary valve
      primaryValvePosition = 100;
      // Map remaining output to secondary valve
      secondaryValvePosition = ((pidOutput.output - primaryThreshold) / (100 - primaryThreshold)) * 100;

      logEquipment(equipmentId, `Primary valve: 100%, Secondary valve: ${secondaryValvePosition.toFixed(1)}%`);
    }

    // Ensure valve positions are within bounds (0-100%)
    primaryValvePosition = Math.max(0, Math.min(100, primaryValvePosition));
    secondaryValvePosition = Math.max(0, Math.min(100, secondaryValvePosition));
  } else {
    logEquipment(equipmentId, `Temperature above setpoint (${currentTemp}°F > ${setpoint}°F), closing valves`);
  }

  // STEP 8: Return the final control values
  const result = {
    primaryValvePosition: primaryValvePosition,     // Primary valve position (0-100%)
    secondaryValvePosition: secondaryValvePosition, // Secondary valve position (0-100%)
    temperatureSetpoint: setpoint,                  // Calculated setpoint
    unitEnable: true,                               // Unit enabled
    pumpStatus: pumpRunning ? "running" : "off",    // Pump status
    safetyStatus: "normal"                          // Normal operation
  };

  // Log the final control values
  logEquipment(equipmentId, `Final control values: primary valve=${result.primaryValvePosition.toFixed(1)}%, ` +
    `secondary valve=${result.secondaryValvePosition.toFixed(1)}%, ` +
    `setpoint=${result.temperatureSetpoint}°F`,
    result);

  return result;
}

/**
 * Helper function to check for pump operation across various naming conventions
 */
function checkPumpOperation(metrics: any): boolean {
  // Check all common pump amp naming patterns
  const pumpAmpPatterns = [
    "HWPump1Amps", "hwPump1Amps", "HWPump-1 Amps", "hwPump-1 Amps", "hwPump1_Amps",
    "HWPump2Amps", "hwPump2Amps", "HWPump-2 Amps", "hwPump-2 Amps", "hwPump2_Amps",
    "PumpAmps", "pumpAmps", "Pump_Amps", "pump_amps", "PumpCurrentA", "pumpCurrentA",
    "P1Amps", "p1Amps", "P2Amps", "p2Amps", "Pump1Amps", "pump1Amps", "Pump2Amps", "pump2Amps"
  ];

  // Check for pump running status fields
  const pumpStatusPatterns = [
    "PumpStatus", "pumpStatus", "PumpRunning", "pumpRunning", "HWPumpStatus", "hwPumpStatus",
    "Pump1Status", "pump1Status", "Pump2Status", "pump2Status",
    "P1Status", "p1Status", "P2Status", "p2Status"
  ];

  // Check amp readings first - these are most reliable
  for (const pattern of pumpAmpPatterns) {
    if (metrics[pattern] !== undefined) {
      const ampReading = Number(metrics[pattern]);
      if (!isNaN(ampReading) && ampReading > 0.5) {
        return true; // Pump running if amps > 0.5
      }
    }
  }

  // Then check status fields which might be boolean or text
  for (const pattern of pumpStatusPatterns) {
    if (metrics[pattern] !== undefined) {
      const status = metrics[pattern];
      if (status === true || status === 1 || status === "on" || status === "running") {
        return true;
      }
    }
  }

  // No active pump found
  return false;
}
