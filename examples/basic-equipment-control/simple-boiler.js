"use strict";

/**
 * Simple Boiler Control Logic
 * Demonstrates basic temperature control with safety features
 * 4-Parameter Interface: ✓
 */

function simpleBoilerControl(metricsInput, settingsInput, currentTempArgument, stateStorageInput) {
  console.log('[Simple Boiler] Starting control logic');
  
  // STEP 1: Input validation
  if (!metricsInput || !settingsInput) {
    console.warn('[Simple Boiler] Missing required inputs');
    return { 
      unitEnable: false,
      error: 'Missing inputs' 
    };
  }

  // STEP 2: Extract metrics with fallbacks
  const supplyTemp = parseFloat(metricsInput.H20Supply || 
                               metricsInput.SupplyTemp || 
                               metricsInput.WaterTemp || 0);
  
  const outdoorTemp = parseFloat(currentTempArgument || 
                                metricsInput.Outdoor_Air || 
                                metricsInput.OutdoorTemp || 50);

  // STEP 3: Get setpoint (UI override or default)
  const targetTemp = parseFloat(settingsInput.temperatureSetpoint || 
                               settingsInput.waterTemperatureSetpoint || 140);

  console.log(`[Simple Boiler] Temps: Supply=${supplyTemp}°F, Target=${targetTemp}°F, Outdoor=${outdoorTemp}°F`);

  // STEP 4: Safety checks
  if (supplyTemp > 180) {
    console.warn('[Simple Boiler] HIGH TEMPERATURE - Safety shutdown');
    return {
      unitEnable: false,
      firing: false,
      safetyShutoff: true,
      safetyReason: 'High supply temperature',
      supplyTemp: supplyTemp
    };
  }

  // STEP 5: Control logic
  const tempError = targetTemp - supplyTemp;
  const shouldFire = tempError > 3.0; // 3°F deadband
  const shouldEnable = outdoorTemp < 65; // Seasonal enable

  // STEP 6: Return control commands
  return {
    unitEnable: shouldEnable,
    firing: shouldFire && shouldEnable,
    waterTempSetpoint: targetTemp,
    temperatureSetpoint: targetTemp,
    supplyTemp: supplyTemp,
    outdoorTemp: outdoorTemp,
    tempError: tempError,
    controlMode: shouldFire ? 'heating' : 'satisfied'
  };
}

// Export patterns for compatibility
module.exports = { simpleBoilerControl };
module.exports.default = simpleBoilerControl;
module.exports.processEquipment = simpleBoilerControl;
