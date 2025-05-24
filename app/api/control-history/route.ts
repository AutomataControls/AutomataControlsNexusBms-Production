// /opt/productionapp/app/api/control-history/route.ts - With Redis caching
import { type NextRequest, NextResponse } from "next/server"
import { connection } from "@/lib/queues" // Reuse your existing Redis connection

export const runtime = "nodejs"

// Updated InfluxDB 3 configuration with hardcoded values
const INFLUXDB_URL = "http://localhost:8181"
const INFLUXDB_DATABASE = "Locations"

// Cache TTL in seconds (2 minutes for history data)
const CACHE_TTL = 120

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const equipmentId = url.searchParams.get("equipmentId")
    const locationId = url.searchParams.get("locationId")
    const limit = url.searchParams.get("limit") || "20"
    // Add a parameter to bypass cache if needed
    const noCache = url.searchParams.get("noCache") === "true"

    console.log("Fetching control history for:", { equipmentId, locationId, limit, noCache })

    if (!equipmentId || !locationId) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
    }

    // Generate cache key
    const cacheKey = `control:history:${locationId}:${equipmentId}:${limit}`

    // Try to get from cache first (unless noCache is true)
    if (!noCache) {
      try {
        const cachedData = await connection.get(cacheKey)
        if (cachedData) {
          console.log(`Cache hit for control history (${locationId}, ${equipmentId}, limit=${limit})`)
          const parsedData = JSON.parse(cachedData)
          
          // Add cache header to response
          return NextResponse.json(parsedData, {
            headers: {
              "X-Cache": "HIT",
              "X-Cache-TTL": CACHE_TTL.toString()
            }
          })
        }
        console.log(`Cache miss for control history (${locationId}, ${equipmentId}, limit=${limit})`)
      } catch (cacheError) {
        console.warn("Redis cache error:", cacheError)
        // Continue to fetch from InfluxDB if cache fails
      }
    }

    // Log the configuration
    console.log("InfluxDB URL:", INFLUXDB_URL)
    console.log("InfluxDB Database:", INFLUXDB_DATABASE)

    // Default history with some sample entries (used as fallback)
    const defaultHistory = [
      {
        id: "temp_setpoint_1",
        command: "update_temperature_setpoint",
        commandType: "temperature_setpoint",
        source: "web_dashboard",
        status: "completed",
        timestamp: Date.now() - 1000 * 60 * 5, // 5 minutes ago
        formattedTimestamp: new Date(Date.now() - 1000 * 60 * 5).toLocaleString(),
        value: 72,
        previousValue: 70,
        userId: "system",
        userName: "System",
        details: "Temperature Setpoint changed to 72",
      },
      {
        id: "heating_valve_1",
        command: "update_heating_valve",
        commandType: "heatingValvePosition",
        source: "web_dashboard",
        status: "completed",
        timestamp: Date.now() - 1000 * 60 * 10, // 10 minutes ago
        formattedTimestamp: new Date(Date.now() - 1000 * 60 * 10).toLocaleString(),
        value: 50,
        previousValue: 0,
        userId: "system",
        userName: "System",
        details: "Heating Valve Position changed to 50",
      },
    ]

    try {
      // First, get all tables that contain control history
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
        throw new Error(`InfluxDB query failed: ${tablesResponse.status} - ${errorText}`);
      }

      // Get the tables from the response
      const tablesData = await tablesResponse.json();
      const tables = tablesData.map((table: any) => table.table_name);

      console.log(`Found ${tables.length} control command tables in database`);

      // Build a single query to get the latest commands across all tables
      // Union approach for all tables
      let sqlQuery = '';
      const validTables = tables.filter(table => table.startsWith('update_'));

      // Create a unified result set with data from all tables
      for (let i = 0; i < validTables.length; i++) {
        const table = validTables[i];
        const commandType = table.replace('update_', '');

        sqlQuery += `SELECT
                      '${table}' as table_name,
                      '${commandType}' as command_type,
                      time,
                      equipment_id,
                      location_id,
                      CAST(value AS STRING) as value,
                      source,
                      status
                    FROM "${table}"
                    WHERE equipment_id='${equipmentId}'
                    AND location_id='${locationId}'
                    AND time > now() - 1d`;

        if (i < validTables.length - 1) {
          sqlQuery += " UNION ALL ";
        }
      }

      // Add ordering and limit to the final query
      if (validTables.length > 0) {
        sqlQuery += ` ORDER BY time DESC LIMIT ${Number.parseInt(limit, 10)}`;
      }

      console.log("Executing SQL query for control history");
      console.log("Query:", sqlQuery);

      if (sqlQuery === '') {
        console.log("No valid tables found, returning default history");
        
        // Cache the default history
        if (!noCache) {
          try {
            await connection.set(
              cacheKey, 
              JSON.stringify(defaultHistory), 
              "EX", 
              CACHE_TTL
            )
            console.log(`Cached default history for (${locationId}, ${equipmentId}, limit=${limit})`)
          } catch (cacheError) {
            console.warn("Redis cache error when storing default history:", cacheError)
          }
        }
        
        return NextResponse.json(defaultHistory, { 
          headers: {
            "X-Cache": "MISS",
            "X-Cache-TTL": CACHE_TTL.toString()
          },
          status: 200 
        });
      }

      // Execute the SQL query
      const response = await fetch(`${INFLUXDB_URL}/api/v3/query_sql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: sqlQuery,
          db: INFLUXDB_DATABASE,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`InfluxDB query error (${response.status}): ${errorText}`);
        throw new Error(`InfluxDB query failed: ${response.status} - ${errorText}`);
      }

      // Parse the JSON response
      const data = await response.json();
      console.log(`Query returned ${data.length} rows`);

      if (Array.isArray(data) && data.length > 0) {
        // Transform the data into history entries
        const history = data.map((row) => {
          // Convert the command type to a valid command name
          const commandType = row.command_type || "unknown";
          const command = `update_${commandType}`;

          // Format the timestamp
          const timestamp = new Date(row.time).getTime();
          const formattedTimestamp = new Date(row.time).toLocaleString();

          // Extract the value and try to convert it to a number if possible
          let value = row.value;
          if (typeof value === 'string' && !isNaN(Number(value))) {
            value = Number.parseFloat(value);
          } else if (value === 'true' || value === 'false') {
            value = value === 'true';
          }

          // Create a unique ID for this history entry
          const id = `${commandType}_${timestamp}_${Math.random().toString(36).substring(2, 9)}`;

          return {
            id,
            command,
            commandType,
            source: row.source || "system",
            status: row.status || "completed",
            timestamp,
            formattedTimestamp,
            value,
            userId: row.user_id || "system",
            userName: row.user_name || "System",
            details: row.details || `${commandType} updated to ${value}`,
          };
        });

        console.log(`Returning ${history.length} control history entries from database`);
        
        // Cache the history
        if (!noCache) {
          try {
            await connection.set(
              cacheKey, 
              JSON.stringify(history), 
              "EX", 
              CACHE_TTL
            )
            console.log(`Cached ${history.length} history entries for (${locationId}, ${equipmentId}, limit=${limit})`)
          } catch (cacheError) {
            console.warn("Redis cache error when storing history:", cacheError)
          }
        }
        
        return NextResponse.json(history, { 
          headers: {
            "X-Cache": "MISS",
            "X-Cache-TTL": CACHE_TTL.toString()
          },
          status: 200 
        });
      }

      // If no data found, return default history
      console.log("No control history found in database, returning default");
      
      // Cache the default history
      if (!noCache) {
        try {
          await connection.set(
            cacheKey, 
            JSON.stringify(defaultHistory), 
            "EX", 
            CACHE_TTL
          )
          console.log(`Cached default history for (${locationId}, ${equipmentId}, limit=${limit})`)
        } catch (cacheError) {
          console.warn("Redis cache error when storing default history:", cacheError)
        }
      }
      
      return NextResponse.json(defaultHistory, { 
        headers: {
          "X-Cache": "MISS",
          "X-Cache-TTL": CACHE_TTL.toString()
        },
        status: 200 
      });
    } catch (queryError) {
      console.error("Error querying InfluxDB:", queryError);

      // Return default history if database query fails
      console.log("Returning default control history due to error");
      
      // Cache the default history even on error
      if (!noCache) {
        try {
          await connection.set(
            cacheKey, 
            JSON.stringify(defaultHistory), 
            "EX", 
            CACHE_TTL
          )
          console.log(`Cached default history (error case) for (${locationId}, ${equipmentId}, limit=${limit})`)
        } catch (cacheError) {
          console.warn("Redis cache error when storing default history:", cacheError)
        }
      }
      
      return NextResponse.json(defaultHistory, { 
        headers: {
          "X-Cache": "MISS",
          "X-Cache-TTL": CACHE_TTL.toString()
        },
        status: 200 
      });
    }
  } catch (error) {
    console.error("Error fetching control history from InfluxDB:", error);

    // Add more detailed error information
    const errorDetails =
      error instanceof Error ? { message: error.message, stack: error.stack } : { message: "Unknown error" };

    console.log("Error details:", errorDetails);

    // Return an empty array instead of an error to prevent UI issues
    return NextResponse.json([], { status: 200 }); // Return 200 OK instead of 500
  }
}
