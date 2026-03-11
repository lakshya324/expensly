/**
 * AI Jobs Worker
 *
 * Called by the cron scheduler every 15 seconds.
 * Polls SQS for up to 10 messages, dispatches each to the appropriate
 * handler, then deletes the message regardless of outcome (no retry —
 * users re-trigger via REST endpoint).
 */
import { receiveMessages, deleteMessage } from "../services/queue.service.js";
import { QueueJob } from "../types/queue.types.js";
import { processOcrJob } from "./handlers/ocr.handler.js";
import { processAiValidationJob } from "./handlers/aiValidation.handler.js";
import { logError, logInfo } from "../utils/logger.js";

async function dispatch(job: QueueJob): Promise<void> {
  if (job.jobType === "ocr_scan") {
    await processOcrJob(job);
  } else if (job.jobType === "ai_validate") {
    await processAiValidationJob(job);
  }
}

export async function processAiJobQueue(): Promise<void> {
  const messages = await receiveMessages(10);
  if (messages.length === 0) return;

  logInfo(`[AI Queue] Processing ${messages.length} job(s)`);

  await Promise.allSettled(
    messages.map(async (msg) => {
      try {
        await dispatch(msg.body);
      } catch (err) {
        logError(err as Error, {
          message: `AI job failed: ${msg.body.jobType}`,
          code: "AI_JOB_DISPATCH_ERROR",
        });
      } finally {
        // Always delete — prevents infinite requeue on bad messages
        await deleteMessage(msg.receiptHandle).catch((err) =>
          logError(err as Error, {
            message: "Failed to delete SQS message",
            code: "SQS_DELETE_ERROR",
          }),
        );
      }
    }),
  );
}
