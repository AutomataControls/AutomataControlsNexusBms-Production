# Equipment Logic Development Guide

## 🎛️ Overview

The Automata Controls Nexus BMS uses sophisticated equipment logic files to control HVAC systems with precision. This guide explains how to create, modify, and deploy custom equipment control algorithms using our standardized 4-parameter interface.

## 🏗️ Equipment Logic Architecture

### File Structure
```
lib/equipment-logic/locations/
├── location-a/
│   ├── air-handler.js      # Air handling units
│   ├── boiler.js          # Boiler systems
│   ├── chiller.js         # Chiller systems
│   ├── fan-coil.js        # Fan coil units
│   ├── pumps.js           # Pump systems
│   └── lead-lag-helpers.js # Shared coordination logic
├── location-b/
│   └── ...
└── base/                   # Generic equipment templates
    └── ...
```

### Location Processors
Each location has its own independent processor that executes equipment logic:
- **Warren Processor** - Handles 4 AHUs with specialized controls
- **Huntington Processor** - Manages boilers, chillers, pumps, fan coils
- **Custom Processors** - Location-specific timing and equipment

## 🔧 4-Parameter Interface

All equipment logic functions use a standardized interface for consistency and flexibility:

### Function Signature
```javascript
async function equipmentControl(metricsInput, settingsInput, currentTempArgument, stateStorageInput) {
    // Equipment control logic
    return commandResults;
}
```

### Parameter 1: metricsInput
**Real-time sensor data from InfluxDB**
```javascript
const metricsInput = {
    // Temperature sensors
    Supply: 72.5,
    SpaceTemp: 68.2,
    Outdoor_Air: 45.3,
    Mixed_Air: 62.1,
    
    // Equipment status
    FanAmps: 2.4,
    PumpAmps: 1.8,
    
    // Valve positions
    HeatingValve: 45,
    CoolingValve: 12,
    
    // System data
    equipmentId: "AHU-001",
    location_id: "4",
    time: "2025-06-05T10:30:00Z"
}
```

### Parameter 2: settingsInput
**Equipment configuration and operational parameters**
```javascript
const settingsInput = {
    equipmentId: "AHU-001",
    locationId: "4",
    locationName: "Building A",
    equipmentType: "air-handler",
    
    // Control setpoints
    temperatureSetpoint: 72,
    heatingSetpoint: 70,
    coolingSetpoint: 74,
    
    // Operational limits
    fanMinSpeed: 20,
    fanMaxSpeed: 100,
    
    // Equipment-specific settings
    enabled: true,
    controlSource: "space" // or "supply"
}
```

### Parameter 3: currentTempArgument
**Primary control temperature (°F)**
- For boilers: Supply water temperature
- For air handlers: Space or supply air temperature
- For fan coils: Zone temperature
- Automatic fallback hierarchy if primary sensor fails

### Parameter 4: stateStorageInput
**Persistent control state for advanced algorithms**
```javascript
const stateStorageInput = {
    // PID controller states
    heatingPIDState: {
        integral: 0,
        previousError: 0,
        lastOutput: 0
    },
    coolingPIDState: {
        integral: 0,
        previousError: 0,
        lastOutput: 0
    },
    
    // Equipment operational state
    lastFanCycleTime: 1677123456789,
    fanCycleState: false,
    
    // Lead-lag coordination
    leadEquipment: "BOILER-001",
    switchoverTime: 3600000 // 1 hour
}
```

## 🌡️ Air Handler Example

Here's a simplified version of the Warren air handler logic demonstrating key concepts:

```javascript
async function airHandlerControl(metricsInput, settingsInput, currentTempArgument, stateStorageInput) {
    const equipmentId = settingsInput.equipmentId;
    const locationId = settingsInput.locationId;
    
    try {
        // 1. Equipment identification
        const ahuNumber = getAHUNumber(equipmentId);
        
        // 2. Temperature source selection
        const controlSource = getControlSource(equipmentId);
        let currentTemp = getCurrentTemperature(metricsInput, controlSource);
        
        // 3. Safety checks
        const outdoorTemp = parseTemperature(metricsInput.Outdoor_Air);
        const supplyTemp = parseTemperature(metricsInput.Supply);
        
        if (supplyTemp < 40) {
            return {
                heatingValvePosition: 100,
                coolingValvePosition: 0,
                fanEnabled: false,
                safetyTripped: "freezestat"
            };
        }
        
        // 4. Occupancy scheduling
        const isOccupied = checkOccupancy(ahuNumber);
        
        // 5. Setpoint calculation with OAR
        let setpoint = calculateOARSetpoint(outdoorTemp, controlSource, ahuNumber);
        if (!isOccupied) {
            setpoint += 3.5; // Unoccupied offset
        }
        
        // 6. PID control
        const heatingPID = pidController({
            input: currentTemp,
            setpoint: setpoint,
            pidParams: getHeatingPIDParams(ahuNumber),
            pidState: stateStorageInput.heatingPIDState
        });
        
        const coolingPID = pidController({
            input: currentTemp,
            setpoint: setpoint,
            pidParams: getCoolingPIDParams(ahuNumber),
            pidState: stateStorageInput.coolingPIDState
        });
        
        // 7. Special equipment handling
        let result = {
            heatingValvePosition: heatingPID.output,
            coolingValvePosition: coolingPID.output,
            fanEnabled: isOccupied,
            fanSpeed: "medium",
            temperatureSetpoint: setpoint,
            unitEnable: true,
            isOccupied: isOccupied
        };
        
        // AHU-2 has electric baseboard heating
        if (ahuNumber === 2) {
            result.heatingStage1Command = heatingPID.output > 30;
            result.heatingStage2Command = heatingPID.output > 75;
            
            // Reduce hydronic heating when electric heat active
            if (result.heatingStage1Command) {
                result.heatingValvePosition *= 0.5;
            }
        }
        
        return result;
        
    } catch (error) {
        console.error(`Air handler control error: ${error}`);
        return getFailsafeOutput();
    }
}

// Export compatibility functions
module.exports = airHandlerControl;
module.exports.default = airHandlerControl;
module.exports.processEquipment = airHandlerControl;
```

## 🔥 Key Control Algorithms

### 1. Outdoor Air Reset (OAR)
Automatically adjusts setpoints based on outdoor temperature:

```javascript
function calculateOARSetpoint(outdoorTemp, controlSource, equipmentType) {
    const minOAT = 32;
    const maxOAT = 74;
    
    let maxSetpoint, minSetpoint;
    
    if (controlSource === "supply") {
        maxSetpoint = 76;  // Winter setpoint
        minSetpoint = 65;  // Summer setpoint
    } else {
        maxSetpoint = 76;  // Winter space temp
        minSetpoint = 71;  // Summer space temp
    }
    
    if (outdoorTemp <= minOAT) return maxSetpoint;
    if (outdoorTemp >= maxOAT) return minSetpoint;
    
    const ratio = (outdoorTemp - minOAT) / (maxOAT - minOAT);
    return maxSetpoint - ratio * (maxSetpoint - minSetpoint);
}
```

### 2. PID Control Integration
Precise temperature control with tunable parameters:

```javascript
const pidSettings = {
    heating: {
        kp: 2.8,           // Proportional gain
        ki: 0.14,          // Integral gain  
        kd: 0.02,          // Derivative gain
        outputMin: 0,
        outputMax: 100,
        reverseActing: true // Reverse acting for heating
    },
    cooling: {
        kp: 1.7,
        ki: 0.15,
        kd: 0.01,
        outputMin: 0,
        outputMax: 100,
        reverseActing: false // Direct acting for cooling
    }
};
```

### 3. Occupancy Scheduling
Automatic scheduling with energy savings:

```javascript
function checkOccupancy(equipmentId) {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const currentTimeMinutes = hour * 60 + minute;
    
    const occupiedStart = 5 * 60 + 30;  // 5:30 AM
    const occupiedEnd = 20 * 60 + 30;   // 8:30 PM
    
    // Some equipment always occupied (pools, critical areas)
    if (isAlwaysOccupied(equipmentId)) {
        return true;
    }
    
    return currentTimeMinutes >= occupiedStart && 
           currentTimeMinutes < occupiedEnd;
}
```

### 4. Lead-Lag Coordination
Automatic equipment rotation for wear equalization:

```javascript
function updateLeadLag(equipmentGroup, stateStorage) {
    const currentTime = Date.now();
    const switchInterval = 7 * 24 * 60 * 60 * 1000; // 7 days
    
    if (!stateStorage.lastSwitchTime || 
        currentTime - stateStorage.lastSwitchTime > switchInterval) {
        
        // Switch lead equipment
        const currentLead = stateStorage.leadEquipment;
        const newLead = getNextLeadEquipment(equipmentGroup, currentLead);
        
        stateStorage.leadEquipment = newLead;
        stateStorage.lastSwitchTime = currentTime;
        
        return {
            switched: true,
            newLead: newLead,
            reason: "scheduled_rotation"
        };
    }
    
    return { switched: false };
}
```

## 🏢 Equipment Type Examples

### Boiler Control Logic
```javascript
async function boilerControl(metricsInput, settingsInput, currentTempArgument, stateStorageInput) {
    const supplyTemp = currentTempArgument; // Water supply temperature
    const setpoint = calculateBoilerSetpoint(metricsInput.Outdoor_Air);
    
    // Lead-lag coordination
    const leadLagStatus = updateLeadLag(settingsInput.boilerGroup, stateStorageInput);
    const isLead = stateStorageInput.leadEquipment === settingsInput.equipmentId;
    
    // Safety checks
    if (supplyTemp > 200) {
        return {
            unitEnable: false,
            firing: false,
            safetyShutoff: true,
            safetyReason: "high_temperature"
        };
    }
    
    // PID control for water temperature
    const pidOutput = pidController({
        input: supplyTemp,
        setpoint: setpoint,
        pidParams: getBoilerPIDParams(),
        pidState: stateStorageInput.boilerPIDState
    });
    
    return {
        unitEnable: true,
        firing: pidOutput.output > 10,
        waterTempSetpoint: setpoint,
        isLead: isLead,
        leadLagGroupId: settingsInput.boilerGroup,
        firingRate: Math.round(pidOutput.output)
    };
}
```

### Fan Coil Control Logic
```javascript
async function fanCoilControl(metricsInput, settingsInput, currentTempArgument, stateStorageInput) {
    const zoneTemp = currentTempArgument;
    const setpoint = settingsInput.temperatureSetpoint || 72;
    
    // Heating/cooling mode selection
    const error = setpoint - zoneTemp;
    const deadband = 1.0; // °F
    
    let heatingValvePosition = 0;
    let coolingValvePosition = 0;
    
    if (error > deadband) {
        // Heating mode
        const heatingPID = pidController({
            input: zoneTemp,
            setpoint: setpoint,
            pidParams: getFanCoilHeatingPID(),
            pidState: stateStorageInput.heatingPIDState
        });
        heatingValvePosition = heatingPID.output;
        
    } else if (error < -deadband) {
        // Cooling mode
        const coolingPID = pidController({
            input: zoneTemp,
            setpoint: setpoint,
            pidParams: getFanCoilCoolingPID(),
            pidState: stateStorageInput.coolingPIDState
        });
        coolingValvePosition = coolingPID.output;
    }
    
    // Fan speed based on demand
    const maxDemand = Math.max(heatingValvePosition, coolingValvePosition);
    const fanSpeed = Math.max(30, Math.min(100, 30 + maxDemand * 0.7));
    
    return {
        fanEnabled: true,
        fanSpeed: Math.round(fanSpeed),
        heatingValvePosition: Math.round(heatingValvePosition),
        coolingValvePosition: Math.round(coolingValvePosition),
        temperatureSetpoint: setpoint
    };
}
```

## 🔄 Return Value Format

Equipment logic must return command objects that will be written to the NeuralControlCommands database:

### Standard Return Object
```javascript
return {
    // Equipment enable/disable
    unitEnable: true,
    fanEnabled: true,
    
    // Temperature control
    temperatureSetpoint: 72,
    supplyAirTempSetpoint: 65,
    waterTempSetpoint: 180,
    
    // Valve positions (0-100%)
    heatingValvePosition: 45,
    coolingValvePosition: 12,
    
    // Fan control
    fanSpeed: 75,
    
    // Lead-lag coordination
    isLead: true,
    leadLagGroupId: "boiler-group-1",
    
    // Safety and status
    safetyTripped: false,
    isOccupied: true,
    
    // Equipment-specific commands
    firing: true,           // Boilers
    compressorStage: 2,     // Chillers
    pumpSpeed: 85,          // Pumps
    
    // Custom metadata
    controlSource: "space",
    temperatureSource: "space"
};
```

### Error Handling
Always include error handling with failsafe outputs:

```javascript
try {
    // Equipment control logic
    return normalOperation();
    
} catch (error) {
    console.error(`Equipment ${equipmentId} error: ${error}`);
    
    // Return safe operating state
    return {
        unitEnable: false,
        fanEnabled: false,
        heatingValvePosition: 0,
        coolingValvePosition: 0,
        fanSpeed: 0,
        temperatureSetpoint: 72,
        safetyTripped: true,
        errorMessage: error.message
    };
}
```

## 🛠️ Development Best Practices

### 1. Function Exports
Ensure compatibility with different calling patterns:

```javascript
// Main function
async function equipmentControl(metricsInput, settingsInput, currentTempArgument, stateStorageInput) {
    // Control logic here
}

// Multiple export patterns for compatibility
module.exports = equipmentControl;
module.exports.default = equipmentControl;
module.exports.processEquipment = equipmentControl;
module.exports.runLogic = equipmentControl;
```

### 2. Safe Value Parsing
Always validate sensor inputs with fallbacks:

```javascript
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

// Usage
const outdoorTemp = parseSafeNumber(metricsInput.Outdoor_Air, 65);
const supplyTemp = parseSafeNumber(metricsInput.Supply, 55);
```

### 3. State Management
Initialize state storage properly:

```javascript
// Initialize PID states
if (!stateStorageInput.heatingPIDState) {
    stateStorageInput.heatingPIDState = {
        integral: 0,
        previousError: 0,
        lastOutput: 0
    };
}

// Use state in PID controller
const pidOutput = pidController({
    input: currentTemp,
    setpoint: setpoint,
    pidParams: pidSettings,
    pidState: stateStorageInput.heatingPIDState
});
```

### 4. Equipment Identification
Support multiple identification methods:

```javascript
function getEquipmentNumber(equipmentId) {
    // Direct mapping for known IDs
    const equipmentMap = {
        "2JFzwQkC1XwJhUvm09rE": 1,
        "upkoHEsD5zVaiLFhGfs5": 2,
        // ... more mappings
    };
    
    if (equipmentMap[equipmentId]) {
        return equipmentMap[equipmentId];
    }
    
    // Fallback to pattern matching
    if (equipmentId.includes("AHU-1")) return 1;
    if (equipmentId.includes("BOILER-2")) return 2;
    
    // Extract numbers from ID
    const match = equipmentId.match(/(\d+)/);
    return match ? parseInt(match[0], 10) : 1;
}
```

## 🧪 Testing Equipment Logic

### Local Testing
Test equipment logic before deployment:

```javascript
// test-air-handler.js
const airHandlerControl = require('./air-handler.js');

async function testAirHandler() {
    const mockMetrics = {
        Supply: 72,
        SpaceTemp: 68,
        Outdoor_Air: 45,
        FanAmps: 2.1
    };
    
    const mockSettings = {
        equipmentId: "AHU-001",
        locationId: "4",
        temperatureSetpoint: 72
    };
    
    const result = await airHandlerControl(
        mockMetrics,
        mockSettings,
        68, // currentTemp
        {} // stateStorage
    );
    
    console.log('Control result:', result);
}

testAirHandler();
```

### Validation Checklist
- ✅ Function exports properly
- ✅ Handles missing sensor data gracefully
- ✅ Returns valid command object
- ✅ Includes error handling
- ✅ State storage initialized
- ✅ Safety checks implemented
- ✅ PID parameters tuned appropriately

## 📚 Advanced Topics

### Integration with Location Processors
Equipment logic is called by location processors with specific timing:

```javascript
// In warren-processor.ts
const equipmentIntervals = {
    'air-handler': 30000,    // 30 seconds for PID control
    'boiler': 120000,        // 2 minutes for boiler control
    'chiller': 300000,       // 5 minutes for chiller control
    'fan-coil': 30000,       // 30 seconds for zone control
    'pumps': 30000,          // 30 seconds for pump control
};
```

### Custom Equipment Types
Create new equipment types by:

1. **Adding equipment logic file** - `custom-equipment.js`
2. **Updating location processor** - Add equipment type to processor
3. **Updating PM2 config** - Restart location processor
4. **Testing thoroughly** - Validate in development environment

### Performance Optimization
- Keep logic execution under 100ms
- Minimize database operations (handled by factory)
- Use efficient algorithms for calculations
- Cache frequently used values
- Avoid blocking operations

---

**Next Steps:**
- Review existing equipment files in your location
- Modify PID parameters for your specific equipment
- Test logic changes in development environment
- Deploy via location processor restart
