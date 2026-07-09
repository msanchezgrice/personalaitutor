import { buildDashboardGamification, type Project, type UserProfile } from "@aitutor/shared";
import type { AssessmentReport } from "@/lib/assessment-report";
import {
  assemblePublicProfileProof,
  type ProofHistoryEntry,
  type PublicProfileProof,
} from "@/lib/public-profile-proof";

export const EXAMPLE_PROFILE_HANDLE = "alex-chen-ai";
export const EXAMPLE_PROJECT_SLUG = "customer-support-copilot";

function daysAgoIso(now: Date, days: number) {
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}

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

export function skillTone(status: "verified" | "built") {
  switch (status) {
    case "verified":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    default:
      return "border-sky-200 bg-sky-50 text-sky-700";
  }
}

/**
 * The seeded example profile (kept clearly labeled "Example profile" on the
 * page). Its data mirrors what the rebuilt product actually produces: gated
 * skills, real-module 30-day plan, generated artifacts served through the
 * demo-rendering /generated route, tutor-session activity, streak, and XP.
 */
export function exampleProfile(now: Date = new Date()): UserProfile {
  const iso = daysAgoIso(now, 1);
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
      { skill: "PRD Generation", status: "verified", score: 0.82, evidenceCount: 3 },
      { skill: "Synthetic User Research", status: "verified", score: 0.76, evidenceCount: 2 },
      { skill: "AI Wireframing", status: "built", score: 0.68, evidenceCount: 2 },
      { skill: "Sentiment Analysis", status: "in_progress", score: 0.4, evidenceCount: 1 },
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
    createdAt: daysAgoIso(now, 30),
    updatedAt: iso,
  };
}

export function exampleProjects(now: Date = new Date()): Project[] {
  return [
    {
      id: "example-project-copilot",
      userId: "example-alex-profile",
      slug: EXAMPLE_PROJECT_SLUG,
      title: "Customer Support Copilot",
      description:
        "An automated support assistant that drafts replies with CRM context, summarizes ticket history, and flags escalation risk before handoff.",
      state: "built",
      artifacts: [
        {
          kind: "pdf",
          url: "/generated/demo/pdf-support-brief.pdf",
          createdAt: daysAgoIso(now, 2),
          metadata: { source: "generated_artifact", contentId: "example-content-brief" },
        },
        {
          kind: "website",
          url: "/generated/demo/website-copilot.html",
          createdAt: daysAgoIso(now, 9),
          metadata: { source: "generated_artifact", contentId: "example-content-website" },
        },
      ],
      moduleSteps: [],
      buildLog: [
        {
          id: "example-log-1",
          projectId: "example-project-copilot",
          userId: "example-alex-profile",
          message: "Completed the Synthetic User Research tutor session — interview synthesis evidenced step by step.",
          level: "success",
          createdAt: daysAgoIso(now, 12),
          metadata: {},
        },
        {
          id: "example-log-2",
          projectId: "example-project-copilot",
          userId: "example-alex-profile",
          message: "Generated the project brief from session evidence — escalation rules grounded in ticket samples.",
          level: "success",
          createdAt: daysAgoIso(now, 2),
          metadata: {},
        },
      ],
      createdAt: daysAgoIso(now, 15),
      updatedAt: daysAgoIso(now, 2),
    },
    {
      id: "example-project-scraper",
      userId: "example-alex-profile",
      slug: "lead-scraper-pro",
      title: "Lead Scraper Pro",
      description:
        "A lightweight lead collection workflow that maps local businesses into a structured CSV for outreach and qualification.",
      state: "built",
      artifacts: [
        {
          kind: "pptx",
          url: "/generated/demo/pptx-lead-scraper.pptx",
          createdAt: daysAgoIso(now, 5),
          metadata: { source: "generated_artifact", contentId: "example-content-deck" },
        },
      ],
      moduleSteps: [],
      buildLog: [
        {
          id: "example-log-3",
          projectId: "example-project-scraper",
          userId: "example-alex-profile",
          message: "Shipped CSV export and validation checks for duplicate businesses.",
          level: "success",
          createdAt: daysAgoIso(now, 5),
          metadata: {},
        },
      ],
      createdAt: daysAgoIso(now, 20),
      updatedAt: daysAgoIso(now, 5),
    },
  ];
}

function exampleReport(score: number, headline: string): AssessmentReport {
  return {
    readinessScore: score,
    headline,
    summary:
      "Consistent tutor-session work is converting scattered AI usage into a repeatable product-discovery system.",
    strengths: [
      { title: "Prompt fluency", detail: "Gets usable model output in one or two iterations." },
      { title: "Ships weekly", detail: "Every module ends in a reviewable artifact." },
    ],
    gaps: [
      {
        title: "Sentiment instrumentation",
        whyItMatters: "Feedback loops stay anecdotal without it.",
        marketImpact: "medium",
      },
    ],
    recommendedPath: { careerPathId: "product-management", reason: "Direct match for current PM role." },
    thirtyDayPlan: [
      {
        week: 1,
        focus: "Interview synthesis sprint",
        actions: ["Run five synthetic user interviews", "Cluster findings into themes"],
        moduleTitle: "Synthetic User Research",
      },
      {
        week: 2,
        focus: "Wireframe the fix",
        actions: ["Draft three AI wireframe variants", "Pick one with evidence"],
        moduleTitle: "AI Wireframing",
      },
      {
        week: 3,
        focus: "PRD from evidence",
        actions: ["Write the PRD grounded in interview clusters"],
        moduleTitle: "PRD Generation",
      },
      {
        week: 4,
        focus: "Instrument the signal",
        actions: ["Wire sentiment analysis into the feedback loop"],
        moduleTitle: "Sentiment Analysis",
      },
    ],
  };
}

/**
 * Proof block for the example profile — assembled through the SAME pure
 * assembly (incl. verification gating) as real profiles, so the example can
 * never demonstrate something the product would not honestly show.
 */
export function exampleProfileProof(now: Date = new Date()): PublicProfileProof {
  const profile = exampleProfile(now);
  const projects = exampleProjects(now);

  const history: ProofHistoryEntry[] = [
    {
      anonymousAssessmentId: "example-assessment",
      createdAt: daysAgoIso(now, 16),
      readinessScore: 52,
      report: exampleReport(52, "Strong instincts, no system yet."),
    },
    {
      anonymousAssessmentId: "example-assessment",
      createdAt: daysAgoIso(now, 1),
      readinessScore: 78,
      report: exampleReport(78, "Two verified workflows in, the system is compounding."),
    },
  ];

  const gamification = buildDashboardGamification({
    user: profile,
    projects,
    latestEvents: [],
    hasOnboardingSession: true,
    onboardingStartedAt: daysAgoIso(now, 16),
    hasCompletedAssessment: true,
    assessmentSubmittedAt: daysAgoIso(now, 16),
    hasSocialDraft: false,
    hasPublishedSocialDraft: false,
    activity: {
      dailyActionsCompleted: 6,
      streakCurrent: 5,
      streakLongest: 6,
      streakLastActionDate: now.toISOString().slice(0, 10),
      tutorSessionsStarted: 3,
      tutorSessionsCompleted: 2,
      firstTutorSessionCompletedAt: daysAgoIso(now, 12),
    },
  });

  return assemblePublicProfileProof({
    profile,
    projects,
    history,
    completedModuleTitles: ["Synthetic User Research", "AI Wireframing"],
    milestones: { started: 3, completed: 2, firstCompletedAt: daysAgoIso(now, 12) },
    streak: { currentStreak: 5, longestStreak: 6, lastActionDate: now.toISOString().slice(0, 10) },
    gamification,
    now,
  });
}
