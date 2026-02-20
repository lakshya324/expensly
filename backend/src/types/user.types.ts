import { Document, Types } from "mongoose";
import { Role } from "../config/constants.js";
import { IOrganization, IOrganizationData } from "./organization.types.js";
import { IDepartmentData } from "./department.types.js";

export interface IUserPermissions {
  /** Override dept-level canViewAllTickets. null = inherit from dept */
  canViewAllTickets: boolean | null;
  /** Override dept-level canApprove. null = inherit from dept */
  canApprove: boolean | null;
}

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  orgId: Types.ObjectId | null;
  department: Types.ObjectId | null;
  managerId: Types.ObjectId | null;
  permissions: IUserPermissions;
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
  department: IDepartmentData | null;
  permissions: IUserPermissions;
  manager: Omit<IUserData, "org" | "department" | "manager" | "permissions"> | null;
}

export interface IUserMinimalData {
  _id: string;
  name: string;
  email: string;
  role: Role;
  department: IDepartmentData | null;
}
