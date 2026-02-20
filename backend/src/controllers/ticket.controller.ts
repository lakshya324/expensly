import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import {
  TICKET_STATUS,
  ROLES,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from "../config/constants.js";
import {
  uploadFile,
  getReceiptSignedUrl,
  deleteFile,
  buildReceiptKey,
} from "../services/s3.service.js";
import { createError } from "../utils/error.js";
import { AuthRequest } from "../types/types.js";
import { buildTicketFilter } from "../utils/tickets.js";
import {
  ResponsePaginationPayload,
  ResponsePayload,
} from "../types/payloads.types.js";
import { logError } from "../utils/logger.js";
import { ITicket, ITicketData } from "../types/ticket.types.js";
import { Ticket } from "../models/Ticket.model.js";
import { User } from "../models/User.model.js";
import { Department } from "../models/Department.model.js";
import { Organization } from "../models/Organization.model.js";
import { convertAmount, getOrgRates } from "../services/exchangeRates.service.js";
import { refreshOrgAnalytics } from "../services/analytics.service.js";
import {
  emitNewTicket,
  emitTicketUpdate,
  emitTicketDelete,
  emitTicketFlag,
  emitTicketStatusChange,
} from "../websocket/handlers/ticket.handler.js";
import { emitAnalyticsUpdate } from "../websocket/handlers/analytics.handler.js";
import { Types } from "mongoose";
import {
  sendTicketSubmittedEmail,
  sendTicketStatusEmail,
} from "../services/email.service.js";

export default class TicketController {
  /**
   * GET /api/expenses
   */
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const org = req.organization!;
      const { page: pageQ, limit: limitQ } = req.query as Record<
        string,
        string | undefined
      >;
      const page = Math.max(1, parseInt(pageQ ?? "") || DEFAULT_PAGE);
      const limit = Math.min(
        MAX_LIMIT,
        Math.max(1, parseInt(limitQ ?? "") || DEFAULT_LIMIT),
      );
      const skip = (page - 1) * limit;

      const filter = buildTicketFilter(req);

      const [tickets, total] = await Promise.all([
        Ticket.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
        Ticket.countDocuments(filter),
      ]);

      const payload: ResponsePaginationPayload<ITicketData> = {
        success: true,
        message: "Tickets retrieved successfully",
        timestamp: new Date().toISOString(),
        data: {
          data: await Promise.all(tickets.map(async (t) => await t.data(org))),
          pagination: {
            page,
            pageSize: tickets.length,
            totalItems: total,
            totalPages: Math.ceil(total / limit),
          },
        },
      };
      res.status(200).json(payload);
    } catch (err) {
      logError(err, {
        message: "Error listing tickets",
        code: "TICKET_LIST_ERROR",
      });
      createError("Failed to list tickets", 500, "TICKET_LIST_ERROR");
    }
  }

  /**
   * POST /api/expenses
   */
  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const org = req.organization!;
      const {
        title,
        amount,
        currency,
        department,
        description,
        tags,
        timestamp,
      } = req.body as Record<string, string | undefined>;

      const dept = await Department.findOne({
        _id: new Types.ObjectId(department as string),
        orgId: org._id,
        isActive: true,
      });
      if (!dept)
        throw createError(
          `Department not found or inactive`,
          400,
          "INVALID_DEPARTMENT",
        );

      const needsManagerApproval = user?.managerId != null;

      const parsedTags: string[] = tags
        ? Array.isArray(tags)
          ? (tags as string[])
          : (JSON.parse(tags) as string[])
        : [];

      const ticket = await Ticket.create({
        title,
        submittedBy: user._id,
        orgId: org._id,
        amount: parseFloat(amount ?? "0"),
        currency,
        department,
        description: description ?? "",
        tags: parsedTags,
        receiptKey: null,
        status: TICKET_STATUS.PENDING,
        managerApproval: needsManagerApproval
          ? {
              required: true,
              approved: null,
              reviewedBy: null,
              reviewedAt: null,
              comments: null,
            }
          : null,
        financeApproval: {
          approved: null,
          reviewedBy: null,
          reviewedAt: null,
          comments: null,
        },
        ...(timestamp && { createdAt: new Date(timestamp) }),
      });

      if (req.file) {
        const properKey = buildReceiptKey(
          ticket._id.toString(),
          org.slug,
          req.file.mimetype,
        );
        await uploadFile(properKey, req.file.buffer, req.file.mimetype);
        ticket.receiptKey = properKey;
        await ticket.save();
      }

      // Add any new tags into the department's tag pool
      if (parsedTags.length > 0) {
        await Department.findByIdAndUpdate(dept._id, {
          $addToSet: { tags: { $each: parsedTags } },
        });
      }

      const ticketData = await ticket.data(org);
      emitNewTicket(org._id.toString(), ticketData, user._id.toString());

      // Notify manager and org admins about new submission (non-blocking)
      try {
        const notifyTargets: { email: string; name: string }[] = [];
        if (user.managerId) {
          const manager = await User.findById(user.managerId).select("email name");
          if (manager) notifyTargets.push({ email: manager.email, name: manager.name });
        }
        const admins = await User.find({ orgId: org._id, role: ROLES.ADMIN, isDisabled: false }).select("email name");
        for (const admin of admins) {
          if (!notifyTargets.some((t) => t.email === admin.email))
            notifyTargets.push({ email: admin.email, name: admin.name });
        }
        for (const target of notifyTargets) {
          sendTicketSubmittedEmail(
            target.email,
            target.name,
            user.name,
            ticket.title,
            ticket._id.toString(),
            ticket.amount,
            ticket.currency,
          );
        }
      } catch {
        // Non-fatal notification
      }

      const payload: ResponsePayload<ITicketData> = {
        success: true,
        message: "Ticket created successfully",
        data: ticketData,
        timestamp: new Date().toISOString(),
      };
      res.status(201).json(payload);
    } catch (err) {
      logError(err, {
        message: "Error creating ticket",
        code: "TICKET_CREATE_ERROR",
      });
      createError("Failed to create ticket", 500, "TICKET_CREATE_ERROR");
    }
  }

  /**
   * GET /api/expenses/:id
   */
  static async getOne(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const org = req.organization!;
      const ticketId = req.params["id"] as string;

      const ticket = await Ticket.findOne({
        _id: new mongoose.Types.ObjectId(ticketId),
        orgId: org._id,
      });

      if (!ticket) throw createError("Ticket not found", 404, "NOT_FOUND");

      const payload: ResponsePayload<ITicketData> = {
        success: true,
        message: "Ticket retrieved successfully",
        data: await ticket.data(org),
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(payload);
    } catch (err) {
      logError(err, {
        message: "Error retrieving ticket",
        code: "TICKET_RETRIEVE_ERROR",
      });
      createError("Failed to retrieve ticket", 500, "TICKET_RETRIEVE_ERROR");
    }
  }

  /**
   * PATCH /api/expenses/:id
   */
  static async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const org = req.organization!;
      const ticketId = req.params["id"] as string;

      const ticket = await Ticket.findOne({
        _id: ticketId,
        orgId: org._id,
      });
      if (!ticket) createError("Ticket not found", 404, "NOT_FOUND");

      const isSubmitter = ticket.submittedBy.toString() === user._id.toString();
      const isAdmin = user.role === ROLES.ADMIN;
      if (!isSubmitter && !isAdmin)
        createError(
          "Only the submitter or admin can edit a ticket",
          403,
          "FORBIDDEN",
        );

      const { title, amount, currency, description, tags } = req.body as Record<
        string,
        string | undefined
      >;
      if (title !== undefined) ticket.title = title;
      if (amount !== undefined) ticket.amount = parseFloat(amount);
      if (currency !== undefined)
        ticket.currency = currency as ITicket["currency"];
      if (description !== undefined) ticket.description = description;
      if (tags !== undefined)
        ticket.tags = Array.isArray(tags)
          ? (tags as string[])
          : (JSON.parse(tags) as string[]);

      await ticket.save();

      const ticketData = await ticket.data(org);
      emitTicketUpdate(org._id.toString(), ticketData, user._id.toString());

      const payload: ResponsePayload<ITicketData> = {
        success: true,
        message: "Ticket updated successfully",
        data: ticketData,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/expenses/:id
   */
  static async remove(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const org = req.organization!;
      const ticketId = req.params["id"] as string;
      const ticket = await Ticket.findOne({
        _id: ticketId,
        orgId: org._id,
      });
      if (!ticket) throw createError("Ticket not found", 404, "NOT_FOUND");

      const isSubmitter = ticket.submittedBy.toString() === user._id.toString();
      const isAdmin = user.role === ROLES.ADMIN;
      if (!isSubmitter && !isAdmin)
        createError(
          "Only the submitter or admin can delete a ticket",
          403,
          "FORBIDDEN",
        );

      if (ticket.receiptKey) {
        try {
          await deleteFile(ticket.receiptKey);
        } catch {
          logError(
            new Error(`Failed to delete receipt file for ticket ${ticket._id}`),
            {
              message: "Receipt deletion error",
              code: "RECEIPT_DELETE_ERROR",
              ticketId: ticket._id.toString(),
            },
          );
        }
      }

      await ticket.deleteOne();
      emitTicketDelete(org._id.toString(), ticket._id.toString());

      const payload: ResponsePayload = {
        success: true,
        message: "Ticket deleted successfully",
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/expenses/:id/flag
   */
  static async flag(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const org = req.organization!;
      const ticketId = req.params["id"] as string;
      const { flagged } = req.body as { flagged: boolean };

      const ticket = await Ticket.findOne({
        _id: ticketId,
        orgId: org._id,
      });
      if (!ticket) createError("Ticket not found", 404, "NOT_FOUND");

      ticket.flagged = flagged === true;
      await ticket.save();

      const ticketData = await ticket.data(org);
      emitTicketFlag(org._id.toString(), ticketData, user._id.toString());

      const payload: ResponsePayload<ITicketData> = {
        success: true,
        message: `Ticket ${flagged ? "flagged" : "unflagged"} successfully`,
        data: ticketData,
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/expenses/:id/status
   */
  static async updateStatus(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const user = req.user!;
      const org = req.organization!;
      const { status, comments } = req.body as {
        status: ITicket["status"];
        comments?: string;
      };
      const ticketId = req.params["id"] as string;

      const ticket = await Ticket.findOne({ _id: ticketId, orgId: org._id });
      if (!ticket) throw createError("Ticket not found", 404, "NOT_FOUND");

      const now = new Date();

      // Manager / awaiting_finance step
      if (
        status === TICKET_STATUS.AWAITING_FINANCE ||
        status === TICKET_STATUS.REJECTED
      ) {
        if (ticket.managerApproval) {
          ticket.managerApproval.approved =
            status === TICKET_STATUS.AWAITING_FINANCE;
          ticket.managerApproval.reviewedBy = user._id;
          ticket.managerApproval.reviewedAt = now;
          ticket.managerApproval.comments = comments ?? null;
        }
      }

      // Finance final approval / rejection
      if (
        status === TICKET_STATUS.APPROVED ||
        status === TICKET_STATUS.REJECTED
      ) {
        // Guard: can't finance-approve if manager approval is required but not yet done
        if (
          ticket.managerApproval?.required === true &&
          ticket.managerApproval?.approved !== true
        ) {
          throw createError(
            "Manager approval is required before finance can approve this ticket",
            400,
            "MANAGER_APPROVAL_REQUIRED",
          );
        }

        ticket.financeApproval = {
          approved: status === TICKET_STATUS.APPROVED,
          reviewedBy: user._id,
          reviewedAt: now,
          comments: comments ?? null,
        };

        if (status === TICKET_STATUS.APPROVED) {
          // Lock exchange rate snapshot
          const freshOrg = await Organization.findById(org._id).select(
            "currentRateSnapshotId baseCurrency",
          );
          if (freshOrg?.currentRateSnapshotId) {
            ticket.exchangeRateSnapshotId = freshOrg.currentRateSnapshotId;
          }

          // Compute converted amount into org base currency
          try {
            const snapshot = await getOrgRates(org._id);
            if (snapshot) {
              ticket.convertedAmount = convertAmount(
                ticket.amount,
                ticket.currency,
                (freshOrg?.baseCurrency ?? org.baseCurrency) as string,
                snapshot.rates,
              );
            }
          } catch {
            // Non-fatal — leave convertedAmount unset if rates unavailable
          }

          // Increment department spent
          if (ticket.department) {
            await Department.findByIdAndUpdate(ticket.department, {
              $inc: { spent: ticket.amount },
            });
          }
        }
      }

      ticket.status = status;
      await ticket.save();

      const ticketData = await ticket.data(org);
      emitTicketStatusChange(
        org._id.toString(),
        ticket.submittedBy.toString(),
        ticketData,
        user._id.toString(),
      );

      // Notify submitter of status change (non-blocking)
      if (
        status === TICKET_STATUS.APPROVED ||
        status === TICKET_STATUS.REJECTED
      ) {
        try {
          const submitter = await User.findById(ticket.submittedBy).select("email name");
          if (submitter) {
            sendTicketStatusEmail(
              submitter.email,
              submitter.name,
              ticket.title,
              ticket._id.toString(),
              status,
              comments ?? null,
            );
          }
        } catch {
          // Non-fatal notification
        }
      }

      // Refresh pre-computed analytics after any status change
      try {
        const analytics = await refreshOrgAnalytics(org._id);
        emitAnalyticsUpdate(org._id.toString(), analytics, user._id.toString());
      } catch {
        // Non-fatal analytics refresh
      }

      const payload: ResponsePayload<ITicketData> = {
        success: true,
        message: "Ticket status updated successfully",
        data: ticketData,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/expenses/:id/receipt
   */
  static async getReceipt(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const org = req.organization!;
      const ticketId = req.params["id"] as string;

      const ticket = await Ticket.findOne({
        _id: ticketId,
        orgId: org._id,
      });
      if (!ticket) createError("Ticket not found", 404, "NOT_FOUND");
      if (!ticket.receiptKey)
        createError("No receipt attached to this ticket", 404, "NO_RECEIPT");

      const signedUrl = await getReceiptSignedUrl(ticket.receiptKey);
      const payload: ResponsePayload<string> = {
        success: true,
        message: "Receipt URL retrieved successfully",
        data: signedUrl,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }
}
