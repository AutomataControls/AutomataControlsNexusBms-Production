// lib/influxdb-client.ts
// IMPROVED VERSION with better error handling and retry mechanism

// Configuration from environment with fallbacks
export const INFLUXDB_URL = process.env.INFLUXDB_URL || 'http://143.198.162.31:8181';
export const INFLUXDB_DATABASE = process.env.INFLUXDB_DATABASE || 'Locations';
export const INFLUXDB_TIMEOUT = parseInt(process.env.INFLUXDB_TIMEOUT || '30000'); // 30 seconds
export const INFLUXDB_MAX_RETRIES = parseInt(process.env.INFLUXDB_MAX_RETRIES || '3');
export const INFLUXDB_RETRY_DELAY = parseInt(process.env.INFLUXDB_RETRY_DELAY || '1000'); // 1 second

// Define option types
export interface InfluxDBQueryOptions {
  timeout?: number; // In milliseconds
  maxRetries?: number;
  retryDelay?: number;
  debug?: boolean;
}

export interface InfluxDBWriteOptions {
  precision?: string; // nanosecond, microsecond, millisecond, second
  maxRetries?: number;
  retryDelay?: number;
  debug?: boolean;
}

/**
 * Query InfluxDB 3 using SQL with robust error handling and retry mechanism
 * @param query SQL query string
 * @param options Query options
 * @returns Query results with success status
 */
export async function queryInfluxDB(query: string, options: InfluxDBQueryOptions = {}) {
  const maxRetries = options.maxRetries || INFLUXDB_MAX_RETRIES;
  const retryDelay = options.retryDelay || INFLUXDB_RETRY_DELAY;
  const timeout = options.timeout || INFLUXDB_TIMEOUT;
  const debug = options.debug || process.env.INFLUXDB_DEBUG === 'true';
  
  if (debug) {
    console.log(`[InfluxDB] Executing query: ${query.substring(0, 200)}${query.length > 200 ? '...' : ''}`);
  }
  
  // Retry loop
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Use AbortController for request timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(`${INFLUXDB_URL}/api/v3/query_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          q: query,
          db: INFLUXDB_DATABASE
        }),
        signal: controller.signal
      });
      
      // Clear timeout
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[InfluxDB] Query failed (${response.status}): ${errorText}`);
        
        // If it's a server error and we haven't maxed out retries, try again
        if (response.status >= 500 && attempt < maxRetries) {
          console.log(`[InfluxDB] Server error, retrying in ${retryDelay}ms... (Attempt ${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
        
        return {
          success: false,
          error: `Query failed: ${response.status} ${response.statusText} - ${errorText}`,
          statusCode: response.status
        };
      }
      
      const data = await response.json();
      
      if (debug) {
        console.log(`[InfluxDB] Query successful, returned ${Array.isArray(data) ? data.length : 'non-array'} results`);
      }
      
      return {
        success: true,
        data,
        statusCode: response.status
      };
    } catch (error: any) {
      // Check if this is an abort error (timeout)
      if (error.name === 'AbortError') {
        console.error(`[InfluxDB] Query timeout after ${timeout}ms`);
        
        if (attempt < maxRetries) {
          console.log(`[InfluxDB] Timeout, retrying in ${retryDelay}ms... (Attempt ${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
        
        return {
          success: false,
          error: `Query timed out after ${timeout}ms`,
          statusCode: 408 // Request Timeout
        };
      }
      
      // Other errors (network, etc.)
      console.error(`[InfluxDB] Query error:`, error);
      
      if (attempt < maxRetries) {
        console.log(`[InfluxDB] Retrying in ${retryDelay}ms... (Attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }
      
      return {
        success: false,
        error: error.message || String(error),
        statusCode: 500 // Internal Server Error
      };
    }
  }
  
  // This should never be reached due to returns in the loop
  return {
    success: false,
    error: `Query failed after ${maxRetries} attempts`,
    statusCode: 500
  };
}

/**
 * Write data to InfluxDB 3 using line protocol with retry mechanism
 * @param lineProtocol Line protocol string
 * @param options Write options
 * @returns Success indicator and status
 */
export async function writeToInfluxDB(lineProtocol: string, options: InfluxDBWriteOptions = {}) {
  const maxRetries = options.maxRetries || INFLUXDB_MAX_RETRIES;
  const retryDelay = options.retryDelay || INFLUXDB_RETRY_DELAY;
  const precision = options.precision || 'nanosecond';
  const debug = options.debug || process.env.INFLUXDB_DEBUG === 'true';
  
  if (debug) {
    // Only log the first part of potentially lengthy line protocol data
    console.log(`[InfluxDB] Writing data: ${lineProtocol.substring(0, 100)}${lineProtocol.length > 100 ? '...' : ''}`);
  }
  
  // Retry loop
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`${INFLUXDB_URL}/api/v3/write_lp?db=${INFLUXDB_DATABASE}&precision=${precision}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: lineProtocol
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[InfluxDB] Write failed (${response.status}): ${errorText}`);
        
        // If it's a server error and we haven't maxed out retries, try again
        if (response.status >= 500 && attempt < maxRetries) {
          console.log(`[InfluxDB] Server error, retrying in ${retryDelay}ms... (Attempt ${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
        
        return {
          success: false,
          error: `Write failed: ${response.status} ${response.statusText} - ${errorText}`,
          statusCode: response.status
        };
      }
      
      if (debug) {
        console.log(`[InfluxDB] Write successful`);
      }
      
      return {
        success: true,
        statusCode: response.status
      };
    } catch (error: any) {
      console.error(`[InfluxDB] Write error:`, error);
      
      if (attempt < maxRetries) {
        console.log(`[InfluxDB] Retrying in ${retryDelay}ms... (Attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }
      
      return {
        success: false,
        error: error.message || String(error),
        statusCode: 500 // Internal Server Error
      };
    }
  }
  
  // This should never be reached due to returns in the loop
  return {
    success: false,
    error: `Write failed after ${maxRetries} attempts`,
    statusCode: 500
  };
}

/**
 * Format data as InfluxDB line protocol with improved type handling
 * @param measurement Measurement name
 * @param tags Tags as key-value pairs
 * @param fields Fields as key-value pairs
 * @param timestamp Optional timestamp in nanoseconds
 * @returns Formatted line protocol string
 */
export function formatLineProtocol(
  measurement: string, 
  tags: Record<string, string>, 
  fields: Record<string, any>, 
  timestamp?: number
) {
  // Validate inputs
  if (!measurement) {
    throw new Error('Measurement name is required');
  }
  
  if (!fields || Object.keys(fields).length === 0) {
    throw new Error('At least one field is required');
  }
  
  // Escape special characters in measurement name
  const escapedMeasurement = measurement.replace(/[ ,]/g, '\\$&');
  
  // Format tags - escape spaces and commas in tag values
  const tagEntries = Object.entries(tags || {})
    .filter(([_, value]) => value !== null && value !== undefined) // Skip null/undefined values
    .map(([key, value]) => {
      // Convert value to string and escape special characters
      const strValue = String(value).replace(/[ ,=]/g, '\\$&');
      return `${key}=${strValue}`;
    });
  
  const tagStr = tagEntries.length > 0 ? ',' + tagEntries.join(',') : '';
  
  // Format fields - proper handling of different data types
  const fieldEntries = Object.entries(fields)
    .filter(([_, value]) => value !== null && value !== undefined) // Skip null/undefined values
    .map(([key, value]) => {
      if (typeof value === 'string') {
        // Escape quotes in string values and wrap in double quotes
        return `${key}="${value.replace(/"/g, '\\"')}"`;
      } else if (typeof value === 'boolean') {
        return `${key}=${value ? 't' : 'f'}`; // InfluxDB format for booleans
      } else if (typeof value === 'number') {
        if (Number.isInteger(value)) {
          return `${key}=${value}i`; // Integer format
        } else {
          return `${key}=${value}`; // Float format
        }
      } else if (typeof value === 'object') {
        // Convert objects to JSON strings
        return `${key}="${JSON.stringify(value).replace(/"/g, '\\"')}"`;
      } else {
        return `${key}=${value}`;
      }
    });
  
  if (fieldEntries.length === 0) {
    throw new Error('At least one non-null field is required');
  }
  
  const fieldStr = fieldEntries.join(',');
  
  // Build line protocol with optional timestamp
  const timestampStr = timestamp ? ` ${timestamp}` : '';
  
  return `${escapedMeasurement}${tagStr} ${fieldStr}${timestampStr}`;
}

/**
 * Create a more robust InfluxDB SQL query for time range
 * @param measurement Measurement to query
 * @param fields Fields to select
 * @param filters Additional WHERE clauses
 * @param timeRange Time range in hours (default 24)
 * @param limit Result limit (default 1000)
 * @returns SQL query string
 */
export function createTimeRangeQuery(
  measurement: string,
  fields: string[] = ['*'],
  filters: string = '',
  timeRange: number = 24,
  limit: number = 1000
): string {
  // Validate inputs
  if (!measurement) {
    throw new Error('Measurement name is required');
  }
  
  // Quote field names if they contain spaces or special characters
  const quotedFields = fields.map(field => {
    if (field === '*') return field;
    if (/[ ,(){}[\]]/.test(field)) {
      return `"${field}"`;
    }
    return field;
  });
  
  const fieldList = quotedFields.join(', ');
  
  // Create time filter
  let timeFilter = '';
  if (timeRange > 0) {
    timeFilter = `time >= now() - ${timeRange}h`;
  }
  
  // Combine filters
  let whereClause = '';
  if (timeFilter && filters) {
    whereClause = `WHERE ${timeFilter} AND (${filters})`;
  } else if (timeFilter) {
    whereClause = `WHERE ${timeFilter}`;
  } else if (filters) {
    whereClause = `WHERE ${filters}`;
  }
  
  // Add quotes around measurement name if it contains special characters
  const quotedMeasurement = /[ ,()]/.test(measurement) ? `"${measurement}"` : measurement;
  
  // Build the full query
  return `SELECT ${fieldList} FROM ${quotedMeasurement} ${whereClause} ORDER BY time DESC LIMIT ${limit}`;
}

/**
 * Get the latest values for a measurement with more robust handling
 * @param measurement Measurement to query
 * @param tags Optional tag filters
 * @param options Query options
 * @returns Latest values with success status
 */
export async function getLatestValues(
  measurement: string, 
  tags?: Record<string, string>,
  options: InfluxDBQueryOptions = {}
) {
  // Build tag filters
  let tagFilters = '';
  
  if (tags && Object.keys(tags).length > 0) {
    tagFilters = Object.entries(tags)
      .filter(([_, value]) => value !== null && value !== undefined)
      .map(([key, value]) => {
        // Quote string values
        if (typeof value === 'string') {
          return `"${key}" = '${value.replace(/'/g, "''")}'`; // Escape single quotes in SQL
        } else {
          return `"${key}" = ${value}`;
        }
      })
      .join(' AND ');
  }
  
  // Build query
  const query = `
    SELECT * FROM "${measurement}"
    ${tagFilters ? `WHERE ${tagFilters}` : ''}
    ORDER BY time DESC
    LIMIT 1
  `;
  
  // Execute query with retry
  return queryInfluxDB(query, options);
}

/**
 * Helper function to get equipment metrics from InfluxDB
 * @param equipmentId Equipment ID
 * @param locationId Optional location ID
 * @returns Equipment metrics with proper type conversion
 */
export async function getEquipmentMetrics(equipmentId: string, locationId?: string) {
  const filters = [];
  
  // Add filters for equipmentId and locationId
  filters.push(`"equipmentId" = '${equipmentId}'`);
  if (locationId) {
    filters.push(`"locationId" = '${locationId}'`);
  }
  
  // Create query with a short time window to limit results
  const query = createTimeRangeQuery(
    'metrics',
    ['*'],
    filters.join(' AND '),
    1, // Last hour
    100 // Limit to latest 100 records
  );
  
  const result = await queryInfluxDB(query, { maxRetries: 2 });
  
  if (!result.success || !result.data || !Array.isArray(result.data) || result.data.length === 0) {
    console.warn(`[InfluxDB] No metrics found for equipment ${equipmentId}`);
    return { success: false, metrics: {} };
  }
  
  // Process results (combining all fields from rows)
  const metrics: Record<string, any> = {};
  
  // Process all rows to get the most complete data set
  for (const row of result.data) {
    Object.entries(row).forEach(([key, value]) => {
      // Skip time field and internal fields
      if (key !== 'time' && !key.startsWith('_') && value !== null && value !== undefined) {
        // Only overwrite if we don't already have this metric
        if (metrics[key] === undefined) {
          // Convert types appropriately
          if (typeof value === 'string') {
            if (value === 'true' || value === 'false') {
              metrics[key] = value === 'true';
            } else if (!isNaN(Number(value))) {
              metrics[key] = Number(value);
            } else {
              metrics[key] = value;
            }
          } else {
            metrics[key] = value;
          }
        }
      }
    });
  }
  
  return { success: true, metrics };
}

/**
 * Helper function to get control values for specific equipment
 * @param equipmentId Equipment ID
 * @param locationId Location ID
 * @returns Control values for the equipment
 */
export async function getEquipmentControlValues(equipmentId: string, locationId: string) {
  // Get list of control command tables first
  const tablesQuery = `SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'update\\_%'`;
  
  const tablesResult = await queryInfluxDB(tablesQuery);
  
  if (!tablesResult.success || !tablesResult.data || !Array.isArray(tablesResult.data)) {
    console.error(`[InfluxDB] Failed to get control tables`);
    return { success: false, controlValues: {} };
  }
  
  // Extract table names
  const tables = tablesResult.data
    .filter(row => row.table_name) // Ensure table_name exists
    .map(row => row.table_name as string);
  
  // Get latest value for each control type
  const controlValues: Record<string, any> = {};
  const promises = [];
  
  for (const table of tables) {
    // Extract command type from table name
    const commandType = table.replace('update_', '');
    
    // Build query for latest value
    const valueQuery = `
      SELECT * FROM "${table}"
      WHERE equipment_id = '${equipmentId}'
      AND location_id = '${locationId}'
      ORDER BY time DESC
      LIMIT 1
    `;
    
    // Create promise for each query
    promises.push(
      queryInfluxDB(valueQuery)
        .then(result => {
          if (result.success && result.data && Array.isArray(result.data) && result.data.length > 0) {
            let value = result.data[0].value;
            
            // Convert types appropriately
            if (typeof value === 'string') {
              if (value === 'true' || value === 'false') {
                value = value === 'true';
              } else if (!isNaN(Number(value))) {
                value = Number(value);
              } else if (value.startsWith('{') || value.startsWith('[')) {
                try {
                  value = JSON.parse(value);
                } catch (e) {
                  // Keep as string if parsing fails
                }
              }
            }
            
            // Use camelCase for field names
            const key = commandType.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
            controlValues[key] = value;
          }
        })
        .catch(error => {
          console.error(`[InfluxDB] Error getting control value for ${commandType}:`, error);
        })
    );
  }
  
  // Wait for all queries to complete
  await Promise.allSettled(promises);
  
  return { success: true, controlValues };
}

/**
 * Execute a write transaction to update control values
 * @param command Command name
 * @param data Command data
 * @returns Result of the operation
 */
export async function writeControlCommand(command: string, data: any) {
  try {
    // Ensure we have required fields
    if (!data.equipmentId || !data.locationId || data.value === undefined) {
      return {
        success: false,
        error: "Missing required fields (equipmentId, locationId, or value)"
      };
    }
    
    // Prepare tags and fields
    const tags = {
      equipment_id: data.equipmentId,
      location_id: data.locationId,
      source: data.source || "server_logic",
      user_id: data.userId || "system",
      user_name: data.userName || "Automated Control"
    };
    
    const fields: Record<string, any> = {
      value: data.value,
      details: data.details || `Command issued by system: ${command}`,
      status: data.status || "completed"
    };
    
    // Add previous value if provided
    if (data.previousValue !== undefined) {
      fields.previous_value = data.previousValue;
    }
    
    // Use the proper table name
    const measurement = command.startsWith('update_') ? command : `update_${command}`;
    
    // Format as line protocol
    const lineProtocol = formatLineProtocol(measurement, tags, fields);
    
    // Write to InfluxDB
    const result = await writeToInfluxDB(lineProtocol);
    
    return {
      success: result.success,
      error: result.error,
      command,
      value: data.value,
      timestamp: Date.now()
    };
  } catch (error: any) {
    console.error(`[InfluxDB] Error writing control command:`, error);
    return {
      success: false,
      error: error.message || String(error),
      timestamp: Date.now()
    };
  }
}
