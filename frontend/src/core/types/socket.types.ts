import type { IOrgAnalyticsData } from './analytics.types';
import type { IDepartmentData } from './ticket.types';
import type { ITicketData } from './ticket.types';
import type { IUserData } from './user.types';
import type { Currency } from './api.types';

export interface SocketEventMeta {
  timestamp: string;
  orgId: string;
  triggeredBy?: string;
}

export interface SocketEnvelope<T> {
  event: string;
  data: T;
  meta: SocketEventMeta;
}

export type SocketEvents = {
  // Client → Server
  ping: undefined;
  subscribe_dept: { deptId: string };
  unsubscribe_dept: { deptId: string };

  // Server → Client
  pong: Record<string, never>;
  new_ticket: { ticket: ITicketData };
  ticket_update: { ticket: ITicketData };
  ticket_delete: { ticketId: string };
  ticket_flag: { ticket: ITicketData };
  ticket_status_change: { ticket: ITicketData };
  user_update: { user: IUserData };
  user_disable: { user: IUserData };
  dept_created: { department: IDepartmentData };
  dept_update: { department: IDepartmentData };
  budget_alert: {
    departmentId: string;
    departmentName: string;
    usagePercent: number;
    spent: number;
    budget: number;
  };
  analytics_update: { analytics: IOrgAnalyticsData };
  rates_update: { snapshotId: string; rates: Record<Currency, number>; baseCurrency: Currency };
};
