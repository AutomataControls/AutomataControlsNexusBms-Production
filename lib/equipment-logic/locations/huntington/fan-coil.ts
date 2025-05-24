// lib/equipment-logic/locations/huntington/fan-coil.ts
import { fanCoilControl as fanCoilControlBase } from "../../base/fan-coil";
import { pidControllerImproved } from "@/lib/pid-controller";
import { logLocationEquipment } from "@/lib/logging/location-logger";

/**
 * Fan Coil Control Logic specifically for Huntington
 * - Uses Supply temperature as control source
 * - Binary damper control (1/0)
 * - OAR: 32°F outdoor -> 76°F setpoint, 74°F outdoor -> 71.5°F setpoint
 * - Cooling: Direct acting (0V closed, 10V open) - UPDATED full range
 * - Heating: Reverse acting (10V closed, 0V open) - UPDATED full range
 * - Safety: FreezeStat at 40°F supply, Hi-Limit at 115°F
 */
export function fanCoilControl(metrics, settings, currentTemp, pidState) {
  const equipmentId = settings.equipmentId || "unknown";
  const locationId = settings.locationId || "4"; // Default to Huntington

  logLocationEquipment(locationId, equipmentId, "fan-coil", "Starting Huntington-specific fan coil control logic");

  // STEP 1: Always use Supply temperature for Huntington
  if (currentTemp === undefined) {
    currentTemp = metrics.Supply || metrics.supplyTemp || metrics.SupplyTemp ||
                  metrics.supplyTemperature || metrics.SupplyTemperature ||
                  metrics.discharge || metrics.Discharge || 55;

    logLocationEquipment(locationId, equipmentId, "fan-coil", `Using supply temperature: ${currentTemp}°F`);
  }

  // STEP 2: Apply Outdoor Air Reset (OAR) logic
  const outdoorTemp = metrics.Outdoor_Air || metrics.outdoorTemperature ||
                     metrics.outdoorTemp || metrics.Outdoor || metrics.OAT || 70;

  // ---------------------------------------------------------------------------
  // STEP 3: USER SETTINGS - FIXED TO LOOK IN SETTINGS NOT METRICS
  // ---------------------------------------------------------------------------
  
  // Important: Log the raw metrics for debugging
  logLocationEquipment(locationId, equipmentId, "fan-coil", 
    `DEBUG - Raw metrics: ${JSON.stringify(metrics)}`);
  
  // CRITICAL FIX: User settings actually come from settings object, not metrics!
  // They have snake_case naming in settings, not metrics
  const userControlsFromUI = {
    // Temperature setpoint (from Apply Temperature button)
    temperatureSetpoint: settings.temperature_setpoint !== undefined ? 
                         parseFloat(settings.temperature_setpoint) : undefined,
    
    // Unit enable state (from UI toggle)
    unitEnable: settings.unit_enable !== undefined ? 
                settings.unit_enable === true || settings.unit_enable === "true" || settings.unit_enable === 1 : undefined,
    
    // Fan enable state (from UI toggle)
    fanEnabled: settings.fan_enabled !== undefined ? 
                settings.fan_enabled === true || settings.fan_enabled === "true" || settings.fan_enabled === 1 : undefined,
    
    // Fan speed (from UI dropdown)
    fanSpeed: settings.fan_speed,
    
    // Fan mode (from UI dropdown)
    fanMode: settings.fan_mode,
    
    // Valve modes (from UI dropdown)
    heatingValveMode: settings.heating_valve_mode,
    coolingValveMode: settings.cooling_valve_mode,
    
    // Valve positions (from UI sliders)
    heatingValvePosition: settings.heating_valve_position !== undefined ? 
                          parseFloat(settings.heating_valve_position) : undefined,
    coolingValvePosition: settings.cooling_valve_position !== undefined ? 
                          parseFloat(settings.cooling_valve_position) : undefined,
    
    // Outdoor damper position (from UI slider)
    outdoorDamperPosition: settings.outdoor_damper_position !== undefined ? 
                          parseFloat(settings.outdoor_damper_position) : undefined,
                          
    // Operation mode (from UI dropdown)
    operationMode: settings.operation_mode
  };
  
  // Get database values (medium priority) from settings - use camelCase fields
  const controlsFromDB = {
    temperatureSetpoint: settings.temperatureSetpoint,
    unitEnable: settings.unitEnable,
    fanEnabled: settings.fanEnabled,
    fanSpeed: settings.fanSpeed,
    fanMode: settings.fanMode,
    heatingValveMode: settings.heatingValveMode,
    coolingValveMode: settings.coolingValveMode,
    heatingValvePosition: settings.heatingValvePosition,
    coolingValvePosition: settings.coolingValvePosition,
    outdoorDamperPosition: settings.outdoorDamperPosition,
    operationMode: settings.operationMode
  };
  
  // Log all settings for debugging
  logLocationEquipment(locationId, equipmentId, "fan-coil", 
    `FULL SETTINGS: ${JSON.stringify(settings)}`);
  
  // Log what user settings were found
  logLocationEquipment(locationId, equipmentId, "fan-coil", 
    `USER SETTINGS FOUND: ${JSON.stringify(userControlsFromUI, (k, v) => v === undefined ? "N/A" : v)}`);
  
  // Calculate OAR setpoint
  let oarSetpointValue = 72; // Default fallback

  if (settings.outdoorAirReset?.enabled !== false) {
    // Calculate slope: (71.5 - 76) / (74 - 32) = -4.5 / 42 = -0.107
    const slope = -0.107;
    // Calculate setpoint: 76 + slope * (outdoorTemp - 32)
    oarSetpointValue = 76 + slope * (outdoorTemp - 32);
    // Clamp to reasonable range
    oarSetpointValue = Math.max(68, Math.min(78, oarSetpointValue));

    logLocationEquipment(locationId, equipmentId, "fan-coil",
      `OAR calculation: Outdoor temp ${outdoorTemp}°F -> OAR setpoint ${oarSetpointValue.toFixed(1)}°F`);
  }

  // STEP 4: Apply priority logic for all controls
  
  // --- Apply temperature setpoint priority ---
  let finalSetpoint;
  let setpointSource;
  
  if (userControlsFromUI.temperatureSetpoint !== undefined) {
    // UI-driven setpoint has highest priority
    finalSetpoint = userControlsFromUI.temperatureSetpoint;
    setpointSource = "UI";
    logLocationEquipment(locationId, equipmentId, "fan-coil", 
      `USING UI SETPOINT: ${finalSetpoint}°F - HIGHEST PRIORITY`);
  } 
  else if (controlsFromDB.temperatureSetpoint !== undefined) {
    // Database-stored setpoint has medium priority
    finalSetpoint = controlsFromDB.temperatureSetpoint;
    setpointSource = "Database";
    logLocationEquipment(locationId, equipmentId, "fan-coil", 
      `Using database setpoint: ${finalSetpoint}°F - MEDIUM PRIORITY`);
  }
  else {
    // OAR-calculated setpoint has lowest priority (fallback)
    finalSetpoint = oarSetpointValue;
    setpointSource = "OAR";
    logLocationEquipment(locationId, equipmentId, "fan-coil", 
      `Using fallback OAR setpoint: ${finalSetpoint.toFixed(1)}°F - LOWEST PRIORITY`);
  }

  // --- Apply unit enable priority ---
  let finalUnitEnable;
  if (userControlsFromUI.unitEnable !== undefined) {
    finalUnitEnable = userControlsFromUI.unitEnable;
    logLocationEquipment(locationId, equipmentId, "fan-coil", 
      `Using UI unit enable: ${finalUnitEnable ? "ON" : "OFF"}`);
  } else {
    finalUnitEnable = controlsFromDB.unitEnable !== undefined ? 
                      controlsFromDB.unitEnable : true;
  }

  // --- Apply fan enable priority ---
  let finalFanEnabled;
  if (userControlsFromUI.fanEnabled !== undefined) {
    finalFanEnabled = userControlsFromUI.fanEnabled;
    logLocationEquipment(locationId, equipmentId, "fan-coil", 
      `Using UI fan enable: ${finalFanEnabled ? "ON" : "OFF"}`);
  } else {
    finalFanEnabled = controlsFromDB.fanEnabled !== undefined ? 
                      controlsFromDB.fanEnabled : true;
  }

  // --- Apply fan speed priority ---
  let finalFanSpeed;
  if (userControlsFromUI.fanSpeed !== undefined) {
    finalFanSpeed = userControlsFromUI.fanSpeed;
    logLocationEquipment(locationId, equipmentId, "fan-coil", 
      `Using UI fan speed: ${finalFanSpeed}`);
  } else {
    finalFanSpeed = controlsFromDB.fanSpeed || "medium";
  }

  // --- Apply fan mode priority ---
  let finalFanMode;
  if (userControlsFromUI.fanMode !== undefined) {
    finalFanMode = userControlsFromUI.fanMode;
    logLocationEquipment(locationId, equipmentId, "fan-coil", 
      `Using UI fan mode: ${finalFanMode}`);
  } else {
    finalFanMode = controlsFromDB.fanMode || "auto";
  }
  
  // --- Apply operation mode priority ---
  let finalOperationMode;
  if (userControlsFromUI.operationMode !== undefined) {
    finalOperationMode = userControlsFromUI.operationMode;
    logLocationEquipment(locationId, equipmentId, "fan-coil", 
      `Using UI operation mode: ${finalOperationMode}`);
  } else {
    finalOperationMode = controlsFromDB.operationMode || "auto";
  }

  // --- Apply valve modes priority ---
  let finalHeatingValveMode = userControlsFromUI.heatingValveMode !== undefined ? 
                             userControlsFromUI.heatingValveMode : (controlsFromDB.heatingValveMode || "auto");
  
  let finalCoolingValveMode = userControlsFromUI.coolingValveMode !== undefined ? 
                             userControlsFromUI.coolingValveMode : (controlsFromDB.coolingValveMode || "auto");

  // --- Apply valve positions priority - ONLY IF in manual mode ---
  let finalHeatingValvePosition;
  let finalCoolingValvePosition;
  
  // For heating valve
  if (finalHeatingValveMode === "manual") {
    // In manual mode, use user-set position
    finalHeatingValvePosition = userControlsFromUI.heatingValvePosition !== undefined ? 
                               userControlsFromUI.heatingValvePosition : 
                               (controlsFromDB.heatingValvePosition || 0);
    
    logLocationEquipment(locationId, equipmentId, "fan-coil", 
      `Heating valve in MANUAL mode: Using fixed position ${finalHeatingValvePosition}%`);
  }
  
  // For cooling valve
  if (finalCoolingValveMode === "manual") {
    // In manual mode, use user-set position
    finalCoolingValvePosition = userControlsFromUI.coolingValvePosition !== undefined ? 
                               userControlsFromUI.coolingValvePosition : 
                               (controlsFromDB.coolingValvePosition || 0);
    
    logLocationEquipment(locationId, equipmentId, "fan-coil", 
      `Cooling valve in MANUAL mode: Using fixed position ${finalCoolingValvePosition}%`);
  }

  // STEP 5: Check for safety conditions (always overrides user settings)

  // FreezeStat: If supply temperature is below 40°F, activate freeze protection
  if (currentTemp <= 40) {
    logLocationEquipment(locationId, equipmentId, "fan-coil", `FREEZESTAT TRIP at ${currentTemp}°F supply`);
    return {
      fanEnabled: false,                // Turn off fan (0)
      outdoorDamperPosition: 0,         // Close damper (0)
      heatingValvePosition: 100,        // Open heating valve fully (0V in real system)
      coolingValvePosition: 0,          // Ensure cooling is off (0V)
      temperatureSetpoint: finalSetpoint, // Keep the high-priority setpoint
      unitEnable: true,                 // Keep unit enabled
      fanSpeed: finalFanSpeed,          // Keep user fan speed setting
      fanMode: finalFanMode,            // Keep user fan mode setting
      heatingValveMode: finalHeatingValveMode, // Keep user valve mode setting
      coolingValveMode: finalCoolingValveMode, // Keep user valve mode setting
      operationMode: finalOperationMode // Keep user operation mode setting
    };
  }

  // Hi-Limit: If supply temperature is above 115°F, activate high limit protection
  if (currentTemp >= 115) {
    logLocationEquipment(locationId, equipmentId, "fan-coil", `HI-LIMIT TRIP at ${currentTemp}°F supply`);
    return {
      fanEnabled: true,                 // Keep fan running
      outdoorDamperPosition: 1,         // Open damper (1)
      heatingValvePosition: 0,          // Close heating valve (10V in real system)
      coolingValvePosition: 0,          // Ensure cooling is off (0V)
      temperatureSetpoint: finalSetpoint, // Keep the high-priority setpoint
      unitEnable: true,                 // Keep unit enabled
      fanSpeed: finalFanSpeed,          // Keep user fan speed setting
      fanMode: finalFanMode,            // Keep user fan mode setting
      heatingValveMode: finalHeatingValveMode, // Keep user valve mode setting
      coolingValveMode: finalCoolingValveMode, // Keep user valve mode setting
      operationMode: finalOperationMode // Keep user operation mode setting
    };
  }

  // STEP 6: Binary damper control for Huntington
  let outdoorDamperPosition = 0;
  
  // Check for user manual setting first
  if (userControlsFromUI.outdoorDamperPosition !== undefined) {
    // User has manually set damper position - respect that
    outdoorDamperPosition = userControlsFromUI.outdoorDamperPosition > 0 ? 1 : 0;
    logLocationEquipment(locationId, equipmentId, "fan-coil",
      `Using user-defined outdoor damper position: ${outdoorDamperPosition}`);
  }
  // Otherwise use automatic binary control based on outdoor temp
  else if (outdoorTemp > 40) {
    outdoorDamperPosition = 1; // Open when above 40°F
    logLocationEquipment(locationId, equipmentId, "fan-coil",
      `Outdoor temp ${outdoorTemp}°F > 40°F, setting damper to OPEN (1)`);
  } else {
    logLocationEquipment(locationId, equipmentId, "fan-coil",
      `Outdoor temp ${outdoorTemp}°F <= 40°F, setting damper to CLOSED (0)`);
  }

  // STEP 7: Define Huntington-specific settings with high-priority user values
  const huntingtonSettings = {
    ...settings,
    // Always use highest-priority setpoint
    temperatureSetpoint: finalSetpoint,
    // Respect user unit enable setting
    unitEnable: finalUnitEnable,
    // Respect user operation mode
    operationMode: finalOperationMode,
    // Respect user fan settings
    fanEnabled: finalFanEnabled,
    fanSpeed: finalFanSpeed,
    fanMode: finalFanMode,
    // Respect user valve mode settings
    heatingValveMode: finalHeatingValveMode,
    coolingValveMode: finalCoolingValveMode,
    // For manual valve mode, use user-set positions
    ...(finalHeatingValveMode === "manual" && { heatingValvePosition: finalHeatingValvePosition }),
    ...(finalCoolingValveMode === "manual" && { coolingValvePosition: finalCoolingValvePosition }),
    // PID settings
    pidControllers: {
      cooling: {
        // Start with base cooling settings if they exist
        ...(settings.pidControllers?.cooling || {}),
        // Override with Huntington-specific values - INCREASED COOLING PID VALUES
        kp: 3.5,        // INCREASED from 1.8 - Higher proportional gain
        ki: 0.2,        // INCREASED from 0.14 - Higher integral gain
        kd: 0.02,       // INCREASED from 0.01 - Higher derivative term
        enabled: true,  // Ensure PID is enabled
        outputMin: 0,   // 0% maps to 0V (valve closed) - UPDATED from 3.5V
        outputMax: 100, // 100% maps to 10V (valve open) - UPDATED from 9V
        reverseActing: false, // Direct acting for cooling
        maxIntegral: 20 // INCREASED from 15 - Larger integral accumulation
      },
      heating: {
        // Start with base heating settings if they exist
        ...(settings.pidControllers?.heating || {}),
        // Override with Huntington-specific values
        kp: 1.7,        // Unchanged from original
        ki: 0.13,       // Unchanged from original
        kd: 0.02,       // Unchanged from original
        enabled: true,  // Ensure PID is enabled
        outputMin: 0,   // 0% maps to 10V (valve closed) - UPDATED from 9V
        outputMax: 100, // 100% maps to 0V (valve open) - UPDATED from 3.5V
        reverseActing: true, // Reverse acting for heating
        maxIntegral: 15 // Unchanged from original
      }
    }
  };

  // STEP 8: Call base implementation with properly prioritized settings
  logLocationEquipment(locationId, equipmentId, "fan-coil",
    `Calling base implementation with ${setpointSource} setpoint: ${finalSetpoint.toFixed(1)}°F, ` +
    `Unit: ${finalUnitEnable ? "ON" : "OFF"}, Fan: ${finalFanEnabled ? "ON" : "OFF"}, ` +
    `Mode: ${finalOperationMode}, ` +
    `Heating Mode: ${finalHeatingValveMode}, Cooling Mode: ${finalCoolingValveMode}`);

  const baseResult = fanCoilControlBase(metrics, huntingtonSettings, currentTemp, pidState);

  // STEP 9: Override the result with manual settings if needed
  const result = {
    ...baseResult,
    // Always respect user settings for these values:
    unitEnable: finalUnitEnable,
    operationMode: finalOperationMode,
    fanEnabled: finalFanEnabled && finalUnitEnable, // Fan can only be on if unit is enabled
    fanSpeed: finalFanSpeed,
    fanMode: finalFanMode,
    heatingValveMode: finalHeatingValveMode,
    coolingValveMode: finalCoolingValveMode,
    // For manual valve modes, override PID-calculated positions with user values
    ...(finalHeatingValveMode === "manual" && { heatingValvePosition: finalHeatingValvePosition }),
    ...(finalCoolingValveMode === "manual" && { coolingValvePosition: finalCoolingValvePosition }),
    // Always override with Huntington binary damper position
    outdoorDamperPosition: outdoorDamperPosition,
    // Always preserve the highest-priority setpoint
    temperatureSetpoint: finalSetpoint
  };

  logLocationEquipment(locationId, equipmentId, "fan-coil",
    `Control result: Unit=${result.unitEnable ? "ON" : "OFF"}, ` +
    `Fan=${result.fanEnabled ? "ON" : "OFF"}, Fan Mode=${result.fanMode}, Fan Speed=${result.fanSpeed}, ` +
    `Mode=${result.operationMode}, ` +
    `Heating=${result.heatingValvePosition}% (${result.heatingValveMode}), ` +
    `Cooling=${result.coolingValvePosition}% (${result.coolingValveMode}), ` +
    `Damper=${result.outdoorDamperPosition}, Setpoint=${result.temperatureSetpoint}°F (${setpointSource})`);

  return result;
}
