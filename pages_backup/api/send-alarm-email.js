// File: pages/api/send-alarm-email.js
// Description: This API route handles sending alarm emails using Resend API with Gmail SMTP fallback

import nodemailer from "nodemailer"
import path from "path"
import fs from "fs"
import { Resend } from 'resend'

// Import the email logger
const emailLogger = require('../../lib/logging/email-logger');

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY)

// Always include these recipients in every alarm email
const ALWAYS_INCLUDE_RECIPIENTS = ['agjewell@currenthvac.net'];

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

// Function to check if an email belongs to a technician
function isTechnician(email) {
  // Convert email to lowercase for case-insensitive comparison
  const emailLower = email.toLowerCase();
  
  emailLogger.debug(`Checking if ${emailLower} is a technician email`);
  
  // Check against specific domains
  const isTech = emailLower.endsWith('@automatacontrols.com') || 
                emailLower.endsWith('@currenthvac.net') || 
                emailLower.endsWith('@currenthvac.com');
  
  emailLogger.debug(`Result for ${emailLower}: ${isTech ? 'IS a technician' : 'is NOT a technician'}`);
  
  return isTech;
}

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
    hour12: true
  };

  // Format the date
  return new Intl.DateTimeFormat("en-US", options).format(date);
}

// Function to get location name from ID
function getLocationName(locationId) {
  // If we have a direct mapping for this ID, use it
  if (LOCATION_ID_MAPPING[locationId]) {
    emailLogger.info(`Found direct mapping for location ID ${locationId}: ${LOCATION_ID_MAPPING[locationId]}`);
    return LOCATION_ID_MAPPING[locationId];
  }

  // If it's a numeric ID, add a prefix
  if (/^\d+$/.test(locationId)) {
    emailLogger.info(`Location ID ${locationId} is numeric but not in mapping, adding prefix`);
    return `Location ${locationId}`;
  }

  // Otherwise, just return the ID as is
  return locationId;
}

// Test network connectivity to SMTP server
async function testSMTPConnectivity(host, port) {
  return new Promise((resolve) => {
    try {
      const net = require('net');
      const socket = net.createConnection(port, host);
      let result = null;

      socket.on('connect', () => {
        emailLogger.info(`Successfully connected to ${host}:${port}`);
        result = { success: true, message: "Connection successful" };
        socket.end();
      });

      socket.on('error', (err) => {
        emailLogger.error(`Socket connection error to ${host}:${port}: ${err.message}`, { code: err.code });
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
        emailLogger.warn(`Socket connection test to ${host}:${port} timed out`);
        result = { success: false, message: "Connection timed out", code: "ETIMEDOUT" };
        socket.destroy();
      });
    } catch (error) {
      emailLogger.error("Network test error", { error: error.message, code: error.code });
      resolve({ success: false, message: error.message, code: error.code });
    }
  });
}

export default async function handler(req, res) {
  emailLogger.info("Alarm Email API route called", { timestamp: new Date().toLocaleTimeString() });

  if (req.method !== "POST") {
    emailLogger.warn("Method not allowed", { method: req.method });
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Log request details
  emailLogger.logRequest(req, "Alarm email request received");

  // Add detailed environment variable checking
  emailLogger.debug("Environment check", {
    EMAIL_USER: process.env.EMAIL_USER ? "Set" : "Not set",
    EMAIL_PASSWORD: process.env.EMAIL_PASSWORD ? `Set (length: ${process.env.EMAIL_PASSWORD?.length || 0})` : "Not set",
    RESEND_API_KEY: process.env.RESEND_API_KEY ? `Set (length: ${process.env.RESEND_API_KEY?.length || 0})` : "Not set",
    NODE_ENV: process.env.NODE_ENV,
    APP_URL: process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "Not set"
  });

  const {
    alarmType,
    details,
    locationId,
    locationName: originalLocationName,
    equipmentName = "Unknown Equipment",
    severity = "warning",
    alarmId,
    recipients,
    assignedTechs
  } = req.body;

  try {
    // Resolve location name
    const displayLocationName = originalLocationName || getLocationName(locationId) || "Unknown Location";
    emailLogger.info(`Using location name: ${displayLocationName}`);

    // Format timestamp in Eastern Time
    const timestamp = formatDateInET(new Date());
    emailLogger.debug(`Formatted timestamp in ET: ${timestamp}`);

    // Dashboard URL
    const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/alarms`
      : "https://neuralbms.automatacontrols.com/dashboard/alarms";
    emailLogger.debug(`Dashboard URL: ${dashboardUrl}`);

    // Use provided recipients
    let emailRecipients = [];

    if (recipients && Array.isArray(recipients) && recipients.length > 0) {
      emailRecipients = [...recipients];
      emailLogger.info(`Using ${emailRecipients.length} provided recipients`);
    } else {
      // If no recipients provided, use default recipient
      const defaultRecipient = process.env.DEFAULT_RECIPIENT || "automatacontrols@gmail.com";
      emailLogger.warn(`No recipients provided, using default recipient: ${defaultRecipient}`);
      emailRecipients.push(defaultRecipient);
    }

    // Always include the specified recipients
    ALWAYS_INCLUDE_RECIPIENTS.forEach(alwaysRecipient => {
      if (!emailRecipients.includes(alwaysRecipient)) {
        emailRecipients.push(alwaysRecipient);
        emailLogger.info(`Added always-include recipient: ${alwaysRecipient}`);
      }
    });

    // Remove duplicates
    emailRecipients = [...new Set(emailRecipients)];
    emailLogger.info(`Final recipient list (${emailRecipients.length})`, { recipients: emailRecipients });

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

    // Path to logo file - adjust this to the actual path of your logo
    const logoPath = path.join(process.cwd(), "public", "neural-loader.png");
    emailLogger.debug(`Looking for logo at: ${logoPath}`);

    // Track email success/failure
    let emailSent = false;
    let emailError = null;
    let emailResults = [];
    let emailErrors = [];

    // RESEND API ATTEMPT FIRST - Try to send individual emails to each recipient
    if (process.env.RESEND_API_KEY) {
      emailLogger.info('Attempting to send emails via Resend API');
      
      try {
        let resendSuccess = false;
        
        for (const recipient of emailRecipients) {
          // Determine if this recipient is a technician
          const recipientIsTechnician = isTechnician(recipient);
          emailLogger.info(`Sending email to ${recipient}`, { isTechnician: recipientIsTechnician });
          
          try {
            const { data: emailData, error } = await resend.emails.send({
              from: "Automata Controls DevOps <DevOps@automatacontrols.com>",
              to: recipient,
              subject: `ALERT: ${severity.toUpperCase()} - ${alarmType} at ${displayLocationName}`,
              text: `${severity.toUpperCase()} ALARM: ${alarmType}

${details}

Location: ${displayLocationName}
Equipment: ${equipmentName}
Time: ${timestamp}
Assigned to: ${assignedTechs || "None"}
Alarm ID: ${alarmId || ""}
${recipientIsTechnician ? `\nView in dashboard: ${dashboardUrl}` : ''}`,
              html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; background-color: #f6f9fc;">
                  <div style="background-color: white; border-radius: 5px; padding: 20px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);">
                    <div style="text-align: center; margin-bottom: 20px;">
                      <img src="${process.env.NEXT_PUBLIC_APP_URL || 'https://neuralbms.automatacontrols.com'}/neural-loader.png" alt="Automata Controls Logo" style="width: 120px; height: auto;">
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
                          <span style="color: #333; font-weight: 500; font-size: 16px;">${assignedTechs || "None"}</span>
                        </td>
                      </tr>
                    </table>

                    ${recipientIsTechnician ? `
                    <div style="text-align: center; margin-top: 30px;">
                      <a href="${dashboardUrl}" style="background-color: #0070f3; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; margin-bottom: 15px;">
                        View in Dashboard
                      </a>
                    </div>
                    ` : ''}

                    <hr style="border-color: #e1e1e1; margin: 20px 0;">

                    <div style="background-color: #1f2937; padding: 15px; border-radius: 4px; margin-top: 20px; text-align: center;">
                      <div style="text-align: center; margin-bottom: 10px;">
                        <span style="color: #14b8a6; font-size: 18px; font-weight: 700; letter-spacing: 0.05em;">NEURAL<span style="color: #5eead4;">BMS</span></span>
                      </div>
                      <div style="border-top: 1px solid #374151; width: 80%; margin: 10px auto;"></div>
                      <div style="text-align: center; margin-top: 10px;">
                        <span style="color: #fcd34d; font-size: 14px; font-weight: 600;">&copy; ${new Date().getFullYear()} AutomataControls</span>
                      </div>
                      <div style="text-align: center; margin-top: 5px;">
                        <span style="color: #f97316; font-size: 13px; font-weight: 400;">Building<span style="color: #fb923c;">Management</span><span style="color: #fed7aa;">System</span></span>
                      </div>
                    </div>

                    <p style="color: #666; font-size: 12px; text-align: center; margin-top: 20px;">
                      This is an automated message from the Automata Controls monitoring system.
                      ${alarmId ? ` Alarm ID: ${alarmId}` : ""}
                    </p>
                  </div>
                </div>
              `,
            });

            if (error) {
              emailLogger.error(`Resend API error for ${recipient}`, { error });
              emailErrors.push({ recipient, error: error.message, method: 'resend' });
              emailLogger.logEmailResult(false, recipient, 'resend', null, error);
            } else {
              emailLogger.info(`Email sent successfully via Resend API to ${recipient}`, { messageId: emailData?.id });
              emailResults.push({ recipient, messageId: emailData?.id, method: 'resend' });
              resendSuccess = true;
              emailLogger.logEmailResult(true, recipient, 'resend', emailData?.id);
            }
          } catch (individualError) {
            emailLogger.error(`Error sending to ${recipient} via Resend`, { error: individualError });
            emailErrors.push({ recipient, error: individualError.message, method: 'resend' });
            emailLogger.logEmailResult(false, recipient, 'resend', null, individualError);
          }
        }
        
        if (resendSuccess) {
          emailSent = true;
          emailLogger.info(`Successfully sent at least one email via Resend API`);
        } else {
          emailLogger.warn(`No emails sent successfully via Resend API, will try SMTP fallback`);
        }
      } catch (resendError) {
        emailLogger.error('Error with Resend API', { error: resendError });
        emailLogger.info('Will attempt SMTP fallback');
      }
    } else {
      emailLogger.warn('RESEND_API_KEY not set, skipping Resend attempt');
    }

    // If Resend wasn't successful, try SMTP
    if (!emailSent) {
      // Rest of your existing SMTP code here
      emailLogger.info('Falling back to SMTP method');

      // Test network connectivity to Gmail SMTP
      emailLogger.info("Testing network connectivity to SMTP servers...");
      const testResults = {
        gmail587: await testSMTPConnectivity("smtp.gmail.com", 587),
        gmail465: await testSMTPConnectivity("smtp.gmail.com", 465),
        gmail25: await testSMTPConnectivity("smtp.gmail.com", 25)
      };

      emailLogger.debug("SMTP connectivity test results", testResults);

      // Find best connection option based on test results
      let bestPort = 587; // Default
      let bestSecure = false;

      if (testResults.gmail465.success) {
        bestPort = 465;
        bestSecure = true;
        emailLogger.info("Using port 465 with SSL (secure) as it tested successfully");
      } else if (testResults.gmail587.success) {
        bestPort = 587;
        bestSecure = false;
        emailLogger.info("Using port 587 with TLS (not secure option) as it tested successfully");
      } else if (testResults.gmail25.success) {
        bestPort = 25;
        bestSecure = false;
        emailLogger.info("Using port 25 as fallback as it tested successfully");
      } else {
        emailLogger.warn("All SMTP connection tests failed. Will attempt sending anyway.");
      }

      // Check if email credentials are set
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
        emailLogger.error("Email credentials not set. Using fallback credentials for testing");
        // For testing purposes only - in production, use environment variables
        process.env.EMAIL_USER = "automatacontrols@gmail.com";
        process.env.EMAIL_PASSWORD = "sifp edkq nvdm vlmj"; // This is just for testing
      }

      // Gmail SMTP configuration with selected port and security settings
      emailLogger.info(`Creating Gmail transporter`, { 
        user: process.env.EMAIL_USER, 
        port: bestPort, 
        secure: bestSecure 
      });
      
      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: bestPort,
        secure: bestSecure, // true for 465, false for other ports
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
        // Add extended timeout settings
        connectionTimeout: 90000, // 90 seconds
        greetingTimeout: 45000, // 45 seconds
        socketTimeout: 90000, // 90 seconds
        // Add debugging for troubleshooting
        debug: true,
        logger: true
      });

      // Verify transporter connection with extended error handling
      emailLogger.info("Verifying connection to Gmail SMTP server...");
      try {
        // Set a timeout for the verify operation
        const verifyPromise = transporter.verify();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("SMTP verify timeout")), 20000) // 20 second timeout
        );

        await Promise.race([verifyPromise, timeoutPromise]);
        emailLogger.info("Gmail SMTP connection verified successfully");
      } catch (verifyError) {
        emailLogger.error("Could not connect to Gmail SMTP server", { 
          error: verifyError.message, 
          code: verifyError.code 
        });

        // Provide specific troubleshooting guidance based on error
        if (verifyError.code === 'ETIMEDOUT') {
          emailLogger.error("CONNECTION TIMED OUT: This might be due to network issues or firewall rules");
        } else if (verifyError.code === 'EAUTH') {
          emailLogger.error("AUTHENTICATION FAILED: For Gmail, make sure to use an App Password");
        } else if (verifyError.message.includes('certificate')) {
          emailLogger.error("SSL/TLS CERTIFICATE ISSUE: Will try another port configuration");
        }

        // Continue anyway - we'll still try to send the email
        emailLogger.info("Continuing despite verification failure");
      }

      // Check if logo file exists
      let attachments = [];
      try {
        if (fs.existsSync(logoPath)) {
          emailLogger.debug(`Logo file found at: ${logoPath}`);
          attachments.push({
            filename: "neural-loader.png",
            path: logoPath,
            cid: "automata-logo" // Same cid value as in the html img src
          });
        } else {
          emailLogger.warn(`Logo file not found at: ${logoPath}`);
        }

        // Add other attachments
        attachments.push(
          {
            filename: "gitlab-icon.png",
            path: "https://about.gitlab.com/images/press/logo/png/gitlab-icon-rgb.png",
            cid: "gitlab-icon"
          },
          {
            filename: "github-icon.png",
            path: "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png",
            cid: "github-icon"
          }
        );
      } catch (err) {
        emailLogger.error(`Error checking logo file: ${err.message}`);
      }

      // Send email with improved HTML template - using try-catch with multiple fallback methods
      let smtpEmailInfo = null;

      // Function to create the mail options object
      const createMailOptions = () => ({
        from: `"Automata Controls Alarm System" <${process.env.EMAIL_USER}>`,
        to: emailRecipients.join(", "),
        subject: `ALERT: ${severity.toUpperCase()} - ${alarmType} at ${displayLocationName}`,
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
                    <span style="color: #333; font-weight: 500; font-size: 16px;">${assignedTechs || "None"}</span>
                  </td>
                </tr>
              </table>

              <div style="text-align: center; margin-top: 30px;">
                <a href="${dashboardUrl}" style="background-color: #0070f3; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; margin-bottom: 15px;">
                  View in Dashboard
                </a>
              </div>

              <hr style="border-color: #e1e1e1; margin: 20px 0;">

              <div style="background-color: #1f2937; padding: 15px; border-radius: 4px; margin-top: 20px; text-align: center;">
                <div style="text-align: center; margin-bottom: 10px;">
                  <span style="color: #14b8a6; font-size: 18px; font-weight: 700; letter-spacing: 0.05em;">NEURAL<span style="color: #5eead4;">BMS</span></span>
                </div>
                <div style="border-top: 1px solid #374151; width: 80%; margin: 10px auto;"></div>
                <div style="text-align: center; margin-top: 10px;">
                  <span style="color: #fcd34d; font-size: 14px; font-weight: 600;">&copy; ${new Date().getFullYear()} AutomataControls</span>
                </div>
                <div style="text-align: center; margin-top: 5px;">
                  <span style="color: #f97316; font-size: 13px; font-weight: 400;">Building<span style="color: #fb923c;">Management</span><span style="color: #fed7aa;">System</span></span>
                </div>
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
        attachments: attachments
      });

      // Create mail options once
      const mailOptions = createMailOptions();

      // First attempt: Try with the configured transporter
      try {
        emailLogger.info(`Attempting to send email via primary SMTP method (port ${bestPort})`);
        smtpEmailInfo = await transporter.sendMail(mailOptions);
        emailLogger.info(`Email sent successfully via primary SMTP method!`, { messageId: smtpEmailInfo.messageId });
        emailSent = true;
        
        for (const recipient of emailRecipients) {
          emailResults.push({ 
            recipient, 
            messageId: smtpEmailInfo.messageId, 
            method: 'smtp-primary' 
          });
          emailLogger.logEmailResult(true, recipient, 'smtp-primary', smtpEmailInfo.messageId);
        }
      } catch (primaryError) {
        emailError = primaryError;
        emailLogger.error("Primary SMTP method failed", { 
          error: primaryError.message, 
          code: primaryError.code 
        });

        // Try alternate port if first attempt failed
        try {
          emailLogger.info("Trying alternate port method (port 465 with SSL)...");

          const alternateTransporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 465,
            secure: true, // Use SSL
            auth: {
              user: process.env.EMAIL_USER,
              pass: process.env.EMAIL_PASSWORD,
            },
            connectionTimeout: 90000,
            greetingTimeout: 45000,
            socketTimeout: 90000
          });

          smtpEmailInfo = await alternateTransporter.sendMail(mailOptions);
          emailLogger.info(`Email sent successfully via alternate SMTP method!`, { messageId: smtpEmailInfo.messageId });
          emailSent = true;
          
          for (const recipient of emailRecipients) {
            emailResults.push({ 
              recipient, 
              messageId: smtpEmailInfo.messageId, 
              method: 'smtp-alternate' 
            });
            emailLogger.logEmailResult(true, recipient, 'smtp-alternate', smtpEmailInfo.messageId);
          }
        } catch (alternateError) {
          emailLogger.error("Alternate SMTP method failed", { error: alternateError.message });

          // Try port 25 as last resort
          try {
            emailLogger.info("Trying last resort SMTP method (port 25)...");

            const lastResortTransporter = nodemailer.createTransport({
              host: "smtp.gmail.com",
              port: 25,
              secure: false,
              auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD,
              },
              connectionTimeout: 90000,
              greetingTimeout: 45000,
              socketTimeout: 90000
            });

            smtpEmailInfo = await lastResortTransporter.sendMail(mailOptions);
            emailLogger.info(`Email sent successfully via last resort SMTP method!`, { messageId: smtpEmailInfo.messageId });
            emailSent = true;
            
            for (const recipient of emailRecipients) {
              emailResults.push({ 
                recipient, 
                messageId: smtpEmailInfo.messageId, 
                method: 'smtp-last-resort' 
              });
              emailLogger.logEmailResult(true, recipient, 'smtp-last-resort', smtpEmailInfo.messageId);
            }
          } catch (lastResortError) {
            emailLogger.error("All standard SMTP methods failed", {
              primary: primaryError.message,
              alternate: alternateError.message,
              lastResort: lastResortError.message
            });

            // If we still can't send, try direct-to-MX as absolute last attempt
            try {
              emailLogger.info("Attempting direct-to-MX delivery as final fallback...");

              // For Gmail, try direct MX delivery
              const directTransporter = nodemailer.createTransport({
                direct: true,
                name: 'localhost.localdomain',
                auth: {
                  user: process.env.EMAIL_USER,
                  pass: process.env.EMAIL_PASSWORD,
                },
                connectionTimeout: 120000,
                greetingTimeout: 60000,
                socketTimeout: 120000
              });

              smtpEmailInfo = await directTransporter.sendMail(mailOptions);
              emailLogger.info(`Email sent successfully via direct MX!`, { messageId: smtpEmailInfo.messageId });
              emailSent = true;
              
              for (const recipient of emailRecipients) {
                emailResults.push({ 
                  recipient, 
                  messageId: smtpEmailInfo.messageId, 
                  method: 'smtp-direct' 
                });
                emailLogger.logEmailResult(true, recipient, 'smtp-direct', smtpEmailInfo.messageId);
              }
            } catch (directError) {
              emailLogger.error("All email sending methods failed", { error: directError });
              
              for (const recipient of emailRecipients) {
                if (!emailResults.some(result => result.recipient === recipient)) {
                  emailErrors.push({ 
                    recipient, 
                    error: "All SMTP methods failed", 
                    method: 'smtp-all'
                  });
                  emailLogger.logEmailResult(false, recipient, 'smtp-all', null, "All methods failed");
                }
              }
            }
          }
        }
      }
    }

    if (emailResults.length > 0) {
      emailLogger.info(`Email successfully sent to at least ${emailResults.length} recipients`);

      // If any recipients failed, return partial success
      if (emailErrors.length > 0) {
        emailLogger.warn(`Some recipients failed: ${emailErrors.length}`);
        res.status(207).json({
          success: true,
          partial: true,
          successful: emailResults,
          failed: emailErrors
        });
      } else {
        // All recipients were successful
        res.status(200).json({
          success: true,
          results: emailResults
        });
      }
    } else {
      emailLogger.error("Email sending failed with all methods");
      res.status(500).json({
        error: "Failed to send email with all methods",
        details: emailErrors
      });
    }
  } catch (error) {
    emailLogger.error("Error in send-alarm-email handler", { 
      error: error.toString(),
      stack: error.stack,
      code: error.code,
      response: error.response
    });

    res.status(500).json({ error: "Failed to send email", details: error.message });
  }
}
