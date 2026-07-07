import { z } from "zod";
import { callOpenAiResponses, resolveOpenAiModel } from "./openai-responses";

/**
 * Event-driven re-scoring (rebuild Phase 3.3): interpret today's landscape
 * briefing against a user's latest assessment report. The LLM produces
 * relevance-ranked gap adjustments, an optional bounded score delta, and the
 * user's daily action ("Today, 15 min: ...").
 *
 * This is paid-tier logic, so the failure contract is HARD (mirrors
 * `assessment-report.ts`):
 * - `OPENAI_CONFIG_MISSING` when no API key is configured.
 * - `OPENAI_RESPONSE_FAILED:*` / `OPENAI_EMPTY_RESPONSE` on upstream failures.
 * - `RESCORE_INVALID_OUTPUT:*` when the model output fails validation.
 * There is NO fabricated fallback action — a failed call fails loudly.
 */

export const briefingRescoreSchema = z.object({
  gapAdjustments: z
    .array(
      z.object({
        gapTitle: z.string().min(1).max(200),
        direction: z.enum(["up", "down", "unchanged"]),
        reason: z.string().min(1).max(500),
      }),
    )
    .max(8)
    .default([]),
  scoreDelta: z.preprocess(
    (value) => (value === undefined || value === null ? 0 : value),
    z.number().int().min(-3).max(3),
  ),
  scoreDeltaReason: z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : value ?? ""),
    z.string().max(500),
  ),
  dailyAction: z.object({
    title: z.string().min(1).max(240),
    minutes: z.number().int().min(10).max(20),
    gapRef: z.string().min(1).max(200),
    artifactRef: z
      .preprocess((value) => (value === undefined ? null : value), z.string().max(240).nullable()),
  }),
});

export type BriefingRescore = z.infer<typeof briefingRescoreSchema>;

/** Structural briefing input — compatible with `@aitutor/daily-content`'s DailyBriefing. */
export type RescoreBriefingInput = {
  date: string;
  careerPathName: string;
  topStory: { headline: string; summary: string; source: string; url: string } | null;
  quickHits: Array<{ headline: string; summary: string; source: string; url: string }>;
};

/** Structural report input — compatible with `assessment-report.ts`'s AssessmentReport. */
export type RescoreReportInput = {
  readinessScore: number;
  headline?: string;
  gaps: Array<{ title: string; whyItMatters: string; marketImpact: "high" | "medium" | "low" }>;
};

export type BriefingRescoreInput = {
  briefing: RescoreBriefingInput;
  report: RescoreReportInput;
  careerPathName: string;
  /** Optional: artifact/module titles in flight, so the action can point at one. */
  activeArtifactTitles?: string[];
};

export function buildBriefingRescorePrompt(input: BriefingRescoreInput) {
  const stories = [
    ...(input.briefing.topStory ? [{ ...input.briefing.topStory, kind: "TOP STORY" }] : []),
    ...input.briefing.quickHits.map((hit) => ({ ...hit, kind: "QUICK HIT" })),
  ];

  return [
    "You are the landscape-monitoring engine for My AI Skill Tutor.",
    "Interpret TODAY'S AI landscape briefing against ONE learner's skill-gap report and return STRICT JSON (no markdown, no commentary).",
    "",
    `## Learner career path: ${input.careerPathName}`,
    `Current AI-readiness score: ${input.report.readinessScore}/100`,
    ...(input.report.headline ? [`Report headline: ${input.report.headline}`] : []),
    "",
    "## Learner's open skill gaps (ranked, highest market impact first)",
    ...input.report.gaps.map(
      (gap, index) => `${index + 1}. "${gap.title}" (${gap.marketImpact} impact) — ${gap.whyItMatters}`,
    ),
    "",
    ...(input.activeArtifactTitles?.length
      ? ["## Artifacts/modules currently in flight", ...input.activeArtifactTitles.map((title) => `- ${title}`), ""]
      : []),
    `## Today's briefing (${input.briefing.date})`,
    ...stories.map((story) => `[${story.kind}] ${story.headline} — ${story.summary} (${story.source}; ${story.url})`),
    "",
    "## Output requirements",
    "Return a single JSON object with EXACTLY these keys:",
    '- "gapAdjustments": 0-8 items, each { "gapTitle": one of the learner\'s gap titles COPIED EXACTLY, "direction": "up" | "down" | "unchanged", "reason": one sentence citing a specific briefing story }. Only include gaps whose urgency genuinely changed today; an empty array is a fine answer.',
    '- "scoreDelta": integer between -3 and 3. Move the score ONLY when today\'s briefing meaningfully raises or lowers the bar for this role (e.g. a tool release that automates one of their gaps = the bar rose = negative delta for their relative readiness). Most days this is 0.',
    '- "scoreDeltaReason": one sentence; empty string when scoreDelta is 0. Must reference a briefing story, never invented events.',
    '- "dailyAction": { "title": one concrete task phrased as an imperative, "minutes": integer 10-20, "gapRef": the gap title (copied EXACTLY from the list above) this action closes, "artifactRef": one of the in-flight artifact titles it feeds, or null }.',
    "The daily action must be doable today at a desk, grounded in the briefing or the gap list — never invent tools, URLs, or events not present above.",
  ].join("\n");
}

function stripCodeFences(raw: string) {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function normalizeTitle(value: string) {
  return value.trim().toLowerCase();
}

/**
 * Parse + validate model output. `validGapTitles` anchors the output to the
 * learner's real report: a gapRef or gapTitle that matches none of them is a
 * validation failure (no fabricated gaps).
 */
export function parseBriefingRescore(raw: string, validGapTitles: string[]): BriefingRescore {
  let candidate: unknown;
  try {
    candidate = JSON.parse(stripCodeFences(raw));
  } catch {
    throw new Error("RESCORE_INVALID_OUTPUT:NOT_JSON");
  }

  const parsed = briefingRescoreSchema.safeParse(candidate);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const where = firstIssue ? firstIssue.path.join(".") || "root" : "root";
    throw new Error(`RESCORE_INVALID_OUTPUT:${where}`);
  }

  const valid = new Set(validGapTitles.map(normalizeTitle));

  const gapRef = parsed.data.dailyAction.gapRef;
  if (!valid.has(normalizeTitle(gapRef))) {
    throw new Error("RESCORE_INVALID_OUTPUT:dailyAction.gapRef");
  }

  for (const adjustment of parsed.data.gapAdjustments) {
    if (!valid.has(normalizeTitle(adjustment.gapTitle))) {
      throw new Error("RESCORE_INVALID_OUTPUT:gapAdjustments.gapTitle");
    }
  }

  if (parsed.data.scoreDelta !== 0 && !parsed.data.scoreDeltaReason.trim()) {
    throw new Error("RESCORE_INVALID_OUTPUT:scoreDeltaReason");
  }

  return parsed.data;
}

export async function generateBriefingRescore(
  input: BriefingRescoreInput,
  options: { callLlm?: typeof callOpenAiResponses } = {},
): Promise<{ rescore: BriefingRescore; model: string }> {
  const model = resolveOpenAiModel();
  const prompt = buildBriefingRescorePrompt(input);
  const callLlm = options.callLlm ?? callOpenAiResponses;

  let raw: string;
  try {
    raw = await callLlm({
      prompt,
      model,
      temperature: 0.2,
      textFormat: { type: "json_object" },
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("OPENAI_API_KEY_MISSING")) {
      throw new Error("OPENAI_CONFIG_MISSING");
    }
    throw error;
  }

  const rescore = parseBriefingRescore(
    raw,
    input.report.gaps.map((gap) => gap.title),
  );
  return { rescore, model };
}
