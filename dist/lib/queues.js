"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connection = exports.queueEvents = exports.equipmentQueues = void 0;
exports.addEquipmentToQueue = addEquipmentToQueue;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
// Redis connection with default settings
const connection = new ioredis_1.default({
    host: 'localhost',
    port: 6379,
    maxRetriesPerRequest: null
});
exports.connection = connection;
// Log Redis connection errors
connection.on('error', (error) => {
    console.error('Redis connection error:', error);
});
// Define queues
exports.equipmentQueues = {
    // Main logic processing queue
    logicProcessor: new bullmq_1.Queue('equipment-logic', {
        connection,
        defaultJobOptions: {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 5000
            },
            removeOnComplete: 100, // Keep last 100 completed jobs
            removeOnFail: 500 // Keep last 500 failed jobs
        }
    }),
};
// Queue events for monitoring
exports.queueEvents = {
    logicProcessor: new bullmq_1.QueueEvents('equipment-logic', { connection }),
};
// Set up event listeners for monitoring
exports.queueEvents.logicProcessor.on('completed', ({ jobId }) => {
    console.log(`Job ${jobId} completed successfully`);
});
exports.queueEvents.logicProcessor.on('failed', ({ jobId, failedReason }) => {
    console.error(`Job ${jobId} failed: ${failedReason}`);
});
// Helper function to add equipment job to queue
async function addEquipmentToQueue(equipmentId, locationId, type) {
    try {
        const job = await exports.equipmentQueues.logicProcessor.add('process-equipment', {
            equipmentId,
            locationId,
            type,
            timestamp: Date.now()
        }, {
            jobId: `${locationId}_${equipmentId}_${Date.now()}`,
            priority: (type === null || type === void 0 ? void 0 : type.toLowerCase().includes('air-handler')) ? 1 : 10, // Lower number = higher priority
        });
        console.log(`Added equipment ${equipmentId} to queue with job ID ${job.id}`);
        return job.id;
    }
    catch (error) {
        console.error(`Error adding equipment ${equipmentId} to queue:`, error);
        throw error;
    }
}
