/**
 * OCR Service — Tesseract.js + sharp
 *
 * Downloads a receipt image from S3, preprocesses it with sharp for better
 * OCR accuracy, then runs Tesseract.js to extract text. Structured fields
 * (amount, date, merchant, currency) are parsed from the raw text using regex.
 */
import Tesseract from "tesseract.js";
import sharp from "sharp";
import { IOcrData } from "../types/ocr.types.js";
import { OCR_STATUS, CURRENCIES, Currency } from "../config/constants.js";
import { downloadFile } from "./s3.service.js";
import { logError } from "../utils/logger.js";

// ─── Regex helpers ────────────────────────────────────────────────────────────

/** Matches amounts like 1,234.56 / 1234.56 / $12.50 / Rs 999 */
const AMOUNT_RE =
  /(?:total|amount|subtotal|grand\s*total|sum)[^\d]{0,20}([\d,]+\.?\d*)/i;
const AMOUNT_FALLBACK_RE = /\b([\d,]+\.\d{2})\b/;

/** Matches ISO dates (YYYY-MM-DD), US (MM/DD/YYYY), EU (DD-MM-YYYY), abbreviated month */
const DATE_RE =
  /\b(\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{2,4})\b/i;

/** Grabs the first non-empty line as a candidate merchant name */
const MERCHANT_LINES_TO_TRY = 5;

function parseAmount(text: string): number | null {
  const m = AMOUNT_RE.exec(text) ?? AMOUNT_FALLBACK_RE.exec(text);
  if (!m) return null;
  const raw = m[1]!.replace(/,/g, "");
  const val = parseFloat(raw);
  return isNaN(val) ? null : val;
}

function parseDate(text: string): string | null {
  const m = DATE_RE.exec(text);
  if (!m) return null;
  const raw = m[1]!;
  // Attempt ISO normalisation — fall back to raw string
  const d = new Date(raw);
  return isNaN(d.getTime()) ? raw : d.toISOString().split("T")[0] ?? null;
}

function parseMerchant(text: string): string | null {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 2);
  const candidate = lines.slice(0, MERCHANT_LINES_TO_TRY).find((l) => l.length > 2);
  return candidate ?? null;
}

function parseCurrency(text: string): Currency | null {
  const upper = text.toUpperCase();
  return (CURRENCIES as readonly string[]).find((c) => upper.includes(c)) as Currency | null;
}

// ─── Preprocessing ────────────────────────────────────────────────────────────

async function preprocessImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .grayscale()
    .normalize()
    .sharpen()
    .toBuffer();
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Extract structured data from a receipt stored at the given S3 key.
 *
 * @param receiptKey  - S3 object key for the receipt image
 * @param _orgId      - Organisation ID (reserved for per-org provider config)
 */
export const extractReceiptData = async (
  receiptKey: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _orgId: string,
): Promise<IOcrData> => {
  try {
    const raw = await downloadFile(receiptKey);
    const processed = await preprocessImage(raw);

    const { data } = await Tesseract.recognize(processed, "eng", {
      logger: () => { /* suppress progress logs */ },
    });

    const text = data.text ?? "";
    const confidence = data.confidence != null ? data.confidence / 100 : null;

    return {
      status: OCR_STATUS.COMPLETED,
      merchantName: parseMerchant(text),
      amount: parseAmount(text),
      currency: parseCurrency(text),
      transactionDate: parseDate(text),
      taxAmount: null,
      suggestedCategory: null,
      rawText: text,
      confidence,
      processedAt: new Date().toISOString(),
    };
  } catch (err) {
    logError(err as Error, { message: "OCR extraction failed", code: "OCR_ERROR" });
    return {
      status: OCR_STATUS.FAILED,
      merchantName: null,
      amount: null,
      currency: null,
      transactionDate: null,
      taxAmount: null,
      suggestedCategory: null,
      rawText: null,
      confidence: null,
      processedAt: new Date().toISOString(),
    };
  }
};

