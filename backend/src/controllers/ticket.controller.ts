import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import {
  TICKET_STATUS,
  ROLES,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  PERMISSION_KEY,
  RECEIPT_USE_CASE,
  OCR_STATUS,
  AI_VALIDATION_STATUS,
} from "../config/constants.js";
import {
  deleteReceiptsAndFiles,
  getReceiptUrl,
} from "../services/receipt.service.js";
import { createError } from "../utils/error.js";
import { AuthRequest } from "../types/types.js";
import { buildTicketFilter, buildTicketVisibilityFilter } from "../utils/tickets.js";
import { resolvePermission } from "../utils/permissions.js";
import {
  ResponsePaginationPayload,
  ResponsePayload,
} from "../types/payloads.types.js";
import { logError } from "../utils/logger.js";
import {
  ITicket,
  ITicketData,
  ITicketSummaryData,
} from "../types/ticket.types.js";
import { Ticket } from "../models/Ticket.model.js";
import { User } from "../models/User.model.js";
import { Department } from "../models/Department.model.js";
import { Organization } from "../models/Organization.model.js";
import {
  convertAmount,
  getOrgRates,
} from "../services/exchangeRates.service.js";
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
import { listTicketsPaginated } from "../services/ticket.service.js";
import { extractReceiptData } from "../services/ocr.service.js";
import { enqueueJob } from "../services/queue.service.js";
import { logAction } from "../services/auditLog.service.js";
import {
  AUDIT_ACTION,
  ENTITY_TYPE,
  BUNDLE_STATUS,
} from "../config/constants.js";
import { IUser } from "../types/user.types.js";
import { IOrganization } from "../types/organization.types.js";
import { Bundle } from "../models/Bundle.model.js";
import { Merchant } from "../models/Merchant.model.js";
import { Category } from "../models/Category.model.js";
import { Receipt } from "../models/Receipt.model.js";
import { QueueJobType } from "../types/queue.types.js";

async function resolveScopedEntityId(
  rawId: string | undefined,
  orgId: Types.ObjectId,
  model: { findOne: (filter: Record<string, unknown>) => any },
  entityLabel: string,
  errorCode: string,
): Promise<Types.ObjectId | null | undefined> {
  if (rawId === undefined) return undefined;
  if (!rawId) return null;
  if (!Types.ObjectId.isValid(rawId))
    throw createError(`${entityLabel} must be a valid MongoDB ObjectId`, 400, "VALIDATION_ERROR");

  const entity = await model.findOne({ _id: rawId, orgId }).select("_id");
  if (!entity) throw createError(`${entityLabel} not found`, 400, errorCode);
  return entity._id;
}

async function findAccessibleTicket(
  req: AuthRequest,
  ticketId: string,
): Promise<ITicket> {
  if (!Types.ObjectId.isValid(ticketId))
    throw createError("Ticket not found", 404, "NOT_FOUND");

  const filter = await buildTicketVisibilityFilter(req);
  filter["_id"] = new Types.ObjectId(ticketId);

  const ticket = await Ticket.findOne(filter);
  if (!ticket) throw createError("Ticket not found", 404, "NOT_FOUND");
  return ticket;
}

export default class TicketController {
  /**
   * GET /api/expenses/stats
   * Returns per-status ticket counts for the requesting user (respects role/permission scope).
   */
  static async getStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const filter = await buildTicketFilter(req);

      const counts: { _id: string; count: number }[] = await Ticket.aggregate([
        { $match: filter },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]);

      const map: Record<string, number> = {};
      counts.forEach(({ _id, count }) => {
        map[_id] = count;
      });

      const stats = {
        total: counts.reduce((s, c) => s + c.count, 0),
        draft:
          (map[TICKET_STATUS.DRAFT] ?? 0) + (map[TICKET_STATUS.SCANNING] ?? 0),
        // + (map[TICKET_STATUS.OCR_FAILED] ?? 0)
        // cando: draft can be used to show "tickets in progress" before submission or juct user side... idk will figure out in the frontend
        pending:
          (map[TICKET_STATUS.PENDING] ?? 0) +
          (map[TICKET_STATUS.AWAITING_FINANCE] ?? 0),
        approved: map[TICKET_STATUS.APPROVED] ?? 0,
        rejected: map[TICKET_STATUS.REJECTED] ?? 0,
      };

      const payload: ResponsePayload<typeof stats> = {
        success: true,
        message: "Stats retrieved successfully",
        timestamp: new Date().toISOString(),
        data: stats,
      };

      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

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
      const filter = await buildTicketFilter(req);
      const orgSnapshotId = org.currentRateSnapshotId
        ? org.currentRateSnapshotId.toString()
        : null;

      const { data: ticketDataList, total } = await listTicketsPaginated(
        filter,
        page,
        limit,
        org._id.toString(),
        orgSnapshotId,
      );

      const payload: ResponsePaginationPayload<ITicketSummaryData> = {
        success: true,
        message: "Tickets retrieved successfully",
        timestamp: new Date().toISOString(),
        data: {
          data: ticketDataList,
          pagination: {
            page,
            pageSize: ticketDataList.length,
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
      next(err);
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
        statusIntent,
        merchant: merchantId,
        category: categoryId,
        bundleId,
      } = req.body as Record<string, string | undefined>;

      const ticketStatus =
        statusIntent === "draft" ? TICKET_STATUS.DRAFT : TICKET_STATUS.PENDING;

      let dept: Awaited<ReturnType<typeof Department.findOne>> | null = null;
      if (department) {
        dept = await Department.findOne({
          _id: new Types.ObjectId(department),
          orgId: org._id,
          isActive: true,
        });
        if (!dept)
          throw createError(
            `Department not found or inactive`,
            400,
            "INVALID_DEPARTMENT",
          );
      }

      if (ticketStatus === TICKET_STATUS.PENDING && !dept)
        throw createError(
          `Department not found or inactive`,
          400,
          "INVALID_DEPARTMENT",
        );

      const [merchantRef, categoryRef] = await Promise.all([
        resolveScopedEntityId(
          merchantId,
          org._id,
          Merchant,
          "Merchant",
          "INVALID_MERCHANT",
        ),
        resolveScopedEntityId(
          categoryId,
          org._id,
          Category,
          "Category",
          "INVALID_CATEGORY",
        ),
      ]);

      // Manager approval required only when the user has a manager AND the ticket
      // amount meets or exceeds the department threshold for that currency.
      // If no threshold is configured, default to requiring manager approval.
      const parsedAmount =
        amount && amount.trim() !== "" ? parseFloat(amount) : null;
      const currencyThreshold =
        ticketStatus === TICKET_STATUS.PENDING && dept && currency
          ? (dept.approvalThresholds.get(currency) ?? null)
          : null;
      const needsManagerApproval =
        ticketStatus === TICKET_STATUS.PENDING &&
        user?.managerId != null &&
        parsedAmount != null &&
        (currencyThreshold === null || parsedAmount >= currencyThreshold);

      const parsedTags: string[] = tags
        ? Array.isArray(tags)
          ? (tags as string[])
          : (JSON.parse(tags) as string[])
        : [];

      // Pre-generate the MongoDB _id so we can build the S3 receipt key before
      // the DB insert, eliminating the second ticket.save() when a file is attached.
      const newTicketId = new mongoose.Types.ObjectId();

      // If a file was uploaded via multer-s3, create a Receipt document
      let receiptId: mongoose.Types.ObjectId | null = null;
      const s3File = req.file as Express.MulterS3.File | undefined;
      if (s3File) {
        const receiptData = await Receipt.create({
          orgId: org._id,
          s3Key: s3File.key,
          mimetype: s3File.mimetype,
          originalName: s3File.originalname,
          size: s3File.size,
          useCase: RECEIPT_USE_CASE.RECEIPT,
          uploadedBy: user._id,
        });
        receiptId = receiptData._id;
      }

      const ticket = await Ticket.create({
        _id: newTicketId,
        title: title?.trim() || null,
        submittedBy: user._id,
        submitterManagerId: user.managerId ?? null,
        orgId: org._id,
        amount: parsedAmount,
        currency: currency ?? null,
        department: department ? new Types.ObjectId(department) : null,
        description: description ?? "",
        tags: parsedTags,
        receiptIds: receiptId ? [receiptId] : [],
        status: ticketStatus,
        merchant: merchantRef ?? null,
        category: categoryRef ?? null,
        managerApproval:
          ticketStatus === TICKET_STATUS.PENDING && needsManagerApproval
          ? {
              required: true,
              approved: null,
              reviewedBy: null,
              reviewedAt: null,
              comments: null,
            }
          : null,
        financeApproval:
          ticketStatus === TICKET_STATUS.PENDING
            ? {
                approved: null,
                reviewedBy: null,
                reviewedAt: null,
                comments: null,
              }
            : null,
        ocrData: receiptId
          ? {
              status: OCR_STATUS.PENDING,
              rawText: null,
              confidence: null,
              processedAt: null,
            }
          : null,
        aiValidation: {
          status: AI_VALIDATION_STATUS.PENDING,
          checks: [],
          summary: null,
          validatedAt: null,
          suggestedTitle: null,
          suggestedAmount: null,
          suggestedCurrency: null,
          suggestedDate: null,
          suggestedMerchantName: null,
          suggestedCategoryName: null,
          suggestedDescription: null,
          unmatchedMerchantSuggestionText: null,
          unmatchedCategorySuggestionText: null,
        },
        ...(timestamp && { createdAt: new Date(timestamp) }),
      });

      // Add any new tags into the department's tag pool
      if (parsedTags.length > 0 && dept) {
        await Department.findByIdAndUpdate(dept._id, {
          $addToSet: { tags: { $each: parsedTags } },
        });
      }

      // Link to bundle if bundleId was provided (non-fatal — silently ignored if bundle not found)
      if (bundleId) {
        try {
          await Bundle.findOneAndUpdate(
            { _id: bundleId, orgId: org._id, status: BUNDLE_STATUS.DRAFT },
            { $addToSet: { ticketIds: ticket._id } },
          );
        } catch {
          // Non-fatal: linking failure should not block ticket creation
        }
      }

      const ticketData = await ticket.data(org);
      logAction({
        orgId: org._id.toString(),
        performedBy: user._id.toString(),
        action: AUDIT_ACTION.CREATED,
        entityType: ENTITY_TYPE.TICKET,
        entityId: ticket._id.toString(),
      }).catch(() => {});
      emitNewTicket(org._id.toString(), ticketData, user._id.toString());

      // Start async AI validation for every created expense.
      // If a receipt exists, OCR runs first and chains AI validation.
      try {
        if (receiptId) {
          await enqueueJob({
            jobType: QueueJobType.OcrScan,
            ticketId: ticket._id.toString(),
            receiptId: receiptId.toString(),
            orgId: org._id.toString(),
          });
        } else {
          await enqueueJob({
            jobType: QueueJobType.AiValidate,
            ticketId: ticket._id.toString(),
            orgId: org._id.toString(),
          });
        }
      } catch (err) {
        logError(err, {
          message: `Failed to enqueue async validation for ticket ${ticket._id.toString()}`,
          code: "TICKET_ASYNC_VALIDATION_ENQUEUE_ERROR",
        });
      }

      // Notify manager and org admins only for pending submissions (non-blocking)
      if (ticketStatus === TICKET_STATUS.PENDING) {
        try {
          const notifyTargets: { email: string; name: string }[] = [];
          // Fetch manager and org admins in parallel — both independent of each other.
          const [manager, admins] = await Promise.all([
            user.managerId
              ? User.findById(user.managerId).select("email name").lean()
              : Promise.resolve(null),
            User.find({ orgId: org._id, role: ROLES.ADMIN, isDisabled: false })
              .select("email name")
              .lean(),
          ]);
          if (manager)
            notifyTargets.push({ email: manager.email, name: manager.name });
          for (const admin of admins) {
            if (!notifyTargets.some((t) => t.email === admin.email))
              notifyTargets.push({ email: admin.email, name: admin.name });
          }
          for (const target of notifyTargets) {
            sendTicketSubmittedEmail(
              target.email,
              target.name,
              user.name,
              ticket.title!,
              ticket.amount!,
              ticket.currency!,
            );
          }
        } catch {
          // Non-fatal notification
        }
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
      next(err);
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
      const ticket = await findAccessibleTicket(req, ticketId);

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
      next(err);
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

      const {
        title,
        amount,
        currency,
        description,
        tags,
        department: deptId,
        merchant: merchantId,
        category: categoryId,
      } = req.body as Record<string, string | undefined>;
      if (title !== undefined) ticket.title = title;
      if (amount !== undefined) ticket.amount = parseFloat(amount);
      if (currency !== undefined)
        ticket.currency = currency as ITicket["currency"];
      if (description !== undefined) ticket.description = description;
      if (tags !== undefined)
        ticket.tags = Array.isArray(tags)
          ? (tags as string[])
          : (JSON.parse(tags) as string[]);

      // Allow department update only when the ticket is in draft state
      if (deptId !== undefined) {
        if (
          ticket.status === TICKET_STATUS.DRAFT ||
          ticket.status === TICKET_STATUS.SCANNING
        ) {
          const deptDoc = await Department.findOne({
            _id: deptId,
            orgId: org._id,
            isActive: true,
          });
          if (!deptDoc)
            throw createError(
              "Department not found or inactive",
              400,
              "INVALID_DEPARTMENT",
            );
          ticket.department = deptDoc._id;
        }
      }
      // Allow merchant / category link update on draft tickets
      const [merchantRef, categoryRef] = await Promise.all([
        resolveScopedEntityId(
          merchantId,
          org._id,
          Merchant,
          "Merchant",
          "INVALID_MERCHANT",
        ),
        resolveScopedEntityId(
          categoryId,
          org._id,
          Category,
          "Category",
          "INVALID_CATEGORY",
        ),
      ]);
      if (merchantRef !== undefined) ticket.merchant = merchantRef;
      if (categoryRef !== undefined) ticket.category = categoryRef;

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

      if (ticket.receiptIds.length > 0) {
        try {
          await deleteReceiptsAndFiles(ticket.receiptIds);
        } catch {
          logError(
            new Error(
              `Failed to delete receipt files for ticket ${ticket._id}`,
            ),
            {
              message: "Receipt deletion error",
              code: "RECEIPT_DELETE_ERROR",
              ticketId: ticket._id.toString(),
            },
          );
        }
      }

      await ticket.deleteOne();
      logAction({
        orgId: org._id.toString(),
        performedBy: user._id.toString(),
        action: AUDIT_ACTION.DELETED,
        entityType: ENTITY_TYPE.TICKET,
        entityId: ticket._id.toString(),
      }).catch(() => {});
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
      const body = req.body as { flagged?: boolean } | undefined;

      const ticket = await Ticket.findOne({
        _id: ticketId,
        orgId: org._id,
      });
      if (!ticket) throw createError("Ticket not found", 404, "NOT_FOUND");

      // If an explicit value is supplied use it, otherwise toggle the current state
      const newFlagged =
        body?.flagged !== undefined ? body.flagged === true : !ticket.flagged;
      ticket.flagged = newFlagged;
      await ticket.save();
      logAction({
        orgId: org._id.toString(),
        performedBy: user._id.toString(),
        action: newFlagged ? AUDIT_ACTION.FLAGGED : AUDIT_ACTION.UNFLAGGED,
        entityType: ENTITY_TYPE.TICKET,
        entityId: ticket._id.toString(),
      }).catch(() => {});

      const ticketData = await ticket.data(org);
      emitTicketFlag(org._id.toString(), ticketData, user._id.toString());

      const payload: ResponsePayload<ITicketData> = {
        success: true,
        message: `Ticket ${newFlagged ? "flagged" : "unflagged"} successfully`,
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
      const dept = req.userDepartment;
      const { status, comments } = req.body as {
        status: ITicket["status"];
        comments?: string;
      };
      const ticketId = req.params["id"] as string;

      const ticket = await Ticket.findOne({ _id: ticketId, orgId: org._id });
      if (!ticket) throw createError("Ticket not found", 404, "NOT_FOUND");

      const now = new Date();

      // Determine which approval step this action belongs to.
      // Manager step: ticket is still pending AND manager approval is outstanding
      //   → manager approves  (target: awaiting_finance)
      //   → manager rejects   (target: rejected)
      // Finance step: anything else targeting approved/rejected
      // Admin can approve/reject at either step, but non-admins must follow the step order.
      const isManagerStep =
        ticket.status === TICKET_STATUS.PENDING &&
        ticket.managerApproval !== null &&
        ticket.managerApproval.approved === null &&
        (status === TICKET_STATUS.AWAITING_FINANCE ||
          status === TICKET_STATUS.REJECTED);

      // Manager / awaiting_finance step
      if (isManagerStep) {
        // Only the submitter's assigned manager (or admins) may act on this step.
        if (
          user.role !== ROLES.ADMIN &&
          (!ticket.submitterManagerId ||
            !ticket.submitterManagerId.equals(user._id))
        ) {
          throw createError(
            "You are not the manager of this ticket's submitter",
            403,
            "FORBIDDEN",
          );
        }

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
        !isManagerStep &&
        (status === TICKET_STATUS.APPROVED || status === TICKET_STATUS.REJECTED)
      ) {
        // Only users with approve_finance permission (or admins) can do finance approval.
        const hasApprovePermission = await resolvePermission(
          user,
          dept ?? null,
          PERMISSION_KEY.APPROVE_FINANCE,
        );
        if (!hasApprovePermission)
          throw createError(
            "You do not have permission to approve or reject tickets",
            403,
            "FORBIDDEN",
          );

        // If manager approval was pending but finance is approving, auto-bypass it
        if (
          status === TICKET_STATUS.APPROVED &&
          ticket.managerApproval?.required === true &&
          ticket.managerApproval?.approved !== true
        ) {
          ticket.managerApproval.approved = true;
          ticket.managerApproval.reviewedBy = user._id;
          ticket.managerApproval.reviewedAt = now;
          ticket.managerApproval.comments = "Auto-approved by finance";
        }

        ticket.financeApproval = {
          approved: status === TICKET_STATUS.APPROVED,
          reviewedBy: user._id,
          reviewedAt: now,
          comments: comments ?? null,
        };

        if (status === TICKET_STATUS.APPROVED) {
          // Lock exchange rate snapshot using a fresh read to get the latest pointer.
          const freshOrg = await Organization.findById(org._id).select(
            "currentRateSnapshotId baseCurrency",
          );
          if (freshOrg?.currentRateSnapshotId) {
            ticket.exchangeRateSnapshotId = freshOrg.currentRateSnapshotId;
          }

          // Compute converted amount into org base currency using the same
          // snapshot that was just locked onto the ticket.
          let convertedAmount = ticket.amount;
          if (ticket.currency !== org.baseCurrency) {
            try {
              const snapshot = freshOrg
                ? await getOrgRates(freshOrg as any)
                : null;
              if (snapshot) {
                convertedAmount = convertAmount(
                  ticket.amount!,
                  ticket.currency!,
                  (freshOrg?.baseCurrency ?? org.baseCurrency) as string,
                  snapshot.rates,
                );
              }
            } catch {
              // Non-fatal — leave convertedAmount unset if rates unavailable
            }
          }

          // Increment department spent (use converted amount so it's always in org base currency)
          if (ticket.department) {
            await Department.findByIdAndUpdate(ticket.department, {
              $inc: { spent: convertedAmount ?? ticket.amount },
            });
          }
        }
      }

      ticket.status = status;
      await ticket.save();
      logAction({
        orgId: org._id.toString(),
        performedBy: user._id.toString(),
        action: AUDIT_ACTION.STATUS_CHANGED,
        entityType: ENTITY_TYPE.TICKET,
        entityId: ticket._id.toString(),
        metadata: { status },
      }).catch(() => {});

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
          const submitter = await User.findById(ticket.submittedBy).select(
            "email name",
          );
          if (submitter) {
            sendTicketStatusEmail(
              submitter.email,
              submitter.name,
              ticket.title!,
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
        const analytics = await refreshOrgAnalytics(org);
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
   * GET /api/users/expenses/:id/receipt
   */
  static async getReceipt(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const ticketId = req.params["id"] as string;
      const ticket = await findAccessibleTicket(req, ticketId);
      if (!ticket.receiptIds || ticket.receiptIds.length === 0)
        throw createError(
          "No receipt attached to this ticket",
          404,
          "NO_RECEIPT",
        );

      const { getReceiptUrls } = await import("../services/receipt.service.js");
      const signedUrls = await getReceiptUrls(ticket.receiptIds);
      const payload: ResponsePayload<string[]> = {
        success: true,
        message: "Receipt URL(s) retrieved successfully",
        data: signedUrls,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/expenses/receipt-scan
   * Receipt-only upload: creates a `scanning` ticket, enqueues OCR + AI pipeline.
   * The FE receives a WebSocket event when the ticket auto-promotes to `draft`.
   */
  static async receiptScan(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const user = req.user! as IUser;
      const org = req.organization! as IOrganization;

      if (!req.file)
        throw createError("Receipt file is required", 400, "NO_FILE");

      const newTicketId = new mongoose.Types.ObjectId();

      // File already uploaded by multer-s3, create Receipt document
      const s3File = req.file as Express.MulterS3.File;
      const receiptData = await Receipt.create({
        orgId: org._id,
        s3Key: s3File.key,
        mimetype: s3File.mimetype,
        originalName: s3File.originalname,
        size: s3File.size,
        useCase: RECEIPT_USE_CASE.RECEIPT,
        uploadedBy: user._id,
      });
      const receiptId = receiptData._id;

      const ticket = await Ticket.create({
        _id: newTicketId,
        title: null,
        submittedBy: user._id,
        submitterManagerId: user.managerId ?? null,
        orgId: org._id,
        amount: null,
        currency: null,
        department: user.department ?? null,
        receiptIds: [receiptId],
        status: TICKET_STATUS.SCANNING,
        managerApproval: null,
        financeApproval: {
          approved: null,
          reviewedBy: null,
          reviewedAt: null,
          comments: null,
        },
        ocrData: {
          status: OCR_STATUS.PROCESSING,
          rawText: null,
          confidence: null,
          processedAt: null,
        },
        aiValidation: {
          status: AI_VALIDATION_STATUS.PENDING,
          checks: [],
          summary: null,
          validatedAt: null,
          suggestedTitle: null,
          suggestedAmount: null,
          suggestedCurrency: null,
          suggestedDate: null,
          suggestedMerchantName: null,
          suggestedCategoryName: null,
          suggestedDescription: null,
          unmatchedMerchantSuggestionText: null,
          unmatchedCategorySuggestionText: null,
        },
      });

      await enqueueJob({
        jobType: QueueJobType.OcrScan,
        ticketId: ticket._id.toString(),
        receiptId: receiptId.toString(),
        orgId: org._id.toString(),
      });

      logAction({
        orgId: org._id.toString(),
        performedBy: user._id.toString(),
        action: AUDIT_ACTION.CREATED,
        entityType: ENTITY_TYPE.TICKET,
        entityId: ticket._id.toString(),
      }).catch(() => {});

      // Link to bundle if bundleId was provided in multipart body (non-fatal)
      const scanBundleId = (req.body as Record<string, string | undefined>)[
        "bundleId"
      ];
      if (scanBundleId) {
        try {
          await Bundle.findOneAndUpdate(
            { _id: scanBundleId, orgId: org._id, status: BUNDLE_STATUS.DRAFT },
            { $addToSet: { ticketIds: ticket._id } },
          );
        } catch {
          // Non-fatal
        }
      }

      const ticketData = await ticket.data(org);
      emitNewTicket(org._id.toString(), ticketData, user._id.toString());

      const payload: ResponsePayload<ITicketData> = {
        success: true,
        message:
          "Receipt uploaded — scanning in progress. Results will arrive via WebSocket.",
        data: ticketData,
        timestamp: new Date().toISOString(),
      };
      res.status(202).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/expenses/:id/submit
   * Promote a `draft` ticket to `pending`, entering the approval flow.
   * All required fields (title, amount, currency, department) must be set.
   */
  static async submitDraft(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const user = req.user! as IUser;
      const org = req.organization! as IOrganization;
      const ticketId = req.params["id"] as string;

      const ticket = await Ticket.findOne({ _id: ticketId, orgId: org._id });
      if (!ticket) throw createError("Ticket not found", 404, "NOT_FOUND");

      if (ticket.status !== TICKET_STATUS.DRAFT)
        throw createError(
          "Only draft tickets can be submitted",
          400,
          "INVALID_STATUS",
        );

      if (ticket.submittedBy.toString() !== user._id.toString())
        throw createError(
          "Only the submitter can submit a draft",
          403,
          "FORBIDDEN",
        );

      const {
        title,
        amount,
        currency,
        description,
        merchant: merchantId,
        category: categoryId,
      } = req.body as Record<string, string | undefined>;

      if (title !== undefined) ticket.title = title.trim() || null;
      if (amount !== undefined) {
        const parsedAmount = parseFloat(amount);
        if (Number.isNaN(parsedAmount)) {
          throw createError("Invalid amount", 400, "VALIDATION_ERROR");
        }
        ticket.amount = parsedAmount;
      }
      if (currency !== undefined)
        ticket.currency = currency as ITicket["currency"];
      if (description !== undefined) ticket.description = description;
      const [merchantRef, categoryRef] = await Promise.all([
        resolveScopedEntityId(
          merchantId,
          org._id,
          Merchant,
          "Merchant",
          "INVALID_MERCHANT",
        ),
        resolveScopedEntityId(
          categoryId,
          org._id,
          Category,
          "Category",
          "INVALID_CATEGORY",
        ),
      ]);
      if (merchantRef !== undefined) ticket.merchant = merchantRef;
      if (categoryRef !== undefined) ticket.category = categoryRef;

      if (!ticket.department)
        throw createError(
          "Department is required before submitting",
          400,
          "MISSING_DEPARTMENT",
        );

      const dept = await Department.findOne({
        _id: ticket.department,
        orgId: org._id,
        isActive: true,
      });
      if (!dept)
        throw createError(
          "Department not found or inactive",
          400,
          "INVALID_DEPARTMENT",
        );

      // Compute manager approval requirement (same logic as create)
      const currencyThreshold = ticket.currency
        ? (dept.approvalThresholds.get(ticket.currency) ?? null)
        : null;
      const needsManagerApproval =
        user?.managerId != null &&
        ticket.amount != null &&
        (currencyThreshold === null || ticket.amount >= currencyThreshold);

      ticket.status = TICKET_STATUS.PENDING;
      ticket.submitterManagerId = user.managerId ?? null;
      ticket.managerApproval = needsManagerApproval
        ? {
            required: true,
            approved: null,
            reviewedBy: null,
            reviewedAt: null,
            comments: null,
          }
        : null;
      if (!ticket.financeApproval) {
        ticket.financeApproval = {
          approved: null,
          reviewedBy: null,
          reviewedAt: null,
          comments: null,
        };
      }

      // pre-validate hook enforces required fields if any are still null
      await ticket.save();

      const ticketData = await ticket.data(org);

      logAction({
        orgId: org._id.toString(),
        performedBy: user._id.toString(),
        action: AUDIT_ACTION.STATUS_CHANGED,
        entityType: ENTITY_TYPE.TICKET,
        entityId: ticket._id.toString(),
        metadata: { from: TICKET_STATUS.DRAFT, to: TICKET_STATUS.PENDING },
      }).catch(() => {});

      emitTicketStatusChange(
        org._id.toString(),
        user._id.toString(),
        ticketData,
        user._id.toString(),
      );

      // Notify manager + admins (non-blocking, same as create)
      try {
        const notifyTargets: { email: string; name: string }[] = [];
        const [manager, admins] = await Promise.all([
          user.managerId
            ? User.findById(user.managerId).select("email name").lean()
            : Promise.resolve(null),
          User.find({ orgId: org._id, role: ROLES.ADMIN, isDisabled: false })
            .select("email name")
            .lean(),
        ]);
        if (manager)
          notifyTargets.push({ email: manager.email, name: manager.name });
        for (const admin of admins) {
          if (!notifyTargets.some((t) => t.email === admin.email))
            notifyTargets.push({ email: admin.email, name: admin.name });
        }
        for (const target of notifyTargets) {
          sendTicketSubmittedEmail(
            target.email,
            target.name,
            user.name,
            ticket.title!,
            ticket.amount!,
            ticket.currency!,
          );
        }
      } catch {
        // Non-fatal
      }

      const payload: ResponsePayload<ITicketData> = {
        success: true,
        message: "Draft submitted successfully",
        data: ticketData,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }
}
