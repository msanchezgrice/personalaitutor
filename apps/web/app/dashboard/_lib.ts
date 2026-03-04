import { getAuthSeed } from "@/lib/auth";
import { runtimeGetDashboardSummary } from "@/lib/runtime";

export async function dashboardReplacements() {
  const seed = await getAuthSeed();
  if (!seed?.userId) {
    return {} as Record<string, string>;
  }

  const summary = await runtimeGetDashboardSummary(seed.userId, {
    name: seed.name,
    handleBase: seed.handleBase,
    avatarUrl: seed.avatarUrl ?? null,
    email: seed.email ?? null,
  });

  if (!summary) return {};

  const avatar = summary.user.avatarUrl?.trim();
  const publicProfileUrl = `/u/${summary.user.handle}/`;
  const firstName = summary.user.name.split(" ")[0] || summary.user.name;
  const replacements: Record<string, string> = {
    "Alex Chen": summary.user.name,
    "Product Manager": summary.user.headline || "AI Builder",
    "Good Morning, Alex 👋": `Good Morning, ${firstName} 👋`,
    "Welcome back, Alex!": `Welcome back, ${firstName}!`,
    "Based on our last session, we were working on handling the JSON payload in your `webhook_handler.py` script.":
      "I’m ready to help with your next build step.",
    "Here's the block we left off with. Can you copy the exact output you are currently receiving in your terminal when a test event triggers?":
      "Share your current blocker or code snippet and I’ll propose the next verified step.",
    "Lead Scraper Pro - Alex Chen": `Lead Scraper Pro - ${summary.user.name}`,
    "Contact Alex": `Contact ${firstName}`,
    "/u/alex-chen-ai/": publicProfileUrl,
    "/u/test-user-0001/": publicProfileUrl,
    "/u/alex-chen-ai": publicProfileUrl,
    "/u/test-user-0001": publicProfileUrl,
  };

  if (avatar) {
    replacements["/assets/avatar.png"] = avatar;
  }

  return replacements;
}
