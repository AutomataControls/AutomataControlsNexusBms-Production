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
  console.log("📧 Rejection Email API route called")

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  const { name, email, username } = req.body

  console.log("📧 Rejection Email request received:", {
    name,
    email,
    username,
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
    console.log(`📧 Sending rejection email to: ${email}`)
    const info = await transporter.sendMail({
      from: `"Automata Controls" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Your Automata Controls Account Application Status`,
      text: `Account Application Status
      
Name: ${name || username}
Email: ${email}
Application Time: ${timestamp}

Dear ${name || username},

Thank you for your interest in the Automata Controls Building Management System. After careful review of your application, we regret to inform you that we are unable to approve your account at this time.

If you believe this decision was made in error, please contact our support team at support@automatacontrols.com.

Best regards,
The Automata Controls Team`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; background-color: #f6f9fc;">
          <div style="background-color: white; border-radius: 5px; padding: 20px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);">
            <div style="text-align: center; margin-bottom: 20px;">
              <img src="cid:automata-logo" alt="Automata Controls Logo" style="width: 120px; height: auto;">
            </div>

            <h2 style="color: #FF6B00; text-align: center; margin-bottom: 20px;">
              Account Application Status
            </h2>

            <p style="color: #404040; margin: 10px 0;">Dear ${name || username},</p>

            <p style="color: #404040; margin: 10px 0;">Thank you for your interest in the Automata Controls Building Management System. After careful review of your application, we regret to inform you that we are unable to approve your account at this time.</p>

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
                  <span style="color: #666; font-size: 14px;">Application Time:</span><br>
                  <span style="color: #333; font-weight: 500; font-size: 16px;">${timestamp}</span>
                </td>
                <td style="padding: 5px 0;"></td>
              </tr>
            </table>

            <div style="background-color: #fff3e0; border-left: 4px solid #ff9800; padding: 15px; margin: 20px 0; text-align: left;">
              <p style="color: #333; margin: 0 0 10px 0;">
                <strong>Need assistance?</strong>
              </p>
              <p style="color: #666; margin: 0 0 15px 0; font-size: 14px;">
                If you believe this decision was made in error, please contact our support team.
              </p>
              <div style="text-align: center;">
                <a href="mailto:support@automatacontrols.com" style="background-color: #ff9800; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                  Contact Support
                </a>
              </div>
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

    console.log(`📧 Rejection email sent successfully! Message ID: ${info.messageId}`)

    res.status(200).json({
      success: true,
      messageId: info.messageId,
      recipient: email,
    })
  } catch (error) {
    console.error("📧 ERROR sending rejection email:", error)
    res.status(500).json({ error: "Failed to send rejection email", details: error.message })
  }
} 
