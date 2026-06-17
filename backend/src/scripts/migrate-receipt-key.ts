/**
 * One-time migration: receiptKey → receiptKeys
 *
 * Background:
 *   Tickets previously stored a single receipt as `receiptKey: string | null`.
 *   The field has been replaced with `receiptKeys: string[]` to support
 *   multiple receipts per ticket (required for AI OCR, expense bundling, etc.).
 *
 * What this script does:
 *   1. For every Ticket where `receiptKey` is a non-null string:
 *      → Set `receiptKeys = [receiptKey]`
 *   2. For every Ticket where `receiptKey` is null (or missing):
 *      → Set `receiptKeys = []`   (field initialisation only)
 *   3. Unset the old `receiptKey` field from all documents.
 *
 * Safe to re-run: the $set + $unset operations are idempotent.
 *
 * Usage:
 *   npx ts-node --esm src/scripts/migrate-receipt-key.ts
 *
 * Run against dev DB first, verify, then run against prod.
 * Coordinate the deploy so that backend + frontend land together AFTER
 * this script completes (frontend reads receiptKeys[0] instead of receiptKey).
 */

import mongoose from "mongoose";
import config from "../config/env.config.js";
import { logInfo, logSuccess, logError } from "../utils/logger.js";

async function run() {
  await mongoose.connect(config.mongodbUri);
  logInfo("Connected to MongoDB. Starting migration…");

  const collection = mongoose.connection.collection("tickets");

  // Step 1 - Documents WITH a non-null receiptKey: wrap it in an array.
  const withKey = await collection.updateMany(
    { receiptKey: { $type: "string" } }, // matches non-null string values
    [
      {
        $set: {
          receiptKeys: { $cond: [{ $ifNull: ["$receiptKey", false] }, ["$receiptKey"], []] },
        },
      },
      { $unset: "receiptKey" },
    ],
  );
  logSuccess(
    `Migrated ${withKey.modifiedCount} ticket(s) with a receipt (receiptKey → receiptKeys[0]).`,
  );

  // Step 2 - Documents WITHOUT a receiptKey (null or field absent): initialise to [].
  const withoutKey = await collection.updateMany(
    {
      $and: [
        { receiptKey: { $in: [null] } },
        { receiptKeys: { $exists: false } },
      ],
    },
    { $set: { receiptKeys: [] }, $unset: { receiptKey: "" } },
  );
  logSuccess(
    `Initialised ${withoutKey.modifiedCount} ticket(s) without a receipt (receiptKeys = []).`,
  );

  // Step 3 - Belt-and-suspenders: unset any remaining receiptKey fields
  // (handles documents already having receiptKeys from a partial prior run).
  const cleanup = await collection.updateMany(
    { receiptKey: { $exists: true } },
    { $unset: { receiptKey: "" } },
  );
  if (cleanup.modifiedCount > 0) {
    logInfo(`Cleaned up ${cleanup.modifiedCount} residual receiptKey field(s).`);
  }

  logSuccess("Migration complete. Closing connection.");
  await mongoose.disconnect();
}

run().catch((err) => {
  logError(err, { message: "Migration failed", code: "MIGRATION_ERROR" });
  process.exit(1);
});
