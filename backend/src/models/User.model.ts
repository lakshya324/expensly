import mongoose, { Schema } from "mongoose";
import { ROLES } from "../config/constants.js";
import { IUser, IUserData, IUserPermissions } from "../types/user.types.js";
import { createError } from "../utils/error.js";
import { Organization } from "./Organization.model.js";
import { Department } from "./Department.model.js";
import { Policy } from "./Policy.model.js";
import { IOrganization } from "../types/organization.types.js";
import { computeEffectivePermissions } from "../utils/permissions.js";

const EntitySnapshotSchema = new Schema(
  { _id: { type: Schema.Types.ObjectId, required: true }, name: { type: String, required: true } },
  { _id: false },
);

const PolicySnapshotSchema = new Schema(
  {
    _id: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    grants: [{ type: String }],
  },
  { _id: false },
);

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
    departmentSnapshot: { type: EntitySnapshotSchema, default: null },
    managerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    managerSnapshot: { type: EntitySnapshotSchema, default: null },
    permissions: {
      view_all_tickets: { type: Boolean, default: null },
      approve_finance: { type: Boolean, default: null },
      export_reports: { type: Boolean, default: null },
      view_analytics: { type: Boolean, default: null },
    },
    policyId: {
      type: Schema.Types.ObjectId,
      ref: "Policy",
      default: null,
    },
    policySnapshot: { type: PolicySnapshotSchema, default: null },
    isDisabled: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// UserSchema.index({ orgId: 1 });
UserSchema.index({ orgId: 1, department: 1 });
UserSchema.index({ managerId: 1 });
UserSchema.index({ orgId: 1, role: 1, isDisabled: 1 }); // admin notify + role-filtered listUsers
UserSchema.index({ orgId: 1, createdAt: -1 }); // listUsers / listAllUsers sort
UserSchema.index({ email: 1, isDisabled: 1 }); // login + disabled check in one index scan
UserSchema.index({ orgId: 1, "departmentSnapshot._id": 1 });
UserSchema.index({ orgId: 1, "managerSnapshot._id": 1 });

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

  if (this.orgId && !org) {
    orgData = await Organization.findById(this.orgId);
  }

  // Fetch manager, department, and user policy concurrently...
  const [manager, dept, userPolicyDoc] = await Promise.all([
    this.managerId
      ? User.findById(this.managerId)
          .select("_id name email role isDisabled createdAt updatedAt")
      : Promise.resolve(null),
    this.department
      ? Department.findById(this.department)
      : Promise.resolve(null),
    this.policyId
      ? Policy.findById(this.policyId).select("grants").lean<{ grants: string[] }>()
      : Promise.resolve(null),
  ]);

  const deptPolicyDoc = dept?.policyId
    ? await Policy.findById(dept.policyId).select("grants").lean<{ grants: string[] }>()
    : null;

  return {
    _id: this._id.toString(),
    name: this.name,
    email: this.email,
    role: this.role,
    org: orgData ? orgData.data() : null,
    department: dept ? { _id: dept._id.toString(), name: dept.name } : null,
    permissions: {
      view_all_tickets: this.permissions?.view_all_tickets ?? null,
      approve_finance: this.permissions?.approve_finance ?? null,
      export_reports: this.permissions?.export_reports ?? null,
      view_analytics: this.permissions?.view_analytics ?? null,
    },
    policyId: this.policyId?.toString() ?? null,
    effectivePermissions: computeEffectivePermissions(
      {
        view_all_tickets: this.permissions?.view_all_tickets ?? null,
        approve_finance: this.permissions?.approve_finance ?? null,
        export_reports: this.permissions?.export_reports ?? null,
        view_analytics: this.permissions?.view_analytics ?? null,
      },
      userPolicyDoc?.grants ?? [],
      dept ? { ...dept.permissions } : null,
      deptPolicyDoc?.grants ?? [],
    ),
    manager: manager ? { _id: manager._id.toString(), name: manager.name } : null,
    isDisabled: this.isDisabled,
    createdAt: this.createdAt.toISOString(),
    updatedAt: this.updatedAt.toISOString(),
  };
};

export const User = mongoose.model<IUser>("User", UserSchema);
