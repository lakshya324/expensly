/**
 * OCR Service — Tesseract.js + sharp (+ PDF text extraction)
 *
 * Downloads a receipt from S3. Image files are preprocessed with sharp and
 * passed to Tesseract OCR. PDF files are parsed directly for embedded text.
 * Raw extracted text is persisted as-is for downstream AI validation.
 */
import Tesseract from "tesseract.js";
import sharp from "sharp";
import { IOcrData } from "../types/ocr.types.js";
import { OCR_STATUS } from "../config/constants.js";
import { downloadFile } from "./s3.service.js";
import { extractTextFromPdf } from "./pdf.service.js";
import { logError } from "../utils/logger.js";

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
  receiptMimetype: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _orgId: string,
): Promise<IOcrData> => {
  try {
    const raw = await downloadFile(receiptKey);
    let text = "";
    let confidence: number | null = null;

    if (receiptMimetype === "application/pdf") {
      text = await extractTextFromPdf(raw);
      if (!text) {
        throw new Error("No extractable text found in PDF");
      }
    } else {
      const processed = await preprocessImage(raw);

      const { data } = await Tesseract.recognize(processed, "eng", {
        logger: () => { /* suppress progress logs */ },
      });

      text = data.text ?? "";
      confidence = data.confidence != null ? data.confidence / 100 : null;
    }

    return {
      status: OCR_STATUS.COMPLETED,
      rawText: text,
      confidence,
      processedAt: new Date().toISOString(),
    };
  } catch (err) {
    logError(err as Error, {
      message: "OCR extraction failed",
      code: "OCR_ERROR",
      details: { receiptKey, receiptMimetype },
    });
    return {
      status: OCR_STATUS.FAILED,
      rawText: null,
      confidence: null,
      processedAt: new Date().toISOString(),
    };
  }
};

