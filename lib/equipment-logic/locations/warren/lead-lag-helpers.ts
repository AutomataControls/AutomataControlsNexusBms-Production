// lib/equipment-logic/locations/warren/lead-lag-helpers.ts
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

// Warren equipment groups - hardcoded for Warren location
const WARREN_EQUIPMENT_GROUPS = {
  "WarrenBoilers": {
    id: "WarrenBoilers",
    name: "Warren Boiler System",
    equipmentIds: [
      "ZLb2FhwIlSmxBoIlEr2R", // Warren Boiler 1
      "warren-boiler-2-id",    // Warren Boiler 2 (replace with actual ID)
    ],
    leadEquipmentId: "ZLb2FhwIlSmxBoIlEr2R", // Default lead
    autoFailover: true,
    useLeadLag: true,
    changeoverIntervalDays: 7, // Weekly rotation
    lastChangeoverTime: Date.now() - (7 * 24 * 60 * 60 * 1000), // 1 week ago
    lastFailoverTime: 0
  }
};

interface WarrenBoilerGroup {
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

interface WarrenLeadLagStatus {
  isLead: boolean;
  shouldRun: boolean;
  reason: string;
  groupId: string | null;
  leadEquipmentId: string | null;
  lagEquipmentIds: string[];
}

/**
 * Get Warren boiler group information
 */
export function getWarrenBoilerGroup(equipmentId: string): WarrenBoilerGroup | null {
  logLocationEquipment("1", equipmentId, "boiler", "Checking Warren boiler groups");
  
  // Check if this equipment is in any Warren group
  for (const [groupKey, group] of Object.entries(WARREN_EQUIPMENT_GROUPS)) {
    if (group.equipmentIds.includes(equipmentId)) {
      logLocationEquipment("1", equipmentId, "boiler", 
        `Found in Warren group: ${group.name} (${group.equipmentIds.length} boilers)`);
      return group;
    }
  }
  
  logLocationEquipment("1", equipmentId, "boiler", "Not found in any Warren boiler group");
  return null;
}

/**
 * Check Warren boiler health based on InfluxDB metrics
 */
export async function checkWarrenBoilerHealth(equipmentId: string, metrics: any): Promise<boolean> {
  logLocationEquipment("1", equipmentId, "boiler", "Checking Warren boiler health");
  
  try {
    // Check supply temperature - if too hot, boiler may be malfunctioning
    const supplyTemp = parseSafeNumber(metrics.H20Supply || metrics.H2OSupply || metrics.Supply, 140);
    
    // Check if boiler is in emergency shutoff (over 170°F is dangerous)
    if (supplyTemp > 170) {
      logLocationEquipment("1", equipmentId, "boiler", 
        `UNHEALTHY: Supply temperature ${supplyTemp}°F exceeds safe limit (170°F)`);
      return false;
    }
    
    // Check for freezestat condition
    const freezestat = metrics.Freezestat || metrics.freezestat || false;
    if (freezestat === true || freezestat === "true" || freezestat === 1) {
      logLocationEquipment("1", equipmentId, "boiler", 
        `UNHEALTHY: Freezestat condition detected`);
      return false;
    }
    
    // Check for fault status
    const boilerStatus = metrics.boilerStatus || metrics.BoilerStatus || "normal";
    if (boilerStatus.toLowerCase().includes("fault") || boilerStatus.toLowerCase().includes("error")) {
      logLocationEquipment("1", equipmentId, "boiler", 
        `UNHEALTHY: Boiler status indicates fault: ${boilerStatus}`);
      return false;
    }
    
    // Check firing status - if it should be firing but isn't, may indicate problem
    const firing = parseSafeNumber(metrics.firing || metrics.Firing, 0);
    const outdoorTemp = parseSafeNumber(metrics.Outdoor_Air || metrics.outdoorTemperature, 50);
    
    // If it's cold outside but boiler isn't firing when it should be
    if (outdoorTemp < 60 && supplyTemp < 100 && firing === 0) {
      // This might indicate a problem, but give some tolerance
      logLocationEquipment("1", equipmentId, "boiler", 
        `WARNING: Cold weather but boiler not firing (OAT: ${outdoorTemp}°F, Supply: ${supplyTemp}°F)`);
      // Don't mark as unhealthy yet, but this could be monitored
    }
    
    logLocationEquipment("1", equipmentId, "boiler", 
      `HEALTHY: Supply: ${supplyTemp}°F, Status: ${boilerStatus}, Firing: ${firing}`);
    return true;
    
  } catch (error: any) {
    logLocationEquipment("1", equipmentId, "boiler", 
      `Error checking boiler health: ${error.message} - defaulting to healthy`);
    return true; // Default to healthy if we can't determine
  }
}

/**
 * Determine Warren lead-lag status for a specific boiler
 */
export async function getWarrenLeadLagStatus(
  equipmentId: string, 
  metrics: any,
  stateStorage: any
): Promise<WarrenLeadLagStatus> {
  
  logLocationEquipment("1", equipmentId, "boiler", "Determining Warren lead-lag status");
  
  // Get the boiler group this equipment belongs to
  const group = getWarrenBoilerGroup(equipmentId);
  
  if (!group) {
    // Not in a group - run independently
    logLocationEquipment("1", equipmentId, "boiler", "Not in Warren boiler group - running independently");
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
    // Lead-lag disabled - all boilers run independently
    logLocationEquipment("1", equipmentId, "boiler", "Lead-lag disabled for Warren boilers - running independently");
    return {
      isLead: true,
      shouldRun: true,
      reason: "Lead-lag disabled - running independently",
      groupId: group.id,
      leadEquipmentId: equipmentId,
      lagEquipmentIds: []
    };
  }
  
  // Initialize state storage for Warren lead-lag
  if (!stateStorage.warrenLeadLag) {
    stateStorage.warrenLeadLag = {
      currentLeadId: group.leadEquipmentId,
      lastHealthCheck: 0,
      lastRotationCheck: 0,
      failoverCount: 0
    };
  }
  
  const now = Date.now();
  const currentLeadId = stateStorage.warrenLeadLag.currentLeadId || group.leadEquipmentId;
  
  // Check if lead boiler has failed (only check every 30 seconds to avoid rapid switching)
  if (now - stateStorage.warrenLeadLag.lastHealthCheck > 30000) {
    stateStorage.warrenLeadLag.lastHealthCheck = now;
    
    if (group.autoFailover && currentLeadId !== equipmentId) {
      // This is a lag boiler - check if lead boiler is healthy
      const leadBoilerHealthy = await checkWarrenBoilerHealth(currentLeadId, metrics);
      
      if (!leadBoilerHealthy) {
        // Lead boiler failed - promote this lag boiler to lead
        stateStorage.warrenLeadLag.currentLeadId = equipmentId;
        stateStorage.warrenLeadLag.failoverCount += 1;
        
        logLocationEquipment("1", equipmentId, "boiler", 
          `FAILOVER: Lead boiler ${currentLeadId} failed, promoting ${equipmentId} to lead`);
        
        // Write failover event to InfluxDB
        await writeWarrenLeadLagEvent(group.id, equipmentId, "failover", "Lead boiler failure detected");
        
        return {
          isLead: true,
          shouldRun: true,
          reason: `Promoted to lead due to failover (${stateStorage.warrenLeadLag.failoverCount} total failovers)`,
          groupId: group.id,
          leadEquipmentId: equipmentId,
          lagEquipmentIds: group.equipmentIds.filter(id => id !== equipmentId)
        };
      }
    }
  }
  
  // Check for scheduled rotation (only check every 5 minutes to avoid excessive checking)
  if (group.useLeadLag && now - stateStorage.warrenLeadLag.lastRotationCheck > 300000) {
    stateStorage.warrenLeadLag.lastRotationCheck = now;
    
    const daysSinceLastRotation = (now - group.lastChangeoverTime) / (24 * 60 * 60 * 1000);
    
    if (daysSinceLastRotation >= group.changeoverIntervalDays) {
      // Time for rotation
      const currentIndex = group.equipmentIds.indexOf(currentLeadId);
      const nextIndex = (currentIndex + 1) % group.equipmentIds.length;
      const nextLeadId = group.equipmentIds[nextIndex];
      
      if (nextLeadId && nextLeadId !== currentLeadId) {
        stateStorage.warrenLeadLag.currentLeadId = nextLeadId;
        
        logLocationEquipment("1", equipmentId, "boiler", 
          `ROTATION: Scheduled changeover from ${currentLeadId} to ${nextLeadId} (${daysSinceLastRotation.toFixed(1)} days since last rotation)`);
        
        // Write rotation event to InfluxDB
        await writeWarrenLeadLagEvent(group.id, nextLeadId, "rotation", `Scheduled rotation after ${daysSinceLastRotation.toFixed(1)} days`);
      }
    }
  }
  
  // Determine final status
  const finalLeadId = stateStorage.warrenLeadLag.currentLeadId;
  const isLead = finalLeadId === equipmentId;
  
  if (isLead) {
    logLocationEquipment("1", equipmentId, "boiler", `LEAD BOILER: Operating as lead in Warren group ${group.name}`);
    return {
      isLead: true,
      shouldRun: true,
      reason: `Lead boiler in Warren group ${group.name}`,
      groupId: group.id,
      leadEquipmentId: equipmentId,
      lagEquipmentIds: group.equipmentIds.filter(id => id !== equipmentId)
    };
  } else {
    logLocationEquipment("1", equipmentId, "boiler", `LAG BOILER: Standing by as lag in Warren group ${group.name} (lead: ${finalLeadId})`);
    return {
      isLead: false,
      shouldRun: false,
      reason: `Lag boiler in standby - Warren group ${group.name} (lead: ${finalLeadId})`,
      groupId: group.id,
      leadEquipmentId: finalLeadId,
      lagEquipmentIds: [equipmentId]
    };
  }
}

/**
 * Write Warren lead-lag events to InfluxDB for monitoring
 */
async function writeWarrenLeadLagEvent(
  groupId: string, 
  equipmentId: string, 
  eventType: "failover" | "rotation",
  reason: string
): Promise<void> {
  try {
    const { execSync } = require('child_process');
    const timestamp = Date.now();
    
    const lineProtocol = `warren_leadlag_events,group_id=${groupId},equipment_id=${equipmentId},event_type=${eventType},location_id=1 reason="${reason}",timestamp=${timestamp}i`;
    
    const command = `curl -s -X POST "http://localhost:8181/api/v3/write_lp?db=ControlCommands&precision=ms" -H "Content-Type: text/plain" -d '${lineProtocol}'`;
    
    execSync(command, { encoding: 'utf8', timeout: 5000 });
    
    logLocationEquipment("1", equipmentId, "boiler", 
      `Warren lead-lag event logged: ${eventType} - ${reason}`);
      
  } catch (error: any) {
    logLocationEquipment("1", equipmentId, "boiler", 
      `Failed to log Warren lead-lag event: ${error.message}`);
  }
}
