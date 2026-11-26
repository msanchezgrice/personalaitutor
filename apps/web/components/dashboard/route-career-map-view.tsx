import { CAREER_MAP_FIT_LABELS, getCareerMapTitle } from "@aitutor/shared";
import { RouteMap } from "@/components/remap/route-map";
import { TranslationList } from "@/components/remap/translation-list";
import { RouteCopyLink } from "@/components/dashboard/route-copy-link";
import type { LearnerCareerMap } from "@/components/dashboard/route-data";
import {
  PROOF_PIECES,
  PROOF_PIECE_STATE_LABELS,
  proofPieceButtonLabel,
  type ProofPieceKey,
  type ProofStatuses,
} from "@/components/dashboard/route-pieces";
import styles from "@/components/dashboard/route-dashboard.module.css";

/**
 * The learner's latest career map inside the dashboard (/dashboard/map).
 * Mirrors the public result page (CareerMap.dc.html) and turns the proof plan
 * into three steps that open the matching Proof Studio editors.
 */

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function mapSharePath(token: string) {
  return `/map/${encodeURIComponent(token)}`;
}

export function RouteCareerMapView({ value, statuses = null }: { value: LearnerCareerMap; statuses?: ProofStatuses | null }) {
  const { map, token, createdAt } = value;
  const primary = getCareerMapTitle(map.primary.titleId);
  const newTitle = primary?.title ?? map.primary.titleId;
  const alternates = map.alternates.map((entry) => ({
    title: getCareerMapTitle(entry.titleId)?.title ?? entry.titleId,
    reason: entry.reason,
  }));
  const drawn = formatDate(createdAt);
  const sharePath = mapSharePath(token);
  const evidenceCount = map.translations.length;
  const plan: Record<ProofPieceKey, { heading: string; summary: string }> = {
    site: { heading: map.proofPlan.site.headline, summary: map.proofPlan.site.summary },
    model: { heading: `${map.proofPlan.model.name}, tuned on your ${map.proofPlan.model.sampleType}`, summary: map.proofPlan.model.summary },
    log: { heading: `“${map.proofPlan.buildLog.firstPostTitle}”`, summary: map.proofPlan.buildLog.summary },
  };

  return (
    <div className={styles.page} data-testid="dashboard-career-map">
      <section className={styles.section} aria-labelledby="dashboard-map-title">
        <p className="rm-kicker rm-kicker--muted">
          Your career map{drawn ? ` · drawn ${drawn}` : ""}
        </p>
        <h1 id="dashboard-map-title" className="rm-h1" style={{ fontSize: "clamp(2rem, 4.4vw, 3.25rem)" }}>
          Your new title: <span className="rm-accent">{newTitle}</span>
        </h1>
        <p className="rm-lede">{map.primary.summary}</p>
        <div className={styles.chips}>
          <span className="rm-chip rm-chip--green">{CAREER_MAP_FIT_LABELS[map.primary.fit]}</span>
          <span className="rm-chip">
            Backed by {evidenceCount} {evidenceCount === 1 ? "line" : "lines"} of your résumé
          </span>
        </div>
      </section>

      <section aria-label="Route map" className={`rm-card rm-card--raised ${styles.routeCard}`}>
        <RouteMap
          fromTitle={map.person.previousTitle}
          fromField={map.person.previousField}
          neighbors={map.neighbors}
          toTitle={newTitle}
          toLineId={primary?.line ?? "growth"}
          alternates={alternates.map((entry) => entry.title)}
        />
      </section>

      <section className={styles.section} aria-labelledby="dashboard-map-translations">
        <h2 id="dashboard-map-translations" className="rm-h2" style={{ fontSize: "2rem" }}>
          What you did, translated
        </h2>
        <p className="rm-p">Each row starts with a line from your résumé. If a translation looks wrong, it probably is: change it on your site.</p>
        <div className="rm-card" style={{ paddingBlock: 8 }}>
          <TranslationList
            beforeLabel="From your résumé"
            rows={map.translations.map((row) => ({
              before: row.before,
              evidence: row.evidence,
              now: row.now,
              explanation: row.explanation,
            }))}
          />
        </div>
      </section>

      <section className={`rm-card ${styles.split}`} aria-label="Alternates and gaps">
        <div className={styles.section}>
          <h2 className="rm-h3">Two other stops on your line</h2>
          <ul className={styles.list}>
            {alternates.map((entry) => (
              <li key={entry.title}>
                <h3 className="rm-h4">{entry.title}</h3>
                <p className="rm-p">{entry.reason}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className={styles.section}>
          <h2 className="rm-h3">What your résumé doesn&apos;t show yet</h2>
          <ul className={styles.list}>
            {map.gaps.map((entry) => (
              <li key={entry.gap} className={styles.gapItem}>
                <span aria-hidden="true" className={styles.gapDot} />
                <span>
                  <span className="rm-p" style={{ display: "block" }}>{entry.gap}</span>
                  <span className="rm-small" style={{ display: "block", marginTop: 4 }}>Close it: {entry.closeWith}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="dashboard-map-plan">
        <h2 id="dashboard-map-plan" className="rm-h2" style={{ fontSize: "2rem" }}>
          Your proof plan
        </h2>
        <p className="rm-p">Three things to build in Proof Studio, in this order. Each one closes a gap above.</p>
        <ol className={styles.cards} style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {PROOF_PIECES.map((piece) => {
            const status = statuses ? statuses[piece.key] : null;
            return (
              <li key={piece.key} className={`rm-card ${styles.pieceCard}`} data-proof-step={piece.key}>
                <div className={styles.pieceHead}>
                  <p className={styles.stepLabel}>
                    {piece.step}. {piece.label}
                  </p>
                  {status ? <span className={`rm-chip ${status.state === "live" ? styles.chipLive : status.state === "draft" ? styles.chipDraft : ""}`}>{PROOF_PIECE_STATE_LABELS[status.state]}</span> : null}
                </div>
                <h3 className="rm-h4">{plan[piece.key].heading}</h3>
                <p className="rm-p">{plan[piece.key].summary}</p>
                <div>
                  <a href={piece.href} className="rm-btn rm-btn--primary rm-btn--sm">
                    {proofPieceButtonLabel(piece, status)}
                  </a>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className={`rm-card ${styles.section}`} aria-labelledby="dashboard-map-share">
        <h2 id="dashboard-map-share" className="rm-h4">
          Share your map
        </h2>
        <div className={styles.urlBox}>
          <a href={sharePath} className={styles.url} data-testid="dashboard-map-share-link">
            {sharePath}
          </a>
          <RouteCopyLink value={sharePath} testId="dashboard-map-copy-link" />
        </div>
        <div className={styles.actions}>
          <a href="/dashboard/proof">Open Proof Studio</a>
          <a href="/map">Draw a new map</a>
        </div>
        <p className="rm-small">
          This map is a starting hypothesis drawn from the text you gave us. It is not a hiring prediction, and the title is a suggestion, not a credential.
        </p>
      </section>
    </div>
  );
}

export function RouteCareerMapEmpty() {
  return (
    <div className={styles.page} data-testid="dashboard-career-map-empty">
      <section className={`rm-card ${styles.section}`} style={{ maxWidth: 760 }} aria-labelledby="dashboard-map-empty-title">
        <h1 id="dashboard-map-empty-title" className="rm-h2">
          You don&apos;t have a career map yet
        </h1>
        <p className="rm-lede">
          A career map takes what you did before, from your résumé or a description of your last job, and maps it to one AI-era job title. Every skill on it is backed by a line you wrote, and it ends with a three-step plan to prove the new title in public.
        </p>
        <div className={styles.actions}>
          <a href="/map" className="rm-btn rm-btn--primary" data-testid="dashboard-map-draw">
            Draw your career map
          </a>
        </div>
      </section>
    </div>
  );
}

export function RouteCareerMapUnavailable() {
  return (
    <div className={styles.page} data-testid="dashboard-career-map-unavailable">
      <section className={`rm-card ${styles.section}`} style={{ maxWidth: 760 }} role="alert">
        <h1 className="rm-h3">We couldn&apos;t load your career map</h1>
        <p className="rm-p">Something went wrong on our side. Refresh the page to try again.</p>
        <div className={styles.actions}>
          <a href="/dashboard/map" className="rm-btn rm-btn--secondary rm-btn--sm">
            Try again
          </a>
        </div>
      </section>
    </div>
  );
}
