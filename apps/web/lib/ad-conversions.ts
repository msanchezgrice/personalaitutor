import {
  captureAnalyticsEvent,
  createAnalyticsEventId,
  getOrCreateFunnelVisitorId,
} from "@/lib/analytics";
import { readClientAttributionEnvelope, type AttributionEnvelope } from "@/lib/attribution";
import {
  fbCompleteRegistration,
  fbInitiateCheckout,
  fbOnboardingComplete,
  fbOnboardingStart,
  fbQuizComplete,
  fbQuizStart,
  fbSubscribe,
} from "@/lib/fb-pixel";
import { trackGoogleAdsConversion } from "@/lib/google-ads";

const linkedInSignupConversionId = Number(process.env.NEXT_PUBLIC_LINKEDIN_SIGNUP_CONVERSION_ID || "0") || 0;
const linkedInLeadConversionId = Number(process.env.NEXT_PUBLIC_LINKEDIN_LEAD_CONVERSION_ID || "0") || 0;
const googleAdsSignupConversionLabel = process.env.NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_CONVERSION_LABEL?.trim() || "";
const googleAdsLeadConversionLabel = process.env.NEXT_PUBLIC_GOOGLE_ADS_LEAD_CONVERSION_LABEL?.trim() || "";
const googleAdsCheckoutStartedConversionLabel =
  process.env.NEXT_PUBLIC_GOOGLE_ADS_CHECKOUT_STARTED_CONVERSION_LABEL?.trim() || "";
const googleAdsCheckoutCompletedConversionLabel =
  process.env.NEXT_PUBLIC_GOOGLE_ADS_CHECKOUT_COMPLETED_CONVERSION_LABEL?.trim() || "";
const DEFAULT_CHECKOUT_VALUE = 49.99;

function hasWindow() {
  return typeof window !== "undefined";
}

type ConversionEvent =
  | "complete_registration"
  | "lead"
  | "onboarding_start"
  | "quiz_start"
  | "quiz_complete"
  | "onboarding_complete"
  | "checkout_started"
  | "checkout_completed";

type ServerConversionPayload = {
  event: ConversionEvent;
  eventId?: string;
  value?: number;
  currency?: string;
  sessionId?: string | null;
  careerCategory?: string;
  score?: number;
  source?: string;
  recommendedPaths?: string[];
  sourceUrl: string;
  visitorId: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  firstUtmSource?: string | null;
  firstUtmMedium?: string | null;
  firstUtmCampaign?: string | null;
  firstUtmContent?: string | null;
  firstUtmTerm?: string | null;
  landingPath?: string | null;
  paidSource?: string | null;
  gclid?: string | null;
  msclkid?: string | null;
};

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
  const body = buildServerConversionPayload(payload, {
    sourceUrl: window.location.href,
    visitorId: getOrCreateFunnelVisitorId(),
    attribution: readClientAttributionEnvelope(),
  });
  const bodyJson = JSON.stringify(body);

  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([bodyJson], { type: "application/json" });
      if (navigator.sendBeacon("/api/analytics/conversion", blob)) {
        return;
      }
    }
  } catch {
    // Fallback to fetch below.
  }

  void fetch("/api/analytics/conversion", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
    credentials: "same-origin",
    keepalive: true,
    body: bodyJson,
  }).catch(() => {
    // Non-blocking analytics path.
  });
}

function normalizePaidSource(attribution: AttributionEnvelope | null | undefined) {
  const last = attribution?.last;
  const source = (last?.utmSource || "").toLowerCase();

  if (source.includes("linkedin")) return "linkedin";
  if (source === "x" || source.includes("twitter")) return "x";
  if (source.includes("facebook") || source.includes("instagram") || source.includes("meta")) {
    return "facebook";
  }
  if (source.includes("google") || last?.gclid) return "google";
  if (source.includes("bing") || last?.msclkid) return "bing";
  return "unknown";
}

export function buildServerConversionPayload(
  payload: {
    event: ConversionEvent;
    eventId?: string;
    value?: number;
    currency?: string;
    sessionId?: string | null;
    careerCategory?: string;
    score?: number;
    source?: string;
    recommendedPaths?: string[];
  },
  context: {
    sourceUrl: string;
    visitorId: string | null;
    attribution: AttributionEnvelope | null | undefined;
  },
): ServerConversionPayload {
  const first = context.attribution?.first;
  const last = context.attribution?.last;

  return {
    ...payload,
    sourceUrl: context.sourceUrl,
    visitorId: context.visitorId,
    utmSource: last?.utmSource ?? null,
    utmMedium: last?.utmMedium ?? null,
    utmCampaign: last?.utmCampaign ?? null,
    utmContent: last?.utmContent ?? null,
    utmTerm: last?.utmTerm ?? null,
    firstUtmSource: first?.utmSource ?? null,
    firstUtmMedium: first?.utmMedium ?? null,
    firstUtmCampaign: first?.utmCampaign ?? null,
    firstUtmContent: first?.utmContent ?? null,
    firstUtmTerm: first?.utmTerm ?? null,
    landingPath: last?.landingPath ?? null,
    paidSource: normalizePaidSource(context.attribution),
    gclid: last?.gclid ?? first?.gclid ?? null,
    msclkid: last?.msclkid ?? first?.msclkid ?? null,
  };
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
    ad_network: "multi",
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
  trackGoogleAdsConversion(googleAdsSignupConversionLabel, {
    transactionId: input.sessionId ?? eventId,
  });
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
  trackGoogleAdsConversion(googleAdsLeadConversionLabel, {
    value: input.score,
    currency: "USD",
    transactionId: input.sessionId ?? eventId,
  });
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

export function trackAdCheckoutStarted(input: {
  sessionId?: string | null;
  source?: string;
  value?: number;
  currency?: string;
}) {
  const eventId = input.sessionId?.trim()
    ? `checkout_started_${input.sessionId.trim()}`
    : createAnalyticsEventId("checkout_started");
  const value = typeof input.value === "number" && Number.isFinite(input.value)
    ? input.value
    : DEFAULT_CHECKOUT_VALUE;
  const currency = input.currency?.trim() || "USD";

  fbInitiateCheckout(value, currency, eventId);
  trackGoogleAdsConversion(googleAdsCheckoutStartedConversionLabel, {
    value,
    currency,
    transactionId: input.sessionId ?? eventId,
  });
  sendServerConversion({
    event: "checkout_started",
    eventId,
    value,
    currency,
    sessionId: input.sessionId ?? null,
    source: input.source,
  });
  captureAdMirror({
    event: "checkout_started",
    eventId,
    sessionId: input.sessionId ?? null,
    source: input.source,
  });
}

export function trackAdCheckoutCompleted(input: {
  sessionId?: string | null;
  source?: string;
  value?: number;
  currency?: string;
  planId?: string | null;
}) {
  const eventId = input.sessionId?.trim()
    ? `checkout_completed_${input.sessionId.trim()}`
    : createAnalyticsEventId("checkout_completed");
  const value = typeof input.value === "number" && Number.isFinite(input.value)
    ? input.value
    : DEFAULT_CHECKOUT_VALUE;
  const currency = input.currency?.trim() || "USD";

  fbSubscribe(value, currency, input.planId ?? "monthly_subscription", eventId);
  trackGoogleAdsConversion(googleAdsCheckoutCompletedConversionLabel, {
    value,
    currency,
    transactionId: input.sessionId ?? eventId,
  });
  sendServerConversion({
    event: "checkout_completed",
    eventId,
    value,
    currency,
    sessionId: input.sessionId ?? null,
    source: input.source,
  });
  captureAdMirror({
    event: "checkout_completed",
    eventId,
    sessionId: input.sessionId ?? null,
    source: input.source,
  });
}

declare global {
  interface Window {
    twq?: (...args: unknown[]) => void;
    lintrk?: (...args: unknown[]) => void;
  }
}
