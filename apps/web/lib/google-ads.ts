"use client";

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
  }
  if (cleanText(input?.currency)) {
    payload.currency = cleanText(input?.currency);
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
