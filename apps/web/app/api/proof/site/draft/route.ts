import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@aitutor/shared";
import { resolveProofSiteAccess } from "@/lib/proof/site-access";
import { loadLatestCompletedMap } from "@/lib/proof/site-api";
import { draftProofSite } from "@/lib/proof/site-draft";

export const maxDuration = 120;

/**
 * Drafts the site copy from the learner's latest career map. Does not save:
 * the editor fills the form and the learner saves with PUT /api/proof/site.
 * Hard failure on any LLM problem; nothing is invented to fill the gap.
 */
export async function POST(req: NextRequest) {
  try {
    const access = await resolveProofSiteAccess(req);
    if (!access.ok) return access.response;

    const record = await loadLatestCompletedMap(access.profile.id);
    if (!record?.map) {
      return jsonError("CAREER_MAP_MISSING", "Map your career first, then draft your site from it", 409, {
        recoveryAction: "Create a career map at /map",
      });
    }

    try {
      const result = await draftProofSite({ map: record.map, profile: { name: access.profile.name } });
      return jsonOk({
        draft: result.draft,
        model: result.model,
        newTitle: result.newTitle,
        previousRole: result.previousRole,
        careerMapId: record.id,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "UNKNOWN";
      const code = reason.startsWith("OPENAI_CONFIG_MISSING") ? "OPENAI_CONFIG_MISSING" : "PROOF_SITE_DRAFT_FAILED";
      return jsonError(code, "Unable to draft your site right now", 502, {
        reason: reason.slice(0, 300),
        recoveryAction: "Try the draft again in a minute, or write the fields yourself",
      });
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : "UNKNOWN";
    return jsonError("PROOF_SITE_DRAFT_FAILED", "Unable to draft your site right now", 500, { reason: reason.slice(0, 300) });
  }
}
