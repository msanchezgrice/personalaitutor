import { jsonError, jsonOk, runtimeCreateDailyUpdate, runtimeFindUserById } from "@/lib/runtime";
import { NextRequest } from "next/server";
import { forcedFailCode, getUserId } from "@/lib/api";
import { requireBillingAccess } from "@/lib/billing-access";

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
