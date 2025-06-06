// @ts-nocheck
/**
 * Boiler Control Logic with Firestore Equipment Groups Integration
 * This function implements on/off control for boilers with proper metrics handling
 * and supports lead/lag configurations for multi-boiler systems
 * 
 * UPDATED: Now respects location-specific control decisions (e.g., Huntington OAR + Lead-Lag)
 */

// Import Firebase Admin if not already imported at the module level
let admin;
try {
  admin = require('firebase-admin');
} catch (error) {
  console.log('Firebase admin not available in this context');
}

// Cache for Firestore equipment group information
const groupCache = new Map();

export function boilerControl(metrics: any, settings: any, currentTemp: number, stateStorage: any) {
  // Extract equipment ID and location ID
  const equipmentId = settings.equipmentId || "unknown";
  const locationId = settings.locationId || "unknown";

  console.log(`Boiler control for ${equipmentId}: Starting control logic`);

  // CRITICAL FIX: Check if location-specific control logic has already made decisions
  // If location-specific logic (like Huntington) has run, respect those decisions
  const locationSpecificResult = checkForLocationSpecificResults(settings, stateStorage);
  
  if (locationSpecificResult.hasLocationLogic) {
    console.log(`Location-specific control detected for ${equipmentId} - using location decisions`);
    console.log(`Location setpoint: ${locationSpecificResult.temperatureSetpoint}°F, enabled: ${locationSpecificResult.boilerEnabled}`);
    
    // Return the location-specific decisions instead of overriding them
    return {
      firing: locationSpecificResult.boilerEnabled ? 1 : 0,
      waterTempSetpoint: locationSpecificResult.temperatureSetpoint,
      unitEnable: Boolean(locationSpecificResult.boilerEnabled),
      stateStorage,
      isLead: locationSpecificResult.isLead || 0,
      boilerRuntime: stateStorage.boilerRuntime || 0,
      boilerType: locationSpecificResult.boilerType || "comfort",
      groupId: locationSpecificResult.groupId || null,
      // Pass through location-specific values
      oarSetpoint: locationSpecificResult.oarSetpoint,
      outdoorTemp: locationSpecificResult.outdoorTemp,
      leadLagReason: locationSpecificResult.leadLagReason
    };
  }

  // Log all available metrics to help diagnose temperature issues
  console.log(
    `Available metrics for boiler ${equipmentId}:`,
    Object.keys(metrics)
      .filter((key) => key.includes("H2O") || key.includes("Supply") || key.includes("Return") || key.includes("Temp"))
      .reduce((obj, key) => {
        obj[key] = metrics[key];
        return obj;
      }, {}),
  );

  // IMPORTANT: Use the exact field names from the InfluxDB "Locations" bucket
  // The metrics are named "H2OSupply" and "H2OReturn" (without spaces)
  const supplyTemp =
    parseTemperature(metrics.H20Supply) || // Primary field name from InfluxDB - EXACT MATCH (note: H20 not H2O)
    parseTemperature(metrics.H2OSupply) || // Alternative spelling
    parseTemperature(metrics["H2O Supply"]) || // Alternative with space
    parseTemperature(metrics.H2O_Supply) || // Alternative with underscore
    parseTemperature(currentTemp) || // Use the passed-in currentTemp as a fallback
    parseTemperature(metrics.Supply) ||
    parseTemperature(metrics.supplyTemperature) ||
    parseTemperature(metrics.SupplyTemperature) ||
    140; // Last resort fallback - CHANGED FROM 180 TO 140

  const returnTemp =
    parseTemperature(metrics.H20Return) || // Primary field name from InfluxDB - EXACT MATCH (note: H20 not H2O)
    parseTemperature(metrics.H2OReturn) || // Alternative spelling
    parseTemperature(metrics["H2O Return"]) || // Alternative with space
    parseTemperature(metrics.H2O_Return) || // Alternative with underscore
    parseTemperature(metrics.Return) ||
    parseTemperature(metrics.returnTemperature) ||
    parseTemperature(metrics.ReturnTemperature) ||
    160;

  // Check if we're getting the right temperature values
  if (!metrics.H20Supply && !metrics.H2OSupply && !metrics["H2O Supply"] && !metrics.H2O_Supply) {
    console.log(
      "WARNING: Could not find H20Supply or H2OSupply field in metrics. Available fields:",
      Object.keys(metrics),
    );
  }

  // Get outdoor temperature with fallbacks - CHANGED PRIMARY SOURCE TO outdoorTemp
  const outdoorTemp =
    parseTemperature(metrics.outdoorTemp) || // Primary field name from InfluxDB - EXACT MATCH
    parseTemperature(metrics.OutdoorTemp) || // Pascal case alternative
    parseTemperature(metrics.OutdoorAirTemp) || // Previous primary field
    parseTemperature(metrics["Outdoor Air Temperature"]) ||
    parseTemperature(metrics.Outdoor_Air_Temperature) ||
    parseTemperature(metrics.outdoorTemperature) ||
    parseTemperature(metrics.OutdoorTemperature) ||
    parseTemperature(metrics.Outdoor) ||
    parseTemperature(metrics.outdoor) ||
    parseTemperature(metrics.OAT) ||
    parseTemperature(metrics.oat) ||
    50;

  // Log the temperatures we found with more detail
  console.log(
    `Boiler temperatures - Supply: ${supplyTemp}°F (from ${
      metrics.H20Supply
        ? "H20Supply"
        : metrics.H2OSupply
          ? "H2OSupply"
          : metrics["H2O Supply"]
            ? "H2O Supply"
            : metrics.H2O_Supply
              ? "H2O_Supply"
              : "fallback"
    }), Return: ${returnTemp}°F, Outdoor: ${outdoorTemp}°F (from ${
      metrics.outdoorTemp
        ? "outdoorTemp"
        : metrics.OutdoorTemp
          ? "OutdoorTemp"
          : metrics.OutdoorAirTemp
            ? "OutdoorAirTemp"
            : metrics["Outdoor Air Temperature"]
              ? "Outdoor Air Temperature"
              : "fallback"
    })`,
  );

  // Determine boiler type based on equipment ID or name
  const boilerName = settings.name || equipmentId;
  const isDomestic =
    boilerName.toLowerCase().includes("domestic") ||
    equipmentId.toLowerCase().includes("domestic") ||
    equipmentId.toLowerCase().includes("dhw");

  const boilerType = isDomestic ? "domestic" : "comfort";
  console.log(`Boiler type: ${boilerType}`);

  // Initialize runtime tracking
  if (!stateStorage.boilerRuntime) {
    stateStorage.boilerRuntime = 0;
  }

  // Update runtime if boiler is currently running
  if (settings.unitEnable) {
    // Assume this function runs every minute, add runtime in hours
    stateStorage.boilerRuntime += 1 / 60;
  }

  // ---- SETPOINT DETERMINATION BASED ON BOILER TYPE ----
  let setpoint = 0;

  if (boilerType === "domestic") {
    // Domestic Hot Water boilers maintain a constant setpoint year-round
    // They operate to maintain a specific temperature for domestic hot water usage
    setpoint = settings.temperatureSetpoint || settings.waterTempSetpoint || 135;
    console.log(`Domestic hot water boiler - using fixed setpoint: ${setpoint}°F`);
  } else {
    // Comfort boilers (for building heating) use outdoor reset curve
    // Start with base setpoint from settings
    setpoint = settings.temperatureSetpoint || settings.waterTempSetpoint || 155;
    console.log(`Initial comfort boiler setpoint from settings: ${setpoint}°F`);

    // Apply outdoor air reset if enabled (default to enabled for comfort boilers)
    if (settings.outdoorAirReset?.enabled !== false) {
      // Get outdoor reset parameters with fallbacks
      const minOutdoorTemp = settings.outdoorAirReset?.minTemp || 30;
      const maxOutdoorTemp = settings.outdoorAirReset?.maxTemp || 75;

      // CORRECTED: Fixed the min/max supply temp values (keeping original property names)
      const minSupplyTemp = settings.outdoorAirReset?.minSetpoint || 80;  // Lower temp at higher outdoor temp
      const maxSupplyTemp = settings.outdoorAirReset?.maxSetpoint || 155; // Higher temp at lower outdoor temp

      console.log(
        `Outdoor air reset parameters: Min Outdoor: ${minOutdoorTemp}°F, Max Outdoor: ${maxOutdoorTemp}°F, Min Supply: ${minSupplyTemp}°F, Max Supply: ${maxSupplyTemp}°F`,
      );

      // Calculate setpoint based on outdoor temperature
      if (outdoorTemp >= maxOutdoorTemp) {
        setpoint = minSupplyTemp;
        console.log(`Outdoor temp ${outdoorTemp}°F >= ${maxOutdoorTemp}°F, using min setpoint: ${minSupplyTemp}°F`);
      } else if (outdoorTemp <= minOutdoorTemp) {
        setpoint = maxSupplyTemp;
        console.log(`Outdoor temp ${outdoorTemp}°F <= ${minOutdoorTemp}°F, using max setpoint: ${maxSupplyTemp}°F`);
      } else {
        // Linear interpolation
        const ratio = (maxOutdoorTemp - outdoorTemp) / (maxOutdoorTemp - minOutdoorTemp);
        setpoint = minSupplyTemp + ratio * (maxSupplyTemp - minSupplyTemp);
        console.log(
          `Outdoor temp ${outdoorTemp}°F, interpolated setpoint: ${setpoint.toFixed(1)}°F (ratio: ${ratio.toFixed(2)})`,
        );
      }
      console.log(`Outdoor air reset applied - New setpoint: ${setpoint.toFixed(1)}°F`);
    }
  }

  // ---- LEAD/LAG CONFIGURATION WITH EQUIPMENT GROUPS ----
  // First, try to use cached group info or from metrics/settings
  let isLeadBoiler = false;
  let leadBoilerFailed = false;
  let useLeadLag = true;
  let autoFailover = true;
  let changeoverIntervalDays = 7;
  let groupId = null;
  let firestoreGroupFound = false;

  // NEW: Check if we have group info in metrics directly - FAST PATH
  if (metrics.isLeadBoiler !== undefined) {
    isLeadBoiler = metrics.isLeadBoiler === true || metrics.isLeadBoiler === 1 || metrics.isLeadBoiler === "true";
    groupId = metrics.boilerGroupId || metrics.groupId || null;
    firestoreGroupFound = groupId !== null;
  }
  // NEW: Check settings next if not in metrics
  else if (settings.isLeadBoiler !== undefined) {
    isLeadBoiler = settings.isLeadBoiler === true || settings.isLeadBoiler === 1 || settings.isLeadBoiler === "true";
    groupId = settings.boilerGroupId || settings.groupId || settings.systemGroupId || null;
    firestoreGroupFound = groupId !== null;
  }
  // NEW: Check cached info
  else if (groupCache.has(equipmentId)) {
    const cachedInfo = groupCache.get(equipmentId);
    isLeadBoiler = cachedInfo.isLeadBoiler;
    groupId = cachedInfo.groupId;
    useLeadLag = cachedInfo.useLeadLag;
    autoFailover = cachedInfo.autoFailover;
    changeoverIntervalDays = cachedInfo.changeoverIntervalDays;
    firestoreGroupFound = true;

    console.log(`Using cached group info for ${equipmentId}: Lead=${isLeadBoiler}, Group=${groupId}`);
  }
  // NEW: Try to check cached info for the boiler group if known
  else if (settings.boilerGroupId || settings.groupId || settings.systemGroupId) {
    groupId = settings.boilerGroupId || settings.groupId || settings.systemGroupId;

    if (groupCache.has(`group_${groupId}`)) {
      const cachedGroup = groupCache.get(`group_${groupId}`);
      isLeadBoiler = cachedGroup.leadEquipmentId === equipmentId;
      useLeadLag = cachedGroup.useLeadLag;
      autoFailover = cachedGroup.autoFailover;
      changeoverIntervalDays = cachedGroup.changeoverIntervalDays;
      firestoreGroupFound = true;

      console.log(`Using cached group info for group ${groupId}: Lead=${cachedGroup.leadEquipmentId}`);
    }
  }

  // Try to access Firestore equipment groups - but don't await, just log the attempt
  // IMPORTANT: We now can't access Firestore synchronously,
  // so we'll need to fall back to stateStorage for now
  if (admin && !firestoreGroupFound) {
    console.log(`Attempting to access Firestore equipment groups for boiler ${equipmentId}`);
    console.log(`Will update group cache asynchronously for next run`);

    // Don't await - schedule asynchronous update of cache for next time
    updateGroupCacheAsync(equipmentId);
  }

  // If no cached group info, fall back to stateStorage (same as before)
  if (!firestoreGroupFound) {
    console.log(`Using fallback state storage approach for group management`);

    // Check if this boiler is part of a lead/lag system using stateStorage
    const boilerGroupId = settings.boilerGroupId || settings.systemGroupId || null;

    if (boilerGroupId) {
      console.log(`Boiler ${equipmentId} is part of boiler group ${boilerGroupId} (from settings)`);
      groupId = boilerGroupId;

      // Different group keys for domestic vs comfort boilers
      const groupType = boilerType === "domestic" ? "domestic" : "comfort";
      const groupStorageKey = `${groupType}BoilerGroup_${boilerGroupId}`;

      // Initialize state storage for this boiler group if not exists
      if (!stateStorage[groupStorageKey]) {
        stateStorage[groupStorageKey] = {
          lastChangeoverTime: Date.now(),
          leadBoilerId: equipmentId, // Default to this boiler as lead initially
          runtimeHours: {},
          useLeadLag: true, // Default to using lead/lag
          autoFailover: true, // Default to auto failover
          changeoverIntervalDays: 7, // Default weekly changeover
          boilerType: groupType, // Store the boiler type with the group
        };
        console.log(`Initialized new ${groupType} boiler group ${boilerGroupId} with ${equipmentId} as lead boiler`);

        // Log the initialization event
        console.log(`GROUP EVENT: Initialized new ${groupType} boiler group ${boilerGroupId} with ${equipmentId} as lead boiler`);
      }

      // Get the group state
      const groupState = stateStorage[groupStorageKey];

      // Initialize runtime tracking for this boiler
      if (!groupState.runtimeHours[equipmentId]) {
        groupState.runtimeHours[equipmentId] = 0;
      }

      // Update runtime tracking
      if (settings.unitEnable) {
        groupState.runtimeHours[equipmentId] += 1 / 60;
      }

      // Get settings from group state with fallbacks to values in settings
      useLeadLag = groupState.useLeadLag ?? settings.useLeadLag ?? true;
      autoFailover = groupState.autoFailover ?? settings.autoFailover ?? true;
      changeoverIntervalDays = groupState.changeoverIntervalDays ?? settings.changeoverIntervalDays ?? 7;

      // Check if it's time for weekly changeover
      const now = Date.now();
      const changoverIntervalMs = changeoverIntervalDays * 24 * 60 * 60 * 1000;
      const timeSinceLastChangeover = now - groupState.lastChangeoverTime;
      const isTimeForChangeover = timeSinceLastChangeover >= changoverIntervalMs;

      if (isTimeForChangeover && useLeadLag) {
        // Perform changeover to the next boiler in the group
        // We identify all boilers that belong to this group and rotate
        const boilersInGroup = Object.keys(groupState.runtimeHours);

        // If this is the only boiler in the group so far, keep it as lead
        if (boilersInGroup.length <= 1) {
          groupState.leadBoilerId = equipmentId;
        } else {
          // Find the current lead boiler index
          const currentLeadIndex = boilersInGroup.indexOf(groupState.leadBoilerId);
          const previousLeadBoilerId = groupState.leadBoilerId;

          // Determine the next lead boiler (rotate to the next boiler)
          const nextLeadIndex = (currentLeadIndex + 1) % boilersInGroup.length;
          const nextLeadBoilerId = boilersInGroup[nextLeadIndex];

          groupState.leadBoilerId = nextLeadBoilerId;

          // Log the changeover event
          console.log(`GROUP EVENT: ${groupType} boiler group ${boilerGroupId} changed lead from ${previousLeadBoilerId} to ${nextLeadBoilerId}`);
        }

        // Reset the changeover timer
        groupState.lastChangeoverTime = now;

        console.log(`Performing weekly changeover for ${groupType} boiler group ${boilerGroupId}. New lead boiler: ${groupState.leadBoilerId}`);
      }

      // Determine if this boiler is lead or lag from stateStorage
      isLeadBoiler = equipmentId === groupState.leadBoilerId;
    } else {
      // Not part of a boiler group - use settings directly
      isLeadBoiler = settings.isLeadBoiler || metrics.isLeadBoiler || true; // Default to lead if not in a group
    }
  }

  // Legacy field overrides if they exist in the metrics or settings
  if (settings.isLeadBoiler !== undefined) {
    isLeadBoiler = settings.isLeadBoiler;
  }
  if (metrics.isLeadBoiler !== undefined) {
    isLeadBoiler = metrics.isLeadBoiler;
  }

  // Check for lead boiler failures
  leadBoilerFailed = metrics.leadBoilerFailed || false;

  // If auto-failover is enabled and this is a lag boiler
  // Check more thoroughly for lead boiler issues
  if (autoFailover && !isLeadBoiler && !leadBoilerFailed) {
    // For domestic boilers we don't check pump amp readings
    // For comfort boilers we might check for more issues
    if (boilerType === "domestic") {
      leadBoilerFailed = checkForLeadBoilerIssues(metrics, groupId, false);
    } else {
      leadBoilerFailed = checkForLeadBoilerIssues(metrics, groupId, true);
    }

    // If we detected a lead boiler failure, record this
    if (leadBoilerFailed) {
      // Log the failover event
      console.log(`GROUP EVENT: ${boilerType} boiler group ${groupId} failover - lag boiler ${equipmentId} taking over due to lead boiler failure`);
    }
  }

  // Log lead/lag status
  console.log(`Lead status: ${isLeadBoiler ? "LEAD" : "LAG"} boiler`);
  if (!isLeadBoiler && leadBoilerFailed) {
    console.log(`FAILOVER: Lead boiler in group ${groupId} has failed, this lag boiler will take over`);
  }

  // Determine if boiler should be running - SIMPLE ON/OFF CONTROL
  let unitEnable = false;
  let firing = 0; // Binary 0/1 for off/on

  // Simple deadband control
  const deadband = 5; // 5°F deadband
  const emergencyShutoffTemp = 170; // Emergency high-temperature shutoff

  // Determine control strategy based on boiler type
  if (boilerType === "domestic") {
    // Domestic Hot Water Boilers - operate year-round regardless of outdoor temp

    // High-temperature safety cutoff
    if (supplyTemp >= emergencyShutoffTemp) {
      unitEnable = false;
      firing = 0; // Off
      console.log(
        `EMERGENCY SHUTOFF: Domestic HW Supply temp ${supplyTemp}°F above emergency shutoff ${emergencyShutoffTemp}°F - TURNING OFF`,
      );
    } else if (supplyTemp < setpoint - deadband) {
      // For lead/lag systems, check if this boiler should respond
      if (!groupId || isLeadBoiler || leadBoilerFailed) {
        unitEnable = true;
        firing = 1; // On
        console.log(`Domestic HW Supply temp ${supplyTemp}°F below setpoint-deadband ${setpoint - deadband}°F - TURNING ON`);
      } else {
        // This is a lag boiler and the lead boiler is operational
        unitEnable = false;
        firing = 0; // Off
        console.log(`Domestic HW Lag boiler - staying OFF while lead boiler is operational`);
      }
    } else if (supplyTemp > setpoint + deadband) {
      unitEnable = false;
      firing = 0; // Off
      console.log(`Domestic HW Supply temp ${supplyTemp}°F above setpoint+deadband ${setpoint + deadband}°F - TURNING OFF`);
    } else {
      // Within deadband - maintain current state to prevent short cycling
      unitEnable = settings.unitEnable || false;
      firing = settings.firing || 0;
      console.log(
        `Domestic HW Supply temp ${supplyTemp}°F within deadband of setpoint ${setpoint}°F - MAINTAINING ${unitEnable ? "ON" : "OFF"}`,
      );
    }
  } else {
    // Comfort Boilers - operate with outdoor reset and may shut down in warm weather

    // High-temperature safety cutoff
    if (supplyTemp >= emergencyShutoffTemp) {
      unitEnable = false;
      firing = 0; // Off
      console.log(
        `EMERGENCY SHUTOFF: Comfort boiler supply temp ${supplyTemp}°F above emergency shutoff ${emergencyShutoffTemp}°F - TURNING OFF`,
      );
    } else if (supplyTemp < setpoint - deadband) {
      // For lead/lag systems, check if this boiler should respond
      if (!groupId || isLeadBoiler || leadBoilerFailed) {
        unitEnable = true;
        firing = 1; // On
        console.log(`Comfort boiler supply temp ${supplyTemp}°F below setpoint-deadband ${setpoint - deadband}°F - TURNING ON`);
      } else {
        // This is a lag boiler and the lead boiler is operational
        unitEnable = false;
        firing = 0; // Off
        console.log(`Comfort boiler lag unit - staying OFF while lead boiler is operational`);
      }
    } else if (supplyTemp > setpoint + deadband) {
      unitEnable = false;
      firing = 0; // Off
      console.log(`Comfort boiler supply temp ${supplyTemp}°F above setpoint+deadband ${setpoint + deadband}°F - TURNING OFF`);
    } else {
      // Within deadband - maintain current state to prevent short cycling
      unitEnable = settings.unitEnable || false;
      firing = settings.firing || 0;
      console.log(
        `Comfort boiler supply temp ${supplyTemp}°F within deadband of setpoint ${setpoint}°F - MAINTAINING ${unitEnable ? "ON" : "OFF"}`,
      );
    }
  }

  // Log control decision
  console.log(`Boiler ${equipmentId} (${boilerType}): ${unitEnable ? "ON" : "OFF"}, Firing: ${firing}`);

  // Return simplified field set for InfluxDB compatibility and add runtime tracking
  return {
    firing: firing ? 1 : 0, // Binary 0/1 for off/on
    waterTempSetpoint: setpoint,
    unitEnable: Boolean(unitEnable), // Explicitly convert to boolean
    stateStorage, // Add state storage to preserve runtime and group info
    isLead: isLeadBoiler ? 1 : 0, // Add lead status as numeric flag for InfluxDB
    boilerRuntime: stateStorage.boilerRuntime || 0, // Add runtime tracking
    boilerType, // Include the boiler type for easier filtering
    groupId: groupId || null // Include the group ID for easier filtering
  };
}

/**
 * CRITICAL FIX: Check if location-specific control logic has already made decisions
 * This prevents the base boiler control from overriding location-specific logic like Huntington OAR + Lead-Lag
 */
function checkForLocationSpecificResults(settings: any, stateStorage: any): any {
  // Check if stateStorage contains location-specific results
  // Location-specific logic (like Huntington) stores its decisions in stateStorage
  if (stateStorage && stateStorage.temperatureSetpoint !== undefined) {
    // Check for Huntington-specific fields
    if (stateStorage.minOutdoorTemp !== undefined && stateStorage.maxOutdoorTemp !== undefined) {
      return {
        hasLocationLogic: true,
        temperatureSetpoint: stateStorage.temperatureSetpoint,
        boilerEnabled: settings.boilerEnabled || false,
        pumpEnabled: settings.pumpEnabled || false,
        isLead: settings.isLead || 0,
        boilerType: "comfort",
        groupId: settings.groupId || null,
        oarSetpoint: stateStorage.temperatureSetpoint,
        outdoorTemp: settings.outdoorTemp,
        leadLagReason: settings.leadLagReason
      };
    }
  }

  // Check if settings contain location-specific override flags
  if (settings.locationSpecificControl === true || settings.huntingtonControl === true) {
    return {
      hasLocationLogic: true,
      temperatureSetpoint: settings.temperatureSetpoint || 155,
      boilerEnabled: settings.boilerEnabled || false,
      pumpEnabled: settings.pumpEnabled || false,
      isLead: settings.isLead || 0,
      boilerType: settings.boilerType || "comfort",
      groupId: settings.groupId || null,
      oarSetpoint: settings.oarSetpoint,
      outdoorTemp: settings.outdoorTemp,
      leadLagReason: settings.leadLagReason
    };
  }

  // Check for specific location indicators (Huntington = location 4)
  if (settings.locationId === "4" || settings.locationId === 4) {
    // For Huntington location, check if custom results are available
    if (settings.oarSetpoint !== undefined || settings.leadLagReason !== undefined) {
      return {
        hasLocationLogic: true,
        temperatureSetpoint: settings.oarSetpoint || settings.temperatureSetpoint || 155,
        boilerEnabled: settings.boilerEnabled || false,
        pumpEnabled: settings.pumpEnabled || false,
        isLead: settings.isLead || 0,
        boilerType: settings.boilerType || "comfort",
        groupId: settings.groupId || null,
        oarSetpoint: settings.oarSetpoint,
        outdoorTemp: settings.outdoorTemp,
        leadLagReason: settings.leadLagReason
      };
    }
  }

  // No location-specific logic detected
  return {
    hasLocationLogic: false
  };
}

/**
 * CRITICAL FIX: Parse temperature values that might be objects or strings
 * This fixes the [object Object] temperature issue
 */
function parseTemperature(value: any): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  
  // If it's already a number, return it
  if (typeof value === 'number' && !isNaN(value)) {
    return value;
  }
  
  // If it's a string, try to parse it
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }
  
  // If it's an object, try to extract a temperature value
  if (typeof value === 'object' && value !== null) {
    // Common temperature field names in objects
    const tempFields = ['value', 'temperature', 'temp', 'val', 'reading'];
    for (const field of tempFields) {
      if (value[field] !== undefined) {
        const parsed = parseFloat(value[field]);
        if (!isNaN(parsed)) {
          return parsed;
        }
      }
    }
  }
  
  // Could not parse
  return null;
}

/**
 * Asynchronous function to update the group cache
 * This will be called without awaiting its result
 */
async function updateGroupCacheAsync(equipmentId: string) {
  try {
    if (!admin) return;

    // Query all equipment groups
    const groupsSnapshot = await admin.firestore().collection('equipmentGroups').get();

    // Find a group that contains this boiler
    groupsSnapshot.forEach(doc => {
      const data = doc.data();
      // Get equipment IDs handling both field names with or without spaces
      const equipmentIds = data.equipmentIds || data['equipmentIds '] || [];

      if (Array.isArray(equipmentIds) && equipmentIds.includes(equipmentId)) {
        const groupId = doc.id;

        // Get lead equipment ID, handling field names with or without spaces
        const leadEquipmentId = data.leadEquipmentId || data['leadEquipmentId '] || '';

        // Check if this boiler is the lead boiler
        const isLeadBoiler = leadEquipmentId === equipmentId;

        // Get group settings, handling field names with or without spaces
        const useLeadLag = data.useLeadLag !== undefined
          ? data.useLeadLag
          : (data['useLeadLag '] !== undefined ? data['useLeadLag '] : true);

        const autoFailover = data.autoFailover !== undefined
          ? data.autoFailover
          : (data['autoFailover '] !== undefined ? data['autoFailover '] : true);

        const changeoverIntervalDays = data.changeoverIntervalDays || data['changeoverIntervalDays '] || 7;

        // Cache equipment-specific info
        groupCache.set(equipmentId, {
          isLeadBoiler,
          groupId,
          useLeadLag,
          autoFailover,
          changeoverIntervalDays
        });

        // Cache group info
        groupCache.set(`group_${groupId}`, {
          leadEquipmentId,
          useLeadLag,
          autoFailover,
          changeoverIntervalDays,
          equipmentIds
        });

        console.log(`Updated group cache for boiler ${equipmentId} (group ${groupId})`);
      }
    });
  } catch (error) {
    console.error(`Error updating group cache: ${error}`);
  }
}

/**
 * Check for issues with the lead boiler
 */
function checkForLeadBoilerIssues(metrics: any, groupId: string, checkPumps: boolean): boolean {
  // Look for fields that might indicate lead boiler status
  const keys = Object.keys(metrics);

  for (const key of keys) {
    if (
      (key.toLowerCase().includes("lead") || key.toLowerCase().includes("boiler1") || key.toLowerCase().includes("boiler_1")) &&
      (key.toLowerCase().includes("alarm") || key.toLowerCase().includes("fault"))
    ) {
      const value = metrics[key];
      if (typeof value === "boolean") {
        return value;
      }
      if (typeof value === "number") {
        return value > 0;
      }
      if (typeof value === "string") {
        return value.toLowerCase() === "true" || value === "1" || value.toLowerCase() === "on";
      }
    }
  }

  // Check for supply temperature too low or other issues
  if (metrics.leadBoilerSupplyTemp && metrics.leadBoilerSupplyTemp < 100) {
    return true; // Lead boiler not producing enough heat
  }

  // Only check pump issues for comfort boilers if requested
  if (checkPumps) {
    // Check for pump amp issues if available (only for comfort boilers)
    if (metrics.pumpAmps !== undefined && metrics.pumpAmps < 0.5) {
      return true; // Pump not running properly
    }

    // Check other pump-related fields
    for (const key of keys) {
      if (key.toLowerCase().includes("pump") && key.toLowerCase().includes("amp")) {
        const value = Number(metrics[key]);
        if (!isNaN(value) && value < 0.5) {
          return true; // Pump issue detected
        }
      }
    }
  }

  // No issues found
  return false;
}
