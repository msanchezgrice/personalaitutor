import type { NextRequest } from "next/server";

export const ATTRIBUTION_STORAGE_KEY = "ai_tutor_attribution_v1";
export const ATTRIBUTION_COOKIE_KEY = "ai_tutor_attribution_v1";

const ATTRIBUTION_QUERY_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
  "twclid",
  "li_fat_id",
  "gclid",
  "msclkid",
] as const;

type AttributionQueryKey = (typeof ATTRIBUTION_QUERY_KEYS)[number];

export type AcquisitionAttribution = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  fbclid?: string;
  twclid?: string;
  liFatId?: string;
  gclid?: string;
  msclkid?: string;
  referrer?: string;
  landingPath?: string;
  capturedAt?: string;
};

export type AttributionEnvelope = {
  first?: AcquisitionAttribution;
  last?: AcquisitionAttribution;
};

function cleanString(value: unknown, maxLen = 300) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;
  return normalized.slice(0, maxLen);
}

function hasAttributionSignal(input: AcquisitionAttribution) {
  return Boolean(
    input.utmSource ||
      input.utmMedium ||
      input.utmCampaign ||
      input.utmContent ||
      input.utmTerm ||
      input.fbclid ||
      input.twclid ||
      input.liFatId ||
      input.gclid ||
      input.msclkid,
  );
}

export function sanitizeAttribution(input: Partial<AcquisitionAttribution> | null | undefined) {
  if (!input || typeof input !== "object") return null;

  const sanitized: AcquisitionAttribution = {
    utmSource: cleanString(input.utmSource),
    utmMedium: cleanString(input.utmMedium),
    utmCampaign: cleanString(input.utmCampaign),
    utmContent: cleanString(input.utmContent),
    utmTerm: cleanString(input.utmTerm),
    fbclid: cleanString(input.fbclid, 200),
    twclid: cleanString(input.twclid, 200),
    liFatId: cleanString(input.liFatId, 200),
    gclid: cleanString(input.gclid, 200),
    msclkid: cleanString(input.msclkid, 200),
    referrer: cleanString(input.referrer, 500),
    landingPath: cleanString(input.landingPath, 300),
    capturedAt: cleanString(input.capturedAt, 40),
  };

  if (!hasAttributionSignal(sanitized) && !sanitized.referrer) return null;
  return sanitized;
}

function normalizeSearchValue(params: URLSearchParams, key: AttributionQueryKey) {
  return cleanString(params.get(key), 300);
}

function fromSearchParams(params: URLSearchParams, fallbackPath?: string | null): AcquisitionAttribution | null {
  const raw: AcquisitionAttribution = {
    utmSource: normalizeSearchValue(params, "utm_source"),
    utmMedium: normalizeSearchValue(params, "utm_medium"),
    utmCampaign: normalizeSearchValue(params, "utm_campaign"),
    utmContent: normalizeSearchValue(params, "utm_content"),
    utmTerm: normalizeSearchValue(params, "utm_term"),
    fbclid: normalizeSearchValue(params, "fbclid"),
    twclid: normalizeSearchValue(params, "twclid"),
    liFatId: normalizeSearchValue(params, "li_fat_id"),
    gclid: normalizeSearchValue(params, "gclid"),
    msclkid: normalizeSearchValue(params, "msclkid"),
    landingPath: cleanString(fallbackPath, 300),
    capturedAt: new Date().toISOString(),
  };

  return sanitizeAttribution(raw);
}

function readAttributionCookie(req: NextRequest) {
  const raw = req.cookies.get(ATTRIBUTION_COOKIE_KEY)?.value;
  if (!raw) return null;

  try {
    const decoded = decodeURIComponent(raw);
    const parsed = JSON.parse(decoded) as AttributionEnvelope;
    const first = sanitizeAttribution(parsed?.first ?? null);
    const last = sanitizeAttribution(parsed?.last ?? null);
    if (!first && !last) return null;
    return { first: first ?? undefined, last: last ?? undefined };
  } catch {
    return null;
  }
}

export function toAttributionCookieValue(envelope: AttributionEnvelope) {
  const next: AttributionEnvelope = {
    first: sanitizeAttribution(envelope.first ?? null) ?? undefined,
    last: sanitizeAttribution(envelope.last ?? null) ?? undefined,
  };
  return encodeURIComponent(JSON.stringify(next));
}

export function extractAttributionFromRequest(req: NextRequest) {
  const fromQuery = fromSearchParams(req.nextUrl.searchParams, req.nextUrl.pathname);
  const cookie = readAttributionCookie(req);

  const fallbackReferrer = cleanString(req.headers.get("referer"), 500);
  const incomingLast = sanitizeAttribution({
    ...(cookie?.last ?? {}),
    ...(fromQuery ?? {}),
    referrer: fromQuery?.referrer ?? cookie?.last?.referrer ?? fallbackReferrer,
    landingPath: fromQuery?.landingPath ?? cookie?.last?.landingPath ?? req.nextUrl.pathname,
    capturedAt: new Date().toISOString(),
  });

  const incomingFirst = sanitizeAttribution(cookie?.first ?? fromQuery ?? null);

  if (!incomingFirst && !incomingLast) return null;

  return {
    first: incomingFirst ?? undefined,
    last: incomingLast ?? undefined,
  } satisfies AttributionEnvelope;
}

export function mergeAttribution(
  base: AttributionEnvelope | null | undefined,
  incoming: AttributionEnvelope | null | undefined,
) {
  const safeBase = {
    first: sanitizeAttribution(base?.first ?? null) ?? undefined,
    last: sanitizeAttribution(base?.last ?? null) ?? undefined,
  } satisfies AttributionEnvelope;

  const safeIncoming = {
    first: sanitizeAttribution(incoming?.first ?? null) ?? undefined,
    last: sanitizeAttribution(incoming?.last ?? null) ?? undefined,
  } satisfies AttributionEnvelope;

  const mergedFirst = safeBase.first ?? safeIncoming.first;
  const mergedLast = safeIncoming.last ?? safeBase.last;

  if (!mergedFirst && !mergedLast) return null;

  return {
    first: mergedFirst,
    last: mergedLast,
  } satisfies AttributionEnvelope;
}

export const attributionCaptureScript = `
(function () {
  var STORAGE_KEY = ${JSON.stringify(ATTRIBUTION_STORAGE_KEY)};
  var COOKIE_KEY = ${JSON.stringify(ATTRIBUTION_COOKIE_KEY)};
  var COOKIE_TTL_SECONDS = 60 * 60 * 24 * 30;

  function clean(value, maxLen) {
    if (typeof value !== "string") return undefined;
    var trimmed = value.trim();
    if (!trimmed) return undefined;
    return trimmed.slice(0, maxLen || 300);
  }

  function readStorage() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function writeStorage(value) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      return;
    }
  }

  function writeCookie(value) {
    try {
      var encoded = encodeURIComponent(JSON.stringify(value));
      var cookie = COOKIE_KEY + "=" + encoded + "; Max-Age=" + String(COOKIE_TTL_SECONDS) + "; Path=/; SameSite=Lax";
      if (window.location && window.location.protocol === "https:") {
        cookie += "; Secure";
      }
      document.cookie = cookie;
    } catch {
      return;
    }
  }

  var params = new URLSearchParams(window.location.search || "");
  var current = {
    utmSource: clean(params.get("utm_source")),
    utmMedium: clean(params.get("utm_medium")),
    utmCampaign: clean(params.get("utm_campaign")),
    utmContent: clean(params.get("utm_content")),
    utmTerm: clean(params.get("utm_term")),
    fbclid: clean(params.get("fbclid"), 200),
    twclid: clean(params.get("twclid"), 200),
    liFatId: clean(params.get("li_fat_id"), 200),
    gclid: clean(params.get("gclid"), 200),
    msclkid: clean(params.get("msclkid"), 200),
    landingPath: clean(window.location.pathname, 300),
    referrer: clean(document.referrer, 500),
    capturedAt: new Date().toISOString(),
  };

  var hasSignal = Boolean(
    current.utmSource ||
    current.utmMedium ||
    current.utmCampaign ||
    current.utmContent ||
    current.utmTerm ||
    current.fbclid ||
    current.twclid ||
    current.liFatId ||
    current.gclid ||
    current.msclkid,
  );

  if (!hasSignal && !current.referrer) return;

  var existing = readStorage() || {};
  var envelope = {
    first: existing.first || current,
    last: Object.assign({}, existing.last || {}, current),
  };

  writeStorage(envelope);
  writeCookie(envelope);
})();
`;

export function readClientAttributionEnvelope() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AttributionEnvelope;
    const first = sanitizeAttribution(parsed?.first ?? null);
    const last = sanitizeAttribution(parsed?.last ?? null);
    if (!first && !last) return null;
    return {
      first: first ?? undefined,
      last: last ?? undefined,
    } satisfies AttributionEnvelope;
  } catch {
    return null;
  }
}
