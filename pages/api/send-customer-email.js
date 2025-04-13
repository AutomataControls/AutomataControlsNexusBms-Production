import nodemailer from "nodemailer"
import path from "path"
import fs from "fs"

// Hardcoded mapping for numeric location IDs
const LOCATION_ID_MAPPING = {
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
function formatDateInET(date) {
  // Options for formatting the date in US Eastern Time
  const options = {
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

// Function to get location name from ID
function getLocationName(locationId) {
  // If we have a direct mapping for this ID, use it
  if (LOCATION_ID_MAPPING[locationId]) {
    console.log(`📧 Found direct mapping for location ID ${locationId}: ${LOCATION_ID_MAPPING[locationId]}`)
    return LOCATION_ID_MAPPING[locationId]
  }

  // If it's a numeric ID, add a prefix
  if (/^\d+$/.test(locationId)) {
    console.log(`📧 Location ID ${locationId} is numeric but not in mapping, adding prefix`)
    return `Location ${locationId}`
  }

  // Otherwise, just return the ID as is
  return locationId
}

export default async function handler(req, res) {
  console.log("📧 Customer Email API route called")

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  const {
    alarmType,
    details,
    locationId,
    locationName: originalLocationName,
    equipmentName = "Unknown Equipment",
    severity = "warning",
    alarmId,
    contactEmail,
    assignedTechs
  } = req.body

  console.log("📧 Customer Email request received:", {
    alarmType,
    locationId,
    originalLocationName,
    equipmentName,
    severity,
    contactEmail,
    assignedTechs
  })

  // Validate that contactEmail is provided
  if (!contactEmail) {
    console.error("📧 ERROR: No contact email provided")
    return res.status(400).json({ error: "Contact email is required" })
  }

  try {
    // Resolve location name
    const displayLocationName = originalLocationName || getLocationName(locationId) || "Unknown Location"
    console.log(`📧 Using location name: ${displayLocationName}`)

    // Format timestamp in Eastern Time
    const timestamp = formatDateInET(new Date())
    console.log(`📧 Formatted timestamp in ET: ${timestamp}`)

    // Get alarm severity color
    const getAlarmColor = (sev) => {
      switch (sev) {
        case "critical":
          return "#cc0000"
        case "warning":
          return "#ff9900"
        case "info":
          return "#3366cc"
        default:
          return "#666666"
      }
    }

    // Check if email credentials are set
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.error("📧 ERROR: Email credentials not set. Using fallback credentials for testing")
      // For testing purposes only - in production, use environment variables
      process.env.EMAIL_USER = "automatacontrols@gmail.com"
      process.env.EMAIL_PASSWORD = "sifp edkq nvdm vlmj" // This is just for testing
    }

    // Gmail SMTP configuration
    console.log("📧 Creating Gmail transporter with user:", process.env.EMAIL_USER)
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false, // true for 465, false for 587
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    })

    // Verify transporter connection
    console.log("📧 Verifying connection to Gmail SMTP server...")
    try {
      await transporter.verify()
      console.log("📧 Gmail SMTP connection verified successfully")
    } catch (verifyError) {
      console.error("📧 ERROR: Could not connect to Gmail SMTP server:", verifyError)
      return res.status(500).json({ error: "Failed to connect to Gmail SMTP server", details: verifyError.message })
    }

    // Path to logo file - adjust this to the actual path of your logo
    const logoPath = path.join(process.cwd(), 'public', 'neural-loader.png')
    console.log(`📧 Looking for logo at: ${logoPath}`)

    // Send email with improved HTML template
    console.log(`📧 Sending customer email to: ${contactEmail}`)
    const info = await transporter.sendMail({
      from: `"Automata Controls Notification" <${process.env.EMAIL_USER}>`,
      to: contactEmail,
      subject: `NOTIFICATION: ${severity.toUpperCase()} - ${alarmType} at ${displayLocationName}`,
      text: `Alarm Type: ${alarmType}
Severity: ${severity.toUpperCase()}
Location: ${displayLocationName}
Equipment: ${equipmentName}
Details: ${details}
Time: ${timestamp}
Assigned Technicians: ${assignedTechs || "None"}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; background-color: #f6f9fc;">
          <div style="background-color: white; border-radius: 5px; padding: 20px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);">
            <div style="text-align: center; margin-bottom: 20px;">
              <img src="cid:automata-logo" alt="Automata Controls Logo" style="width: 120px; height: auto;">
            </div>
            
            <div style="background-color: #fff3e0; border-left: 4px solid #ff9800; padding: 10px; margin-bottom: 20px; text-align: center;">
              <p style="color: #ff9800; font-weight: bold; margin: 0;">
                ${assignedTechs ? `${assignedTechs} has been notified` : "A technician has been notified"}
              </p>
            </div>

            <h2 style="color: ${getAlarmColor(severity)}; text-align: center; margin-bottom: 20px;">
              ${severity.toUpperCase()} ALARM
            </h2>

            <h3 style="margin-top: 20px; color: #333;">${alarmType}</h3>

            <p style="color: #404040; margin: 10px 0;">${details}</p>

            <table style="width: 100%; margin-top: 20px; border-collapse: collapse;">
              <tr>
                <td style="padding: 5px 0;">
                  <span style="color: #666; font-size: 14px;">Location:</span><br>
                  <span style="color: #00FFEA; font-weight: 700; font-size: 16px;">${displayLocationName}</span>
                </td>
                <td style="padding: 5px 0;">
                  <span style="color: #666; font-size: 14px;">Equipment:</span><br>
                  <span style="color: #333; font-weight: 500; font-size: 16px;">${equipmentName}</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 5px 0;">
                  <span style="color: #666; font-size: 14px;">Time:</span><br>
                  <span style="color: #333; font-weight: 500; font-size: 16px;">${timestamp}</span>
                </td>
                <td style="padding: 5px 0;">
                  <span style="color: #666; font-size: 14px;">Assigned to:</span><br>
                  <span style="color: #333; font-weight: 500; font-size: 16px;">${assignedTechs || "Pending assignment"}</span>
                </td>
              </tr>
            </table>

            <hr style="border-color: #e1e1e1; margin: 20px 0;">

            <div style="background-color: #1f2937; padding: 15px; border-radius: 4px; margin-top: 20px; text-align: center;">
              <span style="color: #ffe8cc; font-size: 14px; margin-right: 3px;">©</span>
              <span style="color: #cccccc; text-decoration: none; font-size: 14px; font-weight: 600; margin-right: 15px;">
                AutomataControls
              </span>
              <a href="https://gitlab.com/automata-ui/neuralbms" style="color: #ccf6e4; text-decoration: none; font-size: 14px; font-weight: 500; margin: 0 10px;">
                <img src="cid:gitlab-icon" alt="GitLab" style="width: 16px; height: 16px; vertical-align: middle; margin-right: 5px;">
                GitLab
              </a>
              <a href="https://github.com/AutomataControls" style="color: #ffe8cc; text-decoration: none; font-size: 14px; font-weight: 500; margin: 0 10px;">
                <img src="cid:github-icon" alt="GitHub" style="width: 16px; height: 16px; vertical-align: middle; margin-right: 5px;">
                GitHub
              </a>
            </div>

            <p style="color: #666; font-size: 12px; text-align: center; margin-top: 20px;">
              This is an automated message from the Automata Controls monitoring system.
              ${alarmId ? ` Alarm ID: ${alarmId}` : ""}
            </p>
            
            <p style="color: #666; font-size: 12px; text-align: center; margin-top: 10px;">
              For assistance, please contact Automata Controls at (330) 555-1234 or support@automatacontrols.com
            </p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: 'neural-loader.png',
          path: logoPath,
          cid: 'automata-logo' // Same cid value as in the html img src
        },
        {
          filename: 'gitlab-icon.png',
          path: 'https://about.gitlab.com/images/press/logo/png/gitlab-icon-rgb.png',
          cid: 'gitlab-icon'
        },
        {
          filename: 'github-icon.png',
          path: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
          cid: 'github-icon'
        }
      ]
    })

    console.log(`📧 Customer email sent successfully! Message ID: ${info.messageId}`)

    res.status(200).json({
      success: true,
      messageId: info.messageId,
      recipient: contactEmail
    })
  } catch (error) {
    console.error("📧 ERROR sending customer email:", error)
    res.status(500).json({ error: "Failed to send customer email", details: error.message })
  }
}
