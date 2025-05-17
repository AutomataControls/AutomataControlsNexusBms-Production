import { fanCoilControl } from "./fan-coil"
import { boilerControl } from "./boiler"
import { pumpControl } from "./pumps"
import { chillerControl } from "./chiller"
import { airHandlerControl } from "./air-handler"

// Map of equipment types to their control functions
export const equipmentControlFunctions = {
  "fan-coil": fanCoilControl,
  boiler: boilerControl,
  pump: pumpControl,
  cwpump: pumpControl,
  hwpump: pumpControl,
  "air-handler": airHandlerControl,
  chiller: chillerControl,
  // Other types that don't have control functions yet
  // "air-handler": null,
  // "doas": null,
  // "exhaust-fan": null,
  // "actuator": null,
  // "zone": null
}

/**
 * Get the appropriate control function for an equipment type
 * @param equipmentType The type of equipment
 * @returns The control function for the equipment type, or null if not found
 */
export function getControlFunction(equipmentType: string) {
  if (!equipmentType) return null

  // Normalize the equipment type
  const normalizedType = equipmentType.toLowerCase().replace(/[^a-z0-9]/g, "-")

  // Return the control function or null if not found
  return equipmentControlFunctions[normalizedType] || null
}

// Export individual control functions
export { fanCoilControl, boilerControl, pumpControl, chillerControl, airHandlerControl }
