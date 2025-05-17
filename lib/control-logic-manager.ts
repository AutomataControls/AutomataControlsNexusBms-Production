/**
 * ControlLogicManager
 *
 * This class manages control logic code for equipment, storing and retrieving
 * logic from InfluxDB 3. It provides versioning, validation, and other
 * operations related to control logic.
 */

// Default logic to use when no custom logic is found
const DEFAULT_LOGIC = `// Fan Coil Control Logic
function fanCoilControl(metrics, settings) {
  // Get current temperatures with proper fallbacks - expanded to include more naming variations
  const currentTemp = metrics.Supply || metrics.supply || metrics.SupplyTemp || metrics.supplyTemp || 
    metrics.supplyTemperature || metrics.SupplyTemperature || metrics.discharge || metrics.Discharge || 
    metrics.dischargeTemp || metrics.DischargeTemp || metrics.dischargeTemperature || 
    metrics.DischargeTemperature || metrics.SAT || metrics.sat || metrics.SupplyAirTemp || 
    metrics.supplyAirTemp || metrics.roomTemp || metrics.RoomTemp || metrics.roomTemperature || 
    metrics.RoomTemperature || metrics.coveTemp || metrics.chapelTemp || metrics.kitchenTemp || metrics.mailRoomTemp || 
    metrics.spaceTemp || metrics.SpaceTemp || metrics.zoneTemp || metrics.ZoneTemp || 
    metrics.ZoneTemperature || metrics.zone_temperature || metrics.room_temperature || 72;
  const setpoint = settings.temperatureSetpoint || 72; // Global setpoint for all controllers
  const deadband = 1; // Reduce deadband to 1°F for more responsive control

  console.log("Current temp:", currentTemp, "Setpoint:", setpoint);

  // Determine if we need heating or cooling based on the temperature difference
  let operationMode = settings.operationMode;

  // If in auto mode, determine whether to heat or cool
  if (operationMode === "auto") {
    if (currentTemp < setpoint - deadband) {
      operationMode = "heating";
      console.log("Auto mode selected heating");
    } else if (currentTemp > setpoint + deadband) {
      operationMode = "cooling";
      console.log("Auto mode selected cooling");
    } else {
      console.log("Auto mode - within deadband, maintaining current state");
    }
  }

  console.log("Operating in mode:", operationMode);

  // Access PID controller settings if needed - safely handle undefined values
  const pidSettings = settings.pidControllers || {};

  // Check for outdoor damper control first
  let outdoorDamperPosition;

  // Get outdoor temperature with fallbacks - expanded to include more naming variations
  const outdoorTemp = metrics.outdoorTemperature || metrics.outdoorTemp || metrics.Outdoor || 
    metrics.outdoor || metrics.OutdoorTemp || metrics.OutdoorAir || metrics.outdoorAir || 
    metrics.outdoorAirTemp || metrics.OutdoorAirTemp || metrics.OutdoorAirTemperature || 
    metrics.outdoorAirTemperature || metrics.outdoor_temperature || metrics.outdoor_temp || 
    metrics.outdoor_air_temp || metrics.outdoor_air_temperature || metrics.OAT || 
    metrics.oat || metrics.OutsideAirTemp || metrics.outsideAirTemp || 
    metrics.OutsideTemp || metrics.outsideTemp || 50;

  // Check if PID controller is enabled for outdoor damper
  if (pidSettings.outdoorDamper &&
      typeof pidSettings.outdoorDamper === 'object' &&
      pidSettings.outdoorDamper.enabled === true) {
    // PID controller is enabled for outdoor damper
    console.log("Using PID controller for outdoor damper");
    // PID logic would be handled separately
    const kp = pidSettings.outdoorDamper.kp || 1.0;
    const ki = pidSettings.outdoorDamper.ki || 0.1;
    const kd = pidSettings.outdoorDamper.kd || 0.01;
    const outputMin = pidSettings.outdoorDamper.outputMin || 0;
    const outputMax = pidSettings.outdoorDamper.outputMax || 100;
    const reverseActing = !!pidSettings.outdoorDamper.reverseActing;

    // Example PID calculation for outdoor damper
    const damperSetpoint = 70; // Example setpoint for outdoor air
    const error = damperSetpoint - outdoorTemp;

    const output = pidController(
      outdoorTemp,
      damperSetpoint,
      kp,
      ki,
      kd,
      1.0, // dt (time step)
      outputMin,
      outputMax,
      'outdoorDamper' // Add controller type
    );

    // Apply reverse acting logic if configured
    outdoorDamperPosition = reverseActing ? outputMax - output.output : output.output;
    outdoorDamperPosition = Math.max(0, Math.min(100, outdoorDamperPosition)) / 100; // Ensure it's between 0-1 range
  } else {
    // Binary control based on outdoor temperature
    if (outdoorTemp > 40 && outdoorTemp < 90) {
      console.log("Outdoor temp between 40°F and 90°F, opening outdoor damper");
      outdoorDamperPosition = 1; // Open damper (binary control)
    } else {
      console.log("Outdoor temp outside 40-90°F range, closing outdoor damper");
      outdoorDamperPosition = 0; // Close damper (binary control)
    }
  }

  // Use PID controllers if enabled - with proper null/undefined checks
  if (operationMode === "heating" &&
      pidSettings.heating &&
      typeof pidSettings.heating === 'object' &&
      pidSettings.heating.enabled === true) {

    // Safely extract PID parameters with defaults
    const kp = pidSettings.heating.kp || 1.0;
    const ki = pidSettings.heating.ki || 0.1;
    const kd = pidSettings.heating.kd || 0.01;
    const outputMin = pidSettings.heating.outputMin || 0;
    const outputMax = pidSettings.heating.outputMax || 100;
    const reverseActing = !!pidSettings.heating.reverseActing;

    // Use the global setpoint with heating PID controller
    const error = setpoint - currentTemp;
    console.log("Using heating PID controller with Kp:", kp, "Error:", error);

    // Example PID calculation for heating
    const output = pidController(
      currentTemp,
      setpoint,
      kp,
      ki,
      kd,
      1.0, // dt (time step)
      outputMin,
      outputMax,
      'heating' // Add controller type
    );

    // Apply reverse acting logic if configured
    let finalOutput = output.output;
    if (reverseActing) {
      finalOutput = outputMax - finalOutput;
    }

    return {
      heatingValvePosition: finalOutput,
      coolingValvePosition: 0,
      fanEnabled: true,
      fanSpeed: "medium",
      outdoorDamperPosition: outdoorDamperPosition // Include outdoor damper position
    };
  }

  if (operationMode === "cooling" &&
    pidSettings.cooling &&
    typeof pidSettings.cooling === 'object' &&
    pidSettings.cooling.enabled === true) {

    // Safely extract PID parameters with defaults
    const kp = pidSettings.cooling.kp || 1.0;
    const ki = pidSettings.cooling.ki || 0.1;
    const kd = pidSettings.cooling.kd || 0.01;
    const outputMin = pidSettings.cooling.outputMin || 0;
    const outputMax = pidSettings.cooling.outputMax || 100;
    const reverseActing = !!pidSettings.cooling.reverseActing;

    // For cooling, we need to reverse the error calculation (higher temp = higher error)
    const error = currentTemp - setpoint; // Positive error means we need cooling
    console.log("Using cooling PID controller with Kp:", kp, "Error:", error);

    // Example PID calculation for cooling
    const output = pidController(
      currentTemp,
      setpoint,
      kp,
      ki,
      kd,
      1.0, // dt (time step)
      outputMin,
      outputMax,
      'cooling' // Add controller type
    );

    // Apply reverse acting logic if configured
    let finalOutput = output.output;
    if (reverseActing) {
      finalOutput = outputMax - finalOutput;
    }

    // Ensure cooling valve position is properly set based on temperature difference
    if (currentTemp > setpoint) {
      console.log("Cooling needed: Current temp", currentTemp, "is above setpoint", setpoint);
      console.log("Setting cooling valve position to:", finalOutput);
    } else {
      console.log("No cooling needed: Current temp", currentTemp, "is below setpoint", setpoint);
      // Still use PID output for smoother control
    }

    return {
      coolingValvePosition: finalOutput,
      heatingValvePosition: 100, // Fully closed for reverse acting heating valve
      fanEnabled: true,
      fanSpeed: "medium",
      outdoorDamperPosition: outdoorDamperPosition // Include outdoor damper position
    };
  }

  // Binary control logic when PID is not enabled
  // Simple control logic based on mode
  if (operationMode === "cooling") {
    // Cooling mode logic - binary control
    if (currentTemp > setpoint + deadband) {
      console.log("Cooling: Opening cooling valve");
      return {
        coolingValvePosition: 100, // Fully open cooling valve
        heatingValvePosition: 100, // Fully closed for reverse acting heating valve
        fanEnabled: true,
        fanSpeed: "medium",
        outdoorDamperPosition: outdoorDamperPosition // Include outdoor damper position
      };
    } else if (currentTemp < setpoint - deadband) {
      console.log("Cooling: Closing cooling valve");
      return {
        coolingValvePosition: 0, // Fully closed cooling valve
        heatingValvePosition: 100, // Fully closed for reverse acting heating valve
        fanEnabled: true,
        fanSpeed: "low",
        outdoorDamperPosition: outdoorDamperPosition // Include outdoor damper position
      };
    }
  } else if (operationMode === "heating") {
    // Heating mode logic - binary control
    if (currentTemp < setpoint - deadband) {
      console.log("Heating: Opening heating valve (reverse acting)");
      return {
        heatingValvePosition: 0, // Fully open heating valve (reverse acting)
        coolingValvePosition: 0,
        fanEnabled: true,
        fanSpeed: "medium",
        outdoorDamperPosition: outdoorDamperPosition // Include outdoor damper position
      };
    } else if (currentTemp > setpoint + deadband) {
      console.log("Heating: Closing heating valve (reverse acting)");
      return {
        heatingValvePosition: 100, // Fully closed heating valve (reverse acting)
        coolingValvePosition: 0,
        fanEnabled: true,
        fanSpeed: "low",
        outdoorDamperPosition: outdoorDamperPosition // Include outdoor damper position
      };
    }
  }

  // Default: maintain current state if within deadband
  console.log("Within deadband, maintaining current state");
  return {
    coolingValvePosition: settings.coolingValvePosition || 0,
    heatingValvePosition: settings.heatingValvePosition || 0,
    fanEnabled: settings.fanEnabled !== undefined ? settings.fanEnabled : true,
    fanSpeed: settings.fanSpeed || "low",
    outdoorDamperPosition: outdoorDamperPosition // Include outdoor damper position
  };
}

// Helper Functions
function calculateValvePosition(currentTemp, setpoint, mode) {
  // Add your valve position calculation logic here
  const error = mode === "cooling" ? currentTemp - setpoint : setpoint - currentTemp;
  return Math.max(0, Math.min(100, error * 10));
}

// PID Controller Implementation
function pidController(input, setpoint, kp, ki, kd, dt, outputMin, outputMax, controllerType) {
  // Get the current state for this controller - use the controllerType parameter
  // Make sure controllerType is treated as a string
  const controllerKey = String(controllerType);
  const state = pidState[controllerKey] || { integral: 0, previousError: 0, lastOutput: 0 };

  // Calculate error - special handling for cooling
  let error;
  if (controllerKey === 'cooling') {
    // For cooling, higher temp means positive error (need more cooling)
    error = input - setpoint;
  } else {
    // For heating and other controls, lower temp means positive error
    error = setpoint - input;
  }

  // Calculate integral with anti-windup
  let integral = state.integral + (error * dt);

  // Anti-windup - limit integral to prevent excessive buildup
  const maxIntegral = (outputMax - outputMin) / (ki || 0.1); // Avoid division by zero
  integral = Math.max(Math.min(integral, maxIntegral), -maxIntegral);

  // Calculate derivative
  const derivative = (error - state.previousError) / dt;

  // Calculate output
  let output = kp * error + ki * integral + kd * derivative;

  // Clamp output
  output = Math.max(outputMin, Math.min(outputMax, output));

  console.log(\`PID Controller (\${controllerKey}): Error=\${error.toFixed(2)}, Integral=\${integral.toFixed(2)}, Derivative=\${derivative.toFixed(2)}, Output=\  Integral=\${integral.toFixed(2)}, Derivative=\${derivative.toFixed(2)}, Output=\${output.toFixed(2)}\`);

  // Return the result with updated state values
  return {
    output,
    newState: {
      integral,
      previousError: error,
      lastOutput: output
    }
  };
}

// IMPORTANT: Never directly destructure from a variable named 'pid'
// Always check if objects exist before accessing their properties
`

// Define interfaces for logic data
interface LogicVersion {
  version: string
  timestamp: number
  author: string
  code: string
}

interface LogicData {
  equipmentId: string
  versions: LogicVersion[]
}

export class ControlLogicManager {
  private database: string
  private retryCount = 3
  private retryDelay = 1000

  constructor() {
    // Get InfluxDB 3 configuration from environment variables
    this.database = process.env.INFLUXDB3_DATABASE || "control_logic"

    console.log(`Initializing ControlLogicManager with database: ${this.database}`)
  }

  /**
   * Check if the InfluxDB API is available
   *
   * @returns Promise<boolean> - True if the API is available
   */
  async checkApiAvailability(): Promise<boolean> {
    if (typeof window === "undefined") {
      return false
    }

    try {
      const response = await fetch("/api/influxdb-health", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }).catch(() => null)

      return response?.ok === true
    } catch (error) {
      console.error("Error checking API availability:", error)
      return false
    }
  }

  /**
   * Add a new version of control logic for an equipment
   *
   * @param equipmentId - The ID of the equipment
   * @param version - The version of the logic (e.g., "1.0")
   * @param code - The JavaScript code for the control logic
   * @param author - The author of the logic
   * @returns Promise<boolean> - True if successful
   */
  async addLogic(equipmentId: string, version: string, code: string, author: string): Promise<boolean> {
    try {
      console.log(`Writing control logic point for equipment ${equipmentId}, version ${version}`)

      // Always save to localStorage as a backup/cache
      if (typeof window !== "undefined") {
        try {
          const key = `control_logic_${equipmentId}_${version}`
          localStorage.setItem(
            key,
            JSON.stringify({
              equipmentId,
              version,
              author,
              code,
              timestamp: Date.now(),
            }),
          )

          // Also update the "latest" cache
          localStorage.setItem(
            `control_logic_${equipmentId}_latest`,
            JSON.stringify({
              code,
              timestamp: Date.now(),
            }),
          )

          console.log(`Saved control logic to localStorage for ${equipmentId}`)
        } catch (localStorageError) {
          console.warn("Error saving to localStorage:", localStorageError)
        }
      }

      // If we're not in a browser environment, return success since we can't make API calls
      if (typeof window === "undefined") {
        console.log("Server-side rendering detected, skipping API call")
        return true
      }

      // Check if API is available
      const isApiAvailable = await this.checkApiAvailability()
      if (!isApiAvailable) {
        console.log("API is not available, saving to localStorage only")
        return true
      }

      // Implement retry logic
      let attempt = 0
      let success = false

      while (attempt < this.retryCount && !success) {
        try {
          // Use our proxy API endpoint instead of direct InfluxDB access
          const response = await fetch("/api/influxdb-proxy", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              action: "addLogic",
              equipmentId,
              version,
              code,
              author,
            }),
          })

          // If the response is not OK, log the error and retry
          if (!response || !response.ok) {
            console.error(`API error (${response?.status}): ${response?.statusText}`)
            throw new Error(`API request failed: ${response?.status} ${response?.statusText}`)
          }

          const result = await response.json()
          console.log(`Control logic added for equipment ${equipmentId}, version ${version}`)
          success = result.success
          break
        } catch (apiError) {
          attempt++
          console.error(`Error calling API (attempt ${attempt}/${this.retryCount}):`, apiError)

          if (attempt < this.retryCount) {
            // Wait before retrying
            await new Promise((resolve) => setTimeout(resolve, this.retryDelay))
            // Increase delay for next retry (exponential backoff)
            this.retryDelay *= 2
          }
        }
      }

      // If all retries failed but we saved to localStorage, consider it a partial success
      if (!success && typeof window !== "undefined") {
        console.log("API calls failed, but saved to localStorage")
        return true
      }

      return success
    } catch (error) {
      console.error("Error adding control logic:", error)
      return false
    }
  }

  /**
   * Get the latest version of control logic for an equipment
   *
   * @param equipmentId - The ID of the equipment
   * @returns Promise<any> - The logic data or null if not found
   */
  async getLatestLogic(equipmentId: string): Promise<any> {
    try {
      console.log(`Fetching latest control logic for equipment ${equipmentId}`)

      // Check if we're in a browser environment and have localStorage available
      const hasLocalStorage = typeof window !== "undefined" && window.localStorage

      // Try to get from localStorage first as a quick cache
      if (hasLocalStorage) {
        try {
          const cachedLogic = localStorage.getItem(`control_logic_${equipmentId}_latest`)
          if (cachedLogic) {
            const parsedCache = JSON.parse(cachedLogic)
            // Only use cache if it's less than 5 minutes old
            if (parsedCache && parsedCache.timestamp && Date.now() - parsedCache.timestamp < 5 * 60 * 1000) {
              console.log(`Using cached control logic for ${equipmentId}`)
              return {
                code: [{ as_py: () => parsedCache.code }],
                fromCache: true,
              }
            }
          }
        } catch (cacheError) {
          console.warn("Error reading from localStorage cache:", cacheError)
        }
      }

      // If we're not in a browser environment, return default logic
      if (typeof window === "undefined") {
        console.log("Server-side rendering detected, using default logic")
        return {
          code: [{ as_py: () => DEFAULT_LOGIC }],
          isDefault: true,
        }
      }

      // Check if API is available
      const isApiAvailable = await this.checkApiAvailability()
      if (!isApiAvailable) {
        console.log("API is not available, using fallback logic")
        return this.getFallbackLogic(equipmentId)
      }

      // Implement retry logic
      let attempt = 0
      let success = false
      let result = null

      while (attempt < this.retryCount && !success) {
        try {
          // Use our proxy API endpoint instead of direct InfluxDB access
          const response = await fetch("/api/influxdb-proxy", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              action: "getLatestLogic",
              equipmentId,
            }),
          })

          // If the response is not OK, log the error and retry
          if (!response.ok) {
            console.error(`API error (${response.status}): ${response.statusText}`)
            throw new Error(`API request failed: ${response.status} ${response.statusText}`)
          }

          // Parse the response
          result = await response.json()
          success = true
          break
        } catch (apiError) {
          attempt++
          console.error(`Error calling API (attempt ${attempt}/${this.retryCount}):`, apiError)

          if (attempt < this.retryCount) {
            // Wait before retrying
            await new Promise((resolve) => setTimeout(resolve, this.retryDelay))
            // Increase delay for next retry (exponential backoff)
            this.retryDelay *= 2
          }
        }
      }

      // If all retries failed, use fallback logic
      if (!success) {
        console.log("All API calls failed, using fallback logic")
        return this.getFallbackLogic(equipmentId)
      }

      if (result.success && result.data) {
        console.log(`Found control logic for equipment ${equipmentId}`)

        // Extract the code from the result
        const code = result.data.code || DEFAULT_LOGIC

        // Cache the result in localStorage if available
        if (hasLocalStorage) {
          try {
            localStorage.setItem(
              `control_logic_${equipmentId}_latest`,
              JSON.stringify({
                code,
                timestamp: Date.now(),
              }),
            )
          } catch (cacheError) {
            console.warn("Error saving to localStorage cache:", cacheError)
          }
        }

        return {
          code: [{ as_py: () => code }],
        }
      } else {
        console.log(`No control logic found for equipment ${equipmentId}, using default`)
        return this.getFallbackLogic(equipmentId)
      }
    } catch (error) {
      console.error("Error getting latest control logic:", error)
      return {
        code: [{ as_py: () => DEFAULT_LOGIC }],
      }
    }
  }

  /**
   * Get fallback logic from localStorage or return default
   *
   * @param equipmentId - The ID of the equipment
   * @returns The logic data with default code
   */
  private getFallbackLogic(equipmentId: string): any {
    // Try to get from localStorage as fallback
    if (typeof window !== "undefined") {
      try {
        // Look for any version of this equipment's logic in localStorage
        const keys = Object.keys(localStorage).filter((k) => k.startsWith(`control_logic_${equipmentId}_`))
        if (keys.length > 0) {
          // Sort by timestamp to get the latest
          keys.sort((a, b) => {
            const dataA = JSON.parse(localStorage.getItem(a) || "{}")
            const dataB = JSON.parse(localStorage.getItem(b) || "{}")
            return (dataB.timestamp || 0) - (dataA.timestamp || 0)
          })

          const latestData = JSON.parse(localStorage.getItem(keys[0]) || "{}")
          if (latestData.code) {
            console.log(`Retrieved control logic from localStorage for ${equipmentId}`)
            return {
              code: [{ as_py: () => latestData.code }],
              fromLocalStorage: true,
            }
          }
        }
      } catch (localStorageError) {
        console.error("Error reading from localStorage:", localStorageError)
      }
    }

    // Return default logic if nothing else works
    return {
      code: [{ as_py: () => DEFAULT_LOGIC }],
      isDefault: true,
    }
  }

  /**
   * Get a specific version of control logic for an equipment
   *
   * @param equipmentId - The ID of the equipment
   * @param version - The version to retrieve
   * @returns Promise<any> - The logic data or null if not found
   */
  async getLogicVersion(equipmentId: string, version: string): Promise<any> {
    try {
      // If we're not in a browser environment, return null
      if (typeof window === "undefined") {
        console.log("Server-side rendering detected, skipping API call")
        return null
      }

      // Check if API is available
      const isApiAvailable = await this.checkApiAvailability()
      if (!isApiAvailable) {
        console.log("API is not available, returning null")
        return null
      }

      // Implement retry logic
      let attempt = 0
      let success = false
      let result = null

      while (attempt < this.retryCount && !success) {
        try {
          // Use our proxy API endpoint instead of direct InfluxDB access
          const response = await fetch("/api/influxdb-proxy", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              action: "getLogicVersion",
              equipmentId,
              version,
            }),
          })

          // If the response is not OK, log the error and retry
          if (!response.ok) {
            console.error(`API error (${response.status}): ${response.statusText}`)
            throw new Error(`API request failed: ${response.status} ${response.statusText}`)
          }

          // Parse the response
          result = await response.json()
          success = true
          break
        } catch (apiError) {
          attempt++
          console.error(`Error calling API (attempt ${attempt}/${this.retryCount}):`, apiError)

          if (attempt < this.retryCount) {
            // Wait before retrying
            await new Promise((resolve) => setTimeout(resolve, this.retryDelay))
            // Increase delay for next retry (exponential backoff)
            this.retryDelay *= 2
          }
        }
      }

      // If all retries failed, return null
      if (!success) {
        console.log("All API calls failed, returning null")
        return null
      }

      if (result.success && result.data) {
        return result.data
      } else {
        console.log(`No control logic found for equipment ${equipmentId} version ${version}`)
        return null
      }
    } catch (error) {
      console.error("Error getting control logic version:", error)
      return null
    }
  }

  /**
   * Get all versions of control logic for an equipment
   *
   * @param equipmentId - The ID of the equipment
   * @returns Promise<any[]> - Array of logic versions or empty array if none found
   */
  async getAllLogicVersions(equipmentId: string): Promise<any[]> {
    try {
      // If we're not in a browser environment, return empty array
      if (typeof window === "undefined") {
        console.log("Server-side rendering detected, skipping API call")
        return []
      }

      // Check if API is available
      const isApiAvailable = await this.checkApiAvailability()
      if (!isApiAvailable) {
        console.log("API is not available, returning empty array")
        return []
      }

      // Implement retry logic
      let attempt = 0
      let success = false
      let result = null

      while (attempt < this.retryCount && !success) {
        try {
          // Use our proxy API endpoint instead of direct InfluxDB access
          const response = await fetch("/api/influxdb-proxy", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              action: "getAllLogicVersions",
              equipmentId,
            }),
          })

          // If the response is not OK, log the error and retry
          if (!response.ok) {
            console.error(`API error (${response.status}): ${response.statusText}`)
            throw new Error(`API request failed: ${response.status} ${response.statusText}`)
          }

          // Parse the response
          result = await response.json()
          success = true
          break
        } catch (apiError) {
          attempt++
          console.error(`Error calling API (attempt ${attempt}/${this.retryCount}):`, apiError)

          if (attempt < this.retryCount) {
            // Wait before retrying
            await new Promise((resolve) => setTimeout(resolve, this.retryDelay))
            // Increase delay for next retry (exponential backoff)
            this.retryDelay *= 2
          }
        }
      }

      // If all retries failed, return empty array
      if (!success) {
        console.log("All API calls failed, returning empty array")
        return []
      }

      if (result.success && result.data && result.data.length > 0) {
        return result.data
      } else {
        console.log(`No control logic versions found for equipment ${equipmentId}`)
        return []
      }
    } catch (error) {
      console.error("Error getting all control logic versions:", error)
      return []
    }
  }

  /**
   * Validate control logic code
   *
   * @param code - The JavaScript code to validate
   * @returns object - Validation result with isValid and error properties
   */
  validateLogic(code: string): { isValid: boolean; error?: string } {
    try {
      // Basic validation - try to parse the code
      new Function("metrics", "settings", "pidState", code)
      return { isValid: true }
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : "Unknown error validating logic",
      }
    }
  }

  /**
   * Get the default logic
   *
   * @returns string - The default control logic code
   */
  getDefaultLogic(): string {
    return DEFAULT_LOGIC
  }
}
