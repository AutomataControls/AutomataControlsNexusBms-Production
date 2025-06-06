// @ts-nocheck
// lib/equipment-logic/locations/huntington/lead-lag-helpers.ts
import { logLocationEquipment } from "@/lib/logging/location-logger";

// Helper to safely parse numbers
function parseSafeNumber(value: any, defaultValue: number): number {
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

// Huntington equipment groups - based on the Firestore screenshot
const HUNTINGTON_EQUIPMENT_GROUPS = {
  "HuntingtonHeritageComfortBoilers": {
    id: "HuntingtonHeritageComfortBoilers", 
    name: "Huntington Heritage Comfort Boilers",
    equipmentIds: [
      "ZLYR6YveSmCEMqtBSy3e", // From the logs - this is a Huntington boiler
      "ZLb2FhwIlSmxBoIlEr2R", // From the logs - this might be another Huntington boiler
    ],
    leadEquipmentId: "ZLYR6YveSmCEMqtBSy3e", // Default lead from logs
    autoFailover: true,
    useLeadLag: true,
    changeoverIntervalDays: 7, // Weekly rotation
    lastChangeoverTime: Date.now() - (7 * 24 * 60 * 60 * 1000), // 1 week ago
    lastFailoverTime: 0
  },
  
  "HuntingtonHeritageChillerPumps": {
    id: "HuntingtonHeritageChillerPumps",
    name: "Huntington Heritage Chiller Pumps", 
    equipmentIds: [
      "RJLaOk4UssyePSA1qqT8", // From Firestore screenshot
      "wGvf15Bf6xaLISwhRc7xO", // From Firestore screenshot
    ],
    leadEquipmentId: "RJLaOk4UssyePSA1qqT8", // From Firestore screenshot
    autoFailover: true,
    useLeadLag: true,
    changeoverIntervalDays: 7,
    lastChangeoverTime: 1748012388434, // From Firestore screenshot
    lastFailoverTime: 0
  },

  "HuntingtonHeritageHeatingPumps": {
    id: "HuntingtonHeritageHeatingPumps",
    name: "Huntington Heritage Heating Pumps", 
    equipmentIds: [
      "GUI1SxcedsLEhqbD0G2p",   // HW Pump 1
      "oh5Bz2zzIcuT9lFoogvi",   // HW Pump 2
    ],
    leadEquipmentId: "GUI1SxcedsLEhqbD0G2p", // Default lead
    autoFailover: true,
    useLeadLag: true,
    changeoverIntervalDays: 7,
    lastChangeoverTime: Date.now() - (7 * 24 * 60 * 60 * 1000), // 1 week ago
    lastFailoverTime: 0
  }
};

interface HuntingtonEquipmentGroup {
  id: string;
  name: string;
  equipmentIds: string[];
  leadEquipmentId: string;
  autoFailover: boolean;
  useLeadLag: boolean;
  changeoverIntervalDays: number;
  lastChangeoverTime: number;
  lastFailoverTime: number;
}

interface HuntingtonLeadLagStatus {
  isLead: boolean;
  shouldRun: boolean;
  reason: string;
  groupId: string | null;
  leadEquipmentId: string | null;
  lagEquipmentIds: string[];
}

/**
 * Get Huntington equipment group information
 */
export function getHuntingtonEquipmentGroup(equipmentId: string): HuntingtonEquipmentGroup | null {
  logLocationEquipment("4", equipmentId, "boiler", "Checking Huntington equipment groups");
  
  // Check if this equipment is in any Huntington group
  for (const [groupKey, group] of Object.entries(HUNTINGTON_EQUIPMENT_GROUPS)) {
    if (group.equipmentIds.includes(equipmentId)) {
      logLocationEquipment("4", equipmentId, "boiler", 
        `Found in Huntington group: ${group.name} (${group.equipmentIds.length} units)`);
      return group;
    }
  }
  
  logLocationEquipment("4", equipmentId, "boiler", "Not found in any Huntington equipment group");
  return null;
}

/**
 * Check Huntington boiler health based on InfluxDB metrics
 */
export async function checkHuntingtonBoilerHealth(equipmentId: string, metrics: any): Promise<boolean> {
  logLocationEquipment("4", equipmentId, "boiler", "Checking Huntington boiler health");
  
  try {
    // Check supply temperature - if too hot, boiler may be malfunctioning
    const supplyTemp = parseSafeNumber(metrics.H20Supply || metrics.H20Supply || metrics.Supply, 140);
    
    // Check if boiler is in emergency shutoff (over 170°F is dangerous)
    if (supplyTemp > 170) {
      logLocationEquipment("4", equipmentId, "boiler", 
        `UNHEALTHY: Supply temperature ${supplyTemp}°F exceeds safe limit (170°F)`);
      return false;
    }
    
    // Check for freezestat condition
    const freezestat = metrics.Freezestat || metrics.freezestat || false;
    if (freezestat === true || freezestat === "true" || freezestat === 1) {
      logLocationEquipment("4", equipmentId, "boiler", 
        `UNHEALTHY: Freezestat condition detected`);
      return false;
    }
    
    // Check for fault status
    const boilerStatus = metrics.boilerStatus || metrics.BoilerStatus || "normal";
    if (boilerStatus.toLowerCase().includes("fault") || boilerStatus.toLowerCase().includes("error")) {
      logLocationEquipment("4", equipmentId, "boiler", 
        `UNHEALTHY: Boiler status indicates fault: ${boilerStatus}`);
      return false;
    }
    
    // Check firing status - if it should be firing but isn't, may indicate problem
    const firing = parseSafeNumber(metrics.firing || metrics.Firing, 0);
    const outdoorTemp = parseSafeNumber(metrics.Outdoor_Air || metrics.outdoorTemperature, 50);
    
    // If it's cold outside but boiler isn't firing when it should be
    if (outdoorTemp < 60 && supplyTemp < 100 && firing === 0) {
      // This might indicate a problem, but give some tolerance
      logLocationEquipment("4", equipmentId, "boiler", 
        `WARNING: Cold weather but boiler not firing (OAT: ${outdoorTemp}°F, Supply: ${supplyTemp}°F)`);
      // Don't mark as unhealthy yet, but this could be monitored
    }
    
    logLocationEquipment("4", equipmentId, "boiler", 
      `HEALTHY: Supply: ${supplyTemp}°F, Status: ${boilerStatus}, Firing: ${firing}`);
    return true;
    
  } catch (error: any) {
    logLocationEquipment("4", equipmentId, "boiler", 
      `Error checking boiler health: ${error.message} - defaulting to healthy`);
    return true; // Default to healthy if we can't determine
  }
}

/**
 * Determine Huntington lead-lag status for a specific boiler
 */
export async function getHuntingtonLeadLagStatus(
  equipmentId: string, 
  metrics: any,
  stateStorage: any
): Promise<HuntingtonLeadLagStatus> {
  
  logLocationEquipment("4", equipmentId, "boiler", "Determining Huntington lead-lag status");
  
  // Get the equipment group this equipment belongs to
  const group = getHuntingtonEquipmentGroup(equipmentId);
  
  if (!group) {
    // Not in a group - run independently
    logLocationEquipment("4", equipmentId, "boiler", "Not in Huntington equipment group - running independently");
    return {
      isLead: true,
      shouldRun: true,
      reason: "Not in lead-lag group - running independently",
      groupId: null,
      leadEquipmentId: equipmentId,
      lagEquipmentIds: []
    };
  }
  
  if (!group.useLeadLag) {
    // Lead-lag disabled - all equipment runs independently
    logLocationEquipment("4", equipmentId, "boiler", "Lead-lag disabled for Huntington equipment - running independently");
    return {
      isLead: true,
      shouldRun: true,
      reason: "Lead-lag disabled - running independently",
      groupId: group.id,
      leadEquipmentId: equipmentId,
      lagEquipmentIds: []
    };
  }
  
  // Initialize state storage for Huntington lead-lag
  if (!stateStorage.huntingtonLeadLag) {
    stateStorage.huntingtonLeadLag = {
      currentLeadId: group.leadEquipmentId,
      lastHealthCheck: 0,
      lastRotationCheck: 0,
      failoverCount: 0
    };
  }
  
  const now = Date.now();
  const currentLeadId = stateStorage.huntingtonLeadLag.currentLeadId || group.leadEquipmentId;
  
  // Check if lead equipment has failed (only check every 30 seconds to avoid rapid switching)
  if (now - stateStorage.huntingtonLeadLag.lastHealthCheck > 30000) {
    stateStorage.huntingtonLeadLag.lastHealthCheck = now;
    
    if (group.autoFailover && currentLeadId !== equipmentId) {
      // This is a lag unit - check if lead unit is healthy
      const leadEquipmentHealthy = await checkHuntingtonBoilerHealth(currentLeadId, metrics);
      
      if (!leadEquipmentHealthy) {
        // Lead equipment failed - promote this lag unit to lead
        stateStorage.huntingtonLeadLag.currentLeadId = equipmentId;
        stateStorage.huntingtonLeadLag.failoverCount += 1;
        
        logLocationEquipment("4", equipmentId, "boiler", 
          `FAILOVER: Lead equipment ${currentLeadId} failed, promoting ${equipmentId} to lead`);
        
        // Write failover event to InfluxDB
        await writeHuntingtonLeadLagEvent(group.id, equipmentId, "failover", "Lead equipment failure detected");
        
        return {
          isLead: true,
          shouldRun: true,
          reason: `Promoted to lead due to failover (${stateStorage.huntingtonLeadLag.failoverCount} total failovers)`,
          groupId: group.id,
          leadEquipmentId: equipmentId,
          lagEquipmentIds: group.equipmentIds.filter(id => id !== equipmentId)
        };
      }
    }
  }
  
  // Check for scheduled rotation (only check every 5 minutes to avoid excessive checking)
  if (group.useLeadLag && now - stateStorage.huntingtonLeadLag.lastRotationCheck > 300000) {
    stateStorage.huntingtonLeadLag.lastRotationCheck = now;
    
    const daysSinceLastRotation = (now - group.lastChangeoverTime) / (24 * 60 * 60 * 1000);
    
    if (daysSinceLastRotation >= group.changeoverIntervalDays) {
      // Time for rotation
      const currentIndex = group.equipmentIds.indexOf(currentLeadId);
      const nextIndex = (currentIndex + 1) % group.equipmentIds.length;
      const nextLeadId = group.equipmentIds[nextIndex];
      
      if (nextLeadId && nextLeadId !== currentLeadId) {
        stateStorage.huntingtonLeadLag.currentLeadId = nextLeadId;
        
        logLocationEquipment("4", equipmentId, "boiler", 
          `ROTATION: Scheduled changeover from ${currentLeadId} to ${nextLeadId} (${daysSinceLastRotation.toFixed(1)} days since last rotation)`);
        
        // Write rotation event to InfluxDB
        await writeHuntingtonLeadLagEvent(group.id, nextLeadId, "rotation", `Scheduled rotation after ${daysSinceLastRotation.toFixed(1)} days`);
      }
    }
  }
  
  // Determine final status
  const finalLeadId = stateStorage.huntingtonLeadLag.currentLeadId;
  const isLead = finalLeadId === equipmentId;
  
  if (isLead) {
    logLocationEquipment("4", equipmentId, "boiler", `LEAD EQUIPMENT: Operating as lead in Huntington group ${group.name}`);
    return {
      isLead: true,
      shouldRun: true,
      reason: `Lead equipment in Huntington group ${group.name}`,
      groupId: group.id,
      leadEquipmentId: equipmentId,
      lagEquipmentIds: group.equipmentIds.filter(id => id !== equipmentId)
    };
  } else {
    logLocationEquipment("4", equipmentId, "boiler", `LAG EQUIPMENT: Standing by as lag in Huntington group ${group.name} (lead: ${finalLeadId})`);
    return {
      isLead: false,
      shouldRun: false,
      reason: `Lag equipment in standby - Huntington group ${group.name} (lead: ${finalLeadId})`,
      groupId: group.id,
      leadEquipmentId: finalLeadId,
      lagEquipmentIds: [equipmentId]
    };
  }
}

/**
 * Determine Huntington pump lead-lag status for a specific pump
 */
export async function getHuntingtonPumpLeadLagStatus(
  equipmentId: string, 
  pumpType: "CWPump" | "HWPump",
  metrics: any,
  stateStorage: any
): Promise<HuntingtonLeadLagStatus> {
  
  logLocationEquipment("4", equipmentId, "pump", "Determining Huntington pump lead-lag status");
  
  // Get the appropriate equipment group based on pump type
  let groupKey = "";
  if (pumpType === "CWPump") {
    groupKey = "HuntingtonHeritageChillerPumps";
  } else {
    groupKey = "HuntingtonHeritageHeatingPumps";
  }
  
  const group = HUNTINGTON_EQUIPMENT_GROUPS[groupKey];
  
  if (!group) {
    // Not in a group - run independently
    logLocationEquipment("4", equipmentId, "pump", "Not in Huntington pump group - running independently");
    return {
      isLead: true,
      shouldRun: true,
      reason: "Not in lead-lag group - running independently",
      groupId: null,
      leadEquipmentId: equipmentId,
      lagEquipmentIds: []
    };
  }
  
  if (!group.useLeadLag) {
    // Lead-lag disabled - all pumps run independently
    logLocationEquipment("4", equipmentId, "pump", "Lead-lag disabled for Huntington pumps - running independently");
    return {
      isLead: true,
      shouldRun: true,
      reason: "Lead-lag disabled - running independently",
      groupId: group.id,
      leadEquipmentId: equipmentId,
      lagEquipmentIds: []
    };
  }
  
  // Initialize state storage for Huntington pump lead-lag
  const stateKey = `huntingtonPumpLeadLag_${pumpType}`;
  if (!stateStorage[stateKey]) {
    stateStorage[stateKey] = {
      currentLeadId: group.leadEquipmentId,
      lastHealthCheck: 0,
      lastRotationCheck: 0,
      failoverCount: 0
    };
  }
  
  const now = Date.now();
  const currentLeadId = stateStorage[stateKey].currentLeadId || group.leadEquipmentId;
  
  // Check if lead pump has failed (only check every 30 seconds to avoid rapid switching)
  if (now - stateStorage[stateKey].lastHealthCheck > 30000) {
    stateStorage[stateKey].lastHealthCheck = now;
    
    if (group.autoFailover && currentLeadId !== equipmentId) {
      // This is a lag pump - check if lead pump is healthy
      const leadPumpHealthy = await checkHuntingtonPumpHealth(currentLeadId, pumpType, metrics);
      
      if (!leadPumpHealthy) {
        // Lead pump failed - promote this lag pump to lead
        stateStorage[stateKey].currentLeadId = equipmentId;
        stateStorage[stateKey].failoverCount += 1;
        
        logLocationEquipment("4", equipmentId, "pump", 
          `FAILOVER: Lead pump ${currentLeadId} failed, promoting ${equipmentId} to lead`);
        
        // Write failover event to InfluxDB
        await writeHuntingtonLeadLagEvent(group.id, equipmentId, "failover", "Lead pump failure detected");
        
        return {
          isLead: true,
          shouldRun: true,
          reason: `Promoted to lead due to failover (${stateStorage[stateKey].failoverCount} total failovers)`,
          groupId: group.id,
          leadEquipmentId: equipmentId,
          lagEquipmentIds: group.equipmentIds.filter(id => id !== equipmentId)
        };
      }
    }
  }
  
  // Check for scheduled rotation (only check every 5 minutes to avoid excessive checking)
  if (group.useLeadLag && now - stateStorage[stateKey].lastRotationCheck > 300000) {
    stateStorage[stateKey].lastRotationCheck = now;
    
    const daysSinceLastRotation = (now - group.lastChangeoverTime) / (24 * 60 * 60 * 1000);
    
    if (daysSinceLastRotation >= group.changeoverIntervalDays) {
      // Time for rotation
      const currentIndex = group.equipmentIds.indexOf(currentLeadId);
      const nextIndex = (currentIndex + 1) % group.equipmentIds.length;
      const nextLeadId = group.equipmentIds[nextIndex];
      
      if (nextLeadId && nextLeadId !== currentLeadId) {
        stateStorage[stateKey].currentLeadId = nextLeadId;
        
        logLocationEquipment("4", equipmentId, "pump", 
          `ROTATION: Scheduled changeover from ${currentLeadId} to ${nextLeadId} (${daysSinceLastRotation.toFixed(1)} days since last rotation)`);
        
        // Write rotation event to InfluxDB
        await writeHuntingtonLeadLagEvent(group.id, nextLeadId, "rotation", `Scheduled rotation after ${daysSinceLastRotation.toFixed(1)} days`);
      }
    }
  }
  
  // Determine final status
  const finalLeadId = stateStorage[stateKey].currentLeadId;
  const isLead = finalLeadId === equipmentId;
  
  if (isLead) {
    logLocationEquipment("4", equipmentId, "pump", `LEAD PUMP: Operating as lead in Huntington group ${group.name}`);
    return {
      isLead: true,
      shouldRun: true,
      reason: `Lead pump in Huntington group ${group.name}`,
      groupId: group.id,
      leadEquipmentId: equipmentId,
      lagEquipmentIds: group.equipmentIds.filter(id => id !== equipmentId)
    };
  } else {
    logLocationEquipment("4", equipmentId, "pump", `LAG PUMP: Standing by as lag in Huntington group ${group.name} (lead: ${finalLeadId})`);
    return {
      isLead: false,
      shouldRun: false,
      reason: `Lag pump in standby - Huntington group ${group.name} (lead: ${finalLeadId})`,
      groupId: group.id,
      leadEquipmentId: finalLeadId,
      lagEquipmentIds: [equipmentId]
    };
  }
}

/**
 * Check Huntington pump health based on InfluxDB metrics
 */
export async function checkHuntingtonPumpHealth(equipmentId: string, pumpType: "CWPump" | "HWPump", metrics: any): Promise<boolean> {
  logLocationEquipment("4", equipmentId, "pump", "Checking Huntington pump health");
  
  try {
    let pumpAmps = 0;
    let pumpStatus = "unknown";
    
    // Get pump metrics based on equipment ID
    switch(equipmentId) {
      case "RJLaOk4UssyePSA1qqT8":  // CW Pump 1
        pumpAmps = parseSafeNumber(metrics.CWPump1Amps || metrics.CWP1Amps, 0);
        pumpStatus = metrics.CWPump1Status || metrics.CWP1Status || "unknown";
        break;
      case "wGvf15Bf6xaLISwhRc7xO":  // CW Pump 2
        pumpAmps = parseSafeNumber(metrics.CWPump2Amps || metrics.CWP2Amps, 0);
        pumpStatus = metrics.CWPump2Status || metrics.CWP2Status || "unknown";
        break;
      case "GUI1SxcedsLEhqbD0G2p":   // HW Pump 1
        pumpAmps = parseSafeNumber(metrics.HWPump1Amps || metrics.HWP1Amps, 0);
        pumpStatus = metrics.HWPump1Status || metrics.HWP1Status || "unknown";
        break;
      case "oh5Bz2zzIcuT9lFoogvi":   // HW Pump 2
        pumpAmps = parseSafeNumber(metrics.HWPump2Amps || metrics.HWP2Amps, 0);
        pumpStatus = metrics.HWPump2Status || metrics.HWP2Status || "unknown";
        break;
      default:
        // Generic fallback
        pumpAmps = parseSafeNumber(metrics.pumpAmps || metrics.Amps, 0);
        pumpStatus = metrics.pumpStatus || metrics.Status || "unknown";
    }
    
    // Check for fault status
    if (pumpStatus.toLowerCase().includes("fault") || pumpStatus.toLowerCase().includes("error")) {
      logLocationEquipment("4", equipmentId, "pump", 
        `UNHEALTHY: Pump status indicates fault: ${pumpStatus}`);
      return false;
    }
    
    // Check for low amp draw when pump should be running
    // If pump is enabled but drawing <0.5A, it may have failed
    if (pumpAmps < 0.5 && pumpStatus !== "off") {
      logLocationEquipment("4", equipmentId, "pump", 
        `UNHEALTHY: Low amp draw (${pumpAmps}A) when pump should be running (status: ${pumpStatus})`);
      return false;
    }
    
    logLocationEquipment("4", equipmentId, "pump", 
      `HEALTHY: Amps: ${pumpAmps}A, Status: ${pumpStatus}`);
    return true;
    
  } catch (error: any) {
    logLocationEquipment("4", equipmentId, "pump", 
      `Error checking pump health: ${error.message} - defaulting to healthy`);
    return true; // Default to healthy if we can't determine
  }
}

/**
 * Write Huntington lead-lag events to InfluxDB for monitoring
 */
async function writeHuntingtonLeadLagEvent(
  groupId: string, 
  equipmentId: string, 
  eventType: "failover" | "rotation",
  reason: string
): Promise<void> {
  try {
    const { execSync } = require('child_process');
    const timestamp = Date.now();
    
    const lineProtocol = `huntington_leadlag_events,group_id=${groupId},equipment_id=${equipmentId},event_type=${eventType},location_id=4 reason="${reason}",timestamp=${timestamp}i`;
    
    const command = `curl -s -X POST "http://localhost:8181/api/v3/write_lp?db=ControlCommands&precision=ms" -H "Content-Type: text/plain" -d '${lineProtocol}'`;
    
    execSync(command, { encoding: 'utf8', timeout: 5000 });
    
    logLocationEquipment("4", equipmentId, "pump", 
      `Huntington lead-lag event logged: ${eventType} - ${reason}`);
      
  } catch (error: any) {
    logLocationEquipment("4", equipmentId, "pump", 
      `Failed to log Huntington lead-lag event: ${error.message}`);
  }
}
