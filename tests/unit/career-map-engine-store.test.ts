import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { EXAMPLE_CAREER_MAP, EXAMPLE_CAREER_MAP_INPUT, toCareerMapView } from "@aitutor/shared";
import {
  captureCareerMapEmail,
  completeCareerMapRecord,
  countRecentCareerMaps,
  createCareerMapRecord,
  failCareerMapRecord,
  findCareerMapByToken,
  findOldestRecentCareerMapAt,
  generateCareerMapToken,
  getLatestCareerMapForProfile,
  linkCareerMapByToken,
  linkCareerMapsByEmail,
  markCareerMapEmailSent,
  resetCareerMapStateForTests,
  setCareerMapCreatedAtForTests,
} from "../../apps/web/lib/career-map/store";
import { buildCareerMapEmail } from "../../apps/web/lib/career-map/email";
import { checkCareerMapRateLimit, getRequestIp, hashRequestIp } from "../../apps/web/lib/career-map/rate-limit";

async function completedMap(overrides: { ipHash?: string; learnerProfileId?: string | null } = {}) {
  const record = await createCareerMapRecord({
    source: "paste",
    inputText: EXAMPLE_CAREER_MAP_INPUT,
    visitorId: "visitor_1",
    ipHash: overrides.ipHash ?? "hash_a",
    learnerProfileId: overrides.learnerProfileId ?? null,
  });
  return completeCareerMapRecord({ id: record.id, map: EXAMPLE_CAREER_MAP, model: "test-model" });
}

describe("career map store (memory mode)", () => {
  beforeEach(() => {
    resetCareerMapStateForTests();
  });

  test("tokens are long and unguessable", () => {
    const a = generateCareerMapToken();
    const b = generateCareerMapToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(a).not.toBe(b);
  });

  test("create -> complete -> find by token", async () => {
    const created = await createCareerMapRecord({ source: "describe", inputText: "text", ipHash: "h" });
    expect(created).toMatchObject({ status: "generating", source: "describe", map: null, learnerProfileId: null, linkedAt: null });
    const completed = await completeCareerMapRecord({ id: created.id, map: EXAMPLE_CAREER_MAP, model: "m" });
    expect(completed).toMatchObject({ status: "completed", model: "m" });
    const found = await findCareerMapByToken(created.token);
    expect(found?.map?.primary.titleId).toBe("gtm-engineer");
    expect(await findCareerMapByToken("nope")).toBeNull();
    expect(await findCareerMapByToken("")).toBeNull();
  });

  test("the view never exposes input text, email or ip hash", async () => {
    const record = await completedMap();
    await captureCareerMapEmail({ token: record.token, email: "maya@example.com" });
    const view = toCareerMapView((await findCareerMapByToken(record.token))!);
    const json = JSON.stringify(view);
    expect(json).not.toContain("Kiteborne Games, 2018");
    expect(json).not.toContain("maya@example.com");
    expect(json).not.toContain("hash_a");
    expect(view).toMatchObject({ hasEmail: true, linked: false, status: "completed" });
  });

  test("fail stores the reason", async () => {
    const created = await createCareerMapRecord({ source: "paste", inputText: "text" });
    await failCareerMapRecord({ id: created.id, reason: "CAREER_MAP_INVALID_OUTPUT:UNGROUNDED" });
    const found = await findCareerMapByToken(created.token);
    expect(found).toMatchObject({ status: "failed", failureReason: "CAREER_MAP_INVALID_OUTPUT:UNGROUNDED", map: null });
  });

  test("email capture normalises, keeps the first capture time and rejects junk", async () => {
    const record = await completedMap();
    const first = await captureCareerMapEmail({ token: record.token, email: "  Maya@Example.COM " });
    expect(first?.email).toBe("maya@example.com");
    // The same address again is a no-op; a different one is refused (an address is set once).
    const second = await captureCareerMapEmail({ token: record.token, email: "MAYA@example.com" });
    expect(second?.email).toBe("maya@example.com");
    expect(second?.emailCapturedAt).toBe(first?.emailCapturedAt);
    await expect(captureCareerMapEmail({ token: record.token, email: "other@example.com" })).rejects.toThrow("CAREER_MAP_EMAIL_LOCKED");
    expect((await findCareerMapByToken(record.token))?.email).toBe("maya@example.com");
    expect(await captureCareerMapEmail({ token: record.token, email: "not-an-email" })).toBeNull();
    expect(await captureCareerMapEmail({ token: "missing", email: "a@example.com" })).toBeNull();
    await markCareerMapEmailSent(record.id);
    expect((await findCareerMapByToken(record.token))?.mapEmailSentAt).toBeTruthy();
  });

  test("link by token is idempotent and never steals a map", async () => {
    const record = await completedMap();
    const linked = await linkCareerMapByToken({ token: record.token, learnerProfileId: "profile-1" });
    expect(linked).toMatchObject({ learnerProfileId: "profile-1" });
    expect(linked?.linkedAt).toBeTruthy();
    const again = await linkCareerMapByToken({ token: record.token, learnerProfileId: "profile-1" });
    expect(again?.linkedAt).toBe(linked?.linkedAt);
    expect(await linkCareerMapByToken({ token: record.token, learnerProfileId: "profile-2" })).toBeNull();
    expect((await findCareerMapByToken(record.token))?.learnerProfileId).toBe("profile-1");
    expect(await linkCareerMapByToken({ token: "missing", learnerProfileId: "profile-1" })).toBeNull();
  });

  test("link by email claims only unlinked maps with that email", async () => {
    const a = await completedMap();
    const b = await completedMap();
    const c = await completedMap({ learnerProfileId: "someone-else" });
    const d = await completedMap();
    await captureCareerMapEmail({ token: a.token, email: "maya@example.com" });
    await captureCareerMapEmail({ token: b.token, email: "MAYA@example.com" });
    // A map that already belongs to an account cannot be given an email at all.
    await expect(captureCareerMapEmail({ token: c.token, email: "maya@example.com" })).rejects.toThrow("CAREER_MAP_EMAIL_LOCKED");
    await captureCareerMapEmail({ token: d.token, email: "other@example.com" });
    expect(await linkCareerMapsByEmail({ email: "Maya@Example.com", learnerProfileId: "profile-1" })).toBe(2);
    expect(await linkCareerMapsByEmail({ email: "maya@example.com", learnerProfileId: "profile-1" })).toBe(0);
    expect((await findCareerMapByToken(c.token))?.learnerProfileId).toBe("someone-else");
    expect((await findCareerMapByToken(d.token))?.learnerProfileId).toBeNull();
    expect(await linkCareerMapsByEmail({ email: "bad", learnerProfileId: "profile-1" })).toBe(0);
  });

  test("latest map for a profile ignores failed and generating maps", async () => {
    const older = await completedMap({ learnerProfileId: "p" });
    setCareerMapCreatedAtForTests(older.id, "2026-11-01T00:00:00.000Z");
    const newer = await completedMap({ learnerProfileId: "p" });
    const generating = await createCareerMapRecord({ source: "paste", inputText: "x", learnerProfileId: "p" });
    setCareerMapCreatedAtForTests(generating.id, "2030-01-01T00:00:00.000Z");
    expect((await getLatestCareerMapForProfile("p"))?.id).toBe(newer.id);
    expect(await getLatestCareerMapForProfile("nobody")).toBeNull();
  });

  test("counts recent maps per ip hash and globally", async () => {
    const old = await completedMap({ ipHash: "h1" });
    setCareerMapCreatedAtForTests(old.id, "2026-01-01T00:00:00.000Z");
    await completedMap({ ipHash: "h1" });
    await completedMap({ ipHash: "h2" });
    const since = "2026-06-01T00:00:00.000Z";
    expect(await countRecentCareerMaps({ ipHash: "h1", sinceIso: since })).toBe(1);
    expect(await countRecentCareerMaps({ sinceIso: since })).toBe(2);
    expect(await countRecentCareerMaps({ sinceIso: "2025-01-01T00:00:00.000Z" })).toBe(3);
    expect(await findOldestRecentCareerMapAt({ sinceIso: "2025-01-01T00:00:00.000Z" })).toBe("2026-01-01T00:00:00.000Z");
    expect(await findOldestRecentCareerMapAt({ ipHash: "h9", sinceIso: since })).toBeNull();
  });
});

describe("career map rate limit", () => {
  beforeEach(() => {
    resetCareerMapStateForTests();
    vi.unstubAllEnvs();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("hashes the first forwarded IP with a secret and never returns it raw", () => {
    vi.stubEnv("CAREER_MAP_IP_SALT", "salt-1");
    const req = new Request("http://localhost/api/career-map", { headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" } });
    expect(getRequestIp(req)).toBe("203.0.113.7");
    const hash = hashRequestIp(req);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain("203.0.113.7");
    expect(hashRequestIp(req)).toBe(hash);
    const other = new Request("http://localhost/", { headers: { "x-forwarded-for": "198.51.100.1" } });
    expect(hashRequestIp(other)).not.toBe(hash);
    vi.stubEnv("CAREER_MAP_IP_SALT", "salt-2");
    expect(hashRequestIp(req)).not.toBe(hash);
    expect(getRequestIp(new Request("http://localhost/", { headers: { "x-real-ip": "192.0.2.4" } }))).toBe("192.0.2.4");
    expect(getRequestIp(new Request("http://localhost/"))).toBe("unknown");
  });

  test("defaults: 5 per hour per ip hash, with an accurate retry time", async () => {
    const now = new Date();
    for (let i = 0; i < 5; i += 1) {
      const record = await createCareerMapRecord({ source: "paste", inputText: "x", ipHash: "h" });
      setCareerMapCreatedAtForTests(record.id, new Date(now.getTime() - (50 - i) * 60_000).toISOString());
    }
    const result = await checkCareerMapRateLimit("h", now);
    expect(result).toMatchObject({ ok: false, scope: "hour", limit: 5 });
    if (result.ok) return;
    // Oldest attempt was 50 minutes ago, so the window frees in about 10 minutes.
    expect(result.retryAfterSeconds).toBeGreaterThan(9 * 60);
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(10 * 60);
    expect(await checkCareerMapRateLimit("other", now)).toEqual({ ok: true });
  });

  test("daily and global limits, overridable by env", async () => {
    vi.stubEnv("CAREER_MAP_LIMIT_HOUR", "100");
    vi.stubEnv("CAREER_MAP_LIMIT_DAY", "3");
    vi.stubEnv("CAREER_MAP_LIMIT_GLOBAL_DAY", "5");
    const now = new Date();
    for (let i = 0; i < 3; i += 1) {
      const record = await createCareerMapRecord({ source: "paste", inputText: "x", ipHash: "h" });
      setCareerMapCreatedAtForTests(record.id, new Date(now.getTime() - (5 - i) * 3_600_000).toISOString());
    }
    expect(await checkCareerMapRateLimit("h", now)).toMatchObject({ ok: false, scope: "day", limit: 3 });
    expect(await checkCareerMapRateLimit("h2", now)).toEqual({ ok: true });
    await createCareerMapRecord({ source: "paste", inputText: "x", ipHash: "h2" });
    await createCareerMapRecord({ source: "paste", inputText: "x", ipHash: "h3" });
    expect(await checkCareerMapRateLimit("h4", now)).toMatchObject({ ok: false, scope: "global", limit: 5 });
  });
});

describe("career map email content", () => {
  test("names both titles, escapes HTML and keeps the hypothesis line", () => {
    const map = {
      ...EXAMPLE_CAREER_MAP,
      person: { ...EXAMPLE_CAREER_MAP.person, previousTitle: "Marketing <script>alert(1)</script>" },
    };
    const email = buildCareerMapEmail({ map, mapUrl: "https://www.myaiskilltutor.com/map/abc" });
    expect(email.subject).toContain("Go-to-Market Engineer");
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("https://www.myaiskilltutor.com/map/abc");
    expect(email.html).toContain("A career map is a starting hypothesis, not a hiring prediction.");
    expect(email.text).toContain("Planned 4 global game launches -> Builds AI launch workflows");
    expect(email.text).toContain("Hi Maya,");
  });
});
