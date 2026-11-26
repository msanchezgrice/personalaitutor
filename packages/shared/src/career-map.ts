import { z } from "zod";

/**
 * Career Map contract (2026-11-25).
 *
 * A career map takes what a person did before (résumé text or a description of
 * their last job) and maps it to one AI-era title from the catalog below, two
 * alternates, a set of grounded skill translations, the gaps to close and a
 * three-piece proof plan (site, tuned model, build log).
 *
 * This file is the shared contract: the title catalog, the zod schema for the
 * LLM output and the record/view types. Generation, persistence and UI live in
 * apps/web (lib/career-map/*, app/map/*).
 */

export const CAREER_MAP_LINES = [
  { id: "growth", label: "Growth", color: "#10B981" },
  { id: "product", label: "Product", color: "#0D9488" },
  { id: "evals", label: "Evals", color: "#047857" },
  { id: "operations", label: "Operations", color: "#0F766E" },
  { id: "creative", label: "Creative", color: "#059669" },
] as const;

export type CareerMapLineId = (typeof CAREER_MAP_LINES)[number]["id"];

export type CareerMapTitle = {
  id: string;
  title: string;
  line: CareerMapLineId;
  /** One plain sentence on what the job is. Shown on maps and Remapped pages. */
  blurb: string;
  /** Existing learning path (packages/shared matrix CAREER_PATHS id) that carries the weekly plan. */
  careerPathId: string;
};

export const CAREER_MAP_TITLES: readonly CareerMapTitle[] = [
  // Growth
  { id: "gtm-engineer", title: "Go-to-Market Engineer", line: "growth", blurb: "Builds the automated workflows a marketing and sales team runs on: launches, outreach, enrichment and reporting.", careerPathId: "marketing-seo" },
  { id: "lifecycle-automation-lead", title: "Lifecycle Automation Lead", line: "growth", blurb: "Owns email, in-app and retention messaging as a system of AI-drafted, human-reviewed flows.", careerPathId: "marketing-seo" },
  { id: "ai-content-strategist", title: "AI Content Strategist", line: "growth", blurb: "Sets the briefs, voice rules and review steps that turn AI drafts into publishable content.", careerPathId: "marketing-seo" },
  { id: "creative-ops-engineer", title: "Creative Ops Engineer", line: "growth", blurb: "Runs the pipeline that generates, tags and tests ad and creative variants at volume.", careerPathId: "marketing-seo" },
  { id: "revops-automation-lead", title: "Revenue Operations Automation Lead", line: "growth", blurb: "Automates the pipeline, forecasting and handoff work between sales, marketing and success.", careerPathId: "sales-revops" },
  { id: "ai-sales-engineer", title: "AI Sales Engineer", line: "growth", blurb: "Shows buyers how an AI product fits their workflow and builds the proof-of-concept that closes the deal.", careerPathId: "sales-revops" },
  { id: "ai-community-lead", title: "AI Community Lead", line: "growth", blurb: "Runs a community with AI agents handling answers, moderation and escalation under human rules.", careerPathId: "customer-support" },
  // Product
  { id: "ai-product-manager", title: "AI Product Manager", line: "product", blurb: "Decides what an AI feature should do, how it is evaluated and when it is good enough to ship.", careerPathId: "product-management" },
  { id: "agent-ops-lead", title: "Agent Operations Lead", line: "product", blurb: "Keeps a fleet of AI agents working: monitors runs, fixes failures and tunes instructions.", careerPathId: "operations" },
  { id: "forward-deployed-engineer", title: "Forward-Deployed Engineer", line: "product", blurb: "Sits with a customer and builds the AI workflow that solves their specific problem.", careerPathId: "software-engineering" },
  { id: "ai-solutions-architect", title: "AI Solutions Architect", line: "product", blurb: "Designs how models, data and existing systems fit together for a business use case.", careerPathId: "software-engineering" },
  { id: "conversation-designer", title: "Conversation Designer", line: "product", blurb: "Designs how an AI assistant talks: its flows, tone, guardrails and handoffs to people.", careerPathId: "customer-support" },
  { id: "ai-product-designer", title: "AI Product Designer", line: "product", blurb: "Designs interfaces where part of the product is a model, including what happens when it is wrong.", careerPathId: "branding-design" },
  { id: "ai-engineer", title: "AI Engineer", line: "product", blurb: "Builds product features on top of language models: prompts, retrieval, tools and evaluation.", careerPathId: "software-engineering" },
  // Evals
  { id: "model-evaluator", title: "Model Evaluator", line: "evals", blurb: "Writes the test cases and grading rules that show whether an AI system is right, and where it fails.", careerPathId: "quality-assurance" },
  { id: "ai-quality-lead", title: "AI Quality Lead", line: "evals", blurb: "Owns quality for an AI product: regression suites, release gates and failure triage.", careerPathId: "quality-assurance" },
  { id: "ai-trainer", title: "AI Trainer", line: "evals", blurb: "Teaches models a domain by writing, rating and correcting examples as a subject expert.", careerPathId: "quality-assurance" },
  { id: "ai-environment-designer", title: "AI Environment Designer", line: "evals", blurb: "Designs the tasks, rules and scoring that AI agents are trained and tested in.", careerPathId: "product-management" },
  { id: "annotation-program-lead", title: "Annotation Program Lead", line: "evals", blurb: "Runs the people and guidelines that produce labeled data a model can be trusted on.", careerPathId: "operations" },
  { id: "ai-policy-analyst", title: "AI Policy and Safety Analyst", line: "evals", blurb: "Defines what an AI system must not do and checks that it holds under pressure.", careerPathId: "operations" },
  // Operations
  { id: "ai-operations-lead", title: "AI Operations Lead", line: "operations", blurb: "Finds the repeatable work in a team and moves it onto AI workflows with clear owners.", careerPathId: "operations" },
  { id: "ai-automation-specialist", title: "AI Automation Specialist", line: "operations", blurb: "Builds and maintains the no-code and low-code automations a business runs every day.", careerPathId: "operations" },
  { id: "knowledge-ops-lead", title: "Knowledge Operations Lead", line: "operations", blurb: "Keeps the documents an AI assistant answers from accurate, current and well structured.", careerPathId: "customer-support" },
  { id: "ai-support-ops-lead", title: "AI Support Operations Lead", line: "operations", blurb: "Runs customer support where AI answers first and people handle what it should not.", careerPathId: "customer-support" },
  { id: "ai-talent-partner", title: "AI Talent Partner", line: "operations", blurb: "Recruits with AI sourcing and screening tools while keeping the judgment calls human.", careerPathId: "human-resources" },
  { id: "ai-enablement-lead", title: "AI Enablement Lead", line: "operations", blurb: "Gets a workforce using AI well: training, playbooks, policies and measured adoption.", careerPathId: "human-resources" },
  { id: "legal-ai-ops-specialist", title: "Legal AI Operations Specialist", line: "operations", blurb: "Runs AI-assisted review and drafting for a legal team, with checks a lawyer can sign off on.", careerPathId: "operations" },
  { id: "finance-automation-analyst", title: "Finance Automation Analyst", line: "operations", blurb: "Automates reconciliation, reporting and close work, and audits what the automation produces.", careerPathId: "operations" },
  // Creative
  { id: "ai-art-director", title: "AI Art Director", line: "creative", blurb: "Sets the visual direction and curates generative output so a brand or game keeps one look.", careerPathId: "branding-design" },
  { id: "generative-brand-designer", title: "Generative Brand Designer", line: "creative", blurb: "Builds brand systems, style references and prompts that produce on-brand assets at volume.", careerPathId: "branding-design" },
  { id: "ai-video-producer", title: "AI Video Producer", line: "creative", blurb: "Produces video with generative tools: scripts, shots, edits and the review that keeps it accurate.", careerPathId: "branding-design" },
  { id: "ai-technical-artist", title: "AI Technical Artist", line: "creative", blurb: "Connects generative tools to an art pipeline so assets arrive in the right format and style.", careerPathId: "branding-design" },
  { id: "ai-narrative-designer", title: "AI Narrative Designer", line: "creative", blurb: "Writes the characters, lore and guardrails that AI-driven dialogue and stories run on.", careerPathId: "product-management" },
] as const;

export const CAREER_MAP_TITLE_IDS = CAREER_MAP_TITLES.map((entry) => entry.id);

export function getCareerMapTitle(id: string): CareerMapTitle | null {
  return CAREER_MAP_TITLES.find((entry) => entry.id === id) ?? null;
}

export function getCareerMapLine(id: CareerMapLineId) {
  return CAREER_MAP_LINES.find((entry) => entry.id === id) ?? CAREER_MAP_LINES[0];
}

export const CAREER_MAP_FITS = ["strong", "good", "stretch"] as const;
export type CareerMapFit = (typeof CAREER_MAP_FITS)[number];

export const CAREER_MAP_FIT_LABELS: Record<CareerMapFit, string> = {
  strong: "Strong match",
  good: "Good match",
  stretch: "Stretch match",
};

/** Hard limits on what a visitor can send. Enforced by the API and the UI. */
export const CAREER_MAP_INPUT_MIN_CHARS = 60;
export const CAREER_MAP_INPUT_MAX_CHARS = 20000;

/*
 * Length limits here are the hard ceilings the UI can lay out. The generation
 * prompt asks for noticeably shorter text (see JSON_SHAPE in
 * apps/web/lib/career-map/generate.ts), because models overshoot character
 * counts; a slightly long sentence should not fail a whole map.
 */
const titleId = z.string().refine((value) => CAREER_MAP_TITLE_IDS.includes(value), "UNKNOWN_TITLE_ID");
const trimmed = (min: number, max: number) => z.string().trim().min(min).max(max);

export const careerMapTranslationSchema = z.object({
  /** What they did, in their own terms. Short, no invented numbers. */
  before: trimmed(4, 160),
  /** A verbatim quote from the input that backs `before`. Checked against the input text. */
  evidence: trimmed(4, 240),
  /** The AI-era skill it has become, as a present-tense verb phrase. */
  now: trimmed(4, 90),
  /** One or two plain sentences on why the old work maps to the new skill. */
  explanation: trimmed(12, 420),
});

export const careerMapSchema = z
  .object({
    person: z.object({
      displayName: trimmed(1, 80).nullable(),
      previousTitle: trimmed(2, 80),
      /** Label for the old line on the map, e.g. "Game Studio", "Agency", "Newsroom". */
      previousField: trimmed(2, 36),
      yearsExperience: trimmed(1, 24).nullable(),
    }),
    primary: z.object({
      titleId,
      fit: z.enum(CAREER_MAP_FITS),
      summary: trimmed(20, 480),
    }),
    alternates: z.array(z.object({ titleId, reason: trimmed(12, 400) })).length(2),
    translations: z.array(careerMapTranslationSchema).min(3).max(6),
    gaps: z.array(z.object({ gap: trimmed(8, 240), closeWith: trimmed(8, 320) })).min(2).max(4),
    proofPlan: z.object({
      site: z.object({ headline: trimmed(8, 140), summary: trimmed(12, 360) }),
      model: z.object({ name: trimmed(3, 40), sampleType: trimmed(3, 80), summary: trimmed(12, 360) }),
      buildLog: z.object({ firstPostTitle: trimmed(8, 160), summary: trimmed(12, 360) }),
    }),
    /** Up to three neighbouring old titles on the same old line, for the map drawing. */
    neighbors: z.array(trimmed(2, 40)).max(3),
  })
  .superRefine((value, ctx) => {
    const ids = [value.primary.titleId, ...value.alternates.map((entry) => entry.titleId)];
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["alternates"], message: "DUPLICATE_TITLE_ID" });
    }
  });

export type CareerMap = z.infer<typeof careerMapSchema>;
export type CareerMapTranslation = z.infer<typeof careerMapTranslationSchema>;

export type CareerMapSource = "paste" | "upload" | "describe";
export type CareerMapStatus = "generating" | "completed" | "failed";

/** One stored map. `map` is null until generation completes. */
export type CareerMapRecord = {
  id: string;
  token: string;
  status: CareerMapStatus;
  source: CareerMapSource;
  inputText: string;
  map: CareerMap | null;
  model: string | null;
  failureReason: string | null;
  email: string | null;
  emailCapturedAt: string | null;
  mapEmailSentAt: string | null;
  learnerProfileId: string | null;
  linkedAt: string | null;
  visitorId: string | null;
  ipHash: string | null;
  createdAt: string;
  updatedAt: string;
};

/** What the public result page and GET /api/career-map/[token] expose. Never includes inputText, email or ipHash. */
export type CareerMapView = {
  token: string;
  status: CareerMapStatus;
  map: CareerMap | null;
  createdAt: string;
  hasEmail: boolean;
  linked: boolean;
};

export function toCareerMapView(record: CareerMapRecord): CareerMapView {
  return {
    token: record.token,
    status: record.status,
    map: record.map,
    createdAt: record.createdAt,
    hasEmail: Boolean(record.email),
    linked: Boolean(record.learnerProfileId),
  };
}

/**
 * Normalises text for the grounding check: lower case, straight quotes,
 * collapsed whitespace. A translation is grounded when its normalised
 * `evidence` is a substring of the normalised input.
 */
export function normalizeForGrounding(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[‐-―]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function isEvidenceGrounded(evidence: string, inputText: string): boolean {
  const needle = normalizeForGrounding(evidence).replace(/^["'\s.…]+|["'\s.…]+$/g, "");
  if (needle.length < 4) return false;
  return normalizeForGrounding(inputText).includes(needle);
}

/** The example used on the landing page, in tests and in the launch film. Fictional person and studio. */
export const EXAMPLE_CAREER_MAP_INPUT = [
  "Maya Ortiz",
  "Senior Marketing Manager",
  "Austin, TX",
  "",
  "Experience",
  "Kiteborne Games, 2018 - 2025",
  "Senior Marketing Manager, games publishing",
  "- Planned 4 global game launches",
  "- Wrote player emails to 12M players",
  "- Grew a 90k-member Discord community",
  "- Ran paid campaigns on 6 ad networks",
  "",
  "Skills",
  "Launch planning, Lifecycle email, Community, Paid acquisition",
].join("\n");

export const EXAMPLE_CAREER_MAP: CareerMap = {
  person: { displayName: "Maya Ortiz", previousTitle: "Senior Marketing Manager", previousField: "Game Studio", yearsExperience: "7 years" },
  primary: {
    titleId: "gtm-engineer",
    fit: "strong",
    summary: "Seven years of launch planning, lifecycle email and community work map to the job of building the systems that run a go-to-market team.",
  },
  alternates: [
    { titleId: "lifecycle-automation-lead", reason: "Fits if you would rather own retention and email than the whole launch. Leans hardest on your player-email work." },
    { titleId: "ai-content-strategist", reason: "Fits if you want to stay closest to writing. Less systems work, more editorial judgment over AI drafts." },
  ],
  translations: [
    { before: "Planned 4 global game launches", evidence: "Planned 4 global game launches", now: "Builds AI launch workflows", explanation: "A launch plan is a sequence of briefs, assets and approvals. That sequence is what a workflow tool automates." },
    { before: "Wrote player emails to 12M players", evidence: "Wrote player emails to 12M players", now: "Writes brand-voice prompts", explanation: "You already know what on-voice sounds like. A system prompt is that judgment written down once." },
    { before: "Grew a 90k-member Discord community", evidence: "Grew a 90k-member Discord community", now: "Designs community agents", explanation: "Moderation rules, FAQs and escalation paths are the spec for a support agent." },
    { before: "Ran paid campaigns on 6 ad networks", evidence: "Ran paid campaigns on 6 ad networks", now: "Runs creative testing pipelines", explanation: "Generating, tagging and reading out ad variants is now a pipeline you design, not a spreadsheet you fill." },
  ],
  gaps: [
    { gap: "A workflow that runs without you, built in an automation tool", closeWith: "Automate one launch task end to end and write up how it works." },
    { gap: "A way to check AI output: a small test set with pass and fail rules", closeWith: "Write ten test briefs and grade your model's drafts against them." },
    { gap: "Anything public. Nothing in your résumé links to work a stranger can open.", closeWith: "Publish your site and your first build log post." },
  ],
  proofPlan: {
    site: { headline: "Go-to-market engineer for game studios", summary: "A public page with your new title, the four translations above and room for your first project." },
    model: { name: "maya-voice", sampleType: "launch emails", summary: "Paste 10 or more emails you wrote. Visitors compare it with the untuned model on your page." },
    buildLog: { firstPostTitle: "I turned our launch checklist into one agent workflow", summary: "Your first post: the brief, the workflow and what broke. This is the workflow gap, closed in public." },
  },
  neighbors: ["Community Manager", "Producer", "QA Tester"],
};

/** httpOnly cookie that remembers the visitor's latest map token so it can be linked after sign-up. */
export const CAREER_MAP_COOKIE_NAME = "mast_cm";
