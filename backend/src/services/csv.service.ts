import { stringify } from 'csv-stringify/sync';
import type { FlattenMaps, Types } from 'mongoose';
import { ITicket } from '../types/ticket.types.js';

type LeanTicket = FlattenMaps<ITicket> & { _id: Types.ObjectId };

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Format a Date (or string/null) as "23 Feb 2026, 14:35 UTC" — no IDs, always readable. */
function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '';
  return new Date(d).toUTCString().replace(' GMT', ' UTC');
}

/** Map internal status codes to display-friendly labels. */
function fmtStatus(s: string): string {
  const map: Record<string, string> = {
    pending: 'Pending',
    awaiting_finance: 'Awaiting Finance',
    approved: 'Approved',
    rejected: 'Rejected',
  };
  return map[s] ?? s;
}

/** Resolve a possibly-populated reviewer field to a name string. */
function reviewerName(rv: unknown): string {
  if (!rv) return '';
  if (typeof rv === 'object' && rv !== null && 'name' in rv)
    return (rv as { name: string }).name;
  return '';
}

/** Resolve a possibly-populated department field to a name string. */
function deptName(d: unknown): string {
  if (!d) return '';
  if (typeof d === 'object' && d !== null && 'name' in d)
    return (d as { name: string }).name;
  return String(d);
}

/** Resolve submittedBy to { name, email }. */
function submitterInfo(s: unknown): { name: string; email: string } {
  if (s && typeof s === 'object' && 'name' in s) {
    return {
      name: (s as { name: string }).name,
      email: 'email' in s ? (s as { email: string }).email : '',
    };
  }
  return { name: '', email: '' };
}

// ── Main Export ───────────────────────────────────────────────────────────────

/**
 * Generate a clean, human-readable CSV from populated lean ticket documents.
 * No internal IDs are exposed.
 */
export const generateTicketsCsv = (tickets: LeanTicket[]): string => {
  const headers = [
    // Core details
    'Title',
    'Description',
    'Tags',
    // Money
    'Amount',
    'Currency',
    // People / org
    'Submitted By',
    'Submitter Email',
    'Department',
    // Timestamps
    'Date Submitted',
    'Last Updated',
    // State
    'Status',
    'Flagged',
    'Receipt Attached',
    // Manager review
    'Manager Review',
    'Manager Reviewed By',
    'Manager Reviewed On',
    'Manager Comments',
    // Finance review
    'Finance Review',
    'Finance Reviewed By',
    'Finance Reviewed On',
    'Finance Comments',
  ];

  const rows = tickets.map((t) => {
    const ma = t.managerApproval as {
      required?: boolean;
      approved: boolean | null;
      reviewedBy: unknown;
      reviewedAt: Date | null;
      comments: string | null;
    } | null;
    const fa = t.financeApproval as typeof ma;

    const approvalLabel = (a: typeof ma): string => {
      if (!a || a.approved === null) return a?.required === false ? 'Not Required' : 'Pending';
      return a.approved ? 'Approved' : 'Rejected';
    };

    const { name: subName, email: subEmail } = submitterInfo(t.submittedBy);

    return [
      t.title,
      t.description ?? '',
      (t.tags ?? []).join(', '),
      // Amount — format with 2 decimal places for reliable spreadsheet import
      Number(t.amount).toFixed(2),
      t.currency,
      subName,
      subEmail,
      deptName(t.department),
      fmtDate(t.createdAt),
      fmtDate(t.updatedAt),
      fmtStatus(t.status),
      t.flagged ? 'Yes' : 'No',
      t.receiptKey ? 'Yes' : 'No',
      // Manager
      approvalLabel(ma),
      reviewerName(ma?.reviewedBy),
      fmtDate(ma?.reviewedAt),
      ma?.comments ?? '',
      // Finance
      approvalLabel(fa),
      reviewerName(fa?.reviewedBy),
      fmtDate(fa?.reviewedAt),
      fa?.comments ?? '',
    ];
  });

  return stringify([headers, ...rows]);
};
