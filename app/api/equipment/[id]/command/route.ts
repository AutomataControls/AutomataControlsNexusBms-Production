// @ts-nocheck
// app/api/equipment/[id]/command/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Queue } from 'bullmq'
import Redis from 'ioredis'

// Initialize Redis connection for BullMQ (local server)
const connection = new Redis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: null,
})

// Initialize equipment control queue (SINGLE DECLARATION)
const equipmentQueue = new Queue('equipment-controls', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: { age: 24 * 3600, count: 10 },
    removeOnFail: { age: 24 * 3600, count: 5 },
  }
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const equipmentId = id
    const body = await request.json()

    // Validate required fields
    if (!body.command) {
      return NextResponse.json(
        { error: 'Command is required' },
        { status: 400 }
      )
    }

    // Prepare job data
    const jobData = {
      equipmentId,
      equipmentName: body.equipmentName,
      equipmentType: body.equipmentType,
      locationId: body.locationId,
      locationName: body.locationName,
      command: body.command,
      settings: body.settings,
      userId: body.userId,
      userName: body.userName,
      timestamp: new Date().toISOString(),
      priority: body.priority || 'normal'
    }

    // Set job priority
    const priority = body.priority === 'high' ? 1 :
                    body.command === 'EMERGENCY_SHUTDOWN' ? 1 : 10

    // Add job to queue
    const job = await equipmentQueue.add(
      `${body.command}-${equipmentId}`,
      jobData,
      {
        priority,
        delay: body.delay || 0,
        jobId: `${equipmentId}-${body.command}-${Date.now()}`
      }
    )

    // Also save current state to Redis for immediate UI feedback
    if (body.settings) {
      const stateKey = `equipment:${equipmentId}:state`
      const stateData = {
        ...body.settings,
        lastModified: new Date().toISOString(),
        modifiedBy: body.userId,
        modifiedByName: body.userName
      }
      await connection.setex(stateKey, 86400, JSON.stringify(stateData))
    }

    return NextResponse.json({
      success: true,
      jobId: job.id,
      command: body.command,
      equipmentId,
      timestamp: new Date().toISOString(),
      message: 'Command queued successfully'
    })
  } catch (error) {
    console.error('Error queueing equipment command:', error)
    return NextResponse.json(
      { error: 'Failed to queue equipment command' },
      { status: 500 }
    )
  }
}
