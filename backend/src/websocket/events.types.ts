/**
 * WebSocket Event Type Definitions
 *
 * Every event follows the envelope:
 * { event: string, data: T, meta: { timestamp, orgId, triggeredBy? } }
 */
import { ITicketData } from "../types/ticket.types.js";
import { IUserData } from "../types/user.types.js";
import { IDepartmentData } from "../types/department.types.js";
import { IOrgAnalyticsData } from "../types/analytics.types.js";

// ---------------------------------------------------------------------------
// Envelope
// ---------------------------------------------------------------------------
export interface WSMeta {
  timestamp: string;
  orgId: string;
  triggeredBy?: string;
}

export interface WSEnvelope<T = unknown> {
  event: string;
  data: T;
  meta: WSMeta;
}

// ---------------------------------------------------------------------------
// Ticket events
// ---------------------------------------------------------------------------
export const WS_EVENTS = {
  // Tickets
  NEW_TICKET: "new_ticket",
  TICKET_UPDATE: "ticket_update",
  TICKET_DELETE: "ticket_delete",
  TICKET_FLAG: "ticket_flag",
  TICKET_STATUS_CHANGE: "ticket_status_change",

  // Users
  USER_UPDATE: "user_update",
  USER_DISABLE: "user_disable",

  // Departments
  DEPT_CREATED: "dept_created",
  DEPT_UPDATE: "dept_update",

  // Budget
  BUDGET_ALERT: "budget_alert",

  // Analytics
  ANALYTICS_UPDATE: "analytics_update",

  // Exchange Rates
  RATES_UPDATE: "rates_update",

  // OCR & AI async results
  OCR_COMPLETED: "ticket:ocr_completed",
  OCR_FAILED: "ticket:ocr_failed",
  AI_VALIDATED: "ticket:ai_validated",

  // System
  PING: "ping",
  PONG: "pong",
} as const;

export type WSEventName = (typeof WS_EVENTS)[keyof typeof WS_EVENTS];

// ---------------------------------------------------------------------------
// Event payloads
// ---------------------------------------------------------------------------
export type NewTicketPayload = WSEnvelope<{ ticket: ITicketData }>;
export type TicketUpdatePayload = WSEnvelope<{ ticket: ITicketData }>;
export type TicketDeletePayload = WSEnvelope<{ ticketId: string }>;
export type TicketFlagPayload = WSEnvelope<{ ticket: ITicketData }>;
export type TicketStatusChangePayload = WSEnvelope<{ ticket: ITicketData }>;

export type UserUpdatePayload = WSEnvelope<{ user: IUserData }>;
export type UserDisablePayload = WSEnvelope<{ user: IUserData }>;

export type DeptCreatedPayload = WSEnvelope<{ department: IDepartmentData }>;
export type DeptUpdatePayload = WSEnvelope<{ department: IDepartmentData }>;

export type BudgetAlertPayload = WSEnvelope<{
  departmentId: string;
  departmentName: string;
  usagePercent: number;
  spent: number;
  budget: number;
}>;

export type AnalyticsUpdatePayload = WSEnvelope<{ analytics: IOrgAnalyticsData }>;

export type RatesUpdatePayload = WSEnvelope<{
  snapshotId: string;
  rates: Record<string, number>;
  baseCurrency: string;
}>;

export type OcrCompletedPayload = WSEnvelope<{ ticket: ITicketData }>;
export type OcrFailedPayload = WSEnvelope<{ ticketId: string; error: string }>;
export type AiValidatedPayload = WSEnvelope<{ ticket: ITicketData }>;
