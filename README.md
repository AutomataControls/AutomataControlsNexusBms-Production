![Automata Controls Logo](neural-loader.png)

# Automata Controls Nexus BMS - Enterprise Building Management System

[![MIT License](https://img.shields.io/badge/license-MIT-brightgreen?style=for-the-badge)](LICENSE)
[![Node.js](https://img.shields.io/badge/node.js-20.x-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Redis](https://img.shields.io/badge/redis-6.x-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![InfluxDB 3.0](https://img.shields.io/badge/influxdb-3.0-22ADF6?style=for-the-badge&logo=influxdb&logoColor=white)](https://www.influxdata.com/)
[![Multi-Plugin Engine](https://img.shields.io/badge/4--plugin-processing%20engine-FF6B35?style=for-the-badge&logo=influxdb&logoColor=white)](https://docs.influxdata.com/influxdb3/core/process-data/)
[![Predictive AI](https://img.shields.io/badge/predictive-maintenance-9B59B6?style=for-the-badge&logo=chart-line&logoColor=white)](#predictive-maintenance-engine)
[![Energy Optimization](https://img.shields.io/badge/energy-optimization-27AE60?style=for-the-badge&logo=leaf&logoColor=white)](#energy-optimization-engine)
[![Intelligent Alerts](https://img.shields.io/badge/intelligent-alerts-E74C3C?style=for-the-badge&logo=bell&logoColor=white)](#alert-engine)
[![Firebase](https://img.shields.io/badge/firebase-auth-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![React](https://img.shields.io/badge/react-Next.js-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://nextjs.org/)
[![PWA](https://img.shields.io/badge/pwa-ready-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![PM2](https://img.shields.io/badge/pm2-managed-2B037A?style=for-the-badge&logo=pm2&logoColor=white)](https://pm2.keymetrics.io/)
[![TypeScript](https://img.shields.io/badge/typescript-4.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![BullMQ](https://img.shields.io/badge/bullmq-queue-FF6B6B?style=for-the-badge)](https://bullmq.io/)

## 🏢 Overview

Automata Controls Nexus BMS is a production-ready, enterprise-grade Building Management System (BMS) built with modern web technologies. It provides real-time monitoring, intelligent control, and distributed processing for industrial HVAC equipment across multiple locations.

> **Powered by InfluxDB 3.0 Multi-Plugin Processing Engine** - Leveraging the power of next-generation time-series data platform with **three simultaneous AI-driven plugins** for equipment control, predictive maintenance, and energy optimization delivering lightning-fast analytics, real-time processing, and unparalleled scalability.

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
- **InfluxDB3 Multi-Plugin Processing Engine** - **Four simultaneous AI-driven plugins** with sub-second response times and zero connection leaks
- **🔧 HVAC Control Engine** - Event-driven equipment control with sophisticated automation logic
- **🔍 Predictive Maintenance Engine** - AI-powered equipment health monitoring, failure prediction, and maintenance optimization
- **⚡ Energy Optimization Engine** - Real-time energy analysis, peak demand management, and cost optimization
- **🚨 Intelligent Alert Engine** - Multi-channel notifications with Resend API integration, Slack, Discord, and custom webhooks
- **Distributed Architecture** - Independent location processors for fault tolerance and scalability
- **InfluxDB 3.0 Integration** - Lightning-fast time-series data storage with columnar architecture and Apache Arrow
- **Intelligent Equipment Logic** - Sophisticated PID control, lead-lag coordination, and OAR (Outdoor Air Reset) calculations
- **Cross-User Synchronization** - Redis-based state management for multi-user environments
- **Enterprise Reliability** - BullMQ job queues, error handling, and automatic failover
- **Modern PWA Interface** - React/Next.js responsive web application with offline capabilities
- **Multi-Database Integration** - InfluxDB3 for time-series data, Firebase for authentication and real-time updates

## 🚀 InfluxDB 3.0 Multi-Plugin Processing Engine

Automata Controls Nexus BMS leverages the cutting-edge **InfluxDB 3.0 Processing Engine** with **three simultaneous AI-driven plugins** for revolutionary building management capabilities:

### 🎯 **Four-Plugin Architecture Overview**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Equipment     │───►│  InfluxDB3      │───►│  Processing     │
│   Sensors       │    │  Metrics Table  │    │  Engine Hub     │
│   (Real-time)   │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
          ┌─────────────┬─────────────┬─────────────────┼─────────────────┬─────────────┐
          ▼             ▼             ▼                 ▼                 ▼             ▼
 ┌─────────────┐┌─────────────┐┌─────────────┐ ┌─────────────┐ ┌─────────────┐┌─────────────┐
 │🔧 HVAC      ││🔍 Predictive││⚡ Energy    │ │🚨 Alert     │ │📧 Email     ││📱 Slack/    │
 │Control      ││Maintenance  ││Optimization │ │Engine       │ │(Resend API) ││Discord      │
 │Engine       ││Engine       ││Engine       │ │             │ │Integration  ││Webhooks     │
 │             ││             ││             │ │ • Equipment │ │             ││             │
 │• Equipment  ││• Health     ││• Power      │ │   Alerts    │ │• Professional││• Real-time  │
 │  Commands   ││  Scoring    ││  Analysis   │ │• Predictive │ │  HTML       ││  Notifications│
 │• Real-time  ││• Failure    ││• Peak       │ │  Maintenance││• Delivery   ││• Multi-     │
 │  Control    ││  Prediction ││  Demand     │ │  Alerts     │ │  Tracking   ││  channel    │
 │• Safety     ││• Maintenance││• Cost       │ │• Energy     │ │• Alert      ││  Support    │
 │  Logic      ││  Scheduling ││  Reduction  │ │  Alerts     │ │  History    ││             │
 └─────────────┘└─────────────┘└─────────────┘ └─────────────┘ └─────────────┘└─────────────┘
          │             │             │                 │                 │             │
          ▼             ▼             ▼                 ▼                 ▼             ▼
 ┌─────────────┐┌─────────────┐┌─────────────┐ ┌─────────────┐ ┌─────────────┐┌─────────────┐
 │Equipment    ││Maintenance  ││Energy       │ │Alert        │ │Email        ││Webhook      │
 │Commands     ││Analytics    ││Analytics    │ │History      │ │Delivery     ││Delivery     │
 └─────────────┘└─────────────┘└─────────────┘ └─────────────┘ └─────────────┘└─────────────┘
```

### 🔧 **HVAC Control Engine**

The **Automata Controls Nexus HVAC Plugin** transforms traditional polling-based control into real-time, event-driven automation:

```python
# Automata Controls Nexus InfluxDB3 HVAC Control Plugin
# Event-driven HVAC control with zero connection leaks
def process_writes(influxdb3_local, table_batches, args=None):
    for table_batch in table_batches:
        if table_batch["table_name"] == "metrics":
            # Real-time equipment logic triggered by sensor data
            for row in table_batch["rows"]:
                equipment_commands = process_hvac_equipment(row)
                write_control_commands(influxdb3_local, equipment_commands)
```

**Features:**
- **Sub-second Equipment Response** - Immediate reaction to sensor changes
- **Sophisticated HVAC Logic** - PID control, lead-lag coordination, OAR calculations
- **Zero Connection Leaks** - Eliminates traditional factory connection issues
- **Safety Validation** - Comprehensive equipment safety checks
- **Multi-Equipment Support** - Boilers, chillers, air handlers, pumps, fan coils

### 🔍 **Predictive Maintenance Engine**

The **Automata Controls Predictive Maintenance Plugin** provides AI-powered equipment health monitoring:

```python
# Automata Controls Nexus InfluxDB3 Predictive Maintenance Plugin
# AI-powered equipment health and failure prediction
def process_writes(influxdb3_local, table_batches, args=None):
    for table_batch in table_batches:
        if table_batch["table_name"] == "metrics":
            for row in table_batch["rows"]:
                # Analyze equipment health in real-time
                health_analysis = analyze_equipment_health(row)
                failure_prediction = predict_equipment_failure(health_analysis)
                write_maintenance_analytics(influxdb3_local, health_analysis, failure_prediction)
```

**Capabilities:**
- **Equipment Health Scoring** - Real-time 0-100% health scores for all equipment
- **Failure Prediction** - AI algorithms predict failures 1-180 days in advance
- **Maintenance Optimization** - Automatic scheduling based on equipment condition
- **Cost Estimation** - Predictive maintenance cost analysis and budgeting
- **Alert Generation** - Critical condition alerts with recommended actions
- **Historical Trend Analysis** - Long-term equipment performance tracking

**Supported Equipment Types:**
- **Boilers** - Temperature, pressure, efficiency monitoring
- **Chillers** - Refrigerant analysis, compressor health
- **Air Handlers** - Fan bearing analysis, filter monitoring
- **Pumps** - Vibration analysis, cavitation detection
- **Fan Coils** - Motor health, valve performance
- **Heat Exchangers** - Fouling detection, efficiency loss

### ⚡ **Energy Optimization Engine**

The **Automata Controls Energy Optimization Plugin** delivers real-time energy analysis and cost reduction:

```python
# Automata Controls Nexus InfluxDB3 Energy Optimization Plugin
# Real-time energy analysis and cost optimization
def process_writes(influxdb3_local, table_batches, args=None):
    for table_batch in table_batches:
        if table_batch["table_name"] == "metrics":
            # Analyze energy consumption by location
            location_equipment = group_equipment_by_location(table_batch["rows"])
            for location_id, equipment_list in location_equipment.items():
                energy_analysis = analyze_location_energy(location_id, equipment_list)
                optimization_opportunities = identify_optimization_opportunities(energy_analysis)
                optimization_commands = generate_optimization_commands(optimization_opportunities)
                write_energy_analytics(influxdb3_local, energy_analysis, optimization_commands)
```

**Features:**
- **Real-time Energy Monitoring** - Live power consumption analysis across all locations
- **Peak Demand Management** - Automatic load shedding during peak utility periods
- **Cost Optimization** - Real-time utility rate integration and cost tracking
- **Load Shifting** - Intelligent equipment scheduling to reduce energy costs
- **Carbon Footprint Tracking** - Environmental impact monitoring and reduction
- **Efficiency Analysis** - Equipment efficiency scoring and improvement recommendations
- **Demand Response** - Automated participation in utility demand response programs

**Energy Savings:**
- **15-30% Energy Cost Reduction** - Through intelligent load management
- **20-40% Peak Demand Reduction** - During optimization periods
- **Real-time Rate Optimization** - Automatic adjustment to utility pricing
- **Equipment Staging** - Efficiency-based equipment operation sequencing

### 🚨 **Alert Engine**

The **Automata Controls Alert Engine Plugin** provides intelligent, multi-channel alerting with seamless integration to your existing BMS infrastructure:

```python
# Automata Controls Nexus InfluxDB3 Alert Engine Plugin
# Multi-channel alerting with Resend API integration
def process_writes(influxdb3_local, table_batches, args=None):
    for table_batch in table_batches:
        if table_batch["table_name"] == "metrics":
            for row in table_batch["rows"]:
                # Analyze equipment conditions for critical alerts
                alert = analyze_equipment_alerts(row)
                if alert:
                    # Send via multiple channels simultaneously
                    send_resend_email(alert)  # Professional HTML emails
                    send_slack_notification(alert)  # Real-time Slack alerts
                    send_discord_notification(alert)  # Discord webhooks
                    write_alert_history(alert)  # Tracking and analytics
```

**Alert Types & Triggers:**
- **🌡️ Critical Temperature Alerts** - Immediate notifications when equipment exceeds safe operating temperatures
- **🔧 Equipment Pressure Alerts** - High/low pressure warnings for boilers, pumps, and system safety
- **🔍 Predictive Maintenance Alerts** - Health score warnings and failure predictions from AI analysis
- **⚡ Energy Optimization Alerts** - High consumption warnings and efficiency opportunities
- **📊 System Health Alerts** - Processing engine errors, database connectivity, and system status

**Multi-Channel Delivery:**
- **📧 Resend API Integration** - Professional HTML emails with delivery tracking
- **📱 Slack Webhooks** - Real-time team notifications with rich formatting
- **💬 Discord Integration** - Community and team alerts with embedded content
- **🌐 Custom HTTP Endpoints** - Flexible webhook support for any service
- **📊 Alert History Database** - Complete audit trail and analytics tracking

**Smart Features:**
- **⏰ Alert Cooldowns** - Prevent notification spam with intelligent timing
- **🎯 Priority-Based Routing** - Critical alerts get immediate delivery across all channels
- **🔄 Retry Logic** - Automatic retry with exponential backoff for delivery reliability
- **🏷️ Equipment Classification** - Automatic equipment type detection and appropriate thresholds

### 🎯 **Multi-Plugin Performance Benefits**

| Traditional Single-Plugin Systems | Automata Controls 4-Plugin Processing Engine |
|-----------------------------------|-----------------------------------------------|
| ❌ Limited to single function | ✅ **Four simultaneous AI engines** |
| ❌ Reactive maintenance only | ✅ **Predictive maintenance analytics** |
| ❌ No energy optimization | ✅ **Real-time energy cost optimization** |
| ❌ Basic equipment control | ✅ **Advanced HVAC automation + AI insights** |
| ❌ Manual alert management | ✅ **Intelligent multi-channel alerting** |
| ❌ Separate systems required | ✅ **Unified platform with 4 engines** |
| ❌ Higher operational costs | ✅ **15-30% energy savings + reduced maintenance** |
| ❌ Reactive problem solving | ✅ **Proactive AI-driven insights and notifications** |

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

### 🎯 Multi-Plugin Processing Engine Benefits

| Traditional Factories | InfluxDB3 Multi-Plugin Processing Engine |
|----------------------|-------------------------------------------|
| ❌ Polling every 30-60s | ✅ **Real-time event triggers (3 plugins)** |
| ❌ Connection leaks (400+) | ✅ **Zero connection leaks** |
| ❌ 20-30 minute delays | ✅ **Sub-second response times** |
| ❌ 6 separate processes | ✅ **Single event-driven system** |
| ❌ Resource intensive | ✅ **Lightweight and efficient** |
| ❌ Limited functionality | ✅ **HVAC + Predictive + Energy optimization** |

### 🔧 Dual-Run Capabilities

The system supports **dual-run operation** for safe migration while running **three Processing Engine plugins simultaneously**:

```bash
# Production System (Port 8181)
pm2 status | grep factory
├── Warren Factory: ✅ Running (Traditional)
├── Huntington Factory: ✅ Running (Traditional)
└── Location Factories: ✅ Running (Traditional)

# Multi-Plugin Processing Engine (Port 8182)
influxdb3 list triggers
├── HVAC Control Engine: ✅ Active (Event-driven equipment control)
├── Predictive Maintenance Engine: ✅ Active (AI health monitoring)
└── Energy Optimization Engine: ✅ Active (Cost reduction analytics)
```

### 📊 InfluxDB 3.0 Advantages
- **Columnar Storage** - Apache Parquet format for 10x better compression and query performance
- **Apache Arrow** - In-memory analytics with zero-copy data access
- **SQL Compatibility** - Standard SQL queries alongside InfluxQL for maximum flexibility
- **Unlimited Cardinality** - Handle millions of unique series without performance degradation
- **Real-time Analytics** - Sub-second query responses for live equipment monitoring
- **Event-Driven Processing** - Trigger equipment control automatically when sensor data arrives
- **Multi-Plugin Support** - Run multiple specialized engines simultaneously

### 🏗️ Enhanced Database Architecture
```
Equipment Sensors → InfluxDB 3.0 Databases
                   ├── UIControlCommands (User actions)
                   ├── NeuralControlCommands (AI-generated commands)
                   ├── EquipmentConfig (Configuration data)
                   ├── Locations (Time-series metrics)
                   ├── ProcessingEngineCommands (Event-driven commands)
                   ├── equipment_health (Predictive maintenance data)
                   ├── failure_predictions (AI failure analysis)
                   ├── maintenance_schedule (Optimized maintenance plans)
                   ├── energy_consumption (Real-time energy analytics)
                   ├── optimization_opportunities (Energy savings analysis)
                   └── optimization_commands (Energy control commands)
```

### 📈 Enhanced Performance Benefits
- **10-100x faster queries** compared to InfluxDB 1.x
- **Real-time response** - Equipment responds immediately to sensor changes
- **Massive scale** - Handle petabytes of equipment data
- **Real-time insights** - Live equipment performance analytics
- **Cost efficiency** - Reduced storage costs through superior compression
- **Zero connection leaks** - Eliminates connection pooling issues permanently
- **15-30% energy savings** - Through intelligent optimization
- **Predictive maintenance** - Prevent failures before they occur
- **Multi-engine processing** - Three AI systems working simultaneously

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
                               │ Multi-Plugin    │
                               │ Processing      │
                               │ Engine (3 AI)   │
                               └─────────────────┘
```

### Enhanced Data Flow
1. **User Interface** → Equipment controls via React PWA
2. **Command Processing** → BullMQ queue → Enhanced Equipment Worker
3. **Database Writes** → UIControlCommands, NeuralControlCommands, EquipmentConfig
4. **Equipment Logic** → Independent location processors execute equipment-specific algorithms
5. **Multi-Plugin Processing Engine** → **Three AI engines** respond to sensor data automatically:
   - **🔧 HVAC Control** - Real-time equipment automation
   - **🔍 Predictive Maintenance** - Health monitoring and failure prediction
   - **⚡ Energy Optimization** - Cost reduction and efficiency analysis
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

## 🔧 InfluxDB3 Multi-Plugin Processing Engine Setup

### Enable Multi-Plugin Processing Engine

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

### Deploy Multi-Plugin Architecture

1. **Create Plugin Directories**
```bash
# Create plugin directories
mkdir -p /opt/productionapp/plugins/hvac
mkdir -p /opt/productionapp/plugins/analytics
mkdir -p /opt/productionapp/plugins/optimization
mkdir -p /opt/productionapp/plugins/alerts

# Deploy the Automata Controls Nexus plugin suite
# (Contact support for the full enterprise plugin suite)
```

2. **Install Required Packages**
```bash
# Install httpx for Alert Engine
influxdb3 install package httpx
```

3. **Create Multi-Plugin Processing Engine Triggers**
```bash
# Create HVAC Control Engine trigger
influxdb3 create trigger \
  --trigger-spec "table:metrics" \
  --plugin-filename "hvac/automata_controls_nexus_plugin.py" \
  --database Locations \
  automata_controls_hvac_engine

# Create Predictive Maintenance Engine trigger
influxdb3 create trigger \
  --trigger-spec "table:metrics" \
  --plugin-filename "analytics/predictive_maintenance_plugin.py" \
  --database Locations \
  predictive_maintenance_engine

# Create Energy Optimization Engine trigger
influxdb3 create trigger \
  --trigger-spec "table:metrics" \
  --plugin-filename "optimization/energy_optimization_plugin.py" \
  --database Locations \
  energy_optimization_engine

# Create Alert Engine trigger
influxdb3 create trigger \
  --trigger-spec "table:metrics" \
  --plugin-filename "alerts/automata_alert_engine.py" \
  --database Locations \
  --trigger-arguments "api_base_url=https://yourapp.com,recipient_email=admin@yourcompany.com,alerts_db=alerts_history" \
  equipment_alert_engine
```

4. **Verify Multi-Plugin Processing Engine Status**
```bash
# Check all active triggers
influxdb3 query \
  --database system \
  "SELECT * FROM processing_engine_triggers"

# Monitor all plugin performance
influxdb3 query \
  --database system \
  "SELECT * FROM processing_engine_logs ORDER BY time DESC LIMIT 20"

# Verify real-time 4-plugin operation
tail -f /var/log/influxdb3_plugins.log | grep -E "(HVAC|Predictive|Energy|Alert)"
```

## 🏭 Production Deployment

### PM2 Process Management

The system runs as multiple independent processes plus the **Multi-Plugin Processing Engine**:

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

### Enhanced Process Architecture

| Process | Purpose | Resources |
|---------|---------|-----------|
| `nexus-app` | Next.js PWA application | ~70MB |
| `monitoring-service` | System alerts and monitoring | ~90MB |
| `enhanced-equipment-worker` | UI command processing (2 instances) | ~80MB each |
| `location-processor-*` | Independent location equipment logic | ~80-100MB each |
| `influxdb3-4-plugin-engine` | **Four AI-driven plugins** (HVAC + Predictive + Energy + Alerts) | ~140MB |

### Independent Location Processors + Multi-Plugin Engine

Each location runs completely independently **plus** the **Multi-Plugin Processing Engine** provides real-time AI analysis:

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

**Multi-Plugin Processing Engine:**
- **🔧 HVAC Control Plugin** - Real-time sensor-triggered control (sub-second response)
- **🔍 Predictive Maintenance Plugin** - Equipment health monitoring and failure prediction
- **⚡ Energy Optimization Plugin** - Energy analysis and cost optimization
- **Zero connection leak architecture** across all three plugins

## 🎛️ Equipment Control Features

### Enhanced HVAC Controls with Multi-Plugin Intelligence

### Boiler Controls
- **Temperature Setpoints** - Supply temperature control with OAR calculations
- **Lead-Lag Coordination** - Automatic equipment rotation and staging
- **Safety Systems** - Emergency shutdown and safety monitoring
- **Efficiency Tracking** - Real-time efficiency calculations
- **🔍 Predictive Health Monitoring** - AI-powered failure prediction and maintenance scheduling
- **⚡ Energy Optimization** - Real-time energy cost analysis and optimization

### Air Handler Controls
- **PID Control** - Precise temperature and airflow control
- **Mixed Air Management** - Outside air reset and economizer control
- **Fan Speed Control** - Variable frequency drive management
- **Filter Monitoring** - Differential pressure tracking
- **🔍 Bearing Health Analysis** - Predictive maintenance for fan bearings and motors
- **⚡ Load Scheduling** - Intelligent scheduling for peak demand reduction

### Pump Controls
- **Lead-Lag Operations** - Primary/backup pump coordination
- **Flow Management** - Variable speed control based on demand
- **Efficiency Monitoring** - Power consumption tracking
- **Cavitation Protection** - Safety monitoring and alerts
- **🔍 Vibration Analysis** - Predictive maintenance for bearing wear and seal failure
- **⚡ Energy Staging** - Efficiency-based pump staging and load optimization

### Fan Coil Controls
- **Zone Temperature Control** - Individual zone management
- **Valve Positioning** - Heating and cooling valve control
- **Fan Speed Management** - Multi-speed fan control
- **Occupancy Scheduling** - Time-based control strategies
- **🔍 Motor Health Monitoring** - Predictive maintenance for motor and valve performance
- **⚡ Load Balancing** - Intelligent load distribution for energy efficiency

## 🔧 Enhanced Equipment Logic System

### Location-Specific Equipment Files + Multi-Plugin Intelligence

```
lib/equipment-logic/locations/
├── location-a/
│   ├── boiler.js          # Boiler control logic + AI insights
│   ├── chiller.js         # Chiller control logic + predictive maintenance
│   ├── fan-coil.js        # Fan coil control logic + energy optimization
│   ├── pumps.js           # Pump control logic + health monitoring
│   └── lead-lag-helpers.js
├── location-b/
│   ├── air-handler.js     # Air handler control logic + AI analysis
│   ├── fan-coil.js        # Fan coil control logic + predictive insights
│   ├── pumps.js           # Pump control logic + energy optimization
│   └── steam-bundle.js    # Steam bundle control logic + health monitoring
├── location-c/
│   ├── air-handler.js     # + Multi-plugin AI enhancements
│   └── boiler.js          # + Predictive maintenance integration
└── location-d/
    └── air-handler.js     # + Energy optimization intelligence
```

### Enhanced Equipment Logic Interface

All equipment logic files implement a standard 4-parameter interface **enhanced with Multi-Plugin AI insights**:

```javascript
function processEquipment(metrics, commands, settings, state) {
  // metrics: Current sensor readings from InfluxDB + AI health scores
  // commands: Recent UI commands from users + AI optimization recommendations
  // settings: Equipment configuration + predictive maintenance parameters
  // state: Previous processing state + energy optimization history
  
  // Returns: Array of commands to write to NeuralControlCommands
  return commands
}
```

### Multi-Plugin Processing Engine Interface

The **Automata Controls Nexus Multi-Plugin Processing Engine** uses event-driven triggers with **three simultaneous AI engines**:

```python
# HVAC Control Plugin
def process_hvac_writes(influxdb3_local, table_batches, args=None):
    """Real-time equipment control and automation"""
    for table_batch in table_batches:
        if table_batch["table_name"] == "metrics":
            for row in table_batch["rows"]:
                # Real-time HVAC equipment logic processing
                commands = process_hvac_equipment_logic(row)
                write_control_commands(influxdb3_local, commands)

# Predictive Maintenance Plugin  
def process_maintenance_writes(influxdb3_local, table_batches, args=None):
    """AI-powered equipment health monitoring and failure prediction"""
    for table_batch in table_batches:
        if table_batch["table_name"] == "metrics":
            for row in table_batch["rows"]:
                # AI health analysis and failure prediction
                health_analysis = analyze_equipment_health(row)
                failure_prediction = predict_equipment_failure(health_analysis)
                write_maintenance_analytics(influxdb3_local, health_analysis, failure_prediction)

# Energy Optimization Plugin
def process_energy_writes(influxdb3_local, table_batches, args=None):
    """Real-time energy analysis and cost optimization"""
    for table_batch in table_batches:
        if table_batch["table_name"] == "metrics":
            # Energy consumption analysis and optimization
            location_equipment = group_equipment_by_location(table_batch["rows"])
            for location_id, equipment_list in location_equipment.items():
                energy_analysis = analyze_location_energy(location_id, equipment_list)
                optimization_commands = generate_optimization_commands(energy_analysis)
                write_energy_analytics(influxdb3_local, energy_analysis, optimization_commands)
```

## 🌐 Enhanced API Endpoints

### Equipment Control APIs + Multi-Plugin Data

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/equipment/[id]/state` | GET | Get current equipment state + AI health score |
| `/api/equipment/[id]/command` | POST | Send equipment command |
| `/api/equipment/[id]/status/[jobId]` | GET | Check command status |
| `/api/equipment/[id]/health` | GET | **Get AI health analysis and predictions** |
| `/api/equipment/[id]/energy` | GET | **Get real-time energy consumption and optimization** |
| `/api/influx/control-data` | POST | Get equipment metrics |
| `/api/influx/equipment-data` | POST | Get historical data |
| `/api/influx/health-data` | POST | **Get predictive maintenance analytics** |
| `/api/influx/energy-data` | POST | **Get energy consumption and optimization data** |
| `/api/processing-engine/status` | GET | Get Multi-Plugin Processing Engine status |
| `/api/processing-engine/triggers` | GET | List all active triggers (3 plugins) |
| `/api/predictive-maintenance/alerts` | GET | **Get maintenance alerts and recommendations** |
| `/api/energy-optimization/opportunities` | GET | **Get energy savings opportunities** |

### Enhanced Equipment Command Example

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
  "priority": "normal",
  // Enhanced with Multi-Plugin AI insights
  "aiInsights": {
    "healthScore": 87.5,
    "predictedFailureRisk": "low",
    "energyEfficiency": 92.3,
    "maintenanceRecommendation": "routine_maintenance_in_60_days",
    "energyOptimizationOpportunity": "none"
  }
}
```

## 🗃️ Enhanced Database Schema

### InfluxDB3 Databases + Multi-Plugin Data

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

**🔍 Predictive Maintenance Data:**

**equipment_health** - Real-time equipment health monitoring
```
Measurement: equipment_health
Tags: equipment_id, location_id, equipment_type, health_status
Fields: health_score, temperature_health, efficiency_health, trend_health, operational_health
```

**failure_predictions** - AI-powered failure prediction
```
Measurement: failure_predictions
Tags: equipment_id, location_id, priority
Fields: failure_probability, time_to_failure_days, recommendation
```

**maintenance_schedule** - Optimized maintenance scheduling
```
Measurement: maintenance_schedule
Tags: equipment_id, location_id, maintenance_type, priority
Fields: duration_hours, estimated_cost
```

**maintenance_alerts** - Critical condition alerts
```
Measurement: maintenance_alerts
Tags: equipment_id, location_id, alert_level, equipment_type
Fields: message, health_score, failure_probability, recommendation
```

**⚡ Energy Optimization Data:**

**energy_consumption** - Real-time energy analysis
```
Measurement: energy_consumption
Tags: location_id, period_type, rate_period
Fields: total_power_kw, hourly_cost, average_efficiency, equipment_count, carbon_footprint_kg
```

**optimization_opportunities** - Energy savings analysis
```
Measurement: optimization_opportunities
Tags: location_id, analysis_type
Fields: load_shifting_opportunities, efficiency_opportunities, peak_shaving_opportunities, staging_opportunities
```

**optimization_commands** - Energy optimization commands
```
Measurement: optimization_commands
Tags: equipment_id, location_id, command_type, priority
Fields: action, target_value, duration_minutes, expected_savings_kw
```

**🚨 Alert Engine Data:**

**alert_history** - Real-time alert tracking
```
Measurement: alert_history
Tags: alert_type, severity, source, equipment_id, location_id, equipment_type
Fields: message, value, threshold, health_status, hourly_cost, total_power_kw
```

**alert_notifications** - Multi-channel delivery tracking
```
Measurement: alert_notifications
Tags: alert_id, channel_type, delivery_status
Fields: recipient, message_id, delivery_timestamp, retry_count
```

### Enhanced Redis State Management

**Equipment State Keys + AI Insights:**
```
equipment:{equipmentId}:state
{
  "lastModified": "2025-06-08T01:52:16.665Z",
  "lastModifiedBy": "System Admin",
  "userId": "user_id_example",
  "command": "APPLY_CONTROL_SETTINGS",
  "settings": {
    "enabled": true,
    "supplyTempSetpoint": 175,
    "isLead": true
  },
  // Enhanced with Multi-Plugin AI insights
  "aiAnalytics": {
    "healthScore": 89.2,
    "healthStatus": "good",
    "failureProbability": 12,
    "nextMaintenanceDate": "2025-08-15",
    "energyEfficiency": 94.7,
    "currentPowerConsumption": 35.2,
    "hourlyCost": 4.23,
    "optimizationOpportunities": ["load_shifting"],
    "lastAIUpdate": "2025-06-08T01:52:15.123Z"
  }
}
```

## 🔒 Enhanced Security & Authentication

### Firebase Authentication + AI Data Protection
- **Multi-provider support** - Email, Google, etc.
- **Role-based access control** - Admin, operator, viewer roles
- **Location-based permissions** - Users can access specific locations
- **Session management** - Secure token handling
- **AI Data Protection** - Secure access to predictive maintenance and energy data

### API Security + Multi-Plugin Protection
- **Authentication required** - All API endpoints require valid Firebase tokens
- **Rate limiting** - BullMQ job queues prevent API abuse
- **Input validation** - Equipment commands validated before processing
- **Audit logging** - All commands logged to NeuralControlCommands
- **AI Data Encryption** - Predictive maintenance and energy optimization data encrypted
- **Plugin Isolation** - Each Processing Engine plugin runs in isolated environment

### Multi-Plugin Processing Engine Security
- **Plugin sandboxing** - Isolated execution environment for all 3 plugins
- **Resource limits** - Memory and CPU usage controls per plugin
- **Error handling** - Graceful failure recovery across all plugins
- **Audit trail** - All plugin activities logged and monitored
- **Data validation** - AI predictions and recommendations validated before storage

## 📊 Enhanced Monitoring & Alerts

### Multi-Plugin System Monitoring
- **PM2 Process Monitoring** - Automatic restart on failures
- **Redis Connection Monitoring** - Connection health checks
- **InfluxDB Health Checks** - Database availability monitoring
- **Equipment Status Tracking** - Real-time equipment state monitoring
- **Multi-Plugin Processing Engine Monitoring** - Performance tracking for all 3 AI engines
- **AI Health Monitoring** - Predictive maintenance algorithm performance
- **Energy Optimization Tracking** - Real-time energy savings monitoring

### Enhanced Alert System
- **Equipment Alarms** - High temperature, low pressure, equipment failures
- **System Alerts** - Process failures, database connectivity issues
- **Multi-Plugin Processing Engine Alerts** - Plugin errors, trigger failures across all 3 engines
- **🔍 Predictive Maintenance Alerts** - Equipment health warnings, failure predictions, maintenance recommendations
- **⚡ Energy Optimization Alerts** - Peak demand warnings, cost savings opportunities, efficiency recommendations
- **User Notifications** - Real-time alerts via Firebase with AI insights

### Enhanced Performance Metrics
- **Equipment Response Times** - Traditional vs Multi-Plugin Processing Engine comparison
- **Connection Monitoring** - Track connection leak prevention across all plugins
- **Memory Usage** - System resource optimization including AI plugins
- **Database Performance** - Query execution times and throughput
- **AI Algorithm Performance** - Predictive accuracy and energy savings achieved
- **Multi-Plugin Efficiency** - Resource usage across all 3 simultaneous AI engines

## 🛠️ Enhanced Troubleshooting

### Common Multi-Plugin Issues

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

**Multi-Plugin Processing Engine Issues:**
```bash
# Check all Processing Engine plugins status
influxdb3 query \
  --database system \
  "SELECT * FROM processing_engine_logs ORDER BY time DESC LIMIT 20"

# List all active triggers (should show 3 plugins)
influxdb3 query \
  --database system \
  "SELECT * FROM processing_engine_triggers"

# Test HVAC Control plugin manually
influxdb3 test wal_plugin \
  --database Locations \
  --lp 'metrics,equipmentId=TEST123,location_id=1 temperature=75.0' \
  hvac/automata_controls_nexus_plugin.py

# Test Predictive Maintenance plugin manually
influxdb3 test wal_plugin \
  --database Locations \
  --lp 'metrics,equipmentId=TEST456,location_id=1 temperature=85.0,pressure=120.0' \
  analytics/predictive_maintenance_plugin.py

# Test Energy Optimization plugin manually
influxdb3 test wal_plugin \
  --database Locations \
  --lp 'metrics,equipmentId=TEST789,location_id=1 temperature=78.0,power_consumption=25.5' \
  optimization/energy_optimization_plugin.py

# Monitor real-time multi-plugin activity
tail -f /var/log/influxdb3_plugins.log | grep -E "(HVAC|Predictive|Energy)"
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
curl "http://localhost:3000/api/equipment/test123/health"
curl "http://localhost:3000/api/equipment/test123/energy"
```

**Multi-Plugin Data Verification:**
```bash
# Verify HVAC control data
curl -X POST "http://your-influxdb-server:8181/api/v3/query_sql" \
  -H "Content-Type: application/json" \
  -d '{"q": "SELECT * FROM \"ProcessingEngineCommands\" ORDER BY time DESC LIMIT 5", "db": "Locations"}'

# Verify predictive maintenance data
curl -X POST "http://your-influxdb-server:8181/api/v3/query_sql" \
  -H "Content-Type: application/json" \
  -d '{"q": "SELECT * FROM equipment_health ORDER BY time DESC LIMIT 5", "db": "Locations"}'

# Verify energy optimization data
curl -X POST "http://your-influxdb-server:8181/api/v3/query_sql" \
  -H "Content-Type: application/json" \
  -d '{"q": "SELECT * FROM energy_consumption ORDER BY time DESC LIMIT 5", "db": "Locations"}'
```

### Enhanced Log Files

| Process | Log Location |
|---------|-------------|
| Nexus App | `/root/.pm2/logs/nexus-app-out-0.log` |
| Equipment Worker | `/root/.pm2/logs/ui-worker-*.log` |
| Location Processors | `/root/.pm2/logs/*-processor-*.log` |
| **Multi-Plugin Processing Engine** | `/var/log/influxdb3_plugins.log` |
| **HVAC Control Plugin** | `/var/log/influxdb3_plugins.log` (filter: "HVAC") |
| **Predictive Maintenance Plugin** | `/var/log/influxdb3_plugins.log` (filter: "Predictive") |
| **Energy Optimization Plugin** | `/var/log/influxdb3_plugins.log` (filter: "Energy") |

## 🔄 Enhanced Development Workflow

### Adding New Equipment Types + Multi-Plugin Integration

1. **Create Equipment Logic File with AI Integration**
```javascript
// lib/equipment-logic/locations/your-location/new-equipment.js
function processNewEquipment(metrics, commands, settings, state) {
  // Implement equipment-specific logic
  // Include AI health monitoring integration
  // Include energy optimization considerations
  return generatedCommands
}
```

2. **Update Location Processor**
```javascript
// Add to lib/workers/location-processors/your-location-processor.ts
'new-equipment': { interval: 60000, lastRun: 0 }
```

3. **Add Multi-Plugin Processing Engine Logic**
```python
# Add to HVAC Control plugin
def process_new_equipment_hvac_logic(influxdb3_local, equipment_id, metrics):
    # Real-time equipment control logic
    commands = generate_new_equipment_commands(metrics)
    return commands

# Add to Predictive Maintenance plugin
def process_new_equipment_health_logic(influxdb3_local, equipment_id, metrics):
    # AI health analysis for new equipment type
    health_analysis = analyze_new_equipment_health(metrics)
    return health_analysis

# Add to Energy Optimization plugin
def process_new_equipment_energy_logic(influxdb3_local, equipment_id, metrics):
    # Energy consumption analysis for new equipment type
    energy_analysis = analyze_new_equipment_energy(metrics)
    return energy_analysis
```

4. **Add UI Controls with AI Insights**
```jsx
// Create components/equipment-controls/new-equipment-controls.tsx
// Add equipment-specific control interface
// Include health score display
// Include energy consumption metrics
// Include predictive maintenance recommendations
```

### Adding New Locations + Multi-Plugin Support

1. **Create Location Processor**
```typescript
// lib/workers/location-processors/newlocation-processor.ts
// Copy template and customize for location equipment
```

2. **Add Equipment Logic Directory**
```bash
mkdir lib/equipment-logic/locations/newlocation
# Add equipment-specific logic files with AI integration
```

3. **Update Multi-Plugin Processing Engine**
```python
# Add location configuration to all 3 plugins
LOCATION_CONFIGS = {
    "new_location_id": {
        "name": "newlocation",
        "equipment_mapping": {
            "equipment_id_1": "equipment-type-1",
            "equipment_id_2": "equipment-type-2"
        },
        "predictive_maintenance_config": {
            "health_thresholds": {...},
            "failure_prediction_models": {...}
        },
        "energy_optimization_config": {
            "utility_rates": {...},
            "peak_demand_limits": {...}
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

### Multi-Plugin Processing Engine Development

1. **Enhanced Plugin Structure**
```python
# /opt/productionapp/plugins/hvac/enhanced_hvac_plugin.py
def process_writes(influxdb3_local, table_batches, args=None):
    """
    HVAC Control Plugin - Real-time equipment automation
    Works alongside Predictive Maintenance and Energy Optimization plugins
    """
    # Your HVAC control logic here
    pass

# /opt/productionapp/plugins/analytics/predictive_maintenance_plugin.py
def process_writes(influxdb3_local, table_batches, args=None):
    """
    Predictive Maintenance Plugin - AI health monitoring
    Works alongside HVAC Control and Energy Optimization plugins
    """
    # Your predictive maintenance logic here
    pass

# /opt/productionapp/plugins/optimization/energy_optimization_plugin.py
def process_writes(influxdb3_local, table_batches, args=None):
    """
    Energy Optimization Plugin - Cost reduction and efficiency
    Works alongside HVAC Control and Predictive Maintenance plugins
    """
    # Your energy optimization logic here
    pass
```

2. **Create Multi-Plugin Triggers**
```bash
# Deploy all plugins and create triggers
influxdb3 create trigger \
  --trigger-spec "table:metrics" \
  --plugin-filename "hvac/enhanced_hvac_plugin.py" \
  --database Locations \
  enhanced_hvac_controller

influxdb3 create trigger \
  --trigger-spec "table:metrics" \
  --plugin-filename "analytics/predictive_maintenance_plugin.py" \
  --database Locations \
  predictive_maintenance_engine

influxdb3 create trigger \
  --trigger-spec "table:metrics" \
  --plugin-filename "optimization/energy_optimization_plugin.py" \
  --database Locations \
  energy_optimization_engine
```

3. **Test Multi-Plugin System**
```bash
# Test all plugins with comprehensive data
influxdb3 test wal_plugin \
  --database Locations \
  --lp 'metrics,equipmentId=TEST123,location_id=1 temperature=75.0,pressure=120.0,power_consumption=25.5' \
  hvac/enhanced_hvac_plugin.py

# Monitor all plugin activity
tail -f /var/log/influxdb3_plugins.log | grep -E "(HVAC|Predictive|Energy)"
```

## 📈 Enhanced Performance Optimization

### Current Multi-Plugin Performance Metrics
- **API Response Times** - 25-40ms average (improved with AI caching)
- **Equipment Processing** - Sub-second (Multi-Plugin Processing Engine) vs 1-2 seconds (traditional)
- **Memory Usage** - ~825MB total for all processes (including 3 AI plugins)
- **CPU Usage** - Event-driven, minimal baseline usage across all plugins
- **Connection Management** - Zero leaks with Multi-Plugin Processing Engine vs 400+ with traditional factories
- **AI Processing** - Real-time health scoring and energy analysis with <100ms latency

### Enhanced Optimization Features
- **Event-Driven Multi-Plugin Processing** - Process equipment with 3 AI engines simultaneously
- **Intelligent Multi-Plugin Processing** - Only process when needed across all plugins
- **Batch Database Writes** - Efficient InfluxDB operations for all plugin data
- **Redis Caching** - Fast state retrieval for UI including AI insights
- **Independent Scaling** - Scale location processors independently
- **Connection Pooling** - Prevent connection leaks in traditional processors
- **AI Model Optimization** - Predictive algorithms optimized for real-time performance
- **Energy Data Caching** - Fast access to energy optimization recommendations

### Multi-Plugin Processing Engine Advantages
- **Real-time AI Response** - Equipment responds immediately with AI insights
- **Resource Efficiency** - Lower memory and CPU usage compared to polling across 3 plugins
- **Scalability** - Handle unlimited equipment without performance degradation
- **Reliability** - Automatic failover and error recovery across all plugins
- **AI-Enhanced Decision Making** - Equipment control enhanced with predictive and energy insights
- **Cost Optimization** - 15-30% energy savings through real-time optimization

## 📈 Multi-Plugin Performance Benefits

### **Traditional Single-Function Systems vs Automata Controls Multi-Plugin Engine**

| Traditional BMS | Automata Controls Multi-Plugin Engine |
|----------------|---------------------------------------|
| ❌ **Single Function** - Basic equipment control only | ✅ **Three AI Engines** - HVAC + Predictive + Energy optimization |
| ❌ **Reactive Maintenance** - Fix after failure | ✅ **Predictive Maintenance** - AI prevents failures 1-180 days in advance |
| ❌ **No Energy Intelligence** - Manual energy management | ✅ **Real-time Energy Optimization** - 15-30% automatic cost reduction |
| ❌ **Separate Systems** - Multiple vendors and platforms | ✅ **Unified AI Platform** - One system with three intelligent engines |
| ❌ **High Operating Costs** - Reactive approach is expensive | ✅ **Cost Reduction** - Predictive + energy savings = 20-40% lower costs |
| ❌ **Limited Insights** - Basic monitoring only | ✅ **AI-Driven Insights** - Health scores, failure predictions, energy analytics |

### **Operational Impact & ROI**

**Cost Savings:**
- **Energy Costs:** 15-30% reduction through intelligent optimization
- **Maintenance Costs:** 25-40% reduction through predictive maintenance
- **Equipment Downtime:** 60-80% reduction through failure prevention
- **Operational Efficiency:** 30-50% improvement through AI automation

**Performance Improvements:**
- **Equipment Response Time:** Sub-second vs 20-30 minutes traditional
- **System Reliability:** 99.9% uptime with predictive maintenance
- **Energy Efficiency:** Real-time optimization vs manual management
- **Maintenance Planning:** AI-driven scheduling vs reactive repairs

## 📄 Enhanced Licensing

### 🌐 Enhanced Open-Core Model

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
- Multi-plugin architecture framework

**Commercial Modules (Enterprise License):**
- **🔧 Automata Controls Nexus InfluxDB3 HVAC Control Plugin**
- **🔍 Automata Controls Predictive Maintenance AI Engine**
- **⚡ Automata Controls Energy Optimization Engine**
- Location-specific equipment logic implementations
- Advanced analytics dashboard with AI insights
- Multi-tenant management
- SMS/Email alert integrations with AI recommendations
- Visual zone mapping and floor plans
- Advanced predictive maintenance algorithms
- Energy optimization algorithms
- Priority support and SLA

### 📜 License Files
- `LICENSE` - MIT License for open-source components
- `COMMERCIAL.md` - Enterprise licensing terms for AI engines
- `CONTRIBUTING.md` - Contribution guidelines

## 🤝 Enhanced Contributing

### Development Setup
1. Fork the repository: **[AutomataControls/AutomataControlsNexusBms-Production](https://github.com/AutomataControls/AutomataControlsNexusBms-Production/fork)**
2. Create feature branch: `git checkout -b feature/amazing-ai-feature`
3. Install dependencies: `npm install`
4. Configure environment: `cp .env.example .env`
5. Start development: `npm run dev`
6. Run tests: `npm test`
7. Test multi-plugin system: `npm run test:plugins`
8. Submit pull request

### Enhanced Code Standards
- **TypeScript** - Strict typing for all new code
- **ESLint** - Code linting and formatting
- **Testing** - Unit tests for equipment logic and AI algorithms
- **Documentation** - JSDoc comments for complex functions and AI models
- **Multi-Plugin Processing Engine** - Python plugins follow PEP 8 standards
- **AI Model Standards** - Predictive algorithms must include accuracy metrics
- **Energy Standards** - Optimization algorithms must include savings validation

### Open Source Contributions Welcome
- Core framework improvements
- New equipment type templates
- Multi-Plugin Processing Engine examples
- AI algorithm enhancements (open-source versions)
- Documentation enhancements
- Bug fixes and performance optimizations
- Integration examples and tutorials
- Energy optimization improvements
- Predictive maintenance enhancements

## 🆘 Enhanced Support & Community

### 📖 Enhanced Documentation
- **[API Documentation](https://github.com/AutomataControls/AutomataControlsNexusBms-Production/blob/main/docs/api.md)** - Complete API reference including AI endpoints
- **[Equipment Logic Guide](https://github.com/AutomataControls/AutomataControlsNexusBms-Production/blob/main/docs/equipment-logic.md)** - Building custom control algorithms with AI integration
- **[Multi-Plugin Processing Engine Guide](https://github.com/AutomataControls/AutomataControlsNexusBms-Production/blob/main/docs/multi-plugin-engine.md)** - InfluxDB3 multi-plugin development
- **[Predictive Maintenance Guide](https://github.com/AutomataControls/AutomataControlsNexusBms-Production/blob/main/docs/predictive-maintenance.md)** - AI health monitoring and failure prediction
- **[Energy Optimization Guide](https://github.com/AutomataControls/AutomataControlsNexusBms-Production/blob/main/docs/energy-optimization.md)** - Real-time energy analysis and cost reduction
- **[Deployment Guide](https://github.com/AutomataControls/AutomataControlsNexusBms-Production/blob/main/docs/deployment.md)** - Production deployment with multi-plugin support
- **[InfluxDB Integration](https://github.com/AutomataControls/AutomataControlsNexusBms-Production/blob/main/docs/influxdb.md)** - Time-series data best practices with AI analytics

### 💬 Community Support
- **[GitHub Issues](https://github.com/AutomataControls/AutomataControlsNexusBms-Production/issues)** - Bug reports and feature requests
- **[GitHub Discussions](https://github.com/AutomataControls/AutomataControlsNexusBms-Production/discussions)** - Community Q&A and AI algorithm discussions
- **Discord Server** - Real-time community chat with AI channels
- **Stack Overflow** - Tag: `automata-controls-nexus-ai`

### 🏢 Enhanced Enterprise Support
- **Priority Support** - Dedicated support channels for AI engines
- **Professional Services** - Custom AI implementation assistance
- **Multi-Plugin Processing Engine Consulting** - Expert plugin development services
- **AI Training Programs** - Team training and certification on predictive maintenance and energy optimization
- **SLA Options** - 24/7 support with guaranteed response times
- **Custom AI Development** - Tailored predictive algorithms for specific equipment types

Contact: [enterprise@automatacontrols.com](mailto:enterprise@automatacontrols.com)

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

Commercial AI engines (Predictive Maintenance and Energy Optimization) available under separate enterprise licensing.

## 🆘 Support

For technical support or questions:
- **Issues** - GitHub Issues for bug reports and feature requests
- **Documentation** - Wiki for detailed technical documentation including AI guides
- **Community** - Discord server for real-time support with AI-specific channels

---

**Automata Controls Nexus BMS** - Enterprise Building Management System with **Multi-Plugin AI Processing Engine**  
Built with ❤️ for industrial automation and AI-powered building optimization

[![Built on InfluxDB](https://img.shields.io/badge/Built%20on-InfluxDB%203.0-22ADF6?style=for-the-badge&logo=influxdb&logoColor=white)](https://www.influxdata.com/)
[![Multi-Plugin Engine](https://img.shields.io/badge/Multi--Plugin-Processing%20Engine-FF6B35?style=for-the-badge&logo=influxdb&logoColor=white)](https://docs.influxdata.com/influxdb3/core/process-data/)
[![AI Powered](https://img.shields.io/badge/AI-Powered-9B59B6?style=for-the-badge&logo=brain&logoColor=white)](#predictive-maintenance-engine)
[![Energy Optimized](https://img.shields.io/badge/Energy-Optimized-27AE60?style=for-the-badge&logo=leaf&logoColor=white)](#energy-optimization-engine)
[![Powered by React](https://img.shields.io/badge/Powered%20by-React-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
[![Built with TypeScript](https://img.shields.io/badge/Built%20with-TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
