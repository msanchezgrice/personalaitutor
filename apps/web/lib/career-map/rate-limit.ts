import "server-only";

import { createHash } from "node:crypto";
import { countRecentCareerMaps, findOldestRecentCareerMapAt } from "@/lib/career-map/store";

/**
 * Abuse protection for the anonymous career map endpoint. Every map costs one
 * or two LLM calls, so we cap attempts per hashed IP and globally. Raw IPs are
 * never stored: only sha256(secret + ip).
 *
 * Defaults: 5 per hour and 15 per day per IP hash, 1500 per day overall.
 * Override with CAREER_MAP_LIMIT_HOUR, CAREER_MAP_LIMIT_DAY and
 * CAREER_MAP_LIMIT_GLOBAL_DAY.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const CAREER_MAP_DEFAULT_LIMITS = { hour: 5, day: 15, globalDay: 1500 } as const;

let warnedMissingSecret = false;

function ipHashSecret(): string {
  const secret =
    process.env.CAREER_MAP_IP_SALT?.trim() ||
    process.env.IP_HASH_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.CLERK_SECRET_KEY?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === "production" && !warnedMissingSecret) {
    warnedMissingSecret = true;
    console.warn("[career-map] CAREER_MAP_IP_SALT is not set; IP hashes use a built-in salt");
  }
  return "career-map-local-ip-salt";
}

/** First client IP from the proxy headers Vercel sets, or "unknown". */
export function getRequestIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip")?.trim() || req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  return real || "unknown";
}

/** sha256 of a server secret plus the request IP, hex encoded. */
export function hashRequestIp(req: Request): string {
  return createHash("sha256").update(`${ipHashSecret()}:${getRequestIp(req)}`).digest("hex");
}

function envLimit(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

export function resolveCareerMapLimits() {
  return {
    hour: envLimit("CAREER_MAP_LIMIT_HOUR", CAREER_MAP_DEFAULT_LIMITS.hour),
    day: envLimit("CAREER_MAP_LIMIT_DAY", CAREER_MAP_DEFAULT_LIMITS.day),
    globalDay: envLimit("CAREER_MAP_LIMIT_GLOBAL_DAY", CAREER_MAP_DEFAULT_LIMITS.globalDay),
  };
}

export type CareerMapRateLimitResult =
  | { ok: true }
  | { ok: false; scope: "hour" | "day" | "global"; limit: number; retryAfterSeconds: number };

async function retryAfter(input: { ipHash?: string; sinceIso: string; windowMs: number; now: number }) {
  const oldest = await findOldestRecentCareerMapAt({ ipHash: input.ipHash, sinceIso: input.sinceIso });
  if (!oldest) return 60;
  const freesAt = Date.parse(oldest) + input.windowMs;
  return Math.max(1, Math.ceil((freesAt - input.now) / 1000));
}

/**
 * `includesCurrent`: the caller has already recorded this attempt, so the
 * counts include it and an attempt is refused when a count goes OVER its limit
 * (the Nth of N allowed attempts still passes). Recording first is what makes
 * the limit hold under parallel requests.
 */
export async function checkCareerMapRateLimit(
  ipHash: string,
  now: Date = new Date(),
  options: { includesCurrent?: boolean } = {},
): Promise<CareerMapRateLimitResult> {
  const limits = resolveCareerMapLimits();
  const own = options.includesCurrent ? 1 : 0;
  const nowMs = now.getTime();
  const hourAgo = new Date(nowMs - HOUR_MS).toISOString();
  const dayAgo = new Date(nowMs - DAY_MS).toISOString();

  const [hourCount, dayCount, globalCount] = await Promise.all([
    countRecentCareerMaps({ ipHash, sinceIso: hourAgo }),
    countRecentCareerMaps({ ipHash, sinceIso: dayAgo }),
    countRecentCareerMaps({ sinceIso: dayAgo }),
  ]);

  if (globalCount - own >= limits.globalDay) {
    return {
      ok: false,
      scope: "global",
      limit: limits.globalDay,
      retryAfterSeconds: await retryAfter({ sinceIso: dayAgo, windowMs: DAY_MS, now: nowMs }),
    };
  }
  if (dayCount - own >= limits.day) {
    return {
      ok: false,
      scope: "day",
      limit: limits.day,
      retryAfterSeconds: await retryAfter({ ipHash, sinceIso: dayAgo, windowMs: DAY_MS, now: nowMs }),
    };
  }
  if (hourCount - own >= limits.hour) {
    return {
      ok: false,
      scope: "hour",
      limit: limits.hour,
      retryAfterSeconds: await retryAfter({ ipHash, sinceIso: hourAgo, windowMs: HOUR_MS, now: nowMs }),
    };
  }
  return { ok: true };
}
