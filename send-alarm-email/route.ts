import { NextResponse } from "next/server"
import { Resend } from "resend"
import { AlarmNotification } from "@/emails/alarm-notification"
import { initializeApp } from "firebase/app"
import { getDatabase, ref, get } from "firebase/database"
import { getFirestore, collection, query, where, getDocs, limit } from "firebase/firestore"

const resend = new Resend(process.env.RESEND_API_KEY)

// Enable detailed email debugging
const DEBUG_EMAIL = true;

// Default recipients who should always receive alarm emails
const DEFAULT_RECIPIENTS = ['youremail'];

// Initialize Firebase for RTDB access
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

// Hardcoded mapping for numeric location IDs
const LOCATION_ID_MAPPING: Record<string, string> = {
  "1": "HeritageWarren",
  "2": "StJudeCatholicSchool",
  "3": "ByrnaAmmunition",
  "4": "HeritageHuntington",
  "5": "HopbridgeAutismCenter",
  "6": "AkronCarnegiePublicLibrary",
  "7": "TaylorUniversity",
  "8": "ElementLabs",
  "9": "FirstChurchOfGod",
  "10": "NERealtyGroup",
  "11": "StJohnCatholicSchool",
  "12": "Residential"
}

// Function to format date in Eastern Time
function formatDateInET(date: Date): string {
  // Options for formatting the date in US Eastern Time
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: true
  };

  // Format the date
  return new Intl.DateTimeFormat('en-US', options).format(date);
}

// Function to get location name from ID - IMPROVED VERSION
async function getLocationNameFromId(locationId: string): Promise<string | null> {
  try {
    console.log(`Looking up location name for ID: ${locationId}`)

    // DIRECT MAPPING: Check if we have a hardcoded mapping for this ID
    if (LOCATION_ID_MAPPING[locationId]) {
      console.log(`Using hardcoded mapping for ID ${locationId}: ${LOCATION_ID_MAPPING[locationId]}`)
      return LOCATION_ID_MAPPING[locationId]
    }

    // Initialize Firebase if needed
    let app
    try {
      app = initializeApp(firebaseConfig, "email-api")
    } catch (error) {
      // App might already be initialized
      try {
        app = initializeApp(firebaseConfig, "email-api-" + Date.now())
      } catch (innerError) {
        console.error("Failed to initialize Firebase app:", innerError)
        // If we can't initialize Firebase, return the hardcoded mapping or the ID itself
        return LOCATION_ID_MAPPING[locationId] || `Location ${locationId}`
      }
    }

    const rtdb = getDatabase(app)
    const db = getFirestore(app)

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
      if ((value as any).id === locationId) {
        console.log(`Found location with matching ID field in RTDB: ${key}`)
        // If the location has a name field, use that
        if ((value as any).name) {
          console.log(`Using name from RTDB: ${(value as any).name}`)
          return (value as any).name
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
      const locationCollection = collection(db, "locations")
      const allLocationsSnapshot = await getDocs(locationCollection)

      for (const doc of allLocationsSnapshot.docs) {
        if (doc.id === locationId) {
          const data = doc.data()
          if (data.name) {
            console.log(`Found location document with matching ID and name: ${data.name}`)
            return data.name
          } else {
            console.log(`Found location document with matching ID but no name, using ID: ${locationId}`)
            return locationId
          }
        }
      }
    } catch (error) {
      console.error("Error checking Firestore documents:", error)
    }

    console.log(`No location found for ID: ${locationId} after exhaustive search`)

    // Final fallback: If it's a numeric ID, use our mapping or prefix with "Location"
    if (/^\d+$/.test(locationId)) {
      return LOCATION_ID_MAPPING[locationId] || `Location ${locationId}`
    }

    return locationId
  } catch (error) {
    console.error("Error getting location name:", error)
    // Even if we have an error, try to return something useful
    return LOCATION_ID_MAPPING[locationId] || `Location ${locationId}`
  }
}

// Improved function to check if an email belongs to a technician
function isTechnician(email: string): boolean {
  // Convert email to lowercase for case-insensitive comparison
  const emailLower = email.toLowerCase();
  
  // Log for debugging
  console.log(`Checking if ${emailLower} is a technician email`);
  
  // Check against specific domains
  const isTech = emailLower.endsWith('@yourdomain.com') || 
                emailLower.endsWith('@yourdomain.com') || 
                emailLower.endsWith('@yourdomain.com');
  
  console.log(`Result: ${isTech ? 'IS a technician' : 'is NOT a technician'}`);
  
  return isTech;
}

// Function to validate email address format
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Update the POST function to send individual emails to each recipient
export async function POST(request: Request) {
  try {
    const data = await request.json()
    const {
      alarmType,
      details,
      locationId,
      alarmId,
      severity,
      recipients,
      assignedTechs,
      locationName: originalLocationName,
      equipmentName: originalEquipmentName,
    } = data

    // Format timestamp in Eastern Time
    const timestamp = formatDateInET(new Date())
    console.log(`Formatted timestamp in ET: ${timestamp}`)

    // Dashboard URL
    const dashboardUrl = `${process.env.APP_URL || "https://yourdomain"}/dashboard/alarms`

    // Log the incoming data
    console.log("Received email request with data:", {
      locationId,
      originalLocationName,
      originalEquipmentName,
      severity,
      alarmType,
    })

    // Try to get the actual location name if we have a numeric ID
    let displayLocationName = originalLocationName

    // IMPORTANT: Always try to resolve the location name, even if we already have one
    if (locationId) {
      console.log(`Looking up location name for ID: ${locationId}`)

      // First check our hardcoded mapping
      if (LOCATION_ID_MAPPING[locationId]) {
        displayLocationName = LOCATION_ID_MAPPING[locationId]
        console.log(`Using hardcoded mapping for location: ${displayLocationName}`)
      } else {
        // Try to resolve from database
        const resolvedName = await getLocationNameFromId(locationId)
        if (resolvedName) {
          displayLocationName = resolvedName
          console.log(`Using resolved location name: ${displayLocationName}`)
        }
      }
    }

    // Ensure we have a fallback
    displayLocationName = displayLocationName || locationId || "Unknown Location"

    // Check if the location name is still numeric or looks like an ID
    if (/^\d+$/.test(displayLocationName) || displayLocationName === locationId) {
      console.log(`Warning: Location name still appears to be an ID: ${displayLocationName}`)
      // Add a prefix to make it clear this is an ID
      displayLocationName = `Location ${displayLocationName}`
    }

    // Make sure equipment name is not empty
    const displayEquipmentName = originalEquipmentName || "Unknown Equipment"

    console.log("Final location name for email:", displayLocationName)
    console.log("Final equipment name for email:", displayEquipmentName)

    // Track success and failures for all recipient emails
    const emailResults = []
    const emailErrors = []
    
    // Filter out invalid email addresses from the provided recipients
    let validRecipients = Array.isArray(recipients) 
      ? recipients.filter(email => isValidEmail(email))
      : (typeof recipients === 'string' && isValidEmail(recipients) ? [recipients] : [])
    
    // Add default recipients (always include these)
    DEFAULT_RECIPIENTS.forEach(defaultEmail => {
      if (!validRecipients.includes(defaultEmail)) {
        validRecipients.push(defaultEmail);
        console.log(`Added default recipient: ${defaultEmail}`);
      }
    });
    
    if (validRecipients.length === 0) {
      console.error("No valid recipients found:", recipients)
      return NextResponse.json({ 
        success: false, 
        error: "No valid recipients provided" 
      }, { status: 400 })
    }
    
    console.log(`Valid recipients (${validRecipients.length}):`, validRecipients)
    
    // Send individual emails to each recipient with the appropriate isTechnician flag
    for (const recipient of validRecipients) {
      // Determine if this recipient is a technician
      const recipientIsTechnician = isTechnician(recipient)
      console.log(`Sending email to ${recipient} (isTechnician: ${recipientIsTechnician})`)
      
      try {
        if (DEBUG_EMAIL) {
          console.log("-------------------------------------");
          console.log("EMAIL DEBUGGING - ATTEMPT STARTED");
          console.log(`Sending to: ${recipient}`);
          console.log(`Is technician: ${recipientIsTechnician}`);
          console.log("Using AlarmNotification props:", {
            alarmType,
            severity,
            details: details?.substring(0, 50) + (details?.length > 50 ? '...' : ''),
            locationName: displayLocationName,
            locationId: locationId || "",
            equipmentName: displayEquipmentName,
            timestamp,
            assignedTechs,
            alarmId,
            isTechnician: recipientIsTechnician
          });
        }

        // Send email with updated sender address and isTechnician flag
        const { data: emailData, error } = await resend.emails.send({
          from: "Automata Controls DevOps <yourdomain@yourdomain.com>",
          to: recipient,
          subject: `ALERT: ${severity.toUpperCase()} - ${alarmType} at ${displayLocationName}`,
          react: AlarmNotification({
            alarmType,
            severity,
            details,
            locationName: displayLocationName,
            locationId: locationId || "",
            equipmentName: displayEquipmentName,
            timestamp,
            assignedTechs,
            dashboardUrl,
            alarmId,
            isTechnician: recipientIsTechnician, // Pass the isTechnician flag
          }),
          text: `${severity.toUpperCase()} ALARM: ${alarmType}

${details}

Location: ${displayLocationName}
Equipment: ${displayEquipmentName}
Time: ${timestamp}
Assigned to: ${assignedTechs}
Alarm ID: ${alarmId}
${recipientIsTechnician ? `\nView in dashboard: ${dashboardUrl}` : ''}`, // Conditionally include the dashboard link in the text version
        })

        if (DEBUG_EMAIL) {
          console.log("Resend API Response:", { data: emailData, error });
        }

        if (error) {
          console.error(`❌ EMAIL ERROR for ${recipient}:`, error);
          emailErrors.push({ recipient, error: error.message });
        } else {
          console.log(`✅ EMAIL SENT SUCCESSFULLY to ${recipient} with ID: ${emailData?.id}`);
          emailResults.push({ recipient, messageId: emailData?.id });
        }
        
        if (DEBUG_EMAIL) {
          console.log("EMAIL DEBUGGING - ATTEMPT COMPLETED");
          console.log("-------------------------------------");
        }
      } catch (emailError: any) {
        console.error(`❌ EXCEPTION during email sending to ${recipient}:`, emailError);
        console.error(emailError.stack || "No stack trace available");
        emailErrors.push({ recipient, error: emailError.message });
      }
    }

    // Return results
    if (emailErrors.length > 0) {
      // Return partial success if some emails were sent successfully
      if (emailResults.length > 0) {
        return NextResponse.json({ 
          success: true, 
          partial: true, 
          successful: emailResults, 
          failed: emailErrors 
        }, { status: 207 }) // 207 Multi-Status
      }
      // Return error if all emails failed
      return NextResponse.json({ 
        success: false, 
        error: "Failed to send emails", 
        details: emailErrors 
      }, { status: 500 })
    }

    // All emails sent successfully
    return NextResponse.json({ 
      success: true, 
      results: emailResults 
    })
  } catch (error: any) {
    console.error("Error in send-alarm-email API:", error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
