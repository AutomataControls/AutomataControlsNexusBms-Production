// This is a standalone script to test email configuration
// Run with: node test-email-config.js

const nodemailer = require("nodemailer")
const fs = require("fs")
const path = require("path")
const readline = require("readline")

// Function to read environment variables from .env.local file
function loadEnvFile(filePath) {
  try {
    const envFile = fs.readFileSync(filePath, "utf8")
    const envVars = {}

    envFile.split("\n").forEach((line) => {
      // Skip comments and empty lines
      if (!line || line.startsWith("#")) return

      const [key, ...valueParts] = line.split("=")
      if (key && valueParts.length) {
        const value = valueParts.join("=").trim()
        envVars[key.trim()] = value
      }
    })

    return envVars
  } catch (error) {
    console.error("Error reading .env file:", error.message)
    return {}
  }
}

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

async function testEmailConfig() {
  console.log("🧪 Email Configuration Test Tool 🧪")
  console.log("----------------------------------")

  // Try to load environment variables from .env.local
  let envPath = path.resolve(process.cwd(), ".env.local")
  let envVars = loadEnvFile(envPath)

  if (!Object.keys(envVars).length) {
    // Try alternative path
    envPath = "/opt/productionapp/.env.local"
    envVars = loadEnvFile(envPath)
  }

  // Get email configuration
  let emailUser = envVars.EMAIL_USER
  let emailPassword = envVars.EMAIL_PASSWORD
  let testRecipient = envVars.DEFAULT_RECIPIENT || emailUser

  // If not found in env file, prompt user
  if (!emailUser) {
    emailUser = await new Promise((resolve) => {
      rl.question("Enter email address: ", (answer) => resolve(answer))
    })
  } else {
    console.log(`Using email from env: ${emailUser}`)
  }

  if (!emailPassword) {
    emailPassword = await new Promise((resolve) => {
      rl.question("Enter email password or app password: ", (answer) => resolve(answer))
    })
  } else {
    console.log("Using password from env file")
  }

  testRecipient = await new Promise((resolve) => {
    rl.question(`Enter test recipient email [default: ${testRecipient}]: `, (answer) => {
      resolve(answer || testRecipient)
    })
  })

  console.log(`\nTesting email configuration...`)
  console.log(`From: ${emailUser}`)
  console.log(`To: ${testRecipient}`)
  console.log(`Using Gmail SMTP server`)

  try {
    // Create transporter
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: emailUser,
        pass: emailPassword,
      },
      debug: true,
    })

    // Verify connection
    console.log("Verifying connection to SMTP server...")
    await transporter.verify()
    console.log("✅ Connection to SMTP server successful!")

    // Send test email
    console.log("Sending test email...")
    const info = await transporter.sendMail({
      from: `"Automata Controls Test" <${emailUser}>`,
      to: testRecipient,
      subject: "Test Email from Alarm System",
      text: "This is a test email from the Automata Controls alarm system.",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
          <h2 style="color: #3366cc;">🧪 Test Email</h2>
          <p>This is a test email from the Automata Controls alarm system.</p>
          <p>If you're receiving this, the Gmail SMTP configuration is working correctly!</p>
          <p>Time: ${new Date().toLocaleString()}</p>
        </div>
      `,
    })

    console.log("✅ Test email sent successfully!")
    console.log(`Message ID: ${info.messageId}`)

    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error("❌ Error sending test email:", error.message)
    if (error.code === "EAUTH") {
      console.error("Authentication failed. Please check your email and password/app password.")
      console.error("For Gmail, make sure you're using an app password if 2FA is enabled.")
    }
    return { success: false, error: error.message }
  } finally {
    rl.close()
  }
}

// Run the test
testEmailConfig().then((result) => {
  console.log("\nTest completed with result:", result)
  process.exit(result.success ? 0 : 1)
})
