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
  return {
    careerPaths: CAREER_PATHS.map((path) => ({ id: path.id, name: path.name })),
    roles: uniqueValues(CAREER_PATHS.flatMap((path) => path.roles)),
    modules: uniqueValues(CAREER_PATHS.flatMap((path) => path.modules)),
    tools: uniqueValues(CAREER_PATHS.flatMap((path) => path.tools)),
    skillDomains: uniqueValues(CAREER_PATHS.map((path) => path.coreSkillDomain)),
  };
}

export function getModuleTracksForCareerPath(careerPathId: string) {
  return MODULE_TRACKS.filter((track) => track.careerPathId === careerPathId);
}
