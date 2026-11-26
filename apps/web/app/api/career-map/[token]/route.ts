import { toCareerMapView } from "@aitutor/shared";
import { jsonError, jsonOk } from "@/lib/runtime";
import { findCareerMapByToken } from "@/lib/career-map/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** GET -> `{ ok, view }`. The view never includes the input text, email or ip hash. */
export async function GET(_req: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const record = await findCareerMapByToken(safeDecode(token ?? ""));
    if (!record) {
      return jsonError("CAREER_MAP_NOT_FOUND", "We could not find that map", 404, {
        recoveryAction: "Check the link, or make a new map at /map.",
      });
    }
    return jsonOk({ view: toCareerMapView(record) });
  } catch (error) {
    return jsonError("CAREER_MAP_READ_FAILED", "We could not load that map", 500, {
      reason: error instanceof Error ? error.message.slice(0, 300) : "UNKNOWN",
      recoveryAction: "Retry in a minute.",
    });
  }
}
