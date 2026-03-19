import "server-only";

import Stripe from "stripe";
import type { BillingSubscription } from "@aitutor/shared";
import {
  buildBillingSubscriptionRecord,
  buildCheckoutUrls,
  buildStripeCheckoutSessionParams,
  sanitizeDashboardReturnTo,
} from "@/lib/billing";
import {
  runtimeGetBillingSubscription,
  runtimeGetOrCreateProfile,
  runtimeUpsertBillingSubscription,
} from "@/lib/runtime";
import { getSiteUrl } from "@/lib/site";

const STRIPE_WEBHOOK_EVENTS = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.trial_will_end",
]);

let cachedStripe: Stripe | null = null;

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

export async function createStripeCheckoutSession(input: {
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

    return syncBillingFromCheckoutSession({
      userId,
      sessionId: session.id,
      lastWebhookEventId: event.id,
      lastWebhookReceivedAt: receivedAt,
    });
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

    return syncBillingFromStripeSubscription({
      userId,
      subscription,
      lastWebhookEventId: event.id,
      lastWebhookReceivedAt: receivedAt,
    });
  }

  return null;
}
