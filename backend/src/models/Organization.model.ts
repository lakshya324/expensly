import mongoose, { Schema } from "mongoose";
import { CURRENCIES } from "../config/constants.js";
import {
  IDepartment,
  IDepartmentData,
  IOrganization,
  IOrganizationData,
} from "../types/organization.types.js";

const DepartmentSchema = new Schema<IDepartment>({
  name: { type: String, required: true, trim: true },
  budget: { type: Number, default: 0, min: 0 },
  spent: { type: Number, default: 0, min: 0 },
  currency: { type: String, enum: CURRENCIES, default: CURRENCIES[0] },
});

const OrganizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, lowercase: true, trim: true },
    isDisabled: { type: Boolean, default: false },
    totalBudget: { type: Number, default: 0, min: 0 },
    departments: [DepartmentSchema],
  },
  { timestamps: true },
);

// OrganizationSchema.pre('save', async function () {
//   if (this.isModified('name') || this.isNew) {
//     this.slug = this.name
//       .toLowerCase()
//       .replace(/[^a-z0-9\s-]/g, '')
//       .replace(/\s+/g, '-')
//       .replace(/-+/g, '-')
//       .trim();
//   }
// });

OrganizationSchema.methods.data = function (
  this: IOrganization,
): IOrganizationData {
  return {
    _id: this._id.toString(),
    name: this.name,
    slug: this.slug,
    isDisabled: this.isDisabled,
    totalBudget: this.totalBudget,
  };
};

OrganizationSchema.methods.departmentData = function (
  this: IOrganization,
): IDepartmentData[] {
  return this.departments.map((dept) => ({
    _id: dept._id.toString(),
    name: dept.name,
    budget: dept.budget,
    spent: dept.spent,
    currency: dept.currency,
  }));
};

export const Organization = mongoose.model<IOrganization>(
  "Organization",
  OrganizationSchema,
);
