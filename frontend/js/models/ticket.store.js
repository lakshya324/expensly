import { UserSession } from "../storage/session.js";
import { dbManager } from "./database.js";

export class TicketStore {
  static async createTicket(ticketData) {
    const db = await dbManager.getDB();
    const user = await UserSession.get();
    if (!user) {
      throw new Error("Unauthorized to create ticket");
    }
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["tickets"], "readwrite");
      const store = transaction.objectStore("tickets");

      const ticket = {
        id: "ticket_" + crypto.randomUUID(),
        submittedBy: ticketData.submittedBy,
        orgId: ticketData.orgId,
        amount: parseFloat(ticketData.amount),
        currency: ticketData.currency,
        department: ticketData.department,
        description: ticketData.description,
        tags: ticketData.tags || [],
        receiptUrl: ticketData.receiptUrl || null,
        timestamp: new Date().toISOString(),

        // approvals
        managerApproval: user.managerId
          ? {
              required: true,
              approved: false,
              reviewedBy: user.managerId,
              reviewedAt: null,
              comments: null,
            }
          : null, // TODO: add auto-approval logic in controller

        financeApproval: {
          approved: false,
          reviewedBy: null,
          reviewedAt: null,
          comments: null,
        },

        status: "pending",
        //ENUM: 'pending', 'manager_approved', 'approved', 'rejected'
      };

      const request = store.add(ticket);

      request.onsuccess = () => {
        console.log("Ticket created:", ticket.id);
        resolve(ticket);
      };
      request.onerror = () => reject(request.error);
    });
  }

  static async getTicketById(ticketId) {
    const db = await dbManager.getDB();
    const user = await UserSession.get();
    if (!user) {
      throw new Error("Unauthorized access to ticket");
    }
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["tickets"], "readonly");
      const store = transaction.objectStore("tickets");
      const request = store.get(ticketId);

      request.onsuccess = () => {
        if (!request.result) {
          resolve(null);
          return;
        }

        const ticket = request.result;

        // Check access permissions
        if (
          ticket.orgId !== user.orgId ||
          (ticket.submittedBy !== user.id &&
            !(user.isAdmin || user.isFinance) &&
            !(
              ticket.managerApproval &&
              ticket.managerApproval.reviewedBy === user.id
            ))
        ) {
          reject(new Error("Unauthorized access to ticket"));
          return;
        }

        resolve(ticket);
      };
      request.onerror = () => reject(request.error);
    });
  }

  static async getAllTickets() {
    const db = await dbManager.getDB();
    const user = await UserSession.get();
    if (!user) {
      throw new Error("Unauthorized access to tickets");
    }

    if (user.isAdmin || user.isFinance) {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(["tickets"], "readonly");
        const store = transaction.objectStore("tickets");
        const index = store.index("orgId");
        const request = index.getAll(user.orgId);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }

    // else fetch tickets by user or managed by the user
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["tickets"], "readonly");
      const store = transaction.objectStore("tickets");
      const index = store.index("org_deptartment");
      const request = index.getAll([user.orgId, user.department]);
      request.onsuccess = () => {
        const allTickets = request.result;
        const filteredTickets = allTickets.filter((ticket) => {
          return (
            ticket.submittedBy === user.id ||
            (ticket.managerApproval &&
              ticket.managerApproval.reviewedBy === user.id)
          );
        });
        resolve(filteredTickets);
      };
      request.onerror = () => reject(request.error);
    });
  }

  static async updateTicket(ticketId, updates) {
    const db = await dbManager.getDB();
    return new Promise(async (resolve, reject) => {
      const ticket = await this.getTicketById(ticketId);
      if (!ticket) {
        reject(new Error("Ticket not found"));
        return;
      }

      const transaction = db.transaction(["tickets"], "readwrite");
      const store = transaction.objectStore("tickets");
      const updatedTicket = { ...ticket, ...updates };
      const request = store.put(updatedTicket);

      request.onsuccess = () => {
        console.log("Ticket updated:", ticketId);
        resolve(updatedTicket);
      };
      request.onerror = () => reject(request.error);
    });
  }

  static async approveByManager(ticketId, comments = null) {
    const user = await UserSession.get();
    const ticket = await this.getTicketById(ticketId);
    if (!ticket) {
      throw new Error("Ticket not found");
    }
    return this.updateTicket(ticketId, {
      managerApproval: {
        required: true,
        approved: true,
        reviewedBy: user.id,
        reviewedAt: new Date().toISOString(),
        comments: comments,
      },
      status: "manager_approved",
    });
  }

  static async rejectByManager(ticketId, comments = null) {
    const user = await UserSession.get();
    const ticket = await this.getTicketById(ticketId);
    if (!ticket) {
      throw new Error("Ticket not found");
    }
    return this.updateTicket(ticketId, {
      managerApproval: {
        required: true,
        approved: false,
        reviewedBy: user.id,
        reviewedAt: new Date().toISOString(),
        comments: comments,
      },
      status: "rejected",
    });
  }

  static async approveByFinance(ticketId, comments = null) {
    const user = await UserSession.get();
    const ticket = await this.getTicketById(ticketId);
    if (!ticket) {
      throw new Error("Ticket not found");
    }
    if (ticket.status !== "manager_approved") {
      throw new Error(
        "Ticket must be manager approved before finance approval"
      );
    }
    return this.updateTicket(ticketId, {
      financeApproval: {
        approved: true,
        reviewedBy: user.id,
        reviewedAt: new Date().toISOString(),
        comments: comments,
      },
      status: "approved",
    });
  }

  static async rejectByFinance(ticketId, comments = null) {
    const user = await UserSession.get();
    const ticket = await this.getTicketById(ticketId);
    if (!ticket) {
      throw new Error("Ticket not found");
    }
    if (ticket.status !== "manager_approved") {
      throw new Error(
        "Ticket must be manager approved before finance approval"
      );
    }
    return this.updateTicket(ticketId, {
      financeApproval: {
        approved: false,
        reviewedBy: user.id,
        reviewedAt: new Date().toISOString(),
        comments: comments,
      },
      status: "rejected",
    });
  }

  static async deleteTicket(ticketId) {
    const db = await dbManager.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["tickets"], "readwrite");
      const store = transaction.objectStore("tickets");
      const request = store.delete(ticketId);

      request.onsuccess = () => {
        console.log("Ticket deleted:", ticketId);
        resolve(true);
      };
      request.onerror = () => reject(request.error);
    });
  }
}
