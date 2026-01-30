import { API_BASE, LP_CONFIG } from "../config/env.config.js";
import { ticketDomManager } from "../ui/center/ticket.component.js";

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
    this.poll(expenseId, onApproval, onError);
  }

  poll(expenseId, onApproval, onError) {
    // if (this.activePolls.has(expenseId)) {
    //   return; // polling already active
    // }

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      LP_CONFIG.pollInterval,
    );

    this.activePolls.set(expenseId, {
      controller,
      timeoutId,
      onApproval,
      onError,
    });

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
        console.log("LP > Ticket status response:", data);
        clearTimeout(timeoutId);

        // ticketDomManager.renderExpenseById(expenseId);

        if (data.status === "approved" || data.status === "rejected") {
          // stop polling
          this.activePolls.delete(expenseId);
          this.updateStatus("idle");
          if (onApproval) {
            onApproval(data);
          }
        } else {
          // continue polling
          const pollData = this.activePolls.get(expenseId);
          if (pollData) {
            setTimeout(
              () => this.poll(expenseId, pollData.onApproval, pollData.onError),
              1000,
            );
          }
        }
      })
      .catch((error) => {
        clearTimeout(timeoutId);

        if (error.name === "AbortError") {
          console.log("Long poll request timeout, retrying...");
          // continue polling after timeout
          const pollData = this.activePolls.get(expenseId);
          if (pollData) {
            setTimeout(
              () => this.poll(expenseId, pollData.onApproval, pollData.onError),
              1000,
            );
          }
        } else {
          console.error("Long poll error:", error);
          this.activePolls.delete(expenseId);
          this.updateStatus("error");
          if (onError) {
            onError(error);
          }
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
