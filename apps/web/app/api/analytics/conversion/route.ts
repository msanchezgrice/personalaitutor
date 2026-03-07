import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/runtime";

const schema = z.object({
  event: z.enum(["complete_registration", "lead"]),
  eventId: z.string().max(160).optional(),
  source: z.string().max(120).optional(),
  sourceUrl: z.string().url().optional(),
  value: z.number().finite().optional(),
  currency: z.string().max(10).optional(),
  sessionId: z.string().max(80).nullable().optional(),
  careerCategory: z.string().max(80).optional(),
  score: z.number().finite().optional(),
});

type RelayResult = {
  provider: "meta" | "linkedin" | "x";
  delivered: boolean;
  status?: number;
  reason?: string;
};

function eventName(event: "complete_registration" | "lead") {
  return event === "complete_registration" ? "CompleteRegistration" : "Lead";
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
      score: payload.score,
      careerCategory: payload.careerCategory,
      timestamp: new Date().toISOString(),
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
