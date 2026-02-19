// Exchange Rates Controller (SSE)
import { Request, Response } from 'express';
import { ExchangeRatesService } from '../services/exchangeRates.service.js';

export class ExchangeRatesController {
  static streamRates(req: Request, res: Response): void {
    console.log('[SSE] Exchange rates connection established');

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Send current rates immediately on connect
    const current = ExchangeRatesService.getCurrentRates();
    res.write(`data: ${JSON.stringify(current)}\n\n`);

    // Subscribe to the shared interval emitter
    const unsubscribe = ExchangeRatesService.subscribe((rates) => {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify(rates)}\n\n`);
      }
    });

    req.on('close', () => {
      unsubscribe();
      console.log('[SSE] Exchange rates connection closed');
    });
  }
}
