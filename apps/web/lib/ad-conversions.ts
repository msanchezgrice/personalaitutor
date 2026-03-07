import { captureAnalyticsEvent, createAnalyticsEventId } from "@/lib/analytics";
import {
  fbCompleteRegistration,
  fbOnboardingComplete,
  fbOnboardingStart,
  fbQuizComplete,
  fbQuizStart,
} from "@/lib/fb-pixel";

const linkedInSignupConversionId = Number(process.env.NEXT_PUBLIC_LINKEDIN_SIGNUP_CONVERSION_ID || "0") || 0;
const linkedInLeadConversionId = Number(process.env.NEXT_PUBLIC_LINKEDIN_LEAD_CONVERSION_ID || "0") || 0;

function hasWindow() {
  return typeof window !== "undefined";
}

type ConversionEvent =
  | "complete_registration"
  | "lead"
  | "onboarding_start"
  | "quiz_start"
  | "quiz_complete"
  | "onboarding_complete";

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
  event: ConversionEvent;
  value?: number;
  currency?: string;
  eventId?: string;
  sessionId?: string | null;
  careerCategory?: string;
  score?: number;
  source?: string;
  recommendedPaths?: string[];
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

function captureAdMirror(payload: {
  event: ConversionEvent;
  eventId: string;
  sessionId?: string | null;
  careerCategory?: string;
  score?: number;
  source?: string;
  recommendedPaths?: string[];
}) {
  captureAnalyticsEvent("ad_conversion_event", {
    ad_network: "meta",
    conversion_event: payload.event,
    event_id: payload.eventId,
    session_id: payload.sessionId ?? null,
    career_category: payload.careerCategory ?? null,
    score: payload.score ?? null,
    source: payload.source ?? null,
    recommended_paths: payload.recommendedPaths?.join(",") ?? null,
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
  captureAdMirror({
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
  recommendedPaths?: string[];
  eventId?: string;
}) {
  const eventId = input.eventId ?? createAnalyticsEventId("lead");

  fbQuizComplete(input.score, input.recommendedPaths, eventId);
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
  sendServerConversion({
    event: "quiz_complete",
    eventId: `${eventId}_quiz_complete`,
    value: input.score,
    currency: "USD",
    score: input.score,
    sessionId: input.sessionId ?? null,
    careerCategory: input.careerCategory,
    source: input.source,
    recommendedPaths: input.recommendedPaths,
  });
  captureAdMirror({
    event: "lead",
    eventId,
    sessionId: input.sessionId ?? null,
    careerCategory: input.careerCategory,
    score: input.score,
    source: input.source,
    recommendedPaths: input.recommendedPaths,
  });
  captureAdMirror({
    event: "quiz_complete",
    eventId: `${eventId}_quiz_complete`,
    sessionId: input.sessionId ?? null,
    careerCategory: input.careerCategory,
    score: input.score,
    source: input.source,
    recommendedPaths: input.recommendedPaths,
  });
}

export function trackAdOnboardingStart(input: {
  sessionId?: string | null;
  source?: string;
  careerCategory?: string;
}) {
  const eventId = createAnalyticsEventId("onboarding_start");

  fbOnboardingStart(eventId);
  sendServerConversion({
    event: "onboarding_start",
    eventId,
    sessionId: input.sessionId ?? null,
    careerCategory: input.careerCategory,
    source: input.source,
  });
  captureAdMirror({
    event: "onboarding_start",
    eventId,
    sessionId: input.sessionId ?? null,
    careerCategory: input.careerCategory,
    source: input.source,
  });
}

export function trackAdQuizStart(input: {
  sessionId?: string | null;
  source?: string;
  careerCategory?: string;
}) {
  const eventId = createAnalyticsEventId("quiz_start");

  fbQuizStart(eventId);
  sendServerConversion({
    event: "quiz_start",
    eventId,
    sessionId: input.sessionId ?? null,
    careerCategory: input.careerCategory,
    source: input.source,
  });
  captureAdMirror({
    event: "quiz_start",
    eventId,
    sessionId: input.sessionId ?? null,
    careerCategory: input.careerCategory,
    source: input.source,
  });
}

export function trackAdOnboardingComplete(input: {
  sessionId?: string | null;
  source?: string;
  careerCategory?: string;
  score?: number;
}) {
  const eventId = createAnalyticsEventId("onboarding_complete");

  fbOnboardingComplete(eventId);
  sendServerConversion({
    event: "onboarding_complete",
    eventId,
    sessionId: input.sessionId ?? null,
    careerCategory: input.careerCategory,
    score: input.score,
    source: input.source,
  });
  captureAdMirror({
    event: "onboarding_complete",
    eventId,
    sessionId: input.sessionId ?? null,
    careerCategory: input.careerCategory,
    score: input.score,
    source: input.source,
  });
}

declare global {
  interface Window {
    twq?: (...args: unknown[]) => void;
    lintrk?: (...args: unknown[]) => void;
  }
}
