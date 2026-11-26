import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@aitutor/shared";
import { resolveProofSiteAccess } from "@/lib/proof/site-access";
import { revalidatePublicProfile } from "@/lib/proof/site-api";
import { unpublishLearnerProfile } from "@/lib/proof/site-profile";

/**
 * Takes the public page down (learner_profiles.published = false). Publishing
 * goes through POST /api/profile/publish. Unpublishing needs a signed-in
 * learner but no active plan: anyone can always take their own page down.
 */
export async function POST(req: NextRequest) {
  try {
    const access = await resolveProofSiteAccess(req, { requireBilling: false });
    if (!access.ok) return access.response;

    const profile = await unpublishLearnerProfile(access.profile.id);
    if (!profile) {
      return jsonError("USER_NOT_FOUND", "Cannot unpublish an unknown profile", 404);
    }
    await revalidatePublicProfile([profile.handle]);
    return jsonOk({ profile: { handle: profile.handle, name: profile.name, published: Boolean(profile.published) } });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "UNKNOWN";
    return jsonError("PROOF_SITE_UNPUBLISH_FAILED", "Unable to unpublish your page right now", 500, {
      reason: reason.slice(0, 300),
      recoveryAction: "Try again in a minute",
    });
  }
}
