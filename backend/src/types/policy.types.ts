import { Types } from "mongoose";

export interface IPolicy {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  name: string;
  isActive: boolean;
  /** Open-ended rule definitions — shape TBD when Custom Policies feature ships */
  rules: Record<string, unknown>[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPolicyData {
  id: string;
  orgId: string;
  name: string;
  isActive: boolean;
  rules: Record<string, unknown>[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
