import mongoose, { Schema, Document, Types } from 'mongoose';
import { CURRENCIES, type Currency } from '../config/constants.js';

export interface IDepartment {
  _id: Types.ObjectId;
  name: string;
  budget: number;
  spent: number;
  currency: Currency;
}

export interface IOrganization extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  isDisabled: boolean;
  totalBudget: number;
  departments: Types.DocumentArray<IDepartment>;
  createdAt: Date;
  updatedAt: Date;
}

const DepartmentSchema = new Schema<IDepartment>({
  name: { type: String, required: true, trim: true },
  budget: { type: Number, default: 0, min: 0 },
  spent: { type: Number, default: 0, min: 0 },
  currency: { type: String, enum: CURRENCIES, default: 'USD' },
});

const OrganizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, lowercase: true, trim: true },
    isDisabled: { type: Boolean, default: false },
    totalBudget: { type: Number, default: 0, min: 0 },
    departments: [DepartmentSchema],
  },
  { timestamps: true }
);

OrganizationSchema.pre('save', async function () {
  if (this.isModified('name') || this.isNew) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }
});

export const Organization = mongoose.model<IOrganization>('Organization', OrganizationSchema);
