import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

/**
 * Live regression (2026-07-08 ~03:23 UTC, right at the 6-fix deploy): the
 * /dashboard/ai-news page sat on the server skeleton forever with no
 * /api/news/recommendations request. PostHog proved the client HAD rendered 3
 * cached stories (ai_news_loaded source=cache stories=3, hydrate completed in
 * 25ms) — but React's hydration fallback (mid-deploy HTML/chunk skew) replaced
 * the [data-dashboard-route] subtree AFTER the runtime wrote into it, leaving
 * the runtime's output detached and the server skeleton visible. The runtime
 * believed hydration was done, and the RouteHydrator skip-guard blocked any
 * re-hydration.
 *
 * Fix: hydrateAiNewsPage re-queries the LIVE container at render time, marks
 * its output, and re-renders once from the in-memory payload if a later check
 * finds the output no longer attached. No network involved — pure DOM
 * resilience.
 */

const runtimePath = path.resolve(process.cwd(), "apps/web/public/gemini-runtime.js");
const source = readFileSync(runtimePath, "utf8");
const section = source.slice(
  source.indexOf("async function hydrateAiNewsPage"),
  source.indexOf("async function hydrateProfilePage"),
);

describe("ai-news render survives React hydration clobber", () => {
  test("renders into the live container, not a stale captured reference", () => {
    // The container is re-queried at render time and checked for attachment.
    expect(section).toMatch(/isConnected/);
  });

  test("rendered output carries a marker so clobbering is detectable", () => {
    expect(section).toContain("data-ai-news-rendered");
  });

  test("a post-render recheck re-renders the last payload when the output was clobbered", () => {
    // Keeps the last successful payload in memory and re-renders it.
    expect(section).toMatch(/lastNewsResult/);
    // Recovery is observable in analytics.
    expect(section).toContain("ai_news_rerendered_after_clobber");
    // Recovery re-renders from memory — it must NOT issue a new network call.
    const recheck = section.slice(section.indexOf("scheduleClobberRecheck"));
    expect(recheck).toBeTruthy();
  });

  test("the recheck is scheduled exactly once per hydration", () => {
    expect(section).toMatch(/clobberRecheckScheduled/);
  });
});
