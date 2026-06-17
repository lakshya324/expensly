import { Document, Types } from "mongoose";
import { Role, PermissionKey } from "../config/constants.js";
import { IOrganization, IOrganizationData } from "./organization.types.js";
import {
  IEntitySnapshot,
  IEntitySnapshotData,
  IPolicySnapshot,
} from "./common.types.js";

/** null = inherit from dept/policy chain; true/false = explicit override */
export type IUserPermissions = { [K in PermissionKey]: boolean | null };

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  orgId: Types.ObjectId | null;
  department: Types.ObjectId | null;
  departmentSnapshot: IEntitySnapshot | null;
  managerId: Types.ObjectId | null;
  managerSnapshot: IEntitySnapshot | null;
  permissions: IUserPermissions;
  policyId: Types.ObjectId | null;
  policySnapshot: IPolicySnapshot | null;
  isDisabled: boolean;
  createdAt: Date;
  updatedAt: Date;

  //! Methods
  data(this: IUser, org?: IOrganization): Promise<IUserData>;
}

export interface IUserData {
  _id: string;
  name: string;
  email: string;
  role: Role;
  org: IOrganizationData | null;
  department: IEntitySnapshotData | null;
  permissions: IUserPermissions;
  policyId: string | null;
  effectivePermissions: Record<PermissionKey, boolean>;
  manager: IEntitySnapshotData | null;
  isDisabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IUserMinimalData {
  _id: string;
  name: string;
  email: string;
  role: Role;
  department: IEntitySnapshotData | null;
}
