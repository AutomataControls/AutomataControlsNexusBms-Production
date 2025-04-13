// /scripts/diagnose-metric-mapping.js
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
const { 
  getFirestore, 
  collection, 
  getDocs, 
  getDoc,
  doc,
  query, 
  where, 
  limit 
} = require('firebase/firestore');
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
const firebaseApp = initializeApp(firebaseConfig);
const secondaryFirebaseApp = initializeApp(secondaryFirebaseConfig, 'secondary');
const db = getFirestore(firebaseApp);
const rtdb = getDatabase(secondaryFirebaseApp);

// Function to get metric value from RTDB data - simplified version for diagnosis
function getMetricValue(rtdbData, locationId, systemId, metricName, verbose = false) {
  if (!rtdbData) return { value: null, source: null, path: null };

  try {
    // First, find the location key that matches the locationId
    let locationKey = null;

    // Try direct match first
    if (rtdbData[locationId]) {
      locationKey = locationId;
    } else {
      // If not found directly, search through all locations
      for (const [key, value] of Object.entries(rtdbData)) {
        if (value.id === locationId) {
          locationKey = key;
          break;
        }
      }

      if (!locationKey) {
        return { value: null, source: null, path: null };
      }
    }

    if (verbose) {
      console.log(`Found location key: ${locationKey} for locationId: ${locationId}`);
    }

    // Check if location has systems
    if (!rtdbData[locationKey].systems) {
      return { value: null, source: null, path: null };
    }

    // Check if system exists
    let actualSystemId = systemId;
    if (!rtdbData[locationKey].systems[systemId]) {
      // Try to find a system with a similar name
      const systemKeys = Object.keys(rtdbData[locationKey].systems);

      if (verbose) {
        console.log(`System ${systemId} not found directly. Available systems:`, systemKeys);
      }

      // Try case-insensitive match with more flexible matching
      const systemMatch = systemKeys.find(key => {
        // Try exact match first (case insensitive)
        if (key.toLowerCase() === systemId.toLowerCase()) {
          return true;
        }

        // Try partial matches
        if (key.toLowerCase().includes(systemId.toLowerCase()) || 
            systemId.toLowerCase().includes(key.toLowerCase())) {
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
        actualSystemId = systemMatch;
        if (verbose) {
          console.log(`Found similar system: ${actualSystemId} for requested system: ${systemId}`);
        }
      } else {
        return { value: null, source: null, path: null };
      }
    }

    // Check if system has metrics
    if (!rtdbData[locationKey].systems[actualSystemId].metrics) {
      return { value: null, source: null, path: null };
    }

    // Get the metrics object
    const metrics = rtdbData[locationKey].systems[actualSystemId].metrics;
    
    if (verbose) {
      console.log(`Available metrics for ${locationKey}/${actualSystemId}:`, Object.keys(metrics));
    }

    // Try exact match first
    if (metrics[metricName] !== undefined) {
      const value = metrics[metricName];
      return { 
        value: typeof value === "number" ? value : Number.parseFloat(value), 
        source: "exact_match",
        path: `${locationKey}/systems/${actualSystemId}/metrics/${metricName}`
      };
    }

    // Try case-insensitive match
    const metricNameLower = metricName.toLowerCase();
    for (const key of Object.keys(metrics)) {
      if (key.toLowerCase() === metricNameLower) {
        const value = metrics[key];
        return { 
          value: typeof value === "number" ? value : Number.parseFloat(value), 
          source: "case_insensitive_match",
          path: `${locationKey}/systems/${actualSystemId}/metrics/${key}`
        };
      }
    }

    // Try partial match (if metric name contains the search term or vice versa)
    for (const key of Object.keys(metrics)) {
      if (key.toLowerCase().includes(metricNameLower) || metricNameLower.includes(key.toLowerCase())) {
        const value = metrics[key];
        return { 
          value: typeof value === "number" ? value : Number.parseFloat(value), 
          source: "partial_match",
          path: `${locationKey}/systems/${actualSystemId}/metrics/${key}`
        };
      }
    }

    return { value: null, source: null, path: null };
  } catch (error) {
    console.error(`Error getting metric value for ${locationId}/${systemId}/${metricName}:`, error);
    return { value: null, source: null, path: null };
  }
}

// Function to diagnose metric mapping issues
async function diagnoseMetricMapping() {
  console.log('🔍 Starting metric mapping diagnosis...');
  
  try {
    // 1. Fetch alarms from Firestore
    const alarmsRef = collection(db, 'alarms');
    const alarmsQuery = query(alarmsRef, where("active", "==", true), limit(50));
    const alarmsSnapshot = await getDocs(alarmsQuery);
    
    console.log(`📊 Found ${alarmsSnapshot.docs.length} active alarms`);
    
    // 2. Fetch RTDB data
    const locationsRef = ref(rtdb, '/locations');
    const snapshot = await get(locationsRef);
    const rtdbData = snapshot.val() || {};
    
    console.log(`📊 Found ${Object.keys(rtdbData).length} locations in RTDB`);
    
    // 3. Extract thresholds from equipment
    const thresholds = await extractThresholdsFromEquipment();
    console.log(`📊 Found ${thresholds.length} thresholds`);
    
    // 4. Analyze each alarm for metric mapping issues
    const metricMappingReport = [];
    
    for (const alarmDoc of alarmsSnapshot.docs) {
      const alarmData = alarmDoc.data();
      const alarmId = alarmDoc.id;
      
      console.log(`\n🔍 Analyzing alarm: ${alarmData.name} (ID: ${alarmId})`);
      
      // Extract metric name from alarm name
      let metricName = null;
      if (alarmData.name && alarmData.name.includes('Threshold Exceeded')) {
        metricName = alarmData.name.replace(' Threshold Exceeded', '');
        console.log(`  Extracted metric name: ${metricName}`);
      } else {
        console.log(`  Could not extract metric name from alarm: ${alarmData.name}`);
        continue;
      }
      
      // Extract value from message
      let reportedValue = null;
      let thresholdValue = null;
      if (alarmData.message) {
        const valueMatch = alarmData.message.match(/value of ([0-9.]+)/);
        const thresholdMatch = alarmData.message.match(/(below minimum|exceeds maximum) threshold of ([0-9.]+)/);
        
        if (valueMatch && valueMatch[1]) {
          reportedValue = parseFloat(valueMatch[1]);
        }
        
        if (thresholdMatch && thresholdMatch[2]) {
          thresholdValue = parseFloat(thresholdMatch[2]);
        }
      }
      
      console.log(`  Reported value: ${reportedValue}, Threshold: ${thresholdValue}`);
      
      // Get equipment data
      const equipmentId = alarmData.equipmentId;
      if (!equipmentId) {
        console.log(`  No equipment ID found for alarm`);
        continue;
      }
      
      const equipmentDoc = await getDoc(doc(db, 'equipment', equipmentId));
      if (!equipmentDoc.exists()) {
        console.log(`  Equipment ${equipmentId} not found in Firestore`);
        continue;
      }
      
      const equipmentData = equipmentDoc.data();
      const locationId = alarmData.locationId || equipmentData.locationId;
      const systemId = equipmentData.system || equipmentData.name;
      
      console.log(`  Equipment: ${equipmentData.name} (${equipmentId})`);
      console.log(`  Location: ${alarmData.locationName} (${locationId})`);
      console.log(`  System: ${systemId}`);
      
      // Find matching threshold
      const matchingThreshold = thresholds.find(t => 
        t.equipmentId === equipmentId && 
        t.metricName.toLowerCase().includes(metricName.toLowerCase())
      );
      
      if (!matchingThreshold) {
        console.log(`  No matching threshold found for this metric`);
      } else {
        console.log(`  Matching threshold: ${matchingThreshold.metricName}`);
        console.log(`  Min: ${matchingThreshold.minThreshold}, Max: ${matchingThreshold.maxThreshold}`);
      }
      
      // Try different variations of the metric name
      const metricVariations = [
        metricName,
        metricName.toLowerCase(),
        `${metricName}_value`,
        `${metricName.toLowerCase()}_value`,
        // Add more variations based on common patterns
        metricName.replace(/\s+/g, "_"),
        metricName.replace(/\s+/g, ""),
        metricName.replace(/_/g, " "),
        // Try with common prefixes/suffixes
        `${metricName} value`,
        `${metricName} reading`,
        `${metricName} sensor`,
      ];
      
      console.log(`  Trying ${metricVariations.length} metric name variations...`);
      
      const metricResults = [];
      
      for (const variation of metricVariations) {
        const result = getMetricValue(rtdbData, locationId, systemId, variation, false);
        if (result.value !== null) {
          metricResults.push({
            variation,
            ...result
          });
        }
      }
      
      // Check all available metrics for this system to find potential matches
      let locationKey = null;
      let availableMetrics = [];
      
      // Find location key
      if (rtdbData[locationId]) {
        locationKey = locationId;
      } else {
        for (const [key, value] of Object.entries(rtdbData)) {
          if (value.id === locationId) {
            locationKey = key;
            break;
          }
        }
      }
      
      // Get all available metrics
      if (locationKey) {
        const systems = rtdbData[locationKey].systems || {};
        for (const [sysKey, sysValue] of Object.entries(systems)) {
          if (sysValue.metrics) {
            for (const [metricKey, metricValue] of Object.entries(sysValue.metrics)) {
              availableMetrics.push({
                system: sysKey,
                metric: metricKey,
                value: metricValue,
                path: `${locationKey}/systems/${sysKey}/metrics/${metricKey}`
              });
            }
          }
        }
      }
      
      // Find metrics with values close to the reported value
      const valueMatches = availableMetrics.filter(m => {
        const val = typeof m.value === "number" ? m.value : parseFloat(m.value);
        return !isNaN(val) && Math.abs(val - reportedValue) < 0.1; // Within 0.1 of the reported value
      });
      
      // Create report entry
      const reportEntry = {
        alarmId,
        alarmName: alarmData.name,
        metricName,
        equipmentId,
        equipmentName: equipmentData.name,
        locationId,
        locationName: alarmData.locationName,
        systemId,
        reportedValue,
        thresholdValue,
        matchingThreshold: matchingThreshold ? {
          id: matchingThreshold.id,
          metricName: matchingThreshold.metricName,
          minThreshold: matchingThreshold.minThreshold,
          maxThreshold: matchingThreshold.maxThreshold
        } : null,
        metricResults,
        valueMatches: valueMatches.map(m => ({
          system: m.system,
          metric: m.metric,
          value: m.value,
          path: m.path
        })),
        potentialIssue: metricResults.length > 0 ? 
          (metricResults[0].source !== "exact_match" ? "Using non-exact metric match" : null) : 
          "No metric match found",
        suspectedWrongMetric: valueMatches.length > 0 && 
          !metricResults.some(r => valueMatches.some(v => v.path === r.path))
      };
      
      if (reportEntry.suspectedWrongMetric) {
        console.log(`  ⚠️ SUSPECTED WRONG METRIC MAPPING!`);
        console.log(`  Alarm reports value ${reportedValue} but this doesn't match the expected metric path`);
        console.log(`  Found ${valueMatches.length} metrics with matching values:`);
        valueMatches.forEach(m => {
          console.log(`    - ${m.path} = ${m.value}`);
        });
      } else if (metricResults.length > 0) {
        console.log(`  Found ${metricResults.length} matching metrics:`);
        metricResults.forEach(r => {
          console.log(`    - ${r.variation} => ${r.path} = ${r.value} (${r.source})`);
        });
      } else {
        console.log(`  ❌ No matching metrics found in RTDB`);
      }
      
      metricMappingReport.push(reportEntry);
    }
    
    // 5. Generate summary statistics
    const issueCount = {
      suspectedWrongMetric: 0,
      nonExactMatch: 0,
      noMatch: 0
    };
    
    metricMappingReport.forEach(entry => {
      if (entry.suspectedWrongMetric) {
        issueCount.suspectedWrongMetric++;
      } else if (entry.potentialIssue === "Using non-exact metric match") {
        issueCount.nonExactMatch++;
      } else if (entry.potentialIssue === "No metric match found") {
        issueCount.noMatch++;
      }
    });
    
    // 6. Output the report
    console.log('\n📋 METRIC MAPPING DIAGNOSIS SUMMARY');
    console.log(`Total alarms analyzed: ${metricMappingReport.length}`);
    console.log(`Suspected wrong metric mappings: ${issueCount.suspectedWrongMetric}`);
    console.log(`Non-exact metric matches: ${issueCount.nonExactMatch}`);
    console.log(`No metric matches found: ${issueCount.noMatch}`);
    
    // 7. Output detailed report for alarms with suspected wrong metrics
    console.log('\n🔍 DETAILED DIAGNOSIS (alarms with suspected wrong metrics):');
    const suspectedWrongMetricReport = metricMappingReport.filter(entry => entry.suspectedWrongMetric);
    
    suspectedWrongMetricReport.forEach((entry, index) => {
      console.log(`\n--- ALARM ${index + 1}: ${entry.alarmName} (ID: ${entry.alarmId}) ---`);
      console.log(`Equipment: ${entry.equipmentName} (${entry.equipmentId})`);
      console.log(`Location: ${entry.locationName} (${entry.locationId})`);
      console.log(`Reported value: ${entry.reportedValue}`);
      
      if (entry.metricResults.length > 0) {
        console.log(`Current metric mapping:`);
        entry.metricResults.forEach(r => {
          console.log(`  - ${r.variation} => ${r.path} = ${r.value} (${r.source})`);
        });
      } else {
        console.log(`No current metric mapping found`);
      }
      
      console.log(`Metrics with matching values (likely correct mappings):`);
      entry.valueMatches.forEach(m => {
        console.log(`  - ${m.path} = ${m.value}`);
      });
    });
    
    // 8. Save full report to file
    const reportPath = path.join(__dirname, 'metric-mapping-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(metricMappingReport, null, 2));
    
    console.log(`\n✅ Full metric mapping report saved to: ${reportPath}`);
    
    // 9. Generate recommendations
    console.log('\n🔧 RECOMMENDATIONS:');
    
    if (issueCount.suspectedWrongMetric > 0) {
      console.log('- Update the metric mapping logic in monitoring-service.js to be more strict about matches');
      console.log('- Consider creating explicit metric mappings for each equipment type');
    }
    
    if (issueCount.nonExactMatch > 0) {
      console.log('- Review non-exact matches to ensure they are correct');
    }
    
    if (issueCount.noMatch > 0) {
      console.log('- Add missing metrics to RTDB or update threshold configurations');
    }
    
  } catch (error) {
    console.error('❌ Error during metric mapping diagnosis:', error);
  }
}

// Function to extract thresholds from equipment documents
async function extractThresholdsFromEquipment() {
  try {
    const equipmentSnapshot = await getDocs(collection(db, 'equipment'));
    const thresholds = [];

    for (const docSnapshot of equipmentSnapshot.docs) {
      const equipmentData = docSnapshot.data();
      const equipmentId = docSnapshot.id;
      const locationId = equipmentData.locationId || "";
      const systemId = equipmentData.system || equipmentData.name || "";

      // Skip if no thresholds defined
      if (!equipmentData.thresholds) {
        continue;
      }

      // Process thresholds based on their structure
      const processNestedThresholds = (parentPath, thresholdObj, parentName) => {
        // Check if this object has min/max properties directly
        if (thresholdObj.min !== undefined || thresholdObj.max !== undefined) {
          thresholds.push({
            id: `${equipmentId}-${parentPath.replace(/\//g, "-")}`,
            equipmentId,
            metricPath: parentPath,
            metricName: parentName || "Default",
            minThreshold: thresholdObj.min,
            maxThreshold: thresholdObj.max,
            enabled: true,
            locationId,
            systemId,
          });
          return;
        }

        // Otherwise, iterate through properties looking for nested objects
        Object.entries(thresholdObj).forEach(([key, value]) => {
          if (typeof value === "object" && value !== null) {
            const newPath = parentPath ? `${parentPath}/${key}` : key;
            const newName = parentName ? `${parentName} ${key}` : key;
            processNestedThresholds(newPath, value, newName);
          }
        });
      };

      // Start processing from the root thresholds object
      processNestedThresholds("", equipmentData.thresholds, "");
    }

    return thresholds;
  } catch (error) {
    console.error("Error extracting thresholds from equipment:", error);
    return [];
  }
}

// Run the diagnosis
diagnoseMetricMapping()
  .then(() => {
    console.log('Metric mapping diagnosis complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
