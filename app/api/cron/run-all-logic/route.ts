import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secretKey = searchParams.get('secretKey') || 'Invertedskynet2'; // Default fallback
  
  // Get the base URL
  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;
  
  // Redirect to the correct endpoint with the secretKey
  const redirectUrl = `${baseUrl}/api/cron-run-logic?secretKey=${secretKey}`;
  console.log(`Redirecting from deprecated /api/cron/run-all-logic to ${redirectUrl}`);
  
  return NextResponse.redirect(redirectUrl);
}
