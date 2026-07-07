import { jsonError, jsonOk, runtimeRefreshRelevantNews } from "@/lib/runtime";
import { NextRequest } from "next/server";
import { forcedFailCode, getUserId } from "@/lib/api";
import { getAuthSeed } from "@/lib/auth";
import { billingSeedFromAuthSeed, requireBillingAccess } from "@/lib/billing-access";
import { requireCronSecret } from "@/lib/cron-auth";
import { refreshAllDailyBriefings } from "@/lib/daily-briefing";

export const maxDuration = 300;

/**
 * Vercel cron entry (crons send GET): refresh today's landscape briefing for
 * all 9 career paths from a single feed-fetch pass (rebuild Phase 3.1/3.6).
 * Guarded by CRON_SECRET. The POST handler below stays for per-user manual
 * refreshes.
 */
export async function GET(req: NextRequest) {
  const unauthorized = requireCronSecret(req);
  if (unauthorized) return unauthorized;

  const result = await refreshAllDailyBriefings();
  if (!result.refreshed.length) {
    return jsonError("BRIEFING_REFRESH_FAILED", "No briefing could be refreshed", 502, {
      failures: result.failures,
      feedsOk: result.feedsOk,
      feedsFail: result.feedsFail,
    });
  }

  return jsonOk({
    refreshed: result.refreshed,
    failures: result.failures,
    feedsOk: result.feedsOk,
    feedsFail: result.feedsFail,
  });
}

export async function POST(req: NextRequest) {
  const seed = await getAuthSeed(req);
  const userId = seed?.userId ?? getUserId(req);
  if (!userId) {
    return jsonError("UNAUTHENTICATED", "Sign in required", 401);
  }
  const access = await requireBillingAccess({
    userId,
    seed: billingSeedFromAuthSeed(seed),
  });
  if (!access.ok) {
    return access.response;
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
