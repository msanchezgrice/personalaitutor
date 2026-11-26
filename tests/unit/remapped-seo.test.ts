import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/runtime", () => ({
  runtimeListTalent: async () => [],
  runtimeFindUserByHandle: async () => null,
  runtimeListProjectsByUser: async () => [],
}));
vi.mock("@/app/u/public-profile-utils", () => ({
  EXAMPLE_PROFILE_HANDLE: "alex-chen-ai",
  exampleProjects: () => [],
}));

import sitemap from "@/app/sitemap";
import robots from "@/app/robots";
import { REMAPPED_ROUTES } from "@/lib/remapped/routes";

const publicDir = path.resolve(__dirname, "../../apps/web/public");

describe("sitemap", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("lists /map, /remapped and only the published routes", async () => {
    vi.setSystemTime(new Date("2026-11-25T12:00:00Z"));
    const urls = (await sitemap()).map((entry) => new URL(entry.url).pathname);
    expect(urls).toContain("/map");
    expect(urls).toContain("/remapped");
    expect(urls).toContain("/");
    expect(urls).toContain("/learn");
    const routeUrls = urls.filter((url) => url.startsWith("/remapped/"));
    expect(routeUrls).toHaveLength(6);
    for (const route of REMAPPED_ROUTES) {
      const listed = urls.includes(`/remapped/${route.slug}`);
      expect(listed, route.slug).toBe(route.publishAt <= "2026-11-25");
    }
    expect(urls.some((url) => url.startsWith("/map/"))).toBe(false);
  });

  test("a scheduled route joins the sitemap on its date", async () => {
    vi.setSystemTime(new Date("2026-11-30T01:00:00Z"));
    const urls = (await sitemap()).map((entry) => new URL(entry.url).pathname);
    expect(urls).toContain("/remapped/copywriter-to-ai-content-strategist");
    expect(urls).not.toContain("/remapped/community-manager-to-ai-community-lead");
  });
});

describe("robots", () => {
  test("allows /map and /remapped, disallows tokenised /map/ links and keeps existing rules", () => {
    const rules = robots().rules;
    const rule = Array.isArray(rules) ? rules[0] : rules;
    const allow = [rule.allow].flat();
    const disallow = [rule.disallow].flat();
    expect(allow).toEqual(expect.arrayContaining(["/", "/employers", "/employers/talent", "/u/", "/map", "/remapped"]));
    expect(disallow).toEqual(expect.arrayContaining(["/dashboard", "/onboarding", "/sign-in", "/sign-up", "/api/", "/map/"]));
    expect(disallow).not.toContain("/map");
    expect(disallow.some((entry) => entry?.startsWith("/remapped"))).toBe(false);
    expect(robots().sitemap).toMatch(/\/sitemap\.xml$/);
  });
});

describe("agent files", () => {
  test(".well-known files parse as JSON and describe the new product truthfully", () => {
    for (const file of ["agent-card.json", "ai-agent.json"]) {
      const raw = readFileSync(path.join(publicDir, ".well-known", file), "utf8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      expect(parsed.url).toBe("https://www.myaiskilltutor.com");
      expect(raw).toContain("/map");
      expect(raw).toContain("$49.99/month");
      expect(raw).toContain("7-day free trial");
      expect(raw).toContain("in context");
      expect(raw).toContain("cta-map-career-hero");
    }
    const guardrails = JSON.parse(readFileSync(path.join(publicDir, ".well-known", "ai-agent.json"), "utf8"));
    expect(guardrails.guardrails.resume_submission_requires_confirmation).toBe(true);
    expect(guardrails.guardrails.publishing_requires_confirmation).toBe(true);
    expect(guardrails.guardrails.payment_actions_require_confirmation).toBe(true);
  });

  test("llms.txt and agents.md cover the career map, Remapped, Proof Studio, selectors and the confirmation rule", () => {
    const selectors = [
      "cta-map-career-nav",
      "cta-map-career-hero",
      "cta-upload-resume-hero",
      "cta-start-trial-pricing",
      "cta-map-career-pricing",
      "cta-map-career-bottom",
      "cta-play-film",
    ];
    for (const file of ["llms.txt", "agents.md"]) {
      const text = readFileSync(path.join(publicDir, file), "utf8");
      expect(text, file).toContain("/map");
      expect(text, file).toContain("/remapped");
      expect(text, file).toContain("Proof Studio");
      expect(text, file).toContain("$49.99/month");
      expect(text, file).toContain("7-day free trial");
      expect(text, file).toMatch(/tuned in context/);
      for (const selector of selectors) expect(text, `${file}: ${selector}`).toContain(selector);
      expect(text, file).toMatch(/never submit a résumé/i);
      expect(text, file).not.toMatch(/fine-tuned on/i);
    }
  });
});
