// Modified /opt/productionapp/app/api/cron-run-logic/route.ts with Redis caching
import { NextRequest, NextResponse } from 'next/server';
import { runAllEquipmentLogic, runEquipmentLogic, getQueueStatus } from '@/app/actions/control-logic';
import { getEquipmentWithCustomLogic } from '@/lib/control-logic';
// Add import for lead-lag-manager functions
import { performScheduledChangeovers, checkAndHandleFailovers } from '@/lib/lead-lag-manager';
// Import the queue functions
import { addEquipmentToQueue, connection } from '@/lib/queues';

// Cache TTLs in seconds
const CACHE_TTL = {
  EQUIPMENT_LIST: 60, // 1 minute cache for equipment list
};

export async function GET(request: NextRequest) {
  try {
    console.log('Starting cron-run-logic handler with BullMQ integration');

    // Get the action from URL params
    const { searchParams } = new URL(request.url);
    const equipmentId = searchParams.get('equipmentId');
    const secretKey = searchParams.get('secretKey');
    // Optional parameter to skip lead-lag management
    const skipLeadLag = searchParams.get('skipLeadLag') === 'true';
    // Optional parameter to use legacy queue system instead of BullMQ
    const useLegacyQueue = searchParams.get('legacyQueue') === 'true';
    // Optional parameter to bypass cache
    const noCache = searchParams.get('noCache') === 'true';

    console.log(`Params: equipmentId=${equipmentId}, skipLeadLag=${skipLeadLag}, useLegacyQueue=${useLegacyQueue}, noCache=${noCache}`);

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

    // Process individual equipment directly if requested
    if (equipmentId) {
      // If a specific equipment is requested, run it directly without queuing
      console.log(`Running logic for specific equipment: ${equipmentId}`);
      
      // Check cache for equipment results if caching is not disabled
      if (!noCache) {
        try {
          const cacheKey = `equipment:logic:${equipmentId}`;
          const cachedResult = await connection.get(cacheKey);
          
          if (cachedResult) {
            console.log(`Cache hit for equipment ${equipmentId}`);
            const parsedResult = JSON.parse(cachedResult);
            
            return NextResponse.json({
              success: true,
              data: parsedResult,
              leadLag: leadLagResult,
              fromCache: true
            });
          }
          console.log(`Cache miss for equipment ${equipmentId}`);
        } catch (cacheError) {
          console.warn('Redis cache error:', cacheError);
          // Continue to run logic if cache fails
        }
      }
      
      // Run the logic if not cached or cache is disabled
      const result = await runEquipmentLogic(equipmentId);
      console.log(`Completed logic for equipment ${equipmentId}`);
      
      // Cache the result for future requests
      if (!noCache) {
        try {
          const cacheKey = `equipment:logic:${equipmentId}`;
          await connection.set(
            cacheKey, 
            JSON.stringify(result), 
            'EX', 
            30 // 30 seconds TTL
          );
          console.log(`Cached result for equipment ${equipmentId}`);
        } catch (cacheError) {
          console.warn('Redis cache error:', cacheError);
        }
      }

      return NextResponse.json({
        success: true,
        data: result,
        leadLag: leadLagResult,
        fromCache: false
      });
    }

    // Get current legacy queue status (for compatibility)
    console.log('Getting legacy queue status');
    const legacyQueueStatus = await getQueueStatus();
    console.log(`Current legacy queue status: isProcessing=${legacyQueueStatus.isProcessing}, length=${legacyQueueStatus.queueLength}`);

    // If using legacy queue system, or if a process is already running in legacy queue
    if (useLegacyQueue) {
      console.log('Using legacy queue system as requested');
      // Run the regular equipment logic with the legacy queue system
      const result = await runAllEquipmentLogic();
      // Get updated queue status
      const updatedQueueStatus = await getQueueStatus();

      return NextResponse.json({
        success: true,
        data: result,
        queueStatus: updatedQueueStatus,
        leadLag: leadLagResult,
        queueSystem: 'legacy'
      });
    }

    // Otherwise, use BullMQ for parallel processing
    console.log('Using BullMQ for parallel processing');

    // Get equipment list from cache or fetch new list
    let equipmentList = [];
    const equipmentListCacheKey = 'equipment:customLogic:list';
    
    if (!noCache) {
      try {
        const cachedList = await connection.get(equipmentListCacheKey);
        if (cachedList) {
          console.log('Using cached equipment list');
          equipmentList = JSON.parse(cachedList);
        }
      } catch (cacheError) {
        console.warn('Redis cache error for equipment list:', cacheError);
      }
    }
    
    // If not cached or cache disabled, fetch the list
    if (equipmentList.length === 0) {
      console.log('Fetching fresh equipment list');
      equipmentList = await getEquipmentWithCustomLogic();
      
      // Cache the list for future requests
      if (!noCache) {
        try {
          await connection.set(
            equipmentListCacheKey, 
            JSON.stringify(equipmentList), 
            'EX', 
            CACHE_TTL.EQUIPMENT_LIST
          );
          console.log('Cached equipment list');
        } catch (cacheError) {
          console.warn('Redis cache error when storing equipment list:', cacheError);
        }
      }
    }
    
    console.log(`Found ${equipmentList.length} equipment to process with BullMQ`);

    // Log types of equipment in the list
    const typeCount = {};
    equipmentList.forEach(eq => {
      const type = eq.type || eq.equipmentType || 'unknown';
      if (!typeCount[type]) typeCount[type] = 0;
      typeCount[type]++;
    });
    console.log("Equipment types in list:", JSON.stringify(typeCount));

    // Add specific equipment that must be included (AHU-2)
    const ahu2Id = 'upkoHEsD5zVaiLFhGfs5';
    const ahu2Index = equipmentList.findIndex(equipment => equipment.id === ahu2Id);
    if (ahu2Index === -1) {
      console.log('AHU-2 not found in equipment list - adding it explicitly');
      equipmentList.push({
        id: ahu2Id,
        name: 'AHU-2',
        locationId: '5', // Adjust if needed
        type: 'Air Handler',
        equipmentType: 'Air Handler'
      });
      console.log('AHU-2 explicitly added to equipment list');
    }

    // Add each equipment to the BullMQ queue
    const queueResults = [];
    for (const equipment of equipmentList) {
      try {
        // Get equipment type, normalizing to the standard format
        let equipmentType = equipment.type || equipment.equipmentType || 'unknown';

        // Force specific types to be processed
        const isAirHandler = /air.?handler|ahu/i.test(equipmentType);
        const isFanCoil = /fan.?coil|fcu/i.test(equipmentType);

        // Log what we're processing
        if (isAirHandler) {
          console.log(`Processing Air Handler: ${equipment.name} (${equipment.id})`);
        } else if (isFanCoil) {
          console.log(`Processing Fan Coil: ${equipment.name} (${equipment.id})`);
        }

        const jobId = await addEquipmentToQueue(
          equipment.id,
          equipment.locationId || 'unknown',
          equipmentType
        );

        queueResults.push({
          equipmentId: equipment.id,
          name: equipment.name || 'Unknown',
          jobId,
          status: 'queued'
        });
      } catch (error) {
        console.error(`Error queuing equipment ${equipment.id}:`, error);
        queueResults.push({
          equipmentId: equipment.id,
          name: equipment.name || 'Unknown',
          status: 'queue_error',
          error: String(error)
        });
      }
    }

    console.log(`Added ${queueResults.length} equipment to BullMQ`);

    // Return the response with queue information
    return NextResponse.json({
      success: true,
      message: `Added ${equipmentList.length} equipment to parallel processing queue`,
      queueResults,
      legacyQueueStatus,
      leadLag: leadLagResult,
      queueSystem: 'bullmq'
    });
  } catch (error) {
    console.error('Error executing server logic:', error);
    return NextResponse.json(
      { success: false, message: String(error) },
      { status: 500 }
    );
  }
}
