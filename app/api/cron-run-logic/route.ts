// /opt/productionapp/app/api/cron-run-logic/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { runEquipmentLogic } from '@/app/actions/control-logic';
import { getEquipmentWithCustomLogic } from '@/lib/control-logic';
import { performScheduledChangeovers, checkAndHandleFailovers } from '@/lib/lead-lag-manager';
import { equipmentQueues, connection } from '@/lib/queues';

// Optimized cache TTLs
const CACHE_TTL = {
  EQUIPMENT_LIST: 60 * 60 * 4,      // 4 hours (equipment rarely changes)
  PROCESSING_LOCK: 60 * 3,          // 3 minutes max processing time
  EQUIPMENT_RESULT: 60 * 2,         // 2 minutes (longer cache for stable results)
  LEAD_LAG_LOCK: 60 * 10,          // 10 minutes between lead-lag tasks
  QUEUE_STATUS: 30,                 // 30 seconds for queue status
};

// Redis keys
const REDIS_KEYS = {
  PROCESSING_LOCK: 'cron:processing:lock',
  EQUIPMENT_LIST: 'equipment:list:cached',  
  LEAD_LAG_LAST_RUN: 'lead-lag:last-run',
  QUEUE_STATUS: 'queue:status:cached',
};

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  
  console.log(`[${new Date().toISOString()}] cron-run-logic: Handler started (${requestId})`);

  try {
    const { searchParams } = new URL(request.url);
    const equipmentId = searchParams.get('equipmentId');
    const secretKey = searchParams.get('secretKey');
    const force = searchParams.get('force') === 'true';
    const debugLogs = searchParams.get('debug') === 'true';

    // Authentication
    const expectedKey = process.env.SERVER_ACTION_SECRET_KEY || 'Invertedskynet2';
    if (secretKey !== expectedKey) {
      console.warn(`cron-run-logic: Unauthorized access attempt from ${request.ip}`);
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // Path 1: Individual Equipment Processing (Optimized - this works great!)
    if (equipmentId) {
      return await processIndividualEquipment(equipmentId, debugLogs, startTime, requestId);
    }

    // Path 2: Batch Equipment Processing (New Optimized Approach)
    return await processBatchEquipment(force, debugLogs, startTime, requestId);

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`cron-run-logic: Critical error (${requestId}). Duration: ${duration}ms.`, error);
    
    // Release processing lock on error
    try {
      await connection.del(REDIS_KEYS.PROCESSING_LOCK);
    } catch (lockError) {
      console.warn('Failed to release processing lock on error:', lockError);
    }
    
    return NextResponse.json(
      { success: false, message: String(error.message || error), requestId },
      { status: 500 }
    );
  }
}

// Optimized individual equipment processing
async function processIndividualEquipment(equipmentId: string, debugLogs: boolean, startTime: number, requestId: string) {
  console.log(`cron-run-logic: Processing individual equipment: ${equipmentId} (${requestId})`);
  
  let resultFromCache = false;
  let result: any = null;

  // Check cache first (extended TTL)
  try {
    const cacheKey = `equipment:result:${equipmentId}`;
    const cachedResult = await connection.get(cacheKey);
    if (cachedResult) {
      result = JSON.parse(cachedResult);
      resultFromCache = true;
      if (debugLogs) console.log(`Cache hit for equipment ${equipmentId}`);
    }
  } catch (cacheError: any) {
    console.warn(`Cache error for ${equipmentId}:`, cacheError.message);
  }

  // Process if not cached
  if (!resultFromCache) {
    result = await runEquipmentLogic(equipmentId);
    
    // Cache result with longer TTL
    try {
      const cacheKey = `equipment:result:${equipmentId}`;
      await connection.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL.EQUIPMENT_RESULT);
      if (debugLogs) console.log(`Cached result for equipment ${equipmentId}`);
    } catch (cacheError: any) {
      console.warn(`Failed to cache result for ${equipmentId}:`, cacheError.message);
    }
  }

  const duration = Date.now() - startTime;
  console.log(`cron-run-logic: Completed ${equipmentId}. Duration: ${duration}ms. Cached: ${resultFromCache} (${requestId})`);
  
  return NextResponse.json({
    success: true,
    data: result,
    fromCache: resultFromCache,
    durationMs: duration,
    requestId
  });
}

// Optimized batch processing with smart deduplication
async function processBatchEquipment(force: boolean, debugLogs: boolean, startTime: number, requestId: string) {
  console.log(`cron-run-logic: Starting batch processing (${requestId})`);

  // 1. CONCURRENCY CONTROL - Prevent multiple batch runs
  if (!force) {
    const isProcessing = await connection.get(REDIS_KEYS.PROCESSING_LOCK);
    if (isProcessing) {
      const lockTime = parseInt(isProcessing);
      const timeSince = Math.round((Date.now() - lockTime) / 1000);
      console.log(`cron-run-logic: Batch processing already active (${timeSince}s ago). Skipping. (${requestId})`);
      
      return NextResponse.json({
        success: true,
        message: 'Batch processing already active. Skipped duplicate request.',
        skipped: true,
        timeSinceLastRun: timeSince,
        durationMs: Date.now() - startTime,
        requestId
      });
    }
  }

  // Set processing lock
  await connection.set(REDIS_KEYS.PROCESSING_LOCK, Date.now().toString(), 'EX', CACHE_TTL.PROCESSING_LOCK);
  console.log(`cron-run-logic: Set processing lock (${requestId})`);

  try {
    // 2. SMART EQUIPMENT LIST MANAGEMENT
    const equipmentList = await getOptimizedEquipmentList(debugLogs, requestId);
    
    if (!equipmentList || equipmentList.length === 0) {
      console.warn(`cron-run-logic: No equipment found (${requestId})`);
      return NextResponse.json({
        success: true,
        message: 'No equipment found to process.',
        equipmentCount: 0,
        durationMs: Date.now() - startTime,
        requestId
      });
    }

    console.log(`cron-run-logic: Processing ${equipmentList.length} equipment (${requestId})`);

    // 3. INTELLIGENT QUEUEING - Only add if not already queued
    const queueResults = await addEquipmentToQueueOptimized(equipmentList, debugLogs, requestId);

    // 4. LEAD-LAG MANAGEMENT (Optional)
    const leadLagStatus = await handleLeadLagTasks(requestId);

    const duration = Date.now() - startTime;
    const successCount = queueResults.filter(r => r.status === 'queued' || r.status === 'already_queued').length;
    
    console.log(`cron-run-logic: Batch complete. ${successCount}/${equipmentList.length} processed. Duration: ${duration}ms (${requestId})`);

    return NextResponse.json({
      success: true,
      message: `Processed ${successCount} of ${equipmentList.length} equipment.`,
      equipmentCount: equipmentList.length,
      queuedCount: queueResults.filter(r => r.status === 'queued').length,
      alreadyQueuedCount: queueResults.filter(r => r.status === 'already_queued').length,
      errorCount: queueResults.filter(r => r.status === 'error').length,
      queueResults: debugLogs ? queueResults : undefined,
      leadLagManagement: leadLagStatus,
      durationMs: duration,
      requestId
    });

  } finally {
    // Always release the processing lock
    try {
      await connection.del(REDIS_KEYS.PROCESSING_LOCK);
      if (debugLogs) console.log(`Released processing lock (${requestId})`);
    } catch (lockError) {
      console.warn(`Failed to release processing lock (${requestId}):`, lockError);
    }
  }
}

// Optimized equipment list retrieval with smart caching
async function getOptimizedEquipmentList(debugLogs: boolean, requestId: string): Promise<any[]> {
  try {
    // Try cache first
    const cachedList = await connection.get(REDIS_KEYS.EQUIPMENT_LIST);
    if (cachedList) {
      const equipmentList = JSON.parse(cachedList);
      if (debugLogs) console.log(`Using cached equipment list: ${equipmentList.length} items (${requestId})`);
      return equipmentList;
    }

    // Fetch fresh list
    if (debugLogs) console.log(`Fetching fresh equipment list (${requestId})`);
    const equipmentList = await getEquipmentWithCustomLogic();
    
    // Cache the list
    if (Array.isArray(equipmentList) && equipmentList.length > 0) {
      await connection.set(REDIS_KEYS.EQUIPMENT_LIST, JSON.stringify(equipmentList), 'EX', CACHE_TTL.EQUIPMENT_LIST);
      if (debugLogs) console.log(`Cached equipment list: ${equipmentList.length} items (${requestId})`);
    }

    return equipmentList || [];
    
  } catch (error: any) {
    console.error(`Error getting equipment list (${requestId}):`, error.message);
    return [];
  }
}

// Intelligent queue management - only add if not already queued
async function addEquipmentToQueueOptimized(equipmentList: any[], debugLogs: boolean, requestId: string) {
  const results: any[] = [];
  let addedCount = 0;
  let alreadyQueuedCount = 0;
  let errorCount = 0;

  for (const equipment of equipmentList) {
    try {
      const equipmentId = equipment.id;
      const equipmentType = equipment.type || equipment.equipmentType || 'unknown';
      
      // Check if already in queue (active, waiting, or delayed)
      const existingJob = await equipmentQueues.logicProcessor.getJob(equipmentId);
      
      if (existingJob) {
        const jobState = await existingJob.getState();
        if (['waiting', 'active', 'delayed'].includes(jobState)) {
          results.push({
            equipmentId,
            name: equipment.name || 'Unknown',
            status: 'already_queued',
            jobState
          });
          alreadyQueuedCount++;
          continue;
        }
      }

      // Add to queue with equipment ID as job ID (fixes deduplication!)
      const job = await equipmentQueues.logicProcessor.add(
        'process-equipment',
        {
          equipmentId,
          locationId: equipment.locationId || 'unknown',
          type: equipmentType,
          timestamp: Date.now()
        },
        {
          jobId: equipmentId, // CRITICAL: This prevents duplicates
          priority: equipmentType.toLowerCase().includes('air-handler') ? 1 : 10,
          removeOnComplete: 10,
          removeOnFail: 5,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          delay: Math.floor(Math.random() * 1000), // Spread load
        }
      );

      results.push({
        equipmentId,
        name: equipment.name || 'Unknown',
        jobId: job.id,
        status: 'queued'
      });
      addedCount++;

    } catch (error: any) {
      // Handle duplicate gracefully
      if (error.message?.includes('Job is already') || error.message?.includes('duplicate')) {
        results.push({
          equipmentId: equipment.id,
          name: equipment.name || 'Unknown',
          status: 'already_queued',
          reason: 'duplicate_prevention'
        });
        alreadyQueuedCount++;
      } else {
        console.error(`Error queuing equipment ${equipment.id} (${requestId}):`, error.message);
        results.push({
          equipmentId: equipment.id,
          name: equipment.name || 'Unknown',
          status: 'error',
          error: error.message
        });
        errorCount++;
      }
    }
  }

  console.log(`Queue summary (${requestId}): Added=${addedCount}, AlreadyQueued=${alreadyQueuedCount}, Errors=${errorCount}`);
  return results;
}

// Optimized lead-lag task management
async function handleLeadLagTasks(requestId: string) {
  try {
    const lastRunStr = await connection.get(REDIS_KEYS.LEAD_LAG_LAST_RUN);
    const now = Date.now();
    const tenMinutesInMs = 10 * 60 * 1000;

    if (!lastRunStr || (now - parseInt(lastRunStr)) > tenMinutesInMs) {
      await connection.set(REDIS_KEYS.LEAD_LAG_LAST_RUN, now.toString(), 'EX', CACHE_TTL.LEAD_LAG_LOCK);
      
      console.log(`Running lead-lag management tasks (${requestId})`);
      const failoverResult = await checkAndHandleFailovers();
      const changeoverResult = await performScheduledChangeovers();
      
      return {
        ranThisInvocation: true,
        result: { success: true, failoverResult, changeoverResult }
      };
    } else {
      const timeSinceLastRun = Math.round((now - parseInt(lastRunStr)) / 1000 / 60);
      return {
        ranThisInvocation: false,
        message: `Skipped, ran ${timeSinceLastRun} mins ago`
      };
    }
  } catch (error: any) {
    console.error(`Lead-lag management error (${requestId}):`, error.message);
    return {
      ranThisInvocation: true,
      result: { success: false, error: error.message }
    };
  }
}
