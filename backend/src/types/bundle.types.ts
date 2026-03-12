import { Document, Types } from "mongoose";
import { BundleStatus, Currency } from "../config/constants.js";
import { IApproval } from "./ticket.types.js";
import { IUserMinimalData } from "./user.types.js";
import { IDepartmentData } from "./department.types.js";

export interface IBundle extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  title: string;
  description: string;
  submittedBy: Types.ObjectId;
  status: BundleStatus;
  /** Pre-computed sum in org base currency, recalculated on add/remove and submit */
  totalAmountBase: number | null;
  /** ISO currency code for totalAmountBase */
  baseCurrency: Currency | null;
  /** Denormalized count of tickets — kept in sync */
  ticketCount: number;
  tags: string[];
  managerApproval: IApproval | null;
  financeApproval: IApproval | null;
  createdAt: Date;
  updatedAt: Date;

  toData(): Promise<IBundleData>;
  toSummaryData(): IBundleSummaryData;
}

export interface IBundleData {
  _id: string;
  orgId: string;
  title: string;
  description: string;
  submittedBy: IUserMinimalData;
  submittedByDepartment: IDepartmentData | null;
  status: BundleStatus;
  ticketCount: number;
  totalAmountBase: number | null;
  baseCurrency: string | null;
  tags: string[];
  managerApproval: {
    required?: boolean;
    approved: boolean | null;
    reviewedBy: IUserMinimalData | null;
    reviewedAt: Date | null;
    comments: string | null;
  } | null;
  financeApproval: {
    required?: boolean;
    approved: boolean | null;
    reviewedBy: IUserMinimalData | null;
    reviewedAt: Date | null;
    comments: string | null;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBundleSummaryData {
  _id: string;
  title: string;
  description: string;
}