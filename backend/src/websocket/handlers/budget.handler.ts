import { getIO } from "../ioServer.js";
import { WS_EVENTS, WSMeta, BudgetAlertPayload } from "../events.types.js";

function meta(orgId: string): WSMeta {
  return { timestamp: new Date().toISOString(), orgId };
}

export function emitBudgetAlert(
  orgId: string,
  departmentId: string,
  departmentName: string,
  spent: number,
  budget: number,
): void {
  const usagePercent =
    budget > 0 ? parseFloat(((spent / budget) * 100).toFixed(2)) : 0;

  const payload: BudgetAlertPayload = {
    event: WS_EVENTS.BUDGET_ALERT,
    data: { departmentId, departmentName, usagePercent, spent, budget },
    meta: meta(orgId),
  };

  getIO().to(orgId).emit(WS_EVENTS.BUDGET_ALERT, payload);
}
