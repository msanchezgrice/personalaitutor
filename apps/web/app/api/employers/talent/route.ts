import { getEmployerFacets, jsonOk, runtimeListTalent } from "@/lib/runtime";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const rows = await runtimeListTalent({
    role: req.nextUrl.searchParams.get("role") ?? undefined,
    skill: req.nextUrl.searchParams.get("skill") ?? undefined,
    tool: req.nextUrl.searchParams.get("tool") ?? undefined,
    status: (req.nextUrl.searchParams.get("status") as "not_started" | "in_progress" | "built" | "verified" | null) ?? undefined,
    q: req.nextUrl.searchParams.get("q") ?? undefined,
  });

  return jsonOk({
    facets: getEmployerFacets(),
    total: rows.length,
    rows,
  });
}
