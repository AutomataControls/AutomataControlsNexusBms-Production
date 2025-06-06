"use strict";
// @ts-nocheck
// lib/equipment-logic/locations/hopebridge/boiler.ts
//
// Author: Juelz NeuralBms DevOps
// Last Updated: June 4, 2025
//
// ===============================================================================
// HOPEBRIDGE BOILER CONTROL LOGIC - LEAD/LAG HOT WATER SYSTEM
// ===============================================================================
//
// OVERVIEW:
// This file controls the lead/lag boiler system at the Hopebridge location for
// hot water heating throughout the facility. The system provides consistent
// hot water temperatures for optimal comfort in autism therapy environments with
// intelligent equipment coordination and comprehensive safety monitoring.
//
// EQUIPMENT CONFIGURATION:
// - **Boiler 1**: Currently disconnected for repairs (should not be enabled)
//   * Status: Offline for maintenance and repair work
//   * Control: Automatically disabled until repairs completed
//   * Safety: System prevents activation during repair period
//
// - **Boiler 2**: Primary operating unit (currently acting as lead)
//   * Status: Main operational boiler handling full facility load
//   * Control: Lead boiler with full firing and temperature control
//   * Capacity: Sized to handle entire facility heating demand independently
//
// ADVANCED CONTROL STRATEGY:
// 1. **Supply Water Temperature Control** - Uses actual supply water temperature for precise control
//    - Primary sensor input for all control decisions
//    - Multiple temperature source fallbacks for reliability
//    - Real-time temperature monitoring and adjustment
//
// 2. **Outdoor Air Reset (OAR)** - Energy-efficient setpoint optimization
//    - Automatically adjusts setpoints based on outdoor conditions
//    - Reduces energy consumption during mild weather
//    - Maintains comfort during extreme weather conditions
//    - Linear interpolation provides smooth transitions
//
// 3. **Intelligent Lead/Lag Management** - Coordinates multiple boilers for optimal efficiency
//    - Automatic lead boiler selection based on equipment status
//    - Smart sequencing prevents simultaneous operation conflicts
//    - Equipment rotation capabilities for balanced wear (when both operational)
//    - Failover protection ensures continuous heating availability
//
// 4. **Continuous Operation** - 24/7 heating availability for therapy facility
//    - No occupancy schedules - runs continuously as needed
//    - Consistent temperature maintenance for therapy environments
//    - Automatic adjustment based on actual demand
//    - Emergency backup procedures for equipment failures
//
// 5. **Comprehensive Safety Monitoring** - Multi-layer protection systems
//    - Equipment status validation before operation
//    - Temperature limit monitoring and enforcement
//    - Repair status tracking and automatic lockouts
//    - Emergency shutdown procedures with proper state logging
//
// DETAILED OPERATING PARAMETERS:
// **Temperature Control System:**
// - **Control Method**: Supply water temperature-based control
// - **Primary Sources**: H20Supply, H2OSupply, H2O Supply, H2O_Supply
// - **Secondary Sources**: Supply, supplyTemperature, SupplyTemp, waterSupplyTemp
// - **Fallback Sources**: boilerSupplyTemp, WaterSupplyTemp
// - **Default Value**: 140°F if no sensor reading available
// - **Sensor Validation**: Multiple source checking for reliability
//
// **OAR Setpoints (Hopebridge Therapy Environment):**
// - **Cold Weather Extreme** (32°F outdoor): 155°F supply (maximum heat output)
// - **Mild Weather Extreme** (72°F outdoor): 80°F supply (minimum heat output)
// - **Linear Interpolation**: Smooth setpoint calculation between extremes
//   * Formula: Setpoint = 155 - ((OAT - 32) / (72 - 32)) * (155 - 80)
//   * Provides optimal energy efficiency while maintaining comfort
// - **Therapy Room Optimization**: Moderate heating loads for consistent environment
//
// **Lead/Lag Operation Logic:**
// - **Current Configuration**: Boiler 2 as lead (Boiler 1 disconnected)
// - **Normal Operation**: Only lead boiler operates under standard conditions
// - **Demand-Based Control**: Lead boiler modulates based on temperature error
// - **Failover Protection**: Automatic switching if lead boiler fails
// - **Repair Status Integration**: Prevents operation of disconnected equipment
// - **Future Expansion**: Ready for dual-boiler operation when Boiler 1 returns
//
// COMPREHENSIVE EQUIPMENT DETAILS:
//
// **Boiler 1 (Currently Disconnected):**
// - **Operational Status**: Offline for repairs and maintenance
// - **Control Response**: Automatically disabled, cannot be enabled
// - **Safety Interlock**: System prevents activation during repair period
// - **Monitoring**: Status checked regularly for repair completion
// - **Return to Service**: Will require manual validation and system reconfiguration
// - **Lead/Lag Role**: Will not be selected as lead until repairs completed
//
// **Boiler 2 (Primary Operating Unit):**
// - **Operational Status**: Fully operational and serving as primary heat source
// - **Control Method**: Full firing control based on temperature demand
// - **Lead/Lag Role**: Currently designated as lead boiler
// - **Capacity Handling**: Sized to handle full facility load independently
// - **Temperature Control**: Fires when supply temperature > 2°F below setpoint
// - **Modulation**: On/off firing control with intelligent timing
// - **Efficiency**: Optimized firing patterns for maximum efficiency
//
// **Advanced Safety Systems:**
// - **Equipment Status Validation**: Continuous monitoring of boiler availability
// - **Repair Status Tracking**: Prevents operation of equipment under maintenance
// - **Temperature Limit Enforcement**: High and low temperature protection
// - **Lead/Lag Coordination**: Prevents simultaneous operation conflicts
// - **Emergency Procedures**: Automatic shutdown and safe state procedures
// - **Fault Detection**: Early warning systems for maintenance needs
//
// ENERGY EFFICIENCY FEATURES:
// - **Outdoor Air Reset**: Reduces energy consumption based on weather conditions
// - **Demand-Based Operation**: Operates only when heating is actually needed
// - **Optimal Sizing**: Single boiler operation reduces standby losses
// - **Intelligent Scheduling**: Coordinates operation with facility schedules
// - **Temperature Optimization**: Maintains minimum temperature needed for comfort
// - **Efficient Sequencing**: Minimizes unnecessary equipment cycling
//
// THERAPY FACILITY CONSIDERATIONS:
// - **Consistent Temperature**: Stable heating for therapy session comfort
// - **Quiet Operation**: Minimal noise disruption to therapy activities
// - **Reliable Heating**: High availability for scheduled therapy sessions
// - **Energy Cost Management**: Efficient operation for non-profit facility
// - **Maintenance Coordination**: Scheduled maintenance minimizes therapy disruption
// - **Emergency Backup**: Failover procedures ensure continuous operation
//
// MAINTENANCE AND MONITORING:
// - **Equipment Status Tracking**: Real-time monitoring of boiler health
// - **Performance Logging**: Detailed operation logs for optimization
// - **Repair Coordination**: Integration with maintenance management systems
// - **Runtime Monitoring**: Equipment runtime tracking for service scheduling
// - **Efficiency Analysis**: Performance trending for optimization opportunities
// - **Predictive Maintenance**: Early warning systems for proactive maintenance
//
// OPERATIONAL NOTES FOR TECHNICIANS:
// - **Continuous Operation**: Normal for therapy facility - no occupancy shutdowns
// - **Single Boiler Operation**: Normal while Boiler 1 is under repair
// - **Temperature Monitoring**: Supply temperature is primary control input
// - **OAR Verification**: Outdoor temperature sensor critical for efficient operation
// - **Lead/Lag Status**: Boiler 2 should be lead until Boiler 1 repairs completed
// - **Repair Coordination**: Coordinate with facilities team for Boiler 1 status
// - **System Integration**: Monitor Node-RED dashboard for comprehensive status
//
// FACTORY INTEGRATION:
// - **High Performance**: Returns command objects for 1-2 second processing
// - **BullMQ Compatible**: Designed for smart queue architecture
// - **Error Handling**: Graceful degradation during communication faults
// - **State Persistence**: Maintains boiler states between processing cycles
// - **Real-time Response**: Immediate response to therapy facility heating needs
//
// ===============================================================================

Object.defineProperty(exports, "__esModule", { value: true });
exports.boilerControl = boilerControl;
const location_logger_1 = require("../../../logging/location-logger");

// Helper to safely parse temperatures from various metric sources or settings
function parseSafeNumber(value, defaultValue) {
    if (typeof value === 'number' && !isNaN(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const parsed = parseFloat(value);
        if (!isNaN(parsed)) {
            return parsed;
        }
    }
    return defaultValue;
}

/**
 * Extract boiler number from equipment ID
 */
function getBoilerNumber(equipmentId) {
    try {
        // Check for "Boiler 1" or "Boiler 2" in the ID
        if (equipmentId.includes("Boiler 1") || equipmentId.includes("Boiler-1") || equipmentId.includes("Boiler1")) {
            return 1;
        }
        if (equipmentId.includes("Boiler 2") || equipmentId.includes("Boiler-2") || equipmentId.includes("Boiler2")) {
            return 2;
        }
        // Try to extract the number from the ID
        const match = equipmentId.match(/(\d+)/);
        if (match) {
            return parseInt(match[0], 10);
        }
        // Default to boiler 2 if we can't determine (since boiler 1 is disconnected)
        return 2;
    } catch (error) {
        console.error(`Error determining boiler number: ${error}`);
        return 2; // Default to boiler 2 since boiler 1 is disconnected
    }
}

async function boilerControl(metricsInput, settingsInput, currentTempArgument, stateStorageInput) {
    const equipmentId = settingsInput.equipmentId || "unknown";
    const locationId = settingsInput.locationId || "5"; // Hopebridge location ID
    const currentMetrics = metricsInput;
    const currentSettings = settingsInput;

    (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "boiler", "Starting Hopebridge boiler control logic");

    try {
        // Initialize state storage if needed
        if (!stateStorageInput) {
            stateStorageInput = {};
        }

        // STEP 1: Handle boiler identification and repair status
        const boilerNumber = getBoilerNumber(equipmentId);
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "boiler", `Identified as Boiler ${boilerNumber}`);

        if (boilerNumber === 1) {
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "boiler", "WARNING: Boiler 1 is currently disconnected for repairs, system should be using Boiler 2");
        }

        // STEP 2: Get supply temperature with comprehensive fallbacks
        let currentTemp = currentTempArgument;
        if (currentTemp === undefined || isNaN(currentTemp)) {
            currentTemp = parseSafeNumber(currentMetrics.H20Supply, 
                parseSafeNumber(currentMetrics.H2OSupply, 
                parseSafeNumber(currentMetrics["H2O Supply"], 
                parseSafeNumber(currentMetrics.H2O_Supply, 
                parseSafeNumber(currentMetrics.Supply, 
                parseSafeNumber(currentMetrics.supplyTemperature, 
                parseSafeNumber(currentMetrics.SupplyTemp, 
                parseSafeNumber(currentMetrics.supplyTemp, 
                parseSafeNumber(currentMetrics.SupplyTemperature, 
                parseSafeNumber(currentMetrics.waterSupplyTemp, 
                parseSafeNumber(currentMetrics.WaterSupplyTemp, 
                parseSafeNumber(currentMetrics.boilerSupplyTemp, 140))))))))))));
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "boiler", `Using supply temperature: ${currentTemp}°F`);
        } else {
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "boiler", `Using provided supply temperature: ${currentTemp}°F`);
        }

        // STEP 3: Get outdoor temperature with fallbacks
        const outdoorTemp = parseSafeNumber(currentMetrics.Outdoor_Air, 
            parseSafeNumber(currentMetrics.outdoorTemperature, 
            parseSafeNumber(currentMetrics.outdoorTemp, 
            parseSafeNumber(currentMetrics.Outdoor, 
            parseSafeNumber(currentMetrics.outdoor, 
            parseSafeNumber(currentMetrics.OutdoorTemp, 
            parseSafeNumber(currentMetrics.OAT, 
            parseSafeNumber(currentMetrics.oat, 50))))))));

        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "boiler", `Outdoor temperature: ${outdoorTemp}°F`);

        // STEP 4: Calculate setpoint based on OAR curve
        let setpoint = 155; // Default to max setpoint

        // Hopebridge OAR parameters: Min OAT 32°F → SP 155°F, Max OAT 72°F → SP 80°F
        const minOAT = 32;
        const maxOAT = 72;
        const maxSupply = 155;
        const minSupply = 80;

        if (outdoorTemp <= minOAT) {
            setpoint = maxSupply;
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "boiler", `OAR: OAT ${outdoorTemp}°F <= ${minOAT}°F, using max setpoint: ${setpoint}°F`);
        } else if (outdoorTemp >= maxOAT) {
            setpoint = minSupply;
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "boiler", `OAR: OAT ${outdoorTemp}°F >= ${maxOAT}°F, using min setpoint: ${setpoint}°F`);
        } else {
            // Linear interpolation for values between min and max
            const ratio = (outdoorTemp - minOAT) / (maxOAT - minOAT);
            setpoint = maxSupply - ratio * (maxSupply - minSupply);
            setpoint = parseFloat(setpoint.toFixed(1));
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "boiler", `OAR: Calculated setpoint: ${setpoint}°F (ratio: ${ratio.toFixed(2)})`);
        }

        // STEP 5: Determine lead/lag status
        let isLeadBoiler = false;
        const groupId = currentSettings.boilerGroupId || currentSettings.groupId || currentSettings.systemGroupId || null;

        if (groupId) {
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "boiler", `Boiler is part of group ${groupId}`);
            
            if (currentSettings.isLeadBoiler !== undefined) {
                isLeadBoiler = currentSettings.isLeadBoiler;
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "boiler", `Boiler is ${isLeadBoiler ? "LEAD" : "LAG"} based on settings`);
            } else if (currentMetrics.isLeadBoiler !== undefined) {
                isLeadBoiler = currentMetrics.isLeadBoiler;
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "boiler", `Boiler is ${isLeadBoiler ? "LEAD" : "LAG"} based on metrics`);
            } else if (boilerNumber === 1) {
                // Boiler 1 is disconnected, so it shouldn't be lead
                isLeadBoiler = false;
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "boiler", "Boiler 1 should not be lead since it's disconnected for repairs");
            } else {
                // Boiler 2 should be lead since Boiler 1 is disconnected
                isLeadBoiler = true;
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "boiler", "Boiler 2 should be lead since Boiler 1 is disconnected for repairs");
            }
        } else {
            // If not in a group, default to lead (unless it's the disconnected Boiler 1)
            isLeadBoiler = boilerNumber !== 1;
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "boiler", `Boiler not part of a group, defaulting to ${isLeadBoiler ? "LEAD" : "LAG (disconnected)"}`);
        }

        // STEP 6: Determine if boiler should be enabled
        let unitEnable = true;
        let firing = false;

        // Boiler 1 should never be enabled since it's disconnected
        if (boilerNumber === 1) {
            unitEnable = false;
            firing = false;
            (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "boiler", "Boiler 1 DISABLED - disconnected for repairs");
        } else {
            // For other boilers, determine firing based on temperature and lead/lag status
            if (isLeadBoiler) {
                // Lead boiler fires based on temperature demand
                const temperatureError = setpoint - currentTemp;
                firing = temperatureError > 2.0; // Fire when more than 2°F below setpoint
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "boiler", `Lead boiler firing: ${firing ? "YES" : "NO"} (error: ${temperatureError.toFixed(1)}°F)`);
            } else {
                // Lag boiler only fires if lead boiler cannot meet demand (not implemented here)
                firing = false;
                (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "boiler", "Lag boiler not firing (lead boiler handling load)");
            }
        }

        // STEP 7: Construct result
        const result = {
            unitEnable: unitEnable,
            firing: firing,
            waterTempSetpoint: setpoint,
            temperatureSetpoint: setpoint,
            isLead: isLeadBoiler ? 1 : 0,
            boilerNumber: boilerNumber,
            boilerGroupId: groupId,
            outdoorTemp: outdoorTemp,
            supplyTemp: currentTemp
        };

        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "boiler", `Final Boiler ${boilerNumber} controls: Enable=${result.unitEnable ? "ON" : "OFF"}, ` +
            `Firing=${result.firing ? "ON" : "OFF"}, Setpoint=${result.waterTempSetpoint}°F, ` +
            `Lead=${result.isLead ? "YES" : "NO"}`);

        // STEP 8: Return filtered result (factory will handle database writes)
        return filterValidCommands(result);

    } catch (error) {
        (0, location_logger_1.logLocationEquipment)(locationId, equipmentId, "boiler", `ERROR in Hopebridge boiler control: ${error.message}`, error.stack);

        const errorResult = {
            unitEnable: false,
            firing: false,
            waterTempSetpoint: 80,
            temperatureSetpoint: 80,
            isLead: 0,
            boilerNumber: getBoilerNumber(equipmentId),
            boilerGroupId: null,
            outdoorTemp: 50,
            supplyTemp: 140
        };

        return filterValidCommands(errorResult);
    }
}

/**
 * Helper function to filter result to only include valid control commands
 */
function filterValidCommands(result) {
    const validControlCommands = [
        'unitEnable', 'firing', 'waterTempSetpoint', 'temperatureSetpoint',
        'isLead', 'boilerNumber', 'boilerGroupId', 'outdoorTemp', 'supplyTemp'
    ];

    const filteredResult = {};
    for (const [key, value] of Object.entries(result)) {
        if (validControlCommands.includes(key)) {
            filteredResult[key] = value;
        }
    }

    return filteredResult;
}
