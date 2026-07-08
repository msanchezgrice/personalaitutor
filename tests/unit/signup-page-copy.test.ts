import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const signUpPagePath = path.resolve(process.cwd(), "apps/web/app/sign-up/[[...sign-up]]/page.tsx");

/**
 * UX audit F3 (2026-07-07): the sign-up side panel claimed the report is
 * gated behind an account ("Create your account first so we can save your
 * answers... email your results") — false since Phase 1 made the assessment
 * anonymous and already emailed the report. The panel now sells what an
 * account actually adds: saving the score and raising it.
 */
describe("sign-up page copy (F3)", () => {
  const source = readFileSync(signUpPagePath, "utf8");

  test("legacy account-gated assessment copy is gone", () => {
    expect(source).not.toContain("Create your account first so we can save your answers");
    expect(source).not.toContain("Get your AI assessment report by email");
    expect(source).not.toContain("sent to your inbox when complete");
  });

  test("panel sells raising the score, not unlocking the report", () => {
    expect(source).toContain("Your score is saved");
    expect(source).toMatch(/rais(e|ing)/i);
    expect(source).toMatch(/tutor session/i);
  });
});
