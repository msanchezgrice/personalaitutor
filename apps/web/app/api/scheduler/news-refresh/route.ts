import { jsonError, jsonOk, runtimeRefreshRelevantNews } from "@/lib/runtime";
import { NextRequest } from "next/server";
import { forcedFailCode } from "@/lib/api";

export async function POST(req: NextRequest) {
  const result = await runtimeRefreshRelevantNews({ forceFailCode: forcedFailCode(req) });
  if (!result.ok) {
    return jsonError("NEWS_REFRESH_FAILED", "Relevant news refresh failed", 409, {
      failureCode: result.errorCode,
      recoveryAction: "Retry scheduler/news-refresh when provider is stable",
    });
  }

  return jsonOk({ insights: result.insights });
}
