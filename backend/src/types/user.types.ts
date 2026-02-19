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
  department: string | null;
  managerId: Types.ObjectId | null;
  isDisabled: boolean;
  createdAt: Date;
  updatedAt: Date;

  //! Functions

  data(this: IUser, org?: IOrganization): IUserOutput;
}

export interface IUserOutput {
  _id: string;
  name: string;
  email: string;
  role: Role;
  org: IOrganizationData | null;
  department: IDepartmentData | null;
  manager: Omit<IUserOutput, "org" | "department" | "manager"> | null;
}
