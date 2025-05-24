const { Worker } = require('bullmq');
const { connection } = require('./lib/queues');
const fetch = require('node-fetch');

// Equipment Logic Worker
const equipmentWorker = new Worker('equipment-logic', async job => {
  try {
    console.log(`Processing job ${job.id}: Equipment ${job.data.equipmentId}`);
    
    // Use the API endpoint to process the equipment
    const equipmentId = job.data.equipmentId;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const secretKey = process.env.SERVER_ACTION_SECRET_KEY || "Invertedskynet2";
    
    console.log(`Calling API to process equipment ${equipmentId}`);
    
    const response = await fetch(`${appUrl}/api/cron-run-logic?secretKey=${secretKey}&equipmentId=${equipmentId}`, {
      method: 'GET'
    });
    
    if (!response.ok) {
      throw new Error(`API call failed: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    
    console.log(`Equipment ${equipmentId} processed with result:`, 
                result.success ? 'SUCCESS' : 'FAILURE');
    return result;
  } catch (error) {
    console.error(`Error processing equipment ${job.data.equipmentId}:`, error);
    throw error; // This will trigger a retry based on the queue settings
  }
}, { 
  connection,
  // Set concurrency to process multiple jobs simultaneously
  concurrency: 5
});

// Handle worker events
equipmentWorker.on('completed', job => {
  console.log(`Job ${job.id} completed successfully`);
});

equipmentWorker.on('failed', (job, error) => {
  console.error(`Job ${job?.id} failed with error:`, error);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Worker shutting down...');
  await equipmentWorker.close();
  process.exit(0);
});

console.log('Equipment logic worker started and waiting for jobs...');
