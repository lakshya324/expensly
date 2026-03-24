import { PERMISSION_KEY, TICKET_STATUS } from "../config/constants.js";
import { AuthRequest } from "../types/types.js";
import { resolvePermission } from "./permissions.js";

export async function buildTicketVisibilityFilter(
  req: AuthRequest,
): Promise<Record<string, unknown>> {
  const user = req.user!;
  const filter: Record<string, unknown> = { orgId: user.orgId };

  // Resolve view-all permission through the full chain (user override → user policy → dept → dept policy)
  const dept = req.userDepartment ?? null;
  const canViewAll = await resolvePermission(user, dept, PERMISSION_KEY.VIEW_ALL_TICKETS);

  const userScopeOr = canViewAll
    ? null
    : [
        { submittedBy: user._id },
        { "managerApproval.reviewedBy": user._id },
        { submitterManagerId: user._id }, // See all tickets from team members
      ];

  // Draft/scanning tickets are private: only the submitter can ever see them,
  // regardless of manager authority or view_all permission.
  const draftScanRestriction = {
    $or: [
      {
        status: {
          $nin: [TICKET_STATUS.DRAFT, TICKET_STATUS.SCANNING, TICKET_STATUS.OCR_FAILED],
        },
      },
      { submittedBy: user._id },
    ],
  };

  const andClauses: Record<string, unknown>[] = [draftScanRestriction];
  if (userScopeOr) andClauses.push({ $or: userScopeOr });
  filter["$and"] = andClauses;

  return filter;
}

export async function buildTicketFilter(req: AuthRequest): Promise<Record<string, unknown>> {
  const { status, department, userId, from, to, search, flagged, minAmount, maxAmount } = req.query as Record<
    string,
    string | undefined
  >;

  const filter = await buildTicketVisibilityFilter(req);
  const andClauses = (filter["$and"] as Record<string, unknown>[]) ?? [];

  if (status && Object.values(TICKET_STATUS).includes(status as any)) filter["status"] = status;
  if (department) filter["department"] = department;
  if (userId) filter["submittedBy"] = userId;
  if (flagged === "true") filter["flagged"] = true;

  if (minAmount || maxAmount) {
    const amtRange: Record<string, number> = {};
    if (minAmount) amtRange["$gte"] = parseFloat(minAmount);
    if (maxAmount) amtRange["$lte"] = parseFloat(maxAmount);
    filter["amount"] = amtRange;
  }

  if (from || to) {
    const dateRange: Record<string, Date> = {};
    if (from) dateRange["$gte"] = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      dateRange["$lte"] = toDate;
    }
    filter["createdAt"] = dateRange;
  }

  if (search) {
    andClauses.push({
      $or: [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { tags: { $regex: search, $options: "i" } },
      ],
    });
  }

  return filter;
}
