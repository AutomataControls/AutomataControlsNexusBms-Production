"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.logLocationEquipment = logLocationEquipment;
// lib/logging/location-logger.ts
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Map of location IDs to their names
const LOCATION_NAMES = {
    "1": "Warren",
    "2": "Taylor",
    "3": "FCOG",
    "4": "Huntington",
    "5": "St. John",
    "6": "Hopebridge",
    "7": "Upland",
    "8": "Byrna",
    "9": "NERealty",
    "10": "St. Jude",
    "11": "Akron",
    "12": "Element",
    "13": "Residential"
};
// Make sure log directory exists
const LOG_DIR = path.join(process.cwd(), 'logs', 'locations');
try {
    if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
        console.log(`Created log directory: ${LOG_DIR}`);
    }
}
catch (error) {
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
function logLocationEquipment(locationId, equipmentId, equipmentType, message, data) {
    try {
        // Skip logging if running in browser
        if (typeof window !== 'undefined')
            return;
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
    }
    catch (error) {
        console.error(`Error writing to location log: ${error}`);
    }
}
