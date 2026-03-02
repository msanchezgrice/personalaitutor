import { getCatalogData, jsonError, jsonOk, runtimeGetDashboardSummary } from "@/lib/runtime";
import { NextRequest } from "next/server";
import { getUserId } from "@/lib/api";

export async function GET(req: NextRequest) {
  const userId = getUserId(req);
  const summary = await runtimeGetDashboardSummary(userId);
  if (!summary) {
    return jsonError("USER_NOT_FOUND", "Dashboard summary unavailable for unknown user", 404);
  }

  return jsonOk({ summary, catalog: getCatalogData() });
}
