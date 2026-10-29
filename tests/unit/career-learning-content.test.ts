import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { getLearnArticleBySlug, getLearnArticles } from "@/lib/learn-content";

const slugs = ["ai-skills-for-resume", "my-job-is-disappearing", "career-change-after-gaming-layoff", "how-to-get-a-job-in-the-age-of-ai", "career-mapping-transferable-skills", "career-remapping-workbook"];

describe("published career guides", () => {
  test("makes all approved guides discoverable while preserving the existing library", () => {
    for (const slug of [...slugs, "ai-upskilling-roadmap", "how-to-build-an-ai-portfolio", "prove-ai-skills-to-employers"]) {
      expect(getLearnArticleBySlug(slug), slug).not.toBeNull();
    }
    const all = getLearnArticles();
    expect(new Set(all.map(a => a.slug)).size).toBe(all.length);
    expect(new Set(all.map(a => a.metaTitle ?? a.title)).size).toBe(all.length);
  });

  test("keeps section anchors, table columns, related guides, and learning links valid", () => {
    for (const slug of slugs) {
      const article = getLearnArticleBySlug(slug);
      expect(article, slug).not.toBeNull();
      if (!article) continue;
      expect(article.faq.length).toBeGreaterThan(0);
      expect(new Set(article.sections.map(s => s.id)).size).toBe(article.sections.length);
      for (const related of article.relatedSlugs) expect(getLearnArticleBySlug(related), related).not.toBeNull();
      for (const section of article.sections) {
        for (const block of section.blocks ?? []) {
          if (block.type === "table") for (const row of block.rows) expect(row.length).toBe(block.columns.length);
          for (const match of JSON.stringify(block).matchAll(/\]\((\/learn\/[^)#?]+)\)/g)) {
            expect(getLearnArticleBySlug(match[1].split("/").pop()!), match[1]).not.toBeNull();
          }
        }
      }
    }
  });

  test("links the open workbook to an actual PDF asset rather than a signup or placeholder", () => {
    const workbook = getLearnArticleBySlug("career-remapping-workbook");
    expect(workbook?.resource?.download).toBe(true);
    expect(workbook?.resource?.href).toBe("/downloads/career-remapping-workbook.pdf");
    const pdf = readFileSync(resolve("apps/web/public/downloads/career-remapping-workbook.pdf"));
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
