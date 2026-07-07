import "server-only";

import { randomUUID } from "node:crypto";
import { EMAIL_PRODUCT_NAME } from "@aitutor/shared";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Web-side campaign email plumbing (rebuild Phase 3.4/3.5) for the cron-driven
 * sweeps (weekly proof-of-watch, winbacks). Mirrors the worker's Resend +
 * `learner_email_deliveries` machinery so both writers share one idempotency
 * ledger: one delivery row per (learner, campaign_key), checked before send
 * and enforced by a partial unique index in the Phase 3 migration.
 */

export function campaignFromAddress() {
  const configured = process.env.RESEND_FROM_EMAIL?.trim();
  if (configured) return configured;
  return `${EMAIL_PRODUCT_NAME} <onboarding@resend.dev>`;
}

export type SendEmailResult =
  | { ok: true; messageId: string | null }
  | { ok: false; errorCode: string; detail?: string | null };

export async function sendCampaignEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, errorCode: "RESEND_API_KEY_MISSING" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: campaignFromAddress(),
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => null);
      return { ok: false, errorCode: `RESEND_RESPONSE_${response.status}`, detail: detail?.slice(0, 200) ?? null };
    }
    const payload = (await response.json().catch(() => null)) as { id?: string } | null;
    return { ok: true, messageId: payload?.id ?? null };
  } catch (error) {
    return {
      ok: false,
      errorCode: "RESEND_REQUEST_FAILED",
      detail: error instanceof Error ? error.message.slice(0, 200) : null,
    };
  }
}

export type ActiveSubscriber = {
  learnerProfileId: string;
  externalUserId: string | null;
  name: string;
  email: string;
  careerPathId: string | null;
};

/**
 * Active (trialing/active) subscribers with a contact email — the audience
 * for paid-tier sweeps (daily re-scoring, weekly proof-of-watch).
 */
export async function listActiveSubscribers(limit: number): Promise<ActiveSubscriber[]> {
  const supabase = getSupabaseAdminClient();
  const { data: subscriptions } = await supabase
    .from("billing_subscriptions")
    .select("learner_profile_id,status")
    .in("status", ["trialing", "active"])
    .limit(limit);

  const profileIds = ((subscriptions ?? []) as Array<{ learner_profile_id: string }>).map(
    (row) => row.learner_profile_id,
  );
  if (!profileIds.length) return [];

  const { data: profiles } = await supabase
    .from("learner_profiles")
    .select("id,external_user_id,full_name,contact_email,career_path_id")
    .in("id", profileIds)
    .not("contact_email", "is", null);

  return ((profiles ?? []) as Array<{
    id: string;
    external_user_id: string | null;
    full_name: string | null;
    contact_email: string | null;
    career_path_id: string | null;
  }>)
    .filter((row) => Boolean(row.contact_email?.trim()))
    .map((row) => ({
      learnerProfileId: row.id,
      externalUserId: row.external_user_id,
      name: row.full_name?.trim() || "there",
      email: row.contact_email!.trim(),
      careerPathId: row.career_path_id,
    }));
}

/** Campaign keys already recorded as sent for a learner. */
export async function sentCampaignKeysForUser(learnerProfileId: string): Promise<string[]> {
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("learner_email_deliveries")
    .select("campaign_key,status")
    .eq("learner_profile_id", learnerProfileId)
    .eq("status", "sent");
  return ((data ?? []) as Array<{ campaign_key: string }>).map((row) => row.campaign_key);
}

/**
 * Record a campaign delivery. Idempotent: one row per (learner, campaign_key)
 * for these campaigns — re-recording updates in place instead of duplicating.
 */
export async function recordCampaignDelivery(input: {
  learnerProfileId: string;
  externalUserId?: string | null;
  campaignKey: string;
  status: "sent" | "failed";
  recipientEmail: string;
  subject: string;
  providerMessageId?: string | null;
  emailSource: string;
  payload?: Record<string, unknown>;
  sentAt?: string | null;
}): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  const { data: existing } = await supabase
    .from("learner_email_deliveries")
    .select("id")
    .eq("learner_profile_id", input.learnerProfileId)
    .eq("campaign_key", input.campaignKey)
    .maybeSingle();

  const row = {
    id: (existing as { id: string } | null)?.id ?? randomUUID(),
    learner_profile_id: input.learnerProfileId,
    external_user_id: input.externalUserId ?? null,
    campaign_key: input.campaignKey,
    status: input.status,
    recipient_email: input.recipientEmail,
    subject: input.subject,
    provider: "resend",
    provider_message_id: input.providerMessageId ?? null,
    email_source: input.emailSource,
    email_medium: "email",
    email_campaign: input.campaignKey,
    payload: input.payload ?? {},
    sent_at: input.sentAt ?? null,
    updated_at: nowIso,
  };

  const { error } = await supabase.from("learner_email_deliveries").upsert(row, { onConflict: "id" });
  if (error) {
    throw new Error(`CAMPAIGN_DELIVERY_RECORD_FAILED:${error.message}`);
  }
}
