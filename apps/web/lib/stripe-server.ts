import "server-only";

import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import {
  BILLING_CHECKOUT_REMINDER_KEYS,
  LIFECYCLE_EMAIL_UTM_MEDIUM,
  LIFECYCLE_EMAIL_UTM_SOURCE,
  buildBillingCheckoutReminderEmail,
  buildBillingCheckoutReminderResumeUrl,
  type BillingCheckoutReminderKey,
  type BillingSubscription,
} from "@aitutor/shared";
import {
  billingAccessAllowed,
  buildBillingSubscriptionRecord,
  buildCheckoutUrls,
  buildStripeCheckoutSessionParams,
  sanitizeDashboardReturnTo,
} from "@/lib/billing";
import {
  runtimeClaimStripeWebhookEvent,
  runtimeGetBillingSubscription,
  runtimeGetOrCreateProfile,
  runtimeMarkStripeWebhookEventProcessed,
  runtimeReleaseStripeWebhookEventClaim,
  runtimeUpsertBillingSubscription,
} from "@/lib/runtime";
import { relayFirstPaidInvoiceConversion } from "@/lib/billing-conversion-relay";
import { getSiteUrl } from "@/lib/site";

const STRIPE_WEBHOOK_EVENTS = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.trial_will_end",
  "invoice.paid",
  "invoice.payment_succeeded",
]);

let cachedStripe: Stripe | null = null;
let cachedSupabaseAdmin: SupabaseClient | null = null;

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name}_MISSING`);
  }
  return value;
}

export function getStripePriceId() {
  return requiredEnv("STRIPE_PRICE_ID");
}

export function getStripeWebhookSecret() {
  return requiredEnv("STRIPE_WEBHOOK_SECRET");
}

export function getStripeServerClient() {
  if (cachedStripe) return cachedStripe;
  cachedStripe = new Stripe(requiredEnv("STRIPE_SECRET_KEY"));
  return cachedStripe;
}

export function getStripeReturnBaseUrl() {
  return getSiteUrl();
}

function getSupabaseAdminOrNull() {
  if (cachedSupabaseAdmin) return cachedSupabaseAdmin;

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    return null;
  }

  cachedSupabaseAdmin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedSupabaseAdmin;
}

function normalizeCohortValue(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized || "unknown";
}

function cohortPaidSource(value: string | null | undefined, gclid?: string | null, msclkid?: string | null) {
  const source = normalizeCohortValue(value);
  if (source.includes("linkedin")) return "linkedin";
  if (source === "x" || source.includes("twitter")) return "x";
  if (source.includes("facebook") || source.includes("instagram") || source.includes("meta")) return "facebook";
  if ((gclid || "").trim() || source.includes("google")) return "google";
  if ((msclkid || "").trim() || source.includes("bing")) return "bing";
  return "unknown";
}

function cohortFields(profile: {
  acquisition?: {
    first?: {
      utmSource?: string;
      utmMedium?: string;
      utmCampaign?: string;
      gclid?: string;
      msclkid?: string;
    };
    last?: {
      utmSource?: string;
      utmMedium?: string;
      utmCampaign?: string;
      gclid?: string;
      msclkid?: string;
    };
  };
}) {
  const last = profile.acquisition?.last;
  const first = profile.acquisition?.first;
  const source = last?.utmSource ?? first?.utmSource ?? null;
  const medium = last?.utmMedium ?? first?.utmMedium ?? null;
  const campaign = last?.utmCampaign ?? first?.utmCampaign ?? null;
  const gclid = last?.gclid ?? first?.gclid ?? null;
  const msclkid = last?.msclkid ?? first?.msclkid ?? null;

  return {
    cohortSource: normalizeCohortValue(source),
    cohortMedium: normalizeCohortValue(medium),
    cohortCampaign: normalizeCohortValue(campaign),
    cohortPaidSource: cohortPaidSource(source, gclid, msclkid),
  };
}

async function cancelQueuedBillingReminderDeliveries(userId: string) {
  const supabase = getSupabaseAdminOrNull();
  if (!supabase) return;

  await supabase
    .from("learner_email_deliveries")
    .update({
      status: "skipped",
      updated_at: new Date().toISOString(),
    })
    .eq("learner_profile_id", userId)
    .in("campaign_key", [...BILLING_CHECKOUT_REMINDER_KEYS])
    .in("status", ["queued", "processing"]);
}

async function replaceQueuedBillingReminderDeliveries(input: {
  userId: string;
  learnerName?: string | null;
  recipientEmail: string;
  returnTo?: string | null;
  baseUrl: string;
  acquisition?: {
    first?: {
      utmSource?: string;
      utmMedium?: string;
      utmCampaign?: string;
      gclid?: string;
      msclkid?: string;
    };
    last?: {
      utmSource?: string;
      utmMedium?: string;
      utmCampaign?: string;
      gclid?: string;
      msclkid?: string;
    };
  };
}) {
  const supabase = getSupabaseAdminOrNull();
  if (!supabase) return;

  await cancelQueuedBillingReminderDeliveries(input.userId);

  const now = new Date().toISOString();
  const cohort = cohortFields({ acquisition: input.acquisition });
  const rows = BILLING_CHECKOUT_REMINDER_KEYS.map((campaignKey) => {
    const deliveryId = randomUUID();
    const ctaUrl = buildBillingCheckoutReminderResumeUrl({
      baseUrl: input.baseUrl,
      returnTo: input.returnTo,
      deliveryId,
      campaignKey,
    });
    const template = buildBillingCheckoutReminderEmail({
      campaignKey,
      learnerName: input.learnerName ?? null,
      resumeUrl: ctaUrl,
    });

    return {
      id: deliveryId,
      learner_profile_id: input.userId,
      external_user_id: null,
      campaign_key: campaignKey,
      status: "queued",
      recipient_email: input.recipientEmail,
      subject: template.subject,
      provider: "resend",
      provider_message_id: null,
      email_source: LIFECYCLE_EMAIL_UTM_SOURCE,
      email_medium: LIFECYCLE_EMAIL_UTM_MEDIUM,
      email_campaign: campaignKey,
      cohort_source: cohort.cohortSource,
      cohort_medium: cohort.cohortMedium,
      cohort_campaign: cohort.cohortCampaign,
      cohort_paid_source: cohort.cohortPaidSource,
      payload: {
        returnTo: sanitizeDashboardReturnTo(input.returnTo),
        previewText: template.previewText,
        ctaUrl,
      },
      sent_at: null,
      updated_at: now,
    };
  });

  const { error } = await supabase.from("learner_email_deliveries").insert(rows);
  if (error) {
    throw new Error(`BILLING_REMINDER_QUEUE_FAILED:${error.message}`);
  }
}

function resumedFromBillingReminder(input: {
  resumeEmailDeliveryId?: string | null;
  resumeEmailCampaignKey?: BillingCheckoutReminderKey | null;
}) {
  return Boolean(input.resumeEmailDeliveryId?.trim() && input.resumeEmailCampaignKey);
}

export async function createStripeCheckoutSession(input: {
  userId: string;
  name?: string;
  email?: string | null;
  avatarUrl?: string | null;
  handleBase?: string;
  returnTo?: string | null;
  resumeEmailDeliveryId?: string | null;
  resumeEmailCampaignKey?: BillingCheckoutReminderKey | null;
}) {
  const profile = await runtimeGetOrCreateProfile({
    userId: input.userId,
    name: input.name,
    email: input.email ?? null,
    avatarUrl: input.avatarUrl ?? null,
    handleBase: input.handleBase,
  });
  const billing = await runtimeGetBillingSubscription(profile.id);
  const customerId = profile.stripeCustomerId ?? billing?.stripeCustomerId ?? null;
  const urls = buildCheckoutUrls({
    appUrl: getStripeReturnBaseUrl(),
    returnTo: input.returnTo,
  });
  const stripe = getStripeServerClient();

  const session = await stripe.checkout.sessions.create(
    buildStripeCheckoutSessionParams({
      priceId: getStripePriceId(),
      successUrl: urls.successUrl,
      cancelUrl: urls.cancelUrl,
      customerId,
      customerEmail: profile.contactEmail ?? input.email ?? null,
      userId: profile.id,
      trialDays: 7,
    }),
  );

  if (!session.url) {
    throw new Error("STRIPE_CHECKOUT_URL_MISSING");
  }

  const recipientEmail = profile.contactEmail ?? input.email ?? null;
  if (recipientEmail?.trim() && !resumedFromBillingReminder(input)) {
    await replaceQueuedBillingReminderDeliveries({
      userId: profile.id,
      learnerName: profile.name,
      recipientEmail: recipientEmail.trim(),
      returnTo: input.returnTo,
      baseUrl: getStripeReturnBaseUrl(),
      acquisition: profile.acquisition,
    });
  }

  return {
    profile,
    session,
  };
}

export async function createStripePortalSession(input: {
  userId: string;
  name?: string;
  email?: string | null;
  avatarUrl?: string | null;
  handleBase?: string;
  returnTo?: string | null;
}) {
  const profile = await runtimeGetOrCreateProfile({
    userId: input.userId,
    name: input.name,
    email: input.email ?? null,
    avatarUrl: input.avatarUrl ?? null,
    handleBase: input.handleBase,
  });
  const billing = await runtimeGetBillingSubscription(profile.id);
  const customerId = profile.stripeCustomerId ?? billing?.stripeCustomerId ?? null;
  if (!customerId) {
    throw new Error("BILLING_CUSTOMER_NOT_FOUND");
  }

  const stripe = getStripeServerClient();
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${getStripeReturnBaseUrl()}${sanitizeDashboardReturnTo(input.returnTo)}`,
  });
}

async function resolveStripeSubscription(
  subscription: string | Stripe.Subscription | null | undefined,
): Promise<Stripe.Subscription> {
  if (subscription && typeof subscription !== "string") {
    return subscription;
  }
  if (!subscription) {
    throw new Error("STRIPE_SUBSCRIPTION_MISSING");
  }
  return getStripeServerClient().subscriptions.retrieve(subscription);
}

export async function syncBillingFromStripeSubscription(input: {
  userId: string;
  subscription: Stripe.Subscription;
  lastWebhookEventId?: string | null;
  lastWebhookReceivedAt?: string | null;
}) {
  const record = buildBillingSubscriptionRecord({
    userId: input.userId,
    lastWebhookEventId: input.lastWebhookEventId ?? null,
    lastWebhookReceivedAt: input.lastWebhookReceivedAt ?? null,
    subscription: input.subscription,
  });

  return runtimeUpsertBillingSubscription(record);
}

export async function syncBillingFromCheckoutSession(input: {
  userId: string;
  sessionId: string;
  lastWebhookEventId?: string | null;
  lastWebhookReceivedAt?: string | null;
}) {
  const stripe = getStripeServerClient();
  const session = await stripe.checkout.sessions.retrieve(input.sessionId, {
    expand: ["subscription"],
  });

  if (session.mode !== "subscription") {
    throw new Error("STRIPE_SESSION_NOT_SUBSCRIPTION");
  }

  const subscription = await resolveStripeSubscription(session.subscription);
  return syncBillingFromStripeSubscription({
    userId: input.userId,
    subscription,
    lastWebhookEventId: input.lastWebhookEventId ?? null,
    lastWebhookReceivedAt: input.lastWebhookReceivedAt ?? null,
  });
}

export function constructStripeWebhookEvent(body: string, signature: string) {
  return getStripeServerClient().webhooks.constructEvent(body, signature, getStripeWebhookSecret());
}

function subscriptionUserIdFromMetadata(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId?.trim();
  return userId || null;
}

async function withWebhookClaim<T>(input: {
  eventId: string;
  eventType: string;
  userId: string;
  receivedAt: string;
  run: () => Promise<T>;
}) {
  const claimed = await runtimeClaimStripeWebhookEvent({
    eventId: input.eventId,
    eventType: input.eventType,
    userId: input.userId,
  });
  if (!claimed) {
    return null;
  }

  try {
    const result = await input.run();
    await runtimeMarkStripeWebhookEventProcessed({
      eventId: input.eventId,
      userId: input.userId,
      processedAt: input.receivedAt,
    });
    return result;
  } catch (error) {
    await runtimeReleaseStripeWebhookEventClaim(input.eventId);
    throw error;
  }
}

export async function handleStripeWebhookEvent(event: Stripe.Event): Promise<BillingSubscription | null> {
  if (!STRIPE_WEBHOOK_EVENTS.has(event.type)) {
    return null;
  }

  const receivedAt = new Date().toISOString();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId?.trim();
    if (!userId || session.mode !== "subscription") {
      return null;
    }

    const subscription = await withWebhookClaim({
      eventId: event.id,
      eventType: event.type,
      userId,
      receivedAt,
      run: async () => {
        const synced = await syncBillingFromCheckoutSession({
          userId,
          sessionId: session.id,
          lastWebhookEventId: event.id,
          lastWebhookReceivedAt: receivedAt,
        });
        await cancelQueuedBillingReminderDeliveries(userId);
        return synced;
      },
    });
    return subscription;
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted" ||
    event.type === "customer.subscription.trial_will_end"
  ) {
    const subscription = event.data.object as Stripe.Subscription;
    const userId = subscriptionUserIdFromMetadata(subscription);
    if (!userId) {
      return null;
    }

    return withWebhookClaim({
      eventId: event.id,
      eventType: event.type,
      userId,
      receivedAt,
      run: async () => {
        const synced = await syncBillingFromStripeSubscription({
          userId,
          subscription,
          lastWebhookEventId: event.id,
          lastWebhookReceivedAt: receivedAt,
        });
        if (billingAccessAllowed(synced.status)) {
          await cancelQueuedBillingReminderDeliveries(userId);
        }
        return synced;
      },
    });
  }

  if (event.type === "invoice.paid" || event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as Stripe.Invoice;
    const invoiceSubscription = invoice.parent?.subscription_details?.subscription;
    if (!invoiceSubscription) {
      return null;
    }

    const subscription = await resolveStripeSubscription(invoiceSubscription);
    const userId = subscriptionUserIdFromMetadata(subscription);
    if (!userId) {
      return null;
    }

    return withWebhookClaim({
      eventId: event.id,
      eventType: event.type,
      userId,
      receivedAt,
      run: async () => {
        const synced = await syncBillingFromStripeSubscription({
          userId,
          subscription,
          lastWebhookEventId: event.id,
          lastWebhookReceivedAt: receivedAt,
        });
        if (billingAccessAllowed(synced.status)) {
          await cancelQueuedBillingReminderDeliveries(userId);
        }

        const profile = await runtimeGetOrCreateProfile({ userId });
        await relayFirstPaidInvoiceConversion({
          userId,
          profile,
          invoice,
          subscription,
        });

        return synced;
      },
    });
  }

  return null;
}
