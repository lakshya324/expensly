/**
 * Cron Jobs
 *
 * - Budget reset: hourly scan, resets departments whose nextResetDate has passed
 * - Analytics refresh: daily at midnight for all orgs
 */
import cron from "node-cron";
import { processDueBudgetResets } from "./services/budget.service.js";
import { refreshOrgAnalytics } from "./services/analytics.service.js";
import { Organization } from "./models/Organization.model.js";
import { logError, logInfo } from "./utils/logger.js";

export function startCronJobs(): void {
  // Budget reset — every hour at minute 0
  cron.schedule("0 * * * *", async () => {
    try {
      const count = await processDueBudgetResets();
      if (count > 0)
        logInfo(`[Cron] Budget reset processed for ${count} department(s)`);
    } catch (err) {
      logError(err as Error, {
        message: "Cron budget reset failed",
        code: "CRON_BUDGET_RESET_ERROR",
      });
    }
  });

  // Analytics refresh — every day at midnight (00:00)
  cron.schedule("0 0 * * *", async () => {
    try {
      const orgs = await Organization.find(
        { isDisabled: false },
        { _id: 1 },
      ).lean();

      await Promise.allSettled(
        orgs.map((org) =>
          refreshOrgAnalytics(org).catch((err) =>
            logError(err, {
              message: `Analytics refresh failed for org ${org._id}`,
              code: "CRON_ANALYTICS_ERROR",
            }),
          ),
        ),
      );
      logInfo(`[Cron] Analytics refreshed for ${orgs.length} org(s)`);
    } catch (err) {
      logError(err as Error, {
        message: "Cron analytics refresh failed",
        code: "CRON_ANALYTICS_ERROR",
      });
    }
  });

  logInfo("[Cron] Budget reset (hourly) and analytics refresh (daily) scheduled");
}
