import "server-only";
import { CAREER_MAP_COOKIE_NAME } from "@aitutor/shared";
import { linkCareerMapByToken, linkCareerMapsByEmail } from "@/lib/career-map/store";

/**
 * Attaches career maps drawn before sign-up to the learner's profile.
 *
 * Two sources:
 *  1. The httpOnly `CAREER_MAP_COOKIE_NAME` cookie set by POST /api/career-map
 *     (the visitor's latest map token, kept for 30 days).
 *  2. Any unlinked map whose "Keep this map" email matches the learner's email.
 *
 * Called beside `linkAnonymousAssessmentsToProfile` on dashboard load and in the
 * onboarding claim/complete routes. It never throws: every failure is logged
 * with console.warn and the caller carries on, exactly like the assessment
 * linking next to it.
 *
 * Cheap on repeat loads: a per-process memo remembers which (profile, email,
 * token) combinations were already handled, so a dashboard load with nothing
 * new to link does not touch the store. The store calls are idempotent
 * anyway (they only claim unlinked rows and never steal another learner's map),
 * so a cold instance re-running them is harmless.
 */

export type CareerMapLinkResult = {
  /** True when the store was not called because this combination was already handled. */
  skipped: boolean;
  /** True when the cookie's map is now linked to this learner. */
  linkedByToken: boolean;
  /** Maps linked by email in this call. */
  linkedByEmail: number;
  /** Steps that failed (logged, never thrown). */
  failures: Array<"token" | "email">;
};

/** How long a handled combination stays in the memo. Short enough that a map captured later by email is picked up. */
export const CAREER_MAP_LINK_MEMO_TTL_MS = 10 * 60 * 1000;
const MEMO_MAX_ENTRIES = 5000;
const TOKEN_MAX_CHARS = 200;

const handledTokens = new Map<string, number>();
const handledEmails = new Map<string, number>();

function normalizeEmail(email: string | null | undefined): string | null {
  const value = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!value || !value.includes("@") || value.length > 320) return null;
  return value;
}

function normalizeToken(token: string | null | undefined): string | null {
  const value = typeof token === "string" ? token.trim() : "";
  if (!value || value.length > TOKEN_MAX_CHARS) return null;
  return value;
}

function isFresh(memo: Map<string, number>, key: string, now: number) {
  const at = memo.get(key);
  if (at === undefined) return false;
  if (now - at > CAREER_MAP_LINK_MEMO_TTL_MS) {
    memo.delete(key);
    return false;
  }
  return true;
}

function remember(memo: Map<string, number>, key: string, now: number) {
  if (memo.size >= MEMO_MAX_ENTRIES) {
    // Drop the oldest entry (Map keeps insertion order).
    const oldest = memo.keys().next().value;
    if (oldest !== undefined) memo.delete(oldest);
  }
  memo.set(key, now);
}

function reason(error: unknown) {
  return error instanceof Error ? error.message : "unknown";
}

/**
 * Linking by email is OFF. Neither side of the match is proven: the address on
 * a map is whatever was typed into "Keep this map", and nothing here checks
 * that the account's address is verified. With it on, anyone could put a
 * stranger's address on a map of their own and have it appear in that
 * stranger's dashboard. Maps are linked by the browser cookie only. Turn this
 * back on only together with a confirm-by-email step (a signed link sent to
 * the address) and a verified-address check on the account.
 */
export const CAREER_MAP_LINK_BY_EMAIL: boolean = false;

export async function linkCareerMapsForLearner(input: {
  learnerProfileId: string | null | undefined;
  email?: string | null;
  cookieToken?: string | null;
}): Promise<CareerMapLinkResult> {
  const result: CareerMapLinkResult = { skipped: true, linkedByToken: false, linkedByEmail: 0, failures: [] };
  try {
    const learnerProfileId = typeof input?.learnerProfileId === "string" ? input.learnerProfileId.trim() : "";
    if (!learnerProfileId) return result;

    const token = normalizeToken(input.cookieToken);
    const email = normalizeEmail(input.email);
    const now = Date.now();
    const tokenKey = token ? `${learnerProfileId}|${token}` : null;
    const emailKey = email ? `${learnerProfileId}|${email}` : null;

    if (tokenKey && !isFresh(handledTokens, tokenKey, now)) {
      result.skipped = false;
      try {
        const record = await linkCareerMapByToken({ token: token as string, learnerProfileId });
        result.linkedByToken = Boolean(record && record.learnerProfileId === learnerProfileId);
        // Remember the token even when it was unknown or belongs to someone
        // else: retrying it on every load would not change the answer.
        remember(handledTokens, tokenKey, now);
      } catch (error) {
        result.failures.push("token");
        console.warn("[career-map] cookie map link failed", reason(error));
      }
    }

    if (CAREER_MAP_LINK_BY_EMAIL && emailKey && !isFresh(handledEmails, emailKey, now)) {
      result.skipped = false;
      try {
        const linked = await linkCareerMapsByEmail({ email: email as string, learnerProfileId });
        result.linkedByEmail = Number.isFinite(linked) && linked > 0 ? linked : 0;
        remember(handledEmails, emailKey, now);
      } catch (error) {
        result.failures.push("email");
        console.warn("[career-map] email map link failed", reason(error));
      }
    }
  } catch (error) {
    console.warn("[career-map] map link failed", reason(error));
  }
  return result;
}

/** Reads the career map cookie in a server component or route handler. Null when absent or outside a request. */
export async function readCareerMapCookieToken(): Promise<string | null> {
  try {
    const { cookies } = await import("next/headers");
    const store = await cookies();
    return normalizeToken(store.get(CAREER_MAP_COOKIE_NAME)?.value ?? null);
  } catch {
    return null;
  }
}

/** Reads the career map cookie from a request's Cookie header (route handlers; works with plain Request in tests). */
export function readCareerMapCookieFromRequest(req: { headers?: { get(name: string): string | null } } | null | undefined): string | null {
  try {
    const header = req?.headers?.get("cookie");
    if (!header) return null;
    for (const part of header.split(";")) {
      const index = part.indexOf("=");
      if (index === -1) continue;
      if (part.slice(0, index).trim() !== CAREER_MAP_COOKIE_NAME) continue;
      const raw = part.slice(index + 1).trim();
      let value = raw;
      try {
        value = decodeURIComponent(raw);
      } catch {
        value = raw;
      }
      return normalizeToken(value);
    }
    return null;
  } catch {
    return null;
  }
}

export function resetCareerMapLinkMemoForTests() {
  handledTokens.clear();
  handledEmails.clear();
}
