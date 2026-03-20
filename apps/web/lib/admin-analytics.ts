import type { PersistedFunnelEventRecord } from "@/lib/funnel-events";
import {
  type AdminAnalyticsWindow,
  resolveAdminAnalyticsWindow,
  windowStartForAnalytics,
} from "@/lib/funnel-events";

export { resolveAdminAnalyticsWindow };
export type { AdminAnalyticsWindow };

export type AdminAnalyticsBreakdownRow = {
  key: string;
  label: string;
  landingViews: number;
  landingCtaClicks: number;
  signUpCompleted: number;
  onboardingViewed: number;
  assessmentCompleted: number;
  checkoutStarted: number;
  checkoutCompleted: number;
  guestLinked: number;
};

export type AdminAnalyticsOverviewTotals = {
  landingViews: number;
  landingCtaClicks: number;
  signUpCompleted: number;
  onboardingViewed: number;
  assessmentCompleted: number;
  checkoutStarted: number;
  checkoutCompleted: number;
  guestLinked: number;
};

export type AdminAnalyticsExactFunnelTotals = {
  landingViews: number;
  landingCtaClicks: number;
  signUpCompleted: number;
  onboardingViewed: number;
  assessmentCompleted: number;
  checkoutStarted: number;
  checkoutCompleted: number;
  guestLinked: number;
  landingToCtaRate: number;
  ctaToSignupRate: number;
  signupToOnboardingRate: number;
  onboardingToAssessmentRate: number;
  assessmentToCheckoutStartedRate: number;
  checkoutStartedToCompletedRate: number;
};

export type AdminAnalyticsAttributionCoverage = {
  eventsWithUtmSource: number;
  eventsWithUtmCampaign: number;
  eventsWithLandingPath: number;
  signUpsWithUtmSource: number;
  checkoutsWithUtmSource: number;
};

export type AdminAnalyticsTrackedSteps = {
  signUpPageViewed: number;
  signInCompleted: number;
  assessmentStarted: number;
  onboardingCompleted: number;
  projectCreated: number;
};

export type AdminAnalyticsReport = {
  window: AdminAnalyticsWindow;
  overviewTotals: AdminAnalyticsOverviewTotals;
  exactFunnelTotals: AdminAnalyticsExactFunnelTotals;
  trackedSteps: AdminAnalyticsTrackedSteps;
  attributionCoverage: AdminAnalyticsAttributionCoverage;
  sourceBreakdown: AdminAnalyticsBreakdownRow[];
  campaignBreakdown: AdminAnalyticsBreakdownRow[];
  landingPathBreakdown: AdminAnalyticsBreakdownRow[];
};

type BuildAdminAnalyticsReportInput = {
  events: PersistedFunnelEventRecord[];
  now?: string | Date;
  window: AdminAnalyticsWindow;
};

const PRIMARY_FUNNEL_STEP_KEYS = [
  "landing_page_viewed",
  "landing_cta_clicked",
  "auth_sign_up_completed",
  "onboarding_viewed",
  "assessment_completed",
  "billing_checkout_started",
  "billing_checkout_completed",
  "guest_session_claimed",
] as const;

const TRACKED_STEP_KEYS = [
  "landing_page_viewed",
  "landing_cta_clicked",
  "auth_sign_up_page_viewed",
  "auth_sign_up_completed",
  "auth_sign_in_completed",
  "onboarding_viewed",
  "assessment_started",
  "assessment_completed",
  "onboarding_completed",
  "billing_checkout_started",
  "billing_checkout_completed",
  "project_created",
  "guest_session_claimed",
] as const;

function roundRate(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

function createBreakdownRow(key: string, label: string): AdminAnalyticsBreakdownRow {
  return {
    key,
    label,
    landingViews: 0,
    landingCtaClicks: 0,
    signUpCompleted: 0,
    onboardingViewed: 0,
    assessmentCompleted: 0,
    checkoutStarted: 0,
    checkoutCompleted: 0,
    guestLinked: 0,
  };
}

function actorKey(
  event: PersistedFunnelEventRecord,
  aliasByProfile: Map<string, string>,
  aliasByAuth: Map<string, string>,
) {
  if (event.visitorId) return event.visitorId;
  if (event.learnerProfileId && aliasByProfile.has(event.learnerProfileId)) {
    return aliasByProfile.get(event.learnerProfileId)!;
  }
  if (event.authUserId && aliasByAuth.has(event.authUserId)) {
    return aliasByAuth.get(event.authUserId)!;
  }
  return (
    event.learnerProfileId ||
    event.authUserId ||
    event.visitorId ||
    event.eventId ||
    `${event.eventKey}:${event.occurredAt}`
  );
}

function incrementRowCount(
  row: AdminAnalyticsBreakdownRow,
  eventKey: string,
) {
  switch (eventKey) {
    case "landing_page_viewed":
      row.landingViews += 1;
      return;
    case "landing_cta_clicked":
      row.landingCtaClicks += 1;
      return;
    case "auth_sign_up_completed":
      row.signUpCompleted += 1;
      return;
    case "onboarding_viewed":
      row.onboardingViewed += 1;
      return;
    case "assessment_completed":
      row.assessmentCompleted += 1;
      return;
    case "billing_checkout_started":
      row.checkoutStarted += 1;
      return;
    case "billing_checkout_completed":
      row.checkoutCompleted += 1;
      return;
    case "guest_session_claimed":
      row.guestLinked += 1;
      return;
    default:
      return;
  }
}

function pushBreakdownCount(
  rowsByKey: Map<string, AdminAnalyticsBreakdownRow>,
  dedupe: Set<string>,
  segmentKey: string,
  eventKey: string,
  actor: string,
) {
  const safeKey = segmentKey || "unknown";
  const dedupeKey = `${safeKey}:${eventKey}:${actor}`;
  if (dedupe.has(dedupeKey)) return;
  dedupe.add(dedupeKey);

  const row = rowsByKey.get(safeKey) ?? createBreakdownRow(safeKey, safeKey);
  incrementRowCount(row, eventKey);
  rowsByKey.set(safeKey, row);
}

export function createEmptyAdminAnalyticsReport(window: AdminAnalyticsWindow): AdminAnalyticsReport {
  return {
    window,
    overviewTotals: {
      landingViews: 0,
      landingCtaClicks: 0,
      signUpCompleted: 0,
      onboardingViewed: 0,
      assessmentCompleted: 0,
      checkoutStarted: 0,
      checkoutCompleted: 0,
      guestLinked: 0,
    },
    exactFunnelTotals: {
      landingViews: 0,
      landingCtaClicks: 0,
      signUpCompleted: 0,
      onboardingViewed: 0,
      assessmentCompleted: 0,
      checkoutStarted: 0,
      checkoutCompleted: 0,
      guestLinked: 0,
      landingToCtaRate: 0,
      ctaToSignupRate: 0,
      signupToOnboardingRate: 0,
      onboardingToAssessmentRate: 0,
      assessmentToCheckoutStartedRate: 0,
      checkoutStartedToCompletedRate: 0,
    },
    trackedSteps: {
      signUpPageViewed: 0,
      signInCompleted: 0,
      assessmentStarted: 0,
      onboardingCompleted: 0,
      projectCreated: 0,
    },
    attributionCoverage: {
      eventsWithUtmSource: 0,
      eventsWithUtmCampaign: 0,
      eventsWithLandingPath: 0,
      signUpsWithUtmSource: 0,
      checkoutsWithUtmSource: 0,
    },
    sourceBreakdown: [],
    campaignBreakdown: [],
    landingPathBreakdown: [],
  };
}

export function buildAdminAnalyticsReportFromEvents(
  input: BuildAdminAnalyticsReportInput,
): AdminAnalyticsReport {
  const start = windowStartForAnalytics(input.window, input.now ?? new Date());
  const trackedEvents = input.events.filter((event) => {
    if (!TRACKED_STEP_KEYS.includes(event.eventKey as (typeof TRACKED_STEP_KEYS)[number])) {
      return false;
    }
    if (!start) return true;
    return event.occurredAt >= start;
  });

  const emptyReport = createEmptyAdminAnalyticsReport(input.window);
  if (!trackedEvents.length) {
    return emptyReport;
  }

  const aliasByProfile = new Map<string, string>();
  const aliasByAuth = new Map<string, string>();

  for (const event of trackedEvents) {
    if (event.visitorId && event.learnerProfileId) {
      aliasByProfile.set(event.learnerProfileId, event.visitorId);
    }
    if (event.visitorId && event.authUserId) {
      aliasByAuth.set(event.authUserId, event.visitorId);
    }
  }

  const uniqueByEvent = new Map<string, Set<string>>();
  const trackedUniqueByEvent = new Map<string, Set<string>>();
  const sourceRows = new Map<string, AdminAnalyticsBreakdownRow>();
  const campaignRows = new Map<string, AdminAnalyticsBreakdownRow>();
  const landingRows = new Map<string, AdminAnalyticsBreakdownRow>();
  const sourceDedupe = new Set<string>();
  const campaignDedupe = new Set<string>();
  const landingDedupe = new Set<string>();

  let eventsWithUtmSource = 0;
  let eventsWithUtmCampaign = 0;
  let eventsWithLandingPath = 0;
  let signUpsWithUtmSource = 0;
  let checkoutsWithUtmSource = 0;

  for (const event of trackedEvents) {
    const actor = actorKey(event, aliasByProfile, aliasByAuth);
    const trackedEventSet = trackedUniqueByEvent.get(event.eventKey) ?? new Set<string>();
    trackedEventSet.add(actor);
    trackedUniqueByEvent.set(event.eventKey, trackedEventSet);

    if (event.utmSource) eventsWithUtmSource += 1;
    if (event.utmCampaign) eventsWithUtmCampaign += 1;
    if (event.landingPath) eventsWithLandingPath += 1;
    if (event.eventKey === "auth_sign_up_completed" && event.utmSource) signUpsWithUtmSource += 1;
    if (
      (event.eventKey === "billing_checkout_started" || event.eventKey === "billing_checkout_completed") &&
      event.utmSource
    ) {
      checkoutsWithUtmSource += 1;
    }

    if (!PRIMARY_FUNNEL_STEP_KEYS.includes(event.eventKey as (typeof PRIMARY_FUNNEL_STEP_KEYS)[number])) {
      continue;
    }

    const eventSet = uniqueByEvent.get(event.eventKey) ?? new Set<string>();
    eventSet.add(actor);
    uniqueByEvent.set(event.eventKey, eventSet);

    pushBreakdownCount(sourceRows, sourceDedupe, event.utmSource || "unknown", event.eventKey, actor);
    pushBreakdownCount(campaignRows, campaignDedupe, event.utmCampaign || "unknown", event.eventKey, actor);
    pushBreakdownCount(landingRows, landingDedupe, event.landingPath || "unknown", event.eventKey, actor);
  }

  const landingViews = uniqueByEvent.get("landing_page_viewed")?.size ?? 0;
  const landingCtaClicks = uniqueByEvent.get("landing_cta_clicked")?.size ?? 0;
  const signUpCompleted = uniqueByEvent.get("auth_sign_up_completed")?.size ?? 0;
  const onboardingViewed = uniqueByEvent.get("onboarding_viewed")?.size ?? 0;
  const assessmentCompleted = uniqueByEvent.get("assessment_completed")?.size ?? 0;
  const checkoutStarted = uniqueByEvent.get("billing_checkout_started")?.size ?? 0;
  const checkoutCompleted = uniqueByEvent.get("billing_checkout_completed")?.size ?? 0;
  const guestLinked = uniqueByEvent.get("guest_session_claimed")?.size ?? 0;

  const sortRows = (rows: Map<string, AdminAnalyticsBreakdownRow>) =>
    Array.from(rows.values()).sort((left, right) => {
      const totalDelta =
        right.checkoutCompleted -
        left.checkoutCompleted ||
        right.signUpCompleted -
          left.signUpCompleted ||
        right.landingViews -
          left.landingViews;
      if (totalDelta !== 0) return totalDelta;
      return left.label.localeCompare(right.label);
    });

  return {
    window: input.window,
    overviewTotals: {
      landingViews,
      landingCtaClicks,
      signUpCompleted,
      onboardingViewed,
      assessmentCompleted,
      checkoutStarted,
      checkoutCompleted,
      guestLinked,
    },
    exactFunnelTotals: {
      landingViews,
      landingCtaClicks,
      signUpCompleted,
      onboardingViewed,
      assessmentCompleted,
      checkoutStarted,
      checkoutCompleted,
      guestLinked,
      landingToCtaRate: roundRate(landingCtaClicks, landingViews),
      ctaToSignupRate: roundRate(signUpCompleted, landingCtaClicks),
      signupToOnboardingRate: roundRate(onboardingViewed, signUpCompleted),
      onboardingToAssessmentRate: roundRate(assessmentCompleted, onboardingViewed),
      assessmentToCheckoutStartedRate: roundRate(checkoutStarted, assessmentCompleted),
      checkoutStartedToCompletedRate: roundRate(checkoutCompleted, checkoutStarted),
    },
    trackedSteps: {
      signUpPageViewed: trackedUniqueByEvent.get("auth_sign_up_page_viewed")?.size ?? 0,
      signInCompleted: trackedUniqueByEvent.get("auth_sign_in_completed")?.size ?? 0,
      assessmentStarted: trackedUniqueByEvent.get("assessment_started")?.size ?? 0,
      onboardingCompleted: trackedUniqueByEvent.get("onboarding_completed")?.size ?? 0,
      projectCreated: trackedUniqueByEvent.get("project_created")?.size ?? 0,
    },
    attributionCoverage: {
      eventsWithUtmSource,
      eventsWithUtmCampaign,
      eventsWithLandingPath,
      signUpsWithUtmSource,
      checkoutsWithUtmSource,
    },
    sourceBreakdown: sortRows(sourceRows),
    campaignBreakdown: sortRows(campaignRows),
    landingPathBreakdown: sortRows(landingRows),
  };
}

type StoredFunnelEventRow = {
  id: string;
  event_id: string | null;
  event_key: string;
  occurred_at: string;
  visitor_id: string | null;
  auth_user_id: string | null;
  learner_profile_id: string | null;
  onboarding_session_id: string | null;
  project_id: string | null;
  funnel: string | null;
  step: string | null;
  path: string | null;
  page_url: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  first_utm_source: string | null;
  first_utm_medium: string | null;
  first_utm_campaign: string | null;
  first_utm_content: string | null;
  first_utm_term: string | null;
  landing_path: string | null;
  first_landing_path: string | null;
  referrer: string | null;
  first_referrer: string | null;
  paid_source: string | null;
  properties: Record<string, unknown> | null;
};

export async function getAdminAnalyticsReport(
  window: AdminAnalyticsWindow,
): Promise<AdminAnalyticsReport> {
  const { getSupabaseAdminClient } = await import("@/lib/supabase-admin");
  const supabase = getSupabaseAdminClient();
  const start = windowStartForAnalytics(window, new Date());
  let query = supabase
    .from("learner_funnel_events")
    .select(
      "id,event_id,event_key,occurred_at,visitor_id,auth_user_id,learner_profile_id,onboarding_session_id,project_id,funnel,step,path,page_url,utm_source,utm_medium,utm_campaign,utm_content,utm_term,first_utm_source,first_utm_medium,first_utm_campaign,first_utm_content,first_utm_term,landing_path,first_landing_path,referrer,first_referrer,paid_source,properties",
    )
    .order("occurred_at", { ascending: false })
    .limit(window === "all" ? 5000 : 2500);

  if (start) {
    query = query.gte("occurred_at", start);
  }

  const { data } = await query;
  const events = ((data ?? []) as StoredFunnelEventRow[]).map((row) => ({
    id: row.id,
    eventId: row.event_id,
    eventKey: row.event_key,
    occurredAt: row.occurred_at,
    visitorId: row.visitor_id,
    authUserId: row.auth_user_id,
    learnerProfileId: row.learner_profile_id,
    onboardingSessionId: row.onboarding_session_id,
    projectId: row.project_id,
    funnel: row.funnel,
    step: row.step,
    path: row.path,
    pageUrl: row.page_url,
    utmSource: row.utm_source,
    utmMedium: row.utm_medium,
    utmCampaign: row.utm_campaign,
    utmContent: row.utm_content,
    utmTerm: row.utm_term,
    firstUtmSource: row.first_utm_source,
    firstUtmMedium: row.first_utm_medium,
    firstUtmCampaign: row.first_utm_campaign,
    firstUtmContent: row.first_utm_content,
    firstUtmTerm: row.first_utm_term,
    landingPath: row.landing_path,
    firstLandingPath: row.first_landing_path,
    referrer: row.referrer,
    firstReferrer: row.first_referrer,
    paidSource: row.paid_source,
    properties: row.properties ?? {},
  })) satisfies PersistedFunnelEventRecord[];

  return buildAdminAnalyticsReportFromEvents({
    events,
    window,
  });
}
