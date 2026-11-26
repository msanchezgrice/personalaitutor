import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@aitutor/shared";
import { runtimePublishProfile } from "@/lib/runtime";
import { resolveProofSiteAccess } from "@/lib/proof/site-access";
import { revalidatePublicProfile } from "@/lib/proof/site-api";
import { recordProofSitePublished } from "@/lib/proof/site-publication";
import { getProofSite } from "@/lib/proof/site-store";

/**
 * The proof site editor's Publish button. Publishes the profile when it is not
 * yet published, and records the explicit proof-site publish that makes the
 * saved site the public page (see lib/proof/site-publication.ts). Until this
 * runs, a learner whose profile was already public keeps their earlier page.
 */
export async function POST(req: NextRequest) {
  try {
    const access = await resolveProofSiteAccess(req);
    if (!access.ok) return access.response;

    const site = await getProofSite(access.profile.id);
    if (!site) {
      return jsonError("PROOF_SITE_NOT_SAVED", "Save your site before you publish it.", 409);
    }

    let profile = access.profile;
    if (!profile.published) {
      const published = await runtimePublishProfile(access.userId);
      if (!published) {
        return jsonError("USER_NOT_FOUND", "Cannot publish profile for unknown user", 404);
      }
      profile = published;
    }
    await recordProofSitePublished({ learnerProfileId: profile.id, handle: profile.handle });
    await revalidatePublicProfile([profile.handle]);

    return jsonOk({
      profile: { handle: profile.handle, name: profile.name, published: true },
      publicUrl: `/u/${profile.handle}`,
      siteLive: true,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "UNKNOWN";
    return jsonError("PROOF_SITE_PUBLISH_FAILED", "Unable to publish your page right now", 500, {
      reason: reason.slice(0, 300),
      recoveryAction: "Try again in a minute",
    });
  }
}
