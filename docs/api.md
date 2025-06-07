# Automata Controls Nexus BMS - API Documentation

## 🌐 Overview

The Automata Controls Nexus BMS provides a comprehensive REST API for building management system integration. Built on Next.js with TypeScript, the API offers real-time equipment control, data aggregation, and notification services.

### 🔗 Base URL
```
Production: https://yourdomain.com
Development: http://localhost:3000
```

### 📊 API Architecture
- **Framework**: Next.js API Routes
- **Database**: InfluxDB 3.0 for time-series data
- **Queue System**: BullMQ with Redis backend
- **Authentication**: Firebase Auth (middleware-based)
- **Email Service**: Resend integration
- **Real-time**: Redis state management

## 🔐 Authentication

Currently, authentication is handled by Next.js middleware using Firebase tokens. Include your Firebase JWT token in the Authorization header:

```http
Authorization: Bearer <firebase-jwt-token>
```

## 📡 Equipment Control APIs

### 1. Equipment Command API

Send control commands to HVAC equipment with BullMQ job queuing.

#### **POST** `/api/equipment/[id]/command`

**Parameters:**
- `id` (path) - Equipment identifier

**Request Body:**
```json
{
  "command": "APPLY_CONTROL_SETTINGS",
  "equipmentName": "Boiler-1", 
  "equipmentType": "boiler",
  "locationId": "4",
  "locationName": "Building A",
  "settings": {
    "enabled": true,
    "supplyTempSetpoint": 180,
    "isLead": true
  },
  "userId": "user123",
  "userName": "John Technician",
  "priority": "normal",
  "delay": 0
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "equipment123-APPLY_CONTROL_SETTINGS-1677123456789",
  "command": "APPLY_CONTROL_SETTINGS",
  "equipmentId": "equipment123",
  "timestamp": "2025-06-05T10:30:00.000Z",
  "message": "Command queued successfully"
}
```

**Priority Levels:**
- `high` or `EMERGENCY_SHUTDOWN` → Priority 1 (immediate)
- `normal` → Priority 10 (standard queue)

**Example Commands:**
```bash
# Emergency shutdown
curl -X POST "/api/equipment/ABC123/command" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "EMERGENCY_SHUTDOWN",
    "priority": "high",
    "userId": "safety_system",
    "userName": "Safety System"
  }'

# Temperature setpoint change
curl -X POST "/api/equipment/ABC123/command" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "UPDATE_SETPOINT",
    "settings": {"supplyTempSetpoint": 175},
    "userId": "tech123",
    "userName": "Technician"
  }'
```

---

### 2. Equipment State API

Manage equipment state with Redis caching for real-time updates.

#### **GET** `/api/equipment/[id]/state`

Retrieve current equipment state and OAR setpoint.

**Response:**
```json
{
  "state": {
    "enabled": true,
    "supplyTempSetpoint": 180,
    "isLead": true,
    "lastModified": "2025-06-05T10:30:00.000Z",
    "modifiedBy": "user123",
    "modifiedByName": "John Technician"
  },
  "oarSetpoint": 160,
  "timestamp": "2025-06-05T10:30:00.000Z"
}
```

#### **POST** `/api/equipment/[id]/state`

Update equipment state with audit tracking.

**Request Body:**
```json
{
  "enabled": true,
  "supplyTempSetpoint": 175,
  "isLead": false,
  "oarSetpoint": 160,
  "userId": "tech123",
  "userName": "John Technician"
}
```

**Response:**
```json
{
  "success": true,
  "state": {
    "enabled": true,
    "supplyTempSetpoint": 175,
    "isLead": false,
    "lastModified": "2025-06-05T10:30:00.000Z",
    "modifiedBy": "tech123",
    "modifiedByName": "John Technician"
  },
  "timestamp": "2025-06-05T10:30:00.000Z"
}
```

---

### 3. Job Status API

Monitor BullMQ job execution and cancel pending jobs.

#### **GET** `/api/equipment/[id]/status/[jobId]`

Check job status and progress.

**Parameters:**
- `id` (path) - Equipment identifier  
- `jobId` (path) - BullMQ job identifier

**Response:**
```json
{
  "jobId": "equipment123-APPLY_CONTROL_SETTINGS-1677123456789",
  "equipmentId": "equipment123", 
  "status": "completed",
  "message": "Command successfully applied to equipment",
  "progress": 100,
  "state": "completed",
  "timestamps": {
    "created": 1677123456789,
    "processed": 1677123460000,
    "finished": 1677123465000
  },
  "attempts": {
    "made": 1,
    "total": 3
  }
}
```

**Status Mapping:**
- `waiting`/`delayed` → `pending` - Command queued
- `active` → `processing` - Command being executed  
- `completed` → `completed` - Command successful
- `failed` → `failed` - Command failed
- `stalled` → `failed` - Command timed out

#### **DELETE** `/api/equipment/[id]/status/[jobId]`

Cancel a pending or active job.

**Response:**
```json
{
  "success": true,
  "message": "Job cancelled successfully", 
  "jobId": "equipment123-APPLY_CONTROL_SETTINGS-1677123456789"
}
```

## 📊 Data APIs

### 4. Control Data API

Aggregate real-time equipment data from multiple InfluxDB databases.

#### **POST** `/api/influx/control-data`

Fetch merged equipment data across locations.

**Request Body:**
```json
{
  "locationIds": ["4", "5", "6"],
  "timeRange": "5m"
}
```

**Time Range Options:**
- `5m` - Last 5 minutes
- `1h` - Last hour  
- `24h` - Last 24 hours

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "equipmentId": "EQUIPMENT123", 
      "locationId": "4",
      "equipmentName": "Boiler-1",
      "equipmentType": "boiler",
      "liveMetrics": {
        "spaceTemp": 110.5,
        "supplyTemp": 108.2,
        "isFiring": false,
        "outdoorTemp": 85.3,
        "timestamp": "2025-06-05T10:30:00.000Z"
      },
      "userCommands": {
        "enabled": true,
        "supplyTempSetpoint": 180,
        "isLead": true,
        "modifiedBy": "tech123",
        "lastModified": "2025-06-05T10:25:00.000Z"
      },
      "controlOutputs": {
        "unitEnable": true,
        "firing": false,
        "temperatureSetpoint": 180,
        "isLead": true,
        "timestamp": "2025-06-05T10:30:00.000Z"
      }
    }
  ],
  "timestamp": "2025-06-05T10:30:00.000Z",
  "locationIds": ["4"],
  "recordCounts": {
    "locations": 310,
    "uiCommands": 15, 
    "neuralCommands": 45,
    "merged": 13
  }
}
```

**Equipment Types Supported:**
- **Boilers** - Comfort & domestic hot water
- **Pumps** - Hot water, chilled water, circulation  
- **Fan Coils** - Heating/cooling with dampers
- **Air Handlers** - Supply/return air with mixed air
- **Heat Pumps** - Geothermal, air-source

---

### 5. InfluxDB Proxy API

Secure proxy for frontend-to-InfluxDB communication.

#### **POST** `/api/influx`

Execute SQL queries against InfluxDB through secure proxy.

**Request Body:**
```json
{
  "query": "SELECT * FROM metrics WHERE equipmentId = 'ABC123' ORDER BY time DESC LIMIT 10"
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "time": "2025-06-05T10:30:00Z",
      "equipmentId": "ABC123", 
      "temperature": 72.5,
      "pressure": 14.7
    }
  ]
}
```

**Security Features:**
- Resolves mixed content issues (HTTPS → HTTP)
- Server-side query validation
- Error sanitization
- Centralized authentication point

---

### 6. Equipment Configuration API

Persist equipment configuration changes with audit trail.

#### **POST** `/api/influx/equipment-config`

Save equipment configuration to InfluxDB for audit trail.

**Request Body:**
```json
{
  "equipmentId": "ABC123",
  "equipmentName": "Boiler-1",
  "equipmentType": "boiler", 
  "locationId": "4",
  "locationName": "Building A",
  "userId": "tech123",
  "userName": "John Technician",
  "configuration": {
    "enabled": true,
    "supplyTempSetpoint": 180,
    "isLead": true,
    "oarSetpoint": 160
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Equipment configuration saved successfully",
  "equipmentId": "ABC123", 
  "timestamp": "2025-06-05T10:30:00.000Z"
}
```

#### **GET** `/api/influx/equipment-config`

Retrieve equipment configuration history.

**Query Parameters:**
- `equipmentId` (required) - Equipment identifier
- `limit` (optional) - Number of records (default: 10)

**Response:**
```json
{
  "success": true,
  "equipmentId": "ABC123",
  "configurations": [
    {
      "timestamp": "2025-06-05T10:30:00.000Z",
      "equipmentId": "ABC123",
      "enabled": true,
      "supplyTempSetpoint": 180,
      "isLead": true,
      "configVersion": 1
    }
  ],
  "count": 1
}
```

## 📧 Notification APIs

### 7. Alarm Email API

Send HVAC alarm notifications via Resend email service.

#### **POST** `/api/send-alarm-email`

Send alarm notifications to multiple recipients.

**Request Body:**
```json
{
  "alarmType": "High Temperature",
  "details": "Boiler temperature exceeded safe operating limits",
  "locationId": "4", 
  "locationName": "Building A",
  "equipmentName": "Boiler-1",
  "alarmId": "alarm-123",
  "severity": "critical",
  "recipients": ["tech@company.com", "manager@company.com"],
  "assignedTechs": "John Technician"
}
```

**Severity Levels:**
- `low` - Minor issues, single technician notification
- `medium` - Moderate issues, technician + supervisor
- `high` - Serious issues, full team notification  
- `critical` - Emergency issues, all stakeholders

**Response:**
```json
{
  "success": true,
  "messageId": "alarm-123-1677123456789",
  "summary": {
    "total": 2,
    "successful": 2, 
    "failed": 0,
    "results": [
      {
        "success": true,
        "recipient": "tech@company.com",
        "messageId": "resend-msg-123"
      },
      {
        "success": true,
        "recipient": "manager@company.com", 
        "messageId": "resend-msg-124"
      }
    ]
  }
}
```

**Email Features:**
- Role-based template customization
- Dashboard links for technicians
- Severity-based color coding
- EST timezone formatting
- Batch delivery with individual tracking

#### **GET** `/api/send-alarm-email`

Health check for email service.

**Response:**
```json
{
  "success": true,
  "message": "Email API is ready",
  "provider": "Resend"
}
```

## 🔄 Integration Workflows

### Equipment Control Workflow

1. **Command Submission**
   ```
   POST /api/equipment/{id}/command → BullMQ Queue
   ```

2. **Status Monitoring**
   ```
   GET /api/equipment/{id}/status/{jobId} → Job Progress
   ```

3. **State Synchronization**
   ```
   POST /api/equipment/{id}/state → Redis Cache Update
   ```

4. **Configuration Audit**
   ```
   POST /api/influx/equipment-config → InfluxDB Audit Trail
   ```

### Data Aggregation Workflow

1. **Real-time Dashboard**
   ```
   POST /api/influx/control-data → Merged Equipment Data
   ```

2. **Historical Analysis**
   ```
   POST /api/influx → Direct InfluxDB Queries
   ```

3. **Configuration History**
   ```
   GET /api/influx/equipment-config → Audit Trail
   ```

### Alarm Management Workflow

1. **Alarm Detection** (Equipment Logic)
2. **Email Notification**
   ```
   POST /api/send-alarm-email → Multi-recipient Alerts
   ```
3. **Dashboard Integration** (Email links to dashboard)

## ⚠️ Error Handling

### Standard Error Response
```json
{
  "success": false,
  "error": "Error description",
  "details": "Detailed error information",
  "status": 400
}
```

### HTTP Status Codes
- `200` - Success
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error

### Common Error Scenarios

**Equipment Control:**
- Missing required command field
- Invalid equipment ID
- Job not found (expired or never existed)
- BullMQ queue connection failure

**Data APIs:**
- InfluxDB connection timeout
- Invalid SQL query syntax
- Database not found
- Malformed request body

**Email Notifications:**
- Missing recipients array
- Invalid email addresses
- Resend API key not configured
- Email template rendering failure

## 🚀 Rate Limiting

Current rate limiting is handled at the infrastructure level. Consider implementing application-level rate limiting for:

- Equipment commands: 10 requests/minute per equipment
- Data queries: 100 requests/minute per user
- Email notifications: 50 emails/hour per alarm type

## 📈 Performance Guidelines

### Equipment Control
- **Command Response**: <100ms (job queuing only)
- **State Updates**: <50ms (Redis operations)
- **Job Status**: <20ms (BullMQ lookup)

### Data APIs  
- **Control Data**: 1-3 seconds (multi-database aggregation)
- **InfluxDB Proxy**: Query time + 10ms proxy overhead
- **Configuration**: <200ms (InfluxDB write)

### Email Notifications
- **Single Email**: 1-3 seconds (Resend delivery)
- **Batch Processing**: Parallel delivery to all recipients
- **Template Rendering**: <50ms per email

## 🔧 Development Examples

### JavaScript/TypeScript

```javascript
// Equipment control with status monitoring
const controlEquipment = async (equipmentId, settings) => {
  // Send command
  const commandResponse = await fetch(`/api/equipment/${equipmentId}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      command: 'APPLY_CONTROL_SETTINGS',
      settings,
      userId: 'user123',
      userName: 'Technician'
    })
  });
  
  const { jobId } = await commandResponse.json();
  
  // Monitor status
  let status;
  do {
    const statusResponse = await fetch(`/api/equipment/${equipmentId}/status/${jobId}`);
    status = await statusResponse.json();
    
    if (status.status === 'processing') {
      console.log(`Progress: ${status.progress}%`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } while (status.status === 'pending' || status.status === 'processing');
  
  return status;
};
```

### Python

```python
import requests
import time

def control_equipment(equipment_id, settings):
    # Send command
    command_response = requests.post(
        f'/api/equipment/{equipment_id}/command',
        json={
            'command': 'APPLY_CONTROL_SETTINGS',
            'settings': settings,
            'userId': 'user123',
            'userName': 'Technician'
        }
    )
    
    job_id = command_response.json()['jobId']
    
    # Monitor status
    while True:
        status_response = requests.get(f'/api/equipment/{equipment_id}/status/{job_id}')
        status = status_response.json()
        
        if status['status'] in ['completed', 'failed']:
            break
            
        print(f"Progress: {status['progress']}%")
        time.sleep(1)
    
    return status
```

### cURL Examples

```bash
# Get equipment data
curl -X POST "/api/influx/control-data" \
  -H "Content-Type: application/json" \
  -d '{"locationIds": ["4"], "timeRange": "5m"}'

# Send alarm notification  
curl -X POST "/api/send-alarm-email" \
  -H "Content-Type: application/json" \
  -d '{
    "alarmType": "High Temperature",
    "details": "Temperature exceeded limits",
    "locationName": "Building A",
    "equipmentName": "Boiler-1", 
    "alarmId": "alarm-123",
    "severity": "high",
    "recipients": ["tech@company.com"]
  }'

# Check job status
curl -X GET "/api/equipment/ABC123/status/job-123"
```

## 🛠️ Debugging & Troubleshooting

### API Health Checks
```bash
# Email service health
curl -X GET "/api/send-alarm-email"

# InfluxDB connectivity 
curl -X POST "/api/influx" \
  -H "Content-Type: application/json" \
  -d '{"query": "SHOW DATABASES"}'
```

### Common Issues

**BullMQ Jobs Stuck:**
```bash
# Check Redis connection
redis-cli ping

# List BullMQ jobs
redis-cli keys "bull:equipment-controls:*"
```

**InfluxDB Errors:**
```bash
# Test direct connection
curl -X POST "http://your-influxdb:8181/api/v3/query_sql" \
  -H "Content-Type: application/json" \
  -d '{"q":"SHOW DATABASES","db":"Locations"}'
```

**Email Delivery Issues:**
- Check Resend dashboard for delivery status
- Verify sender domain authentication
- Check recipient email validity

## 📋 API Changelog

### Version 1.0 (Current)
- Initial API implementation
- Equipment control with BullMQ
- Real-time state management
- InfluxDB data aggregation
- Email notification system
- Job status monitoring

### Planned Enhancements
- GraphQL endpoint for complex queries
- WebSocket support for real-time updates
- API versioning strategy
- Enhanced authentication & authorization
- Request/response caching
- API rate limiting middleware

---

**For additional support or API questions:**
- GitHub Issues: [Report API Issues](https://github.com/AutomataControls/AutomataControlsNexusBms-Production/issues)
- Email: enterprise@automatacontrols.com
