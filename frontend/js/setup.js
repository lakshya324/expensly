import {
  approvalPoller,
  auditFeedSocket,
  exchangeRateStream,
  healthChecker,
} from "./communication/connect";
import { dbManager } from "./models/database";

export async function setupDB() {
  try {
    await dbManager.init();
    console.log("Expensly storage ready");
  } catch (error) {
    console.error("Failed to initialize storage:", error);
    alert("Failed to initialize app storage. Please refresh the page.");
  }
}

export function setupCommunicationCallbacks() {
  // ws
  auditFeedSocket.onMessage((data) => {
    if (data.type === "audit") {
      addAuditLogEntry(data); // TODO: implement
    }
  });

  // sse
  exchangeRateStream.onRatesUpdate((rates) => {
    renderExchangeRates(rates); // TODO: implement
  });

  // status change handler (for all communication types)
  const statusCallback = (type, status) => {
    updateStatusIndicator(type, status); //TODO: implement
  };

  // ws: connected, error, disconnected, reconnecting, failed
  auditFeedSocket.onStatusChange(statusCallback);

  // sse: connected, error, reconnecting, disconnected
  exchangeRateStream.onStatusChange(statusCallback);

  // lp: polling, idle, timeout, error, cancelled
  approvalPoller.onStatusChange(statusCallback);

  // sp: healthy, unhealthy
  healthChecker.onStatusChange(statusCallback);
}
