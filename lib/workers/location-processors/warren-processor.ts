// @ts-nocheck
// lib/workers/location-processors/warren-processor.ts
// Independent Warren Location Processor
// Processes: air-handler.ts (30s), fan-coil.ts (30s), pumps.ts (30s), steam-bundle.ts (3min)

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

// Warren equipment configuration
const EQUIPMENT_CONFIG = {
  'air-handler': { 
    interval: 30 * 1000,        // 30 seconds (PID controllers)
    file: 'air-handler.ts'
  },
  'fan-coil': { 
    interval: 30 * 1000,        // 30 seconds (PID controllers)
    file: 'fan-coil.ts'
  },
  'pumps': { 
    interval: 30 * 1000,        // 30 seconds (PID controllers)
    file: 'pumps.ts'
  },
  'steam-bundle': { 
    interval: 3 * 60 * 1000,    // 3 minutes (valve control)
    file: 'steam-bundle.ts'
  }
}

// Equipment state
const equipmentTimers: Map<string, NodeJS.Timeout> = new Map()
const lastRun: Map<string, number> = new Map()
const EQUIPMENT_PATH = path.join(process.cwd(), 'lib', 'equipment-logic', 'locations', 'warren')

// Initialize Warren processors
async function initializeWarrenProcessors(): Promise<void> {
  console.log('[Warren] Initializing equipment processors...')
  
  try {
    const availableFiles = fs.readdirSync(EQUIPMENT_PATH)
      .filter(file => file.endsWith('.ts') && !file.includes('helpers'))
    
    console.log(`[Warren] Available equipment: ${availableFiles.join(', ')}`)
    
    for (const [equipmentType, config] of Object.entries(EQUIPMENT_CONFIG)) {
      if (availableFiles.includes(config.file)) {
        startEquipmentProcessor(equipmentType, config)
        console.log(`[Warren] Started ${equipmentType} processor (${config.interval/1000}s)`)
      }
    }
    
    console.log('[Warren] All processors initialized')
    
  } catch (error) {
    console.error('[Warren] Initialization error:', error)
    throw error
  }
}

function startEquipmentProcessor(equipmentType: string, config: any): void {
  const timer = setInterval(async () => {
    await processEquipment(equipmentType, config)
  }, config.interval)
  
  equipmentTimers.set(equipmentType, timer)
  lastRun.set(equipmentType, 0)
}

async function processEquipment(equipmentType: string, config: any): Promise<void> {
  const startTime = Date.now()
  
  try {
    console.log(`[Warren] Processing ${equipmentType}...`)
    
    const uiCommands = await readUIControlCommands(equipmentType)
    const results = await executeEquipmentLogic(config.file, uiCommands)
    
    if (results && results.length > 0) {
      await writeEquipmentResults(equipmentType, results)
    }
    
    lastRun.set(equipmentType, startTime)
    console.log(`[Warren] Completed ${equipmentType} in ${Date.now() - startTime}ms`)
    
  } catch (error) {
    console.error(`[Warren] Error processing ${equipmentType}:`, error)
  }
}

async function readUIControlCommands(equipmentType: string): Promise<any[]> {
  try {
    const database = process.env.INFLUXDB_DATABASE3 || 'UIControlCommands'
    const influxUrl = process.env.INFLUXDB_URL || 'http://143.198.162.31:8181'
    
    const query = `
      SELECT * FROM UIControlCommands 
      WHERE locationId = 'warren' 
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
    console.error(`[Warren] UI command read error:`, error)
    return []
  }
}

async function executeEquipmentLogic(fileName: string, uiCommands: any[]): Promise<any[]> {
  try {
    const filePath = path.join(EQUIPMENT_PATH, fileName)
    const equipmentModule = await import(filePath)
    
    const equipmentFunction = equipmentModule.default || 
                              equipmentModule.processEquipment || 
                              equipmentModule.runLogic
    
    if (!equipmentFunction) return []
    
    const results = await equipmentFunction(uiCommands)
    return Array.isArray(results) ? results : [results]
    
  } catch (error) {
    console.error(`[Warren] Logic execution error:`, error)
    return []
  }
}

async function writeEquipmentResults(equipmentType: string, results: any[]): Promise<void> {
  try {
    const database = process.env.INFLUXDB_DATABASE5 || 'NeuralControlCommands'
    const influxUrl = process.env.INFLUXDB_URL || 'http://143.198.162.31:8181'
    
    for (const result of results) {
      if (!result || typeof result !== 'object') continue
      
      const actionableCommands = extractActionableCommands(result)
      if (Object.keys(actionableCommands).length === 0) continue
      
      const tags = {
        locationName: 'warren',
        equipmentType,
        equipmentId: result.equipmentId || 'unknown',
        source: 'warren-processor'
      }
      
      const lineProtocol = formatLineProtocol('NeuralControlCommands', tags, {
        timestamp: Date.now(),
        ...actionableCommands
      })
      
      await fetch(`${influxUrl}/api/v3/write_lp?db=${database}&precision=nanosecond`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: lineProtocol
      })
    }
    
    console.log(`[Warren] Wrote ${results.length} ${equipmentType} results`)
    
  } catch (error) {
    console.error(`[Warren] Write error:`, error)
  }
}

function extractActionableCommands(result: any): Record<string, any> {
  const actionable: Record<string, any> = {}
  
  // Air Handler + Fan Coil commands
  if (result.heatingValve !== undefined) actionable.heatingValve = result.heatingValve
  if (result.coolingValve !== undefined) actionable.coolingValve = result.coolingValve
  if (result.fanEnable !== undefined) actionable.fanEnable = result.fanEnable
  if (result.fanSpeed !== undefined) actionable.fanSpeed = result.fanSpeed
  if (result.unitEnable !== undefined) actionable.unitEnable = result.unitEnable
  if (result.outdoorDamper !== undefined) actionable.outdoorDamper = result.outdoorDamper
  
  // Pump commands
  if (result.pumpEnable !== undefined) actionable.pumpEnable = result.pumpEnable
  
  // Steam Bundle commands
  if (result.steamValve !== undefined) actionable.steamValve = result.steamValve
  if (result.steamEnable !== undefined) actionable.steamEnable = result.steamEnable
  
  return actionable
}

async function shutdown(): Promise<void> {
  console.log('[Warren] Shutting down...')
  for (const timer of equipmentTimers.values()) {
    clearInterval(timer)
  }
  await redis.quit()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
redis.on('connect', () => console.log('[Warren] Redis connected'))
redis.on('error', (err) => console.error('[Warren] Redis error:', err))

console.log('[Warren] Starting Warren processor...')
initializeWarrenProcessors()
  .then(() => console.log('[Warren] Started successfully'))
  .catch((error) => {
    console.error('[Warren] Failed to start:', error)
    process.exit(1)
  })
