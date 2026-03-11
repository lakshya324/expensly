/**
 * AI Validation Job Handler
 *
 * Processes an `ai_validate` job from SQS:
 * 1. Set ticket aiValidation.status = IN_PROGRESS
 * 2. Run OpenAI validation via aiValidation.service
 * 3. Save result to DB
 * 4. Emit socket event to org room
 */
import { Ticket } from "../../models/Ticket.model.js";
import { AI_VALIDATION_STATUS } from "../../config/constants.js";
import { AiValidateJob } from "../../types/queue.types.js";
import { validateTicket } from "../../services/aiValidation.service.js";
import { emitAiValidated } from "../../websocket/handlers/ticket.handler.js";
import { logError, logInfo } from "../../utils/logger.js";

export async function processAiValidationJob(job: AiValidateJob): Promise<void> {
  const { ticketId, orgId } = job;

  const ticket = await Ticket.findById(ticketId);
  if (!ticket) {
    logInfo(`[AI Validation Worker] Ticket ${ticketId} not found — skipping`);
    return;
  }

  // Mark as in-progress
  ticket.aiValidation = {
    ...(ticket.aiValidation ?? {}),
    status: AI_VALIDATION_STATUS.IN_PROGRESS,
    checks: [],
    summary: null,
    validatedAt: null,
  } as typeof ticket.aiValidation;
  await ticket.save();

  // Run validation
  const result = await validateTicket(ticket, ticket.ocrData ?? null);
  ticket.aiValidation = result;
  await ticket.save();

  const ticketData = await ticket.data(ticket.toObject() as never);
  emitAiValidated(orgId, ticketData);

  logInfo(
    `[AI Validation Worker] Validation ${result.status} for ticket ${ticketId}`,
  );
}
