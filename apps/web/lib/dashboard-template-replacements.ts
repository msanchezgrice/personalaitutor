import { getAuthSeed } from "@/lib/auth";
import { runtimeGetDashboardSummary } from "@/lib/runtime";

type DashboardSummary = Awaited<ReturnType<typeof runtimeGetDashboardSummary>>;

function salutationForHour(hour: number) {
  if (hour >= 5 && hour < 12) return "Good Morning";
  if (hour >= 12 && hour < 18) return "Good Afternoon";
  return "Good Evening";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeHttpUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function normalizeInlineText(value: string | null | undefined) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function summarizeText(value: string | null | undefined, maxChars: number) {
  const cleaned = normalizeInlineText(value);
  if (!cleaned) return "";
  if (cleaned.length <= maxChars) return cleaned;
  return `${cleaned.slice(0, Math.max(0, maxChars - 3)).trim()}...`;
}

function latestEventMessage(summary: DashboardSummary | null) {
  const events = Array.isArray(summary?.latestEvents) ? summary.latestEvents : [];
  let bestMessage = "";
  let bestTs = Number.NEGATIVE_INFINITY;

  events.forEach((event) => {
    const message = normalizeInlineText(event?.message);
    if (!message) return;
    const parsed = Date.parse(event?.createdAt ? String(event.createdAt) : "");
    const ts = Number.isFinite(parsed) ? parsed : 0;
    if (ts >= bestTs) {
      bestTs = ts;
      bestMessage = message;
    }
  });

  return bestMessage;
}

function latestBuildLogMessage(
  project:
    | {
      buildLog?: Array<{ message?: string | null }>;
    }
    | null
    | undefined,
) {
  const buildLog = Array.isArray(project?.buildLog) ? project.buildLog : [];
  for (let index = buildLog.length - 1; index >= 0; index -= 1) {
    const message = normalizeInlineText(buildLog[index]?.message);
    if (message) return message;
  }
  return "";
}

function activeProjectFromSummary(summary: DashboardSummary | null) {
  const projects = Array.isArray(summary?.projects) ? summary.projects : [];
  return projects.find((project) => (
    project.state === "building" || project.state === "planned" || project.state === "idea"
  )) || projects[0] || null;
}

function completedProjectsFromSummary(summary: DashboardSummary | null) {
  const projects = Array.isArray(summary?.projects) ? summary.projects : [];
  return projects.filter((project) => project.state === "built" || project.state === "showcased");
}

function moduleFallbackFromSummary(summary: DashboardSummary | null) {
  const recommendations = Array.isArray(summary?.moduleRecommendations) ? summary.moduleRecommendations : [];
  return recommendations[0] || null;
}

function homeActiveCard(summary: DashboardSummary | null) {
  const activeProject = activeProjectFromSummary(summary);
  if (activeProject) return activeProject;

  const fallbackModule = moduleFallbackFromSummary(summary);
  if (fallbackModule) {
    return {
      title: fallbackModule.title,
      description: fallbackModule.summary,
      buildLog: [],
    };
  }

  return {
    title: "Introduction to LLMs",
    description: "Start this module to build LLM fundamentals and ship your first practical artifact.",
    buildLog: [],
  };
}

function topSkillLabels(summary: DashboardSummary | null) {
  const verified = Array.isArray(summary?.user?.skills)
    ? summary.user.skills
      .map((entry) => normalizeInlineText(entry?.skill))
      .filter(Boolean)
    : [];
  if (verified.length) return verified.slice(0, 3);
  const recommendations = Array.isArray(summary?.moduleRecommendations)
    ? summary.moduleRecommendations
      .map((entry) => normalizeInlineText(entry?.title))
      .filter(Boolean)
    : [];
  return recommendations.slice(0, 3);
}

export async function getDashboardTemplateReplacements(template = "") {
  const replacements: Record<string, string> = {
    '<span class="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">2</span>': "",
    '<span class="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-[0_0_10px_rgba(239,68,68,0.5)]">2</span>': "",
    "Social Media": "Social Drafts",
    "Level 3": "Level 1",
    "Intermediate Automator": "Starter Builder",
    "400 XP to Level 4": "Start building to level up",
    "Welcome back, Alex! Based on our last session, we were working on handling the JSON payload in your `webhook_handler.py` script.":
      "Loading your latest tutor context...",
    "Here's the block we left off with. Can you copy the exact output you are currently receiving in your terminal when a test event triggers?":
      "Fetching your most recent conversation...",
    "Hi Tutor, the JSON looks like this:": "Loading saved chat history...",
    "It's throwing a TypeError when I try to access `data['customer_data']['email']` because it comes in exactly as the string \"null\" instead of an actual null object.":
      "",
    "webhook_handler.py": "recent_session.txt",
  };

  const seed = await getAuthSeed();
  let summary: DashboardSummary | null = null;

  if (seed?.userId) {
    summary = await runtimeGetDashboardSummary(seed.userId, {
      name: seed.name,
      handleBase: seed.handleBase,
      avatarUrl: seed.avatarUrl ?? null,
      email: seed.email ?? null,
    });
  }

  const trimmedName = summary?.user?.name?.trim() || seed?.name?.trim() || "";
  const firstName = trimmedName.split(" ")[0] || trimmedName;
  const headline = summary?.user?.headline?.trim() || "AI Builder";
  const greeting = firstName ? `${salutationForHour(new Date().getHours())}, ${firstName} 👋` : "Welcome 👋";
  const handle = summary?.user?.handle?.trim() || null;
  const email = normalizeInlineText((seed?.email || "").trim());
  const bio = normalizeInlineText(summary?.user?.bio);
  const linkedInUrl = safeHttpUrl(summary?.user?.socialLinks?.linkedin);

  replacements["Alex Chen"] = escapeHtml(trimmedName || "New Learner");
  replacements["Welcome back, Alex!"] = firstName ? `Welcome back, ${escapeHtml(firstName)}!` : "Welcome back!";
  replacements["Product Manager"] = escapeHtml(headline);
  replacements["Good Morning, Alex 👋"] = escapeHtml(greeting);

  if (handle) {
    replacements["/u/alex-chen-ai/"] = `/u/${handle}/`;
    replacements["/u/test-user-0001/"] = `/u/${handle}/`;
    replacements["/u/alex-chen-ai"] = `/u/${handle}`;
    replacements["/u/test-user-0001"] = `/u/${handle}`;
  }

  const avatarUrl = safeHttpUrl(summary?.user?.avatarUrl ?? seed?.avatarUrl ?? undefined);
  if (avatarUrl) {
    replacements['src="/assets/avatar.png"'] = `src="${escapeHtml(avatarUrl)}"`;
  }

  if (email) {
    replacements["alex@example.com"] = escapeHtml(email);
  }

  if (bio) {
    replacements["I'm a PM learning how to automate workflows and build prototypes using AI. Building publicly to track my journey from non-technical to AI-fluent."] = escapeHtml(bio);
  }

  if (linkedInUrl) {
    replacements["https://linkedin.com/in/alex-chen"] = escapeHtml(linkedInUrl);
  } else {
    replacements["https://linkedin.com/in/alex-chen"] = "";
  }

  if (template === "dashboard/index.html") {
    const activeCard = homeActiveCard(summary);
    const completedProject = completedProjectsFromSummary(summary)[0] || null;
    const skillLabels = topSkillLabels(summary);
    const todayUpdate = summarizeText(
      summary?.dailyUpdate?.summary ||
        latestEventMessage(summary) ||
        "You are set up for focused progress today. Pick one concrete task and ship it.",
      140,
    );
    const continuation = summarizeText(
      latestBuildLogMessage(activeProjectFromSummary(summary)) ||
        "Share your current blocker and I will help you take the next verified step.",
      140,
    );

    replacements["Let's finish your automation workflow."] = escapeHtml(todayUpdate || "Loading your tutor summary...");
    replacements["You left off at the data parsing step in the Customer Support Copilot project."] =
      escapeHtml(continuation || "Loading your latest project context.");
    replacements["Resume Session"] = "Continue where we left off";
    replacements["Customer Support Copilot"] = escapeHtml(activeCard.title);
    replacements["An automated email responder using RAG to fetch CRM context before drafting replies."] =
      escapeHtml(normalizeInlineText(activeCard.description) || "Start this module to build LLM fundamentals and ship your first practical artifact.");
    replacements["Lead Scraper Pro"] = escapeHtml(
      normalizeInlineText(completedProject?.title) || "Project proof syncing",
    );
    replacements["Python script to map local businesses to a CSV using Google Maps APIs."] = escapeHtml(
      normalizeInlineText(completedProject?.description) || "Your latest proof artifacts appear here after sync.",
    );
    if (skillLabels[0]) replacements["Prompt Engineering"] = escapeHtml(skillLabels[0]);
  }

  if (template === "dashboard/projects/index.html") {
    const activeProject = activeProjectFromSummary(summary);
    const completedProjects = completedProjectsFromSummary(summary);
    const firstCompleted = completedProjects[0] || null;
    const secondCompleted = completedProjects[1] || null;
    const progress = activeProject
      ? Math.min(95, Math.max(20, (Array.isArray(activeProject.buildLog) ? activeProject.buildLog.length : 0) * 12 || 40))
      : 0;

    replacements["Customer Support Copilot"] = escapeHtml(
      normalizeInlineText(activeProject?.title) || "Active build syncing",
    );
    replacements["An automated email responder using RAG to fetch CRM context before drafting replies. Currently stuck on processing JSON payload from the API webhook."] =
      escapeHtml(
        normalizeInlineText(activeProject?.description) || "Loading your active build context.",
      );
    replacements["Step 3 of 5"] = activeProject ? "Active build" : "Queued";
    replacements["60%"] = activeProject ? `${progress}%` : "--";
    replacements["Lead Scraper Pro"] = escapeHtml(
      normalizeInlineText(firstCompleted?.title) || "Project proof syncing",
    );
    replacements["Python script to map local businesses to a CSV using Google Maps APIs. Automates the compilation of targeted B2B contact lists."] =
      escapeHtml(
        normalizeInlineText(firstCompleted?.description) || "Your first completed project will appear here.",
      );
    replacements["Sales Forecasting Engine"] = escapeHtml(
      normalizeInlineText(secondCompleted?.title) || "Next proof artifact",
    );
    replacements["A macro-enabled Excel engine combined with API pulls to automatically project quarter-end earnings based on historical pipeline variance."] =
      escapeHtml(
        normalizeInlineText(secondCompleted?.description) || "Additional published work appears here when available.",
      );
    if (handle && firstCompleted?.slug) {
      replacements["/u/alex-chen-ai/projects/customer-support-copilot/"] = `/u/${handle}/projects/${firstCompleted.slug}/`;
    }
  }

  if (template === "dashboard/chat/index.html") {
    const activeProject = activeProjectFromSummary(summary);
    replacements["Customer Support Copilot • Active Build"] = escapeHtml(
      `${normalizeInlineText(activeProject?.title) || "Tutor session"} • Active Build`,
    );
    replacements["Today, 9:41 AM"] = "Today";
  }

  if (template === "dashboard/profile/index.html") {
    if (bio) {
      replacements["I'm a PM learning how to automate workflows and build prototypes using AI. Building publicly to track my journey from non-technical to AI-fluent."] = escapeHtml(bio);
    }
    if (!email) {
      replacements["alex@example.com"] = "";
    }
    if (!linkedInUrl) {
      replacements["https://linkedin.com/in/alex-chen"] = "";
    }
  }

  return replacements;
}
