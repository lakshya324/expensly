import { Request } from "express";
import { Socket } from "socket.io";
import { IUser } from "./user.types.js";
import { IOrganization } from "./organization.types.js";
import { IDepartment } from "./department.types.js";

export interface AuthRequest extends Request {
  requestId?: string;
  user?: IUser;
  organization?: IOrganization;
  /** The department document for the authenticated user (null if user has no department) */
  userDepartment?: IDepartment | null;
}

export interface AuthSocket extends Socket {
  user?: IUser;
  organization?: IOrganization;
  /** The department document for the authenticated user (null if user has no department) */
  userDepartment?: IDepartment | null;
}
