import { WS_BASE, WS_CONFIG } from "../config/env.config.js";

export class AuditFeedSocket {
  constructor(url = WS_BASE) {
    this.url = url;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.heartbeatInterval = null;
    this.onMessageCallback = null;
    this.onStatusChangeCallback = null;
    this.onTicketStatusChangeCallback = null;
    this.onTicketUpdateCallback = null;
    this.onTicketDeleteCallback = null;
    this.onTicketFlagCallback = null;
    this.onNewTicketCallback = null;
    this.onUserUpdateCallback = null;
    this.onUserDeleteCallback = null;
    this.isConnected = false;
  }

  connect() {
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log("WebSocket connected");
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.updateStatus("connected");
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "pong") {
            console.log("<- Heartbeat pong received");
            return;
          }

          // Handle ticket status change messages
          if (data.type === "ticket_status_change") {
            console.log(`Ticket ${data.ticketId} status changed to ${data.status}`);
            if (this.onTicketStatusChangeCallback) {
              this.onTicketStatusChangeCallback(data);
            }
            return;
          }

          // Handle ticket update messages
          if (data.type === "ticket_update") {
            console.log(`Ticket ${data.ticketId} updated`);
            if (this.onTicketUpdateCallback) {
              this.onTicketUpdateCallback(data);
            }
            return;
          }

          // Handle ticket delete messages
          if (data.type === "ticket_delete") {
            console.log(`Ticket ${data.ticketId} deleted`);
            if (this.onTicketDeleteCallback) {
              this.onTicketDeleteCallback(data);
            }
            return;
          }

          // Handle ticket flag messages
          if (data.type === "ticket_flag") {
            console.log(`Ticket ${data.ticketId} flag: ${data.flagged}`);
            if (this.onTicketFlagCallback) {
              this.onTicketFlagCallback(data);
            }
            return;
          }

          // Handle new ticket messages
          if (data.type === "new_ticket") {
            console.log(`New ticket created: ${data.ticketId}`);
            if (this.onNewTicketCallback) {
              this.onNewTicketCallback(data);
            }
            return;
          }

          // Handle user update messages
          if (data.type === "user_update") {
            console.log(`User ${data.userId} updated`);
            if (this.onUserUpdateCallback) {
              this.onUserUpdateCallback(data);
            }
            return;
          }

          // Handle user delete messages
          if (data.type === "user_delete") {
            console.log(`User ${data.userId} deleted`);
            if (this.onUserDeleteCallback) {
              this.onUserDeleteCallback(data);
            }
            return;
          }

          // Pass message to callback
          if (this.onMessageCallback) {
            this.onMessageCallback(data);
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        this.isConnected = false;
        this.updateStatus("error");
      };

      this.ws.onclose = () => {
        console.log("WebSocket disconnected");
        this.isConnected = false;
        this.updateStatus("disconnected");
        this.stopHeartbeat();
        this.attemptReconnect();
      };
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
      this.updateStatus("error");
    }
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
        console.log("-> Heartbeat ping sent");
      }
    }, WS_CONFIG.heartbeatInterval);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts < WS_CONFIG.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay =
        WS_CONFIG.reconnectDelay * Math.pow(WS_CONFIG.backoffFactor, this.reconnectAttempts - 1);
      // delay increases exponentially

      console.log(`Reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
      this.updateStatus("reconnecting");

      setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      console.error("Max reconnection attempts reached");
      this.updateStatus("failed");
    }
  }

  updateStatus(status) {
    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback("ws", status);
    }
  }

  // Set message callback
  // TODO: Use in future to handle different message types
  onMessage(callback) {
    this.onMessageCallback = callback;
  }

  // Set status change callback
  //TODO: use in LEDs for shwoing status
  onStatusChange(callback) {
    this.onStatusChangeCallback = callback;
  }

  // Set ticket status change callback
  onTicketStatusChange(callback) {
    this.onTicketStatusChangeCallback = callback;
  }

  // Set ticket update callback
  onTicketUpdate(callback) {
    this.onTicketUpdateCallback = callback;
  }

  // Set ticket delete callback
  onTicketDelete(callback) {
    this.onTicketDeleteCallback = callback;
  }

  // Set ticket flag callback
  onTicketFlag(callback) {
    this.onTicketFlagCallback = callback;
  }

  // Set new ticket callback
  onNewTicket(callback) {
    this.onNewTicketCallback = callback;
  }

  // Set user update callback
  onUserUpdate(callback) {
    this.onUserUpdateCallback = callback;
  }

  // Set user delete callback
  onUserDelete(callback) {
    this.onUserDeleteCallback = callback;
  }

  // Send ticket status update
  updateTicketStatus(ticketId, status) {
    if (!ticketId || !status) {
      console.error(`Cannot update ticket status: ticketId="${ticketId}", status="${status}"`);
      console.error('Usage: updateTicketStatus(ticketId, status)');
      console.error('Example: updateTicketStatus("T123", "approved")');
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        type: "update_ticket_status",
        ticketId,
        status,
        timestamp: new Date().toISOString()
      });
      console.log(`Sent ticket status update: ${ticketId} -> ${status}`);
    } else {
      console.warn("Cannot send ticket update: WebSocket not connected");
    }
  }

  // Send ticket data update (edit)
  sendTicketUpdate(ticketId, updatedData) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        type: "ticket_update",
        ticketId,
        updatedData,
        timestamp: new Date().toISOString()
      });
      console.log(`Sent ticket update: ${ticketId}`);
    } else {
      console.warn("Cannot send ticket update: WebSocket not connected");
    }
  }

  // Send ticket delete
  sendTicketDelete(ticketId) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        type: "ticket_delete",
        ticketId,
        timestamp: new Date().toISOString()
      });
      console.log(`Sent ticket delete: ${ticketId}`);
    } else {
      console.warn("Cannot send ticket delete: WebSocket not connected");
    }
  }

  // Send ticket flag toggle
  sendTicketFlag(ticketId, flagged) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        type: "ticket_flag",
        ticketId,
        flagged,
        timestamp: new Date().toISOString()
      });
      console.log(`Sent ticket flag: ${ticketId} -> ${flagged}`);
    } else {
      console.warn("Cannot send ticket flag: WebSocket not connected");
    }
  }

  // Send new ticket notification
  sendNewTicket(ticketId, ticketData) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        type: "new_ticket",
        ticketId,
        ticketData,
        timestamp: new Date().toISOString()
      });
      console.log(`Sent new ticket: ${ticketId}`);
    } else {
      console.warn("Cannot send new ticket: WebSocket not connected");
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn("WebSocket not connected");
    }
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
