import type { CareerPath, ModuleTrack } from "./types";

export const CAREER_PATHS: CareerPath[] = [
  {
    id: "product-management",
    name: "Product Management",
    coreSkillDomain: "Rapid Prototyping & Strategy",
    modules: ["Synthetic User Research", "AI Wireframing", "PRD Generation", "Sentiment Analysis"],
    tools: ["Cursor", "v0.dev", "Claude 3.5", "OpenAI API"],
    roles: ["Product Manager", "Product Lead", "Growth PM"],
  },
  {
    id: "marketing-seo",
    name: "Marketing & SEO",
    coreSkillDomain: "Content Automation & Growth",
    modules: ["Programmatic SEO", "Bulk Content Generation", "AI Keyword Clustering", "Copywriting Agents"],
    tools: ["Jasper", "ChatGPT", "Python (Pandas/Scripts)"],
    roles: ["Marketing Lead", "SEO Manager", "Content Strategist"],
  },
  {
    id: "branding-design",
    name: "Branding & Design",
    coreSkillDomain: "Visual Identity & Generation",
    modules: ["Image Synthesis", "Style-consistent Training", "Vector Generation", "Video AI"],
    tools: ["Midjourney", "Stable Diffusion", "Runway", "Recraft"],
    roles: ["Brand Designer", "Creative Director", "Visual Designer"],
  },
  {
    id: "quality-assurance",
    name: "Quality Assurance",
    coreSkillDomain: "Automated Test Generation",
    modules: ["Edge-case Discovery via LLMs", "Visual Regression", "NLP-driven Test Scripts"],
    tools: ["Playwright + Local LLMs", "GitHub Copilot"],
    roles: ["QA Engineer", "Test Automation Engineer", "Quality Lead"],
  },
  {
    id: "sales-revops",
    name: "Sales / RevOps",
    coreSkillDomain: "Lead Scoring & Outreach",
    modules: ["Predictive Lead Scoring", "Deep Data Enrichment", "Hyper-personalized Cold Outreach"],
    tools: ["Clay", "Apollo + AI", "Zapier", "Make.com"],
    roles: ["RevOps Manager", "Sales Manager", "Outbound Lead"],
  },
  {
    id: "customer-support",
    name: "Customer Support",
    coreSkillDomain: "Automated Triaging & RAG",
    modules: ["RAG Document Retrieval", "Intelligent Ticket Routing", "Tone & Sentiment Detection"],
    tools: ["Zendesk AI", "Pinecone", "Custom Python Flask APIs"],
    roles: ["Support Lead", "Customer Success Manager", "Support Operations"],
  },
  {
    id: "operations",
    name: "Operations (Ops)",
    coreSkillDomain: "Intelligent Workflow Automation",
    modules: ["Cross-application Data Sync", "OCR Document Processing", "Intelligent Extraction"],
    tools: ["Zapier", "Make.com", "OpenAI Vision API"],
    roles: ["Operations Manager", "BizOps Lead", "Process Analyst"],
  },
  {
    id: "human-resources",
    name: "Human Resources",
    coreSkillDomain: "People Ops Automation",
    modules: ["Screening Workflow Automation", "Interview Signal Summaries", "Policy Assistant Copilot"],
    tools: ["Greenhouse", "Lever", "Notion AI", "OpenAI API"],
    roles: ["HR Manager", "People Ops Lead", "Talent Partner"],
  },
  {
    id: "software-engineering",
    name: "Software Engineering",
    coreSkillDomain: "Full-Stack Execution",
    modules: ["API Integration", "System Architecture", "RAG Setup", "Prompt Engineering in Code"],
    tools: ["Python", "Node.js", "Langchain", "Cursor IDE"],
    roles: ["Software Engineer", "Tech Lead", "Full-Stack Engineer"],
  },
];

export const MODULE_TRACKS: ModuleTrack[] = CAREER_PATHS.flatMap((path) =>
  path.modules.map((module, index) => ({
    id: `${path.id}-${index + 1}`,
    careerPathId: path.id,
    title: module,
    summary: `${module} module for ${path.name}`,
  })),
);

export function getCareerPath(id: string) {
  return CAREER_PATHS.find((entry) => entry.id === id) ?? null;
}

export function getOnboardingCareerOptions() {
  return CAREER_PATHS.map((path) => ({
    id: path.id,
    label: path.name,
    description: path.coreSkillDomain,
  }));
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

export function getEmployerFilterFacets() {
  const modules = uniqueValues(CAREER_PATHS.flatMap((path) => path.modules));
  return {
    careerPaths: CAREER_PATHS.map((path) => ({ id: path.id, name: path.name })),
    roles: uniqueValues(CAREER_PATHS.flatMap((path) => path.roles)),
    modules,
    skills: modules,
    tools: uniqueValues(CAREER_PATHS.flatMap((path) => path.tools)),
    skillDomains: uniqueValues(CAREER_PATHS.map((path) => path.coreSkillDomain)),
  };
}

export function getModuleTracksForCareerPath(careerPathId: string) {
  return MODULE_TRACKS.filter((track) => track.careerPathId === careerPathId);
}

/**
 * Order module tracks by the learner's 30-day-plan module sequence (spine
 * phase 2). Tracks named by the plan come first, in plan order; the rest keep
 * catalog order. An empty/unknown plan leaves the catalog order untouched, so
 * users without a plan see exactly the pre-spine sequence. Never mutates.
 */
export function orderModuleTracksByPlan<T extends { title: string }>(
  tracks: T[],
  planModuleTitles: Array<string | null | undefined>,
): T[] {
  const rank = new Map<string, number>();
  for (const title of planModuleTitles) {
    const key = (title ?? "").trim().toLowerCase();
    if (key && !rank.has(key)) rank.set(key, rank.size);
  }
  if (!rank.size) return [...tracks];

  return [...tracks].sort((a, b) => {
    const rankA = rank.get(a.title.trim().toLowerCase());
    const rankB = rank.get(b.title.trim().toLowerCase());
    if (rankA !== undefined && rankB !== undefined) return rankA - rankB;
    if (rankA !== undefined) return -1;
    if (rankB !== undefined) return 1;
    return 0; // stable sort keeps catalog order for the rest
  });
}

/**
 * "AI Builder" was the legacy default persona written into `headline` at
 * profile creation. It is an internal string, not something the user chose —
 * UX audit F7 (2026-07-07): never show it. Treat it as "no headline".
 */
export const LEGACY_PERSONA_HEADLINE = "AI Builder";

export function isLegacyPersonaHeadline(headline: string | null | undefined) {
  return (headline ?? "").trim().toLowerCase() === LEGACY_PERSONA_HEADLINE.toLowerCase();
}

/**
 * User-facing role label: the learner's real headline when they set one,
 * otherwise their career-path name (e.g. "Product Management"), never the
 * legacy "AI Builder" persona string.
 */
export function resolveLearnerRoleLabel(input: {
  headline?: string | null;
  careerPathId?: string | null;
}): string {
  const headline = input.headline?.trim();
  if (headline && !isLegacyPersonaHeadline(headline)) return headline;
  const careerPath = input.careerPathId ? getCareerPath(input.careerPathId) : null;
  return careerPath?.name ?? "Learner";
}
