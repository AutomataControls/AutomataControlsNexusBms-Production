import nodemailer from "nodemailer"

export default async function handler(req, res) {
  console.log("📧 Role Upgrade Request API route called")

  const { email, name } = req.query

  if (!email || !name) {
    return res.status(400).json({ error: "Email and name are required" })
  }

  try {
    // Check if email credentials are set
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.error("📧 ERROR: Email credentials not set. Using fallback credentials for testing")
      // For testing purposes only - in production, use environment variables
      process.env.EMAIL_USER = "automatacontrols@gmail.com"
      process.env.EMAIL_PASSWORD = "sifp edkq nvdm vlmj" // This is just for testing
    }

    // Gmail SMTP configuration
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    })

    // Send email to DevOps
    await transporter.sendMail({
      from: `"Automata Controls System" <${process.env.EMAIL_USER}>`,
      to: "DevOps@automatacontrols.com",
      subject: `Role Upgrade Request from ${name}`,
      text: `
Role Upgrade Request

User: ${name}
Email: ${email}

This user has requested elevated access permissions in the Automata Controls Building Management System.
Please review their account and assign appropriate roles if needed.

This is an automated message from the Automata Controls system.
      `,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
          <h2 style="color: #00FFEA;">Role Upgrade Request</h2>
          
          <p><strong>User:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          
          <p>This user has requested elevated access permissions in the Automata Controls Building Management System.</p>
          <p>Please review their account and assign appropriate roles if needed.</p>
          
          <hr style="border-color: #e1e1e1; margin: 20px 0;">
          
          <p style="color: #666; font-size: 12px;">
            This is an automated message from the Automata Controls system.
          </p>
        </div>
      `,
    })

    // Redirect to a thank you page or show a message
    res.writeHead(302, {
      Location: `${process.env.NEXT_PUBLIC_APP_URL || "https://neuralbms.automatacontrols.com"}/role-request-sent`,
    })
    res.end()
  } catch (error) {
    console.error("📧 ERROR sending role upgrade request:", error)
    res.status(500).json({ error: "Failed to send role upgrade request", details: error.message })
  }
}

