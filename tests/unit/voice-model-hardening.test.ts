import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * Voice model defence in depth: the hash/signing secret fails closed in
 * production, and the owner billing check behind public runs is cached per
 * owner for 10 minutes.
 */

const { mockBillingSubscription } = vi.hoisted(() => ({ mockBillingSubscription: vi.fn() }));
vi.mock("@/lib/runtime", () => ({ runtimeFindUserByHandle: vi.fn(), runtimeGetBillingSubscription: mockBillingSubscription }));

import { resetVoiceModelSecretForTests, voiceModelServerSecret } from "../../apps/web/lib/voice-model/rate-limit";
import {
  VOICE_MODEL_OWNER_BILLING_TTL_MS,
  resetVoiceModelOwnerBillingCacheForTests,
  voiceModelOwnerHasBillingAccess,
} from "../../apps/web/lib/voice-model/public";

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("VOICE_MODEL_HASH_SECRET", "");
  vi.stubEnv("IP_HASH_SECRET", "");
  vi.stubEnv("SUPABASE_SERVICE_KEY", "");
  resetVoiceModelSecretForTests();
  resetVoiceModelOwnerBillingCacheForTests();
  mockBillingSubscription.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("voiceModelServerSecret", () => {
  test("uses VOICE_MODEL_HASH_SECRET, then IP_HASH_SECRET", () => {
    vi.stubEnv("IP_HASH_SECRET", "shared-secret");
    expect(voiceModelServerSecret()).toBe("shared-secret");
    vi.stubEnv("VOICE_MODEL_HASH_SECRET", "voice-secret");
    expect(voiceModelServerSecret()).toBe("voice-secret");
  });

  test("production without a secret: one console.error and a stable value derived from the service role key", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const expected = createHash("sha256").update("voice-model-hash-secret:v1:service-role-key").digest("hex");

    expect(voiceModelServerSecret()).toBe(expected);
    expect(voiceModelServerSecret()).toBe(expected);
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0]?.[0])).toContain("VOICE_MODEL_HASH_SECRET");
    expect(expected).not.toContain("service-role-key");

    // Another instance (a fresh process) derives the same value.
    resetVoiceModelSecretForTests();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(voiceModelServerSecret()).toBe(expected);
  });

  test("production with no secret and no service role key fails closed", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => voiceModelServerSecret()).toThrow("VOICE_MODEL_HASH_SECRET_MISSING");
  });

  test("outside production a random per-process secret is still used", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const first = voiceModelServerSecret();
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(voiceModelServerSecret()).toBe(first);
    resetVoiceModelSecretForTests();
    expect(voiceModelServerSecret()).not.toBe(first);
    expect(error).not.toHaveBeenCalled();
  });
});

describe("voiceModelOwnerHasBillingAccess", () => {
  test("trialing and active allow, anything else does not", async () => {
    mockBillingSubscription.mockResolvedValueOnce({ status: "trialing" });
    expect(await voiceModelOwnerHasBillingAccess("owner-1")).toBe(true);
    mockBillingSubscription.mockResolvedValueOnce({ status: "past_due" });
    expect(await voiceModelOwnerHasBillingAccess("owner-2")).toBe(false);
    mockBillingSubscription.mockResolvedValueOnce(null);
    expect(await voiceModelOwnerHasBillingAccess("owner-3")).toBe(false);
  });

  test("the answer is cached per owner for 10 minutes", async () => {
    const start = Date.parse("2026-11-25T12:00:00.000Z");
    mockBillingSubscription.mockResolvedValue({ status: "active" });
    expect(await voiceModelOwnerHasBillingAccess("owner-1", start)).toBe(true);

    mockBillingSubscription.mockResolvedValue({ status: "canceled" });
    expect(await voiceModelOwnerHasBillingAccess("owner-1", start + 60_000)).toBe(true);
    expect(mockBillingSubscription).toHaveBeenCalledTimes(1);

    expect(await voiceModelOwnerHasBillingAccess("owner-1", start + VOICE_MODEL_OWNER_BILLING_TTL_MS + 1)).toBe(false);
    expect(mockBillingSubscription).toHaveBeenCalledTimes(2);
    expect(mockBillingSubscription).toHaveBeenLastCalledWith("owner-1");
  });
});
