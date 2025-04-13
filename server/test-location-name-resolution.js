// Script to test location name resolution for emails
require("dotenv").config()
const path = require("path")

// Also try to load from .env.local if it exists
try {
  require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") })
} catch (error) {
  console.log("No .env.local file found, using .env")
}

const { initializeApp } = require("firebase/app")
const { getDatabase, ref, get } = require("firebase/database")
const { getFirestore, collection, query, where, getDocs, limit, doc, getDoc } = require("firebase/firestore")

// Initialize Firebase configs
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)
const rtdb = getDatabase(app)
const db = getFirestore(app)

// Function to get location name from ID - IMPROVED VERSION
async function getLocationNameFromId(locationId) {
  try {
    console.log(`Looking up location name for ID: ${locationId}`)

    // STEP 1: First check if the locationId is directly a location key in RTDB
    console.log(`Checking if ${locationId} is a direct key in RTDB...`)
    const directLocationRef = ref(rtdb, `/locations/${locationId}`)
    const directSnapshot = await get(directLocationRef)

    if (directSnapshot.exists()) {
      const locationData = directSnapshot.val()
      if (locationData.name) {
        console.log(`Found location directly in RTDB with name: ${locationData.name}`)
        return locationData.name
      } else {
        console.log(`Found location directly in RTDB but it has no name, using key: ${locationId}`)
        return locationId // Use the key itself as the name
      }
    }

    // STEP 2: Check all locations in RTDB for a matching ID field
    console.log(`Checking all locations in RTDB for ID: ${locationId}`)
    const locationsRef = ref(rtdb, "/locations")
    const snapshot = await get(locationsRef)
    const locations = snapshot.val() || {}

    for (const [key, value] of Object.entries(locations)) {
      if (value.id === locationId) {
        console.log(`Found location with matching ID field in RTDB: ${key}`)
        // If the location has a name field, use that
        if (value.name) {
          console.log(`Using name from RTDB: ${value.name}`)
          return value.name
        }
        // Otherwise use the key as the name
        console.log(`No name field, using key as name: ${key}`)
        return key
      }
    }

    // STEP 3: Try Firestore - query by ID field
    console.log(`Checking Firestore for location with ID: ${locationId}`)
    const locationQuery = query(collection(db, "locations"), where("id", "==", locationId), limit(1))

    const querySnapshot = await getDocs(locationQuery)

    if (!querySnapshot.empty) {
      const locationDoc = querySnapshot.docs[0]
      const locationData = locationDoc.data()

      if (locationData.name) {
        console.log(`Found location in Firestore with name: ${locationData.name}`)
        return locationData.name
      } else {
        console.log(`Found location in Firestore but no name field, using document ID: ${locationDoc.id}`)
        return locationDoc.id
      }
    }

    // STEP 4: Last resort - check if the ID is a document ID in Firestore
    console.log(`Checking if ${locationId} is a document ID in Firestore...`)
    try {
      const locationDoc = await getDoc(doc(db, "locations", locationId))
      if (locationDoc.exists()) {
        const data = locationDoc.data()
        if (data.name) {
          console.log(`Found location document with matching ID and name: ${data.name}`)
          return data.name
        } else {
          console.log(`Found location document with matching ID but no name, using ID: ${locationId}`)
          return locationId
        }
      }
    } catch (error) {
      console.error("Error checking Firestore document:", error)
    }

    console.log(`No location found for ID: ${locationId} after exhaustive search`)
    return null
  } catch (error) {
    console.error("Error getting location name:", error)
    return null
  }
}

// Function to test location name resolution for all locations
async function testAllLocationNameResolution() {
  try {
    console.log("=== Testing Location Name Resolution ===\n")

    // Get all locations from RTDB
    const locationsRef = ref(rtdb, "/locations")
    const snapshot = await get(locationsRef)
    const locations = snapshot.val() || {}

    console.log(`Found ${Object.keys(locations).length} locations in RTDB\n`)

    // Test each location
    for (const [key, value] of Object.entries(locations)) {
      console.log(`\n--- Testing location: ${key} ---`)

      // Test using the key
      console.log(`\nTesting with key: ${key}`)
      const nameFromKey = await getLocationNameFromId(key)
      console.log(`Result: ${nameFromKey || "Not found"}`)

      // Test using the ID field if it exists
      if (value.id) {
        console.log(`\nTesting with ID field: ${value.id}`)
        const nameFromId = await getLocationNameFromId(value.id)
        console.log(`Result: ${nameFromId || "Not found"}`)
      }
    }

    // Also test with some specific IDs that might be problematic
    const testIds = ["FirstChurchOfGod", "NERealtyGroup", "123456", "location-1"]

    console.log("\n--- Testing specific IDs ---")
    for (const id of testIds) {
      console.log(`\nTesting ID: ${id}`)
      const name = await getLocationNameFromId(id)
      console.log(`Result: ${name || "Not found"}`)
    }

    console.log("\n=== Testing Complete ===")
  } catch (error) {
    console.error("Error testing location name resolution:", error)
  }
}

// Run the test
testAllLocationNameResolution()
  .then(() => {
    console.log("Test completed")
    process.exit(0)
  })
  .catch((error) => {
    console.error("Test failed:", error)
    process.exit(1)
  })
