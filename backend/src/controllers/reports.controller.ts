import { Request, Response, NextFunction } from 'express';
import { generateTicketsCsv } from '../services/csv.service.js';
import { TICKET_STATUS } from '../config/constants.js';
import { AuthRequest } from '../types/types.js';
import { Ticket } from '../models/Ticket.model.js';

export class ReportsController {
  /**
   * GET /api/reports/export
   */
  static async exportCsv(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const user = req.user!;
        const org = req.organization!;
      const { status, department, from, to } = req.query as Record<string, string | undefined>;

      const filter: Record<string, unknown> = { orgId: org._id };
      if (status && (Object.values(TICKET_STATUS) as string[]).includes(status))
        filter['status'] = status;
      if (department) filter['department'] = department;
      if (from || to) {
        const dateRange: Record<string, Date> = {};
        if (from) dateRange['$gte'] = new Date(from);
        if (to) {
          const toDate = new Date(to);
          toDate.setHours(23, 59, 59, 999);
          dateRange['$lte'] = toDate;
        }
        filter['createdAt'] = dateRange;
      }

      const tickets = await Ticket.find(filter)
        .populate('submittedBy', 'name email')
        .populate('department', 'name')
        .populate({ path: 'managerApproval.reviewedBy', select: 'name' })
        .populate({ path: 'financeApproval.reviewedBy', select: 'name' })
        .sort({ createdAt: -1 })
        .lean();

      const csvContent = generateTicketsCsv(tickets as Parameters<typeof generateTicketsCsv>[0]);

      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]!;
      const parts = ['Expensly', 'Expense Report'];
      if (from && to) parts.push(`${from} to ${to}`);
      else if (from) parts.push(`from ${from}`);
      else if (to) parts.push(`until ${to}`);
      parts.push(dateStr);
      const filename = parts.join(' ') + '.csv';

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      // Prepend UTF-8 BOM so Excel opens the file correctly without re-encoding
      res.status(200).send('\uFEFF' + csvContent);
    } catch (err) {
      next(err);
    }
  }
}
