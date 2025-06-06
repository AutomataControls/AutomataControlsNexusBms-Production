// @ts-nocheck
// app/api/influx/route.ts - InfluxDB Proxy to bypass mixed content
import { NextRequest, NextResponse } from 'next/server'

const INFLUXDB_URL = process.env.INFLUXDB_URL || 'http://143.198.162.31:8181'
const INFLUXDB_DATABASE = process.env.INFLUXDB_DATABASE || 'Locations'

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json()
    
    if (!query) {
      return NextResponse.json(
        { success: false, error: 'Query is required' },
        { status: 400 }
      )
    }

    // Forward request to InfluxDB
    const response = await fetch(`${INFLUXDB_URL}/api/v3/query_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: query,
        db: INFLUXDB_DATABASE
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { 
          success: false, 
          error: `InfluxDB error: ${response.status} ${response.statusText}`,
          details: errorText
        },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    return NextResponse.json({
      success: true,
      data
    })

  } catch (error: any) {
    console.error('InfluxDB Proxy Error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error.message 
      },
      { status: 500 }
    )
  }
}
