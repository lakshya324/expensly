import { User } from "../models/User.model.js";
import { PipelineStage } from "mongoose";
import { IUserData } from "../types/user.types.js";
import { IOrganizationData } from "../types/organization.types.js";
import { computeEffectivePermissions } from "../utils/permissions.js";

function mapOrg(o: any): IOrganizationData | null {
  if (!o) return null;
  return {
    _id: o._id.toString(),
    name: o.name,
    slug: o.slug,
    isDisabled: o.isDisabled,
    baseCurrency: o.baseCurrency,
    activeCurrencies: o.activeCurrencies,
    currentRateSnapshotId: o.currentRateSnapshotId
      ? o.currentRateSnapshotId.toString()
      : null,
    createdAt: new Date(o.createdAt).toISOString(),
    updatedAt: new Date(o.updatedAt).toISOString(),
  };
}

/**
 * Lists users with pagination, filtering, and optional organization data.
 *
 * @param filter - MongoDB filter object to match users.
 * @param page - The page number for pagination (1-based).
 * @param limit - The number of items per page.
 * @param knownOrg - Optional pre-fetched organization data to avoid $lookup.
 *
 * @return An object containing the array of user data and the total count of matching users.
 *
 * @throws Will throw an error if the aggregation fails.
 *
 * @remarks
 * This function performs a MongoDB aggregation to retrieve users based on the provided filter, pagination parameters, and optional organization data. It uses $facet to get both the total count of matching users and the paginated user data in a single query. The function also includes $lookup stages to join related data from the organizations, users (for manager), and departments collections.
 *
 * The returned user data includes the user's organization, department, manager information, and permissions. If knownOrg is provided, the organization data is used directly without performing a $lookup, which can improve performance when the organization context is already available.
 *
 * Example usage:
 *
 * ```typescript
 * const { data: users, total } = await listUsersPaginated(
 *   { orgId: someOrgId },
 *   1, // page
 *   10, // limit
 *   preFetchedOrgData // knownOrg
 * );
 * console.log(users, total);
 * ```
 */
export async function listUsersPaginated(
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  knownOrg: IOrganizationData | null = null,
): Promise<{ data: IUserData[]; total: number }> {
  //! listUsersPaginated
  // Runs a single $match -> $sort -> $facet aggregation that:
  // counts total matching documents (for pagination metadata)
  // fetches the requested page
  //  joins manager (users), department (departments), and optionally
  //  organization (organizations) via $lookup - all in one server round-trip.

  const skip = (page - 1) * limit;

  // org $lookup only when the caller does not already supply an org (e.g. super admin listing)
  const orgLookup: PipelineStage.FacetPipelineStage[] = knownOrg
    ? []
    : [{ $lookup: { from: "organizations", localField: "orgId", foreignField: "_id", as: "_org" } }];

  const [result] = await User.aggregate([
    { $match: filter },
    { $sort: { createdAt: -1 } },
    {
      $facet: {
        total: [{ $count: "count" }],
        data: [{ $skip: skip }, { $limit: limit }, ...orgLookup],
      },
    },
  ]);

  const total: number = result?.total?.[0]?.count ?? 0;
  const users: any[] = result?.data ?? [];

  const data: IUserData[] = users.map((u) => {
    const userPolicyGrants = (u.policySnapshot?.grants ?? []) as string[];
    const userPerms = {
      view_all_tickets: u.permissions?.view_all_tickets ?? null,
      approve_finance: u.permissions?.approve_finance ?? null,
      export_reports: u.permissions?.export_reports ?? null,
      view_analytics: u.permissions?.view_analytics ?? null,
    };
    return {
      _id: u._id.toString(),
      name: u.name,
      email: u.email,
      role: u.role,
      org: knownOrg ?? mapOrg(u._org?.[0] ?? null),
      department: u.departmentSnapshot
        ? { _id: u.departmentSnapshot._id.toString(), name: u.departmentSnapshot.name }
        : null,
      permissions: userPerms,
      policyId: u.policyId?.toString() ?? null,
      effectivePermissions: computeEffectivePermissions(userPerms, userPolicyGrants, null, []),
      manager: u.managerSnapshot
        ? { _id: u.managerSnapshot._id.toString(), name: u.managerSnapshot.name }
        : null,
      isDisabled: u.isDisabled,
      createdAt: new Date(u.createdAt).toISOString(),
      updatedAt: new Date(u.updatedAt).toISOString(),
    };
  });

  return { data, total };
}
