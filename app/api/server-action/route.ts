// File: /opt/productionapp/app/api/server-action/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { runAllEquipmentLogic, runEquipmentLogic } from '@/app/actions/control-logic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, equipmentId, secretKey } = body;
    
    // Simple security check - in production you'd want a more robust solution
    const expectedKey = process.env.SERVER_ACTION_SECRET_KEY || 'change-this-to-a-secure-key';
    if (secretKey !== expectedKey) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    let result;
    
    if (action === 'runAllEquipmentLogic') {
      result = await runAllEquipmentLogic();
    } else if (action === 'runEquipmentLogic' && equipmentId) {
      result = await runEquipmentLogic(equipmentId);
    } else {
      return NextResponse.json(
        { success: false, message: 'Invalid action or missing equipment ID' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error executing server action:', error);
    return NextResponse.json(
      { success: false, message: String(error) },
      { status: 500 }
    );
  }
}

// Also implement GET for simple testing
export async function GET(request: NextRequest) {
  try {
    // Get the action from URL params
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const equipmentId = searchParams.get('equipmentId');
    const secretKey = searchParams.get('secretKey');
    
    // Simple security check
    const expectedKey = process.env.SERVER_ACTION_SECRET_KEY || 'change-this-to-a-secure-key';
    if (secretKey !== expectedKey) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    let result;
    
    if (action === 'runAllEquipmentLogic') {
      result = await runAllEquipmentLogic();
    } else if (action === 'runEquipmentLogic' && equipmentId) {
      result = await runEquipmentLogic(equipmentId);
    } else {
      return NextResponse.json(
        { success: false, message: 'Invalid action or missing equipment ID' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error executing server action:', error);
    return NextResponse.json(
      { success: false, message: String(error) },
      { status: 500 }
    );
  }
}
