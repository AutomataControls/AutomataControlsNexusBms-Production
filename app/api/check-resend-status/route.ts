// Updated /app/api/check-resend-status/route.ts
import { NextResponse } from "next/server"
import { Resend } from "resend"

export async function GET() {
  console.log("Checking Resend API status")
  
  // Check if API key is set
  if (!process.env.RESEND_API_KEY) {
    console.log("RESEND_API_KEY not set in environment variables")
    return NextResponse.json({
      status: "Not Configured",
      error: "RESEND_API_KEY not set in environment variables",
    })
  }
  
  try {
    // Initialize Resend client
    const resend = new Resend(process.env.RESEND_API_KEY)
    
    // Try a simple API call to verify the key works
    const { data, error } = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: "delivered@resend.dev", // Test address that doesn't actually send
      subject: "API Check",
      text: "Checking if API key is valid",
    })
    
    if (error) {
      console.error("Error checking Resend API:", error)
      return NextResponse.json({
        status: "Error",
        error: error.message,
      })
    }
    
    // If we get here, the API key is valid
    return NextResponse.json({
      status: "Ready",
      apiKeyValid: true,
      messageId: data?.id
    })
  } catch (error: any) {
    console.error("Error checking Resend API status:", error)
    return NextResponse.json({
      status: "Error",
      error: error.message,
    })
  }
}
