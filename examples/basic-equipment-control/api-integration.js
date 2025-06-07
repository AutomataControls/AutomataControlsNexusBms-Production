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
