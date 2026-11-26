import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { VoiceModelRunResult } from "@aitutor/shared";
import { listRecentVoiceModelRunTimes } from "@/lib/voice-model/store";

/**
 * Public "try my model" limits and the helpers they need.
 *
 * - Visitors are identified only by sha256(ip + server secret). Raw IPs are
 *   never stored or logged.
 * - 6 public runs per hour per IP hash (across all models) and 80 public runs
 *   per day per model. Override with VOICE_MODEL_LIMIT_IP_HOUR and
 *   VOICE_MODEL_LIMIT_MODEL_DAY.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

let processSecret: string | null = null;

/**
 * Server secret for hashing and signing. Set VOICE_MODEL_HASH_SECRET (or the
 * shared IP_HASH_SECRET) in production. Without one, a random per-process
 * secret keeps raw IPs out of storage but hashes then differ across instances.
 */
export function voiceModelServerSecret(): string {
  const configured = process.env.VOICE_MODEL_HASH_SECRET?.trim() || process.env.IP_HASH_SECRET?.trim();
  if (configured) return configured;
  if (!processSecret) processSecret = randomBytes(32).toString("hex");
  return processSecret;
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
  };
}

export type VoiceModelRateLimitResult =
  | { ok: true }
  | { ok: false; scope: "ip" | "model"; retryAfterSeconds: number; message: string };

function retryAfter(oldestIso: string, windowMs: number, now: number): number {
  return Math.max(1, Math.ceil((new Date(oldestIso).getTime() + windowMs - now) / 1000));
}

export async function checkVoiceModelPublicRateLimit(input: {
  voiceModelId: string;
  ipHash: string;
  now?: Date;
}): Promise<VoiceModelRateLimitResult> {
  const now = (input.now ?? new Date()).getTime();
  const limits = voiceModelPublicLimits();

  const ipRuns = await listRecentVoiceModelRunTimes({
    ipHash: input.ipHash,
    source: "public",
    sinceIso: new Date(now - HOUR_MS).toISOString(),
    limit: limits.perIpHour,
  });
  if (ipRuns.length >= limits.perIpHour) {
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
    limit: limits.perModelDay,
  });
  if (modelRuns.length >= limits.perModelDay) {
    return {
      ok: false,
      scope: "model",
      retryAfterSeconds: retryAfter(modelRuns[0]!, DAY_MS, now),
      message: "This model has had all its runs for today. Try again tomorrow.",
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
