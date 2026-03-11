import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/types.js";
import {
  createBundle,
  listBundles,
  getBundle,
  updateBundle,
  submitBundle,
  deleteBundle,
} from "../services/bundle.service.js";
import { ResponsePayload } from "../types/payloads.types.js";
import { IBundleData } from "../types/bundle.types.js";

/**
 * BundleController — all methods proxy to the bundle service which currently
 * returns 501 Not Implemented. Wire real logic in the service when the
 * Expense Bundling feature is built.
 */
export default class BundleController {
  /** GET /api/users/expenses/bundles */
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const data = await listBundles(org._id.toString());
      const payload: ResponsePayload<IBundleData[]> = {
        success: true,
        message: "Bundles retrieved successfully",
        timestamp: new Date().toISOString(),
        data,
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
      const { name, ticketIds } = req.body as {
        name?: string;
        ticketIds?: string[];
      };
      const data = await createBundle({
        orgId: org._id.toString(),
        name: name ?? "",
        ticketIds: ticketIds ?? [],
        submittedBy: user._id.toString(),
      });
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
      const bundleId = req.params["id"] as string;
      const { name, ticketIds } = req.body as {
        name?: string;
        ticketIds?: string[];
      };
      const data = await updateBundle(org._id.toString(), bundleId, {
        name,
        ticketIds,
      });
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
      const bundleId = req.params["id"] as string;
      const data = await submitBundle(org._id.toString(), bundleId);
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

  /** DELETE /api/users/expenses/bundles/:id */
  static async remove(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const bundleId = req.params["id"] as string;
      await deleteBundle(org._id.toString(), bundleId);
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
}
