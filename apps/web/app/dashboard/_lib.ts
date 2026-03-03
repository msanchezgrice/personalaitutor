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
  });

  if (!summary) return {};

  const avatar = summary.user.avatarUrl?.trim();
  const publicProfileUrl = `/u/${summary.user.handle}/`;
  const replacements: Record<string, string> = {
    "Alex Chen": summary.user.name,
    "Product Manager": summary.user.headline || "AI Builder",
    "/u/alex-chen-ai/": publicProfileUrl,
    "/u/test-user-0001/": publicProfileUrl,
  };

  if (avatar) {
    replacements["/assets/avatar.png"] = avatar;
  }

  return replacements;
}
