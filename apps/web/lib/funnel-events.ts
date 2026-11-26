export const ADMIN_ANALYTICS_WINDOWS = ["1d", "7d", "30d", "90d", "all"] as const;

export type AdminAnalyticsWindow = (typeof ADMIN_ANALYTICS_WINDOWS)[number];

/**
 * Career Map + Proof Studio funnel (2026-11-25). Names are fixed by the plan;
 * client code sends them with captureAnalyticsEvent and they are persisted
 * like the other steps above.
 */
export const CAREER_MAP_FUNNEL_EVENTS = [
  "career_map_started",
  "career_map_completed",
  "career_map_failed",
  "career_map_viewed",
  "career_map_email_captured",
  "career_map_signup_clicked",
  "proof_site_published",
  "voice_model_tuned",
  "voice_model_published",
  "voice_model_public_run",
  "build_log_published",
  "remapped_route_viewed",
] as const;

export type CareerMapFunnelEventKey = (typeof CAREER_MAP_FUNNEL_EVENTS)[number];

export const CLIENT_PERSISTED_FUNNEL_EVENTS = new Set([
  "landing_page_viewed",
  "landing_cta_clicked",
  "auth_sign_up_page_viewed",
  "auth_sign_up_completed",
  "auth_sign_in_completed",
  "onboarding_viewed",
  "onboarding_assessment_funnel_step",
  "onboarding_continue_to_dashboard",
  "assessment_started",
  "assessment_completed",
  "onboarding_completed",
  "anonymous_assessment_started",
  "anonymous_assessment_completed",
  "assessment_email_captured",
  "assessment_report_viewed",
  "billing_hard_gate_viewed",
  "dashboard_signed_in_landed",
  "career_map_started",
  "career_map_completed",
  "career_map_failed",
  "career_map_viewed",
  "career_map_email_captured",
  "career_map_signup_clicked",
  "proof_site_published",
  "voice_model_tuned",
  "voice_model_published",
  "voice_model_public_run",
  "build_log_published",
  "remapped_route_viewed",
] as const);

export type PersistedFunnelEventKey =
  | "landing_page_viewed"
  | "landing_cta_clicked"
  | "auth_sign_up_page_viewed"
  | "auth_sign_up_completed"
  | "auth_sign_in_completed"
  | "onboarding_viewed"
  | "onboarding_assessment_funnel_step"
  | "onboarding_continue_to_dashboard"
  | "assessment_started"
  | "assessment_completed"
  | "onboarding_completed"
  | "anonymous_assessment_started"
  | "anonymous_assessment_completed"
  | "assessment_email_captured"
  | "assessment_report_viewed"
  | "billing_hard_gate_viewed"
  | "dashboard_signed_in_landed"
  | "billing_checkout_started"
  | "billing_checkout_completed"
  | "billing_first_paid_invoice"
  | "project_created"
  | "guest_session_claimed"
  | "career_map_started"
  | "career_map_completed"
  | "career_map_failed"
  | "career_map_viewed"
  | "career_map_email_captured"
  | "career_map_signup_clicked"
  | "proof_site_published"
  | "voice_model_tuned"
  | "voice_model_published"
  | "voice_model_public_run"
  | "build_log_published"
  | "remapped_route_viewed";

export type PersistedFunnelEventRecord = {
  id?: string;
  eventKey: PersistedFunnelEventKey | string;
  eventId?: string | null;
  occurredAt: string;
  visitorId?: string | null;
  authUserId?: string | null;
  learnerProfileId?: string | null;
  onboardingSessionId?: string | null;
  projectId?: string | null;
  funnel?: string | null;
  step?: string | null;
  path?: string | null;
  pageUrl?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  firstUtmSource?: string | null;
  firstUtmMedium?: string | null;
  firstUtmCampaign?: string | null;
  firstUtmContent?: string | null;
  firstUtmTerm?: string | null;
  landingPath?: string | null;
  firstLandingPath?: string | null;
  referrer?: string | null;
  firstReferrer?: string | null;
  paidSource?: string | null;
  properties?: Record<string, unknown>;
};

export function shouldPersistClientFunnelEvent(event: string): event is PersistedFunnelEventKey {
  return CLIENT_PERSISTED_FUNNEL_EVENTS.has(event as never);
}

export function resolveAdminAnalyticsWindow(value: string | null | undefined): AdminAnalyticsWindow {
  if (!value) return "30d";
  return ADMIN_ANALYTICS_WINDOWS.includes(value as AdminAnalyticsWindow)
    ? (value as AdminAnalyticsWindow)
    : "30d";
}

export function windowStartForAnalytics(
  window: AdminAnalyticsWindow,
  now: string | Date = new Date(),
) {
  if (window === "all") return null;
  const date = typeof now === "string" ? new Date(now) : new Date(now);
  const next = new Date(date);
  const days =
    window === "1d" ? 1 : window === "7d" ? 7 : window === "30d" ? 30 : 90;
  next.setUTCDate(next.getUTCDate() - days);
  return next.toISOString();
}
