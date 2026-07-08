import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const workbenchPath = path.resolve(process.cwd(), "apps/web/components/dashboard-project-workbench.tsx");
const projectsPagePath = path.resolve(process.cwd(), "apps/web/app/dashboard/projects/page.tsx");

/**
 * UX audit F4 (2026-07-07): the module workbench had four competing systems
 * (legacy per-step cards, tutor session, standalone Build Actions, Log
 * Progress). The tutor session is now the single spine: proof attaches inside
 * the session's current step, generation happens as the session finale (with
 * one skip-ahead escape hatch), and progress notes ARE the session evidence
 * notes. Underlying API endpoints all survive.
 */
describe("workbench single spine (F4)", () => {
  const source = readFileSync(workbenchPath, "utf8");

  test("legacy per-step cards with their own Attach Proof / Start buttons are gone", () => {
    expect(source).not.toContain(">Attach Proof<");
    expect(source).not.toContain('"step_update"');
    expect(source).not.toContain("/module-steps");
    expect(source).not.toContain("Step proof target");
  });

  test("standalone Build Actions generate buttons are gone", () => {
    expect(source).not.toContain("Generate Website Proof");
    expect(source).not.toContain("Build actions");
    expect(source).not.toContain(">Generate PDF<");
  });

  test("one skip-ahead escape hatch lives inside the session panel", () => {
    expect(source).toContain("Skip ahead");
    expect(source).toContain("generate from what I have");
    // Same generation endpoints, not new ones.
    expect(source).toContain("/generate-website");
    expect(source).toContain("/generate-artifact");
  });

  test("Log Progress card is merged into session evidence notes", () => {
    expect(source).not.toContain("Log progress");
    expect(source).not.toContain("Save Progress Note");
    expect(source).toContain("evidenceNote");
  });

  test("proof link + upload endpoints moved inside the session current step", () => {
    expect(source).toContain("/proof-link");
    expect(source).toContain("/proof-upload");
    expect(source).toContain("Attach evidence");
  });

  test("stale-playbook banner with restart is wired (F5)", () => {
    expect(source).toContain("Playbook updated");
    expect(source).toContain("restart: true");
  });

  test("projects page passes drift detection to the workbench (F5)", () => {
    const page = readFileSync(projectsPagePath, "utf8");
    expect(page).toContain("tutorSessionPlaybookDrifted");
    expect(page).toContain("initialPlaybookDrifted");
  });
});
