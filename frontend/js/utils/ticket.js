import { approvalPoller } from "../communication/connect.js";
import { API_BASE } from "../config/env.config.js";
import { budgetTracker } from "../data/budget.js";
import { AppState } from "../data/state.js";
import { tagManager } from "../data/tags.js";
import { OfflineQueue } from "../models/offlineQueue.store.js";
import { ReceiptStore } from "../models/receipt.store.js";
import { TicketStore } from "../models/ticket.store.js";
import { UserPreferenceLocal } from "../storage/local.js";
import { getExpenseFormData } from "../ui/left/form.js";
import {
  renderAvailableTags,
  renderBudgetGrid,
} from "../ui/left/user.component.js";

export async function handleTicketFormSubmit(event) {
  event.preventDefault();

  const formData = getExpenseFormData();

  const tagString = formData.tags;
  const tags = tagManager.parseTagString(tagString);

  tags.forEach((tag) => tagManager.addTag(tag));
  renderAvailableTags();

  const currentCurrency = UserPreferenceLocal.getCurrency();

  const ticket = {
    id: "ticket_" + crypto.randomUUID(),
    title: formData.title,
    amount: formData.amount,
    currency: currentCurrency, // Storeing user currency
    description: formData.description,
    tags: tags,
    timestamp: Date.now(),
    status: "pending",
    receiptFile: AppState.currentReceiptFile,
  };

  try {
    // Check if online
    if (navigator.onLine) {
      await submitTicketToServer(ticket);

      await addTicketToIDB(ticket, AppState.currentReceiptFile);
      alert("Ticket submitted successfully");
    } else {
      console.log("Offline: adding to queue");
      await OfflineQueue.add(ticket, AppState.currentReceiptFile);
      await updateQueueBadge();
      alert("Offline: Ticket queued for sync");
    }

    // Clear form
    document.getElementById("expense-form").reset();
    document.getElementById("receipt-preview").innerHTML = "";
    expenseDraft.clearDraft();
    AppState.currentReceiptFile = null;

    if (AppState.currentReceiptUrl) {
      URL.revokeObjectURL(AppState.currentReceiptUrl);
      AppState.currentReceiptUrl = null;
    }

    console.log("Ticket submitted:", ticket.id);
  } catch (error) {
    console.error("Submission failed:", error);
    alert("Failed to submit ticket: " + error.message);
  }
}

export async function addTicketToIDB(ticket, receiptFile = null) {
  try {
    await TicketStore.createTicket(ticket);

    // Store receipt if present
    if (receiptFile) {
      await ReceiptStore.storeReceipt(ticket.id, receiptFile);
    }

    budgetTracker.addExpense(ticket.department, ticket.amount);
    await renderBudgetGrid();

    // Add to state and render
    AppState.tickets.push(ticket);
    domManager.renderExpenses(); //TODO

    // Start long polling for approval
    startApprovalPolling(ticket.id);

    console.log("Expense Added to IDB:", ticket.id);
  } catch (error) {
    console.error("Failed to add expense to IDB:", error);
    throw error;
  }
}

export async function submitTicketToServer(ticket) {
  const formData = new FormData();
  formData.append("id", ticket.id);
  formData.append("amount", ticket.amount);
  formData.append("department", ticket.department);
  formData.append("description", ticket.description);
  formData.append("tags", JSON.stringify(ticket.tags));
  formData.append("timestamp", ticket.timestamp);

  if (ticket.receiptFile) {
    formData.append("receipt", ticket.receiptFile);
  }

  const response = await fetch(API_BASE + "/expenses", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const result = await response.json();
  console.log("Server response:", result);

  return result;
}

function startApprovalPolling(expenseId) {
  console.log("Starting approval polling for:", expenseId);

  approvalPoller.startPolling(
    expenseId,
    (result) => {
      console.log("Approval received:", result);
      alert(`Expense ${expenseId} ${result.status} by ${result.approver}`);

      // Update expense status
      const expense = AppState.tickets.find((e) => e.id === expenseId);
      if (expense) {
        expense.status = result.status;
        domManager.renderExpenses(AppState.tickets);
      }
    },
    (error) => {
      console.error("Approval polling failed:", error);
    }
  );
}
