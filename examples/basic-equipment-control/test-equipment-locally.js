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
