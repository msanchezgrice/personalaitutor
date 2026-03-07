import { createAnalyticsEventId } from "@/lib/analytics";
import { fbCompleteRegistration } from "@/lib/fb-pixel";

const linkedInSignupConversionId = Number(process.env.NEXT_PUBLIC_LINKEDIN_SIGNUP_CONVERSION_ID || "0") || 0;
const linkedInLeadConversionId = Number(process.env.NEXT_PUBLIC_LINKEDIN_LEAD_CONVERSION_ID || "0") || 0;

function hasWindow() {
  return typeof window !== "undefined";
}

function trackXEvent(event: string, params?: Record<string, unknown>) {
  if (!hasWindow() || typeof window.twq !== "function") return;
  try {
    if (params) {
      window.twq("event", event, params);
    } else {
      window.twq("event", event);
    }
  } catch {
    // Ignore X pixel errors.
  }
}

function trackLinkedInConversion(conversionId: number, params?: Record<string, unknown>) {
  if (!conversionId || !hasWindow() || typeof window.lintrk !== "function") return;
  try {
    window.lintrk("track", {
      conversion_id: conversionId,
      ...(params ?? {}),
    });
  } catch {
    // Ignore LinkedIn insight errors.
  }
}

function sendServerConversion(payload: {
  event: "complete_registration" | "lead";
  value?: number;
  currency?: string;
  eventId?: string;
  sessionId?: string | null;
  careerCategory?: string;
  score?: number;
  source?: string;
}) {
  if (!hasWindow()) return;
  void fetch("/api/analytics/conversion", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
    credentials: "same-origin",
    body: JSON.stringify({
      ...payload,
      sourceUrl: window.location.href,
    }),
  }).catch(() => {
    // Non-blocking analytics path.
  });
}

export function trackAdCompleteRegistration(input: {
  sessionId?: string | null;
  source?: string;
}) {
  const eventId = createAnalyticsEventId("complete_registration");

  fbCompleteRegistration("clerk", eventId);
  trackXEvent("SignUp", {
    content_name: "signup",
  });
  trackLinkedInConversion(linkedInSignupConversionId, {
    source: input.source ?? "runtime",
  });
  sendServerConversion({
    event: "complete_registration",
    eventId,
    sessionId: input.sessionId ?? null,
    source: input.source,
  });
}

export function trackAdLead(input: {
  score: number;
  sessionId?: string | null;
  careerCategory?: string;
  source?: string;
  eventId?: string;
}) {
  const eventId = input.eventId ?? createAnalyticsEventId("lead");
  trackXEvent("Lead", {
    value: input.score,
    currency: "USD",
    content_name: "assessment_complete",
  });
  trackLinkedInConversion(linkedInLeadConversionId, {
    score: input.score,
    source: input.source ?? "onboarding_complete",
  });
  sendServerConversion({
    event: "lead",
    eventId,
    value: input.score,
    currency: "USD",
    score: input.score,
    sessionId: input.sessionId ?? null,
    careerCategory: input.careerCategory,
    source: input.source,
  });
}

declare global {
  interface Window {
    twq?: (...args: unknown[]) => void;
    lintrk?: (...args: unknown[]) => void;
  }
}
