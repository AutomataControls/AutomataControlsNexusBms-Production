"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bullmq_1 = require("bullmq");
const queues_1 = require("@/lib/queues");
const control_logic_1 = require("@/app/actions/control-logic");
// Equipment Logic Worker
const equipmentWorker = new bullmq_1.Worker('equipment-logic', async (job) => {
    try {
        console.log(`Processing job ${job.id}: Equipment ${job.data.equipmentId}`);
        // Process the equipment logic
        const result = await (0, control_logic_1.runEquipmentLogic)(job.data.equipmentId);
        // Return the result
        console.log(`Equipment ${job.data.equipmentId} processed with result:`, result.success ? 'SUCCESS' : 'FAILURE');
        return result;
    }
    catch (error) {
        console.error(`Error processing equipment ${job.data.equipmentId}:`, error);
        throw error; // This will trigger a retry based on the queue settings
    }
}, {
    connection: queues_1.connection,
    // Set concurrency to process multiple jobs simultaneously
    concurrency: 5
});
// Handle worker events
equipmentWorker.on('completed', job => {
    console.log(`Job ${job.id} completed successfully`);
});
equipmentWorker.on('failed', (job, error) => {
    console.error(`Job ${job === null || job === void 0 ? void 0 : job.id} failed with error:`, error);
});
// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('Worker shutting down...');
    await equipmentWorker.close();
    process.exit(0);
});
console.log('Equipment logic worker started and waiting for jobs...');
