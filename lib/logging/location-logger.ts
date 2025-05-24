// lib/logging/location-logger.ts
import * as fs from 'fs';
import * as path from 'path';

// Map of location IDs to their names
const LOCATION_NAMES: Record<string, string> = {
  "1": "HeritageWarren",
  "2": "StJudeCatholicSchool", 
  "3": "ByrnaAmmunition",
  "4": "HeritageHuntington",
  "5": "HopbridgeAutismCenter",
  "6": "AkronCarnegiePublicLibrary",
  "7": "TaylorUniversity", 
  "8": "ElementLabs",
  "9": "FirstChurchOfGod",
  "10": "NERealtyGroup",
  "11": "StJohnCatholicSchool",
  "12": "Residential",
  "13": "UplandCommunityChurch"
};

// Make sure log directory exists
const LOG_DIR = path.join(process.cwd(), 'logs', 'locations');
try {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    console.log(`Created log directory: ${LOG_DIR}`);
  }
} catch (error) {
  console.error(`Error creating log directory: ${error}`);
}

/**
 * Log a message specific to a location's equipment
 * 
 * @param locationId The location ID
 * @param equipmentId The equipment ID
 * @param equipmentType The type of equipment
 * @param message The log message
 * @param data Optional data to include in the log
 */
export function logLocationEquipment(
  locationId: string, 
  equipmentId: string, 
  equipmentType: string, 
  message: string, 
  data?: any
) {
  try {
    // Skip logging if running in browser
    if (typeof window !== 'undefined') return;
    
    // Get location name
    const locationName = LOCATION_NAMES[locationId] || `Location-${locationId}`;
    
    // Create log entry
    const timestamp = new Date().toISOString();
    const logPrefix = `[${timestamp}][${locationName}][${equipmentType}][${equipmentId}]`;
    const logMessage = `${logPrefix} ${message}`;
    
    // Log to console
    console.log(logMessage);
    if (data) {
      console.log(`${logPrefix} DATA:`, typeof data === 'object' ? JSON.stringify(data).substring(0, 500) : data);
    }
    
    // Generate log filename
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const logFileName = `${locationId}_${today}.log`;
    const logFilePath = path.join(LOG_DIR, logFileName);
    
    // Write to log file
    const logEntry = data 
      ? `${logMessage} DATA: ${typeof data === 'object' ? JSON.stringify(data) : data}\n`
      : `${logMessage}\n`;
    
    fs.appendFileSync(logFilePath, logEntry);
  } catch (error) {
    console.error(`Error writing to location log: ${error}`);
  }
}
