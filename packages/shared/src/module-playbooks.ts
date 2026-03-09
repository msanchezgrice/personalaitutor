import { getCareerPath } from "./matrix";
import type { OAuthConnection } from "./types";
import type { GoalType } from "./types";

export type RecommendedModuleToolLaunch = {
  key: string;
  label: string;
  description: string;
  href: string;
  ctaLabel: string;
  kind: "internal" | "external" | "oauth";
  platform?: OAuthConnection["platform"] | null;
  opensInNewTab?: boolean;
  verificationHint: string;
};

export type RecommendedModuleGuide = {
  careerPathId: string;
  careerPathName: string;
  moduleTitle: string;
  whyThisModule: string;
  expectedOutput: string;
  proofChecklist: string[];
  steps: string[];
  toolFocus: string[];
  toolLaunches: RecommendedModuleToolLaunch[];
};

type PlaybookTemplate = {
  why: string;
  expectedOutput: string;
  proofChecklist: string[];
  steps: string[];
  toolLaunches: RecommendedModuleToolLaunch[];
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
    toolLaunches: [
      {
        key: "jira",
        label: "Jira",
        description: "Open the live backlog or ticket where this workflow starts.",
        href: "https://www.atlassian.com/software/jira",
        ctaLabel: "Open Jira",
        kind: "external",
        opensInNewTab: true,
        verificationHint: "Capture the ticket, workflow, or backlog item you improved.",
      },
      {
        key: "figma",
        label: "Figma",
        description: "Move the module output into a real wireframe, flow, or review artifact.",
        href: "https://www.figma.com/files/",
        ctaLabel: "Open Figma",
        kind: "external",
        opensInNewTab: true,
        verificationHint: "Export a frame or share link as proof.",
      },
      {
        key: "notion",
        label: "Notion",
        description: "Store the final brief, decision note, or PRD slice where your team already works.",
        href: "https://www.notion.so/",
        ctaLabel: "Open Notion",
        kind: "external",
        opensInNewTab: true,
        verificationHint: "Paste the doc URL or upload a screenshot of the final page.",
      },
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
    toolLaunches: [
      {
        key: "google-analytics",
        label: "Google Analytics",
        description: "Open the traffic baseline or campaign target you want this module to improve.",
        href: "https://analytics.google.com/",
        ctaLabel: "Open Analytics",
        kind: "external",
        opensInNewTab: true,
        verificationHint: "Reference the traffic or conversion metric you are trying to move.",
      },
      {
        key: "hubspot",
        label: "HubSpot",
        description: "Launch directly into campaign, CRM, or sequence context tied to this build.",
        href: "https://app.hubspot.com/",
        ctaLabel: "Open HubSpot",
        kind: "external",
        opensInNewTab: true,
        verificationHint: "Show the campaign, list, or sequence the AI workflow improved.",
      },
      {
        key: "linkedin",
        label: "LinkedIn",
        description: "Connect LinkedIn when this module needs audience research or visible proof sharing.",
        href: "https://www.linkedin.com/feed/",
        ctaLabel: "Connect LinkedIn",
        kind: "oauth",
        platform: "linkedin_profile",
        opensInNewTab: true,
        verificationHint: "Use LinkedIn research or publish the proof story once the module is ready.",
      },
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
    toolLaunches: [
      {
        key: "figma",
        label: "Figma",
        description: "Move the strongest output into a frame, board, or shareable concept set.",
        href: "https://www.figma.com/files/",
        ctaLabel: "Open Figma",
        kind: "external",
        opensInNewTab: true,
        verificationHint: "Save a board link or frame export as proof.",
      },
      {
        key: "canva",
        label: "Canva",
        description: "Use Canva when the proof needs a fast polished layout instead of a raw export.",
        href: "https://www.canva.com/",
        ctaLabel: "Open Canva",
        kind: "external",
        opensInNewTab: true,
        verificationHint: "Export the asset and attach it back to the pack.",
      },
      {
        key: "midjourney",
        label: "Midjourney",
        description: "Open your image generation workspace to create the visual variants for this pack.",
        href: "https://www.midjourney.com/",
        ctaLabel: "Open Midjourney",
        kind: "external",
        opensInNewTab: true,
        verificationHint: "Attach the strongest visual output or prompt set.",
      },
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
    toolLaunches: [
      {
        key: "github",
        label: "GitHub",
        description: "Open the repo or pull request where the test coverage or QA artifact belongs.",
        href: "https://github.com/",
        ctaLabel: "Open GitHub",
        kind: "external",
        opensInNewTab: true,
        verificationHint: "Attach the PR link, issue link, or saved test artifact.",
      },
      {
        key: "linear",
        label: "Linear",
        description: "Anchor this pack to a bug, regression, or QA initiative your team already tracks.",
        href: "https://linear.app/",
        ctaLabel: "Open Linear",
        kind: "external",
        opensInNewTab: true,
        verificationHint: "Capture the bug ticket or QA checklist this work closed.",
      },
      {
        key: "chatgpt",
        label: "ChatGPT",
        description: "Use an external copilot when you need fast edge-case expansion or test rewrites.",
        href: "https://chatgpt.com/",
        ctaLabel: "Open ChatGPT",
        kind: "external",
        opensInNewTab: true,
        verificationHint: "Save the output and show how it improved coverage.",
      },
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
    toolLaunches: [
      {
        key: "hubspot",
        label: "HubSpot",
        description: "Open the real pipeline, list, or sequence where the AI workflow should land.",
        href: "https://app.hubspot.com/",
        ctaLabel: "Open HubSpot",
        kind: "external",
        opensInNewTab: true,
        verificationHint: "Capture the segment, list, or pipeline stage this build improves.",
      },
      {
        key: "linkedin-profile",
        label: "LinkedIn",
        description: "Connect LinkedIn for research, prospect context, and public proof distribution.",
        href: "https://www.linkedin.com/feed/",
        ctaLabel: "Connect LinkedIn",
        kind: "oauth",
        platform: "linkedin_profile",
        opensInNewTab: true,
        verificationHint: "Use the connection to research targets or publish the resulting proof story.",
      },
      {
        key: "gmail",
        label: "Gmail",
        description: "Open a live email workflow when the pack output needs to become an outbound message fast.",
        href: "https://mail.google.com/",
        ctaLabel: "Open Gmail",
        kind: "external",
        opensInNewTab: true,
        verificationHint: "Copy the final outreach message into proof or attach a screenshot.",
      },
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
    toolLaunches: [
      {
        key: "zendesk",
        label: "Zendesk",
        description: "Open the ticket queue or macro area where the support workflow actually lives.",
        href: "https://www.zendesk.com/",
        ctaLabel: "Open Zendesk",
        kind: "external",
        opensInNewTab: true,
        verificationHint: "Reference the ticket class or macro flow you improved.",
      },
      {
        key: "slack",
        label: "Slack",
        description: "Use Slack when the module needs handoff visibility or support escalation context.",
        href: "https://app.slack.com/client",
        ctaLabel: "Open Slack",
        kind: "external",
        opensInNewTab: true,
        verificationHint: "Capture the handoff or escalation workflow this module changed.",
      },
      {
        key: "notion",
        label: "Notion",
        description: "Store support policy, triage logic, or help-center structure in a shared doc.",
        href: "https://www.notion.so/",
        ctaLabel: "Open Notion",
        kind: "external",
        opensInNewTab: true,
        verificationHint: "Share the documented policy or knowledge artifact as proof.",
      },
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
    toolLaunches: [
      {
        key: "zapier",
        label: "Zapier",
        description: "Launch the automation workspace when this module needs a real cross-tool workflow.",
        href: "https://zapier.com/app/dashboard",
        ctaLabel: "Open Zapier",
        kind: "external",
        opensInNewTab: true,
        verificationHint: "Attach the zap, automation map, or run screenshot as proof.",
      },
      {
        key: "airtable",
        label: "Airtable",
        description: "Use Airtable for structured ops tracking, extraction staging, or review queues.",
        href: "https://airtable.com/",
        ctaLabel: "Open Airtable",
        kind: "external",
        opensInNewTab: true,
        verificationHint: "Show the base, table, or process snapshot this module improved.",
      },
      {
        key: "slack",
        label: "Slack",
        description: "Open your team handoff channel when the build changes process visibility or approvals.",
        href: "https://app.slack.com/client",
        ctaLabel: "Open Slack",
        kind: "external",
        opensInNewTab: true,
        verificationHint: "Capture the operating change or handoff the module improved.",
      },
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
    toolLaunches: [
      {
        key: "linkedin-profile",
        label: "LinkedIn",
        description: "Connect LinkedIn when the module depends on candidate research or public proof sharing.",
        href: "https://www.linkedin.com/feed/",
        ctaLabel: "Connect LinkedIn",
        kind: "oauth",
        platform: "linkedin_profile",
        opensInNewTab: true,
        verificationHint: "Use the connection for sourcing, research, or the proof post that follows.",
      },
      {
        key: "greenhouse",
        label: "Greenhouse",
        description: "Open the ATS where the screening or interview workflow actually happens.",
        href: "https://app.greenhouse.io/",
        ctaLabel: "Open Greenhouse",
        kind: "external",
        opensInNewTab: true,
        verificationHint: "Capture the hiring stage, scorecard, or summary flow this module improved.",
      },
      {
        key: "chatgpt",
        label: "ChatGPT",
        description: "Use an external copilot for summary drafting, rubric refinement, or policy support.",
        href: "https://chatgpt.com/",
        ctaLabel: "Open ChatGPT",
        kind: "external",
        opensInNewTab: true,
        verificationHint: "Attach the improved rubric, summary, or policy output.",
      },
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
    toolLaunches: [
      {
        key: "github",
        label: "GitHub",
        description: "Open the repo, issue, or pull request where the implementation belongs.",
        href: "https://github.com/",
        ctaLabel: "Open GitHub",
        kind: "external",
        opensInNewTab: true,
        verificationHint: "Link the repo, branch, or PR that contains the build.",
      },
      {
        key: "openai-platform",
        label: "OpenAI Platform",
        description: "Jump into the model and API workspace when this pack needs prompt or integration iteration.",
        href: "https://platform.openai.com/",
        ctaLabel: "Open OpenAI",
        kind: "external",
        opensInNewTab: true,
        verificationHint: "Show the prompt, API config, or eval artifact produced from the build.",
      },
      {
        key: "vercel",
        label: "Vercel",
        description: "Use Vercel when the clearest proof is a live deployment instead of a local-only artifact.",
        href: "https://vercel.com/dashboard",
        ctaLabel: "Open Vercel",
        kind: "external",
        opensInNewTab: true,
        verificationHint: "Attach the deployment URL or screenshot of the live output.",
      },
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
      toolLaunches: [
        {
          key: "chatgpt",
          label: "ChatGPT",
          description: "Use an external copilot if you need a quick first draft outside the tutor.",
          href: "https://chatgpt.com/",
          ctaLabel: "Open ChatGPT",
          kind: "external",
          opensInNewTab: true,
          verificationHint: "Bring the useful output back here as proof.",
        },
        {
          key: "claude",
          label: "Claude",
          description: "Use Claude when the work needs structured writing, analysis, or synthesis.",
          href: "https://claude.ai/",
          ctaLabel: "Open Claude",
          kind: "external",
          opensInNewTab: true,
          verificationHint: "Attach the output or summary that moved the work forward.",
        },
      ],
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
    toolLaunches: template.toolLaunches,
  };
}
