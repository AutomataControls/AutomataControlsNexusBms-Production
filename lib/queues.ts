// @ts-nocheck
import { Queue, Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';

// Redis connection with default settings
const connection = new IORedis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: null
});

// Log Redis connection events
connection.on('error', (error) => {
  console.error('Redis connection error:', error);
});

connection.on('connect', () => {
  console.log('Redis connected successfully');
});

connection.on('ready', () => {
  console.log('Redis ready for operations');
});

// Define queues
export const equipmentQueues = {
  // Main logic processing queue
  logicProcessor: new Queue('equipment-logic', {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000
      },
      removeOnComplete: 100,  // Keep last 100 completed jobs
      removeOnFail: 500       // Keep last 500 failed jobs
    }
  }),
};

// Queue events for monitoring
export const queueEvents = {
  logicProcessor: new QueueEvents('equipment-logic', { connection }),
};

// Set up event listeners for monitoring
queueEvents.logicProcessor.on('completed', ({ jobId }) => {
  console.log(`Job ${jobId} completed successfully`);
});

queueEvents.logicProcessor.on('failed', ({ jobId, failedReason }) => {
  console.error(`Job ${jobId} failed: ${failedReason}`);
});

queueEvents.logicProcessor.on('stalled', ({ jobId }) => {
  console.warn(`Job ${jobId} stalled`);
});

queueEvents.logicProcessor.on('waiting', ({ jobId }) => {
  console.log(`Job ${jobId} is waiting`);
});

queueEvents.logicProcessor.on('active', ({ jobId }) => {
  console.log(`Job ${jobId} is now active`);
});

// Helper function to add equipment job to queue with deduplication
export async function addEquipmentToQueue(equipmentId: string, locationId: string, type: string) {
  try {
    // Use equipmentId as jobId to prevent duplicates
    // Same equipment cannot be queued multiple times
    const job = await equipmentQueues.logicProcessor.add(
      'process-equipment',
      {
        equipmentId,
        locationId,
        type,
        timestamp: Date.now()
      },
      {
        jobId: equipmentId, // CRITICAL: Use equipmentId only - this prevents duplicates
        priority: type?.toLowerCase().includes('air-handler') ? 1 : 10, // Lower number = higher priority
        removeOnComplete: 10, // Auto-cleanup completed jobs
        removeOnFail: 5,      // Keep failed jobs for debugging
        attempts: 3,          // Retry failed jobs up to 3 times
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        // Add delay to prevent overwhelming the system
        delay: Math.floor(Math.random() * 1000), // Random delay 0-1000ms to spread load
      }
    );
    
    console.log(`Added equipment ${equipmentId} to queue with job ID ${job.id}`);
    return job.id;
    
  } catch (error: any) {
    // Handle duplicate job error gracefully - this is expected behavior
    if (error.message && (
        error.message.includes('Job is already') || 
        error.message.includes('duplicate') ||
        error.message.includes('already exists')
      )) {
      console.log(`Equipment ${equipmentId} already queued, skipping duplicate - this is normal`);
      return null; // Not an error, just a duplicate prevention
    }
    
    // Log other errors but don't throw - allows other equipment to continue processing
    console.error(`Error adding equipment ${equipmentId} to queue:`, error.message || error);
    throw error;
  }
}

// Helper function to get queue status
export async function getQueueStatus() {
  try {
    const waiting = await equipmentQueues.logicProcessor.getWaiting();
    const active = await equipmentQueues.logicProcessor.getActive();
    const completed = await equipmentQueues.logicProcessor.getCompleted();
    const failed = await equipmentQueues.logicProcessor.getFailed();
    
    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      total: waiting.length + active.length
    };
  } catch (error) {
    console.error('Error getting queue status:', error);
    return {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      total: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Helper function to clear queue (for maintenance)
export async function clearQueue(includeActive = false) {
  try {
    console.log('Clearing equipment queue...');
    
    // Clear waiting jobs
    await equipmentQueues.logicProcessor.drain();
    
    // Clear completed and failed jobs
    await equipmentQueues.logicProcessor.clean(0, 1000, 'completed');
    await equipmentQueues.logicProcessor.clean(0, 1000, 'failed');
    
    if (includeActive) {
      // This will cancel active jobs - use with caution
      const activeJobs = await equipmentQueues.logicProcessor.getActive();
      for (const job of activeJobs) {
        await job.remove();
      }
      console.log(`Cleared ${activeJobs.length} active jobs`);
    }
    
    console.log('Queue cleared successfully');
    return true;
  } catch (error) {
    console.error('Error clearing queue:', error);
    return false;
  }
}

// Helper function to check if equipment is already queued
export async function isEquipmentQueued(equipmentId: string): Promise<boolean> {
  try {
    // Check if job exists in waiting or active states
    const job = await equipmentQueues.logicProcessor.getJob(equipmentId);
    if (job) {
      const state = await job.getState();
      return ['waiting', 'active', 'delayed'].includes(state);
    }
    return false;
  } catch (error) {
    console.warn(`Error checking if equipment ${equipmentId} is queued:`, error);
    return false; // Assume not queued if we can't check
  }
}

// Helper function to remove specific equipment from queue
export async function removeEquipmentFromQueue(equipmentId: string): Promise<boolean> {
  try {
    const job = await equipmentQueues.logicProcessor.getJob(equipmentId);
    if (job) {
      await job.remove();
      console.log(`Removed equipment ${equipmentId} from queue`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error removing equipment ${equipmentId} from queue:`, error);
    return false;
  }
}

// Graceful shutdown function
export async function closeQueues() {
  try {
    console.log('Closing queue connections...');
    
    // Close queue events
    await queueEvents.logicProcessor.close();
    
    // Close queues
    await equipmentQueues.logicProcessor.close();
    
    // Close Redis connection
    await connection.quit();
    
    console.log('Queue connections closed successfully');
  } catch (error) {
    console.error('Error closing queue connections:', error);
  }
}

// Handle process termination
process.on('SIGTERM', closeQueues);
process.on('SIGINT', closeQueues);

// Export connection for reuse
export { connection };
