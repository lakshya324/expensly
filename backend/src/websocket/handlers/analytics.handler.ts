import { IOrgAnalyticsData } from "../../types/analytics.types.js";
import { getIO } from "../ioServer.js";
import { WS_EVENTS, WSMeta, AnalyticsUpdatePayload, RatesUpdatePayload } from "../events.types.js";

function meta(orgId: string, triggeredBy?: string): WSMeta {
  return { timestamp: new Date().toISOString(), orgId, triggeredBy };
}

export function emitAnalyticsUpdate(
  orgId: string,
  analytics: IOrgAnalyticsData,
  triggeredBy?: string,
): void {
  const payload: AnalyticsUpdatePayload = {
    event: WS_EVENTS.ANALYTICS_UPDATE,
    data: { analytics },
    meta: meta(orgId, triggeredBy),
  };
  getIO().to(orgId).emit(WS_EVENTS.ANALYTICS_UPDATE, payload);
}

export function emitRatesUpdate(
  orgId: string,
  snapshotId: string,
  rates: Record<string, number>,
  baseCurrency: string,
  triggeredBy?: string,
): void {
  const payload: RatesUpdatePayload = {
    event: WS_EVENTS.RATES_UPDATE,
    data: { snapshotId, rates, baseCurrency },
    meta: meta(orgId, triggeredBy),
  };
  getIO().to(orgId).emit(WS_EVENTS.RATES_UPDATE, payload);
}
