import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import type { DailyBriefing } from "@aitutor/daily-content";
import {
  getDailyBriefing,
  getLatestDailyBriefing,
  listDailyBriefingsSince,
  persistDailyBriefing,
  resetDailyBriefingStateForTests,
  todayBriefingDate,
} from "../../apps/web/lib/daily-briefing-store";
import {
  briefingNewsForPath,
  briefingToNewsStories,
  getOrGenerateDailyBriefing,
  resolveBriefingPathId,
  waitForBackgroundBriefingBuilds,
} from "../../apps/web/lib/daily-briefing";

function fixtureBriefing(overrides: Partial<DailyBriefing> = {}): DailyBriefing {
  return {
    careerPathId: "marketing-seo",
    careerPathName: "Marketing & SEO",
    date: "2026-07-07",
    dayOfWeek: 2,
    dowTheme: "Tool Tuesday",
    dowBlurb: "A tool worth trying today",
    topStory: {
      headline: "AI marketing suite ships",
      summary: "Real grounded summary.",
      source: "TechCrunch AI",
      url: "https://real.example.com/top",
      published: "2026-07-07T09:00:00Z",
      trendingScore: 2,
    },
    quickHits: [
      {
        headline: "Quick hit one",
        summary: "Grounded.",
        source: "The Verge AI",
        url: "https://real.example.com/one",
        published: "2026-07-07T08:00:00Z",
        trendingScore: 1,
      },
      {
        headline: "Quick hit two",
        summary: "Grounded.",
        source: "OpenAI Blog",
        url: "https://real.example.com/two",
        published: "2026-07-06T18:00:00Z",
        trendingScore: 1,
      },
    ],
    sources: [
      { name: "TechCrunch AI", url: "https://real.example.com/top" },
      { name: "The Verge AI", url: "https://real.example.com/one" },
      { name: "OpenAI Blog", url: "https://real.example.com/two" },
    ],
    toolOfTheDay: null,
    byTheNumbers: null,
    fetchedCount: 40,
    feedsOk: 30,
    feedsFail: 5,
    validated: true,
    ...overrides,
  };
}

describe("daily briefing store (memory mode)", () => {
  beforeEach(() => {
    resetDailyBriefingStateForTests();
  });

  test("persist + get round-trips per path per day", async () => {
    const briefing = fixtureBriefing();
    await persistDailyBriefing({ careerPathId: "marketing-seo", briefingDate: "2026-07-07", briefing });

    const found = await getDailyBriefing({ careerPathId: "marketing-seo", briefingDate: "2026-07-07" });
    expect(found?.briefing.topStory?.url).toBe("https://real.example.com/top");

    const missOtherPath = await getDailyBriefing({ careerPathId: "operations", briefingDate: "2026-07-07" });
    expect(missOtherPath).toBeNull();
    const missOtherDay = await getDailyBriefing({ careerPathId: "marketing-seo", briefingDate: "2026-07-06" });
    expect(missOtherDay).toBeNull();
  });

  test("re-persisting the same path/day is idempotent (upsert, stable id)", async () => {
    const first = await persistDailyBriefing({
      careerPathId: "marketing-seo",
      briefingDate: "2026-07-07",
      briefing: fixtureBriefing(),
    });
    const second = await persistDailyBriefing({
      careerPathId: "marketing-seo",
      briefingDate: "2026-07-07",
      briefing: fixtureBriefing({ fetchedCount: 99 }),
    });
    expect(second.id).toBe(first.id);
    const found = await getDailyBriefing({ careerPathId: "marketing-seo", briefingDate: "2026-07-07" });
    expect(found?.briefing.fetchedCount).toBe(99);
  });

  test("refuses to persist a briefing that has not passed the guardrail", async () => {
    await expect(
      persistDailyBriefing({
        careerPathId: "marketing-seo",
        briefingDate: "2026-07-07",
        briefing: fixtureBriefing({ validated: false }),
      }),
    ).rejects.toThrowError("DAILY_BRIEFING_NOT_VALIDATED");
  });

  test("listDailyBriefingsSince returns newest-first within the window", async () => {
    for (const date of ["2026-07-01", "2026-07-03", "2026-07-07"]) {
      await persistDailyBriefing({
        careerPathId: "marketing-seo",
        briefingDate: date,
        briefing: fixtureBriefing({ date }),
      });
    }
    const since = await listDailyBriefingsSince({ careerPathId: "marketing-seo", sinceDate: "2026-07-02" });
    expect(since.map((record) => record.briefingDate)).toEqual(["2026-07-07", "2026-07-03"]);
  });
});

describe("briefing news service", () => {
  beforeEach(() => {
    resetDailyBriefingStateForTests();
  });

  test("resolveBriefingPathId picks the first valid candidate, falls back to default", () => {
    expect(resolveBriefingPathId(["marketing-seo"])).toBe("marketing-seo");
    expect(resolveBriefingPathId(["not-a-path", "operations"])).toBe("operations");
    expect(resolveBriefingPathId([null, undefined, "junk"])).toBe("product-management");
  });

  test("getOrGenerateDailyBriefing reads the store first, generates on miss", async () => {
    let built = 0;
    const build = async () => {
      built += 1;
      return fixtureBriefing();
    };
    const now = new Date("2026-07-07T10:00:00Z");

    const first = await getOrGenerateDailyBriefing({ careerPathId: "marketing-seo", now, build });
    expect(built).toBe(1);
    expect(first.briefingDate).toBe("2026-07-07");

    const second = await getOrGenerateDailyBriefing({ careerPathId: "marketing-seo", now, build });
    expect(built).toBe(1); // cache hit — no rebuild
    expect(second.id).toBe(first.id);
  });

  test("briefingToNewsStories maps top story + quick hits with real URLs only", () => {
    const stories = briefingToNewsStories(fixtureBriefing(), 5);
    expect(stories).toHaveLength(3);
    expect(stories[0].url).toBe("https://real.example.com/top");
    expect(stories[0].impact).toBe("high");
    expect(stories[1].url).toBe("https://real.example.com/one");
    expect(stories.map((story) => story.url)).toEqual([
      "https://real.example.com/top",
      "https://real.example.com/one",
      "https://real.example.com/two",
    ]);
    // maxStories is respected.
    expect(briefingToNewsStories(fixtureBriefing(), 2)).toHaveLength(2);
  });

  test("briefingNewsForPath returns grounded stories for the user's path", async () => {
    const now = new Date("2026-07-07T10:00:00Z");
    const result = await briefingNewsForPath({
      careerPathId: "marketing-seo",
      maxStories: 5,
      now,
      build: async () => fixtureBriefing(),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.careerPathId).toBe("marketing-seo");
      expect(result.stories.length).toBe(3);
      expect(result.focusSummary).toContain("Marketing & SEO");
    }
  });

  test("briefingNewsForPath fails EXPLICITLY when generation fails — no fabricated fallback", async () => {
    const result = await briefingNewsForPath({
      careerPathId: "marketing-seo",
      maxStories: 5,
      now: new Date("2026-07-07T10:00:00Z"),
      build: async () => {
        throw new Error("BRIEFING_TOP_STORY_MISSING");
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toContain("BRIEFING_TOP_STORY_MISSING");
    }
  });

  test("todayBriefingDate uses the UTC calendar date", () => {
    expect(todayBriefingDate(new Date("2026-07-07T23:59:59Z"))).toBe("2026-07-07");
    expect(todayBriefingDate(new Date("2026-07-08T00:00:01Z"))).toBe("2026-07-08");
  });
});

/**
 * Live E2E fix (2026-07-07 night, finding #1): Miguel's dashboard served
 * legacy "global_cache" stories at ~02:00 UTC on 07-08 even though a real
 * briefing row dated 2026-07-07 existed for his path. Root cause: the news
 * path only ever looked up TODAY'S UTC date in the store (exact-match miss
 * just past midnight) and the cache-first short-circuit returned legacy
 * global rows before the briefing engine was ever consulted. The serving
 * chain is now: today's row → latest row (background regen if stale >24h) →
 * on-demand generation → global cache as last resort.
 */
describe("briefing serving fallback chain (UTC date boundary)", () => {
  beforeEach(() => {
    resetDailyBriefingStateForTests();
  });

  test("getLatestDailyBriefing returns the newest row for the path", async () => {
    for (const date of ["2026-07-03", "2026-07-07", "2026-07-05"]) {
      await persistDailyBriefing({
        careerPathId: "marketing-seo",
        briefingDate: date,
        briefing: fixtureBriefing({ date }),
      });
    }
    const latest = await getLatestDailyBriefing({ careerPathId: "marketing-seo" });
    expect(latest?.briefingDate).toBe("2026-07-07");
    expect(await getLatestDailyBriefing({ careerPathId: "operations" })).toBeNull();
  });

  test("today's row still wins when present (source 'briefing')", async () => {
    await persistDailyBriefing({
      careerPathId: "marketing-seo",
      briefingDate: "2026-07-07",
      briefing: fixtureBriefing(),
    });
    let built = 0;
    const result = await briefingNewsForPath({
      careerPathId: "marketing-seo",
      maxStories: 5,
      now: new Date("2026-07-07T22:00:00Z"),
      build: async () => {
        built += 1;
        return fixtureBriefing();
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toBe("briefing");
      expect(result.briefingDate).toBe("2026-07-07");
    }
    await waitForBackgroundBriefingBuilds();
    expect(built).toBe(0);
  });

  test("date boundary: when today's row is missing, the LATEST row is served immediately", async () => {
    // Miguel's live case: product-management briefing dated 2026-07-07
    // exists; the dashboard loads at ~02:00 UTC on 2026-07-08.
    await persistDailyBriefing({
      careerPathId: "product-management",
      briefingDate: "2026-07-07",
      briefing: fixtureBriefing({
        careerPathId: "product-management",
        careerPathName: "Product Management",
      }),
    });
    let built = 0;
    const result = await briefingNewsForPath({
      careerPathId: "product-management",
      maxStories: 5,
      now: new Date("2026-07-08T02:00:00Z"),
      build: async () => {
        built += 1;
        return fixtureBriefing({ careerPathId: "product-management", date: "2026-07-08" });
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toBe("briefing_stale");
      expect(result.briefingDate).toBe("2026-07-07");
      // Real, grounded stories from the stored briefing — never global cache.
      expect(result.stories[0].url).toBe("https://real.example.com/top");
    }
    // Yesterday's briefing is <24h old — the daily cron owns its refresh, so
    // no on-demand rebuild fires for a night-owl dashboard load.
    await waitForBackgroundBriefingBuilds();
    expect(built).toBe(0);
  });

  test("stale >24h: latest row served immediately AND today's regenerated in the background", async () => {
    await persistDailyBriefing({
      careerPathId: "marketing-seo",
      briefingDate: "2026-07-05",
      briefing: fixtureBriefing({ date: "2026-07-05" }),
    });
    let built = 0;
    const result = await briefingNewsForPath({
      careerPathId: "marketing-seo",
      maxStories: 5,
      now: new Date("2026-07-08T02:00:00Z"),
      build: async () => {
        built += 1;
        return fixtureBriefing({ date: "2026-07-08" });
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Served instantly from the stale row — generation happens off-path.
      expect(result.source).toBe("briefing_stale");
      expect(result.briefingDate).toBe("2026-07-05");
    }
    await waitForBackgroundBriefingBuilds();
    expect(built).toBe(1);
    const refreshed = await getDailyBriefing({ careerPathId: "marketing-seo", briefingDate: "2026-07-08" });
    expect(refreshed?.briefing.date).toBe("2026-07-08");
  });

  test("background regeneration failure never breaks serving the stale briefing", async () => {
    await persistDailyBriefing({
      careerPathId: "marketing-seo",
      briefingDate: "2026-07-01",
      briefing: fixtureBriefing({ date: "2026-07-01" }),
    });
    const result = await briefingNewsForPath({
      careerPathId: "marketing-seo",
      maxStories: 5,
      now: new Date("2026-07-08T02:00:00Z"),
      build: async () => {
        throw new Error("BRIEFING_TOP_STORY_MISSING");
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toBe("briefing_stale");
      expect(result.briefingDate).toBe("2026-07-01");
    }
    await expect(waitForBackgroundBriefingBuilds()).resolves.not.toThrow();
  });

  test("no rows at all: on-demand generation still runs (blocking) and persists today's row", async () => {
    let built = 0;
    const result = await briefingNewsForPath({
      careerPathId: "operations",
      maxStories: 5,
      now: new Date("2026-07-08T02:00:00Z"),
      build: async () => {
        built += 1;
        return fixtureBriefing({ careerPathId: "operations", date: "2026-07-08" });
      },
    });
    expect(built).toBe(1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toBe("briefing");
      expect(result.briefingDate).toBe("2026-07-08");
    }
    const persisted = await getDailyBriefing({ careerPathId: "operations", briefingDate: "2026-07-08" });
    expect(persisted).not.toBeNull();
  });

  test("runtime news path consults the briefing chain BEFORE any global_cache fallback", () => {
    const runtimeSource = readFileSync(path.resolve(process.cwd(), "apps/web/lib/runtime.ts"), "utf8");
    const fnStart = runtimeSource.indexOf("export async function runtimeRefreshRelevantNews");
    const fnEnd = runtimeSource.indexOf("export async function runtimeCreateDailyUpdate");
    expect(fnStart).toBeGreaterThan(-1);
    const fnSlice = runtimeSource.slice(fnStart, fnEnd);
    const briefingCallAt = fnSlice.indexOf("briefingNewsForPath(");
    const firstGlobalCacheAt = fnSlice.indexOf('"global_cache"');
    expect(briefingCallAt).toBeGreaterThan(-1);
    expect(firstGlobalCacheAt).toBeGreaterThan(-1);
    // global_cache is a LAST resort after the briefing chain fails, never a
    // pre-emptive short-circuit.
    expect(briefingCallAt).toBeLessThan(firstGlobalCacheAt);
  });
});
