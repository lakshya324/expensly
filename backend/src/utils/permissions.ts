import { Policy } from "../models/Policy.model.js";
import { PERMISSION_KEY, PermissionKey, ROLES } from "../config/constants.js";
import { IUser } from "../types/user.types.js";
import { IDepartment } from "../types/department.types.js";

/**
 * Resolves whether a user has a specific permission.
 *
 * Resolution chain (IAM-style):
 *  1. Admin / Super Admin roles → always true
 *  2. User explicit override (permissions[key] === true/false)
 *  3. User's assigned policy grants
 *  4. Department explicit permission
 *  5. Department's assigned policy grants
 *  6. Default → false
 */
export async function resolvePermission(
  user: IUser,
  dept: IDepartment | null,
  permission: PermissionKey,
): Promise<boolean> {
  // Admins always have all permissions
  if (user.role === ROLES.ADMIN || user.role === ROLES.SUPER_ADMIN) return true;

  // Explicit user-level override
  const userExplicit = user.permissions?.[permission];
  if (userExplicit === true) return true;
  if (userExplicit === false) return false;

  // User's assigned policy
  if (user.policyId) {
    const policy = await Policy.findById(user.policyId)
      .select("grants isActive")
      .lean();
    if (policy?.isActive && (policy.grants as PermissionKey[]).includes(permission))
      return true;
  }

  // Department explicit permission
  if (dept?.permissions?.[permission] === true) return true;

  // Department's assigned policy
  if (dept?.policyId) {
    const policy = await Policy.findById(dept.policyId)
      .select("grants isActive")
      .lean();
    if (policy?.isActive && (policy.grants as PermissionKey[]).includes(permission))
      return true;
  }

  return false;
}

/**
 * Computes the fully-resolved effective permissions for a user by merging all sources.
 * Returns a plain boolean for every permission key (no nulls).
 *
 * Priority (highest → lowest):
 *  1. User explicit override (non-null boolean)
 *  2. User's own policy grants
 *  3. Department's direct permission (boolean true)
 *  4. Department's policy grants
 *  5. false (denied by default)
 */
export function computeEffectivePermissions(
  userPerms: Record<string, boolean | null>,
  userPolicyGrants: string[],
  deptPerms: Record<string, boolean> | null,
  deptPolicyGrants: string[],
): Record<PermissionKey, boolean> {
  const result = {} as Record<PermissionKey, boolean>;

  for (const key of Object.values(PERMISSION_KEY)) {
    const userOverride = userPerms[key];

    if (userOverride !== null && userOverride !== undefined) {
      result[key] = userOverride as boolean;
    } else if (userPolicyGrants.includes(key)) {
      result[key] = true;
    } else if (deptPerms && deptPerms[key] === true) {
      result[key] = true;
    } else if (deptPolicyGrants.includes(key)) {
      result[key] = true;
    } else {
      result[key] = false;
    }
  }

  return result;
}
