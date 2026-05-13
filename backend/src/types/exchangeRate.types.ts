import { Document, Types } from "mongoose";
import { Currency } from "../config/constants.js";

// ---------------------------------------------------------------------------
// ExchangeRateSnapshot — one doc per manual/fetched update per org
// ---------------------------------------------------------------------------

export interface IExchangeRateSnapshot extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  /** Rates map: key = ISO currency (e.g. "USD"), value = rate relative to baseCurrency */
  rates: Map<string, number>;
  baseCurrency: Currency;
  /** Which currencies the org has activated */
  // activeCurrencies: Currency[];
  /** 'manual' = admin typed values, 'fetched' = pulled from external API */
  source: "manual" | "fetched";
  creator: { _id: Types.ObjectId; name: string };
  createdAt: Date;
  toData(): IExchangeRateSnapshotData;
}

export interface IExchangeRateSnapshotData {
  _id: string;
  orgId: string;
  rates: Record<string, number>;
  baseCurrency: string;
  // activeCurrencies: string[];
  source: "manual" | "fetched";
  creator: { _id: string; name: string };
  createdAt: Date;
}
