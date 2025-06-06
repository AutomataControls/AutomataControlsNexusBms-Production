// @ts-nocheck
// lib/workers/location-processors/firstchurchofgod-processor.ts
// Independent FirstChurchOfGod Location Processor
// Processes: air-handler.ts (30s)

import fs from 'fs'
import path from 'path'
import Redis from 'ioredis'
import { formatLineProtocol } from '../../influxdb-client'

const redis = new Redis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: null,
})

const EQUIPMENT_CONFIG = {
  'air-handler': { 
    interval: 30 * 1000,        // 30 seconds (PID controllers)
    file: 'air-handler.ts'
  }
}

const equipmentTimers: Map<string, NodeJS.Timeout> = new Map()
const lastRun: Map<string, number> = new Map()
const EQUIPMENT_PATH = path.join(process.cwd(), 'lib', 'equipment-logic', 'locations', 'firstchurchofgod')

async function initializeFirstChurchOfGodProcessors(): Promise<void> {
  console.log('[FirstChurchOfGod] Initializing processors...')
  
  try {
    const availableFiles = fs.readdirSync(EQUIPMENT_PATH)
      .filter(file => file.endsWith('.ts'))
    
    console.log(`[FirstChurchOfGod] Available: ${availableFiles.join(', ')}`)
    
    for (const [equipmentType, config] of Object.entries(EQUIPMENT_CONFIG)) {
      if (availableFiles.includes(config.file)) {
        startEquipmentProcessor(equipmentType, config)
        console.log(`[FirstChurchOfGod] Started ${equipmentType} (${config.interval/1000}s)`)
      }
    }
    
  } catch (error) {
    console.error('[FirstChurchOfGod] Init error:', error)
    throw error
  }
}

function startEquipmentProcessor(equipmentType: string, config: any): void {
  const timer = setInterval(async () => {
    await processEquipment(equipmentType, config)
  }, config.interval)
  
  equipmentTimers.set(equipmentType, timer)
}

async function processEquipment(equipmentType: string, config: any): Promise<void> {
  const startTime = Date.now()
  
  try {
    console.log(`[FirstChurchOfGod] Processing ${equipmentType}...`)
    
    const uiCommands = await readUIControlCommands(equipmentType)
    const results = await executeEquipmentLogic(config.file, uiCommands)
    
    if (results && results.length > 0) {
      await writeEquipmentResults(equipmentType, results)
    }
    
    console.log(`[FirstChurchOfGod] Completed ${equipmentType} in ${Date.now() - startTime}ms`)
    
  } catch (error) {
    console.error(`[FirstChurchOfGod] Error:`, error)
  }
}

async function readUIControlCommands(equipmentType: string): Promise<any[]> {
  try {
    const database = process.env.INFLUXDB_DATABASE3 || 'UIControlCommands'
    const influxUrl = process.env.INFLUXDB_URL || 'http://143.198.162.31:8181'
    
    const query = `
      SELECT * FROM UIControlCommands 
      WHERE locationId = 'firstchurchofgod' 
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
    
    return response.ok ? await response.json() || [] : []
    
  } catch (error) {
    return []
  }
}

async function executeEquipmentLogic(fileName: string, uiCommands: any[]): Promise<any[]> {
  try {
    const filePath = path.join(EQUIPMENT_PATH, fileName)
    const equipmentModule = await import(filePath)
    
    const equipmentFunction = equipmentModule.default || 
                              equipmentModule.processEquipment
    
    if (!equipmentFunction) return []
    
    const results = await equipmentFunction(uiCommands)
    return Array.isArray(results) ? results : [results]
    
  } catch (error) {
    return []
  }
}

async function writeEquipmentResults(equipmentType: string, results: any[]): Promise<void> {
  try {
    const database = process.env.INFLUXDB_DATABASE5 || 'NeuralControlCommands'
    const influxUrl = process.env.INFLUXDB_URL || 'http://143.198.162.31:8181'
    
    for (const result of results) {
      if (!result) continue
      
      const actionable = extractActionableCommands(result)
      if (Object.keys(actionable).length === 0) continue
      
      const lineProtocol = formatLineProtocol('NeuralControlCommands', {
        locationName: 'firstchurchofgod',
        equipmentType,
        equipmentId: result.equipmentId || 'unknown',
        source: 'firstchurchofgod-processor'
      }, {
        timestamp: Date.now(),
        ...actionable
      })
      
      await fetch(`${influxUrl}/api/v3/write_lp?db=${database}&precision=nanosecond`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: lineProtocol
      })
    }
    
  } catch (error) {
    console.error('[FirstChurchOfGod] Write error:', error)
  }
}

function extractActionableCommands(result: any): Record<string, any> {
  const actionable: Record<string, any> = {}
  
  if (result.heatingValve !== undefined) actionable.heatingValve = result.heatingValve
  if (result.coolingValve !== undefined) actionable.coolingValve = result.coolingValve
  if (result.fanEnable !== undefined) actionable.fanEnable = result.fanEnable
  if (result.fanSpeed !== undefined) actionable.fanSpeed = result.fanSpeed
  if (result.unitEnable !== undefined) actionable.unitEnable = result.unitEnable
  if (result.supplyTempSetpoint !== undefined) actionable.supplyTempSetpoint = result.supplyTempSetpoint
  
  return actionable
}

async function shutdown(): Promise<void> {
  console.log('[FirstChurchOfGod] Shutting down...')
  for (const timer of equipmentTimers.values()) {
    clearInterval(timer)
  }
  await redis.quit()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
redis.on('connect', () => console.log('[FirstChurchOfGod] Redis connected'))

console.log('[FirstChurchOfGod] Starting processor...')
initializeFirstChurchOfGodProcessors()
  .then(() => console.log('[FirstChurchOfGod] Started successfully'))
  .catch(error => process.exit(1))
