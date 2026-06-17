/**
 * Budget Service
 *
 * Handles per-department budget reset scheduling and execution.
 */
import { Department } from "../models/Department.model.js";
import { BUDGET_RESET_PERIODS, BudgetResetPeriod } from "../config/constants.js";
import { logInfo } from "../utils/logger.js";

// ---------------------------------------------------------------------------
// Calculate the next reset date from a given base date
// ---------------------------------------------------------------------------
export function calculateNextResetDate(
  period: BudgetResetPeriod,
  from: Date = new Date(),
): Date | null {
  if (period === BUDGET_RESET_PERIODS.NONE) return null;

  const next = new Date(from);

  switch (period) {
    case BUDGET_RESET_PERIODS.MONTHLY:
      next.setMonth(next.getMonth() + 1);
      next.setDate(1);
      next.setHours(0, 0, 0, 0);
      break;
    case BUDGET_RESET_PERIODS.QUARTERLY: {
      // Start of next quarter
      const currentMonth = next.getMonth(); // 0-indexed
      const nextQuarterStart = Math.floor(currentMonth / 3) * 3 + 3;
      next.setMonth(nextQuarterStart);
      next.setDate(1);
      next.setHours(0, 0, 0, 0);
      break;
    }
    case BUDGET_RESET_PERIODS.YEARLY:
      next.setFullYear(next.getFullYear() + 1);
      next.setMonth(0);
      next.setDate(1);
      next.setHours(0, 0, 0, 0);
      break;
  }

  return next;
}

// ---------------------------------------------------------------------------
// Reset a single department's budget
// @deprecated - now handled by processDueBudgetResets with better efficiency and reliability
// ---------------------------------------------------------------------------
// export async function resetDepartmentBudget(
//   dept: IDepartment,
// ): Promise<void> {
//   const nextResetDate = calculateNextResetDate(dept.budgetResetPeriod);

//   await Department.findByIdAndUpdate(dept._id, {
//     $set: {
//       spent: 0,
//       nextResetDate,
//     },
//   });

//   logInfo(
//     `Budget reset for dept ${dept._id} (${dept.name}). Next reset: ${nextResetDate?.toISOString() ?? "none"}`,
//   );
// }

// ---------------------------------------------------------------------------
// Process all departments due for budget reset (called by cron)
// ---------------------------------------------------------------------------
export async function processDueBudgetResets(): Promise<number> {
  const now = new Date();

  const dueDepts = await Department.find({
    budgetResetPeriod: { $ne: BUDGET_RESET_PERIODS.NONE },
    nextResetDate: { $lte: now },
    isActive: true,
  }).lean();

  if (dueDepts.length === 0) return 0;

  // Single bulkWrite instead of N parallel findByIdAndUpdate round-trips.
  await Department.bulkWrite(
    dueDepts.map((dept) => ({
      updateOne: {
        filter: { _id: dept._id },
        update: {
          $set: {
            spent: 0,
            nextResetDate: calculateNextResetDate(dept.budgetResetPeriod),
          },
        },
      },
    })),
  );

  logInfo(`Budget reset processed for ${dueDepts.length} department(s)`);
  return dueDepts.length;
}

// ---------------------------------------------------------------------------
// Schedule initial reset dates when period is set on a dept
// ---------------------------------------------------------------------------
export function initNextResetDate(
  period: BudgetResetPeriod,
): Date | null {
  return calculateNextResetDate(period);
}
