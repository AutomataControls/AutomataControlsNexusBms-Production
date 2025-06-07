# Automata Controls Nexus BMS - Technical Documentation

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Data Models](#data-models)
3. [InfluxDB 3.0 Integration](#influxdb-30-integration)
4. [BullMQ Job Queue System](#bullmq-job-queue-system)
5. [Worker Architecture](#worker-architecture)
6. [API Reference](#api-reference)
7. [Equipment Logic System](#equipment-logic-system)
8. [Authentication System](#authentication-system)
9. [Email Notification System](#email-notification-system)
10. [Real-time Data Flow](#real-time-data-flow)
11. [Integration Examples](#integration-examples)
12. [Performance & Monitoring](#performance--monitoring)

## System Architecture

### Overview

Automata Controls Nexus BMS is built on a modern microservices architecture using **InfluxDB 3.0** as the primary time-series database, **BullMQ** for job queue management, and **location-specific workers** for intelligent equipment processing.

### Core Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend Layer                           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │   Next.js   │ │   React     │ │  Dashboard  │ │   Mobile    ││
│  │   Server    │ │   Client    │ │   Controls  │ │   PWA       ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
└─────────────────────────────────────────────────────────────────┘
           │                │                │                │
           ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API Layer                               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │  Equipment  │ │   InfluxDB  │ │    Email    │ │   Control   ││
│  │  Commands   │ │   Queries   │ │ Notifications│ │   Status    ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
└─────────────────────────────────────────────────────────────────┘
           │                │                │                │
           ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Processing Layer                           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │  Enhanced   │ │   Location  │ │   Logic     │ │    Data     ││
│  │ Equipment   │ │ Processors  │ │  Factory    │ │  Factory    ││
│  │  Worker     │ │  (Per Site) │ │  Workers    │ │  Workers    ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
└─────────────────────────────────────────────────────────────────┘
           │                │                │                │
           ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Data Layer                               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │  InfluxDB   │ │    Redis    │ │  Firebase   │ │   Node-RED  ││
│  │   3.0 Core  │ │   + BullMQ  │ │  (Auth/RT)  │ │ (Metrics)   ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
└─────────────────────────────────────────────────────────────────┘
           │                │                │                │
           ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Equipment Layer                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │   Boilers   │ │    Pumps    │ │ Fan Coils   │ │   Chillers  ││
│  │   (HVAC)    │ │ (Lead-Lag)  │ │  (Zones)    │ │ (Cooling)   ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow Architecture

**Command Flow (UI → Equipment):**
```
User Interface → API Route → BullMQ Queue → Enhanced Worker → InfluxDB → Location Processor → Equipment Logic → NeuralControlCommands
```

**Metrics Flow (Equipment → UI):**
```
Physical Equipment → Node-RED → InfluxDB API → Metrics Storage → Dashboard API → Real-time UI
```

### Multi-Location Architecture

Each location operates independently with dedicated workers:

```
Location Architecture:
├── Heritage Pointe (ID: 4) - Huntington
│   ├── huntington-processor.ts (Location management)
│   ├── huntington-logic-factory.js (Equipment processing)
│   └── huntington-data-factory.js (Analytics)
├── Warren (ID: 1)
│   ├── warren-processor.ts
│   ├── warren-logic-factory.js
│   └── warren-data-factory.js
├── First Church of God (ID: 9)
│   ├── firstchurch-processor.ts
│   ├── firstchurch-logic-factory.js
│   └── firstchurch-data-factory.js
└── [Additional Locations...]
```

## Data Models

### InfluxDB 3.0 Database Structure

The system uses **5 specialized InfluxDB databases**:

```sql
-- Database 1: Equipment Metrics
Locations
├── Measurement: metrics
├── Tags: equipmentId, location_id, equipment_type
└── Fields: temperature readings, pressures, flows, status

-- Database 2: User Interface Commands  
UIControlCommands
├── Measurement: UIControlCommands
├── Tags: equipmentId, locationId, userId, command
└── Fields: userName, priority, settings (enabled, setpoints, etc.)

-- Database 3: AI-Generated Commands
NeuralControlCommands  
├── Measurement: NeuralCommands
├── Tags: equipment_id, location_id, command_type, source
└── Fields: value (command data)

-- Database 4: Equipment Configuration
EquipmentConfig
├── Measurement: EquipmentConfig
├── Tags: equipmentId, locationId, equipmentType
└── Fields: configuration parameters

-- Database 5: Legacy Control Commands (if used)
ControlCommands
├── Measurement: ControlCommands  
├── Tags: equipmentId, locationId
└── Fields: control parameters
```

### Equipment Data Structure

**Boiler Equipment Example:**
```json
{
  "equipmentId": "ZLYR6YveSmCEMqtBSy3e",
  "name": "Comfort-Boiler-1", 
  "type": "boiler",
  "system": "comfort",
  "locationId": "4",
  "liveMetrics": {
    "H20Supply": 111.47,
    "H20Return": 95.2,
    "Outdoor_Air": 65.12,
    "Firing": false,
    "IsEnabled": true,
    "IsLead": true
  },
  "controlOutputs": {
    "unitEnable": true,
    "firing": false,
    "waterTempSetpoint": 96.5,
    "isLead": true,
    "leadLagGroupId": "huntington-comfort-boilers",
    "safetyShutoff": false
  }
}
```

### Location Configuration

**Location Registry Example:**
```javascript
const LOCATION_MAPPING = {
  "1": "Warren",
  "4": "Heritage Pointe of Huntington", 
  "5": "Hopebridge Autism Center",
  "8": "Element Labs",
  "9": "First Church of God",
  "10": "NE Realty Group"
}
```

## InfluxDB 3.0 Integration

### Database Configuration

```typescript
interface InfluxDBConfig {
  url: string;                    // http://143.198.162.31:8181
  token: string;                  // Authentication token
  org: string;                    // Organization name
  databases: {
    metrics: string;              // "Locations"
    uiCommands: string;           // "UIControlCommands" 
    neuralCommands: string;       // "NeuralControlCommands"
    equipmentConfig: string;      // "EquipmentConfig"
    controlCommands: string;      // "ControlCommands"
  };
}
```

### Advanced Query Patterns

**Equipment Metrics Query:**
```sql
SELECT * 
FROM metrics 
WHERE equipmentId = 'ZLYR6YveSmCEMqtBSy3e' 
  AND location_id = '4'
  AND time >= now() - INTERVAL '15 minutes'
ORDER BY time DESC 
LIMIT 100
```

**Control Commands Query:**
```sql
SELECT equipment_id, command_type, value, time
FROM NeuralCommands  
WHERE location_id = '4'
  AND time >= now() - INTERVAL '5 minutes'
  AND source = 'huntington-logic-factory'
ORDER BY time DESC
```

**UI Commands Detection:**
```sql
SELECT * 
FROM UIControlCommands
WHERE equipmentId = 'ZLYR6YveSmCEMqtBSy3e'
  AND time >= now() - INTERVAL '5 minutes'
ORDER BY time DESC
LIMIT 1
```

### Line Protocol Format

**Metrics Writing:**
```
metrics,location=HeritageHuntington,system=Comfort-Boiler-1,equipment_type=boiler,location_id=4,equipmentId=ZLYR6YveSmCEMqtBSy3e H20Supply=111.47,H20Return=95.2,Outdoor_Air=65.12,Firing=false,IsEnabled=true,IsLead=true,source="NeuralBms"
```

**Command Writing:**
```
NeuralCommands,equipment_id=ZLYR6YveSmCEMqtBSy3e,location_id=4,command_type=waterTempSetpoint,equipment_type=boiler,source=huntington-logic-factory,status=active value="96.5"
```

## BullMQ Job Queue System

### Queue Architecture

```typescript
// Queue Configuration
const queueConfig = {
  'equipment-controls': {
    concurrency: 5,
    removeOnComplete: 50,
    removeOnFail: 20,
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 }
  },
  'equipment-logic-4': {  // Huntington location
    concurrency: 3,
    removeOnComplete: 10, 
    removeOnFail: 5,
    stalledInterval: 300000
  }
}
```

### Job Processing Flow

**1. Equipment Command Job:**
```javascript
// User triggers equipment command
const job = await equipmentQueue.add('process-boiler', {
  equipmentId: 'ZLYR6YveSmCEMqtBSy3e',
  locationId: '4',
  command: 'APPLY_CONTROL_SETTINGS',
  settings: { tempSetpoint: 150, enabled: true },
  userId: 'user123',
  userName: 'John Smith',
  priority: 10
});
```

**2. Job Processing Steps:**
```javascript
// Enhanced Equipment Worker processes job
worker.process(async (job) => {
  // Step 1: Save to UIControlCommands (Progress: 40%)
  await saveToUIControlCommands(job.data);
  
  // Step 2: Update Redis state (Progress: 70%) 
  await updateRedisState(job.data);
  
  // Step 3: Log audit trail (Progress: 100%)
  await logCommandToNeuralControlCommands(job.data);
});
```

### Smart Queue Logic

**Priority-Based Processing:**
```javascript
const shouldProcessEquipment = async (equipmentId, equipmentType) => {
  // Priority 1: Safety conditions (Priority 20)
  const hasSafety = await checkSafetyConditions(equipmentId);
  if (hasSafety) return { process: true, priority: 20 };
  
  // Priority 2: Temperature deviation (Priority 15)
  const tempDeviation = await checkTemperatureDeviation(equipmentId);
  if (tempDeviation.hasDeviation) return { process: true, priority: 15 };
  
  // Priority 3: UI commands (Priority 10)
  const hasUICommands = await checkRecentUICommands(equipmentId);
  if (hasUICommands) return { process: true, priority: 10 };
  
  // Priority 4: Maximum stale time (Priority 1)
  const isStale = checkMaxStaleTime(equipmentId, equipmentType);
  if (isStale) return { process: true, priority: 1 };
  
  return { process: false, reason: 'No significant changes' };
};
```

## Worker Architecture

### Enhanced Equipment Worker

**Purpose:** Processes UI commands and maintains equipment state

```typescript
// File: /dist/workers/enhanced-equipment-worker.ts
class EnhancedEquipmentWorker {
  private concurrency = 5;
  private queues = ['equipment-controls'];
  
  async processCommand(job: Job) {
    const { equipmentId, locationId, command, settings } = job.data;
    
    // Multi-database write strategy
    await Promise.all([
      this.writeUICommand(equipmentId, settings),
      this.updateRedisState(equipmentId, settings), 
      this.logAuditTrail(equipmentId, command)
    ]);
    
    return { success: true, processingTime: Date.now() - job.timestamp };
  }
}
```

### Location Processors

**Purpose:** Intelligent equipment scheduling per location

```typescript
// File: /dist/workers/location-processors/huntington-processor.ts
class HuntingtonLocationProcessor {
  private equipmentConfig = {
    'comfort-boiler-1': { interval: 120000, maxStaleTime: 180000 },
    'hw-pump-1': { interval: 30000, maxStaleTime: 120000 },
    'fan-coil-1': { interval: 30000, maxStaleTime: 45000 }
  };
  
  async evaluateEquipment(equipmentType: string) {
    const shouldProcess = await this.smartProcessingDecision(equipmentType);
    
    if (shouldProcess.process) {
      await this.queueEquipmentJob(equipmentType, shouldProcess.priority);
    }
  }
}
```

### Logic Factory Workers

**Purpose:** Execute equipment-specific control algorithms

```typescript
// File: /dist/workers/logic-factories/huntington-logic-factory.js
class HuntingtonLogicFactory {
  private equipmentPath = '/opt/productionapp/dist/lib/equipment-logic/locations/huntington';
  
  async processEquipment(job) {
    const { equipmentId, type } = job.data;
    
    // Load equipment-specific logic
    const equipmentModule = require(`${this.equipmentPath}/${type}.js`);
    
    // Execute 4-parameter interface
    const results = await equipmentModule.processEquipment(
      metricsInput,    // From InfluxDB
      settingsInput,   // Equipment config
      currentTemp,     // Control temperature  
      stateStorage     // PID/control state
    );
    
    // Write results to NeuralControlCommands
    await this.writeResults(equipmentId, results);
  }
}
```

### Data Factory Workers

**Purpose:** Analytics and performance processing

```typescript
// File: /dist/workers/data-factories/huntington-data-factory.js
class HuntingtonDataFactory {
  private equipmentRegistry = {
    COMFORT_BOILERS: { /* boiler configs */ },
    HW_PUMPS: { /* pump configs */ },
    FAN_COILS: { /* fan coil configs */ }
  };
  
  async processLocationData(huntingtonData) {
    const results = {
      equipment: this.processEquipmentData(huntingtonData),
      leadLagStatus: this.calculateLeadLagStatus(),
      systemEfficiency: this.calculateOverallEfficiency(),
      alerts: this.generateSystemAlerts()
    };
    
    return results;
  }
}
```

## API Reference

### Equipment Command API

**POST** `/api/equipment/[id]/command`

Send control commands to equipment.

```typescript
interface CommandRequest {
  command: string;                    // "APPLY_CONTROL_SETTINGS"
  equipmentName: string;              // "Comfort-Boiler-1"
  equipmentType: string;              // "boiler"
  locationId: string;                 // "4"
  locationName: string;               // "Heritage Pointe"
  settings: {
    enabled?: boolean;
    tempSetpoint?: number;
    isLead?: boolean;
    // ... other settings
  };
  userId: string;
  userName: string;
  priority?: number;
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "job-12345",
  "message": "Command queued successfully"
}
```

### Equipment State API

**GET** `/api/equipment/[id]/state`

Get current equipment state from Redis cache.

**Response:**
```json
{
  "equipmentId": "ZLYR6YveSmCEMqtBSy3e",
  "lastModified": "2025-06-07T10:30:45Z",
  "lastModifiedBy": "John Smith",
  "command": "APPLY_CONTROL_SETTINGS",
  "settings": {
    "enabled": true,
    "tempSetpoint": 150,
    "isLead": true
  }
}
```

### Job Status API

**GET** `/api/equipment/[id]/status/[jobId]`

Check command processing status.

**Response:**
```json
{
  "jobId": "job-12345",
  "status": "completed",
  "progress": 100,
  "result": {
    "success": true,
    "processingTime": 1250
  }
}
```

### InfluxDB Query API

**POST** `/api/influx/control-data`

Query equipment metrics and control outputs.

```typescript
interface ControlDataRequest {
  locationIds: string[];              // ["4"]
  timeRange: string;                  // "5m", "1h", "24h"
  equipmentIds?: string[];            // Optional filter
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "equipmentId": "ZLYR6YveSmCEMqtBSy3e",
      "name": "Comfort-Boiler-1",
      "liveMetrics": {
        "H20Supply": 111.47,
        "H20Return": 95.2,
        "Firing": false
      },
      "controlOutputs": {
        "unitEnable": true,
        "waterTempSetpoint": 96.5,
        "isLead": true
      }
    }
  ]
}
```

### Email Notification API

**POST** `/api/send-alarm-email`

Send alarm notifications.

```typescript
interface AlarmEmailRequest {
  alarmType: string;                  // "High Temperature Alert"
  severity: "info" | "warning" | "critical";
  details: string;                    // Alarm description
  locationId: string;                 // "4"
  locationName?: string;              // "Heritage Pointe"
  equipmentName?: string;             // "Comfort-Boiler-1"
  alarmId: string;                    // "ALM-12345"
  assignedTechs?: string;             // "John Smith"
  recipients: string[];               // ["tech@company.com"]
}
```

## Equipment Logic System

### 4-Parameter Interface

All equipment logic implements a standardized interface:

```javascript
function processEquipment(metricsInput, settingsInput, currentTempArgument, stateStorageInput) {
  // metricsInput: Real-time sensor data from InfluxDB
  // settingsInput: Equipment configuration and setpoints
  // currentTempArgument: Control temperature (equipment-specific)
  // stateStorageInput: PID control state and operational data
  
  return [
    {
      // Control outputs to write to NeuralControlCommands
      unitEnable: true,
      waterTempSetpoint: 96.5,
      isLead: true,
      // ... other commands
    }
  ];
}
```

### Equipment Logic Examples

**Boiler Control Logic:**
```javascript
// File: /lib/equipment-logic/locations/huntington/boiler.js
function processBoiler(metricsInput, settingsInput, currentTemp, state) {
  const supplyTemp = parseFloat(metricsInput.H20Supply || 0);
  const outdoorTemp = parseFloat(currentTemp || 70);
  
  // Calculate OAR setpoint
  const targetTemp = calculateOARSetpoint(outdoorTemp, 140, 180, 70, 20);
  
  // Lead-lag logic
  const isLead = settingsInput.equipmentId === 'ZLYR6YveSmCEMqtBSy3e';
  
  // Safety checks
  const safetyShutoff = supplyTemp > 185;
  
  return [{
    unitEnable: !safetyShutoff,
    firing: (targetTemp - supplyTemp) > 2.0,
    waterTempSetpoint: targetTemp,
    isLead: isLead,
    leadLagGroupId: 'huntington-comfort-boilers',
    safetyShutoff: safetyShutoff
  }];
}
```

**Pump Control Logic:**
```javascript
// File: /lib/equipment-logic/locations/huntington/pumps.js
function processPump(metricsInput, settingsInput, currentTemp, state) {
  const pressure = parseFloat(metricsInput.pressure || 0);
  const isLead = settingsInput.equipmentId === 'oh5Bz2zzIcuT9lFoogvi';
  
  // Variable speed based on pressure
  let pumpSpeed = 75;
  if (pressure < 20) pumpSpeed = Math.min(100, pumpSpeed + 10);
  if (pressure > 35) pumpSpeed = Math.max(30, pumpSpeed - 10);
  
  return [{
    pumpEnable: true,
    pumpSpeed: pumpSpeed,
    isLead: isLead,
    leadLagGroupId: 'huntington-hw-pumps'
  }];
}
```

## Authentication System

### Firebase Authentication

```typescript
interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  databaseURL: string;
  // ... other Firebase config
}
```

### Role-Based Access Control

```typescript
enum UserRole {
  ADMIN = "admin",
  TECHNICIAN = "technician", 
  OPERATOR = "operator",
  VIEWER = "viewer"
}

const checkPermissions = (user: User, action: string) => {
  switch (action) {
    case 'equipment_control':
      return ['admin', 'technician', 'operator'].includes(user.role);
    case 'system_settings':
      return ['admin'].includes(user.role);
    case 'view_data':
      return ['admin', 'technician', 'operator', 'viewer'].includes(user.role);
  }
};
```

## Email Notification System

### React Email Templates

```tsx
// File: /emails/alarm-notification.tsx
export const AlarmNotification = ({
  alarmType,
  severity,
  locationName,
  equipmentName,
  isTechnician = false
}: AlarmNotificationProps) => {
  const severityColor = getSeverityColor(severity);
  
  return (
    <Html>
      <Body style={main}>
        <Container style={container}>
          <Text style={{ color: severityColor }}>
            {severity.toUpperCase()} ALARM
          </Text>
          <Text>{alarmType}</Text>
          <Text>Location: {locationName}</Text>
          <Text>Equipment: {equipmentName}</Text>
          
          {isTechnician && (
            <Button href={dashboardUrl}>
              View in Dashboard
            </Button>
          )}
        </Container>
      </Body>
    </Html>
  );
};
```

### Email Service Integration

```typescript
// Using Resend for email delivery
const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  from: "Building Management <alerts@yourdomain.com>",
  to: recipient,
  subject: `ALERT: ${severity.toUpperCase()} - ${alarmType}`,
  react: AlarmNotification({ /* props */ })
});
```

## Real-time Data Flow

### Metrics Collection

**Node-RED to InfluxDB Flow:**
```javascript
// Node-RED function node
const locationName = "HeritageHuntington";
const equipmentId = "ZLYR6YveSmCEMqtBSy3e";
const h20Supply = 111.47;
const firing = false;

const lineProtocol = `metrics,location=${locationName},equipmentId=${equipmentId} H20Supply=${h20Supply},Firing=${firing}`;

msg = {
  url: "http://143.198.162.31:8181/api/v3/write_lp?db=Locations",
  method: "POST", 
  headers: { "Content-Type": "text/plain" },
  payload: lineProtocol
};

return msg;
```

### Dashboard Updates

**Real-time Data Fetching:**
```typescript
// Auto-refresh every 60 seconds
useEffect(() => {
  const fetchData = async () => {
    const response = await fetch('/api/influx/control-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locationIds: ['4'],
        timeRange: '5m'
      })
    });
    
    const data = await response.json();
    setEquipmentData(data.data);
  };
  
  const interval = setInterval(fetchData, 60000);
  return () => clearInterval(interval);
}, []);
```

## Integration Examples

### Node-RED Equipment Integration

**Boiler Metrics Collection:**
```javascript
// Node-RED function for boiler data
const boilerData = {
  locationName: "HeritageHuntington",
  systemName: "Comfort-Boiler-1", 
  equipmentId: "ZLYR6YveSmCEMqtBSy3e",
  H20Supply: global.get("boiler1_supply_temp") || 0,
  H20Return: global.get("boiler1_return_temp") || 0,
  Firing: global.get("boiler1_firing") || false,
  IsEnabled: global.get("boiler1_enabled") || false,
  IsLead: true
};

const lineProtocol = `metrics,location=${boilerData.locationName},system=${boilerData.systemName},equipmentId=${boilerData.equipmentId} H20Supply=${boilerData.H20Supply},H20Return=${boilerData.H20Return},Firing=${boilerData.Firing},IsEnabled=${boilerData.IsEnabled},IsLead=${boilerData.IsLead}`;
```

### Equipment Command Integration

**Sending Commands from External Systems:**
```javascript
// External system integration
const sendEquipmentCommand = async (equipmentId, settings) => {
  const response = await fetch(`/api/equipment/${equipmentId}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      command: 'APPLY_CONTROL_SETTINGS',
      equipmentName: 'Comfort-Boiler-1',
      equipmentType: 'boiler',
      locationId: '4',
      settings: settings,
      userId: 'external_system',
      userName: 'Automation System'
    })
  });
  
  return response.json();
};
```

## Performance & Monitoring

### System Performance Metrics

**Current Performance (Post-Optimization):**
- **Processing Speed:** 1-2 seconds (99% improvement from 2+ minutes)
- **Queue Processing:** Millisecond job execution
- **Memory Usage:** ~625MB total across all processes  
- **API Response:** 30-50ms average
- **Success Rate:** 100% job completion

### PM2 Process Management

```bash
# Production process configuration
pm2 start ecosystem.config.js

# Monitor all processes
pm2 monit

# Check specific location
pm2 logs huntington-processor --lines 20
```

### Monitoring Commands

```bash
# System health check
curl -w "Response Time: %{time_total}s\n" \
  -X POST http://143.198.162.31:3000/api/influx/control-data \
  -H "Content-Type: application/json" \
  -d '{"locationIds":["4"],"timeRange":"5m"}'

# Check queue status
redis-cli LLEN "bull:equipment-logic-4:waiting"

# Memory and CPU monitoring
free -h && top -bn1 | grep "Cpu(s)"
```

### Key Performance Indicators

```typescript
// Performance tracking
interface SystemMetrics {
  processingTime: number;         // Average job processing time (ms)
  queueLength: number;            // Active jobs in queue
  successRate: number;            // Percentage of successful jobs
  memoryUsage: number;            // Total system memory (MB)
  apiResponseTime: number;        // API endpoint response time (ms)
  equipmentOnline: number;        // Number of online equipment units
}
```

This architecture delivers **enterprise-grade performance** with **99% speed improvements**, **fault-tolerant processing**, and **real-time control capabilities** across multiple building locations! 🏭⚡🎯
