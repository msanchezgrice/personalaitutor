import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthSeed } from "@/lib/auth";
import { shouldPersistClientFunnelEvent } from "@/lib/funnel-events";
import { recordPersistedFunnelEvent } from "@/lib/funnel-events-server";
import { jsonError, jsonOk } from "@/lib/runtime";

const schema = z.object({
  event: z.string().min(1).max(120),
  eventId: z.string().max(160).optional(),
  visitorId: z.string().max(160).nullable().optional(),
  occurredAt: z.string().max(80).optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
});

function stringValue(value: unknown, maxLen = 500) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLen);
}

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return jsonError("INVALID_BODY", "Invalid funnel analytics payload", 400, {
      issues: parsed.error.issues,
    });
  }

  if (!shouldPersistClientFunnelEvent(parsed.data.event)) {
    return jsonOk({ ignored: true });
  }

  const seed = await getAuthSeed(req);
  const properties = parsed.data.properties ?? {};

  await recordPersistedFunnelEvent({
    eventKey: parsed.data.event,
    eventId: parsed.data.eventId ?? stringValue(properties.event_id, 160),
    occurredAt: parsed.data.occurredAt ?? new Date().toISOString(),
    visitorId: parsed.data.visitorId ?? null,
    authUserId: seed?.userId ?? null,
    learnerProfileId: stringValue(properties.user_id, 80) ?? null,
    onboardingSessionId:
      stringValue(properties.onboarding_session_id, 80) ??
      stringValue(properties.session_id, 80) ??
      null,
    projectId: stringValue(properties.project_id, 80) ?? null,
    funnel: stringValue(properties.funnel, 120),
    step: stringValue(properties.step, 120),
    path: stringValue(properties.path, 240),
    pageUrl: stringValue(properties.page_url, 1200),
    utmSource: stringValue(properties.utm_source, 240),
    utmMedium: stringValue(properties.utm_medium, 240),
    utmCampaign: stringValue(properties.utm_campaign, 240),
    utmContent: stringValue(properties.utm_content, 240),
    utmTerm: stringValue(properties.utm_term, 240),
    firstUtmSource: stringValue(properties.first_utm_source, 240),
    firstUtmMedium: stringValue(properties.first_utm_medium, 240),
    firstUtmCampaign: stringValue(properties.first_utm_campaign, 240),
    firstUtmContent: stringValue(properties.first_utm_content, 240),
    firstUtmTerm: stringValue(properties.first_utm_term, 240),
    landingPath: stringValue(properties.landing_path, 240),
    firstLandingPath: stringValue(properties.first_landing_path, 240),
    referrer: stringValue(properties.referrer, 1000),
    firstReferrer: stringValue(properties.first_referrer, 1000),
    paidSource: stringValue(properties.paid_source, 120),
    properties,
  });

  return jsonOk({ ok: true });
}
