
import { type NextRequest, NextResponse } from "next/server"

// This endpoint monitors control values
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const equipmentId = searchParams.get("equipmentId") || "BBHCLhaeItV7pIdinQzM"
    const locationId = searchParams.get("locationId") || "4"
    const commandType = searchParams.get("commandType") // Optional - filter by command type
    const timestamp = Date.now()

    // Hard-coded local InfluxDB URL to ensure we always use the local instance
    const INFLUXDB_URL = "http://localhost:8181"
    const INFLUXDB_DATABASE = "Locations"

    console.log(
      `Monitoring control values at ${new Date(timestamp).toISOString()} for equipment ${equipmentId} in location ${locationId}`,
    )

    // Results object
    const results = {
      timestamp,
      equipmentId,
      locationId,
      commandType,
      controlValues: {} as Record<string, any>,
    }

    try {
      // First, get the list of all control value tables
      let tablesQuery = `SELECT table_name FROM information_schema.tables
                     WHERE table_name LIKE 'update\\_%'`;

      // Execute the query to get tables
      const tablesResponse = await fetch(`${INFLUXDB_URL}/api/v3/query_sql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
        body: JSON.stringify({
          q: tablesQuery,
          db: INFLUXDB_DATABASE,
        }),
      });

      if (!tablesResponse.ok) {
        const errorText = await tablesResponse.text()
        throw new Error(`Failed to query InfluxDB3 tables: ${tablesResponse.status} - ${errorText}`)
      }

      // Parse the table names
      const tablesData = await tablesResponse.json()
      const tables = tablesData.map((table: any) => table.table_name)

      // Filter for command_type if provided
      const tablesToQuery = commandType
        ? tables.filter((table: string) => table === `update_${commandType}`)
        : tables;

      // For each table, get the latest value for this equipment
      for (const table of tablesToQuery) {
        const commandName = table.replace('update_', '');
        // CRITICAL UPDATE: Added time constraint (5 minutes) to avoid file limit errors
        const valueQuery = `SELECT * FROM "${table}"
                           WHERE equipment_id='${equipmentId}'
                           AND location_id='${locationId}'
                           AND time > now() - INTERVAL '5 minutes'
                           ORDER BY time DESC LIMIT 1`;

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
            let value = data[0].value;

            // Convert string "true"/"false" to boolean
            if (value === "true") value = true;
            if (value === "false") value = false;

            // Convert numeric strings to numbers
            if (typeof value === "string" && !isNaN(Number(value))) {
              value = Number(value);
            }

            // Try to parse JSON strings
            if (typeof value === "string" && (value.startsWith("{") || value.startsWith("["))) {
              try {
                value = JSON.parse(value);
              } catch (e) {
                // Keep as string if parsing fails
              }
            }

            results.controlValues[commandName] = {
              value,
              time: data[0].time,
              source: data[0].source || 'server_logic',
              command_type: commandName,
            };
          }
        } else {
          // If the first query fails, try a longer time window as fallback
          console.warn(`Failed to query ${table} with 5-minute window, trying 1-hour window`);
          
          const fallbackQuery = `SELECT * FROM "${table}"
                               WHERE equipment_id='${equipmentId}'
                               AND location_id='${locationId}'
                               AND time > now() - INTERVAL '1 hour'
                               ORDER BY time DESC LIMIT 1`;
          
          const fallbackResponse = await fetch(`${INFLUXDB_URL}/api/v3/query_sql`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              q: fallbackQuery,
              db: INFLUXDB_DATABASE,
            }),
          });
          
          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            
            if (fallbackData && fallbackData.length > 0) {
              let value = fallbackData[0].value;
              
              // Process value as above
              if (value === "true") value = true;
              if (value === "false") value = false;
              
              if (typeof value === "string" && !isNaN(Number(value))) {
                value = Number(value);
              }
              
              if (typeof value === "string" && (value.startsWith("{") || value.startsWith("["))) {
                try {
                  value = JSON.parse(value);
                } catch (e) {
                  // Keep as string if parsing fails
                }
              }
              
              results.controlValues[commandName] = {
                value,
                time: fallbackData[0].time,
                source: fallbackData[0].source || 'server_logic',
                command_type: commandName,
              };
            }
          }
        }
      }

      return NextResponse.json({
        success: true,
        ...results,
      });

    } catch (error) {
      console.error("Error fetching control values:", error);
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Error monitoring control values:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
