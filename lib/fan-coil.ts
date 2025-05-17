/**
 * Fan Coil Control Logic
 * This function implements control logic for fan coil units with location-based temperature source selection
 */
export function fanCoilControl(metrics, settings, currentTemp, pidState) {
  // If currentTemp is provided (from location-based selection), use it
  // Otherwise fall back to the extensive fallback chain
  if (currentTemp === undefined) {
    // Get current temperatures with proper fallbacks - expanded to include more naming variations
    currentTemp =
      metrics.Supply ||
      metrics.supply ||
      metrics.SupplyTemp ||
      metrics.supplyTemp ||
      metrics.supplyTemperature ||
      metrics.SupplyTemperature ||
      metrics.discharge ||
      metrics.Discharge ||
      metrics.dischargeTemp ||
      metrics.DischargeTemp ||
      metrics.dischargeTemperature ||
      metrics.DischargeTemperature ||
      metrics.SAT ||
      metrics.sat ||
      metrics.SupplyAirTemp ||
      metrics.supplyAirTemp ||
      metrics.roomTemp ||
      metrics.RoomTemp ||
      metrics.roomTemperature ||
      metrics.RoomTemperature ||
      metrics.coveTemp ||
      metrics.chapelTemp ||
      metrics.kitchenTemp ||
      metrics.mailRoomTemp ||
      metrics.spaceTemp ||
      metrics.SpaceTemp ||
      metrics.zoneTemp ||
      metrics.ZoneTemp ||
      metrics.ZoneTemperature ||
      metrics.zone_temperature ||
      metrics.room_temperature ||
      72
  }

  const setpoint = settings.temperatureSetpoint || 72 // Use existing setpoint or default to 72
  const deadband = 1 // Deadband of 1°F for responsive control

  console.log("Current temp:", currentTemp, "Setpoint:", setpoint)

  // Determine if we need heating or cooling based on the temperature difference
  let operationMode = settings.operationMode

  // If in auto mode, determine whether to heat or cool
  if (operationMode === "auto") {
    if (currentTemp < setpoint - deadband) {
      operationMode = "heating"
      console.log("Auto mode selected heating")
    } else if (currentTemp > setpoint + deadband) {
      operationMode = "cooling"
      console.log("Auto mode selected cooling")
    } else {
      console.log("Auto mode - within deadband, maintaining current state")
    }
  }

  console.log("Operating in mode:", operationMode)

  // Get outdoor temperature with fallbacks
  const outdoorTemp =
    metrics.outdoorTemperature ||
    metrics.outdoorTemp ||
    metrics.Outdoor ||
    metrics.outdoor ||
    metrics.OutdoorTemp ||
    metrics.OutdoorAir ||
    metrics.outdoorAir ||
    metrics.outdoorAirTemp ||
    metrics.OutdoorAirTemp ||
    metrics.OutdoorAirTemperature ||
    metrics.outdoorAirTemperature ||
    metrics.outdoor_temperature ||
    metrics.outdoor_temp ||
    metrics.outdoor_air_temp ||
    metrics.outdoor_air_temperature ||
    metrics.OAT ||
    metrics.oat ||
    metrics.OutsideAirTemp ||
    metrics.outsideAirTemp ||
    metrics.OutsideTemp ||
    metrics.outsideTemp ||
    85

  // Set outdoor damper position
  let outdoorDamperPosition = 0

  // Determine outdoor damper position based on temperature
  if (outdoorTemp > 40 && outdoorTemp < 80) {
    outdoorDamperPosition = 100 // 100 open when temp is moderate
  }

  // Get PID settings from the settings object if available, otherwise use defaults
  const pidSettings = {
    cooling: {
      kp: settings.pidControllers?.cooling?.kp ?? 0.3, // Proportional gain
      ki: settings.pidControllers?.cooling?.ki ?? 0.05, // Integral gain - REDUCED from 0.1 to prevent windup
      kd: settings.pidControllers?.cooling?.kd ?? 0.05, // Derivative gain
      outputMin: settings.pidControllers?.cooling?.outputMin ?? 0,
      outputMax: settings.pidControllers?.cooling?.outputMax ?? 100,
      enabled: settings.pidControllers?.cooling?.enabled ?? true,
    },
    heating: {
      kp: settings.pidControllers?.heating?.kp ?? 0.3, // Proportional gain
      ki: settings.pidControllers?.heating?.ki ?? 0.05, // Integral gain - REDUCED from 0.1 to prevent windup
      kd: settings.pidControllers?.heating?.kd ?? 0.05, // Derivative gain
      outputMin: settings.pidControllers?.heating?.outputMin ?? 0,
      outputMax: settings.pidControllers?.heating?.outputMax ?? 100,
      enabled: settings.pidControllers?.heating?.enabled ?? true,
    },
  }

  // Use PID controller for cooling valve
  if (operationMode === "cooling") {
    // Only use PID if enabled
    if (pidSettings.cooling.enabled) {
      const coolingPID = pidControllerImproved({
        input: currentTemp,
        setpoint: setpoint,
        pidParams: pidSettings.cooling,
        dt: 5, // Sample time in seconds
        controllerType: "cooling",
        pidState: pidState,
      })

      return {
        coolingValvePosition: coolingPID.output,
        heatingValvePosition: 0,
        fanEnabled: true,
        fanSpeed: "medium",
        outdoorDamperPosition: outdoorDamperPosition,
        temperatureSetpoint: setpoint,
        unitEnable: true,
      }
    } else {
      // Simple proportional control if PID disabled
      const error = currentTemp - setpoint
      const coolingOutput = Math.max(0, Math.min(100, error * 10))

      return {
        coolingValvePosition: coolingOutput,
        heatingValvePosition: 0,
        fanEnabled: true,
        fanSpeed: "medium",
        outdoorDamperPosition: outdoorDamperPosition,
        temperatureSetpoint: setpoint,
        unitEnable: true,
      }
    }
  } else if (operationMode === "heating") {
    // Use PID for heating if enabled
    if (pidSettings.heating.enabled) {
      const heatingPID = pidControllerImproved({
        input: currentTemp,
        setpoint: setpoint,
        pidParams: pidSettings.heating,
        dt: 5, // Sample time in seconds
        controllerType: "heating",
        pidState: pidState,
      })

      return {
        coolingValvePosition: 0,
        heatingValvePosition: heatingPID.output,
        fanEnabled: true,
        fanSpeed: "medium",
        outdoorDamperPosition: outdoorDamperPosition,
        temperatureSetpoint: setpoint,
        unitEnable: true,
      }
    } else {
      // Simple proportional control if PID disabled
      const error = setpoint - currentTemp
      const heatingOutput = Math.max(0, Math.min(100, error * 10))

      return {
        coolingValvePosition: 0,
        heatingValvePosition: heatingOutput,
        fanEnabled: true,
        fanSpeed: "medium",
        outdoorDamperPosition: outdoorDamperPosition,
        temperatureSetpoint: setpoint,
        unitEnable: true,
      }
    }
  }

  // Default return for within deadband
  return {
    coolingValvePosition: 0,
    heatingValvePosition: 0,
    fanEnabled: true,
    fanSpeed: "low",
    outdoorDamperPosition: outdoorDamperPosition,
    temperatureSetpoint: setpoint,
    unitEnable: true,
  }
}

/**
 * Improved PID Controller with better anti-windup and more explicit parameters
 *
 * @param {Object} options - The PID controller options
 * @param {number} options.input - Current process value (e.g., temperature)
 * @param {number} options.setpoint - Desired setpoint
 * @param {Object} options.pidParams - PID parameters
 * @param {number} options.pidParams.kp - Proportional gain
 * @param {number} options.pidParams.ki - Integral gain
 * @param {number} options.pidParams.kd - Derivative gain
 * @param {number} options.pidParams.outputMin - Minimum output value
 * @param {number} options.pidParams.outputMax - Maximum output value
 * @param {number} options.dt - Time delta in seconds
 * @param {string} options.controllerType - Type of controller (e.g., "heating", "cooling")
 * @param {Object} options.pidState - State object to maintain between calls
 * @returns {Object} - PID output and new state
 */
function pidControllerImproved({ input, setpoint, pidParams, dt, controllerType, pidState }) {
  // Extract PID parameters
  const { kp, ki, kd, outputMin, outputMax } = pidParams

  // Get the current state for this controller
  const controllerKey = String(controllerType)
  const state = pidState?.[controllerKey] || { integral: 0, previousError: 0, lastOutput: 0 }

  // Calculate error - special handling for cooling vs heating
  let error
  if (controllerKey === "cooling") {
    // For cooling, higher temp means positive error (need more cooling)
    error = input - setpoint
  } else {
    // For heating and other controls, lower temp means positive error
    error = setpoint - input
  }

  // Calculate proportional term
  const proportional = kp * error

  // Calculate integral with improved anti-windup
  // Only integrate if we're not saturated or if integration would reduce saturation
  let integral = state.integral

  // Check if output is saturated
  const lastOutputSaturated = state.lastOutput >= outputMax || state.lastOutput <= outputMin

  // Only integrate if not saturated or if integration would reduce saturation
  const wouldReduceSaturation =
    (state.lastOutput >= outputMax && error < 0) || (state.lastOutput <= outputMin && error > 0)

  if (!lastOutputSaturated || wouldReduceSaturation) {
    integral += ki * error * dt
  }

  // Additional anti-windup - limit integral to prevent excessive buildup
  const maxIntegral = (outputMax - outputMin) / (ki || 0.1) // Avoid division by zero
  integral = Math.max(Math.min(integral, maxIntegral), -maxIntegral)

  // Calculate derivative term with filtering to reduce noise sensitivity
  const derivative = (kd * (error - state.previousError)) / dt

  // Calculate output
  let output = proportional + integral + derivative

  // Clamp output
  output = Math.max(outputMin, Math.min(outputMax, output))

  // Log detailed PID information for debugging
  console.log(
    `PID Controller (${controllerKey}): ` +
      `Error=${error.toFixed(2)}, ` +
      `P=${proportional.toFixed(2)}, ` +
      `I=${integral.toFixed(2)}, ` +
      `D=${derivative.toFixed(2)}, ` +
      `Output=${output.toFixed(2)}`,
  )

  // Store updated state for next run
  if (pidState) {
    pidState[controllerKey] = {
      integral,
      previousError: error,
      lastOutput: output,
    }
  }

  // Return the result
  return {
    output,
    newState: {
      integral,
      previousError: error,
      lastOutput: output,
    },
  }
}
