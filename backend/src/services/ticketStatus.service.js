// Ticket Status Service
// Manages in-memory ticket status updates

import { MAX_STATUS_UPDATES } from '../config/constants.js';

class TicketStatusService {
  constructor() {
    this.statusUpdates = [];
  }

  // Add a new status update
  addStatusUpdate(ticketId, status) {
    const update = {
      ticketId,
      status,
      timestamp: new Date().toISOString(),
    };

    this.statusUpdates.push(update);

    // Keep array size manageable
    if (this.statusUpdates.length > MAX_STATUS_UPDATES) {
      this.statusUpdates.shift();
    }

    return update;
  }

  // Find a status update for a specific ticket
  findUpdate(ticketId) {
    return this.statusUpdates.findIndex((u) => u.ticketId === ticketId);
  }

  // Get and remove a status update
  getAndRemoveUpdate(ticketId) {
    const index = this.findUpdate(ticketId);
    if (index !== -1) {
      const update = this.statusUpdates[index];
      this.statusUpdates.splice(index, 1);
      return update;
    }
    return null;
  }

  // Get all status updates
  getAllUpdates() {
    return this.statusUpdates;
  }
}

// Export singleton instance
export const ticketStatusService = new TicketStatusService();
