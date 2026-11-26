import "server-only";
import type { CareerMap, ProofPieceStatus } from "@aitutor/shared";
import { getLatestCareerMapForProfile } from "@/lib/career-map/store";
import { getProofSiteStatus } from "@/lib/proof/site-store";
import { getVoiceModelStatus } from "@/lib/voice-model/store";
import { getBuildLogStatus } from "@/lib/build-log/store";
import type { ProofStatuses } from "@/components/dashboard/route-pieces";

/**
 * Server-side loaders for the Career Map page, the Proof Studio hub and the
 * dashboard "Your route" card. Every loader is failure-isolated: a failing
 * store becomes an explicit "error"/null result that the page renders as
 * "unavailable", never a thrown error and never made-up content.
 */

export type LearnerCareerMap = { token: string; map: CareerMap; createdAt: string };

export type LearnerCareerMapResult =
  | { status: "ok"; value: LearnerCareerMap }
  | { status: "none" }
  | { status: "error" };

function reason(error: unknown) {
  return error instanceof Error ? error.message : "unknown";
}

export async function loadLearnerCareerMap(learnerProfileId: string | null | undefined): Promise<LearnerCareerMapResult> {
  if (!learnerProfileId) return { status: "none" };
  try {
    const record = await getLatestCareerMapForProfile(learnerProfileId);
    if (!record || record.status !== "completed" || !record.map) return { status: "none" };
    return { status: "ok", value: { token: record.token, map: record.map, createdAt: record.createdAt } };
  } catch (error) {
    console.warn("[career-map] latest map load failed", reason(error));
    return { status: "error" };
  }
}

async function settle(label: string, run: () => Promise<ProofPieceStatus>): Promise<ProofPieceStatus | null> {
  try {
    const status = await run();
    if (!status || (status.state !== "empty" && status.state !== "draft" && status.state !== "live")) return null;
    return { state: status.state, summary: typeof status.summary === "string" ? status.summary : "" };
  } catch (error) {
    console.warn(`[proof-studio] ${label} status failed`, reason(error));
    return null;
  }
}

export async function loadProofStatuses(input: { learnerProfileId: string; published: boolean }): Promise<ProofStatuses> {
  const [site, model, log] = await Promise.all([
    settle("site", () => getProofSiteStatus({ learnerProfileId: input.learnerProfileId, published: input.published })),
    settle("voice model", () => getVoiceModelStatus(input.learnerProfileId)),
    settle("build log", () => getBuildLogStatus(input.learnerProfileId)),
  ]);
  return { site, model, log };
}

export type YourRouteCardData = {
  map: LearnerCareerMapResult;
  statuses: ProofStatuses | null;
};

/** Data for the dashboard home card. Null when the map could not be loaded (the card is then hidden). */
export async function loadYourRouteCard(input: { learnerProfileId: string; published: boolean }): Promise<YourRouteCardData | null> {
  const map = await loadLearnerCareerMap(input.learnerProfileId);
  if (map.status === "error") return null;
  if (map.status === "none") return { map, statuses: null };
  return { map, statuses: await loadProofStatuses(input) };
}
