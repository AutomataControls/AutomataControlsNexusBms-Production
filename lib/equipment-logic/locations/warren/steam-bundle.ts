// lib/equipment-logic/locations/warren/steam-bundle.ts
import { logLocationEquipment } from "@/lib/logging/location-logger";
import { pidControllerImproved } from "@/lib/pid-controller";

/**
 * Steam Bundle Control Logic for Warren
 * - Two valves: Primary (1/3) and Secondary (2/3)
 * - OAR: Min OAT 32°F → SP 155°F, Max OAT 70°F → All valves OFF
 * - Valves: Direct acting 0-10V with PID control
 * - Safety shutoff: 165°F
 * - Operation dependency: Amp reading > 10 from HWPump-1 OR HWPump-2
 */
export function steamBundleControl(metrics: any, settings: any, currentTemp: number, pidState: any): any {
  // Extract equipment ID and location ID for logging
  const equipmentId = settings.equipmentId || "unknown";
  const locationId = settings.locationId || "1"; // Default to Warren (ID: 1)
  
  logLocationEquipment(locationId, equipmentId, "steam-bundle", "Starting Warren steam bundle control logic");

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
    
    logLocationEquipment(locationId, equipmentId, "steam-bundle", `Using supply temperature: ${currentTemp}°F`);
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
  
  logLocationEquipment(locationId, equipmentId, "steam-bundle", `Outdoor temperature: ${outdoorTemp}°F`);
  
  // STEP 3: Check HW pump amp readings
  const hwPump1Amps = metrics.HWPump1Amps || 
                     metrics.hwPump1Amps || 
                     metrics["HWPump-1 Amps"] || 
                     metrics["hwPump-1 Amps"] || 
                     metrics.hwPump1_Amps || 
                     0;
  
  const hwPump2Amps = metrics.HWPump2Amps || 
                     metrics.hwPump2Amps || 
                     metrics["HWPump-2 Amps"] || 
                     metrics["hwPump-2 Amps"] || 
                     metrics.hwPump2_Amps || 
                     0;
  
  logLocationEquipment(locationId, equipmentId, "steam-bundle", 
    `HW Pump amp readings: Pump 1: ${hwPump1Amps}A, Pump 2: ${hwPump2Amps}A`);
  
  const pumpRunning = hwPump1Amps > 10 || hwPump2Amps > 10;
  
  if (!pumpRunning) {
    logLocationEquipment(locationId, equipmentId, "steam-bundle", 
      "No HW pump with amps > 10 detected, disabling steam bundle");
    
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
  // OAR: Min OAT 32°F → SP 155°F, Max OAT 70°F → All valves OFF
  let setpoint = 0;
  let systemEnabled = false;
  
  if (outdoorTemp <= 32) {
    // At or below minimum OAT: Maximum setpoint
    setpoint = 155;
    systemEnabled = true;
    logLocationEquipment(locationId, equipmentId, "steam-bundle", 
      `OAR: OAT ${outdoorTemp}°F <= 32°F, using max setpoint: ${setpoint}°F`);
  } else if (outdoorTemp >= 70) {
    // At or above maximum OAT: System off
    setpoint = 0;
    systemEnabled = false;
    logLocationEquipment(locationId, equipmentId, "steam-bundle", 
      `OAR: OAT ${outdoorTemp}°F >= 70°F, system disabled`);
  } else {
    // Linear interpolation for values between min and max
    // Calculate how far we are between 32°F and 70°F
    const ratio = (outdoorTemp - 32) / (70 - 32);
    // Interpolate between 155°F and 0°F
    setpoint = 155 * (1 - ratio);
    systemEnabled = true;
    logLocationEquipment(locationId, equipmentId, "steam-bundle", 
      `OAR: Calculated setpoint: ${setpoint.toFixed(1)}°F (ratio: ${ratio.toFixed(2)})`);
  }
  
  // STEP 5: Apply safety check - shut off if temperature exceeds 165°F
  if (currentTemp >= 165) {
    logLocationEquipment(locationId, equipmentId, "steam-bundle", 
      `SAFETY: High temperature shutdown at ${currentTemp}°F >= 165°F`);
    
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
  logLocationEquipment(locationId, equipmentId, "steam-bundle", 
    `PID Input: setpoint=${setpoint}°F, current=${currentTemp}°F, error=${error}°F`);
  
  // Only run PID if error is positive (need more heat)
  let primaryValvePosition = 0;
  let secondaryValvePosition = 0;
  
  if (error > 0) {
    // Configure PID parameters
    const pidParams = {
      kp: 2.0,           // Proportional gain
      ki: 0.1,           // Integral gain
      kd: 0.1,           // Derivative gain
      outputMin: 0,      // Minimum output (0%)
      outputMax: 100,    // Maximum output (100%)
      enabled: true,
      reverseActing: false, // Direct acting (more output = more heat)
      maxIntegral: 20    // Anti-windup
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
    logLocationEquipment(locationId, equipmentId, "steam-bundle", 
      `PID Output: ${pidOutput.output.toFixed(1)}%, P=${pidOutput.p.toFixed(1)}, ` +
      `I=${pidOutput.i.toFixed(1)}, D=${pidOutput.d.toFixed(1)}`);
    
    // Stage the valves based on PID output
    // Primary valve (1/3 capacity) operates in the 0-33% range
    // Secondary valve (2/3 capacity) operates in the 33-100% range
    
    // Calculate valve positions
    if (pidOutput.output <= 33) {
      // Only use primary valve (up to 100% of primary)
      primaryValvePosition = (pidOutput.output / 33) * 100;
      secondaryValvePosition = 0;
      
      logLocationEquipment(locationId, equipmentId, "steam-bundle", 
        `Using primary valve only: ${primaryValvePosition.toFixed(1)}%`);
    } else {
      // Primary valve at 100%, modulate secondary valve
      primaryValvePosition = 100;
      // Map 33% to 100% PID output to 0% to 100% secondary valve
      secondaryValvePosition = ((pidOutput.output - 33) / 67) * 100;
      
      logLocationEquipment(locationId, equipmentId, "steam-bundle", 
        `Primary valve: 100%, Secondary valve: ${secondaryValvePosition.toFixed(1)}%`);
    }
    
    // Ensure valve positions are within bounds (0-100%)
    primaryValvePosition = Math.max(0, Math.min(100, primaryValvePosition));
    secondaryValvePosition = Math.max(0, Math.min(100, secondaryValvePosition));
  } else {
    logLocationEquipment(locationId, equipmentId, "steam-bundle", 
      `Temperature above setpoint (${currentTemp}°F > ${setpoint}°F), closing valves`);
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
  logLocationEquipment(locationId, equipmentId, "steam-bundle", 
    `Final control values: primary valve=${result.primaryValvePosition.toFixed(1)}%, ` +
    `secondary valve=${result.secondaryValvePosition.toFixed(1)}%, ` +
    `setpoint=${result.temperatureSetpoint}°F`, 
    result);
  
  return result;
}
