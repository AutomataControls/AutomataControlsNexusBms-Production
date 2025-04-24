import nodemailer from "nodemailer"
import path from "path"

// Function to format date in Eastern Time
function formatDateInET(date) {
  // Options for formatting the date in US Eastern Time
  const options = {
    timeZone: "America/New_York",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: true,
  }

  // Format the date
  return new Intl.DateTimeFormat("en-US", options).format(date)
}

export default async function handler(req, res) {
  console.log("📧 New User Approval Email API route called")

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  const { name, email, username, location, locationName, userId } = req.body

  console.log("📧 New User Approval Email request received:", {
    name,
    email,
    username,
    location,
    locationName,
    userId
  })

  // Validate that email is provided
  if (!email) {
    console.error("📧 ERROR: No email provided")
    return res.status(400).json({ error: "Email is required" })
  }

  try {
    // Format timestamp in Eastern Time
    const timestamp = formatDateInET(new Date())
    console.log(`📧 Formatted timestamp in ET: ${timestamp}`)

    // Approval and rejection URLs
    const approveUrl = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/approve-user?userId=${encodeURIComponent(userId)}&email=${encodeURIComponent(email)}`
      : `https://neuralbms.automatacontrols.com/api/approve-user?userId=${encodeURIComponent(userId)}&email=${encodeURIComponent(email)}`
    
    const rejectUrl = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/reject-user?userId=${encodeURIComponent(userId)}&email=${encodeURIComponent(email)}`
      : `https://neuralbms.automatacontrols.com/api/reject-user?userId=${encodeURIComponent(userId)}&email=${encodeURIComponent(email)}`

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
    const logoPath = path.join(process.cwd(), "public", "neural-loader.png")
    console.log(`📧 Looking for logo at: ${logoPath}`)

    // Send email with improved HTML template
    console.log(`📧 Sending new user approval email to: DevOps@automatacontrols.com`)
    const info = await transporter.sendMail({
      from: `"Automata Controls" <${process.env.EMAIL_USER}>`,
      to: "DevOps@automatacontrols.com",
      subject: `New User Registration Requires Approval: ${name || username}`,
      text: `New User Registration Requires Approval
      
Name: ${name || username}
Email: ${email}
Username: ${username}
Location: ${locationName || "Not specified"}
Registration Time: ${timestamp}
User ID: ${userId}

A new user has registered for the Automata Controls Building Management System and requires your approval.

To approve this user, please visit: ${approveUrl}

To reject this user, please visit: ${rejectUrl}

Best regards,
The Automata Controls System`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; background-color: #f6f9fc;">
          <div style="background-color: white; border-radius: 5px; padding: 20px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);">
            <div style="text-align: center; margin-bottom: 20px;">
              <img src="cid:automata-logo" alt="Automata Controls Logo" style="width: 120px; height: auto;">
            </div>

            <h2 style="color: #FF6B00; text-align: center; margin-bottom: 20px;">
              New User Registration Requires Approval
            </h2>

            <p style="color: #404040; margin: 10px 0;">A new user has registered for the Automata Controls Building Management System and requires your approval.</p>

            <table style="width: 100%; margin-top: 20px; border-collapse: collapse;">
              <tr>
                <td style="padding: 5px 0;">
                  <span style="color: #666; font-size: 14px;">Name:</span><br>
                  <span style="color: #333; font-weight: 500; font-size: 16px;">${name || username}</span>
                </td>
                <td style="padding: 5px 0;">
                  <span style="color: #666; font-size: 14px;">Email:</span><br>
                  <span style="color: #333; font-weight: 500; font-size: 16px;">${email}</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 5px 0;">
                  <span style="color: #666; font-size: 14px;">Username:</span><br>
                  <span style="color: #333; font-weight: 500; font-size: 16px;">${username}</span>
                </td>
                <td style="padding: 5px 0;">
                  <span style="color: #666; font-size: 14px;">Location:</span><br>
                  <span style="color: #333; font-weight: 500; font-size: 16px;">${locationName || "Not specified"}</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 5px 0;">
                  <span style="color: #666; font-size: 14px;">Registration Time:</span><br>
                  <span style="color: #333; font-weight: 500; font-size: 16px;">${timestamp}</span>
                </td>
                <td style="padding: 5px 0;">
                  <span style="color: #666; font-size: 14px;">User ID:</span><br>
                  <span style="color: #333; font-weight: 500; font-size: 16px;">${userId}</span>
                </td>
              </tr>
            </table>

            <div style="display: flex; justify-content: space-between; margin-top: 30px;">
              <a href="${approveUrl}" style="background-color: #4CAF50; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; text-align: center; flex: 1; margin-right: 10px;">
                Approve User
              </a>
              <a href="${rejectUrl}" style="background-color: #f44336; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; text-align: center; flex: 1; margin-left: 10px;">
                Reject User
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
              This is an automated message from the Automata Controls system.
            </p>

            <p style="color: #666; font-size: 12px; text-align: center; margin-top: 10px;">
              For assistance, please contact Automata Controls at (330) 555-1234 or support@automatacontrols.com
            </p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: "neural-loader.png",
          path: logoPath,
          cid: "automata-logo", // Same cid value as in the html img src
        },
        {
          filename: "gitlab-icon.png",
          path: "https://about.gitlab.com/images/press/logo/png/gitlab-icon-rgb.png",
          cid: "gitlab-icon",
        },
        {
          filename: "github-icon.png",
          path: "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png",
          cid: "github-icon",
        },
      ],
    })

    console.log(`📧 New user approval email sent successfully! Message ID: ${info.messageId}`)

    res.status(200).json({
      success: true,
      messageId: info.messageId,
      recipient: "DevOps@automatacontrols.com",
    })
  } catch (error) {
    console.error("📧 ERROR sending new user approval email:", error)
    res.status(500).json({ error: "Failed to send new user approval email", details: error.message })
  }
}
