// File: app/api/test-react-email/route.ts
import { NextResponse } from "next/server"
import { Resend } from "resend"
import { AlarmNotification } from "@/emails/alarm-notification"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function GET(request: Request) {
  // Get email from query parameter
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email') || process.env.DEFAULT_RECIPIENT || 'automatacontrols@gmail.com'
  const severity = searchParams.get('severity') || 'info'
  
  // Log debugging info
  console.log("📧 Test React Email API called")
  console.log("Email:", email)
  console.log("Severity:", severity)
  console.log("RESEND_API_KEY:", process.env.RESEND_API_KEY ? "Set (length: " + process.env.RESEND_API_KEY.length + ")" : "Not set")
  
  try {
    // Timestamp for the test
    const timestamp = new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: true
    })
    
    const testAlarmType = "React Email Test"
    const testDetails = `This is a test email from the React Email testing endpoint. 
This email was sent on ${timestamp} to verify that the Resend API and React Email components are working correctly.`
    const testLocationName = "Test Location"
    const testEquipmentName = "Test Equipment"
    const testAssignedTechs = "Test Technician"
    const testAlarmId = `test-${Date.now()}`
    const dashboardUrl = `${process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://neuralbms.automatacontrols.com"}/dashboard/alarms`
    
    // Send email using the existing React Email component
    const { data, error } = await resend.emails.send({
      from: "Automata Controls DevOps <DevOps@automatacontrols.com>",
      to: [email],
      subject: `TEST: ${severity.toUpperCase()} - ${testAlarmType}`,
      react: AlarmNotification({
        alarmType: testAlarmType,
        severity: severity as "info" | "warning" | "critical",
        details: testDetails,
        locationName: testLocationName,
        equipmentName: testEquipmentName,
        timestamp,
        assignedTechs: testAssignedTechs,
        dashboardUrl,
        alarmId: testAlarmId,
      }),
    })
    
    console.log("Email send result:", data ? "Success" : "Failed")
    
    if (error) {
      console.error("Failed to send email:", error)
      return NextResponse.json({ 
        success: false, 
        error: error.message 
      }, { status: 500 })
    }
    
    return NextResponse.json({ 
      success: true, 
      messageId: data?.id,
      details: {
        to: email,
        severity,
        timestamp
      }
    })
  } catch (error: any) {
    console.error("Error in test email API:", error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}
