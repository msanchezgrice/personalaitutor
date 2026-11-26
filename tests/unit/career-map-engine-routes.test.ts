import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CAREER_MAP_COOKIE_NAME, EXAMPLE_CAREER_MAP, EXAMPLE_CAREER_MAP_INPUT } from "@aitutor/shared";

const { mockGetAuthSeed } = vi.hoisted(() => ({ mockGetAuthSeed: vi.fn() }));

class MockNextRequest extends Request {
  nextUrl: URL;

  constructor(input: string, init?: RequestInit) {
    super(input, init);
    this.nextUrl = new URL(input);
  }
}

vi.mock("next/server", () => ({ NextRequest: MockNextRequest }), { virtual: true });
vi.mock("@/lib/auth", () => ({ getAuthSeed: mockGetAuthSeed }));

import { POST as createPost } from "../../apps/web/app/api/career-map/route";
import { GET as tokenGet } from "../../apps/web/app/api/career-map/[token]/route";
import { POST as emailPost } from "../../apps/web/app/api/career-map/[token]/email/route";
import {
  findCareerMapByToken, linkCareerMapByToken,
  getLatestCareerMapForProfile,
  resetCareerMapStateForTests,
} from "../../apps/web/lib/career-map/store";
import { runtimeGetBillingAccessState } from "../../apps/web/lib/runtime";

type Json = Record<string, any>;

function openAiAnswer(answer: object | string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ output_text: typeof answer === "string" ? answer : JSON.stringify(answer) }),
    text: async () => "",
  };
}

/** Routes OpenAI calls to queued answers and Resend calls to a recorder. */
function mockFetch(openAiAnswers: Array<object | string>, resendOk = true) {
  const openAiCalls: Json[] = [];
  const resendCalls: Json[] = [];
  const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    if (url.startsWith("https://api.resend.com")) {
      resendCalls.push(body);
      return { ok: resendOk, status: resendOk ? 200 : 500, json: async () => ({ id: "email_1" }), text: async () => "" };
    }
    openAiCalls.push(body);
    const next = openAiAnswers.shift();
    if (next === undefined) throw new Error("UNEXPECTED_OPENAI_CALL");
    return openAiAnswer(next);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { openAiCalls, resendCalls };
}

function postMap(body: unknown, ip = "203.0.113.10") {
  return createPost(
    new MockNextRequest("http://localhost/api/career-map", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }) as never,
  );
}

function getMap(token: string) {
  return tokenGet(new Request(`http://localhost/api/career-map/${token}`), { params: Promise.resolve({ token }) });
}

/** By default the request carries the owner cookie for that map, as the browser that drew it would. */
function postEmail(token: string, email: unknown, cookieToken: string | null = token) {
  return emailPost(
    new Request(`http://localhost/api/career-map/${token}/email`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(cookieToken ? { cookie: `mast_cm=${encodeURIComponent(cookieToken)}` } : {}) },
      body: JSON.stringify({ email }),
    }),
    { params: Promise.resolve({ token }) },
  );
}

const VALID_BODY = { text: EXAMPLE_CAREER_MAP_INPUT, source: "paste", visitorId: "visitor_abc" };

describe("POST /api/career-map", () => {
  beforeEach(() => {
    resetCareerMapStateForTests();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_MODEL", "test-model");
    vi.stubEnv("RESEND_API_KEY", "");
    mockGetAuthSeed.mockReset();
    mockGetAuthSeed.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test("creates a map, returns the view and sets the httpOnly cookie", async () => {
    const { openAiCalls } = mockFetch([EXAMPLE_CAREER_MAP]);
    const res = await postMap(VALID_BODY);
    expect(res.status).toBe(200);
    const json = (await res.json()) as Json;
    expect(json.ok).toBe(true);
    expect(json.token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(json.mapPath).toBe(`/map/${json.token}`);
    expect(json.view).toMatchObject({ token: json.token, status: "completed", hasEmail: false, linked: false });
    expect(json.view.map).toEqual(EXAMPLE_CAREER_MAP);
    expect(JSON.stringify(json)).not.toContain("Kiteborne Games, 2018");
    expect(openAiCalls).toHaveLength(1);

    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${CAREER_MAP_COOKIE_NAME}=${json.token}`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain(`Max-Age=${30 * 24 * 60 * 60}`);
    expect(cookie).toContain("Path=/");
    expect(cookie).not.toContain("Secure");

    const stored = await findCareerMapByToken(json.token);
    expect(stored).toMatchObject({ status: "completed", source: "paste", visitorId: "visitor_abc", model: "test-model" });
    expect(stored?.ipHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored?.ipHash).not.toContain("203.0.113.10");
    expect(stored?.inputText).toBe(EXAMPLE_CAREER_MAP_INPUT);
  });

  test("marks the cookie Secure in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mockFetch([EXAMPLE_CAREER_MAP]);
    const res = await postMap(VALID_BODY);
    expect(res.headers.get("set-cookie")).toContain("Secure");
  });

  test("400 INVALID_BODY for a bad source, missing text or text over the limit", async () => {
    mockFetch([]);
    for (const body of [
      { text: EXAMPLE_CAREER_MAP_INPUT, source: "fax" },
      { source: "paste" },
      { text: "x".repeat(20001), source: "paste" },
      "not json",
    ]) {
      const res = await postMap(body);
      expect(res.status).toBe(400);
      expect(((await res.json()) as Json).error.code).toBe("INVALID_BODY");
    }
  });

  test("400 CAREER_MAP_INPUT_TOO_SHORT under the minimum", async () => {
    const { openAiCalls } = mockFetch([]);
    const res = await postMap({ text: "   I did marketing.   ", source: "describe" });
    expect(res.status).toBe(400);
    const json = (await res.json()) as Json;
    expect(json.error.code).toBe("CAREER_MAP_INPUT_TOO_SHORT");
    expect(json.error.minChars).toBe(60);
    expect(openAiCalls).toHaveLength(0);
  });

  test("429 CAREER_MAP_RATE_LIMITED with retryAfterSeconds once the hourly limit is hit", async () => {
    vi.stubEnv("CAREER_MAP_LIMIT_HOUR", "2");
    const { openAiCalls } = mockFetch([EXAMPLE_CAREER_MAP, EXAMPLE_CAREER_MAP]);
    expect((await postMap(VALID_BODY)).status).toBe(200);
    expect((await postMap(VALID_BODY)).status).toBe(200);
    const limited = await postMap(VALID_BODY);
    expect(limited.status).toBe(429);
    const json = (await limited.json()) as Json;
    expect(json.error.code).toBe("CAREER_MAP_RATE_LIMITED");
    expect(json.error.retryAfterSeconds).toBeGreaterThan(3500);
    expect(json.error.retryAfterSeconds).toBeLessThanOrEqual(3600);
    expect(limited.headers.get("retry-after")).toBe(String(json.error.retryAfterSeconds));
    expect(openAiCalls).toHaveLength(2);

    // A different IP is not limited.
    mockFetch([EXAMPLE_CAREER_MAP]);
    expect((await postMap(VALID_BODY, "198.51.100.20")).status).toBe(200);
  });

  test("failed generations count toward the limit", async () => {
    vi.stubEnv("CAREER_MAP_LIMIT_HOUR", "1");
    mockFetch(["nope", "nope"]);
    expect((await postMap(VALID_BODY)).status).toBe(502);
    expect((await postMap(VALID_BODY)).status).toBe(429);
  });

  test("502 OPENAI_CONFIG_MISSING when no key is configured; the record is marked failed", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    mockFetch([]);
    const res = await postMap(VALID_BODY);
    expect(res.status).toBe(502);
    const json = (await res.json()) as Json;
    expect(json.error.code).toBe("OPENAI_CONFIG_MISSING");
    expect(json.error.recoveryAction).toBeTruthy();
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  test("502 CAREER_MAP_FAILED with an add-more-detail recovery when output is ungrounded", async () => {
    const ungrounded = {
      ...EXAMPLE_CAREER_MAP,
      // Work the input never mentions. (A near-quote would be repaired from the input, not rejected.)
      translations: EXAMPLE_CAREER_MAP.translations.map((entry, index) => ({
        ...entry,
        evidence: ["Led a platform migration for the finance team", "Negotiated enterprise vendor contracts", "Taught a weekly analytics seminar", "Audited the payroll ledger"][index % 4],
      })),
    };
    const { openAiCalls } = mockFetch([ungrounded, ungrounded]);
    const res = await postMap(VALID_BODY);
    expect(res.status).toBe(502);
    const json = (await res.json()) as Json;
    expect(json.error.code).toBe("CAREER_MAP_FAILED");
    expect(json.error.reason).toBe("CAREER_MAP_INVALID_OUTPUT:UNGROUNDED");
    expect(json.error.recoveryAction).toMatch(/Add more detail about what you did/);
    expect(openAiCalls).toHaveLength(2);
  });

  test("502 CAREER_MAP_FAILED with a retry recovery on other failures", async () => {
    mockFetch(["not json", "still not json"]);
    const res = await postMap(VALID_BODY);
    const json = (await res.json()) as Json;
    expect(res.status).toBe(502);
    expect(json.error).toMatchObject({ code: "CAREER_MAP_FAILED", reason: "CAREER_MAP_INVALID_OUTPUT:NOT_JSON", recoveryAction: "Retry in a minute." });
  });

  test("links the map to the signed-in learner's profile", async () => {
    const seed = { userId: "user_map_1", email: "signed.in@example.com", name: "Signed In", handleBase: "signed-in" };
    mockGetAuthSeed.mockResolvedValue(seed);
    mockFetch([EXAMPLE_CAREER_MAP]);
    const res = await postMap(VALID_BODY);
    const json = (await res.json()) as Json;
    expect(res.status).toBe(200);
    expect(json.view.linked).toBe(true);
    // Session only: the route must not hand the request (and its x-user-id header) to getAuthSeed.
    expect(mockGetAuthSeed).toHaveBeenCalledWith();

    const billing = await runtimeGetBillingAccessState({ userId: seed.userId, seed });
    const profileId = billing.profile?.id;
    expect(profileId).toBeTruthy();
    const latest = await getLatestCareerMapForProfile(profileId!);
    expect(latest?.token).toBe(json.token);
  });

  test("a signed-out caller stays unlinked", async () => {
    mockFetch([EXAMPLE_CAREER_MAP]);
    const json = (await (await postMap(VALID_BODY)).json()) as Json;
    expect(json.view.linked).toBe(false);
    expect((await findCareerMapByToken(json.token))?.learnerProfileId).toBeNull();
  });
});

describe("GET /api/career-map/[token]", () => {
  beforeEach(() => {
    resetCareerMapStateForTests();
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    mockGetAuthSeed.mockReset();
    mockGetAuthSeed.mockResolvedValue(null);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test("returns the view, or 404 CAREER_MAP_NOT_FOUND", async () => {
    mockFetch([EXAMPLE_CAREER_MAP]);
    const created = (await (await postMap(VALID_BODY)).json()) as Json;
    const res = await getMap(created.token);
    expect(res.status).toBe(200);
    const json = (await res.json()) as Json;
    expect(json.view).toEqual(created.view);
    expect(json.view).not.toHaveProperty("inputText");
    expect(json.view).not.toHaveProperty("ipHash");

    const missing = await getMap("does-not-exist");
    expect(missing.status).toBe(404);
    expect(((await missing.json()) as Json).error.code).toBe("CAREER_MAP_NOT_FOUND");
    expect((await getMap("%E0%A4%A")).status).toBe(404);
  });
});

describe("POST /api/career-map/[token]/email", () => {
  let token = "";

  beforeEach(async () => {
    resetCareerMapStateForTests();
    vi.unstubAllEnvs();
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("RESEND_API_KEY", "");
    mockGetAuthSeed.mockReset();
    mockGetAuthSeed.mockResolvedValue(null);
    mockFetch([EXAMPLE_CAREER_MAP]);
    token = ((await (await postMap(VALID_BODY)).json()) as Json).token;
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test("captures the email even when email delivery is not configured", async () => {
    const res = await postEmail(token, "Maya@Example.com");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, captured: true, emailed: false, mapPath: `/map/${token}` });
    const stored = await findCareerMapByToken(token);
    expect(stored?.email).toBe("maya@example.com");
    expect(stored?.mapEmailSentAt).toBeNull();
    expect(((await (await getMap(token)).json()) as Json).view.hasEmail).toBe(true);
  });

  test("sends the map through Resend once and does not resend within the window", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("APP_BASE_URL", "https://www.myaiskilltutor.com");
    const { resendCalls } = mockFetch([]);
    const first = (await (await postEmail(token, "maya@example.com")).json()) as Json;
    expect(first).toMatchObject({ captured: true, emailed: true });
    expect(resendCalls).toHaveLength(1);
    expect(resendCalls[0].to).toEqual(["maya@example.com"]);
    expect(resendCalls[0].subject).toContain("Go-to-Market Engineer");
    expect(resendCalls[0].html).toContain(`https://www.myaiskilltutor.com/map/${token}`);
    expect((await findCareerMapByToken(token))?.mapEmailSentAt).toBeTruthy();

    const again = (await (await postEmail(token, "maya@example.com")).json()) as Json;
    expect(again).toMatchObject({ captured: true, emailed: true });
    // An address is set once: a second address is refused and nothing is sent to it.
    const otherAddress = await postEmail(token, "someone.else@example.com");
    expect(otherAddress.status).toBe(409);
    expect(((await otherAddress.json()) as Json).error.code).toBe("CAREER_MAP_EMAIL_LOCKED");
    expect((await findCareerMapByToken(token))?.email).toBe("maya@example.com");
    expect(resendCalls).toHaveLength(1);
  });

  test("only the browser that drew the map can save an email on it", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    const { resendCalls } = mockFetch([]);
    const noCookie = await postEmail(token, "attacker@example.com", null);
    expect(noCookie.status).toBe(403);
    expect(((await noCookie.json()) as Json).error.code).toBe("CAREER_MAP_NOT_OWNER");
    const otherCookie = await postEmail(token, "attacker@example.com", "some-other-map-token");
    expect(otherCookie.status).toBe(403);
    expect((await findCareerMapByToken(token))?.email).toBeNull();
    expect(resendCalls).toHaveLength(0);
  });

  test("a map that already belongs to an account cannot be given an email", async () => {
    await linkCareerMapByToken({ token, learnerProfileId: "profile-owner" });
    const res = await postEmail(token, "maya@example.com");
    expect(res.status).toBe(409);
    expect((await findCareerMapByToken(token))?.email).toBeNull();
  });

  test("a Resend failure still counts as captured", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    mockFetch([], false);
    const json = (await (await postEmail(token, "maya@example.com")).json()) as Json;
    expect(json).toMatchObject({ ok: true, captured: true, emailed: false });
    expect((await findCareerMapByToken(token))?.mapEmailSentAt).toBeNull();
  });

  test("400 for an invalid email, 404 for an unknown token", async () => {
    const bad = await postEmail(token, "nope");
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as Json).error.code).toBe("INVALID_BODY");
    const missing = await postEmail("unknown-token", "maya@example.com");
    expect(missing.status).toBe(404);
    expect(((await missing.json()) as Json).error.code).toBe("CAREER_MAP_NOT_FOUND");
  });
});

describe("POST /api/career-map request guards", () => {
  beforeEach(() => {
    resetCareerMapStateForTests();
    vi.unstubAllEnvs();
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    mockGetAuthSeed.mockReset();
    mockGetAuthSeed.mockResolvedValue(null);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function rawPost(headers: Record<string, string>, body: string) {
    return createPost(new MockNextRequest("http://localhost/api/career-map", { method: "POST", headers: { "x-forwarded-for": "203.0.113.77", ...headers }, body }) as never);
  }

  test("a cross-site form post cannot create a map or set the owner cookie", async () => {
    const { openAiCalls } = mockFetch([EXAMPLE_CAREER_MAP]);
    const body = JSON.stringify(VALID_BODY);
    const formPost = await rawPost({ "content-type": "text/plain" }, body);
    expect(formPost.status).toBe(415);
    expect(formPost.headers.get("set-cookie")).toBeNull();
    const crossSite = await rawPost({ "content-type": "application/json", "sec-fetch-site": "cross-site" }, body);
    expect(crossSite.status).toBe(415);
    const foreignOrigin = await rawPost({ "content-type": "application/json", origin: "https://evil.example" }, body);
    expect(foreignOrigin.status).toBe(415);
    expect(openAiCalls).toHaveLength(0);
    const sameOrigin = await rawPost({ "content-type": "application/json", origin: "http://localhost", "sec-fetch-site": "same-origin" }, body);
    expect(sameOrigin.status).toBe(200);
  });

  test("the hourly limit holds under a burst of parallel requests", async () => {
    vi.stubEnv("CAREER_MAP_LIMIT_HOUR", "3");
    mockFetch(Array.from({ length: 12 }, () => EXAMPLE_CAREER_MAP));
    const responses = await Promise.all(Array.from({ length: 12 }, () => postMap(VALID_BODY)));
    const ok = responses.filter((res) => res.status === 200).length;
    const limited = responses.filter((res) => res.status === 429).length;
    expect(ok).toBeLessThanOrEqual(3);
    expect(ok + limited).toBe(12);
    // A refused attempt leaves no record behind, so it does not count against the visitor later.
    vi.stubEnv("CAREER_MAP_LIMIT_HOUR", "50");
    mockFetch([EXAMPLE_CAREER_MAP]);
    expect((await postMap(VALID_BODY)).status).toBe(200);
  });
});
