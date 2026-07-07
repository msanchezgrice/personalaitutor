import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

/**
 * Nav cleanup (rebuild dashboard batch item 5): "Social Drafts" is removed
 * from the dashboard navigation everywhere it renders, but the underlying
 * route and hydration stay intact so direct URL access keeps working.
 */

const shellPath = path.resolve(process.cwd(), "apps/web/components/dashboard-runtime-shell.tsx");
const sidebarPath = path.resolve(process.cwd(), "apps/web/components/dashboard-sidebar.tsx");
const runtimePath = path.resolve(process.cwd(), "apps/web/public/gemini-runtime.js");

describe("dashboard nav cleanup: Social Drafts", () => {
  test("the dashboard shell nav has no Social Drafts entry", () => {
    const source = readFileSync(shellPath, "utf8");
    const navItemsBlock = source.slice(source.indexOf("const navItems"), source.indexOf("function navLinkClassName"));
    expect(navItemsBlock).not.toContain('"Social Drafts"');
    expect(navItemsBlock).not.toContain('"/dashboard/social"');
    // The rest of the nav is untouched.
    expect(navItemsBlock).toContain('"Chat Tutor"');
    expect(navItemsBlock).toContain('"AI News"');
    expect(navItemsBlock).toContain('"Activity"');
  });

  test("the legacy sidebar component has no Social Drafts entry", () => {
    const source = readFileSync(sidebarPath, "utf8");
    expect(source).not.toContain("Social Drafts");
    expect(source).not.toContain("/dashboard/social");
  });

  test("gemini-runtime never injects a Social Drafts nav entry", () => {
    const source = readFileSync(runtimePath, "utf8");
    // The runtime may reference /dashboard/social for page hydration and
    // legacy label rewrites, but must not create a nav link pointing at it.
    expect(source).not.toMatch(/createElement\("a"\)[\s\S]{0,400}\/dashboard\/social/);
  });

  test("the social route and its hydration remain for direct URL access", () => {
    expect(existsSync(path.resolve(process.cwd(), "apps/web/app/dashboard/social/page.tsx"))).toBe(true);
    const source = readFileSync(runtimePath, "utf8");
    expect(source).toContain('currentPath === "/dashboard/social"');
    expect(source).toContain("hydrateSocialPage");
  });
});
