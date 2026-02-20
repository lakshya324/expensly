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
