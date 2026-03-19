import type { BillingSubscriptionStatus } from "@aitutor/shared";

export type NormalizedBillingStatus = BillingSubscriptionStatus;

const allowedStatuses = new Set<NormalizedBillingStatus>(["trialing", "active"]);
const knownStatuses = new Set<NormalizedBillingStatus>([
  "none",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "incomplete",
  "incomplete_expired",
  "paused",
]);

export function normalizeBillingStatus(status: string | null | undefined): NormalizedBillingStatus {
  const normalized = String(status || "").trim().toLowerCase();
  if (!normalized) return "none";
  return knownStatuses.has(normalized as NormalizedBillingStatus) ? (normalized as NormalizedBillingStatus) : "none";
}

export function billingAccessAllowed(status: string | null | undefined) {
  return allowedStatuses.has(normalizeBillingStatus(status));
}

export function buildBillingGateRedirect(pathnameWithSearch: string) {
  return `/dashboard?billing=required&return_to=${encodeURIComponent(sanitizeDashboardReturnTo(pathnameWithSearch))}`;
}

export function buildOnboardingReportReturnUrl(sessionId?: string | null) {
  const params = new URLSearchParams({ view: "report" });
  const normalizedSessionId = String(sessionId || "").trim();
  if (normalizedSessionId) {
    params.set("sessionId", normalizedSessionId);
  }
  return `/onboarding?${params.toString()}`;
}

export function shouldRedirectBlockedDashboardPath(pathname: string, status: string | null | undefined) {
  if (billingAccessAllowed(status)) return false;
  return pathname !== "/dashboard";
}

export function sanitizeDashboardReturnTo(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  if (!normalized.startsWith("/dashboard") || normalized.startsWith("//")) {
    return "/dashboard";
  }
  return normalized || "/dashboard";
}

export function buildCheckoutUrls(input: { appUrl: string; returnTo?: string | null }) {
  const base = input.appUrl.replace(/\/+$/, "");
  const returnTo = sanitizeDashboardReturnTo(input.returnTo);
  const encodedReturnTo = encodeURIComponent(returnTo);
  return {
    successUrl: `${base}/dashboard?billing=success&session_id={CHECKOUT_SESSION_ID}&return_to=${encodedReturnTo}`,
    cancelUrl: `${base}/dashboard?billing=canceled&return_to=${encodedReturnTo}`,
  };
}

export function buildStripeCheckoutSessionParams(input: {
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  customerId?: string | null;
  customerEmail?: string | null;
  userId: string;
  trialDays: number;
}) {
  return {
    mode: "subscription" as const,
    payment_method_collection: "always" as const,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    line_items: [{ price: input.priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: input.trialDays,
      metadata: {
        userId: input.userId,
      },
    },
    metadata: {
      userId: input.userId,
    },
    ...(input.customerId ? { customer: input.customerId } : {}),
    ...(!input.customerId && input.customerEmail ? { customer_email: input.customerEmail } : {}),
  };
}

export function stripeTimestampToIso(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return new Date(value * 1000).toISOString();
}

function stripeIdFromExpandable(value: string | { id?: string | null } | null | undefined) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof value.id === "string") return value.id;
  return null;
}

export function buildBillingSubscriptionRecord(input: {
  userId: string;
  lastWebhookEventId?: string | null;
  lastWebhookReceivedAt?: string | null;
  subscription: {
    id: string;
    customer: string | { id?: string | null } | null;
    status: string | null | undefined;
    cancel_at_period_end?: boolean | null;
    trial_end?: number | null;
    current_period_end?: number | null;
    items?: {
      data?: Array<{
        price?: {
          id?: string | null;
        } | null;
      }>;
    } | null;
  };
}) {
  return {
    userId: input.userId,
    stripeCustomerId: stripeIdFromExpandable(input.subscription.customer),
    stripeSubscriptionId: input.subscription.id,
    stripePriceId: input.subscription.items?.data?.[0]?.price?.id ?? "",
    status: normalizeBillingStatus(input.subscription.status),
    trialEndsAt: stripeTimestampToIso(input.subscription.trial_end),
    currentPeriodEndsAt: stripeTimestampToIso(input.subscription.current_period_end),
    cancelAtPeriodEnd: Boolean(input.subscription.cancel_at_period_end),
    lastWebhookEventId: input.lastWebhookEventId ?? null,
    lastWebhookReceivedAt: input.lastWebhookReceivedAt ?? null,
  };
}
