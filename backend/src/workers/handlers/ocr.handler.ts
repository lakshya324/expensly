/**
 * OCR Job Handler
 *
 * Processes an `ocr_scan` job from SQS:
 * 1. Set ticket ocrData.status = PROCESSING
 * 2. Resolve receiptId → S3 key via Receipt service
 * 3. Run Tesseract OCR via ocr.service
 * 4. Save result to DB
 * 5. Auto-enqueue an ai_validate job
 * 6. Emit socket event to org room
 */
import { Ticket } from "../../models/Ticket.model.js";
import { AI_VALIDATION_STATUS, OCR_STATUS, TICKET_STATUS } from "../../config/constants.js";
import { OcrScanJob, QueueJobType } from "../../types/queue.types.js";
import { extractReceiptData } from "../../services/ocr.service.js";
import { enqueueJob } from "../../services/queue.service.js";
import { emitOcrCompleted, emitOcrFailed } from "../../websocket/handlers/ticket.handler.js";
import { logError, logInfo } from "../../utils/logger.js";
import { Receipt } from "../../models/Receipt.model.js";

function markOcrFailure(ticket: InstanceType<typeof Ticket>, isScanningFlow: boolean): void {
  if (isScanningFlow) {
    ticket.status = TICKET_STATUS.OCR_FAILED;
  }

  ticket.ocrData = {
    ...(ticket.ocrData ?? {}),
    status: OCR_STATUS.FAILED,
    processedAt: new Date().toISOString(),
  } as typeof ticket.ocrData;

  ticket.aiValidation = {
    ...(ticket.aiValidation ?? {}),
    status: AI_VALIDATION_STATUS.ERROR,
    checks: [],
    summary: "OCR extraction failed. AI validation could not be completed.",
    validatedAt: new Date().toISOString(),
    suggestedTitle: null,
    suggestedAmount: null,
    suggestedCurrency: null,
    suggestedDate: null,
    suggestedMerchantName: null,
    suggestedCategoryName: null,
    suggestedDescription: null,
    unmatchedMerchantSuggestionText: null,
    unmatchedCategorySuggestionText: null,
  } as typeof ticket.aiValidation;
}

export async function processOcrJob(job: OcrScanJob): Promise<void> {
  const { ticketId, receiptId, orgId } = job;

  // Mark as processing
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) {
    logInfo(`[OCR Worker] Ticket ${ticketId} not found — skipping`);
    return;
  }
  const isScanningFlow = ticket.status === TICKET_STATUS.SCANNING;

  ticket.ocrData = {
    ...(ticket.ocrData ?? {}),
    status: OCR_STATUS.PROCESSING,
  } as typeof ticket.ocrData;
  await ticket.save();

  const receipt = await Receipt.findOne({ _id: receiptId, orgId }).select("s3Key mimetype");
  if (!receipt) {
    markOcrFailure(ticket, isScanningFlow);
    await ticket.save();

    emitOcrFailed(orgId, ticketId, "Receipt metadata not found");
    logError(new Error("Receipt metadata not found"), {
      message: `OCR failed for ticket ${ticketId}`,
      code: "OCR_WORKER_FAILED",
    });
    return;
  }

  // Run OCR
  const ocrData = await extractReceiptData(receipt.s3Key, receipt.mimetype, orgId);
  ticket.ocrData = ocrData;
  if (ocrData.status === OCR_STATUS.FAILED) {
    markOcrFailure(ticket, isScanningFlow);
  }
  await ticket.save();

  const ticketData = await ticket.data(ticket.toObject() as never);

  if (ocrData.status === OCR_STATUS.COMPLETED) {
    emitOcrCompleted(orgId, ticketData);
    // Automatically chain AI validation
    await enqueueJob({ jobType: QueueJobType.AiValidate, ticketId, orgId });
    logInfo(`[OCR Worker] OCR completed for ticket ${ticketId} — ai_validate enqueued`);
  } else {
    emitOcrFailed(orgId, ticketId, "OCR extraction failed");
    logError(new Error("OCR failed"), {
      message: `OCR failed for ticket ${ticketId}`,
      code: "OCR_WORKER_FAILED",
    });
  }
}

