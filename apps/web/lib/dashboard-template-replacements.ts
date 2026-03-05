import { getAuthSeed } from "@/lib/auth";
import { runtimeGetDashboardSummary } from "@/lib/runtime";

function salutationForHour(hour: number) {
  if (hour >= 5 && hour < 12) return "Good Morning";
  if (hour >= 12 && hour < 18) return "Good Afternoon";
  return "Good Evening";
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

export async function getDashboardTemplateReplacements() {
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
  if (!seed?.userId) return replacements;

  const summary = await runtimeGetDashboardSummary(seed.userId, {
    name: seed.name,
    handleBase: seed.handleBase,
    avatarUrl: seed.avatarUrl ?? null,
    email: seed.email ?? null,
  });

  const trimmedName = summary?.user?.name?.trim() || seed.name?.trim() || "";
  if (!trimmedName) return replacements;

  const firstName = trimmedName.split(" ")[0] || trimmedName;
  const headline = summary?.user?.headline?.trim() || "AI Builder";
  const greeting = `${salutationForHour(new Date().getHours())}, ${firstName} 👋`;
  const handle = summary?.user?.handle?.trim() || null;

  replacements["Alex Chen"] = trimmedName;
  replacements["Product Manager"] = headline;
  replacements["Good Morning, Alex 👋"] = greeting;
  replacements["Welcome back, Alex!"] = `Welcome back, ${firstName}!`;
  if (handle) {
    replacements["/u/alex-chen-ai/"] = `/u/${handle}/`;
    replacements["/u/test-user-0001/"] = `/u/${handle}/`;
    replacements["/u/alex-chen-ai"] = `/u/${handle}`;
    replacements["/u/test-user-0001"] = `/u/${handle}`;
  }

  const avatarUrl = safeHttpUrl(summary?.user?.avatarUrl ?? seed.avatarUrl ?? undefined);
  if (avatarUrl) {
    replacements['src="/assets/avatar.png"'] = `src="${avatarUrl}"`;
  }

  return replacements;
}
