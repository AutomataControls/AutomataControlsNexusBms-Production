// @ts-nocheck
// lib/equipment-logic/index.ts

// Force module reload to prevent caching issues
console.log("Equipment Logic Index module loaded at " + new Date().toISOString());

// Import base implementations
import { fanCoilControl as fanCoilControlBase } from "./base/fan-coil";
import { boilerControl as boilerControlBase } from "./base/boiler";
import { pumpControl as pumpControlBase } from "./base/pumps";
import { chillerControl as chillerControlBase } from "./base/chiller";
import { airHandlerControl as airHandlerControlBase } from "./base/air-handler";
import { steamBundleControl as steamBundleControlBase } from "./base/steam-bundle";

// Import location-specific implementations
// Warren (ID: 1)
import { fanCoilControl as fanCoilControlWarren } from "./locations/warren/fan-coil";
import { pumpControl as pumpControlWarren } from "./locations/warren/pumps";
import { airHandlerControl as airHandlerControlWarren } from "./locations/warren/air-handler";
import { steamBundleControl as steamBundleControlWarren } from "./locations/warren/steam-bundle";

// Hopebridge (ID: 5)
import { boilerControl as boilerControlHopebridge } from "./locations/hopebridge/boiler";
import { airHandlerControl as airHandlerControlHopebridge } from "./locations/hopebridge/air-handler";

// Huntington (ID: 4)
import { fanCoilControl as fanCoilControlHuntington } from "./locations/huntington/fan-coil";
import { boilerControl as boilerControlHuntington } from "./locations/huntington/boiler";
import { pumpControl as pumpControlHuntington } from "./locations/huntington/pumps";
import { chillerControl as chillerControlHuntington } from "./locations/huntington/chiller";

// Add a translation map from numeric IDs to location names
const locationIdToName: Record<string, string> = {
  "1": "warren",
  "2": "stjude",
  "3": "byrna",
  "4": "huntington",
  "5": "hopebridge",
  "6": "akron",
  "7": "taylor",
  "8": "elementlabs",
  "9": "firstchurchofgod",
  "10": "nerealty",
  "11": "stjohn",
  "12": "residential",
  "13": "upland"
};

// Alternative location names mapping for more flexible matching
const locationAliases: Record<string, string> = {
  "element": "8",
  "elementlabs": "8",
  "fcog": "9",
  "firstchurchofgod": "9"
};

// Map of location-specific implementations for ALL locations except residential
const locationSpecificImplementations: Record<string, Record<string, any>> = {
  "1": { // Warren
    "fan-coil": fanCoilControlWarren,
    "pump": pumpControlWarren,
    "cwpump": pumpControlWarren,
    "hwpump": pumpControlWarren,
    "air-handler": airHandlerControlWarren,
    "steam-bundle": steamBundleControlWarren
  },
  "2": { // St. Jude - Using base implementations until specific ones are imported
    "fan-coil": fanCoilControlBase,
    "boiler": boilerControlBase,
    "pump": pumpControlBase,
    "cwpump": pumpControlBase,
    "hwpump": pumpControlBase,
    "air-handler": airHandlerControlBase,
    "chiller": chillerControlBase
  },
  "3": { // Byrna - Using base implementations until specific ones are imported
    "fan-coil": fanCoilControlBase,
    "boiler": boilerControlBase,
    "pump": pumpControlBase,
    "cwpump": pumpControlBase,
    "hwpump": pumpControlBase,
    "air-handler": airHandlerControlBase,
    "chiller": chillerControlBase
  },
  "4": { // Huntington
    "fan-coil": fanCoilControlHuntington,
    "boiler": boilerControlHuntington,
    "pump": pumpControlHuntington,
    "cwpump": pumpControlHuntington,
    "hwpump": pumpControlHuntington,
    "chiller": chillerControlHuntington
  },
  "5": { // Hopebridge
    "boiler": boilerControlHopebridge,
    "air-handler": airHandlerControlHopebridge,
    "fan-coil": fanCoilControlBase,
    "pump": pumpControlBase,
    "cwpump": pumpControlBase,
    "hwpump": pumpControlBase,
    "chiller": chillerControlBase
  },
  "6": { // Akron - Using base implementations until specific ones are imported
    "fan-coil": fanCoilControlBase,
    "boiler": boilerControlBase,
    "pump": pumpControlBase,
    "cwpump": pumpControlBase,
    "hwpump": pumpControlBase,
    "air-handler": airHandlerControlBase,
    "chiller": chillerControlBase
  },
  "7": { // Taylor - Using base implementations until specific ones are imported
    "fan-coil": fanCoilControlBase,
    "boiler": boilerControlBase,
    "pump": pumpControlBase,
    "cwpump": pumpControlBase,
    "hwpump": pumpControlBase,
    "air-handler": airHandlerControlBase,
    "chiller": chillerControlBase
  },
  "8": { // Element Labs - Using base implementations until specific ones are imported
    "fan-coil": fanCoilControlBase,
    "boiler": boilerControlBase,
    "pump": pumpControlBase,
    "cwpump": pumpControlBase,
    "hwpump": pumpControlBase,
    "air-handler": airHandlerControlBase,
    "chiller": chillerControlBase
  },
  "9": { // First Church of God - Using base implementations until specific ones are imported
    "fan-coil": fanCoilControlBase,
    "boiler": boilerControlBase,
    "pump": pumpControlBase,
    "cwpump": pumpControlBase,
    "hwpump": pumpControlBase,
    "air-handler": airHandlerControlBase,
    "chiller": chillerControlBase
  },
  "10": { // NE Realty - Using base implementations until specific ones are imported
    "fan-coil": fanCoilControlBase,
    "boiler": boilerControlBase,
    "pump": pumpControlBase,
    "cwpump": pumpControlBase,
    "hwpump": pumpControlBase,
    "air-handler": airHandlerControlBase,
    "chiller": chillerControlBase
  },
  "11": { // St. John - Using base implementations until specific ones are imported
    "fan-coil": fanCoilControlBase,
    "boiler": boilerControlBase,
    "pump": pumpControlBase,
    "cwpump": pumpControlBase,
    "hwpump": pumpControlBase,
    "air-handler": airHandlerControlBase,
    "chiller": chillerControlBase
  },
  "13": { // Upland - Using base implementations until specific ones are imported
    "fan-coil": fanCoilControlBase,
    "boiler": boilerControlBase,
    "pump": pumpControlBase,
    "cwpump": pumpControlBase,
    "hwpump": pumpControlBase,
    "air-handler": airHandlerControlBase,
    "chiller": chillerControlBase
  }
};

// Map of base equipment control functions (fallback)
const baseEquipmentControlFunctions: Record<string, any> = {
  "fan-coil": fanCoilControlBase,
  "boiler": boilerControlBase,
  "pump": pumpControlBase,
  "cwpump": pumpControlBase,
  "hwpump": pumpControlBase,
  "air-handler": airHandlerControlBase,
  "chiller": chillerControlBase,
  "steam-bundle": steamBundleControlBase
};

/**
 * Resolve location identifier to a numeric location ID
 * @param locationIdentifier The location ID or name
 * @returns The resolved location ID
 */
function resolveLocationId(locationIdentifier?: string): string | undefined {
  if (!locationIdentifier) return undefined;

  console.log(`Resolving location identifier: ${locationIdentifier}`);

  // If it's already a numeric ID in our map, return it
  if (locationIdToName[locationIdentifier]) {
    console.log(`Found direct match in locationIdToName: ${locationIdentifier}`);
    return locationIdentifier;
  }

  // Check for a name match (case-insensitive)
  const normalizedInput = locationIdentifier.toLowerCase().trim();

  // Check aliases map first
  if (locationAliases[normalizedInput]) {
    console.log(`Found match in location aliases: ${normalizedInput} -> ${locationAliases[normalizedInput]}`);
    return locationAliases[normalizedInput];
  }

  // Search through locationIdToName for a match
  for (const [id, name] of Object.entries(locationIdToName)) {
    if (name.toLowerCase() === normalizedInput) {
      console.log(`Found match by name: ${normalizedInput} -> ${id}`);
      return id;
    }
  }

  // No match found
  console.log(`Warning: Unable to resolve location identifier: ${locationIdentifier}`);
  return locationIdentifier; // Return the original input as fallback
}

/**
 * Get the appropriate control function for an equipment type and location
 * @param equipmentType The type of equipment
 * @param locationId The location ID or name
 * @param context Optional context with additional information
 * @returns The control function for the equipment type and location
 */
export function getControlFunction(equipmentType: string, locationId?: string, context?: any) {
  if (!equipmentType) return null;

  // CRITICAL DEBUGGING - Log the exact parameters received
  console.log(`getControlFunction CALLED with equipmentType=${equipmentType}, locationId=${locationId}, hasContext=${!!context}`);
  
  // Normalize the equipment type
  const normalizedType = equipmentType.toLowerCase().replace(/[^a-z0-9]/g, "-");
  
  // DIRECTLY use the passed locationId as the primary source of truth
  let resolvedLocationId = locationId;
  
  // Only if locationId is explicitly undefined or null, try to find it in context
  if (resolvedLocationId === undefined || resolvedLocationId === null) {
    if (context?.settings?.locationId) {
      resolvedLocationId = context.settings.locationId;
      console.log(`Using location ID ${resolvedLocationId} from context settings`);
    }
  }
  
  // Final resolution step using our existing resolver
  resolvedLocationId = resolveLocationId(resolvedLocationId);

  // Log what we received and resolved
  console.log(`Looking for control function for ${normalizedType} at location ${locationId || 'unknown'} (resolved to ${resolvedLocationId || 'unknown'})`);

  // Special case for Residential (ID: 12) - always use base implementation
  if (resolvedLocationId === "12") {
    console.log(`Using base implementation for ${normalizedType} at Residential location as requested`);
    return baseEquipmentControlFunctions[normalizedType] || null;
  }

  // DIRECT LOCATION-SPECIFIC CONTROL FUNCTION LOOKUP
  // This ensures we get the right implementation even if the standard lookup mechanism fails
  
  // Warren (ID: 1)
  if (resolvedLocationId === "1") {
    console.log(`DIRECT LOCATION: Using Warren-specific implementation for ${normalizedType}`);
    if (normalizedType === "fan-coil") return fanCoilControlWarren;
    if (normalizedType === "pump" || normalizedType === "hwpump" || normalizedType === "cwpump") return pumpControlWarren;
    if (normalizedType === "air-handler") return airHandlerControlWarren;
    if (normalizedType === "steam-bundle") return steamBundleControlWarren;
  }
  
  // Hopebridge (ID: 5)
  if (resolvedLocationId === "5") {
    console.log(`DIRECT LOCATION: Using Hopebridge-specific implementation for ${normalizedType}`);
    if (normalizedType === "boiler") return boilerControlHopebridge;
    if (normalizedType === "air-handler") return airHandlerControlHopebridge;
  }
  
  // Huntington (ID: 4)
  if (resolvedLocationId === "4") {
    console.log(`DIRECT LOCATION: Using Huntington-specific implementation for ${normalizedType}`);
    if (normalizedType === "fan-coil") return fanCoilControlHuntington;
    if (normalizedType === "boiler") return boilerControlHuntington;
    if (normalizedType === "pump" || normalizedType === "hwpump" || normalizedType === "cwpump") return pumpControlHuntington;
    if (normalizedType === "chiller") return chillerControlHuntington;
  }

  // Try to find location-specific implementation using the structured map
  if (resolvedLocationId && locationSpecificImplementations[resolvedLocationId]) {
    const locationName = locationIdToName[resolvedLocationId] || 'unknown';
    console.log(`Mapped location ID ${resolvedLocationId} to ${locationName}`);

    // Check if we have implementations for this location
    if (locationSpecificImplementations[resolvedLocationId][normalizedType]) {
      console.log(`Using location-specific control for ${normalizedType} at location ${locationName}`);
      return locationSpecificImplementations[resolvedLocationId][normalizedType];
    } else {
      console.log(`No specific implementation found for ${normalizedType} at ${locationName} (ID: ${resolvedLocationId})`);
    }
  }

  // Fall back to base implementation
  console.log(`Using base implementation for ${normalizedType}`);
  return baseEquipmentControlFunctions[normalizedType] || null;
}

// Export for backward compatibility
export const equipmentControlFunctions = baseEquipmentControlFunctions;

// Export individual control functions
export {
  fanCoilControlBase as fanCoilControl,
  boilerControlBase as boilerControl,
  pumpControlBase as pumpControl,
  chillerControlBase as chillerControl,
  airHandlerControlBase as airHandlerControl,
  steamBundleControlBase as steamBundleControl
};
