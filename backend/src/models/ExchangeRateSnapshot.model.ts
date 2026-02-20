import mongoose, { Schema } from "mongoose";
import { CURRENCIES } from "../config/constants.js";
import {
  IExchangeRateSnapshot,
  IExchangeRateSnapshotData,
} from "../types/exchangeRate.types.js";

const ExchangeRateSnapshotSchema = new Schema<IExchangeRateSnapshot>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    rates: {
      type: Map,
      of: Number,
      required: true,
    },
    baseCurrency: {
      type: String,
      enum: CURRENCIES,
      required: true,
    },
    activeCurrencies: {
      type: [String],
      default: [],
    },
    source: {
      type: String,
      enum: ["manual", "fetched"],
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

ExchangeRateSnapshotSchema.index({ orgId: 1, createdAt: -1 });

ExchangeRateSnapshotSchema.methods.toData =
  function (this: IExchangeRateSnapshot): IExchangeRateSnapshotData {
    return {
      _id: this._id.toString(),
      orgId: this.orgId.toString(),
      rates: Object.fromEntries(this.rates),
      baseCurrency: this.baseCurrency,
      activeCurrencies: this.activeCurrencies,
      source: this.source,
      createdBy: this.createdBy.toString(),
      createdAt: this.createdAt,
    };
  };

export const ExchangeRateSnapshot = mongoose.model<IExchangeRateSnapshot>(
  "ExchangeRateSnapshot",
  ExchangeRateSnapshotSchema,
);
