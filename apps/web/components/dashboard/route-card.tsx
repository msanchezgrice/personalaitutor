import { CAREER_MAP_FIT_LABELS, getCareerMapTitle } from "@aitutor/shared";
import { RouteStrip } from "@/components/remap/translation-list";
import type { YourRouteCardData } from "@/components/dashboard/route-data";
import { pickNextProofStep } from "@/components/dashboard/route-pieces";
import styles from "@/components/dashboard/route-dashboard.module.css";

/**
 * "Your route" card on dashboard Home: old title -> new title, the next
 * unfinished Proof Studio step, and links to the map and Proof Studio. With no
 * map yet it prompts the learner to draw one at /map.
 *
 * Server component; the page loads `data` with `loadYourRouteCard` and hides
 * the card when that fails, like the other Home cards.
 */
export function YourRouteCard({ data }: { data: YourRouteCardData }) {
  return (
    <div className="rm" style={{ minHeight: 0, background: "transparent" }}>
      <section className={`rm-card ${styles.homeCard}`} data-dashboard-home-section="your-route" aria-labelledby="your-route-title">
        {data.map.status === "ok" ? <WithMap data={data} /> : <WithoutMap />}
      </section>
    </div>
  );
}

function WithoutMap() {
  return (
    <div className={styles.section}>
      <p id="your-route-title" className="rm-kicker">
        Your route
      </p>
      <h2 className="rm-h3">Find the AI-era job title your experience already fits</h2>
      <p className="rm-p">
        Paste your résumé or describe your last job. We map it to one new title, show which of your skills carry over, and plan the proof you build here.
      </p>
      <div className={styles.actions}>
        <a
          href="/map"
          className="rm-btn rm-btn--primary rm-btn--sm"
          data-testid="your-route-draw-map"
          data-analytics-event="dashboard_home_cta_clicked"
          data-analytics-cta="draw_career_map"
          data-analytics-location="your_route_card"
          data-analytics-destination="/map"
        >
          Draw your career map
        </a>
      </div>
    </div>
  );
}

function WithMap({ data }: { data: YourRouteCardData }) {
  if (data.map.status !== "ok") return null;
  const { map } = data.map.value;
  const newTitle = getCareerMapTitle(map.primary.titleId)?.title ?? map.primary.titleId;
  const next = data.statuses ? pickNextProofStep(data.statuses) : { kind: "unknown" as const };

  return (
    <div className={styles.homeGrid}>
      <div className={styles.section}>
        <p id="your-route-title" className="rm-kicker">
          Your route
        </p>
        <RouteStrip fromTitle={map.person.previousTitle} toTitle={newTitle} />
        <div className={styles.chips}>
          <span className="rm-chip rm-chip--green">{CAREER_MAP_FIT_LABELS[map.primary.fit]}</span>
        </div>
        <div className={styles.actions}>
          <a href="/dashboard/map" data-testid="your-route-open-map">
            Open your career map
          </a>
          <a href="/dashboard/proof" data-testid="your-route-open-proof">
            Open Proof Studio
          </a>
        </div>
      </div>
      <div className={styles.section} data-testid="your-route-next">
        {next.kind === "step" ? (
          <>
            <p className="rm-kicker rm-kicker--muted">
              Next step · {next.piece.step} of 3
            </p>
            <h3 className="rm-h4">{next.piece.nextLabel}</h3>
            {next.status.summary ? <p className="rm-p">{next.status.summary}</p> : null}
            <div>
              <a
                href={next.piece.href}
                className="rm-btn rm-btn--primary rm-btn--sm"
                data-analytics-event="dashboard_home_cta_clicked"
                data-analytics-cta={`proof_next_${next.piece.key}`}
                data-analytics-location="your_route_card"
                data-analytics-destination={next.piece.href}
              >
                {next.status.state === "empty" ? next.piece.startLabel : next.piece.openLabel}
              </a>
            </div>
          </>
        ) : next.kind === "done" ? (
          <>
            <p className="rm-kicker rm-kicker--muted">All three pieces are live</p>
            <h3 className="rm-h4">Your site, voice model and build log are public.</h3>
            <p className="rm-p">Keep the build log moving: one short post each time you ship something.</p>
            <div>
              <a href="/dashboard/proof/log" className="rm-btn rm-btn--secondary rm-btn--sm">
                Write a new post
              </a>
            </div>
          </>
        ) : (
          <>
            <p className="rm-kicker rm-kicker--muted">Next step</p>
            <h3 className="rm-h4">Build your proof in Proof Studio</h3>
            <p className="rm-p">A public site, a voice model tuned on your writing and a build log.</p>
            <div>
              <a href="/dashboard/proof" className="rm-btn rm-btn--primary rm-btn--sm">
                Open Proof Studio
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
