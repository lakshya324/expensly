import { body, query } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Ticket, Organization, User } from '../models/index.js';
import type { ITicket } from '../models/index.js';
import { TICKET_STATUS, ROLES, DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } from '../config/constants.js';
import {
  uploadFile,
  getReceiptSignedUrl,
  deleteFile,
  buildReceiptKey,
} from '../services/s3.service.js';
import { createError } from '../middleware/errorHandler.js';
import { getIO } from '../websocket/wsServer.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const buildPagination = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  pages: Math.ceil(total / limit),
});

const buildTicketFilter = (req: Request): Record<string, unknown> => {
  const { role, orgId, id: userId } = req.user!;
  const { status, department, from, to, search } = req.query as Record<string, string | undefined>;

  const filter: Record<string, unknown> = { orgId };

  if (role === ROLES.USER) {
    filter['$or'] = [{ submittedBy: userId }, { 'managerApproval.reviewedBy': userId }];
  }

  if (status) filter['status'] = status;
  if (department) filter['department'] = department;

  if (from || to) {
    const dateRange: Record<string, Date> = {};
    if (from) dateRange['$gte'] = new Date(from);
    if (to) dateRange['$lte'] = new Date(to);
    filter['createdAt'] = dateRange;
  }

  if (search) {
    // Note: this overwrites any $or set above; search takes precedence
    filter['$or'] = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { tags: { $regex: search, $options: 'i' } },
    ];
  }

  return filter;
};

// ─── Controller ──────────────────────────────────────────────────────────────

export class TicketController {
  /**
   * GET /api/expenses
   */
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page: pageQ, limit: limitQ } = req.query as Record<string, string | undefined>;
      const page = Math.max(1, parseInt(pageQ ?? '') || DEFAULT_PAGE);
      const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(limitQ ?? '') || DEFAULT_LIMIT));
      const skip = (page - 1) * limit;

      const filter = buildTicketFilter(req);

      const [tickets, total] = await Promise.all([
        Ticket.find(filter)
          .populate('submittedBy', 'name email department')
          .populate('managerApproval.reviewedBy', 'name email')
          .populate('financeApproval.reviewedBy', 'name email')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Ticket.countDocuments(filter),
      ]);

      res.status(200).json({ success: true, data: tickets, pagination: buildPagination(page, limit, total) });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/expenses
   */
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: userId, orgId } = req.user!;
      const { title, amount, currency, department, description, tags, timestamp } =
        req.body as Record<string, string | undefined>;

      const org = await Organization.findById(orgId);
      if (!org) throw createError(404, 'Organization not found', 'ORG_NOT_FOUND');
      const deptExists = org.departments.some((d) => d.name === department);
      if (!deptExists)
        throw createError(
          400,
          `Department "${department}" not found in your organization`,
          'INVALID_DEPARTMENT'
        );

      let receiptKey: string | null = null;
      if (req.file) {
        const ticketTempId = Date.now().toString();
        receiptKey = buildReceiptKey(ticketTempId, req.file.mimetype);
        await uploadFile(receiptKey, req.file.buffer, req.file.mimetype);
      }

      const user = await User.findById(userId).lean();
      const needsManagerApproval = user?.managerId != null;

      const parsedTags: string[] = tags
        ? Array.isArray(tags)
          ? (tags as string[])
          : (JSON.parse(tags) as string[])
        : [];

      const ticket = await Ticket.create({
        title,
        submittedBy: userId,
        orgId: orgId as unknown as mongoose.Types.ObjectId,
        amount: parseFloat(amount ?? '0'),
        currency,
        department,
        description: description ?? '',
        tags: parsedTags,
        receiptKey,
        status: TICKET_STATUS.PENDING,
        managerApproval: needsManagerApproval
          ? { required: true, approved: null, reviewedBy: null, reviewedAt: null, comments: null }
          : null,
        financeApproval: { approved: null, reviewedBy: null, reviewedAt: null, comments: null },
        ...(timestamp && { createdAt: new Date(timestamp) }),
      });

      if (receiptKey && req.file) {
        const properKey = buildReceiptKey(ticket._id.toString(), req.file.mimetype);
        await uploadFile(properKey, req.file.buffer, req.file.mimetype);
        try {
          await deleteFile(receiptKey);
        } catch {
          /* non-fatal */
        }
        ticket.receiptKey = properKey;
        await ticket.save();
      }

      const populated = await ticket.populate('submittedBy', 'name email department');

      getIO()
        .to(orgId!)
        .emit('new_ticket', {
          type: 'new_ticket',
          ticketId: ticket._id.toString(),
          ticketData: populated,
          timestamp: new Date().toISOString(),
        });

      res.status(201).json({ success: true, ticket: populated });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/expenses/:id
   */
  static async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ticket = await Ticket.findOne({
        _id: req.params['id'],
        orgId: req.user!.orgId,
      })
        .populate('submittedBy', 'name email department')
        .populate('managerApproval.reviewedBy', 'name email')
        .populate('financeApproval.reviewedBy', 'name email')
        .lean();

      if (!ticket) throw createError(404, 'Ticket not found', 'NOT_FOUND');

      res.status(200).json({ success: true, ticket });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/expenses/:id
   */
  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ticket = await Ticket.findOne({
        _id: req.params['id'],
        orgId: req.user!.orgId,
      });
      if (!ticket) throw createError(404, 'Ticket not found', 'NOT_FOUND');

      const isSubmitter = ticket.submittedBy.toString() === req.user!.id;
      const isAdmin = req.user!.role === ROLES.ADMIN;
      if (!isSubmitter && !isAdmin) {
        throw createError(403, 'Only the submitter or admin can edit a ticket', 'FORBIDDEN');
      }

      const { title, amount, currency, description, tags } = req.body as Record<
        string,
        string | undefined
      >;
      if (title !== undefined) ticket.title = title;
      if (amount !== undefined) ticket.amount = parseFloat(amount);
      if (currency !== undefined) ticket.currency = currency as ITicket['currency'];
      if (description !== undefined) ticket.description = description;
      if (tags !== undefined)
        ticket.tags = Array.isArray(tags) ? (tags as string[]) : (JSON.parse(tags) as string[]);

      await ticket.save();

      const updatedData = {
        title: ticket.title,
        amount: ticket.amount,
        currency: ticket.currency,
        description: ticket.description,
        tags: ticket.tags,
      };

      getIO()
        .to(req.user!.orgId!)
        .emit('ticket_update', {
          type: 'ticket_update',
          ticketId: ticket._id.toString(),
          updatedData,
          timestamp: new Date().toISOString(),
        });

      res.status(200).json({ success: true, ticket });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/expenses/:id
   */
  static async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ticket = await Ticket.findOne({
        _id: req.params['id'],
        orgId: req.user!.orgId,
      });
      if (!ticket) throw createError(404, 'Ticket not found', 'NOT_FOUND');

      const isSubmitter = ticket.submittedBy.toString() === req.user!.id;
      const isAdmin = req.user!.role === ROLES.ADMIN;
      if (!isSubmitter && !isAdmin) {
        throw createError(403, 'Only the submitter or admin can delete a ticket', 'FORBIDDEN');
      }

      if (ticket.receiptKey) {
        try {
          await deleteFile(ticket.receiptKey);
        } catch {
          /* non-fatal */
        }
      }

      await ticket.deleteOne();

      getIO()
        .to(req.user!.orgId!)
        .emit('ticket_delete', {
          type: 'ticket_delete',
          ticketId: ticket._id.toString(),
          timestamp: new Date().toISOString(),
        });

      res.status(200).json({ success: true, message: 'Ticket deleted' });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/expenses/:id/flag
   */
  static async flag(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ticket = await Ticket.findOne({
        _id: req.params['id'],
        orgId: req.user!.orgId,
      });
      if (!ticket) throw createError(404, 'Ticket not found', 'NOT_FOUND');

      ticket.flagged =
        (req.body as Record<string, unknown>)['flagged'] !== undefined
          ? Boolean((req.body as Record<string, unknown>)['flagged'])
          : !ticket.flagged;
      await ticket.save();

      getIO()
        .to(req.user!.orgId!)
        .emit('ticket_flag', {
          type: 'ticket_flag',
          ticketId: ticket._id.toString(),
          flagged: ticket.flagged,
          timestamp: new Date().toISOString(),
        });

      res.status(200).json({ success: true, flagged: ticket.flagged });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/expenses/:id/status
   */
  static async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, comments } = req.body as { status: ITicket['status']; comments?: string };
      const { id: userId, role, orgId } = req.user!;

      const ticket = await Ticket.findOne({ _id: req.params['id'], orgId });
      if (!ticket) throw createError(404, 'Ticket not found', 'NOT_FOUND');

      const now = new Date();

      if (
        status === TICKET_STATUS.MANAGER_APPROVED ||
        status === TICKET_STATUS.REJECTED
      ) {
        if (ticket.managerApproval) {
          ticket.managerApproval.approved = status === TICKET_STATUS.MANAGER_APPROVED;
          ticket.managerApproval.reviewedBy = userId as unknown as ITicket['submittedBy'];
          ticket.managerApproval.reviewedAt = now;
          ticket.managerApproval.comments = comments ?? null;
        }
      }

      if (status === TICKET_STATUS.APPROVED || status === TICKET_STATUS.REJECTED) {
        ticket.financeApproval = {
          approved: status === TICKET_STATUS.APPROVED,
          reviewedBy: userId as unknown as ITicket['submittedBy'],
          reviewedAt: now,
          comments: comments ?? null,
        };
      }

      ticket.status = status;
      await ticket.save();

      if (status === TICKET_STATUS.APPROVED) {
        await Organization.findOneAndUpdate(
          { _id: orgId, 'departments.name': ticket.department },
          { $inc: { 'departments.$.spent': ticket.amount } }
        );
      }

      const io = getIO();
      const eventPayload = {
        type: 'ticket_status_change',
        ticketId: ticket._id.toString(),
        status: ticket.status,
        timestamp: new Date().toISOString(),
      };

      io.to(orgId!).emit('ticket_status_change', eventPayload);
      io.to(ticket.submittedBy.toString()).emit('ticket_status_change', eventPayload);

      res.status(200).json({ success: true, ticket });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/expenses/:id/receipt
   */
  static async getReceipt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ticket = await Ticket.findOne({
        _id: req.params['id'],
        orgId: req.user!.orgId,
      }).lean();
      if (!ticket) throw createError(404, 'Ticket not found', 'NOT_FOUND');
      if (!ticket.receiptKey)
        throw createError(404, 'No receipt attached to this ticket', 'NO_RECEIPT');

      const signedUrl = await getReceiptSignedUrl(ticket.receiptKey);
      res.status(200).json({ success: true, signedUrl });
    } catch (err) {
      next(err);
    }
  }
}

// ─── Validation Rules ─────────────────────────────────────────────────────────

export const createTicketValidation = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be a positive number'),
  body('currency').isIn(['USD', 'INR']).withMessage('Currency must be USD or INR'),
  body('department').trim().notEmpty().withMessage('Department is required'),
];

export const updateStatusValidation = [
  body('status')
    .isIn(Object.values(TICKET_STATUS))
    .withMessage(`Status must be one of: ${Object.values(TICKET_STATUS).join(', ')}`),
];

export const listTicketsValidation = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: MAX_LIMIT }),
  query('status').optional().isIn(Object.values(TICKET_STATUS)),
];
