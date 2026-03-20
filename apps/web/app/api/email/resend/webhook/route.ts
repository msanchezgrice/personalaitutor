import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  LIFECYCLE_EMAIL_UTM_MEDIUM,
  LIFECYCLE_EMAIL_UTM_SOURCE,
  capturePosthogServerEvent,
  jsonError,
  jsonOk,
  readLifecycleEmailTracking,
  type EmailCampaignKey,
} from "@aitutor/shared";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

type LifecycleEmailEventType =
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained"
  | "unsubscribed";

type EmailDeliveryRow = {
  id: string;
  learner_profile_id: string;
  external_user_id: string | null;
  campaign_key: EmailCampaignKey;
  recipient_email: string;
  provider: string | null;
  provider_message_id: string | null;
  email_source: string | null;
  email_medium: string | null;
  email_campaign: string | null;
  cohort_source: string | null;
  cohort_medium: string | null;
  cohort_campaign: string | null;
  cohort_paid_source: string | null;
};

const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

let cachedClient: SupabaseClient | null = null;

function cleanText(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function objectRecord(input: unknown) {
  return input && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : null;
}

function supabaseAdmin() {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_ENV_MISSING");
  }

  cachedClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}

function posthogCaptureHost() {
  return (process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://us.i.posthog.com").replace(/\/+$/, "");
}

function posthogProjectApiKey() {
  return process.env.POSTHOG_PROJECT_API_KEY?.trim() || process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() || "";
}

function lifecycleEmailEventName(eventType: LifecycleEmailEventType) {
  switch (eventType) {
    case "delivered":
      return "email_delivered";
    case "opened":
      return "email_opened";
    case "clicked":
      return "email_clicked";
    case "bounced":
      return "email_bounced";
    case "complained":
      return "email_complained";
    case "unsubscribed":
      return "email_unsubscribed";
  }
}

function normalizeWebhookEventType(raw: string | null | undefined): LifecycleEmailEventType | null {
  switch ((raw ?? "").toLowerCase()) {
    case "email.delivered":
      return "delivered";
    case "email.opened":
      return "opened";
    case "email.clicked":
      return "clicked";
    case "email.bounced":
      return "bounced";
    case "email.complained":
      return "complained";
    case "email.unsubscribed":
      return "unsubscribed";
    default:
      return null;
  }
}

function decodeWebhookSecret(secret: string) {
  const normalized = secret.replace(/^whsec_/, "");
  return Buffer.from(normalized, "base64");
}

function safeCompareSignature(expected: string, candidate: string) {
  const expectedBuffer = Buffer.from(expected);
  const candidateBuffer = Buffer.from(candidate);
  if (expectedBuffer.length !== candidateBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, candidateBuffer);
}

function verifyResendWebhookSignature(req: NextRequest, payload: string, secret: string) {
  const messageId =
    cleanText(req.headers.get("svix-id")) ||
    cleanText(req.headers.get("webhook-id"));
  const timestampValue =
    cleanText(req.headers.get("svix-timestamp")) ||
    cleanText(req.headers.get("webhook-timestamp"));
  const signatureHeader =
    cleanText(req.headers.get("svix-signature")) ||
    cleanText(req.headers.get("webhook-signature"));

  if (!messageId || !timestampValue || !signatureHeader) {
    throw new Error("WEBHOOK_HEADERS_MISSING");
  }

  const timestamp = Number.parseInt(timestampValue, 10);
  if (!Number.isFinite(timestamp)) {
    throw new Error("WEBHOOK_TIMESTAMP_INVALID");
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > WEBHOOK_TOLERANCE_SECONDS) {
    throw new Error("WEBHOOK_TIMESTAMP_OUT_OF_RANGE");
  }

  const computedSignature = createHmac("sha256", decodeWebhookSecret(secret))
    .update(`${messageId}.${timestamp}.${payload}`)
    .digest("base64");

  const signatures = signatureHeader
    .split(/\s+/)
    .flatMap((entry) => entry.split(","))
    .map((entry) => entry.trim())
    .filter((entry) => entry && entry !== "v1");

  const valid = signatures.some((entry) => safeCompareSignature(computedSignature, entry));
  if (!valid) {
    throw new Error("WEBHOOK_SIGNATURE_INVALID");
  }

  return messageId;
}

function normalizeTimestamp(input: unknown) {
  const value = cleanText(typeof input === "string" ? input : null);
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

function extractProviderMessageId(data: Record<string, unknown> | null) {
  return cleanText(
    typeof data?.email_id === "string"
      ? data.email_id
      : typeof data?.id === "string"
        ? data.id
        : null,
  );
}

function extractClickUrl(data: Record<string, unknown> | null) {
  const click = objectRecord(data?.click);
  const link = objectRecord(data?.link);
  return (
    cleanText(typeof click?.url === "string" ? click.url : null) ||
    cleanText(typeof link?.url === "string" ? link.url : null) ||
    cleanText(typeof data?.url === "string" ? data.url : null) ||
    cleanText(typeof data?.link === "string" ? data.link : null)
  );
}

async function findDeliveryByProviderMessageId(providerMessageId: string) {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("learner_email_deliveries")
    .select(
      "id,learner_profile_id,external_user_id,campaign_key,recipient_email,provider,provider_message_id,email_source,email_medium,email_campaign,cohort_source,cohort_medium,cohort_campaign,cohort_paid_source",
    )
    .eq("provider", "resend")
    .eq("provider_message_id", providerMessageId)
    .maybeSingle();

  if (error) throw error;
  return (data as EmailDeliveryRow | null) ?? null;
}

async function insertLifecycleEmailEvent(input: {
  delivery: EmailDeliveryRow;
  providerEventId: string;
  providerMessageId: string;
  eventType: LifecycleEmailEventType;
  eventAt: string;
  emailContent?: string | null;
  linkUrl?: string | null;
  linkHost?: string | null;
  linkPath?: string | null;
  payload: Record<string, unknown>;
}) {
  const supabase = supabaseAdmin();
  const { error } = await supabase.from("learner_email_events").insert({
    id: randomUUID(),
    delivery_id: input.delivery.id,
    learner_profile_id: input.delivery.learner_profile_id,
    external_user_id: input.delivery.external_user_id ?? null,
    provider: "resend",
    provider_message_id: input.providerMessageId,
    provider_event_id: input.providerEventId,
    campaign_key: input.delivery.campaign_key,
    event_type: input.eventType,
    event_at: input.eventAt,
    email_source: input.delivery.email_source ?? LIFECYCLE_EMAIL_UTM_SOURCE,
    email_medium: input.delivery.email_medium ?? LIFECYCLE_EMAIL_UTM_MEDIUM,
    email_campaign: input.delivery.email_campaign ?? input.delivery.campaign_key,
    email_content: input.emailContent ?? null,
    cohort_source: input.delivery.cohort_source ?? "unknown",
    cohort_medium: input.delivery.cohort_medium ?? "unknown",
    cohort_campaign: input.delivery.cohort_campaign ?? "unknown",
    cohort_paid_source: input.delivery.cohort_paid_source ?? "unknown",
    link_url: input.linkUrl ?? null,
    link_host: input.linkHost ?? null,
    link_path: input.linkPath ?? null,
    payload: input.payload,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    if (error.code === "23505") return false;
    throw error;
  }

  return true;
}

async function captureLifecycleEmailEventToPosthog(input: {
  delivery: EmailDeliveryRow;
  eventType: LifecycleEmailEventType;
  eventAt: string;
  providerEventId: string;
  providerMessageId: string;
  emailContent?: string | null;
  linkUrl?: string | null;
  linkHost?: string | null;
  linkPath?: string | null;
  payload?: Record<string, unknown>;
}) {
  const apiKey = posthogProjectApiKey();
  if (!apiKey) return false;

  const distinctId =
    cleanText(input.delivery.external_user_id) ||
    cleanText(input.delivery.recipient_email) ||
    input.delivery.learner_profile_id;

  const result = await capturePosthogServerEvent({
    apiKey,
    host: posthogCaptureHost(),
    event: lifecycleEmailEventName(input.eventType),
    distinctId,
    timestamp: input.eventAt,
    properties: {
      app: "email",
      channel: "email",
      event_source: "resend_webhook",
      learner_profile_id: input.delivery.learner_profile_id,
      recipient_email: input.delivery.recipient_email,
      email_delivery_id: input.delivery.id,
      email_campaign_key: input.delivery.campaign_key,
      lifecycle_delivery_id: input.delivery.id,
      lifecycle_campaign_key: input.delivery.campaign_key,
      email_provider: "resend",
      provider_event_id: input.providerEventId,
      provider_message_id: input.providerMessageId,
      utm_source: input.delivery.email_source ?? LIFECYCLE_EMAIL_UTM_SOURCE,
      utm_medium: input.delivery.email_medium ?? LIFECYCLE_EMAIL_UTM_MEDIUM,
      utm_campaign: input.delivery.email_campaign ?? input.delivery.campaign_key,
      utm_content: input.emailContent ?? null,
      cohort_source: input.delivery.cohort_source ?? "unknown",
      cohort_medium: input.delivery.cohort_medium ?? "unknown",
      cohort_campaign: input.delivery.cohort_campaign ?? "unknown",
      cohort_paid_source: input.delivery.cohort_paid_source ?? "unknown",
      link_url: input.linkUrl ?? null,
      link_host: input.linkHost ?? null,
      link_path: input.linkPath ?? null,
      ...(input.payload ?? {}),
    },
  });

  return result.ok;
}

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
    if (!secret) {
      return jsonError("RESEND_WEBHOOK_SECRET_MISSING", "Resend webhook secret is not configured", 503);
    }

    const rawBody = await req.text();
    let providerEventId = "";
    try {
      providerEventId = verifyResendWebhookSignature(req, rawBody, secret);
    } catch (error) {
      return jsonError("WEBHOOK_SIGNATURE_INVALID", "Webhook signature verification failed", 400, {
        reason: error instanceof Error ? error.message : "UNKNOWN",
      });
    }

    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      return jsonError("INVALID_BODY", "Webhook body is not valid JSON", 400);
    }

    const envelope = objectRecord(parsedBody);
    const eventType = normalizeWebhookEventType(cleanText(typeof envelope?.type === "string" ? envelope.type : null));
    if (!eventType) {
      return jsonOk({ received: true, ignored: true, reason: "UNSUPPORTED_EVENT" });
    }

    const data = objectRecord(envelope?.data);
    const providerMessageId = extractProviderMessageId(data);
    if (!providerMessageId) {
      return jsonOk({ received: true, ignored: true, reason: "MISSING_PROVIDER_MESSAGE_ID" });
    }

    const delivery = await findDeliveryByProviderMessageId(providerMessageId);
    if (!delivery) {
      return jsonOk({ received: true, ignored: true, reason: "DELIVERY_NOT_FOUND" });
    }

    const linkUrl = eventType === "clicked" ? extractClickUrl(data) : null;
    const tracking = readLifecycleEmailTracking(linkUrl);
    const eventAt = normalizeTimestamp(
      typeof data?.created_at === "string"
        ? data.created_at
        : typeof envelope?.created_at === "string"
          ? envelope.created_at
          : null,
    );
    const inserted = await insertLifecycleEmailEvent({
      delivery,
      providerEventId,
      providerMessageId,
      eventType,
      eventAt,
      emailContent: tracking.utmContent ?? tracking.emailCta,
      linkUrl,
      linkHost: tracking.linkHost,
      linkPath: tracking.linkPath,
      payload: {
        resend_event_type: envelope?.type ?? null,
        webhook_received_at: new Date().toISOString(),
        webhook_payload: envelope ?? {},
      },
    });

    if (inserted) {
      await captureLifecycleEmailEventToPosthog({
        delivery,
        eventType,
        eventAt,
        providerEventId,
        providerMessageId,
        emailContent: tracking.utmContent ?? tracking.emailCta,
        linkUrl,
        linkHost: tracking.linkHost,
        linkPath: tracking.linkPath,
        payload: {
          resend_event_type: envelope?.type ?? null,
        },
      });
    }

    return jsonOk({
      received: true,
      inserted,
      eventType,
      deliveryId: delivery.id,
      providerMessageId,
    });
  } catch (error) {
    return jsonError("RESEND_WEBHOOK_FAILED", "Failed to process Resend webhook", 500, {
      reason: error instanceof Error ? error.message : "UNKNOWN",
    });
  }
}
