/**
 * OCR Job Handler
 *
 * Processes an `ocr_scan` job from SQS:
 * 1. Set ticket ocrData.status = PROCESSING
 * 2. Run Tesseract OCR via ocr.service
 * 3. Save result to DB
 * 4. Auto-enqueue an ai_validate job
 * 5. Emit socket event to org room
 */
import { Ticket } from "../../models/Ticket.model.js";
import { OCR_STATUS } from "../../config/constants.js";
import { OcrScanJob } from "../../types/queue.types.js";
import { extractReceiptData } from "../../services/ocr.service.js";
import { enqueueJob } from "../../services/queue.service.js";
import { emitOcrCompleted, emitOcrFailed } from "../../websocket/handlers/ticket.handler.js";
import { logError, logInfo } from "../../utils/logger.js";

export async function processOcrJob(job: OcrScanJob): Promise<void> {
  const { ticketId, receiptKey, orgId } = job;

  // Mark as processing
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) {
    logInfo(`[OCR Worker] Ticket ${ticketId} not found — skipping`);
    return;
  }

  ticket.ocrData = {
    ...(ticket.ocrData ?? {}),
    status: OCR_STATUS.PROCESSING,
  } as typeof ticket.ocrData;
  await ticket.save();

  // Run OCR
  const ocrData = await extractReceiptData(receiptKey, orgId);
  ticket.ocrData = ocrData;
  await ticket.save();

  const ticketData = await ticket.data(ticket.toObject() as never);

  if (ocrData.status === OCR_STATUS.COMPLETED) {
    emitOcrCompleted(orgId, ticketData);
    // Automatically chain AI validation
    await enqueueJob({ jobType: "ai_validate", ticketId, orgId });
    logInfo(`[OCR Worker] OCR completed for ticket ${ticketId} — ai_validate enqueued`);
  } else {
    emitOcrFailed(orgId, ticketId, "OCR extraction failed");
    logError(new Error("OCR failed"), {
      message: `OCR failed for ticket ${ticketId}`,
      code: "OCR_WORKER_FAILED",
    });
  }
}
