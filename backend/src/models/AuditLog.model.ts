import mongoose, { Schema } from "mongoose";
import { AUDIT_ACTION, ENTITY_TYPE } from "../config/constants.js";
import { IAuditLog } from "../types/auditLog.types.js";

const AuditLogSchema = new Schema<IAuditLog>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    entityType: {
      type: String,
      enum: Object.values(ENTITY_TYPE),
      required: true,
    },
    entityId: { type: Schema.Types.ObjectId, required: true },
    action: {
      type: String,
      enum: Object.values(AUDIT_ACTION),
      required: true,
    },
    /** Performer info embedded at creation — intentionally frozen for immutable audit trail. */
    performer: {
      type: new Schema(
        {
          _id: { type: Schema.Types.ObjectId, ref: "User", required: true },
          name: { type: String, required: true },
        },
        { _id: false },
      ),
      required: true,
    },
    /** IP address of the requesting client, if available */
    ip: { type: String, default: null },
    /**
     * Freeform context bag — store diffs, old values, extra labels.
     * Keep fields small; avoid storing PII beyond what's already in parent docs.
     */
    metadata: { type: Schema.Types.Mixed, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // audit logs are immutable
  },
);

// Query patterns:
//   - "show all changes to ticket X"  → (orgId, entityId)
//   - "admin audit trail newest-first" → (orgId, createdAt desc)
AuditLogSchema.index({ orgId: 1, entityId: 1 });
AuditLogSchema.index({ orgId: 1, createdAt: -1 });
AuditLogSchema.index({ orgId: 1, entityType: 1, createdAt: -1 });

export const AuditLog = mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
