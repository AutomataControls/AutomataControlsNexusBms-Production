// /server/monitoring-service.js
// Load environment variables from .env file
require("dotenv").config()
const path = require("path")

// Also try to load from .env.local if it exists
try {
  require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") })
} catch (error) {
  console.log("No .env.local file found, using .env")
}

// Import Firebase modules
const { getFirestore, collection, doc, getDoc, getDocs, addDoc, query, where, limit } = require("firebase/firestore")
const { getDatabase, ref, onValue, get } = require("firebase/database")
const fetch = require("node-fetch")
// Import the metric mappings
const { getMetricValue, getMetricType } = require("./metric-mappings")

console.log("🔄 Initializing monitoring service...")

// Debug environment variables
console.log("Checking environment variables:")
console.log("- NEXT_PUBLIC_FIREBASE_DATABASE_URL:", process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ? "Set" : "Not set")
console.log("- NEXT_PUBLIC_FIREBASE_PROJECT_ID:", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? "Set" : "Not set")

// Use existing Firebase instances if they exist, otherwise initialize them
let db, rtdb

// Function to initialize Firebase if not already initialized
function initializeFirebase() {
  // Check if Firebase is already initialized
  if (global.firebaseApp && global.secondaryFirebaseApp) {
    console.log("Using existing Firebase instances")
    db = getFirestore(global.firebaseApp)
    rtdb = getDatabase(global.secondaryFirebaseApp)
    return
  }

  // Import Firebase app initialization only if needed
  const { initializeApp } = require("firebase/app")

  // Initialize primary Firebase (for Firestore)
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
  // IMPORTANT: We need to hardcode the databaseURL if the environment variable is not available
  const databaseURL =
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ||
    `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`

  console.log("Using database URL:", databaseURL)

  const secondaryFirebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    databaseURL: databaseURL, // Explicitly set the database URL
  }

  try {
    // Initialize primary Firebase app
    global.firebaseApp = initializeApp(firebaseConfig)
    // Get Firestore instance using the modular API
    db = getFirestore(global.firebaseApp)
    console.log("✅ Primary Firebase initialized successfully")

    // Initialize secondary Firebase app for RTDB
    global.secondaryFirebaseApp = initializeApp(secondaryFirebaseConfig, "secondary")
    console.log("Secondary Firebase app initialized with config:", {
      projectId: secondaryFirebaseConfig.projectId,
      databaseURL: secondaryFirebaseConfig.databaseURL,
    })

    // Get RTDB instance using the modular API
    rtdb = getDatabase(global.secondaryFirebaseApp)
    console.log("✅ Secondary Firebase initialized successfully")
  } catch (error) {
    console.error("❌ Firebase initialization error:", error)
    throw error
  }
}

// Initialize Firebase
try {
  initializeFirebase()
} catch (error) {
  console.error("Failed to initialize Firebase:", error)
  process.exit(1)
}

// Global variables
let thresholdSettings = []
let locationTechnicians = {}
const locationUsers = {}
let isMonitoringActive = true
let checkInterval = 60000 // 1 minute in milliseconds
let lastCheck = null
let locationRecipients = {}

// Function to extract thresholds from equipment documents
async function extractThresholdsFromEquipment() {
  try {
    console.log("🔍 Starting threshold extraction from equipment documents")
    const equipmentSnapshot = await getDocs(collection(db, "equipment"))
    console.log(`📊 Found ${equipmentSnapshot.docs.length} equipment documents to check for thresholds`)

    const thresholds = []

    for (const docSnapshot of equipmentSnapshot.docs) {
      const equipmentData = docSnapshot.data()
      const equipmentId = docSnapshot.id
      const locationId = equipmentData.locationId || ""
      const systemId = equipmentData.system || equipmentData.name || ""

      // Skip if no thresholds defined
      if (!equipmentData.thresholds) {
        continue
      }

      console.log(`✅ Found thresholds for ${equipmentId} (${equipmentData.name})`)
      console.log(`   Location: ${locationId}, System: ${systemId}`)
      console.log(`   Thresholds:`, JSON.stringify(equipmentData.thresholds, null, 2))

      // Process thresholds based on their structure - IMPROVED VERSION
      const processNestedThresholds = (parentPath, thresholdObj, parentName) => {
        // Check if this object has min/max properties directly
        if (thresholdObj.min !== undefined || thresholdObj.max !== undefined) {
          const thresholdId = `${equipmentId}-${parentPath.replace(/\//g, "-")}`
          console.log(`   Adding threshold: ${thresholdId}`)
          console.log(`     Path: ${parentPath}, Name: ${parentName || "Default"}`)
          console.log(`     Min: ${thresholdObj.min}, Max: ${thresholdObj.max}`)

          thresholds.push({
            id: thresholdId,
            equipmentId,
            metricPath: parentPath,
            metricName: parentName || "Default",
            minThreshold: thresholdObj.min,
            maxThreshold: thresholdObj.max,
            enabled: true,
            locationId,
            systemId,
          })
          return
        }

        // Otherwise, iterate through properties looking for nested objects
        Object.entries(thresholdObj).forEach(([key, value]) => {
          if (typeof value === "object" && value !== null) {
            const newPath = parentPath ? `${parentPath}/${key}` : key
            const newName = parentName ? `${parentName} ${key}` : key
            processNestedThresholds(newPath, value, newName)
          }
        })
      }

      // Start processing from the root thresholds object
      processNestedThresholds("", equipmentData.thresholds, "")
    }

    console.log(`🎯 Extracted ${thresholds.length} thresholds from equipment documents`)

    // Log all extracted thresholds for debugging
    console.log("All extracted thresholds:")
    thresholds.forEach((threshold) => {
      console.log(`- ${threshold.id}: ${threshold.metricName}`)
      console.log(`  Min: ${threshold.minThreshold}, Max: ${threshold.maxThreshold}`)
      console.log(`  Location: ${threshold.locationId}, System: ${threshold.systemId}`)
    })

    return thresholds
  } catch (error) {
    console.error("❌ Error extracting thresholds from equipment:", error)
    return []
  }
}

// Function to fetch technicians and recipients for locations
async function fetchLocationPersonnel() {
  try {
    // Fetch all technicians
    const techniciansSnapshot = await getDocs(collection(db, "technicians"))
    const technicians = techniciansSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))

    // Fetch all recipients (replacing users)
    const recipientsSnapshot = await getDocs(collection(db, "recipients"))
    const recipients = recipientsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))

    // Map technicians to locations
    const techMap = {}
    technicians.forEach((tech) => {
      if (tech.assignedLocations && Array.isArray(tech.assignedLocations)) {
        tech.assignedLocations.forEach((locationId) => {
          if (!techMap[locationId]) {
            techMap[locationId] = []
          }
          techMap[locationId].push(tech)
        })
      }
    })

    // Map recipients to locations (replacing users mapping)
    const recipientMap = {}
    recipients.forEach((recipient) => {
      if (recipient.locationId) {
        const locationId = recipient.locationId
        if (!recipientMap[locationId]) {
          recipientMap[locationId] = []
        }
        recipientMap[locationId].push(recipient)
      }
    })

    locationTechnicians = techMap
    locationRecipients = recipientMap // Replace locationUsers with locationRecipients

    console.log("Personnel data loaded:", {
      technicians: Object.keys(techMap).length,
      recipients: Object.keys(recipientMap).length,
    })

    return { techMap, recipientMap }
  } catch (error) {
    console.error("Error fetching personnel data:", error)
    return { techMap: {}, recipientMap: {} }
  }
}

// Function to get location name from ID - UPDATED
async function getLocationName(locationId) {
  if (!locationId) return null

  try {
    // First try to get from Firestore
    const locationQuery = query(collection(db, "locations"), where("id", "==", locationId), limit(1))
    const locationSnapshot = await getDocs(locationQuery)

    if (!locationSnapshot.empty) {
      const name = locationSnapshot.docs[0].data().name
      return name || null
    }

    // If not found in Firestore, try RTDB
    const locationsRef = ref(rtdb, "/locations")
    const snapshot = await get(locationsRef)
    const rtdbData = snapshot.val() || {}

    // First check: Is the locationId itself a key in the RTDB?
    if (rtdbData[locationId]) {
      console.log(`Found location key "${locationId}" directly in RTDB`)
      // Use the key itself as the name since that's the actual location name
      return locationId
    }

    // Second check: Search through all locations in RTDB for matching id field
    for (const [key, value] of Object.entries(rtdbData)) {
      if (value.id === locationId) {
        // Found a match by id
        console.log(`Found location with matching id field: ${key}`)
        // Use the key as the name since that's the actual location name
        return key
      }
    }

    return null
  } catch (error) {
    console.error("Error getting location name:", error)
    return null
  }
}

// Function to send alarm email
async function sendAlarmEmail(alarmData, alarmId) {
  try {
    // Get the location identifiers
    const locationId = alarmData.locationId
    const locationName = alarmData.locationName

    console.log(`Sending alarm email for location: ${locationName} (ID: ${locationId})`)

    // Step 1: Gather all possible location identifiers by cross-referencing
    const locationIdentifiers = new Set([locationId])
    const locationNames = new Set([locationName])

    // Try to find the location document in Firestore to get all possible identifiers
    try {
      // First try by locationId
      if (locationId) {
        // Try direct document lookup
        const locationDoc = await getDoc(doc(db, "locations", locationId))
        if (locationDoc.exists()) {
          const data = locationDoc.data()
          if (data.id) locationIdentifiers.add(data.id)
          if (data.name) locationNames.add(data.name)
          console.log(`Found location document by direct ID lookup: ${locationDoc.id}`)
        }

        // Try by 'id' field
        const locationQuery1 = query(collection(db, "locations"), where("id", "==", locationId), limit(1))
        const locationSnapshot1 = await getDocs(locationQuery1)
        if (!locationSnapshot1.empty) {
          const data = locationSnapshot1.docs[0].data()
          locationIdentifiers.add(locationSnapshot1.docs[0].id)
          if (data.id) locationIdentifiers.add(data.id)
          if (data.name) locationNames.add(data.name)
          console.log(`Found location by 'id' field: ${locationSnapshot1.docs[0].id}`)
        }
      }

      // Then try by locationName
      if (locationName) {
        const locationQuery2 = query(collection(db, "locations"), where("name", "==", locationName), limit(1))
        const locationSnapshot2 = await getDocs(locationQuery2)
        if (!locationSnapshot2.empty) {
          const data = locationSnapshot2.docs[0].data()
          locationIdentifiers.add(locationSnapshot2.docs[0].id)
          if (data.id) locationIdentifiers.add(data.id)
          console.log(`Found location by 'name' field: ${locationSnapshot2.docs[0].id}`)
        }
      }

      // Also check RTDB for additional identifiers
      const locationsRef = ref(rtdb, "/locations")
      const rtdbSnapshot = await get(locationsRef)
      const rtdbData = rtdbSnapshot.val() || {}

      // Search through all locations in RTDB
      for (const [key, value] of Object.entries(rtdbData)) {
        // Match by ID
        if (locationIdentifiers.has(key) || (value.id && locationIdentifiers.has(value.id))) {
          locationIdentifiers.add(key)
          if (value.id) locationIdentifiers.add(value.id)
          if (value.name) locationNames.add(value.name)
          console.log(`Found matching location in RTDB: ${key}`)
        }

        // Match by name
        if (value.name && locationNames.has(value.name)) {
          locationIdentifiers.add(key)
          if (value.id) locationIdentifiers.add(value.id)
          console.log(`Found matching location by name in RTDB: ${key}`)
        }
      }

      console.log(`All possible location identifiers:`, [...locationIdentifiers])
      console.log(`All possible location names:`, [...locationNames])
    } catch (error) {
      console.error("Error gathering location identifiers:", error)
    }

    // Step 2: Find technicians and recipients using all possible identifiers
    let techs = []
    let recipients = []

    // Check for technicians using all location identifiers
    for (const id of locationIdentifiers) {
      if (locationTechnicians[id] && locationTechnicians[id].length > 0) {
        console.log(`Found ${locationTechnicians[id].length} technicians for location ID: ${id}`)
        techs = [...techs, ...locationTechnicians[id]]
      }
    }

    // Check for recipients using all location identifiers
    for (const id of locationIdentifiers) {
      if (locationRecipients[id] && locationRecipients[id].length > 0) {
        console.log(`Found ${locationRecipients[id].length} recipients for location ID: ${id}`)
        recipients = [...recipients, ...locationRecipients[id]]
      }
    }

    // Step 3: If still no recipients, query Firestore directly
    if (recipients.length === 0) {
      console.log(`No recipients found in cache, querying Firestore directly`)
      try {
        // Try each location identifier
        for (const id of locationIdentifiers) {
          const recipientsQuery = query(collection(db, "recipients"), where("locationId", "==", id), limit(10))
          const recipientsSnapshot = await getDocs(recipientsQuery)

          if (!recipientsSnapshot.empty) {
            console.log(`Found ${recipientsSnapshot.docs.length} recipients by locationId ${id} in Firestore`)
            recipients = [...recipients, ...recipientsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))]
            break // Found some recipients, no need to continue
          }
        }

        // If still no recipients, try by location names
        if (recipients.length === 0) {
          for (const name of locationNames) {
            const recipientsQuery = query(collection(db, "recipients"), where("locationName", "==", name), limit(10))
            const recipientsSnapshot = await getDocs(recipientsQuery)

            if (!recipientsSnapshot.empty) {
              console.log(`Found ${recipientsSnapshot.docs.length} recipients by locationName ${name} in Firestore`)
              recipients = [...recipients, ...recipientsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))]
              break // Found some recipients, no need to continue
            }
          }
        }
      } catch (error) {
        console.error("Error querying recipients from Firestore:", error)
      }
    }

    // Step 4: If still no technicians, query Firestore directly
    if (techs.length === 0) {
      console.log(`No technicians found in cache, querying Firestore directly`)
      try {
        const techniciansQuery = query(collection(db, "technicians"), limit(20))
        const techniciansSnapshot = await getDocs(techniciansQuery)

        if (!techniciansSnapshot.empty) {
          // Filter technicians that have any of our location identifiers in their assignedLocations array
          const allTechs = techniciansSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))

          techs = allTechs.filter((tech) => {
            if (!tech.assignedLocations || !Array.isArray(tech.assignedLocations)) return false

            // Check if any of our location identifiers match this tech's assigned locations
            return tech.assignedLocations.some(
              (loc) => locationIdentifiers.has(loc) || [...locationNames].some((name) => loc.includes(name)),
            )
          })

          console.log(`Found ${techs.length} technicians for this location through direct query`)
        }
      } catch (error) {
        console.error("Error querying technicians from Firestore:", error)
      }
    }

    // Remove duplicates from techs and recipients
    techs = [...new Map(techs.map((item) => [item.id, item])).values()]
    recipients = [...new Map(recipients.map((item) => [item.id, item])).values()]

    // Combine emails from both groups
    const techEmails = techs.map((tech) => tech.email).filter(Boolean)
    const recipientEmails = recipients.map((recipient) => recipient.email).filter(Boolean)
    const allEmails = [...new Set([...techEmails, ...recipientEmails])]

    // Get tech names for the email
    const techNames = techs.map((tech) => tech.name).join(", ")

    // Skip email sending if no recipients
    if (allEmails.length === 0) {
      console.log(`Skipping email send - no recipients found for location ${locationName} (${locationId})`)
      return
    }

    console.log(`Sending alarm email to ${allEmails.length} recipients for alarm ${alarmId}`)
    console.log(`Recipients: ${allEmails.join(", ")}`)

    console.log("Sending email with location data:", {
      locationId: alarmData.locationId,
      locationName: alarmData.locationName,
    })

    try {
      const response = await fetch(`${process.env.APP_URL || "http://localhost:3000"}/api/send-alarm-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          alarmType: alarmData.name,
          details: alarmData.message,
          locationId: alarmData.locationId,
          locationName: alarmData.locationName,
          equipmentName: alarmData.equipmentName,
          alarmId: alarmId,
          severity: alarmData.severity,
          recipients: allEmails,
          assignedTechs: techNames || "None",
        }),
      })

      if (!response.ok) {
        console.warn("Email API returned error status:", response.status)
        const errorData = await response.json()
        console.error("Email API error details:", errorData)
      } else {
        const result = await response.json()
        console.log("Alarm email sent successfully to", allEmails.length, "recipients. Message ID:", result.messageId)
      }
    } catch (error) {
      console.warn("Email sending failed but continuing alarm creation:", error)
    }
  } catch (error) {
    console.error("Error in sendAlarmEmail function:", error)
  }
}

// Function to monitor equipment metrics
async function monitorEquipmentMetrics() {
  try {
    // Get RTDB data
    const locationsRef = ref(rtdb, "/locations")
    const snapshot = await get(locationsRef)
    const rtdbData = snapshot.val() || {}

    console.log("🔍 monitorEquipmentMetrics called with", {
      thresholdCount: thresholdSettings.length,
      rtdbAvailable: !!rtdbData,
      locationCount: Object.keys(rtdbData).length,
    })

    if (!rtdbData || !thresholdSettings.length) {
      console.log("Cannot monitor metrics - missing dependencies")
      return
    }

    const checkTime = new Date()
    lastCheck = checkTime
    console.log(
      `🔍 CHECKING METRICS at ${checkTime.toLocaleTimeString()} - ${thresholdSettings.length} thresholds to check`,
    )

    // Track metrics check statistics
    let metricsChecked = 0
    let metricsFound = 0
    let thresholdsExceeded = 0

    // For each threshold setting, check the corresponding metric
    for (const threshold of thresholdSettings) {
      try {
        metricsChecked++
        console.log(`\n📊 Checking threshold: ${threshold.metricName} (${threshold.id})`)
        console.log(`Min: ${threshold.minThreshold}, Max: ${threshold.maxThreshold}`)

        // Get the equipment document to access current metrics and verify thresholds
        const equipmentDoc = await getDoc(doc(db, "equipment", threshold.equipmentId))

        if (!equipmentDoc.exists()) {
          console.log(`❌ Equipment ${threshold.equipmentId} not found in Firestore`)
          continue
        }

        const equipmentData = equipmentDoc.data()
        const locationId = equipmentData.locationId || threshold.locationId
        const systemId = equipmentData.system || equipmentData.name || threshold.systemId

        console.log(`📍 Equipment: ${equipmentData.name} (${threshold.equipmentId}) at location ${locationId}`)

        // IMPORTANT: Re-verify the threshold values from the equipment document
        // This ensures we're using the most up-to-date thresholds
        let currentMinThreshold = threshold.minThreshold
        let currentMaxThreshold = threshold.maxThreshold

        // Parse the metric path to navigate the thresholds object
        const pathParts = threshold.metricPath.split("/").filter(Boolean)
        let thresholdObj = equipmentData.thresholds

        // Navigate through the path to find the specific threshold
        for (const part of pathParts) {
          if (thresholdObj && typeof thresholdObj === "object") {
            thresholdObj = thresholdObj[part]
          } else {
            thresholdObj = null
            break
          }
        }

        // If we found the threshold object, update the min/max values
        if (thresholdObj && typeof thresholdObj === "object") {
          if (thresholdObj.min !== undefined) {
            currentMinThreshold = thresholdObj.min
          }
          if (thresholdObj.max !== undefined) {
            currentMaxThreshold = thresholdObj.max
          }

          console.log(`📊 Updated thresholds from document: Min: ${currentMinThreshold}, Max: ${currentMaxThreshold}`)
        } else {
          console.log(`⚠️ Could not find threshold object at path: ${threshold.metricPath}`)
          console.log(`⚠️ Using original thresholds: Min: ${currentMinThreshold}, Max: ${currentMaxThreshold}`)
        }

        // Try to get the metric value from RTDB using the improved function
        let currentValue = getMetricValue(locationId, systemId, threshold.metricName, rtdbData)
        let metricSource = ""

        if (currentValue !== null) {
          metricSource = "RTDB"
          metricsFound++
          console.log(`📈 Current value for ${threshold.metricName}: ${currentValue} (source: ${metricSource})`)
        } else {
          // If we still don't have a value, try to get it from Firestore
          console.log(`⚠️ Metric not found in RTDB, checking Firestore at path: thresholds.${threshold.metricPath}`)
          const firestoreValue = threshold.metricPath
            .split("/")
            .reduce((obj, key) => (obj && typeof obj === "object" ? obj[key] : null), equipmentData.thresholds || {})

          if (
            firestoreValue &&
            (typeof firestoreValue.value !== "undefined" || typeof firestoreValue.current !== "undefined")
          ) {
            metricsFound++
            metricSource = "Firestore"
            currentValue =
              typeof firestoreValue.value !== "undefined"
                ? typeof firestoreValue.value === "number"
                  ? firestoreValue.value
                  : Number.parseFloat(firestoreValue.value)
                : typeof firestoreValue.current === "number"
                  ? firestoreValue.current
                  : Number.parseFloat(firestoreValue.current)
            console.log(`📈 Current value for ${threshold.metricName}: ${currentValue} (source: ${metricSource})`)
          } else {
            console.log(`❌ Metric not found in Firestore either`)
          }
        }

        // Skip if no valid metric value found
        if (currentValue === null) {
          console.log(`⚠️ Skipping alarm creation for ${threshold.metricName} - no valid metric value found`)
          continue
        }

        // Check if value exceeds thresholds - USING UPDATED THRESHOLD VALUES
        let severity = null
        let message = ""

        // Check against min/max thresholds
        if (currentMaxThreshold !== undefined && currentValue !== null && currentValue > currentMaxThreshold) {
          severity = "critical"
          thresholdsExceeded++
          message = `${threshold.metricName} value of ${currentValue} exceeds maximum threshold of ${currentMaxThreshold}`
          console.log(`🚨 THRESHOLD EXCEEDED (MAX): ${currentValue} > ${currentMaxThreshold}`)
        } else if (currentMinThreshold !== undefined && currentValue !== null && currentValue < currentMinThreshold) {
          severity = "warning"
          thresholdsExceeded++
          message = `${threshold.metricName} value of ${currentValue} is below minimum threshold of ${currentMinThreshold}`
          console.log(`⚠️ THRESHOLD EXCEEDED (MIN): ${currentValue} < ${currentMinThreshold}`)
        } else if (currentValue !== null) {
          console.log(
            `✅ Value is within acceptable range: ${currentValue} (min: ${currentMinThreshold}, max: ${currentMaxThreshold})`,
          )
        }

        // If threshold exceeded, create an alarm
        if (severity) {
          // Check if there's already an active alarm for this metric
          const existingAlarmQuery = query(
            collection(db, "alarms"),
            where("equipmentId", "==", threshold.equipmentId),
            where("name", "==", `${threshold.metricName} Threshold Exceeded`),
            where("active", "==", true),
            limit(1),
          )
          const existingAlarmSnapshot = await getDocs(existingAlarmQuery)

          if (existingAlarmSnapshot.empty) {
            // Get location name
            let locationName = equipmentData.locationName || equipmentData.location || null

            // Try to get a better location name if we don't have one
            if (!locationName) {
              console.log(`Attempting to resolve location name for ID: ${locationId}`)

              try {
                // First try direct lookup in Firestore
                const locationDocRef = doc(db, "locations", locationId)
                const locationDocSnap = await getDoc(locationDocRef)

                if (locationDocSnap.exists() && locationDocSnap.data().name) {
                  locationName = locationDocSnap.data().name
                  console.log(`Found location name via direct lookup: ${locationName}`)
                } else {
                  // Try query by ID field
                  const locationQuery = query(collection(db, "locations"), where("id", "==", locationId), limit(1))
                  const locationSnapshot = await getDocs(locationQuery)

                  if (!locationSnapshot.empty && locationSnapshot.docs[0].data().name) {
                    locationName = locationSnapshot.docs[0].data().name
                    console.log(`Found location name via query: ${locationName}`)
                  } else {
                    // Try RTDB lookup
                    if (rtdbData && rtdbData[locationId] && rtdbData[locationId].name) {
                      locationName = rtdbData[locationId].name
                      console.log(`Found location name in RTDB direct: ${locationName}`)
                    } else {
                      // Search through RTDB
                      for (const [key, value] of Object.entries(rtdbData)) {
                        if (value.id === locationId && value.name) {
                          locationName = value.name
                          console.log(`Found location name in RTDB search: ${locationName}`)
                          break
                        }
                      }
                    }
                  }
                }
              } catch (error) {
                console.error(`Error resolving location name for ${locationId}:`, error)
              }

              // If still no name found, use a placeholder
              if (!locationName) {
                locationName = `Location ${locationId}`
                console.log(`Using placeholder name: ${locationName}`)
              }
            }

            // Create new alarm with the resolved location name
            const alarmData = {
              name: `${threshold.metricName} Threshold Exceeded`,
              equipmentId: threshold.equipmentId,
              equipmentName: equipmentData.name || "Unknown Equipment",
              locationId: locationId,
              // Use the location key as the name when no name field is available
              locationName: locationName || locationId || "Unknown Location", // This ensures we use the location ID as name if no name is found
              severity,
              message,
              active: true,
              acknowledged: false,
              resolved: false,
              timestamp: new Date(),
            }

            console.log(`Creating alarm with location name: "${locationName || locationId}" and ID: "${locationId}"`)

            // Add to Firestore
            const alarmsCollection = collection(db, "alarms")
            const newAlarmRef = await addDoc(alarmsCollection, alarmData)
            console.log(`🔔 New ${severity} alarm created for ${threshold.metricName} with ID ${newAlarmRef.id}`)

            // Send email notification
            await sendAlarmEmail(alarmData, newAlarmRef.id)
          } else {
            console.log(`ℹ️ Alarm already exists for this metric, not creating a new one`)
          }
        }
      } catch (error) {
        console.error(`❌ Error monitoring metric ${threshold.metricName}:`, error)
      }
    }

    console.log(`\n📊 METRICS CHECK SUMMARY:
   - Time: ${checkTime.toLocaleTimeString()}
   - Thresholds checked: ${metricsChecked}
   - Metrics found: ${metricsFound}
   - Thresholds exceeded: ${thresholdsExceeded}
   `)
  } catch (error) {
    console.error("❌ Error in monitorEquipmentMetrics:", error)
  }
}

// Initialize the monitoring service
async function initializeMonitoring() {
  try {
    console.log("🚀 Starting monitoring service initialization...")

    // Load thresholds
    thresholdSettings = await extractThresholdsFromEquipment()
    console.log(`✅ Loaded ${thresholdSettings.length} thresholds`)

    // Load personnel data
    await fetchLocationPersonnel()
    console.log("✅ Loaded personnel data")

    // Start monitoring
    console.log("🔄 Starting monitoring cycle...")
    await monitorEquipmentMetrics()

    // Set up interval for continuous monitoring
    setInterval(async () => {
      if (isMonitoringActive) {
        try {
          await monitorEquipmentMetrics()
        } catch (error) {
          console.error("❌ Error in monitoring cycle:", error)
        }
      }
    }, checkInterval)

    console.log(`✅ Monitoring service initialized successfully. Checking every ${checkInterval / 1000} seconds.`)
    return true
  } catch (error) {
    console.error("❌ Error initializing monitoring service:", error)
    return false
  }
}

// Export functions for external use
module.exports = {
  initializeMonitoring,
  monitorEquipmentMetrics,
  setMonitoringActive: (active) => {
    isMonitoringActive = active
    console.log(`Monitoring is now ${active ? "active" : "paused"}`)
  },
  setCheckInterval: (interval) => {
    checkInterval = interval
    console.log(`Check interval set to ${interval}ms`)
  },
  getStatus: () => ({
    isActive: isMonitoringActive,
    lastCheck,
    checkInterval,
    thresholdCount: thresholdSettings.length,
  }),
}
