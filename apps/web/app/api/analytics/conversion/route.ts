import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/runtime";

const conversionEventSchema = z.enum([
  "complete_registration",
  "lead",
  "onboarding_start",
  "quiz_start",
  "quiz_complete",
  "onboarding_complete",
]);

const schema = z.object({
  event: conversionEventSchema,
  eventId: z.string().max(160).optional(),
  source: z.string().max(120).optional(),
  sourceUrl: z.string().url().optional(),
  visitorId: z.string().max(160).nullable().optional(),
  value: z.number().finite().optional(),
  currency: z.string().max(10).optional(),
  sessionId: z.string().max(80).nullable().optional(),
  careerCategory: z.string().max(80).optional(),
  score: z.number().finite().optional(),
  recommendedPaths: z.array(z.string().max(80)).max(10).optional(),
  utmSource: z.string().max(240).nullable().optional(),
  utmMedium: z.string().max(240).nullable().optional(),
  utmCampaign: z.string().max(240).nullable().optional(),
  utmContent: z.string().max(240).nullable().optional(),
  utmTerm: z.string().max(240).nullable().optional(),
  firstUtmSource: z.string().max(240).nullable().optional(),
  firstUtmMedium: z.string().max(240).nullable().optional(),
  firstUtmCampaign: z.string().max(240).nullable().optional(),
  firstUtmContent: z.string().max(240).nullable().optional(),
  firstUtmTerm: z.string().max(240).nullable().optional(),
  landingPath: z.string().max(240).nullable().optional(),
  paidSource: z.string().max(120).nullable().optional(),
});

type ConversionEvent = z.infer<typeof conversionEventSchema>;

type RelayResult = {
  provider: "meta" | "linkedin" | "x";
  delivered: boolean;
  status?: number;
  reason?: string;
};

function eventName(event: ConversionEvent) {
  switch (event) {
    case "complete_registration":
      return "CompleteRegistration";
    case "lead":
      return "Lead";
    case "onboarding_start":
      return "OnboardingStart";
    case "quiz_start":
      return "QuizStart";
    case "quiz_complete":
      return "QuizComplete";
    case "onboarding_complete":
      return "OnboardingComplete";
  }
}

function providerSupportsEvent(provider: "meta" | "linkedin" | "x", event: ConversionEvent) {
  if (provider === "meta") return true;
  return event === "complete_registration" || event === "lead";
}

function firstClientIp(req: NextRequest) {
  const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = req.headers.get("x-real-ip")?.trim();
  const cfIp = req.headers.get("cf-connecting-ip")?.trim();
  return cfIp || forwardedFor || realIp || undefined;
}

async function relayMeta(payload: z.infer<typeof schema>, req: NextRequest): Promise<RelayResult> {
  const pixelId = process.env.META_PIXEL_ID?.trim() || process.env.NEXT_PUBLIC_FB_PIXEL_ID?.trim();
  const token = process.env.META_CONVERSIONS_ACCESS_TOKEN?.trim();
  if (!pixelId || !token) {
    return { provider: "meta", delivered: false, reason: "MISSING_CONFIG" };
  }

  const body = {
    data: [
      {
        event_name: eventName(payload.event),
        event_time: Math.floor(Date.now() / 1000),
        action_source: "website",
        event_id: payload.eventId ?? `${payload.event}_${Date.now()}`,
        event_source_url: payload.sourceUrl,
        custom_data: {
          currency: payload.currency ?? "USD",
          value: payload.value,
          session_id: payload.sessionId ?? undefined,
          score: payload.score,
          career_category: payload.careerCategory,
          recommended_paths: payload.recommendedPaths?.join(",") ?? undefined,
          source: payload.source,
          visitor_id: payload.visitorId ?? undefined,
          utm_source: payload.utmSource ?? undefined,
          utm_medium: payload.utmMedium ?? undefined,
          utm_campaign: payload.utmCampaign ?? undefined,
          utm_content: payload.utmContent ?? undefined,
          utm_term: payload.utmTerm ?? undefined,
          first_utm_source: payload.firstUtmSource ?? undefined,
          first_utm_medium: payload.firstUtmMedium ?? undefined,
          first_utm_campaign: payload.firstUtmCampaign ?? undefined,
          first_utm_content: payload.firstUtmContent ?? undefined,
          first_utm_term: payload.firstUtmTerm ?? undefined,
          landing_path: payload.landingPath ?? undefined,
          paid_source: payload.paidSource ?? undefined,
        },
        user_data: {
          client_ip_address: firstClientIp(req),
          client_user_agent: req.headers.get("user-agent") ?? undefined,
          fbc: req.cookies.get("_fbc")?.value ?? undefined,
          fbp: req.cookies.get("_fbp")?.value ?? undefined,
        },
      },
    ],
  };

  const res = await fetch(`https://graph.facebook.com/v19.0/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return {
    provider: "meta",
    delivered: res.ok,
    status: res.status,
    reason: res.ok ? undefined : "META_RELAY_FAILED",
  };
}

async function relayGenericProvider(
  provider: "linkedin" | "x",
  payload: z.infer<typeof schema>,
): Promise<RelayResult> {
  if (!providerSupportsEvent(provider, payload.event)) {
    return { provider, delivered: false, reason: "UNSUPPORTED_EVENT" };
  }

  const endpointEnv = provider === "linkedin" ? "LINKEDIN_CONVERSIONS_API_URL" : "X_CONVERSIONS_API_URL";
  const tokenEnv = provider === "linkedin" ? "LINKEDIN_CONVERSIONS_API_TOKEN" : "X_CONVERSIONS_API_TOKEN";

  const endpoint = process.env[endpointEnv]?.trim();
  const token = process.env[tokenEnv]?.trim();
  if (!endpoint || !token) {
    return { provider, delivered: false, reason: "MISSING_CONFIG" };
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      event: payload.event,
      eventId: payload.eventId ?? `${payload.event}_${Date.now()}`,
      source: payload.source,
      sourceUrl: payload.sourceUrl,
      value: payload.value,
      currency: payload.currency ?? "USD",
      sessionId: payload.sessionId,
      visitorId: payload.visitorId,
      score: payload.score,
      careerCategory: payload.careerCategory,
      timestamp: new Date().toISOString(),
      utmSource: payload.utmSource,
      utmMedium: payload.utmMedium,
      utmCampaign: payload.utmCampaign,
      utmContent: payload.utmContent,
      utmTerm: payload.utmTerm,
      firstUtmSource: payload.firstUtmSource,
      firstUtmMedium: payload.firstUtmMedium,
      firstUtmCampaign: payload.firstUtmCampaign,
      firstUtmContent: payload.firstUtmContent,
      firstUtmTerm: payload.firstUtmTerm,
      landingPath: payload.landingPath,
      paidSource: payload.paidSource,
    }),
  });

  return {
    provider,
    delivered: res.ok,
    status: res.status,
    reason: res.ok ? undefined : `${provider.toUpperCase()}_RELAY_FAILED`,
  };
}

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return jsonError("INVALID_BODY", "Invalid conversion payload", 400, {
        issues: parsed.error.issues,
      });
    }

    const payload = parsed.data;
    const [meta, linkedin, x] = await Promise.all([
      relayMeta(payload, req),
      relayGenericProvider("linkedin", payload),
      relayGenericProvider("x", payload),
    ]);

    return jsonOk({
      event: payload.event,
      relays: [meta, linkedin, x],
    });
  } catch (error) {
    return jsonError("CONVERSION_RELAY_FAILED", "Failed to relay conversion event", 500, {
      reason: error instanceof Error ? error.message : "UNKNOWN",
    });
  }
}
