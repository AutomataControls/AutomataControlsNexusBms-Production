// File: pages/api/test-notifier.js
// Description: API endpoint for testing alarm email notifications

import fetch from "node-fetch"

export default async function handler(req, res) {
  console.log("📧 Test Notifier API route called at", new Date().toLocaleTimeString())

  // Require POST method
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    // Get test parameters from request body
    const {
      email,       // Single email or array of emails to send test to
      severity = "info",  // Can be "info", "warning", or "critical"
      locationId = "1",   // Default to first location in mapping
      equipmentName = "Test Equipment",
      includeDetails = true, // Whether to include extra test details
      testName = "Email Notification Test"
    } = req.body

    // Validate required parameters
    if (!email) {
      return res.status(400).json({ error: "Email parameter is required" })
    }

    // Format emails as array
    const emails = Array.isArray(email) ? email : [email]
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const invalidEmails = emails.filter(e => !emailRegex.test(e))
    
    if (invalidEmails.length > 0) {
      return res.status(400).json({ 
        error: "Invalid email format", 
        invalidEmails
      })
    }

    // Create timestamp for test
    const timestamp = new Date().toISOString()
    
    // Create test message with useful details
    const testDetails = includeDetails 
      ? `This is a test alarm notification sent at ${timestamp}. 
         This message was generated from the test-notifier API to verify email delivery.
         
         The email system is using the following configuration:
         - SMTP: smtp.gmail.com
         - Ports tested: 587 (TLS), 465 (SSL), 25 (fallback)
         - Multiple delivery methods are attempted if the primary method fails.
         
         If you're receiving this email, it means that the email notification system is working correctly.`
      : "This is a test notification message."

    console.log(`📧 Sending test notification to ${emails.length} recipients:`, emails)

    // Call the send-alarm-email API
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000'}/api/send-alarm-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        alarmType: testName,
        details: testDetails,
        locationId: locationId,
        locationName: "Test Location",
        equipmentName: equipmentName,
        alarmId: `test-${Date.now()}`,
        severity: severity,
        recipients: emails,
        assignedTechs: "Test Technician"
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error("📧 Email API returned error:", errorData)
      return res.status(response.status).json({ 
        error: "Failed to send test email", 
        details: errorData 
      })
    }

    const result = await response.json()
    console.log("📧 Test email sent successfully:", result)

    res.status(200).json({
      success: true,
      message: `Test email sent to ${emails.join(", ")}`,
      timestamp: timestamp,
      result: result
    })
  } catch (error) {
    console.error("📧 Error sending test email:", error)
    res.status(500).json({ error: "Internal server error", details: error.message })
  }
}
