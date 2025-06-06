// @ts-nocheck
// app/api/equipment/[id]/status/[jobId]/route.ts
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
const equipmentQueue = new Queue('equipment-controls', { connection })

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; jobId: string }> }
) {
  try {
    const { id, jobId } = await params
    const equipmentId = id

    // Get job status from BullMQ
    const job = await equipmentQueue.getJob(jobId)

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // Get job state and progress
    const state = await job.getState()
    const progress = job.progress
    const failedReason = job.failedReason
    const finishedOn = job.finishedOn
    const processedOn = job.processedOn

    // Map BullMQ states to our status system
    let status: string
    let message: string

    switch (state) {
      case 'waiting':
      case 'delayed':
        status = 'pending'
        message = 'Command is queued and waiting to be processed'
        break
      case 'active':
        status = 'processing'
        message = 'Command is being applied to equipment'
        break
      case 'completed':
        status = 'completed'
        message = 'Command successfully applied to equipment'
        break
      case 'failed':
        status = 'failed'
        message = failedReason || 'Command failed to apply'
        break
      case 'stalled':
        status = 'failed'
        message = 'Command timed out and was cancelled'
        break
      default:
        status = 'unknown'
        message = `Unknown job state: ${state}`
    }

    return NextResponse.json({
      jobId,
      equipmentId,
      status,
      message,
      progress: typeof progress === 'number' ? progress : 0,
      state: state,
      timestamps: {
        created: job.timestamp,
        processed: processedOn,
        finished: finishedOn
      },
      attempts: {
        made: job.attemptsMade,
        total: job.opts.attempts
      }
    })
  } catch (error) {
    console.error('Error fetching job status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch job status' },
      { status: 500 }
    )
  }
}

// Optional: Cancel/retry job endpoint
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; jobId: string }> }
) {
  try {
    const { jobId } = await params

    const job = await equipmentQueue.getJob(jobId)

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // Cancel the job if it's not already completed/failed
    const state = await job.getState()
    if (state === 'waiting' || state === 'delayed' || state === 'active') {
      await job.remove()
    }

    return NextResponse.json({
      success: true,
      message: 'Job cancelled successfully',
      jobId
    })
  } catch (error) {
    console.error('Error cancelling job:', error)
    return NextResponse.json(
      { error: 'Failed to cancel job' },
      { status: 500 }
    )
  }
}
