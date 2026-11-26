import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test, vi } from "vitest";
import React, { createElement } from "react";

// Foundation components (components/remap/*) rely on the automatic JSX runtime;
// vitest compiles JSX with the classic runtime, so React has to be global here.
(globalThis as { React?: typeof React }).React = React;
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server.node.js";

vi.mock("@/lib/analytics", () => ({
  captureAnalyticsEvent: vi.fn(),
  getOrCreateFunnelVisitorId: vi.fn(() => "visitor_test"),
}));
// Components resolve `next` from apps/web/node_modules, so mock that exact file.
vi.mock("../../apps/web/node_modules/next/navigation.js", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/auth", () => ({ getAuthSeed: vi.fn(async () => null) }));

import { CareerMapInput } from "../../apps/web/components/career-map/career-map-input";

const root = path.resolve(__dirname, "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

describe("/map input", () => {
  test("offers paste, upload and describe, with the counter and privacy line", () => {
    const html = renderToStaticMarkup(createElement(CareerMapInput, {}));
    expect(html).toContain("Paste résumé");
    expect(html).toContain("Upload a file");
    expect(html).toContain("Describe your last job");
    expect(html).toContain("0 / 20,000 characters");
    expect(html).toContain("Your résumé is used to draw the map and nothing else.");
    expect(html).toContain("Map my career");
    expect(html).toMatch(/id="career-map-mode-paste"[^>]*checked/);
  });

  test("?upload=1 opens the upload flow", () => {
    const html = renderToStaticMarkup(createElement(CareerMapInput, { startWithUpload: true }));
    expect(html).toMatch(/id="career-map-mode-upload"[^>]*checked/);
    expect(html).toContain("Choose a file");
    expect(html).toContain("up to 4 MB");
    expect(html).toContain('accept=".pdf,.docx,.txt');
  });

  test("the page renders the header, intro and the form", async () => {
    const { default: Page } = await import("../../apps/web/app/map/page");
    const element = await Page({ searchParams: Promise.resolve({ from: "home", upload: "1" }) });
    const html = renderToStaticMarkup(createElement(() => element));
    expect(html).toContain("What did you do before?");
    expect(html).toMatch(/id="career-map-mode-upload"[^>]*checked/);
    expect(html).not.toContain('data-testid="cta-map-career-nav"');
  });

  test("calls the contracted API routes and reads the hero draft key", () => {
    const source = read("apps/web/components/career-map/career-map-input.tsx");
    expect(source).toContain('fetch("/api/career-map",');
    expect(source).toContain('fetch("/api/career-map/extract"');
    expect(source).toContain("CAREER_MAP_DRAFT_STORAGE_KEY");
    expect(source).toContain("removeItem(CAREER_MAP_DRAFT_STORAGE_KEY)");
    for (const event of ["career_map_started", "career_map_completed", "career_map_failed"]) expect(source).toContain(`"${event}"`);
    const actions = read("apps/web/components/career-map/career-map-actions.tsx");
    for (const event of ["career_map_viewed", "career_map_email_captured", "career_map_signup_clicked"]) expect(actions).toContain(`"${event}"`);
    expect(actions).toContain("/api/career-map/${encodeURIComponent(token)}/email");
  });
});
