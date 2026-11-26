import "server-only";

import type { NextRequest } from "next/server";
import type { UserProfile } from "@aitutor/shared";
import { jsonError } from "@aitutor/shared";
import { getAuthSeed } from "@/lib/auth";
import { getUserId } from "@/lib/api";
import { billingSeedFromAuthSeed, requireBillingAccess } from "@/lib/billing-access";

/** Shared gate for every owner route under /api/build-log: signed in + Career Builder access + a learner profile. */
export async function resolveBuildLogAccess(
  req: NextRequest,
): Promise<{ ok: true; profile: UserProfile } | { ok: false; response: Response }> {
  const seed = await getAuthSeed(req);
  const userId = seed?.userId ?? getUserId(req);
  if (!userId) {
    return { ok: false, response: jsonError("UNAUTHENTICATED", "Sign in required", 401) };
  }
  const access = await requireBillingAccess({
    userId,
    seed: billingSeedFromAuthSeed(seed),
    message: "Start your 7-day free trial to write your build log.",
  });
  if (!access.ok) return { ok: false, response: access.response };
  const profile = access.billing.profile;
  if (!profile) {
    return { ok: false, response: jsonError("USER_NOT_FOUND", "No learner profile", 404) };
  }
  return { ok: true, profile };
}

export function buildLogPostPath(handle: string, slug: string) {
  return `/u/${encodeURIComponent(handle)}/log/${encodeURIComponent(slug)}`;
}

export function buildLogFailure(error: unknown, fallbackCode = "BUILD_LOG_FAILED") {
  const reason = error instanceof Error ? error.message : "UNKNOWN";
  if (reason === "BUILD_LOG_LIMIT_REACHED") {
    return jsonError("BUILD_LOG_LIMIT_REACHED", "You have reached the post limit. Delete an old draft first.", 409);
  }
  if (reason === "BUILD_LOG_TITLE_REQUIRED") {
    return jsonError("BUILD_LOG_TITLE_REQUIRED", "Add a title first.", 400);
  }
  return jsonError(fallbackCode, "Something went wrong with your build log. Try again.", 500, { reason: reason.slice(0, 300) });
}
