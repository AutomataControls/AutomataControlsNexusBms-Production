/**
 * Script to test the metric mappings with real data
 * This script will test the getMetricValue function with various metrics
 * to ensure it can correctly find them in the RTDB data
 *
 * Usage: node test-metric-mapping.js [metric-name]
 */

require("dotenv").config()
const path = require("path")
const fs = require("fs")

// Try to load from .env.local if it exists
try {
  require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") })
} catch (error) {
  console.log("No .env.local file found, using .env")
}

const { initializeApp } = require("firebase/app")
const { getDatabase, ref, get } = require("firebase/database")

// Path to the metric mappings file
const mappingsPath = path.join(__dirname, "metric-mappings.js")

// Check if the mappings file exists
if (!fs.existsSync(mappingsPath)) {
  console.error("Metric mappings file not found. Please run generate-metric-mappings.js first.")
  process.exit(1)
}

// Import the metric mappings
const { getMetricValue, getMetricType, metricTypeMapping } = require("./metric-mappings")

// Initialize Firebase configs
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

// Initialize secondary Firebase for RTDB
const databaseURL =
  process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ||
  `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`

console.log("Using database URL:", databaseURL)

const secondaryFirebaseConfig = {
  ...firebaseConfig,
  databaseURL: databaseURL,
}

// Initialize Firebase instances
const secondaryFirebaseApp = initializeApp(secondaryFirebaseConfig, "secondary")
const rtdb = getDatabase(secondaryFirebaseApp)

// Function to test metric mappings
async function testMetricMappings(specificMetric = null) {
  console.log("Testing metric mappings...")

  try {
    // Fetch RTDB data
    const locationsRef = ref(rtdb, "/locations")
    const snapshot = await get(locationsRef)
    const rtdbData = snapshot.val() || {}

    console.log(`Found ${Object.keys(rtdbData).length} locations in RTDB`)

    // If a specific metric was provided, test just that one
    if (specificMetric) {
      console.log(`\nTesting specific metric: ${specificMetric}`)
      const metricType = getMetricType(specificMetric)
      console.log(`Detected metric type: ${metricType || "unknown"}`)

      // Test the metric on all locations and systems
      let found = false
      for (const [locationKey, locationData] of Object.entries(rtdbData)) {
        for (const [systemKey, systemData] of Object.entries(locationData.systems || {})) {
          const value = getMetricValue(locationKey, systemKey, specificMetric, rtdbData)
          if (value !== null) {
            console.log(`Found in ${locationKey}/${systemKey}: ${value}`)
            found = true
          }
        }
      }

      if (!found) {
        console.log(`Metric "${specificMetric}" not found in any location/system`)
      }

      return
    }

    // Test a sample of metrics from each type
    console.log("\nTesting sample metrics from each type:")

    for (const [type, metrics] of Object.entries(metricTypeMapping)) {
      if (metrics.length === 0) continue

      console.log(`\n=== Testing ${type} metrics ===`)

      // Take up to 3 samples from each type
      const samples = metrics.slice(0, 3)

      for (const metricName of samples) {
        console.log(`\nTesting metric: ${metricName}`)

        // Test on a few locations
        let found = false
        const locationKeys = Object.keys(rtdbData).slice(0, 3)

        for (const locationKey of locationKeys) {
          const systemKeys = Object.keys(rtdbData[locationKey].systems || {}).slice(0, 3)

          for (const systemKey of systemKeys) {
            const value = getMetricValue(locationKey, systemKey, metricName, rtdbData)
            if (value !== null) {
              console.log(`Found in ${locationKey}/${systemKey}: ${value}`)
              found = true
              break
            }
          }

          if (found) break
        }

        if (!found) {
          console.log(`Metric "${metricName}" not found in sampled locations/systems`)
        }
      }
    }

    console.log("\nMetric mapping tests completed")
  } catch (error) {
    console.error("Error testing metric mappings:", error)
  }
}

// Get the specific metric from command line arguments
const specificMetric = process.argv[2]

// Run the tests
testMetricMappings(specificMetric)
  .then(() => {
    console.log("\nTest completed successfully")
    process.exit(0)
  })
  .catch((error) => {
    console.error("Test failed:", error)
    process.exit(1)
  })
