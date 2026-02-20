import { ROLES } from "../config/constants.js";
import { AuthRequest } from "../types/types.js";

export function buildTicketFilter(req: AuthRequest): Record<string, unknown> {
  const user = req.user!;
  const { status, department, from, to, search } = req.query as Record<
    string,
    string | undefined
  >;

  const filter: Record<string, unknown> = { orgId: user.orgId };

  // Determine if user should see only their own tickets.
  // Priority: user-level permission → dept-level permission → role default.
  const dept = req.userDepartment ?? null;
  const canViewAll =
    user.permissions?.canViewAllTickets === true ||
    (user.permissions?.canViewAllTickets == null && (
      dept?.permissions?.canViewAllTickets === true ||
      user.role !== ROLES.USER
    ));

  const userScopeOr = canViewAll
    ? null
    : [
        { submittedBy: user._id },
        { "managerApproval.reviewedBy": user._id },
        { submitterManagerId: user._id }, // See all tickets from team members
      ];

  if (status) filter["status"] = status;
  if (department) filter["department"] = department;

  if (from || to) {
    const dateRange: Record<string, Date> = {};
    if (from) dateRange["$gte"] = new Date(from);
    if (to) dateRange["$lte"] = new Date(to);
    filter["createdAt"] = dateRange;
  }

  const searchOr = search
    ? [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { tags: { $regex: search, $options: "i" } },
      ]
    : null;

  if (userScopeOr && searchOr) {
    // Both constraints active — combine with $and to prevent overwrite
    filter["$and"] = [{ $or: userScopeOr }, { $or: searchOr }];
  } else if (userScopeOr) {
    filter["$or"] = userScopeOr;
  } else if (searchOr) {
    filter["$or"] = searchOr;
  }

  return filter;
}