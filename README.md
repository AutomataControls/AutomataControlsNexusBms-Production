![Automata Controls Logo](neural-loader.png)

# Automata Controls Nexus BMS - Enterprise Building Management System

[![MIT License](https://img.shields.io/badge/license-MIT-brightgreen?style=for-the-badge)](LICENSE)
[![Node.js](https://img.shields.io/badge/node.js-20.x-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Redis](https://img.shields.io/badge/redis-6.x-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![InfluxDB 3.0](https://img.shields.io/badge/influxdb-3.0-22ADF6?style=for-the-badge&logo=influxdb&logoColor=white)](https://www.influxdata.com/)
[![Processing Engine](https://img.shields.io/badge/processing-engine-FF6B35?style=for-the-badge&logo=influxdb&logoColor=white)](https://docs.influxdata.com/influxdb3/core/process-data/)
[![Firebase](https://img.shields.io/badge/firebase-auth-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![React](https://img.shields.io/badge/react-Next.js-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://nextjs.org/)
[![PWA](https://img.shields.io/badge/pwa-ready-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![PM2](https://img.shields.io/badge/pm2-managed-2B037A?style=for-the-badge&logo=pm2&logoColor=white)](https://pm2.keymetrics.io/)
[![TypeScript](https://img.shields.io/badge/typescript-4.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![BullMQ](https://img.shields.io/badge/bullmq-queue-FF6B6B?style=for-the-badge)](https://bullmq.io/)

## 🏢 Overview

Automata Controls Nexus BMS is a production-ready, enterprise-grade Building Management System (BMS) built with modern web technologies. It provides real-time monitoring, intelligent control, and distributed processing for industrial HVAC equipment across multiple locations.

> **Powered by InfluxDB 3.0 Processing Engine** - Leveraging the power of next-generation time-series data platform with event-driven equipment control for lightning-fast analytics, real-time processing, and unparalleled scalability.

## 📸 Screenshots & Features

### 🎛️ Real-time Equipment Control Dashboard
![Dashboard Overview](docs/images/dashboard-overview.png)
*Live monitoring of HVAC equipment with real-time metrics and control capabilities*

### 🔧 Advanced Equipment Controls
![Equipment Controls](docs/images/equipment-controls.png)
*Intuitive control interfaces for boilers, chillers, air handlers, and pumps*

### 📊 InfluxDB 3.0 Analytics
![Analytics Dashboard](docs/images/analytics-dashboard.png)
*Powerful time-series analytics with sub-second query performance*

### 🏗️ Multi-Location Management
![Location Management](docs/images/location-management.png)
*Distributed processing across multiple facilities with centralized monitoring*

### 🌟 Key Features

- **Real-time Equipment Control** - Live monitoring and control of boilers, chillers, air handlers, pumps, and more
- **InfluxDB3 Processing Engine** - Event-driven HVAC control with sub-second response times and zero connection leaks
- **Distributed Architecture** - Independent location processors for fault tolerance and scalability
- **InfluxDB 3.0 Integration** - Lightning-fast time-series data storage with columnar architecture and Apache Arrow
- **Intelligent Equipment Logic** - Sophisticated PID control, lead-lag coordination, and OAR (Outdoor Air Reset) calculations
- **Cross-User Synchronization** - Redis-based state management for multi-user environments
- **Enterprise Reliability** - BullMQ job queues, error handling, and automatic failover
- **Modern PWA Interface** - React/Next.js responsive web application with offline capabilities
- **Multi-Database Integration** - InfluxDB3 for time-series data, Firebase for authentication and real-time updates

## 🚀 InfluxDB 3.0 Processing Engine

Automata Controls Nexus BMS leverages the cutting-edge **InfluxDB 3.0 Processing Engine** for revolutionary equipment control capabilities:

### ⚡ Event-Driven Equipment Control

Our **Automata Controls Nexus InfluxDB3 Plugin** transforms traditional polling-based control into real-time, event-driven automation:

```python
# Automata Controls Nexus InfluxDB3 Processing Engine Plugin
# Event-driven HVAC control with zero connection leaks
def process_writes(influxdb3_local, table_batches, args=None):
    for table_batch in table_batches:
        if table_batch["table_name"] == "metrics":
            # Real-time equipment logic triggered by sensor data
            for row in table_batch["rows"]:
                equipment_commands = process_hvac_equipment(row)
                write_control_commands(influxdb3_local, equipment_commands)
```

### 🏗️ Processing Engine Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Sensor Data   │───►│  InfluxDB3      │───►│  Processing     │
│   (Real-time)   │    │  Metrics Table  │    │  Engine Plugin  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Equipment     │◄───│  Control        │◄───│  HVAC Logic     │
│   (Immediate)   │    │  Commands       │    │  (Event-based)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 🎯 Processing Engine Benefits

| Traditional Factories | InfluxDB3 Processing Engine |
|----------------------|----------------------------|
| ❌ Polling every 30-60s | ✅ Real-time event triggers |
| ❌ Connection leaks (400+) | ✅ Zero connection leaks |
| ❌ 20-30 minute delays | ✅ Sub-second response times |
| ❌ 6 separate processes | ✅ Single event-driven system |
| ❌ Resource intensive | ✅ Lightweight and efficient |

### 🔧 Dual-Run Capabilities

The system supports **dual-run operation** for safe migration:

```bash
# Production System (Port 8181)
pm2 status | grep factory
├── Warren Factory: ✅ Running (Traditional)
├── Huntington Factory: ✅ Running (Traditional)
└── Location Factories: ✅ Running (Traditional)

# Processing Engine (Port 8182)
influxdb3 list triggers
└── Automata Controls Nexus Plugin: ✅ Active (Event-driven)
```

### 📊 InfluxDB 3.0 Advantages
- **Columnar Storage** - Apache Parquet format for 10x better compression and query performance
- **Apache Arrow** - In-memory analytics with zero-copy data access
- **SQL Compatibility** - Standard SQL queries alongside InfluxQL for maximum flexibility
- **Unlimited Cardinality** - Handle millions of unique series without performance degradation
- **Real-time Analytics** - Sub-second query responses for live equipment monitoring
- **Event-Driven Processing** - Trigger equipment control automatically when sensor data arrives

### 🏗️ Database Architecture
```
Equipment Sensors → InfluxDB 3.0 Databases
                   ├── UIControlCommands (User actions)
                   ├── NeuralControlCommands (AI-generated commands)
                   ├── EquipmentConfig (Configuration data)
                   ├── Locations (Time-series metrics)
                   └── ProcessingEngineCommands (Event-driven commands)
```

### 📈 Performance Benefits
- **10-100x faster queries** compared to InfluxDB 1.x
- **Real-time response** - Equipment responds immediately to sensor changes
- **Massive scale** - Handle petabytes of equipment data
- **Real-time insights** - Live equipment performance analytics
- **Cost efficiency** - Reduced storage costs through superior compression
- **Zero connection leaks** - Eliminates connection pooling issues permanently

## 🏗️ System Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React PWA     │    │  Enhanced       │    │  Location       │
│   (Next.js)     │◄──►│  Equipment      │◄──►│  Processors     │
│                 │    │  Worker         │    │  (Multiple)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Firebase      │    │   Redis +       │    │   InfluxDB3     │
│   (Auth/RTDB)   │    │   BullMQ        │    │   (Time-series) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
                               ┌─────────────────┐
                               │  Processing     │
                               │  Engine Plugin  │
                               │ (Event-driven)  │
                               └─────────────────┘
```

### Data Flow
1. **User Interface** → Equipment controls via React PWA
2. **Command Processing** → BullMQ queue → Enhanced Equipment Worker
3. **Database Writes** → UIControlCommands, NeuralControlCommands, EquipmentConfig
4. **Equipment Logic** → Independent location processors execute equipment-specific algorithms
5. **Processing Engine** → Event-driven triggers respond to sensor data automatically
6. **Real-time Updates** → Redis state management for cross-user synchronization

## 🚀 Quick Start

### Prerequisites
- Node.js 20.x+
- Redis 6.x+
- InfluxDB3
- Firebase project

### Installation

1. **Clone and Install**
```bash
git clone https://github.com/AutomataControls/AutomataControlsNexusBms-Production.git
cd AutomataControlsNexusBms-Production
npm install
```

Or using GitHub CLI:
```bash
gh repo clone AutomataControls/AutomataControlsNexusBms-Production
cd AutomataControlsNexusBms-Production
npm install
```

2. **Environment Configuration**
```bash
# Copy environment template
cp .env.example .env

# Configure your environment variables
```

### .env.example Template
```bash
# Firebase Configuration (Replace with your Firebase project details)
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=yourproject.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=yourproject.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://yourproject-default-rtdb.firebaseio.com/

# Firebase Admin SDK Service Account (Replace with your service account JSON)
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"your-project","private_key_id":"your_key_id","private_key":"-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk@yourproject.iam.gserviceaccount.com","client_id":"your_client_id","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk%40yourproject.iam.gserviceaccount.com","universe_domain":"googleapis.com"}

# InfluxDB Configuration
INFLUXDB_URL=http://your-influxdb-server:8181
INFLUXDB_TOKEN=your_influxdb_token
INFLUXDB2_TOKEN=your_influxdb2_token
INFLUXDB_ORG=YourOrganization
INFLUXDB_DATABASE=Locations
INFLUXDB_DATABASE2=ControlCommands
INFLUXDB_DATABASE3=UIControlCommands
INFLUXDB_DATABASE4=EquipmentConfig
INFLUXDB_DATABASE5=NeuralControlCommands
INFLUXDB_COMMANDS_BUCKET=Control
INFLUXDB_LOCATIONS_BUCKET=Locations

# Email Configuration (Optional - for alerts and notifications)
DEFAULT_RECIPIENT=admin@yourcompany.com
EMAIL_USER=notifications@yourcompany.com
EMAIL_PASSWORD=your_email_app_password
RESEND_API_KEY=your_resend_api_key

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Application Security
LOG_VIEWER_KEY=your_secure_log_viewer_key
NEXT_PUBLIC_LOG_VIEWER_KEY=your_secure_log_viewer_key

# Application URLs (Production)
NEXT_PUBLIC_SOCKET_URL=https://yourdomain.com/socket.io
NEXT_PUBLIC_BRIDGE_URL=https://yourdomain.com
NEXT_PUBLIC_FIREBASE_SIGN_IN_REDIRECT_URL=https://yourdomain.com
NEXT_PUBLIC_FIREBASE_SIGN_IN_SUCCESS_URL=https://yourdomain.com/dashboard

# Development URLs (Local Development)
# NEXT_PUBLIC_SOCKET_URL=http://localhost:3000/socket.io
# NEXT_PUBLIC_BRIDGE_URL=http://localhost:3000
# NEXT_PUBLIC_FIREBASE_SIGN_IN_REDIRECT_URL=http://localhost:3000
# NEXT_PUBLIC_FIREBASE_SIGN_IN_SUCCESS_URL=http://localhost:3000/dashboard
```

3. **Database Setup**
```bash
# Create InfluxDB databases
curl -X POST "http://your-influxdb-server:8181/api/v3/write_lp?db=UIControlCommands&precision=nanosecond" \
  -H "Content-Type: text/plain" \
  -d "init_measurement value=1 $(date +%s)000000000"

curl -X POST "http://your-influxdb-server:8181/api/v3/write_lp?db=EquipmentConfig&precision=nanosecond" \
  -H "Content-Type: text/plain" \
  -d "init_measurement value=1 $(date +%s)000000000"

curl -X POST "http://your-influxdb-server:8181/api/v3/write_lp?db=NeuralControlCommands&precision=nanosecond" \
  -H "Content-Type: text/plain" \
  -d "init_measurement value=1 $(date +%s)000000000"
```

4. **Start Development**
```bash
# Build TypeScript workers
npm run build:workers

# Start development server
npm run dev

# Start production with PM2
pm2 start ecosystem.config.js
```

## 🔧 InfluxDB3 Processing Engine Setup

### Enable Processing Engine

1. **Start InfluxDB3 with Processing Engine**
```bash
# Start InfluxDB3 with plugin directory enabled
influxdb3 serve \
  --node-id=node0 \
  --http-bind=0.0.0.0:8181 \
  --object-store=file \
  --data-dir /opt/productionapp/influxdb/data \
  --plugin-dir /opt/productionapp/plugins \
  --without-auth
```

2. **Deploy Automata Controls Nexus Plugin**
```bash
# Create plugin directory
mkdir -p /opt/productionapp/plugins/hvac

# Deploy the Automata Controls Nexus plugin
# (Contact support for the full enterprise plugin)
```

3. **Create Processing Engine Trigger**
```bash
# Create trigger for real-time equipment control
influxdb3 create trigger \
  --trigger-spec "table:metrics" \
  --plugin-filename "hvac/automata_controls_nexus_plugin.py" \
  --database Locations \
  automata_controls_hvac_engine
```

4. **Verify Processing Engine Status**
```bash
# Check trigger status
influxdb3 query \
  --database system \
  "SELECT * FROM processing_engine_triggers"

# Monitor plugin performance
influxdb3 query \
  --database system \
  "SELECT * FROM processing_engine_logs ORDER BY time DESC LIMIT 10"
```

## 🏭 Production Deployment

### PM2 Process Management

The system runs as multiple independent processes:

```bash
# Start all processes
pm2 start ecosystem.config.js

# Monitor processes
pm2 status
pm2 logs

# Individual process management
pm2 restart location-processor-1
pm2 logs enhanced-equipment-worker
```

### Process Architecture

| Process | Purpose | Resources |
|---------|---------|-----------|
| `nexus-app` | Next.js PWA application | ~70MB |
| `monitoring-service` | System alerts and monitoring | ~90MB |
| `enhanced-equipment-worker` | UI command processing (2 instances) | ~80MB each |
| `location-processor-*` | Independent location equipment logic | ~80-100MB each |
| `influxdb3-processing-engine` | Event-driven equipment control | ~100MB |

### Independent Location Processors

Each location runs completely independently:

**Example Location Processor:**
- Equipment type A control (variable intervals)
- Equipment type B control (variable intervals)  
- Equipment type C control (variable intervals)
- Equipment type D control (variable intervals)

**Custom Location Processors:**
- Air handler control (30s intervals)
- Fan coil control (30s intervals)
- Pump control (30s intervals)
- Boiler/Chiller control (2-5min intervals)

**Processing Engine Plugin:**
- Real-time sensor-triggered control (sub-second response)
- Event-driven equipment automation
- Zero connection leak architecture

## 🎛️ Equipment Control Features

### Boiler Controls
- **Temperature Setpoints** - Supply temperature control with OAR calculations
- **Lead-Lag Coordination** - Automatic equipment rotation and staging
- **Safety Systems** - Emergency shutdown and safety monitoring
- **Efficiency Tracking** - Real-time efficiency calculations

### Air Handler Controls
- **PID Control** - Precise temperature and airflow control
- **Mixed Air Management** - Outside air reset and economizer control
- **Fan Speed Control** - Variable frequency drive management
- **Filter Monitoring** - Differential pressure tracking

### Pump Controls
- **Lead-Lag Operations** - Primary/backup pump coordination
- **Flow Management** - Variable speed control based on demand
- **Efficiency Monitoring** - Power consumption tracking
- **Cavitation Protection** - Safety monitoring and alerts

### Fan Coil Controls
- **Zone Temperature Control** - Individual zone management
- **Valve Positioning** - Heating and cooling valve control
- **Fan Speed Management** - Multi-speed fan control
- **Occupancy Scheduling** - Time-based control strategies

## 🔧 Equipment Logic System

### Location-Specific Equipment Files

```
lib/equipment-logic/locations/
├── location-a/
│   ├── boiler.js          # Boiler control logic
│   ├── chiller.js         # Chiller control logic
│   ├── fan-coil.js        # Fan coil control logic
│   ├── pumps.js           # Pump control logic
│   └── lead-lag-helpers.js
├── location-b/
│   ├── air-handler.js     # Air handler control logic
│   ├── fan-coil.js        # Fan coil control logic
│   ├── pumps.js           # Pump control logic
│   └── steam-bundle.js    # Steam bundle control logic
├── location-c/
│   ├── air-handler.js
│   └── boiler.js
└── location-d/
    └── air-handler.js
```

### Equipment Logic Interface

All equipment logic files implement a standard 4-parameter interface:

```javascript
function processEquipment(metrics, commands, settings, state) {
  // metrics: Current sensor readings from InfluxDB
  // commands: Recent UI commands from users
  // settings: Equipment configuration
  // state: Previous processing state
  
  // Returns: Array of commands to write to NeuralControlCommands
  return commands
}
```

### Processing Engine Plugin Interface

The Automata Controls Nexus Processing Engine plugin uses event-driven triggers:

```python
def process_writes(influxdb3_local, table_batches, args=None):
    """
    Process incoming sensor data and generate equipment commands
    
    Args:
        influxdb3_local: InfluxDB3 local client for database operations
        table_batches: List of data batches from triggered tables
        args: Optional plugin arguments
    
    Returns:
        Automatically writes control commands to equipment
    """
    for table_batch in table_batches:
        if table_batch["table_name"] == "metrics":
            for row in table_batch["rows"]:
                # Real-time equipment logic processing
                commands = process_equipment_logic(row)
                write_control_commands(influxdb3_local, commands)
```

## 🌐 API Endpoints

### Equipment Control APIs

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/equipment/[id]/state` | GET | Get current equipment state |
| `/api/equipment/[id]/command` | POST | Send equipment command |
| `/api/equipment/[id]/status/[jobId]` | GET | Check command status |
| `/api/influx/control-data` | POST | Get equipment metrics |
| `/api/influx/equipment-data` | POST | Get historical data |
| `/api/processing-engine/status` | GET | Get Processing Engine status |
| `/api/processing-engine/triggers` | GET | List active triggers |

### Equipment Command Example

```javascript
// POST /api/equipment/EQUIPMENT_ID_123/command
{
  "command": "APPLY_CONTROL_SETTINGS",
  "equipmentName": "Equipment-Unit-1",
  "equipmentType": "boiler",
  "locationId": "location-1",
  "locationName": "Sample Building Location",
  "settings": {
    "enabled": true,
    "supplyTempSetpoint": 180,
    "isLead": true
  },
  "userId": "user_id_example",
  "userName": "System Admin",
  "priority": "normal"
}
```

## 🗃️ Database Schema

### InfluxDB3 Databases

**UIControlCommands** - User interface commands
```
Measurement: UIControlCommands
Tags: equipmentId, locationId, userId, command
Fields: userName, priority, enabled, supplyTempSetpoint, isLead
```

**NeuralControlCommands** - Processed equipment commands
```
Measurement: NeuralControlCommands  
Tags: equipmentId, locationId, source, userId
Fields: command, userName, priority, settings
```

**ProcessingEngineCommands** - Event-driven equipment commands
```
Measurement: ProcessingEngineCommands
Tags: equipmentId, locationId, command_type, equipment_type, source, status
Fields: value, timestamp
```

**EquipmentConfig** - Equipment configuration data
```
Measurement: EquipmentConfig
Tags: equipmentId, locationId, equipmentType
Fields: configuration parameters (varies by equipment type)
```

### Redis State Management

**Equipment State Keys:**
```
equipment:{equipmentId}:state
{
  "lastModified": "2025-05-29T01:52:16.665Z",
  "lastModifiedBy": "System Admin",
  "userId": "user_id_example",
  "command": "APPLY_CONTROL_SETTINGS",
  "settings": {
    "enabled": true,
    "supplyTempSetpoint": 175,
    "isLead": true
  }
}
```

## 🔒 Security & Authentication

### Firebase Authentication
- **Multi-provider support** - Email, Google, etc.
- **Role-based access control** - Admin, operator, viewer roles
- **Location-based permissions** - Users can access specific locations
- **Session management** - Secure token handling

### API Security
- **Authentication required** - All API endpoints require valid Firebase tokens
- **Rate limiting** - BullMQ job queues prevent API abuse
- **Input validation** - Equipment commands validated before processing
- **Audit logging** - All commands logged to NeuralControlCommands

### Processing Engine Security
- **Plugin sandboxing** - Isolated execution environment
- **Resource limits** - Memory and CPU usage controls
- **Error handling** - Graceful failure recovery
- **Audit trail** - All plugin activities logged

## 📊 Monitoring & Alerts

### System Monitoring
- **PM2 Process Monitoring** - Automatic restart on failures
- **Redis Connection Monitoring** - Connection health checks
- **InfluxDB Health Checks** - Database availability monitoring
- **Equipment Status Tracking** - Real-time equipment state monitoring
- **Processing Engine Monitoring** - Plugin performance and error tracking

### Alert System
- **Equipment Alarms** - High temperature, low pressure, equipment failures
- **System Alerts** - Process failures, database connectivity issues
- **Processing Engine Alerts** - Plugin errors, trigger failures
- **User Notifications** - Real-time alerts via Firebase

### Performance Metrics
- **Equipment Response Times** - Traditional vs Processing Engine comparison
- **Connection Monitoring** - Track connection leak prevention
- **Memory Usage** - System resource optimization
- **Database Performance** - Query execution times and throughput

## 🛠️ Troubleshooting

### Common Issues

**Processes Not Starting:**
```bash
# Check TypeScript compilation
npx tsc --project tsconfig.worker.json --noEmit

# Test individual workers
npx ts-node --project tsconfig.worker.json lib/workers/enhanced-equipment-worker.ts
```

**Database Connection Issues:**
```bash
# Test InfluxDB connectivity
curl -X POST "http://your-influxdb-server:8181/api/v3/query_sql" \
  -H "Content-Type: application/json" \
  -d '{"q": "SHOW DATABASES"}'

# Test Redis connectivity
redis-cli ping
```

**Processing Engine Issues:**
```bash
# Check Processing Engine status
influxdb3 query \
  --database system \
  "SELECT * FROM processing_engine_logs ORDER BY time DESC LIMIT 10"

# List active triggers
influxdb3 query \
  --database system \
  "SELECT * FROM processing_engine_triggers"

# Test plugin manually
influxdb3 test wal_plugin \
  --database Locations \
  --lp 'metrics,equipmentId=TEST123,location_id=1 temperature=75.0' \
  hvac/automata_controls_nexus_plugin.py
```

**API Errors:**
```bash
# Check process logs
pm2 logs nexus-app --lines 20
pm2 logs enhanced-equipment-worker --lines 20

# Individual location processor management
pm2 restart location-processor-1
pm2 logs location-processor-1 --lines 20

# Test API endpoints
curl "http://localhost:3000/api/equipment/test123/state"
```

### Log Files

| Process | Log Location |
|---------|-------------|
| Nexus App | `/root/.pm2/logs/nexus-app-out-0.log` |
| Equipment Worker | `/root/.pm2/logs/ui-worker-*.log` |
| Location Processors | `/root/.pm2/logs/*-processor-*.log` |
| Processing Engine | `/var/log/influxdb3_plugins.log` |

## 🔄 Development Workflow

### Adding New Equipment Types

1. **Create Equipment Logic File**
```javascript
// lib/equipment-logic/locations/your-location/new-equipment.js
function processNewEquipment(metrics, commands, settings, state) {
  // Implement equipment-specific logic
  return generatedCommands
}
```

2. **Update Location Processor**
```javascript
// Add to lib/workers/location-processors/your-location-processor.ts
'new-equipment': { interval: 60000, lastRun: 0 }
```

3. **Add Processing Engine Logic**
```python
# Add to processing engine plugin
def process_new_equipment_logic(influxdb3_local, equipment_id, metrics):
    # Real-time equipment control logic
    commands = generate_new_equipment_commands(metrics)
    return commands
```

4. **Add UI Controls**
```jsx
// Create components/equipment-controls/new-equipment-controls.tsx
// Add equipment-specific control interface
```

### Adding New Locations

1. **Create Location Processor**
```typescript
// lib/workers/location-processors/newlocation-processor.ts
// Copy template and customize for location equipment
```

2. **Add Equipment Logic Directory**
```bash
mkdir lib/equipment-logic/locations/newlocation
# Add equipment-specific logic files
```

3. **Update Processing Engine Plugin**
```python
# Add location configuration to plugin
LOCATION_CONFIGS = {
    "new_location_id": {
        "name": "newlocation",
        "equipment_mapping": {
            "equipment_id_1": "equipment-type-1",
            "equipment_id_2": "equipment-type-2"
        }
    }
}
```

4. **Update PM2 Configuration**
```javascript
// Add to ecosystem.config.js
{
  name: 'newlocation-processor',
  script: 'ts-node --project tsconfig.worker.json lib/workers/location-processors/newlocation-processor.ts'
}
```

### Processing Engine Plugin Development

1. **Plugin Structure**
```python
# /opt/productionapp/plugins/hvac/custom_plugin.py
def process_writes(influxdb3_local, table_batches, args=None):
    """
    Main plugin entry point
    Triggered when data is written to specified tables
    """
    # Your custom equipment logic here
    pass

def process_equipment_logic(equipment_id, metrics):
    """
    Equipment-specific control algorithms
    """
    # Return list of commands
    return []
```

2. **Create Trigger**
```bash
# Deploy plugin and create trigger
influxdb3 create trigger \
  --trigger-spec "table:metrics" \
  --plugin-filename "hvac/custom_plugin.py" \
  --database Locations \
  custom_equipment_controller
```

3. **Test Plugin**
```bash
# Test with sample data
influxdb3 test wal_plugin \
  --database Locations \
  --lp 'metrics,equipmentId=TEST123,location_id=1 temperature=75.0' \
  hvac/custom_plugin.py
```

## 📈 Performance Optimization

### Current Performance Metrics
- **API Response Times** - 30-50ms average
- **Equipment Processing** - Sub-second (Processing Engine) vs 1-2 seconds (traditional)
- **Memory Usage** - ~725MB total for all processes (including Processing Engine)
- **CPU Usage** - Event-driven, minimal baseline usage
- **Connection Management** - Zero leaks with Processing Engine vs 400+ with traditional factories

### Optimization Features
- **Event-Driven Processing** - Process equipment only when sensor data changes
- **Intelligent Processing** - Only process equipment when needed
- **Batch Database Writes** - Efficient InfluxDB operations
- **Redis Caching** - Fast state retrieval for UI
- **Independent Scaling** - Scale location processors independently
- **Connection Pooling** - Prevent connection leaks in traditional processors

### Processing Engine Advantages
- **Real-time Response** - Equipment responds immediately to sensor changes
- **Resource Efficiency** - Lower memory and CPU usage compared to polling
- **Scalability** - Handle unlimited equipment without performance degradation
- **Reliability** - Automatic failover and error recovery

## 📄 Licensing

### 🌐 Open-Core Model

**Open Source (MIT License):**
- Core BMS framework and architecture
- React/Next.js PWA interface
- Firebase authentication integration
- InfluxDB 3.0 data layer
- Redis state management
- BullMQ job queuing system
- Base equipment logic framework
- Generic PID, lead-lag, and OAR helpers
- Processing Engine integration framework

**Commercial Modules (Enterprise License):**
- Automata Controls Nexus InfluxDB3 Processing Engine Plugin
- Location-specific equipment logic implementations
- Advanced analytics dashboard
- Multi-tenant management
- SMS/Email alert integrations
- Visual zone mapping and floor plans
- Predictive maintenance algorithms
- Priority support and SLA

### 📜 License Files
- `LICENSE` - MIT License for open-source components
- `COMMERCIAL.md` - Enterprise licensing terms
- `CONTRIBUTING.md` - Contribution guidelines

## 🤝 Contributing

### Development Setup
1. Fork the repository: **[AutomataControls/AutomataControlsNexusBms-Production](https://github.com/AutomataControls/AutomataControlsNexusBms-Production/fork)**
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Install dependencies: `npm install`
4. Configure environment: `cp .env.example .env`
5. Start development: `npm run dev`
6. Run tests: `npm test`
7. Submit pull request

### Code Standards
- **TypeScript** - Strict typing for all new code
- **ESLint** - Code linting and formatting
- **Testing** - Unit tests for equipment logic
- **Documentation** - JSDoc comments for complex functions
- **Processing Engine** - Python plugins follow PEP 8 standards

### Open Source Contributions Welcome
- Core framework improvements
- New equipment type templates
- Processing Engine plugin examples
- Documentation enhancements
- Bug fixes and performance optimizations
- Integration examples and tutorials

## 🆘 Support & Community

### 📖 Documentation
- **[API Documentation](https://github.com/AutomataControls/AutomataControlsNexusBms-Production/blob/main/docs/api.md)** - Complete API reference
- **[Equipment Logic Guide](https://github.com/AutomataControls/AutomataControlsNexusBms-Production/blob/main/docs/equipment-logic.md)** - Building custom control algorithms
- **[Processing Engine Guide](https://github.com/AutomataControls/AutomataControlsNexusBms-Production/blob/main/docs/processing-engine.md)** - InfluxDB3 plugin development
- **[Deployment Guide](https://github.com/AutomataControls/AutomataControlsNexusBms-Production/blob/main/docs/deployment.md)** - Production deployment instructions
- **[InfluxDB Integration](https://github.com/AutomataControls/AutomataControlsNexusBms-Production/blob/main/docs/influxdb.md)** - Time-series data best practices

### 💬 Community Support
- **[GitHub Issues](https://github.com/AutomataControls/AutomataControlsNexusBms-Production/issues)** - Bug reports and feature requests
- **[GitHub Discussions](https://github.com/AutomataControls/AutomataControlsNexusBms-Production/discussions)** - Community Q&A and ideas
- **Discord Server** - Real-time community chat
- **Stack Overflow** - Tag: `automata-controls-nexus`

### 🏢 Enterprise Support
- **Priority Support** - Dedicated support channels
- **Professional Services** - Custom implementation assistance
- **Processing Engine Consulting** - Expert plugin development services
- **Training Programs** - Team training and certification
- **SLA Options** - 24/7 support with guaranteed response times

Contact: [enterprise@automatacontrols.com](mailto:enterprise@automatacontrols.com)

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For technical support or questions:
- **Issues** - GitHub Issues for bug reports and feature requests
- **Documentation** - Wiki for detailed technical documentation
- **Community** - Discord server for real-time support

---

**Automata Controls Nexus BMS** - Enterprise Building Management System  
Built with ❤️ for industrial automation

[![Built on InfluxDB](https://img.shields.io/badge/Built%20on-InfluxDB%203.0-22ADF6?style=for-the-badge&logo=influxdb&logoColor=white)](https://www.influxdata.com/)
[![Processing Engine](https://img.shields.io/badge/Processing-Engine-FF6B35?style=for-the-badge&logo=influxdb&logoColor=white)](https://docs.influxdata.com/influxdb3/core/process-data/)
[![Powered by React](https://img.shields.io/badge/Powered%20by-React-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
[![Built with TypeScript](https://img.shields.io/badge/Built%20with-TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
