import type { ProofPieceState, ProofPieceStatus } from "@aitutor/shared";

/**
 * The three Proof Studio pieces in build order, shared by the Career Map page,
 * the Proof Studio hub and the dashboard "Your route" card. No server imports:
 * safe for any component.
 *
 * Hrefs are plain strings rendered in <a> tags: the routes are owned by other
 * workstreams and typedRoutes would reject them on <Link>.
 */

export type ProofPieceKey = "site" | "model" | "log";

export type ProofPieceDefinition = {
  key: ProofPieceKey;
  step: number;
  label: string;
  href: string;
  /** What the piece is, in one sentence. */
  description: string;
  /** Button label when nothing exists yet. */
  startLabel: string;
  /** Button label once a draft or a live piece exists. */
  openLabel: string;
  /** Short imperative for "Next step" copy. */
  nextLabel: string;
};

export const PROOF_PIECES: readonly ProofPieceDefinition[] = [
  {
    key: "site",
    step: 1,
    label: "Site",
    href: "/dashboard/proof/site",
    description: "A public page with your new title, what you did before and how it translates.",
    startLabel: "Build your site",
    openLabel: "Edit your site",
    nextLabel: "Build and publish your site",
  },
  {
    key: "model",
    step: 2,
    label: "Voice model",
    href: "/dashboard/proof/model",
    description: "A model tuned in context on your own writing. Visitors compare it with the untuned model on your page.",
    startLabel: "Tune your model",
    openLabel: "Open your model",
    nextLabel: "Tune your voice model on your writing",
  },
  {
    key: "log",
    step: 3,
    label: "Build log",
    href: "/dashboard/proof/log",
    description: "Short public posts about what you built, what broke and what you changed.",
    startLabel: "Write your first post",
    openLabel: "Open your build log",
    nextLabel: "Publish your first build log post",
  },
] as const;

export const PROOF_PIECE_STATE_LABELS: Record<ProofPieceState, string> = {
  empty: "Not started",
  draft: "Draft",
  live: "Live",
};

/** `null` means the status could not be loaded. */
export type ProofStatuses = Record<ProofPieceKey, ProofPieceStatus | null>;

export type NextProofStep =
  | { kind: "step"; piece: ProofPieceDefinition; status: ProofPieceStatus }
  | { kind: "done" }
  | { kind: "unknown" };

/**
 * The first piece, in build order, that is known not to be live. Pieces whose
 * status failed to load are skipped rather than guessed at; when nothing is
 * known to be unfinished but some status is missing, the answer is "unknown".
 */
export function pickNextProofStep(statuses: ProofStatuses): NextProofStep {
  let missing = false;
  for (const piece of PROOF_PIECES) {
    const status = statuses[piece.key];
    if (!status) {
      missing = true;
      continue;
    }
    if (status.state !== "live") return { kind: "step", piece, status };
  }
  return missing ? { kind: "unknown" } : { kind: "done" };
}

export function proofPieceButtonLabel(piece: ProofPieceDefinition, status: ProofPieceStatus | null) {
  if (status && status.state !== "empty") return piece.openLabel;
  return piece.startLabel;
}
