// Exchange Rates Controller (SSE)
import { ExchangeRatesService } from '../services/exchangeRates.service.js';
import { SSE_UPDATE_INTERVAL } from '../config/constants.js';

export class ExchangeRatesController {
  static streamRates(req, res) {
    console.log("SSE connection established for exchange rates");

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const sendRates = () => {
      const rates = ExchangeRatesService.generateRates();
      res.write(`data: ${JSON.stringify(rates)}\n\n`);
    };

    sendRates();
    const interval = setInterval(sendRates, SSE_UPDATE_INTERVAL);

    req.on("close", () => {
      clearInterval(interval);
      console.log("SSE connection closed");
    });
  }
}
