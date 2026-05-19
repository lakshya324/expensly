import { AiValidationStatus } from "../config/constants.js";

/** Result of a single automated check */
export interface IValidationCheck {
  /** Human-readable label for the check */
  label: string;
  /** Whether the check passed */
  passed: boolean;
  /** Model confidence score 0–1 */
  confidence: number | null;
  /** Extra detail the reviewer might find useful */
  detail: string | null;
}

/**
 * Aggregated result of the AI validation pipeline for a ticket.
 *
 * NOTE: This is advisory - the AI never approves or rejects automatically.
 * It produces a summary that helps human reviewers make faster decisions.
 */
export interface IAiValidationResult {
  status: AiValidationStatus;
  checks: IValidationCheck[];
  /** Short natural-language summary for the reviewer ("All checks passed.", "Receipt amount mismatch detected.") */
  summary: string | null;
  /** ISO timestamp of when the validation ran */
  validatedAt: string | null;
  // ─── AI-extracted fields (populated on the scanning→draft transition) ────
  /** Suggested expense title extracted from raw receipt text */
  suggestedTitle: string | null;
  /** Suggested total amount extracted from raw receipt text */
  suggestedAmount: number | null;
  /** Suggested ISO 4217 currency code extracted from raw receipt text */
  suggestedCurrency: string | null;
  /** Suggested transaction date in YYYY-MM-DD format */
  suggestedDate: string | null;
  /** Merchant name as it appears on the receipt */
  suggestedMerchantName: string | null;
  /** Suggested category name inferred from receipt context */
  suggestedCategoryName: string | null;
  /** Suggested description inferred from receipt context */
  suggestedDescription: string | null;
  /** Fallback merchant text when no structured merchant match is found */
  unmatchedMerchantSuggestionText: string | null;
  /** Fallback category text when no structured category match is found */
  unmatchedCategorySuggestionText: string | null;
}
