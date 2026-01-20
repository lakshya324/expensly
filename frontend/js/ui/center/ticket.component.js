import { exchangeRateStream } from "../../communication/connect.js";
import { AppState } from "../../data/state.js";
import { TicketStore } from "../../models/ticket.store.js";
import { UserPreferenceLocal } from "../../storage/local.js";
import { CURRENCY, getCurrencySymbol } from "../../utils/currency.js";

class TicketDomManager {
  constructor() {
    this.expenseListContainer = null;

    // WeakMap to store private audit notes for DOM elements
    // todo: just added idk what to do with it... but looks cool
    this.auditNotesMap = new WeakMap();
  }

  async initEventDelegation() {
    this.expenseListContainer = document.getElementById("expense-list");

    if (!this.expenseListContainer) {
      console.error("Expense list container not found");
      return;
    }

    // render expenses
    await this.renderExpenses();

    // single event delegation for all expense
    this.expenseListContainer.addEventListener("click", async (event) => {
      const target = event.target;

      //* Finance actions
      if (target.id === "btnFinanceApprove") {
        target.disabled = true;

        const expenseId = target.getAttribute("data-expense-id");
        const expense = AppState.tickets.find((e) => e.id === expenseId);

        if (!expense) {
          console.error("Expense not found:", expenseId);
          return;
        }
        if (expense.status !== "manager_approved") {
          alert("Expense must be manager approved before finance approval");
          target.disabled = false;
          return;
        }

        await TicketStore.updateTicket(expenseId, {
          financeApproval: {
            approved: true,
            reviewedBy: AppState.currentUser.id,
            reviewedAt: Date.now(),
            comments: null,
          },
          status: "approved",
        });
        AppState.tickets = await TicketStore.getAllTickets();
        await this.renderExpenses();
        console.log("Finance approve clicked for", expenseId);
      } else if (target.id === "btnFinanceReject") {
        target.disabled = true;

        const expenseId = target.getAttribute("data-expense-id");
        const expense = AppState.tickets.find((e) => e.id === expenseId);

        if (!expense) {
          console.error("Expense not found:", expenseId);
          return;
        }
        if (expense.status !== "manager_approved") {
          alert("Expense must be manager approved before finance rejection");
          target.disabled = false;
          return;
        }

        await TicketStore.updateTicket(expenseId, {
          financeApproval: {
            approved: false,
            reviewedBy: AppState.currentUser.id,
            reviewedAt: Date.now(),
            comments: null,
          },
          status: "rejected",
        });
        AppState.tickets = await TicketStore.getAllTickets();
        await this.renderExpenses();
        console.log("Finance reject clicked for", expenseId);
      }

      //* manager actions
      else if (target.id === "btnManagerApprove") {
        target.disabled = true;

        const expenseId = target.getAttribute("data-expense-id");
        const expense = AppState.tickets.find((e) => e.id === expenseId);

        if (!expense) {
          console.error("Expense not found:", expenseId);
          return;
        }
        if (expense.status !== "pending") {
          alert("Only pending expenses can be approved by manager");
          target.disabled = false;
          return;
        }

        await TicketStore.updateTicket(expenseId, {
          managerApproval: {
            required: true,
            approved: true,
            reviewedBy: AppState.currentUser.id,
            reviewedAt: Date.now(),
            comments: null,
          },
          status: "manager_approved",
        });
        AppState.tickets = await TicketStore.getAllTickets();
        await this.renderExpenses();
        console.log("Manager approve clicked for", expenseId);
      } else if (target.id === "btnManagerReject") {
        target.disabled = true;

        const expenseId = target.getAttribute("data-expense-id");
        const expense = AppState.tickets.find((e) => e.id === expenseId);

        if (!expense) {
          console.error("Expense not found:", expenseId);
          return;
        }
        if (expense.status !== "pending") {
          alert("Only pending expenses can be rejected by manager");
          target.disabled = false;
          return;
        }

        await TicketStore.updateTicket(expenseId, {
          managerApproval: {
            required: true,
            approved: false,
            reviewedBy: AppState.currentUser.id,
            reviewedAt: Date.now(),
            comments: null,
          },
          status: "rejected",
        });
        AppState.tickets = await TicketStore.getAllTickets();
        await this.renderExpenses();
        console.log("Manager reject clicked for", expenseId);
      }

      //* smart expand/collapse feat :)
      else if (target.closest(".expense-card")) {
        const expenseCard = target.closest(".expense-card");
        this.toggleCardExpansion(expenseCard);
      }
    });
  }

  toggleCardExpansion(expenseCard) {
    const details = expenseCard.querySelector(".expense-details");
    if (details) {
      const isExpanded = details.style.display === "block";
      details.style.display = isExpanded ? "none" : "block";
      expenseCard.classList.toggle("expanded", !isExpanded);

      console.log("Card", isExpanded ? "collapsed" : "expanded");
    }
  }

  // Todo: use audit notes
  setAuditNote(element, note) {
    this.auditNotesMap.set(element, note);
  }

  getAuditNote(element) {
    return this.auditNotesMap.get(element) || null;
  }

  hasAuditNote(element) {
    return this.auditNotesMap.has(element);
  }

  createExpenseCard(expense) {
    const user = AppState.currentUser;
    const card = document.createElement("div");
    card.className = "expense-card";

    const userCurrency = UserPreferenceLocal.getCurrency();
    const expenseCurrency = expense.currency || CURRENCY[0];

    // Convert amount if needed
    let displayAmount = "";
    if (expenseCurrency === userCurrency) {
      displayAmount = `${getCurrencySymbol(
        expenseCurrency
      )} ${expense.amount.toFixed(2)}`;
    } else {
      displayAmount = `${getCurrencySymbol(userCurrency)} ${exchangeRateStream
        .convert(expense.amount, expenseCurrency, userCurrency)
        .toFixed(2)} (${getCurrencySymbol(
        expenseCurrency
      )} ${expense.amount.toFixed(2)})`;
    }

    card.innerHTML = `
      <div class="expense-header">
        <div class="expense-info">
          <span class="expense-title">${expense.title}</span>
          <span class="expense-amount">${displayAmount} | ${
      expense.status
    }</span>
          <span class="expense-dept">${expense.department}</span>
        </div>
        <div class="expense-actions">
          ${
            user.isFinance & (expense.status === "manager_approved")
              ? `
            <button id="btnFinanceApprove" data-expense-id="${expense.id}" title="Approve Expense">Approve</button>
            <button id="btnFinanceReject" data-expense-id="${expense.id}" title="Reject Expense">Reject</button>
          `
              : ""
          }
          ${
            expense.managerApproval &&
            expense.managerApproval.reviewedBy === user.id &&
            expense.status === "pending"
              ? `
            <button id="btnManagerApprove" data-expense-id="${expense.id}" title="Approve Expense">Approve</button>
            <button id="btnManagerReject" data-expense-id="${expense.id}" title="Reject Expense">Reject</button>
          `
              : ""
          }
        </div>
      </div>
      <div class="expense-details" style="display: none;">
        <p><strong>Description:</strong> ${expense.description}</p>
        <p><strong>Date:</strong> ${new Date(
          expense.timestamp
        ).toLocaleDateString()}</p>
        <p><strong>Tags:</strong> ${expense.tags.join(", ")}</p>
        <p><strong>Status:</strong> ${expense.status}</p>
        ${
          expense.receiptUrl
            ? `<img src="${expense.receiptUrl}" alt="Receipt" class="receipt-preview">`
            : ""
        }
      </div>
    `;

    return card;
  }

  async renderExpenses() {
    if (!this.expenseListContainer) {
      console.error("Container not initialized");
      return;
    }

    this.expenseListContainer.innerHTML = "";

    // const expenses = AppState.tickets; // todo: check it is update when edit
    const expenses = await TicketStore.getAllTickets();

    console.log("Rendering expenses:", expenses.length);

    expenses.forEach((expense) => {
      const card = this.createExpenseCard(expense);
      this.expenseListContainer.appendChild(card);
    });

    console.log(`Rendered ${expenses.length} expenses`);
  }
}

export const ticketDomManager = new TicketDomManager();
