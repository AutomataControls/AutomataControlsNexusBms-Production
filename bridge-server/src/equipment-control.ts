import { MQTTClient } from './mqtt-client';

interface EquipmentControl {
  equipmentId: string;
  command: string;
  value: any;
}

export async function handleEquipmentControl(
  data: EquipmentControl,
  mqttClient: MQTTClient
): Promise<void> {
  try {
    const { equipmentId, command, value } = data;
    
    // Validate control data
    if (!equipmentId || !command) {
      throw new Error('Missing required control parameters');
    }

    // Create MQTT message
    const message = {
      command,
      value,
      timestamp: new Date().toISOString()
    };

    // Publish to equipment control topic
    await mqttClient.publish(`equipment/${equipmentId}/control`, message);
  } catch (error) {
    console.error('Error handling equipment control:', error);
    throw error;
  }
} 