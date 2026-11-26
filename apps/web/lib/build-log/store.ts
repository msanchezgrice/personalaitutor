// FOUNDATION-SEED (owner: workstream F, build log). Signatures other
// workstreams rely on; workstream F replaces the bodies, adds whatever else it
// needs and removes this marker. Table: public.build_log_posts.
import "server-only";
import type { BuildLogPost, BuildLogPostPublic, ProofPieceStatus } from "@aitutor/shared";

const seed = (name: string): never => {
  throw new Error(`FOUNDATION_SEED_NOT_IMPLEMENTED:build-log/store.${name}`);
};

export async function listBuildLogPosts(_learnerProfileId: string): Promise<BuildLogPost[]> {
  return seed("listBuildLogPosts");
}

/** Published posts, newest first, in the public shape. */
export async function listPublishedBuildLogPosts(_learnerProfileId: string): Promise<BuildLogPostPublic[]> {
  return seed("listPublishedBuildLogPosts");
}

export async function getBuildLogStatus(_learnerProfileId: string): Promise<ProofPieceStatus> {
  return seed("getBuildLogStatus");
}

export function resetBuildLogStateForTests(): void {
  seed("resetBuildLogStateForTests");
}
