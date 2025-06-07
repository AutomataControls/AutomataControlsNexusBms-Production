# Custom Location Setup Example

This example demonstrates how to set up a complete new location with multiple equipment types using the Automata Controls Nexus BMS architecture. We'll create "Sample Building" as Location ID `6` with various HVAC equipment.

## 📁 File Structure

```
examples/custom-location-setup/
├── README.md                           # This guide
├── location-processor.ts               # Main location processor
├── equipment-logic/
│   ├── boiler.js                      # Boiler control logic
│   ├── pump.js                        # Pump control logic  
│   ├── fan-coil.js                    # Fan coil control logic
│   └── air-handler.js                 # Air handler control logic
├── ecosystem.config.js                 # PM2 configuration
├── influxdb-setup.sql                 # Database setup queries
├── equipment-registry.js              # Equipment configuration
└── node-red-flows/
    ├── boiler-metrics.json            # Node-RED flow for boiler
    ├── pump-metrics.json              # Node-RED flow for pump
    └── sample-metrics.json            # Sample data flows
```

## 🏗️ Location Overview

**Sample Building Location (ID: 6)**
- 2 Boilers (lead-lag configuration)
- 2 Hot Water Pumps (lead-lag configuration) 
- 3 Fan Coils (zone control)
- 1 Air Handler (central system)

## 🚀 Step 1: Equipment Registry Configuration

Create your equipment registry with real equipment IDs and specifications:

```javascript
// equipment-registry.js
const SAMPLE_BUILDING_EQUIPMENT = {
  // Boiler Systems - Lead/Lag Configuration
  BOILERS: {
    'SAMPLE_BOILER_001': {
      name: 'Sample-Boiler-1',
      type: 'boiler',
      system: 'comfort',
      priority: 1, // Lead
      designCapacity: 400000, // BTU/hr
      minModulation: 25, // %
      maxTemp: 180, // °F
      interval: 2 * 60 * 1000 // 2 minutes
    },
    'SAMPLE_BOILER_002': {
      name: 'Sample-Boiler-2', 
      type: 'boiler',
      system: 'comfort',
      priority: 2, // Lag
      designCapacity: 400000, // BTU/hr
      minModulation: 25, // %
      maxTemp: 180, // °F
      interval: 2 * 60 * 1000 // 2 minutes
    }
  },

  // Hot Water Pump Systems - Lead/Lag Configuration
  HW_PUMPS: {
    'SAMPLE_PUMP_001': {
      name: 'Sample-HWPump-1',
      type: 'hotwater_pump',
      priority: 1, // Lead
      designFlow: 120, // GPM
      designHead: 30, // ft
      motorHP: 1.5,
      interval: 30 * 1000 // 30 seconds
    },
    'SAMPLE_PUMP_002': {
      name: 'Sample-HWPump-2',
      type: 'hotwater_pump', 
      priority: 2, // Lag
      designFlow: 120, // GPM
      designHead: 30, // ft
      motorHP: 1.5,
      interval: 30 * 1000 // 30 seconds
    }
  },

  // Fan Coil Units - Zone Control
  FAN_COILS: {
    'SAMPLE_FC_001': {
      name: 'Sample-FanCoil-1',
      type: 'fancoil',
      zone: 'Zone1',
      designCFM: 600,
      heatingCapacity: 20000, // BTU/hr
      coolingCapacity: 24000, // BTU/hr
      interval: 30 * 1000 // 30 seconds
    },
    'SAMPLE_FC_002': {
      name: 'Sample-FanCoil-2',
      type: 'fancoil',
      zone: 'Zone2', 
      designCFM: 600,
      heatingCapacity: 20000,
      coolingCapacity: 24000,
      interval: 30 * 1000
    },
    'SAMPLE_FC_003': {
      name: 'Sample-FanCoil-3',
      type: 'fancoil',
      zone: 'Zone3',
      designCFM: 600,
      heatingCapacity: 20000,
      coolingCapacity: 24000,
      interval: 30 * 1000
    }
  },

  // Air Handler System
  AIR_HANDLERS: {
    'SAMPLE_AHU_001': {
      name: 'Sample-AirHandler-1',
      type: 'air_handler',
      designCFM: 5000,
      heatingCapacity: 150000,
      coolingCapacity: 180000,
      minOAPosition: 15, // %
      maxOAPosition: 100, // %
      interval: 60 * 1000 // 1 minute
    }
  }
};

module.exports = { SAMPLE_BUILDING_EQUIPMENT };
```

## 📡 Step 2: Location Processor Implementation

Based on the Huntington processor pattern, create your location processor:

```typescript
// location-processor.ts
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { SAMPLE_BUILDING_EQUIPMENT } from './equipment-registry';

const LOCATION_ID = '6';
const LOCATION_NAME = 'Sample Building';

// Redis connection for BullMQ
const redis = new Redis({
    host: 'localhost',
    port: 6379,
    maxRetriesPerRequest: null,
});

// BullMQ Queue for equipment processing
const equipmentQueue = new Queue('equipment-logic-6', {
    connection: redis,
    defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 5,
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000,
        },
    },
});

// Equipment configuration from registry
const EQUIPMENT_CONFIG = createEquipmentConfig();

function createEquipmentConfig() {
    const config = {};
    
    // Process all equipment types from registry
    Object.entries(SAMPLE_BUILDING_EQUIPMENT).forEach(([category, equipment]) => {
        Object.entries(equipment).forEach(([equipmentId, specs]) => {
            // Create equipment key from name (lowercase, hyphenated)
            const equipmentKey = specs.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
            
            config[equipmentKey] = {
                interval: specs.interval,
                file: `${specs.type}.js`,
                equipmentId: equipmentId,
                category: category,
                specs: specs
            };
        });
    });
    
    return config;
}

// Smart queue management (simplified from Huntington pattern)
const queuedJobs = new Set();
const lastRun = new Map();

// Equipment timer management
const equipmentTimers = new Map();

// Equipment processing path
const EQUIPMENT_PATH = '/opt/productionapp/dist/lib/equipment-logic/locations/sample-building';

// Initialize location processors
async function initializeSampleBuildingProcessors() {
    console.log('[Sample Building] Initializing equipment processors...');
    console.log(`[Sample Building] Equipment path: ${EQUIPMENT_PATH}`);
    
    // Start processors for each configured equipment
    for (const [equipmentType, config] of Object.entries(EQUIPMENT_CONFIG)) {
        startEquipmentProcessor(equipmentType, config);
        console.log(`[Sample Building] Started ${equipmentType} processor (${config.interval / 1000}s) - Equipment ID: ${config.equipmentId}`);
    }
    
    console.log('[Sample Building] All equipment processors initialized');
}

// Start individual equipment processor with smart queue logic
function startEquipmentProcessor(equipmentType: string, config: any) {
    const timer = setInterval(async () => {
        await processEquipment(equipmentType, config);
    }, config.interval);
    
    equipmentTimers.set(equipmentType, timer);
    lastRun.set(equipmentType, 0);
}

// Process equipment with smart queue logic
async function processEquipment(equipmentType: string, config: any) {
    const startTime = Date.now();
    
    try {
        console.log(`[Sample Building] Evaluating ${equipmentType} (${config.equipmentId}) for processing...`);
        
        // Smart processing decision
        const shouldProcess = await shouldProcessEquipment(config.equipmentId, equipmentType, config);
        
        if (!shouldProcess.process) {
            console.log(`[Sample Building] Skipping ${equipmentType}: ${shouldProcess.reason}`);
            return;
        }
        
        // Add to queue
        const jobId = await addEquipmentToQueue(
            config.equipmentId,
            LOCATION_ID,
            equipmentType,
            shouldProcess.priority
        );
        
        if (jobId) {
            console.log(`[Sample Building] Queued ${equipmentType} with job ID ${jobId} - Reason: ${shouldProcess.reason}`);
            lastRun.set(config.equipmentId, startTime);
        }
        
    } catch (error) {
        if (error.message?.includes('already exists')) {
            console.log(`[Sample Building] ${equipmentType} already queued - normal behavior`);
        } else {
            console.error(`[Sample Building] Error processing ${equipmentType}:`, error);
        }
    }
}

// Smart processing decision engine (simplified)
async function shouldProcessEquipment(equipmentId: string, equipmentType: string, config: any) {
    try {
        // Check for recent UI commands
        const hasRecentUICommands = await checkRecentUICommands(equipmentId);
        if (hasRecentUICommands) {
            return {
                process: true,
                reason: 'Recent UI commands detected',
                priority: 10
            };
        }
        
        // Check maximum stale time
        const timeSinceLastRun = Date.now() - (lastRun.get(equipmentId) || 0);
        const maxStaleTime = config.interval * 3; // 3x normal interval
        
        if (timeSinceLastRun > maxStaleTime) {
            return {
                process: true,
                reason: `Maximum time exceeded: ${Math.round(timeSinceLastRun / 1000)}s`,
                priority: 1
            };
        }
        
        return {
            process: false,
            reason: `No significant changes detected`
        };
        
    } catch (error) {
        return {
            process: true,
            reason: `Error in decision logic: ${error.message}`,
            priority: 1
        };
    }
}

// Add equipment to queue with deduplication
async function addEquipmentToQueue(equipmentId: string, locationId: string, equipmentType: string, priority: number = 0) {
    const jobKey = `${locationId}-${equipmentId}-${equipmentType}`;
    
    if (queuedJobs.has(jobKey)) {
        return null;
    }
    
    const jobData = {
        equipmentId: equipmentId,
        locationId: locationId,
        type: equipmentType,
        timestamp: Date.now(),
        priority: priority
    };
    
    const job = await equipmentQueue.add(
        `process-${equipmentType}`,
        jobData,
        {
            priority: priority,
            jobId: jobKey,
        }
    );
    
    queuedJobs.add(jobKey);
    
    // Auto-cleanup after processing timeout
    setTimeout(() => {
        queuedJobs.delete(jobKey);
    }, 120000); // 2 minutes
    
    return job.id;
}

// Check for recent UI commands
async function checkRecentUICommands(equipmentId: string): Promise<boolean> {
    try {
        const database = 'UIControlCommands';
        const influxUrl = process.env.INFLUXDB_URL || 'http://localhost:8181';
        
        const query = `
            SELECT * FROM UIControlCommands
            WHERE equipmentId = '${equipmentId}'
            AND time >= now() - INTERVAL '5 minutes'
            LIMIT 1
        `;
        
        const response = await fetch(`${influxUrl}/api/v3/query_sql`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: query, db: database })
        });
        
        if (response.ok) {
            const data = await response.json();
            return Array.isArray(data) && data.length > 0;
        }
        
        return false;
    } catch (error) {
        console.error(`[Sample Building] Error checking UI commands for ${equipmentId}:`, error);
        return false;
    }
}

// Graceful shutdown
async function shutdown() {
    console.log('[Sample Building] Shutting down equipment processors...');
    
    for (const timer of equipmentTimers.values()) {
        clearInterval(timer);
    }
    
    await equipmentQueue.close();
    await redis.quit();
    process.exit(0);
}

// Signal handlers
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Redis event handlers
redis.on('connect', () => console.log('[Sample Building] Redis connected'));
redis.on('error', (err) => console.error('[Sample Building] Redis error:', err));

// Queue event handlers
equipmentQueue.on('completed', (job) => {
    const jobKey = `${job.data.locationId}-${job.data.equipmentId}-${job.data.type}`;
    queuedJobs.delete(jobKey);
    console.log(`[Sample Building] Job completed - ${job.data.type} (${job.data.equipmentId})`);
});

equipmentQueue.on('failed', (job, err) => {
    const jobKey = `${job.data.locationId}-${job.data.equipmentId}-${job.data.type}`;
    queuedJobs.delete(jobKey);
    console.error(`[Sample Building] Job failed - ${job.data.type}:`, err.message);
});

// Initialize and start
console.log('[Sample Building] Starting Sample Building processor...');
initializeSampleBuildingProcessors()
    .then(() => console.log('[Sample Building] Sample Building processor started successfully'))
    .catch((error) => {
        console.error('[Sample Building] Failed to start:', error);
        process.exit(1);
    });
```

## 🔧 Step 3: Equipment Logic Files

Create equipment-specific control logic files:

### Boiler Control Logic

```javascript
// equipment-logic/boiler.js
"use strict";

/**
 * Sample Building Boiler Control Logic
 * 4-Parameter Interface: ✓
 */

function processBoiler(metricsInput, settingsInput, currentTempArgument, stateStorageInput) {
    console.log(`[Sample Boiler] Processing ${settingsInput.equipmentId}`);
    
    // Parse input data safely
    const supplyTemp = parseFloat(metricsInput.H20Supply || metricsInput.supplyTemp || 0);
    const outdoorTemp = parseFloat(currentTempArgument || 70);
    const enabled = settingsInput.enabled !== false;
    const setpoint = parseFloat(settingsInput.tempSetpoint || 140);
    
    // Determine if this is the lead boiler
    const isLead = settingsInput.equipmentId === 'SAMPLE_BOILER_001';
    
    // Calculate outdoor air reset setpoint
    const targetTemp = calculateOARSetpoint(outdoorTemp, 140, 180, 70, 20);
    
    // PID control for temperature
    const tempError = targetTemp - supplyTemp;
    const shouldFire = enabled && tempError > 2.0;
    
    // Lead-lag logic
    let unitEnable = enabled;
    if (!isLead) {
        // Lag boiler only operates if lead is already firing and more heat needed
        const leadDemand = tempError > 10; // High demand threshold
        unitEnable = enabled && leadDemand;
    }
    
    // Safety checks
    const safetyShutoff = supplyTemp > 185; // Safety limit
    if (safetyShutoff) {
        unitEnable = false;
    }
    
    console.log(`[Sample Boiler] ${settingsInput.equipmentId}: Supply=${supplyTemp}°F, Target=${targetTemp.toFixed(1)}°F, Firing=${shouldFire}, Lead=${isLead}`);
    
    return [{
        unitEnable: unitEnable,
        firing: shouldFire && unitEnable && !safetyShutoff,
        waterTempSetpoint: targetTemp,
        temperatureSetpoint: targetTemp,
        isLead: isLead,
        leadLagGroupId: 'sample-boilers',
        leadEquipmentId: isLead ? settingsInput.equipmentId : 'SAMPLE_BOILER_001',
        leadLagReason: isLead ? 'Lead boiler' : 'Lag boiler',
        outdoorTemp: outdoorTemp,
        supplyTemp: supplyTemp,
        safetyShutoff: safetyShutoff,
        safetyReason: safetyShutoff ? 'High temperature limit' : null
    }];
}

// Outdoor Air Reset calculation
function calculateOARSetpoint(outdoorTemp, minSetpoint, maxSetpoint, maxOAT, minOAT) {
    if (outdoorTemp >= maxOAT) return minSetpoint;
    if (outdoorTemp <= minOAT) return maxSetpoint;
    
    const slope = (maxSetpoint - minSetpoint) / (minOAT - maxOAT);
    return minSetpoint + slope * (maxOAT - outdoorTemp);
}

// Export functions for discovery
module.exports = {
    processBoiler,
    processEquipment: processBoiler,
    default: processBoiler,
    boilerControl: processBoiler
};
```

### Pump Control Logic

```javascript
// equipment-logic/pump.js
"use strict";

/**
 * Sample Building Hot Water Pump Control Logic
 * 4-Parameter Interface: ✓
 */

function processPump(metricsInput, settingsInput, currentTempArgument, stateStorageInput) {
    console.log(`[Sample Pump] Processing ${settingsInput.equipmentId}`);
    
    // Parse input data
    const enabled = settingsInput.enabled !== false;
    const currentAmps = parseFloat(metricsInput.amps || 0);
    const pressure = parseFloat(metricsInput.pressure || 0);
    
    // Determine if this is the lead pump
    const isLead = settingsInput.equipmentId === 'SAMPLE_PUMP_001';
    
    // Basic pump control logic
    let pumpEnable = enabled;
    let pumpSpeed = 75; // Default speed percentage
    
    // Lead-lag logic
    if (!isLead) {
        // Lag pump operates based on pressure or lead pump status
        const needsLagPump = pressure < 25 || currentAmps > 8; // Low pressure or high load
        pumpEnable = enabled && needsLagPump;
        pumpSpeed = needsLagPump ? 85 : 0; // Higher speed for lag when needed
    }
    
    // Variable speed control based on pressure
    if (pumpEnable && pressure > 0) {
        if (pressure < 20) {
            pumpSpeed = Math.min(100, pumpSpeed + 10); // Increase speed
        } else if (pressure > 35) {
            pumpSpeed = Math.max(30, pumpSpeed - 10); // Decrease speed
        }
    }
    
    console.log(`[Sample Pump] ${settingsInput.equipmentId}: Enable=${pumpEnable}, Speed=${pumpSpeed}%, Pressure=${pressure} PSI, Lead=${isLead}`);
    
    return [{
        pumpEnable: pumpEnable,
        pumpSpeed: pumpEnable ? pumpSpeed : 0,
        pumpCommand: pumpEnable ? 'RUN' : 'STOP',
        isLead: isLead,
        leadLagStatus: isLead ? 'LEAD' : 'LAG',
        leadLagGroupId: 'sample-hw-pumps',
        leadEquipmentId: isLead ? settingsInput.equipmentId : 'SAMPLE_PUMP_001',
        leadLagReason: isLead ? 'Primary circulation pump' : 'Backup circulation pump',
        pressure: pressure,
        amps: currentAmps
    }];
}

module.exports = {
    processPump,
    processEquipment: processPump,
    default: processPump,
    pumpControl: processPump
};
```

### Fan Coil Control Logic

```javascript
// equipment-logic/fan-coil.js
"use strict";

/**
 * Sample Building Fan Coil Control Logic
 * 4-Parameter Interface: ✓
 */

function processFanCoil(metricsInput, settingsInput, currentTempArgument, stateStorageInput) {
    console.log(`[Sample Fan Coil] Processing ${settingsInput.equipmentId}`);
    
    // Parse input data
    const roomTemp = parseFloat(metricsInput.RoomTemp || metricsInput.roomTemperature || 72);
    const setpoint = parseFloat(settingsInput.tempSetpoint || 72);
    const enabled = settingsInput.enabled !== false;
    const heatingSetpoint = parseFloat(settingsInput.heatingSetpoint || 70);
    const coolingSetpoint = parseFloat(settingsInput.coolingSetpoint || 74);
    
    // Temperature control logic with deadband
    const tempError = setpoint - roomTemp;
    const deadband = 1.0; // 1°F deadband
    
    let heatingEnable = false;
    let coolingEnable = false;
    let heatingValvePosition = 0;
    let coolingValvePosition = 0;
    let fanSpeed = 0;
    
    if (enabled) {
        if (tempError > deadband) {
            // Need heating
            heatingEnable = true;
            heatingValvePosition = Math.min(100, Math.abs(tempError) * 20); // Proportional control
            fanSpeed = Math.max(30, Math.min(100, 40 + Math.abs(tempError) * 10));
        } else if (tempError < -deadband) {
            // Need cooling
            coolingEnable = true;
            coolingValvePosition = Math.min(100, Math.abs(tempError) * 20); // Proportional control
            fanSpeed = Math.max(30, Math.min(100, 40 + Math.abs(tempError) * 10));
        } else {
            // In deadband - maintain minimum fan speed
            fanSpeed = 25;
        }
    }
    
    console.log(`[Sample Fan Coil] ${settingsInput.equipmentId}: Room=${roomTemp}°F, Setpoint=${setpoint}°F, Error=${tempError.toFixed(1)}°F, Fan=${fanSpeed}%`);
    
    return [{
        fanEnabled: enabled && fanSpeed > 0,
        fanSpeed: fanSpeed,
        heatingEnable: heatingEnable,
        coolingEnable: coolingEnable,
        heatingValvePosition: heatingValvePosition,
        coolingValvePosition: coolingValvePosition,
        temperatureSetpoint: setpoint,
        roomTemperature: roomTemp,
        mode: heatingEnable ? 'heating' : (coolingEnable ? 'cooling' : 'off'),
        zone: settingsInput.zone || 'Unknown'
    }];
}

module.exports = {
    processFanCoil,
    processEquipment: processFanCoil,
    default: processFanCoil,
    fanCoilControl: processFanCoil
};
```

## ⚙️ Step 4: PM2 Configuration

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'sample-building-processor',
      script: 'ts-node --project tsconfig.worker.json lib/workers/location-processors/sample-building-processor.ts',
      cwd: '/opt/productionapp',
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '200M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      env: {
        NODE_ENV: 'production',
        LOCATION_ID: '6',
        LOCATION_NAME: 'Sample Building'
      },
      error_file: '/root/.pm2/logs/sample-building-processor-error.log',
      out_file: '/root/.pm2/logs/sample-building-processor-out.log'
    },
    {
      name: 'sample-building-logic-factory',
      script: '/opt/productionapp/dist/workers/logic-factories/sample-building-logic-factory.js',
      cwd: '/opt/productionapp',
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '150M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      env: {
        NODE_ENV: 'production',
        LOCATION_ID: '6'
      }
    }
  ]
};
```

## 💾 Step 5: InfluxDB Setup

```sql
-- influxdb-setup.sql
-- Create necessary databases for Sample Building

-- Create UIControlCommands entry for equipment
INSERT INTO UIControlCommands 
(equipmentId, locationId, userId, command, userName, priority, enabled, tempSetpoint)
VALUES 
('SAMPLE_BOILER_001', '6', 'admin', 'APPLY_CONTROL_SETTINGS', 'System Admin', 1, true, 140);

-- Create EquipmentConfig entries
INSERT INTO EquipmentConfig
(equipmentId, locationId, equipmentType, designCapacity, minModulation, maxTemp)
VALUES 
('SAMPLE_BOILER_001', '6', 'boiler', 400000, 25, 180),
('SAMPLE_BOILER_002', '6', 'boiler', 400000, 25, 180),
('SAMPLE_PUMP_001', '6', 'pump', 120, 30, 100),
('SAMPLE_PUMP_002', '6', 'pump', 120, 30, 100);
```

## 📊 Step 6: Node-RED Metric Flows

Example Node-RED flow for sending boiler metrics:

```json
// node-red-flows/boiler-metrics.json
[
  {
    "id": "sample-boiler-1",
    "type": "inject",
    "z": "sample-building-flow",
    "name": "Sample Boiler 1 Metrics",
    "props": [
      {
        "p": "payload"
      }
    ],
    "repeat": "30",
    "crontab": "",
    "once": false,
    "onceDelay": 0.1,
    "topic": "",
    "payload": "",
    "payloadType": "date",
    "x": 160,
    "y": 100,
    "wires": [
      [
        "sample-boiler-function"
      ]
    ]
  },
  {
    "id": "sample-boiler-function",
    "type": "function",
    "z": "sample-building-flow",
    "name": "Sample Boiler Data",
    "func": "// Sample Building Boiler 1 Metrics\nconst locationName = \"SampleBuilding\";\nconst systemName = \"Sample-Boiler-1\";\nconst locationId = \"6\";\nconst equipmentId = \"SAMPLE_BOILER_001\";\n\n// Generate sample metrics\nconst h20Supply = 140 + Math.random() * 20; // 140-160°F\nconst h20Return = h20Supply - (5 + Math.random() * 10); // 5-15°F delta\nconst outdoorTemp = 50 + Math.random() * 30; // 50-80°F\nconst firing = Math.random() > 0.3; // 70% chance firing\nconst isEnabled = true;\nconst isLead = true;\n\n// Build InfluxDB line protocol\nconst lineProtocol = `metrics,` +\n    `location=${locationName},` +\n    `system=${systemName},` +\n    `equipment_type=boiler,` +\n    `location_id=${locationId},` +\n    `equipmentId=${equipmentId} ` +\n    `H20Supply=${h20Supply.toFixed(1)},` +\n    `H20Return=${h20Return.toFixed(1)},` +\n    `Outdoor_Air=${outdoorTemp.toFixed(1)},` +\n    `Firing=${firing},` +\n    `IsEnabled=${isEnabled},` +\n    `IsLead=${isLead},` +\n    `source=\"SampleBuilding\"`;\n\nmsg = {\n    url: \"http://localhost:8181/api/v3/write_lp?db=Locations&precision=nanosecond\",\n    method: \"POST\",\n    headers: { \"Content-Type\": \"text/plain\" },\n    payload: lineProtocol\n};\n\nreturn msg;",
    "outputs": 1,
    "noerr": 0,
    "initialize": "",
    "finalize": "",
    "libs": [],
    "x": 380,
    "y": 100,
    "wires": [
      [
        "http-request"
      ]
    ]
  },
  {
    "id": "http-request",
    "type": "http request",
    "z": "sample-building-flow",
    "name": "Send to InfluxDB",
    "method": "use",
    "ret": "txt",
    "paytoqs": "ignore",
    "url": "",
    "tls": "",
    "persist": false,
    "proxy": "",
    "authType": "",
    "x": 580,
    "y": 100,
    "wires": [
      [
        "debug"
      ]
    ]
  }
]
```

## 🚀 Step 7: Deployment Instructions

### 1. Create Directory Structure
```bash
# Create location directory
sudo mkdir -p /opt/productionapp/dist/lib/equipment-logic/locations/sample-building

# Copy equipment logic files
sudo cp equipment-logic/*.js /opt/productionapp/dist/lib/equipment-logic/locations/sample-building/

# Copy location processor
sudo cp location-processor.ts /opt/productionapp/lib/workers/location-processors/sample-building-processor.ts
```

### 2. Build TypeScript
```bash
cd /opt/productionapp
npm run build:workers
```

### 3. Start with PM2
```bash
# Start the location processor
pm2 start ecosystem.config.js

# Check status
pm2 status

# View logs
pm2 logs sample-building-processor
```

### 4. Verify Operation
```bash
# Check equipment logic queue
redis-cli LLEN "bull:equipment-logic-6:waiting"

# Check for processed commands
curl "http://localhost:8181/api/v3/query_sql" \
  -H "Content-Type: application/json" \
  -d '{
    "q": "SELECT * FROM NeuralControlCommands WHERE location_id = '\''6'\'' ORDER BY time DESC LIMIT 10",
    "db": "NeuralControlCommands"
  }'
```

## 🔍 Step 8: Testing Your Setup

### Test Equipment Processing
```bash
# Monitor equipment processing
tail -f /root/.pm2/logs/sample-building-processor-out.log

# Send test UI command
curl "http://localhost:3000/api/equipment/SAMPLE_BOILER_001/command" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "command": "APPLY_CONTROL_SETTINGS",
    "equipmentName": "Sample-Boiler-1",
    "equipmentType": "boiler",
    "locationId": "6",
    "locationName": "Sample Building",
    "settings": {
      "enabled": true,
      "tempSetpoint": 150
    },
    "userId": "test_user",
    "userName": "Test User"
  }'
```

### Verify Equipment State
```bash
# Check Redis state
redis-cli GET "equipment:SAMPLE_BOILER_001:state"

# Check InfluxDB metrics
curl "http://localhost:8181/api/v3/query_sql" \
  -H "Content-Type: application/json" \
  -d '{
    "q": "SELECT * FROM metrics WHERE equipmentId = '\''SAMPLE_BOILER_001'\'' ORDER BY time DESC LIMIT 5",
    "db": "Locations"
  }'
```

## 📈 Step 9: Monitoring and Maintenance

### PM2 Monitoring
```bash
# Monitor all processes
pm2 monit

# Restart if needed
pm2 restart sample-building-processor

# View detailed logs
pm2 logs sample-building-processor --lines 50
```

### Performance Monitoring
```bash
# Check queue performance
redis-cli INFO | grep bull

# Monitor memory usage
pm2 show sample-building-processor
```

## 🔧 Step 10: Customization Guide

### Adding New Equipment Types

1. **Update Equipment Registry**: Add new equipment to `SAMPLE_BUILDING_EQUIPMENT`
2. **Create Equipment Logic**: Add new `.js` file in `equipment-logic/`
3. **Update Location Processor**: Equipment will be auto-discovered from registry
4. **Test and Deploy**: Follow deployment steps above

### Modifying Control Logic

1. **Edit Equipment Files**: Modify logic in `equipment-logic/*.js` files
2. **Rebuild**: Run `npm run build:workers`
3. **Restart**: `pm2 restart sample-building-processor`

### Scaling to Multiple Locations

1. **Copy Template**: Use this example as template for new locations
2. **Change Location ID**: Update all location IDs and names
3. **Deploy Separately**: Each location runs as independent PM2 process

## 📚 Key Learning Outcomes

After completing this example, you'll understand:

✅ **Location Architecture**: How to structure a complete building location  
✅ **Equipment Registry**: How to configure and manage multiple equipment types  
✅ **Smart Queue Logic**: How equipment processing decisions are made  
✅ **4-Parameter Interface**: How to implement equipment control algorithms  
✅ **Lead-Lag Coordination**: How to coordinate paired equipment systems  
✅ **Database Integration**: How metrics and commands flow through the system  
✅ **PM2 Management**: How to deploy and monitor location processes  
✅ **Node-RED Integration**: How to send equipment metrics to the system  

This example provides a complete foundation for building your own custom locations with the Automata Controls Nexus BMS system! 🏗️
