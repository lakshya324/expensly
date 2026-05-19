import { Document, Types } from "mongoose";
import { AuditAction, EntityType } from "../config/constants.js";
import { IEntitySnapshot, IEntitySnapshotData } from "./common.types.js";

export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  entityType: EntityType;
  entityId: Types.ObjectId;
  action: AuditAction;
  /** Performer info embedded at creation - intentionally frozen for immutable audit trail. */
  performer: IEntitySnapshot;
  /** Client IP address, if available */
  ip: string | null;
  /** Arbitrary extra context (diff snapshots, old values, etc.) */
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface IAuditLogData {
  _id: string;
  orgId: string;
  entityType: EntityType;
  entityId: string;
  action: AuditAction;
  performer: IEntitySnapshotData;
  ip: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}
