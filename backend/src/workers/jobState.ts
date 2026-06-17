import { QueueJob, QueueJobStatus } from "../types/queue.types.js";
import type { ITicket } from "../types/ticket.types.js";

export function markJobQueued(ticket: ITicket, job: QueueJob): void {
  const existing = ticket.processingJobs.find((entry) => entry.jobId === job.meta.jobId);
  if (existing) return;

  ticket.processingJobs.push({
    jobId: job.meta.jobId,
    jobType: job.jobType,
    status: QueueJobStatus.Queued,
    attempt: job.meta.attempt,
    traceId: job.meta.traceId,
    reason: null,
    queuedAt: job.meta.createdAt,
    startedAt: null,
    finishedAt: null,
  });
}

export function markJobProcessing(ticket: ITicket, job: QueueJob): void {
  markJobQueued(ticket, job);
  const existing = ticket.processingJobs.find((entry) => entry.jobId === job.meta.jobId);
  if (!existing) return;

  existing.status = QueueJobStatus.Processing;
  existing.attempt = job.meta.attempt;
  existing.startedAt = new Date().toISOString();
  existing.reason = null;
}

export function markJobFinished(
  ticket: ITicket,
  job: QueueJob,
  status: QueueJobStatus.Completed | QueueJobStatus.Failed | QueueJobStatus.Retryable | QueueJobStatus.Skipped,
  reason: string | null = null,
): void {
  markJobQueued(ticket, job);
  const existing = ticket.processingJobs.find((entry) => entry.jobId === job.meta.jobId);
  if (!existing) return;

  existing.status = status;
  existing.attempt = job.meta.attempt;
  existing.finishedAt = new Date().toISOString();
  existing.reason = reason;
}
