import { getCatalogData, jsonError, jsonOk, runtimeGetDashboardSummary } from "@/lib/runtime";
import { NextRequest } from "next/server";
import { getUserId } from "@/lib/api";
import { getAuthSeed } from "@/lib/auth";
import { billingSeedFromAuthSeed, jsonSubscriptionRequired, runtimeGetBillingAccessState, toBillingPayload } from "@/lib/billing-access";

export async function GET(req: NextRequest) {
  try {
    const seed = await getAuthSeed(req);
    const userId = seed?.userId ?? getUserId(req);
    if (!userId) {
      return jsonError("UNAUTHENTICATED", "Sign in required", 401);
    }
    const billing = await runtimeGetBillingAccessState({
      userId,
      seed: billingSeedFromAuthSeed(seed),
    });
    if (!billing.accessAllowed) {
      return jsonSubscriptionRequired(billing);
    }
    const summary = await runtimeGetDashboardSummary(userId, {
      name: seed?.name,
      handleBase: seed?.handleBase,
      avatarUrl: seed?.avatarUrl ?? null,
      email: seed?.email ?? null,
    });
    if (!summary) {
      return jsonError("USER_NOT_FOUND", "Dashboard summary unavailable for unknown user", 404);
    }

    return jsonOk({ summary, catalog: getCatalogData(), billing: toBillingPayload(billing) });
  } catch (error) {
    return jsonError("DASHBOARD_SUMMARY_FAILED", "Failed to load dashboard summary", 500, {
      reason: error instanceof Error ? error.message : "UNKNOWN",
    });
  }
}
