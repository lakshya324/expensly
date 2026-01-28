import { auditFeedSocket } from "../communication/connect.js";
import { AppState } from "../data/state.js";
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
        id: ticketData.id || "ticket_" + crypto.randomUUID(),
        title: ticketData.title,
        submittedBy: user.userId,
        orgId: user.orgId,
        amount: parseFloat(ticketData.amount),
        currency: ticketData.currency,
        department: user.department,
        description: ticketData.description,
        tags: ticketData.tags || [],
        // receiptUrl: ticketData.receiptUrl || AppState.currentReceiptUrl || null,
        timestamp: new Date().toISOString(),

        // approvals
        managerApproval: ticketData.managerApproval
          ? ticketData.managerApproval
          : user.managerId
            ? {
                required: true,
                approved: false,
                reviewedBy: user.managerId,
                reviewedAt: null,
                comments: null,
              }
            : null,

        financeApproval: ticketData.financeApproval || {
          approved: false,
          reviewedBy: null,
          reviewedAt: null,
          comments: null,
        },

        status: ticketData.status || "pending",
        //ENUM: 'pending', 'manager_approved', 'approved', 'rejected'
      };

      const request = store.add(ticket);

      request.onsuccess = () => {
        console.log("Ticket created:", ticket.id);

        // sending it to server
        auditFeedSocket.updateTicketStatus(ticket.id, ticket.status);

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
        if (ticket.orgId !== user.orgId) {
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
      const index = store.index("org_department");
      const request = index.getAll([user.orgId, user.department]);
      request.onsuccess = () => {
        const allTickets = request.result;
        const filteredTickets = allTickets.filter((ticket) => {
          return (
            ticket.submittedBy === user.userId ||
            (ticket.managerApproval &&
              ticket.managerApproval.reviewedBy === user.userId)
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
