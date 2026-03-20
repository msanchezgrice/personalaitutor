import "server-only";

import { randomUUID } from "node:crypto";
import type { PersistedFunnelEventKey, PersistedFunnelEventRecord } from "@/lib/funnel-events";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function cleanText(value: unknown, maxLen = 500) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLen);
}

function cleanJsonRecord(value: Record<string, unknown> | undefined) {
  if (!value) return {};
  const entries = Object.entries(value).filter(([, entry]) => entry !== undefined);
  return Object.fromEntries(entries);
}

async function resolveLearnerProfileId(input: {
  learnerProfileId?: string | null;
  authUserId?: string | null;
  onboardingSessionId?: string | null;
  projectId?: string | null;
}) {
  const supabase = getSupabaseAdminClient();

  if (cleanText(input.learnerProfileId, 80)) {
    return cleanText(input.learnerProfileId, 80);
  }

  if (cleanText(input.authUserId, 160)) {
    const { data } = await supabase
      .from("learner_profiles")
      .select("id")
      .eq("external_user_id", input.authUserId)
      .maybeSingle();
    if (data?.id) return String(data.id);
  }

  if (cleanText(input.onboardingSessionId, 80)) {
    const { data } = await supabase
      .from("onboarding_sessions")
      .select("learner_profile_id")
      .eq("id", input.onboardingSessionId)
      .maybeSingle();
    if (data?.learner_profile_id) return String(data.learner_profile_id);
  }

  if (cleanText(input.projectId, 80)) {
    const { data } = await supabase
      .from("projects")
      .select("learner_profile_id")
      .eq("id", input.projectId)
      .maybeSingle();
    if (data?.learner_profile_id) return String(data.learner_profile_id);
  }

  return null;
}

export async function recordPersistedFunnelEvent(
  input: Omit<PersistedFunnelEventRecord, "learnerProfileId"> & {
    eventKey: PersistedFunnelEventKey;
    learnerProfileId?: string | null;
  },
) {
  try {
    const supabase = getSupabaseAdminClient();
    const learnerProfileId = await resolveLearnerProfileId({
      learnerProfileId: input.learnerProfileId,
      authUserId: input.authUserId,
      onboardingSessionId: input.onboardingSessionId,
      projectId: input.projectId,
    });

    await supabase.from("learner_funnel_events").insert({
      id: randomUUID(),
      event_id: cleanText(input.eventId, 160),
      event_key: input.eventKey,
      occurred_at: cleanText(input.occurredAt, 80) || new Date().toISOString(),
      visitor_id: cleanText(input.visitorId, 160),
      auth_user_id: cleanText(input.authUserId, 160),
      learner_profile_id: learnerProfileId,
      onboarding_session_id: cleanText(input.onboardingSessionId, 80),
      project_id: cleanText(input.projectId, 80),
      funnel: cleanText(input.funnel, 120),
      step: cleanText(input.step, 120),
      path: cleanText(input.path, 240),
      page_url: cleanText(input.pageUrl, 1200),
      utm_source: cleanText(input.utmSource, 240),
      utm_medium: cleanText(input.utmMedium, 240),
      utm_campaign: cleanText(input.utmCampaign, 240),
      utm_content: cleanText(input.utmContent, 240),
      utm_term: cleanText(input.utmTerm, 240),
      first_utm_source: cleanText(input.firstUtmSource, 240),
      first_utm_medium: cleanText(input.firstUtmMedium, 240),
      first_utm_campaign: cleanText(input.firstUtmCampaign, 240),
      first_utm_content: cleanText(input.firstUtmContent, 240),
      first_utm_term: cleanText(input.firstUtmTerm, 240),
      landing_path: cleanText(input.landingPath, 240),
      first_landing_path: cleanText(input.firstLandingPath, 240),
      referrer: cleanText(input.referrer, 1000),
      first_referrer: cleanText(input.firstReferrer, 1000),
      paid_source: cleanText(input.paidSource, 120),
      properties: cleanJsonRecord(input.properties),
    });
  } catch (error) {
    console.warn(
      "[analytics] persisted funnel event failed",
      error instanceof Error ? error.message : "unknown",
    );
  }
}
