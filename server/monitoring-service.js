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

// Cache for outdoor temperatures with 30-minute TTL
const outdoorTempCache = {}
const TEMP_CACHE_TTL = 30 * 60 * 1000 // 30 minutes

// Track previous values for rate-of-change validation
const lastValidReadings = {}

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
        // Step 5: Get location contactEmail if available
        let locationContactEmail = null
        try {
            // First check if we already have the location document
            let locationDoc = null

            // Try direct document lookup if we haven't already
            if (locationId) {
                locationDoc = await getDoc(doc(db, "locations", locationId))
                if (locationDoc.exists() && locationDoc.data().contactEmail) {
                    locationContactEmail = locationDoc.data().contactEmail
                    console.log(`Found location contactEmail from direct lookup: ${locationContactEmail}`)
                }
            }

            // If not found directly, try searching by ID
            if (!locationContactEmail) {
                for (const id of locationIdentifiers) {
                    // Skip if we already tried this ID
                    if (id === locationId) continue

                    const locationQuery = query(collection(db, "locations"), where("id", "==", id), limit(1))
                    const locationSnapshot = await getDocs(locationQuery)

                    if (!locationSnapshot.empty && locationSnapshot.docs[0].data().contactEmail) {
                        locationContactEmail = locationSnapshot.docs[0].data().contactEmail
                        console.log(`Found contactEmail via ID query: ${locationContactEmail}`)
                        break
                    }
                }
            }

            // If still not found, try by name
            if (!locationContactEmail) {
                for (const name of locationNames) {
                    const locationQuery = query(collection(db, "locations"), where("name", "==", name), limit(1))
                    const locationSnapshot = await getDocs(locationQuery)

                    if (!locationSnapshot.empty && locationSnapshot.docs[0].data().contactEmail) {
                        locationContactEmail = locationSnapshot.docs[0].data().contactEmail
                        console.log(`Found contactEmail via name query: ${locationContactEmail}`)
                        break
                    }
                }
            }
        } catch (error) {
            console.error("Error getting location contactEmail:", error)
        }

        // Remove duplicates from techs and recipients
        techs = [...new Map(techs.map((item) => [item.id, item])).values()]
        recipients = [...new Map(recipients.map((item) => [item.id, item])).values()]

        // Combine emails from both groups
        const techEmails = techs.map((tech) => tech.email).filter(Boolean)
        const recipientEmails = recipients.map((recipient) => recipient.email).filter(Boolean)
        let allEmails = [...new Set([...techEmails, ...recipientEmails])]

        // Add the location contact email to the recipients list if found
        if (locationContactEmail) {
            console.log(`Adding location contactEmail to recipients: ${locationContactEmail}`)
            allEmails.push(locationContactEmail)
            // Remove duplicates again just to be safe
            allEmails = [...new Set(allEmails)]
        }

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

// Enhanced function to get outdoor temperature for a location
async function getOutdoorTemperature(locationId, rtdbData) {
    try {
        console.log(`🌡️ Attempting to get outdoor temperature for location ${locationId}`);

        // Check cache first
        const now = Date.now();
        if (outdoorTempCache[locationId] && (now - outdoorTempCache[locationId].timestamp) < TEMP_CACHE_TTL) {
            console.log(`Using cached outdoor temperature for ${locationId}: ${outdoorTempCache[locationId].temperature}°F`);
            return outdoorTempCache[locationId].temperature;
        }

        // 1. First try to get from OpenWeatherMap API (same approach as WeatherDisplay component)
        try {
            // Get location weather settings (same as in WeatherDisplay)
            const weatherSettingsDoc = await getDoc(doc(db, "locations", locationId, "settings", "weather"));
            let apiKey = null;
            let zipCode = "46803"; // Default zip code

            if (weatherSettingsDoc.exists()) {
                const settings = weatherSettingsDoc.data();
                if (settings.enabled && settings.apiKey) {
                    apiKey = settings.apiKey;
                    zipCode = settings.zipCode || zipCode;
                    console.log(`Using location-specific weather settings for ${locationId}`);
                }
            }

            // If no location-specific settings, try global config
            if (!apiKey) {
                // Get global weather API key
                const configDoc = await getDoc(doc(db, "config", "global"));
                if (configDoc.exists() && configDoc.data().weatherApiKey) {
                    apiKey = configDoc.data().weatherApiKey;
                    zipCode = configDoc.data().weatherZipCode || zipCode;
                    console.log(`Using global weather settings with zip code ${zipCode}`);
                }
            }

            // If we have an API key, make the request
            if (apiKey) {
                console.log(`Making OpenWeatherMap API request for zip code ${zipCode}`);
                const response = await fetch(
                    `https://api.openweathermap.org/data/2.5/weather?zip=${zipCode},us&units=imperial&appid=${apiKey}`
                );

                if (!response.ok) {
                    throw new Error(`Weather API returned status ${response.status}`);
                }

                const data = await response.json();
                const temperature = data.main.temp;
                
                console.log(`Retrieved temperature from OpenWeatherMap: ${temperature}°F`);
                
                // Cache the result
                outdoorTempCache[locationId] = {
                    temperature,
                    timestamp: now,
                    source: 'openweathermap'
                };
                
                return temperature;
            } else {
                console.log(`No OpenWeatherMap API key available`);
            }
        } catch (error) {
            console.error("Error fetching from OpenWeatherMap:", error);
        }

        // 2. Check for equipment with outdoor temperature sensors
        console.log(`Checking equipment with outdoor sensors for location ${locationId}`);
        try {
            // Query Firestore for equipment that might have outdoor sensors
            const outdoorSensorQuery = query(
                collection(db, "equipment"),
                where("locationId", "==", locationId),
                where("type", "in", ["weather_station", "outdoor_sensor", "temperature_sensor"]),
                limit(1)
            );
            
            const sensorSnapshot = await getDocs(outdoorSensorQuery);
            if (!sensorSnapshot.empty) {
                const sensorEquipment = sensorSnapshot.docs[0].data();
                const equipId = sensorSnapshot.docs[0].id;
                console.log(`Found outdoor sensor equipment: ${equipId}`);
                
                // Use your existing getMetricValue function to get the temperature
                // This assumes getMetricValue can get metrics from your storage (InfluxDB)
                const sensorTemp = getMetricValue(locationId, equipId, 'temperature', rtdbData);
                if (sensorTemp !== null) {
                    console.log(`Found temperature from sensor equipment: ${sensorTemp}°F`);
                    
                    // Cache the result
                    outdoorTempCache[locationId] = {
                        temperature: sensorTemp,
                        timestamp: now,
                        source: 'sensor'
                    };
                    
                    return sensorTemp;
                }
            }
        } catch (error) {
            console.error("Error checking for outdoor sensor equipment:", error);
        }

        // 3. Try more general equipment search
        console.log(`Checking all equipment for outdoor temperature metrics for location ${locationId}`);
        try {
            const generalEquipQuery = query(
                collection(db, "equipment"),
                where("locationId", "==", locationId),
                limit(20)
            );
            
            const equipSnapshot = await getDocs(generalEquipQuery);
            for (const equipDoc of equipSnapshot.docs) {
                const equipment = equipDoc.data();
                const equipId = equipDoc.id;
                
                // Look for metrics that might contain outdoor temperature
                const metricNames = ['outdoorTemp', 'outdoor_temp', 'OutdoorTemperature', 'OAT', 
                                    'outside_temp', 'ambient_temp', 'outside_air_temperature'];
                
                for (const metricName of metricNames) {
                    const tempValue = getMetricValue(locationId, equipId, metricName, rtdbData);
                    if (tempValue !== null) {
                        console.log(`Found outdoor temperature in equipment ${equipId} as ${metricName}: ${tempValue}°F`);
                        
                        // Cache the result
                        outdoorTempCache[locationId] = {
                            temperature: tempValue,
                            timestamp: now,
                            source: 'equipment_metric'
                        };
                        
                        return tempValue;
                    }
                }
                
                // Check if equipment has metrics.outdoor.temperature structure
                if (equipment.metrics && equipment.metrics.outdoor && 
                    equipment.metrics.outdoor.temperature !== undefined) {
                    const tempValue = equipment.metrics.outdoor.temperature;
                    if (tempValue !== null && !isNaN(parseFloat(tempValue))) {
                        const temp = parseFloat(tempValue);
                        console.log(`Found outdoor temperature in equipment ${equipId} metrics: ${temp}°F`);
                        
                        // Cache the result
                        outdoorTempCache[locationId] = {
                            temperature: temp,
                            timestamp: now,
                            source: 'equipment_metrics_object'
                        };
                        
                        return temp;
                    }
                }
            }
        } catch (error) {
            console.error("Error checking equipment for outdoor temperature:", error);
        }

        // 4. Check RTDB as a fallback
        if (rtdbData && rtdbData[locationId]) {
            if (rtdbData[locationId].weather && rtdbData[locationId].weather.temperature !== undefined) {
                const temp = rtdbData[locationId].weather.temperature;
                console.log(`Found outdoor temperature in RTDB: ${temp}°F`);
                
                // Cache the result
                outdoorTempCache[locationId] = {
                    temperature: temp,
                    timestamp: now,
                    source: 'rtdb'
                };
                
                return temp;
            }
            
            // Check more RTDB paths
            if (rtdbData[locationId].outdoor && rtdbData[locationId].outdoor.temperature !== undefined) {
                const temp = rtdbData[locationId].outdoor.temperature;
                console.log(`Found outdoor temperature in RTDB at outdoor/temperature: ${temp}°F`);
                
                outdoorTempCache[locationId] = {
                    temperature: temp,
                    timestamp: now,
                    source: 'rtdb_outdoor'
                };
                
                return temp;
            }
            
            if (rtdbData[locationId].sensors && 
                rtdbData[locationId].sensors.outdoor && 
                rtdbData[locationId].sensors.outdoor.temperature !== undefined) {
                const temp = rtdbData[locationId].sensors.outdoor.temperature;
                console.log(`Found outdoor temperature in RTDB at sensors/outdoor/temperature: ${temp}°F`);
                
                outdoorTempCache[locationId] = {
                    temperature: temp,
                    timestamp: now,
                    source: 'rtdb_sensors'
                };
                
                return temp;
            }
        }

        // 5. Last resort - use a hardcoded default temp based on month
        const month = new Date().getMonth(); // 0-11 for Jan-Dec
        let defaultTemp;
        
        if (month >= 5 && month <= 8) {
            // Summer months (Jun-Sep)
            defaultTemp = 75;
        } else if (month >= 9 && month <= 10) {
            // Fall months (Oct-Nov)
            defaultTemp = 55;
        } else if (month >= 11 || month <= 1) {
            // Winter months (Dec-Feb)
            defaultTemp = 30;
        } else {
            // Spring months (Mar-May)
            defaultTemp = 60;
        }
        
        console.log(`❌ Could not find outdoor temperature for location ${locationId}, using seasonal default: ${defaultTemp}°F`);
        
        // Cache the default value with a shorter TTL (10 minutes)
        outdoorTempCache[locationId] = {
            temperature: defaultTemp,
            timestamp: now,
            source: 'seasonal_default',
            ttl: 10 * 60 * 1000 // 10 minutes for default values
        };
        
        return defaultTemp;
    } catch (error) {
        console.error("Error getting outdoor temperature:", error);
        // Return a reasonable default value to prevent system failures
        return 65; // Moderate default temperature
    }
}

// Function to calculate dynamic thresholds based on outdoor temperature
function calculateDynamicThresholds(baseMinThreshold, baseMaxThreshold, equipmentType, outdoorTemp, metricName) {
    // Default to the base thresholds
    let adjustedMin = baseMinThreshold
    let adjustedMax = baseMaxThreshold

    console.log(`Calculating dynamic thresholds for ${equipmentType} - ${metricName}`)
    console.log(`Base thresholds: Min: ${baseMinThreshold}, Max: ${baseMaxThreshold}`)
    console.log(`Outdoor temp: ${outdoorTemp !== null ? outdoorTemp + '°F' : 'Unknown'}`)

    // If we don't have outdoor temp data, just use the base thresholds
    if (outdoorTemp === null) {
        console.log(`No outdoor temperature data available, using base thresholds`)
        return { adjustedMin, adjustedMax }
    }

    // Convert metric name to lowercase for easier matching
    const metricNameLower = metricName.toLowerCase()
    const isTemperature = metricNameLower.includes('temp') ||
        metricNameLower.includes('temperature') ||
        metricNameLower.includes('°f') ||
        metricNameLower.includes('°c')

    // Only adjust temperature metrics based on outdoor temperature
    if (isTemperature) {
        // Adjust thresholds based on equipment type and outdoor temperature
        switch (equipmentType) {
            case 'boiler':
                if (outdoorTemp >= 50) {
                    // When outdoor temp is 50°F or higher, boilers may be shut off or running at lower temps
                    adjustedMin = 60 // Allow temps as low as 60°F when it's warm outside

                    // Keep the max if it's higher than our winter max, otherwise use winter max
                    adjustedMax = Math.max(baseMaxThreshold, 160)

                    console.log(`Adjusted boiler thresholds for warm weather (outdoor: ${outdoorTemp}°F): Min: ${adjustedMin}, Max: ${adjustedMax}`)
                } else {
                    // When outdoor temp is below 50°F, ensure boilers are in proper winter range
                    adjustedMin = Math.max(baseMinThreshold, 120) // Min should be at least 120°F
                    adjustedMax = Math.min(baseMaxThreshold, 180) // Max should be at most 180°F

                    // For very cold temps, adjust the minimum upward
                    if (outdoorTemp < 20) {
                        // Linear scaling: colder outdoor temp = higher minimum threshold
                        // At 20°F outdoor, min is 120°F
                        // At 0°F outdoor, min is 140°F
                        // At -20°F outdoor, min is 160°F
                        const coldAdjustment = Math.max(0, (20 - outdoorTemp)) * 1.0; // 1°F higher min per 1°F colder outdoor
                        adjustedMin = Math.min(160, Math.max(baseMinThreshold, 120 + coldAdjustment));
                        console.log(`Cold weather adjustment applied: +${coldAdjustment.toFixed(1)}°F to minimum threshold`);
                    }

                    console.log(`Adjusted boiler thresholds for cold weather (outdoor: ${outdoorTemp}°F): Min: ${adjustedMin}, Max: ${adjustedMax}`)
                }
                break

            case 'steam_bundle':
                if (outdoorTemp >= 50) {
                    // Different thresholds for warm weather
                    adjustedMin = Math.min(baseMinThreshold, 70) // Can go lower in warm weather
                    
                    // Linear adjustment of maximum based on outdoor temperature
                    // Hotter outside = lower maximum threshold
                    if (outdoorTemp > 70) {
                        const reductionFactor = Math.min(30, (outdoorTemp - 70) * 1.5); // 1.5°F lower per 1°F hotter
                        adjustedMax = Math.max(140, baseMaxThreshold - reductionFactor);
                        console.log(`Hot weather adjustment for steam bundle: -${reductionFactor.toFixed(1)}°F to maximum threshold`);
                    }
                    
                    console.log(`Adjusted steam bundle thresholds for warm weather (outdoor: ${outdoorTemp}°F): Min: ${adjustedMin}, Max: ${adjustedMax}`)
                } else {
                    // Cold weather adjustments
                    // As it gets colder, increase the minimum threshold
                    const coldAdjustment = Math.max(0, (50 - outdoorTemp) * 0.5); // 0.5°F higher per 1°F colder
                    adjustedMin = Math.min(120, Math.max(baseMinThreshold, baseMinThreshold + coldAdjustment));
                    
                    console.log(`Adjusted steam bundle thresholds for cold weather (outdoor: ${outdoorTemp}°F): Min: ${adjustedMin}, Max: ${adjustedMax}`)
                }
                break

            case 'residential_system':
                if (outdoorTemp >= 70) {
                    // Hot summer day - cooling mode
                    adjustedMin = 55 // Allow cooler supply temps for A/C
                    adjustedMax = 85 // Upper limit for return air
                    console.log(`Adjusted residential thresholds for hot weather (outdoor: ${outdoorTemp}°F): Min: ${adjustedMin}, Max: ${adjustedMax}`)
                } else if (outdoorTemp >= 50 && outdoorTemp < 70) {
                    // Mild temperatures - shoulder season
                    adjustedMin = 60
                    adjustedMax = 85
                    console.log(`Adjusted residential thresholds for mild weather (outdoor: ${outdoorTemp}°F): Min: ${adjustedMin}, Max: ${adjustedMax}`)
                } else {
                    // Cold weather - heating mode
                    // For residential, implement a true outdoor reset curve
                    // As outside temp drops, supply temp increases on a linear scale
                    
                    // For cold weather:
                    // At 50°F outdoor, min supply = 100°F
                    // At 30°F outdoor, min supply = 120°F
                    // At 10°F outdoor, min supply = 140°F
                    // At -10°F outdoor, min supply = 160°F
                    
                    // Linear formula: min_supply = 100 + (50 - outdoor_temp) * (60/60) = 100 + (50 - outdoor_temp)
                    // But limit between 100-160°F
                    if (metricNameLower.includes('supply') || metricNameLower.includes('water')) {
                        adjustedMin = Math.min(160, Math.max(100, 100 + Math.max(0, 50 - outdoorTemp)));
                        adjustedMax = Math.min(180, adjustedMin + 40); // Max is 40°F above min, but not more than 180°F
                    } else {
                        // For return/air temps in cold weather
                        adjustedMin = 65;
                        adjustedMax = 85;
                    }
                    
                    console.log(`Adjusted residential thresholds for cold weather (outdoor: ${outdoorTemp}°F): Min: ${adjustedMin}, Max: ${adjustedMax}`)
                }
                break

            case 'fan_coil':
            case 'air_handler':
                if (outdoorTemp >= 65) {
                    // Cooling mode
                    if (metricNameLower.includes('supply') || metricNameLower.includes('discharge')) {
                        adjustedMin = 50;  // Cool supply air in cooling mode
                        adjustedMax = 65;
                    } else if (metricNameLower.includes('return')) {
                        adjustedMin = 65;
                        adjustedMax = 85;  // Higher return temps in cooling mode
                    } else {
                        // General air temperature
                        adjustedMin = 55;
                        adjustedMax = 80;
                    }
                } else if (outdoorTemp >= 45 && outdoorTemp < 65) {
                    // Shoulder season
                    adjustedMin = 60;
                    adjustedMax = 80;
                } else {
                    // Heating mode
                    if (metricNameLower.includes('supply') || metricNameLower.includes('discharge')) {
                        // Linear reset curve for supply air in heating mode
                        // At 45°F outdoor, min supply = 70°F
                        // At 0°F outdoor, min supply = 110°F
                        adjustedMin = Math.min(120, Math.max(70, 70 + (45 - Math.max(0, outdoorTemp)) * (40/45)));
                        adjustedMax = adjustedMin + 40; // Max is 40°F above min
                    } else if (metricNameLower.includes('return')) {
                        adjustedMin = 65;
                        adjustedMax = 80;
                    } else {
                        // General air temperature
                        adjustedMin = 65;
                        adjustedMax = 90;
                    }
                }
                console.log(`Adjusted air system thresholds for outdoor temp ${outdoorTemp}°F: Min: ${adjustedMin}, Max: ${adjustedMax}`)
                break

            case 'chiller':
                if (outdoorTemp >= 75) {
                    // On very hot days, chillers work harder
                    if (metricNameLower.includes('leaving') || metricNameLower.includes('supply')) {
                        // Leaving water temperature can be higher on hot days
                        const tempAdjustment = Math.min(8, (outdoorTemp - 75) * 0.4); // 0.4°F higher per 1°F hotter, max 8°F
                        adjustedMax = Math.min(55, baseMaxThreshold + tempAdjustment);
                        console.log(`Hot weather adjustment for chiller: +${tempAdjustment.toFixed(1)}°F to maximum threshold`);
                    }
                    
                    // For condensers, adjust the maximum threshold based on outdoor temp
                    if (metricNameLower.includes('condenser')) {
                        // Condenser temperature is typically 10-15°F above outdoor temperature
                        adjustedMax = Math.max(baseMaxThreshold, outdoorTemp + 15);
                        console.log(`Adjusted condenser max threshold to outdoor + 15°F: ${adjustedMax}°F`);
                    }
                }
                break

            default:
                // For unknown equipment types with temperature metrics, make a reasonable guess
                if (outdoorTemp >= 60) {
                    // In warm weather, lower the minimum threshold for most heating equipment
                    if (baseMinThreshold > 80) { // If this seems to be a heating setpoint
                        adjustedMin = 60 // Allow it to go much lower in warm weather
                        console.log(`Applied general warm weather adjustment (outdoor: ${outdoorTemp}°F): Min: ${adjustedMin}`)
                    }
                } else if (outdoorTemp <= 30) {
                    // In cold weather, increase minimum thresholds for heating equipment
                    if (baseMinThreshold > 80) { // If this seems to be a heating setpoint
                        // Increase min threshold by 0.5°F for each degree below 30°F
                        const coldAdjustment = Math.max(0, (30 - outdoorTemp) * 0.5);
                        adjustedMin = Math.min(160, Math.max(baseMinThreshold, baseMinThreshold + coldAdjustment));
                        console.log(`Applied general cold weather adjustment (outdoor: ${outdoorTemp}°F): +${coldAdjustment.toFixed(1)}°F to Min: ${adjustedMin}`)
                    }
                }
        }
    }

    console.log(`Final adjusted thresholds: Min: ${adjustedMin}, Max: ${adjustedMax}`)
    return { adjustedMin, adjustedMax }
}

// Enhanced validation function with tighter bounds and equipment-specific rules
function validateMetricValue(value, metricName, equipmentType, systemId) {
    // If value is null or undefined, it's invalid
    if (value === null || value === undefined) {
        console.log(`❌ REJECTED ${metricName}: Value is null or undefined`)
        return null
    }

    // Parse the value to a number if it's not already
    const numValue = typeof value === 'number' ? value : Number(value)

    // Check if parsing resulted in a valid number
    if (isNaN(numValue)) {
        console.log(`❌ REJECTED ${metricName}: Value "${value}" is not a valid number`)
        return null
    }

    // Get the metric type to apply appropriate validation
    const metricType = getMetricType(metricName)
    let isValid = true
    let validationMessage = ""

    // First apply universal sanity checks
    // Check for values that are clearly outside any possible real-world reading
    if (Math.abs(numValue) > 10000) {
        console.log(`❌ REJECTED ${metricName}: Value ${numValue} is an extreme outlier (absolute value > 10000)`)
        return null
    }

    // Apply metric-specific validation
    switch (metricType) {
        case 'temperature':
            // Apply general temperature bounds first
            if (numValue < -50 || numValue > 250) {
                isValid = false
                validationMessage = `Temperature outside physical range (-50°F to 250°F)`
            } else {
                // Apply equipment-specific temperature validation
                switch (equipmentType) {
                    case 'boiler':
                        // Boiler temperatures should never be below freezing when active
                        // and rarely exceed 200°F for safety reasons
                        if (numValue < 32 || numValue > 200) {
                            isValid = false
                            validationMessage = `Boiler temperature outside expected range (32°F to 200°F)`
                        }
                        break

                    case 'chiller':
                        // Chiller temperatures typically operate between 35°F and 75°F
                        if (numValue < 35 || numValue > 75) {
                            isValid = false
                            validationMessage = `Chiller temperature outside expected range (35°F to 75°F)`
                        }
                        break

                    case 'residential_system':
                        // Residential systems typically operate between 45°F and 95°F
                        // for supply/return air, but water temps can be higher
                        if (metricName.toLowerCase().includes('water')) {
                            if (numValue < 40 || numValue > 180) {
                                isValid = false
                                validationMessage = `Residential water temperature outside expected range (40°F to 180°F)`
                            }
                        } else {
                            if (numValue < 45 || numValue > 95) {
                                isValid = false
                                validationMessage = `Residential air temperature outside expected range (45°F to 95°F)`
                            }
                        }
                        break

                    case 'steam_bundle':
                        // Steam temperatures typically range from 100°F to 212°F
                        if (numValue < 100 || numValue > 220) {
                            isValid = false
                            validationMessage = `Steam temperature outside expected range (100°F to 220°F)`
                        }
                        break
                }
            }
            break

        case 'pressure':
            // General pressure validation (assuming PSI)
            if (numValue < 0 || numValue > 200) {
                isValid = false
                validationMessage = `Pressure outside physical range (0 to 200 PSI)`
            } else {
                // Equipment-specific pressure validation
                switch (equipmentType) {
                    case 'boiler':
                        // Typical boiler pressure ranges from 5-30 PSI for residential,
                        // and up to 150 PSI for commercial
                        if (systemId && systemId.toLowerCase().includes('residential')) {
                            if (numValue < 5 || numValue > 30) {
                                isValid = false
                                validationMessage = `Residential boiler pressure outside expected range (5 to 30 PSI)`
                            }
                        } else if (numValue < 5 || numValue > 150) {
                            isValid = false
                            validationMessage = `Commercial boiler pressure outside expected range (5 to 150 PSI)`
                        }
                        break

                    case 'chiller':
                        // Chiller refrigerant pressures vary by refrigerant type,
                        // but generally stay between 50-250 PSI
                        if (numValue < 50 || numValue > 250) {
                            isValid = false
                            validationMessage = `Chiller pressure outside expected range (50 to 250 PSI)`
                        }
                        break
                }
            }
            break

        case 'humidity':
            // Humidity must be between 0-100%
            if (numValue < 0 || numValue > 100) {
                isValid = false
                validationMessage = `Humidity outside physical range (0% to 100%)`
            }
            break

        case 'flow':
            // Flow must be non-negative and has reasonable upper bounds
            // depending on the system
            if (numValue < 0) {
                isValid = false
                validationMessage = `Flow cannot be negative`
            } else if (numValue > 5000) {
                // Generic high limit for any flow
                isValid = false
                validationMessage = `Flow exceeds maximum expected value`
            } else {
                // System-specific flow validation
                switch (equipmentType) {
                    case 'residential_system':
                        // Residential flow rates typically don't exceed a few dozen GPM
                        if (numValue > 50) {
                            isValid = false
                            validationMessage = `Residential flow rate exceeds expected maximum (50 GPM)`
                        }
                        break

                    case 'boiler':
                        // Commercial boiler flow rates are higher but still have limits
                        if (numValue > 500) {
                            isValid = false
                            validationMessage = `Boiler flow rate exceeds expected maximum (500 GPM)`
                        }
                        break
                }
            }
            break

        case 'voltage':
            // Common voltage levels: 5V, 12V, 24V, 120V, 208V, 240V, 480V
            // Allow some fluctuation but catch values outside physical ranges
            if (numValue < 0 || numValue > 600) {
                isValid = false
                validationMessage = `Voltage outside physical range (0V to 600V)`
            }
            break

        case 'current':
            // Current (amps) validation depends on the equipment type
            if (numValue < 0) {
                isValid = false
                validationMessage = `Current cannot be negative`
            } else {
                switch (equipmentType) {
                    case 'residential_system':
                        // Typical residential equipment rarely exceeds 30A
                        if (numValue > 50) {
                            isValid = false
                            validationMessage = `Residential current exceeds expected maximum (50A)`
                        }
                        break

                    case 'boiler':
                    case 'chiller':
                        // Commercial equipment can pull higher current
                        if (numValue > 200) {
                            isValid = false
                            validationMessage = `Commercial equipment current exceeds expected maximum (200A)`
                        }
                        break
                }
            }
            break

        // Add more specific metric types as needed

        default:
            // For unknown metric types, apply basic sanity checks
            if (Math.abs(numValue) > 1000) {
                isValid = false
                validationMessage = `Value outside reasonable range for unknown metric type`
            }
    }

    // If value failed validation, log and return null
    if (!isValid) {
        console.log(`❌ REJECTED ${metricName}: ${numValue} - ${validationMessage}`)
        return null
    }

    // Value passed all validation checks
    console.log(`✅ Validated ${metricType} value for ${metricName}: ${numValue}`)
    return numValue
}

// Function to validate rate of change between readings
function validateRateOfChange(equipmentId, metricName, currentValue, metricType) {
    const key = `${equipmentId}-${metricName}`

    // If we don't have a previous reading, store this one and return true
    if (!lastValidReadings[key]) {
        lastValidReadings[key] = {
            value: currentValue,
            timestamp: Date.now()
        }
        console.log(`📝 First reading for ${metricName}, saving as baseline`)
        return true
    }

    const previousReading = lastValidReadings[key]
    const timeDiffSeconds = (Date.now() - previousReading.timestamp) / 1000
    const valueDiff = Math.abs(currentValue - previousReading.value)

    // Don't validate if readings are too far apart (more than 10 minutes)
    if (timeDiffSeconds > 600) {
        console.log(`⏱️ Readings are ${(timeDiffSeconds / 60).toFixed(1)} minutes apart - too long to validate rate of change, accepting value`)
        lastValidReadings[key] = {
            value: currentValue,
            timestamp: Date.now()
        }
        return true
    }

    // Define maximum allowable rate of change per second for different metric types
    let maxRateOfChange

    switch (metricType) {
        case 'temperature':
            // Temperature shouldn't change more than 5°F per minute in most HVAC systems
            // So that's about 0.083°F per second
            maxRateOfChange = 0.083
            break

        case 'pressure':
            // Pressure shouldn't change more than 5 PSI per minute
            // So that's about 0.083 PSI per second
            maxRateOfChange = 0.083
            break

        case 'humidity':
            // Humidity typically changes slowly, maybe 2% per minute at most
            // So that's about 0.033% per second
            maxRateOfChange = 0.033
            break

        case 'flow':
            // Flow can change more rapidly, maybe 20% of max flow per minute
            // This is very system-dependent
            maxRateOfChange = 0.5 // Higher to allow for flow changes
            break

        default:
            // Default to a reasonable value for unknown metrics
            maxRateOfChange = 0.1
    }

    // Calculate the actual rate of change per second
    const rateOfChange = valueDiff / timeDiffSeconds

    // If the rate of change exceeds our maximum, reject the value
    if (rateOfChange > maxRateOfChange * 60) { // Convert to per-minute for easier reading
        console.log(`❌ REJECTED ${metricName}: ${currentValue} - Rate of change too high (${rateOfChange.toFixed(2)} per minute vs max ${(maxRateOfChange * 60).toFixed(2)})`)
        // Don't update the last valid reading since this one failed
        return false
    }

    // Update the last valid reading
    lastValidReadings[key] = {
        value: currentValue,
        timestamp: Date.now()
    }

    console.log(`✅ Rate of change for ${metricName} is acceptable: ${rateOfChange.toFixed(4)} per second`)
    return true
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
        let alarmsCreated = 0

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

                // Get equipment type - either from a dedicated field or infer from name/system
                const equipmentType = equipmentData.type ||
                    (equipmentData.name && equipmentData.name.toLowerCase().includes('boiler') ? 'boiler' :
                        (equipmentData.name && equipmentData.name.toLowerCase().includes('steam') ? 'steam_bundle' :
                            (equipmentData.name && equipmentData.name.toLowerCase().includes('residential') ? 'residential_system' : 'unknown')))

                console.log(`🔧 Equipment type: ${equipmentType}`)

                // Get outdoor temperature for this location
                const outdoorTemp = await getOutdoorTemperature(locationId, rtdbData)

                // Calculate dynamic thresholds based on outdoor temperature
                const { adjustedMin, adjustedMax } = calculateDynamicThresholds(
                    currentMinThreshold,
                    currentMaxThreshold,
                    equipmentType,
                    outdoorTemp,
                    threshold.metricName
                )

                // Try to get the metric value from RTDB using the improved function
                let currentValue = getMetricValue(locationId, systemId, threshold.metricName, rtdbData)
                let metricSource = ""

                if (currentValue !== null) {
                    metricSource = "RTDB"
                    console.log(`📈 Raw value for ${threshold.metricName}: ${currentValue} (source: ${metricSource})`)

                    // Validate the metric value before processing
                    currentValue = validateMetricValue(currentValue, threshold.metricName, equipmentType, systemId)

                    if (currentValue !== null) {
                        // If the value passed basic validation, check the rate of change
                        const metricType = getMetricType(threshold.metricName)
                        const rateValid = validateRateOfChange(threshold.equipmentId, threshold.metricName, currentValue, metricType)

                        if (!rateValid) {
                            // Skip this reading if the rate of change is invalid
                            console.log(`⚠️ Skipping threshold check for ${threshold.metricName} - rate of change invalid`)
                            continue
                        }

                        metricsFound++
                        console.log(`✅ Validated value for ${threshold.metricName}: ${currentValue}`)
                    } else {
                        console.log(`❌ Invalid value detected for ${threshold.metricName}, skipping threshold check`)
                        continue // Skip to the next threshold check
                    }
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
                        // Extract the raw value
                        const rawValue = typeof firestoreValue.value !== "undefined"
                            ? firestoreValue.value
                            : firestoreValue.current

                        console.log(`📈 Raw value from Firestore for ${threshold.metricName}: ${rawValue}`)

                        // Validate the value
                        currentValue = validateMetricValue(rawValue, threshold.metricName, equipmentType, systemId)

                        if (currentValue !== null) {
                            // If the value passed basic validation, check the rate of change
                            const metricType = getMetricType(threshold.metricName)
                            const rateValid = validateRateOfChange(threshold.equipmentId, threshold.metricName, currentValue, metricType)

                            if (!rateValid) {
                                // Skip this reading if the rate of change is invalid
                                console.log(`⚠️ Skipping threshold check for ${threshold.metricName} - rate of change invalid`)
                                continue
                            }

                            metricsFound++
                            metricSource = "Firestore"
                            console.log(`✅ Validated value for ${threshold.metricName}: ${currentValue} (source: ${metricSource})`)
                        } else {
                            console.log(`❌ Invalid value detected in Firestore for ${threshold.metricName}, skipping threshold check`)
                            continue // Skip to the next threshold check
                        }
                    } else {
                        console.log(`❌ Metric not found in Firestore either`)
                    }
                }

                // Skip if no valid metric value found
                if (currentValue === null) {
                    console.log(`⚠️ Skipping alarm creation for ${threshold.metricName} - no valid metric value found`)
                    continue
                }

                // Check if value exceeds thresholds - USING ADJUSTED THRESHOLD VALUES
                let severity = null
                let message = ""

                // Check against adjusted min/max thresholds
                if (adjustedMax !== undefined && currentValue !== null && currentValue > adjustedMax) {
                    severity = "critical"
                    thresholdsExceeded++
                    message = `${threshold.metricName} value of ${currentValue} exceeds adjusted maximum threshold of ${adjustedMax}`
                    if (adjustedMax !== currentMaxThreshold) {
                        message += ` (base: ${currentMaxThreshold}, adjusted for outdoor temp: ${outdoorTemp}°F)`
                    }
                    console.log(`🚨 THRESHOLD EXCEEDED (MAX): ${currentValue} > ${adjustedMax}`)
                } else if (adjustedMin !== undefined && currentValue !== null && currentValue < adjustedMin) {
                    severity = "warning"
                    thresholdsExceeded++
                    message = `${threshold.metricName} value of ${currentValue} is below adjusted minimum threshold of ${adjustedMin}`
                    if (adjustedMin !== currentMinThreshold) {
                        message += ` (base: ${currentMinThreshold}, adjusted for outdoor temp: ${outdoorTemp}°F)`
                    }
                    console.log(`⚠️ THRESHOLD EXCEEDED (MIN): ${currentValue} < ${adjustedMin}`)
                } else if (currentValue !== null) {
                    console.log(
                        `✅ Value is within acceptable range: ${currentValue} (adjusted min: ${adjustedMin}, adjusted max: ${adjustedMax})`
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

                        // Get a better equipment name
                        let equipmentName = "Unknown Equipment"
                        if (equipmentData.name) {
                            equipmentName = equipmentData.name
                        } else if (equipmentData.system) {
                            equipmentName = equipmentData.system
                        } else if (equipmentData.type) {
                            equipmentName = `${equipmentData.type} System`
                        } else if (threshold.metricName.includes("Boiler")) {
                            equipmentName = "Boiler System"
                        } else if (threshold.metricName.includes("Chiller")) {
                            equipmentName = "Chiller System"
                        } else if (threshold.metricName.includes("Steam")) {
                            equipmentName = "Steam System"
                        }

                        console.log(`Using equipment name: ${equipmentName}`)

                        // Create new alarm with the resolved location name and better equipment name
                        const alarmData = {
                            name: `${threshold.metricName} Threshold Exceeded`,
                            equipmentId: threshold.equipmentId,
                            equipmentName: equipmentName,
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
                        alarmsCreated++

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
   - Time: ${checkTime.toLocaleTimeString('en-US', { timeZone: 'America/New_York' })}
   - Thresholds checked: ${metricsChecked}
   - Metrics found: ${metricsFound}
   - Thresholds exceeded: ${thresholdsExceeded}
   - Alarms created: ${alarmsCreated}
   `)
    } catch (error) {
        console.error("❌ Error in monitorEquipmentMetrics:", error)
    }
}

// Function to get seasonal threshold rules from Firestore (for future expansion)
async function getSeasonalThresholdRules() {
    try {
        const rulesSnapshot = await getDocs(collection(db, "seasonalThresholdRules"))
        const rules = []

        rulesSnapshot.forEach(doc => {
            rules.push({
                id: doc.id,
                ...doc.data()
            })
        })

        console.log(`Loaded ${rules.length} seasonal threshold rules`)
        return rules
    } catch (error) {
        console.error("Error loading seasonal threshold rules:", error)
        return []
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

        // Test outdoor temperature retrieval for a few locations
        console.log("🌡️ Testing outdoor temperature retrieval...")
        try {
            // Get some location IDs to test with
            const locationsSnapshot = await getDocs(collection(db, "locations"));
            const locationIds = locationsSnapshot.docs.map(doc => doc.id).slice(0, 3); // Test first 3 locations
            
            // Get RTDB data
            const locationsRef = ref(rtdb, "/locations")
            const snapshot = await get(locationsRef)
            const rtdbData = snapshot.val() || {}
            
            for (const locationId of locationIds) {
                console.log(`Testing outdoor temperature for location: ${locationId}`);
                const temp = await getOutdoorTemperature(locationId, rtdbData);
                console.log(`Result for ${locationId}: ${temp !== null ? temp + '°F' : 'Temperature not found'}`);
            }
        } catch (tempTestError) {
            console.error("Error testing outdoor temperature:", tempTestError);
        }

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
