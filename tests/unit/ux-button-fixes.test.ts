import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server.node.js";
import { DailyActionCard } from "../../apps/web/components/daily-action-card";

/**
 * C. Mislabeled / no-feedback buttons.
 * (1) "View Public Page" must open the actual public project page when
 *     published, and honestly say "Publish Settings" when it can only go to
 *     profile settings.
 * (2) "Get Today's Action" must give feedback on the first click: buttons
 *     stay disabled until React hydrates so a click can never be silently
 *     swallowed, and the handler flips to a pending state synchronously.
 */

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("view public page button", () => {
  const source = read("apps/web/app/dashboard/projects/page.tsx");

  test("published projects link to the actual public project page", () => {
    expect(source).toContain("projects/${completedProject.slug}/");
    expect(source).toContain("publicProjectUrl");
  });

  test("unpublished fallback is honestly labeled Publish Settings", () => {
    expect(source).toContain('publicProjectUrl ? "View Public Page" : "Publish Settings"');
    // The profile-settings fallback only remains behind the honest label.
    expect(source).toContain('publicProjectUrl || "/dashboard/profile"');
    expect(source).not.toContain('state.publicProfileUrl || "/dashboard/profile"');
  });
});

describe("daily action button feedback", () => {
  test("buttons render disabled until hydration (no silently-dropped first click)", () => {
    const html = renderToStaticMarkup(
      createElement(DailyActionCard, {
        initialAction: null,
        initialStreak: { current: 0, longest: 0 },
      }),
    );
    expect(html).toContain("Get Today&#x27;s Action");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>/);
  });

  test("handler shows a pending state synchronously and guards re-entry", () => {
    const source = read("apps/web/components/daily-action-card.tsx");
    expect(source).toContain("const [ready, setReady] = useState(false)");
    expect(source).toContain("disabled={!ready || busy}");
    expect(source.match(/if \(busy\) return;/g)?.length).toBe(2);
    // Result or error always surfaces: explicit error branches remain.
    expect(source).toContain("Daily action generation failed");
  });
});
