import { Document, Types } from "mongoose";
import { Currency, TicketStatus } from "../config/constants.js";
import { IUserData, IUserMinimalData } from "./user.types.js";
import { IDepartmentData, IOrganization } from "./organization.types.js";

export interface IApproval {
  required?: boolean;
  approved: boolean | null;
  reviewedBy: Types.ObjectId | null;
  reviewedAt: Date | null;
  comments: string | null;
}

export interface ITicket extends Document {
  _id: Types.ObjectId;
  title: string;
  submittedBy: Types.ObjectId;
  orgId: Types.ObjectId;
  amount: number;
  currency: Currency;
  department: Types.ObjectId;
  description: string;
  tags: string[];
  receiptKey: string | null;
  status: TicketStatus;
  flagged: boolean;
  managerApproval: IApproval | null;
  financeApproval: IApproval | null;
  createdAt: Date;
  updatedAt: Date;

  //! Methods
  data: (this: ITicket, org: IOrganization) => Promise<ITicketData>;
}

export interface IApprovalData {
  required?: boolean;
  approved: boolean | null;
  reviewedBy: IUserMinimalData | null;
  reviewedAt: Date | null;
  comments: string | null;
}

export interface ITicketData {
  _id: string;
  title: string;
  submittedBy: IUserMinimalData;
  orgId: string;
  amount: number;
  currency: Currency;
  department: IDepartmentData;
  description: string;
  tags: string[];
  receiptKey: string | null;
  status: TicketStatus;
  flagged: boolean;
  managerApproval: IApprovalData | null;
  financeApproval: IApprovalData | null;
  createdAt: Date;
}
