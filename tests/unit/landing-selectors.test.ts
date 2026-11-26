import * as React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server.node.js";
import { describe, expect, test, vi } from "vitest";

import { LandingPage, type LandingPageProps } from "@/components/landing/landing-page";
import { HERO_MAP_FROM_HOME_PATH, HERO_MAP_PATH, submitHeroDraft } from "@/components/landing/hero-form";
import { LANDING_CTA_SELECTOR } from "@/components/home-page-tracking";
import { CAREER_MAP_DRAFT_STORAGE_KEY, CAREER_MAP_SIGNED_IN_HREF, CAREER_MAP_SIGNUP_HREF, LAUNCH_FILM_POSTER, LAUNCH_FILM_SRC } from "@/lib/career-map/constants";

vi.stubGlobal("React", React);

function render(overrides: Partial<LandingPageProps> = {}) {
  return renderToStaticMarkup(React.createElement(LandingPage, { signedIn: false, remappedRoutes: [], guides: [], ...overrides }));
}

/** The opening tag of the element carrying `data-testid="<id>"`. */
function tagFor(html: string, testId: string) {
  const at = html.indexOf(`data-testid="${testId}"`);
  if (at < 0) return null;
  const start = html.lastIndexOf("<", at);
  return html.slice(start, html.indexOf(">", at) + 1);
}

function attr(tag: string, name: string) {
  return tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1] ?? null;
}

describe("landing page selectors", () => {
  test("every primary CTA has its stable test id and an agent action", () => {
    const html = render();
    const expected: Array<[string, string, string | null]> = [
      ["cta-map-career-nav", "a", "/map"],
      ["cta-map-career-hero", "button", null],
      ["cta-upload-resume-hero", "a", "/map?upload=1"],
      ["cta-play-film", "button", null],
      ["cta-map-career-pricing", "a", "/map"],
      ["cta-start-trial-pricing", "a", CAREER_MAP_SIGNUP_HREF.replace(/&/g, "&amp;")],
      ["cta-map-career-bottom", "a", "/map"],
    ];
    for (const [testId, element, href] of expected) {
      const tag = tagFor(html, testId);
      expect(tag, testId).not.toBeNull();
      expect(tag!.startsWith(`<${element}`), testId).toBe(true);
      expect(attr(tag!, "data-agent-action"), testId).toBeTruthy();
      if (href) expect(attr(tag!, "href"), testId).toBe(href);
    }
    expect(html.match(/data-testid="cta-map-career-nav"/g)).toHaveLength(1);
  });

  test("hero submit is a real submit button inside a form that falls back to /map without JS", () => {
    const html = render();
    const form = tagFor(html, "hero-map-form")!;
    expect(attr(form, "action")).toBe("/map");
    expect(attr(form, "method")).toBe("get");
    expect(attr(tagFor(html, "cta-map-career-hero")!, "type")).toBe("submit");
    // The textarea has no name, so résumé text never lands in a URL.
    const textarea = html.slice(html.indexOf("<textarea"), html.indexOf(">", html.indexOf("<textarea")) + 1);
    expect(textarea).toContain('id="hero-background"');
    expect(textarea).not.toMatch(/\sname=/);
    expect(html).toContain('<label for="hero-background"');
  });

  test("pricing trial CTA goes to sign-up when signed out and to Proof Studio when signed in", () => {
    const signedOut = tagFor(render({ signedIn: false }), "cta-start-trial-pricing")!;
    expect(attr(signedOut, "href")).toBe(CAREER_MAP_SIGNUP_HREF.replace(/&/g, "&amp;"));

    const signedInHtml = render({ signedIn: true });
    const signedIn = tagFor(signedInHtml, "cta-start-trial-pricing")!;
    expect(attr(signedIn, "href")).toBe(CAREER_MAP_SIGNED_IN_HREF);
    expect(signedInHtml).toContain("Open Proof Studio");
    expect(signedInHtml).toContain("nav-dashboard");
  });

  test("launch film is a real video with poster, controls and lazy loading", () => {
    const html = render();
    const video = tagFor(html, "launch-film")!;
    expect(video.startsWith("<video")).toBe(true);
    expect(video).toMatch(/\scontrols=""/);
    expect(attr(video, "preload")).toBe("none");
    expect(attr(video, "poster")).toBe(LAUNCH_FILM_POSTER);
    expect(html).toContain(`<source src="${LAUNCH_FILM_SRC}" type="video/mp4"/>`);
    expect(attr(tagFor(html, "cta-play-film")!, "aria-label")).toBe("Play the film");
  });

  test("hero network map is inline SVG with an accessible description", () => {
    const html = render();
    const svg = tagFor(html, "hero-network-map")!;
    expect(svg.startsWith("<svg")).toBe(true);
    expect(attr(svg, "role")).toBe("img");
    expect(attr(svg, "aria-label")).toContain("A green route connects Marketing Manager to Go-to-Market Engineer.");
    for (const station of ["QA Tester", "Marketing Manager", "Copywriter", "Go-to-Market Engineer", "Model Evaluator", "No route, until now", "Maya"]) {
      expect(html).toContain(`>${station}</text>`);
    }
  });

  test("Remapped section lists up to five routes and is hidden when the library is empty", () => {
    expect(render({ remappedRoutes: [] })).not.toContain('id="remapped"');

    const routes = Array.from({ length: 7 }, (_, index) => ({ slug: `route-${index}`, fromTitle: `Old ${index}`, toTitle: `New ${index}` }));
    const html = render({ remappedRoutes: routes });
    expect(html).toContain('id="remapped"');
    expect(html.match(/href="\/remapped\/route-\d"/g)).toHaveLength(5);
    expect(html).toContain('href="/remapped/route-0"');
    expect(html).not.toContain('href="/remapped/route-5"');
    expect(html).toContain('href="/remapped" class="rm-btn rm-btn--secondary');
  });

  test("guides section links each guide and hides when there are none", () => {
    expect(render({ guides: [] })).not.toContain('data-testid="landing-guides"');
    const html = render({ guides: [{ slug: "my-job-is-disappearing", title: "My job is disappearing", description: "What to do next.", category: "Career Proof", readingTime: "7 min read" }] });
    expect(html).toContain('href="/learn/my-job-is-disappearing"');
    expect(html).toContain('href="/learn"');
  });

  test("page uses the rm design system and no legacy dark or Gemini shell markup", () => {
    const html = render();
    expect(html).toMatch(/<div class="rm [^"]*" data-testid="landing-page"/);
    expect(html).not.toContain("data-gemini-shell");
    expect(html).not.toMatch(/class="[^"]*\b(text-white|bg-black|glass|btn-primary)\b/);
    expect(html.indexOf('<header class="rm-header"')).toBeLessThan(html.indexOf("<h1"));
  });
});

describe("hero draft hand-off to /map", () => {
  function memoryStorage() {
    const data = new Map<string, string>();
    return { data, setItem: (key: string, value: string) => void data.set(key, value) };
  }

  test("stores the trimmed draft and goes to /map?from=home", () => {
    const storage = memoryStorage();
    expect(submitHeroDraft("  Senior marketing manager at a game studio  ", storage)).toBe(HERO_MAP_FROM_HOME_PATH);
    expect(HERO_MAP_FROM_HOME_PATH).toBe("/map?from=home");
    // One line of prose is a description; a multi-line résumé is a paste.
    expect(JSON.parse(storage.data.get(CAREER_MAP_DRAFT_STORAGE_KEY)!)).toEqual({ text: "Senior marketing manager at a game studio", source: "describe" });
    const resume = ["Maya Ortiz", "Senior Marketing Manager", "- Planned 4 launches", "- Wrote player emails", "- Grew a Discord community"].join("\n");
    submitHeroDraft(resume, storage);
    expect(JSON.parse(storage.data.get(CAREER_MAP_DRAFT_STORAGE_KEY)!)).toEqual({ text: resume, source: "paste" });
  });

  test("empty text goes to /map and stores nothing", () => {
    const storage = memoryStorage();
    expect(submitHeroDraft("   \n ", storage)).toBe(HERO_MAP_PATH);
    expect(storage.data.size).toBe(0);
  });

  test("blocked storage still reaches /map, without the auto-start", () => {
    expect(submitHeroDraft("Some text", null)).toBe("/map");
    const throwing = { setItem: () => { throw new Error("QuotaExceededError"); } };
    expect(submitHeroDraft("Some text", throwing)).toBe("/map");
  });
});

describe("landing tracking and first paint", () => {
  test("tracking selector covers map links, trial links and cta test ids", () => {
    expect(LANDING_CTA_SELECTOR).toContain("a[href^='/map']");
    expect(LANDING_CTA_SELECTOR).toContain("a[href*='/sign-up']");
    expect(LANDING_CTA_SELECTOR).toContain("[data-testid^='cta-']");
  });

  test("the landing stylesheet drops the first-paint loader once the page is in the DOM", () => {
    const css = readFileSync(path.resolve(process.cwd(), "apps/web/components/landing/landing.module.css"), "utf8");
    expect(css).toContain(':global(html[data-path="/"]):has(.page) :global([data-shell-loader="1"])');
  });

  test("hero map animation is CSS only and switched off for reduced motion", () => {
    const css = readFileSync(path.resolve(process.cwd(), "apps/web/components/landing/hero-network-map.module.css"), "utf8");
    const motionBlock = css.indexOf("@media (prefers-reduced-motion: no-preference)");
    expect(motionBlock).toBeGreaterThan(-1);
    // Every animation declaration lives inside the no-preference block.
    const firstAnimation = css.indexOf("animation:");
    expect(firstAnimation).toBeGreaterThan(motionBlock);
  });
});
