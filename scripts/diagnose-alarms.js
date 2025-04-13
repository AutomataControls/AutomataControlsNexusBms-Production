// /scripts/diagnose-alarms.js
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
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp 
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

// Function to fetch and diagnose alarms
async function diagnoseAlarms() {
  console.log('🔍 Starting alarm diagnosis...');
  
  try {
    // 1. Fetch alarms from Firestore
    const alarmsRef = collection(db, 'alarms');
    const alarmsQuery = query(alarmsRef, orderBy('timestamp', 'desc'), limit(50));
    const alarmsSnapshot = await getDocs(alarmsQuery);
    
    console.log(`📊 Found ${alarmsSnapshot.docs.length} alarms`);
    
    // 2. Fetch RTDB data for reference
    const locationsRef = ref(rtdb, '/locations');
    const snapshot = await get(locationsRef);
    const rtdbData = snapshot.val() || {};
    
    console.log(`📊 Found ${Object.keys(rtdbData).length} locations in RTDB`);
    
    // 3. Create a mapping diagnostic report
    const diagnosticReport = [];
    
    for (const doc of alarmsSnapshot.docs) {
      const rawData = doc.data();
      
      // Create a diagnostic entry
      const diagnosticEntry = {
        id: doc.id,
        rawData: { ...rawData },
        transformedData: {
          id: doc.id,
          name: rawData.name || 'Unknown Alarm',
          equipmentId: rawData.equipmentId || 'Unknown',
          locationId: rawData.locationId || 'Unknown',
          locationName: rawData.locationName || 'Unknown Location',
          equipmentName: rawData.equipmentName || 'Unknown Equipment',
          severity: rawData.severity || 'info',
          message: rawData.message || '',
          active: rawData.active !== undefined ? rawData.active : true,
          acknowledged: rawData.acknowledged || false,
          resolved: rawData.resolved || false,
          timestamp: rawData.timestamp instanceof Timestamp 
            ? rawData.timestamp.toDate() 
            : new Date(rawData.timestamp || Date.now()),
          acknowledgedTimestamp: rawData.acknowledgedTimestamp instanceof Timestamp
            ? rawData.acknowledgedTimestamp.toDate()
            : rawData.acknowledgedTimestamp
              ? new Date(rawData.acknowledgedTimestamp)
              : undefined,
          resolvedTimestamp: rawData.resolvedTimestamp instanceof Timestamp
            ? rawData.resolvedTimestamp.toDate()
            : rawData.resolvedTimestamp
              ? new Date(rawData.resolvedTimestamp)
              : undefined,
        },
        issues: []
      };
      
      // Check for potential mapping issues
      if (!rawData.name) diagnosticEntry.issues.push('Missing alarm name');
      if (!rawData.equipmentId) diagnosticEntry.issues.push('Missing equipment ID');
      if (!rawData.locationId) diagnosticEntry.issues.push('Missing location ID');
      if (!rawData.locationName) diagnosticEntry.issues.push('Missing location name');
      if (!rawData.equipmentName) diagnosticEntry.issues.push('Missing equipment name');
      
      // Check if location exists in RTDB
      if (rawData.locationId) {
        let locationFound = false;
        
        // Check direct match
        if (rtdbData[rawData.locationId]) {
          locationFound = true;
          diagnosticEntry.rtdbLocationKey = rawData.locationId;
          diagnosticEntry.rtdbLocationName = rtdbData[rawData.locationId].name || 'No name in RTDB';
        } else {
          // Check by ID field
          for (const [key, value] of Object.entries(rtdbData)) {
            if (value.id === rawData.locationId) {
              locationFound = true;
              diagnosticEntry.rtdbLocationKey = key;
              diagnosticEntry.rtdbLocationName = value.name || 'No name in RTDB';
              break;
            }
          }
        }
        
        if (!locationFound) {
          diagnosticEntry.issues.push('Location ID not found in RTDB');
        } else if (!rawData.locationName || rawData.locationName === 'Unknown Location') {
          diagnosticEntry.issues.push('Location name missing but found in RTDB');
        }
      }
      
      diagnosticReport.push(diagnosticEntry);
    }
    
    // 4. Generate summary statistics
    const issueTypes = {};
    let alarmsWithIssues = 0;
    
    diagnosticReport.forEach(entry => {
      if (entry.issues.length > 0) {
        alarmsWithIssues++;
        entry.issues.forEach(issue => {
          issueTypes[issue] = (issueTypes[issue] || 0) + 1;
        });
      }
    });
    
    // 5. Output the report
    console.log('\n📋 ALARM MAPPING DIAGNOSIS SUMMARY');
    console.log(`Total alarms analyzed: ${diagnosticReport.length}`);
    console.log(`Alarms with issues: ${alarmsWithIssues} (${Math.round(alarmsWithIssues/diagnosticReport.length*100)}%)`);
    
    console.log('\n🚨 ISSUE TYPES:');
    Object.entries(issueTypes)
      .sort((a, b) => b[1] - a[1])
      .forEach(([issue, count]) => {
        console.log(`- ${issue}: ${count} occurrences (${Math.round(count/diagnosticReport.length*100)}%)`);
      });
    
    // 6. Output detailed report for alarms with issues
    console.log('\n🔍 DETAILED DIAGNOSIS (first 10 alarms with issues):');
    const alarmsWithIssuesReport = diagnosticReport.filter(entry => entry.issues.length > 0).slice(0, 10);
    
    alarmsWithIssuesReport.forEach((entry, index) => {
      console.log(`\n--- ALARM ${index + 1} (ID: ${entry.id}) ---`);
      console.log('Issues:', entry.issues);
      console.log('Raw Data:', JSON.stringify({
        name: entry.rawData.name,
        equipmentId: entry.rawData.equipmentId,
        locationId: entry.rawData.locationId,
        locationName: entry.rawData.locationName,
        equipmentName: entry.rawData.equipmentName,
        severity: entry.rawData.severity,
        timestamp: entry.rawData.timestamp instanceof Timestamp 
          ? entry.rawData.timestamp.toDate().toISOString()
          : entry.rawData.timestamp
      }, null, 2));
      
      if (entry.rtdbLocationKey) {
        console.log('RTDB Location Match:', {
          key: entry.rtdbLocationKey,
          name: entry.rtdbLocationName
        });
      }
    });
    
    // 7. Save full report to file
    const reportPath = path.join(__dirname, 'alarm-diagnosis-report.json');
    fs.writeFileSync(
      reportPath, 
      JSON.stringify(diagnosticReport, (key, value) => {
        // Convert timestamps to ISO strings for readability
        if (value instanceof Timestamp) return value.toDate().toISOString();
        if (value instanceof Date) return value.toISOString();
        return value;
      }, 2)
    );
    
    console.log(`\n✅ Full diagnostic report saved to: ${reportPath}`);
    console.log('\n🔧 RECOMMENDATIONS:');
    
    // Generate recommendations based on issues
    if (issueTypes['Missing location name'] || issueTypes['Location name missing but found in RTDB']) {
      console.log('- Run a location name update script to populate missing location names from RTDB');
    }
    
    if (issueTypes['Missing equipment name']) {
      console.log('- Run an equipment name update script to populate missing equipment names');
    }
    
    if (issueTypes['Location ID not found in RTDB']) {
      console.log('- Check for mismatched location IDs between Firestore and RTDB');
    }
    
  } catch (error) {
    console.error('❌ Error during alarm diagnosis:', error);
  }
}

// Run the diagnosis
diagnoseAlarms()
  .then(() => {
    console.log('Diagnosis complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
