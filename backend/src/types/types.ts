import { Request } from "express";
import { Socket } from "socket.io";
import { IUser } from "./user.types.js";
import { IOrganization } from "./organization.types.js";

export interface AuthRequest extends Request {
  user?: IUser;
  organization?: IOrganization;
}

export interface AuthSocket extends Socket {
  user?: IUser;
  organization?: IOrganization;
}