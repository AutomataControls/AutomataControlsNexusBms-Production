// File: scripts/test-email.js
// Description: Command line script for testing email notifications
// Usage: node scripts/test-email.js email@example.com

// Load environment variables
require('dotenv').config();
const path = require('path');
try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
} catch (error) {
  console.log('No .env.local file found, using .env');
}

const nodemailer = require('nodemailer');
const fs = require('fs');

// Parse command line arguments
const args = process.argv.slice(2);
const email = args[0];
const severity = args[1] || 'info';

if (!email) {
  console.error('Error: Email argument is required');
  console.log('Usage: node scripts/test-email.js <email> [severity]');
  console.log('Example: node scripts/test-email.js user@example.com warning');
  process.exit(1);
}

// Function to test SMTP connectivity
async function testSMTPConnectivity(host, port) {
  return new Promise((resolve) => {
    try {
      const net = require('net');
      const socket = net.createConnection(port, host);
      let result = null;
      
      socket.on('connect', () => {
        console.log(`✅ Successfully connected to ${host}:${port}`);
        result = { success: true, message: "Connection successful" };
        socket.end();
      });
      
      socket.on('error', (err) => {
        console.error(`❌ Socket connection error to ${host}:${port}:`, err.message);
        result = { success: false, message: err.message, code: err.code };
      });
      
      socket.on('close', () => {
        if (!result) {
          result = { success: false, message: "Connection closed without establishing" };
        }
        resolve(result);
      });
      
      // Set a timeout of 5 seconds
      socket.setTimeout(5000);
      socket.on('timeout', () => {
        console.log(`⏱️ Socket connection test to ${host}:${port} timed out`);
        result = { success: false, message: "Connection timed out", code: "ETIMEDOUT" };
        socket.destroy();
      });
    } catch (error) {
      console.error("❌ Network test error:", error);
      resolve({ success: false, message: error.message, code: error.code });
    }
  });
}

// Get alarm severity color
const getAlarmColor = (sev) => {
  switch (sev) {
    case "critical":
      return "#cc0000";
    case "warning":
      return "#ff9900";
    case "info":
      return "#3366cc";
    default:
      return "#666666";
  }
};

// Function to format date in Eastern Time
function formatDateInET(date) {
  const options = {
    timeZone: "America/New_York",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: true
  };

  return new Intl.DateTimeFormat("en-US", options).format(date);
}

async function sendTestEmail() {
  console.log('🔍 Checking environment variables...');
  
  // Print environment variable status
  console.log('EMAIL_USER:', process.env.EMAIL_USER ? 'Set' : 'Not set');
  console.log('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? `Set (length: ${process.env.EMAIL_PASSWORD.length})` : 'Not set');
  console.log('NODE_ENV:', process.env.NODE_ENV || 'Not set');
  
  // Test connectivity to Gmail SMTP servers
  console.log('\n🔌 Testing SMTP connectivity...');
  const testResults = {
    gmail587: await testSMTPConnectivity('smtp.gmail.com', 587),
    gmail465: await testSMTPConnectivity('smtp.gmail.com', 465),
    gmail25: await testSMTPConnectivity('smtp.gmail.com', 25)
  };
  
  console.log('\nSMTP Test Results:');
  console.log(`Port 587 (TLS): ${testResults.gmail587.success ? '✅ Connected' : '❌ Failed'}`);
  console.log(`Port 465 (SSL): ${testResults.gmail465.success ? '✅ Connected' : '❌ Failed'}`);
  console.log(`Port 25 (Basic): ${testResults.gmail25.success ? '✅ Connected' : '❌ Failed'}`);
  
  // Determine the best port to use
  let bestPort = 587;
  let bestSecure = false;
  
  if (testResults.gmail465.success) {
    bestPort = 465;
    bestSecure = true;
    console.log('\n✅ Using port 465 with SSL (secure) as it tested successfully');
  } else if (testResults.gmail587.success) {
    bestPort = 587;
    bestSecure = false;
    console.log('\n✅ Using port 587 with TLS as it tested successfully');
  } else if (testResults.gmail25.success) {
    bestPort = 25;
    bestSecure = false;
    console.log('\n✅ Using port 25 as fallback as it tested successfully');
  } else {
    console.log('\n⚠️ Warning: All SMTP connection tests failed. Will attempt sending anyway.');
  }

  // Check if credentials are available
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.error('\n❌ Error: Email credentials not set');
    console.log('Please set EMAIL_USER and EMAIL_PASSWORD environment variables');
    process.exit(1);
  }
  
  // Create transporters for each method to try
  const transporters = [
    // Method 1: Use best port determined by connectivity tests
    {
      name: `Gmail (Port ${bestPort}${bestSecure ? ' SSL' : ' TLS'})`,
      transporter: nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: bestPort,
        secure: bestSecure,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
        connectionTimeout: 60000,
        greetingTimeout: 30000,
        socketTimeout: 60000
      })
    },
    // Method 2: Always try SSL as backup
    {
      name: 'Gmail (Port 465 SSL)',
      transporter: nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
        connectionTimeout: 60000,
        greetingTimeout: 30000,
        socketTimeout: 60000
      })
    },
    // Method 3: Try port 25 as last standard option
    {
      name: 'Gmail (Port 25)',
      transporter: nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 25,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
        connectionTimeout: 60000,
        greetingTimeout: 30000,
        socketTimeout: 60000
      })
    },
    // Method 4: Direct MX as absolute fallback
    {
      name: 'Direct MX',
      transporter: nodemailer.createTransport({
        direct: true,
        name: 'localhost.localdomain',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
        connectionTimeout: 90000,
        greetingTimeout: 45000,
        socketTimeout: 90000
      })
    }
  ];
  
  // Timestamp and details for the test email
  const timestamp = formatDateInET(new Date());
  const alarmType = 'Command Line Email Test';
  const details = `This is a test email sent from the command line script.
  
Script details:
- Script: scripts/test-email.js
- Timestamp: ${timestamp}
- Target email: ${email}
- Severity: ${severity}
- Sending account: ${process.env.EMAIL_USER}
- SMTP connectivity test results:
  - Port 587 (TLS): ${testResults.gmail587.success ? 'Connected' : 'Failed'}
  - Port 465 (SSL): ${testResults.gmail465.success ? 'Connected' : 'Failed'}
  - Port 25 (Basic): ${testResults.gmail25.success ? 'Connected' : 'Failed'}

If you're receiving this email, it confirms that the email notification system is working.`;

  // Create the mail options
  const mailOptions = {
    from: `"Automata Controls Test" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `TEST: ${severity.toUpperCase()} Alarm Notification`,
    text: `Test Alarm Type: ${alarmType}
Severity: ${severity.toUpperCase()}
Details: ${details}
Time: ${timestamp}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; background-color: #f6f9fc;">
        <div style="background-color: white; border-radius: 5px; padding: 20px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: ${getAlarmColor(severity)};">TEST: ${severity.toUpperCase()} ALARM</h1>
          </div>

          <h3 style="margin-top: 20px; color: #333;">${alarmType}</h3>

          <p style="color: #404040; margin: 10px 0; white-space: pre-line;">${details}</p>

          <table style="width: 100%; margin-top: 20px; border-collapse: collapse;">
            <tr>
              <td style="padding: 5px 0;">
                <span style="color: #666; font-size: 14px;">Time:</span><br>
                <span style="color: #333; font-weight: 500; font-size: 16px;">${timestamp}</span>
              </td>
              <td style="padding: 5px 0;">
                <span style="color: #666; font-size: 14px;">Target Email:</span><br>
                <span style="color: #333; font-weight: 500; font-size: 16px;">${email}</span>
              </td>
            </tr>
          </table>

          <hr style="border-color: #e1e1e1; margin: 20px 0;">

          <p style="color: #666; font-size: 12px; text-align: center; margin-top: 20px;">
            This is an automated test message from the Automata Controls monitoring system.
          </p>
        </div>
      </div>
    `
  };

  // Try each transport method until one succeeds
  console.log('\n📧 Attempting to send test email...');
  let success = false;
  let lastError = null;
  
  for (const { name, transporter } of transporters) {
    if (success) break;
    
    console.log(`\nTrying method: ${name}...`);
    try {
      // First verify connection
      try {
        await transporter.verify();
        console.log(`✅ SMTP connection verified for ${name}`);
      } catch (verifyError) {
        console.error(`❌ SMTP connection failed for ${name}:`, verifyError.message);
        console.log('Still attempting to send email...');
      }
      
      // Try to send
      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ Email sent successfully via ${name}!`);
      console.log(`📧 Message ID: ${info.messageId}`);
      success = true;
    } catch (error) {
      console.error(`❌ Failed to send via ${name}:`, error.message);
      lastError = error;
    }
  }
  
  if (success) {
    console.log('\n🎉 Email test completed successfully!');
    console.log(`📧 Test email sent to: ${email}`);
  } else {
    console.error('\n❌ All email sending methods failed');
    if (lastError) {
      console.error('Last error:', lastError.message);
      
      // Provide troubleshooting guidance
      console.log('\n🔍 Troubleshooting suggestions:');
      
      if (lastError.code === 'EAUTH') {
        console.log('- Authentication failed. Make sure your email and password are correct.');
        console.log('- For Gmail accounts, you need to use an "App Password" rather than your regular password.');
        console.log('- Create an App Password at: https://myaccount.google.com/apppasswords');
      } else if (lastError.code === 'ESOCKET' || lastError.code === 'ETIMEDOUT') {
        console.log('- Network connection issue. Check your internet connection.');
        console.log('- Your server might be blocking outgoing SMTP connections.');
        console.log('- Try using a different port or using an external email service like SendGrid or Mailgun.');
      } else if (lastError.code === 'EENVELOPE') {
        console.log('- Problem with sender or recipient address.');
        console.log('- Make sure the email addresses are formatted correctly.');
      }
      
      console.log('- Check your EMAIL_USER and EMAIL_PASSWORD environment variables.');
      console.log('- Gmail requires "Less secure apps" to be enabled, or an App Password if 2FA is enabled.');
    }
  }
  
  return success;
}

// Run the test email function
sendTestEmail()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
  });
