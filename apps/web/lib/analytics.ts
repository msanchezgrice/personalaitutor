import { readClientAttributionEnvelope, type AttributionEnvelope } from "@/lib/attribution";
import { shouldPersistClientFunnelEvent } from "@/lib/funnel-events";

type PosthogCaptureProperties = Record<string, unknown>;

type PosthogClient = {
  capture: (event: string, properties?: PosthogCaptureProperties) => void;
  identify?: (distinctId: string, properties?: PosthogCaptureProperties) => void;
  alias?: (alias: string, distinctId?: string) => void;
  setPersonProperties?: (properties: PosthogCaptureProperties) => void;
  reset?: () => void;
  get_distinct_id?: () => string;
};

type AnalyticsUser = {
  distinctId: string;
  email?: string | null;
  name?: string | null;
  handle?: string | null;
  careerPathId?: string | null;
  authProvider?: string | null;
  profileUserId?: string | null;
};

const FUNNEL_VISITOR_KEY = "ai_tutor_funnel_visitor_v1";

function browserLocation() {
  if (typeof window === "undefined") return null;
  return window.location;
}

function readStorageValue(key: string) {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorageValue(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    return;
  }
}

function posthogClient(): PosthogClient | null {
  if (typeof window === "undefined") return null;
  const candidate = (window as typeof window & { posthog?: PosthogClient }).posthog;
  if (!candidate || typeof candidate.capture !== "function") return null;
  return candidate;
}

function cleanText(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

export function isMetaAttributionSource(value: string | null | undefined) {
  const source = cleanText(value)?.toLowerCase() ?? "";
  if (!source) return false;

  return (
    source === "fb" ||
    source === "ig" ||
    source === "an" ||
    source.includes("facebook") ||
    source.includes("meta") ||
    source.includes("instagram")
  );
}

function eventAttributionProps(attribution: AttributionEnvelope | null | undefined) {
  const first = attribution?.first;
  const last = attribution?.last;

  return {
    utm_source: last?.utmSource ?? null,
    utm_medium: last?.utmMedium ?? null,
    utm_campaign: last?.utmCampaign ?? null,
    utm_content: last?.utmContent ?? null,
    utm_term: last?.utmTerm ?? null,
    fbclid: last?.fbclid ?? null,
    twclid: last?.twclid ?? null,
    li_fat_id: last?.liFatId ?? null,
    gclid: last?.gclid ?? null,
    msclkid: last?.msclkid ?? null,
    landing_path: last?.landingPath ?? null,
    referrer: last?.referrer ?? null,
    attribution_captured_at: last?.capturedAt ?? null,
    first_utm_source: first?.utmSource ?? null,
    first_utm_medium: first?.utmMedium ?? null,
    first_utm_campaign: first?.utmCampaign ?? null,
    first_utm_content: first?.utmContent ?? null,
    first_utm_term: first?.utmTerm ?? null,
    first_landing_path: first?.landingPath ?? null,
    first_referrer: first?.referrer ?? null,
    paid_source: normalizePaidSource(attribution),
  } satisfies PosthogCaptureProperties;
}

function personAttributionProps(attribution: AttributionEnvelope | null | undefined) {
  const first = attribution?.first;
  const last = attribution?.last;

  return {
    first_utm_source: first?.utmSource ?? null,
    first_utm_medium: first?.utmMedium ?? null,
    first_utm_campaign: first?.utmCampaign ?? null,
    first_utm_content: first?.utmContent ?? null,
    first_utm_term: first?.utmTerm ?? null,
    first_landing_path: first?.landingPath ?? null,
    first_referrer: first?.referrer ?? null,
    last_utm_source: last?.utmSource ?? null,
    last_utm_medium: last?.utmMedium ?? null,
    last_utm_campaign: last?.utmCampaign ?? null,
    last_utm_content: last?.utmContent ?? null,
    last_utm_term: last?.utmTerm ?? null,
    last_landing_path: last?.landingPath ?? null,
    last_referrer: last?.referrer ?? null,
    last_fbclid: last?.fbclid ?? null,
    last_twclid: last?.twclid ?? null,
    last_li_fat_id: last?.liFatId ?? null,
    last_gclid: last?.gclid ?? null,
    last_msclkid: last?.msclkid ?? null,
    paid_source: normalizePaidSource(attribution),
  } satisfies PosthogCaptureProperties;
}

export function normalizePaidSource(attribution: AttributionEnvelope | null | undefined) {
  const last = attribution?.last;
  const source = last?.utmSource?.toLowerCase() ?? "";

  if (source.includes("linkedin")) return "linkedin";
  if (source === "x" || source.includes("twitter")) return "x";
  if (isMetaAttributionSource(source)) {
    return "facebook";
  }
  if (source.includes("google") || last?.gclid) return "google";
  if (source.includes("bing") || last?.msclkid) return "bing";
  return "unknown";
}

export function getAnalyticsDistinctId() {
  const client = posthogClient();
  if (!client || typeof client.get_distinct_id !== "function") return null;

  try {
    return cleanText(client.get_distinct_id());
  } catch {
    return null;
  }
}

export function getOrCreateFunnelVisitorId() {
  const existing = cleanText(readStorageValue(FUNNEL_VISITOR_KEY));
  if (existing) return existing;

  const next = createAnalyticsEventId("visitor");
  writeStorageValue(FUNNEL_VISITOR_KEY, next);
  return next;
}

export function buildAnalyticsEventProps(properties?: PosthogCaptureProperties) {
  const attribution = readClientAttributionEnvelope();
  const location = browserLocation();

  return {
    app: "web",
    visitor_id: getOrCreateFunnelVisitorId(),
    path: location?.pathname ?? null,
    page_url: location?.href ?? null,
    posthog_distinct_id: getAnalyticsDistinctId(),
    ...eventAttributionProps(attribution),
    ...(properties ?? {}),
  } satisfies PosthogCaptureProperties;
}

function relayPersistedFunnelEvent(event: string, properties: PosthogCaptureProperties) {
  if (typeof window === "undefined" || !shouldPersistClientFunnelEvent(event)) return;

  const body = JSON.stringify({
    event,
    eventId: cleanText(String(properties.event_id ?? "")) ?? undefined,
    visitorId: getOrCreateFunnelVisitorId(),
    occurredAt: new Date().toISOString(),
    properties,
  });

  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/analytics/funnel", blob);
      return;
    }
  } catch {
    // Fallback to fetch below.
  }

  void fetch("/api/analytics/funnel", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    credentials: "same-origin",
    keepalive: true,
    body,
  }).catch(() => {
    // Non-blocking analytics path.
  });
}

export function captureAnalyticsEvent(event: string, properties?: PosthogCaptureProperties) {
  const client = posthogClient();
  const eventProps = buildAnalyticsEventProps(properties);
  relayPersistedFunnelEvent(event, eventProps);
  if (!client) return false;

  try {
    client.capture(event, eventProps);
    return true;
  } catch {
    return false;
  }
}

export function identifyAnalyticsUser(user: AnalyticsUser) {
  const client = posthogClient();
  if (!client || typeof client.identify !== "function") return false;

  const distinctId = cleanText(user.distinctId);
  if (!distinctId) return false;
  const anonymousDistinctId = getAnalyticsDistinctId();

  const attribution = readClientAttributionEnvelope();
  const personProps = {
    email: cleanText(user.email ?? null),
    name: cleanText(user.name ?? null),
    handle: cleanText(user.handle ?? null),
    career_path_id: cleanText(user.careerPathId ?? null),
    auth_provider: cleanText(user.authProvider ?? null),
    profile_user_id: cleanText(user.profileUserId ?? null),
    ...personAttributionProps(attribution),
  } satisfies PosthogCaptureProperties;

  try {
    if (
      anonymousDistinctId &&
      anonymousDistinctId !== distinctId &&
      typeof client.alias === "function"
    ) {
      client.alias(distinctId, anonymousDistinctId);
    }
    client.identify(distinctId, personProps);
    if (typeof client.setPersonProperties === "function") {
      client.setPersonProperties(personProps);
    }
    return true;
  } catch {
    return false;
  }
}

export function resetAnalytics() {
  const client = posthogClient();
  if (!client || typeof client.reset !== "function") return false;

  try {
    client.reset();
    return true;
  } catch {
    return false;
  }
}

export function createAnalyticsEventId(prefix: string) {
  const safePrefix = cleanText(prefix) ?? "event";

  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return `${safePrefix}_${window.crypto.randomUUID()}`;
  }

  return `${safePrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
