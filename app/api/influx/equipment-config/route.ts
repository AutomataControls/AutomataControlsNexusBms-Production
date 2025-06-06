// @ts-nocheck
// app/api/influx/equipment-config/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.equipmentId || !body.configuration) {
      return NextResponse.json(
        { error: 'Equipment ID and configuration are required' },
        { status: 400 }
      )
    }

    // Prepare tags and fields for InfluxDB line protocol
    const tags = {
      equipmentId: body.equipmentId,
      equipmentName: body.equipmentName || '',
      equipmentType: body.equipmentType || '',
      locationId: body.locationId || '',
      locationName: body.locationName || '',
      userId: body.userId || 'unknown'
    }

    const fields = {
      userName: body.userName || 'Unknown User',
      // Configuration fields
      enabled: body.configuration.enabled,
      supplyTempSetpoint: body.configuration.supplyTempSetpoint,
      isLead: body.configuration.isLead,
      oarSetpoint: body.configuration.oarSetpoint || null,
      // Additional metadata
      configVersion: 1,
      configType: 'boiler_settings'
    }

    // Create line protocol manually (same format as enhanced equipment worker)
    const timestamp = Date.now() * 1000000 // Convert to nanoseconds
    const tagString = Object.entries(tags)
      .map(([key, value]) => `${key}=${String(value).replace(/[, ]/g, '\\ ')}`)
      .join(',')
    
    const fieldString = Object.entries(fields)
      .map(([key, value]) => {
        if (value === null || value === undefined) {
          return null // Skip null values
        } else if (typeof value === 'string') {
          return `${key}="${value.replace(/"/g, '\\"')}"`
        } else if (typeof value === 'boolean') {
          return `${key}=${value ? 't' : 'f'}`
        } else if (typeof value === 'number') {
          return `${key}=${value}i`
        }
        return `${key}="${String(value)}"`
      })
      .filter(field => field !== null)
      .join(',')

    const lineProtocol = `EquipmentConfig,${tagString} ${fieldString} ${timestamp}`

    console.log('Saving equipment configuration:', lineProtocol)

    // Write to InfluxDB EquipmentConfig database (DATABASE4)
    const database = process.env.INFLUXDB_DATABASE4 || 'EquipmentConfig'
    const influxUrl = `${process.env.INFLUXDB_URL || 'http://143.198.162.31:8181'}/api/v3/write_lp?db=${database}&precision=nanosecond`
    
    const response = await fetch(influxUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain'
      },
      body: lineProtocol
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('InfluxDB write error:', errorText)
      throw new Error(`Failed to write to InfluxDB: ${response.status} ${response.statusText}`)
    }

    return NextResponse.json({
      success: true,
      message: 'Equipment configuration saved successfully',
      equipmentId: body.equipmentId,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error saving equipment configuration:', error)
    return NextResponse.json(
      { 
        error: 'Failed to save equipment configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const equipmentId = searchParams.get('equipmentId')
    const limit = parseInt(searchParams.get('limit') || '10')

    if (!equipmentId) {
      return NextResponse.json(
        { error: 'Equipment ID is required' },
        { status: 400 }
      )
    }

    // For now, return mock data since we're focusing on the save functionality
    const configurations = [
      {
        timestamp: new Date().toISOString(),
        equipmentId,
        enabled: true,
        supplyTempSetpoint: 160,
        isLead: false,
        configVersion: 1
      }
    ]

    return NextResponse.json({
      success: true,
      equipmentId,
      configurations,
      count: configurations.length
    })

  } catch (error) {
    console.error('Error fetching equipment configurations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch equipment configurations' },
      { status: 500 }
    )
  }
}
