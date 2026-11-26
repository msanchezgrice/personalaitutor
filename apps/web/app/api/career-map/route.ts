import { NextRequest } from "next/server";
import { z } from "zod";
import {
  CAREER_MAP_COOKIE_NAME,
  CAREER_MAP_INPUT_MAX_CHARS,
  CAREER_MAP_INPUT_MIN_CHARS,
  toCareerMapView,
} from "@aitutor/shared";
import { getAuthSeed } from "@/lib/auth";
import { jsonError, jsonOk, runtimeGetBillingAccessState } from "@/lib/runtime";
import { CAREER_MAP_UNGROUNDED_ERROR, generateCareerMap } from "@/lib/career-map/generate";
import { checkCareerMapRateLimit, hashRequestIp } from "@/lib/career-map/rate-limit";
import { completeCareerMapRecord, createCareerMapRecord, failCareerMapRecord } from "@/lib/career-map/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const schema = z.object({
  text: z.string().max(CAREER_MAP_INPUT_MAX_CHARS, `Keep it under ${CAREER_MAP_INPUT_MAX_CHARS.toLocaleString("en-US")} characters`),
  source: z.enum(["paste", "upload", "describe"]),
  visitorId: z.string().max(160).optional().nullable(),
});

function careerMapCookie(token: string) {
  const parts = [
    `${CAREER_MAP_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

/**
 * Learner profile id of the signed-in caller, or null. Uses Clerk's session
 * only (getAuthSeed without the request), never the x-user-id header, which a
 * signed-out caller can set on this public route.
 */
async function resolveSignedInProfileId(): Promise<string | null> {
  try {
    const seed = await getAuthSeed().catch(() => null);
    if (!seed?.userId) return null;
    const billing = await runtimeGetBillingAccessState({
      userId: seed.userId,
      seed: {
        name: seed.name,
        email: seed.email,
        avatarUrl: seed.avatarUrl ?? null,
        handleBase: seed.handleBase,
      },
    });
    return billing.profile?.id ?? null;
  } catch (error) {
    console.warn("[career-map] signed-in profile lookup failed", error instanceof Error ? error.message : "unknown");
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return jsonError("INVALID_BODY", parsed.error.issues[0]?.message ?? "Invalid request", 400, {
        issues: parsed.error.issues,
      });
    }
    const text = parsed.data.text.trim();
    if (text.length < CAREER_MAP_INPUT_MIN_CHARS) {
      return jsonError(
        "CAREER_MAP_INPUT_TOO_SHORT",
        `Tell us a bit more: at least ${CAREER_MAP_INPUT_MIN_CHARS} characters about what you did.`,
        400,
        { minChars: CAREER_MAP_INPUT_MIN_CHARS, chars: text.length },
      );
    }

    const ipHash = hashRequestIp(req);
    const limit = await checkCareerMapRateLimit(ipHash);
    if (!limit.ok) {
      const response = jsonError(
        "CAREER_MAP_RATE_LIMITED",
        limit.scope === "global"
          ? "We have made a lot of maps today. Try again later."
          : "You have made several maps in a short time. Try again later.",
        429,
        { retryAfterSeconds: limit.retryAfterSeconds, scope: limit.scope },
      );
      response.headers.set("retry-after", String(limit.retryAfterSeconds));
      return response;
    }

    const learnerProfileId = await resolveSignedInProfileId();

    const record = await createCareerMapRecord({
      source: parsed.data.source,
      inputText: text,
      visitorId: parsed.data.visitorId ?? null,
      ipHash,
      learnerProfileId,
    });

    // HARD FAILURE contract: no fallback map. The record is marked failed and
    // the caller gets a clear reason and what to do next.
    let generated;
    try {
      generated = await generateCareerMap({ inputText: text });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "UNKNOWN";
      await failCareerMapRecord({ id: record.id, reason }).catch(() => undefined);
      if (reason.startsWith("OPENAI_CONFIG_MISSING")) {
        return jsonError("OPENAI_CONFIG_MISSING", "Career maps are not available right now", 502, {
          reason: reason.slice(0, 300),
          recoveryAction: "Try again later.",
        });
      }
      const ungrounded = reason.startsWith(CAREER_MAP_UNGROUNDED_ERROR);
      return jsonError(
        "CAREER_MAP_FAILED",
        ungrounded ? "We could not find enough detail about your work to map it" : "We could not build your map right now",
        502,
        {
          reason: reason.slice(0, 300),
          recoveryAction: ungrounded
            ? "Add more detail about what you did: paste your full résumé, or describe at least three specific tasks from your last job in your own words."
            : "Retry in a minute.",
        },
      );
    }

    const completed = await completeCareerMapRecord({ id: record.id, map: generated.map, model: generated.model });

    const response = jsonOk({
      token: completed.token,
      mapPath: `/map/${encodeURIComponent(completed.token)}`,
      view: toCareerMapView(completed),
    });
    response.headers.append("set-cookie", careerMapCookie(completed.token));
    return response;
  } catch (error) {
    return jsonError("CAREER_MAP_FAILED", "We could not build your map right now", 500, {
      reason: error instanceof Error ? error.message.slice(0, 300) : "UNKNOWN",
      recoveryAction: "Retry in a minute.",
    });
  }
}
