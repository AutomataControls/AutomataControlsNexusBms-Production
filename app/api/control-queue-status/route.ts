import { NextRequest, NextResponse } from 'next/server';
import { equipmentQueue, isProcessingQueue } from '@/app/actions/control-logic';

export async function GET(request: NextRequest) {
  try {
    // Get the secret key from URL params
    const { searchParams } = new URL(request.url);
    const secretKey = searchParams.get('secretKey');

    // Security check with your specific key
    const expectedKey = process.env.SERVER_ACTION_SECRET_KEY || 'Invertedskynet2';
    if (secretKey !== expectedKey) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Return the current queue status
    return NextResponse.json({
      success: true,
      queueStatus: {
        isProcessing: isProcessingQueue,
        queueLength: equipmentQueue.length,
        queuedEquipment: equipmentQueue,
        timestamp: Date.now()
      }
    });
  } catch (error) {
    console.error('Error getting queue status:', error);
    return NextResponse.json(
      { success: false, message: String(error) },
      { status: 500 }
    );
  }
}
