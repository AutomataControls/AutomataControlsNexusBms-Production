// /opt/productionapp/app/api/cached-data/route.ts (NEW FILE)
import { NextRequest, NextResponse } from 'next/server';
import { getCachedCollection, getCachedDoc } from '@/lib/firebase-cache';

const API_SECRET = process.env.API_SECRET || 'your-secret-key';

export async function GET(request: NextRequest) {
  // Get query parameters
  const { searchParams } = new URL(request.url);
  const secretKey = searchParams.get('secretKey');
  const path = searchParams.get('path');
  const id = searchParams.get('id');
  const forceRefresh = searchParams.get('forceRefresh') === 'true';
  
  // Validate secret key for security
  if (secretKey !== API_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Validate required parameters
  if (!path) {
    return NextResponse.json({ error: 'Path is required' }, { status: 400 });
  }
  
  try {
    let data;
    
    // Get document if ID is provided, otherwise get collection
    if (id) {
      data = await getCachedDoc(path, id, { forceRefresh });
    } else {
      data = await getCachedCollection(path, { forceRefresh });
    }
    
    // Return data or 404 if not found
    if (data) {
      return NextResponse.json(data);
    } else {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
  } catch (error) {
    console.error('Error in cached-data route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
