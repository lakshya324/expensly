// Reports Controller
import { Request, Response, NextFunction } from 'express';
import { Ticket } from '../models/index.js';
import { generateTicketsCsv } from '../services/csv.service.js';
import { createError } from '../middleware/errorHandler.js';
import { TICKET_STATUS } from '../config/constants.js';
import type { ITicket } from '../models/index.js';

export class ReportsController {
  /**
   * GET /api/reports/export
   */
  static async exportCsv(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { orgId } = req.user!;
      const { status, department, from, to } = req.query as Record<string, string | undefined>;

      const filter: Record<string, unknown> = { orgId };
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
        .populate('submittedBy', 'name email department')
        .sort({ createdAt: -1 })
        .lean();

      const csvContent = generateTicketsCsv(tickets as Parameters<typeof generateTicketsCsv>[0]);

      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]!;
      let filename = `EXPENSLY_expenses_export`;
      if (from && to) filename += `_${from}_to_${to}`;
      else if (from) filename += `_from_${from}`;
      else if (to) filename += `_until_${to}`;
      filename += `_${dateStr}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(csvContent);
    } catch (err) {
      next(err);
    }
  }
}
