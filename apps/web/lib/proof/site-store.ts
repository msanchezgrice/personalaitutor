// FOUNDATION-SEED (owner: workstream D, proof site). Signatures only; workstream
// D replaces the bodies with the dual-mode implementation and removes this
// marker. Table: public.proof_sites.
import "server-only";
import type { ProofPieceStatus, ProofSite } from "@aitutor/shared";

const seed = (name: string): never => {
  throw new Error(`FOUNDATION_SEED_NOT_IMPLEMENTED:proof/site-store.${name}`);
};

export async function getProofSite(_learnerProfileId: string): Promise<ProofSite | null> {
  return seed("getProofSite");
}

export async function upsertProofSite(_input: Omit<ProofSite, "createdAt" | "updatedAt">): Promise<ProofSite> {
  return seed("upsertProofSite");
}

/** `published` is learner_profiles.published for this learner. */
export async function getProofSiteStatus(_input: { learnerProfileId: string; published: boolean }): Promise<ProofPieceStatus> {
  return seed("getProofSiteStatus");
}

export function resetProofSiteStateForTests(): void {
  seed("resetProofSiteStateForTests");
}
