import React from "react";
import {
  CAREER_MAP_FIT_LABELS,
  getCareerMapLine,
  getCareerMapTitle,
  type CareerMap,
  type CareerMapLineId,
  type CareerMapSource,
  type CareerMapTitle,
  VOICE_MODEL_METHOD_LABEL,
} from "@aitutor/shared";
import { RouteMap } from "@/components/remap/route-map";
import { RemapBrand, RemapSiteFooter } from "@/components/remap/site-chrome";
import { CAREER_MAP_SIGNED_IN_HREF, CAREER_MAP_SIGNUP_HREF } from "@/lib/career-map/constants";
import { CareerMapAutoRefresh, CareerMapCtaLink, CareerMapEmailForm, CareerMapViewTracking, CopyLinkButton, type CareerMapViewer } from "./career-map-actions";
import { describeStoredFailure } from "./input-helpers";
import styles from "./career-map.module.css";

/**
 * The career map result (CareerMap.dc.html): title, route, translations,
 * alternates, gaps, proof plan, "keep this map" and the hypothesis line.
 * A server component; the copy button, email form, CTA tracking and view
 * tracking are client islands.
 */

export const CAREER_MAP_DISCLAIMER =
  "This map is a starting hypothesis drawn from the text you gave us. It is not a hiring prediction, and the title is a suggestion, not a credential.";

export type ResolvedCareerMap = {
  map: CareerMap;
  primary: CareerMapTitle;
  line: { id: CareerMapLineId; label: string; color: string };
  alternates: Array<{ title: CareerMapTitle; reason: string }>;
};

/** Looks every title id up in the catalog. Returns null when the primary title is unknown. */
export function resolveCareerMap(map: CareerMap): ResolvedCareerMap | null {
  const primary = getCareerMapTitle(map.primary.titleId);
  if (!primary) return null;
  const alternates = map.alternates.flatMap((entry) => {
    const title = getCareerMapTitle(entry.titleId);
    return title ? [{ title, reason: entry.reason }] : [];
  });
  return { map, primary, line: getCareerMapLine(primary.line), alternates };
}

/** "Senior Marketing Manager → Go-to-Market Engineer" */
export function careerMapRouteLabel(map: CareerMap): string | null {
  const primary = getCareerMapTitle(map.primary.titleId);
  if (!primary) return null;
  return `${map.person.previousTitle} → ${primary.title}`;
}

function sourceNoun(source: CareerMapSource) {
  return source === "describe" ? "what you wrote" : "your résumé";
}

function kicker(map: CareerMap, source: CareerMapSource) {
  const drawn = source === "describe" ? "drawn from how you described your last job" : "drawn from your résumé";
  const name = map.person.displayName?.trim();
  return name ? `Career map for ${name} · ${drawn}` : `Your career map · ${drawn}`;
}

export function signupHref(signedIn: boolean) {
  return signedIn ? CAREER_MAP_SIGNED_IN_HREF : CAREER_MAP_SIGNUP_HREF;
}

function MapHeader({ shareUrl, showSave, cta }: { shareUrl: string; showSave: boolean; cta?: React.ReactNode }) {
  return (
    <header className="rm-header">
      <div className={`rm-container ${styles.wrap} ${styles.headerInner}`}>
        <div className={styles.headerBrand}>
          <RemapBrand />
        </div>
        <div className={styles.headerActions}>
          <CopyLinkButton url={shareUrl} />
          {showSave ? (
            <a href="#save" className="rm-btn rm-btn--primary rm-btn--sm" data-testid="career-map-save-link">
              Save my map
            </a>
          ) : (
            cta
          )}
        </div>
      </div>
    </header>
  );
}

export type CareerMapResultProps = {
  mapId: string;
  token: string;
  map: CareerMap;
  source: CareerMapSource;
  hasEmail: boolean;
  signedIn: boolean;
  viewer: CareerMapViewer;
  /** Absolute share URL of this page. */
  shareUrl: string;
};

export function CareerMapResult({ mapId, token, map, source, hasEmail, signedIn, viewer, shareUrl }: CareerMapResultProps) {
  const resolved = resolveCareerMap(map);
  if (!resolved) {
    return <CareerMapFailedState reason="CAREER_MAP_INVALID_OUTPUT:UNKNOWN_TITLE_ID" />;
  }
  const { primary, line, alternates } = resolved;
  const showEmailForm = !hasEmail && !signedIn;
  const ctaHref = signupHref(signedIn);
  const evidenceCount = map.translations.length;
  const plan = map.proofPlan;

  return (
    <div className={`rm ${styles.pageRoot} ${styles.narrowFooter}`} data-testid="career-map-result">
      <CareerMapViewTracking mapId={mapId} titleId={primary.id} fit={map.primary.fit} viewer={viewer} signedIn={signedIn} />
      <MapHeader
        shareUrl={shareUrl}
        showSave={showEmailForm}
        cta={
          <CareerMapCtaLink
            href={ctaHref}
            label={signedIn ? "Open Proof Studio" : "Start building"}
            mapId={mapId}
            titleId={primary.id}
            placement="header"
            className="rm-btn rm-btn--primary rm-btn--sm"
            testId="career-map-cta-header"
          />
        }
      />

      <main>
        <section className={`rm-container ${styles.wrap} ${styles.titleBlock}`} aria-labelledby="career-map-title">
          <p className={styles.kicker}>{kicker(map, source)}</p>
          <h1 id="career-map-title" className={`rm-h1 ${styles.title}`}>
            Your new title: <span className={`rm-accent ${styles.titleName}`}>{primary.title}</span>
          </h1>
          <p className={styles.lede}>{map.primary.summary}</p>
          <div className={styles.chips}>
            <span className={map.primary.fit === "stretch" ? "rm-chip" : "rm-chip rm-chip--green"} data-testid="career-map-fit">
              {CAREER_MAP_FIT_LABELS[map.primary.fit]}
            </span>
            <span className={`rm-chip ${styles.chipQuiet}`}>
              Backed by {evidenceCount} line{evidenceCount === 1 ? "" : "s"} of {sourceNoun(source)}
            </span>
          </div>
        </section>

        <section className={`rm-container ${styles.wrap} ${styles.routeSection}`} aria-label="Your route">
          <div className={styles.routeCard}>
            <RouteMap
              fromTitle={map.person.previousTitle}
              fromField={map.person.previousField}
              neighbors={map.neighbors}
              toTitle={primary.title}
              toLineId={primary.line}
              alternates={alternates.map((entry) => entry.title.title)}
              animate
            />
          </div>
        </section>

        <section className={`rm-container ${styles.wrap} ${styles.sectionStack}`} aria-labelledby="career-map-translations">
          <h2 id="career-map-translations" className={styles.h2}>
            What you did, translated
          </h2>
          <p className={styles.intro}>
            Each row starts with a line from {sourceNoun(source)}. If a translation looks wrong, it probably is: you can edit every line when you
            build your site.
          </p>
          <ul className={styles.translations} data-testid="career-map-translations">
            {map.translations.map((row, index) => (
              <li className={styles.translation} key={`${row.now}-${index}`}>
                <div className={styles.translationFrom}>
                  <span className={styles.fieldLabel}>From {sourceNoun(source)}</span>
                  <p className={styles.quote}>{`“${row.evidence}”`}</p>
                </div>
                <div className={styles.translationNow}>
                  <span className={styles.fieldLabelNew}>Now</span>
                  <span className={styles.now}>{row.now}</span>
                  <p className={styles.explanation}>{row.explanation}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.band}>
          <div className={`rm-container ${styles.wrap} ${styles.bandInner}`}>
            <div className={styles.bandColumn}>
              <h2 className={`${styles.h2} ${styles.h2Small}`}>
                {alternates.length === 2 ? "Two other stops on your line" : "Another stop on your line"}
              </h2>
              {alternates.map((entry) => (
                <div className={styles.alternate} key={entry.title.id} data-testid="career-map-alternate">
                  <h3 className={styles.h3}>{entry.title.title}</h3>
                  <p className="rm-p">{entry.reason}</p>
                  <p className="rm-small">
                    {getCareerMapLine(entry.title.line).label} line. {entry.title.blurb}
                  </p>
                </div>
              ))}
            </div>
            <div className={styles.bandColumn}>
              <h2 className={`${styles.h2} ${styles.h2Small}`}>
                {source === "describe" ? "What your description doesn't show yet" : "What your résumé doesn't show yet"}
              </h2>
              <ul className={styles.gapList}>
                {map.gaps.map((gap, index) => (
                  <li className={styles.gap} key={`${gap.gap}-${index}`}>
                    <span aria-hidden="true" className={styles.gapRing} />
                    <span className={styles.gapText}>
                      <span>{gap.gap}</span>
                      <span className={styles.gapClose}>Close it: {gap.closeWith}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className={`rm-container ${styles.wrap} ${styles.proofSection}`} aria-labelledby="career-map-proof">
          <div className={styles.proofHead}>
            <h2 id="career-map-proof" className={styles.h2}>
              Your proof plan
            </h2>
            <p className="rm-p">Three things to build, in this order. Each one closes a gap above.</p>
          </div>
          <ol className={styles.proofCards}>
            <li className={styles.proofCard}>
              <span className={styles.fieldLabelNew}>1. Site</span>
              <h3 className={styles.h3}>{plan.site.headline}</h3>
              <p className="rm-p">{plan.site.summary}</p>
            </li>
            <li className={styles.proofCard}>
              <span className={styles.fieldLabelNew}>2. Tuned model</span>
              <h3 className={styles.h3}>
                {plan.model.name}, tuned on your {plan.model.sampleType}
              </h3>
              <p className="rm-p">{plan.model.summary}</p>
              <p className="rm-small">How it is tuned: {VOICE_MODEL_METHOD_LABEL.toLowerCase()}. Nothing is retrained.</p>
            </li>
            <li className={styles.proofCard}>
              <span className={styles.fieldLabelNew}>3. Build log</span>
              <h3 className={styles.h3}>{`“${plan.buildLog.firstPostTitle}”`}</h3>
              <p className="rm-p">{plan.buildLog.summary}</p>
            </li>
          </ol>
          <div className={styles.ctaRow}>
            <CareerMapCtaLink
              href={ctaHref}
              label={signedIn ? "Start building in Proof Studio" : "Start building, free for 7 days"}
              mapId={mapId}
              titleId={primary.id}
              placement="proof_plan"
              className="rm-btn rm-btn--primary rm-btn--lg"
              testId="career-map-cta-proof"
            />
            <span className={styles.ctaNote}>
              {signedIn ? "Proof Studio is part of the Career Builder plan." : "Then $49.99 per month. Card required. Cancel any time."}
            </span>
          </div>
        </section>

        <section id="save" className={`rm-container ${styles.wrap} ${styles.saveSection}`} aria-label="Keep this map">
          {showEmailForm ? <CareerMapEmailForm token={token} mapId={mapId} /> : null}
          <p className={styles.disclaimer} data-testid="career-map-disclaimer">
            {CAREER_MAP_DISCLAIMER}
          </p>
        </section>
      </main>
      <RemapSiteFooter />
    </div>
  );
}

function StatusShell({ children, testId }: { children: React.ReactNode; testId: string }) {
  return (
    <div className={`rm ${styles.pageRoot} ${styles.narrowFooter}`} data-testid={testId}>
      <header className="rm-header">
        <div className={`rm-container ${styles.wrap} ${styles.headerInner}`}>
          <div className={styles.headerBrand}>
            <RemapBrand />
          </div>
        </div>
      </header>
      <main className={`rm-container ${styles.wrap} ${styles.statusSection}`}>
        <div className={styles.statusCard}>{children}</div>
      </main>
      <RemapSiteFooter />
    </div>
  );
}

export function CareerMapGeneratingState() {
  return (
    <StatusShell testId="career-map-generating">
      <p className={styles.kicker}>Career map</p>
      <h1 className={`rm-h1 ${styles.inputH1}`}>Your map is still being drawn</h1>
      <p className={styles.lede}>It usually takes 10 to 30 seconds. This page will show the map as soon as it is ready.</p>
      <div className={styles.progressTrack} aria-hidden="true">
        <span className={styles.progressDot} />
        <span className={styles.progressLine} />
        <span className={`${styles.progressDot} ${styles.progressDotNew}`} />
      </div>
      <CareerMapAutoRefresh />
    </StatusShell>
  );
}

export function CareerMapFailedState({ reason }: { reason: string | null }) {
  return (
    <StatusShell testId="career-map-failed">
      <p className={styles.kicker}>Career map</p>
      <h1 className={`rm-h1 ${styles.inputH1}`}>We couldn&apos;t draw this map</h1>
      <p className={styles.lede}>{describeStoredFailure(reason)}</p>
      <p className="rm-p">We never show a map we can&apos;t back with your own words. Drawing it again is free.</p>
      <div className={styles.statusActions}>
        <a href="/map" className="rm-btn rm-btn--primary" data-testid="career-map-retry">
          Try again
        </a>
      </div>
    </StatusShell>
  );
}

export function CareerMapNotFoundState() {
  return (
    <StatusShell testId="career-map-not-found">
      <p className={styles.kicker}>Career map</p>
      <h1 className={`rm-h1 ${styles.inputH1}`}>We couldn&apos;t find that map</h1>
      <p className={styles.lede}>The link may be incomplete. You can draw a new map in about a minute.</p>
      <div className={styles.statusActions}>
        <a href="/map" className="rm-btn rm-btn--primary">
          Draw a new map
        </a>
      </div>
    </StatusShell>
  );
}
