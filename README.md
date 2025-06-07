## 🏢 Overview

Automata Controls Nexus BMS is a production-ready, enterprise-grade Building Management System (BMS) built with modern web technologies. It provides real-time monitoring, intelligent control, and distributed processing for industrial HVAC equipment across multiple locations.

> **Built on InfluxDB 3.0** - Leveraging the power of next-generation time-series data platform for lightning-fast analytics and unparalleled scalability.

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
*Distribute# Automata Controls Nexus BMS - Enterprise Building Management System

[![MIT License](https://img.shields.io/badge/license-MIT-brightgreen?style=for-the-badge)](LICENSE)
[![Node.js](https://img.shields.io/badge/node.js-20.x-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Redis](https://img.shields.io/badge/redis-6.x-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![InfluxDB 3.0](https://img.shields.io/badge/influxdb-3.0-22ADF6?style=for-the-badge&logo=influxdb&logoColor=white)](https://www.influxdata.com/)
[![Firebase](https://img.shields.io/badge/firebase-auth-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![React](https://img.shields.io/badge/react-Next.js-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://nextjs.org/)
[![PWA](https://img.shields.io/badge/pwa-ready-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![PM2](https://img.shields.io/badge/pm2-managed-2B037A?style=for-the-badge&logo=pm2&logoColor=white)](https://pm2.keymetrics.io/)
[![TypeScript](https://img.shields.io/badge/typescript-4.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![BullMQ](https://img.shields.io/badge/bullmq-queue-FF6B6B?style=for-the-badge)](https://bullmq.io/)

## 🏢 Overview

Automata Controls Nexus BMS is a production-ready, enterprise-grade Building Management System (BMS) built with modern web technologies. It provides real-time monitoring, intelligent control, and distributed processing for industrial HVAC equipment across multiple locations.

> **Built on InfluxDB 3.0** - Leveraging the power of next-generation time-series data platform for lightning-fast analytics and unparalleled scalability.

### 🌟 Key Features

- **Real-time Equipment Control** - Live monitoring and control of boilers, chillers, air handlers, pumps, and more
- **Distributed Architecture** - Independent location processors for fault tolerance and scalability
- **InfluxDB 3.0 Integration** - Lightning-fast time-series data storage with columnar architecture and Apache Arrow
- **Intelligent Equipment Logic** - Sophisticated PID control, lead-lag coordination, and OAR (Outdoor Air Reset) calculations
- **Cross-User Synchronization** - Redis-based state management for multi-user environments
- **Enterprise Reliability** - BullMQ job queues, error handling, and automatic failover
- **Modern PWA Interface** - React/Next.js responsive web application with offline capabilities
- **Multi-Database Integration** - InfluxDB3 for time-series data, Firebase for authentication and real-time updates

## 📊 InfluxDB 3.0 Integration

Automata Controls Nexus BMS leverages the cutting-edge capabilities of InfluxDB 3.0 for superior time-series data management:

### 🚀 InfluxDB 3.0 Advantages
- **Columnar Storage** - Apache Parquet format for 10x better compression and query performance
- **Apache Arrow** - In-memory analytics with zero-copy data access
- **SQL Compatibility** - Standard SQL queries alongside InfluxQL for maximum flexibility
- **Unlimited Cardinality** - Handle millions of unique series without performance degradation
- **Real-time Analytics** - Sub-second query responses for live equipment monitoring

### 🏗️ Database Architecture
```
Equipment Sensors → InfluxDB 3.0 Databases
                   ├── UIControlCommands (User actions)
                   ├── NeuralControlCommands (AI-generated commands)
                   ├── EquipmentConfig (Configuration data)
                   └── Locations (Time-series metrics)
```

### 📈 Performance Benefits
- **10-100x faster queries** compared to InfluxDB 1.x
- **Massive scale** - Handle petabytes of equipment data
- **Real-time insights** - Live equipment performance analytics
- **Cost efficiency** - Reduced storage costs through superior compression

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
```

### Data Flow
1. **User Interface** → Equipment controls via React PWA
2. **Command Processing** → BullMQ queue → Enhanced Equipment Worker
3. **Database Writes** → UIControlCommands, NeuralControlCommands, EquipmentConfig
4. **Equipment Logic** → Independent location processors execute equipment-specific algorithms
5. **Real-time Updates** → Redis state management for cross-user synchronization

## 🚀 Quick Start

### Prerequisites
- Node.js 20.x+
- Redis 6.x+
- InfluxDB3
- Firebase project

### Installation

1. **Clone and Install**
```bash
git clone <repository-url>
cd automata-controls-nexus-bms
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
pm2 restart huntington-processor
pm2 logs enhanced-equipment-worker
```

### Process Architecture

| Process | Purpose | Resources |
|---------|---------|-----------|
| `nexus-app` | Next.js PWA application | ~70MB |
| `monitoring-service` | System alerts and monitoring | ~90MB |
| `enhanced-equipment-worker` | UI command processing (2 instances) | ~80MB each |
| `location-processor-*` | Independent location equipment logic | ~80-100MB each |

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

## 🌐 API Endpoints

### Equipment Control APIs

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/equipment/[id]/state` | GET | Get current equipment state |
| `/api/equipment/[id]/command` | POST | Send equipment command |
| `/api/equipment/[id]/status/[jobId]` | GET | Check command status |
| `/api/influx/control-data` | POST | Get equipment metrics |
| `/api/influx/equipment-data` | POST | Get historical data |

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

## 📊 Monitoring & Alerts

### System Monitoring
- **PM2 Process Monitoring** - Automatic restart on failures
- **Redis Connection Monitoring** - Connection health checks
- **InfluxDB Health Checks** - Database availability monitoring
- **Equipment Status Tracking** - Real-time equipment state monitoring

### Alert System
- **Equipment Alarms** - High temperature, low pressure, equipment failures
- **System Alerts** - Process failures, database connectivity issues
- **User Notifications** - Real-time alerts via Firebase

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

3. **Add UI Controls**
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

3. **Update PM2 Configuration**
```javascript
// Add to ecosystem.config.js
{
  name: 'newlocation-processor',
  script: 'ts-node --project tsconfig.worker.json lib/workers/location-processors/newlocation-processor.ts'
}
```

## 📈 Performance Optimization

### Current Performance Metrics
- **API Response Times** - 30-50ms average
- **Equipment Processing** - 1-2 seconds (down from 2+ minutes)
- **Memory Usage** - ~625MB total for all processes
- **CPU Usage** - Event-driven, minimal baseline usage

### Optimization Features
- **Intelligent Processing** - Only process equipment when needed
- **Batch Database Writes** - Efficient InfluxDB operations
- **Redis Caching** - Fast state retrieval for UI
- **Independent Scaling** - Scale location processors independently

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

**Commercial Modules (Enterprise License):**
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
1. Fork the repository
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

### Open Source Contributions Welcome
- Core framework improvements
- New equipment type templates
- Documentation enhancements
- Bug fixes and performance optimizations
- Integration examples and tutorials

## 🆘 Support & Community

### 📖 Documentation
- **[API Documentation](docs/api.md)** - Complete API reference
- **[Equipment Logic Guide](docs/equipment-logic.md)** - Building custom control algorithms
- **[Deployment Guide](docs/deployment.md)** - Production deployment instructions
- **[InfluxDB Integration](docs/influxdb.md)** - Time-series data best practices

### 💬 Community Support
- **GitHub Issues** - Bug reports and feature requests
- **GitHub Discussions** - Community Q&A and ideas
- **Discord Server** - Real-time community chat
- **Stack Overflow** - Tag: `automata-controls-nexus`

### 🏢 Enterprise Support
- **Priority Support** - Dedicated support channels
- **Professional Services** - Custom implementation assistance
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
[![Powered by React](https://img.shields.io/badge/Powered%20by-React-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
[![Built with TypeScript](https://img.shields.io/badge/Built%20with-TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
