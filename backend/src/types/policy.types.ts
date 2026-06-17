import { Types } from "mongoose";
import { PermissionKey } from "../config/constants.js";

export interface IPolicy {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  grants: PermissionKey[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPolicyData {
  _id: string;
  orgId: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  grants: PermissionKey[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
