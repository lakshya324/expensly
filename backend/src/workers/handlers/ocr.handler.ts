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
import { Organization } from "../../models/Organization.model.js";
import { AI_VALIDATION_STATUS, OCR_STATUS, TICKET_STATUS } from "../../config/constants.js";
import { JobFailureKind, JobProcessingResult, OcrScanJob, QueueJobStatus, QueueJobType } from "../../types/queue.types.js";
import { extractReceiptData } from "../../services/ocr.service.js";
import { enqueueJob } from "../../services/queue.service.js";
import { emitOcrCompleted, emitTicketFailed } from "../../websocket/handlers/ticket.handler.js";
import { logError, logInfo } from "../../utils/logger.js";
import { Receipt } from "../../models/Receipt.model.js";
import { buildTicketData } from "../../utils/ticket.utils.js";
import { markJobFinished, markJobProcessing, markJobQueued } from "../jobState.js";

function markOcrFailure(ticket: InstanceType<typeof Ticket>, isScanningFlow: boolean, reason: string): void {
  if (isScanningFlow) {
    ticket.status = TICKET_STATUS.FAILED;
  }

  ticket.ocrData = {
    ...(ticket.ocrData ?? {}),
    status: OCR_STATUS.FAILED,
    processedAt: new Date().toISOString(),
    failureReason: reason,
  } as typeof ticket.ocrData;

  ticket.aiValidation = {
    ...(ticket.aiValidation ?? {}),
    status: AI_VALIDATION_STATUS.ERROR,
    checks: [],
    summary: null,
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
    failureReason: "OCR extraction failed — AI validation could not run.",
  } as typeof ticket.aiValidation;
}

export async function processOcrJob(job: OcrScanJob): Promise<JobProcessingResult> {
  const { ticketId, receiptId, orgId } = job;
  const logContext = { jobId: job.meta.jobId, traceId: job.meta.traceId, ticketId, orgId };

  // Mark as processing
  const [ticket, org] = await Promise.all([
    Ticket.findById(ticketId),
    Organization.findById(orgId),
  ]);
  if (!ticket) {
    logInfo("[OCR Worker] Ticket not found - skipping", logContext);
    return { status: QueueJobStatus.Skipped, failureKind: JobFailureKind.NonRetryable, reason: "Ticket not found" };
  }
  if (!org) {
    logInfo("[OCR Worker] Org not found - skipping", logContext);
    return { status: QueueJobStatus.Skipped, failureKind: JobFailureKind.NonRetryable, reason: "Org not found" };
  }

  if (ticket.ocrData?.status === OCR_STATUS.COMPLETED) {
    markJobFinished(ticket, job, QueueJobStatus.Skipped, "OCR already completed");
    await ticket.save();
    return { status: QueueJobStatus.Skipped, reason: "OCR already completed" };
  }

  markJobProcessing(ticket, job);
  const isScanningFlow = ticket.status === TICKET_STATUS.SCANNING;

  ticket.ocrData = {
    ...(ticket.ocrData ?? {}),
    status: OCR_STATUS.PROCESSING,
  } as typeof ticket.ocrData;
  await ticket.save();

  const receipt = await Receipt.findOne({ _id: receiptId, orgId }).select("s3Key mimetype");
  if (!receipt) {
    const reason = "Receipt file not found. Please re-upload and try again.";
    markOcrFailure(ticket, isScanningFlow, reason);
    await ticket.save();

    const ticketDataOnFailure = await buildTicketData(ticket, org);
    emitTicketFailed(orgId, ticketDataOnFailure, reason);
    logError(new Error("Receipt metadata not found"), {
      message: `OCR failed for ticket ${ticketId}`,
      code: "OCR_WORKER_FAILED",
      ...logContext,
    });
    markJobFinished(ticket, job, QueueJobStatus.Failed, reason);
    await ticket.save();
    return { status: QueueJobStatus.Failed, failureKind: JobFailureKind.NonRetryable, reason };
  }

  // Run OCR
  const ocrData = await extractReceiptData(receipt.s3Key, receipt.mimetype, orgId);
  ticket.ocrData = ocrData;
  if (ocrData.status === OCR_STATUS.FAILED) {
    markOcrFailure(ticket, isScanningFlow, "Could not extract text from the receipt. Please ensure the image is clear and try again.");
  }
  await ticket.save();

  const ticketData = await buildTicketData(ticket, org);

  if (ocrData.status === OCR_STATUS.COMPLETED) {
    emitOcrCompleted(orgId, ticketData);
    // Automatically chain AI validation
    const chainedJob = await enqueueJob({
      jobType: QueueJobType.AiValidate,
      ticketId,
      orgId,
      meta: {
        traceId: job.meta.traceId,
        requestedBy: job.meta.requestedBy,
      },
    });
    markJobFinished(ticket, job, QueueJobStatus.Completed);
    markJobQueued(ticket, chainedJob);
    await ticket.save();
    logInfo("[OCR Worker] OCR completed - ai_validate enqueued", {
      ...logContext,
      chainedJobId: chainedJob.meta.jobId,
    });
    return { status: QueueJobStatus.Completed };
  } else {
    const reason = ticket.ocrData?.failureReason ?? "Could not extract text from the receipt.";
    emitTicketFailed(orgId, ticketData, reason);
    logError(new Error("OCR failed"), {
      message: `OCR failed for ticket ${ticketId}`,
      code: "OCR_WORKER_FAILED",
      ...logContext,
    });
    markJobFinished(ticket, job, QueueJobStatus.Failed, reason);
    await ticket.save();
    return { status: QueueJobStatus.Failed, failureKind: JobFailureKind.NonRetryable, reason };
  }
}
