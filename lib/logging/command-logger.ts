// /lib/logging/command-logger.ts
import fs from 'fs';
import path from 'path';

const LOG_DIR = '/opt/productionapp/logs';
const COMMAND_LOG_FILE = path.join(LOG_DIR, 'control-commands.log');

// Make sure the log directory exists
try {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
} catch (error) {
  console.error(`Failed to create log directory: ${error}`);
}

/**
 * Logs a message to the control commands log file
 */
export function logCommand(message: string, level: 'info' | 'error' | 'warn' = 'info'): void {
  try {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
    
    // Append to the log file
    fs.appendFileSync(COMMAND_LOG_FILE, logEntry);
    
    // Also log to console for immediate feedback
    console.log(`[COMMAND_LOG] ${logEntry.trim()}`);
  } catch (error) {
    console.error(`Failed to write to command log: ${error}`);
  }
}

/**
 * Clears the command log file (useful for starting fresh)
 */
export function clearCommandLog(): void {
  try {
    fs.writeFileSync(COMMAND_LOG_FILE, '');
    console.log('Command log cleared');
  } catch (error) {
    console.error(`Failed to clear command log: ${error}`);
  }
}

export default {
  logCommand,
  clearCommandLog
};
