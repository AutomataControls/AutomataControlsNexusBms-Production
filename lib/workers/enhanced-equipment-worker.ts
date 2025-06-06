// @ts-nocheck
// lib/workers/enhanced-equipment-worker.ts
// Enhanced BullMQ Worker for UI Equipment Commands
// Processes user interface commands and saves to UIControlCommands database

import { Worker, Queue, Job } from 'bullmq'
import Redis from 'ioredis'
import { formatLineProtocol } from '../influxdb-client'

// Redis connection for state management
const connection = new Redis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: null,
})

// BullMQ Queue for equipment control commands
const equipmentQueue = new Queue('equipment-controls', { connection })

// Job data interface
interface EquipmentControlJob {
  equipmentId: string
  locationId: string
  userId: string
  userName: string
  command: string
  settings: {
    enabled?: boolean
    isLead?: boolean
    supplyTempSetpoint?: number
    temperatureSetpoint?: number
    heatingValvePosition?: number
    coolingValvePosition?: number
    fanSpeed?: number
    fanEnabled?: boolean
    unitEnabled?: boolean
    [key: string]: any
  }
  timestamp: number
  priority: 'normal' | 'high' | 'emergency'
}

// Enhanced Equipment Worker
const worker = new Worker(
  'equipment-controls',
  async (job: Job<EquipmentControlJob>) => {
    const data = job.data
    
    try {
      console.log(`[Enhanced Worker] Processing UI command for equipment ${data.equipmentId}`)
      
      // Update job progress
      await job.updateProgress(10)
      
      // Save to UIControlCommands database
      await saveToUIControlCommands(data)
      await job.updateProgress(40)
      
      // Update Redis state for cross-user synchronization
      await updateRedisState(data)
      await job.updateProgress(70)
      
      // Log to NeuralControlCommands for audit trail
      await logCommandToNeuralControlCommands(data)
      await job.updateProgress(100)
      
      console.log(`[Enhanced Worker] Successfully processed command for equipment ${data.equipmentId}`)
      
      return {
        success: true,
        equipmentId: data.equipmentId,
        command: data.command,
        timestamp: data.timestamp
      }
      
    } catch (error) {
      console.error(`[Enhanced Worker] Error processing equipment ${data.equipmentId}:`, error)
      throw error
    }
  },
  {
    connection,
    removeOnComplete: { age: 24 * 3600, count: 20 }, // Keep 20 jobs for 24 hours
    removeOnFail: { age: 24 * 3600, count: 10 }, // Keep 10 failed jobs for 24 hours
  }
)

// Save UI command to UIControlCommands database
async function saveToUIControlCommands(data: EquipmentControlJob): Promise<void> {
  try {
    const tags = {
      equipmentId: data.equipmentId,
      locationId: data.locationId,
      userId: data.userId,
      command: data.command
    }
    
    const fields = {
      userName: data.userName,
      priority: data.priority,
      ...data.settings
    }
    
    // Write to UIControlCommands database using env variable
    const lineProtocol = formatLineProtocol('UIControlCommands', tags, fields, data.timestamp * 1000000) // Convert to nanoseconds
    const database = process.env.INFLUXDB_DATABASE3 || 'UIControlCommands'
    const url = `${process.env.INFLUXDB_URL || 'http://143.198.162.31:8181'}/api/v3/write_lp?db=${database}&precision=nanosecond`
    
    console.log(`[DEBUG] Writing to URL: ${url}`)
    console.log(`[DEBUG] Line protocol: ${lineProtocol}`)
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain'
      },
      body: lineProtocol
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.log(`[DEBUG] Response status: ${response.status}`)
      console.log(`[DEBUG] Response text: ${errorText}`)
      throw new Error(`Failed to write to ${database}: ${response.status} ${response.statusText}`)
    }
    
    console.log(`[Enhanced Worker] Saved UI command to ${database}: ${data.command}`)
    
  } catch (error) {
    console.error('[Enhanced Worker] Error saving to UIControlCommands:', error)
    throw error
  }
}

// Update Redis state for cross-user synchronization
async function updateRedisState(data: EquipmentControlJob): Promise<void> {
  try {
    const redisKey = `equipment:${data.equipmentId}:state`
    const state = {
      lastModified: data.timestamp,
      lastModifiedBy: data.userName,
      userId: data.userId,
      command: data.command,
      settings: data.settings
    }
    
    // Set state with 24-hour expiration
    await connection.setex(redisKey, 24 * 3600, JSON.stringify(state))
    
    console.log(`[Enhanced Worker] Updated Redis state for equipment ${data.equipmentId}`)
    
  } catch (error) {
    console.error('[Enhanced Worker] Error updating Redis state:', error)
    throw error
  }
}

// Log command to NeuralControlCommands for audit trail
async function logCommandToNeuralControlCommands(data: EquipmentControlJob): Promise<void> {
  try {
    const tags = {
      equipmentId: data.equipmentId,
      locationId: data.locationId,
      source: 'ui-command',
      userId: data.userId
    }
    
    const fields = {
      command: data.command,
      userName: data.userName,
      priority: data.priority,
      settings: JSON.stringify(data.settings)
    }
    
    // Write to NeuralControlCommands database using env variable
    const lineProtocol = formatLineProtocol('NeuralControlCommands', tags, fields, data.timestamp * 1000000) // Convert to nanoseconds
    const database = process.env.INFLUXDB_DATABASE5 || 'NeuralControlCommands'
    const response = await fetch(`${process.env.INFLUXDB_URL || 'http://143.198.162.31:8181'}/api/v3/write_lp?db=${database}&precision=nanosecond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain'
      },
      body: lineProtocol
    })
    
    if (!response.ok) {
      throw new Error(`Failed to write to ${database}: ${response.status} ${response.statusText}`)
    }
    
    console.log(`[Enhanced Worker] Logged to ${database}: ${data.command}`)
    
  } catch (error) {
    console.error('[Enhanced Worker] Error logging to NeuralControlCommands:', error)
    throw error
  }
}

// Worker event handlers
worker.on('completed', (job) => {
  console.log(`[Enhanced Worker] Job ${job.id} completed successfully`)
})

worker.on('failed', (job, err) => {
  console.error(`[Enhanced Worker] Job ${job?.id} failed:`, err.message)
})

worker.on('progress', (job, progress) => {
  if (typeof progress === 'number' && progress % 25 === 0) { // Log every 25% progress
    console.log(`[Enhanced Worker] Job ${job.id} progress: ${progress}%`)
  }
})

worker.on('error', (err) => {
  console.error('[Enhanced Worker] Worker error:', err)
})

// Redis connection event handlers
connection.on('connect', () => {
  console.log('[Enhanced Worker] Redis connected')
})

connection.on('error', (err) => {
  console.error('[Enhanced Worker] Redis error:', err)
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Enhanced Worker] Shutting down gracefully...')
  await worker.close()
  await connection.quit()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('[Enhanced Worker] Shutting down gracefully...')
  await worker.close()
  await connection.quit()
  process.exit(0)
})

console.log('[Enhanced Worker] Enhanced equipment worker started and waiting for UI commands...')

export { equipmentQueue, worker }
