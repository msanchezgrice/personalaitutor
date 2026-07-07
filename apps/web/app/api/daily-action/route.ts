import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@aitutor/shared";
import { getAuthSeed } from "@/lib/auth";
import { getUserId } from "@/lib/api";
import { billingSeedFromAuthSeed, requireBillingAccess } from "@/lib/billing-access";
import { getDailyActionWithStreak, runDailyRescoreForUser } from "@/lib/daily-action";

export const maxDuration = 120;

async function resolveAccess(req: NextRequest) {
  const seed = await getAuthSeed(req);
  const userId = seed?.userId ?? getUserId(req);
  if (!userId) {
    return { ok: false as const, response: jsonError("UNAUTHENTICATED", "Sign in required", 401) };
  }
  const access = await requireBillingAccess({ userId, seed: billingSeedFromAuthSeed(seed) });
  if (!access.ok) {
    return { ok: false as const, response: access.response };
  }
  const profile = access.billing.profile;
  if (!profile) {
    return { ok: false as const, response: jsonError("USER_NOT_FOUND", "No learner profile", 404) };
  }
  return { ok: true as const, profile };
}

/** Today's daily action + streak for the signed-in learner. */
export async function GET(req: NextRequest) {
  const access = await resolveAccess(req);
  if (!access.ok) return access.response;

  const view = await getDailyActionWithStreak({ learnerProfileId: access.profile.id });
  return jsonOk({ action: view.action, streak: view.streak });
}

/**
 * Generate today's daily action on demand (idempotent per day). Hard-failure
 * contract: a failed LLM call returns an explicit error, never a fabricated
 * action.
 */
export async function POST(req: NextRequest) {
  const access = await resolveAccess(req);
  if (!access.ok) return access.response;

  const result = await runDailyRescoreForUser({
    learnerProfileId: access.profile.id,
    careerPathId: access.profile.careerPathId,
  });

  if (!result.ok) {
    const status = result.errorCode === "ASSESSMENT_REPORT_MISSING" ? 409 : 502;
    return jsonError("DAILY_ACTION_FAILED", "Daily action generation failed", status, {
      failureCode: result.errorCode,
      recoveryAction:
        result.errorCode === "ASSESSMENT_REPORT_MISSING"
          ? "Complete the assessment so the tutor has a report to score against"
          : "Retry once the provider is stable",
    });
  }

  const view = await getDailyActionWithStreak({ learnerProfileId: access.profile.id });
  return jsonOk({ action: result.action, created: result.created, scoreAfter: result.scoreAfter, streak: view.streak });
}
