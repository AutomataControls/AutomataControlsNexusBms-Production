// /opt/productionapp/app/api/control-values/route.ts - With Redis caching
import { type NextRequest, NextResponse } from "next/server"
import { connection } from "@/lib/queues" // Reuse your existing Redis connection

// Updated InfluxDB 3 configuration with hardcoded values
const INFLUXDB_URL = "http://localhost:8181"
const INFLUXDB_DATABASE = "Locations"

// Cache TTL in seconds (1 minute)
const CACHE_TTL = 60

export async function GET(req: NextRequest) {
  try {
    // Get locationId and equipmentId from query parameters
    const { searchParams } = new URL(req.url)
    const locationId = searchParams.get("locationId")
    const equipmentId = searchParams.get("equipmentId")
    // Add a parameter to bypass cache if needed
    const noCache = searchParams.get("noCache") === "true"

    // Validate required parameters
    if (!locationId || !equipmentId) {
      return NextResponse.json({ error: "Missing locationId or equipmentId" }, { status: 400 })
    }

    console.log(`Fetching control values for location ${locationId}, equipment ${equipmentId}`)

    // Generate cache key
    const cacheKey = `control:values:${locationId}:${equipmentId}`

    // Try to get from cache first (unless noCache is true)
    if (!noCache) {
      try {
        const cachedData = await connection.get(cacheKey)
        if (cachedData) {
          console.log(`Cache hit for control values (${locationId}, ${equipmentId})`)
          const parsedData = JSON.parse(cachedData)
          
          // Add cache header to response
          return NextResponse.json(parsedData, {
            headers: {
              "X-Cache": "HIT",
              "X-Cache-TTL": CACHE_TTL.toString()
            }
          })
        }
        console.log(`Cache miss for control values (${locationId}, ${equipmentId})`)
      } catch (cacheError) {
        console.warn("Redis cache error:", cacheError)
        // Continue to fetch from InfluxDB if cache fails
      }
    }

    // Query InfluxDB for the latest control values
    const latestValues = await fetchLatestControlValues(locationId, equipmentId)

    // Store in Redis cache (unless noCache is true)
    if (!noCache) {
      try {
        await connection.set(
          cacheKey, 
          JSON.stringify(latestValues), 
          "EX", 
          CACHE_TTL
        )
        console.log(`Cached control values for (${locationId}, ${equipmentId})`)
      } catch (cacheError) {
        console.warn("Redis cache error when storing values:", cacheError)
      }
    }

    // Return the data with cache header
    return NextResponse.json(latestValues, {
      headers: {
        "X-Cache": "MISS",
        "X-Cache-TTL": CACHE_TTL.toString()
      }
    })
  } catch (error) {
    console.error("Error fetching control values:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}

async function fetchLatestControlValues(locationId: string, equipmentId: string) {
  try {
    // First, query information_schema to get all control command tables
    const tablesQuery = `SELECT table_name FROM information_schema.tables
                          WHERE table_name LIKE 'update\\_%'`;

    // Execute the query to get tables
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
      const errorText = await tablesResponse.text();
      console.error(`Failed to query InfluxDB tables: ${tablesResponse.status} - ${errorText}`);
      return {};
    }

    // Get the tables from the response
    const tablesData = await tablesResponse.json();
    const tables = tablesData.map((table: any) => table.table_name);

    console.log(`Found ${tables.length} control command tables in database`);

    // Initialize control values object
    const controlValues: Record<string, any> = {};

    // For each table, get the latest value for this equipment
    for (const table of tables) {
      // Extract command type from table name
      const commandType = table.replace('update_', '');

      // SQL query to get the latest value for this command type
      // CRITICAL UPDATE: Added tight time constraint (5 minutes) for HVAC real-time control
      const valueQuery = `SELECT * FROM "${table}"
                         WHERE equipment_id='${equipmentId}'
                         AND location_id='${locationId}'
                         AND time > now() - INTERVAL '5 minutes'
                         ORDER BY time DESC LIMIT 1`;

      // Execute the query
      const valueResponse = await fetch(`${INFLUXDB_URL}/api/v3/query_sql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: valueQuery,
          db: INFLUXDB_DATABASE,
        }),
      });

      if (valueResponse.ok) {
        const data = await valueResponse.json();

        if (data && data.length > 0) {
          // Get the value from the first row
          let value = data[0].value;

          // Convert the value based on its type
          // Try to parse numbers
          if (typeof value === 'string' && !isNaN(Number(value))) {
            value = Number(value);
          }
          // Try to parse booleans
          else if (value === "true" || value === "false") {
            value = value === "true";
          }
          // Try to parse JSON objects
          else if (typeof value === 'string' && (value.startsWith("{") || value.startsWith("["))) {
            try {
              value = JSON.parse(value);
            } catch (e) {
              // Keep as string if parsing fails
            }
          }

          // Convert command_type to camelCase for the UI
          const key = commandType.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

          // Add to control values
          controlValues[key] = value;
        }
      } else {
        // If the query fails, log the error
        const errorText = await valueResponse.text();
        console.warn(`Failed to query table ${table}: ${valueResponse.status} - ${errorText}`);
      }
    }

    console.log(`Retrieved control values:`, controlValues);
    return controlValues;
  } catch (error) {
    console.error("Error in fetchLatestControlValues:", error);
    return {};
  }
}
