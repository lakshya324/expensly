import {
  exchangeRateStream,
  auditFeedSocket,
} from "../../communication/connect.js";
import { AppState } from "../../data/state.js";
import { ReceiptStore } from "../../models/receipt.store.js";
import { TicketStore } from "../../models/ticket.store.js";
import { UserStore } from "../../models/user.store.js";
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
            reviewedBy: AppState.currentUser.userId,
            reviewedAt: Date.now(),
            comments: null,
          },
          status: "approved",
        });

        // Broadcast status change via WebSocket
        auditFeedSocket.updateTicketStatus(expenseId, "approved");

        AppState.tickets = await TicketStore.getAllTickets();
        await this.renderExpenseById(expenseId);
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
            reviewedBy: AppState.currentUser.userId,
            reviewedAt: Date.now(),
            comments: null,
          },
          status: "rejected",
        });

        // broadcast status change
        auditFeedSocket.updateTicketStatus(expenseId, "rejected");

        AppState.tickets = await TicketStore.getAllTickets();
        await this.renderExpenseById(expenseId);
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
            reviewedBy: AppState.currentUser.userId,
            reviewedAt: Date.now(),
            comments: null,
          },
          status: "manager_approved",
        });

        // broadcast status change
        auditFeedSocket.updateTicketStatus(expenseId, "manager_approved");

        AppState.tickets = await TicketStore.getAllTickets();
        await this.renderExpenseById(expenseId);
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
            reviewedBy: AppState.currentUser.userId,
            reviewedAt: Date.now(),
            comments: null,
          },
          status: "rejected",
        });

        // broadcast status change
        auditFeedSocket.updateTicketStatus(expenseId, "rejected");

        AppState.tickets = await TicketStore.getAllTickets();
        await this.renderExpenseById(expenseId);
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

  async createExpenseCard(expense) {
    const user = AppState.currentUser;
    const card = document.createElement("div");
    card.className = "expense-card";

    const userCurrency = UserPreferenceLocal.getCurrency();
    const expenseCurrency = expense.currency || CURRENCY[0];

    // Convert amount if needed
    let displayAmount = "";
    if (expenseCurrency === userCurrency) {
      displayAmount = `${getCurrencySymbol(
        expenseCurrency,
      )} ${expense.amount.toFixed(2)}`;
    } else {
      displayAmount = `${getCurrencySymbol(userCurrency)} ${exchangeRateStream
        .convert(expense.amount, expenseCurrency, userCurrency)
        .toFixed(2)} (${getCurrencySymbol(
        expenseCurrency,
      )} ${expense.amount.toFixed(2)})`;
    }

    // Check if current user is the manager of the ticket submitter
    let isManager = false;
    const submittedBy = expense.submittedBy;
    if (submittedBy && expense.status === "pending") {
      const submitter = await UserStore.getUserById(submittedBy);
      isManager = submitter && submitter.managerId === user.userId;
    }

    // checking for recept
    const receipt = await ReceiptStore.getReceipt(expense.id);
    const receiptUrl = receipt ? URL.createObjectURL(receipt.blob) : null;

    card.innerHTML = `
      <div class="expense-header">
        <div class="expense-info" data-expense-id="${expense.id}">
          <span class="expense-title">${expense.title}</span>
          <span class="expense-amount">${displayAmount}</span>
          <span class="expense-status status-${expense.status}">
          ${expense.status}</span>
          <span class="expense-dept">${expense.department}</span>
        </div>
        <div class="expense-actions">
          ${
            user.isFinance && expense.status === "manager_approved"
              ? `
            <button id="btnFinanceApprove" data-expense-id="${expense.id}" title="Approve Expense">Approve</button>
            <button id="btnFinanceReject" data-expense-id="${expense.id}" title="Reject Expense">Reject</button>
          `
              : ""
          }
          ${
            isManager
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
          expense.timestamp,
        ).toLocaleDateString()}</p>
        <p><strong>Tags:</strong> ${expense.tags.join(", ")}</p>
        <p><strong>Status:</strong> ${expense.status}</p>
        ${
          receiptUrl
            ? `<a href="${receiptUrl}" class="receipt-preview" target="_blank"><img src="${receiptUrl}" alt="${receipt.blob.name || "Receipt"}"></a>`
            : ""
        }
    `;

    return card;
  }

  async renderExpenses() {
    if (!this.expenseListContainer) {
      console.error("Container not initialized");
      return;
    }

    this.expenseListContainer.innerHTML = "";

    const raw = await TicketStore.getAllTickets();
    const expenses = raw.sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp),
    );

    console.log("Rendering expenses:", expenses.length);

    for (const expense of expenses) {
      const card = await this.createExpenseCard(expense);
      this.expenseListContainer.appendChild(card);
    }

    console.log(`Rendered ${expenses.length} expenses`);
  }

  async renderExpenseById(expenseId) {
    if (!this.expenseListContainer) {
      console.error("Container not initialized");
      return;
    }

    const expense = await TicketStore.getTicketById(expenseId);
    if (!expense) {
      console.error("Expense not found:", expenseId);
      return;
    }

    const card = await this.createExpenseCard(expense);
    const existingCard = this.expenseListContainer.querySelector(
      `.expense-info[data-expense-id="${expenseId}"]`,
    )?.parentElement;

    if (existingCard) {
      this.expenseListContainer.replaceChild(card, existingCard);
      console.log("Re-rendered expense:", expenseId);
    } else {
      // this.expenseListContainer.appendChild(card);
      // console.log("Appended new expense:", expenseId);
      // todo: helps in pagination later
    }
  }

  async addExpense(expense) {
    if (!this.expenseListContainer) {
      console.error("Container not initialized");
      return;
    }

    const card = await this.createExpenseCard(expense);
    this.expenseListContainer.prepend(card);
    console.log("Added new expense to DOM:", expense.id);
  }

  async updatePricesOnCurrencyChange() {
    //todo: optimize this later (take compont and update prices only)
    const raw = await TicketStore.getAllTickets();
    const expenses = raw.sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp),
    );

    for (const expense of expenses) {
      const card = this.expenseListContainer.querySelector(
        `.expense-info[data-expense-id="${expense.id}"]`,
      );
      if (card) {
        const amountElem = card.querySelector(".expense-amount");
        if (amountElem) {
          const userCurrency = UserPreferenceLocal.getCurrency();
          const expenseCurrency = expense.currency || CURRENCY[0];

          let displayAmount = "";
          if (expenseCurrency === userCurrency) {
            displayAmount = `${getCurrencySymbol(
              expenseCurrency,
            )} ${expense.amount.toFixed(2)}`;
          } else {
            displayAmount = `${getCurrencySymbol(userCurrency)} ${exchangeRateStream
              .convert(expense.amount, expenseCurrency, userCurrency)
              .toFixed(2)} (${getCurrencySymbol(
              expenseCurrency,
            )} ${expense.amount.toFixed(2)})`;

            amountElem.textContent = displayAmount;
          }
        }
      }
    }
  }
}
export const ticketDomManager = new TicketDomManager();
