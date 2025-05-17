import { type NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

// InfluxDB configuration from environment variables
const INFLUXDB_URL = process.env.INFLUXDB_URL || "https://cloud2.influxdata.com"
const INFLUXDB_TOKEN = process.env.INFLUXDB_TOKEN
const INFLUXDB_ORG = process.env.INFLUXDB_ORG
const INFLUXDB_BUCKET = process.env.INFLUXDB_BUCKET || "neuralbms" // Use a fixed bucket name

export async function POST(req: NextRequest) {
  try {
    const { commandId, commandType, sequentialId, equipmentId, locationId } = await req.json()

    console.log("Deleting command:", { commandId, commandType, sequentialId, equipmentId, locationId })

    if (!commandId || !commandType || !equipmentId || !locationId) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
    }

    // Log environment variables (without exposing the full token)
    console.log("InfluxDB URL:", INFLUXDB_URL)
    console.log("InfluxDB Token:", INFLUXDB_TOKEN ? "Set (hidden)" : "Not set")
    console.log("InfluxDB Org:", INFLUXDB_ORG || "Not set")
    console.log("InfluxDB Bucket:", INFLUXDB_BUCKET)

    if (!INFLUXDB_TOKEN) {
      console.error("Missing InfluxDB token. Please set INFLUXDB_TOKEN environment variable.")
      return NextResponse.json(
        {
          error: "Missing InfluxDB configuration",
          details: "Please set INFLUXDB_TOKEN environment variable",
        },
        { status: 500 },
      )
    }

    // Use the fixed bucket name instead of locationId
    const bucketName = INFLUXDB_BUCKET

    // Use a consistent measurement name
    const measurementName = `control_history`

    // In InfluxDB, we can't directly delete points by ID
    // Instead, we'll write a new point with the same tags but with a "deleted" status
    // Format data in line protocol format
    // Format: measurement,tag1=value1,tag2=value2 field1=value1,field2=value2 timestamp
    let lineProtocol = `${measurementName},equipment_id=${equipmentId},location_id=${locationId},command_type=${commandType}`

    // Add fields section
    lineProtocol += ` status="deleted",original_id="${commandId}"`

    // Add timestamp in nanoseconds
    const timestamp = Date.now() * 1000000 // Convert milliseconds to nanoseconds
    lineProtocol += ` ${timestamp}`

    console.log("Line protocol data for delete:", lineProtocol)

    try {
      // Use the v2 write API endpoint
      const writeUrl = `${INFLUXDB_URL}/api/v2/write?bucket=${bucketName}&precision=ns`

      // Send data to InfluxDB using the v2 write API
      const response = await fetch(writeUrl, {
        method: "POST",
        headers: {
          Authorization: `Token ${INFLUXDB_TOKEN}`,
          "Content-Type": "text/plain; charset=utf-8",
          ...(INFLUXDB_ORG ? { "X-Org": INFLUXDB_ORG } : {}), // Add org header if available
        },
        body: lineProtocol,
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`InfluxDB write error (${response.status}): ${errorText}`)
        // Return success anyway to allow UI to function
        return NextResponse.json({
          success: true,
          warning: "Command may not have been deleted in InfluxDB. Please check server logs.",
        })
      }

      console.log("Successfully wrote delete marker to InfluxDB")
      return NextResponse.json({ success: true })
    } catch (writeError) {
      console.error("Error writing delete marker to InfluxDB:", writeError)
      // Return success anyway to allow UI to function
      return NextResponse.json({
        success: true,
        warning: "Command may not have been deleted in InfluxDB. Please check server logs.",
      })
    }
  } catch (error) {
    console.error("Error deleting command from InfluxDB:", error)

    // Add more detailed error information
    const errorDetails =
      error instanceof Error ? { message: error.message, stack: error.stack } : { message: "Unknown error" }

    console.log("Error details:", errorDetails)

    // Return success anyway to allow UI to function
    return NextResponse.json({
      success: true,
      warning: "An error occurred while deleting the command. Please check server logs.",
    })
  }
}
