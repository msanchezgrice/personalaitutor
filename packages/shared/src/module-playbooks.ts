import { getCareerPath } from "./matrix";
import type { OAuthConnection } from "./types";
import type { ArtifactKind, GoalType } from "./types";

export type RecommendedModuleToolActionKind =
  | "jira_ticket"
  | "linear_ticket"
  | "notion_brief"
  | "slack_update"
  | "gmail_draft"
  | "hubspot_note"
  | "github_summary"
  | "social_drafts";

export type RecommendedModuleToolAction = {
  actionKey: RecommendedModuleToolActionKind;
  label: string;
  description: string;
};

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
  apiAction?: RecommendedModuleToolAction | null;
};

export type RecommendedModuleStepDefinition = {
  title: string;
  whyThisStep: string;
  proofRequirement: {
    key: string;
    label: string;
    description: string;
    acceptedKinds: ArtifactKind[];
  };
};

export type RecommendedModuleGuide = {
  careerPathId: string;
  careerPathName: string;
  moduleTitle: string;
  whyThisModule: string;
  expectedOutput: string;
  proofChecklist: string[];
  stepDefinitions: RecommendedModuleStepDefinition[];
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

const CHATGPT_LAUNCH: RecommendedModuleToolLaunch = {
  key: "chatgpt",
  label: "ChatGPT",
  description: "Run the session prompts here — every step of this playbook happens inside an AI chat.",
  href: "https://chatgpt.com/",
  ctaLabel: "Open ChatGPT",
  kind: "external",
  opensInNewTab: true,
  verificationHint: "Paste the outputs back into your evidence notes as you go.",
};

const CLAUDE_LAUNCH: RecommendedModuleToolLaunch = {
  key: "claude",
  label: "Claude",
  description: "Use Claude for the session prompts when the work needs longer context or structured writing.",
  href: "https://claude.ai/",
  ctaLabel: "Open Claude",
  kind: "external",
  opensInNewTab: true,
  verificationHint: "Paste the outputs back into your evidence notes as you go.",
};

const NOTION_LAUNCH: RecommendedModuleToolLaunch = {
  key: "notion",
  label: "Notion",
  description: "Store the final brief, decision note, or PRD slice where your team already works.",
  href: "https://www.notion.so/",
  ctaLabel: "Open Notion",
  kind: "external",
  opensInNewTab: true,
  verificationHint: "Paste the doc URL or upload a screenshot of the final page.",
};

const ANALYTICS_LAUNCH: RecommendedModuleToolLaunch = {
  key: "google-analytics",
  label: "Google Analytics",
  description: "Open the traffic baseline or campaign target you want this module to improve.",
  href: "https://analytics.google.com/",
  ctaLabel: "Open Analytics",
  kind: "external",
  opensInNewTab: true,
  verificationHint: "Reference the traffic or conversion metric you are trying to move.",
};

const PM_TOOL_LAUNCHES = [CHATGPT_LAUNCH, CLAUDE_LAUNCH, NOTION_LAUNCH];
const MSEO_TOOL_LAUNCHES = [CHATGPT_LAUNCH, CLAUDE_LAUNCH, ANALYTICS_LAUNCH];

/**
 * Per-module playbooks (rebuild item: AI-tool sessions). Every step is an
 * action performed inside an AI tool with a copy-pasteable prompt embedded in
 * the step text, produces pasteable evidence, and builds toward the module's
 * final artifact. ~45 minutes per session.
 */
const MODULE_PLAYBOOKS: Record<string, Record<string, PlaybookTemplate>> = {
  "product-management": {
    "Synthetic User Research": {
      why: "Synthetic user research turns a fuzzy product question into evidence you can act on today: you interview five AI-simulated users before booking a single real call.",
      expectedOutput:
        "A synthetic user research brief that cites five AI-run interviews: your ICP, ranked themes with supporting quotes, and a recommended next decision.",
      proofChecklist: [
        "Paste your final ICP definition from the ICP prompt.",
        "Paste all five synthetic interview transcripts (or links to the chats).",
        "Paste the ranked theme table with one supporting quote per theme.",
      ],
      steps: [
        'Define your ICP in ChatGPT or Claude (8 min). Paste this prompt: "Act as my product research partner. My product is [one line] and my open question is [one line]. Draft my ideal customer profile: role, company size, top 3 jobs-to-be-done, top 3 pains, and the trigger that makes them look for a solution. Ask me up to 3 clarifying questions before you answer." Paste the final ICP into your evidence notes.',
        'Turn the ICP into an interview script (7 min). Prompt: "Using this ICP: [paste ICP], write an 8-question user interview script that probes their current workflow, pains, workarounds, and willingness to change. No leading questions." Save the script — you will reuse it five times.',
        'Run 5 synthetic user interviews (12 min). Open a fresh chat for each persona and paste: "You are a [role from my ICP] at a [company size] company. Stay in character with realistic constraints and skepticism. I will interview you about [topic]. Answer from lived experience, including annoyances and workarounds." Ask your 8 questions, vary one trait per persona (seniority, industry, team size), and copy each full transcript into your evidence.',
        'Extract themes from the transcripts (8 min). Prompt: "Here are 5 user interview transcripts: [paste transcripts]. Extract the top 5 themes ranked by frequency and intensity. For each theme give a name, a 1-sentence summary, one direct quote per interview that supports it, and any contradictions between interviews." Paste the ranked theme table as evidence.',
        "Generate your research brief artifact (10 min). Ask the tutor to generate the brief from your pasted ICP, transcripts, and themes — it must cite the interviews directly. Review it for anything the transcripts do not support, then attach it as your final artifact.",
      ],
      toolLaunches: PM_TOOL_LAUNCHES,
    },
    "AI Wireframing": {
      why: "AI wireframing collapses the idea-to-mock loop from days to one session: you go from user problem to a critiqued wireframe set without opening a design tool.",
      expectedOutput:
        "An annotated wireframe set for one real flow: a screen-by-screen spec, an AI-generated grayscale HTML mock, and a heuristic critique with the fixes applied.",
      proofChecklist: [
        "Paste the flow spec (screens, key elements, primary action per screen).",
        "Paste or screenshot the generated wireframe mock output.",
        "Paste the heuristic critique table and note what you changed in response.",
      ],
      steps: [
        'Pick one real flow and spec it with AI (8 min). Paste this prompt: "Act as a senior product designer. I need to wireframe this flow: [user + problem + happy path in 2-3 sentences]. Produce a screen-by-screen spec: for each screen list its goal, key elements top-to-bottom, primary action, and empty/error states. Ask me up to 3 clarifying questions first." Paste the final spec into your evidence.',
        'Turn the spec into text wireframes (8 min). Prompt: "Turn this flow spec into low-fidelity wireframes described as layout blocks: [paste spec]. For each screen, output a text wireframe using sections, boxes, and labels so a developer could sketch it exactly. Flag any element that has no clear user need." Copy the output into your evidence.',
        'Generate a clickable grayscale mock (12 min). Prompt: "Generate a single-file HTML page that renders these wireframes as grayscale mock screens I can click through: [paste text wireframes]. No branding, no color — boxes and labels only." Save the output and capture a screenshot as evidence.',
        "Run a heuristic critique (9 min). In a fresh chat: \"Review these wireframes against Nielsen's 10 usability heuristics: [paste wireframes]. Output a table: heuristic, issue, severity 1-3, concrete fix. Then rewrite the two highest-severity screens with the fixes applied.\" Paste the critique table as evidence.",
        "Generate your wireframe artifact (8 min). Ask the tutor to generate the annotated wireframe set from your pasted spec, mock, and critique, then attach it as your final artifact.",
      ],
      toolLaunches: PM_TOOL_LAUNCHES,
    },
    "PRD Generation": {
      why: "A PRD written with an AI red-team catches the gaps a first draft always hides — you ship a reviewable document in one session instead of a week of doc-wrangling.",
      expectedOutput:
        "A complete, red-teamed PRD for one real feature: problem, users, requirements, acceptance criteria, and open risks — ready to circulate.",
      proofChecklist: [
        "Paste the feature context brief the AI interviewed you into.",
        "Paste the first-draft PRD with assumptions marked.",
        "Paste the red-team gap list and how each gap was resolved or rejected.",
      ],
      steps: [
        'Build the context brief (7 min). Paste this prompt: "Interview me to build a feature context brief. Ask me one question at a time about: the user problem, who has it, evidence it matters, constraints, and the metric that should move. Stop after 6 questions and output the brief." Paste the brief into your evidence.',
        'Draft the PRD (10 min). Prompt: "Write a PRD from this context brief: [paste brief]. Sections: problem statement, target users, user stories (as a / I want / so that), functional requirements (must/should/will not), success metrics, rollout risks. Mark every assumption you had to make with [ASSUMPTION]." Copy the draft into your evidence.',
        'Red-team it (10 min). In a fresh chat: "You are a skeptical engineering lead and a data-informed designer reviewing this PRD: [paste PRD]. List the 10 most important gaps, ambiguities, or hidden dependencies, ranked by how badly each would hurt the build. Be blunt." Paste the gap list as evidence.',
        'Resolve the gaps and add acceptance criteria (10 min). Prompt: "Revise the PRD to close these gaps: [paste gap list — mark any you reject with a reason]. Then add Given/When/Then acceptance criteria for each user story." Save the revised PRD.',
        "Generate your PRD artifact (8 min). Ask the tutor to generate the final PRD artifact grounded in your pasted brief, draft, and red-team evidence, then attach it.",
      ],
      toolLaunches: PM_TOOL_LAUNCHES,
    },
    "Sentiment Analysis": {
      why: "Sentiment analysis with an LLM turns a pile of raw feedback into a defensible read on what users feel and why — evidence attached, no spreadsheet gymnastics.",
      expectedOutput:
        "A feedback insight memo built from 20+ real feedback snippets: sentiment breakdown, top pain themes with verbatim quotes, and three recommended actions.",
      proofChecklist: [
        "Paste the numbered raw feedback snippets you collected.",
        "Paste the AI-tagged sentiment/theme table.",
        "Paste the quantified summary — the memo must cite real quotes by line number.",
      ],
      steps: [
        "Collect 20-50 real feedback snippets (8 min). Pull from support tickets, app reviews, NPS verbatims, or sales notes. Number each line, then paste the numbered list into your evidence notes — the whole session grounds on it.",
        'Tag the data (10 min). Prompt: "Classify each numbered feedback snippet below. Output a table: #, sentiment (positive/neutral/negative), emotion (frustration, delight, confusion, ...), theme (define max 6 recurring themes), quote-worthy yes/no. Snippets: [paste numbered list]." Paste the tagged table as evidence.',
        'Quantify it (8 min). Prompt: "From this tagged table: [paste table], output counts by sentiment and by theme, the top 3 negative themes ranked by frequency times intensity, and the 5 most quote-worthy lines with their numbers." Copy the summary into your evidence.',
        'Draft the insight memo (9 min). Prompt: "Write a one-page insight memo from this analysis: [paste counts + quotes]. Three insights max — each with the evidence, one verbatim quote cited by line number, and one recommended product action. No claims the data does not support." Paste the memo draft.',
        "Generate your insight artifact (10 min). Ask the tutor to generate the final sentiment analysis brief citing your tagged snippets and memo, then attach it as your artifact.",
      ],
      toolLaunches: PM_TOOL_LAUNCHES,
    },
  },
  "marketing-seo": {
    "Programmatic SEO": {
      why: "Programmatic SEO wins when one template can honestly answer hundreds of long-tail queries — this session gets you a validated pattern and real sample pages, not a theory.",
      expectedOutput:
        "A programmatic SEO plan: a validated page pattern, a template with variable slots, and three fully generated sample pages grounded in facts you supplied.",
      proofChecklist: [
        "Paste the chosen pattern with its example long-tail queries.",
        "Paste the page template with variable slots.",
        "Paste the three generated sample pages and the dataset rows that power them.",
      ],
      steps: [
        "Find your repeatable pattern (8 min). Paste this prompt: \"I run [business, one line]. Propose 5 programmatic SEO patterns of the form '[modifier] + [head term]' (like 'X for [industry]' or 'X vs Y') that my audience genuinely searches and that I can answer with data I actually have. For each: the pattern, 10 example long-tail queries, and the dataset that would power it. Ask me what data I have first.\" Paste the chosen pattern and queries into your evidence.",
        'Inventory your real facts (9 min). List the true data you have for the pattern (features, integrations, locations, comparisons). Prompt: "Turn these raw facts into a structured dataset table for the pattern [pattern]: [paste facts]. One row per future page; flag rows with too little unique data to justify a page." Paste the table as evidence.',
        'Design the template (10 min). Prompt: "Design a page template for [pattern] with variable slots in {curly braces}: title tag, meta description, H1, intro paragraph, 3-5 body sections, FAQ block, CTA. Every section must stay true when variables change — flag any section that would read as duplicate filler across pages." Copy the template into your evidence.',
        'Generate 3 sample pages (10 min). Prompt: "Fill the template with these 3 rows from my dataset: [paste rows]. Generate all three complete pages. Use ONLY facts from the rows — where data is missing, write [MISSING] instead of inventing." Paste the pages and replace every [MISSING] with a real fact before saving.',
        "Generate your plan artifact (8 min). Ask the tutor to generate the programmatic SEO plan artifact citing your pattern, dataset, and sample pages, then attach it.",
      ],
      toolLaunches: MSEO_TOOL_LAUNCHES,
    },
    "Bulk Content Generation": {
      why: "Bulk content only works with a voice profile and brief system that keeps piece #40 as sharp as piece #1 — this session builds that system and proves it on five drafts.",
      expectedOutput:
        "A reusable content production system: a voice profile, a brief template, and five on-voice draft outlines with openings produced from it in one batch.",
      proofChecklist: [
        "Paste the extracted voice profile.",
        "Paste the filled brief template for the five chosen angles.",
        "Paste the five outlines with openings plus your on-voice / off-voice QA notes.",
      ],
      steps: [
        'Build a voice profile from your best work (8 min). Paste this prompt: "Here are 2-3 samples of our best content: [paste samples]. Extract a voice profile: tone adjectives, sentence rhythm, vocabulary to prefer, phrases to ban, how we open and close pieces, and a sounds-like-us / does-not-sound-like-us example pair." Paste the profile into your evidence.',
        'Define the cluster and angles (8 min). Prompt: "We are producing a content batch about [topic] for [audience]. Propose 8 piece angles that do not cannibalize each other: working title, the search query it targets, a one-line unique angle, and the reader\'s job-to-be-done. Cut any angle that overlaps another by more than 30%." Save your chosen 5 angles as evidence.',
        'Create the brief template (10 min). Prompt: "Create a reusable content brief template with slots for: target query, angle, voice profile (attached), required sections, internal links, sources to cite, and a do-not-say list. Then fill it for these 5 angles: [paste angles]." Paste the filled briefs.',
        'Batch-generate the five drafts (11 min). For each brief, open a fresh chat and paste: "Using this brief and voice profile: [paste one brief + the profile], write the full outline with H2/H3s and the first 150 words. Follow the voice profile exactly — drafts that break the banned-phrases list will be rejected." Collect all five, mark each line on-voice or off-voice, and paste the batch with QA notes.',
        "Generate your content system artifact (8 min). Ask the tutor to generate the content system artifact (voice profile + brief template + batch) grounded in your pasted evidence, then attach it.",
      ],
      toolLaunches: MSEO_TOOL_LAUNCHES,
    },
    "AI Keyword Clustering": {
      why: "Keyword clustering by intent is the difference between publishing pages and building a rankable topic map — an LLM does the grouping in minutes when prompted correctly.",
      expectedOutput:
        "An intent-clustered keyword map for one topic: named clusters, priority scores, and a page-by-page mapping ready to hand to content.",
      proofChecklist: [
        "Paste the raw query list you started from.",
        "Paste the intent cluster table (including the unclustered bucket).",
        "Paste the prioritized page map for the top clusters.",
      ],
      steps: [
        'Assemble 40-80 real queries (8 min). Export from Search Console or your keyword tool if you have one; otherwise paste this prompt: "List 60 realistic search queries a [audience] would type when researching [topic]. Mix informational, comparison, and buying intent. One per line, no invented volume numbers." Paste the final query list into your evidence.',
        "Cluster by intent (10 min). Prompt: \"Cluster these queries by search intent and sub-topic: [paste queries]. Output a table: cluster name, intent (informational/comparison/transactional), the queries in it, and the single page type that should target it (guide, comparison, landing page, FAQ). Do not force queries into clusters they do not fit — put outliers in an 'unclustered' bucket.\" Paste the cluster table as evidence.",
        'Prioritize the clusters (9 min). Prompt: "Score each cluster 1-5 on: business fit for [your offer], buying intent, and how realistically a new page could rank. Multiply into a priority score and rank the clusters, with one sentence of reasoning each." Copy the ranked list into your evidence.',
        "Map clusters to pages (10 min). Prompt: \"For the top 5 clusters, output: URL slug, title tag (under 60 chars), meta description (under 155 chars), H1, and 4-6 H2s that cover the cluster's queries. Our existing pages are [paste URLs or 'none'] — note where updating an existing page beats creating a new one.\" Paste the page map.",
        "Generate your clustering artifact (8 min). Ask the tutor to generate the keyword clustering brief artifact citing your query list, clusters, and page map, then attach it.",
      ],
      toolLaunches: MSEO_TOOL_LAUNCHES,
    },
    "Copywriting Agents": {
      why: "A copywriting agent is a system prompt that reliably produces on-brand variants on demand — build it once and every future campaign starts at draft ten instead of draft zero.",
      expectedOutput:
        "A reusable copywriting agent (system prompt) plus a tested copy pack: ten scored variants for one real conversion surface and the top three ready to ship.",
      proofChecklist: [
        "Paste the conversion copy brief the AI interviewed you into.",
        "Paste the agent system prompt you built.",
        "Paste all ten variants with their scores and the chosen top three.",
      ],
      steps: [
        'Pick one conversion surface and build the offer brief (7 min). Paste this prompt: "Interview me one question at a time to build a conversion copy brief for my [landing hero / email / ad]. Cover: audience, pain, promise, proof, main objection, CTA, and the exact action we want. Stop after 6 questions and output the brief." Paste the brief into your evidence.',
        'Draft the agent (9 min). Prompt: "Write a reusable system prompt for a copywriting agent that produces [surface] copy for us. Include: role, our offer brief (attached), voice rules with banned phrases, output format (headline + subhead + CTA), and 3 quality checks it must run on its own output before answering." Paste the system prompt as evidence.',
        'Run the agent (11 min). Open a fresh chat, paste the agent system prompt, then: "Produce 10 distinct variants. Vary the persuasion angle across: pain-led, outcome-led, social-proof-led, objection-led, and curiosity-led. Label each variant with its angle." Copy all ten variants into your evidence.',
        'Score and select (10 min). Prompt: "Score each variant 1-5 against the brief on clarity, specificity, believability, and CTA strength: [paste variants + brief]. Rank them, pick the top 3, and state what a simple A/B test between #1 and #2 should measure." Paste the scoring table.',
        "Generate your copy pack artifact (8 min). Ask the tutor to generate the copy pack artifact (agent prompt + top variants + test plan) from your pasted evidence, then attach it.",
      ],
      toolLaunches: MSEO_TOOL_LAUNCHES,
    },
  },
};

const PLAYBOOKS: Record<string, PlaybookTemplate> = {
  "product-management": {
    why: "This path's playbooks run the whole loop inside an AI tool: real product context in, pasteable evidence out, and a reviewable artifact at the end.",
    expectedOutput:
      "One AI-produced product artifact (brief, spec, or analysis) grounded in a real workflow, with the prompts and outputs that produced it.",
    proofChecklist: [
      "Paste the restated problem statement.",
      "Paste the AI-produced working output with assumptions marked.",
      "Paste the red-team gap list and what you changed.",
    ],
    steps: [
      'Anchor {module} on one real product question (10 min). Paste this prompt into ChatGPT or Claude: "Act as my product thinking partner for {module}. My open question is [one line]. Ask me up to 4 questions to pin down the user, the decision I need to make, and what evidence would change my mind — then restate the problem crisply." Paste the restated problem as evidence.',
      'Produce the first working output with AI (12 min). Prompt: "Using this problem statement: [paste it], produce the first working version of the {module} output. Mark every assumption with [ASSUMPTION] so I can verify it." Copy the full output into your evidence.',
      'Red-team and revise (13 min). In a fresh chat: "You are a skeptical product leader reviewing this work: [paste output]. List the 5 biggest gaps or wrong assumptions, ranked by risk. Be blunt." Fix what holds up, note what you rejected, and save both lists as evidence.',
      "Generate your artifact (10 min). Ask the tutor to generate the final artifact from your pasted problem, output, and red-team notes, then attach it as proof.",
    ],
    toolLaunches: PM_TOOL_LAUNCHES,
  },
  "marketing-seo": {
    why: "This path's playbooks run the whole growth loop inside an AI tool: real audience and campaign context in, pasteable evidence out, and a reusable asset at the end.",
    expectedOutput:
      "One AI-produced marketing asset (brief, cluster map, or copy system) tied to a real audience, with the prompts and outputs that produced it.",
    proofChecklist: [
      "Paste the audience and goal brief.",
      "Paste the AI-produced working output.",
      "Paste the critique pass and what you changed.",
    ],
    steps: [
      'Anchor {module} on one real audience and goal (10 min). Paste this prompt into ChatGPT or Claude: "Act as my growth partner for {module}. My audience is [who] and the metric I care about is [metric]. Ask me up to 4 questions to sharpen the target, then restate the goal and the single asset that would move it." Paste the restated goal as evidence.',
      'Produce the first working output with AI (12 min). Prompt: "Using this goal: [paste it], produce the first working version of the {module} output. Ground every claim in what I told you — mark anything you had to assume with [ASSUMPTION]." Copy the full output into your evidence.',
      'Critique and tighten (13 min). In a fresh chat: "You are a demanding head of growth reviewing this asset: [paste output]. List the 5 weakest points — vague claims, generic copy, missing intent match — ranked by impact, then rewrite the two weakest sections." Save the critique and rewrites as evidence.',
      "Generate your artifact (10 min). Ask the tutor to generate the final artifact from your pasted goal, output, and critique notes, then attach it as proof.",
    ],
    toolLaunches: MSEO_TOOL_LAUNCHES,
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

function toolActionForLaunch(tool: RecommendedModuleToolLaunch): RecommendedModuleToolAction | null {
  switch (tool.key) {
    case "jira":
      return {
        actionKey: "jira_ticket",
        label: "Generate ticket draft",
        description: "Create a ready-to-paste Jira issue from the current pack and step context.",
      };
    case "linear":
      return {
        actionKey: "linear_ticket",
        label: "Generate Linear issue",
        description: "Create a concise Linear-ready issue with scope, outcome, and verification notes.",
      };
    case "notion":
      return {
        actionKey: "notion_brief",
        label: "Generate brief",
        description: "Draft a Notion-ready doc or operating brief from the pack context.",
      };
    case "slack":
      return {
        actionKey: "slack_update",
        label: "Generate Slack update",
        description: "Draft a team update you can paste into Slack after each meaningful step.",
      };
    case "gmail":
      return {
        actionKey: "gmail_draft",
        label: "Generate email draft",
        description: "Create a polished email draft tied to the workflow you are shipping.",
      };
    case "hubspot":
      return {
        actionKey: "hubspot_note",
        label: "Generate CRM note",
        description: "Draft a HubSpot-ready note or sequence input from the pack work.",
      };
    case "github":
      return {
        actionKey: "github_summary",
        label: "Generate GitHub summary",
        description: "Create a README, PR summary, or issue note grounded in the current build.",
      };
    case "linkedin":
    case "linkedin-profile":
      return {
        actionKey: "social_drafts",
        label: "Generate social drafts",
        description: "Create role-specific LinkedIn and X drafts from the current pack work.",
      };
    default:
      return null;
  }
}

function stepDefinitionForTitle(
  title: string,
  index: number,
  moduleTitle: string,
  totalSteps: number,
): RecommendedModuleStepDefinition {
  const lastIndex = Math.max(0, totalSteps - 1);

  if (index === 0 && lastIndex > 0) {
    return {
      title,
      whyThisStep: `This step anchors ${moduleTitle} to a real workflow so the rest of the pack stays specific instead of generic.`,
      proofRequirement: {
        key: "starting-context",
        label: "Starting context",
        description: "Attach the live ticket, document, queue, dashboard, or screenshot that shows where this module starts.",
        acceptedKinds: ["proof_link", "proof_upload"],
      },
    };
  }

  if (index < lastIndex) {
    return {
      title,
      whyThisStep: `This step captures the working output so you can prove the AI-assisted work existed before the final polish.`,
      proofRequirement: {
        key: "working-draft",
        label: "Working draft",
        description: "Attach the draft output, intermediate artifact, or screenshot that shows the work moving from idea into execution.",
        acceptedKinds: ["proof_link", "proof_upload", "pdf", "pptx"],
      },
    };
  }

  return {
    title,
    whyThisStep: `This final step turns ${moduleTitle} into visible proof that another person can inspect quickly.`,
    proofRequirement: {
      key: "visible-proof",
      label: "Visible proof",
      description: "Attach the final artifact, public link, or exported file that shows the shipped outcome from this pack.",
      acceptedKinds: ["website", "pdf", "pptx", "proof_link", "proof_upload"],
    },
  };
}

export function buildRecommendedModuleGuide(input: {
  careerPathId?: string | null;
  moduleTitle: string;
  jobTitle?: string | null;
  primaryGoal?: GoalType | null;
}): RecommendedModuleGuide {
  const careerPath = getCareerPath(String(input.careerPathId || "")) ?? null;
  const trimmedModuleTitle = input.moduleTitle.trim();
  const template = careerPath
    ? MODULE_PLAYBOOKS[careerPath.id]?.[trimmedModuleTitle] ?? PLAYBOOKS[careerPath.id] ?? null
    : null;
  const careerPathId = careerPath?.id ?? "general";
  const careerPathName = careerPath?.name ?? "Current path";
  const moduleTitle = input.moduleTitle.trim() || "Starter AI Pack";
  const roleLabel = input.jobTitle?.trim() || careerPathName;
  const goalLabel = firstGoalLabel(input.primaryGoal ?? null);

  if (!template) {
    const steps = [
      `Start ${moduleTitle} on one real workflow from your week.`,
      "Produce the smallest useful output first.",
      "Package the result as visible proof instead of leaving it private.",
    ];
    const toolLaunches: RecommendedModuleToolLaunch[] = [
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
    ];
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
      stepDefinitions: steps.map((step, index) => stepDefinitionForTitle(step, index, moduleTitle, steps.length)),
      steps,
      toolFocus: [],
      toolLaunches: toolLaunches.map((tool) => ({ ...tool, apiAction: toolActionForLaunch(tool) })),
    };
  }

  const steps = template.steps.map((step) => step.replaceAll("{module}", moduleTitle));
  return {
    careerPathId,
    careerPathName,
    moduleTitle,
    whyThisModule: `${template.why} For ${roleLabel}, the goal is to ${goalLabel}.`,
    expectedOutput: template.expectedOutput,
    proofChecklist: template.proofChecklist,
    stepDefinitions: steps.map((step, index) => stepDefinitionForTitle(step, index, moduleTitle, steps.length)),
    steps,
    toolFocus: careerPath?.tools.slice(0, 4) ?? [],
    toolLaunches: template.toolLaunches.map((tool) => ({
      ...tool,
      apiAction: toolActionForLaunch(tool),
    })),
  };
}
