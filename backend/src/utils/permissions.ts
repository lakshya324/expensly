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
