import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@aitutor/shared";
import { runtimeUpdateProfile } from "@/lib/runtime";
import { resolveProofSiteAccess } from "@/lib/proof/site-access";
import {
  buildProofSiteState,
  loadLatestCompletedMap,
  normalizeLinkedinUrl,
  proofSiteUpdateSchema,
  revalidatePublicProfile,
} from "@/lib/proof/site-api";
import { checkProfileHandleAvailable } from "@/lib/proof/site-profile";
import { isProofSiteLive } from "@/lib/proof/site-publication";
import { getProofSite, upsertProofSite } from "@/lib/proof/site-store";

/** The learner's proof site settings, their profile basics and their latest career map. */
export async function GET(req: NextRequest) {
  try {
    const access = await resolveProofSiteAccess(req);
    if (!access.ok) return access.response;
    const state = await buildProofSiteState(access.profile);
    return jsonOk(state);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "UNKNOWN";
    return jsonError("PROOF_SITE_FAILED", "Unable to load your proof site right now", 500, { reason: reason.slice(0, 300) });
  }
}

/**
 * Saves the proof site and keeps learner_profiles in sync: handle (validated,
 * 409 when taken), headline (= new title), bio and the LinkedIn link go
 * through the existing profile update path.
 *
 * Saving is not publishing: for a learner whose profile was already public,
 * visitors keep seeing the earlier page until they publish from the editor
 * (POST /api/proof/site/publish). `siteLive` says which one visitors see.
 */
export async function PUT(req: NextRequest) {
  try {
    const access = await resolveProofSiteAccess(req);
    if (!access.ok) return access.response;

    const parsed = proofSiteUpdateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return jsonError("INVALID_BODY", "Some fields are missing or too long", 400, { issues: parsed.error.issues });
    }
    const body = parsed.data;
    const profile = access.profile;

    const handleCheck = await checkProfileHandleAvailable({ handle: body.handle, learnerProfileId: profile.id });
    if (!handleCheck.ok) {
      return jsonError(handleCheck.code, handleCheck.message, handleCheck.code === "HANDLE_TAKEN" ? 409 : 400, { field: "handle" });
    }

    const linkedinUrl = normalizeLinkedinUrl(body.linkedinUrl);
    if (linkedinUrl === "INVALID") {
      return jsonError("INVALID_BODY", "Use a linkedin.com address for LinkedIn", 400, { field: "linkedinUrl" });
    }

    const existing = await getProofSite(profile.id);
    const latestMap = existing?.careerMapId ? null : await loadLatestCompletedMap(profile.id);

    const updatedProfile = await runtimeUpdateProfile(profile.id, {
      handle: handleCheck.handle,
      headline: body.newTitle,
      bio: body.bio,
      socialLinks: { ...profile.socialLinks, linkedin: linkedinUrl ?? undefined },
    });
    if (!updatedProfile) {
      return jsonError("USER_NOT_FOUND", "Profile update requires a valid user", 404);
    }
    if (updatedProfile.handle !== handleCheck.handle) {
      // Another learner claimed the handle between the check and the write.
      return jsonError("HANDLE_TAKEN", `The address /u/${handleCheck.handle} is taken. Try another one.`, 409, {
        field: "handle",
        savedHandle: updatedProfile.handle,
      });
    }

    const site = await upsertProofSite({
      learnerProfileId: profile.id,
      careerMapId: existing?.careerMapId ?? latestMap?.id ?? null,
      newTitle: body.newTitle,
      previousRole: body.previousRole?.trim() ? body.previousRole.trim() : null,
      tagline: body.tagline,
      bio: body.bio,
      translations: body.translations,
      contactEmail: body.contactEmail?.trim() ? body.contactEmail.trim().toLowerCase() : null,
      linkedinUrl,
    });

    await revalidatePublicProfile([profile.handle, updatedProfile.handle]);
    const siteLive = await isProofSiteLive({ site, profilePublished: Boolean(updatedProfile.published) });

    return jsonOk({
      site,
      siteLive,
      profile: { handle: updatedProfile.handle, name: updatedProfile.name, published: Boolean(updatedProfile.published) },
      publicUrl: `/u/${updatedProfile.handle}`,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "UNKNOWN";
    return jsonError("PROOF_SITE_SAVE_FAILED", "Unable to save your proof site right now", 500, {
      reason: reason.slice(0, 300),
      recoveryAction: "Try saving again in a minute",
    });
  }
}
