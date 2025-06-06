// @ts-nocheck
// /opt/productionapp/lib/influxdb-cloud-client.ts
// Modified to support local InfluxDB 3 instance

import { exec } from 'child_process'
import { promisify } from 'util'

// Use the local InfluxDB URL
const url = "http://143.198.162.31:8181"
const database = process.env.INFLUXDB_DATABASE || 'Locations'

// Helper function to run shell commands
const execPromise = promisify(exec)

// Function to execute InfluxQL queries against InfluxDB 3
export async function queryInfluxDBCloud(fluxQuery: string) {
  try {
    console.log(`Executing query on local InfluxDB: ${fluxQuery}`)
    
    // Convert Flux query to InfluxQL - this is a simple conversion and might need adjustments
    // Remove bucket references and replace with database
    const influxQL = fluxQuery
      .replace(/from\s*\(\s*bucket\s*:\s*"[^"]*"\s*\)/, '')
      .replace(/range\s*\(\s*start\s*:\s*-(\d+)([dhm])\s*\)/, 'SELECT * FROM /.*/ WHERE time > now() - $1$2')
      .replace(/filter\s*\(\s*fn\s*:\s*\(\s*r\s*\)\s*=>\s*r\._measurement\s*==\s*"([^"]*)"\s*\)/, 'FROM $1')
      .replace(/filter\s*\(\s*fn\s*:\s*\(\s*r\s*\)\s*=>\s*r\.([^=]*)=="([^"]*)"\s*\)/, 'WHERE $1=\'$2\'')
      .replace(/filter\s*\(\s*fn\s*:\s*\(\s*r\s*\)\s*=>\s*r\._field\s*==\s*"([^"]*)"\s*\)/, 'AND $1 IS NOT NULL')
      .replace(/sort\s*\(\s*columns\s*:\s*\[\s*"_time"\s*\]\s*,\s*desc\s*:\s*true\s*\)/, 'ORDER BY time DESC')
      .replace(/limit\s*\(\s*n\s*:\s*(\d+)\s*\)/, 'LIMIT $1')
      .replace(/last\s*\(\s*\)/, 'ORDER BY time DESC LIMIT 1')
    
    console.log(`Converted query: ${influxQL}`)
    
    // Use curl to execute the query against InfluxDB 3
    const command = `curl -s -G "${url}/api/v3/query_lp?db=${database}" --data-urlencode "q=${influxQL}"`
    const { stdout } = await execPromise(command)
    
    // Parse the results
    const results = stdout.trim().split('\n').map(line => {
      const parts = line.split(',')
      const result: any = { _measurement: parts[0] }
      
      // Parse tags and fields
      parts.slice(1).forEach(part => {
        const [key, value] = part.split('=')
        if (key && value) {
          result[key.trim()] = value.trim()
        }
      })
      
      return result
    })
    
    return results
  } catch (error) {
    console.error('InfluxDB query error:', error)
    throw error
  }
}

// Function to write data to local InfluxDB 3
export async function writeToInfluxDBCloud(measurement: string, tags: Record<string, string>, fields: Record<string, any>) {
  try {
    console.log(`Writing to local InfluxDB: ${measurement}`)
    
    // Build the line protocol string
    let lineProtocol = measurement
    
    // Add tags
    Object.entries(tags).forEach(([key, value]) => {
      lineProtocol += `,${key}=${String(value)}`
    })
    
    lineProtocol += ' '
    
    // Add fields
    const fieldEntries = Object.entries(fields)
    fieldEntries.forEach(([key, value], index) => {
      if (typeof value === 'number') {
        lineProtocol += `${key}=${value}`
      } else if (typeof value === 'boolean') {
        lineProtocol += `${key}=${value}`
      } else if (typeof value === 'string') {
        lineProtocol += `${key}="${value}"`
      } else if (value !== null && value !== undefined) {
        // Convert objects to JSON strings
        lineProtocol += `${key}="${JSON.stringify(value)}"`
      }
      
      if (index < fieldEntries.length - 1) {
        lineProtocol += ','
      }
    })
    
    // Escape special characters for command line
    const escapedLineProtocol = lineProtocol
      .replace(/\\/g, '\\\\')  // Double escape backslashes
      .replace(/"/g, '\\"')    // Escape double quotes
      .replace(/'/g, "\\'")    // Escape single quotes
      .replace(/`/g, '\\`')    // Escape backticks
      .replace(/\$/g, '\\$')   // Escape dollar signs
      .replace(/!/g, '\\!')    // Escape exclamations
      .replace(/\n/g, ' ')     // Replace newlines with spaces
    
    // Use curl to write the data
    const command = `curl -s -X POST "${url}/api/v3/write_lp?db=${database}&precision=ns" -H "Content-Type: text/plain" -d "${escapedLineProtocol}"`
    await execPromise(command)
    
    return true
  } catch (error) {
    console.error('InfluxDB write error:', error)
    throw error
  }
}

// Function to write control command
export async function writeControlCommand(
  locationId: string,
  equipmentId: string,
  commandType: string,
  value: any,
  metadata: Record<string, any> = {}
) {
  const tags = {
    locationId,
    equipmentId,
    commandType,
    source: 'web_dashboard',
  }

  const fields = {
    value: typeof value === 'object' ? JSON.stringify(value) : value,
    status: 'pending',
    timestamp: Date.now(),
    ...metadata,
  }

  return writeToInfluxDBCloud('control_commands', tags, fields)
}

// Function to query control history
export async function getControlHistory(locationId: string, equipmentId: string, limit = 20) {
  const query = `SELECT * FROM control_commands WHERE locationId='${locationId}' AND equipmentId='${equipmentId}' ORDER BY time DESC LIMIT ${limit}`
  return queryInfluxDBCloud(query)
}

// Function to query latest metrics
export async function getLatestMetrics(locationId: string, equipmentId: string) {
  const query = `SELECT * FROM Locations WHERE location='${locationId}' AND equipmentId='${equipmentId}' ORDER BY time DESC LIMIT 1`
  return queryInfluxDBCloud(query)
}

// New function to get a specific metric for monitoring
export async function getMetricValue(locationId: string, systemId: string | null, metricName: string) {
  let query = `SELECT ${metricName} FROM Locations WHERE location='${locationId}'`
  
  if (systemId) {
    query += ` AND system='${systemId}'`
  }
  
  query += ' ORDER BY time DESC LIMIT 1'
  
  const results = await queryInfluxDBCloud(query)
  if (results && results.length > 0) {
    return results[0][metricName]
  }
  return null
}

// Function to get outdoor temperature
export async function getOutdoorTemperature(locationId: string) {
  // Common outdoor temperature field names
  const tempFields = [
    'OutdoorTemperature',
    'OutsideTemperature',
    'OutdoorTemp',
    'OutsideTemp',
    'Outside Temperature'
  ]
  
  const fieldsQuery = tempFields.map(field => `${field}`).join(' OR ')
  
  const query = `SELECT ${fieldsQuery} FROM Locations WHERE location='${locationId}' ORDER BY time DESC LIMIT 1`
  
  const results = await queryInfluxDBCloud(query)
  if (results && results.length > 0) {
    for (const field of tempFields) {
      if (results[0][field] !== undefined) {
        return results[0][field]
      }
    }
  }
  return null
}

// Function to update command status
export async function updateCommandStatus(
  locationId: string,
  equipmentId: string,
  commandId: string,
  status: string
) {
  const tags = {
    locationId,
    equipmentId,
    commandId,
  }

  const fields = {
    status,
    updatedAt: Date.now(),
  }

  return writeToInfluxDBCloud('command_status', tags, fields)
}
