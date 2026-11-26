import { describe, expect, test, vi } from "vitest";
import React, { createElement } from "react";

// Foundation components (components/remap/*) rely on the automatic JSX runtime;
// vitest compiles JSX with the classic runtime, so React has to be global here.
(globalThis as { React?: typeof React }).React = React;
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server.node.js";
import { EXAMPLE_CAREER_MAP, getCareerMapTitle, VOICE_MODEL_METHOD_LABEL, type CareerMap } from "@aitutor/shared";

vi.mock("@/lib/analytics", () => ({
  captureAnalyticsEvent: vi.fn(),
  getOrCreateFunnelVisitorId: vi.fn(() => "visitor_test"),
}));

// Components resolve `next` from apps/web/node_modules, so mock that exact file.
vi.mock("../../apps/web/node_modules/next/navigation.js", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import {
  CAREER_MAP_DISCLAIMER,
  CareerMapFailedState,
  CareerMapGeneratingState,
  CareerMapNotFoundState,
  CareerMapResult,
  careerMapRouteLabel,
  resolveCareerMap,
} from "../../apps/web/components/career-map/career-map-result";
import { CAREER_MAP_SIGNED_IN_HREF, CAREER_MAP_SIGNUP_HREF } from "../../apps/web/lib/career-map/constants";

const escapeHref = (href: string) => href.replace(/&/g, "&amp;");

function render(overrides: Partial<Parameters<typeof CareerMapResult>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(CareerMapResult, {
      mapId: "map-1",
      token: "tok_abcdefghijklmnop",
      map: EXAMPLE_CAREER_MAP,
      source: "paste",
      hasEmail: false,
      signedIn: false,
      viewer: "owner",
      shareUrl: "https://www.myaiskilltutor.com/map/tok_abcdefghijklmnop",
      ...overrides,
    }),
  );
}

describe("career map result view", () => {
  test("renders every section of the design from EXAMPLE_CAREER_MAP", () => {
    const html = render();

    // Title block
    expect(html).toContain("Career map for Maya Ortiz · drawn from your résumé");
    expect(html).toContain("Your new title: ");
    expect(html).toContain("Go-to-Market Engineer");
    expect(html).toContain(EXAMPLE_CAREER_MAP.primary.summary);
    expect(html).toContain("Strong match");
    expect(html).toContain("Backed by 4 lines of your résumé");

    // Route map (SVG with the old and new titles)
    expect(html).toContain("rm-routemap");
    expect(html).toContain("Senior Marketing Manager");
    expect(html).toContain("Game Studio");

    // Translations: quote, now, explanation
    expect(html).toContain("What you did, translated");
    for (const row of EXAMPLE_CAREER_MAP.translations) {
      expect(html).toContain(`“${row.evidence}”`);
      expect(html).toContain(row.now);
      expect(html).toContain(row.explanation);
    }

    // Alternates from the catalog
    expect(html).toContain("Two other stops on your line");
    expect(html).toContain("Lifecycle Automation Lead");
    expect(html).toContain("AI Content Strategist");
    expect(html).toContain(EXAMPLE_CAREER_MAP.alternates[0].reason.replace(/'/g, "&#x27;"));

    // Gaps
    expect(html).toContain("What your résumé doesn&#x27;t show yet");
    for (const gap of EXAMPLE_CAREER_MAP.gaps) expect(html).toContain(gap.gap);

    // Proof plan + CTA
    expect(html).toContain("Your proof plan");
    expect(html).toContain("1. Site");
    expect(html).toContain(EXAMPLE_CAREER_MAP.proofPlan.site.headline);
    expect(html).toContain("2. Voice model");
    expect(html).toContain("maya-voice, tuned on your launch emails");
    expect(html).toContain(VOICE_MODEL_METHOD_LABEL.toLowerCase());
    expect(html).toContain("3. Build log");
    expect(html).toContain(EXAMPLE_CAREER_MAP.proofPlan.buildLog.firstPostTitle);
    expect(html).toContain("Start building, free for 7 days");
    expect(html).toContain("Then $49.99 per month. Card required. Cancel any time.");
    expect(html).toContain(`href="${escapeHref(CAREER_MAP_SIGNUP_HREF)}"`);

    // Save + share + disclaimer
    expect(html).toContain("Keep this map");
    expect(html).toContain("Email me my map");
    expect(html).toContain('href="#save"');
    expect(html).toContain("Copy link");
    expect(html).toContain(CAREER_MAP_DISCLAIMER);
    expect(html).toContain("starting hypothesis");
    expect(html).toContain("not a hiring prediction");
  });

  test("hides the email form when the map already has an email", () => {
    const html = render({ hasEmail: true });
    expect(html).not.toContain("Email me my map");
    expect(html).not.toContain('href="#save"');
    expect(html).toContain(CAREER_MAP_DISCLAIMER);
    expect(html).toContain('data-testid="career-map-cta-header"');
  });

  test("signed-in viewers get the Proof Studio href and no email form", () => {
    const html = render({ signedIn: true });
    expect(html).not.toContain("Email me my map");
    expect(html).toContain(`href="${CAREER_MAP_SIGNED_IN_HREF}"`);
    expect(html).not.toContain(escapeHref(CAREER_MAP_SIGNUP_HREF));
    expect(html).toContain("Start building in Proof Studio");
  });

  test("describe source changes the evidence wording", () => {
    const html = render({ source: "describe", map: { ...EXAMPLE_CAREER_MAP, person: { ...EXAMPLE_CAREER_MAP.person, displayName: null } } });
    expect(html).toContain("Your career map · drawn from how you described your last job");
    expect(html).toContain("Backed by 4 lines of what you wrote");
    expect(html).toContain("What your description doesn&#x27;t show yet");
  });

  test("an unknown primary title renders the failed state instead of a broken map", () => {
    const broken: CareerMap = { ...EXAMPLE_CAREER_MAP, primary: { ...EXAMPLE_CAREER_MAP.primary, titleId: "not-a-title" } };
    const html = render({ map: broken });
    expect(html).toContain('data-testid="career-map-failed"');
    expect(html).not.toContain("Your new title");
  });

  test("never uses emoji", () => {
    expect(render()).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

describe("career map catalog lookups", () => {
  test("resolveCareerMap reads titles and the line from the catalog", () => {
    const resolved = resolveCareerMap(EXAMPLE_CAREER_MAP);
    expect(resolved?.primary).toEqual(getCareerMapTitle("gtm-engineer"));
    expect(resolved?.line.label).toBe("Growth");
    expect(resolved?.alternates.map((entry) => entry.title.title)).toEqual(["Lifecycle Automation Lead", "AI Content Strategist"]);
  });

  test("unknown alternates are dropped, unknown primary returns null", () => {
    const map: CareerMap = { ...EXAMPLE_CAREER_MAP, alternates: [{ titleId: "nope", reason: "x".repeat(20) }, EXAMPLE_CAREER_MAP.alternates[1]] };
    expect(resolveCareerMap(map)?.alternates).toHaveLength(1);
    expect(resolveCareerMap({ ...EXAMPLE_CAREER_MAP, primary: { ...EXAMPLE_CAREER_MAP.primary, titleId: "nope" } })).toBeNull();
  });

  test("route label uses a real arrow", () => {
    expect(careerMapRouteLabel(EXAMPLE_CAREER_MAP)).toBe("Senior Marketing Manager → Go-to-Market Engineer");
  });
});

describe("career map status states", () => {
  test("generating state explains the wait and refreshes itself", () => {
    const html = renderToStaticMarkup(createElement(CareerMapGeneratingState));
    expect(html).toContain("Your map is still being drawn");
    expect(html).toContain("10 to 30 seconds");
    expect(html).toContain("checks again every few seconds");
  });

  test("failed state gives a human reason and a retry link to /map", () => {
    const html = renderToStaticMarkup(createElement(CareerMapFailedState, { reason: "CAREER_MAP_INVALID_OUTPUT:UNGROUNDED" }));
    expect(html).toContain("We couldn&#x27;t draw this map");
    expect(html).toContain("too few did");
    expect(html).toContain('href="/map"');
    expect(html).not.toContain("UNGROUNDED");
  });

  test("not-found state links to a new map", () => {
    const html = renderToStaticMarkup(createElement(CareerMapNotFoundState));
    expect(html).toContain("We couldn&#x27;t find that map");
    expect(html).toContain('href="/map"');
  });
});
