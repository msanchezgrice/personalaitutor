import { z } from "zod";

/**
 * Proof Studio contract (2026-11-25).
 *
 * Proof Studio is the paid half of the product: three public pieces that back
 * up the title on a career map.
 *   1. Site       — the public page at /u/{handle} (ProofSite settings + existing learner profile)
 *   2. Voice model — a model tuned in context on the learner's own writing samples
 *   3. Build log  — short public posts about what they built
 *
 * Types and LLM-output schemas only. Stores, routes and UI live in apps/web.
 */

const trimmed = (min: number, max: number) => z.string().trim().min(min).max(max);

/** Status of one proof piece, shown on the Proof Studio hub and the dashboard home. */
export type ProofPieceState = "empty" | "draft" | "live";
export type ProofPieceStatus = {
  state: ProofPieceState;
  /** One short sentence, e.g. "Published 3 posts" or "Add 6 more samples to tune it". */
  summary: string;
};

// ---------------------------------------------------------------------------
// 1. Site
// ---------------------------------------------------------------------------

export const proofSiteTranslationSchema = z.object({ before: trimmed(4, 110), now: trimmed(4, 70) });

/** LLM draft of the site copy, generated from the learner's career map. The learner edits before publishing. */
export const proofSiteDraftSchema = z.object({
  tagline: trimmed(8, 110),
  bio: trimmed(40, 600),
  translations: z.array(proofSiteTranslationSchema).min(2).max(6),
});
export type ProofSiteDraft = z.infer<typeof proofSiteDraftSchema>;

export type ProofSite = {
  learnerProfileId: string;
  careerMapId: string | null;
  /** The new title shown under the name, e.g. "Go-to-Market Engineer". */
  newTitle: string;
  /** e.g. "Senior Marketing Manager at Kiteborne Games, 2018 to 2025". Optional. */
  previousRole: string | null;
  tagline: string;
  bio: string;
  translations: Array<{ before: string; now: string }>;
  contactEmail: string | null;
  linkedinUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// 2. Voice model
// ---------------------------------------------------------------------------

/** Minimum samples before a model can be tuned, and the cap we keep in context. */
export const VOICE_MODEL_MIN_SAMPLES = 5;
export const VOICE_MODEL_MAX_SAMPLES = 40;
export const VOICE_MODEL_SAMPLE_MAX_CHARS = 4000;
export const VOICE_MODEL_PROMPT_MAX_CHARS = 400;
/** Honest description of the method. Shown on every model card. */
export const VOICE_MODEL_METHOD_LABEL = "Voice profile + examples in context";

/** LLM-derived description of how the learner writes. Stored on the model and injected at run time. */
export const voiceStyleProfileSchema = z.object({
  summary: trimmed(20, 400),
  tone: z.array(trimmed(2, 40)).min(2).max(6),
  habits: z.array(trimmed(4, 160)).min(3).max(8),
  avoid: z.array(trimmed(2, 120)).min(2).max(8),
  signaturePhrases: z.array(trimmed(2, 80)).max(8),
});
export type VoiceStyleProfile = z.infer<typeof voiceStyleProfileSchema>;

export type VoiceModelStatus = "draft" | "ready";

export type VoiceModel = {
  id: string;
  learnerProfileId: string;
  /** URL slug, unique per learner, e.g. "maya-voice-v1". */
  slug: string;
  name: string;
  /** What it writes, e.g. "game launch announcements". */
  purpose: string;
  /** What the samples are, e.g. "launch emails". */
  sampleType: string;
  status: VoiceModelStatus;
  published: boolean;
  styleProfile: VoiceStyleProfile | null;
  baseModel: string | null;
  sampleCount: number;
  /** A saved comparison shown on the public page before a visitor runs anything. */
  demoPrompt: string | null;
  demoBaseOutput: string | null;
  demoTunedOutput: string | null;
  tunedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VoiceModelSample = {
  id: string;
  voiceModelId: string;
  title: string | null;
  content: string;
  createdAt: string;
};

/** Public shape: never includes samples. */
export type VoiceModelPublic = Pick<
  VoiceModel,
  "slug" | "name" | "purpose" | "sampleType" | "baseModel" | "sampleCount" | "demoPrompt" | "demoBaseOutput" | "demoTunedOutput" | "tunedAt"
> & { methodLabel: string };

export type VoiceModelRunResult = { prompt: string; baseOutput: string; tunedOutput: string };

// ---------------------------------------------------------------------------
// 3. Build log
// ---------------------------------------------------------------------------

export const BUILD_LOG_TITLE_MAX = 120;
export const BUILD_LOG_BODY_MAX = 12000;

/** LLM draft of a post from the learner's rough notes. Never invents results the notes don't contain. */
export const buildLogDraftSchema = z.object({
  title: trimmed(8, BUILD_LOG_TITLE_MAX),
  summary: trimmed(20, 240),
  /** Markdown: short paragraphs, optional "## " headings and "- " lists. No HTML. */
  bodyMarkdown: trimmed(120, 6000),
});
export type BuildLogDraft = z.infer<typeof buildLogDraftSchema>;

export type BuildLogPostStatus = "draft" | "published";

export type BuildLogPost = {
  id: string;
  learnerProfileId: string;
  slug: string;
  title: string;
  summary: string;
  bodyMarkdown: string;
  status: BuildLogPostStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BuildLogPostPublic = Pick<BuildLogPost, "slug" | "title" | "summary" | "bodyMarkdown" | "publishedAt">;

// ---------------------------------------------------------------------------
// Remapped library (public routes, one new one each week)
// ---------------------------------------------------------------------------

export type RemappedRoute = {
  slug: string;
  /** ISO date the route goes public. Routes with a future date are hidden everywhere. */
  publishAt: string;
  fromTitle: string;
  /** Label for the old line, e.g. "Game Studio". */
  fromField: string;
  /** Catalog id from CAREER_MAP_TITLES. */
  toTitleId: string;
  /** One or two sentences: why this job is shrinking and why this destination fits. */
  intro: string;
  translations: Array<{ before: string; now: string; explanation: string }>;
  gaps: Array<{ gap: string; closeWith: string }>;
  firstProject: { title: string; steps: string[] };
  /** What stays hard about this move. Required: no route is all upside. */
  watchOuts: string[];
};
