import mongoose, { Schema, Document, Types } from 'mongoose';
import { ROLES, type Role } from '../config/constants.js';

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  orgId: Types.ObjectId | null;
  department: string | null;
  managerId: Types.ObjectId | null;
  isDisabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.USER,
    },
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
    },
    department: { type: String, trim: true, default: null },
    managerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isDisabled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

UserSchema.index({ orgId: 1 });
UserSchema.index({ orgId: 1, department: 1 });
UserSchema.index({ managerId: 1 });

UserSchema.pre('save', async function () {
  if (this.role !== ROLES.SUPER_ADMIN && !this.orgId) {
    throw new Error('orgId is required for non-super_admin users');
  }
});

export const User = mongoose.model<IUser>('User', UserSchema);
