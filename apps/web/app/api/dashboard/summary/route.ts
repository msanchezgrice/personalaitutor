import { getCatalogData, jsonError, jsonOk, runtimeGetDashboardSummary } from "@/lib/runtime";
import { NextRequest } from "next/server";
import { getUserId } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const userId = getUserId(req);
    const summary = await runtimeGetDashboardSummary(userId);
    if (!summary) {
      return jsonError("USER_NOT_FOUND", "Dashboard summary unavailable for unknown user", 404);
    }

    return jsonOk({ summary, catalog: getCatalogData() });
  } catch (error) {
    return jsonError("DASHBOARD_SUMMARY_FAILED", "Failed to load dashboard summary", 500, {
      reason: error instanceof Error ? error.message : "UNKNOWN",
    });
  }
}
