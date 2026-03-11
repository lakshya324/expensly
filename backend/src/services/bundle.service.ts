/**
 * Bundle Service — STUB
 *
 * All methods return 501 Not Implemented until the Expense Bundling feature is built.
 * Type signatures are intentionally defined here so that the controller can import them
 * without needing changes when the feature ships.
 */
import { createError } from "../utils/error.js";
import { IBundleData } from "../types/bundle.types.js";

// ─── Stub signatures (types only — no real logic yet) ────────────────────────

export interface CreateBundleInput {
  orgId: string;
  name: string;
  ticketIds: string[];
  submittedBy: string;
}

export interface UpdateBundleInput {
  name?: string;
  ticketIds?: string[];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const createBundle = async (_input: CreateBundleInput): Promise<IBundleData> => {
  throw createError("Expense Bundling is not yet implemented", 501, "NOT_IMPLEMENTED");
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const listBundles = async (_orgId: string): Promise<IBundleData[]> => {
  throw createError("Expense Bundling is not yet implemented", 501, "NOT_IMPLEMENTED");
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const getBundle = async (_orgId: string, _bundleId: string): Promise<IBundleData> => {
  throw createError("Expense Bundling is not yet implemented", 501, "NOT_IMPLEMENTED");
};

export const updateBundle = async (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _orgId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _bundleId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _input: UpdateBundleInput,
): Promise<IBundleData> => {
  throw createError("Expense Bundling is not yet implemented", 501, "NOT_IMPLEMENTED");
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const submitBundle = async (_orgId: string, _bundleId: string): Promise<IBundleData> => {
  throw createError("Expense Bundling is not yet implemented", 501, "NOT_IMPLEMENTED");
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const deleteBundle = async (_orgId: string, _bundleId: string): Promise<void> => {
  throw createError("Expense Bundling is not yet implemented", 501, "NOT_IMPLEMENTED");
};
