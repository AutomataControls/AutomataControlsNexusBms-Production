// File: /opt/productionapp/ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'bms-server-logic-runner',
      script: './scripts/server-logic-scheduler.js',
      watch: false,
      instances: 1,
      autorestart: true,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        NEXT_APP_URL: 'http://localhost:3000', // Update with your actual URL
        SERVER_ACTION_SECRET_KEY: 'Invertedskynet2', // Update with a secure key
        LOGIC_SCHEDULE_INTERVAL: '60000' // Run every minute
      }
    },
    {
      name: 'neural-bms',
      script: './node_modules/.bin/next',
      args: 'dev -p 3000',
      cwd: '/opt/productionapp',
      watch: false,
      instances: 1,
      autorestart: true,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development'
      }
    },
    {
      name: 'monitoring-service',
      script: './scripts/start-monitoring.js', // Adjust path if needed
      watch: false,
      instances: 1,
      autorestart: true,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
