/**
 * Script to update the monitoring service with the new metric mappings
 * This script will modify the monitorEquipmentMetrics function to use
 * the new metric mappings for more reliable metric lookups
 *
 * Usage: node update-monitoring-service.js
 */

const fs = require("fs")
const path = require("path")

// Path to the metric mappings file
const mappingsPath = path.join(__dirname, "metric-mappings.js")

// Check if the mappings file exists
if (!fs.existsSync(mappingsPath)) {
  console.error("Metric mappings file not found. Please run generate-metric-mappings.js first.")
  process.exit(1)
}

// Path to the monitoring service file
const monitoringServicePath = path.join(__dirname, "start-monitoring.js")

// Check if the monitoring service file exists
if (!fs.existsSync(monitoringServicePath)) {
  console.error("Monitoring service file not found. Please specify the correct path.")
  process.exit(1)
}

// Load the monitoring service file
let monitoringServiceContent = fs.readFileSync(monitoringServicePath, "utf8")

// Import the metric mappings
const { getMetricValue } = require("./metric-mappings")

// Function to update the monitoring service
function updateMonitoringService() {
  console.log("Updating monitoring service...")

  // Add the import for metric mappings
  if (!monitoringServiceContent.includes("require('./metric-mappings')")) {
    // Find the last require statement
    const lastRequireIndex = monitoringServiceContent.lastIndexOf("require(")
    if (lastRequireIndex !== -1) {
      // Find the end of the line
      const endOfLine = monitoringServiceContent.indexOf("\n", lastRequireIndex)
      if (endOfLine !== -1) {
        // Insert the new require statement after the last one
        monitoringServiceContent =
          monitoringServiceContent.slice(0, endOfLine + 1) +
          "const { getMetricValue, getMetricType } = require('./metric-mappings');\n" +
          monitoringServiceContent.slice(endOfLine + 1)

        console.log("Added import for metric mappings")
      }
    }
  }

  // Replace the getMetricValue function
  const getMetricValueRegex = /function\s+getMetricValue\s*$$[^)]*$$\s*\{[\s\S]*?\}/
  if (monitoringServiceContent.match(getMetricValueRegex)) {
    // Replace the function with a call to the imported function
    monitoringServiceContent = monitoringServiceContent.replace(
      getMetricValueRegex,
      `function getMetricValue(locationId, systemId, metricName) {
  // Use the imported function from metric-mappings.js
  return require('./metric-mappings').getMetricValue(locationId, systemId, metricName, rtdbData);
}`,
    )

    console.log("Updated getMetricValue function")
  } else {
    console.log("Could not find getMetricValue function to replace")
  }

  // Save the updated file
  const backupPath = monitoringServicePath + ".bak"
  fs.writeFileSync(backupPath, monitoringServiceContent)
  console.log(`Backup of original file saved to: ${backupPath}`)

  fs.writeFileSync(monitoringServicePath, monitoringServiceContent)
  console.log(`Updated monitoring service saved to: ${monitoringServicePath}`)
}

// Run the update
updateMonitoringService()

console.log("\n=== MONITORING SERVICE UPDATE COMPLETE ===")
console.log("The monitoring service has been updated to use the new metric mappings.")
console.log("This should improve the reliability of metric lookups and reduce false alarms.")
console.log("\nIf you encounter any issues, a backup of the original file has been created.")
console.log("You can restore it by renaming the .bak file.")
