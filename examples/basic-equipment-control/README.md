# Basic Equipment Control Example

This example demonstrates how to create and test basic equipment control logic using the Automata Controls Nexus BMS 4-parameter interface.

## 📁 File Structure

```
examples/basic-equipment-control/
├── README.md                    # This file
├── simple-boiler.js            # Basic boiler control logic
├── simple-pump.js              # Basic pump control logic
├── test-equipment-locally.js   # Local testing script
├── api-integration.js          # API integration example
└── package.json                # Dependencies for examples
```

## 🎯 4-Parameter Interface Overview

All equipment logic functions follow this standardized interface:

```javascript
function equipmentControl(metricsInput, settingsInput, currentTempArgument, stateStorageInput) {
  // Returns: Equipment control commands object
}
```

### **Parameter Breakdown:**
1. **`metricsInput`** - Real-time equipment data from InfluxDB
2. **`settingsInput`** - Equipment configuration and setpoints  
3. **`currentTempArgument`** - Control temperature (equipment-specific source)
4. **`stateStorageInput`** - PID state and persistent control data

---

## ⚙️ Simple Boiler Example

**File: `simple-boiler.js`**

```javascript
"use strict";

/**
 * Simple Boiler Control Logic
 * Demonstrates basic temperature control with safety features
 * 4-Parameter Interface: ✓
 */

function simpleBoilerControl(metricsInput, settingsInput, currentTempArgument, stateStorageInput) {
  console.log('[Simple Boiler] Starting control logic');
  
  // STEP 1: Input validation
  if (!metricsInput || !settingsInput) {
    console.warn('[Simple Boiler] Missing required inputs');
    return { 
      unitEnable: false,
      error: 'Missing inputs' 
    };
  }

  // STEP 2: Extract metrics with fallbacks
  const supplyTemp = parseFloat(metricsInput.H20Supply || 
                               metricsInput.SupplyTemp || 
                               metricsInput.WaterTemp || 0);
  
  const outdoorTemp = parseFloat(currentTempArgument || 
                                metricsInput.Outdoor_Air || 
                                metricsInput.OutdoorTemp || 50);

  // STEP 3: Get setpoint (UI override or default)
  const targetTemp = parseFloat(settingsInput.temperatureSetpoint || 
                               settingsInput.waterTemperatureSetpoint || 140);

  console.log(`[Simple Boiler] Temps: Supply=${supplyTemp}°F, Target=${targetTemp}°F, Outdoor=${outdoorTemp}°F`);

  // STEP 4: Safety checks
  if (supplyTemp > 180) {
    console.warn('[Simple Boiler] HIGH TEMPERATURE - Safety shutdown');
    return {
      unitEnable: false,
      firing: false,
      safetyShutoff: true,
      safetyReason: 'High supply temperature',
      supplyTemp: supplyTemp
    };
  }

  // STEP 5: Control logic
  const tempError = targetTemp - supplyTemp;
  const shouldFire = tempError > 3.0; // 3°F deadband
  const shouldEnable = outdoorTemp < 65; // Seasonal enable

  // STEP 6: Return control commands
  return {
    unitEnable: shouldEnable,
    firing: shouldFire && shouldEnable,
    waterTempSetpoint: targetTemp,
    temperatureSetpoint: targetTemp,
    supplyTemp: supplyTemp,
    outdoorTemp: outdoorTemp,
    tempError: tempError,
    controlMode: shouldFire ? 'heating' : 'satisfied'
  };
}

// Export patterns for compatibility
module.exports = { simpleBoilerControl };
module.exports.default = simpleBoilerControl;
module.exports.processEquipment = simpleBoilerControl;
```

---

## 💨 Simple Pump Example

**File: `simple-pump.js`**

```javascript
"use strict";

/**
 * Simple Pump Control Logic
 * Demonstrates basic enable/disable control with speed modulation
 * 4-Parameter Interface: ✓
 */

function simplePumpControl(metricsInput, settingsInput, currentTempArgument, stateStorageInput) {
  console.log('[Simple Pump] Starting control logic');
  
  // STEP 1: Input validation
  if (!metricsInput || !settingsInput) {
    console.warn('[Simple Pump] Missing required inputs');
    return { 
      pumpEnable: false,
      error: 'Missing inputs' 
    };
  }

  // STEP 2: Extract metrics
  const systemPressure = parseFloat(metricsInput.SystemPressure || 
                                   metricsInput.Pressure || 15);
  
  const flowRate = parseFloat(metricsInput.FlowRate || 
                             metricsInput.Flow || 0);
  
  const pumpAmps = parseFloat(metricsInput.PumpAmps || 
                             metricsInput.Amps || 0);

  // STEP 3: Get control settings
  const enablePump = settingsInput.pumpEnable !== false; // Default enabled
  const targetPressure = parseFloat(settingsInput.targetPressure || 20);
  const minSpeed = parseFloat(settingsInput.minSpeed || 30);
  const maxSpeed = parseFloat(settingsInput.maxSpeed || 100);

  console.log(`[Simple Pump] Pressure=${systemPressure} PSI, Target=${targetPressure} PSI, Flow=${flowRate} GPM`);

  // STEP 4: Safety checks
  if (pumpAmps > 10) { // Overload protection
    console.warn('[Simple Pump] HIGH AMPERAGE - Overload protection');
    return {
      pumpEnable: false,
      pumpSpeed: 0,
      overloadProtection: true,
      protectionReason: 'High amperage detected',
      currentAmps: pumpAmps
    };
  }

  // STEP 5: Speed control based on pressure
  let pumpSpeed = minSpeed;
  if (enablePump) {
    const pressureError = targetPressure - systemPressure;
    
    if (pressureError > 2) {
      // Need more pressure - increase speed
      pumpSpeed = Math.min(maxSpeed, minSpeed + (pressureError * 5));
    } else if (pressureError < -2) {
      // Too much pressure - decrease speed
      pumpSpeed = Math.max(minSpeed, maxSpeed + (pressureError * 5));
    } else {
      // Maintain current speed (within deadband)
      pumpSpeed = Math.max(minSpeed, Math.min(maxSpeed, 
        stateStorageInput.lastPumpSpeed || minSpeed));
    }
  }

  // Store speed for next cycle
  if (!stateStorageInput) stateStorageInput = {};
  stateStorageInput.lastPumpSpeed = pumpSpeed;

  // STEP 6: Return control commands
  return {
    pumpEnable: enablePump,
    pumpSpeed: Math.round(pumpSpeed),
    systemPressure: systemPressure,
    targetPressure: targetPressure,
    flowRate: flowRate,
    currentAmps: pumpAmps,
    controlMode: enablePump ? 'automatic' : 'disabled'
  };
}

// Export patterns for compatibility
module.exports = { simplePumpControl };
module.exports.default = simplePumpControl;
module.exports.processEquipment = simplePumpControl;
```

---

## 🧪 Local Testing Script

**File: `test-equipment-locally.js`**

```javascript
"use strict";

const { simpleBoilerControl } = require('./simple-boiler');
const { simplePumpControl } = require('./simple-pump');

/**
 * Local Equipment Logic Testing
 * Test your equipment functions before deployment
 */

function testEquipmentLogic() {
  console.log('🧪 Starting Equipment Logic Tests\n');

  // Test 1: Simple Boiler Control
  console.log('=== Testing Simple Boiler ===');
  
  const boilerMetrics = {
    H20Supply: 135,           // Supply temperature
    Outdoor_Air: 45,          // Outdoor temperature
    equipmentId: 'TEST_BOILER_001'
  };
  
  const boilerSettings = {
    equipmentId: 'TEST_BOILER_001',
    temperatureSetpoint: 145,  // Target temperature
    locationId: '1'
  };
  
  const boilerResult = simpleBoilerControl(
    boilerMetrics,
    boilerSettings, 
    45, // currentTempArgument (outdoor temp)
    {}  // empty state storage
  );
  
  console.log('Boiler Result:', JSON.stringify(boilerResult, null, 2));
  console.log(`Expected: Boiler should fire (temp error: ${145 - 135}°F)\n`);

  // Test 2: Simple Pump Control
  console.log('=== Testing Simple Pump ===');
  
  const pumpMetrics = {
    SystemPressure: 18,       // Current pressure
    FlowRate: 85,            // Current flow
    PumpAmps: 4.2,           // Current amperage
    equipmentId: 'TEST_PUMP_001'
  };
  
  const pumpSettings = {
    equipmentId: 'TEST_PUMP_001',
    pumpEnable: true,
    targetPressure: 20,       // Target pressure
    minSpeed: 30,
    maxSpeed: 100,
    locationId: '1'
  };
  
  const pumpResult = simplePumpControl(
    pumpMetrics,
    pumpSettings,
    null, // not used for pumps
    {}    // empty state storage
  );
  
  console.log('Pump Result:', JSON.stringify(pumpResult, null, 2));
  console.log(`Expected: Pump should increase speed (pressure error: ${20 - 18} PSI)\n`);

  // Test 3: Safety Conditions
  console.log('=== Testing Safety Conditions ===');
  
  const dangerousBoilerMetrics = {
    ...boilerMetrics,
    H20Supply: 185  // Dangerous temperature
  };
  
  const safetyResult = simpleBoilerControl(
    dangerousBoilerMetrics,
    boilerSettings,
    45,
    {}
  );
  
  console.log('Safety Result:', JSON.stringify(safetyResult, null, 2));
  console.log('Expected: Safety shutdown should be active\n');

  // Test 4: Invalid Inputs
  console.log('=== Testing Error Handling ===');
  
  const errorResult = simpleBoilerControl(
    null, // Missing metrics
    boilerSettings,
    45,
    {}
  );
  
  console.log('Error Result:', JSON.stringify(errorResult, null, 2));
  console.log('Expected: Should return error with unit disabled\n');

  console.log('✅ All tests completed!');
}

// Helper function to simulate live metrics
function simulateLiveMetrics() {
  console.log('📊 Simulating Live Equipment Data\n');
  
  // Simulate changing conditions over time
  for (let minute = 0; minute < 10; minute++) {
    console.log(`--- Minute ${minute} ---`);
    
    // Simulate boiler heating up
    const supplyTemp = 130 + (minute * 2); // Temperature rising
    const outdoorTemp = 40 + Math.random() * 10; // Variable outdoor temp
    
    const metrics = {
      H20Supply: supplyTemp,
      Outdoor_Air: outdoorTemp,
      equipmentId: 'SIM_BOILER_001'
    };
    
    const settings = {
      equipmentId: 'SIM_BOILER_001',
      temperatureSetpoint: 145,
      locationId: '1'
    };
    
    const result = simpleBoilerControl(metrics, settings, outdoorTemp, {});
    
    console.log(`Supply: ${supplyTemp}°F, Firing: ${result.firing}, Error: ${result.tempError.toFixed(1)}°F`);
  }
  
  console.log('\n🎯 Simulation complete - observe how control responds to changing conditions');
}

// Run tests
if (require.main === module) {
  testEquipmentLogic();
  console.log('\n' + '='.repeat(50) + '\n');
  simulateLiveMetrics();
}

module.exports = {
  testEquipmentLogic,
  simulateLiveMetrics
};
```

---

## 🔌 API Integration Example

**File: `api-integration.js`**

```javascript
"use strict";

/**
 * API Integration Example
 * Shows how to send equipment commands via the API
 */

class EquipmentAPIClient {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  /**
   * Send equipment command via API
   */
  async sendEquipmentCommand(equipmentId, command, value, userId = 'system') {
    try {
      const response = await fetch(`${this.baseUrl}/api/equipment/${equipmentId}/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          command: command,
          value: value,
          userId: userId,
          timestamp: Date.now()
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`✅ Command sent: ${command} = ${value} for equipment ${equipmentId}`);
      return result;

    } catch (error) {
      console.error(`❌ Failed to send command: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get equipment status
   */
  async getEquipmentStatus(equipmentId) {
    try {
      const response = await fetch(`${this.baseUrl}/api/equipment/${equipmentId}/state`);
      
      if (!response.ok) {
        throw new Error(`Failed to get status: ${response.status}`);
      }

      return await response.json();

    } catch (error) {
      console.error(`❌ Failed to get status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Monitor job status
   */
  async monitorJobStatus(equipmentId, jobId) {
    try {
      const response = await fetch(`${this.baseUrl}/api/equipment/${equipmentId}/status/${jobId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to get job status: ${response.status}`);
      }

      return await response.json();

    } catch (error) {
      console.error(`❌ Failed to get job status: ${error.message}`);
      throw error;
    }
  }
}

/**
 * Example usage of the API client
 */
async function demonstrateAPIUsage() {
  console.log('🔌 Demonstrating API Integration\n');

  const client = new EquipmentAPIClient();
  const equipmentId = 'DEMO_BOILER_001';

  try {
    // Example 1: Set temperature setpoint
    console.log('--- Setting Temperature Setpoint ---');
    const setpointResult = await client.sendEquipmentCommand(
      equipmentId,
      'setpoint',
      75,
      'demo-user'
    );
    console.log('Result:', setpointResult);

    // Example 2: Enable equipment
    console.log('\n--- Enabling Equipment ---');
    const enableResult = await client.sendEquipmentCommand(
      equipmentId,
      'enable',
      true,
      'demo-user'
    );
    console.log('Result:', enableResult);

    // Example 3: Get current status
    console.log('\n--- Getting Equipment Status ---');
    const status = await client.getEquipmentStatus(equipmentId);
    console.log('Status:', status);

    // Example 4: Monitor job if job ID provided
    if (enableResult.jobId) {
      console.log('\n--- Monitoring Job Status ---');
      const jobStatus = await client.monitorJobStatus(equipmentId, enableResult.jobId);
      console.log('Job Status:', jobStatus);
    }

  } catch (error) {
    console.error('API demonstration failed:', error.message);
  }
}

/**
 * Batch equipment control example
 */
async function batchEquipmentControl() {
  console.log('📦 Demonstrating Batch Equipment Control\n');

  const client = new EquipmentAPIClient();
  
  const equipmentList = [
    { id: 'BOILER_001', setpoint: 145 },
    { id: 'BOILER_002', setpoint: 140 },
    { id: 'PUMP_001', enable: true },
    { id: 'PUMP_002', enable: true }
  ];

  const results = [];

  for (const equipment of equipmentList) {
    try {
      if (equipment.setpoint) {
        const result = await client.sendEquipmentCommand(
          equipment.id,
          'setpoint',
          equipment.setpoint,
          'batch-user'
        );
        results.push({ equipmentId: equipment.id, success: true, result });
      }

      if (equipment.enable !== undefined) {
        const result = await client.sendEquipmentCommand(
          equipment.id,
          'enable',
          equipment.enable,
          'batch-user'
        );
        results.push({ equipmentId: equipment.id, success: true, result });
      }

      // Small delay between commands
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      results.push({ 
        equipmentId: equipment.id, 
        success: false, 
        error: error.message 
      });
    }
  }

  console.log('Batch Results:');
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.equipmentId}: ${result.success ? 'Success' : result.error}`);
  });
}

// Run demonstrations
if (require.main === module) {
  demonstrateAPIUsage()
    .then(() => {
      console.log('\n' + '='.repeat(50) + '\n');
      return batchEquipmentControl();
    })
    .then(() => {
      console.log('\n🎯 API integration examples completed');
    })
    .catch(error => {
      console.error('Example failed:', error);
    });
}

module.exports = {
  EquipmentAPIClient,
  demonstrateAPIUsage,
  batchEquipmentControl
};
```

---

## 📦 Package Dependencies

**File: `package.json`**

```json
{
  "name": "basic-equipment-control-example",
  "version": "1.0.0",
  "description": "Basic equipment control examples for Automata Controls Nexus BMS",
  "main": "test-equipment-locally.js",
  "scripts": {
    "test": "node test-equipment-locally.js",
    "demo-api": "node api-integration.js",
    "test-boiler": "node -e \"require('./simple-boiler.js'); console.log('Boiler logic loaded successfully')\"",
    "test-pump": "node -e \"require('./simple-pump.js'); console.log('Pump logic loaded successfully')\""
  },
  "dependencies": {
    "node-fetch": "^2.7.0"
  },
  "keywords": [
    "hvac",
    "building-management",
    "equipment-control",
    "iot",
    "automation"
  ],
  "author": "Automata Controls",
  "license": "MIT"
}
```

---

## 🚀 Getting Started

### **1. Install Dependencies**
```bash
cd examples/basic-equipment-control
npm install
```

### **2. Test Equipment Logic Locally**
```bash
npm test
```

### **3. Test Individual Components**
```bash
npm run test-boiler
npm run test-pump
```

### **4. Test API Integration** (requires running application)
```bash
npm run demo-api
```

---

## 🎯 Key Learning Points

### **Equipment Logic Best Practices:**
- ✅ **Always validate inputs** - Check for null/undefined values
- ✅ **Implement safety checks** - Temperature limits, overload protection
- ✅ **Use fallback values** - Provide sensible defaults
- ✅ **Clear logging** - Help with debugging and monitoring
- ✅ **Consistent exports** - Support multiple function discovery patterns

### **Control Algorithm Principles:**
- 🌡️ **Deadband control** - Prevent rapid cycling
- ⚡ **Safety first** - Emergency shutdowns take priority
- 📊 **State storage** - Maintain control state between cycles
- 🔄 **Graceful degradation** - Continue operating with partial data

### **API Integration Patterns:**
- 🔌 **RESTful commands** - Standard HTTP methods
- 📝 **JSON payloads** - Structured command data
- ⏱️ **Job monitoring** - Track command execution
- 🔄 **Error handling** - Robust error management

---

## 📚 Next Steps

1. **Modify the examples** for your specific equipment types
2. **Add more complex algorithms** like PID control or lead-lag coordination
3. **Test with real equipment data** from your InfluxDB
4. **Create location-specific variations** based on your facility needs
5. **Explore the advanced examples** in other directories

For more sophisticated control examples, see:
- **Advanced Equipment Control** - PID controllers and staging logic
- **Custom Location Setup** - Complete location processor examples  
- **API Integration** - Advanced API usage and monitoring

---

*This example provides a foundation for understanding the Automata Controls Nexus BMS equipment control system. Build upon these patterns to create sophisticated building management solutions.*
