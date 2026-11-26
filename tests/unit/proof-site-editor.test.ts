import { describe, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import React, { createElement } from "react";
// eslint-disable-next-line import/no-relative-packages -- matches existing test convention
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server.node.js";
import { EXAMPLE_CAREER_MAP, type ProofSite } from "@aitutor/shared";

vi.stubGlobal("React", React);
vi.mock("@/lib/analytics", () => ({ captureAnalyticsEvent: vi.fn() }));

import { SiteEditor, type SiteEditorInitial } from "@/components/proof/site-editor";

const SITE: ProofSite = {
  learnerProfileId: "p1",
  careerMapId: "m1",
  newTitle: "Go-to-Market Engineer",
  previousRole: "Senior Marketing Manager",
  tagline: "I turn launch plans into AI workflows.",
  bio: "Seven years of launches and lifecycle email, now built as AI workflows.",
  translations: [{ before: "Planned 4 global game launches", now: "Builds AI launch workflows" }],
  contactEmail: null,
  linkedinUrl: null,
  createdAt: "2026-11-24T00:00:00.000Z",
  updatedAt: "2026-11-24T00:00:00.000Z",
};

const MAP_VIEW = { token: "tok", status: "completed" as const, map: EXAMPLE_CAREER_MAP, createdAt: "2026-11-24T00:00:00.000Z", hasEmail: false, linked: true };

function render(overrides: Partial<SiteEditorInitial>) {
  const initial: SiteEditorInitial = {
    site: null,
    profile: { handle: "pat-rivera", name: "Pat Rivera", published: false },
    map: null,
    siteUrl: "https://www.myaiskilltutor.com",
    ...overrides,
  };
  return renderToStaticMarkup(createElement(SiteEditor, { initial }));
}

describe("proof site editor states", () => {
  test("no map yet: sends them to /map", () => {
    const html = render({});
    expect(html).toContain('data-testid="proof-site-no-map"');
    expect(html).toContain('href="/map"');
    expect(html).not.toContain("Draft it from my map");
    expect(html).not.toContain("<form");
  });

  test("map but no site: offers the draft", () => {
    const html = render({ map: MAP_VIEW });
    expect(html).toContain('data-testid="proof-site-draft-offer"');
    expect(html).toContain("Draft it from my map");
    expect(html).toContain("Your map points to Go-to-Market Engineer.");
  });

  test("saved draft: form, preview and publish", () => {
    const html = render({ site: SITE, map: MAP_VIEW });
    expect(html).toContain('data-state="draft"');
    expect(html).toContain("Not published");
    expect(html).toContain('data-testid="proof-site-publish"');
    expect(html).toContain(">Preview<");
    expect(html).toContain('href="/u/pat-rivera"');
    expect(html).toContain("<form");
    expect(html).toContain('value="Go-to-Market Engineer"');
    expect(html).toContain("Redraft from my map");
    expect(html).not.toContain("Unpublish");
  });

  test("published: public URL, copy link, view page, unpublish", () => {
    const html = render({ site: SITE, profile: { handle: "pat-rivera", name: "Pat Rivera", published: true } });
    expect(html).toContain('data-state="live"');
    expect(html).toContain("https://www.myaiskilltutor.com/u/pat-rivera");
    expect(html).toContain("Copy link");
    expect(html).toContain("View page");
    expect(html).toContain('data-testid="proof-site-unpublish"');
    expect(html).not.toContain('data-testid="proof-site-publish"');
  });

  test("fires proof_site_published only after a successful publish call", () => {
    const source = readFileSync(path.resolve(process.cwd(), "apps/web/components/proof/site-editor.tsx"), "utf8");
    const publishBody = source.slice(source.indexOf("async function publish()"), source.indexOf("async function unpublish()"));
    expect(publishBody).toContain('"/api/profile/publish"');
    expect(publishBody.indexOf("if (!result.ok)")).toBeLessThan(publishBody.indexOf('captureAnalyticsEvent("proof_site_published"'));
  });
});
