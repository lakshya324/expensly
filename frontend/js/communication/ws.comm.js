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
