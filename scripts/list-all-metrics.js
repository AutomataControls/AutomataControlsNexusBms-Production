/**
 * Script to retrieve all metric names from the RTDB for every location and equipment
 * This helps with properly setting up the monitoring service's metric mapping
 *
 * Usage: node list-all-metrics.js
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');

// Try to load from .env.local if it exists
try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
} catch (error) {
  console.log('No .env.local file found, using .env');
}

const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get } = require('firebase/database');

// Initialize Firebase configs
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Initialize secondary Firebase for RTDB
const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ||
                   `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`;

console.log('Using database URL:', databaseURL);

const secondaryFirebaseConfig = {
  ...firebaseConfig,
  databaseURL: databaseURL
};

// Initialize Firebase instances
const secondaryFirebaseApp = initializeApp(secondaryFirebaseConfig, 'secondary');
const rtdb = getDatabase(secondaryFirebaseApp);

async function getAllMetrics() {
  try {
    console.log("Connecting to Firebase RTDB...")

    // Get all locations
    const locationsRef = ref(rtdb, "/locations")
    const locationsSnapshot = await get(locationsRef)

    if (!locationsSnapshot.exists()) {
      console.log("No locations found in the database")
      return
    }

    const locationsData = locationsSnapshot.val()
    console.log(`Found ${Object.keys(locationsData).length} locations`)

    // Create a structure to hold all metrics
    const allMetrics = {}

    // Process each location
    for (const [locationKey, locationData] of Object.entries(locationsData)) {
      console.log(`\nProcessing location: ${locationKey}`)

      const locationId = locationData.id || locationKey
      const locationName = locationData.name || locationKey

      allMetrics[locationKey] = {
        id: locationId,
        name: locationName,
        systems: {},
      }

      // Skip if no systems
      if (!locationData.systems) {
        console.log(`  No systems found for location ${locationKey}`)
        continue
      }

      // Process each system in the location
      for (const [systemKey, systemData] of Object.entries(locationData.systems)) {
        console.log(`  Processing system: ${systemKey}`)

        const systemName = systemData.name || systemKey

        allMetrics[locationKey].systems[systemKey] = {
          name: systemName,
          metrics: {},
        }

        // Skip if no metrics
        if (!systemData.metrics) {
          console.log(`    No metrics found for system ${systemKey}`)
          continue
        }

        // Process each metric in the system
        for (const [metricKey, metricValue] of Object.entries(systemData.metrics)) {
          // Store metric information
          allMetrics[locationKey].systems[systemKey].metrics[metricKey] = {
            value: metricValue,
            type: typeof metricValue,
            possibleMappings: generatePossibleMappings(metricKey),
          }
        }

        const metricCount = Object.keys(systemData.metrics).length
        console.log(`    Found ${metricCount} metrics for system ${systemKey}`)
      }
    }

    // Generate summary
    const summary = generateSummary(allMetrics)

    // Save the full metrics data to a file
    const outputPath = path.join(__dirname, "all-metrics-report.json")
    fs.writeFileSync(outputPath, JSON.stringify(allMetrics, null, 2))
    console.log(`\nFull metrics data saved to ${outputPath}`)

    // Save the summary to a file
    const summaryPath = path.join(__dirname, "metrics-summary.json")
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2))
    console.log(`Summary saved to ${summaryPath}`)

    // Print metric mapping suggestions
    console.log("\n=== SUGGESTED METRIC MAPPINGS ===")
    printMetricMappingSuggestions(summary.uniqueMetricNames)

    return { allMetrics, summary }
  } catch (error) {
    console.error("Error retrieving metrics:", error)
  }
}

// Generate possible mappings for a metric name
function generatePossibleMappings(metricName) {
  const mappings = [metricName]

  // Add lowercase version
  mappings.push(metricName.toLowerCase())

  // Add version with spaces replaced by underscores and vice versa
  if (metricName.includes(" ")) {
    mappings.push(metricName.replace(/\s+/g, "_"))
  }
  if (metricName.includes("_")) {
    mappings.push(metricName.replace(/_+/g, " "))
  }

  // Add common variations for temperature metrics
  if (metricName.toLowerCase().includes("temp")) {
    mappings.push("Temperature")
    mappings.push("temperature")

    // Add specific temperature types
    if (metricName.toLowerCase().includes("supply")) {
      mappings.push("Supply Air Temperature")
      mappings.push("SupplyAirTemperature")
    }
    if (metricName.toLowerCase().includes("return")) {
      mappings.push("Return Air Temperature")
      mappings.push("ReturnAirTemperature")
    }
    if (metricName.toLowerCase().includes("outside") || metricName.toLowerCase().includes("outdoor")) {
      mappings.push("Outside Air Temperature")
      mappings.push("Outdoor Air Temperature")
      mappings.push("OutdoorAirTemperature")
    }
  }

  // Add common variations for humidity metrics
  if (metricName.toLowerCase().includes("humid")) {
    mappings.push("Humidity")
    mappings.push("humidity")

    // Add specific humidity types
    if (metricName.toLowerCase().includes("supply")) {
      mappings.push("Supply Air Humidity")
    }
    if (metricName.toLowerCase().includes("return")) {
      mappings.push("Return Air Humidity")
    }
    if (metricName.toLowerCase().includes("outside") || metricName.toLowerCase().includes("outdoor")) {
      mappings.push("Outside Air Humidity")
      mappings.push("Outdoor Air Humidity")
    }
  }

  // Add common variations for pressure metrics
  if (metricName.toLowerCase().includes("press")) {
    mappings.push("Pressure")
    mappings.push("pressure")
    mappings.push("Static Pressure")
  }

  // Return unique mappings
  return [...new Set(mappings)]
}

// Generate a summary of all metrics
function generateSummary(allMetrics) {
  const summary = {
    locationCount: 0,
    systemCount: 0,
    metricCount: 0,
    uniqueMetricNames: {},
    metricsByType: {
      temperature: [],
      humidity: [],
      pressure: [],
      speed: [],
      position: [],
      setpoint: [],
      other: [],
    },
  }

  // Process all metrics
  for (const locationData of Object.values(allMetrics)) {
    summary.locationCount++

    for (const systemData of Object.values(locationData.systems)) {
      summary.systemCount++

      for (const [metricName, metricData] of Object.entries(systemData.metrics)) {
        summary.metricCount++

        // Track unique metric names
        if (!summary.uniqueMetricNames[metricName]) {
          summary.uniqueMetricNames[metricName] = {
            count: 0,
            type: metricData.type,
            examples: [],
          }
        }

        summary.uniqueMetricNames[metricName].count++

        // Add example if we don't have too many
        if (summary.uniqueMetricNames[metricName].examples.length < 5) {
          summary.uniqueMetricNames[metricName].examples.push(metricData.value)
        }

        // Categorize metrics by type
        const metricNameLower = metricName.toLowerCase()
        if (metricNameLower.includes("temp")) {
          summary.metricsByType.temperature.push(metricName)
        } else if (metricNameLower.includes("humid")) {
          summary.metricsByType.humidity.push(metricName)
        } else if (metricNameLower.includes("press")) {
          summary.metricsByType.pressure.push(metricName)
        } else if (metricNameLower.includes("speed") || metricNameLower.includes("rpm")) {
          summary.metricsByType.speed.push(metricName)
        } else if (
          metricNameLower.includes("position") ||
          metricNameLower.includes("valve") ||
          metricNameLower.includes("damper")
        ) {
          summary.metricsByType.position.push(metricName)
        } else if (metricNameLower.includes("setpoint") || metricNameLower.includes("set point")) {
          summary.metricsByType.setpoint.push(metricName)
        } else {
          summary.metricsByType.other.push(metricName)
        }
      }
    }
  }

  // Remove duplicates from metricsByType
  for (const type in summary.metricsByType) {
    summary.metricsByType[type] = [...new Set(summary.metricsByType[type])]
  }

  return summary
}

// Print suggested metric mappings for the monitoring service
function printMetricMappingSuggestions(uniqueMetricNames) {
  console.log("\nHere are suggested mappings for your monitoring service:")
  console.log("\nconst metricMappings = {")

  // Temperature metrics
  console.log("  // Temperature metrics")
  for (const metricName of Object.keys(uniqueMetricNames)) {
    if (metricName.toLowerCase().includes("temp")) {
      console.log(`  "${metricName}": ["${metricName}", "${metricName.toLowerCase()}", "Temperature"],`)
    }
  }

  // Humidity metrics
  console.log("\n  // Humidity metrics")
  for (const metricName of Object.keys(uniqueMetricNames)) {
    if (metricName.toLowerCase().includes("humid")) {
      console.log(`  "${metricName}": ["${metricName}", "${metricName.toLowerCase()}", "Humidity"],`)
    }
  }

  // Pressure metrics
  console.log("\n  // Pressure metrics")
  for (const metricName of Object.keys(uniqueMetricNames)) {
    if (metricName.toLowerCase().includes("press")) {
      console.log(`  "${metricName}": ["${metricName}", "${metricName.toLowerCase()}", "Pressure"],`)
    }
  }

  // Other metrics
  console.log("\n  // Other metrics")
  for (const metricName of Object.keys(uniqueMetricNames)) {
    if (
      !metricName.toLowerCase().includes("temp") &&
      !metricName.toLowerCase().includes("humid") &&
      !metricName.toLowerCase().includes("press")
    ) {
      console.log(`  "${metricName}": ["${metricName}", "${metricName.toLowerCase()}"],`)
    }
  }

  console.log("};")

  console.log("\nYou can use this mapping in your getMetricValue function:")
  console.log(`
// Example implementation for your monitoring service
function getMetricValue(locationId, systemId, metricName) {
  // Try to find the metric using the mappings
  if (metricMappings[metricName]) {
    for (const mappedName of metricMappings[metricName]) {
      // Try to get the metric with this mapped name
      const value = getRawMetricValue(locationId, systemId, mappedName);
      if (value !== null) {
        return value;
      }
    }
  }
  
  // Fallback to direct lookup
  return getRawMetricValue(locationId, systemId, metricName);
}
  `)
}

// Run the script
getAllMetrics()
  .then(() => {
    console.log("\nScript completed successfully")
    process.exit(0)
  })
  .catch((error) => {
    console.error("Script failed:", error)
    process.exit(1)
  })
