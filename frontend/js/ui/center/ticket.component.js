import {
  exchangeRateStream,
  auditFeedSocket,
} from "../../communication/connect.js";
import { budgetTracker } from "../../data/budget.js";
import { AppState } from "../../data/state.js";
import { ReceiptStore } from "../../models/receipt.store.js";
import { TicketStore } from "../../models/ticket.store.js";
import { UserStore } from "../../models/user.store.js";
import { UserPreferenceLocal } from "../../storage/local.js";
import { CURRENCY, getCurrencySymbol } from "../../utils/currency.js";

class TicketDomManager {
  constructor() {
    this.expenseListContainer = null;
    this.editModal = null;

    // WeakMap to store private audit notes for DOM elements
    // todo: just added idk what to do with it... but looks cool
    this.auditNotesMap = new WeakMap();

    // Create modal on initialization
    this.createEditModal();
  }

  createEditModal() {
    // Create modal HTML
    const modalHTML = `
      <div id="edit-ticket-modal" class="modal" style="display: none;">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Edit Ticket</h3>
            <button id="modal-close" class="close-btn">&times;</button>
          </div>
          <form id="edit-ticket-form">
            <input type="hidden" id="edit-ticket-id">
            <div class="form-group">
              <label>Title</label>
              <input type="text" id="edit-title" required>
            </div>
            <div class="form-group">
              <label>Amount</label>
              <input type="number" id="edit-amount" step="0.01" required>
            </div>
            <div class="form-group">
              <label>Currency</label>
              <select id="edit-currency" required>
                ${CURRENCY.map(
                  (cur) => `<option value="${cur}">${cur}</option>`,
                ).join("")}
              </select>
            </div>
            <div class="form-group">
              <label>Description</label>
              <textarea id="edit-description" rows="3"></textarea>
            </div>
            <div class="form-group">
              <label>Tags (comma separated)</label>
              <input type="text" id="edit-tags">
            </div>
            <div class="form-actions">
              <button type="button" id="modal-cancel" class="btn-secondary">Cancel</button>
              <button type="submit" class="btn-primary">Save Changes</button>
            </div>
          </form>
        </div>
      </div>
    `;

    // Append modal to body
    document.body.insertAdjacentHTML("beforeend", modalHTML);
    this.editModal = document.getElementById("edit-ticket-modal");

    // Setup modal event listeners
    document
      .getElementById("modal-close")
      .addEventListener("click", () => this.closeEditModal());
    document
      .getElementById("modal-cancel")
      .addEventListener("click", () => this.closeEditModal());
    document
      .getElementById("edit-ticket-form")
      .addEventListener("submit", (e) => this.handleEditSubmit(e));

    // Close modal on outside click
    this.editModal.addEventListener("click", (e) => {
      if (e.target === this.editModal) {
        this.closeEditModal();
      }
    });
  }

  openEditModal(expense) {
    document.getElementById("edit-ticket-id").value = expense.id;
    document.getElementById("edit-title").value = expense.title;
    document.getElementById("edit-amount").value = expense.amount;
    document.getElementById("edit-currency").value = expense.currency;
    document.getElementById("edit-description").value =
      expense.description || "";
    document.getElementById("edit-tags").value = expense.tags
      ? expense.tags.join(", ")
      : "";

    this.editModal.style.display = "flex";
  }

  closeEditModal() {
    this.editModal.style.display = "none";
    document.getElementById("edit-ticket-form").reset();
  }

  async handleEditSubmit(e) {
    e.preventDefault();

    const ticketId = document.getElementById("edit-ticket-id").value;
    const updatedData = {
      title: document.getElementById("edit-title").value,
      amount: parseFloat(document.getElementById("edit-amount").value),
      currency: document.getElementById("edit-currency").value,
      description: document.getElementById("edit-description").value,
      tags: document
        .getElementById("edit-tags")
        .value.split(",")
        .map((t) => t.trim())
        .filter((t) => t),
    };

    try {
      await TicketStore.updateTicket(ticketId, updatedData);

      // Broadcast the update via WebSocket
      auditFeedSocket.sendTicketUpdate(ticketId, updatedData);

      // Update local state
      const ticketIndex = AppState.tickets.findIndex((t) => t.id === ticketId);
      if (ticketIndex !== -1) {
        AppState.tickets[ticketIndex] = {
          ...AppState.tickets[ticketIndex],
          ...updatedData,
        };
      }

      // rendering ticket
      await this.renderExpenseById(ticketId);

      this.closeEditModal();
      console.log("Ticket updated:", ticketId);
    } catch (error) {
      console.error("Failed to update ticket:", error);
      alert("Failed to update ticket");
    }
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

      //! Actions for edit, delete, flag
      else if (target.id === "btnEdit") {
        const expenseId = target.getAttribute("data-expense-id");
        const expense = AppState.tickets.find((e) => e.id === expenseId);
        if (expense) {
          this.openEditModal(expense);
        }
      } else if (target.id === "btnDelete") {
        const expenseId = target.getAttribute("data-expense-id");

        if (confirm("Are you sure you want to delete this ticket?")) {
          try {
            const expense = AppState.tickets.find((e) => e.id === expenseId);

            // Delete from store
            await TicketStore.deleteTicket(expenseId);

            // Update budget if it was approved
            if (expense && expense.status === "approved") {
              budgetTracker.removeExpense(
                AppState.currentUser.department,
                expense.amount,
              );
            }

            // Broadcast deletion via WebSocket
            auditFeedSocket.sendTicketDelete(expenseId);

            // Remove from local state
            AppState.tickets = AppState.tickets.filter(
              (t) => t.id !== expenseId,
            );

            // Remove card form UI
            await this.deleteExpenseById(expenseId);

            console.log("Ticket deleted:", expenseId);
          } catch (error) {
            console.error("Failed to delete ticket:", error);
            alert("Failed to delete ticket");
          }
        }
      } else if (target.id === "btnFlag") {
        const expenseId = target.getAttribute("data-expense-id");
        const expense = await TicketStore.getTicketById(expenseId);
        if (expense) {
          const newFlaggedState = !expense.flagged;

          // Update store
          await TicketStore.updateTicket(expenseId, {
            flagged: newFlaggedState,
          });

          // Broadcast flag change via WebSocket
          auditFeedSocket.sendTicketFlag(expenseId, newFlaggedState);

          // Update local state //todo: remove appState dependency later
          const ticketIndex = AppState.tickets.findIndex(
            (t) => t.id === expenseId,
          );
          if (ticketIndex !== -1) {
            AppState.tickets[ticketIndex].flagged = newFlaggedState;
          }

          // Update UI
          await this.flagExpenseById(expenseId, newFlaggedState);

          console.log(
            `Ticket flag toggled: ${expenseId} -> ${newFlaggedState}`,
          );
        }


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

    // add flagged if ticket is flagged
    if (expense.flagged) {
      card.classList.add("flagged");
    }

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

    // Determine which action buttons to show
    const showActionButtons = {
      showEditButton:
        user.userId === expense.submittedBy && expense.status === "pending",
      showDeleteButton:
        user.userId === expense.submittedBy &&
        (expense.status === "pending" || expense.status === "rejected"),
      showFlagButton: user.isFinance || user.isAdmin || isManager,
      alreadyFlagged: expense.flagged,
    };

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
        <div class="action-buttons">
        ${
          showActionButtons.showFlagButton
            ? `<button id="btnFlag" data-expense-id="${expense.id}" title="Flag Expense">${showActionButtons.alreadyFlagged ? "Unflag" : "Flag"}</button>`
            : ""
        }
        ${
          showActionButtons.showEditButton
            ? `<button id="btnEdit" data-expense-id="${expense.id}" title="Edit Expense">Edit</button>`
            : ""
        }
        ${
          showActionButtons.showDeleteButton
            ? `<button id="btnDelete" data-expense-id="${expense.id}" title="Delete Expense">Delete</button>`
            : ""
        }
        </div>
        <div class="approval-buttons">
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

  async deleteExpenseById(expenseId) {
    if (!this.expenseListContainer) {
      console.error("Container not initialized");
      return;
    }

    const existingCard = this.expenseListContainer.querySelector(
      `.expense-info[data-expense-id="${expenseId}"]`,
    )?.parentElement?.parentElement;

    if (existingCard) {
      this.expenseListContainer.removeChild(existingCard);
      console.log("Deleted expense from DOM:", expenseId);
    } else {
      console.warn("Expense card not found in DOM for deletion:", expenseId);
    }
  }

  async flagExpenseById(expenseId, flagged) {
    if (!this.expenseListContainer) {
      console.error("Container not initialized");
      return;
    }

    const existingCard = this.expenseListContainer.querySelector(
      `.expense-info[data-expense-id="${expenseId}"]`,
    )?.parentElement?.parentElement;

    if (existingCard) {
      console.log("parent", existingCard);
      if (flagged) {
        existingCard.classList.add("flagged");
        existingCard
          .querySelector('#btnFlag')
          .textContent = "Unflag";
      } else {
        existingCard.classList.remove("flagged");
        existingCard
          .querySelector('#btnFlag')
          .textContent = "Flag";
      }
      console.log(`Flagged state updated for expense ${expenseId}: ${flagged}`);
    } else {
      console.warn("Expense card not found in DOM for flag update:", expenseId);
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
