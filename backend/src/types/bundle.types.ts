import { Document, Types } from "mongoose";
import { BundleStatus } from "../config/constants.js";
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
  /** Ticket IDs included in this bundle */
  ticketIds: Types.ObjectId[];
  /** Pre-computed sum in org base currency, updated when bundle is submitted */
  totalAmountBase: number | null;
  tags: string[];
  managerApproval: IApproval | null;
  financeApproval: IApproval | null;
  createdAt: Date;
  updatedAt: Date;

  toData(): Promise<IBundleData>;
}

export interface IBundleData {
  _id: string;
  orgId: string;
  title: string;
  description: string;
  submittedBy: IUserMinimalData;
  submittedByDepartment: IDepartmentData | null;
  status: BundleStatus;
  ticketIds: string[];
  ticketCount: number;
  totalAmountBase: number | null;
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
