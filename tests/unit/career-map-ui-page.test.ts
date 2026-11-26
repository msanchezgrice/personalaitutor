import { beforeEach, describe, expect, test, vi } from "vitest";
import React, { createElement } from "react";

// Foundation components (components/remap/*) rely on the automatic JSX runtime;
// vitest compiles JSX with the classic runtime, so React has to be global here.
(globalThis as { React?: typeof React }).React = React;
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server.node.js";
import { EXAMPLE_CAREER_MAP, EXAMPLE_CAREER_MAP_INPUT, type CareerMapRecord } from "@aitutor/shared";

const { mockFind, mockGetAuthSeed, mockCookieValue } = vi.hoisted(() => ({
  mockFind: vi.fn(),
  mockGetAuthSeed: vi.fn(),
  mockCookieValue: { current: null as string | null },
}));

vi.mock("@/lib/career-map/store", () => ({ findCareerMapByToken: mockFind }));
vi.mock("@/lib/auth", () => ({ getAuthSeed: mockGetAuthSeed }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (mockCookieValue.current ? { value: mockCookieValue.current } : undefined) }),
}));
// Components resolve `next` from apps/web/node_modules, so mock that exact file.
vi.mock("../../apps/web/node_modules/next/navigation.js", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/lib/analytics", () => ({
  captureAnalyticsEvent: vi.fn(),
  getOrCreateFunnelVisitorId: vi.fn(() => "visitor_test"),
}));

/** next/navigation notFound() digest (or the mocked message). */
const NOT_FOUND = /NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/;

const TOKEN = "tok_abcdefghijklmnopqrstuvwx";

function record(overrides: Partial<CareerMapRecord> = {}): CareerMapRecord {
  return {
    id: "map-1",
    token: TOKEN,
    status: "completed",
    source: "paste",
    inputText: EXAMPLE_CAREER_MAP_INPUT,
    map: EXAMPLE_CAREER_MAP,
    model: "test-model",
    failureReason: null,
    email: null,
    emailCapturedAt: null,
    mapEmailSentAt: null,
    learnerProfileId: null,
    linkedAt: null,
    visitorId: null,
    ipHash: null,
    createdAt: "2026-11-25T00:00:00.000Z",
    updatedAt: "2026-11-25T00:00:00.000Z",
    ...overrides,
  };
}

async function renderPage(token: string) {
  const { default: Page } = await import("../../apps/web/app/map/[token]/page");
  const element = await Page({ params: Promise.resolve({ token }) });
  return renderToStaticMarkup(createElement(() => element));
}

beforeEach(() => {
  mockFind.mockReset();
  mockGetAuthSeed.mockReset();
  mockGetAuthSeed.mockResolvedValue(null);
  mockCookieValue.current = null;
});

describe("/map/[token] page", () => {
  test("calls notFound for an unknown token", async () => {
    mockFind.mockResolvedValue(null);
    await expect(renderPage(TOKEN)).rejects.toThrow(NOT_FOUND);
    expect(mockFind).toHaveBeenCalledWith(TOKEN);
  });

  test("rejects malformed tokens without touching the store", async () => {
    await expect(renderPage("bad token!")).rejects.toThrow(NOT_FOUND);
    await expect(renderPage("%E0%A4%A")).rejects.toThrow(NOT_FOUND);
    expect(mockFind).not.toHaveBeenCalled();
  });

  test("renders a completed map with the signed-out CTA and the email form", async () => {
    mockFind.mockResolvedValue(record());
    const html = await renderPage(TOKEN);
    expect(html).toContain("Go-to-Market Engineer");
    expect(html).toContain("Email me my map");
    expect(html).toContain("/sign-up?redirect_url=%2Fdashboard%2Fproof&amp;from=map");
    expect(html).not.toContain(EXAMPLE_CAREER_MAP_INPUT.split("\n")[2]); // never leaks raw input beyond quotes
  });

  test("signed-in viewer gets the dashboard CTA and no email form", async () => {
    mockFind.mockResolvedValue(record());
    mockGetAuthSeed.mockResolvedValue({ userId: "user_1" });
    const html = await renderPage(TOKEN);
    expect(html).not.toContain("Email me my map");
    expect(html).toContain('href="/dashboard/proof"');
  });

  test("hides the email form when the map already has an email", async () => {
    mockFind.mockResolvedValue(record({ email: "person@example.com" }));
    const html = await renderPage(TOKEN);
    expect(html).not.toContain("Email me my map");
    expect(html).not.toContain("person@example.com");
  });

  test("generating and failed records render their own states", async () => {
    mockFind.mockResolvedValue(record({ status: "generating", map: null }));
    expect(await renderPage(TOKEN)).toContain('data-testid="career-map-generating"');

    mockFind.mockResolvedValue(record({ status: "failed", map: null, failureReason: "CAREER_MAP_INVALID_OUTPUT:UNGROUNDED" }));
    const failed = await renderPage(TOKEN);
    expect(failed).toContain('data-testid="career-map-failed"');
    expect(failed).toContain('href="/map"');
    expect(failed).not.toContain("UNGROUNDED");
  });

  test("metadata: route title with an arrow, noindex, OG image route", async () => {
    mockFind.mockResolvedValue(record());
    const { generateMetadata } = await import("../../apps/web/app/map/[token]/page");
    const metadata = await generateMetadata({ params: Promise.resolve({ token: TOKEN }) });
    expect(metadata.title).toBe("Senior Marketing Manager → Go-to-Market Engineer | My AI Skill Tutor");
    expect(metadata.robots).toEqual({ index: false, follow: false });
    const images = metadata.openGraph?.images as Array<{ url: string; width: number; height: number }>;
    expect(images[0].url).toMatch(new RegExp(`/api/og/map/${TOKEN}$`));
    expect(images[0]).toMatchObject({ width: 1200, height: 630 });
    expect((metadata.twitter as { card?: string }).card).toBe("summary_large_image");
  });

  test("metadata for missing and unfinished maps stays noindex", async () => {
    const { generateMetadata } = await import("../../apps/web/app/map/[token]/page");
    mockFind.mockResolvedValue(null);
    expect((await generateMetadata({ params: Promise.resolve({ token: TOKEN }) })).robots).toEqual({ index: false, follow: false });
    mockFind.mockResolvedValue(record({ status: "generating", map: null }));
    const pending = await generateMetadata({ params: Promise.resolve({ token: TOKEN }) });
    expect(pending.robots).toEqual({ index: false, follow: false });
    expect(pending.openGraph).toBeUndefined();
  });
});

describe("GET /api/og/map/[token]", () => {
  test("returns a JSON 404 for an unknown token", async () => {
    mockFind.mockResolvedValue(null);
    const { GET } = await import("../../apps/web/app/api/og/map/[token]/route");
    const res = await GET(new Request("http://localhost/api/og/map/x"), { params: Promise.resolve({ token: TOKEN }) });
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ ok: false, error: { code: "CAREER_MAP_NOT_FOUND" } });
  });
});

describe("og image element", () => {
  test("shows the old title, the route and the new title from the catalog", async () => {
    const { careerMapOgElement, genericCareerMapOgElement } = await import("../../apps/web/components/career-map/og-image");
    const element = careerMapOgElement(EXAMPLE_CAREER_MAP);
    expect(element).not.toBeNull();
    const html = renderToStaticMarkup(element!);
    expect(html).toContain("Senior Marketing Manager");
    expect(html).toContain("Go-to-Market Engineer");
    expect(html).toContain("Your route");
    expect(html).toContain("Growth line");
    expect(html).toContain("Game Studio");
    expect(careerMapOgElement({ ...EXAMPLE_CAREER_MAP, primary: { ...EXAMPLE_CAREER_MAP.primary, titleId: "nope" } })).toBeNull();
    expect(renderToStaticMarkup(genericCareerMapOgElement())).toContain("Find your new job title");
  });
});
