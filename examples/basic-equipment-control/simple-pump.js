"use strict";

/**
 * Simple Pump Control Logic
 * Demonstrates basic enable/disable control with speed modulation
 * 4-Parameter Interface: ✓
 */

function simplePumpControl(metricsInput, settingsInput, currentTempArgument, stateStorageInput) {
  console.log('[Simple Pump] Starting control logic');
  
  // STEP 1: Input validation
  if (!metricsInput || !settingsInput) {
    console.warn('[Simple Pump] Missing required inputs');
    return { 
      pumpEnable: false,
      error: 'Missing inputs' 
    };
  }

  // STEP 2: Extract metrics
  const systemPressure = parseFloat(metricsInput.SystemPressure || 
                                   metricsInput.Pressure || 15);
  
  const flowRate = parseFloat(metricsInput.FlowRate || 
                             metricsInput.Flow || 0);
  
  const pumpAmps = parseFloat(metricsInput.PumpAmps || 
                             metricsInput.Amps || 0);

  // STEP 3: Get control settings
  const enablePump = settingsInput.pumpEnable !== false; // Default enabled
  const targetPressure = parseFloat(settingsInput.targetPressure || 20);
  const minSpeed = parseFloat(settingsInput.minSpeed || 30);
  const maxSpeed = parseFloat(settingsInput.maxSpeed || 100);

  console.log(`[Simple Pump] Pressure=${systemPressure} PSI, Target=${targetPressure} PSI, Flow=${flowRate} GPM`);

  // STEP 4: Safety checks
  if (pumpAmps > 10) { // Overload protection
    console.warn('[Simple Pump] HIGH AMPERAGE - Overload protection');
    return {
      pumpEnable: false,
      pumpSpeed: 0,
      overloadProtection: true,
      protectionReason: 'High amperage detected',
      currentAmps: pumpAmps
    };
  }

  // STEP 5: Speed control based on pressure
  let pumpSpeed = minSpeed;
  if (enablePump) {
    const pressureError = targetPressure - systemPressure;
    
    if (pressureError > 2) {
      // Need more pressure - increase speed
      pumpSpeed = Math.min(maxSpeed, minSpeed + (pressureError * 5));
    } else if (pressureError < -2) {
      // Too much pressure - decrease speed
      pumpSpeed = Math.max(minSpeed, maxSpeed + (pressureError * 5));
    } else {
      // Maintain current speed (within deadband)
      pumpSpeed = Math.max(minSpeed, Math.min(maxSpeed, 
        stateStorageInput.lastPumpSpeed || minSpeed));
    }
  }

  // Store speed for next cycle
  if (!stateStorageInput) stateStorageInput = {};
  stateStorageInput.lastPumpSpeed = pumpSpeed;

  // STEP 6: Return control commands
  return {
    pumpEnable: enablePump,
    pumpSpeed: Math.round(pumpSpeed),
    systemPressure: systemPressure,
    targetPressure: targetPressure,
    flowRate: flowRate,
    currentAmps: pumpAmps,
    controlMode: enablePump ? 'automatic' : 'disabled'
  };
}

// Export patterns for compatibility
module.exports = { simplePumpControl };
module.exports.default = simplePumpControl;
module.exports.processEquipment = simplePumpControl;
