import * as React from "react";
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server.node.js";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { captureAnalyticsEvent } = vi.hoisted(() => ({ captureAnalyticsEvent: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ captureAnalyticsEvent }));

import RemappedIndexPage from "@/app/remapped/page";
import RemappedRoutePage, { generateMetadata, generateStaticParams, revalidate } from "@/app/remapped/[slug]/page";
import { listRemappedRoutes } from "@/lib/remapped/routes";

vi.stubGlobal("React", React);

function text(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, " ");
}

describe("Remapped pages", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-25T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("index lists published routes newest first with dates and links to /map", () => {
    const html = renderToStaticMarkup(RemappedIndexPage());
    const body = text(html);
    expect(body).toContain("One new career, remapped every week");
    expect(body).toContain("Don't see your job? Map your own.");
    expect(html).toContain('href="/map"');
    const order = listRemappedRoutes(new Date()).map((route) => html.indexOf(`href="/remapped/${route.slug}"`));
    for (const index of order) expect(index).toBeGreaterThan(-1);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(body).toContain("November 23, 2026");
    expect(html).not.toContain("copywriter-to-ai-content-strategist");
    expect(body.toLowerCase()).not.toContain("coming soon");
    expect(html).toContain('"@type":"CollectionPage"');
  });

  test("route page renders the full route with JSON-LD and the map CTA", async () => {
    const html = renderToStaticMarkup(await RemappedRoutePage({ params: Promise.resolve({ slug: "qa-tester-to-model-evaluator" }) }));
    const body = text(html);
    expect(body).toContain("QA Tester to Model Evaluator");
    expect(body).toContain("November 16, 2026");
    expect(body).toContain("Writes the test cases and grading rules"); // catalog blurb
    expect(body).toContain("Writes evaluation cases");
    expect(body).toContain("Build a small public eval for one AI task");
    expect(body).toContain("What stays hard");
    expect(body).toContain("Get this done for your own résumé. Free, about a minute.");
    expect(html).toContain('href="/map"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('"@type":"Article"');
    expect(html).toContain("rm-routemap");
    expect((html.match(/<li class="[^"]*step/g) ?? []).length).toBe(6);
    const relatedLinks = html.match(/href="\/remapped\/[a-z0-9-]+"/g) ?? [];
    expect(relatedLinks.length).toBeGreaterThanOrEqual(2);
    expect(relatedLinks.length).toBeLessThanOrEqual(3);
    expect(relatedLinks).not.toContain('href="/remapped/qa-tester-to-model-evaluator"');
  });

  test("future-dated and unknown slugs 404", async () => {
    await expect(RemappedRoutePage({ params: Promise.resolve({ slug: "copywriter-to-ai-content-strategist" }) })).rejects.toThrow();
    await expect(RemappedRoutePage({ params: Promise.resolve({ slug: "nope" }) })).rejects.toThrow();
    const meta = await generateMetadata({ params: Promise.resolve({ slug: "copywriter-to-ai-content-strategist" }) });
    expect(meta.robots).toMatchObject({ index: false });
  });

  test("static params cover published routes only; metadata is canonical with OG; revalidates daily", async () => {
    const params = generateStaticParams().map((entry) => entry.slug);
    expect(params).toHaveLength(6);
    expect(params).not.toContain("copywriter-to-ai-content-strategist");
    expect(revalidate).toBe(86400);
    const meta = await generateMetadata({ params: Promise.resolve({ slug: "marketing-manager-to-go-to-market-engineer" }) });
    expect(meta.alternates?.canonical).toBe("/remapped/marketing-manager-to-go-to-market-engineer");
    expect(String(meta.title)).toContain("Marketing Manager to Go-to-Market Engineer");
    expect(meta.openGraph).toMatchObject({ type: "article" });
  });
});
