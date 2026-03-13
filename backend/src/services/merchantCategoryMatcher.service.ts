import { Types } from "mongoose";
import { openai } from "../config/openai.config.js";
import config from "../config/env.config.js";
import { Category } from "../models/Category.model.js";
import { Merchant } from "../models/Merchant.model.js";
import { logError } from "../utils/logger.js";

const MAX_CANDIDATES = 50;

interface Candidate {
  _id: string;
  name: string;
  normalizedName: string;
}

interface MatchInput {
  orgId: string;
  suggestedMerchantName: string | null;
  suggestedCategoryName: string | null;
}

interface MatchOutput {
  merchantId: Types.ObjectId | null;
  categoryId: Types.ObjectId | null;
  unmatchedMerchantSuggestionText: string | null;
  unmatchedCategorySuggestionText: string | null;
}

interface EntityMatchResponse {
  merchantId: string | null;
  categoryId: string | null;
}

function normalizeText(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function scoreCandidate(input: string | null, candidate: Candidate): number {
  if (!input) return 0;

  const normalizedInput = normalizeText(input);
  if (!normalizedInput) return 0;

  const normalizedCandidate = normalizeText(candidate.normalizedName || candidate.name);
  if (!normalizedCandidate) return 0;

  if (normalizedCandidate === normalizedInput) return 1;
  if (normalizedCandidate.includes(normalizedInput) || normalizedInput.includes(normalizedCandidate)) {
    return 0.92;
  }

  const inputTokens = new Set(normalizedInput.split(" "));
  const candidateTokens = new Set(normalizedCandidate.split(" "));
  const overlapCount = [...inputTokens].filter((token) => candidateTokens.has(token)).length;
  const maxSize = Math.max(inputTokens.size, candidateTokens.size, 1);

  return overlapCount / maxSize;
}

function findDeterministicMatch(input: string | null, candidates: Candidate[]): Candidate | null {
  if (!input) return null;

  const ranked = candidates
    .map((candidate) => ({ candidate, score: scoreCandidate(input, candidate) }))
    .sort((a, b) => b.score - a.score);

  const top = ranked[0];
  if (!top) return null;

  return top.score >= 0.92 ? top.candidate : null;
}

async function disambiguateWithAi(
  suggestedMerchantName: string | null,
  suggestedCategoryName: string | null,
  merchantCandidates: Candidate[],
  categoryCandidates: Candidate[],
): Promise<EntityMatchResponse> {
  const completion = await openai.chat.completions.create({
    model: config.openai.model,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: `You are matching extracted expense entities to existing lists.
Return ONLY valid JSON:
{
  "merchantId": "id from merchantCandidates or null",
  "categoryId": "id from categoryCandidates or null"
}

Rules:
- Only return an id if there is a strong semantic match.
- If no confident match exists, return null for that field.
- Never invent ids.

Input:
${JSON.stringify(
  {
    suggestedMerchantName,
    suggestedCategoryName,
    merchantCandidates: merchantCandidates.map(({ _id, name }) => ({ _id, name })),
    categoryCandidates: categoryCandidates.map(({ _id, name }) => ({ _id, name })),
  },
  null,
  2,
)}`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as EntityMatchResponse;

  return {
    merchantId: typeof parsed.merchantId === "string" ? parsed.merchantId : null,
    categoryId: typeof parsed.categoryId === "string" ? parsed.categoryId : null,
  };
}

export async function resolveMerchantAndCategoryMatches(input: MatchInput): Promise<MatchOutput> {
  const { orgId, suggestedMerchantName, suggestedCategoryName } = input;

  const [merchants, categories] = await Promise.all([
    Merchant.find({ orgId: new Types.ObjectId(orgId), isActive: true })
      .sort({ name: 1 })
      .limit(MAX_CANDIDATES)
      .select("_id name normalizedName")
      .lean(),
    Category.find({ orgId: new Types.ObjectId(orgId), isActive: true })
      .sort({ name: 1 })
      .limit(MAX_CANDIDATES)
      .select("_id name normalizedName")
      .lean(),
  ]);

  const merchantCandidates: Candidate[] = merchants.map((merchant) => ({
    _id: merchant._id.toString(),
    name: merchant.name,
    normalizedName: merchant.normalizedName,
  }));

  const categoryCandidates: Candidate[] = categories.map((category) => ({
    _id: category._id.toString(),
    name: category.name,
    normalizedName: category.normalizedName,
  }));

  const deterministicMerchant = findDeterministicMatch(suggestedMerchantName, merchantCandidates);
  const deterministicCategory = findDeterministicMatch(suggestedCategoryName, categoryCandidates);

  let merchantId = deterministicMerchant ? new Types.ObjectId(deterministicMerchant._id) : null;
  let categoryId = deterministicCategory ? new Types.ObjectId(deterministicCategory._id) : null;

  if (!merchantId || !categoryId) {
    try {
      const aiResolved = await disambiguateWithAi(
        suggestedMerchantName,
        suggestedCategoryName,
        merchantCandidates,
        categoryCandidates,
      );

      if (!merchantId && aiResolved.merchantId && merchantCandidates.some((m) => m._id === aiResolved.merchantId)) {
        merchantId = new Types.ObjectId(aiResolved.merchantId);
      }
      if (!categoryId && aiResolved.categoryId && categoryCandidates.some((c) => c._id === aiResolved.categoryId)) {
        categoryId = new Types.ObjectId(aiResolved.categoryId);
      }
    } catch (error) {
      logError(error as Error, {
        message: "AI disambiguation for merchant/category failed",
        code: "AI_MATCH_DISAMBIGUATION_FAILED",
      });
    }
  }

  return {
    merchantId,
    categoryId,
    unmatchedMerchantSuggestionText: merchantId ? null : suggestedMerchantName,
    unmatchedCategorySuggestionText: categoryId ? null : suggestedCategoryName,
  };
}
