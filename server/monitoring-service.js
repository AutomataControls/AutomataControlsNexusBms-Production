// /server/monitoring-service.js - Updated for InfluxDB3
// Load environment variables from .env file
require("dotenv").config()
const path = require("path")

// Also try to load from .env.local if it exists
try {
    require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") })
} catch (error) {
    console.log("No .env.local file found, using .env")
}

// Import Firebase modules (only for Firestore)
const { getFirestore, collection, doc, getDoc, getDocs, addDoc, query, where, limit } = require("firebase/firestore")
const fetch = require("node-fetch")

// Import the InfluxDB3 metric mappings
const { mapMetricNameToInfluxColumn, getAlternativeColumnNames } = require("./influx-metric-mappings")

console.log("🔄 Initializing monitoring service for InfluxDB3...")

// Debug environment variables
console.log("Checking environment variables:")
console.log("- APP_URL:", process.env.APP_URL || "http://localhost:3000")
console.log("- NEXT_PUBLIC_FIREBASE_PROJECT_ID:", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? "Set" : "Not set")

// Use existing Firebase instances if they exist, otherwise initialize them
let db

// Function to initialize Firebase if not already initialized
function initializeFirebase() {
    // Check if Firebase is already initialized
    if (global.firebaseApp) {
        console.log("Using existing Firebase instance")
        db = getFirestore(global.firebaseApp)
        return
    }

    // Import Firebase app initialization only if needed
    const { initializeApp } = require("firebase/app")

    // Initialize primary Firebase (for Firestore only)
    const firebaseConfig = {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    }

    try {
        // Initialize primary Firebase app
        global.firebaseApp = initializeApp(firebaseConfig)
        // Get Firestore instance using the modular API
        db = getFirestore(global.firebaseApp)
        console.log("✅ Firebase initialized successfully")
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

// InfluxDB query function using Next.js API proxy
async function queryInfluxDB(query) {
    try {
        const appUrl = process.env.APP_URL || "http://localhost:3000"
        console.log(`🔍 Querying InfluxDB via Next.js API: ${appUrl}/api/influx`)
        console.log(`📝 Query: ${query}`)
        
        const response = await fetch(`${appUrl}/api/influx`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: query })
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`InfluxDB query failed: ${response.status} ${response.statusText} - ${errorText}`)
        }

        const result = await response.json()
        
        if (!result.success) {
            throw new Error(result.error || 'InfluxDB query failed')
        }

        console.log(`✅ Query successful, returned ${result.data?.length || 0} rows`)
        return result.data || []
    } catch (error) {
        console.error("InfluxDB query error:", error)
        return null
    }
}

// Function to get metric value from InfluxDB3
async function getMetricValueFromInflux(locationId, equipmentId, metricName) {
    try {
        console.log(`🔍 Querying InfluxDB for ${metricName} from equipment ${equipmentId} at location ${locationId}`)
        
        // Get recent data for this equipment
        const exploreQuery = `
            SELECT *
            FROM metrics
            WHERE location_id = '${locationId}'
            AND "equipmentId" = '${equipmentId}'
            AND time >= now() - INTERVAL '15 minutes'
            ORDER BY time DESC
            LIMIT 1
        `

        const result = await queryInfluxDB(exploreQuery)
        
        if (result && result.length > 0) {
            const row = result[0]
            console.log(`📊 Available columns for equipment ${equipmentId}:`, Object.keys(row))
            
            // Map the metric name to actual column name
            const actualColumnName = mapMetricNameToInfluxColumn(metricName)
            console.log(`📝 Mapped "${metricName}" to column "${actualColumnName}"`)
            
            // Try the mapped column name first
            if (row[actualColumnName] !== null && row[actualColumnName] !== undefined) {
                const value = row[actualColumnName]
                console.log(`✅ Found ${metricName} as ${actualColumnName}: ${value}`)
                return value
            }

            // Try alternative names
            const alternativeNames = getAlternativeColumnNames(metricName)
            console.log(`🔍 Trying alternative names:`, alternativeNames)

            for (const altName of alternativeNames) {
                if (row[altName] !== null && row[altName] !== undefined) {
                    const value = row[altName]
                    console.log(`✅ Found ${metricName} as ${altName}: ${value}`)
                    return value
                }
            }

            // Try partial matches (for complex metric names)
            for (const [key, value] of Object.entries(row)) {
                if (key.toLowerCase().includes(actualColumnName.toLowerCase()) || 
                    actualColumnName.toLowerCase().includes(key.toLowerCase())) {
                    if (value !== null && value !== undefined) {
                        console.log(`✅ Found partial match: ${key} = ${value} for metric ${metricName}`)
                        return value
                    }
                }
            }

            console.log(`❌ Metric ${metricName} (${actualColumnName}) not found in available columns:`, Object.keys(row))
        } else {
            console.log(`❌ No recent data found for equipment ${equipmentId} at location ${locationId}`)
        }

        return null
    } catch (error) {
        console.error(`Error querying InfluxDB for ${metricName}:`, error)
        return null
    }
}

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

            // Process thresholds based on their structure
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

        // Fetch all recipients
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

        // Map recipients to locations
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
        locationRecipients = recipientMap

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

// Function to get location name from ID
async function getLocationName(locationId) {
    if (!locationId) return null

    try {
        // Try to get from Firestore
        const locationQuery = query(collection(db, "locations"), where("id", "==", locationId), limit(1))
        const locationSnapshot = await getDocs(locationQuery)

        if (!locationSnapshot.empty) {
            const name = locationSnapshot.docs[0].data().name
            return name || locationId
        }

        return locationId
    } catch (error) {
        console.error("Error getting location name:", error)
        return locationId
    }
}

// Enhanced function to get outdoor temperature for a location
async function getOutdoorTemperature(locationId) {
    try {
        console.log(`🌡️ Attempting to get outdoor temperature for location ${locationId}`);

        // Check cache first
        const now = Date.now();
        if (outdoorTempCache[locationId] && (now - outdoorTempCache[locationId].timestamp) < TEMP_CACHE_TTL) {
            console.log(`Using cached outdoor temperature for ${locationId}: ${outdoorTempCache[locationId].temperature}°F`);
            return outdoorTempCache[locationId].temperature;
        }

        // 1. First try to get from OpenWeatherMap API
        try {
            // Get location weather settings
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

        // 2. Try to get outdoor temperature from InfluxDB metrics
        console.log(`Checking InfluxDB for outdoor temperature metrics for location ${locationId}`);
        try {
            // Query for outdoor temperature metrics
            const outdoorTempQuery = `
                SELECT outdoorAir, Outdoor_Air, OutdoorTemp, outdoor_temp, time
                FROM metrics
                WHERE location_id = '${locationId}'
                AND time >= now() - INTERVAL '1 hour'
                ORDER BY time DESC
                LIMIT 5
            `;

            const result = await queryInfluxDB(outdoorTempQuery);
            
            if (result && result.length > 0) {
                for (const row of result) {
                    const temperature = row.outdoorAir || row.Outdoor_Air || row.OutdoorTemp || row.outdoor_temp;
                    
                    if (temperature !== null && temperature !== undefined && !isNaN(parseFloat(temperature))) {
                        const temp = parseFloat(temperature);
                        console.log(`Found outdoor temperature in InfluxDB: ${temp}°F`);

                        // Cache the result
                        outdoorTempCache[locationId] = {
                            temperature: temp,
                            timestamp: now,
                            source: 'influxdb'
                        };

                        return temp;
                    }
                }
            }
        } catch (error) {
            console.error("Error checking InfluxDB for outdoor temperature:", error);
        }

        // 3. Last resort - use a seasonal default temp based on month
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
                    adjustedMin = 60
                    adjustedMax = Math.max(baseMaxThreshold, 160)
                    console.log(`Adjusted boiler thresholds for warm weather (outdoor: ${outdoorTemp}°F): Min: ${adjustedMin}, Max: ${adjustedMax}`)
                } else {
                    adjustedMin = Math.max(baseMinThreshold, 120)
                    adjustedMax = Math.min(baseMaxThreshold, 180)

                    if (outdoorTemp < 20) {
                        const coldAdjustment = Math.max(0, (20 - outdoorTemp)) * 1.0;
                        adjustedMin = Math.min(160, Math.max(baseMinThreshold, 120 + coldAdjustment));
                        console.log(`Cold weather adjustment applied: +${coldAdjustment.toFixed(1)}°F to minimum threshold`);
                    }

                    console.log(`Adjusted boiler thresholds for cold weather (outdoor: ${outdoorTemp}°F): Min: ${adjustedMin}, Max: ${adjustedMax}`)
                }
                break

            case 'steam_bundle':
                if (outdoorTemp >= 50) {
                    adjustedMin = Math.min(baseMinThreshold, 70)
                    if (outdoorTemp > 70) {
                        const reductionFactor = Math.min(30, (outdoorTemp - 70) * 1.5);
                        adjustedMax = Math.max(140, baseMaxThreshold - reductionFactor);
                        console.log(`Hot weather adjustment for steam bundle: -${reductionFactor.toFixed(1)}°F to maximum threshold`);
                    }
                    console.log(`Adjusted steam bundle thresholds for warm weather (outdoor: ${outdoorTemp}°F): Min: ${adjustedMin}, Max: ${adjustedMax}`)
                } else {
                    const coldAdjustment = Math.max(0, (50 - outdoorTemp) * 0.5);
                    adjustedMin = Math.min(120, Math.max(baseMinThreshold, baseMinThreshold + coldAdjustment));
                    console.log(`Adjusted steam bundle thresholds for cold weather (outdoor: ${outdoorTemp}°F): Min: ${adjustedMin}, Max: ${adjustedMax}`)
                }
                break

            default:
                if (outdoorTemp >= 60) {
                    if (baseMinThreshold > 80) {
                        adjustedMin = 60
                        console.log(`Applied general warm weather adjustment (outdoor: ${outdoorTemp}°F): Min: ${adjustedMin}`)
                    }
                } else if (outdoorTemp <= 30) {
                    if (baseMinThreshold > 80) {
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

// Enhanced validation function
function validateMetricValue(value, metricName, equipmentType, systemId) {
    if (value === null || value === undefined) {
        console.log(`❌ REJECTED ${metricName}: Value is null or undefined`)
        return null
    }

    const numValue = typeof value === 'number' ? value : Number(value)

    if (isNaN(numValue)) {
        console.log(`❌ REJECTED ${metricName}: Value "${value}" is not a valid number`)
        return null
    }

    if (Math.abs(numValue) > 10000) {
        console.log(`❌ REJECTED ${metricName}: Value ${numValue} is an extreme outlier (absolute value > 10000)`)
        return null
    }

    // Apply basic validation based on metric name
    const metricNameLower = metricName.toLowerCase()
    
    if (metricNameLower.includes('temp') || metricNameLower.includes('temperature')) {
        if (numValue < -50 || numValue > 250) {
            console.log(`❌ REJECTED ${metricName}: Temperature ${numValue} outside physical range (-50°F to 250°F)`)
            return null
        }
    } else if (metricNameLower.includes('pressure')) {
        if (numValue < 0 || numValue > 200) {
            console.log(`❌ REJECTED ${metricName}: Pressure ${numValue} outside physical range (0 to 200 PSI)`)
            return null
        }
    } else if (metricNameLower.includes('humidity') || metricNameLower.includes('rh')) {
        if (numValue < 0 || numValue > 100) {
            console.log(`❌ REJECTED ${metricName}: Humidity ${numValue} outside physical range (0% to 100%)`)
            return null
        }
    }

    console.log(`✅ Validated value for ${metricName}: ${numValue}`)
    return numValue
}

// Function to validate rate of change between readings
function validateRateOfChange(equipmentId, metricName, currentValue, metricType) {
    const key = `${equipmentId}-${metricName}`

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

    if (timeDiffSeconds > 600) {
        console.log(`⏱️ Readings are ${(timeDiffSeconds / 60).toFixed(1)} minutes apart - too long to validate rate of change, accepting value`)
        lastValidReadings[key] = {
            value: currentValue,
            timestamp: Date.now()
        }
        return true
    }

    // Define maximum allowable rate of change per second
    let maxRateOfChange = 0.1 // Default

    if (metricName.toLowerCase().includes('temp')) {
        maxRateOfChange = 0.083 // ~5°F per minute
    } else if (metricName.toLowerCase().includes('pressure')) {
        maxRateOfChange = 0.083 // ~5 PSI per minute
    }

    const rateOfChange = valueDiff / timeDiffSeconds

    if (rateOfChange > maxRateOfChange * 60) {
        console.log(`❌ REJECTED ${metricName}: ${currentValue} - Rate of change too high (${rateOfChange.toFixed(2)} per minute vs max ${(maxRateOfChange * 60).toFixed(2)})`)
        return false
    }

    lastValidReadings[key] = {
        value: currentValue,
        timestamp: Date.now()
    }

    console.log(`✅ Rate of change for ${metricName} is acceptable: ${rateOfChange.toFixed(4)} per second`)
    return true
}

// Function to send alarm email
async function sendAlarmEmail(alarmData, alarmId) {
    try {
        const locationId = alarmData.locationId
        const locationName = alarmData.locationName

        console.log(`Sending alarm email for location: ${locationName} (ID: ${locationId})`)

        // Get technicians and recipients for this location
        let techs = locationTechnicians[locationId] || []
        let recipients = locationRecipients[locationId] || []

        // If no recipients found, query Firestore directly
        if (recipients.length === 0) {
            console.log(`No recipients found in cache, querying Firestore directly`)
            try {
                const recipientsQuery = query(collection(db, "recipients"), where("locationId", "==", locationId), limit(10))
                const recipientsSnapshot = await getDocs(recipientsQuery)

                if (!recipientsSnapshot.empty) {
                    console.log(`Found ${recipientsSnapshot.docs.length} recipients by locationId ${locationId} in Firestore`)
                    recipients = recipientsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
                }
            } catch (error) {
                console.error("Error querying recipients from Firestore:", error)
            }
        }

        // Combine emails from both groups
        const techEmails = techs.map((tech) => tech.email).filter(Boolean)
        const recipientEmails = recipients.map((recipient) => recipient.email).filter(Boolean)
        let allEmails = [...new Set([...techEmails, ...recipientEmails])]

        // Get tech names for the email
        const techNames = techs.map((tech) => tech.name).join(", ")

        // Skip email sending if no recipients
        if (allEmails.length === 0) {
            console.log(`Skipping email send - no recipients found for location ${locationName} (${locationId})`)
            return
        }

        console.log(`Sending alarm email to ${allEmails.length} recipients for alarm ${alarmId}`)
        console.log(`Recipients: ${allEmails.join(", ")}`)

        try {
            const appUrl = process.env.APP_URL || "http://localhost:3000"
            const response = await fetch(`${appUrl}/api/send-alarm-email`, {
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

// Function to monitor equipment metrics using InfluxDB3
async function monitorEquipmentMetrics() {
    try {
        console.log("🔍 monitorEquipmentMetrics called with", {
            thresholdCount: thresholdSettings.length,
        })

        if (!thresholdSettings.length) {
            console.log("Cannot monitor metrics - no thresholds configured")
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

                // Re-verify the threshold values from the equipment document
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

                // Get equipment type
                const equipmentType = equipmentData.type ||
                    (equipmentData.name && equipmentData.name.toLowerCase().includes('boiler') ? 'boiler' :
                        (equipmentData.name && equipmentData.name.toLowerCase().includes('steam') ? 'steam_bundle' :
                            (equipmentData.name && equipmentData.name.toLowerCase().includes('residential') ? 'residential_system' : 'unknown')))

                console.log(`🔧 Equipment type: ${equipmentType}`)

                // Get outdoor temperature for this location
                const outdoorTemp = await getOutdoorTemperature(locationId)

                // Calculate dynamic thresholds based on outdoor temperature
                const { adjustedMin, adjustedMax } = calculateDynamicThresholds(
                    currentMinThreshold,
                    currentMaxThreshold,
                    equipmentType,
                    outdoorTemp,
                    threshold.metricName
                )

                // Get the metric value from InfluxDB3
                let currentValue = await getMetricValueFromInflux(locationId, threshold.equipmentId, threshold.metricName)

                if (currentValue !== null) {
                    console.log(`📈 Raw value for ${threshold.metricName}: ${currentValue} (source: InfluxDB)`)

                    // Validate the metric value before processing
                    currentValue = validateMetricValue(currentValue, threshold.metricName, equipmentType, systemId)

                    if (currentValue !== null) {
                        // If the value passed basic validation, check the rate of change
                        const rateValid = validateRateOfChange(threshold.equipmentId, threshold.metricName, currentValue, 'temperature')

                        if (!rateValid) {
                            console.log(`⚠️ Skipping threshold check for ${threshold.metricName} - rate of change invalid`)
                            continue
                        }

                        metricsFound++
                        console.log(`✅ Validated value for ${threshold.metricName}: ${currentValue}`)
                    } else {
                        console.log(`❌ Invalid value detected for ${threshold.metricName}, skipping threshold check`)
                        continue
                    }
                } else {
                    console.log(`❌ Metric ${threshold.metricName} not found in InfluxDB`)
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
                        let locationName = equipmentData.locationName || equipmentData.location || await getLocationName(locationId)

                        // Get a better equipment name
                        let equipmentName = equipmentData.name || equipmentData.system || "Unknown Equipment"

                        console.log(`Using equipment name: ${equipmentName}`)
                        console.log(`Using location name: ${locationName}`)

                        // Create new alarm
                        const alarmData = {
                            name: `${threshold.metricName} Threshold Exceeded`,
                            equipmentId: threshold.equipmentId,
                            equipmentName: equipmentName,
                            locationId: locationId,
                            locationName: locationName,
                            severity,
                            message,
                            active: true,
                            acknowledged: false,
                            resolved: false,
                            timestamp: new Date(),
                        }

                        console.log(`Creating alarm with location name: "${locationName}" and ID: "${locationId}"`)

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

        // Test InfluxDB connection via Next.js API
        console.log("🔍 Testing InfluxDB connection via Next.js API...")
        try {
            const testQuery = "SELECT COUNT(*) as count FROM metrics WHERE time >= now() - INTERVAL '1 hour'"
            const testResult = await queryInfluxDB(testQuery)
            if (testResult && testResult.length > 0) {
                console.log(`✅ InfluxDB connection via Next.js API successful. Found ${testResult[0].count} recent metrics.`)
            } else {
                console.log("⚠️ InfluxDB connection successful but no recent metrics found.")
            }
        } catch (error) {
            console.error("❌ InfluxDB connection test failed:", error)
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

// Initialize and start monitoring
initializeMonitoring()
