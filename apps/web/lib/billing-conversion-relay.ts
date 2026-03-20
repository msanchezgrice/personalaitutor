import "server-only";

import { createHash } from "node:crypto";
import Stripe from "stripe";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { recordPersistedFunnelEvent } from "@/lib/funnel-events-server";
import { getSiteUrl } from "@/lib/site";

type RelayResult = {
  provider: "meta" | "google";
  delivered: boolean;
  status?: number;
  reason?: string;
};

type AcquisitionPoint = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  referrer?: string;
  landingPath?: string;
  gclid?: string;
  msclkid?: string;
};

type RelayInput = {
  userId: string;
  profile: {
    id: string;
    contactEmail?: string | null;
    acquisition?: {
      first?: AcquisitionPoint;
      last?: AcquisitionPoint;
    };
  };
  invoice: Stripe.Invoice;
  subscription?: Stripe.Subscription | null;
};

const FIRST_PAID_INVOICE_EVENT_KEY = "billing_first_paid_invoice";

function cleanText(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function uppercaseCurrency(value: string | null | undefined) {
  return cleanText(value)?.toUpperCase() ?? "USD";
}

function invoiceAmountPaid(invoice: Stripe.Invoice) {
  const amountPaid = Number(invoice.amount_paid ?? 0);
  if (!Number.isFinite(amountPaid) || amountPaid <= 0) return 0;
  return amountPaid / 100;
}

function invoiceOccurredAt(invoice: Stripe.Invoice) {
  const paidAt = Number(invoice.status_transitions?.paid_at ?? 0);
  if (Number.isFinite(paidAt) && paidAt > 0) {
    return new Date(paidAt * 1000).toISOString();
  }

  const created = Number(invoice.created ?? 0);
  if (Number.isFinite(created) && created > 0) {
    return new Date(created * 1000).toISOString();
  }

  return new Date().toISOString();
}

function invoiceSubscriptionRef(invoice: Stripe.Invoice) {
  return invoice.parent?.subscription_details?.subscription ?? null;
}

function invoiceSubscriptionId(invoice: Stripe.Invoice, subscription?: Stripe.Subscription | null) {
  const ref = invoiceSubscriptionRef(invoice);
  if (typeof ref === "string") {
    return cleanText(ref);
  }
  if (ref && typeof ref === "object" && typeof ref.id === "string") {
    return cleanText(ref.id);
  }
  if (subscription?.id) {
    return cleanText(subscription.id);
  }
  return null;
}

function isEligibleFirstPaidInvoice(invoice: Stripe.Invoice) {
  const amountPaid = Number(invoice.amount_paid ?? 0);
  return Boolean(
    (invoice.status === "paid" || Number(invoice.status_transitions?.paid_at ?? 0) > 0) &&
      Number.isFinite(amountPaid) &&
      amountPaid > 0,
  );
}

function normalizePaidSource(input: RelayInput["profile"]["acquisition"]) {
  const last = input?.last;
  const source = cleanText(last?.utmSource)?.toLowerCase() ?? "";

  if (source.includes("linkedin")) return "linkedin";
  if (source === "x" || source.includes("twitter")) return "x";
  if (source.includes("facebook") || source.includes("instagram") || source.includes("meta")) return "facebook";
  if (source.includes("google") || last?.gclid) return "google";
  if (source.includes("bing") || last?.msclkid) return "bing";
  return "unknown";
}

function sha256(value: string | null | undefined) {
  const normalized = cleanText(value)?.toLowerCase();
  if (!normalized) return null;
  return createHash("sha256").update(normalized).digest("hex");
}

async function hasRecordedFirstPaidInvoice(profileId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("learner_funnel_events")
    .select("id")
    .eq("learner_profile_id", profileId)
    .eq("event_key", FIRST_PAID_INVOICE_EVENT_KEY)
    .limit(1);

  if (error) {
    throw new Error(`FIRST_PAID_INVOICE_LOOKUP_FAILED:${error.message}`);
  }

  return Boolean(data?.length);
}

async function relayMetaFirstPaidInvoice(input: RelayInput): Promise<RelayResult> {
  const pixelId = process.env.META_PIXEL_ID?.trim() || process.env.NEXT_PUBLIC_FB_PIXEL_ID?.trim();
  const token = process.env.META_CONVERSIONS_ACCESS_TOKEN?.trim();
  if (!pixelId || !token) {
    return { provider: "meta", delivered: false, reason: "MISSING_CONFIG" };
  }

  const value = invoiceAmountPaid(input.invoice);
  const occurredAt = Math.floor(new Date(invoiceOccurredAt(input.invoice)).getTime() / 1000);
  const body = {
    data: [
      {
        event_name: "Purchase",
        event_time: occurredAt,
        action_source: "website",
        event_id: `invoice_paid_${input.invoice.id}`,
        event_source_url: `${getSiteUrl()}/dashboard?billing=invoice_paid`,
        custom_data: {
          value,
          currency: uppercaseCurrency(input.invoice.currency),
          order_id: input.invoice.id,
          invoice_id: input.invoice.id,
          billing_reason: cleanText(input.invoice.billing_reason),
          stripe_subscription_id: invoiceSubscriptionId(input.invoice, input.subscription) ?? undefined,
        },
        user_data: {
          em: sha256(input.profile.contactEmail ?? null) ?? undefined,
          external_id: sha256(input.profile.id) ?? undefined,
        },
      },
    ],
  };

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  return {
    provider: "meta",
    delivered: res.ok,
    status: res.status,
    reason: res.ok ? undefined : "META_RELAY_FAILED",
  };
}

function normalizeGoogleAdsCustomerId(value: string | null | undefined) {
  const digits = String(value || "").replace(/\D+/g, "");
  return digits || null;
}

function formatGoogleAdsDateTime(isoString: string) {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteMinutes = Math.abs(offsetMinutes);
  const offsetHours = String(Math.floor(absoluteMinutes / 60)).padStart(2, "0");
  const offsetRemainderMinutes = String(absoluteMinutes % 60).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}${sign}${offsetHours}:${offsetRemainderMinutes}`;
}

async function relayGoogleFirstPaidInvoice(input: RelayInput): Promise<RelayResult> {
  const customerId = normalizeGoogleAdsCustomerId(process.env.GOOGLE_ADS_CUSTOMER_ID);
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN?.trim();
  const loginCustomerId = normalizeGoogleAdsCustomerId(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);
  const conversionAction = process.env.GOOGLE_ADS_INVOICE_PAID_CONVERSION_ACTION?.trim();
  const apiVersion = process.env.GOOGLE_ADS_API_VERSION?.trim() || "v22";
  const gclid =
    cleanText(input.profile.acquisition?.last?.gclid) ??
    cleanText(input.profile.acquisition?.first?.gclid);

  if (!customerId || !developerToken || !clientId || !clientSecret || !refreshToken || !conversionAction) {
    return { provider: "google", delivered: false, reason: "MISSING_CONFIG" };
  }

  if (!gclid) {
    return { provider: "google", delivered: false, reason: "MISSING_CLICK_ID" };
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!tokenRes.ok) {
    return {
      provider: "google",
      delivered: false,
      status: tokenRes.status,
      reason: "GOOGLE_TOKEN_FAILED",
    };
  }

  const tokenPayload = await tokenRes.json().catch(() => null) as { access_token?: string } | null;
  const accessToken = cleanText(tokenPayload?.access_token);
  if (!accessToken) {
    return {
      provider: "google",
      delivered: false,
      reason: "GOOGLE_TOKEN_MISSING",
    };
  }

  const occurredAt = invoiceOccurredAt(input.invoice);
  const value = invoiceAmountPaid(input.invoice);
  const uploadRes = await fetch(
    `https://googleads.googleapis.com/${encodeURIComponent(apiVersion)}/customers/${encodeURIComponent(customerId)}:uploadClickConversions`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
        "developer-token": developerToken,
        ...(loginCustomerId ? { "login-customer-id": loginCustomerId } : {}),
      },
      body: JSON.stringify({
        conversions: [
          {
            conversionAction: conversionAction,
            gclid,
            conversionDateTime: formatGoogleAdsDateTime(occurredAt),
            conversionValue: value,
            currencyCode: uppercaseCurrency(input.invoice.currency),
            orderId: input.invoice.id,
          },
        ],
        partialFailure: false,
        validateOnly: false,
      }),
    },
  );

  return {
    provider: "google",
    delivered: uploadRes.ok,
    status: uploadRes.status,
    reason: uploadRes.ok ? undefined : "GOOGLE_RELAY_FAILED",
  };
}

export async function relayFirstPaidInvoiceConversion(input: RelayInput) {
  if (!isEligibleFirstPaidInvoice(input.invoice)) {
    return {
      skipped: true as const,
      reason: "INVOICE_NOT_ELIGIBLE",
    };
  }

  if (await hasRecordedFirstPaidInvoice(input.profile.id)) {
    return {
      skipped: true as const,
      reason: "FIRST_PAID_INVOICE_ALREADY_RECORDED",
    };
  }

  const first = input.profile.acquisition?.first;
  const last = input.profile.acquisition?.last;
  const occurredAt = invoiceOccurredAt(input.invoice);
  const amountPaid = invoiceAmountPaid(input.invoice);
  const currency = uppercaseCurrency(input.invoice.currency);
  const subscriptionId = invoiceSubscriptionId(input.invoice, input.subscription);

  await recordPersistedFunnelEvent({
    eventKey: FIRST_PAID_INVOICE_EVENT_KEY,
    eventId: input.invoice.id,
    occurredAt,
    authUserId: input.userId === input.profile.id ? null : input.userId,
    learnerProfileId: input.profile.id,
    utmSource: last?.utmSource ?? first?.utmSource ?? null,
    utmMedium: last?.utmMedium ?? first?.utmMedium ?? null,
    utmCampaign: last?.utmCampaign ?? first?.utmCampaign ?? null,
    utmContent: last?.utmContent ?? first?.utmContent ?? null,
    utmTerm: last?.utmTerm ?? first?.utmTerm ?? null,
    firstUtmSource: first?.utmSource ?? null,
    firstUtmMedium: first?.utmMedium ?? null,
    firstUtmCampaign: first?.utmCampaign ?? null,
    firstUtmContent: first?.utmContent ?? null,
    firstUtmTerm: first?.utmTerm ?? null,
    landingPath: last?.landingPath ?? first?.landingPath ?? null,
    firstLandingPath: first?.landingPath ?? null,
    referrer: last?.referrer ?? first?.referrer ?? null,
    firstReferrer: first?.referrer ?? null,
    paidSource: normalizePaidSource(input.profile.acquisition),
    properties: {
      invoice_id: input.invoice.id,
      stripe_subscription_id: subscriptionId,
      amount_paid: amountPaid,
      currency,
      billing_reason: cleanText(input.invoice.billing_reason),
    },
  });

  const [meta, google] = await Promise.all([
    relayMetaFirstPaidInvoice(input),
    relayGoogleFirstPaidInvoice(input),
  ]);

  return {
    skipped: false as const,
    relays: [meta, google],
  };
}
