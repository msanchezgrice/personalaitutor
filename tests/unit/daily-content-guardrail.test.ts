import { describe, expect, test } from "vitest";
import {
  composeBriefing,
  contentHash,
  validateBriefing,
  CAREER_PATH_CATEGORY_MAP,
  type DailyBriefing,
  type FeedItem,
  type FetchStats,
} from "@aitutor/daily-content";

const NOW = new Date("2026-07-07T12:00:00.000Z");

function baseBriefing(overrides: Partial<DailyBriefing> = {}): DailyBriefing {
  return {
    careerPathId: "marketing-seo",
    careerPathName: "Marketing & SEO",
    date: "2026-07-07",
    dayOfWeek: 2,
    dowTheme: "Tool Tuesday",
    dowBlurb: "A tool worth trying today",
    topStory: {
      headline: "Real story",
      summary: "Grounded summary",
      source: "TechCrunch AI",
      url: "https://real.example.com/top",
      published: "2026-07-07T09:00:00Z",
      trendingScore: 1,
    },
    quickHits: [
      {
        headline: "Real hit",
        summary: "Grounded",
        source: "The Verge AI",
        url: "https://real.example.com/hit",
        published: "2026-07-07T08:00:00Z",
        trendingScore: 1,
      },
    ],
    sources: [
      { name: "TechCrunch AI", url: "https://real.example.com/top" },
      { name: "The Verge AI", url: "https://real.example.com/hit" },
    ],
    toolOfTheDay: null,
    byTheNumbers: null,
    fetchedCount: 2,
    feedsOk: 2,
    feedsFail: 0,
    validated: false,
    ...overrides,
  };
}

const FETCHED = new Set(["https://real.example.com/top", "https://real.example.com/hit"]);

describe("briefing guardrail (validateBriefing)", () => {
  test("clean briefing passes and is marked validated", () => {
    const validated = validateBriefing(baseBriefing(), FETCHED);
    expect(validated.validated).toBe(true);
    expect(validated.topStory?.url).toBe("https://real.example.com/top");
    expect(validated.quickHits).toHaveLength(1);
  });

  test("fabricated quick-hit URL -> block dropped, briefing survives", () => {
    const briefing = baseBriefing({
      quickHits: [
        ...baseBriefing().quickHits,
        {
          headline: "Fabricated",
          summary: "Made up",
          source: "Nowhere",
          url: "https://fabricated.example.com/story",
          published: "",
          trendingScore: 1,
        },
      ],
    });
    const validated = validateBriefing(briefing, FETCHED);
    expect(validated.quickHits.map((hit) => hit.url)).toEqual(["https://real.example.com/hit"]);
  });

  test("fabricated source URL -> source dropped", () => {
    const briefing = baseBriefing({
      sources: [...baseBriefing().sources, { name: "Ghost", url: "https://ghost.example.com/x" }],
    });
    const validated = validateBriefing(briefing, FETCHED);
    expect(validated.sources.map((source) => source.url)).toEqual([
      "https://real.example.com/top",
      "https://real.example.com/hit",
    ]);
  });

  test("top story with a non-fetched URL -> dropped -> HARD FAILURE", () => {
    const briefing = baseBriefing({
      topStory: {
        headline: "Fabricated top",
        summary: "Made up",
        source: "Nowhere",
        url: "https://fabricated.example.com/top",
        published: "",
        trendingScore: 1,
      },
    });
    expect(() => validateBriefing(briefing, FETCHED)).toThrowError("BRIEFING_TOP_STORY_MISSING");
  });

  test("missing top story is a hard failure even when quick hits exist", () => {
    const briefing = baseBriefing({ topStory: null });
    expect(() => validateBriefing(briefing, FETCHED)).toThrowError("BRIEFING_TOP_STORY_MISSING");
  });

  test("empty fetched set can never validate", () => {
    expect(() => validateBriefing(baseBriefing(), new Set())).toThrowError("BRIEFING_TOP_STORY_MISSING");
  });
});

describe("composeBriefing end-to-end guardrail", () => {
  const category = CAREER_PATH_CATEGORY_MAP["marketing-seo"];
  const stats: FetchStats = { ok: 1, fail: 0, totalFeeds: 1, totalItems: 2, failures: [] };

  function feedItem(url: string, title: string, summary: string): FeedItem {
    return {
      url,
      originalUrl: url,
      title,
      summary,
      source: "TechCrunch AI",
      tier: "press",
      published: "2026-07-07T09:00:00Z",
      contentHash: contentHash(url, title),
    };
  }

  test("compose validates against the fetched set and emits sources for rendered items", async () => {
    const items = [
      feedItem("https://real.example.com/a", "AI marketing tools launch", "Generative AI advertising update."),
      feedItem("https://real.example.com/b", "Content marketing agents", "AI content marketing workflows."),
    ];
    const briefing = await composeBriefing({
      category,
      items,
      fetchedUrls: new Set(items.map((entry) => entry.url)),
      stats,
      now: NOW,
      summarize: async (entries) => entries, // skip LLM in unit tests
    });

    expect(briefing.validated).toBe(true);
    expect(briefing.topStory).not.toBeNull();
    expect(briefing.sources.length).toBeGreaterThan(0);
    for (const source of briefing.sources) {
      expect(["https://real.example.com/a", "https://real.example.com/b"]).toContain(source.url);
    }
    // Curation-only blocks are never fabricated.
    expect(briefing.toolOfTheDay).toBeNull();
    expect(briefing.byTheNumbers).toBeNull();
  });

  test("no fetched items -> hard failure, never an invented briefing", async () => {
    await expect(
      composeBriefing({
        category,
        items: [],
        fetchedUrls: new Set(),
        stats: { ...stats, ok: 0, fail: 1, totalItems: 0 },
        now: NOW,
        summarize: async (entries) => entries,
      }),
    ).rejects.toThrowError("BRIEFING_TOP_STORY_MISSING");
  });

  test("a summarizer that drifts a URL cannot smuggle it past the guardrail", async () => {
    const items = [
      feedItem("https://real.example.com/a", "AI marketing tools launch", "Generative AI advertising update."),
    ];
    await expect(
      composeBriefing({
        category,
        items,
        fetchedUrls: new Set(items.map((entry) => entry.url)),
        stats,
        now: NOW,
        summarize: async (entries) =>
          entries.map((entry) => ({ ...entry, url: "https://attacker.example.com/hijack" })),
      }),
    ).rejects.toThrowError("BRIEFING_TOP_STORY_MISSING");
  });
});
