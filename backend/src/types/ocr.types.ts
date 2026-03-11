import { OcrStatus } from "../config/constants.js";
import { Currency } from "../config/constants.js";

/**
 * Structured data extracted from a receipt image by the OCR pipeline.
 * All fields are optional — OCR confidence varies by document quality.
 */
export interface IOcrData {
  /** Status of the OCR job */
  status: OcrStatus;
  /** Merchant / vendor name as it appears on the receipt */
  merchantName: string | null;
  /** Total amount extracted from the receipt */
  amount: number | null;
  /** Currency detected or inferred from the receipt */
  currency: Currency | null;
  /** Transaction date in ISO-8601 format */
  transactionDate: string | null;
  /** Tax / VAT amount, if present */
  taxAmount: number | null;
  /** Suggested category label from the AI classification model */
  suggestedCategory: string | null;
  /** Full raw text extracted (OCR dump) — useful for debugging / manual review */
  rawText: string | null;
  /** Confidence score 0–1 reported by the OCR model */
  confidence: number | null;
  /** ISO timestamp of when the extraction ran */
  processedAt: string | null;
}
