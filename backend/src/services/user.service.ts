import { User } from "../models/User.model.js";
import { PipelineStage } from "mongoose";
import { IUserData } from "../types/user.types.js";
import { IOrganizationData } from "../types/organization.types.js";
import { IDepartmentData } from "../types/department.types.js";

// map raw aggregation docs to typed data objects
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

function mapDept(d: any): IDepartmentData | null {
  if (!d) return null;
  return {
    _id: d._id.toString(),
    orgId: d.orgId.toString(),
    name: d.name,
    budget: d.budget,
    spent: d.spent,
    approvalThresholds: d.approvalThresholds ?? {},
    permissions: d.permissions,
    policyId: d.policyId?.toString() ?? null,
    tags: d.tags ?? [],
    budgetResetPeriod: d.budgetResetPeriod,
    nextResetDate: d.nextResetDate,
    isActive: d.isActive,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

function mapManager(m: any): IUserData["manager"] | null {
  if (!m) return null;
  return {
    _id: m._id.toString(),
    name: m.name,
    email: m.email,
    role: m.role,
    isDisabled: m.isDisabled,
    createdAt: new Date(m.createdAt).toISOString(),
    updatedAt: new Date(m.updatedAt).toISOString(),
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

  // Build the $lookup stages for the data branch.
  // The org lookup is only added when the caller does not already supply an org.
  const lookups: PipelineStage.FacetPipelineStage[] = [];

  // adding $lookup for org when knownOrg is not provided
  // (e.g. superadmin listing users across orgs)
  if (!knownOrg) {
    lookups.push({
      $lookup: {
        from: "organizations",
        localField: "orgId",
        foreignField: "_id",
        as: "_org",
      },
    });
  }

  lookups.push(
    // manager lookup
    {
      $lookup: {
        from: "users",
        localField: "managerId",
        foreignField: "_id",
        pipeline: [
          {
            $project: {
              _id: 1,
              name: 1,
              email: 1,
              role: 1,
              isDisabled: 1,
              createdAt: 1,
              updatedAt: 1,
            },
          },
        ],
        as: "_manager",
      },
    },

    // department lookup
    {
      $lookup: {
        from: "departments",
        localField: "department",
        foreignField: "_id",
        as: "_dept",
      },
    },
  );

  //! Running the aggregation with $facet to get total count and paginated data in one query
  const [result] = await User.aggregate([
    { $match: filter },
    { $sort: { createdAt: -1 } },
    {
      $facet: {
        total: [{ $count: "count" }],
        data: [{ $skip: skip }, { $limit: limit }, ...lookups],
      },
    },
  ]);

  const total: number = result?.total?.[0]?.count ?? 0;
  const users: any[] = result?.data ?? [];

  const data: IUserData[] = users.map((u) => ({
    _id: u._id.toString(),
    name: u.name,
    email: u.email,
    role: u.role,
    org: knownOrg ?? mapOrg(u._org?.[0] ?? null),
    department: mapDept(u._dept?.[0] ?? null),
    permissions: {
      view_all_tickets: u.permissions?.view_all_tickets ?? null,
      approve_finance: u.permissions?.approve_finance ?? null,
      export_reports: u.permissions?.export_reports ?? null,
      view_analytics: u.permissions?.view_analytics ?? null,
    },
    policyId: u.policyId?.toString() ?? null,
    manager: mapManager(u._manager?.[0] ?? null),
    isDisabled: u.isDisabled,
    createdAt: new Date(u.createdAt).toISOString(),
    updatedAt: new Date(u.updatedAt).toISOString(),
  }));

  return { data, total };
}
