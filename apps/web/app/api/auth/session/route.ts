import { jsonError, jsonOk, runtimeGetDashboardSummary } from "@/lib/runtime";
import { getAuthSeed } from "@/lib/auth";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const seed = await getAuthSeed(req);
  if (!seed?.userId) {
    return jsonError("UNAUTHENTICATED", "Sign in required", 401);
  }

  const summary = await runtimeGetDashboardSummary(seed.userId, {
    name: seed.name,
    handleBase: seed.handleBase,
    avatarUrl: seed.avatarUrl ?? null,
    email: seed.email ?? null,
  });

  if (!summary) {
    return jsonError("USER_NOT_FOUND", "Unable to load session profile", 404);
  }

  return jsonOk({
    auth: {
      userId: seed.userId,
      name: seed.name ?? summary.user.name,
      email: seed.email ?? null,
      avatarUrl: seed.avatarUrl ?? summary.user.avatarUrl ?? null,
    },
    summary,
  });
}
