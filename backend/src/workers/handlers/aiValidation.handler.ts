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
import { Types } from "mongoose";
import { Ticket } from "../../models/Ticket.model.js";
import { Merchant } from "../../models/Merchant.model.js";
import { AI_VALIDATION_STATUS, TICKET_STATUS, CURRENCIES } from "../../config/constants.js";
import { AiValidateJob } from "../../types/queue.types.js";
import { validateTicket } from "../../services/aiValidation.service.js";
import { emitAiValidated, emitTicketUpdate } from "../../websocket/handlers/ticket.handler.js";
import { logError, logInfo } from "../../utils/logger.js";
import type { Currency } from "../../config/constants.js";

// ─── Merchant fuzzy-match helper ──────────────────────────────────────────────

/** Strip all non-alphanumeric chars and lowercase for fuzzy comparison. */
function normalizeStr(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Attempt to match the AI-suggested merchant name against the org's merchant list.
 * Returns the matched merchant's ObjectId or null if no confident match is found.
 */
async function findMatchingMerchant(
  orgId: string,
  suggestedName: string | null | undefined,
): Promise<Types.ObjectId | null> {
  if (!suggestedName) return null;
  const normInput = normalizeStr(suggestedName);
  if (!normInput) return null;

  const merchants = await Merchant.find({
    orgId: new Types.ObjectId(orgId),
    isActive: true,
  }).select("_id normalizedName");

  for (const m of merchants) {
    const normMerchant = normalizeStr(m.normalizedName);
    // Exact or contained-match on normalized strings
    if (normMerchant === normInput || normMerchant.includes(normInput) || normInput.includes(normMerchant)) {
      return m._id;
    }
  }
  return null;
}

// ─── Job processor ────────────────────────────────────────────────────────────

export async function processAiValidationJob(job: AiValidateJob): Promise<void> {
  const { ticketId, orgId } = job;

  const ticket = await Ticket.findById(ticketId);
  if (!ticket) {
    logInfo(`[AI Validation Worker] Ticket ${ticketId} not found — skipping`);
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
  } as typeof ticket.aiValidation;
  await ticket.save();

  // Run validation (also extracts ticket fields from rawText for scanning flow)
  const result = await validateTicket(ticket, ticket.ocrData ?? null);
  ticket.aiValidation = result;

  // ─── Scanning → Draft promotion ───────────────────────────────────────────
  if (wasScanning) {
    // Auto-fill ticket fields from AI extraction
    if (result.suggestedTitle) ticket.title = result.suggestedTitle;
    if (result.suggestedAmount != null) ticket.amount = result.suggestedAmount;
    if (
      result.suggestedCurrency &&
      (CURRENCIES as readonly string[]).includes(result.suggestedCurrency)
    ) {
      ticket.currency = result.suggestedCurrency as Currency;
    }
    // Keep OCR-extracted date in ocrData (transactionDate) if AI extracted it
    if (result.suggestedDate && ticket.ocrData && !ticket.ocrData.transactionDate) {
      ticket.ocrData.transactionDate = result.suggestedDate;
    }

    // Fuzzy-match merchant and link if confident
    const matchedMerchantId = await findMatchingMerchant(orgId, result.suggestedMerchantName);
    if (matchedMerchantId) {
      ticket.merchant = matchedMerchantId;
    }

    // Promote to draft — the user now sees their ticket pre-filled and can review/edit
    ticket.status = TICKET_STATUS.DRAFT;
    logInfo(`[AI Validation Worker] Promoted ticket ${ticketId} scanning → draft`);
  }

  await ticket.save();

  const ticketData = await ticket.data(ticket.toObject() as never);

  // Always emit AI validated event for the AI status icon on FE
  emitAiValidated(orgId, ticketData);

  // For the scanning → draft transition, also emit a full ticket update so the
  // FE can replace the scanning placeholder row with the newly filled draft.
  if (wasScanning) {
    emitTicketUpdate(orgId, ticketData);
  }

  logInfo(
    `[AI Validation Worker] Validation ${result.status} for ticket ${ticketId}`,
  );
}
