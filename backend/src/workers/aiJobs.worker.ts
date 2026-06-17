/**
 * AI Jobs Worker
 *
 * Called by the cron scheduler every 15 seconds.
 * Polls SQS for up to 10 messages, dispatches each to the appropriate
 * handler, then deletes the message regardless of outcome (no retry -
 * users re-trigger via REST endpoint).
 */
import { receiveMessages, deleteMessage } from "../services/queue.service.js";
import { JobFailureKind, JobProcessingResult, QueueJob, QueueJobStatus, QueueJobType } from "../types/queue.types.js";
import { processOcrJob } from "./handlers/ocr.handler.js";
import { processAiValidationJob } from "./handlers/aiValidation.handler.js";
import { logError, logInfo } from "../utils/logger.js";

async function dispatch(job: QueueJob): Promise<JobProcessingResult> {
  if (job.jobType === QueueJobType.OcrScan) {
    return processOcrJob(job);
  } else if (job.jobType === QueueJobType.AiValidate) {
    return processAiValidationJob(job);
  }
  return {
    status: QueueJobStatus.Failed,
    failureKind: JobFailureKind.NonRetryable,
    reason: "Unsupported job type",
  };
}

export async function processAiJobQueue(): Promise<void> {
  const messages = await receiveMessages(10);
  if (messages.length === 0) return;

  logInfo("[AI Queue] Processing jobs", { count: messages.length });

  await Promise.allSettled(
    messages.map(async (msg) => {
      const startedAt = Date.now();
      const jobContext = {
        jobId: msg.body.meta.jobId,
        traceId: msg.body.meta.traceId,
        jobType: msg.body.jobType,
        attempt: msg.body.meta.attempt,
        receiveCount: msg.receiveCount,
        messageId: msg.messageId,
      };
      try {
        const result = await dispatch(msg.body);
        const shouldDelete =
          result.status === QueueJobStatus.Completed ||
          result.status === QueueJobStatus.Skipped ||
          result.failureKind === JobFailureKind.NonRetryable;

        logInfo("[AI Queue] Job finished", {
          ...jobContext,
          jobStatus: result.status,
          failureKind: result.failureKind,
          reason: result.reason,
          durationMs: Date.now() - startedAt,
        });

        if (shouldDelete) {
          await deleteMessage(msg.receiptHandle);
        }
      } catch (err) {
        logError(err as Error, {
          message: `AI job failed: ${msg.body.jobType}`,
          code: "AI_JOB_DISPATCH_ERROR",
          ...jobContext,
          durationMs: Date.now() - startedAt,
        });
      }
    }),
  );
}
