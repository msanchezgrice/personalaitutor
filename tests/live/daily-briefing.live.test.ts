/**
 * LIVE sanity check for the ported MDD briefing engine — fetches REAL RSS
 * feeds over the network and (when OPENAI_API_KEY is present) runs the real
 * grounded-summarization pass, then builds one guardrail-validated briefing.
 *
 * Not part of `pnpm test`. Run explicitly:
 *
 *   pnpm vitest run tests/live/daily-briefing.live.test.ts
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { buildBriefing, fetchAllFeeds, FEEDS } from "@aitutor/daily-content";

function loadRootEnv() {
  try {
    const raw = readFileSync(path.resolve(process.cwd(), ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!match) continue;
      const [, key, value] = match;
      if (!process.env[key]) {
        process.env[key] = value.replace(/^["']|["']$/g, "").trim();
      }
    }
  } catch {
    // No .env file; rely on the process environment.
  }
}

describe("LIVE daily briefing engine", () => {
  test(
    "fetches a handful of real feeds",
    async () => {
      const sample = FEEDS.filter((feed) =>
        ["TechCrunch AI", "The Verge AI", "Hugging Face Blog", "Simon Willison"].includes(feed.source),
      );
      const { items, stats } = await fetchAllFeeds({ feeds: sample });
      // At least half the sampled feeds must respond with real items.
      expect(stats.ok).toBeGreaterThanOrEqual(2);
      expect(items.length).toBeGreaterThan(10);
      for (const item of items.slice(0, 5)) {
        expect(item.url).toMatch(/^https?:\/\//);
        expect(item.title.length).toBeGreaterThan(0);
      }
      console.log(`[live] feeds ok=${stats.ok} fail=${stats.fail} items=${items.length}`);
    },
    60_000,
  );

  test(
    "builds one real guardrail-validated briefing for marketing-seo",
    async () => {
      loadRootEnv();
      const briefing = await buildBriefing({ careerPathId: "marketing-seo" });

      expect(briefing.validated).toBe(true);
      expect(briefing.topStory).not.toBeNull();
      expect(briefing.topStory!.url).toMatch(/^https?:\/\//);
      expect(briefing.quickHits.length).toBeGreaterThanOrEqual(2);
      for (const hit of briefing.quickHits) {
        expect(hit.url).toMatch(/^https?:\/\//);
      }
      expect(briefing.sources.length).toBeGreaterThanOrEqual(3);
      expect(briefing.toolOfTheDay).toBeNull();
      expect(briefing.byTheNumbers).toBeNull();

      console.log("[live] BIG STORY:", briefing.topStory!.headline);
      console.log("[live]   ", briefing.topStory!.summary.slice(0, 200));
      console.log("[live]   source:", briefing.topStory!.source, "—", briefing.topStory!.url);
      for (const [index, hit] of briefing.quickHits.entries()) {
        console.log(`[live] QUICK HIT ${index + 1}:`, hit.headline);
        console.log("[live]   source:", hit.source, "—", hit.url);
      }
      console.log(
        `[live] feeds ok=${briefing.feedsOk} fail=${briefing.feedsFail} fetched=${briefing.fetchedCount} summarized=${Boolean(process.env.OPENAI_API_KEY)}`,
      );
    },
    300_000,
  );
});
