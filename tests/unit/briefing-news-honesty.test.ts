import { describe, expect, test } from "vitest";
import type { DailyBriefing } from "@aitutor/daily-content";
import { briefingToNewsStories } from "@/lib/daily-briefing";

/**
 * E. "Why relevant" / "Action" must be per-story and derived only from REAL
 * ranking signals: recomputed keyword matches against the path's search
 * terms (the same extractKeywords the ranking engine uses), the persisted
 * cross-feed trending count, and rank position. No fabrication.
 */

function story(input: {
  headline: string;
  summary?: string;
  source?: string;
  trendingScore?: number;
}) {
  return {
    headline: input.headline,
    summary: input.summary ?? "",
    source: input.source ?? "TechCrunch",
    url: "https://example.com/story",
    published: "2026-07-08T09:00:00Z",
    trendingScore: input.trendingScore ?? 1,
  };
}

function fixtureBriefing(): DailyBriefing {
  return {
    careerPathId: "marketing-seo",
    careerPathName: "Marketing & SEO",
    date: "2026-07-08",
    dayOfWeek: 2,
    dowTheme: "Tool Tuesday",
    dowBlurb: "New tools worth a look.",
    topStory: story({
      headline: "Programmatic SEO platform ships AI copywriting agents",
      summary: "Bulk content generation with keyword clustering built in.",
      source: "Search Engine Land",
      trendingScore: 3,
    }),
    quickHits: [
      story({
        headline: "Quarterly earnings beat expectations at chipmaker",
        summary: "Revenue rose on datacenter demand.",
        source: "Reuters",
        trendingScore: 1,
      }),
    ],
    sources: [
      { name: "Search Engine Land", url: "https://example.com/story" },
      { name: "Reuters", url: "https://example.com/story" },
    ],
    toolOfTheDay: null,
    byTheNumbers: null,
    fetchedCount: 100,
    feedsOk: 30,
    feedsFail: 2,
    validated: true,
  };
}

describe("briefing news honesty copy", () => {
  const stories = briefingToNewsStories(fixtureBriefing(), 5);

  test("whyRelevant is per-story, built from matched keywords and trending count", () => {
    expect(stories).toHaveLength(2);
    const [top, hit] = stories;

    expect(top.whyRelevant).not.toBe(hit.whyRelevant);
    // Real keyword match, quoted, from the path's actual search terms.
    expect(top.whyRelevant).toContain('Matched "');
    expect(top.whyRelevant).toContain("Marketing & SEO");
    // Real persisted trending signal.
    expect(top.whyRelevant).toContain("trending across 3 feeds");

    // The keyword-free story cannot claim a keyword match or trending.
    expect(hit.whyRelevant).not.toContain('Matched "');
    expect(hit.whyRelevant).not.toContain("trending across");
    expect(hit.whyRelevant).toContain("#2");
  });

  test("recommendedAction references the story topic, not a shared template", () => {
    const [top, hit] = stories;
    expect(top.recommendedAction).not.toBe(hit.recommendedAction);
    expect(top.recommendedAction).toContain("Programmatic SEO platform");
    expect(hit.recommendedAction).toContain("Quarterly earnings");
  });

  test("no invented signals: copy only cites keyword/trending/rank sources", () => {
    for (const entry of stories) {
      // Trust tier is not persisted per story, so it must never be claimed.
      expect(entry.whyRelevant.toLowerCase()).not.toContain("trust tier");
    }
  });
});
