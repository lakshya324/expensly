import mongoose, { Schema } from "mongoose";
import {
  BUDGET_RESET_PERIODS,
  CURRENCIES,
} from "../config/constants.js";
import { IDepartment, IDepartmentData } from "../types/department.types.js";

const DepartmentSchema = new Schema<IDepartment>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    budget: { type: Number, default: 0, min: 0 },
    spent: { type: Number, default: 0, min: 0 },
    approvalThresholds: {
      type: Map,
      of: Number,
      default: {},
    },
    permissions: {
      view_all_tickets: { type: Boolean, default: false },
      approve_finance: { type: Boolean, default: false },
      export_reports: { type: Boolean, default: false },
      view_analytics: { type: Boolean, default: false },
    },
    policyId: {
      type: Schema.Types.ObjectId,
      ref: "Policy",
      default: null,
    },
    /**
     * @deprecated Free-form department tags — replaced by Merchant & Category models.
     * Kept for backward-compat; do not add new logic that writes to this field.
     */
    tags: { type: [String], default: [] },
    budgetResetPeriod: {
      type: String,
      enum: Object.values(BUDGET_RESET_PERIODS),
      default: BUDGET_RESET_PERIODS.NONE,
    },
    nextResetDate: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

DepartmentSchema.index({ orgId: 1 });
DepartmentSchema.index({ orgId: 1, name: 1 }, { unique: true });
DepartmentSchema.index({ orgId: 1, isActive: 1 });
DepartmentSchema.index({ nextResetDate: 1, isActive: 1 }); // hourly budget-reset cron: {nextResetDate <= now, isActive: true}

DepartmentSchema.methods.toData = function (this: IDepartment): IDepartmentData {
  return {
    _id: this._id.toString(),
    orgId: this.orgId.toString(),
    name: this.name,
    budget: this.budget,
    spent: this.spent,
    approvalThresholds: Object.fromEntries(this.approvalThresholds),
    permissions: this.permissions,
    policyId: this.policyId?.toString() ?? null,
    tags: this.tags,
    budgetResetPeriod: this.budgetResetPeriod,
    nextResetDate: this.nextResetDate,
    isActive: this.isActive,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export const Department = mongoose.model<IDepartment>(
  "Department",
  DepartmentSchema,
);
