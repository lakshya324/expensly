import { Document, Types } from "mongoose";
import { Currency } from "../config/constants.js";

export interface IOrganization extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  isDisabled: boolean;
  baseCurrency: Currency;
  activeCurrencies: Currency[];
  currentRateSnapshotId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;

  //! Methods
  data(this: IOrganization): IOrganizationData;
}

export interface IOrganizationData {
  _id: string;
  name: string;
  slug: string;
  isDisabled: boolean;
  baseCurrency: string;
  activeCurrencies: string[];
  currentRateSnapshotId: string | null;
  createdAt: string;
  updatedAt: string;
}
