// Test script to verify location name resolution
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

// Function to test location name resolution
async function testLocationNameResolution(locationId) {
  console.log(`Testing location name resolution for ID: ${locationId}`)

  let locationName = null

  try {
    // First try direct lookup in Firestore
    console.log("Trying direct document lookup...")
    const locationDocRef = doc(db, "locations", locationId)
    const locationDocSnap = await getDoc(locationDocRef)

    if (locationDocSnap.exists()) {
      console.log("Document exists:", locationDocSnap.data())
      if (locationDocSnap.data().name) {
        locationName = locationDocSnap.data().name
        console.log(`Found location name via direct lookup: ${locationName}`)
      } else {
        console.log("Document exists but has no name field")
      }
    } else {
      console.log("Document does not exist")
    }

    // Try query by ID field
    console.log("Trying query by ID field...")
    const locationQuery = query(collection(db, "locations"), where("id", "==", locationId), limit(1))
    const locationSnapshot = await getDocs(locationQuery)

    if (!locationSnapshot.empty) {
      console.log("Query returned results:", locationSnapshot.docs[0].data())
      if (locationSnapshot.docs[0].data().name) {
        locationName = locationSnapshot.docs[0].data().name
        console.log(`Found location name via query: ${locationName}`)
      } else {
        console.log("Query result has no name field")
      }
    } else {
      console.log("Query returned no results")
    }

    // Try RTDB lookup
    console.log("Trying RTDB lookup...")
    const locationsRef = ref(rtdb, "/locations")
    const snapshot = await get(locationsRef)
    const rtdbData = snapshot.val() || {}

    if (rtdbData[locationId]) {
      console.log("Found direct match in RTDB:", rtdbData[locationId])
      if (rtdbData[locationId].name) {
        locationName = rtdbData[locationId].name
        console.log(`Found location name in RTDB direct: ${locationName}`)
      } else {
        console.log("RTDB entry has no name field")
      }
    } else {
      console.log("No direct match in RTDB, searching...")
      // Search through RTDB
      for (const [key, value] of Object.entries(rtdbData)) {
        console.log(`Checking RTDB entry: ${key}`)
        if (value.id === locationId) {
          console.log(`Found match by ID in RTDB: ${key}`, value)
          if (value.name) {
            locationName = value.name
            console.log(`Found location name in RTDB search: ${locationName}`)
            break
          } else {
            console.log("Matching RTDB entry has no name field")
          }
        }
      }
    }

    console.log("\nFinal result:")
    if (locationName) {
      console.log(`✅ Successfully resolved location name: "${locationName}" for ID: "${locationId}"`)
    } else {
      console.log(`❌ Failed to resolve location name for ID: "${locationId}"`)
    }
  } catch (error) {
    console.error(`Error resolving location name for ${locationId}:`, error)
  }
}

// Test with the location ID from the command line or use a default
const testLocationId = process.argv[2] || "FirstChurchOfGod"
testLocationNameResolution(testLocationId)
  .then(() => {
    console.log("Test completed")
    process.exit(0)
  })
  .catch((error) => {
    console.error("Test failed:", error)
    process.exit(1)
  })
