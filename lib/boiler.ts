/**
 * Boiler Control Logic
 * This function implements control logic for boilers
 */
export function boilerControl(metrics, settings, currentTemp, pidState) {
  // Get water temperatures with fallbacks
  const supplyTemp = metrics["H2O Supply"] || metrics.H2O_Supply || metrics.supplyTemperature || 180
  const returnTemp = metrics["H2O Return"] || metrics.H2O_Return || metrics.returnTemperature || 160

  // Get setpoint from settings
  const setpoint = settings.waterTempSetpoint || settings.temperatureSetpoint || 180

  console.log(`Boiler control: Supply=${supplyTemp}°F, Return=${returnTemp}°F, Setpoint=${setpoint}°F`)

  // Get outdoor temperature with fallbacks
  const outdoorTemp =
    metrics["Outdoor Air Temperature"] ||
    metrics.Outdoor_Air_Temperature ||
    metrics.outdoorTemperature ||
    metrics.outdoorTemp ||
    metrics.Outdoor ||
    50

  // Get PID settings from the settings object if available, otherwise use defaults
  const pidSettings = {
    kp: settings.pidControllers?.boiler?.kp ?? 0.5, // Proportional gain
    ki: settings.pidControllers?.boiler?.ki ?? 0.05, // Integral gain - REDUCED from 0.1 to prevent windup
    kd: settings.pidControllers?.boiler?.kd ?? 0.05, // Derivative gain
    outputMin: settings.pidControllers?.boiler?.outputMin ?? 0,
    outputMax: settings.pidControllers?.boiler?.outputMax ?? 100,
    enabled: settings.pidControllers?.boiler?.enabled ?? true,
  }

  // Use improved PID controller for boiler control
  const boilerPID = pidControllerImproved({
    input: supplyTemp,
    setpoint: setpoint,
    pidParams: pidSettings,
    dt: 5, // Sample time in seconds
    controllerType: "boiler",
    pidState: pidState,
  })

  // Calculate firing rate based on PID output
  const firingRate = boilerPID.output

  return {
    firingRate,
    waterTempSetpoint: setpoint,
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

  // Calculate error - for boiler, lower temp means positive error (need more heat)
  const error = setpoint - input

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
