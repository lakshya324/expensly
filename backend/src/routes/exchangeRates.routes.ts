import { Router } from "express";
import ExchangeRatesController from "../controllers/exchangeRates.controller.js";

const router = Router();

//! Exchange Rate Routes [ALL Methods /api/admin/exchange-rates]

//* Get Current Rates Snapshot [GET /api/admin/exchange-rates]
router.get("/", ExchangeRatesController.getCurrent);

//* Manually Set Rates [PATCH /api/admin/exchange-rates]
router.patch("/", ExchangeRatesController.setRates);

//* Fetch Latest from External API [POST /api/admin/exchange-rates/fetch-latest]
router.post("/fetch-latest", ExchangeRatesController.fetchLatest);

//* Preview External Rates Without Saving [GET /api/admin/exchange-rates/fetch-preview]
router.get("/fetch-preview", ExchangeRatesController.fetchPreview);

//* Rate History [GET /api/admin/exchange-rates/history]
router.get("/history", ExchangeRatesController.getHistory);

//* Update Active Currencies [PATCH /api/admin/exchange-rates/active-currencies]
router.patch("/active-currencies", ExchangeRatesController.updateActiveCurrencies);

export default router;
