import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { DailyBriefing } from "@aitutor/daily-content";

/**
 * I. MAST→MDD briefing feed: after the news-refresh scheduler builds the 9
 * path briefings, per-MDD-career rows are mirrored into MDD's separate
 * Supabase `briefings` table so the career hubs' "latest briefing" stays
 * fresh. Env-gated (skips silently when MDD_SUPABASE_* unset), idempotent
 * upsert per (career_id, seniority, date), failure-isolated.
 */

import { feedBriefingsToMdd, type MddBriefingsClient } from "@/lib/mdd-briefing-feed";

const mockUpsert = vi.fn();
const stubClient: MddBriefingsClient = {
  from: () => ({ upsert: mockUpsert }),
};

function briefing(careerPathId: string, careerPathName: string): DailyBriefing {
  return {
    careerPathId,
    careerPathName,
    date: "2026-07-09",
    dayOfWeek: 4,
    dowTheme: "Deep-Dive Thursday",
    dowBlurb: "One story, properly understood.",
    topStory: {
      headline: "AI copilots reach general availability",
      summary: "Rollout across enterprise suites.",
      source: "TechCrunch",
      url: "https://example.com/top",
      published: "2026-07-09T08:00:00Z",
      trendingScore: 2,
    },
    quickHits: [
      {
        headline: "New agent framework released",
        summary: "Open source.",
        source: "VentureBeat",
        url: "https://example.com/hit",
        published: "2026-07-09T07:00:00Z",
        trendingScore: 1,
      },
    ],
    sources: [
      { name: "TechCrunch", url: "https://example.com/top" },
      { name: "VentureBeat", url: "https://example.com/hit" },
    ],
    toolOfTheDay: null,
    byTheNumbers: null,
    fetchedCount: 200,
    feedsOk: 34,
    feedsFail: 4,
    validated: true,
  };
}

describe("mdd briefing feed", () => {
  const originalUrl = process.env.MDD_SUPABASE_URL;
  const originalKey = process.env.MDD_SUPABASE_SERVICE_ROLE_KEY;

  beforeEach(() => {
    mockUpsert.mockReset();
    mockUpsert.mockResolvedValue({ error: null });
    process.env.MDD_SUPABASE_URL = "https://mdd.supabase.co";
    process.env.MDD_SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
  });

  afterEach(() => {
    process.env.MDD_SUPABASE_URL = originalUrl;
    process.env.MDD_SUPABASE_SERVICE_ROLE_KEY = originalKey;
  });

  test("skips silently (no client, no throw) when MDD envs are unset", async () => {
    delete process.env.MDD_SUPABASE_URL;
    delete process.env.MDD_SUPABASE_SERVICE_ROLE_KEY;

    const result = await feedBriefingsToMdd([briefing("marketing-seo", "Marketing & SEO")]);
    expect(result.skipped).toBe(true);
    if (result.skipped) expect(result.reason).toBe("MDD_ENV_MISSING");
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  test("fans one MAST path briefing out to every MDD career mapped to it", async () => {
    const result = await feedBriefingsToMdd([briefing("marketing-seo", "Marketing & SEO")], { client: stubClient });
    expect(result.skipped).toBe(false);
    if (result.skipped) return;

    // marketing-seo absorbs MDD "marketing" + "content-creation".
    expect(result.written.sort()).toEqual(["content-creation", "marketing"]);
    expect(mockUpsert).toHaveBeenCalledTimes(2);

    const [row, options] = mockUpsert.mock.calls[0];
    expect(options).toEqual({ onConflict: "career_id,seniority,date" });
    expect(row.seniority).toBe("Mid Level");
    expect(row.date).toBe("2026-07-09");
    expect(row.dow).toBe(4);
    expect(["marketing", "content-creation"]).toContain(row.career_id);
  });

  test("blocks_json matches MDD's snake_case contract exactly", async () => {
    await feedBriefingsToMdd([briefing("marketing-seo", "Marketing & SEO")], { client: stubClient });
    const [row] = mockUpsert.mock.calls.find(([r]) => r.career_id === "marketing")!;
    const blocks = row.blocks_json;

    expect(blocks.category_id).toBe("marketing");
    expect(blocks.category_name).toBe("Marketing");
    expect(blocks.date).toBe("July 09, 2026");
    expect(blocks.day_of_week).toBe(4);
    expect(blocks.dow_theme).toBe("Deep-Dive Thursday");
    expect(blocks.dow_blurb).toBe("One story, properly understood.");
    expect(blocks.seniority).toBe("Mid Level");
    expect(blocks.topStory).toEqual({
      headline: "AI copilots reach general availability",
      summary: "Rollout across enterprise suites.",
      source: "TechCrunch",
      url: "https://example.com/top",
      published: "2026-07-09T08:00:00Z",
      trending_score: 2,
    });
    expect(blocks.quickHits).toHaveLength(1);
    expect(blocks.quickHits[0].trending_score).toBe(1);
    expect(blocks.sources).toEqual([
      { name: "TechCrunch", url: "https://example.com/top" },
      { name: "VentureBeat", url: "https://example.com/hit" },
    ]);
    // Never fabricated — MDD kept these null and the hub renders no block.
    expect(blocks.toolOfTheDay).toBeNull();
    expect(blocks.byTheNumbers).toBeNull();
    expect(blocks.fetched_count).toBe(200);
    expect(blocks.feeds_ok).toBe(34);
    expect(blocks.feeds_fail).toBe(4);
  });

  test("retired MDD careers (legal, healthcare) are never written", async () => {
    const all = [
      briefing("product-management", "Product Management"),
      briefing("marketing-seo", "Marketing & SEO"),
      briefing("branding-design", "Branding & Design"),
      briefing("sales-revops", "Sales & RevOps"),
      briefing("customer-support", "Customer Support"),
      briefing("operations", "Operations"),
      briefing("human-resources", "Human Resources"),
      briefing("software-engineering", "Software Engineering"),
      briefing("quality-assurance", "Quality Assurance"),
    ];
    const result = await feedBriefingsToMdd(all, { client: stubClient });
    expect(result.skipped).toBe(false);
    if (result.skipped) return;

    // 15 MDD careers minus the 2 retired verticals = 13 rows.
    expect(result.written).toHaveLength(13);
    expect(result.written).not.toContain("legal");
    expect(result.written).not.toContain("healthcare");
    expect(result.failures).toHaveLength(0);
  });

  test("a single career write failure never fails the feed (isolation)", async () => {
    mockUpsert
      .mockResolvedValueOnce({ error: { message: "row level security" } })
      .mockResolvedValue({ error: null });

    const result = await feedBriefingsToMdd([briefing("marketing-seo", "Marketing & SEO")], { client: stubClient });
    expect(result.skipped).toBe(false);
    if (result.skipped) return;
    expect(result.written).toHaveLength(1);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].error).toContain("row level security");
  });

  test("the news-refresh pipeline hooks the feed in, failure-isolated", () => {
    const source = require("node:fs").readFileSync(
      require("node:path").resolve(process.cwd(), "apps/web/lib/daily-briefing.ts"),
      "utf8",
    );
    expect(source).toContain("feedBriefingsToMdd");
    // The MDD mirror must never fail the MAST refresh.
    expect(source).toContain("[mdd-feed]");
  });
});
