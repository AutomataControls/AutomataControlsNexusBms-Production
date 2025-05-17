// Test script to verify system names in RTDB
require("dotenv").config()
const path = require("path")
// Also try to load from .env.local if it exists
try {
  require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") })
} catch (error) {
  console.log("No .env.local file found, using .env")
}

const { initializeApp } = require("firebase/app")
const { getFirestore, collection, getDocs } = require("firebase/firestore")
const { getDatabase, ref, get } = require("firebase/database")

// Parse command line arguments
const args = process.argv.slice(2)
const verbose = args.includes("--verbose")
const showMissing = args.includes("--show-missing")
const locationFilter = args.find(arg => arg.startsWith("--location="))?.split("=")[1]

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
const firebaseApp = initializeApp(firebaseConfig)
const secondaryFirebaseApp = initializeApp(secondaryFirebaseConfig, "secondary")
const db = getFirestore(firebaseApp)
const rtdb = getDatabase(secondaryFirebaseApp)

/**
 * Find a system in available systems
 */
function findSystemMatch(systemId, availableSystems) {
  // 1. Check if system exists directly in available systems
  if (availableSystems.includes(systemId)) {
    if (verbose) console.log(`✅ Direct match found for system: ${systemId}`)
    return { found: true, matchType: 'direct', match: systemId }
  }

  // 2. Try case-insensitive match
  const systemIdLower = systemId.toLowerCase()
  for (const availableSystem of availableSystems) {
    if (availableSystem.toLowerCase() === systemIdLower) {
      if (verbose) console.log(`✅ Found case-insensitive match: ${availableSystem}`)
      return { found: true, matchType: 'case-insensitive', match: availableSystem }
    }
  }

  // 3. Try partial match
  for (const availableSystem of availableSystems) {
    if (
      availableSystem.toLowerCase().includes(systemIdLower) ||
      systemIdLower.includes(availableSystem.toLowerCase())
    ) {
      if (verbose) console.log(`✅ Found partial match: ${availableSystem}`)
      return { found: true, matchType: 'partial', match: availableSystem }
    }
  }

  // 4. Try matching by type (Boiler, AHU, etc.)
  const commonTypes = ["boiler", "ahu", "chiller", "pump", "fan", "vav", "rtu", "fcu", "doas", "mua"]
  for (const type of commonTypes) {
    if (systemIdLower.includes(type)) {
      for (const availableSystem of availableSystems) {
        if (availableSystem.toLowerCase().includes(type)) {
          if (verbose) console.log(`✅ Found type match (${type}): ${availableSystem}`)
          return { found: true, matchType: 'type', match: availableSystem }
        }
      }
    }
  }

  // 5. Generic fallbacks for specific locations with generic systems
  if (
    availableSystems.includes("Boiler") ||
    availableSystems.includes("Fan Coil") ||
    availableSystems.includes("Pump")
  ) {
    if (systemIdLower.includes("boiler") && availableSystems.includes("Boiler")) {
      if (verbose) console.log(`✅ Generic fallback to: Boiler`)
      return { found: true, matchType: 'generic_fallback', match: "Boiler" }
    }
    else if (
      (systemIdLower.includes("coil") ||
       systemIdLower.includes("fcu") ||
       systemIdLower.includes("ahu") ||
       systemIdLower.includes("handler")) &&
      availableSystems.includes("Fan Coil")
    ) {
      if (verbose) console.log(`✅ Generic fallback to: Fan Coil`)
      return { found: true, matchType: 'generic_fallback', match: "Fan Coil" }
    }
    else if (
      (systemIdLower.includes("pump") ||
       systemIdLower.includes("cwp") ||
       systemIdLower.includes("hwp")) &&
      availableSystems.includes("Pump")
    ) {
      if (verbose) console.log(`✅ Generic fallback to: Pump`)
      return { found: true, matchType: 'generic_fallback', match: "Pump" }
    }
  }

  // Nothing found
  if (verbose) console.log(`❌ No match found for system: ${systemId}`)
  return { found: false, matchType: 'not_found', match: null }
}

// Function to test system name mappings
async function testSystemNameMappings() {
  try {
    console.log("=== Testing System Name Matching ===\n")

    // Fetch all locations from RTDB
    console.log("Fetching all locations from RTDB...")
    const locationsRef = ref(rtdb, "/locations")
    const snapshot = await get(locationsRef)
    const rtdbData = snapshot.val() || {}
    console.log(`Found ${Object.keys(rtdbData).length} locations in RTDB\n`)

    // Fetch all equipment from Firestore
    console.log("Fetching all equipment from Firestore...")
    const equipmentCollection = collection(db, "equipment")
    const equipmentSnapshot = await getDocs(equipmentCollection)
    
    const equipmentList = []
    equipmentSnapshot.forEach(doc => {
      equipmentList.push({
        id: doc.id,
        ...doc.data()
      })
    })
    console.log(`Found ${equipmentList.length} equipment items in Firestore\n`)

    // Create ID to name mapping
    const idToNameMap = {}
    for (const [key, value] of Object.entries(rtdbData)) {
      if (value.id) {
        idToNameMap[value.id] = key
      }
    }

    // Track statistics
    let totalSystems = 0
    let matchedSystems = 0
    const matchTypes = {}

    // Filter locations if specified
    const locationsToProcess = locationFilter ? 
      (locationFilter in rtdbData ? [locationFilter] : 
       Object.entries(rtdbData).filter(([_, val]) => val.id === locationFilter).map(([key]) => key)) :
      Object.keys(rtdbData)

    if (locationsToProcess.length === 0) {
      console.log(`⚠️ No locations found matching filter: ${locationFilter}`)
    }

    // Process each location
    console.log("System Name Matching By Location:")
    console.log("================================")
    
    for (const locationKey of locationsToProcess) {
      const locationData = rtdbData[locationKey]
      
      console.log(`\nProcessing location: ${locationKey}${locationData.name ? ` (${locationData.name})` : ''}`)
      
      // Skip if location has no systems
      if (!locationData.systems) {
        console.log(`⚠️ Location ${locationKey} has no systems data`)
        continue
      }
      
      const availableSystems = Object.keys(locationData.systems)
      console.log(`Available systems: ${availableSystems.join(', ')}`)
      
      // Get equipment for this location - try both key and id
      const locationEquipment = equipmentList.filter(
        eq => eq.locationId === locationKey || 
              (locationData.id && eq.locationId === locationData.id)
      )
      
      console.log(`Found ${locationEquipment.length} equipment items for this location`)
      
      if (locationEquipment.length === 0 && showMissing) {
        console.log(`⚠️ No equipment found for location ${locationKey}`)
        continue
      }
      
      // Test each equipment's system mapping
      for (const equipment of locationEquipment) {
        const systemId = equipment.system || equipment.name
        if (!systemId) {
          if (verbose) console.log(`⚠️ Equipment ${equipment.id} has no system or name field`)
          continue
        }
        
        totalSystems++
        console.log(`\nTesting system: ${systemId} (Equipment ID: ${equipment.id})`)
        
        // Try to find a match
        const result = findSystemMatch(systemId, availableSystems)
        matchTypes[result.matchType] = (matchTypes[result.matchType] || 0) + 1
        
        if (result.found) {
          matchedSystems++
          console.log(`✅ ${result.matchType.toUpperCase()}: "${systemId}" -> "${result.match}"`)
        } else {
          console.log(`❌ NOT FOUND: "${systemId}" in available systems`)
          if (verbose) {
            console.log(`  Available systems: ${availableSystems.join(', ')}`)
          }
        }
      }
    }
    
    // Print summary
    console.log("\n=== System Matching Summary ===")
    console.log(`Total systems tested: ${totalSystems}`)
    console.log(`Successfully matched: ${matchedSystems} (${(matchedSystems/totalSystems*100).toFixed(1)}%)`)
    console.log("Match types:")
    for (const [type, count] of Object.entries(matchTypes)) {
      console.log(`  - ${type.replace('_', ' ')} matches: ${count}`)
    }
    
    // Test specific problematic systems
    console.log("\nTesting Known Problematic Systems:")
    console.log("=================================")
    
    const testCases = [
      { locationId: "4", systemId: "ComfortBoiler-1" },
      { locationId: "4", systemId: "DomesticBoiler-2" },
      { locationId: "4", systemId: "FanCoil3" },
      { locationId: "1", systemId: "AHU-2" },
      { locationId: "1", systemId: "SteamBundle" },
      { locationId: "9", systemId: "Chiller-1" },
      // Add name-based lookups too
      { locationId: "HeritageHuntington", systemId: "ComfortBoiler-1" },
      { locationId: "HeritageWarren", systemId: "AHU-2" },
      { locationId: "FirstChurchOfGod", systemId: "Chiller-1" }
    ]
    
    for (const test of testCases) {
      console.log(`\nTesting: ${test.systemId} in location: ${test.locationId}`)
      
      // Find the location data - either by key or by id
      let locationData
      let locationKey
      
      if (rtdbData[test.locationId]) {
        locationData = rtdbData[test.locationId]
        locationKey = test.locationId
      } else {
        // Look for location by name matching
        for (const [key, value] of Object.entries(rtdbData)) {
          if (key === test.locationId || value.id === test.locationId) {
            locationData = value
            locationKey = key
            break
          }
        }
      }
      
      if (!locationData) {
        console.log(`❌ Location ${test.locationId} not found in RTDB`)
        continue
      }
      
      if (!locationData.systems) {
        console.log(`❌ Location ${locationKey} has no systems data`)
        continue
      }
      
      const availableSystems = Object.keys(locationData.systems)
      console.log(`Available systems at ${locationKey}: ${availableSystems.join(', ')}`)
      
      // Try to find a match
      const result = findSystemMatch(test.systemId, availableSystems)
      
      if (result.found) {
        console.log(`✅ ${result.matchType.toUpperCase()}: "${test.systemId}" -> "${result.match}"`)
      } else {
        console.log(`❌ NOT FOUND: "${test.systemId}" in available systems`)
      }
    }
    
    console.log("\nTesting complete!")
    
  } catch (error) {
    console.error("Error testing system name mappings:", error)
  }
}

// Run the test
testSystemNameMappings()
  .then(() => {
    process.exit(0)
  })
  .catch(error => {
    console.error("Script failed:", error)
    process.exit(1)
  })
