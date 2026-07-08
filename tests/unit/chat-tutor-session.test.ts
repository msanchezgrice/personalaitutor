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

/**
 * Live E2E fix (2026-07-07 night, finding #6): old generic chat replies
 * ("install pandas") persisted above new tutor-session messages with nothing
 * marking the boundary. A subtle divider now marks where the session starts.
 * History is NEVER deleted — the divider is additive context only.
 */
describe("tutor session divider in chat history", () => {
  test("a divider element marks where the tutor session starts", () => {
    expect(chatSection).toContain("data-chat-session-divider");
    expect(chatSection).toContain("earlier messages are from generic chat");
  });

  test("the divider is a persisted history entry so it survives reloads", () => {
    // Divider entries round-trip through the cached history with their own role.
    expect(chatSection).toContain('"divider"');
    expect(chatSection).toMatch(/hasSessionDivider\(/);
  });

  test("starting a session from chat inserts the divider before the first session message", () => {
    const startFn = chatSection.slice(
      chatSection.indexOf("async function startTutorSessionFromChat"),
      chatSection.indexOf("function persistChatHistory"),
    );
    expect(startFn).toMatch(/divider/i);
  });

  test("hydrating with an active session and restored history adds the divider once", () => {
    // The restore path inserts the divider through the once-guard (which
    // checks hasSessionDivider before appending).
    const restoreSection = chatSection.slice(
      chatSection.indexOf("var cachedMessages"),
      chatSection.indexOf("async function sendMessage"),
    );
    expect(restoreSection).toMatch(/insertSessionDividerOnce\(/);
    const onceGuard = chatSection.slice(
      chatSection.indexOf("function insertSessionDividerOnce"),
      chatSection.indexOf("function renderMessage"),
    );
    expect(onceGuard).toMatch(/hasSessionDivider\(/);
  });

  test("history is never cleared when a session is active (divider is additive)", () => {
    // The only history reset is the initial hydration blank — no session-mode
    // cache clearing exists.
    expect(chatSection).not.toContain("clearChatHistoryCache");
  });
});
