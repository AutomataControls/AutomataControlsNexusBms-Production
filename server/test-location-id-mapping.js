// Test script to verify location ID to name mapping
require("dotenv").config()
const path = require("path")

// Also try to load from .env.local if it exists
try {
  require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") })
} catch (error) {
  console.log("No .env.local file found, using .env")
}

const { initializeApp } = require("firebase/app")
const { getFirestore, collection, doc, getDoc, getDocs, query, where, limit } = require("firebase/firestore")
const { getDatabase, ref, get } = require("firebase/database")

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

// Function to map all location IDs to names
async function mapAllLocationIds() {
  try {
    console.log("Fetching all locations from RTDB...")
    const locationsRef = ref(rtdb, "/locations")
    const snapshot = await get(locationsRef)
    const rtdbData = snapshot.val() || {}

    console.log(`Found ${Object.keys(rtdbData).length} locations in RTDB`)
    console.log("\nLocation ID to Name Mapping:")
    console.log("============================")

    // Create a mapping of all IDs to location names (keys)
    const idToNameMap = {}

    for (const [key, value] of Object.entries(rtdbData)) {
      if (value.id) {
        idToNameMap[value.id] = key
        console.log(`ID: "${value.id}" -> Name: "${key}"`)
      } else {
        console.log(`Location "${key}" has no ID field`)
      }
    }

    console.log("\nTesting lookup by ID:")
    console.log("====================")

    // Test looking up each ID
    for (const [id, name] of Object.entries(idToNameMap)) {
      console.log(`Looking up ID: "${id}"`)

      // Try to find in RTDB
      let found = false
      for (const [key, value] of Object.entries(rtdbData)) {
        if (value.id === id) {
          console.log(`✅ Found in RTDB: ID "${id}" -> Name "${key}"`)
          found = true
          break
        }
      }

      if (!found) {
        console.log(`❌ Could not find location with ID "${id}" in RTDB`)
      }
    }

    return idToNameMap
  } catch (error) {
    console.error("Error mapping location IDs:", error)
    return {}
  }
}

// Run the mapping function
mapAllLocationIds()
  .then((mapping) => {
    console.log("\nMapping complete!")
    console.log(`Found ${Object.keys(mapping).length} location ID mappings`)
    process.exit(0)
  })
  .catch((error) => {
    console.error("Script failed:", error)
    process.exit(1)
  })
