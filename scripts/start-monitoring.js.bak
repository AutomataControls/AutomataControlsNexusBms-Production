// /scripts/start-monitoring.js
const path = require('path');
const monitoringServicePath = path.join(__dirname, '..', 'server', 'monitoring-service.js');

console.log('Loading monitoring service from:', monitoringServicePath);
const { initializeMonitoring } = require(monitoringServicePath);
const { getMetricValue, getMetricType } = require('./metric-mappings');

console.log('Starting monitoring service...');

// Initialize the monitoring service
initializeMonitoring()
  .then(success => {
    if (success) {
      console.log('Monitoring service started successfully');
    } else {
      console.error('Failed to start monitoring service');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Error starting monitoring service:', error);
    process.exit(1);
  });
