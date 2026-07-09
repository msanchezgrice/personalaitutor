import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { themeBootScript } from "../../apps/web/lib/theme-script";

/**
 * Live bug (2026-07-09): https://www.myaiskilltutor.com/dashboard/admin/signups
 * never loaded. theme-script held data-runtime-ready="0" for ALL /dashboard/*
 * paths, and the globals.css hold hides the [data-gemini-shell] until the
 * Gemini runtime flips the attribute. Admin pages are fully server-rendered —
 * the runtime has nothing to hydrate there — and gemini-runtime.js only runs
 * afterInteractive, so any hydration stall left the page hidden forever.
 *
 * Fix: admin paths never hold for the runtime (theme-script), and
 * hydrateCurrentPath treats /dashboard/admin/* as a known no-op hydration
 * that marks the runtime ready (belt-and-suspenders).
 */

function runThemeBoot(pathname: string) {
  const htmlAttrs: Record<string, string> = {};
  const documentElement = {
    setAttribute: (key: string, value: string) => {
      htmlAttrs[key] = value;
    },
    style: {} as Record<string, string>,
  };
  const doc = {
    documentElement,
    readyState: "complete",
    addEventListener: () => undefined,
    getElementById: () => null,
    createElement: () => ({ style: {}, setAttribute: () => undefined }),
    querySelector: () => null,
    body: {
      setAttribute: () => undefined,
      appendChild: () => undefined,
    },
  };
  const win = {
    location: { pathname },
    requestAnimationFrame: () => 0,
    addEventListener: () => undefined,
    getComputedStyle: () => ({
      getPropertyValue: () => "",
      position: "",
      paddingLeft: "0",
    }),
  };
  new Function("window", "document", themeBootScript)(win, doc);
  return htmlAttrs;
}

describe("first-paint runtime hold skips server-rendered admin pages", () => {
  test("regular dashboard pages still hold for the runtime", () => {
    expect(runThemeBoot("/dashboard")["data-runtime-ready"]).toBe("0");
    expect(runThemeBoot("/dashboard/ai-news")["data-runtime-ready"]).toBe("0");
  });

  test("admin dashboard pages reveal without waiting for the runtime", () => {
    expect(runThemeBoot("/dashboard/admin")["data-runtime-ready"]).toBe("1");
    expect(runThemeBoot("/dashboard/admin/signups")["data-runtime-ready"]).toBe("1");
    expect(runThemeBoot("/dashboard/admin/signups/")["data-runtime-ready"]).toBe("1");
    expect(runThemeBoot("/dashboard/admin/analytics")["data-runtime-ready"]).toBe("1");
  });

  test("non-dashboard pages are unaffected", () => {
    expect(runThemeBoot("/")["data-runtime-ready"]).toBe("1");
    expect(runThemeBoot("/employers/talent")["data-runtime-ready"]).toBe("1");
  });

  test("admin pages still hold for styles like the rest of the dashboard", () => {
    expect(runThemeBoot("/dashboard/admin/signups")["data-style-ready"]).toBe("0");
  });
});

describe("gemini-runtime treats admin paths as a known no-op hydration", () => {
  const runtimePath = path.resolve(process.cwd(), "apps/web/public/gemini-runtime.js");
  const source = readFileSync(runtimePath, "utf8");
  const section = source.slice(
    source.indexOf("async function hydrateCurrentPath"),
    source.indexOf("function syncPathAttributes"),
  );

  test("admin paths mark the runtime ready and never redirect", () => {
    const adminBranch = section.slice(
      section.indexOf('currentPath.indexOf("/dashboard/admin") === 0'),
      section.indexOf("currentPath.indexOf(\"/dashboard/\") === 0"),
    );
    expect(adminBranch).toContain('setAttribute("data-runtime-ready", "1")');
    expect(adminBranch).toContain("admin_noop");
    expect(adminBranch).not.toContain("window.location.replace");
  });

  test("the unknown-path redirect fallback still excludes admin paths", () => {
    expect(section).toContain('currentPath.indexOf("/dashboard/admin") !== 0');
    expect(section).toContain('window.location.replace("/dashboard/")');
  });
});
