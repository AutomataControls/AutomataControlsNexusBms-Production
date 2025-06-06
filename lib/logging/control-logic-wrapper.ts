// @ts-nocheck
// lib/logging/control-logic-wrapper.ts
import { 
  runEquipmentLogic as originalRunLogic,
  runAllEquipmentLogic as originalRunAll,
  fetchMetricsFromInfluxDB as originalFetchMetrics, 
  fetchControlValuesFromInfluxDB as originalFetchControl,
  fetchMetricsFromFirebase as originalFetchFirebase, 
  equipmentQueue
} from '../control-logic';

import {
  recordProcessingStart,
  recordProcessingEnd,
  recordQueueAdd,
  recordDbOperation
} from './control-logic-monitor';

// Wrapped version of runEquipmentLogic
export async function runEquipmentLogic(equipmentId: string) {
  let startTime = 0;
  let equipmentType = 'unknown';
  let locationId = 'unknown';
  
  try {
    // Try to get equipment details first
    // This duplicates some logic from the original but necessary for monitoring
    const { getDoc, doc } = await import("firebase/firestore");
    const { db } = await import("../control-logic");
    
    const equipmentRef = doc(db, "equipment", equipmentId);
    const equipmentSnap = await getDoc(equipmentRef);
    
    if (equipmentSnap.exists()) {
      const equipment = equipmentSnap.data();
      equipmentType = equipment.type || equipment.equipmentType || 'unknown';
      locationId = equipment.locationId || 'unknown';
    }
    
    // Start monitoring
    startTime = recordProcessingStart(equipmentId, equipmentType, locationId);
    
    // Call the original function
    const result = await originalRunLogic(equipmentId);
    
    // Record successful completion
    recordProcessingEnd(equipmentId, startTime, true);
    
    return result;
  } catch (error) {
    // Record error
    recordProcessingEnd(equipmentId, startTime, false, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

// Wrapped version of runAllEquipmentLogic
export async function runAllEquipmentLogic() {
  try {
    // Call original function
    const result = await originalRunAll();
    
    // Monitor equipment that was queued
    if (result.results && Array.isArray(result.results)) {
      for (const equipment of result.results) {
        if (equipment.status === 'queued') {
          recordQueueAdd(equipment.equipmentId);
        }
      }
    }
    
    return result;
  } catch (error) {
    console.error("Error in runAllEquipmentLogic:", error);
    throw error;
  }
}

// Wrapped version of fetchMetricsFromInfluxDB
export async function fetchMetricsFromInfluxDB(locationId: string, equipmentId: string) {
  const startTime = Date.now();
  try {
    const result = await originalFetchMetrics(locationId, equipmentId);
    const duration = Date.now() - startTime;
    recordDbOperation('influx', `fetchMetrics:${equipmentId}`, duration);
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    recordDbOperation('influx', `fetchMetrics:${equipmentId} (error)`, duration);
    throw error;
  }
}

// Wrapped version of fetchControlValuesFromInfluxDB
export async function fetchControlValuesFromInfluxDB(locationId: string, equipmentId: string) {
  const startTime = Date.now();
  try {
    const result = await originalFetchControl(locationId, equipmentId);
    const duration = Date.now() - startTime;
    recordDbOperation('influx', `fetchControl:${equipmentId}`, duration);
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    recordDbOperation('influx', `fetchControl:${equipmentId} (error)`, duration);
    throw error;
  }
}

// Wrapped version of fetchMetricsFromFirebase
export async function fetchMetricsFromFirebase(locationId: string, equipmentId: string) {
  const startTime = Date.now();
  try {
    const result = await originalFetchFirebase(locationId, equipmentId);
    const duration = Date.now() - startTime;
    recordDbOperation('firebase', `fetchMetrics:${equipmentId}`, duration);
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    recordDbOperation('firebase', `fetchMetrics:${equipmentId} (error)`, duration);
    throw error;
  }
}

// Re-export other functions and variables from the original module
export * from '../control-logic';
