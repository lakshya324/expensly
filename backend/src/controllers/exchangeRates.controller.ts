import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/types.js";
import {
  getOrgRates,
  setOrgRates,
  fetchAndSaveOrgRates,
  fetchExternalRates,
  getRateHistory,
} from "../services/exchangeRates.service.js";
import { Organization } from "../models/Organization.model.js";
import { createError } from "../utils/error.js";
import {
  ResponsePayload,
  ResponsePaginationPayload,
} from "../types/payloads.types.js";
import { IExchangeRateSnapshotData } from "../types/exchangeRate.types.js";
import { emitRatesUpdate } from "../websocket/handlers/analytics.handler.js";
import {
  Currency,
  CURRENCIES,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from "../config/constants.js";

export default class ExchangeRatesController {
  /** GET /api/admin/exchange-rates — current snapshot */
  static async getCurrent(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const snapshot = await getOrgRates(org);

      const payload: ResponsePayload<IExchangeRateSnapshotData | null> = {
        success: true,
        message: snapshot
          ? "Exchange rates retrieved"
          : "No exchange rates set yet",
        timestamp: new Date().toISOString(),
        data: snapshot,
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /** PATCH /api/admin/exchange-rates — manually set rates */
  static async setRates(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const user = req.user!;
      const { rates } = req.body as {
        rates: Record<string, number>;
      };

      if (
        !rates ||
        typeof rates !== "object" ||
        Object.keys(rates).length === 0
      )
        throw createError("rates object is required", 400, "VALIDATION_ERROR");

      const invalidCurrencies = Object.keys(rates).filter(
        (c) => !(CURRENCIES as readonly string[]).includes(c),
      );
      if (invalidCurrencies.length > 0)
        throw createError(
          `Invalid currencies: ${invalidCurrencies.join(", ")}`,
          400,
          "INVALID_CURRENCY",
        );

      const snapshot = await setOrgRates(org, user, rates);

      emitRatesUpdate(
        org._id.toString(),
        snapshot._id,
        snapshot.rates,
        snapshot.baseCurrency,
        user._id.toString(),
      );

      const payload: ResponsePayload<IExchangeRateSnapshotData> = {
        success: true,
        message: "Exchange rates updated",
        timestamp: new Date().toISOString(),
        data: snapshot,
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /** POST /api/admin/exchange-rates/fetch-latest — pull from external API */
  static async fetchLatest(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const org = req.organization!;
      const user = req.user!;

      const snapshot = await fetchAndSaveOrgRates(org, user);

      emitRatesUpdate(
        org._id.toString(),
        snapshot._id,
        snapshot.rates,
        snapshot.baseCurrency,
        user._id.toString(),
      );

      const payload: ResponsePayload<IExchangeRateSnapshotData> = {
        success: true,
        message: "Latest exchange rates fetched and saved",
        timestamp: new Date().toISOString(),
        data: snapshot,
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/admin/exchange-rates/fetch-preview — preview external rates without saving */
  static async fetchPreview(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const org = req.organization!;
      const rates = await fetchExternalRates(org.baseCurrency);

      const payload: ResponsePayload<Record<string, number>> = {
        success: true,
        message: "External rates fetched (preview only — not saved)",
        timestamp: new Date().toISOString(),
        data: rates,
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/admin/exchange-rates/history — paginated snapshot history */
  static async getHistory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const { page: pageQ, limit: limitQ } = req.query as Record<
        string,
        string | undefined
      >;
      const page = Math.max(1, parseInt(pageQ ?? "") || DEFAULT_PAGE);
      const limit = Math.min(
        MAX_LIMIT,
        Math.max(1, parseInt(limitQ ?? "") || DEFAULT_LIMIT),
      );

      const { data, total } = await getRateHistory(org._id, limit, page);

      const payload: ResponsePaginationPayload<IExchangeRateSnapshotData> = {
        success: true,
        message: "Exchange rate history retrieved",
        timestamp: new Date().toISOString(),
        data: {
          data,
          pagination: {
            page,
            pageSize: data.length,
            totalItems: total,
            totalPages: Math.ceil(total / limit),
          },
        },
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /** PATCH /api/admin/exchange-rates/active-currencies */
  static async updateActiveCurrencies(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const org = req.organization!;
      const { activeCurrencies } = req.body as { activeCurrencies: Currency[] };

      if (!Array.isArray(activeCurrencies) || activeCurrencies.length === 0)
        throw createError(
          "activeCurrencies must be a non-empty array",
          400,
          "VALIDATION_ERROR",
        );

      const invalid = activeCurrencies.filter(
        (c) => !(CURRENCIES as readonly string[]).includes(c),
      );
      if (invalid.length > 0)
        throw createError(
          `Invalid currencies: ${invalid.join(", ")}`,
          400,
          "INVALID_CURRENCY",
        );

      const updatedOrg = await Organization.findByIdAndUpdate(
        org._id,
        { $set: { activeCurrencies } },
        { returnDocument: "after" },
      );

      const payload: ResponsePayload<string[]> = {
        success: true,
        message: "Active currencies updated",
        timestamp: new Date().toISOString(),
        data: updatedOrg!.activeCurrencies,
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }
}
