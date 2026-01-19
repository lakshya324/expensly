import {
  approvalPoller,
  auditFeedSocket,
  exchangeRateStream,
  healthChecker,
} from "./communication/connect.js";
import { budgetTracker } from "./data/budget.js";
import { tagManager } from "./data/tags.js";
import { dbManager } from "./models/database.js";
import {
  addAuditLogEntry,
  renderExchangeRates,
  updateStatusIndicator,
} from "./ui/right.render.js";

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
      addAuditLogEntry(data);
    }
  });

  // sse
  exchangeRateStream.onRatesUpdate((rates) => {
    renderExchangeRates(rates);
  });

  // status change handler (for all communication types)
  const statusCallback = (type, status) => {
    updateStatusIndicator(type, status);
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

export async function setupData() {
  try {
    budgetTracker.initialize();
    console.log("Budget data loaded");
  } catch (error) {
    console.error("Failed to load budget data:", error);
  }
  try {
    await tagManager.sync();
    console.log("Tag data loaded");
  } catch (error) {
    console.error("Failed to load tag data:", error);
  }
}
