// Create a temporary debug API route, e.g., app/api/debug-clear-caches/route.ts
import { NextResponse } from 'next/server';
import { clearLeadLagCaches } from '@/lib/lead-lag-manager'; // Adjust path

export async function GET() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEBUG_CLEAR_CACHE !== 'true') {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  }
  try {
    const result = await clearLeadLagCaches();
    return NextResponse.json({ message: "Lead-lag caches cleared", result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
