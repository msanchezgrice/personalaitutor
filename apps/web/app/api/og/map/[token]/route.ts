import { renderCareerMapOgImage } from "@/components/career-map/og-image";
import { findCareerMapByToken } from "@/lib/career-map/store";

/** 1200x630 share image for /map/[token]. Completed maps get the route; others get the brand card. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  let decoded = token;
  try {
    decoded = decodeURIComponent(token);
  } catch {
    // Use the raw token.
  }
  const record = await findCareerMapByToken(decoded).catch(() => null);
  if (!record) {
    return new Response(JSON.stringify({ ok: false, error: { code: "CAREER_MAP_NOT_FOUND", message: "Career map not found" } }), {
      status: 404,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }
  return renderCareerMapOgImage(record.status === "completed" ? record.map : null);
}
