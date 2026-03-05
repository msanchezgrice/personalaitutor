import { getAuthSeed } from "@/lib/auth";

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
  };

  const seed = await getAuthSeed();
  if (!seed?.name) return replacements;

  const trimmedName = seed.name.trim();
  if (!trimmedName) return replacements;

  const firstName = trimmedName.split(" ")[0] || trimmedName;
  const greeting = `${salutationForHour(new Date().getHours())}, ${firstName} 👋`;

  replacements["Alex Chen"] = trimmedName;
  replacements["Good Morning, Alex 👋"] = greeting;
  replacements["Welcome back, Alex!"] = `Welcome back, ${firstName}!`;

  const avatarUrl = safeHttpUrl(seed.avatarUrl ?? undefined);
  if (avatarUrl) {
    replacements['src="/assets/avatar.png"'] = `src="${avatarUrl}"`;
  }

  return replacements;
}
