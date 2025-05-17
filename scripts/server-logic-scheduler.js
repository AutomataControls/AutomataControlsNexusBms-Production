// server-logic-scheduler.js
const { CronJob } = require("cron");
const fetch = require("node-fetch"); // You'll need to install this if not already installed

// Store active jobs
const activeJobs = {};

// Flag to track if scheduler has been initialized
let schedulerInitialized = false;

// Store the last run time in memory
let lastRunTime = 0;

// Function to start the scheduler
function startScheduler() {
  // Prevent multiple initializations in the same process
  if (schedulerInitialized) {
    console.log("Scheduler already initialized in this process, skipping");
    return;
  }

  console.log("Starting server-side scheduler");

  try {
    // Create a job that runs every 15 seconds
    const job = new CronJob(
      "*/15 * * * * *", // Cron expression: run every 15 seconds
      async () => {
        try {
          const now = Date.now();
          console.log(`Running scheduled logic for all equipment at ${new Date(now).toISOString()}`);

          // Update the last run time
          lastRunTime = now;

          // Call the API endpoint to run logic for all equipment
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
          const secretKey = process.env.SERVER_ACTION_SECRET_KEY || "Invertedskynet2";
          console.log(`Using app URL: ${appUrl}`);

          const response = await fetch(`${appUrl}/api/cron-run-logic?secretKey=${secretKey}`, {
            method: "GET",
          });

          if (!response.ok) {
            console.error(`Failed to run scheduled logic: ${response.status} ${response.statusText}`);
            return;
          }

          const result = await response.json();
          console.log("Scheduled logic run completed:", result);
        } catch (error) {
          console.error("Error in scheduled job:", error);
        }
      },
      null, // onComplete
      true, // start
      "America/New_York", // timezone
    );

    // Store the job with the correct key name
    activeJobs["cron-run-logic"] = job;

    // Set the initialized flag
    schedulerInitialized = true;

    console.log("Scheduler initialized and running:", job.running);

    return job;
  } catch (error) {
    console.error("Error starting scheduler:", error);
    throw error;
  }
}

// Function to stop the scheduler
function stopScheduler() {
  console.log("Stopping server-side scheduler");

  // Stop all active jobs
  Object.values(activeJobs).forEach((job) => {
    if (job.running) {
      job.stop();
    }
  });

  // Reset the initialized flag
  schedulerInitialized = false;
}

// Function to check if the scheduler is running
function isSchedulerRunning() {
  // First check if any jobs are running in the current process
  const isRunningInProcess = Object.values(activeJobs).some((job) => job.running);

  // If running in the current process, return true
  if (isRunningInProcess) {
    console.log("Scheduler is running in the current process");
    return true;
  }

  // If not running in the current process, check if it ran recently
  const now = Date.now();
  const lastRun = lastRunTime;
  const maxInterval = 30000; // 30 seconds

  // If it ran within the last 30 seconds, consider it running
  if (lastRun > 0 && now - lastRun < maxInterval) {
    console.log(`Scheduler ran recently (${Math.round((now - lastRun) / 1000)}s ago)`);
    return true;
  }

  console.log("Scheduler is not running");
  return false;
}

// Function to manually trigger the scheduler logic
async function runSchedulerLogic() {
  try {
    const now = Date.now();
    console.log(`Manually running scheduler logic at ${new Date(now).toISOString()}`);

    // Update the last run time
    lastRunTime = now;

    // Call the API endpoint to run logic for all equipment
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const secretKey = process.env.SERVER_ACTION_SECRET_KEY || "Invertedskynet2";

    const response = await fetch(`${appUrl}/api/cron-run-logic?secretKey=${secretKey}`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`Failed to run scheduled logic: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log("Manual scheduler logic run completed:", result);

    return result;
  } catch (error) {
    console.error("Error running scheduler logic manually:", error);
    throw error;
  }
}

// Export functions for potential use elsewhere
module.exports = {
  startScheduler,
  stopScheduler,
  isSchedulerRunning,
  runSchedulerLogic
};

// IMPORTANT: Actually start the scheduler when this file is loaded
console.log("Auto-starting scheduler on script load");
startScheduler();
