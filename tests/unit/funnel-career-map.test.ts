import { readFileSync } from "node:fs";
import path from "node:path";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server.node.js";
import { beforeEach, describe, expect, test, vi } from "vitest";

const { mockRecord, mockGetAuthSeed } = vi.hoisted(() => ({
  mockRecord: vi.fn(),
  mockGetAuthSeed: vi.fn(),
}));

class MockNextRequest extends Request {
  nextUrl: URL;

  constructor(input: string, init?: RequestInit) {
    super(input, init);
    this.nextUrl = new URL(input);
  }
}

vi.mock("next/server", () => ({ NextRequest: MockNextRequest }), { virtual: true });
vi.mock("@/lib/auth", () => ({ getAuthSeed: mockGetAuthSeed }));
vi.mock("@/lib/funnel-events-server", () => ({ recordPersistedFunnelEvent: mockRecord }));

import { CAREER_MAP_FUNNEL_EVENTS, CLIENT_PERSISTED_FUNNEL_EVENTS, type PersistedFunnelEventKey } from "@/lib/funnel-events";
import { buildAdminAnalyticsReportFromEvents, createEmptyAdminAnalyticsReport } from "@/lib/admin-analytics";
import { AdminAnalyticsPageView } from "@/components/admin-analytics-page-view";
import { POST as funnelPost } from "../../apps/web/app/api/analytics/funnel/route";
import { SignUpMapPanel, isSignUpFromMap } from "../../apps/web/app/sign-up/sign-up-map-panel";
import { BillingGateOverlay } from "../../apps/web/components/billing-gate-overlay";

(globalThis as { React?: typeof React }).React = React;

const read = (relative: string) => readFileSync(path.resolve(process.cwd(), relative), "utf8");

const PLAN_EVENTS = [
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

describe("career map funnel events", () => {
  test("every plan event is in the persisted Set and the exported list", () => {
    expect([...CAREER_MAP_FUNNEL_EVENTS]).toEqual([...PLAN_EVENTS]);
    for (const event of PLAN_EVENTS) {
      expect(CLIENT_PERSISTED_FUNNEL_EVENTS.has(event as never)).toBe(true);
    }
  });

  test("every plan event is part of the PersistedFunnelEventKey union", () => {
    // Tests are not typechecked, so also check the union in the source text.
    const keys: PersistedFunnelEventKey[] = [...PLAN_EVENTS];
    expect(keys).toHaveLength(12);
    const source = read("apps/web/lib/funnel-events.ts");
    const union = source.slice(source.indexOf("export type PersistedFunnelEventKey"), source.indexOf("export type PersistedFunnelEventRecord"));
    for (const event of PLAN_EVENTS) expect(union).toContain(`| "${event}"`);
  });

  test("the funnel endpoint persists career map events instead of ignoring them", async () => {
    mockGetAuthSeed.mockResolvedValue(null);
    mockRecord.mockReset();
    mockRecord.mockResolvedValue(undefined);
    const response = await funnelPost(
      new MockNextRequest("https://example.com/api/analytics/funnel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event: "career_map_completed", visitorId: "visitor_a", properties: { utm_source: "linkedin", path: "/map" } }),
      }) as never,
    );
    const payload = await response.json();
    expect(payload.ignored).toBeUndefined();
    expect(mockRecord).toHaveBeenCalledTimes(1);
    expect(mockRecord.mock.calls[0][0]).toMatchObject({ eventKey: "career_map_completed", visitorId: "visitor_a", utmSource: "linkedin", path: "/map" });
  });
});

describe("admin analytics: career map tracked steps", () => {
  test("counts every career map / Proof Studio step by unique visitor", () => {
    const base = { occurredAt: "2026-11-24T12:00:00.000Z", landingPath: "/" };
    const events = [
      ...PLAN_EVENTS.map((eventKey) => ({ ...base, eventKey, visitorId: "visitor_a" })),
      { ...base, eventKey: "career_map_started", visitorId: "visitor_b" },
      { ...base, eventKey: "career_map_started", visitorId: "visitor_b" },
      { ...base, eventKey: "career_map_viewed", visitorId: "visitor_c" },
    ];
    const report = buildAdminAnalyticsReportFromEvents({ window: "30d", now: "2026-11-25T12:00:00.000Z", events });
    expect(report.trackedSteps).toMatchObject({
      careerMapStarted: 2,
      careerMapCompleted: 1,
      careerMapFailed: 1,
      careerMapViewed: 2,
      careerMapEmailCaptured: 1,
      careerMapSignupClicked: 1,
      proofSitePublished: 1,
      voiceModelTuned: 1,
      voiceModelPublished: 1,
      voiceModelPublicRun: 1,
      buildLogPublished: 1,
      remappedRouteViewed: 1,
    });
    // Tracked steps do not leak into the primary funnel.
    expect(report.overviewTotals.landingViews).toBe(0);
  });

  test("the empty report has zeroed career map steps and the page renders them", () => {
    const empty = createEmptyAdminAnalyticsReport("30d");
    expect(empty.trackedSteps.careerMapStarted).toBe(0);
    expect(empty.trackedSteps.remappedRouteViewed).toBe(0);
    const html = renderToStaticMarkup(createElement(AdminAnalyticsPageView, { report: empty, activeWindow: "30d" }));
    for (const label of ["Career map started", "Career map completed", "Map email captured", "Map sign-up clicked", "Proof site published", "Voice model tuned", "Build log published", "Remapped route viewed"]) {
      expect(html).toContain(label);
    }
  });
});

describe("sign-up page: from=map", () => {
  test("detects from=map only", () => {
    expect(isSignUpFromMap("map")).toBe(true);
    expect(isSignUpFromMap(["map", "x"])).toBe(true);
    expect(isSignUpFromMap(" MAP ")).toBe(true);
    expect(isSignUpFromMap(undefined)).toBe(false);
    expect(isSignUpFromMap("home")).toBe(false);
    expect(isSignUpFromMap(null)).toBe(false);
  });

  test("the map panel says the map is saved and what Proof Studio builds, with honest pricing", () => {
    const html = renderToStaticMarkup(createElement(SignUpMapPanel));
    expect(html).toContain("Your map is saved");
    expect(html).toContain("Proof Studio");
    expect(html).toContain("A public site");
    expect(html).toContain("A voice model");
    expect(html).toContain("Tuned in context on your own writing");
    expect(html).toContain("A build log");
    expect(html).toContain("7-day free trial, then $49.99/month. Card required.");
    expect(html).not.toContain("AI-readiness score");
  });

  test("the page branches on from=map and keeps the default panel otherwise", () => {
    const source = read("apps/web/app/sign-up/[[...sign-up]]/page.tsx");
    expect(source).toContain("const fromMap = isSignUpFromMap(params?.from);");
    expect(source).toContain("{fromMap ? <SignUpMapPanel /> : (");
    // Default panel copy is untouched.
    expect(source).toContain("Your score is saved. Create your account to start raising it.");
    expect(source).toContain("AI-readiness score");
  });
});

describe("billing gate overlay: Proof Studio", () => {
  test("lists Proof Studio alongside everything it listed before", () => {
    const source = read("apps/web/components/billing-gate-overlay.tsx");
    expect(source).toContain("Get Proof Studio: a public site, a voice model tuned on your own writing, and a build log");
    for (const line of [
      "Get career-related AI news sent to you daily",
      "Get suggested tweets that you can post to show your progress and your focus on AI",
      "Get dedicated AI skills modules based on your career",
      "Get a 24/7 dedicated AI tutor that can help with any questions",
    ]) {
      expect(source).toContain(line);
    }
  });

  test("renders the Proof Studio line first in the list", () => {
    const html = renderToStaticMarkup(createElement(BillingGateOverlay, {}));
    const proofIndex = html.indexOf("Get Proof Studio");
    expect(proofIndex).toBeGreaterThan(-1);
    expect(proofIndex).toBeLessThan(html.indexOf("Get career-related AI news sent to you daily"));
    expect(html).toContain("Start 7-Day Free Trial");
  });
});
