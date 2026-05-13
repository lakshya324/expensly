/**
 * AI Validation Job Handler
 *
 * Processes an `ai_validate` job from SQS:
 * 1. Set ticket aiValidation.status = IN_PROGRESS
 * 2. Run OpenAI validation via aiValidation.service
 * 3. Save result to DB
 * 4. If ticket was in `scanning` state — auto-fill extracted fields and promote to `draft`
 * 5. Emit socket event to org room
 */
import { Ticket } from "../../models/Ticket.model.js";
import { Organization } from "../../models/Organization.model.js";
import { AI_VALIDATION_STATUS, TICKET_STATUS, CURRENCIES } from "../../config/constants.js";
import { AiValidateJob } from "../../types/queue.types.js";
import { validateTicket } from "../../services/aiValidation.service.js";
import { resolveMerchantAndCategoryMatches } from "../../services/merchantCategoryMatcher.service.js";
import { emitAiValidated, emitTicketUpdate } from "../../websocket/handlers/ticket.handler.js";
import { logError, logInfo } from "../../utils/logger.js";
import { buildTicketData } from "../../utils/ticket.utils.js";
import type { Currency } from "../../config/constants.js";

// ─── Job processor ────────────────────────────────────────────────────────────

export async function processAiValidationJob(job: AiValidateJob): Promise<void> {
  const { ticketId, orgId } = job;

  const [ticket, org] = await Promise.all([
    Ticket.findById(ticketId),
    Organization.findById(orgId),
  ]);

  if (!ticket) {
    logInfo(`[AI Validation Worker] Ticket ${ticketId} not found — skipping`);
    return;
  }
  if (!org) {
    logInfo(`[AI Validation Worker] Org ${orgId} not found — skipping`);
    return;
  }

  const wasScanning = ticket.status === TICKET_STATUS.SCANNING;

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
  } as typeof ticket.aiValidation;
  await ticket.save();

  // Run validation (also extracts ticket fields from rawText for scanning flow)
  const result = await validateTicket(ticket, ticket.ocrData ?? null);

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
      // Fetch name for snapshot (one-time async write, acceptable in worker context)
      try {
        const { Merchant } = await import("../../models/Merchant.model.js");
        const m = await Merchant.findById(matchedEntities.merchantId).select("_id name").lean();
        ticket.merchantSnapshot = m ? { _id: m._id, name: m.name } : null;
      } catch {
        // Non-fatal — snapshot will be null until propagation or next update
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
    logInfo(`[AI Validation Worker] Promoted ticket ${ticketId} scanning → draft`);
  }

  ticket.aiValidation = result;
  await ticket.save();

  const ticketData = await buildTicketData(ticket, org);

  emitAiValidated(orgId, ticketData);

  if (wasScanning) {
    emitTicketUpdate(orgId, ticketData);
  }

  logInfo(
    `[AI Validation Worker] Validation ${result.status} for ticket ${ticketId}`,
  );
}
