/**
 * One-time migration: backfill denormalized snapshot fields on existing documents.
 *
 * Run BEFORE deploying the new application code. Processes in batches of 500
 * using cursors to avoid loading the full collection into memory.
 *
 * Usage:
 *   npx tsx src/scripts/migrate-denormalization.ts
 * 
 * Usage:
 *  npm run build && node dist/scripts/migrate-denormalization.js
 */
import mongoose, { Types } from "mongoose";
import { connectToMongoDB } from "../config/db.config.js";
import { Ticket } from "../models/Ticket.model.js";
import { Bundle } from "../models/Bundle.model.js";
import { DiscussionMessage } from "../models/DiscussionMessage.model.js";
import { AuditLog } from "../models/AuditLog.model.js";
import { User } from "../models/User.model.js";
import { Department } from "../models/Department.model.js";
import { Merchant } from "../models/Merchant.model.js";
import { Category } from "../models/Category.model.js";
import { Policy } from "../models/Policy.model.js";
import { Receipt } from "../models/Receipt.model.js";
import { ExchangeRateSnapshot } from "../models/ExchangeRateSnapshot.model.js";
import { logInfo, logError } from "../utils/logger.js";

async function migrateUsers(): Promise<void> {
  logInfo("[migrate] Starting User snapshot backfill…");
  let processed = 0;

  const cursor = User.find({
    $or: [
      { departmentSnapshot: null },
      { departmentSnapshot: { $exists: false } },
    ],
  }).cursor({ batchSize: BATCH });

  for await (const user of cursor) {
    const [deptDoc, mgrDoc] = await Promise.all([
      user.department ? Department.findById(user.department).select("_id name").lean() : null,
      user.managerId ? User.findById(user.managerId).select("_id name").lean() : null,
    ]);
    const update: Record<string, unknown> = {};
    if (deptDoc) update["departmentSnapshot"] = { _id: deptDoc._id, name: deptDoc.name };
    if (mgrDoc) update["managerSnapshot"] = { _id: mgrDoc._id, name: mgrDoc.name };
    if (Object.keys(update).length > 0) {
      await User.updateOne({ _id: user._id }, { $set: update });
    }
    processed++;
    if (processed % 500 === 0) logInfo(`[migrate] Users: ${processed} processed`);
  }

  logInfo(`[migrate] Users done - ${processed} total`);
}

const BATCH = 500;

async function migrateTickets(): Promise<void> {
  logInfo("[migrate] Starting Ticket snapshot backfill…");
  let processed = 0;

  const cursor = Ticket.find({
    $or: [
      { submitterSnapshot: null },
      { submitterSnapshot: { $exists: false } },
    ],
  }).cursor({ batchSize: BATCH });

  for await (const ticket of cursor) {
    const [submitterUser, deptDoc, merchantDoc, categoryDoc, bundleDoc] = await Promise.all([
      User.findById(ticket.submittedBy).select("_id name email").lean(),
      ticket.department ? Department.findById(ticket.department).select("_id name").lean() : null,
      ticket.merchant ? Merchant.findById(ticket.merchant).select("_id name").lean() : null,
      ticket.category ? Category.findById(ticket.category).select("_id name").lean() : null,
      ticket.bundleId
        ? import("../models/Bundle.model.js").then(({ Bundle: B }) =>
            B.findById(ticket.bundleId).select("_id title").lean(),
          )
        : null,
    ]);

    const managerReviewerSnap = ticket.managerApproval?.reviewedBy && !ticket.managerApproval.reviewerSnapshot
      ? await User.findById(ticket.managerApproval.reviewedBy).select("_id name email").lean()
      : null;
    const financeReviewerSnap = ticket.financeApproval?.reviewedBy && !ticket.financeApproval.reviewerSnapshot
      ? await User.findById(ticket.financeApproval.reviewedBy).select("_id name email").lean()
      : null;

    const update: Record<string, unknown> = {};
    if (submitterUser) {
      update["submitterSnapshot"] = { _id: submitterUser._id, name: submitterUser.name, email: submitterUser.email };
    }
    if (deptDoc) update["departmentSnapshot"] = { _id: deptDoc._id, name: deptDoc.name };
    if (merchantDoc) update["merchantSnapshot"] = { _id: merchantDoc._id, name: merchantDoc.name };
    if (categoryDoc) update["categorySnapshot"] = { _id: categoryDoc._id, name: categoryDoc.name };
    if (bundleDoc) update["bundleSnapshot"] = { _id: (bundleDoc as any)._id, name: (bundleDoc as any).title };
    if (managerReviewerSnap) {
      update["managerApproval.reviewerSnapshot"] = { _id: managerReviewerSnap._id, name: managerReviewerSnap.name, email: managerReviewerSnap.email };
    }
    if (financeReviewerSnap) {
      update["financeApproval.reviewerSnapshot"] = { _id: financeReviewerSnap._id, name: financeReviewerSnap.name, email: financeReviewerSnap.email };
    }

    if (Object.keys(update).length > 0) {
      await Ticket.updateOne({ _id: ticket._id }, { $set: update });
    }
    processed++;
    if (processed % 500 === 0) logInfo(`[migrate] Tickets: ${processed} processed`);
  }

  logInfo(`[migrate] Tickets done - ${processed} total`);
}

async function migrateBundles(): Promise<void> {
  logInfo("[migrate] Starting Bundle submitter backfill…");
  let processed = 0;

  // Bundles in the new schema don't have `submittedBy` anymore - if migrating
  // from old schema, find docs that still have submittedBy and lack submitter.
  const rawCollection = mongoose.connection.collection("bundles");
  const cursor = rawCollection.find({ submitter: { $exists: false }, submittedBy: { $exists: true } });

  for await (const rawBundle of cursor) {
    const submittedById = rawBundle["submittedBy"] as Types.ObjectId | undefined;
    if (!submittedById) continue;
    const user = await User.findById(submittedById).select("_id name email").lean();
    if (!user) continue;

    const update: Record<string, unknown> = {
      submitter: { _id: user._id, name: user.name, email: user.email },
    };

    // Reviewer snapshots
    const mgr = rawBundle["managerApproval"]?.reviewedBy;
    const fin = rawBundle["financeApproval"]?.reviewedBy;
    if (mgr && !rawBundle["managerApproval"]?.reviewerSnapshot) {
      const reviewer = await User.findById(mgr).select("_id name email").lean();
      if (reviewer) update["managerApproval.reviewerSnapshot"] = { _id: reviewer._id, name: reviewer.name, email: reviewer.email };
    }
    if (fin && !rawBundle["financeApproval"]?.reviewerSnapshot) {
      const reviewer = await User.findById(fin).select("_id name email").lean();
      if (reviewer) update["financeApproval.reviewerSnapshot"] = { _id: reviewer._id, name: reviewer.name, email: reviewer.email };
    }

    await rawCollection.updateOne({ _id: rawBundle["_id"] }, { $set: update });
    processed++;
    if (processed % 200 === 0) logInfo(`[migrate] Bundles: ${processed} processed`);
  }

  logInfo(`[migrate] Bundles done - ${processed} total`);
}

async function migrateDiscussionMessages(): Promise<void> {
  logInfo("[migrate] Starting DiscussionMessage author backfill…");
  let processed = 0;

  const rawCollection = mongoose.connection.collection("discussionmessages");
  const cursor = rawCollection.find({ author: { $exists: false }, authorId: { $exists: true } });

  for await (const rawMsg of cursor) {
    const authorId = rawMsg["authorId"] as Types.ObjectId | undefined;
    if (!authorId) continue;

    const user = await User.findById(authorId).select("_id name email role department").lean();
    if (!user) continue;

    const dept = user.department
      ? await Department.findById(user.department).select("_id name").lean()
      : null;

    await rawCollection.updateOne(
      { _id: rawMsg["_id"] },
      {
        $set: {
          author: { _id: user._id, name: user.name, email: user.email, role: user.role },
          authorDeptSnapshot: dept ? { _id: dept._id, name: dept.name } : null,
        },
      },
    );
    processed++;
    if (processed % 500 === 0) logInfo(`[migrate] DiscussionMessages: ${processed} processed`);
  }

  logInfo(`[migrate] DiscussionMessages done - ${processed} total`);
}

async function migrateAuditLogs(): Promise<void> {
  logInfo("[migrate] Starting AuditLog performer backfill…");
  let processed = 0;

  const rawCollection = mongoose.connection.collection("auditlogs");
  const cursor = rawCollection.find({ performer: { $exists: false }, performedBy: { $exists: true } });

  for await (const rawLog of cursor) {
    const performedById = rawLog["performedBy"] as Types.ObjectId | undefined;
    if (!performedById) continue;

    const user = await User.findById(performedById).select("_id name").lean();
    if (!user) continue;

    await rawCollection.updateOne(
      { _id: rawLog["_id"] },
      { $set: { performer: { _id: user._id, name: user.name } } },
    );
    processed++;
    if (processed % 1000 === 0) logInfo(`[migrate] AuditLogs: ${processed} processed`);
  }

  logInfo(`[migrate] AuditLogs done - ${processed} total`);
}

async function migrateMerchantLogoKeys(): Promise<void> {
  logInfo("[migrate] Starting Merchant logo backfill…");
  let processed = 0;

  // Match merchants that have old-style logoId but no new logo subdoc
  const rawCollection = mongoose.connection.collection("merchants");
  const cursor = rawCollection.find({ logoId: { $ne: null }, logo: { $exists: false } });

  for await (const rawMerchant of cursor) {
    const logoId = rawMerchant["logoId"] as Types.ObjectId | undefined;
    if (!logoId) continue;
    const receipt = await Receipt.findById(logoId).select("s3Key").lean<{ s3Key: string }>();
    if (receipt?.s3Key) {
      await rawCollection.updateOne(
        { _id: rawMerchant["_id"] },
        { $set: { logo: { id: logoId, s3Key: receipt.s3Key } } },
      );
    }
    processed++;
    if (processed % 100 === 0) logInfo(`[migrate] Merchants: ${processed} processed`);
  }

  logInfo(`[migrate] Merchants done - ${processed} total`);
}

async function migrateDepartmentPolicySnapshots(): Promise<void> {
  logInfo("[migrate] Starting Department policySnapshot backfill…");
  let processed = 0;

  const cursor = Department.find({
    policyId: { $ne: null },
    $or: [{ policySnapshot: null }, { policySnapshot: { $exists: false } }],
  }).cursor({ batchSize: BATCH });

  for await (const dept of cursor) {
    if (!dept.policyId) continue;
    const policy = await Policy.findById(dept.policyId).select("_id name").lean<{ _id: Types.ObjectId; name: string }>();
    if (policy) {
      await Department.updateOne(
        { _id: dept._id },
        { $set: { policySnapshot: { _id: policy._id, name: policy.name } } },
      );
    }
    processed++;
    if (processed % 100 === 0) logInfo(`[migrate] Departments: ${processed} processed`);
  }

  logInfo(`[migrate] Departments done - ${processed} total`);
}

async function migrateUserPolicySnapshots(): Promise<void> {
  logInfo("[migrate] Starting User policySnapshot backfill…");
  let processed = 0;

  const cursor = User.find({
    policyId: { $ne: null },
    $or: [{ policySnapshot: null }, { policySnapshot: { $exists: false } }],
  }).cursor({ batchSize: BATCH });

  for await (const user of cursor) {
    if (!user.policyId) continue;
    const policy = await Policy.findById(user.policyId).select("_id name grants").lean<{ _id: Types.ObjectId; name: string; grants: string[] }>();
    if (policy) {
      await User.updateOne(
        { _id: user._id },
        { $set: { policySnapshot: { _id: policy._id, name: policy.name, grants: policy.grants } } },
      );
    }
    processed++;
    if (processed % 500 === 0) logInfo(`[migrate] Users (policy): ${processed} processed`);
  }

  logInfo(`[migrate] Users (policy) done - ${processed} total`);
}

async function migrateExchangeRateCreators(): Promise<void> {
  logInfo("[migrate] Starting ExchangeRateSnapshot creator backfill…");
  let processed = 0;

  const rawCollection = mongoose.connection.collection("exchangeratesnapshots");
  const cursor = rawCollection.find({ creator: { $exists: false } });

  for await (const rawSnap of cursor) {
    const createdById = rawSnap["createdBy"] as Types.ObjectId | undefined;
    if (!createdById) continue;
    const user = await User.findById(createdById).select("_id name").lean<{ _id: Types.ObjectId; name: string }>();
    if (!user) continue;
    await rawCollection.updateOne(
      { _id: rawSnap["_id"] },
      { $set: { creator: { _id: user._id, name: user.name } } },
    );
    processed++;
    if (processed % 500 === 0) logInfo(`[migrate] ExchangeRateSnapshots: ${processed} processed`);
  }

  logInfo(`[migrate] ExchangeRateSnapshots done - ${processed} total`);
}

async function main() {
  await connectToMongoDB();

  try {
    await migrateMerchantLogoKeys();
    await migrateDepartmentPolicySnapshots();
    await migrateUserPolicySnapshots();
    await migrateExchangeRateCreators();
    await migrateUsers();
    await migrateTickets();
    await migrateBundles();
    await migrateDiscussionMessages();
    await migrateAuditLogs();
    logInfo("[migrate] All collections backfilled successfully.");
  } catch (err) {
    logError(err, { message: "Migration failed", code: "MIGRATION_ERROR" });
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();
