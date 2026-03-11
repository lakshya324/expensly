import { ITicketData } from "../../types/ticket.types.js";
import { getIO } from "../ioServer.js";
import {
  WS_EVENTS,
  WSMeta,
  NewTicketPayload,
  TicketUpdatePayload,
  TicketDeletePayload,
  TicketFlagPayload,
  TicketStatusChangePayload,
  OcrCompletedPayload,
  OcrFailedPayload,
  AiValidatedPayload,
} from "../events.types.js";

function meta(orgId: string, triggeredBy?: string): WSMeta {
  return { timestamp: new Date().toISOString(), orgId, triggeredBy };
}

export function emitNewTicket(
  orgId: string,
  ticket: ITicketData,
  triggeredBy?: string,
): void {
  const payload: NewTicketPayload = {
    event: WS_EVENTS.NEW_TICKET,
    data: { ticket },
    meta: meta(orgId, triggeredBy),
  };
  getIO().to(orgId).emit(WS_EVENTS.NEW_TICKET, payload);
}

export function emitTicketUpdate(
  orgId: string,
  ticket: ITicketData,
  triggeredBy?: string,
): void {
  const payload: TicketUpdatePayload = {
    event: WS_EVENTS.TICKET_UPDATE,
    data: { ticket },
    meta: meta(orgId, triggeredBy),
  };
  getIO().to(orgId).emit(WS_EVENTS.TICKET_UPDATE, payload);
}

export function emitTicketDelete(
  orgId: string,
  ticketId: string,
  triggeredBy?: string,
): void {
  const payload: TicketDeletePayload = {
    event: WS_EVENTS.TICKET_DELETE,
    data: { ticketId },
    meta: meta(orgId, triggeredBy),
  };
  getIO().to(orgId).emit(WS_EVENTS.TICKET_DELETE, payload);
}

export function emitTicketFlag(
  orgId: string,
  ticket: ITicketData,
  triggeredBy?: string,
): void {
  const payload: TicketFlagPayload = {
    event: WS_EVENTS.TICKET_FLAG,
    data: { ticket },
    meta: meta(orgId, triggeredBy),
  };
  getIO().to(orgId).emit(WS_EVENTS.TICKET_FLAG, payload);
}

export function emitTicketStatusChange(
  orgId: string,
  submitterId: string,
  ticket: ITicketData,
  triggeredBy?: string,
): void {
  const payload: TicketStatusChangePayload = {
    event: WS_EVENTS.TICKET_STATUS_CHANGE,
    data: { ticket },
    meta: meta(orgId, triggeredBy),
  };
  const io = getIO();
  io.to(orgId).emit(WS_EVENTS.TICKET_STATUS_CHANGE, payload);
  // Also notify the submitter on their personal room
  if (submitterId !== triggeredBy) {
    io.to(submitterId).emit(WS_EVENTS.TICKET_STATUS_CHANGE, payload);
  }
}

export function emitOcrCompleted(orgId: string, ticket: ITicketData): void {
  const payload: OcrCompletedPayload = {
    event: WS_EVENTS.OCR_COMPLETED,
    data: { ticket },
    meta: meta(orgId),
  };
  getIO().to(orgId).emit(WS_EVENTS.OCR_COMPLETED, payload);
}

export function emitOcrFailed(
  orgId: string,
  ticketId: string,
  error: string,
): void {
  const payload: OcrFailedPayload = {
    event: WS_EVENTS.OCR_FAILED,
    data: { ticketId, error },
    meta: meta(orgId),
  };
  getIO().to(orgId).emit(WS_EVENTS.OCR_FAILED, payload);
}

export function emitAiValidated(orgId: string, ticket: ITicketData): void {
  const payload: AiValidatedPayload = {
    event: WS_EVENTS.AI_VALIDATED,
    data: { ticket },
    meta: meta(orgId),
  };
  getIO().to(orgId).emit(WS_EVENTS.AI_VALIDATED, payload);
}
