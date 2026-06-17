import databases from "../databases.js";
import { processAiJobQueue } from "./aiJobs.worker.js";
import { logError, logInfo, logSuccess } from "../utils/logger.js";
import mongoose from "mongoose";
import getRedisClient from "../config/redis.config.js";

const POLL_INTERVAL_MS = 1_000;

let isShuttingDown = false;
let inProgress = false;

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logInfo("[Worker] Shutting down", { signal });
  while (inProgress) {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  await Promise.allSettled([
    mongoose.disconnect(),
    getRedisClient().quit(),
  ]);

  process.exit(0);
}

async function poll(): Promise<void> {
  if (isShuttingDown || inProgress) return;
  inProgress = true;
  try {
    await processAiJobQueue();
  } catch (err) {
    logError(err, {
      message: "Worker queue poll failed",
      code: "WORKER_POLL_ERROR",
    });
  } finally {
    inProgress = false;
  }
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

databases()
  .then(() => {
    logSuccess("[Worker] AI queue worker started");
    setInterval(() => void poll(), POLL_INTERVAL_MS);
    void poll();
  })
  .catch((err) => {
    logError(err, {
      message: "Failed to start AI queue worker",
      code: "WORKER_START_FAILED",
    });
    process.exit(1);
  });
