import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { VoiceModelRunResult } from "@aitutor/shared";
import { listRecentVoiceModelRunTimes } from "@/lib/voice-model/store";

/**
 * Public "try my model" limits and the helpers they need.
 *
 * - Visitors are identified only by sha256(ip + server secret). Raw IPs are
 *   never stored or logged.
 * - 6 public runs per hour per IP hash (across all models), 80 public runs
 *   per day per model, and 200 public runs per day across all of one
 *   learner's models. Override with VOICE_MODEL_LIMIT_IP_HOUR,
 *   VOICE_MODEL_LIMIT_MODEL_DAY and VOICE_MODEL_LIMIT_OWNER_DAY.
 * - The public run route records the run row BEFORE calling the model and
 *   then checks with `alreadyRecorded: true`, so the current run is part of
 *   the count. Two racing requests both see each other and both lose, rather
 *   than both slipping under the limit.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

let processSecret: string | null = null;
let derivedSecret: { source: string; value: string } | null = null;
let warnedProductionFallback = false;

/** Fixed label so the derived secret is never the service role key itself. */
const DERIVED_SECRET_LABEL = "voice-model-hash-secret:v1:";

/**
 * Server secret for hashing and signing. Set VOICE_MODEL_HASH_SECRET (or the
 * shared IP_HASH_SECRET).
 *
 * In production (VERCEL_ENV=production) without either, we do not silently
 * use a per-process random secret: IP hashes and demo signatures would then
 * differ between instances (rate limits leak, saved-demo signatures fail at
 * random). Instead we log one console.error and derive a stable secret from
 * SUPABASE_SERVICE_ROLE_KEY (sha256 with a fixed label). With no service role
 * key either, this throws: the routes fail closed with a 500.
 *
 * Outside production, a random per-process secret keeps raw IPs out of
 * storage for local dev and tests.
 */
export function voiceModelServerSecret(): string {
  const configured = process.env.VOICE_MODEL_HASH_SECRET?.trim() || process.env.IP_HASH_SECRET?.trim();
  if (configured) return configured;

  if (process.env.VERCEL_ENV === "production") {
    if (!warnedProductionFallback) {
      warnedProductionFallback = true;
      console.error(
        "[voice-model] VOICE_MODEL_HASH_SECRET and IP_HASH_SECRET are not set in production; deriving the hash secret from SUPABASE_SERVICE_ROLE_KEY. Set VOICE_MODEL_HASH_SECRET.",
      );
    }
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim();
    if (!serviceKey) throw new Error("VOICE_MODEL_HASH_SECRET_MISSING");
    if (!derivedSecret || derivedSecret.source !== serviceKey) {
      derivedSecret = { source: serviceKey, value: createHash("sha256").update(`${DERIVED_SECRET_LABEL}${serviceKey}`).digest("hex") };
    }
    return derivedSecret.value;
  }

  if (!processSecret) processSecret = randomBytes(32).toString("hex");
  return processSecret;
}

/** Test hook: forget the one-time warning and the cached secrets. */
export function resetVoiceModelSecretForTests(): void {
  processSecret = null;
  derivedSecret = null;
  warnedProductionFallback = false;
}

/** First address in x-forwarded-for, else x-real-ip, else "unknown". */
export function requestIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export function hashVoiceModelRequestIp(req: Request): string {
  return createHash("sha256").update(`${requestIp(req)}|${voiceModelServerSecret()}`).digest("hex");
}

function envLimit(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function voiceModelPublicLimits() {
  return {
    perIpHour: envLimit("VOICE_MODEL_LIMIT_IP_HOUR", 6),
    perModelDay: envLimit("VOICE_MODEL_LIMIT_MODEL_DAY", 80),
    perOwnerDay: envLimit("VOICE_MODEL_LIMIT_OWNER_DAY", 200),
  };
}

export type VoiceModelRateLimitResult =
  | { ok: true }
  | { ok: false; scope: "ip" | "model" | "owner"; retryAfterSeconds: number; message: string };

function retryAfter(oldestIso: string, windowMs: number, now: number): number {
  return Math.max(1, Math.ceil((new Date(oldestIso).getTime() + windowMs - now) / 1000));
}

export async function checkVoiceModelPublicRateLimit(input: {
  voiceModelId: string;
  ipHash: string;
  /** Every model id of the model's owner (for the per-owner daily cap). Defaults to just this model. */
  ownerVoiceModelIds?: string[];
  /** The current run is already stored, so it is part of each count: over the limit means more than `limit`. */
  alreadyRecorded?: boolean;
  now?: Date;
}): Promise<VoiceModelRateLimitResult> {
  const now = (input.now ?? new Date()).getTime();
  const limits = voiceModelPublicLimits();
  const extra = input.alreadyRecorded ? 1 : 0;
  const over = (count: number, limit: number) => count >= limit + extra;

  const ipRuns = await listRecentVoiceModelRunTimes({
    ipHash: input.ipHash,
    source: "public",
    sinceIso: new Date(now - HOUR_MS).toISOString(),
    limit: limits.perIpHour + extra,
  });
  if (over(ipRuns.length, limits.perIpHour)) {
    const seconds = retryAfter(ipRuns[0]!, HOUR_MS, now);
    const minutes = Math.max(1, Math.ceil(seconds / 60));
    return {
      ok: false,
      scope: "ip",
      retryAfterSeconds: seconds,
      message: `You have run ${limits.perIpHour} comparisons in the last hour. Try again in about ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`,
    };
  }

  const modelRuns = await listRecentVoiceModelRunTimes({
    voiceModelId: input.voiceModelId,
    source: "public",
    sinceIso: new Date(now - DAY_MS).toISOString(),
    limit: limits.perModelDay + extra,
  });
  if (over(modelRuns.length, limits.perModelDay)) {
    return {
      ok: false,
      scope: "model",
      retryAfterSeconds: retryAfter(modelRuns[0]!, DAY_MS, now),
      message: "This model has had all its runs for today. Try again tomorrow.",
    };
  }

  const ownerIds = input.ownerVoiceModelIds?.length ? input.ownerVoiceModelIds : [input.voiceModelId];
  const ownerRuns = await listRecentVoiceModelRunTimes({
    voiceModelIds: ownerIds,
    source: "public",
    sinceIso: new Date(now - DAY_MS).toISOString(),
    limit: limits.perOwnerDay + extra,
  });
  if (over(ownerRuns.length, limits.perOwnerDay)) {
    return {
      ok: false,
      scope: "owner",
      retryAfterSeconds: retryAfter(ownerRuns[0]!, DAY_MS, now),
      message: "This learner's models have had all their runs for today. Try again tomorrow.",
    };
  }

  return { ok: true };
}

// --- demo signatures ---------------------------------------------------------
// The saved demo on a public page must be a comparison that really ran. Owner
// runs return a signature over (model id, prompt, outputs); saving a demo
// requires it, so edited text cannot be passed off as model output.

function demoPayload(voiceModelId: string, result: VoiceModelRunResult): string {
  return JSON.stringify([voiceModelId, result.prompt, result.baseOutput, result.tunedOutput]);
}

export function signVoiceModelRun(voiceModelId: string, result: VoiceModelRunResult): string {
  return createHmac("sha256", voiceModelServerSecret()).update(demoPayload(voiceModelId, result)).digest("base64url");
}

export function verifyVoiceModelRunSignature(voiceModelId: string, result: VoiceModelRunResult, signature: string): boolean {
  const expected = Buffer.from(signVoiceModelRun(voiceModelId, result));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
