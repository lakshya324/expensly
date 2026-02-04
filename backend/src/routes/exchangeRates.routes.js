// Exchange Rates Routes (SSE)
import express from 'express';
import { ExchangeRatesController } from '../controllers/exchangeRates.controller.js';

const router = express.Router();

// GET /api/exchange-rates - Server-Sent Events for exchange rates
router.get('/exchange-rates', ExchangeRatesController.streamRates);

export default router;
