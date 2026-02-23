import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/types.js";
import {
  getOrgAnalytics,
  refreshOrgAnalytics,
} from "../services/analytics.service.js";
import { ResponsePayload } from "../types/payloads.types.js";
import { IOrgAnalyticsData } from "../types/analytics.types.js";

export default class AnalyticsController {
  /** GET /api/admin/analytics */
  static async getAnalytics(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const org = req.organization!;
      const analytics = await getOrgAnalytics(org._id);

      const payload: ResponsePayload<IOrgAnalyticsData | null> = {
        success: true,
        message: analytics ? "Analytics retrieved" : "No analytics yet",
        timestamp: new Date().toISOString(),
        data: analytics,
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /** POST /api/admin/analytics/refresh — trigger manual refresh */
  static async refreshAnalytics(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const org = req.organization!;
      const analytics = await refreshOrgAnalytics(org);

      const payload: ResponsePayload<IOrgAnalyticsData> = {
        success: true,
        message: "Analytics refreshed successfully",
        timestamp: new Date().toISOString(),
        data: analytics,
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }
}
