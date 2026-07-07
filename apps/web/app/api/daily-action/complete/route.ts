import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@aitutor/shared";
import { getAuthSeed } from "@/lib/auth";
import { getUserId } from "@/lib/api";
import { billingSeedFromAuthSeed, requireBillingAccess } from "@/lib/billing-access";
import { completeDailyAction } from "@/lib/daily-action";

/**
 * Completing the daily action = a check-in: marks it done and advances the
 * streak (idempotent — re-completion never double-counts).
 */
export async function POST(req: NextRequest) {
  const seed = await getAuthSeed(req);
  const userId = seed?.userId ?? getUserId(req);
  if (!userId) {
    return jsonError("UNAUTHENTICATED", "Sign in required", 401);
  }
  const access = await requireBillingAccess({ userId, seed: billingSeedFromAuthSeed(seed) });
  if (!access.ok) {
    return access.response;
  }
  const profile = access.billing.profile;
  if (!profile) {
    return jsonError("USER_NOT_FOUND", "No learner profile", 404);
  }

  const result = await completeDailyAction({ learnerProfileId: profile.id });
  if (!result.ok) {
    return jsonError("DAILY_ACTION_COMPLETE_FAILED", "No daily action to complete", 409, {
      failureCode: result.errorCode,
    });
  }

  return jsonOk({
    action: result.action,
    streak: {
      current: result.streak.currentStreak,
      longest: result.streak.longestStreak,
    },
    alreadyCompleted: result.alreadyCompleted,
  });
}
