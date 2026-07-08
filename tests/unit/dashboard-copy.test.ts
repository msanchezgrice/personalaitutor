import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { isDashboardCopyNoise, sanitizeDashboardCopy } from "../../apps/web/lib/dashboard-copy";

/**
 * Live E2E fix (2026-07-07 night, finding #3): the Home hero leaked raw
 * event-log text — "start here: AI Tutor reply generated for: hey". Chat and
 * event-log bookkeeping messages must never surface as dashboard copy; when
 * every candidate is noise, the default line renders instead.
 */

const pagePath = path.resolve(process.cwd(), "apps/web/app/dashboard/page.tsx");
const runtimePath = path.resolve(process.cwd(), "apps/web/public/gemini-runtime.js");

describe("sanitizeDashboardCopy", () => {
  test("blocks chat/event-log bookkeeping patterns", () => {
    expect(sanitizeDashboardCopy("AI Tutor reply generated for: hey")).toBe("");
    expect(sanitizeDashboardCopy("Reply generated for: what should I do next")).toBe("");
    expect(sanitizeDashboardCopy("ai tutor REPLY GENERATED for: hey")).toBe("");
    expect(sanitizeDashboardCopy("Queued memory.refresh job")).toBe("");
  });

  test("passes real copy through unchanged", () => {
    expect(sanitizeDashboardCopy("You shipped the ICP interview guide — next up: synthesize findings.")).toBe(
      "You shipped the ICP interview guide — next up: synthesize findings.",
    );
  });

  test("empty and nullish input stays empty", () => {
    expect(sanitizeDashboardCopy("")).toBe("");
    expect(sanitizeDashboardCopy(null)).toBe("");
    expect(sanitizeDashboardCopy(undefined)).toBe("");
    expect(sanitizeDashboardCopy("   ")).toBe("");
  });

  test("isDashboardCopyNoise matches the patterns case-insensitively", () => {
    expect(isDashboardCopyNoise("AI Tutor reply generated for: hey")).toBe(true);
    expect(isDashboardCopyNoise("reply generated for: x")).toBe(true);
    expect(isDashboardCopyNoise("memory.refresh")).toBe(true);
    expect(isDashboardCopyNoise("Ship one concrete task today.")).toBe(false);
  });
});

describe("dashboard home hero uses the shared sanitizer", () => {
  test("the server page imports the shared sanitizer instead of a local copy", () => {
    const source = readFileSync(pagePath, "utf8");
    expect(source).toContain('from "@/lib/dashboard-copy"');
    expect(source).not.toContain("function sanitizeDashboardCopy");
  });

  test("the continuation line (buildLog) is sanitized too", () => {
    const source = readFileSync(pagePath, "utf8");
    const continuation = source.slice(source.indexOf("const continuationText"), source.indexOf("const skills"));
    expect(continuation).toContain("sanitizeDashboardCopy(");
  });

  test("gemini-runtime filters the same noise patterns from hero copy candidates", () => {
    const source = readFileSync(runtimePath, "utf8");
    expect(source).toContain('"ai tutor reply generated"');
    expect(source).toContain('"reply generated for"');
    // All three hero copy selectors go through the noise filter.
    const eventFn = source.slice(source.indexOf("function latestEventMessage"), source.indexOf("function latestBuildLogMessage"));
    const buildLogFn = source.slice(source.indexOf("function latestBuildLogMessage"), source.indexOf("function latestChatCacheMessage"));
    const chatCacheFn = source.slice(source.indexOf("function latestChatCacheMessage"), source.indexOf("var narrowViewport"));
    expect(eventFn).toContain("isDashboardCopyNoise(");
    expect(buildLogFn).toContain("isDashboardCopyNoise(");
    expect(chatCacheFn).toContain("isDashboardCopyNoise(");
  });
});
