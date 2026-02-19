// Exchange Rates Routes (SSE)
import express from 'express';
import { ExchangeRatesController } from '../controllers/exchangeRates.controller.js';

const router = express.Router();

router.get('/', ExchangeRatesController.streamRates);

export default router;
