import { Types } from "mongoose";
import { Ticket } from "../models/Ticket.model.js";
import { Bundle } from "../models/Bundle.model.js";
import { DiscussionMessage } from "../models/DiscussionMessage.model.js";
import { User } from "../models/User.model.js";
import { Department } from "../models/Department.model.js";

/**
 * Propagation helpers — called fire-and-catch from mutation endpoints.
 *
 * When a display field changes (user name, dept name, merchant name, etc.) these
 * functions push the updated value into all documents that embedded a snapshot of
 * that field at write time. AuditLog is intentionally excluded: it is an immutable
 * historical record and its performer name should stay frozen at the time of action.
 *
 * Usage:
 *   propagateUserRename(userId, newName, newEmail)
 *     .catch((err) => logError(err, { message: "Propagation failed", code: "PROPAGATION_ERROR" }));
 */

export async function propagateUserRename(
  userId: string,
  newName: string,
  newEmail: string,
): Promise<void> {
  const oid = new Types.ObjectId(userId);
  await Promise.all([
    Ticket.updateMany(
      { "submitterSnapshot._id": oid },
      { $set: { "submitterSnapshot.name": newName, "submitterSnapshot.email": newEmail } },
    ),
    Ticket.updateMany(
      { "managerApproval.reviewerSnapshot._id": oid },
      { $set: { "managerApproval.reviewerSnapshot.name": newName, "managerApproval.reviewerSnapshot.email": newEmail } },
    ),
    Ticket.updateMany(
      { "financeApproval.reviewerSnapshot._id": oid },
      { $set: { "financeApproval.reviewerSnapshot.name": newName, "financeApproval.reviewerSnapshot.email": newEmail } },
    ),
    Bundle.updateMany(
      { "submitter._id": oid },
      { $set: { "submitter.name": newName, "submitter.email": newEmail } },
    ),
    Bundle.updateMany(
      { "managerApproval.reviewerSnapshot._id": oid },
      { $set: { "managerApproval.reviewerSnapshot.name": newName, "managerApproval.reviewerSnapshot.email": newEmail } },
    ),
    Bundle.updateMany(
      { "financeApproval.reviewerSnapshot._id": oid },
      { $set: { "financeApproval.reviewerSnapshot.name": newName, "financeApproval.reviewerSnapshot.email": newEmail } },
    ),
    DiscussionMessage.updateMany(
      { "author._id": oid },
      { $set: { "author.name": newName, "author.email": newEmail } },
    ),
    User.updateMany(
      { "managerSnapshot._id": oid },
      { $set: { "managerSnapshot.name": newName } },
    ),
    // DiscussionMessage.authorDeptSnapshot is intentionally NOT updated here.
    // It reflects the user's department at message-write time — immutable historical record,
    // consistent with AuditLog.performer which is also never updated after write.
  ]);
}

export async function propagateDepartmentRename(
  deptId: string,
  newName: string,
): Promise<void> {
  const oid = new Types.ObjectId(deptId);
  await Promise.all([
    Ticket.updateMany(
      { "departmentSnapshot._id": oid },
      { $set: { "departmentSnapshot.name": newName } },
    ),
    DiscussionMessage.updateMany(
      { "authorDeptSnapshot._id": oid },
      { $set: { "authorDeptSnapshot.name": newName } },
    ),
    User.updateMany(
      { "departmentSnapshot._id": oid },
      { $set: { "departmentSnapshot.name": newName } },
    ),
  ]);
}

export async function propagateMerchantRename(
  merchantId: string,
  newName: string,
): Promise<void> {
  await Ticket.updateMany(
    { "merchantSnapshot._id": new Types.ObjectId(merchantId) },
    { $set: { "merchantSnapshot.name": newName } },
  );
}

export async function propagateCategoryRename(
  categoryId: string,
  newName: string,
): Promise<void> {
  await Ticket.updateMany(
    { "categorySnapshot._id": new Types.ObjectId(categoryId) },
    { $set: { "categorySnapshot.name": newName } },
  );
}

export async function propagateBundleTitleChange(
  bundleId: string,
  newTitle: string,
): Promise<void> {
  await Ticket.updateMany(
    { "bundleSnapshot._id": new Types.ObjectId(bundleId) },
    { $set: { "bundleSnapshot.name": newTitle } },
  );
}

export async function propagatePolicyUpdate(
  policyId: string,
  newName: string,
  newGrants: string[],
): Promise<void> {
  const oid = new Types.ObjectId(policyId);
  await Promise.all([
    User.updateMany(
      { "policySnapshot._id": oid },
      { $set: { "policySnapshot.name": newName, "policySnapshot.grants": newGrants } },
    ),
    Department.updateMany(
      { "policySnapshot._id": oid },
      { $set: { "policySnapshot.name": newName } },
    ),
  ]);
}

export async function propagatePolicyDeletion(policyId: string): Promise<void> {
  const oid = new Types.ObjectId(policyId);
  await Promise.all([
    User.updateMany(
      { "policySnapshot._id": oid },
      { $set: { policySnapshot: null } },
    ),
    Department.updateMany(
      { "policySnapshot._id": oid },
      { $set: { policySnapshot: null } },
    ),
  ]);
}
