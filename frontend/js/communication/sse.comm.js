import { API_BASE } from "../config/env.config.js";
import { CURRENCY } from "../utils/currency.js";

export class ExchangeRateStream {
  constructor(url = API_BASE + "/exchange-rates") {
    this.url = url;
    this.eventSource = null;
    this.onRatesUpdateCallback = null;
    this.onStatusChangeCallback = null;
    this.isConnected = false;
    this.currentRates = {
      USD: 1,
      EUR: 0.85,
      GBP: 0.75,
      INR: 74,
      JPY: 110,
      CAD: 1.25,
    };
  }

  connect() {
    try {
      this.eventSource = new EventSource(this.url);

      this.eventSource.onopen = () => {
        console.log("SSE connected");
        this.isConnected = true;
        this.updateStatus("connected");
      };

      this.eventSource.onmessage = (event) => {
        try {
          const rates = JSON.parse(event.data);
          this.currentRates = rates;

          console.log("Exchange rates updated:", rates);

          if (this.onRatesUpdateCallback) {
            this.onRatesUpdateCallback(rates);
          }
        } catch (error) {
          console.error("Error parsing SSE data:", error);
        }
      };

      this.eventSource.onerror = (error) => {
        console.error("SSE error:", error);
        this.isConnected = false;
        this.updateStatus("error");

        // we only track status as sse auto-reconnect
        setTimeout(() => {
          if (
            this.eventSource &&
            this.eventSource.readyState === EventSource.CONNECTING
          ) {
            this.updateStatus("reconnecting");
          }
        }, 1000);
      };
    } catch (error) {
      console.error("Failed to create SSE:", error);
      this.updateStatus("error");
    }
  }

  updateStatus(status) {
    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback("sse", status);
    }
  }

  onRatesUpdate(callback) {
    this.onRatesUpdateCallback = callback;
  }

  onStatusChange(callback) {
    this.onStatusChangeCallback = callback;
  }

  convert(amount, fromCurrency, toCurrency) {
    if (!CURRENCY.includes(fromCurrency)) {
      throw new Error("Unsupported fromCurrency: " + fromCurrency);
    }
    if (!CURRENCY.includes(toCurrency)) {
      throw new Error("Unsupported toCurrency: " + toCurrency);
    }
    if (!this.currentRates[fromCurrency] || !this.currentRates[toCurrency]) {
      throw new Error("Exchange rate for given currency not available");
    }

    const rate =
      this.currentRates[toCurrency] / this.currentRates[fromCurrency];
    return amount * rate;
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.isConnected = false;
      this.updateStatus("disconnected");
    }
  }
}
