const { Queue, Worker, QueueEvents } = require('bullmq');
const IORedis = require('ioredis');

// Redis connection with default settings
const connection = new IORedis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: null
});

// Log Redis connection errors
connection.on('error', (error) => {
  console.error('Redis connection error:', error);
});

// Define queues
const equipmentQueues = {
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
const queueEvents = {
  logicProcessor: new QueueEvents('equipment-logic', { connection }),
};

// Set up event listeners for monitoring
queueEvents.logicProcessor.on('completed', ({ jobId }) => {
  console.log(`Job ${jobId} completed successfully`);
});

queueEvents.logicProcessor.on('failed', ({ jobId, failedReason }) => {
  console.error(`Job ${jobId} failed: ${failedReason}`);
});

// Helper function to add equipment job to queue
async function addEquipmentToQueue(equipmentId, locationId, type) {
  try {
    const job = await equipmentQueues.logicProcessor.add(
      'process-equipment', 
      { 
        equipmentId, 
        locationId, 
        type, 
        timestamp: Date.now() 
      },
      {
        jobId: `${locationId}_${equipmentId}_${Date.now()}`,
        priority: type?.toLowerCase().includes('air-handler') ? 1 : 10, // Lower number = higher priority
      }
    );
    console.log(`Added equipment ${equipmentId} to queue with job ID ${job.id}`);
    return job.id;
  } catch (error) {
    console.error(`Error adding equipment ${equipmentId} to queue:`, error);
    throw error;
  }
}

// Export for use in other files
module.exports = {
  connection,
  equipmentQueues,
  queueEvents,
  addEquipmentToQueue
};
