// /app/api/control-commands/route.ts
import { NextResponse } from 'next/server';
import { handleControlCommand } from '../control-commands-handler';

export async function POST(request: Request) {
  try {
    const commandData = await request.json();
    const result = await handleControlCommand(commandData);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error handling control command:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
