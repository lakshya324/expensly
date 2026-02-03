import {
  approvalPoller,
  auditFeedSocket,
  exchangeRateStream,
  healthChecker,
} from "./communication/connect.js";
import { budgetTracker } from "./data/budget.js";
import { AppState } from "./data/state.js";
import { tagManager } from "./data/tags.js";
import { dbManager } from "./models/database.js";
import { TicketStore } from "./models/ticket.store.js";
import { UserSession } from "./storage/session.js";
import { ticketDomManager } from "./ui/center/ticket.component.js";
import { renderBudgetGrid } from "./ui/left/common.component.js";
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
  //! ws
  auditFeedSocket.onMessage((data) => {
    if (data.type === "audit") {
      addAuditLogEntry(data);
    }
  });

  // ws ticket status changes
  auditFeedSocket.onTicketStatusChange(async (data) => {
    console.log(
      `Ticket status update received: ${data.ticketId} -> ${data.status}`,
    );

    // const ticket = AppState.tickets.find(t => t.id === data.ticketId);
    const ticket = await TicketStore.getTicketById(data.ticketId);
    console.log("Fetched ticket for status update:", ticket);
    if (ticket) {
      const oldStatus = ticket.status;
      ticket.status = data.status;
      await TicketStore.updateTicket(ticket.id, { status: data.status });

      // Update budget when ticket is approved
      if (data.status === "approved") {
        // budgetTracker.addExpense(ticket.amount);
        await budgetTracker.reloadBudgets();
        await renderBudgetGrid();
        console.log(`Budget updated: Added ${ticket.amount} for approved ticket ${data.ticketId}`);
      }
    }

    // todo: remove appState dependency
    AppState.tickets = await TicketStore.getAllTickets();

    // rerendering
    await ticketDomManager.renderExpenses();

    console.log(`UI updated for ticket ${data.ticketId}`);
  });

  // ws ticket updates (edit)
  auditFeedSocket.onTicketUpdate(async (data) => {
    console.log(`Ticket update received: ${data.ticketId}`);

    const ticket = await TicketStore.getTicketById(data.ticketId);
    if (ticket) {
      await TicketStore.updateTicket(data.ticketId, data.updatedData);

      // Update local state
      const ticketIndex = AppState.tickets.findIndex(
        (t) => t.id === data.ticketId,
      );
      if (ticketIndex !== -1) {
        AppState.tickets[ticketIndex] = {
          ...AppState.tickets[ticketIndex],
          ...data.updatedData,
        };
      }

      // Re-render the specific card
      await ticketDomManager.renderExpenseById(data.ticketId);
      console.log(`UI updated for edited ticket ${data.ticketId}`);
    }
  });

  // ws ticket delete
  auditFeedSocket.onTicketDelete(async (data) => {
    console.log(`Ticket delete received: ${data.ticketId}`);

    // Remove from local state
    AppState.tickets = AppState.tickets.filter((t) => t.id !== data.ticketId);

    // Remove card from DOM
    await ticketDomManager.deleteExpenseById(data.ticketId);

    console.log(`UI updated for deleted ticket ${data.ticketId}`);
  });

  // ws ticket flag
  auditFeedSocket.onTicketFlag(async (data) => {
    console.log(`Ticket flag received: ${data.ticketId} -> ${data.flagged}`);

    const ticket = await TicketStore.getTicketById(data.ticketId);
    if (ticket) {
      await TicketStore.updateTicket(data.ticketId, { flagged: data.flagged });

      // Update local state //TODO: remove appState dependency
      const ticketIndex = AppState.tickets.findIndex(
        (t) => t.id === data.ticketId,
      );
      if (ticketIndex !== -1) {
        AppState.tickets[ticketIndex].flagged = data.flagged;
      }

      // Re-render the specific card
      await ticketDomManager.flagExpenseById(data.ticketId, data.flagged);

      console.log(`UI updated for flagged ticket ${data.ticketId}`);
    }
  });

  // ws new ticket
  auditFeedSocket.onNewTicket(async (data) => {
    console.log(`New ticket received: ${data.ticketId}`);

    // validating ticket details
    const ticket = await TicketStore.getTicketById(data.ticketId);
    if (!ticket) {
      console.warn("Ticket not found in store:", data.ticketId);
      return;
    }

    // Check if the ticket was created by the current user
    const currentUser = await UserSession.get();
    if (ticket.submittedBy === currentUser.userId) {
      console.log(`Skipping own ticket: ${data.ticketId}`);
      return;
    }

    // Refresh tickets from store //TODO: remove appState dependency
    // AppState.tickets = await TicketStore.getAllTickets();

    await ticketDomManager.addExpenseById(data.ticketId);

    console.log(`UI updated for new ticket ${data.ticketId}`);
  });

  // ws user update
  auditFeedSocket.onUserUpdate(async (data) => {
    console.log(`User update received: ${data.userId}`);

    // Check if the updated user is the current user
    const currentUser = await UserSession.get();
    if (currentUser && currentUser.userId === data.userId) {
      alert("Your account has been updated. Please log in again.");
      UserSession.clear();
      window.location.href = "login.html";
      return;
    }
  });

  // ws user disable
  auditFeedSocket.onUserDisable(async (data) => {
    console.log(`User disable received: ${data.userId}, isDisabled: ${data.isDisabled}`);

    // Check if the disabled user is the current user
    const currentUser = await UserSession.get();
    if (currentUser && currentUser.userId === data.userId && data.isDisabled) {
      alert("Your account has been disabled. You will be logged out.");
      UserSession.clear();
      window.location.href = "login.html";
      return;
    }
  });

  //! SSE
  exchangeRateStream.onRatesUpdate(async (rates) => {
    renderExchangeRates(rates);
    await ticketDomManager.updatePricesOnCurrencyChange();
    // Update budget grid with new exchange rates
    const { renderBudgetGrid } = await import("./ui/left/common.component.js");
    await renderBudgetGrid();
  });

  // status change handler (for all communication types)
  const statusCallback = (type, status) => {
    updateStatusIndicator(type, status);
  };

  //* ws: connected, error, disconnected, reconnecting, failed
  auditFeedSocket.onStatusChange(statusCallback);

  //* sse: connected, error, reconnecting, disconnected
  exchangeRateStream.onStatusChange(statusCallback);

  //* lp: polling, idle, timeout, error, cancelled
  approvalPoller.onStatusChange(statusCallback);

  //* sp: healthy, unhealthy
  healthChecker.onStatusChange(statusCallback);
}

export async function setupData() {
  try {
    await budgetTracker.initialize();
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

  workerBtn.addEventListener("click", async () => {
    workerBtn.disabled = true;
    workerBtn.textContent = "Generating...";

    // Fetch all tickets from the store
    const tickets = await TicketStore.getAllTickets();
    
    // Send tickets to worker for processing
    worker.postMessage({ type: "run", tickets });
  });

  worker.onmessage = (e) => {
    if (e.data.type === "done") {
      downloadBtn.style.display = "block";

      workerBtn.textContent = "Generate Quarterly Report";
      workerBtn.disabled = false;

      const reportData = e.data.payload;
      const blob = new Blob([reportData], { type: "text/csv" });
      const url = URL.createObjectURL(blob);

      downloadBtn.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      downloadBtn.download = `expenses_export_${dateStr}.csv`;

      console.log("Report generation completed");
    }
  };
}
