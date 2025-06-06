"use strict";
// @ts-nocheck
// lib/equipment-logic/index.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.steamBundleControl = exports.airHandlerControl = exports.chillerControl = exports.pumpControl = exports.boilerControl = exports.fanCoilControl = exports.equipmentControlFunctions = void 0;
exports.getControlFunction = getControlFunction;
// Force module reload to prevent caching issues
console.log("Equipment Logic Index module loaded at " + new Date().toISOString());
// Import base implementations
const fan_coil_1 = require("./base/fan-coil");
Object.defineProperty(exports, "fanCoilControl", { enumerable: true, get: function () { return fan_coil_1.fanCoilControl; } });
const boiler_1 = require("./base/boiler");
Object.defineProperty(exports, "boilerControl", { enumerable: true, get: function () { return boiler_1.boilerControl; } });
const pumps_1 = require("./base/pumps");
Object.defineProperty(exports, "pumpControl", { enumerable: true, get: function () { return pumps_1.pumpControl; } });
const chiller_1 = require("./base/chiller");
Object.defineProperty(exports, "chillerControl", { enumerable: true, get: function () { return chiller_1.chillerControl; } });
const air_handler_1 = require("./base/air-handler");
Object.defineProperty(exports, "airHandlerControl", { enumerable: true, get: function () { return air_handler_1.airHandlerControl; } });
const steam_bundle_1 = require("./base/steam-bundle");
Object.defineProperty(exports, "steamBundleControl", { enumerable: true, get: function () { return steam_bundle_1.steamBundleControl; } });
// Import location-specific implementations
// Warren (ID: 1)
const fan_coil_2 = require("./locations/warren/fan-coil");
const pumps_2 = require("./locations/warren/pumps");
const air_handler_2 = require("./locations/warren/air-handler");
const steam_bundle_2 = require("./locations/warren/steam-bundle");
// Hopebridge (ID: 5)
const boiler_2 = require("./locations/hopebridge/boiler");
const air_handler_3 = require("./locations/hopebridge/air-handler");
// Huntington (ID: 4)
const fan_coil_3 = require("./locations/huntington/fan-coil");
const boiler_3 = require("./locations/huntington/boiler");
const pumps_3 = require("./locations/huntington/pumps");
const chiller_2 = require("./locations/huntington/chiller");
// Add a translation map from numeric IDs to location names
const locationIdToName = {
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
const locationAliases = {
    "element": "8",
    "elementlabs": "8",
    "fcog": "9",
    "firstchurchofgod": "9"
};
// Map of location-specific implementations for ALL locations except residential
const locationSpecificImplementations = {
    "1": {
        "fan-coil": fan_coil_2.fanCoilControl,
        "pump": pumps_2.pumpControl,
        "cwpump": pumps_2.pumpControl,
        "hwpump": pumps_2.pumpControl,
        "air-handler": air_handler_2.airHandlerControl,
        "steam-bundle": steam_bundle_2.steamBundleControl
    },
    "2": {
        "fan-coil": fan_coil_1.fanCoilControl,
        "boiler": boiler_1.boilerControl,
        "pump": pumps_1.pumpControl,
        "cwpump": pumps_1.pumpControl,
        "hwpump": pumps_1.pumpControl,
        "air-handler": air_handler_1.airHandlerControl,
        "chiller": chiller_1.chillerControl
    },
    "3": {
        "fan-coil": fan_coil_1.fanCoilControl,
        "boiler": boiler_1.boilerControl,
        "pump": pumps_1.pumpControl,
        "cwpump": pumps_1.pumpControl,
        "hwpump": pumps_1.pumpControl,
        "air-handler": air_handler_1.airHandlerControl,
        "chiller": chiller_1.chillerControl
    },
    "4": {
        "fan-coil": fan_coil_3.fanCoilControl,
        "boiler": boiler_3.boilerControl,
        "pump": pumps_3.pumpControl,
        "cwpump": pumps_3.pumpControl,
        "hwpump": pumps_3.pumpControl,
        "chiller": chiller_2.chillerControl
    },
    "5": {
        "boiler": boiler_2.boilerControl,
        "air-handler": air_handler_3.airHandlerControl,
        "fan-coil": fan_coil_1.fanCoilControl,
        "pump": pumps_1.pumpControl,
        "cwpump": pumps_1.pumpControl,
        "hwpump": pumps_1.pumpControl,
        "chiller": chiller_1.chillerControl
    },
    "6": {
        "fan-coil": fan_coil_1.fanCoilControl,
        "boiler": boiler_1.boilerControl,
        "pump": pumps_1.pumpControl,
        "cwpump": pumps_1.pumpControl,
        "hwpump": pumps_1.pumpControl,
        "air-handler": air_handler_1.airHandlerControl,
        "chiller": chiller_1.chillerControl
    },
    "7": {
        "fan-coil": fan_coil_1.fanCoilControl,
        "boiler": boiler_1.boilerControl,
        "pump": pumps_1.pumpControl,
        "cwpump": pumps_1.pumpControl,
        "hwpump": pumps_1.pumpControl,
        "air-handler": air_handler_1.airHandlerControl,
        "chiller": chiller_1.chillerControl
    },
    "8": {
        "fan-coil": fan_coil_1.fanCoilControl,
        "boiler": boiler_1.boilerControl,
        "pump": pumps_1.pumpControl,
        "cwpump": pumps_1.pumpControl,
        "hwpump": pumps_1.pumpControl,
        "air-handler": air_handler_1.airHandlerControl,
        "chiller": chiller_1.chillerControl
    },
    "9": {
        "fan-coil": fan_coil_1.fanCoilControl,
        "boiler": boiler_1.boilerControl,
        "pump": pumps_1.pumpControl,
        "cwpump": pumps_1.pumpControl,
        "hwpump": pumps_1.pumpControl,
        "air-handler": air_handler_1.airHandlerControl,
        "chiller": chiller_1.chillerControl
    },
    "10": {
        "fan-coil": fan_coil_1.fanCoilControl,
        "boiler": boiler_1.boilerControl,
        "pump": pumps_1.pumpControl,
        "cwpump": pumps_1.pumpControl,
        "hwpump": pumps_1.pumpControl,
        "air-handler": air_handler_1.airHandlerControl,
        "chiller": chiller_1.chillerControl
    },
    "11": {
        "fan-coil": fan_coil_1.fanCoilControl,
        "boiler": boiler_1.boilerControl,
        "pump": pumps_1.pumpControl,
        "cwpump": pumps_1.pumpControl,
        "hwpump": pumps_1.pumpControl,
        "air-handler": air_handler_1.airHandlerControl,
        "chiller": chiller_1.chillerControl
    },
    "13": {
        "fan-coil": fan_coil_1.fanCoilControl,
        "boiler": boiler_1.boilerControl,
        "pump": pumps_1.pumpControl,
        "cwpump": pumps_1.pumpControl,
        "hwpump": pumps_1.pumpControl,
        "air-handler": air_handler_1.airHandlerControl,
        "chiller": chiller_1.chillerControl
    }
};
// Map of base equipment control functions (fallback)
const baseEquipmentControlFunctions = {
    "fan-coil": fan_coil_1.fanCoilControl,
    "boiler": boiler_1.boilerControl,
    "pump": pumps_1.pumpControl,
    "cwpump": pumps_1.pumpControl,
    "hwpump": pumps_1.pumpControl,
    "air-handler": air_handler_1.airHandlerControl,
    "chiller": chiller_1.chillerControl,
    "steam-bundle": steam_bundle_1.steamBundleControl
};
/**
 * Resolve location identifier to a numeric location ID
 * @param locationIdentifier The location ID or name
 * @returns The resolved location ID
 */
function resolveLocationId(locationIdentifier) {
    if (!locationIdentifier)
        return undefined;
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
function getControlFunction(equipmentType, locationId, context) {
    if (!equipmentType)
        return null;
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
        if (normalizedType === "fan-coil")
            return fan_coil_2.fanCoilControl;
        if (normalizedType === "pump" || normalizedType === "hwpump" || normalizedType === "cwpump")
            return pumps_2.pumpControl;
        if (normalizedType === "air-handler")
            return air_handler_2.airHandlerControl;
        if (normalizedType === "steam-bundle")
            return steam_bundle_2.steamBundleControl;
    }
    // Hopebridge (ID: 5)
    if (resolvedLocationId === "5") {
        console.log(`DIRECT LOCATION: Using Hopebridge-specific implementation for ${normalizedType}`);
        if (normalizedType === "boiler")
            return boiler_2.boilerControl;
        if (normalizedType === "air-handler")
            return air_handler_3.airHandlerControl;
    }
    // Huntington (ID: 4)
    if (resolvedLocationId === "4") {
        console.log(`DIRECT LOCATION: Using Huntington-specific implementation for ${normalizedType}`);
        if (normalizedType === "fan-coil")
            return fan_coil_3.fanCoilControl;
        if (normalizedType === "boiler")
            return boiler_3.boilerControl;
        if (normalizedType === "pump" || normalizedType === "hwpump" || normalizedType === "cwpump")
            return pumps_3.pumpControl;
        if (normalizedType === "chiller")
            return chiller_2.chillerControl;
    }
    // Try to find location-specific implementation using the structured map
    if (resolvedLocationId && locationSpecificImplementations[resolvedLocationId]) {
        const locationName = locationIdToName[resolvedLocationId] || 'unknown';
        console.log(`Mapped location ID ${resolvedLocationId} to ${locationName}`);
        // Check if we have implementations for this location
        if (locationSpecificImplementations[resolvedLocationId][normalizedType]) {
            console.log(`Using location-specific control for ${normalizedType} at location ${locationName}`);
            return locationSpecificImplementations[resolvedLocationId][normalizedType];
        }
        else {
            console.log(`No specific implementation found for ${normalizedType} at ${locationName} (ID: ${resolvedLocationId})`);
        }
    }
    // Fall back to base implementation
    console.log(`Using base implementation for ${normalizedType}`);
    return baseEquipmentControlFunctions[normalizedType] || null;
}
// Export for backward compatibility
exports.equipmentControlFunctions = baseEquipmentControlFunctions;
