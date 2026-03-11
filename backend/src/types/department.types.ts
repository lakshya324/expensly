import { Document, Types } from "mongoose";
import { BudgetResetPeriod, PermissionKey } from "../config/constants.js";

export type IDepartmentPermissions = { [K in PermissionKey]: boolean };

export interface IDepartment extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  name: string;
  budget: number;
  spent: number;
  /** Per-currency approval threshold map. Key = ISO currency code, value = amount. */
  approvalThresholds: Map<string, number>;
  permissions: IDepartmentPermissions;
  policyId: Types.ObjectId | null;
  /** Tag pool — union of all tags used by this dept's tickets */
  tags: string[];
  budgetResetPeriod: BudgetResetPeriod;
  nextResetDate: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  toData(): IDepartmentData;
}

export interface IDepartmentData {
  _id: string;
  orgId: string;
  name: string;
  budget: number;
  spent: number;
  approvalThresholds: Record<string, number>;
  permissions: IDepartmentPermissions;
  policyId: string | null;
  tags: string[];
  budgetResetPeriod: BudgetResetPeriod;
  nextResetDate: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
