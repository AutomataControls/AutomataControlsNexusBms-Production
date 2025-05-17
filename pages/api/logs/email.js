// /pages/api/logs/email.js
import fs from 'fs';
import path from 'path';

const emailLogger = require('../../../lib/logging/email-logger');

export default async function handler(req, res) {
  // Basic authentication - you should improve this for production
  const { key } = req.query;
  
  if (key !== process.env.LOG_VIEWER_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const logPath = emailLogger.getLogFilePath();
    
    if (!fs.existsSync(logPath)) {
      return res.status(404).json({ error: 'Log file not found' });
    }
    
    // Get the last n lines from the log file
    const { lines = 200 } = req.query;
    const logContent = fs.readFileSync(logPath, 'utf8');
    const logLines = logContent.split('\n').filter(Boolean).reverse(); // Reverse to get newest first
    
    // Get the most recent lines
    const recentLines = logLines.slice(0, parseInt(lines));
    
    // Parse log entries to make them searchable
    const formattedLogs = recentLines.map(line => {
      try {
        // Extract timestamp and level
        const timestampMatch = line.match(/\[(.*?)\]/);
        const levelMatch = line.match(/\[([A-Z]+)\]/);
        
        const timestamp = timestampMatch ? timestampMatch[1] : '';
        const level = levelMatch ? levelMatch[1] : '';
        
        // Remove timestamp and level from the message
        let message = line;
        if (timestampMatch) message = message.replace(timestampMatch[0], '');
        if (levelMatch) message = message.replace(levelMatch[0], '');
        
        // Extract data if present as JSON
        let data = {};
        const jsonMatch = message.match(/(\{.*\})/);
        if (jsonMatch) {
          try {
            data = JSON.parse(jsonMatch[1]);
            message = message.replace(jsonMatch[1], '').trim();
          } catch (e) {
            // If JSON parsing fails, just keep the original message
          }
        }
        
        return {
          timestamp,
          level,
          message: message.trim(),
          data,
          raw: line
        };
      } catch (err) {
        return { raw: line };
      }
    });
    
    return res.status(200).json({
      logFile: logPath,
      lines: recentLines.length,
      logs: formattedLogs
    });
  } catch (error) {
    console.error('Error reading log file:', error);
    return res.status(500).json({ error: 'Failed to read log file' });
  }
}
