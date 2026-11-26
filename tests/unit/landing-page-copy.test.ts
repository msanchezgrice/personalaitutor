import * as React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server.node.js";
import { describe, expect, test, vi } from "vitest";

import { LandingPage, type LandingPageProps } from "@/components/landing/landing-page";
import { LANDING_FAQS, LANDING_META_TITLE, LANDING_STATS } from "@/components/landing/landing-content";

vi.stubGlobal("React", React);

const homePagePath = path.resolve(process.cwd(), "apps/web/app/page.tsx");

const routes = [
  { slug: "qa-tester-to-model-evaluator", fromTitle: "QA Tester", toTitle: "Model Evaluator" },
  { slug: "game-designer-to-ai-environment-designer", fromTitle: "Game Designer", toTitle: "AI Environment Designer" },
];
const guides = [
  { slug: "career-mapping-transferable-skills", title: "Career mapping guide", description: "Map your work.", category: "Career Proof", readingTime: "6 min read" },
];

function render(overrides: Partial<LandingPageProps> = {}) {
  return renderToStaticMarkup(React.createElement(LandingPage, { signedIn: false, remappedRoutes: routes, guides, ...overrides }));
}

/** Visible text only, entities decoded, whitespace collapsed. */
function text(html: string) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

describe("landing page copy", () => {
  test("hero tells the career map story from the film", () => {
    const html = render();
    const body = text(html);
    expect(body).toContain("For people whose job title is disappearing");
    expect(html).toMatch(/<h1[^>]*>Your experience isn(&#x27;|')t obsolete\. It(&#x27;|')s <span class="rm-accent">unmapped\.<\/span><\/h1>/);
    expect(body).toContain("Tell us what you did before. We map it to the AI-era job it fits");
    expect(body).toContain("What did you do before?");
    expect(body).toContain("Map my career");
    expect(body).toContain("Upload résumé (PDF or Word)");
    expect(body).toContain("Free. No account needed. Takes about a minute.");
    expect(html.match(/<h1\b/g)).toHaveLength(1);
  });

  test("sections follow the design order", () => {
    const body = text(render());
    const headings = [
      "Your experience isn't obsolete",
      "The 65-second version",
      "Old jobs are closing. New ones are opening. Nobody drew the map between them.",
      "How the map gets drawn",
      "Maya's translation",
      "Then we help you prove it",
      "A site of your own",
      "A model tuned on your work",
      "A build log that shows the work",
      "One new career, remapped every week",
      "A tutor for the whole route",
      "The map is free. Building the proof is one plan.",
      "Questions people ask first",
      "Guides for the move",
      // The final call to action (the header's button carries the same words).
      "Find your new title Paste your résumé",
    ];
    const indexes = headings.map((heading) => body.indexOf(heading));
    expect(indexes.every((index) => index >= 0)).toBe(true);
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
  });

  test("pricing keeps the plan facts: free map, $49.99 Career Builder, 7-day free trial, card required", () => {
    const body = text(render());
    expect(body).toContain("Career map Free");
    expect(body).toContain("Career Builder");
    expect(body).toContain("$49.99");
    expect(body).toContain("per month, after a 7-day free trial");
    expect(body).toContain("Start 7-day free trial");
    expect(body).toContain("Card required to start the trial.");
    expect(body).toContain("Proof Studio: your site, your tuned model, your build log");
  });

  test("shows exactly the three sourced statistics, each with its source", () => {
    const body = text(render());
    expect(LANDING_STATS.map((stat) => stat.value)).toEqual(["1 in 3", "170M", "62%"]);
    expect(body).toContain("1 in 3 U.S. game workers surveyed were laid off in the last two years. Source: GDC State of the Game Industry 2026");
    expect(body).toContain("170M new jobs are expected worldwide by 2030. Source: World Economic Forum, Future of Jobs Report 2025");
    expect(body).toContain("62% average pay premium for workers with AI skills. Source: PwC 2026 Global AI Jobs Barometer");
  });

  test("makes no fabricated social proof or forbidden claims", () => {
    const html = render();
    const body = text(html).toLowerCase();
    for (const banned of [
      "cryptographic",
      "public proof",
      "system verified",
      "testimonial",
      "trusted by",
      "join thousands",
      "learners",
      "customers",
      "users",
      "rated",
      "★",
      "unlock",
      "seamless",
      "supercharge",
      "game-changer",
    ]) {
      expect(body, banned).not.toContain(banned);
    }
    // Every percentage or large number on the page is one of the sourced stats or the price.
    const numbers = body.match(/\b\d[\d,.]*\s?(%|m\b|k\b)/g) ?? [];
    const allowed = new Set(["62%", "170m", "12m", "90k"]);
    for (const value of numbers) expect(allowed.has(value.replace(/\s/g, "")), value).toBe(true);
    // No emoji.
    expect(html).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  test("labels Maya as an example wherever she appears", () => {
    const html = render();
    const body = text(html);
    expect(body).toContain("Example: Maya, a game-studio marketing manager, remapped to Go-to-Market Engineer.");
    expect(body).toContain("Maya and her studio are fictional.");
    const example = html.slice(html.indexOf('data-testid="landing-example"'));
    expect(text(example.slice(0, 600))).toContain("Example");
    for (const label of ["Example of a proof site", "Example of a voice model comparison", "Example of a build log post"]) {
      const start = html.indexOf(`aria-label="${label}"`);
      expect(start, label).toBeGreaterThan(-1);
      expect(text(html.slice(start, start + 900))).toContain("Example");
    }
  });

  test("describes the voice model as tuned in context", () => {
    const body = text(render());
    expect(body).toContain("Method: Voice profile + examples in context.");
    expect(body).toContain("Yes, in context: we build a voice profile from your samples");
  });

  test("renders every FAQ from the shared list", () => {
    const body = text(render());
    expect(LANDING_FAQS).toHaveLength(5);
    for (const entry of LANDING_FAQS) {
      expect(body).toContain(entry.question);
      expect(body).toContain(entry.answer);
    }
  });

  test("homepage metadata matches the career map positioning", () => {
    const source = readFileSync(homePagePath, "utf8");
    expect(LANDING_META_TITLE).toBe("Find Your New Job Title for the AI Era | My AI Skill Tutor");
    expect(source).toContain("title: LANDING_META_TITLE");
    expect(source).toContain("description: LANDING_META_DESCRIPTION");
    expect(source).not.toContain("GeminiStaticPage");
    expect(source).not.toContain("AI Upskilling for Working Professionals");
  });
});
