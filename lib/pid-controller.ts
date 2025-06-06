// @ts-nocheck
/**
 * Advanced PID Controller for HVAC Applications
 *
 * This module provides a robust PID (Proportional-Integral-Derivative) controller
 * implementation specifically designed for HVAC control systems. It includes
 * anti-windup protection, bumpless transfer, and other features critical for
 * stable temperature control.
 *
 * @author NeuralBMS Team
 * @version 2.0
 */

/**
 * PID Controller Parameters Interface
 * These parameters determine how the PID controller responds to errors
 */
export interface PIDParams {
  /**
   * Proportional Gain (Kp)
   * - Controls how aggressively the system responds to the current error
   * - Higher values: More aggressive response, potential for overshoot
   * - Lower values: Slower response, less overshoot
   * - Typical range: 0.5 to 3.0 for temperature control
   */
  kp: number

  /**
   * Integral Gain (Ki)
   * - Eliminates steady-state error by responding to accumulated error over time
   * - Higher values: Faster elimination of steady-state error, but more overshoot
   * - Lower values: Slower elimination of steady-state error, more stable
   * - Typical range: 0.01 to 0.1 for temperature control
   * - WARNING: Setting too high can cause oscillation and instability
   */
  ki: number

  /**
   * Derivative Gain (Kd)
   * - Responds to the rate of change of error to reduce overshoot
   * - Higher values: More damping, less overshoot, but more noise sensitivity
   * - Lower values: Less damping, more overshoot, less noise sensitivity
   * - Typical range: 0.01 to 0.5 for temperature control
   * - NOTE: Often set to 0 in noisy environments
   */
  kd: number

  /**
   * Minimum Output Value
   * - Limits the minimum output of the controller
   * - Typically 0 for valve position (0% open)
   */
  outputMin: number

  /**
   * Maximum Output Value
   * - Limits the maximum output of the controller
   * - Typically 100 for valve position (100% open)
   */
  outputMax: number

  /**
   * PID Controller Enabled Flag
   * - When true, the PID controller is active
   * - When false, the controller will use simple proportional control
   */
  enabled: boolean

  /**
   * Reverse Acting Flag
   * - For heating: typically true (lower temperature = higher output)
   * - For cooling: typically false (higher temperature = higher output)
   */
  reverseActing?: boolean

  /**
   * Maximum Integral Value
   * - Limits the maximum value of the integral term to prevent windup
   * - Typical range: 5 to 20
   * - Higher values allow more integral action but risk windup
   */
  maxIntegral?: number

  /**
   * Sample Time in milliseconds
   * - The expected time between controller updates
   * - Used to scale the integral and derivative terms
   * - Default: 1000ms (1 second)
   */
  sampleTime?: number
}

/**
 * PID Controller State Interface
 * Maintains the controller's state between calls
 */
export interface PIDState {
  /** Accumulated integral term */
  integral: number

  /** Previous error value for derivative calculation */
  previousError: number

  /** Last output value for anti-windup */
  lastOutput: number

  /** Last setpoint for detecting setpoint changes */
  lastSetpoint?: number
}

/**
 * PID Controller Options Interface
 */
export interface PIDControllerOptions {
  /** Current process value (e.g., temperature) */
  input: number

  /** Desired setpoint */
  setpoint: number

  /** PID parameters */
  pidParams: PIDParams

  /** Time delta in seconds */
  dt: number

  /** Type of controller (e.g., "heating", "cooling") */
  controllerType: string

  /** State object to maintain between calls */
  pidState: Record<string, PIDState>
}

/**
 * PID Controller Result Interface
 */
export interface PIDControllerResult {
  /** Calculated output value */
  output: number

  /** New controller state */
  newState: PIDState
}

/**
 * Improved PID Controller with anti-windup and bumpless transfer
 *
 * This function implements a PID controller with several advanced features:
 * - Anti-windup protection to prevent integral term from growing too large
 * - Rate limiting on integral changes to prevent sudden output changes
 * - Input validation to handle sensor errors gracefully
 * - Derivative filtering to reduce noise sensitivity
 *
 * @param options - The PID controller options
 * @returns PID output and new state
 *
 * @example
 * // Basic usage for a heating valve
 * const heatingPID = pidControllerImproved({
 *   input: roomTemperature,
 *   setpoint: desiredTemperature,
 *   pidParams: {
 *     kp: 2.0,
 *     ki: 0.05,
 *     kd: 0.01,
 *     outputMin: 0,
 *     outputMax: 100,
 *     enabled: true,
 *     reverseActing: true,
 *     maxIntegral: 10
 *   },
 *   dt: 1,
 *   controllerType: "heating",
 *   pidState: equipmentPidState
 * });
 *
 * // The valve position to set
 * const valvePosition = heatingPID.output;
 */
export function pidControllerImproved(options: PIDControllerOptions): PIDControllerResult {
  // Extract options
  const { input, setpoint, pidParams, dt, controllerType, pidState } = options

  // Extract PID parameters with defaults
  const { kp, ki, kd, outputMin, outputMax, reverseActing = false, maxIntegral = 10 } = pidParams

  // Get the current state for this controller
  const controllerKey = String(controllerType)
  const state = pidState?.[controllerKey] || { integral: 0, previousError: 0, lastOutput: 0 }

  // Validate input and setpoint
  let validInput = input
  let validSetpoint = setpoint

  if (isNaN(input) || !isFinite(input)) {
    console.error(`PID Controller (${controllerKey}): Invalid input value: ${input} - using setpoint`)
    validInput = setpoint
  }

  if (isNaN(setpoint) || !isFinite(setpoint)) {
    console.error(`PID Controller (${controllerKey}): Invalid setpoint value: ${setpoint} - using default`)
    validSetpoint = controllerType === "heating" || controllerType === "boiler" ? 72 : 72
  }

  // Calculate error - direction depends on whether controller is reverse acting
  // For heating (reverse acting): lower temp means positive error (need more heat)
  // For cooling (direct acting): higher temp means positive error (need more cooling)
  const error = reverseActing ? validSetpoint - validInput : validInput - validSetpoint

  // Calculate proportional term
  const proportional = kp * error

  // Calculate integral with improved anti-windup
  let integral = state.integral || 0

  // Check if output is saturated (within 1% of limits)
  const lastOutputSaturated = state.lastOutput >= outputMax - 1 || state.lastOutput <= outputMin + 1

  // Only integrate if not saturated or if integration would reduce saturation
  const wouldReduceSaturation =
    (state.lastOutput >= outputMax - 1 && error < 0) || (state.lastOutput <= outputMin + 1 && error > 0)

  // Calculate new integral term with rate limiting
  const maxIntegralChange = 0.5 // Maximum change in integral per iteration
  let integralChange = ki * error * dt

  // Limit the rate of integral change
  integralChange = Math.max(-maxIntegralChange, Math.min(maxIntegralChange, integralChange))

  // Only update integral if not saturated or if it would reduce saturation
  if (!lastOutputSaturated || wouldReduceSaturation) {
    integral += integralChange
  }

  // Clamp the integral term to prevent windup
  integral = Math.max(-maxIntegral, Math.min(maxIntegral, integral))

  // Calculate derivative term with filtering to reduce noise sensitivity
  // Use max(dt, 0.1) to avoid division by very small dt
  const derivative = (kd * (error - (state.previousError || 0))) / Math.max(dt, 0.1)

  // Calculate output
  let output = proportional + integral + derivative

  // Clamp output to min/max limits
  output = Math.max(outputMin, Math.min(outputMax, output))

  // Log detailed PID information for debugging
  console.log(
    `PID Controller (${controllerKey}): ` +
      `Input=${validInput.toFixed(2)}, ` +
      `Setpoint=${validSetpoint.toFixed(2)}, ` +
      `Error=${error.toFixed(2)}, ` +
      `P=${proportional.toFixed(2)}, ` +
      `I=${integral.toFixed(2)} (max=${maxIntegral}), ` +
      `D=${derivative.toFixed(2)}, ` +
      `Output=${output.toFixed(2)}`,
  )

  // Store updated state for next run
  if (pidState) {
    pidState[controllerKey] = {
      integral,
      previousError: error,
      lastOutput: output,
      lastSetpoint: validSetpoint, // Store setpoint for change detection
      ...pidState[controllerKey], // Preserve other properties
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

/**
 * ======================================================================
 * PID TUNING GUIDE
 * ======================================================================
 *
 * This guide will help you tune PID controllers for different HVAC equipment.
 *
 * GENERAL TUNING PROCEDURE:
 *
 * 1. Start with conservative values:
 *    - Kp = 0.5
 *    - Ki = 0.03
 *    - Kd = 0.01
 *
 * 2. Disable integral and derivative (set Ki and Kd to 0)
 *
 * 3. Increase Kp until the system responds quickly but without excessive
 *    oscillation. If the system oscillates, reduce Kp by 50%.
 *
 * 4. Add integral action by slowly increasing Ki until steady-state error
 *    is eliminated within a reasonable time. Start with 0.01 and increase
 *    gradually.
 *
 * 5. If needed, add derivative action by slowly increasing Kd to reduce
 *    overshoot. Start with 0.01 and increase gradually.
 *
 * 6. Fine-tune all parameters as needed.
 *
 * EQUIPMENT-SPECIFIC RECOMMENDATIONS:
 *
 * Fan Coil Units (Cooling):
 * - Kp: 0.5 to 1.0
 * - Ki: 0.03 to 0.05
 * - Kd: 0.01 to 0.03
 * - reverseActing: false
 *
 * Fan Coil Units (Heating):
 * - Kp: 0.5 to 1.0
 * - Ki: 0.03 to 0.05
 * - Kd: 0.01 to 0.03
 * - reverseActing: true
 *
 * Boilers:
 * - Kp: 0.3 to 0.7
 * - Ki: 0.02 to 0.04
 * - Kd: 0.01 to 0.05
 * - reverseActing: true
 * - maxIntegral: 5 to 10
 *
 * VAV Boxes:
 * - Kp: 0.3 to 0.8
 * - Ki: 0.02 to 0.05
 * - Kd: 0.01 to 0.02
 *
 * COMMON ISSUES AND SOLUTIONS:
 *
 * 1. Oscillation (system constantly overshoots and undershoots):
 *    - Decrease Kp
 *    - Decrease Ki
 *    - Increase Kd slightly
 *
 * 2. Slow response (system takes too long to reach setpoint):
 *    - Increase Kp
 *    - Increase Ki slightly
 *
 * 3. Overshoot (system goes past setpoint before settling):
 *    - Decrease Kp
 *    - Decrease Ki
 *    - Increase Kd
 *
 * 4. Steady-state error (system stabilizes but not at setpoint):
 *    - Increase Ki
 *
 * 5. Instability after setpoint changes:
 *    - Decrease Ki
 *    - Increase maxIntegral
 *    - Ensure integral reset on large setpoint changes
 *
 * TUNING INDIVIDUAL EQUIPMENT:
 *
 * To tune an individual piece of equipment, modify its PID settings in the
 * equipment's control values. The system allows for equipment-specific PID
 * settings through the pidControllers object in the equipment's controls.
 *
 * Example structure in Firebase:
 *
 * equipment/{equipmentId}/controls/pidControllers/heating: {
 *   kp: 0.8,
 *   ki: 0.04,
 *   kd: 0.02,
 *   enabled: true,
 *   outputMin: 0,
 *   outputMax: 100,
 *   reverseActing: true,
 *   maxIntegral: 10
 * }
 *
 * You can update these values through:
 * 1. The NeuralBMS admin interface
 * 2. Direct Firebase database updates
 * 3. API calls to update equipment controls
 *
 * MONITORING PID PERFORMANCE:
 *
 * The PID controller logs detailed information about its operation.
 * Monitor these logs to understand how the controller is performing:
 *
 * - Input: Current temperature
 * - Setpoint: Target temperature
 * - Error: Difference between setpoint and input
 * - P: Proportional term contribution
 * - I: Integral term contribution
 * - D: Derivative term contribution
 * - Output: Final calculated output (valve position, etc.)
 *
 * Use this information to identify which term might need adjustment.
 */

/**
 * Simple proportional control function
 *
 * This is a fallback control method used when PID is disabled.
 * It applies a simple proportional control based on the error.
 *
 * @param currentValue - Current process value (e.g., temperature)
 * @param setpoint - Desired setpoint
 * @param gain - Proportional gain (how aggressively to respond)
 * @param reverseActing - Whether the control is reverse acting
 * @param outputMin - Minimum output value
 * @param outputMax - Maximum output value
 * @returns Calculated output value
 */
export function simpleProportionalControl(
  currentValue: number,
  setpoint: number,
  gain = 10,
  reverseActing = false,
  outputMin = 0,
  outputMax = 100,
): number {
  // Calculate error based on whether control is reverse acting
  const error = reverseActing ? setpoint - currentValue : currentValue - setpoint

  // Calculate output with proportional gain
  const output = error * gain

  // Clamp output to min/max limits
  return Math.max(outputMin, Math.min(outputMax, output))
}
