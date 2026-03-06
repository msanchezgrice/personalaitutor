import { jsonError, jsonOk, runtimeRefreshRelevantNews } from "@/lib/runtime";
import { NextRequest } from "next/server";
import { forcedFailCode, getUserId } from "@/lib/api";
import { getAuthSeed } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const seed = await getAuthSeed(req);
  const userId = seed?.userId ?? getUserId(req);
  if (!userId) {
    return jsonError("UNAUTHENTICATED", "Sign in required", 401);
  }

  const result = await runtimeRefreshRelevantNews({
    forceFailCode: forcedFailCode(req),
    userId,
    preferFresh: true,
    seed: seed
      ? {
          name: seed.name,
          handleBase: seed.handleBase,
          avatarUrl: seed.avatarUrl ?? null,
          email: seed.email ?? null,
        }
      : undefined,
  });
  if (!result.ok) {
    return jsonError("NEWS_REFRESH_FAILED", "Relevant news refresh failed", 409, {
      failureCode: result.errorCode,
      recoveryAction: "Retry scheduler/news-refresh when provider is stable",
    });
  }

  return jsonOk({
    insights: result.insights,
    source: result.source,
    focusSummary: result.focusSummary,
    selectionRationale: result.selectionRationale,
    contextSignals: result.contextSignals,
  });
}
