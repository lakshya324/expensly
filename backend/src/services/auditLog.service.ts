import { Types } from "mongoose";
import { AuditLog } from "../models/AuditLog.model.js";
import { AuditAction, EntityType } from "../config/constants.js";
import { IAuditLogData } from "../types/auditLog.types.js";
import { logError } from "../utils/logger.js";

export interface LogActionParams {
  orgId: Types.ObjectId | string;
  entityType: EntityType;
  entityId: Types.ObjectId | string;
  action: AuditAction;
  performedBy: Types.ObjectId | string;
  /** Display name of the performer - embedded in the log entry. */
  performerName: string;
  ip?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Record an immutable audit log entry.
 *
 * Designed to be called fire-and-catch from controllers - errors are logged
 * but never re-thrown so they cannot disrupt the primary request flow.
 */
export const logAction = async (params: LogActionParams): Promise<void> => {
  try {
    await AuditLog.create({
      orgId: new Types.ObjectId(params.orgId.toString()),
      entityType: params.entityType,
      entityId: new Types.ObjectId(params.entityId.toString()),
      action: params.action,
      performer: {
        _id: new Types.ObjectId(params.performedBy.toString()),
        name: params.performerName,
      },
      ip: params.ip ?? null,
      metadata: params.metadata ?? null,
    });
  } catch (err) {
    logError(err, {
      message: "Failed to write audit log entry",
      code: "AUDIT_LOG_WRITE_ERROR",
    });
  }
};

export interface GetAuditLogOptions {
  orgId: string;
  entityId?: string;
  entityType?: EntityType;
  /** 1-based page number */
  page?: number;
  limit?: number;
}

export interface AuditLogPage {
  data: IAuditLogData[];
  total: number;
}

/**
 * Fetch a paginated, newest-first audit trail.
 */
export const getAuditLog = async (
  opts: GetAuditLogOptions,
): Promise<AuditLogPage> => {
  const { orgId, entityId, entityType, page = 1, limit = 50 } = opts;

  const filter: Record<string, unknown> = {
    orgId: new Types.ObjectId(orgId),
  };
  if (entityId) filter["entityId"] = new Types.ObjectId(entityId);
  if (entityType) filter["entityType"] = entityType;

  const [entries, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  const data: IAuditLogData[] = entries.map((e) => ({
    _id: e._id.toString(),
    orgId: e.orgId.toString(),
    entityType: e.entityType,
    entityId: e.entityId.toString(),
    action: e.action,
    performer: {
      _id: e.performer._id.toString(),
      name: e.performer.name,
    },
    ip: e.ip ?? null,
    metadata: e.metadata ?? null,
    createdAt: e.createdAt,
  }));

  return { data, total };
};
