import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { mockLinkByToken, mockLinkByEmail, mockCookieGet } = vi.hoisted(() => ({
  mockLinkByToken: vi.fn(),
  mockLinkByEmail: vi.fn(),
  mockCookieGet: vi.fn(),
}));

vi.mock("@/lib/career-map/store", () => ({
  linkCareerMapByToken: mockLinkByToken,
  linkCareerMapsByEmail: mockLinkByEmail,
}));

// next lives in apps/web/node_modules; mock the file the app module resolves to.
vi.mock("../../apps/web/node_modules/next/headers.js", () => ({
  cookies: async () => ({ get: mockCookieGet }),
}));

import {
  CAREER_MAP_LINK_BY_EMAIL,
  CAREER_MAP_LINK_MEMO_TTL_MS,
  linkCareerMapsForLearner,
  readCareerMapCookieFromRequest,
  readCareerMapCookieToken,
  resetCareerMapLinkMemoForTests,
} from "@/lib/career-map-linking";
import { CAREER_MAP_COOKIE_NAME } from "@aitutor/shared";

function linkedRecord(token: string, learnerProfileId: string) {
  return { token, learnerProfileId, status: "completed" };
}

describe("linkCareerMapsForLearner", () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetCareerMapLinkMemoForTests();
    mockLinkByToken.mockReset();
    mockLinkByEmail.mockReset();
    mockCookieGet.mockReset();
    mockLinkByToken.mockImplementation(async ({ token, learnerProfileId }: { token: string; learnerProfileId: string }) =>
      linkedRecord(token, learnerProfileId),
    );
    mockLinkByEmail.mockResolvedValue(0);
    warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
    vi.useRealTimers();
  });

  test("cookie path: links the cookie's map to the learner", async () => {
    const result = await linkCareerMapsForLearner({ learnerProfileId: "profile_1", email: null, cookieToken: "tok_abc" });
    expect(mockLinkByToken).toHaveBeenCalledWith({ token: "tok_abc", learnerProfileId: "profile_1" });
    expect(mockLinkByEmail).not.toHaveBeenCalled();
    expect(result).toMatchObject({ skipped: false, linkedByToken: true, linkedByEmail: 0, failures: [] });
  });

  test("cookie path: a map that belongs to someone else is not reported as linked", async () => {
    mockLinkByToken.mockResolvedValue(linkedRecord("tok_abc", "someone_else"));
    const result = await linkCareerMapsForLearner({ learnerProfileId: "profile_1", cookieToken: "tok_abc" });
    expect(result.linkedByToken).toBe(false);
  });

  test("email path is off: an email alone never links a map (neither address is verified)", async () => {
    mockLinkByEmail.mockResolvedValue(2);
    const result = await linkCareerMapsForLearner({ learnerProfileId: "profile_1", email: "  Maya@Example.com ", cookieToken: null });
    expect(CAREER_MAP_LINK_BY_EMAIL).toBe(false);
    expect(mockLinkByEmail).not.toHaveBeenCalled();
    expect(mockLinkByToken).not.toHaveBeenCalled();
    expect(result).toMatchObject({ skipped: true, linkedByToken: false, linkedByEmail: 0 });
  });

  test("cookie and email together: only the cookie's map is linked", async () => {
    mockLinkByEmail.mockResolvedValue(1);
    const result = await linkCareerMapsForLearner({ learnerProfileId: "profile_1", email: "maya@example.com", cookieToken: "tok_abc" });
    expect(mockLinkByToken).toHaveBeenCalledTimes(1);
    expect(mockLinkByEmail).not.toHaveBeenCalled();
    expect(result).toMatchObject({ linkedByToken: true, linkedByEmail: 0 });
  });

  test("fast path: nothing to link means no store call at all", async () => {
    const result = await linkCareerMapsForLearner({ learnerProfileId: "profile_1", email: null, cookieToken: null });
    expect(result.skipped).toBe(true);
    expect(mockLinkByToken).not.toHaveBeenCalled();
    expect(mockLinkByEmail).not.toHaveBeenCalled();
  });

  test("fast path: no profile id means no store call", async () => {
    const result = await linkCareerMapsForLearner({ learnerProfileId: "", email: "maya@example.com", cookieToken: "tok" });
    expect(result.skipped).toBe(true);
    expect(mockLinkByToken).not.toHaveBeenCalled();
    expect(mockLinkByEmail).not.toHaveBeenCalled();
  });

  test("fast path: repeat loads with the same cookie and email do not hit the store again", async () => {
    const input = { learnerProfileId: "profile_1", email: "maya@example.com", cookieToken: "tok_abc" };
    await linkCareerMapsForLearner(input);
    const second = await linkCareerMapsForLearner(input);
    const third = await linkCareerMapsForLearner({ ...input, cookieToken: null });
    expect(mockLinkByToken).toHaveBeenCalledTimes(1);
    expect(mockLinkByEmail).not.toHaveBeenCalled();
    expect(second.skipped).toBe(true);
    expect(third.skipped).toBe(true);
  });

  test("a new cookie token is still linked after the first load", async () => {
    await linkCareerMapsForLearner({ learnerProfileId: "profile_1", cookieToken: "tok_one" });
    await linkCareerMapsForLearner({ learnerProfileId: "profile_1", cookieToken: "tok_two" });
    expect(mockLinkByToken).toHaveBeenCalledTimes(2);
    expect(mockLinkByToken).toHaveBeenLastCalledWith({ token: "tok_two", learnerProfileId: "profile_1" });
  });

  test("the memo expires so the cookie's map is tried again later", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-25T12:00:00.000Z"));
    await linkCareerMapsForLearner({ learnerProfileId: "profile_1", cookieToken: "tok_abc" });
    vi.setSystemTime(new Date(Date.parse("2026-11-25T12:00:00.000Z") + CAREER_MAP_LINK_MEMO_TTL_MS + 1000));
    await linkCareerMapsForLearner({ learnerProfileId: "profile_1", cookieToken: "tok_abc" });
    expect(mockLinkByToken).toHaveBeenCalledTimes(2);
  });

  test("never throws: store failures are logged with console.warn and reported", async () => {
    mockLinkByToken.mockRejectedValue(new Error("SUPABASE_DOWN"));
    mockLinkByEmail.mockRejectedValue(new Error("SUPABASE_DOWN"));
    const result = await linkCareerMapsForLearner({ learnerProfileId: "profile_1", email: "maya@example.com", cookieToken: "tok_abc" });
    expect(result.failures).toEqual(["token"]);
    expect(result.linkedByToken).toBe(false);
    expect(warn).toHaveBeenCalledWith("[career-map] cookie map link failed", "SUPABASE_DOWN");
  });

  test("never throws: a failing token link is reported and nothing else is attempted", async () => {
    mockLinkByToken.mockRejectedValue(new Error("boom"));
    mockLinkByEmail.mockResolvedValue(3);
    const result = await linkCareerMapsForLearner({ learnerProfileId: "profile_1", email: "maya@example.com", cookieToken: "tok_abc" });
    expect(result.linkedByEmail).toBe(0);
    expect(result.failures).toEqual(["token"]);
  });

  test("failures are retried on the next load (not memoised)", async () => {
    mockLinkByToken.mockRejectedValueOnce(new Error("boom"));
    await linkCareerMapsForLearner({ learnerProfileId: "profile_1", cookieToken: "tok_abc" });
    await linkCareerMapsForLearner({ learnerProfileId: "profile_1", cookieToken: "tok_abc" });
    expect(mockLinkByToken).toHaveBeenCalledTimes(2);
  });

  test("never throws: synchronous throws and junk input are absorbed", async () => {
    mockLinkByToken.mockImplementation(() => {
      throw new Error("sync");
    });
    await expect(linkCareerMapsForLearner({ learnerProfileId: "profile_1", cookieToken: "tok" })).resolves.toMatchObject({ failures: ["token"] });
    await expect(linkCareerMapsForLearner(undefined as never)).resolves.toMatchObject({ skipped: true });
    await expect(linkCareerMapsForLearner({ learnerProfileId: "profile_1", email: "not-an-email", cookieToken: "x".repeat(500) })).resolves.toMatchObject({ skipped: true });
  });

  test("the seed store (not implemented yet) cannot break the caller", async () => {
    mockLinkByToken.mockRejectedValue(new Error("FOUNDATION_SEED_NOT_IMPLEMENTED:career-map/store.linkCareerMapByToken"));
    await expect(linkCareerMapsForLearner({ learnerProfileId: "profile_1", cookieToken: "tok" })).resolves.toBeDefined();
  });
});

describe("career map cookie readers", () => {
  beforeEach(() => {
    mockCookieGet.mockReset();
  });

  test("readCareerMapCookieFromRequest parses the cookie header", () => {
    const req = new Request("https://example.com/api/onboarding/claim", {
      headers: { cookie: `other=1; ${CAREER_MAP_COOKIE_NAME}=tok%5Fabc; theme=light` },
    });
    expect(readCareerMapCookieFromRequest(req)).toBe("tok_abc");
  });

  test("readCareerMapCookieFromRequest returns null without the cookie", () => {
    expect(readCareerMapCookieFromRequest(new Request("https://example.com", { headers: { cookie: "a=1" } }))).toBeNull();
    expect(readCareerMapCookieFromRequest(new Request("https://example.com"))).toBeNull();
    expect(readCareerMapCookieFromRequest(null)).toBeNull();
    expect(readCareerMapCookieFromRequest({} as never)).toBeNull();
  });

  test("readCareerMapCookieToken reads next/headers cookies", async () => {
    mockCookieGet.mockImplementation((name: string) => (name === CAREER_MAP_COOKIE_NAME ? { value: " tok_xyz " } : undefined));
    await expect(readCareerMapCookieToken()).resolves.toBe("tok_xyz");
  });

  test("readCareerMapCookieToken is null when cookies() fails outside a request", async () => {
    mockCookieGet.mockImplementation(() => {
      throw new Error("cookies was called outside a request scope");
    });
    await expect(readCareerMapCookieToken()).resolves.toBeNull();
  });
});
