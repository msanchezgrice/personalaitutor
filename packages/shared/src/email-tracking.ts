import type { LifecycleEmailKey } from "./lifecycle-email";

export const LIFECYCLE_EMAIL_UTM_SOURCE = "lifecycle_email";
export const LIFECYCLE_EMAIL_UTM_MEDIUM = "email";

export type LifecycleEmailTrackingInput = {
  url: string;
  campaignKey: LifecycleEmailKey;
  deliveryId: string;
  cta: string;
};

export type LifecycleEmailTrackingParams = {
  emailDeliveryId: string | null;
  emailCampaignKey: string | null;
  emailCta: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  linkHost: string | null;
  linkPath: string | null;
};

function cleanText(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

export function appendLifecycleEmailTracking(input: LifecycleEmailTrackingInput) {
  try {
    const url = new URL(input.url);
    url.searchParams.set("utm_source", LIFECYCLE_EMAIL_UTM_SOURCE);
    url.searchParams.set("utm_medium", LIFECYCLE_EMAIL_UTM_MEDIUM);
    url.searchParams.set("utm_campaign", input.campaignKey);
    url.searchParams.set("utm_content", input.cta);
    url.searchParams.set("email_delivery_id", input.deliveryId);
    url.searchParams.set("email_campaign_key", input.campaignKey);
    url.searchParams.set("email_cta", input.cta);
    return url.toString();
  } catch {
    return input.url;
  }
}

export function readLifecycleEmailTracking(urlValue: string | null | undefined): LifecycleEmailTrackingParams {
  const raw = cleanText(urlValue);
  if (!raw) {
    return {
      emailDeliveryId: null,
      emailCampaignKey: null,
      emailCta: null,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmContent: null,
      linkHost: null,
      linkPath: null,
    };
  }

  try {
    const url = new URL(raw);
    return {
      emailDeliveryId: cleanText(url.searchParams.get("email_delivery_id")),
      emailCampaignKey: cleanText(url.searchParams.get("email_campaign_key")),
      emailCta: cleanText(url.searchParams.get("email_cta")),
      utmSource: cleanText(url.searchParams.get("utm_source")),
      utmMedium: cleanText(url.searchParams.get("utm_medium")),
      utmCampaign: cleanText(url.searchParams.get("utm_campaign")),
      utmContent: cleanText(url.searchParams.get("utm_content")),
      linkHost: cleanText(url.host),
      linkPath: cleanText(url.pathname),
    };
  } catch {
    return {
      emailDeliveryId: null,
      emailCampaignKey: null,
      emailCta: null,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmContent: null,
      linkHost: null,
      linkPath: null,
    };
  }
}
