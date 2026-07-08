import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const employersPagePath = path.resolve(process.cwd(), "apps/web/app/employers/page.tsx");

/**
 * UX audit F6 (2026-07-07): the employers page presented seeded synthetic
 * candidates as a live marketplace ("Verified candidates live now",
 * "System Verified"). The page stays (SEO/positioning) but every synthetic
 * surface is labeled as an example and the live-marketplace claims become
 * waitlist framing.
 */
describe("employers page honesty (F6)", () => {
  const source = readFileSync(employersPagePath, "utf8");

  test("no fabricated live-marketplace claims", () => {
    expect(source).not.toContain("Verified candidates live now");
    expect(source).not.toContain("proof pages available instantly");
    expect(source).not.toContain("System Verified");
  });

  test("candidates are labeled as examples with waitlist framing", () => {
    expect(source).toContain("Example candidates");
    expect(source).toContain("Example");
    expect(source).toMatch(/opening soon/i);
    expect(source).toContain("Join as a candidate");
  });
});
