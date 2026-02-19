import { Document, Types } from "mongoose";
import { Role } from "../config/constants.js";

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

  data(): IUserOutput;
}

export interface IUserOutput {
  id: string;
  name: string;
  email: string;
  role: Role;
  orgId: string | null;
  department: string | null;
  managerId: string | null;
}