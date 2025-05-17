// /app/api/test-control-command/route.ts
import { NextResponse } from 'next/server';
import { handleControlCommand } from '../control-commands-handler';

export async function POST(request: Request) {
  try {
    const commandData = await request.json();
    console.log("Test endpoint received command:", JSON.stringify(commandData, null, 2));
    
    const result = await handleControlCommand(commandData);
    console.log("Handler result:", JSON.stringify(result, null, 2));
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in test endpoint:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
