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
        NEXT_APP_URL: 'http://localhost:3000',
        SERVER_ACTION_SECRET_KEY: 'Invertedskynet2',
        LOGIC_SCHEDULE_INTERVAL: '60000'
      }
    },
    {
      name: 'neural',
      script: '/usr/bin/bash',
      args: '-c "npx next dev -p 3000"',
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
      script: './scripts/start-monitoring.js',
      watch: false,
      instances: 1,
      autorestart: true,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production'
      }
    },
    // Add the equipment worker
    {
      name: 'equipment-worker',
      script: './worker.js',
      watch: false,
      instances: 4,
      exec_mode: 'cluster',
      autorestart: true,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
