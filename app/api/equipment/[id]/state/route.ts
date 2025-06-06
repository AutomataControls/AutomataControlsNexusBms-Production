// @ts-nocheck
// app/api/equipment/[id]/state/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Redis from 'ioredis'

// Initialize Redis connection (local server, no auth needed)
const redis = new Redis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: null,
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const equipmentId = id

    // Get equipment state from Redis
    const stateKey = `equipment:${equipmentId}:state`
    const oarKey = `equipment:${equipmentId}:oar`

    const [stateData, oarData] = await Promise.all([
      redis.get(stateKey),
      redis.get(oarKey)
    ])

    const state = stateData ? JSON.parse(stateData) : null
    const oarSetpoint = oarData ? parseFloat(oarData) : null

    return NextResponse.json({
      state,
      oarSetpoint,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error fetching equipment state:', error)
    return NextResponse.json(
      { error: 'Failed to fetch equipment state' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const equipmentId = id
    const body = await request.json()

    const stateKey = `equipment:${equipmentId}:state`
    const lastModKey = `equipment:${equipmentId}:lastmod`

    // Prepare state data
    const stateData = {
      enabled: body.enabled ?? false,
      supplyTempSetpoint: body.supplyTempSetpoint ?? 160,
      isLead: body.isLead ?? false,
      lastModified: new Date().toISOString(),
      modifiedBy: body.userId || 'unknown',
      modifiedByName: body.userName || 'Unknown User'
    }

    // Save to Redis with expiration (24 hours)
    await Promise.all([
      redis.setex(stateKey, 86400, JSON.stringify(stateData)),
      redis.setex(lastModKey, 86400, stateData.lastModified)
    ])

    // Also save OAR setpoint if provided
    if (body.oarSetpoint !== undefined) {
      const oarKey = `equipment:${equipmentId}:oar`
      await redis.setex(oarKey, 86400, body.oarSetpoint.toString())
    }

    return NextResponse.json({
      success: true,
      state: stateData,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error saving equipment state:', error)
    return NextResponse.json(
      { error: 'Failed to save equipment state' },
      { status: 500 }
    )
  }
}
