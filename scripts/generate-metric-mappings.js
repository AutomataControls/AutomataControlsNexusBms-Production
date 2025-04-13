/**
 * Script to generate optimized metric mappings from the all-metrics-report.json
 * This script analyzes the metrics data and creates a comprehensive mapping file
 * that can be used in the monitoring service
 *
 * Usage: node generate-metric-mappings.js
 */

const fs = require("fs")
const path = require("path")

// Path to the metrics report file
const reportPath = path.join(__dirname, "all-metrics-report.json")
const outputPath = path.join(__dirname, "metric-mappings.js")

// Check if the report file exists
if (!fs.existsSync(reportPath)) {
  console.error("Metrics report file not found. Please run list-all-metrics.js first.")
  process.exit(1)
}

// Load the metrics report
const metricsReport = JSON.parse(fs.readFileSync(reportPath, "utf8"))

// Function to categorize metrics by type
function categorizeMetrics(metricsReport) {
  // Define metric categories
  const categories = {
    temperature: [],
    humidity: [],
    pressure: [],
    airflow: [],
    valve: [],
    damper: [],
    fan: [],
    pump: [],
    status: [],
    setpoint: [],
    actuator: [],
    mode: [],
    alarm: [],
    other: [],
  }

  // Process all locations, systems, and metrics
  Object.values(metricsReport).forEach((location) => {
    Object.values(location.systems).forEach((system) => {
      Object.entries(system.metrics).forEach(([metricName, metricData]) => {
        // Determine category based on name
        const nameLower = metricName.toLowerCase()

        if (nameLower.includes("temp") || (nameLower.includes("air") && !nameLower.includes("actuator"))) {
          categories.temperature.push(metricName)
        } else if (nameLower.includes("humid") || nameLower.includes("rh")) {
          categories.humidity.push(metricName)
        } else if (nameLower.includes("press") || nameLower.includes("static")) {
          categories.pressure.push(metricName)
        } else if (nameLower.includes("flow") || nameLower.includes("cfm")) {
          categories.airflow.push(metricName)
        } else if (nameLower.includes("valve")) {
          categories.valve.push(metricName)
        } else if (nameLower.includes("damper")) {
          categories.damper.push(metricName)
        } else if (nameLower.includes("fan")) {
          categories.fan.push(metricName)
        } else if (nameLower.includes("pump")) {
          categories.pump.push(metricName)
        } else if (nameLower.includes("status") || nameLower.includes("state") || nameLower.includes("enabled")) {
          categories.status.push(metricName)
        } else if (nameLower.includes("setpoint") || nameLower.includes("target")) {
          categories.setpoint.push(metricName)
        } else if (nameLower.includes("actuator")) {
          categories.actuator.push(metricName)
        } else if (nameLower.includes("mode")) {
          categories.mode.push(metricName)
        } else if (nameLower.includes("alarm")) {
          categories.alarm.push(metricName)
        } else {
          categories.other.push(metricName)
        }
      })
    })
  })

  // Remove duplicates from each category
  Object.keys(categories).forEach((category) => {
    categories[category] = [...new Set(categories[category])]
  })

  return categories
}

// Function to generate mappings for each metric
function generateMetricMappings(metricsReport) {
  const mappings = {}
  const seenMetrics = new Set()

  // Process all locations, systems, and metrics
  Object.values(metricsReport).forEach((location) => {
    Object.values(location.systems).forEach((system) => {
      Object.entries(system.metrics).forEach(([metricName, metricData]) => {
        // Skip if we've already processed this metric
        if (seenMetrics.has(metricName)) return
        seenMetrics.add(metricName)

        // Start with the possible mappings from the report
        const possibleMappings = [...metricData.possibleMappings]

        // Add additional variations
        const nameLower = metricName.toLowerCase()

        // Add common variations based on metric type
        if (nameLower.includes("temp")) {
          possibleMappings.push("Temperature")
          possibleMappings.push("temperature")

          if (nameLower.includes("supply")) {
            possibleMappings.push("Supply Air Temperature")
            possibleMappings.push("SupplyAirTemperature")
            possibleMappings.push("Supply Temperature")
            possibleMappings.push("SAT")
          }

          if (nameLower.includes("return")) {
            possibleMappings.push("Return Air Temperature")
            possibleMappings.push("ReturnAirTemperature")
            possibleMappings.push("Return Temperature")
            possibleMappings.push("RAT")
          }

          if (nameLower.includes("outdoor") || nameLower.includes("outside")) {
            possibleMappings.push("Outdoor Air Temperature")
            possibleMappings.push("Outside Air Temperature")
            possibleMappings.push("OAT")
          }

          if (nameLower.includes("mixed")) {
            possibleMappings.push("Mixed Air Temperature")
            possibleMappings.push("MAT")
          }

          if (nameLower.includes("discharge")) {
            possibleMappings.push("Discharge Air Temperature")
            possibleMappings.push("DAT")
          }
        }

        if (nameLower.includes("humid")) {
          possibleMappings.push("Humidity")
          possibleMappings.push("humidity")
          possibleMappings.push("RH")
          possibleMappings.push("Relative Humidity")

          if (nameLower.includes("outdoor") || nameLower.includes("outside")) {
            possibleMappings.push("Outdoor Humidity")
            possibleMappings.push("Outside Humidity")
            possibleMappings.push("OAH")
          }
        }

        if (nameLower.includes("press")) {
          possibleMappings.push("Pressure")
          possibleMappings.push("pressure")
          possibleMappings.push("Static Pressure")
          possibleMappings.push("SP")
        }

        // Remove duplicates
        mappings[metricName] = [...new Set(possibleMappings)]
      })
    })
  })

  return mappings
}

// Function to generate type-based mappings
function generateTypeMappings(categories) {
  const typeMappings = {}

  Object.entries(categories).forEach(([category, metrics]) => {
    typeMappings[category] = metrics
  })

  return typeMappings
}

// Generate the mappings
const categories = categorizeMetrics(metricsReport)
const metricMappings = generateMetricMappings(metricsReport)
const typeMappings = generateTypeMappings(categories)

// Count metrics by type for reporting
const metricCounts = {}
Object.entries(categories).forEach(([category, metrics]) => {
  metricCounts[category] = metrics.length
})

// Create the output file content
const outputContent = `/**
 * Metric mappings for the monitoring service
 * Generated on ${new Date().toISOString()}
 * 
 * This file contains mappings for ${Object.keys(metricMappings).length} unique metrics
 * categorized into ${Object.keys(categories).length} types.
 */

// Metric mappings by name
const metricMappings = ${JSON.stringify(metricMappings, null, 2)};

// Metric mappings by type
const metricTypeMapping = ${JSON.stringify(typeMappings, null, 2)};

/**
 * Get a metric value using the mappings
 * @param {string} locationId - The location ID
 * @param {string} systemId - The system/equipment ID
 * @param {string} metricName - The metric name to look for
 * @param {Object} rtdbData - The RTDB data
 * @returns {number|null} - The metric value or null if not found
 */
function getMetricValue(locationId, systemId, metricName, rtdbData) {
  if (!rtdbData) {
    console.log("No RTDB data available");
    return null;
  }

  try {
    // First, find the location key that matches the locationId
    let locationKey = null;

    // Try direct match first
    if (rtdbData[locationId]) {
      locationKey = locationId;
    } else {
      // If not found directly, search through all locations
      console.log(\`Location \${locationId} not found directly, searching through all locations\`);
      
      // Try to find a location with a matching ID property
      for (const [key, value] of Object.entries(rtdbData)) {
        if (value.id === locationId) {
          locationKey = key;
          console.log(\`Found location with matching ID: \${key}\`);
          break;
        }
      }

      if (!locationKey) {
        console.log(\`No location found for ID: \${locationId}\`);
        return null;
      }
    }

    // Check if location has systems
    if (!rtdbData[locationKey].systems) {
      console.log(\`No systems found for location \${locationKey}\`);
      return null;
    }

    // Check if system exists
    if (!rtdbData[locationKey].systems[systemId]) {
      console.log(\`System \${systemId} not found in location \${locationKey}\`);

      // Try to find a system with a similar name
      const systemKeys = Object.keys(rtdbData[locationKey].systems);
      console.log(\`Available systems in \${locationKey}: \${systemKeys.join(", ")}\`);

      // Try case-insensitive match with more flexible matching
      const systemMatch = systemKeys.find((key) => {
        // Try exact match first (case insensitive)
        if (key.toLowerCase() === systemId.toLowerCase()) {
          return true;
        }

        // Try partial matches
        if (
          key.toLowerCase().includes(systemId.toLowerCase()) ||
          systemId.toLowerCase().includes(key.toLowerCase())
        ) {
          return true;
        }

        // Try matching by type (if systemId contains a type like "Boiler", "AHU", etc.)
        const commonTypes = ["boiler", "ahu", "chiller", "pump", "fan", "vav", "rtu", "fcu"];
        for (const type of commonTypes) {
          if (systemId.toLowerCase().includes(type) && key.toLowerCase().includes(type)) {
            return true;
          }
        }

        return false;
      });

      if (systemMatch) {
        console.log(\`Found system with similar name: \${systemMatch}\`);
        systemId = systemMatch;
      } else {
        return null;
      }
    }

    // Check if system has metrics
    if (!rtdbData[locationKey].systems[systemId].metrics) {
      console.log(\`No metrics found for system \${systemId} in location \${locationKey}\`);
      return null;
    }

    // Get the metrics object
    const metrics = rtdbData[locationKey].systems[systemId].metrics;
    
    // Try to find the metric using the mappings
    if (metricMappings[metricName]) {
      for (const mappedName of metricMappings[metricName]) {
        if (metrics[mappedName] !== undefined) {
          const value = metrics[mappedName];
          console.log(\`Found mapped metric \${metricName} -> \${mappedName}: \${value}\`);
          return typeof value === "number" ? value : Number.parseFloat(value);
        }
      }
    }
    
    // If no direct mapping found, try to find by type
    // Determine the likely type of the metric
    const metricType = getMetricType(metricName);
    if (metricType && metricTypeMapping[metricType]) {
      // Try each metric of this type
      for (const typedMetricName of metricTypeMapping[metricType]) {
        if (metrics[typedMetricName] !== undefined) {
          const value = metrics[typedMetricName];
          console.log(\`Found metric by type (\${metricType}): \${metricName} -> \${typedMetricName}: \${value}\`);
          return typeof value === "number" ? value : Number.parseFloat(value);
        }
      }
    }
    
    // If still not found, try direct match
    if (metrics[metricName] !== undefined) {
      const value = metrics[metricName];
      console.log(\`Found exact match for metric \${metricName}: \${value}\`);
      return typeof value === "number" ? value : Number.parseFloat(value);
    }

    // Try case-insensitive match
    const metricNameLower = metricName.toLowerCase();
    for (const key of Object.keys(metrics)) {
      if (key.toLowerCase() === metricNameLower) {
        const value = metrics[key];
        console.log(\`Found case-insensitive match for metric \${metricName} -> \${key}: \${value}\`);
        return typeof value === "number" ? value : Number.parseFloat(value);
      }
    }

    // Try partial match (if metric name contains the search term or vice versa)
    for (const key of Object.keys(metrics)) {
      if (key.toLowerCase().includes(metricNameLower) || metricNameLower.includes(key.toLowerCase())) {
        const value = metrics[key];
        console.log(\`Found partial match for metric \${metricName} -> \${key}: \${value}\`);
        return typeof value === "number" ? value : Number.parseFloat(value);
      }
    }

    console.log(\`Metric \${metricName} not found in system \${systemId} in location \${locationKey}\`);
    return null;
  } catch (error) {
    console.error(\`Error getting metric value for \${locationId}/\${systemId}/\${metricName}:\`, error);
    return null;
  }
}

/**
 * Determine the likely type of a metric based on its name
 * @param {string} metricName - The metric name
 * @returns {string|null} - The likely metric type or null if unknown
 */
function getMetricType(metricName) {
  const nameLower = metricName.toLowerCase();
  
  if (nameLower.includes('temp') || nameLower.includes('air') && !nameLower.includes('actuator')) {
    return 'temperature';
  } else if (nameLower.includes('humid') || nameLower.includes('rh')) {
    return 'humidity';
  } else if (nameLower.includes('press') || nameLower.includes('static')) {
    return 'pressure';
  } else if (nameLower.includes('flow') || nameLower.includes('cfm')) {
    return 'airflow';
  } else if (nameLower.includes('valve')) {
    return 'valve';
  } else if (nameLower.includes('damper')) {
    return 'damper';
  } else if (nameLower.includes('fan')) {
    return 'fan';
  } else if (nameLower.includes('pump')) {
    return 'pump';
  } else if (nameLower.includes('status') || nameLower.includes('state') || nameLower.includes('enabled')) {
    return 'status';
  } else if (nameLower.includes('setpoint') || nameLower.includes('target')) {
    return 'setpoint';
  } else if (nameLower.includes('actuator')) {
    return 'actuator';
  } else if (nameLower.includes('mode')) {
    return 'mode';
  } else if (nameLower.includes('alarm')) {
    return 'alarm';
  }
  
  return null;
}

module.exports = {
  metricMappings,
  metricTypeMapping,
  getMetricValue,
  getMetricType
};
`

// Write the output file
fs.writeFileSync(outputPath, outputContent)

// Generate a summary report
console.log(`\n=== METRIC MAPPING GENERATION SUMMARY ===`)
console.log(`Generated mappings for ${Object.keys(metricMappings).length} unique metrics`)
console.log(`Categorized into ${Object.keys(categories).length} types:`)
Object.entries(metricCounts).forEach(([category, count]) => {
  console.log(`  - ${category}: ${count} metrics`)
})
console.log(`\nOutput file saved to: ${outputPath}`)

console.log(`\n=== HOW TO USE THE METRIC MAPPINGS ===`)
console.log(`1. Import the getMetricValue function in your monitoring service:`)
console.log(`   const { getMetricValue } = require('./metric-mappings');`)
console.log(`2. Use the getMetricValue function to get metric values:`)
console.log(`   const value = getMetricValue(locationId, systemId, metricName, rtdbData);`)
console.log(`3. This function will use the generated mappings to find the correct metric value.`)
console.log(`4. You can also use the getMetricType function to determine the type of a metric:`)
console.log(`   const metricType = getMetricType(metricName);`)
