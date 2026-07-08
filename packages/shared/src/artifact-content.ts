import { z } from "zod";
import { callOpenAiResponses, resolveOpenAiModel } from "./openai-responses";
import type { ArtifactKind } from "./types";

/**
 * Real artifact content generation (Phase 2.1 of the rebuild).
 *
 * Produces personalized, structured artifact content (website copy, resume
 * content, deck outlines, project briefs) from the learner's profile, their
 * assessment report, the module playbook, and completed-module evidence.
 * The structured JSON is persisted (see `project_artifact_contents`) and fed
 * to the existing HTML/PDF/DOCX/PPTX writers in
 * `apps/web/app/generated/[...slug]/route.ts`.
 *
 * Failure contract (no silent fallbacks, no placeholders):
 * - `OPENAI_CONFIG_MISSING` when no API key is configured.
 * - `OPENAI_RESPONSE_FAILED:*` / `OPENAI_EMPTY_RESPONSE` on upstream failures.
 * - `ARTIFACT_CONTENT_INVALID_OUTPUT:*` when the model output fails validation.
 * - `ARTIFACT_KIND_NOT_GENERATABLE:*` for kinds that have no generator.
 * A failed generation MUST mark the job failed and MUST NOT flip project or
 * skill state — callers never emit the legacy title+timestamp placeholder.
 */

export type ArtifactContentKind = "website" | "resume" | "deck" | "brief";

const sectionSchema = z.object({
  heading: z.string().min(1).max(200),
  body: z.string().min(1),
  bullets: z.array(z.string().min(1)).max(6).optional(),
});

export const websiteContentSchema = z.object({
  title: z.string().min(1).max(200),
  tagline: z.string().min(1).max(300),
  heroCta: z.string().min(1).max(80),
  sections: z.array(sectionSchema).min(3).max(6),
  footerNote: z.string().min(1).max(300),
});

/**
 * Deterministic normalization (NOT a fallback): models occasionally emit a
 * single string where a one-element array is expected. Wrapping it is a
 * lossless coercion; anything else still fails validation loudly.
 */
function stringToSingletonArray(value: unknown) {
  return typeof value === "string" && value.trim() ? [value.trim()] : value;
}

export const resumeContentSchema = z.object({
  fullName: z.string().min(1).max(120),
  headline: z.string().min(1).max(200),
  summary: z.string().min(1),
  experienceBullets: z.array(z.string().min(1)).min(3).max(10),
  skills: z.array(z.string().min(1)).min(3).max(12),
  aiProof: z.preprocess(stringToSingletonArray, z.array(z.string().min(1)).min(1).max(6)),
});

export const deckContentSchema = z.object({
  title: z.string().min(1).max(200),
  subtitle: z.string().min(1).max(300),
  slides: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        bullets: z.array(z.string().min(1)).min(2).max(6),
        speakerNotes: z.string().min(1),
      }),
    )
    .min(4)
    .max(8),
});

export const briefContentSchema = z.object({
  title: z.string().min(1).max(200),
  summary: z.string().min(1),
  sections: z.array(sectionSchema).min(2).max(6),
  nextSteps: z.array(z.string().min(1)).min(2).max(6),
});

export type WebsiteContent = z.infer<typeof websiteContentSchema>;
export type ResumeContent = z.infer<typeof resumeContentSchema>;
export type DeckContent = z.infer<typeof deckContentSchema>;
export type BriefContent = z.infer<typeof briefContentSchema>;
export type ArtifactContent = WebsiteContent | ResumeContent | DeckContent | BriefContent;

const CONTENT_SCHEMAS: Record<ArtifactContentKind, z.ZodTypeAny> = {
  website: websiteContentSchema,
  resume: resumeContentSchema,
  deck: deckContentSchema,
  brief: briefContentSchema,
};

export function artifactContentKindFor(kind: ArtifactKind | string): ArtifactContentKind {
  switch (kind) {
    case "website":
      return "website";
    case "resume_docx":
    case "resume_pdf":
      return "resume";
    case "pptx":
      return "deck";
    case "pdf":
      return "brief";
    default:
      throw new Error(`ARTIFACT_KIND_NOT_GENERATABLE:${kind}`);
  }
}

export type ArtifactGenerationContext = {
  learner: {
    name: string;
    headline: string | null;
    careerPathId: string | null;
    careerPathName: string | null;
    goals: string[];
    bio?: string | null;
  };
  assessment: {
    readinessScore: number;
    headline: string;
    summary: string;
    topGaps: Array<{ title: string; whyItMatters: string; marketImpact: string }>;
  } | null;
  module: {
    moduleTitle: string;
    whyThisModule: string;
    expectedOutput: string;
    proofChecklist: string[];
    steps: string[];
  };
  project: {
    title: string;
    slug: string;
    description: string;
  };
  evidence: {
    completedSteps: Array<{ title: string; completedAt: string | null }>;
    proofArtifacts: Array<{ kind: string; url: string; note?: string | null }>;
    buildNotes: string[];
  };
};

const OUTPUT_SPECS: Record<ArtifactContentKind, string[]> = {
  website: [
    "Return a single JSON object for a personal proof-of-work WEBSITE with EXACTLY these keys:",
    '- "title": page title naming the learner and what they built (max 120 chars).',
    '- "tagline": one specific sentence about the outcome, not generic praise.',
    '- "heroCta": short call-to-action label (max 60 chars).',
    '- "sections": 3-5 items, each { "heading": short phrase, "body": 2-4 sentences grounded in the evidence, "bullets": optional 2-4 concrete highlights }. Cover: what was built, how AI was used, and the measurable/qualitative result.',
    '- "footerNote": one sentence attribution or context line.',
  ],
  resume: [
    "Return a single JSON object for RESUME content tuned to the learner's target path with EXACTLY these keys:",
    '- "fullName": the learner\'s name exactly as provided.',
    '- "headline": role headline positioning them for their target path (max 140 chars).',
    '- "summary": 2-3 sentence professional summary that foregrounds their AI-enabled way of working.',
    '- "experienceBullets": JSON array of 4-7 achievement bullet strings. Rework what the learner actually did (from profile, evidence, notes) into outcome-first bullets; include the AI workflow angle where it is real.',
    '- "skills": JSON array of 5-10 skill strings mixing their domain skills with the AI skills evidenced here.',
    '- "aiProof": JSON array of 1-4 strings, each one concrete AI proof-of-work item they can defend in an interview.',
  ],
  deck: [
    "Return a single JSON object for a short DECK OUTLINE with EXACTLY these keys:",
    '- "title": deck title (max 120 chars).',
    '- "subtitle": one-line framing.',
    '- "slides": 4-6 items, each { "title": slide title, "bullets": 2-5 tight bullets, "speakerNotes": 1-3 sentences of what to say — specific, grounded, no filler }.',
    "Structure the deck as: problem/bottleneck, the AI-assisted workflow, evidence/results, next steps.",
  ],
  brief: [
    "Return a single JSON object for a PROJECT BRIEF with EXACTLY these keys:",
    '- "title": brief title (max 120 chars).',
    '- "summary": 2-4 sentence synthesis of what this project is and why it matters for the learner\'s path.',
    '- "sections": 2-5 items, each { "heading": short phrase, "body": 2-4 sentences, "bullets": optional 2-4 items }. Cover context, the workflow built, and evidence.',
    '- "nextSteps": 2-5 concrete next actions.',
  ],
};

function contextLines(context: ArtifactGenerationContext) {
  const lines: string[] = [
    "## Learner profile",
    `Name: ${context.learner.name}`,
    `Role / headline: ${context.learner.headline ?? "Not provided"}`,
    `Career path: ${context.learner.careerPathName ?? "Not provided"}${context.learner.careerPathId ? ` (${context.learner.careerPathId})` : ""}`,
    `Goals: ${context.learner.goals.length ? context.learner.goals.join(", ") : "none provided"}`,
    ...(context.learner.bio ? [`Bio: ${context.learner.bio}`] : []),
    "",
  ];

  if (context.assessment) {
    lines.push(
      "## Latest AI-readiness assessment",
      `Readiness score: ${context.assessment.readinessScore}/100`,
      `Headline: ${context.assessment.headline}`,
      `Summary: ${context.assessment.summary}`,
      "Top gaps:",
      ...context.assessment.topGaps.map(
        (gap) => `- ${gap.title} (${gap.marketImpact} impact): ${gap.whyItMatters}`,
      ),
      "",
    );
  }

  lines.push(
    "## Module playbook being completed",
    `Module: ${context.module.moduleTitle}`,
    `Why this module: ${context.module.whyThisModule}`,
    `Expected output: ${context.module.expectedOutput}`,
    "Proof checklist:",
    ...context.module.proofChecklist.map((item) => `- ${item}`),
    "Steps:",
    ...context.module.steps.map((step, index) => `${index + 1}. ${step}`),
    "",
    "## Project",
    `Title: ${context.project.title}`,
    `Slug: ${context.project.slug}`,
    `Description: ${context.project.description}`,
    "",
    "## Completed-module evidence",
    context.evidence.completedSteps.length
      ? "Completed steps:"
      : "Completed steps: none yet",
    ...context.evidence.completedSteps.map(
      (step) => `- ${step.title}${step.completedAt ? ` (completed ${step.completedAt})` : ""}`,
    ),
    context.evidence.proofArtifacts.length ? "Attached proof:" : "Attached proof: none yet",
    ...context.evidence.proofArtifacts.map(
      (artifact) => `- ${artifact.kind}: ${artifact.url}${artifact.note ? ` — ${artifact.note}` : ""}`,
    ),
    context.evidence.buildNotes.length ? "Learner build notes:" : "Learner build notes: none",
    ...context.evidence.buildNotes.map((note) => `- ${note}`),
  );

  return lines;
}

/**
 * Skip-ahead / incomplete-evidence guard (live E2E fix 2026-07-07, finding
 * #4): a skip-ahead PDF with only step-1 evidence claimed "all five interview
 * transcripts included". When completed steps do not cover the full playbook,
 * the prompt carries a hard grounded-only constraint naming exactly which
 * steps are NOT done, so the artifact can never assert deliverables that do
 * not exist yet.
 */
function incompleteEvidenceConstraintLines(context: ArtifactGenerationContext): string[] {
  const totalSteps = context.module.steps.length;
  const completedTitles = new Set(
    context.evidence.completedSteps.map((step) => step.title.trim().toLowerCase()),
  );
  const remainingSteps = context.module.steps.filter(
    (step) => !completedTitles.has(step.trim().toLowerCase()),
  );
  const completedCount = Math.min(context.evidence.completedSteps.length, totalSteps);
  if (totalSteps === 0 || (completedCount >= totalSteps && remainingSteps.length === 0)) {
    return [];
  }

  return [
    "",
    "## GROUNDING CONSTRAINT — INCOMPLETE EVIDENCE (skip-ahead generation)",
    `Only ${completedCount} of ${totalSteps} playbook steps are complete. The remaining steps have NOT been done:`,
    ...remainingSteps.map((step) => `- ${step}`),
    "Do NOT claim, imply, or include deliverables from steps that are not complete — no interview transcripts, recordings, datasets, launches, published outputs, or metrics that do not appear verbatim in the completed-module evidence above.",
    "Describe ONLY what the completed steps, attached proof, and learner build notes actually contain.",
    "If unfinished playbook work is mentioned at all, frame it explicitly as planned next steps — never as completed work or existing artifacts.",
  ];
}

export function buildArtifactContentPrompt(input: {
  kind: ArtifactKind | string;
  context: ArtifactGenerationContext;
}) {
  const contentKind = artifactContentKindFor(input.kind);
  return [
    "You are the proof-of-work artifact engine for My AI Skill Tutor, an AI upskilling product for working professionals.",
    `Produce personalized ${contentKind.toUpperCase()} content as STRICT JSON (no markdown, no commentary).`,
    "The artifact must be something the learner could genuinely show an employer: specific, grounded in their real work, free of filler.",
    "",
    ...contextLines(input.context),
    ...incompleteEvidenceConstraintLines(input.context),
    "",
    "## Output requirements",
    ...OUTPUT_SPECS[contentKind],
    "Ground every claim in the provided context. Never invent employers, metrics, tools, or history the learner did not mention.",
    "Where evidence is thin, describe the workflow and its intent honestly instead of fabricating results.",
  ].join("\n");
}

function stripCodeFences(raw: string) {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

export function parseArtifactContent(contentKind: ArtifactContentKind, raw: string): ArtifactContent {
  let candidate: unknown;
  try {
    candidate = JSON.parse(stripCodeFences(raw));
  } catch {
    throw new Error("ARTIFACT_CONTENT_INVALID_OUTPUT:NOT_JSON");
  }

  const parsed = CONTENT_SCHEMAS[contentKind].safeParse(candidate);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const where = firstIssue ? firstIssue.path.join(".") || "root" : "root";
    throw new Error(`ARTIFACT_CONTENT_INVALID_OUTPUT:${where}`);
  }
  return parsed.data as ArtifactContent;
}

export async function generateArtifactContent(input: {
  kind: ArtifactKind | string;
  context: ArtifactGenerationContext;
  model?: string;
}): Promise<{ contentKind: ArtifactContentKind; content: ArtifactContent; model: string }> {
  const contentKind = artifactContentKindFor(input.kind);
  const model = input.model ?? resolveOpenAiModel();
  const prompt = buildArtifactContentPrompt({ kind: input.kind, context: input.context });

  let raw: string;
  try {
    raw = await callOpenAiResponses({
      prompt,
      model,
      temperature: 0.5,
      textFormat: { type: "json_object" },
      maxOutputTokens: 3000,
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("OPENAI_API_KEY_MISSING")) {
      throw new Error("OPENAI_CONFIG_MISSING");
    }
    throw error;
  }

  const content = parseArtifactContent(contentKind, raw);
  return { contentKind, content, model };
}

/**
 * Maps a failure thrown by `generateArtifactContent` to a stable job failure
 * code. Kept here so web runtime and worker report identical codes.
 */
export function artifactGenerationFailureCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith("OPENAI_CONFIG_MISSING") || message.startsWith("OPENAI_API_KEY_MISSING")) {
    return "OPENAI_CONFIG_MISSING";
  }
  if (message.startsWith("ARTIFACT_CONTENT_INVALID_OUTPUT")) {
    return message.slice(0, 120);
  }
  if (message.startsWith("OPENAI_RESPONSE_FAILED") || message.startsWith("OPENAI_EMPTY_RESPONSE")) {
    return message.slice(0, 120);
  }
  return "ARTIFACT_CONTENT_FAILED";
}

/** Table name for persisted structured artifact content. */
export const PROJECT_ARTIFACT_CONTENTS_TABLE = "project_artifact_contents";

export type ArtifactContentRecord = {
  id: string;
  projectId: string;
  learnerProfileId: string | null;
  artifactUrl: string;
  kind: string;
  contentKind: ArtifactContentKind;
  content: ArtifactContent;
  model: string | null;
  createdAt: string;
};

/** Snake-case row shape used by both the web store and the worker. */
export function artifactContentRowFrom(record: ArtifactContentRecord) {
  return {
    id: record.id,
    project_id: record.projectId,
    learner_profile_id: record.learnerProfileId,
    artifact_url: record.artifactUrl,
    kind: record.kind,
    content_kind: record.contentKind,
    content: record.content,
    model: record.model,
    created_at: record.createdAt,
  };
}
