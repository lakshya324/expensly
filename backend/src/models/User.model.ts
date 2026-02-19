import mongoose, { Schema } from "mongoose";
import { ROLES } from "../config/constants.js";
import { IUser, IUserData } from "../types/user.types.js";
import { createError } from "../utils/error.js";
import { Organization } from "./Organization.model.js";
import { IDepartmentData, IOrganization } from "../types/organization.types.js";

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
    department: { type: Schema.Types.ObjectId, default: null },
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

export const User = mongoose.model<IUser>("User", UserSchema);

UserSchema.methods.data = async function (
  this: IUser,
  org: IOrganization | null = null,
): Promise<IUserData> {
  if (this.isDisabled)
    createError(
      "User account is disabled. Please contact your administrator.",
      403,
      "USER_DISABLED",
    );

  let orgData = org;
  let managerData = null;

  if (this.orgId && !org) {
    if (this.managerId) {
      const [org, manager] = await Promise.all([
        Organization.findById(this.orgId),
        User.findById(this.managerId),
      ]);

      if (!org)
        createError(
          "Organization not found for the user",
          404,
          "ORG_NOT_FOUND",
        );

      if (!manager)
        createError("Manager not found for the user", 404, "MANAGER_NOT_FOUND");

      orgData = org;
      managerData = {
        _id: manager._id.toString(),
        name: manager.name,
        email: manager.email,
        role: manager.role,
      };
    } else {
      orgData = await Organization.findById(this.orgId);
      if (!orgData)
        createError(
          "Organization not found for the user",
          404,
          "ORG_NOT_FOUND",
        );
    }
  }

  const departmentData =
    this.orgId && orgData
      ? orgData
          .departmentData()
          .find((dept: IDepartmentData) => dept._id.toString() === this.department?.toString())
      : null;

  return {
    _id: this._id.toString(),
    name: this.name,
    email: this.email,
    role: this.role,
    org: orgData ? orgData.data() : null,
    department: departmentData ? departmentData : null,
    manager: managerData,
  };
};
