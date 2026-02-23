import { IUserData } from "../../types/user.types.js";
import { getIO } from "../ioServer.js";
import {
  WS_EVENTS,
  WSMeta,
  UserUpdatePayload,
  UserDisablePayload,
} from "../events.types.js";

function meta(orgId: string, triggeredBy?: string): WSMeta {
  return { timestamp: new Date().toISOString(), orgId, triggeredBy };
}

export function emitUserUpdate(
  orgId: string,
  user: IUserData,
  triggeredBy?: string,
): void {
  const payload: UserUpdatePayload = {
    event: WS_EVENTS.USER_UPDATE,
    data: { user },
    meta: meta(orgId, triggeredBy),
  };
  getIO().to(orgId).emit(WS_EVENTS.USER_UPDATE, payload);
}

export function emitUserDisable(
  orgId: string,
  userId: string,
  user: IUserData,
  triggeredBy?: string,
): void {
  const payload: UserDisablePayload = {
    event: WS_EVENTS.USER_DISABLE,
    data: { user },
    meta: meta(orgId, triggeredBy),
  };
  const io = getIO();
  io.to(orgId).emit(WS_EVENTS.USER_DISABLE, payload);
  io.to(userId).emit(WS_EVENTS.USER_DISABLE, payload);
}
