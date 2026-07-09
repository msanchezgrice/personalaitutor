import { getCareerPath, isLegacyPersonaHeadline } from "./matrix";
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

const HUBSPOT_LAUNCH: RecommendedModuleToolLaunch = {
  key: "hubspot",
  label: "HubSpot",
  description: "Open the real pipeline, list, or sequence this session's output should land in.",
  href: "https://app.hubspot.com/",
  ctaLabel: "Open HubSpot",
  kind: "external",
  opensInNewTab: true,
  verificationHint: "Capture the segment, list, or pipeline stage this build improves.",
};

const ZENDESK_LAUNCH: RecommendedModuleToolLaunch = {
  key: "zendesk",
  label: "Zendesk",
  description: "Open the ticket queue the session's real tickets and macros come from.",
  href: "https://www.zendesk.com/",
  ctaLabel: "Open Zendesk",
  kind: "external",
  opensInNewTab: true,
  verificationHint: "Reference the ticket class or macro flow you improved.",
};

const ZAPIER_LAUNCH: RecommendedModuleToolLaunch = {
  key: "zapier",
  label: "Zapier",
  description: "Open the automation workspace where this session's blueprint will eventually run.",
  href: "https://zapier.com/app/dashboard",
  ctaLabel: "Open Zapier",
  kind: "external",
  opensInNewTab: true,
  verificationHint: "Attach the automation map or blueprint as proof.",
};

const GREENHOUSE_LAUNCH: RecommendedModuleToolLaunch = {
  key: "greenhouse",
  label: "Greenhouse",
  description: "Open the ATS where the screening or interview workflow actually happens.",
  href: "https://app.greenhouse.io/",
  ctaLabel: "Open Greenhouse",
  kind: "external",
  opensInNewTab: true,
  verificationHint: "Capture the hiring stage, scorecard, or summary flow this module improved.",
};

const MIDJOURNEY_LAUNCH: RecommendedModuleToolLaunch = {
  key: "midjourney",
  label: "Midjourney",
  description: "Open your image generation workspace to create the visual variants for this pack.",
  href: "https://www.midjourney.com/",
  ctaLabel: "Open Midjourney",
  kind: "external",
  opensInNewTab: true,
  verificationHint: "Attach the strongest visual output or prompt set.",
};

const GITHUB_LAUNCH: RecommendedModuleToolLaunch = {
  key: "github",
  label: "GitHub",
  description: "Open the repo, issue, or pull request where the implementation belongs.",
  href: "https://github.com/",
  ctaLabel: "Open GitHub",
  kind: "external",
  opensInNewTab: true,
  verificationHint: "Link the repo, branch, or PR that contains the build.",
};

const PM_TOOL_LAUNCHES = [CHATGPT_LAUNCH, CLAUDE_LAUNCH, NOTION_LAUNCH];
const MSEO_TOOL_LAUNCHES = [CHATGPT_LAUNCH, CLAUDE_LAUNCH, ANALYTICS_LAUNCH];
const SALES_TOOL_LAUNCHES = [CHATGPT_LAUNCH, CLAUDE_LAUNCH, HUBSPOT_LAUNCH];
const SUPPORT_TOOL_LAUNCHES = [CHATGPT_LAUNCH, CLAUDE_LAUNCH, ZENDESK_LAUNCH];
const OPS_TOOL_LAUNCHES = [CHATGPT_LAUNCH, CLAUDE_LAUNCH, ZAPIER_LAUNCH];
const HR_TOOL_LAUNCHES = [CHATGPT_LAUNCH, CLAUDE_LAUNCH, GREENHOUSE_LAUNCH];
const DESIGN_TOOL_LAUNCHES = [CHATGPT_LAUNCH, CLAUDE_LAUNCH, MIDJOURNEY_LAUNCH];
const SWE_TOOL_LAUNCHES = [CHATGPT_LAUNCH, CLAUDE_LAUNCH, GITHUB_LAUNCH];
const QA_TOOL_LAUNCHES = [CHATGPT_LAUNCH, CLAUDE_LAUNCH, GITHUB_LAUNCH];

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
  "sales-revops": {
    "Predictive Lead Scoring": {
      why: "Predictive lead scoring turns gut-feel prioritization into a rubric your whole team can run: one session gets you a weighted model tested against real wins and losses.",
      expectedOutput:
        "A lead scoring model brief: a weighted scoring rubric, 20 real leads scored with it, and a validation pass against past closed-won and closed-lost deals.",
      proofChecklist: [
        "Paste the signal inventory ranked by predictive power.",
        "Paste the weighted scoring rubric.",
        "Paste the scored lead table and the validation notes against past deals.",
      ],
      steps: [
        'Inventory your buying signals (8 min). Paste this prompt into ChatGPT or Claude: "Act as my RevOps partner. I sell [product, one line] to [buyer, one line]. List every signal we could realistically score a lead on — firmographic, behavioral, and intent — and rank the top 10 by likely predictive power for my motion. Ask me up to 3 questions about my pipeline first." Paste the ranked signal list into your evidence notes.',
        'Build the weighted rubric (9 min). Prompt: "Turn these signals into a lead scoring rubric: [paste ranked signals]. For each signal: a weight out of 100 total, the data source, and the exact rule for awarding points (thresholds, not vibes). Flag any signal we cannot actually observe today." Copy the rubric into your evidence.',
        'Score 20 real leads (10 min). Pull 20 leads from your CRM or a recent list export — mix obvious fits and long shots. Prompt: "Score each of these leads with the rubric: [paste rubric + the 20 leads with their known attributes]. Output a table: lead, per-signal points, total score, tier (A/B/C), and the single missing data point that would most change the score." Paste the scored table as evidence.',
        'Validate against real outcomes (10 min). Prompt: "Here are 5 past closed-won and 5 closed-lost deals with their attributes: [paste deals]. Score them with the same rubric. Where do wins score low or losses score high? Propose specific weight changes and state the tradeoff of each." Save the validation notes and the adjusted rubric as evidence.',
        "Generate your scoring model artifact (8 min). Ask the tutor to generate the lead scoring brief from your pasted rubric, scored table, and validation notes — it must state the rubric a rep could apply in under a minute. Attach it as your final artifact.",
      ],
      toolLaunches: SALES_TOOL_LAUNCHES,
    },
    "Deep Data Enrichment": {
      why: "Enrichment is where outreach quality is actually won: this session builds an AI research workflow that turns a bare account list into decision-ready profiles.",
      expectedOutput:
        "An account enrichment pack: a field schema tied to your qualification criteria, five AI-researched account profiles, and a repeatable enrichment prompt.",
      proofChecklist: [
        "Paste the enrichment field schema with the qualifying question each field answers.",
        "Paste the five enriched account profiles with sources noted.",
        "Paste the reusable enrichment prompt and your accuracy spot-check notes.",
      ],
      steps: [
        'Define the fields that matter (8 min). Paste this prompt into ChatGPT or Claude: "Act as my sales research lead. I sell [product] and qualify accounts on [criteria, one line]. Design an enrichment schema of 8-12 fields that would let a rep decide fit and angle in 60 seconds — for each field: why it matters, where it is usually findable publicly, and a confidence label (verifiable vs inferred)." Paste the schema into your evidence notes.',
        'Build the reusable enrichment prompt (10 min). Prompt: "Write a reusable research prompt that takes a company name and domain and fills this schema: [paste schema]. It must cite where each answer came from, write UNKNOWN instead of guessing, and end with a 2-sentence fit summary against my criteria." Save the prompt — it is the core of your workflow — and copy it into your evidence.',
        "Enrich 5 real target accounts (10 min). Run the enrichment prompt once per account in a fresh chat (use an AI tool with web access if you have one). Paste each completed profile into your evidence, keeping every UNKNOWN visible — the gaps are part of the output.",
        'Spot-check and harden (9 min). Verify 3 fields per account against the company site or LinkedIn. Prompt: "Here are my spot-check results: [paste corrections]. Revise the enrichment prompt so the errors I found are less likely — tighten sourcing rules, add a verification step, or downgrade fields to inferred." Save the revised prompt and your check notes as evidence.',
        "Generate your enrichment workflow artifact (8 min). Ask the tutor to generate the enrichment pack from your pasted schema, profiles, and hardened prompt — schema, prompt, and the five profiles as worked examples. Attach it as your final artifact.",
      ],
      toolLaunches: SALES_TOOL_LAUNCHES,
    },
    "Hyper-personalized Cold Outreach": {
      why: "Personalization at depth is what gets replies, and it only scales when research and drafting run through a repeatable AI workflow — this session builds one on five real prospects.",
      expectedOutput:
        "An outreach pack: five researched prospects, a personalization angle for each, and a three-touch sequence per prospect that passes your own reply-worthiness bar.",
      proofChecklist: [
        "Paste the five prospect research digests.",
        "Paste the personalization angles with the evidence line each one leans on.",
        "Paste the three-touch sequences and the QA scores per message.",
      ],
      steps: [
        'Pick 5 real prospects and digest them (8 min). For each prospect paste this prompt into a fresh chat: "Summarize what is publicly knowable about [name, role, company]: recent company news, likely priorities for their role, tech or process clues, and one thing they have personally published or said. Mark anything uncertain as UNVERIFIED — I will check it." Paste the five digests into your evidence notes.',
        'Find the angle for each (9 min). Prompt: "For each prospect digest below, propose the single strongest personalization angle — a specific, verifiable observation that connects their world to [your offer, one line]. Reject generic flattery. Digests: [paste digests]. Output: prospect, angle, the evidence line it leans on, and the risk if the inference is wrong." Copy the angle table into your evidence.',
        'Draft three-touch sequences (12 min). Prompt: "Write a 3-touch sequence (opener, value follow-up, breakup) for each prospect using their angle: [paste angles]. Rules: under 90 words per email, first line must be about them not us, one concrete proof point, one low-friction CTA, no [FIRSTNAME]-style filler." Paste all sequences as evidence.',
        'QA against the reply bar (8 min). In a fresh chat: "You are a busy [prospect role] who deletes most cold email. Score each message 1-5 on: would you keep reading, does the personalization feel real, is the ask easy. Rewrite the two lowest scorers. Messages: [paste sequences]." Save the scores and rewrites as evidence.',
        "Generate your outreach pack artifact (8 min). Ask the tutor to generate the outreach pack from your pasted digests, angles, and QA-scored sequences, then attach it as your final artifact.",
      ],
      toolLaunches: SALES_TOOL_LAUNCHES,
    },
  },
  "customer-support": {
    "RAG Document Retrieval": {
      why: "Retrieval-grounded answers are the difference between a support bot that helps and one that invents policy: this session proves grounding on your own help content.",
      expectedOutput:
        "A grounded support assistant spec: a curated knowledge pack, an answer-with-citations prompt, and a test log showing grounded answers plus caught failure cases.",
      proofChecklist: [
        "Paste the knowledge pack inventory with the questions each document answers.",
        "Paste the grounded answering prompt with its refusal rule.",
        "Paste the ten-question test log including the trap questions and outcomes.",
      ],
      steps: [
        'Curate the knowledge pack (8 min). Collect 5-8 real help articles, macros, or policy snippets and paste this prompt: "Here are our support documents: [paste content]. Build an inventory table: doc ID, title, the top 3 customer questions it answers, and any contradictions or gaps between documents." Paste the inventory into your evidence notes.',
        'Build the grounded answering prompt (9 min). Prompt: "Write a system prompt for a support assistant that answers ONLY from the provided documents. Rules: quote or cite the doc ID for every claim, answer in our support voice, and if the documents do not cover the question reply that a teammate will follow up — never guess. Documents: [paste pack]." Save the prompt and copy it into your evidence.',
        "Test with 10 real questions (10 min). Pull 10 genuine customer questions from tickets — include 2 the documents cannot answer and 1 asking the assistant to bend policy. Run each against the assistant in a fresh chat and paste the full Q&A log into your evidence.",
        'Grade the grounding (10 min). Prompt: "Grade this support assistant test log: [paste log]. For each answer: grounded (cites a real doc correctly), hallucinated (claims beyond the docs), or correctly-refused. Then propose prompt fixes for every hallucination and one gap the knowledge pack must fill." Save the graded table and the fixed prompt as evidence.',
        "Generate your assistant spec artifact (8 min). Ask the tutor to generate the grounded assistant spec from your pasted inventory, prompt, and graded test log — including the refusal rule and known gaps. Attach it as your final artifact.",
      ],
      toolLaunches: SUPPORT_TOOL_LAUNCHES,
    },
    "Intelligent Ticket Routing": {
      why: "Routing is a classification problem your best triager already solves in their head — this session extracts that judgment into a prompt you can measure against real tickets.",
      expectedOutput:
        "A ticket routing spec: a category taxonomy, a classification prompt with confidence rules, and a measured accuracy run over 20 real tickets.",
      proofChecklist: [
        "Paste the routing taxonomy with owner and SLA per category.",
        "Paste the classification prompt including the low-confidence escalation rule.",
        "Paste the 20-ticket accuracy table with the error analysis.",
      ],
      steps: [
        'Extract the taxonomy from real tickets (8 min). Copy 20 recent tickets (subject + first message, scrub names) and paste this prompt: "Here are 20 support tickets: [paste tickets]. Propose a routing taxonomy of 5-8 categories: name, definition, owning queue or team, target SLA, and 2 example tickets from the set. Flag tickets that fit no category." Paste the taxonomy into your evidence notes.',
        'Build the classifier prompt (9 min). Prompt: "Write a classification prompt that assigns a ticket to one of these categories: [paste taxonomy]. It must output: category, urgency (low/normal/high), confidence 0-100, and a one-line reason. Below confidence 70 it must route to human triage instead of guessing." Save it and copy it into your evidence.',
        "Run the 20-ticket eval (10 min). First write down your own answer key — the correct category and urgency per ticket. Then classify all 20 with the prompt in a fresh chat and paste the full results table next to your key as evidence.",
        'Measure and fix (10 min). Prompt: "Compare predictions to the answer key: [paste both]. Output accuracy overall and per category, list every miss with the likely cause (ambiguous definition, missing category, prompt wording), and rewrite the category definitions that caused misses." Save the accuracy table and revised taxonomy as evidence.',
        "Generate your routing spec artifact (8 min). Ask the tutor to generate the ticket routing spec from your pasted taxonomy, classifier prompt, and accuracy run — a support lead should be able to pilot it next week. Attach it as your final artifact.",
      ],
      toolLaunches: SUPPORT_TOOL_LAUNCHES,
    },
    "Tone & Sentiment Detection": {
      why: "The costliest tickets are the ones where frustration goes unnoticed until churn: this session builds a detector that flags at-risk customers and rewrites replies in the right register.",
      expectedOutput:
        "A tone playbook: a tagged set of real customer messages, an escalation rule set keyed to emotional signals, and before/after response rewrites.",
      proofChecklist: [
        "Paste the tagged message table (sentiment, emotion, churn-risk).",
        "Paste the escalation rules mapped to the signals that trigger them.",
        "Paste the before/after response rewrites with the tone rationale.",
      ],
      steps: [
        'Collect and tag 15 real messages (8 min). Copy 15 customer messages across the mood spectrum (scrub names) and paste this prompt: "Tag each message: sentiment (positive/neutral/negative), primary emotion (frustration, confusion, anger, delight, anxiety), intensity 1-5, churn-risk yes/no with the phrase that signals it. Messages: [paste them]." Paste the tagged table into your evidence notes.',
        'Define escalation rules (9 min). Prompt: "From this tagged table: [paste table], derive escalation rules a support team could run automatically: which signal combinations page a lead, which get a priority queue, which get a standard reply. Express each rule as WHEN [signals] THEN [action] and note false-positive risk." Copy the rules into your evidence.',
        'Stress-test the rules (10 min). Prompt: "Here are 5 new messages the rules have not seen: [paste 5 held-back messages]. Apply the escalation rules step by step and state which fire. Then write 3 adversarial messages that SHOULD escalate but would slip past the rules, and patch the rules." Save the test results and patched rules as evidence.',
        'Rewrite responses in the right register (10 min). Pick your 3 tensest messages. Prompt: "For each message and our draft reply: [paste pairs], critique the reply tone against the customer emotional state, then rewrite it — acknowledge the emotion first, be concrete about the fix, no corporate filler. Explain each change in one line." Paste the before/after pairs as evidence.',
        "Generate your tone playbook artifact (8 min). Ask the tutor to generate the tone playbook from your pasted tagged table, escalation rules, and rewrites, then attach it as your final artifact.",
      ],
      toolLaunches: SUPPORT_TOOL_LAUNCHES,
    },
  },
  operations: {
    "Cross-application Data Sync": {
      why: "Every manual copy-paste bridge between two tools is an error factory: this session designs the sync blueprint — triggers, field maps, and failure handling — that automation can be built from.",
      expectedOutput:
        "An automation blueprint for one real cross-tool sync: current-state map, field mapping table, trigger and edge-case rules, ready to hand to whoever wires it up.",
      proofChecklist: [
        "Paste the current-state workflow map with the failure points marked.",
        "Paste the field mapping table with transforms and conflict rules.",
        "Paste the edge-case matrix and the dry-run walkthrough output.",
      ],
      steps: [
        'Map the manual workflow (8 min). Pick one copy-paste bridge you or your team run weekly. Paste this prompt into ChatGPT or Claude: "Interview me one question at a time about a manual data transfer between [tool A] and [tool B]: what triggers it, what fields move, who touches it, where it breaks. Stop after 6 questions and output a numbered current-state map with failure points marked." Paste the map into your evidence notes.',
        'Design the field mapping (10 min). Prompt: "Build a field mapping table for this sync: [paste map]. Columns: source field, destination field, transform (format, lookup, default), what happens when the value is missing, and which system wins on conflict. Flag any field with no clean mapping." Copy the table into your evidence.',
        'Define triggers and edge cases (10 min). Prompt: "For this sync: [paste map + mapping], specify: the trigger event, idempotency rule (what stops a double-run creating duplicates), retry behavior on failure, and an edge-case matrix — duplicates, deletions, partial records, permission errors — each with its handling rule." Save the rules as evidence.',
        'Dry-run the blueprint on real records (9 min). Take 3 real records (scrub sensitive values). Prompt: "Walk these records through the blueprint step by step: [paste records + blueprint]. Show the destination result per record, and state exactly where record 3 would fail if [pick a realistic edge case] happened." Paste the walkthrough output and fix anything it exposed.',
        "Generate your automation blueprint artifact (8 min). Ask the tutor to generate the sync blueprint from your pasted map, mapping table, rules, and dry-run — precise enough for a Zapier or Make build without further questions. Attach it as your final artifact.",
      ],
      toolLaunches: OPS_TOOL_LAUNCHES,
    },
    "OCR Document Processing": {
      why: "Documents are where ops time disappears — this session turns a stack of PDFs or scans into structured rows using an AI vision chat, with an accuracy check that tells you if you can trust it.",
      expectedOutput:
        "A document processing workflow spec: an extraction schema, a tested vision-extraction prompt, and a field-level accuracy log over three real documents.",
      proofChecklist: [
        "Paste the extraction schema with validation rules per field.",
        "Paste the extraction prompt and the structured output for each document.",
        "Paste the field-level accuracy log against the source documents.",
      ],
      steps: [
        'Define the extraction schema (8 min). Pick one document type you handle weekly (invoice, receipt, order form). Paste this prompt: "Design an extraction schema for [document type]: every field we need downstream, its type, a validation rule (format, range, required), and where on the document it usually appears. Downstream use: [one line]." Paste the schema into your evidence notes.',
        'Build the extraction prompt (9 min). Prompt: "Write an extraction prompt for an AI vision chat that takes a [document type] image and returns this schema as JSON: [paste schema]. Rules: never invent a value — use null with a reason field, flag totals that do not sum, include a confidence per field." Copy the prompt into your evidence.',
        "Extract from 3 real documents (10 min). Upload each document image (scrub sensitive values) to ChatGPT or Claude with the extraction prompt and capture all three JSON outputs into your evidence, exactly as returned — warts included.",
        'Score accuracy field by field (10 min). Check every extracted value against the source documents. Prompt: "Here are my extraction results with my corrections marked: [paste corrected outputs]. Compute per-field accuracy across the 3 documents, identify the failure patterns (layout, handwriting, ambiguous labels), and revise the extraction prompt to address the top 2 patterns." Save the accuracy log and revised prompt as evidence.',
        "Generate your workflow spec artifact (8 min). Ask the tutor to generate the document processing spec from your pasted schema, prompt, outputs, and accuracy log — including when a human must review. Attach it as your final artifact.",
      ],
      toolLaunches: OPS_TOOL_LAUNCHES,
    },
    "Intelligent Extraction": {
      why: "Ops teams sit on unstructured gold — emails, notes, threads — and extraction is how it becomes reportable data: this session builds and validates a schema-locked extraction prompt on your real text.",
      expectedOutput:
        "An extraction pipeline spec: a target schema, a tested extraction prompt with strict null-handling, and a 10-sample validation log with failure analysis.",
      proofChecklist: [
        "Paste the target schema with one worked example.",
        "Paste the extraction prompt and the 10 structured outputs.",
        "Paste the validation log with per-field accuracy and failure patterns.",
      ],
      steps: [
        'Pick the messy source and define the schema (8 min). Choose one unstructured source you mine manually (order emails, meeting notes, form submissions). Paste this prompt: "Here are 2 samples of the raw text: [paste samples]. Design a target schema: fields, types, validation rules, and one fully worked example extracted from sample 1. Ask me 2 clarifying questions about downstream use first." Paste the schema and example into your evidence notes.',
        'Build the extraction prompt (9 min). Prompt: "Write an extraction prompt that converts this raw text into the schema as JSON: [paste schema]. Rules: null plus a reason when a field is absent, never merge two records, copy values verbatim where possible, add extraction_confidence 0-100 per record." Copy the prompt into your evidence.',
        "Run it on 10 real samples (10 min). Collect 10 raw samples including 2 ugly ones (missing data, mixed topics). Run the extraction prompt over them in a fresh chat and paste all 10 structured outputs into your evidence unedited.",
        'Validate and harden (10 min). Mark every wrong or missed field against the source text. Prompt: "Here are 10 extraction outputs with my corrections: [paste marked outputs]. Compute per-field accuracy, name the failure patterns, and rewrite the extraction prompt to fix the two most frequent — without breaking the null rules." Save the validation log and hardened prompt as evidence.',
        "Generate your pipeline spec artifact (8 min). Ask the tutor to generate the extraction pipeline spec from your pasted schema, prompt, outputs, and validation log — including the human-review threshold. Attach it as your final artifact.",
      ],
      toolLaunches: OPS_TOOL_LAUNCHES,
    },
  },
  "human-resources": {
    "Screening Workflow Automation": {
      why: "Screening breaks when every reviewer applies a private rubric: this session turns one real job description into an explicit, bias-checked rubric and proves it on real resumes.",
      expectedOutput:
        "A screening workflow doc: a weighted rubric derived from one real JD, five scored sample resumes with rationales, and a consistency-and-bias check.",
      proofChecklist: [
        "Paste the weighted screening rubric with evidence rules per criterion.",
        "Paste the five scored screens with per-criterion rationales.",
        "Paste the consistency and bias-check output with the rubric changes it forced.",
      ],
      steps: [
        'Turn the JD into a rubric (8 min). Paste this prompt with a real job description: "Act as my structured-hiring partner. Turn this JD into a screening rubric: 6-8 criteria, weight per criterion, and for each a rule for what counts as evidence on a resume (specific accomplishments, not keywords). JD: [paste JD]." Paste the rubric into your evidence notes.',
        'Calibrate on a known-good profile (9 min). Prompt: "Score this resume of someone who succeeded in a similar role against the rubric: [paste resume + rubric]. Per criterion: score, the exact resume line as evidence, and what is missing. If the rubric rewards pedigree over demonstrated work, propose fixes." Save the calibration notes and any rubric changes as evidence.',
        'Screen 5 sample resumes (10 min). Use real (scrubbed) or realistic sample resumes. In a fresh chat: "Score each resume against this rubric: [paste rubric + resumes]. Output per candidate: per-criterion scores with cited evidence lines, total, and recommend (advance / maybe / decline) with a 2-line rationale." Paste all five screens into your evidence.',
        'Run the consistency and bias check (10 min). Prompt: "Audit these 5 screens: [paste screens]. (1) Consistency: same evidence, same score everywhere? (2) Proxy bias: did school names, company brands, or employment gaps move scores without evidence? (3) Rerun candidate 2 with the name and university removed — does the score change? Report findings and rewrite the weakest rubric rule." Save the audit output and final rubric as evidence.',
        "Generate your screening workflow artifact (8 min). Ask the tutor to generate the screening doc from your pasted rubric, screens, and audit — including where a human must make the call. Attach it as your final artifact.",
      ],
      toolLaunches: HR_TOOL_LAUNCHES,
    },
    "Interview Signal Summaries": {
      why: "Debrief quality decides hiring quality, and raw interview notes bury the signal: this session builds a summary format that separates observed evidence from interviewer opinion.",
      expectedOutput:
        "A debrief format pack: a signal summary template, two real interviews summarized with evidence-opinion separation, and a red-team pass for halo effects.",
      proofChecklist: [
        "Paste the signal summary template.",
        "Paste both interview summaries with evidence tagged to quotes.",
        "Paste the red-team output and the template fixes it forced.",
      ],
      steps: [
        'Design the summary template (8 min). Paste this prompt: "Design an interview signal summary template for [role]: competencies assessed, per competency an evidence field (what the candidate actually said or did) split from an interpretation field (what the interviewer concluded), confidence per signal, and open questions for the next round. Keep it under one page." Paste the template into your evidence notes.',
        'Summarize a real interview (9 min). Take your notes or transcript from one interview (scrub names). Prompt: "Fill the template from these notes: [paste template + notes]. Every evidence entry must quote or closely paraphrase the notes — if a competency has no evidence, write NOT ASSESSED instead of inferring." Copy the completed summary into your evidence.',
        'Summarize a second, contrasting interview (10 min). Repeat with notes from a different candidate or interviewer in a fresh chat, then prompt: "Compare these two summaries: [paste both]. Which signals are truly comparable and which reflect different interviewer styles? List the template changes that would make round-over-round comparison cleaner." Save both the summary and comparison as evidence.',
        'Red-team for halo and leniency (10 min). Prompt: "Audit these summaries for judgment traps: [paste summaries]. Where does one strong answer bleed into unrelated competencies (halo)? Where does interpretation exceed evidence? Where would a skeptical hiring manager push back? Rewrite the two weakest entries with evidence-only language." Save the audit and rewrites as evidence.',
        "Generate your debrief format artifact (8 min). Ask the tutor to generate the debrief pack from your pasted template, summaries, and red-team notes — ready to run in your next hiring loop. Attach it as your final artifact.",
      ],
      toolLaunches: HR_TOOL_LAUNCHES,
    },
    "Policy Assistant Copilot": {
      why: "HR answers the same policy questions on repeat, and a wrong answer is a liability: this session builds a copilot that answers only from your actual policies and escalates everything else.",
      expectedOutput:
        "A policy copilot prompt pack: a curated policy pack, a grounded answering prompt with escalation rules, and a test log across easy, tricky, and out-of-scope questions.",
      proofChecklist: [
        "Paste the policy pack inventory with coverage gaps flagged.",
        "Paste the copilot system prompt with its escalation rules.",
        "Paste the ten-question test log with the grading of each answer.",
      ],
      steps: [
        'Assemble the policy pack (8 min). Collect 4-6 real policy excerpts (PTO, expenses, remote work — scrub anything confidential). Paste this prompt: "Here are our policy documents: [paste excerpts]. Build an inventory: doc ID, topic, the 3 most likely employee questions it answers, ambiguous language a copilot could misread, and topics employees ask about that no document covers." Paste the inventory into your evidence notes.',
        'Build the copilot prompt (9 min). Prompt: "Write a system prompt for an HR policy copilot that answers ONLY from the provided documents. Rules: cite the doc ID and section for every answer, answer in plain language, and escalate to a human for anything involving medical, legal, harassment, compensation disputes, or questions the documents do not cover — with a warm handoff line. Documents: [paste pack]." Save it and copy it into your evidence.',
        "Test with 10 employee questions (10 min). Write 10 questions: 5 straightforward, 3 tricky edge cases, 2 that MUST escalate (one out-of-scope, one sensitive). Run each against the copilot in a fresh chat and paste the full Q&A log into your evidence.",
        'Grade and patch (10 min). Prompt: "Grade this copilot test log: [paste log]. Per answer: correct-and-cited, wrong, over-answered (gave policy advice beyond the docs), or correctly-escalated. Patch the system prompt for every failure and list the policy gaps HR should actually document." Save the graded log and patched prompt as evidence.',
        "Generate your copilot pack artifact (8 min). Ask the tutor to generate the policy copilot pack from your pasted inventory, prompt, and graded test log — including the escalation boundary. Attach it as your final artifact.",
      ],
      toolLaunches: HR_TOOL_LAUNCHES,
    },
  },
  "branding-design": {
    "Image Synthesis": {
      why: "Image generation earns its place when it runs from a real creative brief to a selected, defensible set — this session takes one campaign need through brief, prompt system, and critique.",
      expectedOutput:
        "A concept board for one real campaign need: a creative brief, an iterated prompt system, and the three selected images with selection rationale.",
      proofChecklist: [
        "Paste the creative brief.",
        "Paste the prompt iterations with what each change fixed.",
        "Paste or screenshot the selected images with the selection rationale.",
      ],
      steps: [
        'Write the creative brief with AI (8 min). Paste this prompt into ChatGPT or Claude: "Act as my creative director. I need visuals for [brand + campaign need, one line]. Interview me with up to 4 questions, then write a one-page creative brief: audience, single-minded message, mood, color and style references, mandatories, and what to avoid." Paste the brief into your evidence notes.',
        'Build the base prompt system (9 min). Prompt: "Translate this brief into an image-generation prompt system for Midjourney or a similar tool: [paste brief]. Output: one base prompt (subject, style, lighting, composition, mood), 3 controlled variations that change exactly one variable each, and a negative list of what must not appear." Copy the prompt set into your evidence.',
        "Generate and iterate (12 min). Run the base prompt and variations in your image tool (Midjourney, or image generation inside ChatGPT). After each round, note what is off, revise the prompt, and run again — at least 3 rounds. Save every prompt version and screenshot the strongest output per round as evidence.",
        'Critique against the brief (8 min). Prompt: "Here is the brief and my 6 strongest outputs (described or attached): [paste brief + images or descriptions]. Score each 1-5 on brief fit, brand safety, and craft (hands, text, artifacts). Pick the top 3 and state what a retoucher would still fix." Paste the critique table as evidence.',
        "Generate your concept board artifact (8 min). Ask the tutor to generate the concept board write-up from your pasted brief, prompt system, and critique — the selected images with the reasoning a client could follow. Attach it as your final artifact.",
      ],
      toolLaunches: DESIGN_TOOL_LAUNCHES,
    },
    "Style-consistent Training": {
      why: "One good image is luck; a style you can reproduce across every asset is a system — this session extracts your style into a reusable prompt block and proves it holds across subjects.",
      expectedOutput:
        "A style system doc: a written style profile extracted from references, a reusable style block, and a five-subject consistency test with drift scores.",
      proofChecklist: [
        "Paste the extracted style profile.",
        "Paste the reusable style block and the five test prompts.",
        "Paste or screenshot the consistency grid with the drift notes.",
      ],
      steps: [
        'Extract the style profile (8 min). Pick 3-5 reference images that define the style (yours or the brand you serve). Paste this prompt with the images into ChatGPT or Claude: "Describe the shared visual style of these references as a reusable specification: palette, line and shape language, lighting, texture, composition habits, era or movement echoes, and what is conspicuously absent. Be specific enough that another artist could fake it." Paste the profile into your evidence notes.',
        'Compress it into a style block (9 min). Prompt: "Compress this style profile into a reusable style block for image generation — a comma-separated descriptor string under 60 words plus a negative list: [paste profile]. Give me 2 variants: one strict (maximum fidelity) and one loose (style-adjacent exploration)." Copy both blocks into your evidence.',
        "Run the five-subject consistency test (11 min). Generate 5 images with the strict block, changing ONLY the subject each time (portrait, object, landscape, interior, abstract). Keep everything else fixed. Screenshot the grid and save each exact prompt as evidence.",
        'Score the drift (9 min). Prompt: "Here are 5 outputs meant to share one style (attached or described): [paste grid or descriptions]. Score each 1-5 on palette, line language, lighting, and mood fidelity to the profile. Where did the style drift and which descriptor failed to hold it? Revise the style block to pin down the two worst drifts." Paste the drift table and revised block as evidence.',
        "Generate your style system artifact (8 min). Ask the tutor to generate the style system doc from your pasted profile, blocks, and consistency test — usable by anyone producing assets for this brand. Attach it as your final artifact.",
      ],
      toolLaunches: DESIGN_TOOL_LAUNCHES,
    },
    "Vector Generation": {
      why: "Icons and marks live or die on consistency and scalability — this session gets you an AI-generated vector set with real SVG output you can inspect, not just pictures of logos.",
      expectedOutput:
        "An icon set pack: a geometry spec, five AI-generated SVG icons that share one construction system, and the paste-ready SVG code with usage notes.",
      proofChecklist: [
        "Paste the icon set brief and geometry spec.",
        "Paste the SVG code for all five icons.",
        "Paste the consistency review and what you regenerated in response.",
      ],
      steps: [
        'Define the set and its geometry (8 min). Paste this prompt: "Act as my brand systems designer. I need a 5-icon set for [brand/product + the 5 concepts]. Define the construction system: grid size, stroke weight, corner radius, fill vs outline, allowed angles, and the metaphor style. Output as a geometry spec." Paste the spec into your evidence notes.',
        'Generate the first icons as SVG code (9 min). Prompt: "Generate SVG code for the first 2 icons following this geometry spec exactly: [paste spec + concepts]. Requirements: single viewBox 0 0 24 24, consistent stroke width, no embedded raster, minimal paths, each under 20 elements." Paste the SVG code into your evidence and preview it (any online SVG viewer or a Figma paste).',
        'Complete and stress the set (11 min). Generate the remaining 3 icons in the same chat so the system holds. Then prompt: "Render-check all 5 icons against the geometry spec: list any inconsistencies in stroke, corner treatment, optical weight, or metaphor style across the set, icon by icon." Save all SVG code plus the inconsistency list as evidence.',
        'Fix and verify scalability (9 min). Prompt: "Regenerate the flagged icons with the fixes applied: [paste flags]. Then state how each icon degrades at 16px and what to simplify for a small-size variant." Paste the final SVG set and preview screenshots at large and small sizes as evidence.',
        "Generate your icon set artifact (8 min). Ask the tutor to generate the icon set pack from your pasted spec, SVG code, and consistency review — code plus usage notes another designer could extend. Attach it as your final artifact.",
      ],
      toolLaunches: DESIGN_TOOL_LAUNCHES,
    },
    "Video AI": {
      why: "AI video is storyboard-first work: the craft is in the shot design and prompt writing, and this session produces a directed concept — brief, storyboard, generated shots, and an edit plan.",
      expectedOutput:
        "A video concept pack: a 15-30 second concept brief, an AI-built storyboard with per-shot generation prompts, at least one generated clip, and an edit plan.",
      proofChecklist: [
        "Paste the concept brief and storyboard with per-shot prompts.",
        "Paste or link the generated clip outputs with your iteration notes.",
        "Paste the edit plan with music, pacing, and text overlay calls.",
      ],
      steps: [
        'Write the concept brief (8 min). Paste this prompt into ChatGPT or Claude: "Act as my creative director. I need a 15-30 second video for [brand + goal, one line]. Interview me with up to 3 questions, then write the concept brief: audience, single message, emotional arc in 3 beats, visual style, and the final frame." Paste the brief into your evidence notes.',
        'Storyboard with per-shot prompts (9 min). Prompt: "Turn this brief into a storyboard of 4-6 shots: [paste brief]. Per shot: duration, camera move, subject and action, transition, and a ready-to-run text-to-video prompt written for a tool like Runway (subject, motion, camera, lighting, style, length)." Copy the storyboard into your evidence.',
        "Generate the hero shots (11 min). Run the 2 most important shot prompts in your video tool (Runway or similar). Iterate each at least once — note what broke (motion, morphing, coherence) and how you changed the prompt. Save the clips or screenshots and every prompt version as evidence.",
        'Critique and plan the edit (9 min). Prompt: "Here is my storyboard and notes on the generated shots: [paste both]. Critique arc and pacing, then write the edit plan: shot order with durations, where text overlays carry the message, music mood, and the cheapest fix for the weakest shot (regenerate, trim, or replace with a still)." Paste the edit plan as evidence.',
        "Generate your video concept artifact (8 min). Ask the tutor to generate the video concept pack from your pasted brief, storyboard, generation notes, and edit plan, then attach it as your final artifact.",
      ],
      toolLaunches: DESIGN_TOOL_LAUNCHES,
    },
  },
  "software-engineering": {
    "API Integration": {
      why: "Integrations are judged by how they fail, not how they demo: this session uses an AI pair to design, implement, and red-team a third-party API client around one real call you need.",
      expectedOutput:
        "A reviewable integration slice: a client module with typed errors, retry and timeout policy, a red-team failure table, and AI-generated tests — all as pasteable code.",
      proofChecklist: [
        "Paste the integration contract (endpoints, auth, failure policy).",
        "Paste the client module code and the failure-mode table.",
        "Paste the generated tests and their output.",
      ],
      steps: [
        'Write the integration contract (8 min). Pick one real API you need (payment, CRM, weather — anything with docs). Paste this prompt into Claude, ChatGPT, or your AI editor (Cursor, Claude Code): "Act as my integration reviewer. I need to call [API + endpoint] from [language/stack] to do [one line]. Draft the integration contract: request/response shapes, auth handling, timeout budget, retry policy with backoff, rate-limit behavior, and which errors are retryable vs fatal. Ask me 2 questions first." Paste the contract into your evidence notes.',
        'Generate the client module (10 min). Prompt: "Implement the client module from this contract: [paste contract]. Requirements: one public function per operation, typed errors (no silent nulls), timeouts and retries per the contract, no secrets in code — read config from the runtime settings. Keep it under 120 lines and comment only the non-obvious." Copy the full code into your evidence.',
        'Red-team the failure modes (10 min). In a fresh chat: "Review this API client like a hostile SRE: [paste code + contract]. Table every failure mode — network partition, 429 storm, malformed 200, expired credentials, slow response just under timeout — with: what the code does today, what it should do, severity. Then patch the two worst." Paste the failure table and patched code as evidence.',
        'Generate the tests (9 min). Prompt: "Write unit tests for this client with the HTTP layer faked: [paste final code]. Cover: happy path, each typed error, retry-then-succeed, retry-exhausted, and timeout. State what each test would catch in a regression." Run them if your project is handy, or have the AI trace the expected results — paste the tests and outcome as evidence.',
        "Generate your integration artifact (8 min). Ask the tutor to generate the integration design note from your pasted contract, code, failure table, and tests — what a reviewer needs to approve this PR. Attach it as your final artifact.",
      ],
      toolLaunches: SWE_TOOL_LAUNCHES,
    },
    "System Architecture": {
      why: "Architecture skill shows in written tradeoffs: this session produces a real architecture decision record — options, failure analysis, and capacity math — with an AI sparring partner instead of a whiteboard.",
      expectedOutput:
        "An architecture decision record for one real system need: three candidate designs with tradeoffs, a failure-mode analysis, back-of-envelope capacity math, and a justified recommendation.",
      proofChecklist: [
        "Paste the requirements brief with load and constraint numbers.",
        "Paste the three candidate architectures with the tradeoff table.",
        "Paste the failure-mode analysis and capacity estimates.",
      ],
      steps: [
        'Pin down the requirements (8 min). Pick one real design decision you face (queue vs cron, monolith split, cache layer). Paste this prompt: "Act as my staff engineer. Interview me one question at a time about this system need: [one line]. Cover: read/write volume, latency budget, consistency needs, team size, existing stack, and cost ceiling. Stop after 6 questions and output a requirements brief with explicit numbers — force me to estimate where I do not know." Paste the brief into your evidence notes.',
        'Generate three candidate designs (10 min). Prompt: "Propose 3 architectures for this brief: [paste brief]. For each: component diagram in text, data flow, the strongest argument for it, the strongest argument against it, and operational burden for a team of [N]. Make them genuinely different — not one design with three names." Copy all three into your evidence.',
        'Run the failure-mode analysis (10 min). Prompt: "For the two strongest candidates, walk through: the dependency that fails first under 10x load, behavior during a partial outage, data-loss windows, and the 3am page each design generates most. Then do back-of-envelope capacity math from the brief numbers — show the arithmetic." Paste the analysis and math as evidence.',
        'Decide and write the ADR (9 min). Prompt: "Write the architecture decision record: context (from the brief), options considered (the three candidates, one paragraph each), decision with justification tied to the failure analysis and math, and consequences — including what becomes harder. Mark any unverified input as [ASSUMPTION]." Save the ADR draft as evidence.',
        "Generate your ADR artifact (8 min). Ask the tutor to generate the final architecture decision record from your pasted brief, candidates, analysis, and draft — reviewable by an engineer who was not in the room. Attach it as your final artifact.",
      ],
      toolLaunches: SWE_TOOL_LAUNCHES,
    },
    "RAG Setup": {
      why: "RAG quality is decided by chunking, retrieval, and grounding rules long before any model call: this session designs the pipeline and proves the grounding behavior on your own documents.",
      expectedOutput:
        "A RAG design pack: a corpus and chunking spec, retrieval configuration, a grounded answering prompt, and an eval log showing cited answers and correctly refused questions.",
      proofChecklist: [
        "Paste the corpus inventory and chunking spec.",
        "Paste the grounded answering prompt and retrieval configuration.",
        "Paste the eval log with grounded, hallucinated, and refused outcomes.",
      ],
      steps: [
        'Spec the corpus and chunking (8 min). Pick a real document set (docs, wiki, runbooks). Paste this prompt: "Act as my RAG architect. My corpus is [description: doc types, count, size, update rate] serving [use case]. Recommend: chunk size and overlap with reasoning, what metadata to attach per chunk, embedding model class, and vector store choice for my scale — with the simplest option that works. Ask me 2 questions first." Paste the spec into your evidence notes.',
        'Generate the pipeline code (10 min). Prompt: "Write the ingestion and retrieval code for this spec in [language]: [paste spec]. Two functions: ingest(documents) that chunks, embeds, and upserts with metadata; retrieve(query, k) that returns chunks with scores and source references. Use [chosen store] and keep it under 100 lines total." Copy the code into your evidence.',
        'Write the grounding rules (10 min). Prompt: "Write the answer-generation prompt for this RAG system: it receives a question plus retrieved chunks, must cite chunk sources inline for every claim, must say the corpus does not cover it when retrieval scores are weak, and must never blend outside knowledge into corpus claims. Include the score threshold logic." Paste the prompt as evidence.',
        "Eval the grounding (9 min). Write 8 test questions: 5 answerable from your corpus, 2 not covered, 1 adversarial (asks it to speculate). In a fresh chat, simulate the pipeline: paste real excerpt chunks plus the answering prompt per question. Grade each answer grounded / hallucinated / correctly-refused and save the eval log as evidence.",
        "Generate your RAG design artifact (8 min). Ask the tutor to generate the RAG design pack from your pasted spec, code, grounding prompt, and eval log — including known failure modes. Attach it as your final artifact.",
      ],
      toolLaunches: SWE_TOOL_LAUNCHES,
    },
    "Prompt Engineering in Code": {
      why: "Production prompts are code: versioned, schema-locked, and measured against an eval set — this session turns one LLM feature into a prompt module with evals instead of vibes.",
      expectedOutput:
        "A prompt module pack: a structured prompt template as code with output schema validation, a 10-case eval set, and two measured iterations showing the score move.",
      proofChecklist: [
        "Paste the prompt template code with its output schema.",
        "Paste the 10-case eval set with expected outputs.",
        "Paste both eval runs showing per-case results and the fixes between them.",
      ],
      steps: [
        'Define the feature contract (8 min). Pick one real LLM feature (classify tickets, extract fields, summarize records). Paste this prompt: "Act as my LLM engineer. My feature: [one line], input: [shape], downstream consumer: [one line]. Define the contract: output JSON schema, edge cases the prompt must survive (empty input, wrong language, adversarial text), and the failure behavior when output does not validate." Paste the contract into your evidence notes.',
        'Build the prompt as code (9 min). Prompt: "Write the prompt module in [language] for this contract: [paste contract]. Include: a system prompt constant with role, rules, and 2 few-shot examples; a function that builds messages from input; schema validation on the response with a typed error on mismatch. No retry loops yet — fail loudly." Copy the module into your evidence.',
        'Build the eval set (11 min). Prompt: "Generate a 10-case eval set for this contract: [paste contract]. Cover: 5 typical inputs, 3 edge cases from the contract, 2 adversarial. Per case: input, expected output (exact or rubric), and what failure it detects." Adjust any case that does not match your real data, then save the eval set as evidence.',
        'Run, measure, iterate (9 min). Run all 10 cases against the prompt in a fresh chat, score each pass/fail against expected outputs, then prompt: "Here are the failures: [paste failing cases + outputs]. Diagnose each (instruction gap, few-shot gap, schema ambiguity) and revise the system prompt minimally." Re-run the failures and paste both runs of scores as evidence.',
        "Generate your prompt module artifact (8 min). Ask the tutor to generate the prompt module pack from your pasted contract, code, eval set, and both runs — including the score movement between iterations. Attach it as your final artifact.",
      ],
      toolLaunches: SWE_TOOL_LAUNCHES,
    },
  },
  "quality-assurance": {
    "Edge-case Discovery via LLMs": {
      why: "The bugs that hurt ship in the gaps between happy-path tests: this session uses an LLM as an adversarial tester to enumerate, rank, and specify the edge cases your suite is missing.",
      expectedOutput:
        "An edge-case library for one real feature: a risk-ranked case taxonomy, adversarial input sets, and the top cases written as executable test specs.",
      proofChecklist: [
        "Paste the feature contract you tested against.",
        "Paste the risk-ranked edge-case taxonomy with the adversarial inputs.",
        "Paste the test specs for the top-priority cases.",
      ],
      steps: [
        'Write the feature contract (8 min). Pick one feature whose failure is expensive. Paste this prompt into ChatGPT or Claude: "Act as my QA lead. Here is the feature: [describe inputs, outputs, rules, and what must never happen]. Restate it as a testable contract: inputs with valid ranges, invariants, and explicit out-of-scope behavior. Ask me up to 3 questions where the spec is ambiguous." Paste the contract into your evidence notes.',
        'Enumerate the edge-case taxonomy (9 min). Prompt: "Generate an edge-case taxonomy for this contract: [paste contract]. Categories: boundary values, type and format abuse, state and timing (double-submit, stale data, concurrent edits), scale extremes, and malicious input. At least 5 concrete cases per category, each with the expected correct behavior." Copy the taxonomy into your evidence.',
        'Rank by risk and build adversarial inputs (10 min). Prompt: "Score every case: likelihood 1-3 times blast-radius 1-3, rank by product. For the top 8, produce the exact adversarial input values — real strings, numbers, and sequences I can paste into a test, not descriptions." Save the ranked table and inputs as evidence.',
        'Write the test specs (10 min). Prompt: "Turn the top 5 cases into test specs in [your framework, e.g. Playwright or Jest]: arrange/act/assert with the exact adversarial inputs, plus a one-line comment naming the failure it guards against. Flag any case that needs a fixture my description did not cover." Paste the runnable specs into your evidence.',
        "Generate your edge-case library artifact (8 min). Ask the tutor to generate the edge-case library from your pasted contract, taxonomy, rankings, and specs — organized so the team can pull cases into any suite. Attach it as your final artifact.",
      ],
      toolLaunches: QA_TOOL_LAUNCHES,
    },
    "Visual Regression": {
      why: "UI breakage that functional tests cannot see still loses users: this session builds a visual regression plan — what to snapshot, when a diff matters, and the generated test code to enforce it.",
      expectedOutput:
        "A visual regression plan: a prioritized screen inventory, diff-triage rules that separate real breakage from noise, and generated snapshot test code for the top screens.",
      proofChecklist: [
        "Paste the prioritized screen and state inventory.",
        "Paste the diff-triage rules with the noise sources they filter.",
        "Paste the generated snapshot test code.",
      ],
      steps: [
        'Inventory the surfaces that matter (8 min). Paste this prompt into ChatGPT or Claude: "Act as my visual QA lead for [product/app, one line]. Build a screen inventory: the 10 highest-value screens and the states of each (empty, loaded, error, long-content, mobile). Rank by user impact when they silently break. Ask me 2 questions about traffic and release cadence first." Paste the ranked inventory into your evidence notes.',
        'Define what counts as breakage (9 min). Prompt: "Write diff-triage rules for visual regression on these screens: [paste inventory]. Classify diff causes — layout shift, font fallback, color drift, animation frames, dynamic data — into always-fail, needs-human-review, and auto-ignore, with a masking strategy for dynamic regions (dates, avatars, feeds)." Copy the rules into your evidence.',
        'Generate the snapshot tests (10 min). Prompt: "Generate Playwright visual regression tests for the top 3 screens: [paste inventory rows + rules]. Per screen: navigate, wait for stable state, mask the dynamic regions from the rules, and snapshot desktop plus mobile viewports. Include the config block that sets diff threshold and mask color." Paste the generated code into your evidence.',
        'Dry-run the triage on real diffs (10 min). Describe or screenshot 3 recent visual changes from your product (or 3 plausible ones). Prompt: "Apply the triage rules to these diffs: [paste descriptions or images]. For each: classification, the rule that decided it, and whether a human should have been paged. Patch the rule that misfires." Save the triage walkthrough and patched rules as evidence.',
        "Generate your regression plan artifact (8 min). Ask the tutor to generate the visual regression plan from your pasted inventory, rules, test code, and triage dry-run — ready for the team to adopt screen by screen. Attach it as your final artifact.",
      ],
      toolLaunches: QA_TOOL_LAUNCHES,
    },
    "NLP-driven Test Scripts": {
      why: "Acceptance criteria written in English and tests written in code drift apart within a sprint: this session builds the translation layer — plain-language criteria in, runnable test scripts out.",
      expectedOutput:
        "A test suite pack: user stories converted into Gherkin scenarios, generated runnable test scripts, and a coverage audit showing which criteria are actually enforced.",
      proofChecklist: [
        "Paste the user stories and the Gherkin scenarios derived from them.",
        "Paste the generated test scripts.",
        "Paste the coverage audit with the gaps it exposed.",
      ],
      steps: [
        'Collect the plain-language criteria (8 min). Take 3 real user stories or acceptance criteria from your tracker. Paste this prompt: "Act as my test analyst. Rewrite these stories as testable statements: [paste stories]. Flag every ambiguity a developer could interpret two ways, and ask me to resolve the 3 worst before proceeding." Paste the clarified criteria into your evidence notes.',
        'Derive Gherkin scenarios (9 min). Prompt: "Convert the criteria into Gherkin: [paste criteria]. Per story: the happy-path scenario plus at least 2 unhappy paths (validation failure, permission denied, boundary). Given/When/Then only — no implementation details in the steps." Copy the scenarios into your evidence.',
        'Generate the runnable scripts (11 min). Prompt: "Implement these Gherkin scenarios as [Playwright/Cypress/your framework] tests: [paste scenarios + describe the UI or paste selectors]. Use accessible selectors (roles, labels) over CSS classes, one test per scenario, shared setup extracted. Mark any selector you had to guess with TODO." Paste the generated scripts into your evidence and resolve the TODOs against your real UI.',
        'Audit the coverage (9 min). In a fresh chat: "Audit these tests against the original stories: [paste stories + scripts]. Which acceptance criteria have no test? Which tests assert less than the criterion demands (weak assertions)? Rank the gaps by risk and write the one missing test that matters most." Save the audit and the added test as evidence.',
        "Generate your test suite artifact (8 min). Ask the tutor to generate the test suite pack from your pasted criteria, scenarios, scripts, and audit — including the criteria-to-test traceability table. Attach it as your final artifact.",
      ],
      toolLaunches: QA_TOOL_LAUNCHES,
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
    why: "This path's playbooks run the whole creative loop inside an AI tool: a real brand need in, pasteable prompts and outputs out, and a reviewable creative asset at the end.",
    expectedOutput:
      "One AI-produced creative asset (concept set, style system, or visual pack) tied to a real brand need, with the prompts and outputs that produced it.",
    proofChecklist: [
      "Paste the creative brief.",
      "Paste the prompt iterations and strongest outputs.",
      "Paste the critique pass and what you changed.",
    ],
    steps: [
      'Anchor {module} on one real brand need (10 min). Paste this prompt into ChatGPT or Claude: "Act as my creative director for {module}. The brand need is [one line] for [audience]. Ask me up to 4 questions about mood, references, and mandatories, then write a compact creative brief with a single-minded message." Paste the brief as evidence.',
      'Produce the first round with AI (12 min). Prompt: "Using this brief: [paste it], produce the first working version of the {module} output — include the exact generation prompts or specifications so the work is reproducible." Run or refine the outputs in your creative tool and copy the prompts plus strongest results into your evidence.',
      'Critique against the brief (13 min). In a fresh chat: "You are a demanding creative director reviewing this work against its brief: [paste brief + outputs or descriptions]. Score brief fit, craft, and distinctiveness 1-5, name what reads as generic AI output, and direct the two most important revisions." Save the critique and revised outputs as evidence.',
      "Generate your artifact (10 min). Ask the tutor to generate the final artifact from your pasted brief, prompts, outputs, and critique, then attach it as proof.",
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
    why: "This path's playbooks run the whole QA loop inside an AI tool: a real feature contract in, pasteable cases and scripts out, and a reviewable test asset at the end.",
    expectedOutput:
      "One AI-produced QA asset (edge-case library, test plan, or generated suite) tied to a real feature, with the prompts and outputs that produced it.",
    proofChecklist: [
      "Paste the feature contract you tested against.",
      "Paste the AI-generated cases or scripts.",
      "Paste the coverage critique and what you changed.",
    ],
    steps: [
      'Anchor {module} on one real feature under test (10 min). Paste this prompt into ChatGPT or Claude: "Act as my QA lead for {module}. The feature under test is [one line] and the failure that scares us most is [one line]. Ask me up to 4 questions about inputs, states, and invariants, then restate the feature as a testable contract." Paste the contract as evidence.',
      'Produce the first working output with AI (12 min). Prompt: "Using this contract: [paste it], produce the first working version of the {module} output — concrete inputs and expected behavior, not descriptions. Mark anything assumed with [ASSUMPTION]." Copy the full output into your evidence.',
      'Attack the coverage (13 min). In a fresh chat: "You are an adversarial tester reviewing this QA work: [paste output + contract]. Name the 5 most dangerous scenarios it still misses — timing, state, scale, malice — ranked by blast radius, then add the two most important ones." Save the critique and additions as evidence.',
      "Generate your artifact (10 min). Ask the tutor to generate the final artifact from your pasted contract, output, and coverage notes, then attach it as proof.",
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
    why: "This path's playbooks run the whole revenue loop inside an AI tool: real pipeline context in, pasteable evidence out, and a reviewable sales asset at the end.",
    expectedOutput:
      "One AI-produced revenue asset (scoring rubric, enrichment workflow, or outreach sequence) grounded in a real pipeline motion, with the prompts and outputs that produced it.",
    proofChecklist: [
      "Paste the pipeline motion brief.",
      "Paste the AI-produced working output with assumptions marked.",
      "Paste the manager-review critique and what you changed.",
    ],
    steps: [
      'Anchor {module} on one real pipeline motion (10 min). Paste this prompt into ChatGPT or Claude: "Act as my RevOps partner for {module}. The pipeline motion I want to improve is [one line] and the metric that should move is [metric]. Ask me up to 4 questions to pin down the segment, the current manual process, and what a rep would need to trust the output — then restate the target crisply." Paste the restated target as evidence.',
      'Produce the first working output with AI (12 min). Prompt: "Using this target: [paste it], produce the first working version of the {module} output. Ground every rule and claim in what I told you — mark anything you had to assume with [ASSUMPTION]." Copy the full output into your evidence.',
      'Red-team it like a sales manager (13 min). In a fresh chat: "You are a skeptical sales manager reviewing this work before letting reps use it: [paste output]. List the 5 biggest gaps — wrong incentives, unverifiable data, steps reps will skip — ranked by revenue risk, then fix the two worst." Save the critique and fixes as evidence.',
      "Generate your artifact (10 min). Ask the tutor to generate the final artifact from your pasted target, output, and critique notes, then attach it as proof.",
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
    why: "This path's playbooks run the whole support loop inside an AI tool: real tickets and policies in, pasteable evidence out, and a reviewable support asset at the end.",
    expectedOutput:
      "One AI-produced support asset (routing logic, grounded answer flow, or tone playbook) tied to a real ticket class, with the prompts and outputs that produced it.",
    proofChecklist: [
      "Paste the ticket-class brief.",
      "Paste the AI-produced working output.",
      "Paste the failure-case test log and what you changed.",
    ],
    steps: [
      'Anchor {module} on one real ticket class (10 min). Paste this prompt into ChatGPT or Claude: "Act as my support operations partner for {module}. The ticket class I want to improve is [one line] and it hurts because [volume, handle time, or CSAT]. Ask me up to 4 questions about the current handling, then restate the problem and the single output that would improve it." Paste the restated problem as evidence.',
      'Produce the first working output with AI (12 min). Prompt: "Using this problem statement: [paste it], produce the first working version of the {module} output. Use only the policies and examples I gave you — mark anything assumed with [ASSUMPTION]." Copy the full output into your evidence.',
      'Test it against hard tickets (13 min). In a fresh chat: "Here are 5 difficult real tickets (scrubbed): [paste them]. Run this support output against each: [paste output]. Show where it fails, misroutes, or strikes the wrong tone, then fix the two worst failures." Save the test log and fixes as evidence.',
      "Generate your artifact (10 min). Ask the tutor to generate the final artifact from your pasted problem, output, and test log, then attach it as proof.",
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
    why: "This path's playbooks run the whole ops loop inside an AI tool: a real manual workflow in, pasteable evidence out, and a reviewable process asset at the end.",
    expectedOutput:
      "One AI-produced operations asset (workflow map, extraction spec, or automation blueprint) grounded in a real manual process, with the prompts and outputs that produced it.",
    proofChecklist: [
      "Paste the workflow map with failure points marked.",
      "Paste the AI-produced working output with assumptions marked.",
      "Paste the edge-case walkthrough and what you changed.",
    ],
    steps: [
      'Anchor {module} on one real manual workflow (10 min). Paste this prompt into ChatGPT or Claude: "Act as my process improvement partner for {module}. The manual workflow is [one line] and it costs roughly [time per week]. Interview me one question at a time about triggers, tools, handoffs, and where it breaks. Stop after 5 questions and output a numbered current-state map." Paste the map as evidence.',
      'Produce the first working output with AI (12 min). Prompt: "Using this workflow map: [paste it], produce the first working version of the {module} output. Every rule must trace to something in the map — mark anything assumed with [ASSUMPTION]." Copy the full output into your evidence.',
      'Walk the edge cases (13 min). In a fresh chat: "Stress-test this process design: [paste output]. Walk through: a malformed input, a duplicate run, a missing field, and a permissions failure. Show what happens in each case today and patch the two worst gaps." Save the walkthrough and patches as evidence.',
      "Generate your artifact (10 min). Ask the tutor to generate the final artifact from your pasted map, output, and edge-case notes, then attach it as proof.",
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
    why: "This path's playbooks run the whole people-ops loop inside an AI tool: a real hiring or policy scenario in, pasteable evidence out, and a reviewable HR asset at the end.",
    expectedOutput:
      "One AI-produced people-ops asset (rubric, summary format, or policy workflow) tied to a real scenario, with the prompts and outputs that produced it.",
    proofChecklist: [
      "Paste the scenario brief.",
      "Paste the AI-produced working output with assumptions marked.",
      "Paste the fairness and consistency review and what you changed.",
    ],
    steps: [
      'Anchor {module} on one real people-ops scenario (10 min). Paste this prompt into ChatGPT or Claude: "Act as my people-ops partner for {module}. The scenario is [one line: role, process, or policy] and the outcome I need is [one line]. Ask me up to 4 questions to pin down who is affected and what consistent looks like, then restate the problem crisply." Paste the restated problem as evidence.',
      'Produce the first working output with AI (12 min). Prompt: "Using this problem statement: [paste it], produce the first working version of the {module} output. Separate observed evidence from interpretation everywhere — mark anything assumed with [ASSUMPTION]." Copy the full output into your evidence.',
      'Review for fairness and consistency (13 min). In a fresh chat: "Audit this HR work like an employment-practices reviewer: [paste output]. Where could it treat two similar people differently? Where does it infer beyond the evidence? Where must a human decide? Fix the two worst issues." Save the audit and fixes as evidence.',
      "Generate your artifact (10 min). Ask the tutor to generate the final artifact from your pasted scenario, output, and review notes, then attach it as proof.",
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
    why: "This path's playbooks run the whole engineering loop inside an AI tool: a real technical need in, pasteable code and analysis out, and a reviewable engineering asset at the end.",
    expectedOutput:
      "One AI-produced engineering asset (code module, design record, or eval pack) grounded in a real technical need, with the prompts and outputs that produced it.",
    proofChecklist: [
      "Paste the technical contract or requirements brief.",
      "Paste the AI-produced code or design output.",
      "Paste the red-team review and what you changed.",
    ],
    steps: [
      'Anchor {module} on one real technical need (10 min). Paste this prompt into Claude, ChatGPT, or your AI editor: "Act as my staff engineer for {module}. The technical need is [one line] in [stack]. Ask me up to 4 questions about constraints, scale, and failure tolerance, then restate the problem as a contract with explicit inputs, outputs, and invariants." Paste the contract as evidence.',
      'Produce the first working output with AI (12 min). Prompt: "Implement the first working version of the {module} output from this contract: [paste it]. Fail loudly instead of silently, no invented dependencies, and mark every assumption with [ASSUMPTION]." Copy the full code or design output into your evidence.',
      'Red-team it like a reviewer (13 min). In a fresh chat: "Review this work like a hostile senior engineer: [paste output + contract]. List the 5 most serious problems — failure modes, security holes, unstated coupling — ranked by blast radius, then patch the two worst." Save the review and patched output as evidence.',
      "Generate your artifact (10 min). Ask the tutor to generate the final artifact from your pasted contract, output, and review notes, then attach it as proof.",
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
  // UX audit F7: never surface the legacy "AI Builder" persona string —
  // callers historically passed profile.headline (defaulted to "AI Builder")
  // through jobTitle. Fall back to the career-path name instead.
  const realJobTitle = !isLegacyPersonaHeadline(input.jobTitle) ? input.jobTitle?.trim() : "";
  const roleLabel = realJobTitle || careerPathName;
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
