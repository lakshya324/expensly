import { stringify } from 'csv-stringify/sync';
import type { FlattenMaps, Types } from 'mongoose';
import type { ITicket, IApproval } from '../models/index.js';

type LeanTicket = FlattenMaps<ITicket> & { _id: Types.ObjectId };

/**
 * Generate a CSV string from an array of populated lean ticket documents.
 */
export const generateTicketsCsv = (tickets: LeanTicket[]): string => {
  const headers = [
    'Title',
    'Amount',
    'Currency',
    'Department',
    'Description',
    'Tags',
    'Date',
    'Status',
    'Flagged',
    'Manager Approved',
    'Manager Approval Date',
    'Manager Comments',
    'Finance Approved',
    'Finance Approval Date',
    'Finance Comments',
  ];

  const rows = tickets.map((t) => {
    const ma = t.managerApproval as IApproval | null;
    const fa = t.financeApproval as IApproval | null;
    return [
      t.title,
      t.amount,
      t.currency,
      t.department,
      t.description ?? '',
      (t.tags ?? []).join(', '),
      t.createdAt ? new Date(t.createdAt).toISOString() : '',
      t.status,
      t.flagged ? 'Yes' : 'No',
      // Manager approval
      ma?.approved == null ? '' : ma.approved ? 'Yes' : 'No',
      ma?.reviewedAt ? new Date(ma.reviewedAt).toISOString() : '',
      ma?.comments ?? '',
      // Finance approval
      fa?.approved == null ? '' : fa.approved ? 'Yes' : 'No',
      fa?.reviewedAt ? new Date(fa.reviewedAt).toISOString() : '',
      fa?.comments ?? '',
    ];
  });

  return stringify([headers, ...rows]);
};
