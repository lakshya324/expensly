import { ROLES, TICKET_STATUS } from "../config/constants.js";
import { AuthRequest } from "../types/types.js";

export function buildTicketFilter(req: AuthRequest): Record<string, unknown> {
  const user = req.user!;
  const org = req.organization!;
  const { status, department, userId, from, to, search, flagged, minAmount, maxAmount } = req.query as Record<
    string,
    string | undefined
  >;

  const filter: Record<string, unknown> = { orgId: user.orgId };

  // Determine if user should see only their own tickets.
  // Priority: user-level permission → dept-level permission → role default.
  const dept = req.userDepartment ?? null;
  
  // Cando: Users with canApprove permission also get full visibility so they can act on tickets.
  // const hasApprovePermission =
  //   user.permissions?.canApprove === true ||
  //   (user.permissions?.canApprove == null && dept?.permissions?.canApprove === true);
  
  const canViewAll =
    // hasApprovePermission ||
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

  if (status && Object.values(TICKET_STATUS).includes(status as any)) filter["status"] = status;
  if (department) filter["department"] = department;
  if (userId) filter["submittedBy"] = userId;
  if (flagged === 'true') filter["flagged"] = true;
  
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