import { Document, Types } from "mongoose";
import { Role } from "../config/constants.js";
import { IDepartmentData, IOrganization, IOrganizationData } from "./organization.types.js";

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  orgId: Types.ObjectId | null;
  department: Types.ObjectId | null;
  managerId: Types.ObjectId | null;
  isDisabled: boolean;
  createdAt: Date;
  updatedAt: Date;

  //! Functions

  data(this: IUser, org?: IOrganization): Promise<IUserData>;
}

export interface IUserData {
  _id: string;
  name: string;
  email: string;
  role: Role;
  org: IOrganizationData | null;
  department: IDepartmentData | null;
  manager: Omit<IUserData, "org" | "department" | "manager"> | null;
}

export interface IUserMinimalData {
  _id: string;
  name: string;
  email: string;
  role: Role;
  department: IDepartmentData | null;
}
