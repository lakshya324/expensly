/**
 * Queue Job Type Definitions
 * Each job carries a `jobType` discriminator so the worker can dispatch correctly.
 */

export interface OcrScanJob {
  jobType: "ocr_scan";
  ticketId: string;
  receiptKey: string;
  orgId: string;
}

export interface AiValidateJob {
  jobType: "ai_validate";
  ticketId: string;
  orgId: string;
}

export type QueueJob = OcrScanJob | AiValidateJob;
