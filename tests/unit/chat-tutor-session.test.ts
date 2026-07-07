import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

/**
 * Session-aware Chat Tutor tab (rebuild dashboard batch item 2).
 * The chat tab is hydrated entirely by the static Gemini runtime, so this
 * follows the repo's source-assertion convention for that file (see
 * billing-gate-theme.test.ts): the hydration must fetch the active project's
 * tutor session, surface step + checklist progress, route messages through
 * the session-aware endpoint, and offer a session entry point when none
 * exists — while generic project chat stays available as the fallback.
 */

const runtimePath = path.resolve(process.cwd(), "apps/web/public/gemini-runtime.js");
const source = readFileSync(runtimePath, "utf8");
const chatSection = source.slice(source.indexOf("async function hydrateChatPage"), source.indexOf("async function hydrateSocialPage"));

describe("session-aware chat tutor hydration", () => {
  test("chat hydration loads the tutor session for the resolved project", () => {
    expect(chatSection).toContain('"/tutor-session"');
  });

  test("messages route through the session-aware endpoint when a session is active", () => {
    expect(chatSection).toContain('"/tutor-session/message"');
    expect(chatSection).toMatch(/activeTutorSession\s*\?/);
  });

  test("generic project chat remains the fallback endpoint", () => {
    expect(chatSection).toContain('"/chat"');
  });

  test("the session banner surfaces current step and checklist progress", () => {
    expect(chatSection).toContain("data-chat-tutor-session-banner");
    expect(chatSection).toContain("Step ");
    expect(chatSection).toContain("Checklist ");
  });

  test("a start-session entry point exists when no session is active", () => {
    expect(chatSection).toContain("Start Tutor Session");
    // Starting posts to the session route (inline start), with the workbench as the alternate path.
    expect(chatSection).toMatch(/postJson\(tutorSessionUrl\(/);
    expect(chatSection).toContain("/dashboard/projects/#pack-workbench");
  });
});
