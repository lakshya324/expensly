import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/types.js";
import {
  createBundle,
  listBundles,
  getBundle,
  getBundleTickets,
  updateBundle,
  submitBundle,
  deleteBundle,
  approveBundleStatus,
  addTicketsToBundle,
  removeTicketFromBundle,
} from "../services/bundle.service.js";
import { Ticket } from "../models/Ticket.model.js";
import { ResponsePayload, ResponsePaginationPayload } from "../types/payloads.types.js";
import { IBundleData } from "../types/bundle.types.js";
import { ITicketData } from "../types/ticket.types.js";
import { logAction } from "../services/auditLog.service.js";
import { createError } from "../utils/error.js";
import { AUDIT_ACTION, ENTITY_TYPE, ROLES, PERMISSION_KEY, DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } from "../config/constants.js";

export default class BundleController {
  /** GET /api/users/expenses/bundles */
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const user = req.user!;
      const { page: pageQ, limit: limitQ, status } = req.query as Record<string, string | undefined>;
      const page = Math.max(1, parseInt(pageQ ?? "") || DEFAULT_PAGE);
      const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(limitQ ?? "") || DEFAULT_LIMIT));
      // Admins see all org bundles; regular users see only their own
      const submittedByFilter =
        user.role === ROLES.ADMIN ? undefined : user._id.toString();
      const { data, total } = await listBundles(org._id.toString(), submittedByFilter, page, limit, status);
      const payload: ResponsePaginationPayload<IBundleData> = {
        success: true,
        message: "Bundles retrieved successfully",
        timestamp: new Date().toISOString(),
        data: {
          data,
          pagination: {
            page,
            pageSize: data.length,
            totalItems: total,
            totalPages: Math.ceil(total / limit),
          },
        },
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/users/bundles/:id/tickets */
  static async getTickets(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const bundleId = req.params["id"] as string;
      const { page: pageQ, limit: limitQ } = req.query as Record<string, string | undefined>;
      const page = Math.max(1, parseInt(pageQ ?? "") || DEFAULT_PAGE);
      const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(limitQ ?? "") || DEFAULT_LIMIT));

      const { tickets: pageIds, total } = await getBundleTickets(org._id.toString(), bundleId, page, limit);

      const docs = pageIds.length > 0
        ? await Ticket.find({ _id: { $in: pageIds } })
        : [];

      // Preserve order from bundle.ticketIds
      const orderedDocs = pageIds
        .map((id) => docs.find((d) => d._id.equals(id)))
        .filter(Boolean) as (typeof docs[number])[];

      const data: ITicketData[] = await Promise.all(orderedDocs.map((t) => t.data(org)));

      const payload: ResponsePaginationPayload<ITicketData> = {
        success: true,
        message: "Bundle tickets retrieved successfully",
        timestamp: new Date().toISOString(),
        data: {
          data,
          pagination: {
            page,
            pageSize: data.length,
            totalItems: total,
            totalPages: Math.ceil(total / limit),
          },
        },
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/users/expenses/bundles/:id */
  static async getOne(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const bundleId = req.params["id"] as string;
      const data = await getBundle(org._id.toString(), bundleId);
      const payload: ResponsePayload<IBundleData> = {
        success: true,
        message: "Bundle retrieved successfully",
        timestamp: new Date().toISOString(),
        data,
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /** POST /api/users/expenses/bundles */
  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const user = req.user!;
      const { name, ticketIds, description, tags } = req.body as {
        name?: string;
        ticketIds?: string[];
        description?: string;
        tags?: string[];
      };
      const data = await createBundle({
        orgId: org._id.toString(),
        name: name ?? "",
        ticketIds,
        description,
        tags,
        submittedBy: user._id.toString(),
      });
      logAction({
        orgId: org._id.toString(),
        performedBy: user._id.toString(),
        action: AUDIT_ACTION.CREATED,
        entityType: ENTITY_TYPE.BUNDLE,
        entityId: data._id,
      }).catch(() => {});
      const payload: ResponsePayload<IBundleData> = {
        success: true,
        message: "Bundle created successfully",
        timestamp: new Date().toISOString(),
        data,
      };
      res.status(201).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /** PATCH /api/users/expenses/bundles/:id */
  static async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const user = req.user!;
      const bundleId = req.params["id"] as string;
      const { name, description, tags } = req.body as {
        name?: string;
        description?: string;
        tags?: string[];
      };
      const data = await updateBundle(org._id.toString(), bundleId, user._id.toString(), {
        name,
        description,
        tags,
      });
      logAction({
        orgId: org._id.toString(),
        performedBy: user._id.toString(),
        action: AUDIT_ACTION.UPDATED,
        entityType: ENTITY_TYPE.BUNDLE,
        entityId: bundleId,
      }).catch(() => {});
      const payload: ResponsePayload<IBundleData> = {
        success: true,
        message: "Bundle updated successfully",
        timestamp: new Date().toISOString(),
        data,
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /** POST /api/users/expenses/bundles/:id/submit */
  static async submit(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const user = req.user!;
      const bundleId = req.params["id"] as string;
      const data = await submitBundle(org._id.toString(), bundleId, user._id.toString());
      logAction({
        orgId: org._id.toString(),
        performedBy: user._id.toString(),
        action: AUDIT_ACTION.STATUS_CHANGED,
        entityType: ENTITY_TYPE.BUNDLE,
        entityId: bundleId,
        metadata: { status: "submitted" },
      }).catch(() => {});
      const payload: ResponsePayload<IBundleData> = {
        success: true,
        message: "Bundle submitted for approval",
        timestamp: new Date().toISOString(),
        data,
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /** PATCH /api/users/expenses/bundles/:id/status */
  static async updateStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const user = req.user!;
      const bundleId = req.params["id"] as string;
      const { step, approved, action, comments } = req.body as {
        step?: "manager" | "finance";
        approved?: boolean;
        action?: "approve" | "reject";
        comments?: string;
      };
      const resolvedApproved =
        typeof approved === "boolean"
          ? approved
          : action === "approve"
            ? true
            : action === "reject"
              ? false
              : undefined;
      if (typeof resolvedApproved !== "boolean") {
        throw createError(
          "Provide either 'approved' boolean or 'action' ('approve'|'reject')",
          400,
          "VALIDATION_ERROR",
        );
      }
      // Resolve finance permission: explicit user override, then fall back to department-level
      const userApproveFinance = user.permissions?.approve_finance;
      const deptApproveFinance = req.userDepartment?.permissions?.approve_finance;
      const hasApproveFinance =
        userApproveFinance === true ||
        (userApproveFinance == null && deptApproveFinance === true);

      const result = await approveBundleStatus(
        org._id.toString(),
        bundleId,
        user._id.toString(),
        user.role,
        hasApproveFinance,
        { step: step ?? "finance", approved: resolvedApproved, comments },
      );
      const data = result.bundle;
      logAction({
        orgId: org._id.toString(),
        performedBy: user._id.toString(),
        action: resolvedApproved ? AUDIT_ACTION.APPROVED : AUDIT_ACTION.REJECTED,
        entityType: ENTITY_TYPE.BUNDLE,
        entityId: bundleId,
        metadata: {
          step: step ?? "finance",
          comments: comments ?? null,
          approvedTicketCount: result.approvedTicketCount,
          skippedTicketCount: result.skippedTicketCount,
        },
      }).catch(() => {});

      const message = resolvedApproved
        ? result.skippedTicketCount > 0
          ? `Bundle approved. ${result.approvedTicketCount} expenses approved, ${result.skippedTicketCount} skipped (only pending/awaiting_finance are eligible).`
          : `Bundle approved. ${result.approvedTicketCount} expenses approved.`
        : "Bundle rejected";

      const payload: ResponsePayload<IBundleData> = {
        success: true,
        message,
        timestamp: new Date().toISOString(),
        data,
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /** DELETE /api/users/expenses/bundles/:id */
  static async remove(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const user = req.user!;
      const bundleId = req.params["id"] as string;
      await deleteBundle(org._id.toString(), bundleId, user._id.toString(), user.role);
      logAction({
        orgId: org._id.toString(),
        performedBy: user._id.toString(),
        action: AUDIT_ACTION.DELETED,
        entityType: ENTITY_TYPE.BUNDLE,
        entityId: bundleId,
      }).catch(() => {});
      const payload: ResponsePayload = {
        success: true,
        message: "Bundle deleted successfully",
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /** POST /api/users/bundles/:id/tickets */
  static async addTickets(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const user = req.user!;
      const bundleId = req.params["id"] as string;
      const { ticketIds } = req.body as { ticketIds?: string[] };
      const data = await addTicketsToBundle(
        org._id.toString(),
        bundleId,
        user._id.toString(),
        ticketIds ?? [],
      );
      logAction({
        orgId: org._id.toString(),
        performedBy: user._id.toString(),
        action: AUDIT_ACTION.UPDATED,
        entityType: ENTITY_TYPE.BUNDLE,
        entityId: bundleId,
        metadata: { ticketsAdded: (ticketIds ?? []).length },
      }).catch(() => {});
      const payload: ResponsePayload<IBundleData> = {
        success: true,
        message: "Expenses added to bundle",
        timestamp: new Date().toISOString(),
        data,
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /** DELETE /api/users/bundles/:id/tickets/:ticketId */
  static async removeTicket(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const user = req.user!;
      const bundleId = req.params["id"] as string;
      const ticketId = req.params["ticketId"] as string;
      const data = await removeTicketFromBundle(
        org._id.toString(),
        bundleId,
        user._id.toString(),
        ticketId,
      );
      logAction({
        orgId: org._id.toString(),
        performedBy: user._id.toString(),
        action: AUDIT_ACTION.UPDATED,
        entityType: ENTITY_TYPE.BUNDLE,
        entityId: bundleId,
        metadata: { ticketRemoved: ticketId },
      }).catch(() => {});
      const payload: ResponsePayload<IBundleData> = {
        success: true,
        message: "Expense removed from bundle",
        timestamp: new Date().toISOString(),
        data,
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }
}
