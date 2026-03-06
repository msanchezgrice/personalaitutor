import type { Project, UserProfile } from "@aitutor/shared";

export const EXAMPLE_PROFILE_HANDLE = "alex-chen-ai";
export const EXAMPLE_PROJECT_SLUG = "customer-support-copilot";

const now = new Date("2026-03-05T15:00:00.000Z").toISOString();

export function safeHttpUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function prettyProjectState(state: Project["state"]) {
  switch (state) {
    case "idea":
      return "Idea";
    case "planned":
      return "Planned";
    case "building":
      return "In Progress";
    case "built":
      return "Built";
    case "showcased":
      return "Showcased";
    case "archived":
      return "Archived";
    default:
      return state;
  }
}

export function stateTone(state: Project["state"]) {
  switch (state) {
    case "showcased":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "built":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "building":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "planned":
      return "border-violet-200 bg-violet-50 text-violet-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

export function skillTone(status: UserProfile["skills"][number]["status"]) {
  switch (status) {
    case "verified":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "built":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "in_progress":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

export function exampleProfile(): UserProfile {
  return {
    id: "example-alex-profile",
    handle: EXAMPLE_PROFILE_HANDLE,
    name: "Alex Chen",
    avatarUrl: "/assets/avatar.png",
    headline: "Product Manager",
    bio:
      "I build AI workflows publicly so employers can review real proof instead of resume claims. My recent work focuses on automation, prompt design, and API-powered product ops.",
    careerPathId: "product-management",
    skills: [
      { skill: "Prompt Engineering", status: "verified", score: 0.86, evidenceCount: 4 },
      { skill: "API Integrations", status: "built", score: 0.79, evidenceCount: 3 },
      { skill: "Workflow Automation", status: "built", score: 0.74, evidenceCount: 2 },
      { skill: "User Research", status: "in_progress", score: 0.67, evidenceCount: 2 },
    ],
    tools: ["Cursor IDE", "Python", "OpenAI API", "Zapier"],
    socialLinks: {
      linkedin: "https://www.linkedin.com/in/alexchenai/",
      website: "https://www.myaiskilltutor.com/u/alex-chen-ai/",
    },
    published: true,
    tokensUsed: 0,
    goals: ["upskill_current_job", "showcase_for_job"],
    acquisition: {},
    createdAt: now,
    updatedAt: now,
  };
}

export function exampleProjects(): Project[] {
  return [
    {
      id: "example-project-copilot",
      userId: "example-alex-profile",
      slug: EXAMPLE_PROJECT_SLUG,
      title: "Customer Support Copilot",
      description:
        "An automated support assistant that drafts replies with CRM context, summarizes ticket history, and flags escalation risk before handoff.",
      state: "building",
      artifacts: [
        { kind: "website", url: "/api/og/project/alex-chen-ai/customer-support-copilot", createdAt: now },
      ],
      buildLog: [
        {
          id: "example-log-1",
          projectId: "example-project-copilot",
          userId: "example-alex-profile",
          message: "Added CRM context retrieval before the response-drafting step.",
          level: "success",
          createdAt: now,
          metadata: {},
        },
        {
          id: "example-log-2",
          projectId: "example-project-copilot",
          userId: "example-alex-profile",
          message: "Improved escalation detection rules for billing and outage tickets.",
          level: "info",
          createdAt: now,
          metadata: {},
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "example-project-scraper",
      userId: "example-alex-profile",
      slug: "lead-scraper-pro",
      title: "Lead Scraper Pro",
      description:
        "A lightweight lead collection workflow that maps local businesses into a structured CSV for outreach and qualification.",
      state: "built",
      artifacts: [],
      buildLog: [
        {
          id: "example-log-3",
          projectId: "example-project-scraper",
          userId: "example-alex-profile",
          message: "Shipped CSV export and validation checks for duplicate businesses.",
          level: "success",
          createdAt: now,
          metadata: {},
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
  ];
}
