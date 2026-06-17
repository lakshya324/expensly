import { randomUUID } from "crypto";
import { z } from "zod";

export enum QueueJobType {
  OcrScan = "ocr_scan",
  AiValidate = "ai_validate",
}

export enum QueueJobStatus {
  Queued = "queued",
  Processing = "processing",
  Completed = "completed",
  Failed = "failed",
  Retryable = "retryable",
  DeadLettered = "dead_lettered",
  Skipped = "skipped",
}

export interface QueueJobMeta {
  jobId: string;
  attempt: number;
  createdAt: string;
  traceId: string;
  requestedBy?: string;
}

interface QueueJobBase {
  meta: QueueJobMeta;
}

export interface OcrScanJob extends QueueJobBase {
  jobType: QueueJobType.OcrScan;
  ticketId: string;
  receiptId: string;
  orgId: string;
}

export interface AiValidateJob extends QueueJobBase {
  jobType: QueueJobType.AiValidate;
  ticketId: string;
  orgId: string;
}

export type QueueJob = OcrScanJob | AiValidateJob;

export enum JobFailureKind {
  Retryable = "retryable",
  NonRetryable = "non_retryable",
}

export interface JobProcessingResult {
  status: QueueJobStatus.Completed | QueueJobStatus.Failed | QueueJobStatus.Skipped;
  failureKind?: JobFailureKind;
  reason?: string;
}

export type QueueJobInput =
  | (Omit<OcrScanJob, "meta"> & { meta?: Partial<QueueJobMeta> })
  | (Omit<AiValidateJob, "meta"> & { meta?: Partial<QueueJobMeta> });

export const buildQueueJob = (job: QueueJobInput): QueueJob => {
  const createdAt = job.meta?.createdAt ?? new Date().toISOString();
  const traceId = job.meta?.traceId ?? job.meta?.jobId ?? randomUUID();
  return {
    ...job,
    meta: {
      jobId: job.meta?.jobId ?? randomUUID(),
      attempt: job.meta?.attempt ?? 0,
      createdAt,
      traceId,
      ...(job.meta?.requestedBy ? { requestedBy: job.meta.requestedBy } : {}),
    },
  } as QueueJob;
};

const metaSchema = z.object({
  jobId: z.string().min(1).default(() => randomUUID()),
  attempt: z.number().int().min(0).default(0),
  createdAt: z.string().datetime().default(() => new Date().toISOString()),
  traceId: z.string().min(1).default(() => randomUUID()),
  requestedBy: z.string().min(1).optional(),
});

const ocrJobSchema = z.object({
  jobType: z.literal(QueueJobType.OcrScan),
  ticketId: z.string().min(1),
  receiptId: z.string().min(1),
  orgId: z.string().min(1),
  meta: metaSchema.default(() => buildQueueJob({ jobType: QueueJobType.OcrScan, ticketId: "pending", receiptId: "pending", orgId: "pending" }).meta),
});

const aiJobSchema = z.object({
  jobType: z.literal(QueueJobType.AiValidate),
  ticketId: z.string().min(1),
  orgId: z.string().min(1),
  meta: metaSchema.default(() => buildQueueJob({ jobType: QueueJobType.AiValidate, ticketId: "pending", orgId: "pending" }).meta),
});

const queueJobSchema = z.discriminatedUnion("jobType", [ocrJobSchema, aiJobSchema]);

export const parseQueueJob = (raw: unknown): QueueJob => {
  const parsed = queueJobSchema.parse(raw);
  return {
    ...parsed,
    meta: {
      ...parsed.meta,
      traceId: parsed.meta.traceId || parsed.meta.jobId,
    },
  } as QueueJob;
};
