import { OcrStatus } from "../config/constants.js";

/**
 * Structured data extracted from a receipt image by the OCR pipeline.
 * All fields are optional — OCR confidence varies by document quality.
 */
export interface IOcrData {
  /** Status of the OCR job */
  status: OcrStatus;
  /** Full raw text extracted (OCR dump) — useful for debugging / manual review */
  rawText: string | null;
  /** Confidence score 0–1 reported by the OCR model */
  confidence: number | null;
  /** ISO timestamp of when the extraction ran */
  processedAt: string | null;
}
