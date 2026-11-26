import { describe, expect, test } from "vitest";
import { CAREER_MAP_TITLE_IDS, getCareerMapTitle } from "@aitutor/shared";
import {
  REMAPPED_ROUTES,
  describeRemappedRoute,
  formatRemappedDate,
  getRelatedRemappedRoutes,
  getRemappedNearbyStops,
  getRemappedRoute,
  listRemappedRoutes,
} from "@/lib/remapped/routes";

const LAUNCH = new Date("2026-11-25T12:00:00Z");

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function allCopy(route: (typeof REMAPPED_ROUTES)[number]): string[] {
  return [
    route.fromTitle,
    route.fromField,
    route.intro,
    ...route.translations.flatMap((row) => [row.before, row.now, row.explanation]),
    ...route.gaps.flatMap((gap) => [gap.gap, gap.closeWith]),
    route.firstProject.title,
    ...route.firstProject.steps,
    ...route.watchOuts,
  ];
}

describe("Remapped library content", () => {
  test("has the twelve assigned routes with the two fixed slugs", () => {
    expect(REMAPPED_ROUTES).toHaveLength(12);
    const pairs = REMAPPED_ROUTES.map((route) => `${route.fromTitle} -> ${route.toTitleId}`);
    expect(pairs).toEqual(
      expect.arrayContaining([
        "Marketing Manager -> gtm-engineer",
        "QA Tester -> model-evaluator",
        "Game Designer -> ai-environment-designer",
        "Producer -> ai-product-manager",
        "Concept Artist -> ai-art-director",
        "Recruiter -> ai-trainer",
        "Copywriter -> ai-content-strategist",
        "Community Manager -> ai-community-lead",
        "Support Lead -> ai-support-ops-lead",
        "Brand Designer -> generative-brand-designer",
        "Product Manager -> agent-ops-lead",
        "Paralegal -> legal-ai-ops-specialist",
      ]),
    );
    const slugs = REMAPPED_ROUTES.map((route) => route.slug);
    expect(slugs).toContain("marketing-manager-to-go-to-market-engineer");
    expect(slugs).toContain("qa-tester-to-model-evaluator");
  });

  test("every toTitleId is in the career map catalog", () => {
    for (const route of REMAPPED_ROUTES) {
      expect(CAREER_MAP_TITLE_IDS, route.slug).toContain(route.toTitleId);
    }
  });

  test("slugs are unique and follow <from>-to-<to> in kebab case", () => {
    const slugs = REMAPPED_ROUTES.map((route) => route.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const route of REMAPPED_ROUTES) {
      const title = getCareerMapTitle(route.toTitleId);
      expect(route.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(route.slug).toBe(`${slugify(route.fromTitle)}-to-${slugify(title?.title ?? "")}`);
    }
  });

  test("six routes are live at launch with staggered dates, Marketing Manager newest; six follow on consecutive Mondays", () => {
    const dates = REMAPPED_ROUTES.map((route) => route.publishAt);
    for (const date of dates) expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const published = REMAPPED_ROUTES.slice(0, 6);
    const scheduled = REMAPPED_ROUTES.slice(6);
    for (const route of published) expect(route.publishAt <= "2026-11-25", route.slug).toBe(true);
    expect(new Set(published.map((route) => route.publishAt)).size).toBe(6);
    expect(published[0].slug).toBe("marketing-manager-to-go-to-market-engineer");
    // Published block runs newest -> oldest; scheduled block runs in date order.
    for (let i = 1; i < published.length; i += 1) expect(published[i].publishAt < published[i - 1].publishAt).toBe(true);
    const mondays = scheduled.map((route) => new Date(`${route.publishAt}T00:00:00Z`));
    expect(scheduled[0].publishAt).toBe("2026-11-30");
    for (let i = 0; i < mondays.length; i += 1) {
      expect(mondays[i].getUTCDay(), scheduled[i].slug).toBe(1);
      if (i > 0) expect(mondays[i].getTime() - mondays[i - 1].getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    }
  });

  test("content limits: 4 translations, 2-3 gaps, 4-6 steps, 2-3 watch-outs, non-empty copy", () => {
    for (const route of REMAPPED_ROUTES) {
      expect(route.translations, route.slug).toHaveLength(4);
      expect(route.gaps.length, route.slug).toBeGreaterThanOrEqual(2);
      expect(route.gaps.length, route.slug).toBeLessThanOrEqual(3);
      expect(route.firstProject.steps.length, route.slug).toBeGreaterThanOrEqual(4);
      expect(route.firstProject.steps.length, route.slug).toBeLessThanOrEqual(6);
      expect(route.watchOuts.length, route.slug).toBeGreaterThanOrEqual(2);
      expect(route.watchOuts.length, route.slug).toBeLessThanOrEqual(3);
      for (const text of allCopy(route)) expect(text.trim().length, route.slug).toBeGreaterThan(1);
      expect(route.intro.length).toBeLessThanOrEqual(420);
    }
  });

  test("copy has no banned words, percentages, money figures, emoji or em-dashes", () => {
    const banned = /\b(unlock\w*|seamless\w*|supercharg\w*|game[- ]?changer\w*|revolutioni[sz]\w*|skyrocket\w*|guaranteed job|land your dream)\b/i;
    for (const route of REMAPPED_ROUTES) {
      for (const text of allCopy(route)) {
        expect(text, route.slug).not.toMatch(banned);
        expect(text, route.slug).not.toMatch(/\d\s*%/);
        expect(text, route.slug).not.toMatch(/\$\s*\d|\d\s*\$/);
        expect(text, route.slug).not.toMatch(/\p{Extended_Pictographic}/u);
        expect(text, route.slug).not.toContain("—");
        expect(text, route.slug).not.toMatch(/\b(salary|salaries|six figures)\b/i);
      }
    }
  });

  test("nearby stops are catalog titles on the destination's line", () => {
    for (const route of REMAPPED_ROUTES) {
      const destination = getCareerMapTitle(route.toTitleId);
      const stops = getRemappedNearbyStops(route);
      expect(stops.length, route.slug).toBe(2);
      for (const stop of stops) {
        expect(stop.line).toBe(destination?.line);
        expect(stop.id).not.toBe(route.toTitleId);
      }
    }
  });

  test("describe and format helpers", () => {
    const route = REMAPPED_ROUTES[1];
    expect(describeRemappedRoute(route)).toContain("QA Tester to Model Evaluator");
    expect(formatRemappedDate("2026-11-23")).toBe("November 23, 2026");
  });
});

describe("publishing schedule", () => {
  test("listRemappedRoutes hides future routes and sorts newest first", () => {
    const live = listRemappedRoutes(LAUNCH);
    expect(live).toHaveLength(6);
    expect(live[0].slug).toBe("marketing-manager-to-go-to-market-engineer");
    for (let i = 1; i < live.length; i += 1) expect(live[i].publishAt <= live[i - 1].publishAt).toBe(true);
    expect(live.map((route) => route.slug)).not.toContain("copywriter-to-ai-content-strategist");
  });

  test("a scheduled route appears on its date and not a moment before", () => {
    const slug = "copywriter-to-ai-content-strategist";
    expect(getRemappedRoute(slug, new Date("2026-11-29T23:59:59Z"))).toBeNull();
    expect(listRemappedRoutes(new Date("2026-11-29T23:59:59Z")).map((route) => route.slug)).not.toContain(slug);
    expect(getRemappedRoute(slug, new Date("2026-11-30T00:00:00Z"))?.slug).toBe(slug);
    const onDay = listRemappedRoutes(new Date("2026-11-30T09:00:00Z"));
    expect(onDay).toHaveLength(7);
    expect(onDay[0].slug).toBe(slug);
  });

  test("everything is live after the last Monday; unknown slugs are null", () => {
    expect(listRemappedRoutes(new Date("2027-01-04T00:00:00Z"))).toHaveLength(12);
    expect(getRemappedRoute("paralegal-to-legal-ai-operations-specialist", LAUNCH)).toBeNull();
    expect(getRemappedRoute("not-a-route", LAUNCH)).toBeNull();
    expect(getRemappedRoute("qa-tester-to-model-evaluator", LAUNCH)?.toTitleId).toBe("model-evaluator");
  });

  test("related routes are published, exclude the current one, and prefer the same line", () => {
    const route = getRemappedRoute("qa-tester-to-model-evaluator", LAUNCH);
    expect(route).not.toBeNull();
    const related = getRelatedRemappedRoutes(route!, LAUNCH, 3);
    expect(related).toHaveLength(3);
    expect(related.map((entry) => entry.slug)).not.toContain(route!.slug);
    const live = new Set(listRemappedRoutes(LAUNCH).map((entry) => entry.slug));
    for (const entry of related) expect(live.has(entry.slug)).toBe(true);
    expect(getCareerMapTitle(related[0].toTitleId)?.line).toBe("evals");
  });
});
