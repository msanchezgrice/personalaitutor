import { describe, expect, test } from "vitest";
import {
  canonicalizeUrl,
  contentHash,
  dedupeItems,
  extractKeywords,
  rankForCategory,
  recencyDecay,
  type FeedItem,
} from "@aitutor/daily-content";

const NOW = new Date("2026-07-07T12:00:00.000Z");

function item(overrides: Partial<FeedItem>): FeedItem {
  const url = overrides.url ?? "https://example.com/story";
  const title = overrides.title ?? "A story";
  return {
    url,
    originalUrl: overrides.originalUrl ?? url,
    title,
    summary: overrides.summary ?? "",
    source: overrides.source ?? "Example Feed",
    tier: overrides.tier ?? "press",
    published: overrides.published ?? "2026-07-07T09:00:00Z",
    contentHash: overrides.contentHash ?? contentHash(url, title),
    trendingScore: overrides.trendingScore,
  };
}

describe("canonicalizeUrl", () => {
  test("strips tracking params, keeps meaningful ones", () => {
    expect(canonicalizeUrl("https://example.com/a?utm_source=x&utm_medium=y&id=7")).toBe(
      "https://example.com/a?id=7",
    );
  });

  test("unwraps nested redirect wrappers without network calls", () => {
    const wrapped = `https://redirect.example.com/r?url=${encodeURIComponent("https://real.example.com/story?utm_campaign=z")}`;
    expect(canonicalizeUrl(wrapped)).toBe("https://real.example.com/story");
  });

  test("lowercases host, drops fragment and trailing slash", () => {
    expect(canonicalizeUrl("https://Example.COM/Path/To/Story/#section")).toBe(
      "https://example.com/Path/To/Story",
    );
    expect(canonicalizeUrl("https://example.com/")).toBe("https://example.com/");
  });

  test("falls back to the original on garbage input", () => {
    expect(canonicalizeUrl("not a url")).toBe("not a url");
    expect(canonicalizeUrl("")).toBe("");
  });
});

describe("dedupeItems", () => {
  test("collapses same-story items across feeds and counts trending", () => {
    const items = [
      item({ url: "https://a.com/x", title: "OpenAI launches agents", source: "TechCrunch AI", tier: "press" }),
      item({ url: "https://b.com/y", title: "OpenAI Launches Agents!", source: "The Verge AI", tier: "press" }),
      item({ url: "https://openai.com/blog/agents", title: "openai launches agents", source: "OpenAI Blog", tier: "primary" }),
    ];
    const deduped = dedupeItems(items);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].trendingScore).toBe(3);
    // Highest-trust representative wins (primary > press).
    expect(deduped[0].tier).toBe("primary");
    expect(deduped[0].source).toBe("OpenAI Blog");
  });

  test("same URL from the same feed does not inflate trending", () => {
    const one = item({ url: "https://a.com/x", title: "Story", source: "TechCrunch AI" });
    const deduped = dedupeItems([one, { ...one }]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].trendingScore).toBe(1);
  });

  test("distinct stories stay distinct", () => {
    const deduped = dedupeItems([
      item({ url: "https://a.com/1", title: "First distinct story" }),
      item({ url: "https://a.com/2", title: "Second distinct story" }),
    ]);
    expect(deduped).toHaveLength(2);
  });
});

describe("recencyDecay", () => {
  test("7-day half-life", () => {
    expect(recencyDecay("2026-07-07T12:00:00Z", NOW)).toBeCloseTo(1.0, 5);
    expect(recencyDecay("2026-06-30T12:00:00Z", NOW)).toBeCloseTo(0.5, 5);
    expect(recencyDecay("2026-06-23T12:00:00Z", NOW)).toBeCloseTo(0.25, 5);
  });

  test("unparseable or missing dates get the neutral 0.5", () => {
    expect(recencyDecay("", NOW)).toBe(0.5);
    expect(recencyDecay("not a date", NOW)).toBe(0.5);
  });

  test("parses RFC822 feed dates", () => {
    expect(recencyDecay("Tue, 07 Jul 2026 12:00:00 GMT", NOW)).toBeCloseTo(1.0, 5);
  });
});

describe("rankForCategory determinism", () => {
  const category = {
    name: "Marketing & SEO",
    searchTerms: "AI marketing tools, generative AI advertising, AI content marketing, programmatic SEO",
  };

  const fixtureItems: FeedItem[] = [
    item({
      url: "https://press.example.com/marketing-ai",
      title: "Generative AI advertising tools reshape marketing budgets",
      summary: "Marketing teams adopt AI content tooling for programmatic SEO.",
      tier: "press",
      published: "2026-07-06T12:00:00Z",
      trendingScore: 2,
    }),
    item({
      url: "https://lab.example.com/research-post",
      title: "A new large language model benchmark",
      summary: "Benchmarks and evaluation methodology.",
      tier: "research",
      published: "2026-07-07T11:00:00Z",
    }),
    item({
      url: "https://openai.example.com/marketing-agents",
      title: "Marketing agents for advertising content",
      summary: "First-party marketing tools announcement.",
      tier: "primary",
      published: "2026-07-05T12:00:00Z",
    }),
    item({
      url: "https://indie.example.com/off-topic",
      title: "A quiet week in chip supply chains",
      summary: "Nothing about the category here.",
      tier: "indie",
      published: "2026-07-07T11:59:00Z",
    }),
  ];

  test("ranking on fixture feeds is deterministic and relevance-dominant", () => {
    const first = rankForCategory(fixtureItems, category, { now: NOW });
    const second = rankForCategory([...fixtureItems].reverse(), category, { now: NOW });

    expect(first.map((entry) => entry.url)).toEqual([
      "https://press.example.com/marketing-ai",
      "https://openai.example.com/marketing-agents",
      // Both zero-overlap items score the same relevance floor; the fresher
      // one wins the recency tie-break.
      "https://indie.example.com/off-topic",
      "https://lab.example.com/research-post",
    ]);
    // Same input set in any order produces the same ranking.
    expect(second.map((entry) => entry.url)).toEqual(first.map((entry) => entry.url));
    // Off-topic-but-fresh never beats on-topic stories.
    expect(first[0].overlap).toBeGreaterThan(0);
    expect(first[first.length - 1].overlap).toBe(0);
  });

  test("scores are stable across runs for a fixed now", () => {
    const a = rankForCategory(fixtureItems, category, { now: NOW });
    const b = rankForCategory(fixtureItems, category, { now: NOW });
    expect(a.map((entry) => entry.score)).toEqual(b.map((entry) => entry.score));
  });

  test("keyword extraction drops stopwords and short tokens", () => {
    const keywords = extractKeywords("The new AI tools for a marketing team");
    expect(keywords.has("ai")).toBe(false);
    expect(keywords.has("the")).toBe(false);
    expect(keywords.has("tools")).toBe(true);
    expect(keywords.has("marketing")).toBe(true);
  });
});
