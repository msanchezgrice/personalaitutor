import { describe, expect, test } from "vitest";
import { CAREER_MAP_INPUT_MAX_CHARS, CAREER_MAP_INPUT_MIN_CHARS, CAREER_MAP_TITLES } from "@aitutor/shared";
import {
  CAREER_MAP_ERROR_CODES,
  CAREER_MAP_PROGRESS_STAGES,
  careerMapProgressMessage,
  checkCareerMapInput,
  checkUploadFile,
  describeCareerMapEmailError,
  describeCareerMapError,
  describeStoredFailure,
  formatCharacterCount,
  formatRetryAfter,
  isLikelyEmail,
  parseCareerMapDraft,
  shouldAutoStart,
} from "../../apps/web/components/career-map/input-helpers";

const enough = "Senior producer at a mobile game studio. Ran the release schedule for three live games.";

describe("career map input validation", () => {
  test("empty, short, ok and long inputs use the shared limits", () => {
    expect(checkCareerMapInput("   ")).toMatchObject({ ok: false, reason: "empty", chars: 0 });

    const short = checkCareerMapInput("Producer");
    expect(short).toMatchObject({ ok: false, reason: "short", chars: 8 });
    if (!short.ok) expect(short.message).toContain(`${CAREER_MAP_INPUT_MIN_CHARS - 8} more characters`);

    expect(checkCareerMapInput("x".repeat(CAREER_MAP_INPUT_MIN_CHARS))).toEqual({ ok: true, chars: CAREER_MAP_INPUT_MIN_CHARS });
    expect(checkCareerMapInput(`  ${"x".repeat(CAREER_MAP_INPUT_MAX_CHARS)}  `)).toEqual({ ok: true, chars: CAREER_MAP_INPUT_MAX_CHARS });

    const long = checkCareerMapInput("x".repeat(CAREER_MAP_INPUT_MAX_CHARS + 1234));
    expect(long).toMatchObject({ ok: false, reason: "long" });
    if (!long.ok) expect(long.message).toContain("1,234 characters over");
  });

  test("character counter formats against the max", () => {
    expect(formatCharacterCount(1204)).toBe("1,204 / 20,000 characters");
  });

  test("hero draft parsing is defensive", () => {
    expect(parseCareerMapDraft(null)).toBeNull();
    expect(parseCareerMapDraft("not json")).toBeNull();
    expect(parseCareerMapDraft(JSON.stringify({ text: "   " }))).toBeNull();
    expect(parseCareerMapDraft(JSON.stringify({ text: 42 }))).toBeNull();
    expect(parseCareerMapDraft(JSON.stringify({ text: enough }))).toEqual({ text: enough, source: "paste" });
    expect(parseCareerMapDraft(JSON.stringify({ text: enough, source: "describe" }))).toEqual({ text: enough, source: "describe" });
    expect(parseCareerMapDraft(JSON.stringify({ text: enough, source: "upload" }))?.source).toBe("paste");
  });

  test("auto-start needs from=home and a valid draft", () => {
    const draft = { text: enough, source: "paste" as const };
    expect(shouldAutoStart(draft, "home")).toBe(true);
    expect(shouldAutoStart(draft, null)).toBe(false);
    expect(shouldAutoStart(draft, "nav")).toBe(false);
    expect(shouldAutoStart({ text: "too short", source: "paste" }, "home")).toBe(false);
    expect(shouldAutoStart(null, "home")).toBe(false);
  });

  test("upload pre-check rejects legacy .doc and files over 4 MB", () => {
    expect(checkUploadFile({ name: "Resume.PDF", size: 1000 })).toEqual({ ok: true });
    expect(checkUploadFile({ name: "resume.docx", size: 1000 })).toEqual({ ok: true });
    expect(checkUploadFile({ name: "resume.txt", size: 1000 })).toEqual({ ok: true });
    expect(checkUploadFile({ name: "resume.doc", size: 1000 })).toEqual({ ok: false, code: "RESUME_FILE_UNSUPPORTED" });
    expect(checkUploadFile({ name: "resume.png", size: 1000 })).toEqual({ ok: false, code: "RESUME_FILE_UNSUPPORTED" });
    expect(checkUploadFile({ name: "resume.pdf", size: 5 * 1024 * 1024 + 1 })).toEqual({ ok: false, code: "RESUME_FILE_TOO_LARGE" });
  });

  test("email check", () => {
    expect(isLikelyEmail("person@example.com")).toBe(true);
    expect(isLikelyEmail(" person@example.co ")).toBe(true);
    expect(isLikelyEmail("person@example")).toBe(false);
    expect(isLikelyEmail("bad")).toBe(false);
  });
});

describe("career map progress copy", () => {
  test("messages advance with elapsed time and never show a percentage", () => {
    expect(careerMapProgressMessage(0)).toBe(CAREER_MAP_PROGRESS_STAGES[0].message);
    expect(careerMapProgressMessage(9)).toContain(`${CAREER_MAP_TITLES.length} AI-era titles`);
    expect(careerMapProgressMessage(20)).toContain("your own words");
    expect(careerMapProgressMessage(500)).toBe(CAREER_MAP_PROGRESS_STAGES[CAREER_MAP_PROGRESS_STAGES.length - 1].message);
    for (const stage of CAREER_MAP_PROGRESS_STAGES) expect(stage.message).not.toMatch(/%/);
    const thresholds = CAREER_MAP_PROGRESS_STAGES.map((stage) => stage.afterSeconds);
    expect([...thresholds].sort((a, b) => a - b)).toEqual(thresholds);
  });

  test("retry-after formatting", () => {
    expect(formatRetryAfter(30)).toBe("in a minute");
    expect(formatRetryAfter(2400)).toBe("in about 40 minutes");
    expect(formatRetryAfter(3600)).toBe("in about 1 hour");
    expect(formatRetryAfter(5 * 3600)).toBe("in about 5 hours");
    expect(formatRetryAfter(30 * 3600)).toBe("tomorrow");
  });
});

describe("career map error copy", () => {
  test("every API error code has its own human sentence and an action", () => {
    const titles = new Set<string>();
    for (const code of CAREER_MAP_ERROR_CODES) {
      const copy = describeCareerMapError({ code });
      expect(copy.code).toBe(code);
      expect(copy.title.length).toBeGreaterThan(8);
      expect(copy.message.length).toBeGreaterThan(20);
      expect(copy.actionLabel.length).toBeGreaterThan(3);
      expect(copy.message).not.toMatch(/[A-Z]{3,}_[A-Z]/); // never leaks a raw code
      titles.add(copy.title);
    }
    expect(titles.size).toBe(CAREER_MAP_ERROR_CODES.length);
  });

  test("actions fit the error", () => {
    expect(describeCareerMapError({ code: "INVALID_BODY" }).action).toBe("edit");
    expect(describeCareerMapError({ code: "CAREER_MAP_INPUT_TOO_SHORT" }).action).toBe("edit");
    expect(describeCareerMapError({ code: "OPENAI_CONFIG_MISSING" }).action).toBe("retry");
    expect(describeCareerMapError({ code: "RESUME_FILE_TOO_LARGE" }).action).toBe("upload");
    expect(describeCareerMapError({ code: "RESUME_FILE_UNSUPPORTED" }).message).toContain(".doc");
    expect(describeCareerMapError({ code: "RESUME_TEXT_NOT_FOUND" }).action).toBe("paste");
    expect(describeCareerMapError({ code: "CAREER_MAP_NOT_FOUND" }).action).toBe("start-over");
    expect(describeCareerMapError({ code: "NETWORK_ERROR" }).action).toBe("retry");
  });

  test("rate limit says when to come back", () => {
    const copy = describeCareerMapError({ code: "CAREER_MAP_RATE_LIMITED", status: 429, retryAfterSeconds: 2400 });
    expect(copy.action).toBe("wait");
    expect(copy.retryAfterSeconds).toBe(2400);
    expect(copy.message).toContain("in about 40 minutes");
    expect(describeCareerMapError({ code: "CAREER_MAP_RATE_LIMITED" }).retryAfterSeconds).toBe(3600);
  });

  test("CAREER_MAP_FAILED distinguishes ungrounded output from other failures", () => {
    const ungrounded = describeCareerMapError({ code: "CAREER_MAP_FAILED", reason: "CAREER_MAP_INVALID_OUTPUT:UNGROUNDED" });
    expect(ungrounded.action).toBe("edit");
    expect(ungrounded.message).toContain("instead of showing you a guess");
    const other = describeCareerMapError({ code: "CAREER_MAP_FAILED", reason: "OPENAI_RESPONSE_FAILED:500" });
    expect(other.action).toBe("retry");
    expect(other.title).not.toBe(ungrounded.title);
  });

  test("a 504 without a JSON body is a timeout; unknown codes get the generic retry", () => {
    expect(describeCareerMapError({ code: null, status: 504 }).code).toBe("TIMEOUT");
    const unknown = describeCareerMapError({ code: "SOMETHING_NEW", status: 500 });
    expect(unknown.action).toBe("retry");
    expect(unknown.title).toBe("Something went wrong on our side");
  });

  test("email form errors", () => {
    expect(describeCareerMapEmailError({ code: "INVALID_BODY" })).toContain("email address");
    expect(describeCareerMapEmailError({ code: "CAREER_MAP_NOT_FOUND" })).toContain("could not find this map");
    expect(describeCareerMapEmailError({ code: "NETWORK_ERROR" })).toContain("connection");
    expect(describeCareerMapEmailError({ code: "CAREER_MAP_EMAIL_FAILED" })).toContain("Try again");
  });

  test("stored failure reasons are translated, never shown raw", () => {
    expect(describeStoredFailure("CAREER_MAP_INVALID_OUTPUT:UNGROUNDED")).toContain("too few did");
    expect(describeStoredFailure("OPENAI_CONFIG_MISSING")).toContain("offline");
    expect(describeStoredFailure("CAREER_MAP_INVALID_OUTPUT:primary.titleId")).toContain("could not check");
    expect(describeStoredFailure(null)).toContain("Nothing was wrong with your text");
    for (const reason of ["CAREER_MAP_INVALID_OUTPUT:UNGROUNDED", "OPENAI_RESPONSE_FAILED:500:boom", null]) {
      expect(describeStoredFailure(reason)).not.toMatch(/[A-Z]{3,}_[A-Z]/);
    }
  });
});
