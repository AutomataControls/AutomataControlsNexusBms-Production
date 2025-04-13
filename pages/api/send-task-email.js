import nodemailer from "nodemailer"
import path from "path"
import fs from "fs"

// Hardcoded mapping for numeric location IDs (reused from alarm email)
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

// Function to format date in Eastern Time (reused from alarm email)
function formatDateInET(date) {
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

  return new Intl.DateTimeFormat('en-US', options).format(date);
}

// Function to get location name from ID (reused from alarm email)
function getLocationName(locationId) {
  if (LOCATION_ID_MAPPING[locationId]) {
    console.log(`📧 Found direct mapping for location ID ${locationId}: ${LOCATION_ID_MAPPING[locationId]}`)
    return LOCATION_ID_MAPPING[locationId]
  }

  if (/^\d+$/.test(locationId)) {
    console.log(`📧 Location ID ${locationId} is numeric but not in mapping, adding prefix`)
    return `Location ${locationId}`
  }

  return locationId
}

// Function to get priority color
function getPriorityColor(priority) {
  switch (priority) {
    case "critical":
      return "#cc0000"
    case "high":
      return "#ff9900"
    case "medium":
      return "#3366cc"
    case "low":
      return "#4FD1C5"
    default:
      return "#666666"
  }
}

export default async function handler(req, res) {
  console.log("📧 Task Email API route called")

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  const {
    taskTitle,
    taskDescription,
    locationId,
    locationName: originalLocationName,
    dueDate,
    priority = "medium",
    taskId,
    technicianEmail,
    technicianName,
    assignedBy
  } = req.body

  console.log("📧 Task Email request received:", {
    taskTitle,
    locationId,
    originalLocationName,
    priority,
    technicianEmail,
    technicianName
  })

  try {
    // Resolve location name
    const displayLocationName = originalLocationName || getLocationName(locationId) || "Unknown Location"
    console.log(`📧 Using location name: ${displayLocationName}`)

    // Format timestamp in Eastern Time
    const timestamp = formatDateInET(new Date())
    console.log(`📧 Formatted timestamp in ET: ${timestamp}`)

    // Format due date if provided
    const formattedDueDate = dueDate ? formatDateInET(new Date(dueDate)) : "No due date"

    // Dashboard URL
    const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/tasks`
      : "https://neuralbms.automatacontrols.com/dashboard/tasks"
    console.log(`📧 Dashboard URL: ${dashboardUrl}`)

    // Use provided recipient or default
    let emailRecipient = technicianEmail
    
    if (!emailRecipient) {
      emailRecipient = process.env.DEFAULT_RECIPIENT || "automatacontrols@gmail.com"
      console.log(`📧 No recipient provided, using default recipient: ${emailRecipient}`)
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

    // Path to logo file
    const logoPath = path.join(process.cwd(), 'public', 'neural-loader.png')
    console.log(`📧 Looking for logo at: ${logoPath}`)

    // Send email with improved HTML template
    console.log(`📧 Sending task email to: ${emailRecipient}`)
    const info = await transporter.sendMail({
      from: `"Automata Controls Task System" <${process.env.EMAIL_USER}>`,
      to: emailRecipient,
      subject: `TASK ASSIGNED: ${taskTitle} at ${displayLocationName}`,
      text: `Task: ${taskTitle}
Description: ${taskDescription || "No description provided"}
Priority: ${priority.toUpperCase()}
Location: ${displayLocationName}
Due Date: ${formattedDueDate}
Assigned By: ${assignedBy || "System Administrator"}
Time: ${timestamp}
Dashboard: ${dashboardUrl}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; background-color: #f6f9fc;">
          <div style="background-color: white; border-radius: 5px; padding: 20px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);">
            <div style="text-align: center; margin-bottom: 20px;">
              <img src="cid:automata-logo" alt="Automata Controls Logo" style="width: 120px; height: auto;">
            </div>

            <h2 style="color: ${getPriorityColor(priority)}; text-align: center; margin-bottom: 20px;">
              NEW TASK ASSIGNED
            </h2>

            <h3 style="margin-top: 20px; color: #333;">${taskTitle}</h3>

            <p style="color: #404040; margin: 10px 0;">${taskDescription || "No description provided"}</p>

            <table style="width: 100%; margin-top: 20px; border-collapse: collapse;">
              <tr>
                <td style="padding: 5px 0;">
                  <span style="color: #666; font-size: 14px;">Location:</span><br>
                  <span style="color: #00FFEA; font-weight: 700; font-size: 16px;">${displayLocationName}</span>
                </td>
                <td style="padding: 5px 0;">
                  <span style="color: #666; font-size: 14px;">Priority:</span><br>
                  <span style="color: ${getPriorityColor(priority)}; font-weight: 500; font-size: 16px;">${priority.toUpperCase()}</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 5px 0;">
                  <span style="color: #666; font-size: 14px;">Due Date:</span><br>
                  <span style="color: #333; font-weight: 500; font-size: 16px;">${formattedDueDate}</span>
                </td>
                <td style="padding: 5px 0;">
                  <span style="color: #666; font-size: 14px;">Assigned to:</span><br>
                  <span style="color: #333; font-weight: 500; font-size: 16px;">${technicianName || emailRecipient}</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 5px 0;">
                  <span style="color: #666; font-size: 14px;">Assigned by:</span><br>
                  <span style="color: #333; font-weight: 500; font-size: 16px;">${assignedBy || "System Administrator"}</span>
                </td>
                <td style="padding: 5px 0;">
                  <span style="color: #666; font-size: 14px;">Assigned on:</span><br>
                  <span style="color: #333; font-weight: 500; font-size: 16px;">${timestamp}</span>
                </td>
              </tr>
            </table>

            <div style="text-align: center; margin-top: 30px;">
              <a href="${dashboardUrl}" style="background-color: #98ffd8; color: #333; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                View Task in Dashboard
              </a>
            </div>

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
              This is an automated message from the Automata Controls task management system.
              ${taskId ? ` Task ID: ${taskId}` : ""}
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

    console.log(`📧 Task email sent successfully! Message ID: ${info.messageId}`)

    res.status(200).json({
      success: true,
      messageId: info.messageId,
      recipient: emailRecipient
    })
  } catch (error) {
    console.error("📧 ERROR sending task email:", error)
    res.status(500).json({ error: "Failed to send task email", details: error.message })
  }
}
