import "server-only";

/**
 * Per-IP limit for the public résumé extract endpoint
 * (POST /api/career-map/extract): 20 extracts per 10 minutes per IP hash.
 *
 * Extracts are not stored anywhere, so there is no table to count. This is an
 * in-process sliding window: it is per server instance (each serverless
 * instance keeps its own Map, and a cold start forgets it). It is a speed
 * bump against one client hammering the PDF/DOCX parsers, not a guarantee.
 * The key is the IP hash from `hashRequestIp`; raw IPs are never kept.
 */

export const RESUME_EXTRACT_LIMIT = 20;
export const RESUME_EXTRACT_WINDOW_MS = 10 * 60 * 1000;
/** Keys kept at most. Past this, expired keys are pruned, then the oldest keys are dropped. */
export const RESUME_EXTRACT_MAX_KEYS = 10_000;

const hits = new Map<string, number[]>();

export function resetResumeExtractRateLimitForTests(): void {
  hits.clear();
}

export function resumeExtractRateLimitKeyCount(): number {
  return hits.size;
}

function prune(now: number) {
  const cutoff = now - RESUME_EXTRACT_WINDOW_MS;
  for (const [key, times] of hits) {
    if (times.length === 0 || times[times.length - 1]! <= cutoff) hits.delete(key);
  }
  // Still too many live keys: drop the oldest inserted (Map keeps insertion order).
  for (const key of hits.keys()) {
    if (hits.size < RESUME_EXTRACT_MAX_KEYS) break;
    hits.delete(key);
  }
}

export type ResumeExtractRateLimitResult = { ok: true } | { ok: false; limit: number; retryAfterSeconds: number };

/** Counts this attempt when it is allowed. */
export function checkResumeExtractRateLimit(ipHash: string, now: number = Date.now()): ResumeExtractRateLimitResult {
  const cutoff = now - RESUME_EXTRACT_WINDOW_MS;
  const recent = (hits.get(ipHash) ?? []).filter((time) => time > cutoff);

  if (recent.length >= RESUME_EXTRACT_LIMIT) {
    hits.set(ipHash, recent);
    const oldest = recent[0]!;
    return {
      ok: false,
      limit: RESUME_EXTRACT_LIMIT,
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + RESUME_EXTRACT_WINDOW_MS - now) / 1000)),
    };
  }

  if (!hits.has(ipHash) && hits.size >= RESUME_EXTRACT_MAX_KEYS) prune(now);
  recent.push(now);
  // Re-insert so the Map's order tracks the most recent activity.
  hits.delete(ipHash);
  hits.set(ipHash, recent);
  return { ok: true };
}
