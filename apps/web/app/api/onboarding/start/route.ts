import { getCatalogData, jsonError, jsonOk, runtimeCreateOnboardingSession } from "@/lib/runtime";
import { z } from "zod";
import { NextRequest } from "next/server";
import { getUserId } from "@/lib/api";
import { getAuthSeed } from "@/lib/auth";
import { randomUUID } from "node:crypto";
import { issueOnboardingSessionToken } from "@/lib/onboarding-session-token";
import {
  ATTRIBUTION_COOKIE_KEY,
  extractAttributionFromRequest,
  mergeAttribution,
  toAttributionCookieValue,
} from "@/lib/attribution";

const attributionPointSchema = z
  .object({
    utmSource: z.string().max(300).optional(),
    utmMedium: z.string().max(300).optional(),
    utmCampaign: z.string().max(300).optional(),
    utmContent: z.string().max(300).optional(),
    utmTerm: z.string().max(300).optional(),
    fbclid: z.string().max(200).optional(),
    twclid: z.string().max(200).optional(),
    liFatId: z.string().max(200).optional(),
    gclid: z.string().max(200).optional(),
    msclkid: z.string().max(200).optional(),
    referrer: z.string().max(500).optional(),
    landingPath: z.string().max(300).optional(),
    capturedAt: z.string().max(40).optional(),
  })
  .partial();

const attributionEnvelopeSchema = z
  .object({
    first: attributionPointSchema.optional(),
    last: attributionPointSchema.optional(),
  })
  .partial();

const bodySchema = z
  .object({
    userId: z.string().min(1).optional(),
    name: z.string().min(1).max(80).optional(),
    avatarUrl: z.string().url().optional().nullable(),
    handleBase: z.string().min(1).max(80).optional(),
    careerPathId: z.string().min(1).optional(),
    email: z.string().email().optional().nullable(),
    acquisition: attributionEnvelopeSchema.optional(),
  })
  .optional();

export async function POST(req: NextRequest) {
  try {
    const payload = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!payload.success) {
      return jsonError("INVALID_BODY", "Invalid onboarding start payload", 400, { issues: payload.error.issues });
    }

    const seed = await getAuthSeed(req);
    const requestUserId = seed?.userId ?? getUserId(req) ?? `visitor_${randomUUID()}`;
    const requestAttribution = extractAttributionFromRequest(req);
    const mergedAttribution = mergeAttribution(requestAttribution, payload.data?.acquisition);

    const { user, session } = await runtimeCreateOnboardingSession({
      ...(payload.data ?? {}),
      userId: requestUserId,
      name: payload.data?.name ?? seed?.name,
      avatarUrl: payload.data?.avatarUrl ?? seed?.avatarUrl ?? null,
      email: seed?.email ?? payload.data?.email ?? null,
      handleBase: payload.data?.handleBase ?? seed?.handleBase,
      acquisition: mergedAttribution ?? undefined,
    });
    const sessionToken = issueOnboardingSessionToken({
      sessionId: session.id,
      userId: session.userId,
    });
    const catalog = getCatalogData();
    const response = jsonOk({
      user,
      session,
      sessionToken,
      onboardingOptions: catalog.careerPaths.map((c) => ({ id: c.id, name: c.name })),
    });
    if (mergedAttribution) {
      response.headers.append(
        "set-cookie",
        `${ATTRIBUTION_COOKIE_KEY}=${toAttributionCookieValue(mergedAttribution)}; Max-Age=2592000; Path=/; SameSite=Lax`,
      );
    }
    return response;
  } catch (error) {
    return jsonError("ONBOARDING_START_FAILED", "Failed to start onboarding session", 500, {
      reason: error instanceof Error ? error.message : "UNKNOWN",
    });
  }
}
