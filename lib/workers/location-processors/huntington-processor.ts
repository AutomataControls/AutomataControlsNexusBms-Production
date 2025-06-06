// @ts-nocheck
// lib/workers/location-processors/huntington-processor.ts
// Independent Huntington Location Processor
// Processes: boiler.ts (2min), chiller.ts (5min), fan-coil.ts (30s), pumps.ts (30s)

import fs from 'fs'
import path from 'path'
import Redis from 'ioredis'
import { formatLineProtocol } from '../../influxdb-client'

// Redis connection
const redis = new Redis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: null,
})

// Huntington equipment configuration
const EQUIPMENT_CONFIG = {
  'boiler': { 
    interval: 2 * 60 * 1000,    // 2 minutes (lead-lag coordination)
    file: 'boiler.ts'
  },
  'chiller': { 
    interval: 5 * 60 * 1000,    // 5 minutes (staging)
    file: 'chiller.ts'
  },
  'fan-coil': { 
    interval: 30 * 1000,        // 30 seconds (PID controllers)
    file: 'fan-coil.ts'
  },
  'pumps': { 
    interval: 30 * 1000,        // 30 seconds (PID controllers)
    file: 'pumps.ts'
  }
}

// Equipment timers
const equipmentTimers: Map<string, NodeJS.Timeout> = new Map()
const lastRun: Map<string, number> = new Map()

// Equipment logic base path
const EQUIPMENT_PATH = path.join(process.cwd(), 'lib', 'equipment-logic', 'locations', 'huntington')

// Initialize Huntington processors
async function initializeHuntingtonProcessors(): Promise<void> {
  console.log('[Huntington] Initializing equipment processors...')
  
  try {
    // Check which equipment files actually exist
    const availableFiles = fs.readdirSync(EQUIPMENT_PATH)
      .filter(file => file.endsWith('.ts') && !file.includes('helpers'))
    
    console.log(`[Huntington] Available equipment files: ${availableFiles.join(', ')}`)
    
    // Start timers for each configured equipment that exists
    for (const [equipmentType, config] of Object.entries(EQUIPMENT_CONFIG)) {
      if (availableFiles.includes(config.file)) {
        startEquipmentProcessor(equipmentType, config)
        console.log(`[Huntington] Started ${equipmentType} processor (${config.interval/1000}s interval)`)
      } else {
        console.log(`[Huntington] Skipping ${equipmentType} - file ${config.file} not found`)
      }
    }
    
    console.log('[Huntington] All equipment processors initialized')
    
  } catch (error) {
    console.error('[Huntington] Error initializing processors:', error)
    throw error
  }
}

// Start individual equipment processor
function startEquipmentProcessor(equipmentType: string, config: any): void {
  const timer = setInterval(async () => {
    await processEquipment(equipmentType, config)
  }, config.interval)
  
  equipmentTimers.set(equipmentType, timer)
  lastRun.set(equipmentType, 0)
}

// Process individual equipment
async function processEquipment(equipmentType: string, config: any): Promise<void> {
  const startTime = Date.now()
  
  try {
    console.log(`[Huntington] Processing ${equipmentType}...`)
    
    // Read UIControlCommands for huntington equipment
    const uiCommands = await readUIControlCommands(equipmentType)
    
    // Execute equipment logic
    const results = await executeEquipmentLogic(config.file, uiCommands)
    
    // Write actionable results to NeuralControlCommands
    if (results && results.length > 0) {
      await writeEquipmentResults(equipmentType, results)
    }
    
    // Update last run time
    lastRun.set(equipmentType, startTime)
    
    const duration = Date.now() - startTime
    console.log(`[Huntington] Completed ${equipmentType} in ${duration}ms`)
    
  } catch (error) {
    console.error(`[Huntington] Error processing ${equipmentType}:`, error)
  }
}

// Read UI control commands from UIControlCommands database
async function readUIControlCommands(equipmentType: string): Promise<any[]> {
  try {
    const database = process.env.INFLUXDB_DATABASE3 || 'UIControlCommands'
    const influxUrl = process.env.INFLUXDB_URL || 'http://143.198.162.31:8181'
    
    // Query recent UI commands for huntington equipment
    const query = `
      SELECT * FROM UIControlCommands 
      WHERE locationId = 'huntington' 
      AND command LIKE '%${equipmentType}%'
      AND time >= now() - 15m
      ORDER BY time DESC
      LIMIT 20
    `
    
    const response = await fetch(`${influxUrl}/api/v3/query_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: query,
        db: database
      })
    })
    
    if (response.ok) {
      const data = await response.json()
      return Array.isArray(data) ? data : []
    } else {
      // No UI commands is normal - equipment runs with defaults
      return []
    }
    
  } catch (error) {
    console.error(`[Huntington] Error reading UI commands for ${equipmentType}:`, error)
    return []
  }
}

// Execute equipment logic file
async function executeEquipmentLogic(fileName: string, uiCommands: any[]): Promise<any[]> {
  try {
    const filePath = path.join(EQUIPMENT_PATH, fileName)
    
    // Dynamic import of equipment logic
    const equipmentModule = await import(filePath)
    
    // Your equipment files might export different function names
    let equipmentFunction = null
    
    if (typeof equipmentModule.default === 'function') {
      equipmentFunction = equipmentModule.default
    } else if (typeof equipmentModule.processEquipment === 'function') {
      equipmentFunction = equipmentModule.processEquipment
    } else if (typeof equipmentModule.runLogic === 'function') {
      equipmentFunction = equipmentModule.runLogic
    }
    
    if (!equipmentFunction) {
      console.warn(`[Huntington] No callable function found in ${fileName}`)
      return []
    }
    
    // Execute the equipment logic with UI commands
    const results = await equipmentFunction(uiCommands)
    return Array.isArray(results) ? results : [results]
    
  } catch (error) {
    console.error(`[Huntington] Error executing ${fileName}:`, error)
    return []
  }
}

// Write equipment results to NeuralControlCommands
async function writeEquipmentResults(equipmentType: string, results: any[]): Promise<void> {
  try {
    const database = process.env.INFLUXDB_DATABASE5 || 'NeuralControlCommands'
    const influxUrl = process.env.INFLUXDB_URL || 'http://143.198.162.31:8181'
    
    for (const result of results) {
      if (!result || typeof result !== 'object') continue
      
      // Extract only actionable commands
      const actionableCommands = extractActionableCommands(result)
      
      if (Object.keys(actionableCommands).length === 0) continue
      
      const tags = {
        locationName: 'huntington',
        equipmentType,
        equipmentId: result.equipmentId || 'unknown',
        source: 'huntington-processor'
      }
      
      const fields = {
        timestamp: Date.now(),
        ...actionableCommands
      }
      
      // Write to NeuralControlCommands
      const lineProtocol = formatLineProtocol('NeuralControlCommands', tags, fields)
      
      const response = await fetch(`${influxUrl}/api/v3/write_lp?db=${database}&precision=nanosecond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: lineProtocol
      })
      
      if (!response.ok) {
        console.error(`[Huntington] Failed to write to ${database}: ${response.status}`)
      }
    }
    
    console.log(`[Huntington] Wrote ${results.length} ${equipmentType} results to NeuralControlCommands`)
    
  } catch (error) {
    console.error(`[Huntington] Error writing ${equipmentType} results:`, error)
  }
}

// Extract actionable commands (no diagnostic data)
function extractActionableCommands(result: any): Record<string, any> {
  const actionable: Record<string, any> = {}
  
  // Boiler actionable commands
  if (result.boilerEnable !== undefined) actionable.boilerEnable = result.boilerEnable
  if (result.boilerFiring !== undefined) actionable.boilerFiring = result.boilerFiring
  if (result.waterTempSetpoint !== undefined) actionable.waterTempSetpoint = result.waterTempSetpoint
  if (result.tempSetpoint !== undefined) actionable.tempSetpoint = result.tempSetpoint
  
  // Chiller actionable commands
  if (result.chillerEnable !== undefined) actionable.chillerEnable = result.chillerEnable
  if (result.chillerStage !== undefined) actionable.chillerStage = result.chillerStage
  if (result.cwTempSetpoint !== undefined) actionable.cwTempSetpoint = result.cwTempSetpoint
  if (result.chillerSetpoint !== undefined) actionable.chillerSetpoint = result.chillerSetpoint
  
  // Fan Coil actionable commands
  if (result.heatingValve !== undefined) actionable.heatingValve = result.heatingValve
  if (result.coolingValve !== undefined) actionable.coolingValve = result.coolingValve
  if (result.fanEnable !== undefined) actionable.fanEnable = result.fanEnable
  if (result.fanSpeed !== undefined) actionable.fanSpeed = result.fanSpeed
  if (result.unitEnable !== undefined) actionable.unitEnable = result.unitEnable
  
  // Pump actionable commands
  if (result.pumpEnable !== undefined) actionable.pumpEnable = result.pumpEnable
  
  return actionable
}

// Get processor status
function getProcessorStatus(): any {
  const status: any = {
    location: 'huntington',
    equipmentProcessors: {},
    totalProcessors: equipmentTimers.size
  }
  
  for (const [equipmentType, config] of Object.entries(EQUIPMENT_CONFIG)) {
    if (equipmentTimers.has(equipmentType)) {
      status.equipmentProcessors[equipmentType] = {
        interval: config.interval,
        lastRun: lastRun.get(equipmentType) || 0,
        nextRun: (lastRun.get(equipmentType) || 0) + config.interval,
        running: true
      }
    }
  }
  
  return status
}

// Graceful shutdown
async function shutdown(): Promise<void> {
  console.log('[Huntington] Shutting down equipment processors...')
  
  // Clear all timers
  for (const timer of equipmentTimers.values()) {
    clearInterval(timer)
  }
  
  // Close Redis connection
  await redis.quit()
  
  console.log('[Huntington] Shutdown complete')
  process.exit(0)
}

// Signal handlers
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

// Error handlers
process.on('uncaughtException', (error) => {
  console.error('[Huntington] Uncaught exception:', error)
  shutdown()
})

process.on('unhandledRejection', (reason) => {
  console.error('[Huntington] Unhandled rejection:', reason)
  shutdown()
})

// Redis connection handlers
redis.on('connect', () => {
  console.log('[Huntington] Redis connected')
})

redis.on('error', (err) => {
  console.error('[Huntington] Redis error:', err)
})

// Initialize and start
console.log('[Huntington] Starting Huntington location processor...')
initializeHuntingtonProcessors()
  .then(() => {
    console.log('[Huntington] Huntington processor started successfully')
    
    // Status logging every 10 minutes
    setInterval(() => {
      const status = getProcessorStatus()
      console.log(`[Huntington] Status: ${status.totalProcessors} equipment processors running`)
    }, 10 * 60 * 1000)
  })
  .catch((error) => {
    console.error('[Huntington] Failed to start Huntington processor:', error)
    process.exit(1)
  })

export { getProcessorStatus }
