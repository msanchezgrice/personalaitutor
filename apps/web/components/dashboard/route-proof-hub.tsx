import { VOICE_MODEL_METHOD_LABEL } from "@aitutor/shared";
import { RouteCopyLink } from "@/components/dashboard/route-copy-link";
import {
  PROOF_PIECES,
  PROOF_PIECE_STATE_LABELS,
  proofPieceButtonLabel,
  type ProofStatuses,
} from "@/components/dashboard/route-pieces";
import styles from "@/components/dashboard/route-dashboard.module.css";

/**
 * Proof Studio hub (/dashboard/proof): one card per proof piece with its live
 * status, the learner's public page and, when no career map is linked yet, a
 * nudge to draw one first. A piece whose status failed to load shows
 * "Status unavailable" and still links into its editor.
 */

export type ProofStudioHubProps = {
  statuses: ProofStatuses;
  /** Absolute public page URL when the profile is published, otherwise null. */
  publicUrl: string | null;
  /** "none" shows the career map nudge; "error" hides it (we do not know). */
  mapState: "ok" | "none" | "error";
  /** New title from the map, when there is one. */
  newTitle?: string | null;
};

export function ProofStudioHub({ statuses, publicUrl, mapState, newTitle = null }: ProofStudioHubProps) {
  return (
    <div className={styles.page} data-testid="proof-studio-hub">
      <section className={styles.section} aria-labelledby="proof-studio-title">
        <h1 id="proof-studio-title" className="rm-h1" style={{ fontSize: "clamp(2rem, 4.4vw, 3.25rem)" }}>
          Proof Studio
        </h1>
        <p className="rm-lede">
          Proof Studio builds three public pieces that back up {newTitle ? <strong>{newTitle}</strong> : "your new title"}: a site, a voice model tuned on your own writing, and a build log of what you made.
        </p>
      </section>

      {mapState === "none" ? (
        <section className={`rm-card rm-card--accent ${styles.section}`} data-testid="proof-studio-map-nudge" aria-labelledby="proof-studio-nudge">
          <h2 id="proof-studio-nudge" className="rm-h4">
            Start with your career map
          </h2>
          <p className="rm-p">
            Your map picks the title your site leads with, the writing your model learns from and the first post for your log. Draw it first and every piece starts from it.
          </p>
          <div className={styles.actions}>
            <a href="/map" className="rm-btn rm-btn--primary rm-btn--sm">
              Draw your career map
            </a>
          </div>
        </section>
      ) : null}

      <section aria-label="Proof pieces">
        <ol className={styles.cards} style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {PROOF_PIECES.map((piece) => {
            const status = statuses[piece.key];
            const chipClass = !status
              ? styles.chipUnavailable
              : status.state === "live"
                ? styles.chipLive
                : status.state === "draft"
                  ? styles.chipDraft
                  : "";
            return (
              <li key={piece.key} className={`rm-card ${styles.pieceCard}`} data-proof-piece={piece.key} data-proof-state={status?.state ?? "unavailable"}>
                <div className={styles.pieceHead}>
                  <p className={styles.stepLabel}>Step {piece.step}</p>
                  <span className={`rm-chip ${chipClass}`}>{status ? PROOF_PIECE_STATE_LABELS[status.state] : "Status unavailable"}</span>
                </div>
                <h2 className="rm-h4">{piece.label}</h2>
                <p className="rm-p">{piece.description}</p>
                {piece.key === "model" ? <p className="rm-small">Method: {VOICE_MODEL_METHOD_LABEL}. It is not a fine-tuned model.</p> : null}
                <p className="rm-small" style={{ color: "var(--rm-ink)" }}>
                  {status ? status.summary : "We couldn't load this right now. You can still open it."}
                </p>
                <div>
                  <a href={piece.href} className="rm-btn rm-btn--primary rm-btn--sm" data-testid={`proof-studio-open-${piece.key}`}>
                    {proofPieceButtonLabel(piece, status)}
                  </a>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className={`rm-card ${styles.section}`} aria-labelledby="proof-studio-public">
        <h2 id="proof-studio-public" className="rm-h4">
          Your public page
        </h2>
        {publicUrl ? (
          <div className={styles.urlBox}>
            <span className="rm-chip rm-chip--green">Published</span>
            <a href={publicUrl} className={styles.url} data-testid="proof-studio-public-url">
              {publicUrl}
            </a>
            <RouteCopyLink value={publicUrl} testId="proof-studio-copy-url" />
          </div>
        ) : (
          <>
            <p className="rm-p">
              <span className="rm-chip" style={{ marginRight: 10 }}>Not published</span>
              Your page is private until you publish it. Publish it from your site once it says what you want a stranger to read.
            </p>
            <div>
              <a href="/dashboard/proof/site" className="rm-btn rm-btn--secondary rm-btn--sm">
                Go to your site
              </a>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
