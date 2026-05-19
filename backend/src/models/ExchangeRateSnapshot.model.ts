import mongoose, { Schema } from "mongoose";
import { CURRENCIES } from "../config/constants.js";
import {
  IExchangeRateSnapshot,
  IExchangeRateSnapshotData,
} from "../types/exchangeRate.types.js";
import { EntitySnapshotSchema } from "./common.model.js";

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
    // activeCurrencies: {
    //   type: [String],
    //   default: [],
    // },
    source: {
      type: String,
      enum: ["manual", "fetched"],
      required: true,
    },
    creator: { type: EntitySnapshotSchema, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

ExchangeRateSnapshotSchema.index({ orgId: 1, createdAt: -1 });

ExchangeRateSnapshotSchema.methods.toData = function (
  this: IExchangeRateSnapshot,
): IExchangeRateSnapshotData {
  return {
    _id: this._id.toString(),
    orgId: this.orgId.toString(),
    rates: Object.fromEntries(this.rates),
    baseCurrency: this.baseCurrency,
    // activeCurrencies: this.activeCurrencies,
    source: this.source,
    creator: { _id: this.creator._id.toString(), name: this.creator.name },
    createdAt: this.createdAt,
  };
};

export const ExchangeRateSnapshot = mongoose.model<IExchangeRateSnapshot>(
  "ExchangeRateSnapshot",
  ExchangeRateSnapshotSchema,
);
