import type { ProjectArtifact } from "./types";

/**
 * State-machine gating rules (Phase 2.3 of the rebuild).
 *
 * `built` and `verified` must mean something:
 * - `built` requires EITHER a generated artifact with real persisted content
 *   (metadata carries the `contentId` written by the content pipeline) OR
 *   user-submitted proof (`proof_link` / `proof_upload`).
 * - `verified` additionally requires the module's proof checklist to be
 *   completed in a tutor session.
 *
 * Legacy placeholder artifacts (synthetic `/generated/...` URLs inserted with
 * no content) never satisfy these gates.
 */

const PROOF_KINDS = new Set(["proof_link", "proof_upload"]);

export function artifactCountsAsBuiltEvidence(artifact: ProjectArtifact): boolean {
  if (PROOF_KINDS.has(String(artifact.kind))) return true;
  const metadata = artifact.metadata ?? {};
  const source = typeof metadata.source === "string" ? metadata.source : null;
  const contentId = typeof metadata.contentId === "string" ? metadata.contentId : null;
  return source === "generated_artifact" && Boolean(contentId);
}

export function canMarkProjectBuilt(artifacts: ProjectArtifact[]): boolean {
  return artifacts.some((artifact) => artifactCountsAsBuiltEvidence(artifact));
}

export function canMarkSkillVerified(input: {
  checklistComplete: boolean;
  artifacts: ProjectArtifact[];
}): boolean {
  return input.checklistComplete && canMarkProjectBuilt(input.artifacts);
}
