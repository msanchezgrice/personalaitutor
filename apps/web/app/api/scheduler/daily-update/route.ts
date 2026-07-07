import { jsonError, jsonOk, runtimeCreateDailyUpdate, runtimeFindUserById } from "@/lib/runtime";
import { NextRequest } from "next/server";
import { forcedFailCode, getUserId } from "@/lib/api";
import { requireBillingAccess } from "@/lib/billing-access";
import { requireCronSecret } from "@/lib/cron-auth";
import { runDailyRescoreSweep } from "@/lib/daily-action";

export const maxDuration = 300;

/**
 * Vercel cron entry (crons send GET): daily re-scoring + daily-action sweep
 * for all active subscribers (rebuild Phase 3.3/3.6). Guarded by CRON_SECRET.
 * The POST handler below stays for per-user manual triggering.
 */
export async function GET(req: NextRequest) {
  const unauthorized = requireCronSecret(req);
  if (unauthorized) return unauthorized;

  const result = await runDailyRescoreSweep();
  return jsonOk({
    attempted: result.attempted,
    created: result.created,
    existing: result.existing,
    skipped: result.skipped,
    failed: result.failed,
  });
}

export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) {
    return jsonError("UNAUTHENTICATED", "Sign in required", 401);
  }
  const access = await requireBillingAccess({ userId });
  if (!access.ok) {
    return access.response;
  }
  const user = await runtimeFindUserById(userId);
  if (!user) {
    return jsonError("USER_NOT_FOUND", "Cannot send daily update for unknown user", 404);
  }

  const result = await runtimeCreateDailyUpdate({ userId, forceFailCode: forcedFailCode(req) });
  if (!result.ok) {
    return jsonError("DAILY_UPDATE_FAILED", "Daily update send failed", 409, {
      failureCode: result.errorCode,
      recoveryAction: "Retry scheduler/daily-update after email provider recovery",
    });
  }

  return jsonOk({ update: result.update });
}
