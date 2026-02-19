import { ROLES } from "../config/constants.js";
import { AuthRequest } from "../types/types.js";

export function buildTicketFilter(req: AuthRequest): Record<string, unknown> {
  const user = req.user!;
  const { status, department, from, to, search } = req.query as Record<
    string,
    string | undefined
  >;

  const filter: Record<string, unknown> = { orgId: user.orgId };

  if (user.role === ROLES.USER) {
    filter["$or"] = [
      { submittedBy: user._id },
      { "managerApproval.reviewedBy": user._id },
    ];
  }

  if (status) filter["status"] = status;
  if (department) filter["department"] = department;

  if (from || to) {
    const dateRange: Record<string, Date> = {};
    if (from) dateRange["$gte"] = new Date(from);
    if (to) dateRange["$lte"] = new Date(to);
    filter["createdAt"] = dateRange;
  }

  if (search) {
    // Note: this overwrites any $or set above; search takes precedence
    filter["$or"] = [
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
      { tags: { $regex: search, $options: "i" } },
    ];
  }

  return filter;
}