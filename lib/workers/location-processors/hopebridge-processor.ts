// @ts-nocheck
// lib/workers/location-processors/hopebridge-processor.ts
// Independent Hopebridge Location Processor
// Processes: air-handler.ts (30s), boiler.ts (2min)

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

// Hopebridge equipment configuration
const EQUIPMENT_CONFIG = {
  'air-handler': { 
    interval: 30 * 1000,        // 30 seconds (PID controllers)
    file: 'air-handler.ts'
  },
  'boiler': { 
    interval: 2 * 60 * 1000,    // 2 minutes (lead-lag coordination)
    file: 'boiler.ts'
  }
}

// Equipment timers and state
const equipmentTimers: Map<string, NodeJS.Timeout> = new Map()
const lastRun: Map<string, number> = new Map()

// Equipment logic path
const EQUIPMENT_PATH = path.join(process.cwd(), 'lib', 'equipment-logic', 'locations', 'hopebridge')

// Initialize Hopebridge processors
async function initializeHopebridgeProcessors(): Promise<void> {
  console.log('[Hopebridge] Initializing equipment processors...')
  
  try {
    // Check available equipment files
    const availableFiles = fs.readdirSync(EQUIPMENT_PATH)
      .filter(file => file.endsWith('.ts') && !file.includes('helpers'))
    
    console.log(`[Hopebridge] Available equipment: ${availableFiles.join(', ')}`)
    
    // Start processors for existing equipment
    for (const [equipmentType, config] of Object.entries(EQUIPMENT_CONFIG)) {
      if (availableFiles.includes(config.file)) {
        startEquipmentProcessor(equipmentType, config)
        console.log(`[Hopebridge] Started ${equipmentType} processor (${config.interval/1000}s interval)`)
      } else {
        console.log(`[Hopebridge] Skipping ${equipmentType} - file not found`)
      }
    }
    
    console.log('[Hopebridge] All processors initialized')
    
  } catch (error) {
    console.error('[Hopebridge] Initialization error:', error)
    throw error
  }
}

// Start equipment processor
function startEquipmentProcessor(equipmentType: string, config: any): void {
  const timer = setInterval(async () => {
    await processEquipment(equipmentType, config)
  }, config.interval)
  
  equipmentTimers.set(equipmentType, timer)
  lastRun.set(equipmentType, 0)
}

// Process equipment logic
async function processEquipment(equipmentType: string, config: any): Promise<void> {
  const startTime = Date.now()
  
  try {
    console.log(`[Hopebridge] Processing ${equipmentType}...`)
    
    // Read UI commands
    const uiCommands = await readUIControlCommands(equipmentType)
    
    // Execute equipment logic
    const results = await executeEquipmentLogic(config.file, uiCommands)
    
    // Write results
    if (results && results.length > 0) {
      await writeEquipmentResults(equipmentType, results)
    }
    
    lastRun.set(equipmentType, startTime)
    
    const duration = Date.now() - startTime
    console.log(`[Hopebridge] Completed ${equipmentType} in ${duration}ms`)
    
  } catch (error) {
    console.error(`[Hopebridge] Error processing ${equipmentType}:`, error)
  }
}

// Read UI commands from database
async function readUIControlCommands(equipmentType: string): Promise<any[]> {
  try {
    const database = process.env.INFLUXDB_DATABASE3 || 'UIControlCommands'
    const influxUrl = process.env.INFLUXDB_URL || 'http://143.198.162.31:8181'
    
    const query = `
      SELECT * FROM UIControlCommands 
      WHERE locationId = 'hopebridge' 
      AND command LIKE '%${equipmentType}%'
      AND time >= now() - 15m
      ORDER BY time DESC
      LIMIT 20
    `
    
    const response = await fetch(`${influxUrl}/api/v3/query_sql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, db: database })
    })
    
    if (response.ok) {
      const data = await response.json()
      return Array.isArray(data) ? data : []
    }
    return []
    
  } catch (error) {
    console.error(`[Hopebridge] Error reading UI commands:`, error)
    return []
  }
}

// Execute equipment logic
async function executeEquipmentLogic(fileName: string, uiCommands: any[]): Promise<any[]> {
  try {
    const filePath = path.join(EQUIPMENT_PATH, fileName)
    const equipmentModule = await import(filePath)
    
    let equipmentFunction = equipmentModule.default || 
                           equipmentModule.processEquipment || 
                           equipmentModule.runLogic
    
    if (!equipmentFunction) {
      console.warn(`[Hopebridge] No function found in ${fileName}`)
      return []
    }
    
    const results = await equipmentFunction(uiCommands)
    return Array.isArray(results) ? results : [results]
    
  } catch (error) {
    console.error(`[Hopebridge] Error executing ${fileName}:`, error)
    return []
  }
}

// Write results to NeuralControlCommands
async function writeEquipmentResults(equipmentType: string, results: any[]): Promise<void> {
  try {
    const database = process.env.INFLUXDB_DATABASE5 || 'NeuralControlCommands'
    const influxUrl = process.env.INFLUXDB_URL || 'http://143.198.162.31:8181'
    
    for (const result of results) {
      if (!result || typeof result !== 'object') continue
      
      const actionableCommands = extractActionableCommands(result)
      if (Object.keys(actionableCommands).length === 0) continue
      
      const tags = {
        locationName: 'hopebridge',
        equipmentType,
        equipmentId: result.equipmentId || 'unknown',
        source: 'hopebridge-processor'
      }
      
      const fields = {
        timestamp: Date.now(),
        ...actionableCommands
      }
      
      const lineProtocol = formatLineProtocol('NeuralControlCommands', tags, fields)
      
      const response = await fetch(`${influxUrl}/api/v3/write_lp?db=${database}&precision=nanosecond`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: lineProtocol
      })
      
      if (!response.ok) {
        console.error(`[Hopebridge] Write failed: ${response.status}`)
      }
    }
    
    console.log(`[Hopebridge] Wrote ${results.length} ${equipmentType} results`)
    
  } catch (error) {
    console.error(`[Hopebridge] Write error:`, error)
  }
}

// Extract actionable commands
function extractActionableCommands(result: any): Record<string, any> {
  const actionable: Record<string, any> = {}
  
  // Air Handler commands
  if (result.heatingValve !== undefined) actionable.heatingValve = result.heatingValve
  if (result.coolingValve !== undefined) actionable.coolingValve = result.coolingValve
  if (result.fanEnable !== undefined) actionable.fanEnable = result.fanEnable
  if (result.fanSpeed !== undefined) actionable.fanSpeed = result.fanSpeed
  if (result.outdoorDamper !== undefined) actionable.outdoorDamper = result.outdoorDamper
  if (result.unitEnable !== undefined) actionable.unitEnable = result.unitEnable
  if (result.dxEnable !== undefined) actionable.dxEnable = result.dxEnable
  if (result.cwPumpEnable !== undefined) actionable.cwPumpEnable = result.cwPumpEnable
  if (result.chillerEnable !== undefined) actionable.chillerEnable = result.chillerEnable
  if (result.supplyTempSetpoint !== undefined) actionable.supplyTempSetpoint = result.supplyTempSetpoint
  
  // Boiler commands
  if (result.boilerEnable !== undefined) actionable.boilerEnable = result.boilerEnable
  if (result.boilerFiring !== undefined) actionable.boilerFiring = result.boilerFiring
  if (result.waterTempSetpoint !== undefined) actionable.waterTempSetpoint = result.waterTempSetpoint
  
  return actionable
}

// Graceful shutdown
async function shutdown(): Promise<void> {
  console.log('[Hopebridge] Shutting down...')
  for (const timer of equipmentTimers.values()) {
    clearInterval(timer)
  }
  await redis.quit()
  process.exit(0)
}

// Signal handlers
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

// Redis handlers
redis.on('connect', () => console.log('[Hopebridge] Redis connected'))
redis.on('error', (err) => console.error('[Hopebridge] Redis error:', err))

// Initialize
console.log('[Hopebridge] Starting Hopebridge processor...')
initializeHopebridgeProcessors()
  .then(() => console.log('[Hopebridge] Started successfully'))
  .catch((error) => {
    console.error('[Hopebridge] Failed to start:', error)
    process.exit(1)
  })
