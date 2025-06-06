// @ts-nocheck
/**
 * Air Handler Control Logic
 * This function implements control logic for air handling units with temperature control, damper control, and economizer logic
 */
import { pidControllerImproved } from "@/lib/pid-controller"

export function airHandlerControl(metrics, settings, currentTemp, pidState) {
  // If currentTemp is provided (from location-based selection), use it
  // Otherwise fall back to extensive fallback chain
  if (currentTemp === undefined) {
    // First check for supply temperature
    if (metrics.Supply !== undefined) {
      currentTemp = metrics.Supply
      console.log(`Using Supply temperature: ${currentTemp}°F from metrics.Supply`)
    }
    // Then check for measurement which contains the temperature in the database view
    else if (metrics.measurement !== undefined) {
      currentTemp = metrics.measurement
      console.log(`Using measurement temperature: ${currentTemp}°F from metrics.measurement`)
    }
    // Then try all other possible field names
    else {
      currentTemp =
        metrics.supplyTemperature ||
        metrics.SupplyTemp ||
        metrics.supplyTemp ||
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
        metrics.DischargeAir ||
        metrics.dischargeAir ||
        55

      // Log which temperature field was actually used
      const usedField = Object.keys(metrics).find(
        (key) =>
          metrics[key] === currentTemp &&
          key !== "outdoorTemperature" &&
          key !== "outdoorTemp" &&
          key !== "OutdoorTemp" &&
          key !== "OAT",
      )

      console.log(`Temperature source field: ${usedField || "default value"}, Value: ${currentTemp}°F`)
    }
  }

  // Log equipment ID and system for debugging
  console.log(`Air Handler Control for Equipment ID: ${settings.equipmentId}, System: ${metrics.system || "unknown"}`)
  console.log(
    `Current temperature: ${currentTemp}°F, Supply: ${metrics.Supply || "N/A"}°F, Measurement: ${metrics.measurement || "N/A"}°F`,
  )

  // Validate temperature values
  if (isNaN(currentTemp) || !isFinite(currentTemp)) {
    console.error(`Invalid current temperature: ${currentTemp} - using default of 55°F`)
    currentTemp = 55
  }

  // Get and validate supply air temperature setpoint
  let supplySetpoint = settings.supplyAirTempSetpoint || 55 // Use existing setpoint or default to 55°F
  if (isNaN(supplySetpoint) || !isFinite(supplySetpoint)) {
    console.error(`Invalid supply air temperature setpoint: ${supplySetpoint} - using default of 55°F`)
    supplySetpoint = 55
  }

  // Get room temperature setpoint (used for mode selection in auto mode)
  let roomSetpoint = settings.temperatureSetpoint || 72 // Use existing setpoint or default to 72°F
  if (isNaN(roomSetpoint) || !isFinite(roomSetpoint)) {
    console.error(`Invalid room temperature setpoint: ${roomSetpoint} - using default of 72°F`)
    roomSetpoint = 72
  }

  // Check for unreasonable setpoint values
  if (supplySetpoint < 45 || supplySetpoint > 80) {
    console.warn(`Supply temperature setpoint outside normal range: ${supplySetpoint}°F - clamping to reasonable range`)
    supplySetpoint = Math.max(45, Math.min(80, supplySetpoint))
  }

  const deadband = 1 // Deadband of 1°F for responsive control

  // Log current temperature and setpoint
  console.log("Current supply temp:", currentTemp, "Supply setpoint:", supplySetpoint)

  // Get outdoor temperature with fallbacks
  const outdoorTemp =
    metrics.Outdoor_Air || // From the database view
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

  // Get zone/room temperature with fallbacks
  const roomTemp =
    metrics.roomTemperature ||
    metrics.roomTemp ||
    metrics.RoomTemp ||
    metrics.RoomTemperature ||
    metrics.Zone ||
    metrics.zone ||
    metrics.ZoneTemp ||
    metrics.zoneTemp ||
    metrics.ZoneTemperature ||
    metrics.zoneTemperature ||
    metrics.space ||
    metrics.spaceTemp ||
    metrics.SpaceTemp ||
    metrics.spaceTemperature ||
    metrics.SpaceTemperature ||
    72 // Default to 72°F if not found

  // High and Low Limit Protection
  const HIGH_LIMIT = 120 // High limit protection temperature
  const LOW_LIMIT = 45 // Low limit protection temperature

  // Safety checks
  if (currentTemp > HIGH_LIMIT) {
    console.log("HIGH LIMIT PROTECTION ACTIVATED")
    // Emergency shutdown
    return {
      heatingValvePosition: 0,
      coolingValvePosition: 100,
      fanEnabled: true,
      fanSpeed: "high",
      outdoorDamperPosition: 100, // Full outdoor air to cool the system
      unitEnable: true, // Keep the unit running to cool down
    }
  }

  if (currentTemp < LOW_LIMIT) {
    console.log("LOW LIMIT PROTECTION ACTIVATED")
    // Emergency heating
    return {
      heatingValvePosition: 100,
      coolingValvePosition: 0,
      fanEnabled: true,
      fanSpeed: "medium",
      outdoorDamperPosition: 0, // Close outdoor air damper
      unitEnable: true, // Keep the unit running to warm up
    }
  }

  // Determine operation mode
  let operationMode = settings.operationMode

  // FIXED: Check for controlSource setting and use appropriate logic for auto mode
  if (operationMode === "auto") {
    // Check if we should use supply or room temperature for control
    const controlSource = settings.controlSource || "space";
    
    if (controlSource === "supply") {
      // SUPPLY TEMPERATURE CONTROL
      if (currentTemp < supplySetpoint - deadband) {
        operationMode = "heating"
        console.log(`Auto mode selected heating based on supply temperature: ${currentTemp}°F < ${supplySetpoint - deadband}°F`)
      } else if (currentTemp > supplySetpoint + deadband) {
        operationMode = "cooling"
        console.log(`Auto mode selected cooling based on supply temperature: ${currentTemp}°F > ${supplySetpoint + deadband}°F`)
      } else {
        // If supply temperature is within deadband, maintain current state
        console.log(`Auto mode - supply temperature within deadband (${supplySetpoint - deadband}°F to ${supplySetpoint + deadband}°F), maintaining current state`)
      }
    } else {
      // ROOM TEMPERATURE CONTROL (original logic)
      if (roomTemp < roomSetpoint - deadband) {
        operationMode = "heating"
        console.log(`Auto mode selected heating based on room temperature: ${roomTemp}°F < ${roomSetpoint - deadband}°F`)
      } else if (roomTemp > roomSetpoint + deadband) {
        operationMode = "cooling"
        console.log(`Auto mode selected cooling based on room temperature: ${roomTemp}°F > ${roomSetpoint + deadband}°F`)
      } else {
        // If room temperature is within deadband, maintain current state
        console.log(`Auto mode - room temperature within deadband (${roomSetpoint - deadband}°F to ${roomSetpoint + deadband}°F), maintaining current state`)
      }
    }
  }

  console.log("Operating in mode:", operationMode)

  // Get unit operating settings
  const unitEnable = settings.unitEnable !== undefined ? settings.unitEnable : true
  const fanEnabled = settings.fanEnabled !== undefined ? settings.fanEnabled : true
  const fanSpeed = settings.fanSpeed || "medium"
  const economizerEnabled = settings.economizerEnable || false

  // Get PID settings from the settings object if available, otherwise use defaults
  const pidSettings = {
    cooling: {
      kp: settings.pidControllers?.cooling?.kp ?? 1.0, // Proportional gain
      ki: settings.pidControllers?.cooling?.ki ?? 0.1, // Integral gain
      kd: settings.pidControllers?.cooling?.kd ?? 0.01, // Derivative gain
      outputMin: settings.pidControllers?.cooling?.outputMin ?? 0,
      outputMax: settings.pidControllers?.cooling?.outputMax ?? 100,
      enabled: settings.pidControllers?.cooling?.enabled ?? true,
      reverseActing: settings.pidControllers?.cooling?.reverseActing ?? false, // Direct acting for cooling
      maxIntegral: settings.pidControllers?.cooling?.maxIntegral ?? 10, // Maximum integral value
    },
    heating: {
      kp: settings.pidControllers?.heating?.kp ?? 1.0, // Proportional gain
      ki: settings.pidControllers?.heating?.ki ?? 0.1, // Integral gain
      kd: settings.pidControllers?.heating?.kd ?? 0.01, // Derivative gain
      outputMin: settings.pidControllers?.heating?.outputMin ?? 0,
      outputMax: settings.pidControllers?.heating?.outputMax ?? 100,
      enabled: settings.pidControllers?.heating?.enabled ?? true,
      reverseActing: settings.pidControllers?.heating?.reverseActing ?? true, // Reverse acting for heating
      maxIntegral: settings.pidControllers?.heating?.maxIntegral ?? 10, // Maximum integral value
    },
    outdoorDamper: {
      kp: settings.pidControllers?.outdoorDamper?.kp ?? 1.0, // Proportional gain
      ki: settings.pidControllers?.outdoorDamper?.ki ?? 0.1, // Integral gain
      kd: settings.pidControllers?.outdoorDamper?.kd ?? 0.01, // Derivative gain
      outputMin: settings.pidControllers?.outdoorDamper?.outputMin ?? 0,
      outputMax: settings.pidControllers?.outdoorDamper?.outputMax ?? 100,
      enabled: settings.pidControllers?.outdoorDamper?.enabled ?? false,
      reverseActing: settings.pidControllers?.outdoorDamper?.reverseActing ?? false,
      maxIntegral: settings.pidControllers?.outdoorDamper?.maxIntegral ?? 10,
    },
  }

  // Check for setpoint changes that would require resetting the integral term
  const controllerKey = operationMode === "cooling" ? "cooling" : "heating"
  const previousSetpoint = pidState?.[controllerKey]?.lastSetpoint
  const setpointChanged = previousSetpoint !== undefined && Math.abs(supplySetpoint - previousSetpoint) > 0.5

  if (setpointChanged) {
    console.log(`Setpoint changed from ${previousSetpoint}°F to ${supplySetpoint}°F - resetting integral term`)
    if (pidState?.[controllerKey]) {
      pidState[controllerKey].integral = 0
    }
  }

  // Default values
  let heatingValvePosition = 0
  let coolingValvePosition = 0
  let outdoorDamperPosition = 20 // Minimum outdoor air by default

  // Economizer logic (if enabled)
  if (economizerEnabled) {
    if (outdoorTemp < roomTemp - 5) {
      // Outdoor air is at least 5°F cooler than indoor, use economizer
      console.log("Economizer enabled and beneficial")
      outdoorDamperPosition = 100 // Fully open outdoor air damper
    } else {
      // Economizer enabled but not beneficial
      console.log("Economizer enabled but not beneficial")
      outdoorDamperPosition = 20 // Minimum outdoor air
    }
  } else {
    // If economizer is disabled, use outdoor air reset if available
    if (settings.outdoorAirReset?.enabled) {
      const oar = settings.outdoorAirReset
      console.log("Outdoor Air Reset enabled:", oar)

      // Outdoor Air Reset logic
      if (outdoorTemp <= oar.outdoorTempLow) {
        // Below low temperature limit - use high setpoint
        supplySetpoint = oar.setpointLow
        console.log("OAR: Outdoor temp below low limit, using setpoint:", supplySetpoint)
      } else if (outdoorTemp >= oar.outdoorTempHigh) {
        // Above high temperature limit - use low setpoint
        supplySetpoint = oar.setpointHigh
        console.log("OAR: Outdoor temp above high limit, using setpoint:", supplySetpoint)
      } else {
        // Linear interpolation between limits
        const ratio =
          (outdoorTemp - oar.outdoorTempLow) / (oar.outdoorTempHigh - oar.outdoorTempLow)
        supplySetpoint = oar.setpointLow - ratio * (oar.setpointLow - oar.setpointHigh)
        console.log(`OAR: Interpolated setpoint: ${supplySetpoint.toFixed(1)}°F (ratio: ${ratio.toFixed(2)})`)
      }
    }
  }

  // Get damper mode and position
  const outdoorDamperMode = settings.outdoorDamperMode || 'auto'
  if (outdoorDamperMode === 'manual') {
    outdoorDamperPosition = settings.outdoorDamperPosition || 20
    console.log(`Outdoor damper in manual mode, position set to: ${outdoorDamperPosition}%`)
  }

  // Calculate control outputs based on mode and temperature
  if (operationMode === "cooling") {
    // Cooling mode - manage cooling valve
    if (pidSettings.cooling.enabled) {
      // Use PID for cooling
      const coolingPID = pidControllerImproved({
        input: currentTemp,
        setpoint: supplySetpoint,
        pidParams: pidSettings.cooling,
        dt: 1,
        controllerType: "cooling",
        pidState: pidState,
      })

      // FIXED: Added optional chaining and fallbacks to avoid "cannot read property of undefined" errors
      console.log(
        `PID Controller (cooling): Input=${currentTemp.toFixed(2)}, Setpoint=${supplySetpoint.toFixed(2)}, Error=${(
          currentTemp - supplySetpoint
        ).toFixed(2)}, P=${coolingPID.p?.toFixed(2) || "N/A"}, I=${coolingPID.i?.toFixed(2) || "N/A"} (max=${
          pidSettings.cooling.maxIntegral
        }), D=${coolingPID.d?.toFixed(2) || "N/A"}, Output=${coolingPID.output?.toFixed(2) || coolingPID.output || "N/A"}`
      )

      coolingValvePosition = coolingPID.output
      heatingValvePosition = 0 // Ensure heating valve is closed

      // Log the relationship for clarity
      const tempDiff = currentTemp - supplySetpoint
      console.log(
        `Cooling: Temp diff (current - setpoint) = ${tempDiff.toFixed(2)}°F, Valve position = ${coolingValvePosition?.toFixed(2) || coolingValvePosition || "N/A"}%`
      )

      if (tempDiff > 0) {
        console.log(
          `Supply temp too warm (${currentTemp}°F > ${supplySetpoint}°F): Opening cooling valve to ${coolingValvePosition?.toFixed(2) || coolingValvePosition || "N/A"}%`
        )
      } else if (tempDiff < 0) {
        console.log(
          `Supply temp too cool (${currentTemp}°F < ${supplySetpoint}°F): Closing cooling valve to ${coolingValvePosition?.toFixed(2) || coolingValvePosition || "N/A"}%`
        )
      }

      // Store the current setpoint for change detection
      if (pidState?.cooling) {
        pidState.cooling.lastSetpoint = supplySetpoint
      }
    } else {
      // Simple proportional control if PID disabled
      const error = currentTemp - supplySetpoint
      coolingValvePosition = Math.max(0, Math.min(100, error * 10)) // 10% per degree of error
      heatingValvePosition = 0 // Ensure heating valve is closed

      console.log(
        `Simple cooling control: Temp diff = ${error.toFixed(2)}°F, Valve position = ${coolingValvePosition.toFixed(2)}%`
      )
    }
  } else if (operationMode === "heating") {
    // Heating mode - manage heating valve
    if (pidSettings.heating.enabled) {
      // Use PID for heating
      const heatingPID = pidControllerImproved({
        input: currentTemp,
        setpoint: supplySetpoint,
        pidParams: pidSettings.heating,
        dt: 1,
        controllerType: "heating",
        pidState: pidState,
      })

      // FIXED: Added optional chaining and fallbacks to avoid "cannot read property of undefined" errors
      console.log(
        `PID Controller (heating): Input=${currentTemp.toFixed(2)}, Setpoint=${supplySetpoint.toFixed(2)}, Error=${(
          supplySetpoint - currentTemp
        ).toFixed(2)}, P=${heatingPID.p?.toFixed(2) || "N/A"}, I=${heatingPID.i?.toFixed(2) || "N/A"} (max=${
          pidSettings.heating.maxIntegral
        }), D=${heatingPID.d?.toFixed(2) || "N/A"}, Output=${heatingPID.output?.toFixed(2) || heatingPID.output || "N/A"}`
      )

      heatingValvePosition = heatingPID.output
      coolingValvePosition = 0 // Ensure cooling valve is closed

      // Log the relationship for clarity
      const tempDiff = supplySetpoint - currentTemp
      console.log(
        `Heating: Temp diff (setpoint - current) = ${tempDiff.toFixed(2)}°F, Valve position = ${heatingValvePosition?.toFixed(2) || heatingValvePosition || "N/A"}%`
      )

      if (tempDiff > 0) {
        console.log(
          `Supply temp too cool (${currentTemp}°F < ${supplySetpoint}°F): Opening heating valve to ${heatingValvePosition?.toFixed(2) || heatingValvePosition || "N/A"}%`
        )
      } else if (tempDiff < 0) {
        console.log(
          `Supply temp too warm (${currentTemp}°F > ${supplySetpoint}°F): Closing heating valve to ${heatingValvePosition?.toFixed(2) || heatingValvePosition || "N/A"}%`
        )
      }

      // Store the current setpoint for change detection
      if (pidState?.heating) {
        pidState.heating.lastSetpoint = supplySetpoint
      }
    } else {
      // Simple proportional control if PID disabled
      const error = supplySetpoint - currentTemp
      heatingValvePosition = Math.max(0, Math.min(100, error * 10)) // 10% per degree of error
      coolingValvePosition = 0 // Ensure cooling valve is closed

      console.log(
        `Simple heating control: Temp diff = ${error.toFixed(2)}°F, Valve position = ${heatingValvePosition.toFixed(2)}%`
      )
    }
  } else {
    // Off mode or within deadband
    heatingValvePosition = 0
    coolingValvePosition = 0
    console.log("System in off mode or within deadband, both valves closed")
  }

  // Return the calculated control values
  return {
    heatingValvePosition,
    coolingValvePosition,
    fanEnabled,
    fanSpeed,
    outdoorDamperPosition,
    supplyAirTempSetpoint: supplySetpoint,
    temperatureSetpoint: roomSetpoint,
    unitEnable,
    operationMode
  }
}
