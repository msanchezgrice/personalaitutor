import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

/**
 * Live E2E fix (2026-07-07 night, finding #5): the Tool Launchers cards
 * rendered one word per line — fixed 2/3-column tracks squeezed the cards
 * far below a readable width inside the workbench's split grid. The launcher
 * grid now uses intrinsic minimum-width columns (auto-fill + minmax) so a
 * card can never collapse below a readable width, and the card content is
 * shrink-safe.
 */

const workbenchPath = path.resolve(process.cwd(), "apps/web/components/dashboard-project-workbench.tsx");

describe("workbench tool launcher layout", () => {
  const source = readFileSync(workbenchPath, "utf8");
  const section = source.slice(source.indexOf("Tool launchers"), source.indexOf("Generated tool draft"));

  test("launcher grid uses auto-fill minmax columns instead of fixed narrow tracks", () => {
    expect(section).toContain("repeat(auto-fill,minmax(");
    expect(section).not.toContain("md:grid-cols-2 xl:grid-cols-3");
  });

  test("launcher cards are shrink-safe", () => {
    expect(section).toContain("min-w-0");
  });
});
