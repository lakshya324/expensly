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

export async function setupWorker() {
  const workerBtn = document.getElementById("btn-generate-report");
  const downloadBtn = document.getElementById("btn-download-report");
  const worker = new Worker("js/utils/worker.js");

  workerBtn.addEventListener("click", () => {
    workerBtn.disabled = true;
    workerBtn.textContent = "Generating...";

    worker.postMessage({ type: "run" });
  });

  worker.onmessage = (e) => {
    if (e.data.type === "done") {
      downloadBtn.style.display = "block";
      
      workerBtn.textContent = "Generate Quarterly Report";
      workerBtn.disabled = false;

      const reportData = e.data.payload;
      const blob = new Blob([reportData], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      downloadBtn.href = url;
      downloadBtn.download = `quarterly_report_${Date.now()}.json`;

      console.log("Report generation completed");
    }
  };
}
