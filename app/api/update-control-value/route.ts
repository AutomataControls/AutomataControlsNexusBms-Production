import { type NextRequest, NextResponse } from "next/server"

// InfluxDB configuration
const INFLUXDB_URL = process.env.INFLUXDB_URL || "https://us-east-1-1.aws.cloud2.influxdata.com"
const INFLUXDB_TOKEN = process.env.INFLUXDB_TOKEN
const INFLUXDB_ORG = process.env.INFLUXDB_ORG || "CurrentMechanical"
const INFLUXDB_BUCKET = process.env.INFLUXDB_BUCKET || "neuralbms"

// InfluxDB3 configuration
const INFLUXDB3_URL = process.env.INFLUXDB3_URL || "http://localhost:8181"
const INFLUXDB3_DATABASE = process.env.INFLUXDB3_DATABASE || "control_logic"

// This endpoint directly updates a control value in both InfluxDB and InfluxDB3
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { equipmentId, locationId, commandType, value, source = "api", userId = "system", userName = "System" } = body

    if (!equipmentId || !locationId || !commandType || value === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required parameters: equipmentId, locationId, commandType, and value are required",
        },
        { status: 400 },
      )
    }

    console.log(`Updating control value: ${commandType} = ${value} for equipment ${equipmentId}`)

    // Generate timestamp
    const timestamp = Date.now()
    const timestampNs = `${timestamp}000000` // Convert ms to ns

    // Format the value for InfluxDB line protocol
    let numericValue: number | null = null
    let stringValue: string | null = null

    // Process the value based on its type
    if (value === null || value === undefined) {
      numericValue = 0
    } else if (typeof value === "number") {
      numericValue = value
    } else if (typeof value === "boolean") {
      numericValue = value ? 1 : 0
      stringValue = value.toString()
    } else if (typeof value === "object") {
      // For objects, store as JSON string
      stringValue = JSON.stringify(value)
      // Use a placeholder numeric value
      numericValue = timestamp % 1000000 // Use last 6 digits of timestamp
    } else {
      // For strings, try to parse as number or use as string
      const parsed = Number.parseFloat(value)
      if (!isNaN(parsed)) {
        numericValue = parsed
        stringValue = value
      } else {
        // Use string as is
        stringValue = value
        // Use a placeholder numeric value
        numericValue = timestamp % 1000000 // Use last 6 digits of timestamp
      }
    }

    // Build the fields part of the line protocol
    const fields = []

    // Always include the value field (required by InfluxDB)
    if (numericValue !== null) {
      fields.push(`value=${numericValue}`)
    } else {
      // Fallback value if somehow numericValue is still null
      fields.push(`value=0`)
    }

    // Add string_value if we have one
    if (stringValue !== null) {
      // Escape quotes in the string value
      const escapedString = stringValue.replace(/"/g, '\\"')
      fields.push(`string_value="${escapedString}"`)
    }

    // Add status and details
    fields.push(`status="completed"`)
    fields.push(`details="Updated ${commandType} to ${value} via direct API call"`)

    // Join fields with commas
    const fieldsStr = fields.join(",")

    // Create tags for the line protocol
    const tags = [
      `equipment_id=${equipmentId}`,
      `location_id=${locationId}`,
      `command_type=${commandType}`,
      `source=${source}`,
      `user_id=${userId}`,
      `user_name=${userName.replace(/\s/g, "\\ ")}`, // Escape spaces in tag values
    ].join(",")

    // Create the line protocol
    const measurement = "control_history"
    const lineProtocol = `${measurement},${tags} ${fieldsStr} ${timestampNs}`

    console.log(`Line protocol: ${lineProtocol}`)

    // Results object to track success/failure
    const results = {
      influxdb3: null as any,
      influxdb2: null as any,
    }

    // First, try to write to InfluxDB3
    try {
      // First, ensure the table exists
      try {
        const createTableUrl = `${INFLUXDB3_URL}/api/v3/query_lp?db=${INFLUXDB3_DATABASE}`
        const createTableQuery = `
          CREATE TABLE IF NOT EXISTS control_history (
            time TIMESTAMP,
            equipment_id TEXT,
            location_id TEXT,
            command_type TEXT,
            source TEXT,
            user_id TEXT,
            user_name TEXT,
            value DOUBLE,
            string_value TEXT,
            status TEXT,
            details TEXT
          )
        `

        // Execute the query without authentication
        const createTableResponse = await fetch(createTableUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
          body: JSON.stringify({ query: createTableQuery }),
        })

        if (!createTableResponse.ok) {
          console.error(`Failed to create table: ${createTableResponse.status} ${createTableResponse.statusText}`)
        }
      } catch (error) {
        console.error("Error creating table:", error)
      }

      // Write URL for InfluxDB3 - use 'nanosecond' instead of 'ns'
      const writeUrl3 = `${INFLUXDB3_URL}/api/v3/write_lp?db=${INFLUXDB3_DATABASE}&precision=nanosecond`

      // Write to InfluxDB3 without authentication
      const response3 = await fetch(writeUrl3, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
        body: lineProtocol,
      })

      // Check if the write was successful
      if (response3.ok || response3.status === 204) {
        console.log(`Successfully wrote to InfluxDB3`)
        results.influxdb3 = {
          success: true,
          message: "Value updated successfully in InfluxDB3",
        }
      } else {
        // Try to get error details
        let errorDetails = ""
        try {
          errorDetails = await response3.text()
        } catch (e) {
          errorDetails = "Could not read error details"
        }

        console.error(`Failed to write to InfluxDB3: ${response3.status} ${response3.statusText} - ${errorDetails}`)
        results.influxdb3 = {
          success: false,
          error: `Failed to write to InfluxDB3: ${response3.status} ${response3.statusText}`,
          details: errorDetails,
        }
      }
    } catch (error) {
      console.error("Error writing to InfluxDB3:", error)
      results.influxdb3 = {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }

    // Next, try to write to InfluxDB2
    try {
      // Write URL for InfluxDB2
      const writeUrl = `${INFLUXDB_URL}/api/v2/write?bucket=${INFLUXDB_BUCKET}&precision=ns&org=${INFLUXDB_ORG}`

      // Write to InfluxDB2
      const response = await fetch(writeUrl, {
        method: "POST",
        headers: {
          Authorization: `Token ${INFLUXDB_TOKEN}`,
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
        body: lineProtocol,
      })

      // Check if the write was successful
      if (response.ok || response.status === 204) {
        console.log(`Successfully wrote to InfluxDB2`)
        results.influxdb2 = {
          success: true,
          message: "Value updated successfully in InfluxDB2",
        }
      } else {
        // Try to get error details
        let errorDetails = ""
        try {
          errorDetails = await response.text()
        } catch (e) {
          errorDetails = "Could not read error details"
        }

        console.error(`Failed to write to InfluxDB2: ${response.status} ${response.statusText} - ${errorDetails}`)
        results.influxdb2 = {
          success: false,
          error: `Failed to write to InfluxDB2: ${response.status} ${response.statusText}`,
          details: errorDetails,
        }
      }
    } catch (error) {
      console.error("Error writing to InfluxDB2:", error)
      results.influxdb2 = {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }

    // Determine overall success
    const success = results.influxdb3?.success || results.influxdb2?.success

    return NextResponse.json({
      success,
      message: success ? "Control value updated successfully" : "Failed to update control value in both databases",
      timestamp,
      commandType,
      value,
      results,
    })
  } catch (error) {
    console.error("Error updating control value:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
