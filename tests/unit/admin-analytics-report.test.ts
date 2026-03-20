import { createElement } from "react";
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server.node.js";
import { describe, expect, test } from "vitest";
import {
  buildAdminAnalyticsReportFromEvents,
  createEmptyAdminAnalyticsReport,
} from "@/lib/admin-analytics";
import { AdminAnalyticsPageView } from "@/components/admin-analytics-page-view";

describe("admin analytics report", () => {
  test("renders an empty-state analytics report", () => {
    const html = renderToStaticMarkup(
      createElement(AdminAnalyticsPageView, {
        report: createEmptyAdminAnalyticsReport("30d"),
        activeWindow: "30d",
      }),
    );

    expect(html).toContain("Overview");
    expect(html).toContain("Exact funnel");
    expect(html).toContain("Attribution coverage");
    expect(html).toContain("Tracked steps");
    expect(html).toContain("No rows in this window.");
    expect(html).toContain("Landing views");
    expect(html).toContain("Checkout completed");
    expect(html).toContain("Guest linked");
  });

  test("builds a linked funnel report with source attribution", () => {
    const report = buildAdminAnalyticsReportFromEvents({
      window: "30d",
      now: "2026-03-19T18:00:00.000Z",
      events: [
        {
          eventKey: "landing_page_viewed",
          occurredAt: "2026-03-18T12:00:00.000Z",
          visitorId: "visitor_1",
          utmSource: "facebook",
          utmCampaign: "spring_launch",
          landingPath: "/",
        },
        {
          eventKey: "landing_cta_clicked",
          occurredAt: "2026-03-18T12:01:00.000Z",
          visitorId: "visitor_1",
          utmSource: "facebook",
          utmCampaign: "spring_launch",
          landingPath: "/",
        },
        {
          eventKey: "auth_sign_up_page_viewed",
          occurredAt: "2026-03-18T12:02:00.000Z",
          visitorId: "visitor_1",
          utmSource: "facebook",
          utmCampaign: "spring_launch",
          landingPath: "/sign-up",
        },
        {
          eventKey: "auth_sign_up_completed",
          occurredAt: "2026-03-18T12:03:00.000Z",
          visitorId: "visitor_1",
          authUserId: "user_ext_1",
          learnerProfileId: "profile_1",
          utmSource: "facebook",
          utmCampaign: "spring_launch",
          landingPath: "/",
        },
        {
          eventKey: "onboarding_viewed",
          occurredAt: "2026-03-18T12:04:00.000Z",
          visitorId: "visitor_1",
          authUserId: "user_ext_1",
          learnerProfileId: "profile_1",
          onboardingSessionId: "session_1",
          utmSource: "facebook",
          utmCampaign: "spring_launch",
          landingPath: "/onboarding",
        },
        {
          eventKey: "assessment_started",
          occurredAt: "2026-03-18T12:09:00.000Z",
          visitorId: "visitor_1",
          authUserId: "user_ext_1",
          learnerProfileId: "profile_1",
          onboardingSessionId: "session_1",
          utmSource: "facebook",
          utmCampaign: "spring_launch",
          landingPath: "/onboarding",
        },
        {
          eventKey: "assessment_completed",
          occurredAt: "2026-03-18T12:10:00.000Z",
          visitorId: "visitor_1",
          authUserId: "user_ext_1",
          learnerProfileId: "profile_1",
          onboardingSessionId: "session_1",
          utmSource: "facebook",
          utmCampaign: "spring_launch",
          landingPath: "/onboarding",
        },
        {
          eventKey: "onboarding_completed",
          occurredAt: "2026-03-18T12:11:00.000Z",
          visitorId: "visitor_1",
          authUserId: "user_ext_1",
          learnerProfileId: "profile_1",
          onboardingSessionId: "session_1",
          utmSource: "facebook",
          utmCampaign: "spring_launch",
          landingPath: "/onboarding",
        },
        {
          eventKey: "billing_checkout_started",
          occurredAt: "2026-03-18T12:12:00.000Z",
          visitorId: "visitor_1",
          authUserId: "user_ext_1",
          learnerProfileId: "profile_1",
          utmSource: "facebook",
          utmCampaign: "spring_launch",
          landingPath: "/dashboard",
        },
        {
          eventKey: "billing_checkout_completed",
          occurredAt: "2026-03-18T12:20:00.000Z",
          visitorId: "visitor_1",
          authUserId: "user_ext_1",
          learnerProfileId: "profile_1",
          utmSource: "facebook",
          utmCampaign: "spring_launch",
          landingPath: "/dashboard",
        },
        {
          eventKey: "project_created",
          occurredAt: "2026-03-18T12:30:00.000Z",
          visitorId: "visitor_1",
          authUserId: "user_ext_1",
          learnerProfileId: "profile_1",
          projectId: "project_1",
          utmSource: "facebook",
          utmCampaign: "spring_launch",
          landingPath: "/dashboard",
        },
        {
          eventKey: "guest_session_claimed",
          occurredAt: "2026-03-18T12:05:00.000Z",
          visitorId: "visitor_1",
          authUserId: "user_ext_1",
          learnerProfileId: "profile_1",
          onboardingSessionId: "session_1",
          utmSource: "facebook",
          utmCampaign: "spring_launch",
          landingPath: "/onboarding",
        },
        {
          eventKey: "landing_page_viewed",
          occurredAt: "2026-03-18T13:00:00.000Z",
          visitorId: "visitor_2",
          utmSource: "google",
          utmCampaign: "brand_search",
          landingPath: "/",
        },
      ],
    });

    expect(report.overviewTotals.landingViews).toBe(2);
    expect(report.overviewTotals.signUpCompleted).toBe(1);
    expect(report.overviewTotals.checkoutCompleted).toBe(1);
    expect(report.overviewTotals.guestLinked).toBe(1);
    expect(report.exactFunnelTotals.landingToCtaRate).toBe(50);
    expect(report.exactFunnelTotals.checkoutStartedToCompletedRate).toBe(100);
    expect(report.trackedSteps.signUpPageViewed).toBe(1);
    expect(report.trackedSteps.assessmentStarted).toBe(1);
    expect(report.trackedSteps.onboardingCompleted).toBe(1);
    expect(report.trackedSteps.projectCreated).toBe(1);
    expect(report.attributionCoverage.eventsWithUtmSource).toBe(13);
    expect(report.sourceBreakdown[0]).toMatchObject({
      key: "facebook",
      landingViews: 1,
      signUpCompleted: 1,
      checkoutCompleted: 1,
      guestLinked: 1,
    });
  });
});
