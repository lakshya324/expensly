import { Types } from "mongoose";
import { Policy } from "../models/Policy.model.js";
import { PERMISSION_KEY, PermissionKey } from "../config/constants.js";

interface SystemPolicyDef {
  name: string;
  description: string;
  grants: PermissionKey[];
}

const SYSTEM_POLICY_DEFS: SystemPolicyDef[] = [
  {
    name: "Finance Approver",
    description: "Can approve or reject expense tickets at the finance step.",
    grants: [PERMISSION_KEY.APPROVE_FINANCE],
  },
  {
    name: "Team Lead",
    description: "Can view all tickets across the organization.",
    grants: [PERMISSION_KEY.VIEW_ALL_TICKETS],
  },
  {
    name: "Reporting Analyst",
    description: "Can export reports and view analytics dashboards.",
    grants: [PERMISSION_KEY.EXPORT_REPORTS, PERMISSION_KEY.VIEW_ANALYTICS],
  },
  {
    name: "Org Contributor",
    description: "Full access - view all tickets, approve finance, export reports, and view analytics.",
    grants: [
      PERMISSION_KEY.VIEW_ALL_TICKETS,
      PERMISSION_KEY.APPROVE_FINANCE,
      PERMISSION_KEY.EXPORT_REPORTS,
      PERMISSION_KEY.VIEW_ANALYTICS,
    ],
  },
];

/**
 * Idempotently seeds the 4 system policies for a given org.
 * Safe to call multiple times - uses upsert on (orgId, name, isSystem).
 */
export async function seedSystemPolicies(
  orgId: string,
  createdBy: string,
): Promise<void> {
  const orgObjectId = new Types.ObjectId(orgId);
  const createdByObjectId = new Types.ObjectId(createdBy);

  await Promise.all(
    SYSTEM_POLICY_DEFS.map((def) =>
      Policy.updateOne(
        { orgId: orgObjectId, name: def.name, isSystem: true },
        {
          $setOnInsert: {
            orgId: orgObjectId,
            name: def.name,
            description: def.description,
            isSystem: true,
            isActive: true,
            grants: def.grants,
            createdBy: createdByObjectId,
          },
        },
        { upsert: true },
      ),
    ),
  );
}
