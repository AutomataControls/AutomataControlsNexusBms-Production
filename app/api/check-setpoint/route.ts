import { type NextRequest, NextResponse } from "next/server"

// Updated InfluxDB 3 configuration with hardcoded values
const INFLUXDB_URL = "http://localhost:8181"
const INFLUXDB_DATABASE = "Locations"

// This endpoint checks the current setpoint from the sensor data
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const equipmentId = searchParams.get("equipmentId") || "BBHCLhaeItV7pIdinQzM"
    const locationId = searchParams.get("locationId") || "4"
    const debug = searchParams.get("debug") === "true"
    const timestamp = Date.now()

    // Get the location name from the location ID
    const locationName = getLocationNameFromId(locationId)

    if (!locationName) {
      return NextResponse.json(
        {
          success: false,
          error: `Unknown location ID: ${locationId}`,
          knownLocations: getKnownLocations(),
        },
        { status: 400 },
      )
    }

    console.log(
      `Checking setpoint at ${new Date(timestamp).toISOString()} for equipment ${equipmentId} in location ${locationId} (${locationName})`,
    )

    // Query InfluxDB 3 for sensor data
    try {
      const sensorData = await queryInfluxDB3(equipmentId, locationId, debug)
      
      if (sensorData.success && sensorData.data) {
        return NextResponse.json({
          success: true,
          timestamp,
          equipmentId,
          locationId,
          locationName,
          sensorData: sensorData.data,
          dataSource: "influxdb3",
          diagnostics: debug ? {
            environment: {
              INFLUXDB_URL,
              INFLUXDB_DATABASE,
            },
            queryDetails: sensorData.details
          } : undefined,
        })
      } else {
        return NextResponse.json({
          success: false,
          timestamp,
          equipmentId,
          locationId,
          locationName,
          error: sensorData.error || "No sensor data found",
          diagnostics: debug ? {
            environment: {
              INFLUXDB_URL,
              INFLUXDB_DATABASE,
            },
            queryDetails: sensorData.details
          } : undefined,
        }, { status: 404 })
      }
    } catch (error) {
      console.error("Error querying InfluxDB:", error)
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp,
          equipmentId,
          locationId,
          locationName,
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error("Error checking setpoint:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    )
  }
}

// Helper function to convert locationId to location name
function getLocationNameFromId(locationId: string): string | null {
  // Map locationId to actual location names
  const locationMap: Record<string, string> = {
    "1": "AkronCarnegiePublicLibrary",
    "2": "FirstChurchofGod",
    "3": "HeritageWarren",
    "4": "HuntingtonHeritage",
    "5": "ElementLabs",
    "6": "ByrnaAmmunition",
    "7": "HopebrideAutismCenter",
    "8": "NERealtyGroup",
    "9": "TaylorUniversity",
    "10": "UplandCommunityChurch",
    "11": "Residential",
  }

  return locationMap[locationId] || null
}

// Helper function to get all known locations
function getKnownLocations(): Record<string, string> {
  return {
    "1": "AkronCarnegiePublicLibrary",
    "2": "FirstChurchofGod",
    "3": "HeritageWarren",
    "4": "HuntingtonHeritage",
    "5": "ElementLabs",
    "6": "ByrnaAmmunition",
    "7": "HopebrideAutismCenter",
    "8": "NERealtyGroup",
    "9": "TaylorUniversity",
    "10": "UplandCommunityChurch",
    "11": "Residential",
  }
}

// Function to query InfluxDB3 for sensor data
async function queryInfluxDB3(equipmentId: string, locationId: string, debug = false): Promise<any> {
  try {
    if (debug) {
      console.log("Querying InfluxDB3...")
      console.log("InfluxDB URL:", INFLUXDB_URL)
      console.log("InfluxDB Database:", INFLUXDB_DATABASE)
    }

    // First, query for metrics data
    const metricsQuery = `SELECT * FROM "metrics" WHERE equipmentId='${equipmentId}' ORDER BY time DESC LIMIT 1`;

    if (debug) {
      console.log("SQL query for metrics:", metricsQuery)
    }

    // Execute the query
    const metricsResponse = await fetch(`${INFLUXDB_URL}/api/v3/query_sql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
      body: JSON.stringify({
        q: metricsQuery,
        db: INFLUXDB_DATABASE
      }),
    })

    if (!metricsResponse.ok) {
      const errorText = await metricsResponse.text()
      console.error(`Failed to query InfluxDB3 metrics: ${metricsResponse.status} ${metricsResponse.statusText}`)
      if (debug) {
        console.error("Error details:", errorText)
      }
      
      return {
        success: false,
        error: `Failed to query InfluxDB3 metrics: ${metricsResponse.status} ${metricsResponse.statusText}`,
        details: errorText,
      }
    }

    const metricsData = await metricsResponse.json()
    
    if (debug) {
      console.log("InfluxDB3 metrics response:", metricsData)
    }

    // Process metrics data
    const sensorData: Record<string, any> = {}
    
    if (Array.isArray(metricsData) && metricsData.length > 0) {
      const metrics = metricsData[0]
      
      // Process each field in the metrics row
      for (const [key, value] of Object.entries(metrics)) {
        // Skip internal fields and time
        if (!key.startsWith('_') && key !== 'time') {
          // Process the value (convert to appropriate type)
          let processedValue = value
          
          // Convert string numeric values to numbers
          if (typeof value === 'string' && !isNaN(Number(value))) {
            processedValue = Number(value)
          }
          // Convert boolean strings to actual booleans
          else if (value === 'true') {
            processedValue = true
          }
          else if (value === 'false') {
            processedValue = false
          }
          
          // Add to sensor data
          sensorData[key] = processedValue
        }
      }
      
      // Add timestamp
      if (metrics.time) {
        sensorData.timestamp = metrics.time
      }
    }
    
    // Now, query for control values to get setpoint information
    // Query all update_* tables to find setpoint data
    const tablesQuery = `SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'update\\_%'`;
    
    const tablesResponse = await fetch(`${INFLUXDB_URL}/api/v3/query_sql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: tablesQuery,
        db: INFLUXDB_DATABASE,
      }),
    });
    
    if (!tablesResponse.ok) {
      // If tables query fails, still return the metrics data we have
      return {
        success: true,
        data: sensorData,
        details: {
          tablesQueryError: await tablesResponse.text(),
          metricsData: sensorData
        }
      }
    }
    
    const tablesData = await tablesResponse.json();
    const tables = tablesData.map((table: any) => table.table_name);
    
    // Check for temperatureSetpoint or Setpoint in control values
    for (const table of tables) {
      if (table === 'update_temperatureSetpoint' || table === 'update_Setpoint') {
        const setpointQuery = `SELECT * FROM "${table}" 
                              WHERE equipment_id='${equipmentId}' 
                              AND location_id='${locationId}'
                              ORDER BY time DESC LIMIT 1`;
        
        const setpointResponse = await fetch(`${INFLUXDB_URL}/api/v3/query_sql`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            q: setpointQuery,
            db: INFLUXDB_DATABASE,
          }),
        });
        
        if (setpointResponse.ok) {
          const setpointData = await setpointResponse.json();
          
          if (Array.isArray(setpointData) && setpointData.length > 0) {
            // Add setpoint to sensor data
            const setpointValue = setpointData[0].value;
            
            // Convert to number if it's a numeric string
            sensorData.Setpoint = typeof setpointValue === 'string' && !isNaN(Number(setpointValue)) 
              ? Number(setpointValue) 
              : setpointValue;
          }
        }
      }
    }

    // If we found any sensor data, return success
    if (Object.keys(sensorData).length > 0) {
      return {
        success: true,
        data: sensorData,
        details: debug ? { metricsQuery, tables } : undefined
      }
    } else {
      return {
        success: false,
        error: "No sensor data found in InfluxDB3",
        details: debug ? { metricsQuery, tables } : undefined
      }
    }
  } catch (error) {
    console.error("Error querying InfluxDB3:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      details: { error: String(error) }
    }
  }
}

// Helper function to parse a value as numeric if possible
function parseNumericIfPossible(value: any) {
  if (typeof value === "string") {
    const numValue = Number.parseFloat(value)
    return isNaN(numValue) ? value : numValue
  }
  return value
}
