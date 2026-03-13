/**
 * Queue Job Type Definitions
 * Each job carries a `jobType` discriminator so the worker can dispatch correctly.
 */

export enum QueueJobType {
  OcrScan = "ocr_scan",
  AiValidate = "ai_validate",
}

export interface OcrScanJob {
  jobType: QueueJobType.OcrScan;
  ticketId: string;
  receiptId: string;
  orgId: string;
}

export interface AiValidateJob {
  jobType: QueueJobType.AiValidate;
  ticketId: string;
  orgId: string;
}

export type QueueJob = OcrScanJob | AiValidateJob;
