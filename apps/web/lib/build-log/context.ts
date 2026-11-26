import "server-only";

import { getCareerMapTitle } from "@aitutor/shared";
import { getLatestCareerMapForProfile } from "@/lib/career-map/store";
import { getProofSite } from "@/lib/proof/site-store";

/**
 * What the build log borrows from the rest of the product: the learner's new
 * title and the first-post suggestion from their career map. Every lookup is
 * failure-isolated: a missing map or a store error just means "no context".
 */

export type BuildLogMapContext = {
  newTitle: string | null;
  previousTitle: string | null;
  firstPostTitle: string | null;
  firstPostSummary: string | null;
};

export async function getBuildLogMapContext(learnerProfileId: string): Promise<BuildLogMapContext | null> {
  try {
    const record = await getLatestCareerMapForProfile(learnerProfileId);
    const map = record?.status === "completed" ? record.map : null;
    if (!map) return null;
    return {
      newTitle: getCareerMapTitle(map.primary.titleId)?.title ?? null,
      previousTitle: map.person.previousTitle || null,
      firstPostTitle: map.proofPlan.buildLog.firstPostTitle || null,
      firstPostSummary: map.proofPlan.buildLog.summary || null,
    };
  } catch {
    return null;
  }
}

/** The title to show under the author's name: the one on their proof site, else the one on their map. */
export async function getAuthorNewTitle(learnerProfileId: string): Promise<string | null> {
  try {
    const site = await getProofSite(learnerProfileId);
    if (site?.newTitle?.trim()) return site.newTitle.trim();
  } catch {
    // Fall through to the map.
  }
  const context = await getBuildLogMapContext(learnerProfileId);
  return context?.newTitle ?? null;
}
