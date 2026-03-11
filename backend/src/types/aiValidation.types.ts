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
 * NOTE: This is advisory — the AI never approves or rejects automatically.
 * It produces a summary that helps human reviewers make faster decisions.
 */
export interface IAiValidationResult {
  status: AiValidationStatus;
  checks: IValidationCheck[];
  /** Short natural-language summary for the reviewer ("All checks passed.", "Receipt amount mismatch detected.") */
  summary: string | null;
  /** ISO timestamp of when the validation ran */
  validatedAt: string | null;
}
