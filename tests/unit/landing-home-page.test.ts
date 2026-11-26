import * as React from "react";
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server.node.js";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { RemappedRoute } from "@aitutor/shared";

const { mockGetAuthSeed, mockListRemappedRoutes } = vi.hoisted(() => ({
  mockGetAuthSeed: vi.fn(),
  mockListRemappedRoutes: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAuthSeed: mockGetAuthSeed }));
vi.mock("@/lib/remapped/routes", () => ({ listRemappedRoutes: mockListRemappedRoutes }));

import HomePage, { metadata } from "@/app/page";
import { landingGuides, landingRemappedRoutes } from "@/components/landing/landing-data";
import { LANDING_FAQS } from "@/components/landing/landing-content";

vi.stubGlobal("React", React);

function route(slug: string, fromTitle: string, toTitleId: string): RemappedRoute {
  return {
    slug,
    publishAt: "2026-11-23",
    fromTitle,
    fromField: "Game Studio",
    toTitleId,
    intro: "Intro.",
    translations: [],
    gaps: [],
    firstProject: { title: "Project", steps: [] },
    watchOuts: [],
  };
}

function jsonLdBlocks(html: string) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1]));
}

afterEach(() => {
  mockGetAuthSeed.mockReset();
  mockListRemappedRoutes.mockReset();
});

describe("home page", () => {
  test("metadata uses the new title and the hero description", () => {
    expect(metadata.title).toBe("Find Your New Job Title for the AI Era | My AI Skill Tutor");
    expect(metadata.description).toBe(
      "Tell us what you did before. We map it to the AI-era job it fits, then help you prove it in public: a live site, a model tuned on your own work, and a build log.",
    );
    expect(metadata.alternates?.canonical).toBe("/");
    expect(metadata.openGraph?.title).toBe(metadata.title);
  });

  test("emits Organization, WebSite and FAQPage JSON-LD with the new FAQs", async () => {
    mockGetAuthSeed.mockResolvedValue(null);
    mockListRemappedRoutes.mockReturnValue([]);
    const html = renderToStaticMarkup(await HomePage());
    const blocks = jsonLdBlocks(html);
    expect(blocks.map((block) => block["@type"])).toEqual(["Organization", "WebSite", "FAQPage"]);
    const faq = blocks[2];
    expect(faq.mainEntity).toHaveLength(LANDING_FAQS.length);
    expect(faq.mainEntity[0]).toEqual({
      "@type": "Question",
      name: "Will this get me a job?",
      acceptedAnswer: { "@type": "Answer", text: LANDING_FAQS[0].answer },
    });
  });

  test("renders signed out when the session lookup fails", async () => {
    mockGetAuthSeed.mockRejectedValue(new Error("CLERK_DOWN"));
    mockListRemappedRoutes.mockReturnValue([]);
    const html = renderToStaticMarkup(await HomePage());
    expect(html).toContain('data-testid="nav-log-in"');
    expect(html).not.toContain('id="remapped"');
  });

  test("signed-in visitors get the dashboard shortcut and the Proof Studio trial link", async () => {
    mockGetAuthSeed.mockResolvedValue({ userId: "user_123", name: "Test" });
    mockListRemappedRoutes.mockReturnValue([]);
    const html = renderToStaticMarkup(await HomePage());
    expect(html).toContain('href="/dashboard/?welcome=1"');
    expect(html).toContain('href="/dashboard/proof" class="rm-btn rm-btn--primary');
  });

  test("Remapped routes resolve catalog titles, skip unknown ids and stop at five", () => {
    mockListRemappedRoutes.mockReturnValue([
      route("qa-tester-to-model-evaluator", "QA Tester", "model-evaluator"),
      route("unknown", "Mystery", "not-a-title"),
      route("marketing-manager-to-go-to-market-engineer", "Marketing Manager", "gtm-engineer"),
      route("a", "A", "model-evaluator"),
      route("b", "B", "model-evaluator"),
      route("c", "C", "model-evaluator"),
      route("d", "D", "model-evaluator"),
    ]);
    const now = new Date("2026-11-25T12:00:00Z");
    const routes = landingRemappedRoutes(now);
    expect(mockListRemappedRoutes).toHaveBeenCalledWith(now);
    expect(routes).toHaveLength(5);
    expect(routes[0]).toEqual({ slug: "qa-tester-to-model-evaluator", fromTitle: "QA Tester", toTitle: "Model Evaluator" });
    expect(routes[1]).toEqual({ slug: "marketing-manager-to-go-to-market-engineer", fromTitle: "Marketing Manager", toTitle: "Go-to-Market Engineer" });
    expect(routes.some((entry) => entry.slug === "unknown")).toBe(false);
  });

  test("guides are the three career-change guides and never mention forbidden claims", () => {
    const guides = landingGuides();
    expect(guides.map((guide) => guide.slug)).toEqual(["career-mapping-transferable-skills", "my-job-is-disappearing", "ai-skills-for-resume"]);
    for (const guide of guides) {
      const copy = `${guide.title} ${guide.description}`.toLowerCase();
      expect(copy).not.toContain("public proof");
      expect(copy).not.toContain("cryptographic");
    }
  });
});
