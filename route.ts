// app/api/send-alarm-email/route.ts
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { AlarmNotification } from '@/emails/alarm-notification';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { 
      alarmType, 
      details, 
      locationId, 
      alarmId, 
      severity, 
      recipients, 
      assignedTechs,
      locationName,
      equipmentName
    } = data;

    // Format timestamp
    const timestamp = new Date().toLocaleString();
    
    // Dashboard URL
    const dashboardUrl = `${process.env.APP_URL || 'http://localhost:3000'}/dashboard/alarms`;

    // Send email
    const { data: emailData, error } = await resend.emails.send({
      from: 'Alarm System <alarms@yourdomain.com>',
      to: recipients,
      subject: `[${severity.toUpperCase()}] Alarm: ${alarmType}`,
      react: AlarmNotification({
        alarmType,
        severity,
        details,
        locationName: locationName || `Location ID: ${locationId}`,
        equipmentName: equipmentName || 'Unknown Equipment',
        timestamp,
        assignedTechs,
        dashboardUrl,
      }),
      text: `${severity.toUpperCase()} ALARM: ${alarmType}\n\n${details}\n\nLocation: ${locationName || locationId}\nTime: ${timestamp}\nAssigned to: ${assignedTechs}\n\nView in dashboard: ${dashboardUrl}`,
    });

    if (error) {
      console.error('Email sending error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, messageId: emailData?.id });
  } catch (error: any) {
    console.error('Error in send-alarm-email API:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
