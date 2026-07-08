import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

/**
 * Live E2E fix (2026-07-07 night, finding #2): /dashboard/news (an unknown
 * dashboard path — the real route is /dashboard/ai-news) hung on the
 * first-paint spinner forever. Root cause: the theme-boot script holds
 * `data-runtime-ready="0"` for EVERY /dashboard/* path, but only real
 * dashboard pages mount `gemini-runtime.js` (which flips the flag). An
 * unmatched path rendered the root 404 without the runtime, so the shell
 * loader never released.
 *
 * Fix is two layers:
 * 1. A server-side catch-all under /dashboard redirects unknown paths home
 *    before anything paints.
 * 2. gemini-runtime's hydrateCurrentPath gains a belt-and-suspenders fallback:
 *    an unknown dashboard path marks the runtime ready and redirects to
 *    /dashboard/ instead of hanging.
 */

const catchAllPath = path.resolve(process.cwd(), "apps/web/app/dashboard/[...missing]/page.tsx");
const runtimePath = path.resolve(process.cwd(), "apps/web/public/gemini-runtime.js");

describe("unknown /dashboard/* paths never hang on the first-paint spinner", () => {
  test("a dashboard catch-all route exists and redirects to /dashboard", () => {
    const source = readFileSync(catchAllPath, "utf8");
    expect(source).toContain('from "next/navigation"');
    expect(source).toMatch(/redirect\(\s*["']\/dashboard["']/);
  });

  test("the catch-all does not shadow any real dashboard route", () => {
    // Catch-all segments only match when no static segment does, but guard
    // against someone renaming it to a fixed segment later.
    expect(catchAllPath).toContain("[...missing]");
  });

  test("hydrateCurrentPath falls back for unknown dashboard paths: runtime-ready + redirect", () => {
    const source = readFileSync(runtimePath, "utf8");
    const start = source.indexOf("async function hydrateCurrentPath");
    const end = source.indexOf("function syncPathAttributes");
    expect(start).toBeGreaterThan(-1);
    const section = source.slice(start, end);
    // Unknown dashboard path → mark ready (release the shell hold) and go home.
    expect(section).toContain('setAttribute("data-runtime-ready", "1")');
    expect(section).toContain('window.location.replace("/dashboard/")');
    // Admin pages have no runtime hydration and must never be redirected.
    expect(section).toContain("/dashboard/admin");
  });

  test("known dashboard routes keep their dedicated hydration (no accidental redirects)", () => {
    const source = readFileSync(runtimePath, "utf8");
    const section = source.slice(
      source.indexOf("async function hydrateCurrentPath"),
      source.indexOf("function syncPathAttributes"),
    );
    for (const known of [
      '"/dashboard"',
      '"/dashboard/projects"',
      '"/dashboard/chat"',
      '"/dashboard/social"',
      '"/dashboard/ai-news"',
      '"/dashboard/updates"',
      '"/dashboard/profile"',
    ]) {
      expect(section).toContain("currentPath === " + known);
    }
  });
});
