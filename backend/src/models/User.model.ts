import mongoose, { Schema } from "mongoose";
import { ROLES } from "../config/constants.js";
import { IUser, IUserOutput } from "../types/user.types.js";
import { createError } from "../utils/error.js";

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.USER,
    },
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },
    department: { type: String, trim: true, default: null },
    managerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    isDisabled: { type: Boolean, default: false },
  },
  { timestamps: true },
);

UserSchema.index({ orgId: 1 });
UserSchema.index({ orgId: 1, department: 1 });
UserSchema.index({ managerId: 1 });

UserSchema.pre("save", async function () {
  if (this.role !== ROLES.SUPER_ADMIN && !this.orgId)
    createError(
      "orgId is required for non-super_admin users",
      400,
      "VALIDATION_ERROR",
    );
});

UserSchema.methods.data = function (): IUserOutput {
  if (this.isDisabled)
    createError(
      "User account is disabled. Please contact your administrator.",
      403,
      "USER_DISABLED",
    );

  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    role: this.role,
    orgId: this.orgId ? this.orgId.toString() : null,
    department: this.department,
    managerId: this.managerId ? this.managerId.toString() : null,
  };
};

export const User = mongoose.model<IUser>("User", UserSchema);
