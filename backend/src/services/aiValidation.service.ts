/**
 * AI Validation Service — OpenAI GPT
 *
 * Runs 5 structured checks against a ticket and its OCR data using GPT-4o-mini.
 * - Receipt amount match
 * - Merchant recognition
 * - Date validity
 * - Currency consistency
 * - Duplicate / anomaly flag
 *
 * This service is purely advisory — it NEVER auto-approves or auto-rejects.
 * Results are stored on the ticket and surfaced to reviewers.
 */
import { ITicket } from "../types/ticket.types.js";
import { IAiValidationResult, IValidationCheck } from "../types/aiValidation.types.js";
import { AI_VALIDATION_STATUS } from "../config/constants.js";
import { IOcrData } from "../types/ocr.types.js";
import config from "../config/env.config.js";
import { logError } from "../utils/logger.js";
import { openai } from "../config/openai.config.js";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CheckResult {
  label: string;
  passed: boolean;
  confidence: number | null;
  detail: string | null;
}

interface GptValidationResponse {
  checks: CheckResult[];
  summary: string;
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(ticket: ITicket, ocrData?: IOcrData | null): string {
  return `You are an expense validation assistant. Analyse the following expense ticket and its OCR-extracted receipt data, then return a structured JSON validation report.

## Ticket
- Title: ${ticket.title}
- Amount: ${ticket.amount} ${ticket.currency}
- Description: ${ticket.description}
- Tags: ${ticket.tags.join(", ") || "none"}
- Expense type: ${ticket.expenseType}

## OCR Data (from receipt image)
${
  ocrData
    ? `- Merchant: ${ocrData.merchantName ?? "unknown"}
- Amount: ${ocrData.amount ?? "unknown"} ${ocrData.currency ?? ""}
- Date: ${ocrData.transactionDate ?? "unknown"}
- Confidence: ${ocrData.confidence != null ? `${Math.round(ocrData.confidence * 100)}%` : "unknown"}`
    : "No OCR data available."
}

## Your task
Respond ONLY with a valid JSON object matching this schema (no markdown, no extra text):
{
  "checks": [
    {
      "label": "Amount Match",
      "passed": true | false,
      "confidence": 0.0–1.0 or null,
      "detail": "short explanation"
    },
    {
      "label": "Merchant Recognition",
      "passed": true | false,
      "confidence": 0.0–1.0 or null,
      "detail": "short explanation"
    },
    {
      "label": "Date Validity",
      "passed": true | false,
      "confidence": 0.0–1.0 or null,
      "detail": "short explanation"
    },
    {
      "label": "Currency Consistency",
      "passed": true | false,
      "confidence": 0.0–1.0 or null,
      "detail": "short explanation"
    },
    {
      "label": "Anomaly / Duplicate Risk",
      "passed": true | false,
      "confidence": 0.0–1.0 or null,
      "detail": "short explanation"
    }
  ],
  "summary": "One-sentence natural-language summary for the reviewer."
}`;
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Run AI validation checks against a ticket and its OCR data.
 */
export const validateTicket = async (
  ticket: ITicket,
  ocrData?: IOcrData | null,
): Promise<IAiValidationResult> => {
  try {
    const completion = await openai.chat.completions.create({
      model: config.openai.model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: buildPrompt(ticket, ocrData),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed: GptValidationResponse = JSON.parse(raw);

    const checks: IValidationCheck[] = (parsed.checks ?? []).map((c) => ({
      label: c.label,
      passed: !!c.passed,
      confidence: typeof c.confidence === "number" ? c.confidence : null,
      detail: c.detail ?? null,
    }));

    const allPassed = checks.length > 0 && checks.every((c) => c.passed);
    const anyFailed = checks.some((c) => !c.passed);

    return {
      status: allPassed
        ? AI_VALIDATION_STATUS.PASSED
        : anyFailed
          ? AI_VALIDATION_STATUS.FLAGGED
          : AI_VALIDATION_STATUS.PASSED,
      checks,
      summary: parsed.summary ?? null,
      validatedAt: new Date().toISOString(),
    };
  } catch (err) {
    logError(err as Error, {
      message: "AI validation failed",
      code: "AI_VALIDATION_ERROR",
    });
    return {
      status: AI_VALIDATION_STATUS.ERROR,
      checks: [],
      summary: "Validation could not be completed due to an internal error.",
      validatedAt: new Date().toISOString(),
    };
  }
};

