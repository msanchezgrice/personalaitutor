import "server-only";
import type { NextRequest } from "next/server";
import { jsonError, type UserProfile } from "@aitutor/shared";
import { getAuthSeed } from "@/lib/auth";
import { getUserId } from "@/lib/api";
import { billingSeedFromAuthSeed, requireBillingAccess } from "@/lib/billing-access";

/**
 * Auth + entitlement for the proof site API. Signed-in user, active trial or
 * subscription, and a learner profile. `requireBilling: false` is used only by
 * unpublish, so a learner whose plan lapsed can still take their page down.
 */
export async function resolveProofSiteAccess(
  req: NextRequest,
  options: { requireBilling?: boolean } = {},
): Promise<{ ok: true; userId: string; profile: UserProfile } | { ok: false; response: Response }> {
  const seed = await getAuthSeed(req).catch(() => null);
  const userId = seed?.userId ?? getUserId(req);
  if (!userId) {
    return { ok: false, response: jsonError("UNAUTHENTICATED", "Sign in required", 401) };
  }
  const access = await requireBillingAccess({
    userId,
    seed: billingSeedFromAuthSeed(seed),
    message: "Start your 7-day free trial to build your proof site.",
  });
  if (!access.ok && options.requireBilling !== false) {
    return { ok: false, response: access.response };
  }
  const profile = access.billing.profile;
  if (!profile) {
    return { ok: false, response: jsonError("USER_NOT_FOUND", "No learner profile", 404) };
  }
  return { ok: true, userId, profile };
}
