# InfluxDB 3.0 Integration Guide

## 🚀 Overview

Automata Controls Nexus BMS leverages **InfluxDB 3.0** as its primary time-series database for high-performance industrial building management. This guide covers the comprehensive integration architecture, advanced features, and enterprise-grade capabilities that power real-time HVAC control across multiple locations.

## 📊 InfluxDB 3.0 Advantages

### **Columnar Storage Engine**
- **Apache Arrow** format for 10-100x faster query performance
- **Optimized compression** for massive time-series datasets
- **Vectorized processing** for analytical workloads

### **SQL Compatibility**
- **Standard SQL syntax** with time-series extensions
- **Complex joins and aggregations** across equipment data
- **Familiar syntax** for developers and analysts

### **Unlimited Cardinality**
- **No series limits** for complex equipment hierarchies
- **High-dimensional data** with unlimited tag combinations
- **Scalable architecture** for enterprise deployments

---

## 🏗️ Architecture Overview

### **Database Structure**
```
InfluxDB 3.0 Cluster
├── Locations (Primary Database)
│   ├── metrics table (Real-time equipment data)
│   ├── control_data table (Aggregated system data)
│   └── equipment_config table (Configuration storage)
├── UIControlCommands (User Interface Commands)
├── NeuralControlCommands (AI-generated Commands)
└── Location-specific databases (Per-site isolation)
```

### **Client Architecture**
```typescript
// lib/influxdb-client.ts - Comprehensive TypeScript Client
export class InfluxDBClient {
  // SQL query execution with retry logic
  queryInfluxDB(query: string, options?: QueryOptions)
  
  // Line protocol writing with batch support
  writeToInfluxDB(lineProtocol: string, options?: WriteOptions)
  
  // Equipment-specific data retrieval
  getEquipmentMetrics(equipmentId: string, locationId: string)
  
  // Control command management
  writeControlCommand(command: string, data: CommandData)
}
```

---

## ⚡ Core Client Implementation

### **Enhanced Client Features**

#### **1. Robust Error Handling & Retry Logic**
```typescript
// Automatic retry with exponential backoff
const result = await queryInfluxDB(query, {
  maxRetries: 3,
  retryDelay: 1000,
  timeout: 30000
});

// Server errors (5xx) trigger automatic retry
// Client errors (4xx) fail immediately
// Timeout protection with AbortController
```

#### **2. Advanced Line Protocol Formatting**
```typescript
// Automatic type detection and formatting
const lineProtocol = formatLineProtocol(
  'metrics',                    // Measurement
  { equipmentId: 'EQUIP001' },  // Tags
  { temperature: 72.5 },        // Fields (auto-typed)
  Date.now() * 1000000         // Nanosecond precision
);

// Output: metrics,equipmentId=EQUIP001 temperature=72.5 1625097600000000000
```

#### **3. Equipment-Specific Data Retrieval**
```typescript
// Get comprehensive equipment metrics
const { success, metrics } = await getEquipmentMetrics(
  'ZLYR6YveSmCEMqtBSy3e',  // Equipment ID
  '4'                       // Location ID
);

// Returns typed metrics with automatic conversion
// Handles missing data with intelligent fallbacks
```

---

## 🎯 Real-World Usage Examples

### **1. Equipment Metrics Query**
```sql
-- Get latest boiler performance data
SELECT 
  equipmentId,
  H20Supply,
  H20Return,
  (H20Supply - H20Return) AS deltaT,
  Firing,
  time
FROM metrics 
WHERE equipmentId = 'ZLYR6YveSmCEMqtBSy3e'
  AND location_id = '4'
  AND time >= now() - INTERVAL '15 minutes'
ORDER BY time DESC
LIMIT 100;
```

### **2. Multi-Equipment Aggregation**
```sql
-- System-wide efficiency analysis
SELECT 
  location_id,
  equipment_type,
  AVG(efficiency) as avg_efficiency,
  COUNT(*) as equipment_count,
  MAX(time) as last_update
FROM metrics 
WHERE time >= now() - INTERVAL '1 hour'
GROUP BY location_id, equipment_type
ORDER BY avg_efficiency DESC;
```

### **3. Control Command Processing**
```typescript
// Write equipment control command
await writeControlCommand('setpoint', {
  equipmentId: 'BBHCLhaeItV7pIdinQzM',
  locationId: '4',
  value: 72,
  userId: 'user123',
  userName: 'Facility Manager',
  details: 'Temperature adjustment for comfort'
});
```

---

## 🏭 Industrial Equipment Integration

### **Multi-Location Architecture**

#### **Location Processors**
```typescript
// Huntington Location Processor
// Processes 15 equipment units with intelligent scheduling
const EQUIPMENT_CONFIG = {
  'comfort-boiler-1': {
    interval: 2 * 60 * 1000,     // 2-minute intervals
    equipmentId: 'ZLYR6YveSmCEMqtBSy3e'
  },
  'fan-coil-1': {
    interval: 30 * 1000,         // 30-second intervals for PID control
    equipmentId: 'BBHCLhaeItV7pIdinQzM'
  }
  // ... 13 more equipment units
};
```

#### **Smart Queue Processing**
```typescript
// Intelligent processing decisions based on:
// 1. Safety conditions (Priority 20)
// 2. Temperature deviation (Priority 15) 
// 3. UI commands (Priority 10)
// 4. Significant changes (Priority 5)
// 5. Maximum stale time (Priority 1)

const shouldProcess = await shouldProcessEquipment(equipmentId, equipmentType);
if (shouldProcess.process) {
  await addEquipmentToQueue(equipmentId, locationId, equipmentType);
}
```

### **Equipment Logic Factory**
```typescript
// 4-Parameter Equipment Interface
await equipmentFunction(
  metricsInput,         // Real-time InfluxDB data
  settingsInput,        // Equipment configuration
  currentTempArgument,  // Control temperature
  stateStorageInput     // PID state management
);

// Writes results to NeuralControlCommands
const lineProtocol = `NeuralCommands,equipment_id=${equipmentId},location_id=4,command_type=${commandType},equipment_type=${equipmentType},source=logic-factory,status=active value="${String(value)}"`;
```

---

## 🔧 Advanced Features

### **1. Batch Processing**
```typescript
// Multiple commands in single operation
const batchData = [
  'metrics,equipmentId=001 temp=72.5',
  'metrics,equipmentId=002 temp=68.2',
  'metrics,equipmentId=003 temp=75.1'
].join('\n');

await writeToInfluxDB(batchData);
```

### **2. Time Range Queries**
```typescript
// Flexible time-based filtering
const query = createTimeRangeQuery(
  'metrics',                    // Measurement
  ['temperature', 'pressure'],  // Fields
  'equipmentId = "EQUIP001"',   // Filters
  24,                          // Hours (last 24 hours)
  1000                         // Limit
);
```

### **3. State Management Integration**
```typescript
// Equipment state persistence with Redis
const redisKey = `equipment:${equipmentId}:state`;
await connection.setex(redisKey, 24 * 3600, JSON.stringify({
  lastModified: timestamp,
  lastModifiedBy: userName,
  command: commandType,
  settings: controlSettings
}));
```

---

## 📈 Performance Optimizations

### **Query Optimization Strategies**

#### **1. Efficient Field Selection**
```sql
-- ✅ Good: Select only needed fields
SELECT equipmentId, temperature, time 
FROM metrics 
WHERE time >= now() - INTERVAL '1 hour';

-- ❌ Avoid: Select all fields for large datasets
SELECT * FROM metrics WHERE time >= now() - INTERVAL '24 hours';
```

#### **2. Strategic Indexing**
```sql
-- Leverage automatic indexing on:
-- - time column (automatic)
-- - tag columns (equipmentId, locationId)
-- - Avoid filtering on field columns in WHERE clauses
```

#### **3. Batch Write Operations**
```typescript
// ✅ Efficient: Batch multiple points
const batchData = equipmentData
  .map(data => formatLineProtocol(measurement, tags, fields))
  .join('\n');

await writeToInfluxDB(batchData);

// ❌ Inefficient: Individual writes
for (const data of equipmentData) {
  await writeToInfluxDB(formatLineProtocol(measurement, tags, fields));
}
```

---

## 🛡️ Production Deployment

### **Environment Configuration**
```bash
# Core InfluxDB settings
INFLUXDB_URL=https://your-influxdb-server:8181
INFLUXDB_DATABASE=Locations
INFLUXDB_TIMEOUT=30000
INFLUXDB_MAX_RETRIES=3
INFLUXDB_RETRY_DELAY=1000
INFLUXDB_DEBUG=false

# Multi-database support
INFLUXDB_DATABASE3=UIControlCommands
INFLUXDB_DATABASE5=NeuralControlCommands
```

### **High Availability Setup**
```typescript
// Multiple InfluxDB instances with failover
const influxCluster = [
  'https://influx-primary:8181',
  'https://influx-secondary:8181',
  'https://influx-tertiary:8181'
];

// Automatic failover in client implementation
```

### **Monitoring & Alerting**
```typescript
// Performance monitoring
const startTime = performance.now();
const result = await queryInfluxDB(query);
const queryTime = performance.now() - startTime;

if (queryTime > 5000) {  // 5-second threshold
  console.warn(`Slow query detected: ${queryTime}ms`);
}
```

---

## 🔄 Multi-Equipment Data Flow

### **1. Real-Time Metrics Collection**
```
Equipment Sensors → Location Processor → InfluxDB Metrics
                                      ↓
                              Equipment Logic Factory
                                      ↓
                              Neural Commands → InfluxDB
```

### **2. Equipment Control Loop**
```typescript
// Complete control cycle
async function controlLoop(equipmentId: string) {
  // 1. Gather metrics from InfluxDB
  const metrics = await getEquipmentMetrics(equipmentId, locationId);
  
  // 2. Execute equipment logic
  const commands = await executeEquipmentLogic(metrics);
  
  // 3. Write commands back to InfluxDB
  await writeControlCommands(commands);
  
  // 4. Update equipment state in Redis
  await updateEquipmentState(equipmentId, commands);
}
```

---

## 📊 Analytics & Reporting

### **Equipment Performance Analytics**
```sql
-- Boiler efficiency trending
SELECT 
  DATE_TRUNC('hour', time) as hour,
  equipmentId,
  AVG(H20Supply - H20Return) as avg_delta_t,
  AVG(efficiency) as avg_efficiency,
  COUNT(*) as data_points
FROM metrics 
WHERE equipment_type = 'boiler'
  AND time >= now() - INTERVAL '7 days'
GROUP BY hour, equipmentId
ORDER BY hour DESC;
```

### **Energy Consumption Analysis**
```sql
-- Daily energy consumption by location
SELECT 
  location_id,
  DATE(time) as date,
  SUM(energy_consumption) as total_kwh,
  AVG(efficiency) as avg_efficiency
FROM metrics 
WHERE time >= now() - INTERVAL '30 days'
GROUP BY location_id, date
ORDER BY date DESC, total_kwh DESC;
```

---

## 🚨 Troubleshooting

### **Common Issues & Solutions**

#### **1. Connection Timeouts**
```typescript
// Increase timeout for complex queries
const result = await queryInfluxDB(query, {
  timeout: 60000  // 60 seconds for complex analytics
});
```

#### **2. High Cardinality Issues**
```sql
-- ✅ Good: Reasonable cardinality
SELECT * FROM metrics 
WHERE equipmentId = 'specific_id'
  AND time >= now() - INTERVAL '1 hour';

-- ⚠️ Caution: High cardinality queries
SELECT DISTINCT equipmentId FROM metrics; -- Can be expensive
```

#### **3. Memory Optimization**
```typescript
// Process large datasets in chunks
const CHUNK_SIZE = 1000;
for (let offset = 0; offset < totalRecords; offset += CHUNK_SIZE) {
  const chunk = await queryInfluxDB(`
    SELECT * FROM metrics 
    ORDER BY time DESC 
    LIMIT ${CHUNK_SIZE} OFFSET ${offset}
  `);
  await processChunk(chunk.data);
}
```

### **Debug Mode**
```bash
# Enable detailed logging
INFLUXDB_DEBUG=true

# Logs will show:
# - Query execution details
# - Write operation status
# - Retry attempts
# - Performance metrics
```

---

## 🔮 Advanced Use Cases

### **1. Predictive Analytics**
```sql
-- Identify equipment trending toward failure
SELECT 
  equipmentId,
  equipment_type,
  AVG(efficiency) as avg_efficiency,
  STDDEV(efficiency) as efficiency_variance,
  COUNT(*) as data_points
FROM metrics 
WHERE time >= now() - INTERVAL '7 days'
GROUP BY equipmentId, equipment_type
HAVING avg_efficiency < 75 OR efficiency_variance > 10
ORDER BY avg_efficiency ASC;
```

### **2. Lead-Lag Optimization**
```sql
-- Pump runtime balancing for lead-lag systems
SELECT 
  equipmentId,
  SUM(CASE WHEN pumpEnable = true THEN 1 ELSE 0 END) as runtime_hours,
  AVG(amps) as avg_amperage,
  MAX(time) as last_runtime
FROM metrics 
WHERE equipment_type = 'pump'
  AND location_id = '4'
  AND time >= now() - INTERVAL '30 days'
GROUP BY equipmentId
ORDER BY runtime_hours DESC;
```

### **3. Energy Optimization**
```sql
-- Identify most energy-efficient operating conditions
SELECT 
  ROUND(outdoor_temperature, 0) as temp_range,
  equipment_type,
  AVG(energy_consumption) as avg_consumption,
  AVG(efficiency) as avg_efficiency,
  COUNT(*) as samples
FROM metrics 
WHERE time >= now() - INTERVAL '90 days'
  AND outdoor_temperature IS NOT NULL
GROUP BY temp_range, equipment_type
HAVING samples > 100
ORDER BY avg_efficiency DESC, avg_consumption ASC;
```

---

## 📚 Best Practices

### **Schema Design**
- **Use tags for dimensions** (equipmentId, locationId, equipment_type)
- **Use fields for measurements** (temperature, pressure, efficiency)
- **Consistent naming conventions** across all measurements
- **Avoid high-cardinality tags** (timestamps, random IDs)

### **Query Optimization**
- **Filter by time first** in WHERE clauses
- **Use tag filters** before field filters
- **Limit result sets** with appropriate LIMIT clauses
- **Aggregate data** for reporting dashboards

### **Write Patterns**
- **Batch writes** for better performance
- **Consistent timestamps** for accurate ordering
- **Proper data types** in line protocol
- **Handle write failures** gracefully

### **Monitoring**
- **Track query performance** with timing
- **Monitor write success rates** and retries
- **Alert on connection failures** and timeouts
- **Regular database maintenance** and optimization

---

## 🎯 Next Steps

### **Integration Checklist**
- [ ] Configure InfluxDB 3.0 connection parameters
- [ ] Implement error handling and retry logic
- [ ] Set up monitoring and alerting
- [ ] Create equipment-specific queries
- [ ] Optimize for your data patterns
- [ ] Test failover scenarios
- [ ] Document custom schemas

### **Advanced Features to Explore**
- **Continuous queries** for real-time aggregations
- **Retention policies** for data lifecycle management
- **Backup and restore** procedures
- **Scaling strategies** for enterprise deployment
- **Integration with** visualization tools (Grafana, custom dashboards)

---

This comprehensive InfluxDB 3.0 integration powers the entire Automata Controls Nexus BMS, enabling real-time building management with enterprise-grade performance and reliability. The columnar storage engine and SQL compatibility make it ideal for both operational control and analytical workloads.
