import { IDepartmentData } from "../../types/department.types.js";
import { getIO } from "../ioServer.js";
import {
  WS_EVENTS,
  WSMeta,
  DeptCreatedPayload,
  DeptUpdatePayload,
} from "../events.types.js";

function meta(orgId: string, triggeredBy?: string): WSMeta {
  return { timestamp: new Date().toISOString(), orgId, triggeredBy };
}

export function emitDeptCreated(
  orgId: string,
  department: IDepartmentData,
  triggeredBy?: string,
): void {
  const payload: DeptCreatedPayload = {
    event: WS_EVENTS.DEPT_CREATED,
    data: { department },
    meta: meta(orgId, triggeredBy),
  };
  getIO().to(orgId).emit(WS_EVENTS.DEPT_CREATED, payload);
}

export function emitDeptUpdate(
  orgId: string,
  department: IDepartmentData,
  triggeredBy?: string,
): void {
  const payload: DeptUpdatePayload = {
    event: WS_EVENTS.DEPT_UPDATE,
    data: { department },
    meta: meta(orgId, triggeredBy),
  };
  getIO().to(orgId).emit(WS_EVENTS.DEPT_UPDATE, payload);
}
