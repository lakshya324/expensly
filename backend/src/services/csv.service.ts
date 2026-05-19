import { stringify } from 'csv-stringify/sync';
import type { FlattenMaps, Types } from 'mongoose';
import { ITicket } from '../types/ticket.types.js';

type LeanTicket = FlattenMaps<ITicket> & { _id: Types.ObjectId };

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '';
  return new Date(d).toUTCString().replace(' GMT', ' UTC');
}

function fmtStatus(s: string): string {
  const map: Record<string, string> = {
    pending: 'Pending',
    awaiting_finance: 'Awaiting Finance',
    approved: 'Approved',
    rejected: 'Rejected',
  };
  return map[s] ?? s;
}

/**
 * Generate a clean, human-readable CSV from lean ticket documents.
 * Uses embedded snapshot fields for all display names - no populated refs needed.
 */
export const generateTicketsCsv = (tickets: LeanTicket[]): string => {
  const headers = [
    'Title', 'Description', 'Tags',
    'Amount', 'Currency',
    'Submitted By', 'Submitter Email', 'Department',
    'Date Submitted', 'Last Updated',
    'Status', 'Flagged', 'Receipt Attached',
    'Manager Review', 'Manager Reviewed By', 'Manager Reviewed On', 'Manager Comments',
    'Finance Review', 'Finance Reviewed By', 'Finance Reviewed On', 'Finance Comments',
  ];

  const rows = tickets.map((t) => {
    const ma = t.managerApproval;
    const fa = t.financeApproval;

    const approvalLabel = (a: typeof ma): string => {
      if (!a || a.approved === null) return a?.required === false ? 'Not Required' : 'Pending';
      return a.approved ? 'Approved' : 'Rejected';
    };

    return [
      t.title ?? '',
      t.description ?? '',
      (t.tags ?? []).join(', '),
      Number(t.amount).toFixed(2),
      t.currency ?? '',
      // All display names come from embedded snapshots - no DB lookup needed
      t.submitterSnapshot?.name ?? '',
      t.submitterSnapshot?.email ?? '',
      t.departmentSnapshot?.name ?? '',
      fmtDate(t.createdAt),
      fmtDate(t.updatedAt),
      fmtStatus(t.status),
      t.flagged ? 'Yes' : 'No',
      (t.receiptIds?.length ?? 0) > 0 ? 'Yes' : 'No',
      approvalLabel(ma),
      ma?.reviewerSnapshot?.name ?? '',
      fmtDate(ma?.reviewedAt),
      ma?.comments ?? '',
      approvalLabel(fa),
      fa?.reviewerSnapshot?.name ?? '',
      fmtDate(fa?.reviewedAt),
      fa?.comments ?? '',
    ];
  });

  return stringify([headers, ...rows]);
};
