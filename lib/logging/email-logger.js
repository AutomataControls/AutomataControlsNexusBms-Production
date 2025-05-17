// /lib/logging/email-logger.js
const fs = require('fs');
const path = require('path');

class EmailLogger {
  constructor(options = {}) {
    this.logDir = options.logDir || path.join(process.cwd(), 'logs');
    this.logFile = options.logFile || 'email-service.log';
    this.maxLogSize = options.maxLogSize || 10 * 1024 * 1024; // 10MB default
    this.maxLogFiles = options.maxLogFiles || 5;
    this.logLevel = options.logLevel || 'info'; // debug, info, warn, error
    
    // Create log directory if it doesn't exist
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
    
    this.logLevels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    
    this.checkLogRotation();
  }
  
  checkLogRotation() {
    const logPath = path.join(this.logDir, this.logFile);
    
    // Check if log file exists and is too large
    if (fs.existsSync(logPath)) {
      const stats = fs.statSync(logPath);
      if (stats.size > this.maxLogSize) {
        this.rotateLogFiles();
      }
    }
  }
  
  rotateLogFiles() {
    for (let i = this.maxLogFiles - 1; i > 0; i--) {
      const oldFile = path.join(this.logDir, `${this.logFile}.${i}`);
      const newFile = path.join(this.logDir, `${this.logFile}.${i + 1}`);
      
      if (fs.existsSync(oldFile)) {
        try {
          fs.renameSync(oldFile, newFile);
        } catch (err) {
          console.error(`Failed to rotate log file ${oldFile} to ${newFile}: ${err.message}`);
        }
      }
    }
    
    // Rename current log to .1
    const currentLog = path.join(this.logDir, this.logFile);
    const newLog = path.join(this.logDir, `${this.logFile}.1`);
    
    if (fs.existsSync(currentLog)) {
      try {
        fs.renameSync(currentLog, newLog);
      } catch (err) {
        console.error(`Failed to rotate log file ${currentLog} to ${newLog}: ${err.message}`);
      }
    }
  }
  
  formatLog(level, message, data) {
    const timestamp = new Date().toISOString();
    const formattedData = data ? JSON.stringify(data, null, 0) : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message} ${formattedData}\n`;
  }
  
  shouldLog(level) {
    return this.logLevels[level] >= this.logLevels[this.logLevel];
  }
  
  writeLog(level, message, data) {
    if (!this.shouldLog(level)) return;
    
    this.checkLogRotation();
    
    const logEntry = this.formatLog(level, message, data);
    const logPath = path.join(this.logDir, this.logFile);
    
    try {
      fs.appendFileSync(logPath, logEntry);
      // Also log to console with a prefix for visibility
      console.log(`📧 ${level.toUpperCase()}: ${message}`, data || '');
    } catch (err) {
      console.error(`Failed to write to email log file: ${err.message}`);
    }
  }
  
  debug(message, data) {
    this.writeLog('debug', message, data);
  }
  
  info(message, data) {
    this.writeLog('info', message, data);
  }
  
  warn(message, data) {
    this.writeLog('warn', message, data);
  }
  
  error(message, data) {
    this.writeLog('error', message, data);
  }
  
  // Utility method to dump any incoming request details
  logRequest(req, msg = 'Received request') {
    this.info(msg, {
      method: req?.method,
      url: req?.url,
      headers: {
        'content-type': req?.headers?.['content-type'],
        'user-agent': req?.headers?.['user-agent']
      },
      body: req?.body ? {
        alarmType: req.body.alarmType,
        severity: req.body.severity,
        locationId: req.body.locationId,
        recipientCount: req.body.recipients?.length || 0
      } : null
    });
  }
  
  // Utility to log email success/failure
  logEmailResult(success, recipient, method, messageId, error) {
    if (success) {
      this.info(`Email sent successfully to ${recipient}`, {
        recipient,
        method,
        messageId
      });
    } else {
      this.error(`Failed to send email to ${recipient}`, {
        recipient,
        method,
        error: error?.message || error || 'Unknown error'
      });
    }
  }
  
  // Utility to get the log file path
  getLogFilePath() {
    return path.join(this.logDir, this.logFile);
  }
}

// Create and export a singleton instance
const emailLogger = new EmailLogger();
module.exports = emailLogger;
