import mongoose, { Schema } from "mongoose";
import { ROLES } from "../config/constants.js";
import { IUser, IUserData, IUserPermissions } from "../types/user.types.js";
import { createError } from "../utils/error.js";
import { Organization } from "./Organization.model.js";
import { Department } from "./Department.model.js";
import { IOrganization } from "../types/organization.types.js";

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
    department: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      default: null,
    },
    managerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    permissions: {
      canViewAllTickets: { type: Boolean, default: null },
      canApprove: { type: Boolean, default: null },
    },
    isDisabled: { type: Boolean, default: false },
  },
  { timestamps: true },
);

UserSchema.index({ orgId: 1 });
UserSchema.index({ orgId: 1, department: 1 });
UserSchema.index({ managerId: 1 });
UserSchema.index({ orgId: 1, role: 1, isDisabled: 1 }); // admin notify + role-filtered listUsers
UserSchema.index({ orgId: 1, createdAt: -1 }); // listUsers / listAllUsers sort

UserSchema.pre("save", async function () {
  if (this.role !== ROLES.SUPER_ADMIN && !this.orgId)
    createError(
      "orgId is required for non-super_admin users",
      400,
      "VALIDATION_ERROR",
    );
});

UserSchema.methods.data = async function (
  this: IUser,
  org: IOrganization | null = null,
): Promise<IUserData> {
  // if (this.isDisabled)
  //   createError(
  //     "User account is disabled. Please contact your administrator.",
  //     403,
  //     "USER_DISABLED",
  //   );

  let orgData = org;
  let managerData = null;

  if (this.orgId && !org) {
    orgData = await Organization.findById(this.orgId);
    // if (!orgData)
    //   createError("Organization not found for the user", 404, "ORG_NOT_FOUND");
  }

  if (this.managerId) {
    const manager = await User.findById(this.managerId).select(
      "_id name email role isDisabled createdAt updatedAt",
    );
    if (manager) {
      managerData = {
        _id: manager._id.toString(),
        name: manager.name,
        email: manager.email,
        role: manager.role,
        isDisabled: manager.isDisabled,
        createdAt: manager.createdAt.toISOString(),
        updatedAt: manager.updatedAt.toISOString(),
      };
    }
  }

  let departmentData = null;
  if (this.department) {
    const dept = await Department.findById(this.department);
    if (dept) departmentData = dept.toData();
  }

  return {
    _id: this._id.toString(),
    name: this.name,
    email: this.email,
    role: this.role,
    org: orgData ? orgData.data() : null,
    department: departmentData,
    permissions: {
      canViewAllTickets: this.permissions?.canViewAllTickets ?? null,
      canApprove: this.permissions?.canApprove ?? null,
    },
    manager: managerData,
    isDisabled: this.isDisabled,
    createdAt: this.createdAt.toISOString(),
    updatedAt: this.updatedAt.toISOString(),
  };
};

export const User = mongoose.model<IUser>("User", UserSchema);
