// File: /opt/productionapp/ecosystem.config.js
// CORE SERVICES ONLY - Location processors/factories moved to individual configs
module.exports = {
  apps: [
    {
      name: 'neural',
      script: '/usr/bin/bash',
      args: '-c "npx next start -p 3000"',
      cwd: '/opt/productionapp',
      watch: false,
      instances: 1,
      autorestart: true,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'monitoring-service',
      script: './scripts/start-monitoring.js',
      watch: false,
      instances: 1,
      autorestart: true,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'enhanced-equipment-worker',
      script: './dist/workers/enhanced-equipment-worker.js',
      watch: false,
      instances: 2,
      exec_mode: 'cluster',
      autorestart: true,
      max_memory_restart: '300M',
      out_file: './logs/ui-worker.log',
      error_file: './logs/ui-worker-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      env: {
        NODE_ENV: 'production',
        INFLUXDB_URL: 'http://143.198.162.31:8181',
        INFLUXDB_DATABASE3: 'UIControlCommands',
        INFLUXDB_DATABASE4: 'EquipmentConfig',
        INFLUXDB_DATABASE5: 'NeuralControlCommands',
        INFLUXDB_LOCATIONS_BUCKET: 'Locations'
      }
    }
  ]
}
