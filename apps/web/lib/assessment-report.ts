import "server-only";

import { z } from "zod";
import { CAREER_PATHS, getCareerPath } from "@aitutor/shared";
import { callOpenAiResponses, resolveOpenAiModel } from "@/lib/openai-responses";

/**
 * LLM-generated skill-gap report anchored on a persistent 0-100 AI-readiness
 * score. This module intentionally lives outside `runtime.ts` (extract, never
 * extend) and reuses the shared OpenAI Responses plumbing.
 *
 * Failure contract (matches the repo's `OPENAI_CONFIG_MISSING` style):
 * - `OPENAI_CONFIG_MISSING` when no API key is configured.
 * - `OPENAI_RESPONSE_FAILED:*` / `OPENAI_EMPTY_RESPONSE` on upstream failures.
 * - `ASSESSMENT_REPORT_INVALID_OUTPUT` when the model output fails validation.
 * There is NO fallback to rule-based report text — a failed generation fails loudly.
 */

export {
  ASSESSMENT_QUIZ_QUESTIONS,
  type AssessmentQuizQuestionId,
  type AssessmentAnswer,
} from "@/lib/assessment-quiz";

import { ASSESSMENT_QUIZ_QUESTIONS } from "@/lib/assessment-quiz";
import type { AssessmentAnswer } from "@/lib/assessment-quiz";

/**
 * Same formula as the legacy deterministic scorer in `runtimeSubmitAssessment`
 * (`runtime.ts:1719`): average answer value normalized against a max of 5,
 * rounded to 4 decimal places. Kept as an input signal for the LLM report —
 * it is no longer the deliverable.
 */
export function computeDeterministicAssessmentScore(answers: AssessmentAnswer[]) {
  const total = answers.reduce((sum, answer) => sum + Number(answer.value || 0), 0);
  return Number((answers.length ? total / answers.length / 5 : 0).toFixed(4));
}

const CAREER_PATH_IDS = CAREER_PATHS.map((path) => path.id);

const careerPathIdSchema = z
  .string()
  .refine((value) => CAREER_PATH_IDS.includes(value), { message: "UNKNOWN_CAREER_PATH" });

export const assessmentReportSchema = z.object({
  readinessScore: z.preprocess(
    (value) => (typeof value === "number" && Number.isFinite(value) ? Math.round(value) : value),
    z.number().int().min(0).max(100),
  ),
  headline: z.string().min(1).max(300),
  summary: z.string().min(1),
  strengths: z
    .array(
      z.object({
        title: z.string().min(1),
        detail: z.string().min(1),
      }),
    )
    .min(1)
    .max(8),
  gaps: z
    .array(
      z.object({
        title: z.string().min(1),
        whyItMatters: z.string().min(1),
        marketImpact: z.enum(["high", "medium", "low"]),
      }),
    )
    .min(1)
    .max(8),
  recommendedPath: z.object({
    careerPathId: careerPathIdSchema,
    reason: z.string().min(1),
  }),
  thirtyDayPlan: z
    .array(
      z.object({
        week: z.number().int().min(1).max(5),
        focus: z.string().min(1),
        actions: z.array(z.string().min(1)).min(1).max(6),
        /**
         * Spine phase 1: the catalog module this week advances — the plan is
         * the learner's per-user module ORDERING. Optional so reports
         * generated before this field keep parsing (backward compatible).
         * Normalized to an exact catalog string in `parseAssessmentReport`;
         * unmatched titles are dropped, never invented.
         */
        moduleTitle: z.string().min(1).max(160).optional(),
      }),
    )
    .min(1)
    .max(6),
});

export type AssessmentReport = z.infer<typeof assessmentReportSchema>;

export type AssessmentReportInput = {
  role: {
    careerPathId?: string | null;
    careerCategoryLabel?: string | null;
    jobTitle?: string | null;
    yearsExperience?: string | null;
    companySize?: string | null;
    situation?: string | null;
  };
  goals: string[];
  aiComfort?: number | null;
  answers: AssessmentAnswer[];
  linkedinUrl?: string | null;
  resumeText?: string | null;
  deterministicScore: number;
};

function quizAnswerLines(answers: AssessmentAnswer[]) {
  const byId = new Map(ASSESSMENT_QUIZ_QUESTIONS.map((entry) => [entry.id as string, entry]));
  return answers.map((answer) => {
    const question = byId.get(answer.questionId);
    const label = question ? question.question : answer.questionId;
    return `- ${answer.questionId} — "${label}": ${answer.value}/5`;
  });
}

function careerPathCatalogLines() {
  return CAREER_PATHS.map(
    (path) => `- id: ${path.id} | ${path.name} | focus: ${path.coreSkillDomain} | modules: ${path.modules.join(", ")}`,
  );
}

export function buildAssessmentReportPrompt(input: AssessmentReportInput) {
  const signalPct = Math.round(Math.max(0, Math.min(1, input.deterministicScore)) * 100);
  const resumeExcerpt = input.resumeText?.trim() ? input.resumeText.trim().slice(0, 6000) : null;

  return [
    "You are the assessment engine for My AI Skill Tutor, an AI upskilling product for working professionals.",
    "Produce a personalized AI skill-gap report as STRICT JSON (no markdown, no commentary).",
    "",
    "## Learner profile",
    `Role category: ${input.role.careerCategoryLabel ?? "Unknown"}`,
    `Job title: ${input.role.jobTitle ?? "Not provided"}`,
    `Years of experience: ${input.role.yearsExperience ?? "Not provided"}`,
    `Company size: ${input.role.companySize ?? "Not provided"}`,
    `Current situation: ${input.role.situation ?? "Not provided"}`,
    `Self-selected career path id: ${input.role.careerPathId ?? "none"}`,
    `Goals: ${input.goals.length ? input.goals.join(", ") : "none provided"}`,
    `Self-rated AI comfort (1-5): ${input.aiComfort ?? "not provided"}`,
    `LinkedIn: ${input.linkedinUrl ?? "not provided"}`,
    "",
    "## Quiz answers (1 = low, 5 = high)",
    ...quizAnswerLines(input.answers),
    "",
    `## Deterministic baseline signal`,
    `A rule-based scorer rated this learner ${signalPct}/100. Use it only as a weak prior; your score should reflect the full context above and may differ.`,
    "",
    ...(resumeExcerpt ? ["## Resume / LinkedIn text (verbatim from the learner)", resumeExcerpt, ""] : []),
    "## Career path catalog (recommendedPath.careerPathId MUST be exactly one of these ids)",
    ...careerPathCatalogLines(),
    "",
    "## Output requirements",
    "Return a single JSON object with EXACTLY these keys:",
    '- "readinessScore": integer 0-100. This is the learner\'s AI-readiness score for THEIR role: how prepared they are to use AI to stay competitive. Be calibrated and honest — most professionals today land between 25 and 70. Do not inflate.',
    '- "headline": one punchy sentence (max 140 chars) summarizing their situation. Specific to them, not generic.',
    '- "summary": 2-4 sentences interpreting their situation against where their role\'s market is heading.',
    '- "strengths": 2-4 items, each { "title": short phrase, "detail": one sentence grounded in their answers/resume }.',
    '- "gaps": 3-5 items RANKED by market impact (highest first), each { "title": short phrase, "whyItMatters": one sentence tied to their role\'s market, "marketImpact": "high" | "medium" | "low" }.',
    '- "recommendedPath": { "careerPathId": one id from the catalog above, "reason": one sentence }.',
    '- "thirtyDayPlan": exactly 4 items, one per week, each { "week": 1-4, "focus": short phrase, "moduleTitle": one module name COPIED EXACTLY from the modules list of the career path you chose in recommendedPath, "actions": 2-3 concrete actions doable in under an hour each }. Sequence the four moduleTitles so they close this learner\'s highest-impact gaps first — this becomes their personal module order.',
    "Ground every claim in the provided context. Never invent employers, tools, or history the learner did not mention.",
  ].join("\n");
}

function stripCodeFences(raw: string) {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function moduleTitleKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Normalize a model-emitted plan module title to an EXACT catalog string
 * (spine phase 1). Accepts case/whitespace/punctuation near-misses and
 * unambiguous containment (e.g. "AI Wireframing module" -> "AI Wireframing").
 * Returns undefined when nothing matches or the match is ambiguous — a plan
 * week never points at a module that does not exist.
 */
export function normalizePlanModuleTitle(
  raw: string | null | undefined,
  catalogModuleTitles: string[],
): string | undefined {
  const key = moduleTitleKey(String(raw ?? ""));
  if (!key) return undefined;

  const exact = catalogModuleTitles.find((title) => moduleTitleKey(title) === key);
  if (exact) return exact;

  const candidates = catalogModuleTitles.filter((title) => {
    const catalogKey = moduleTitleKey(title);
    if (catalogKey.length < 4 || key.length < 4) return false;
    return key.includes(catalogKey) || catalogKey.includes(key);
  });
  return candidates.length === 1 ? candidates[0] : undefined;
}

/**
 * Normalize every plan week's moduleTitle against the recommended path's
 * module catalog. Unmatched titles are removed (the week keeps its focus and
 * actions), so downstream consumers only ever see exact catalog strings.
 */
export function normalizeReportPlanModuleTitles(report: AssessmentReport): AssessmentReport {
  const catalog = getCareerPath(report.recommendedPath.careerPathId)?.modules ?? [];
  return {
    ...report,
    thirtyDayPlan: report.thirtyDayPlan.map((week) => {
      const { moduleTitle, ...rest } = week;
      const normalized = normalizePlanModuleTitle(moduleTitle, catalog);
      return normalized ? { ...rest, moduleTitle: normalized } : rest;
    }),
  };
}

export function parseAssessmentReport(raw: string): AssessmentReport {
  let candidate: unknown;
  try {
    candidate = JSON.parse(stripCodeFences(raw));
  } catch {
    throw new Error("ASSESSMENT_REPORT_INVALID_OUTPUT:NOT_JSON");
  }

  const parsed = assessmentReportSchema.safeParse(candidate);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const where = firstIssue ? firstIssue.path.join(".") || "root" : "root";
    throw new Error(`ASSESSMENT_REPORT_INVALID_OUTPUT:${where}`);
  }
  return normalizeReportPlanModuleTitles(parsed.data);
}

export async function generateAssessmentReport(input: AssessmentReportInput): Promise<{
  report: AssessmentReport;
  model: string;
}> {
  const model = resolveOpenAiModel();
  const prompt = buildAssessmentReportPrompt(input);

  let raw: string;
  try {
    raw = await callOpenAiResponses({
      prompt,
      model,
      temperature: 0.4,
      textFormat: { type: "json_object" },
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("OPENAI_API_KEY_MISSING")) {
      throw new Error("OPENAI_CONFIG_MISSING");
    }
    throw error;
  }

  const report = parseAssessmentReport(raw);
  return { report, model };
}
