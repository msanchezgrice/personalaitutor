// Shared Google tag helpers. No "use client" directive: the module is plain
// utilities (window access is guarded), and the server layout imports
// buildGoogleTagInitScript to render the gtag bootstrap inline.

function cleanText(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function googleAdsTagId() {
  return cleanText(process.env.NEXT_PUBLIC_GOOGLE_ADS_ID) ?? cleanText(process.env.NEXT_PUBLIC_GOOGLE_ADS_TAG_ID);
}

function browserGtag() {
  if (typeof window === "undefined" || typeof window.gtag !== "function") {
    return null;
  }
  return window.gtag;
}

export function buildGoogleAdsSendTo(label: string | null | undefined) {
  const tagId = googleAdsTagId();
  const cleanLabel = cleanText(label);
  if (!tagId || !cleanLabel) return null;
  return `${tagId}/${cleanLabel}`;
}

/**
 * Inline bootstrap for the Google tag (gtag.js). Configures every provided
 * destination — the GT container (if any), the Google Ads tag (AW-…), and the
 * GA4 measurement id (G-…) — so Ads conversion tracking and GA4 both fire
 * from the single gtag.js loader in the app layout.
 */
export function buildGoogleTagInitScript(input: {
  bootstrapId?: string | null;
  adsId?: string | null;
  gaMeasurementId?: string | null;
}) {
  const configIds = [
    cleanText(input.bootstrapId),
    cleanText(input.adsId),
    cleanText(input.gaMeasurementId),
  ].filter((value, index, all): value is string => Boolean(value) && all.indexOf(value) === index);
  if (!configIds.length) return "";

  const configLines = configIds
    .map((id) => `gtag('config', ${JSON.stringify(id)});`)
    .join("\n");

  return `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = window.gtag || gtag;
gtag('js', new Date());
${configLines}
`;
}

export function trackGoogleAdsConversion(
  label: string | null | undefined,
  input?: {
    value?: number;
    currency?: string;
    transactionId?: string | null;
  },
) {
  const gtag = browserGtag();
  const sendTo = buildGoogleAdsSendTo(label);
  if (!gtag || !sendTo) return false;

  const payload: Record<string, unknown> = {
    send_to: sendTo,
  };

  if (typeof input?.value === "number" && Number.isFinite(input.value)) {
    payload.value = input.value;
    // Currency is only meaningful alongside a billed value: a value-less
    // conversion (e.g. free-trial start) must not claim a currency either.
    if (cleanText(input?.currency)) {
      payload.currency = cleanText(input?.currency);
    }
  }
  if (cleanText(input?.transactionId)) {
    payload.transaction_id = cleanText(input?.transactionId);
  }

  try {
    gtag("event", "conversion", payload);
    return true;
  } catch {
    return false;
  }
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}
