"use strict";
/**
 * Boiler Control Logic with Firestore Equipment Groups Integration
 * This function implements on/off control for boilers with proper metrics handling
 * and supports lead/lag configurations for multi-boiler systems
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.boilerControl = boilerControl;
// Import Firebase Admin if not already imported at the module level
let admin;
try {
    admin = require('firebase-admin');
}
catch (error) {
    console.log('Firebase admin not available in this context');
}
// Cache for Firestore equipment group information
const groupCache = new Map();
function boilerControl(metrics, settings, currentTemp, stateStorage) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    // Extract equipment ID and location ID
    const equipmentId = settings.equipmentId || "unknown";
    const locationId = settings.locationId || "unknown";
    // Log all available metrics to help diagnose temperature issues
    console.log(`Available metrics for boiler ${equipmentId}:`, Object.keys(metrics)
        .filter((key) => key.includes("H2O") || key.includes("Supply") || key.includes("Return") || key.includes("Temp"))
        .reduce((obj, key) => {
        obj[key] = metrics[key];
        return obj;
    }, {}));
    console.log(`Boiler control for ${equipmentId}: Starting control logic`);
    // IMPORTANT: Use the exact field names from the InfluxDB "Locations" bucket
    // The metrics are named "H2OSupply" and "H2OReturn" (without spaces)
    const supplyTemp = metrics.H20Supply || // Primary field name from InfluxDB - EXACT MATCH (note: H20 not H2O)
        metrics.H2OSupply || // Alternative spelling
        metrics["H2O Supply"] || // Alternative with space
        metrics.H2O_Supply || // Alternative with underscore
        currentTemp || // Use the passed-in currentTemp as a fallback
        metrics.Supply ||
        metrics.supplyTemperature ||
        metrics.SupplyTemperature ||
        140; // Last resort fallback - CHANGED FROM 180 TO 140
    const returnTemp = metrics.H20Return || // Primary field name from InfluxDB - EXACT MATCH (note: H20 not H2O)
        metrics.H2OReturn || // Alternative spelling
        metrics["H2O Return"] || // Alternative with space
        metrics.H2O_Return || // Alternative with underscore
        metrics.Return ||
        metrics.returnTemperature ||
        metrics.ReturnTemperature ||
        160;
    // Check if we're getting the right temperature values
    if (!metrics.H20Supply && !metrics.H2OSupply && !metrics["H2O Supply"] && !metrics.H2O_Supply) {
        console.log("WARNING: Could not find H20Supply or H2OSupply field in metrics. Available fields:", Object.keys(metrics));
    }
    // Get outdoor temperature with fallbacks - CHANGED PRIMARY SOURCE TO outdoorTemp
    const outdoorTemp = metrics.outdoorTemp || // Primary field name from InfluxDB - EXACT MATCH
        metrics.OutdoorTemp || // Pascal case alternative
        metrics.OutdoorAirTemp || // Previous primary field
        metrics["Outdoor Air Temperature"] ||
        metrics.Outdoor_Air_Temperature ||
        metrics.outdoorTemperature ||
        metrics.OutdoorTemperature ||
        metrics.Outdoor ||
        metrics.outdoor ||
        metrics.OAT ||
        metrics.oat ||
        50;
    // Log the temperatures we found with more detail
    console.log(`Boiler temperatures - Supply: ${supplyTemp}°F (from ${metrics.H20Supply
        ? "H20Supply"
        : metrics.H2OSupply
            ? "H2OSupply"
            : metrics["H2O Supply"]
                ? "H2O Supply"
                : metrics.H2O_Supply
                    ? "H2O_Supply"
                    : "fallback"}), Return: ${returnTemp}°F, Outdoor: ${outdoorTemp}°F (from ${metrics.outdoorTemp
        ? "outdoorTemp"
        : metrics.OutdoorTemp
            ? "OutdoorTemp"
            : metrics.OutdoorAirTemp
                ? "OutdoorAirTemp"
                : metrics["Outdoor Air Temperature"]
                    ? "Outdoor Air Temperature"
                    : "fallback"})`);
    // Determine boiler type based on equipment ID or name
    const boilerName = settings.name || equipmentId;
    const isDomestic = boilerName.toLowerCase().includes("domestic") ||
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
    }
    else {
        // Comfort boilers (for building heating) use outdoor reset curve
        // Start with base setpoint from settings
        setpoint = settings.temperatureSetpoint || settings.waterTempSetpoint || 155;
        console.log(`Initial comfort boiler setpoint from settings: ${setpoint}°F`);
        // Apply outdoor air reset if enabled (default to enabled for comfort boilers)
        if (((_a = settings.outdoorAirReset) === null || _a === void 0 ? void 0 : _a.enabled) !== false) {
            // Get outdoor reset parameters with fallbacks
            const minOutdoorTemp = ((_b = settings.outdoorAirReset) === null || _b === void 0 ? void 0 : _b.minTemp) || 30;
            const maxOutdoorTemp = ((_c = settings.outdoorAirReset) === null || _c === void 0 ? void 0 : _c.maxTemp) || 75;
            // CORRECTED: Fixed the min/max supply temp values (keeping original property names)
            const minSupplyTemp = ((_d = settings.outdoorAirReset) === null || _d === void 0 ? void 0 : _d.minSetpoint) || 80; // Lower temp at higher outdoor temp
            const maxSupplyTemp = ((_e = settings.outdoorAirReset) === null || _e === void 0 ? void 0 : _e.maxSetpoint) || 155; // Higher temp at lower outdoor temp
            console.log(`Outdoor air reset parameters: Min Outdoor: ${minOutdoorTemp}°F, Max Outdoor: ${maxOutdoorTemp}°F, Min Supply: ${minSupplyTemp}°F, Max Supply: ${maxSupplyTemp}°F`);
            // Calculate setpoint based on outdoor temperature
            if (outdoorTemp >= maxOutdoorTemp) {
                setpoint = minSupplyTemp;
                console.log(`Outdoor temp ${outdoorTemp}°F >= ${maxOutdoorTemp}°F, using min setpoint: ${minSupplyTemp}°F`);
            }
            else if (outdoorTemp <= minOutdoorTemp) {
                setpoint = maxSupplyTemp;
                console.log(`Outdoor temp ${outdoorTemp}°F <= ${minOutdoorTemp}°F, using max setpoint: ${maxSupplyTemp}°F`);
            }
            else {
                // Linear interpolation
                const ratio = (maxOutdoorTemp - outdoorTemp) / (maxOutdoorTemp - minOutdoorTemp);
                setpoint = minSupplyTemp + ratio * (maxSupplyTemp - minSupplyTemp);
                console.log(`Outdoor temp ${outdoorTemp}°F, interpolated setpoint: ${setpoint.toFixed(1)}°F (ratio: ${ratio.toFixed(2)})`);
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
            useLeadLag = (_g = (_f = groupState.useLeadLag) !== null && _f !== void 0 ? _f : settings.useLeadLag) !== null && _g !== void 0 ? _g : true;
            autoFailover = (_j = (_h = groupState.autoFailover) !== null && _h !== void 0 ? _h : settings.autoFailover) !== null && _j !== void 0 ? _j : true;
            changeoverIntervalDays = (_l = (_k = groupState.changeoverIntervalDays) !== null && _k !== void 0 ? _k : settings.changeoverIntervalDays) !== null && _l !== void 0 ? _l : 7;
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
                }
                else {
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
        }
        else {
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
        }
        else {
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
            console.log(`EMERGENCY SHUTOFF: Domestic HW Supply temp ${supplyTemp}°F above emergency shutoff ${emergencyShutoffTemp}°F - TURNING OFF`);
        }
        else if (supplyTemp < setpoint - deadband) {
            // For lead/lag systems, check if this boiler should respond
            if (!groupId || isLeadBoiler || leadBoilerFailed) {
                unitEnable = true;
                firing = 1; // On
                console.log(`Domestic HW Supply temp ${supplyTemp}°F below setpoint-deadband ${setpoint - deadband}°F - TURNING ON`);
            }
            else {
                // This is a lag boiler and the lead boiler is operational
                unitEnable = false;
                firing = 0; // Off
                console.log(`Domestic HW Lag boiler - staying OFF while lead boiler is operational`);
            }
        }
        else if (supplyTemp > setpoint + deadband) {
            unitEnable = false;
            firing = 0; // Off
            console.log(`Domestic HW Supply temp ${supplyTemp}°F above setpoint+deadband ${setpoint + deadband}°F - TURNING OFF`);
        }
        else {
            // Within deadband - maintain current state to prevent short cycling
            unitEnable = settings.unitEnable || false;
            firing = settings.firing || 0;
            console.log(`Domestic HW Supply temp ${supplyTemp}°F within deadband of setpoint ${setpoint}°F - MAINTAINING ${unitEnable ? "ON" : "OFF"}`);
        }
    }
    else {
        // Comfort Boilers - operate with outdoor reset and may shut down in warm weather
        // High-temperature safety cutoff
        if (supplyTemp >= emergencyShutoffTemp) {
            unitEnable = false;
            firing = 0; // Off
            console.log(`EMERGENCY SHUTOFF: Comfort boiler supply temp ${supplyTemp}°F above emergency shutoff ${emergencyShutoffTemp}°F - TURNING OFF`);
        }
        else if (supplyTemp < setpoint - deadband) {
            // For lead/lag systems, check if this boiler should respond
            if (!groupId || isLeadBoiler || leadBoilerFailed) {
                unitEnable = true;
                firing = 1; // On
                console.log(`Comfort boiler supply temp ${supplyTemp}°F below setpoint-deadband ${setpoint - deadband}°F - TURNING ON`);
            }
            else {
                // This is a lag boiler and the lead boiler is operational
                unitEnable = false;
                firing = 0; // Off
                console.log(`Comfort boiler lag unit - staying OFF while lead boiler is operational`);
            }
        }
        else if (supplyTemp > setpoint + deadband) {
            unitEnable = false;
            firing = 0; // Off
            console.log(`Comfort boiler supply temp ${supplyTemp}°F above setpoint+deadband ${setpoint + deadband}°F - TURNING OFF`);
        }
        else {
            // Within deadband - maintain current state to prevent short cycling
            unitEnable = settings.unitEnable || false;
            firing = settings.firing || 0;
            console.log(`Comfort boiler supply temp ${supplyTemp}°F within deadband of setpoint ${setpoint}°F - MAINTAINING ${unitEnable ? "ON" : "OFF"}`);
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
 * Asynchronous function to update the group cache
 * This will be called without awaiting its result
 */
async function updateGroupCacheAsync(equipmentId) {
    try {
        if (!admin)
            return;
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
    }
    catch (error) {
        console.error(`Error updating group cache: ${error}`);
    }
}
/**
 * Check for issues with the lead boiler
 */
function checkForLeadBoilerIssues(metrics, groupId, checkPumps) {
    // Look for fields that might indicate lead boiler status
    const keys = Object.keys(metrics);
    for (const key of keys) {
        if ((key.toLowerCase().includes("lead") || key.toLowerCase().includes("boiler1") || key.toLowerCase().includes("boiler_1")) &&
            (key.toLowerCase().includes("alarm") || key.toLowerCase().includes("fault"))) {
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
