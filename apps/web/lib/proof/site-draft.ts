import "server-only";
import {
  getCareerMapTitle,
  normalizeForGrounding,
  proofSiteDraftSchema,
  resolveOpenAiModel,
  type CareerMap,
  type ProofSiteDraft,
} from "@aitutor/shared";
import { callOpenAiResponses } from "@/lib/openai-responses";

/**
 * Drafts the proof site copy (tagline, bio, translations) from the learner's
 * career map. Grounded only in the map and the learner's name: no employers,
 * numbers or results that are not already in the map. Hard-failure contract:
 * invalid or ungrounded output throws PROOF_SITE_DRAFT_INVALID_OUTPUT:<reason>,
 * a missing key throws OPENAI_CONFIG_MISSING. Nothing is ever filled in.
 */

export type ProofSiteDraftProfile = { name: string };

export type ProofSiteDraftResult = {
  draft: ProofSiteDraft;
  model: string;
  /** Deterministic fields taken straight from the map, for the editor to prefill. */
  newTitle: string;
  previousRole: string;
};

function mapSourceText(map: CareerMap, profile: ProofSiteDraftProfile) {
  const title = getCareerMapTitle(map.primary.titleId);
  return [
    profile.name,
    map.person.displayName ?? "",
    map.person.previousTitle,
    map.person.previousField,
    map.person.yearsExperience ?? "",
    title?.title ?? "",
    title?.blurb ?? "",
    map.primary.summary,
    ...map.translations.flatMap((row) => [row.before, row.evidence, row.now, row.explanation]),
    ...map.gaps.flatMap((row) => [row.gap, row.closeWith]),
    map.proofPlan.site.headline,
    map.proofPlan.site.summary,
  ].join("\n");
}

export function buildProofSiteDraftPrompt(input: { map: CareerMap; profile: ProofSiteDraftProfile; strict?: boolean }): string {
  const { map, profile } = input;
  const title = getCareerMapTitle(map.primary.titleId);
  const facts = {
    name: profile.name,
    previousTitle: map.person.previousTitle,
    previousField: map.person.previousField,
    yearsExperience: map.person.yearsExperience,
    newTitle: title?.title ?? map.primary.titleId,
    newTitleMeans: title?.blurb ?? null,
    mapSummary: map.primary.summary,
    siteHeadline: map.proofPlan.site.headline,
    translations: map.translations.map((row) => ({ before: row.before, now: row.now, why: row.explanation })),
  };

  return [
    "You write the copy for a person's public proof page: a one-page site that shows an employer what they did before and the AI-era job it maps to.",
    "Write in the first person, as the person. Plain, short sentences. No hype words (unlock, seamless, supercharge, game-changer, passionate, cutting-edge). No emoji.",
    "",
    "Use ONLY the facts below. Grounding rules (strict):",
    "- Do not name any employer, studio, client, school or product that is not written in the facts.",
    "- Do not add any number, percentage, date, count or result that is not written in the facts. If a number appears, copy it exactly.",
    "- Do not claim work the person has not done, tools they have not used, or results they have not reported.",
    "- Each translation must come from one translation in the facts: keep its meaning, you may shorten it.",
    input.strict
      ? "- Your last answer broke these rules. This time copy each translation's before and now exactly as written in the facts, and use no digits anywhere except copied from the facts."
      : "",
    "",
    "FACTS (JSON):",
    JSON.stringify(facts, null, 2),
    "",
    "Return STRICT JSON with exactly these keys:",
    "{",
    '  "tagline": string, 8-110 characters. One sentence in the first person on what the person does now, built from the translations (e.g. "I turn launch plans into AI workflows and player emails into brand-voice prompts.").',
    '  "bio": string, 40-600 characters. Two to four first-person sentences: what they did before, what they do now, and what they are building next. Only the facts.',
    '  "translations": array of 2-6 objects { "before": string 4-110 chars, "now": string 4-70 chars }, in the same order as the facts.',
    "}",
    "Return the JSON object only.",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function stripFences(raw: string) {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export function parseProofSiteDraft(raw: string): ProofSiteDraft {
  let json: unknown;
  try {
    json = JSON.parse(stripFences(raw));
  } catch {
    throw new Error("PROOF_SITE_DRAFT_INVALID_OUTPUT:NOT_JSON");
  }
  const parsed = proofSiteDraftSchema.safeParse(json);
  if (!parsed.success) {
    const path = parsed.error.issues[0]?.path.join(".") || "ROOT";
    throw new Error(`PROOF_SITE_DRAFT_INVALID_OUTPUT:${path}`);
  }
  return parsed.data;
}

const STOP_WORDS = new Set(["a", "an", "the", "and", "or", "of", "to", "for", "in", "on", "with", "at", "by", "from", "into", "as", "is", "my", "i"]);

function contentWords(text: string) {
  return normalizeForGrounding(text)
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

function overlapRatio(candidate: string, reference: string) {
  const words = contentWords(candidate);
  if (!words.length) return 0;
  const ref = new Set(contentWords(reference));
  return words.filter((word) => ref.has(word)).length / words.length;
}

/**
 * Returns null when the draft is grounded in the map, otherwise the reason.
 * Checks: every digit run in the draft appears in the source facts, and every
 * translation shares most of its words with one translation on the map.
 */
export function findProofSiteDraftGroundingIssue(draft: ProofSiteDraft, map: CareerMap, profile: ProofSiteDraftProfile): string | null {
  const source = normalizeForGrounding(mapSourceText(map, profile));
  const sourceNumbers = new Set(source.match(/\d+(?:[.,]\d+)?/g) ?? []);
  const draftText = [draft.tagline, draft.bio, ...draft.translations.flatMap((row) => [row.before, row.now])].join("\n");
  for (const number of normalizeForGrounding(draftText).match(/\d+(?:[.,]\d+)?/g) ?? []) {
    if (!sourceNumbers.has(number)) return "UNGROUNDED_NUMBER";
  }

  for (const row of draft.translations) {
    const grounded = map.translations.some((ref) => {
      const before = overlapRatio(row.before, `${ref.before} ${ref.evidence}`);
      const now = overlapRatio(row.now, `${ref.now} ${ref.explanation}`);
      return before >= 0.5 && now >= 0.5;
    });
    if (!grounded) return "UNGROUNDED_TRANSLATION";
  }
  return null;
}

export function proofSitePreviousRole(map: CareerMap): string {
  return map.person.previousTitle;
}

export async function draftProofSite(input: { map: CareerMap; profile: ProofSiteDraftProfile }): Promise<ProofSiteDraftResult> {
  const model = resolveOpenAiModel();
  const title = getCareerMapTitle(input.map.primary.titleId);
  let lastIssue = "UNGROUNDED";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let raw: string;
    try {
      raw = await callOpenAiResponses({
        prompt: buildProofSiteDraftPrompt({ ...input, strict: attempt > 0 }),
        model,
        temperature: attempt > 0 ? 0.2 : 0.5,
        textFormat: { type: "json_object" },
        maxOutputTokens: 1200,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.startsWith("OPENAI_API_KEY_MISSING")) {
        throw new Error("OPENAI_CONFIG_MISSING");
      }
      throw error;
    }

    const draft = parseProofSiteDraft(raw);
    const issue = findProofSiteDraftGroundingIssue(draft, input.map, input.profile);
    if (!issue) {
      return {
        draft,
        model,
        newTitle: title?.title ?? input.map.primary.titleId,
        previousRole: proofSitePreviousRole(input.map),
      };
    }
    lastIssue = issue;
  }

  throw new Error(`PROOF_SITE_DRAFT_INVALID_OUTPUT:${lastIssue}`);
}
