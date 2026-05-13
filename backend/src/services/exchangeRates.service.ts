/**
 * Exchange Rates Service
 *
 * Handles per-org exchange rate snapshots.
 * - Admin can manually set rates or fetch latest from external API.
 * - Approved tickets lock in the snapshot ID so historical rates are preserved.
 */
import mongoose, { Types } from "mongoose";
import { ExchangeRateSnapshot } from "../models/ExchangeRateSnapshot.model.js";
import { Organization } from "../models/Organization.model.js";
import { CURRENCIES, DEFAULT_BASE_CURRENCY, Currency } from "../config/constants.js";
import {
  IExchangeRateSnapshot,
  IExchangeRateSnapshotData,
} from "../types/exchangeRate.types.js";
import { createError } from "../utils/error.js";
import { logError, logInfo } from "../utils/logger.js";
import { getJSON, setJSON, del } from "./cache.service.js";
import { IOrganization } from "../types/organization.types.js";
import { IUser } from "../types/user.types.js";

// Cache TTL for external rate responses (1 hour)
const RATE_CACHE_TTL = 3600;
const RATE_CACHE_PREFIX = "cache:rates:";

// ---------------------------------------------------------------------------
// External rate fetch (open.er-api.com — free, no key required for base rates)
// ---------------------------------------------------------------------------
const EXTERNAL_RATE_API = "https://open.er-api.com/v6/latest";

export async function fetchExternalRates(
  baseCurrency: Currency = DEFAULT_BASE_CURRENCY,
): Promise<Record<string, number>> {
  const cacheKey = `${RATE_CACHE_PREFIX}${baseCurrency}`;

  // Check cache first
  const cached = await getJSON<Record<string, number>>(cacheKey);
  if (cached) return cached;

  const url = `${EXTERNAL_RATE_API}/${baseCurrency}`;
  try {
    const res = await fetch(url);
    if (!res.ok)
      throw new Error(`External rate API responded ${res.status}`);
    const json = (await res.json()) as { rates?: Record<string, number>; result?: string };

    if (json.result !== "success" || !json.rates) {
      throw new Error("External rate API returned unexpected payload");
    }

    // Filter to only currencies we support
    const filtered: Record<string, number> = {};
    for (const c of CURRENCIES) {
      if (json.rates[c] != null) filtered[c] = json.rates[c];
    }

    // Cache the filtered result
    await setJSON(cacheKey, filtered, RATE_CACHE_TTL);

    return filtered;
  } catch (err) {
    logError(err as Error, {
      message: "Failed to fetch external exchange rates",
      code: "EXCHANGE_RATE_FETCH_ERROR",
    });
    throw createError("Failed to fetch external exchange rates. Try again or set rates manually.", 502, "EXCHANGE_RATE_FETCH_ERROR");
  }
}

// ---------------------------------------------------------------------------
// Get the current org snapshot
// ---------------------------------------------------------------------------
export async function getOrgRates(
  org: IOrganization,
): Promise<IExchangeRateSnapshotData | null> {
  // const org = await Organization.findById(orgId);
  // if (!org) return null;

  if (!org.currentRateSnapshotId) return null;

  const snapshot = await ExchangeRateSnapshot.findById(org.currentRateSnapshotId);
  return snapshot ? snapshot.toData() : null;
}

// ---------------------------------------------------------------------------
// Save a new snapshot and update org pointer
// ---------------------------------------------------------------------------
export async function setOrgRates(
  org: IOrganization,
  user: IUser,
  rates: Record<string, number>,
  source: "manual" | "fetched" = "manual",
): Promise<IExchangeRateSnapshotData> {
  // Wrap snapshot create + org pointer update in a transaction...
  const session = await mongoose.startSession();
  session.startTransaction();
  let snapshot: IExchangeRateSnapshot;
  try {
    [snapshot] = await ExchangeRateSnapshot.create(
      [
        {
          orgId: org._id,
          rates: new Map(Object.entries(rates)),
          baseCurrency: org.baseCurrency,
          source,
          creator: { _id: user._id, name: user.name },
        },
      ],
      { session },
    );
    await Organization.updateOne(
      { _id: org._id },
      { $set: { currentRateSnapshotId: snapshot._id } },
      { session },
    );
    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }

  logInfo(`Exchange rates updated for org ${org._id} (source: ${source})`);
  return snapshot.toData();
}

// ---------------------------------------------------------------------------
// Fetch latest from external API and save for org
// ---------------------------------------------------------------------------
export async function fetchAndSaveOrgRates(
  org: IOrganization,
  user: IUser,
): Promise<IExchangeRateSnapshotData> {
  // const org = await Organization.findById(orgId);
  // if (!org) throw createError("Organization not found", 404, "ORG_NOT_FOUND");

  const rates = await fetchExternalRates(org.baseCurrency);
  return setOrgRates(org, user, rates, "fetched");
}

// ---------------------------------------------------------------------------
// Rate snapshot history for an org
// ---------------------------------------------------------------------------
export async function getRateHistory(
  orgId: Types.ObjectId | string,
  limit = 20,
  page = 1,
): Promise<{ data: IExchangeRateSnapshotData[]; total: number }> {
  const skip = (page - 1) * limit;
  const [snapshots, total] = await Promise.all([
    ExchangeRateSnapshot.find({ orgId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    ExchangeRateSnapshot.countDocuments({ orgId }),
  ]);
  return { data: snapshots.map((s) => s.toData()), total };
}

// ---------------------------------------------------------------------------
// Convert amount between currencies using a snapshot
// ---------------------------------------------------------------------------
export function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number>,
): number {
  if (fromCurrency === toCurrency) return amount;

  const fromRate = rates[fromCurrency] ?? null;
  const toRate = rates[toCurrency] ?? null;

  if (fromRate == null || toRate == null)
    throw createError(
      `Cannot convert: missing rate for ${fromRate == null ? fromCurrency : toCurrency}`,
      400,
      "RATE_NOT_FOUND",
    );

  // Rates are relative to baseCurrency (base = 1 unit = 1 unit of baseCurrency)
  // amount in base = amount / fromRate, then * toRate
  const amountInBase = amount / fromRate;
  return parseFloat((amountInBase * toRate).toFixed(4));
}
