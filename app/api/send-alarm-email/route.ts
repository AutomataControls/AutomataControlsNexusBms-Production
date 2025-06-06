// @ts-nocheck
// app/api/send-alarm-email/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { render } from '@react-email/render'
import AlarmNotification from '../../../emails/alarm-notification'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const {
      alarmType,
      details,
      locationId,
      locationName,
      equipmentName,
      alarmId,
      severity,
      recipients,
      assignedTechs
    } = await request.json()

    console.log(`📧 Sending alarm email via Resend to ${recipients.length} recipients`)
    console.log(`📧 Alarm: ${alarmType} at ${locationName}`)
    console.log(`📧 Recipients: ${recipients.join(', ')}`)

    // Validate required fields
    if (!recipients || recipients.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No recipients provided'
      }, { status: 400 })
    }

    // Format timestamp in EST
    const timestamp = new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })

    // Dashboard URL
    const dashboardUrl = `${process.env.NEXT_PUBLIC_BRIDGE_URL || 'https://neuralbms.automatacontrols.com'}/dashboard/alarms`

    // Send emails to all recipients in batches
    const emailPromises = recipients.map(async (recipientEmail: string) => {
      try {
        // Determine if recipient is a technician (show dashboard button)
        const isTechnician = recipientEmail.includes('@automatacontrols.com') ||
                            assignedTechs?.toLowerCase().includes(recipientEmail.split('@')[0])

        // Render the email template (await the Promise)
        const emailHtml = await render(
          AlarmNotification({
            alarmType,
            severity,
            details,
            locationName,
            locationId,
            equipmentName,
            timestamp,
            assignedTechs: assignedTechs || 'Unassigned',
            dashboardUrl,
            alarmId,
            isTechnician
          })
        )

        // Send via Resend
        const result = await resend.emails.send({
          from: 'NeuralBMS Alerts <alerts@automatacontrols.com>',
          to: [recipientEmail],
          subject: `🚨 ${severity.toUpperCase()} ALARM: ${alarmType} at ${locationName}`,
          html: emailHtml,
          headers: {
            'X-Alarm-ID': alarmId,
            'X-Location-ID': locationId,
            'X-Severity': severity,
            'X-Equipment': equipmentName,
            'X-Timestamp': new Date().toISOString()
          }
        })

        if (result.error) {
          throw new Error(result.error.message)
        }

        console.log(`✅ Email sent to ${recipientEmail}, Message ID: ${result.data?.id}`)
        return {
          success: true,
          recipient: recipientEmail,
          messageId: result.data?.id
        }
      } catch (error) {
        console.error(`❌ Failed to send email to ${recipientEmail}:`, error)
        return {
          success: false,
          recipient: recipientEmail,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    })

    // Wait for all email sends to complete
    const results = await Promise.allSettled(emailPromises)

    // Process results
    const emailResults = results.map(result => {
      if (result.status === 'fulfilled') {
        return result.value
      } else {
        return {
          success: false,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason)
        }
      }
    })

    // Count successes and failures
    const successful = emailResults.filter(r => r.success).length
    const failed = emailResults.filter(r => !r.success).length

    console.log(`📧 Email batch summary: ${successful} sent, ${failed} failed`)

    // Log any failures for debugging
    if (failed > 0) {
      const failures = emailResults.filter(r => !r.success)
      console.log(`❌ Failed emails:`, failures)
    }

    // Return success if at least one email was sent
    if (successful > 0) {
      return NextResponse.json({
        success: true,
        messageId: `alarm-${alarmId}-${Date.now()}`,
        summary: {
          total: recipients.length,
          successful,
          failed,
          results: emailResults
        }
      })
    } else {
      return NextResponse.json({
        success: false,
        error: 'All email sends failed',
        summary: {
          total: recipients.length,
          successful,
          failed,
          results: emailResults
        }
      }, { status: 500 })
    }

  } catch (error) {
    console.error('❌ Send alarm email API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

// Health check endpoint
export async function GET() {
  try {
    // Test Resend API key
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'RESEND_API_KEY not configured'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Email API is ready',
      provider: 'Resend'
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
