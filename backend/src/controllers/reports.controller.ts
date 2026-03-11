import { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { generateTicketsCsv } from '../services/csv.service.js';
import { buildReportKey, uploadFile, getReportSignedUrl, getReportBuffer, deleteFile } from '../services/s3.service.js';
import { sendReportEmail } from '../services/email.service.js';
import { TICKET_STATUS } from '../config/constants.js';
import { AuthRequest } from '../types/types.js';
import { Ticket } from '../models/Ticket.model.js';
import { Report } from '../models/Report.model.js';
import { AppError } from '../types/error.types.js';
import type { ReportListItem } from '../types/report.types.js';

const MAX_SAVED_REPORTS = 5;

export class ReportsController {
  /**
   * GET /api/users/reports/export
   * Generate and stream a CSV, also persisting it to S3 (capped at 5 per user).
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

      // Build CSV buffer (UTF-8 BOM + content)
      const csvBuffer = Buffer.from('\uFEFF' + csvContent, 'utf-8');

      // --- Persist to S3 & DB (best-effort, non-blocking to client) ---
      try {
        console.log(`Persisting report for user ${user._id} with filters:`, { status, department, from, to });
        const reportDoc = new Report({
          orgId: org._id,
          generatedBy: user._id,
          s3Key: '', // filled after we have an _id
          filename,
          ticketCount: tickets.length,
          filters: { status, department, from, to },
        });
        const s3Key = buildReportKey(org.slug, (reportDoc._id as mongoose.Types.ObjectId).toString());
        reportDoc.s3Key = s3Key;

        // Upload to S3 and saving to DB... independent operations
        await Promise.all([
          uploadFile(s3Key, csvBuffer, 'text/csv'),
          reportDoc.save(),
        ]);

        // keep only the latest MAX_SAVED_REPORTS per user.
        const toDelete = await Report.find({ generatedBy: user._id })
          .sort({ createdAt: -1 })
          .skip(MAX_SAVED_REPORTS)
          .select('_id s3Key')
          .lean();

        if (toDelete.length > 0) {
          await Promise.all(toDelete.map((r) => deleteFile(r.s3Key).catch(() => {})));
          await Report.deleteMany({ _id: { $in: toDelete.map((r) => r._id) } });
        }
      } catch (err) {
        // S3/DB persistence failure never blocks the CSV download
      }

      // Streaming the CSV directly in the response with appropriate headers for download
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(csvBuffer);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/users/reports
   * List the last 5 saved reports for the current user, each with a fresh signed download URL.
   */
  static async listReports(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = req.user!;

      const reports = await Report.find({ generatedBy: user._id })
        .sort({ createdAt: -1 })
        .limit(MAX_SAVED_REPORTS)
        .lean();

      const items: ReportListItem[] = await Promise.all(
        reports.map(async (r) => ({
          _id: (r._id as mongoose.Types.ObjectId).toString(),
          filename: r.filename,
          ticketCount: r.ticketCount,
          filters: r.filters,
          downloadUrl: await getReportSignedUrl(r.s3Key),
          createdAt: (r.createdAt as Date).toISOString(),
        })),
      );

      res.status(200).json({ success: true, data: items });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/users/reports/:id/email
   * Email the specified report (CSV attachment + 7-day download link) to the current user.
   */
  static async emailReport(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const { id } = req.params;

      const report = await Report.findById(id).lean();
      if (!report) throw new AppError(404, 'Report not found', 'REPORT_NOT_FOUND');

      // Only the owner can email their own report
      if (report.generatedBy.toString() !== (user._id as mongoose.Types.ObjectId).toString()) {
        throw new AppError(403, 'Forbidden', 'FORBIDDEN');
      }

      const [csvBuffer, downloadUrl] = await Promise.all([
        getReportBuffer(report.s3Key),
        getReportSignedUrl(report.s3Key),
      ]);

      await sendReportEmail(user.email, user.name, report.filename, csvBuffer, downloadUrl);

      res.status(200).json({ success: true, message: 'Report emailed successfully' });
    } catch (err) {
      next(err);
    }
  }
}
