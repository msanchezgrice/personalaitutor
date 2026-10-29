import * as React from "react";
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server.node.js";
import { describe, expect, test, vi } from "vitest";

vi.mock("@/components/learning-header", () => ({ LearningHeader: () => null }));
vi.mock("@/components/learning-footer", () => ({ LearningFooter: () => null }));
vi.mock("@/lib/learn-content", () => {
  const article = {
    slug: "career-map-test", category: "Career Proof", title: "A longer visible title",
    metaTitle: "Career mapping examples", description: "A task-based career map.",
    heroSummary: "Map tasks, then build evidence.", readingTime: "5 min read",
    publishedAt: "2026-10-29", updatedAt: "2026-10-29", takeaways: [], keywords: [],
    relatedSlugs: [], faq: [], tool: "resume",
    resource: { href: "/downloads/career-remapping-workbook.pdf", label: "Download workbook (PDF)", description: "Use your own copy.", download: true },
    sections: [{ id: "map", title: "Map your work", paragraphs: [], blocks: [
      { type: "paragraph", text: "Start with **actual tasks** and [the proof guide](/learn/prove-ai-skills-to-employers)." },
      { type: "table", columns: ["Past work", "Next experiment"], rows: [["Games QA", "A synthetic reply checker"]] },
      { type: "quote", text: "This is a hypothesis, not a qualification." },
      { type: "list", ordered: true, items: ["Choose a task", "Check the result"] },
      { type: "paragraph", text: "<script>alert(1)</script> [unsafe](javascript:alert(1))" },
    ] }],
  };
  return { getLearnArticleBySlug: (slug: string) => slug === article.slug ? article : null, getLearnArticles: () => [article] };
});

import LearnArticlePage, { generateMetadata } from "@/app/learn/[slug]/page";
vi.stubGlobal("React", React);

describe("structured learning guides", () => {
  test("keeps tables, quotes, lists and inline emphasis readable in their authored order", async () => {
    const html = renderToStaticMarkup(await LearnArticlePage({ params: Promise.resolve({ slug: "career-map-test" }) }));
    expect(html).toContain("<strong>actual tasks</strong>");
    expect(html).toContain('<th scope="col"');
    expect(html).toContain("Games QA");
    expect(html).toContain("overflow-x-auto");
    expect(html).toContain("<blockquote");
    expect(html).toContain("<ol");
    expect(html.indexOf("<table")).toBeLessThan(html.indexOf("<blockquote"));
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain('href="javascript:');
  });

  test("offers the real downloadable resource and a distinct search title", async () => {
    const html = renderToStaticMarkup(await LearnArticlePage({ params: Promise.resolve({ slug: "career-map-test" }) }));
    expect(html).toMatch(/href="\/downloads\/career-remapping-workbook.pdf"[^>]*download/);
    expect(html).toContain("Download workbook (PDF)");
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: "career-map-test" }) });
    expect(metadata.title).toBe("Career mapping examples | My AI Skill Tutor");
    expect(metadata.alternates?.canonical).toBe("/learn/career-map-test");
  });

  test("embeds a usable career exercise on its guide", async () => {
    const html = renderToStaticMarkup(await LearnArticlePage({ params: Promise.resolve({ slug: "career-map-test" }) }));
    expect(html).toContain('id="career-tool"');
    expect(html).toContain("Resume evidence builder");
    expect(html).toContain("What did you actually do?");
    expect(html).toContain("ph-no-capture");
  });
});
