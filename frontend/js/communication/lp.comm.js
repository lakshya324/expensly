import { API_BASE, LP_CONFIG } from "../config/env.config";

export class ApprovalPoller {
  constructor() {
    this.baseUrl = API_BASE;
    this.activePolls = new Map();
    this.onStatusChangeCallback = null;
  }

  startPolling(expenseId, onApproval, onError) {
    if (this.activePolls.has(expenseId)) {
      console.warn("Already polling for expense:", expenseId);
      return;
    }

    console.log("Starting long poll for approval:", expenseId);
    this.updateStatus("polling");

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      LP_CONFIG.pollInterval
    );

    this.activePolls.set(expenseId, { controller, timeoutId });

    fetch(`${this.baseUrl}/expenses/${expenseId}/approval`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        console.log("Approval response received:", data);
        clearTimeout(timeoutId);
        this.activePolls.delete(expenseId);
        this.updateStatus("idle");

        if (onApproval) {
          onApproval(data);
        }
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        this.activePolls.delete(expenseId);

        if (error.name === "AbortError") {
          console.log("Long poll timeout");
          this.updateStatus("timeout");
        } else {
          console.error("Long poll error:", error);
          this.updateStatus("error");
        }

        if (onError) {
          onError(error);
        }
      });
  }

  cancelPolling(expenseId) {
    const poll = this.activePolls.get(expenseId);
    if (poll) {
      clearTimeout(poll.timeoutId);
      poll.controller.abort();
      this.activePolls.delete(expenseId);
      console.log("Polling cancelled for:", expenseId);
      this.updateStatus("cancelled");
    }
  }

  cancelAll() {
    this.activePolls.forEach((poll, expenseId) => {
      clearTimeout(poll.timeoutId);
      poll.controller.abort();
    });
    this.activePolls.clear();
    console.log("All polls cancelled");
    this.updateStatus("idle");
  }

  updateStatus(status) {
    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback("lp", status);
    }
  }

  onStatusChange(callback) {
    this.onStatusChangeCallback = callback;
  }

  getActivePollCount() {
    return this.activePolls.size;
  }
}
