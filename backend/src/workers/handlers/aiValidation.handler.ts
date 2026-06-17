/**
 * AI Validation Job Handler
 *
 * Processes an `ai_validate` job from SQS:
 * 1. Set ticket aiValidation.status = IN_PROGRESS
 * 2. Run OpenAI validation via aiValidation.service
 * 3. Save result to DB
 * 4. If ticket was in `scanning` state - auto-fill extracted fields and promote to `draft`
 * 5. Emit socket event to org room
 *
 * If the AI call throws, the ticket is marked as FAILED (scanning flow) or left
 * with aiValidation.status = ERROR (draft/pending flow) so it never silently stalls.
 */
import { Ticket } from "../../models/Ticket.model.js";
import { Organization } from "../../models/Organization.model.js";
import { AI_VALIDATION_STATUS, TICKET_STATUS, CURRENCIES } from "../../config/constants.js";
import { AiValidateJob, JobFailureKind, JobProcessingResult, QueueJobStatus } from "../../types/queue.types.js";
import { validateTicket } from "../../services/aiValidation.service.js";
import { resolveMerchantAndCategoryMatches } from "../../services/merchantCategoryMatcher.service.js";
import { emitAiValidated, emitTicketFailed, emitTicketUpdate } from "../../websocket/handlers/ticket.handler.js";
import { logError, logInfo } from "../../utils/logger.js";
import { buildTicketData } from "../../utils/ticket.utils.js";
import type { Currency } from "../../config/constants.js";
import { markJobFinished, markJobProcessing } from "../jobState.js";

// ─── Job processor ────────────────────────────────────────────────────────────

export async function processAiValidationJob(job: AiValidateJob): Promise<JobProcessingResult> {
  const { ticketId, orgId } = job;
  const logContext = { jobId: job.meta.jobId, traceId: job.meta.traceId, ticketId, orgId };

  const [ticket, org] = await Promise.all([
    Ticket.findById(ticketId),
    Organization.findById(orgId),
  ]);

  if (!ticket) {
    logInfo("[AI Validation Worker] Ticket not found - skipping", logContext);
    return { status: QueueJobStatus.Skipped, failureKind: JobFailureKind.NonRetryable, reason: "Ticket not found" };
  }
  if (!org) {
    logInfo("[AI Validation Worker] Org not found - skipping", logContext);
    return { status: QueueJobStatus.Skipped, failureKind: JobFailureKind.NonRetryable, reason: "Org not found" };
  }

  if (
    ticket.aiValidation?.status === AI_VALIDATION_STATUS.PASSED ||
    ticket.aiValidation?.status === AI_VALIDATION_STATUS.FLAGGED
  ) {
    markJobFinished(ticket, job, QueueJobStatus.Skipped, "AI validation already completed");
    await ticket.save();
    return { status: QueueJobStatus.Skipped, reason: "AI validation already completed" };
  }

  const wasScanning = ticket.status === TICKET_STATUS.SCANNING;
  markJobProcessing(ticket, job);

  // Mark as in-progress
  ticket.aiValidation = {
    ...(ticket.aiValidation ?? {}),
    status: AI_VALIDATION_STATUS.IN_PROGRESS,
    checks: [],
    summary: null,
    validatedAt: null,
    suggestedTitle: null,
    suggestedAmount: null,
    suggestedCurrency: null,
    suggestedDate: null,
    suggestedMerchantName: null,
    suggestedCategoryName: null,
    suggestedDescription: null,
    unmatchedMerchantSuggestionText: null,
    unmatchedCategorySuggestionText: null,
    failureReason: null,
  } as typeof ticket.aiValidation;
  await ticket.save();

  let result;
  try {
    result = await validateTicket(ticket, ticket.ocrData ?? null);
  } catch (err) {
    const reason = "AI validation provider failed. The queue will retry this job.";
    markJobFinished(ticket, job, QueueJobStatus.Retryable, reason);
    await ticket.save();

    logError(err as Error, {
      message: `AI validation failed for ticket ${ticketId}`,
      code: "AI_VALIDATION_WORKER_FAILED",
      ...logContext,
      wasScanning,
    });
    return { status: QueueJobStatus.Failed, failureKind: JobFailureKind.Retryable, reason };
  }

  // ─── Scanning → Draft promotion ───────────────────────────────────────────
  if (wasScanning) {
    if (result.suggestedTitle) ticket.title = result.suggestedTitle;
    if (result.suggestedAmount != null) ticket.amount = result.suggestedAmount;
    if (
      result.suggestedCurrency &&
      (CURRENCIES as readonly string[]).includes(result.suggestedCurrency)
    ) {
      ticket.currency = result.suggestedCurrency as Currency;
    }
    if (result.suggestedDescription && !ticket.description?.trim()) {
      ticket.description = result.suggestedDescription;
    }

    const matchedEntities = await resolveMerchantAndCategoryMatches({
      orgId,
      suggestedMerchantName: result.suggestedMerchantName,
      suggestedCategoryName: result.suggestedCategoryName,
    });

    if (matchedEntities.merchantId) {
      ticket.merchant = matchedEntities.merchantId;
      try {
        const { Merchant } = await import("../../models/Merchant.model.js");
        const m = await Merchant.findById(matchedEntities.merchantId).select("_id name").lean();
        ticket.merchantSnapshot = m ? { _id: m._id, name: m.name } : null;
      } catch {
        // Non-fatal - snapshot will be null until propagation or next update
      }
    }
    if (matchedEntities.categoryId) {
      ticket.category = matchedEntities.categoryId;
      try {
        const { Category } = await import("../../models/Category.model.js");
        const c = await Category.findById(matchedEntities.categoryId).select("_id name").lean();
        ticket.categorySnapshot = c ? { _id: c._id, name: c.name } : null;
      } catch {
        // Non-fatal
      }
    }
    result.unmatchedMerchantSuggestionText = matchedEntities.unmatchedMerchantSuggestionText;
    result.unmatchedCategorySuggestionText = matchedEntities.unmatchedCategorySuggestionText;

    ticket.status = TICKET_STATUS.DRAFT;
    logInfo("[AI Validation Worker] Promoted scanning ticket to draft", logContext);
  }

  ticket.aiValidation = result;
  markJobFinished(ticket, job, QueueJobStatus.Completed);
  await ticket.save();

  const ticketData = await buildTicketData(ticket, org);

  emitAiValidated(orgId, ticketData);

  if (wasScanning) {
    emitTicketUpdate(orgId, ticketData);
  }

  logInfo(
    "[AI Validation Worker] Validation completed",
    { ...logContext, validationStatus: result.status },
  );
  return { status: QueueJobStatus.Completed };
}
