import { describe, expect, test } from "vitest";
import { CAREER_PATHS } from "@aitutor/shared";
import {
  CAREER_PATH_CATEGORIES,
  CAREER_PATH_CATEGORY_MAP,
  FEEDS,
  MDD_CAREER_MAPPINGS,
  getCareerPathCategory,
} from "@aitutor/daily-content";

/** The 15 career ids from MDD's config.py:27-43 — the mapping must account for all of them. */
const MDD_CAREER_IDS = [
  "product-management",
  "marketing",
  "sales",
  "operations",
  "hr-people",
  "design",
  "finance",
  "engineering",
  "data-science",
  "customer-success",
  "content-creation",
  "consulting",
  "legal",
  "healthcare",
  "entrepreneurship",
];

describe("taxonomy mapping completeness", () => {
  test("every MAST career path has a category with non-empty search terms", () => {
    expect(CAREER_PATHS).toHaveLength(9);
    for (const path of CAREER_PATHS) {
      const category = getCareerPathCategory(path.id);
      expect(category, `missing category for ${path.id}`).not.toBeNull();
      expect(category!.searchTerms.trim().length, `empty search terms for ${path.id}`).toBeGreaterThan(10);
      expect(category!.name).toBe(path.name);
    }
    expect(CAREER_PATH_CATEGORIES).toHaveLength(9);
  });

  test("every MDD career id is accounted for exactly once (mapped or explicitly retired)", () => {
    const mappedIds = MDD_CAREER_MAPPINGS.map((entry) => entry.mddId).sort();
    expect(mappedIds).toEqual([...MDD_CAREER_IDS].sort());
    // No duplicates.
    expect(new Set(mappedIds).size).toBe(MDD_CAREER_IDS.length);
    // Retired careers must say why.
    for (const entry of MDD_CAREER_MAPPINGS) {
      if (entry.mastPathId === null) {
        expect(entry.retiredReason, `${entry.mddId} retired without a reason`).toBeTruthy();
      } else {
        expect(
          CAREER_PATHS.some((path) => path.id === entry.mastPathId),
          `${entry.mddId} maps to unknown MAST path ${entry.mastPathId}`,
        ).toBe(true);
      }
    }
  });

  test("merged search terms carry the MDD ancestor vocabulary", () => {
    const marketing = CAREER_PATH_CATEGORY_MAP["marketing-seo"];
    expect(marketing.mddSources.sort()).toEqual(["content-creation", "marketing"]);
    expect(marketing.searchTerms).toContain("AI marketing tools");
    expect(marketing.searchTerms).toContain("AI content creation");

    const engineering = CAREER_PATH_CATEGORY_MAP["software-engineering"];
    expect(engineering.mddSources.sort()).toEqual(["data-science", "engineering"]);
    expect(engineering.searchTerms).toContain("AI coding tools");
    expect(engineering.searchTerms).toContain("AI data science");
  });

  test("paths without an MDD ancestor still get adapted search terms", () => {
    const qa = CAREER_PATH_CATEGORY_MAP["quality-assurance"];
    expect(qa.mddSources).toEqual([]);
    expect(qa.searchTerms.toLowerCase()).toContain("test automation");
  });

  test("unknown path id returns null", () => {
    expect(getCareerPathCategory("astronaut")).toBeNull();
  });
});

describe("feed source list", () => {
  test("ships the full MDD feed roster with trust tiers", () => {
    expect(FEEDS.length).toBeGreaterThanOrEqual(35);
    const tiers = new Set(FEEDS.map((feed) => feed.tier));
    expect(tiers).toEqual(new Set(["primary", "press", "research", "indie"]));
    for (const feed of FEEDS) {
      expect(feed.url).toMatch(/^https:\/\//);
      expect(feed.source.trim().length).toBeGreaterThan(0);
    }
    // No duplicate URLs.
    expect(new Set(FEEDS.map((feed) => feed.url)).size).toBe(FEEDS.length);
  });
});
