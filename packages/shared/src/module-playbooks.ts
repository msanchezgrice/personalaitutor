import { getCareerPath } from "./matrix";
import type { GoalType } from "./types";

export type RecommendedModuleGuide = {
  careerPathId: string;
  careerPathName: string;
  moduleTitle: string;
  whyThisModule: string;
  expectedOutput: string;
  proofChecklist: string[];
  steps: string[];
  toolFocus: string[];
};

type PlaybookTemplate = {
  why: string;
  expectedOutput: string;
  proofChecklist: string[];
  steps: string[];
};

const GOAL_LABELS: Partial<Record<GoalType, string>> = {
  build_business: "create workflow leverage that has direct business value",
  upskill_current_job: "improve the job you already own",
  find_new_role: "create proof that supports a role transition",
  showcase_for_job: "package visible proof for hiring conversations",
  learn_foundations: "build confidence through one practical rep",
  ship_ai_projects: "ship one real AI-enabled workflow",
};

const PLAYBOOKS: Record<string, PlaybookTemplate> = {
  "product-management": {
    why: "This is the fastest module for turning product judgment into visible AI-assisted proof instead of private notes.",
    expectedOutput: "A research brief, wireframe set, or PRD section that shows what changed because AI was used well.",
    proofChecklist: [
      "Show the workflow you improved.",
      "Capture a before-and-after output.",
      "Summarize the decision quality or speed gain in plain English.",
    ],
    steps: [
      "Choose one live product question that is still fuzzy or slow.",
      "Use the module to produce a first pass artifact with AI support.",
      "Tighten the artifact and record what became clearer, faster, or more actionable.",
    ],
  },
  "marketing-seo": {
    why: "This module gives you one concrete growth workflow you can turn into proof quickly, which is better than consuming more generic AI content.",
    expectedOutput: "A campaign brief, content system, or SEO asset set tied to one measurable marketing goal.",
    proofChecklist: [
      "Show the target audience or query set.",
      "Show the AI-assisted content or clustering output.",
      "State the metric or workflow improvement you expect to move.",
    ],
    steps: [
      "Pick one campaign, content cluster, or search theme.",
      "Run the module on that real workflow instead of a made-up example.",
      "Package the result as a reusable system you can explain publicly.",
    ],
  },
  "branding-design": {
    why: "This module is the quickest route to visible creative proof because the output is immediately inspectable by other people.",
    expectedOutput: "A style-consistent visual set, concept board, or design asset package with a clear creative brief.",
    proofChecklist: [
      "Show the prompt or creative system you used.",
      "Show the strongest visual outputs.",
      "Explain how you kept style, quality, or iteration speed under control.",
    ],
    steps: [
      "Start from one brand or campaign need that already exists.",
      "Generate a first round of outputs using the module workflow.",
      "Select the strongest variants and document the creative reasoning behind them.",
    ],
  },
  "quality-assurance": {
    why: "This module helps you turn QA thinking into a concrete automation or test artifact that teams can inspect immediately.",
    expectedOutput: "A test plan, generated test suite, or edge-case library that clearly improves coverage.",
    proofChecklist: [
      "Name the product area or workflow under test.",
      "Show the generated cases or regression checks.",
      "State what risk is now covered better than before.",
    ],
    steps: [
      "Choose one workflow where failures are expensive or hard to catch manually.",
      "Use the module to generate tests, edge cases, or regression coverage.",
      "Tighten the output and save the strongest proof artifact.",
    ],
  },
  "sales-revops": {
    why: "This module is the highest-leverage way to show AI value in sales because it touches pipeline quality, outreach quality, or rep speed directly.",
    expectedOutput: "A lead scoring model, enrichment workflow, or outbound sequence that a manager could review and reuse.",
    proofChecklist: [
      "Show the segment or account set you targeted.",
      "Show the scoring, enrichment, or messaging logic.",
      "State the rep workflow or conversion gain this should improve.",
    ],
    steps: [
      "Pick one pipeline motion that is manual, repetitive, or inconsistent today.",
      "Run the module on a real account list, segment, or outreach workflow.",
      "Save the output in a format you could show to a sales or RevOps lead.",
    ],
  },
  "customer-support": {
    why: "This module is the clearest way to prove AI support value because routing, retrieval, and response quality are visible quickly.",
    expectedOutput: "A ticket routing logic, knowledge retrieval flow, or support copilot prompt set tied to a real support scenario.",
    proofChecklist: [
      "Show the support problem or ticket class.",
      "Show the AI-assisted routing or response logic.",
      "Explain how this improves speed, consistency, or customer tone.",
    ],
    steps: [
      "Choose one support issue type that repeats often.",
      "Use the module to design the retrieval, routing, or response layer.",
      "Record the output as a workflow another support lead could understand fast.",
    ],
  },
  operations: {
    why: "This module is right because operations proof is strongest when it shows a real handoff, extraction, or sync that now happens with less manual effort.",
    expectedOutput: "An automation map, extraction workflow, or cross-tool process that clearly reduces manual work.",
    proofChecklist: [
      "Name the broken or repetitive workflow.",
      "Show the system steps or automation logic.",
      "State the time saved, error reduction, or visibility gain.",
    ],
    steps: [
      "Pick one workflow that still depends on copy-paste, manual review, or repeated handoffs.",
      "Use the module to map and automate the most painful segment first.",
      "Package the result as a process proof artifact you can show internally or publicly.",
    ],
  },
  "human-resources": {
    why: "This module is the fastest route to HR proof because it turns people-ops judgment into a repeatable workflow other operators can inspect.",
    expectedOutput: "A screening workflow, interview summary format, or policy support assistant tied to one HR use case.",
    proofChecklist: [
      "Show the hiring or people-ops scenario.",
      "Show the AI-assisted decision or summary workflow.",
      "State how this improves consistency, speed, or signal quality.",
    ],
    steps: [
      "Choose one recruiting or people-ops workflow that is repetitive today.",
      "Run the module on that real scenario and keep the scope narrow.",
      "Document the result as a process asset another HR leader would understand quickly.",
    ],
  },
  "software-engineering": {
    why: "This module is right because engineering proof gets stronger when the output is inspectable, runnable, or clearly architectural instead of abstract.",
    expectedOutput: "A coded integration, architecture artifact, or RAG setup that another engineer could inspect and extend.",
    proofChecklist: [
      "Show the repo, API, or system boundary you touched.",
      "Show the code or architecture output.",
      "Explain what became more reliable, faster, or easier to extend.",
    ],
    steps: [
      "Choose one technical workflow that is blocked by repetition, glue code, or unclear context.",
      "Use the module to build the smallest useful implementation first.",
      "Save the code, architecture note, or artifact so the proof is reviewable.",
    ],
  },
};

function firstGoalLabel(goal?: GoalType | null) {
  if (!goal) return "ship one concrete proof step";
  return GOAL_LABELS[goal] ?? "ship one concrete proof step";
}

export function buildRecommendedModuleGuide(input: {
  careerPathId?: string | null;
  moduleTitle: string;
  jobTitle?: string | null;
  primaryGoal?: GoalType | null;
}): RecommendedModuleGuide {
  const careerPath = getCareerPath(String(input.careerPathId || "")) ?? null;
  const template = careerPath ? PLAYBOOKS[careerPath.id] ?? null : null;
  const careerPathId = careerPath?.id ?? "general";
  const careerPathName = careerPath?.name ?? "Current path";
  const moduleTitle = input.moduleTitle.trim() || "Starter AI Pack";
  const roleLabel = input.jobTitle?.trim() || careerPathName;
  const goalLabel = firstGoalLabel(input.primaryGoal ?? null);

  if (!template) {
    return {
      careerPathId,
      careerPathName,
      moduleTitle,
      whyThisModule: `This module is the clearest next move for ${roleLabel} because it helps you ${goalLabel} with an output you can actually show.`,
      expectedOutput: "One visible workflow artifact tied to a real problem from your work.",
      proofChecklist: [
        "Name the workflow you improved.",
        "Show the AI-assisted output.",
        "Summarize what changed and why it matters.",
      ],
      steps: [
        `Start ${moduleTitle} on one real workflow from your week.`,
        "Produce the smallest useful output first.",
        "Package the result as visible proof instead of leaving it private.",
      ],
      toolFocus: [],
    };
  }

  return {
    careerPathId,
    careerPathName,
    moduleTitle,
    whyThisModule: `${template.why} For ${roleLabel}, the goal is to ${goalLabel}.`,
    expectedOutput: template.expectedOutput,
    proofChecklist: template.proofChecklist,
    steps: template.steps.map((step) => step.replaceAll("{module}", moduleTitle)),
    toolFocus: careerPath?.tools.slice(0, 4) ?? [],
  };
}
