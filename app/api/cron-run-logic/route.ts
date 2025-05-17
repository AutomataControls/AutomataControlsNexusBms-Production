import { NextRequest, NextResponse } from 'next/server';
import { runAllEquipmentLogic, runEquipmentLogic, getQueueStatus } from '@/app/actions/control-logic';
// Add import for lead-lag-manager functions
import { performScheduledChangeovers, checkAndHandleFailovers } from '@/lib/lead-lag-manager';

export async function GET(request: NextRequest) {
  try {
    console.log('Starting cron-run-logic handler');
    
    // Get the action from URL params
    const { searchParams } = new URL(request.url);
    const equipmentId = searchParams.get('equipmentId');
    const secretKey = searchParams.get('secretKey');
    // Optional parameter to skip lead-lag management
    const skipLeadLag = searchParams.get('skipLeadLag') === 'true';
    
    console.log(`Params: equipmentId=${equipmentId}, skipLeadLag=${skipLeadLag}`);
    
    // Security check with your specific key
    const expectedKey = process.env.SERVER_ACTION_SECRET_KEY || 'Invertedskynet2';
    if (secretKey !== expectedKey) {
      console.log('Unauthorized access attempt');
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Log the request
    console.log(`Received logic execution request at ${new Date().toISOString()}`);
    
    // Run lead-lag management if not skipped
    let leadLagResult = null;
    if (!skipLeadLag) {
      try {
        console.log('Running lead-lag management tasks');
        // Check for equipment failures and handle failovers
        const failoverResult = await checkAndHandleFailovers();
        // Check if it's time for scheduled changeovers
        const changeoverResult = await performScheduledChangeovers();
        leadLagResult = {
          success: true,
          failoverResult,
          changeoverResult
        };
        console.log('Lead-lag management completed successfully');
      } catch (leadLagError) {
        console.error('Error in lead-lag management:', leadLagError);
        leadLagResult = {
          success: false,
          error: String(leadLagError)
        };
        // Continue with equipment logic even if lead-lag fails
      }
    }
    
    // Get current queue status
    console.log('Getting queue status');
    const queueStatus = await getQueueStatus();
    console.log(`Current queue status: isProcessing=${queueStatus.isProcessing}, length=${queueStatus.queueLength}`);
    
    // Run the regular equipment logic (with queue system)
    let result;
    if (equipmentId) {
      // If a specific equipment is requested, run it directly without queuing
      console.log(`Running logic for specific equipment: ${equipmentId}`);
      result = await runEquipmentLogic(equipmentId);
      console.log(`Completed logic for equipment ${equipmentId}`);
    } else {
      // Check if a process is already running
      if (queueStatus.isProcessing) {
        console.log('Queue is already processing, returning current queue state');
        // Return info about current queue state instead of waiting
        return NextResponse.json({
          success: true,
          message: 'Logic execution already in progress, returning current queue state',
          queueStatus: {
            isProcessing: queueStatus.isProcessing,
            queueLength: queueStatus.queueLength,
            timestamp: Date.now()
          },
          leadLag: leadLagResult
        });
      }
      
      // Otherwise, run normally which will queue the equipment
      console.log('Running logic for all equipment - triggering runAllEquipmentLogic()');
      result = await runAllEquipmentLogic();
      console.log('Completed runAllEquipmentLogic() call');
    }
    
    // Get updated queue status
    console.log('Getting updated queue status');
    const updatedQueueStatus = await getQueueStatus();
    console.log(`Updated queue status: isProcessing=${updatedQueueStatus.isProcessing}, length=${updatedQueueStatus.queueLength}`);
    
    // Log the result
    console.log(`Logic execution completed with ${result ? (result.success ? 'success' : 'failure') : 'no result'}`);
    console.log('Result details:', JSON.stringify(result).substring(0, 200));
    
    // Return the response with queue information
    console.log('Returning success response');
    return NextResponse.json({
      success: true,
      data: result,
      queueStatus: updatedQueueStatus,
      leadLag: leadLagResult // Add lead-lag results if available
    });
  } catch (error) {
    console.error('Error executing server logic:', error);
    return NextResponse.json(
      { success: false, message: String(error) },
      { status: 500 }
    );
  }
}
