import { VOICE_MODEL_METHOD_LABEL } from "@aitutor/shared";
import { CAREER_MAP_SIGNED_IN_HREF, CAREER_MAP_SIGNUP_HREF } from "@/lib/career-map/constants";
import { RemapSiteFooter, RemapSiteHeader } from "@/components/remap/site-chrome";
import { TranslationList } from "@/components/remap/translation-list";
import { HeroForm } from "./hero-form";
import { HeroNetworkMap } from "./hero-network-map";
import { LaunchFilm } from "./launch-film";
import {
  LANDING_EXAMPLE,
  LANDING_FAQ_HEADING,
  LANDING_FAQS,
  LANDING_FILM,
  LANDING_FINAL,
  LANDING_GAP_HEADING,
  LANDING_GUIDES,
  LANDING_HERO,
  LANDING_PRICING,
  LANDING_PROOF,
  LANDING_REMAPPED,
  LANDING_STATS,
  LANDING_STEPS,
  LANDING_TUTOR,
} from "./landing-content";
import styles from "./landing.module.css";

/** A Remapped route as the landing page lists it. */
export type LandingRemappedRoute = { slug: string; fromTitle: string; toTitle: string };

/** A learn guide as the landing page lists it. */
export type LandingGuide = { slug: string; title: string; description: string; category: string; readingTime: string };

export type LandingPageProps = {
  signedIn: boolean;
  /** Up to five published routes, newest first. The section is hidden when empty. */
  remappedRoutes: LandingRemappedRoute[];
  guides: LandingGuide[];
};

const STAT_TONE_CLASS = { old: styles.statOld, new: styles.statNew, deep: styles.statDeep } as const;
const STEP_DOT_CLASS = { old: "rm-dot", new: "rm-dot rm-dot--new", arrived: "rm-dot rm-dot--arrived" } as const;

function ExampleChip() {
  return <span className={`rm-chip ${styles.exampleChip}`}>Example</span>;
}

export function LandingPage({ signedIn, remappedRoutes, guides }: LandingPageProps) {
  const routes = remappedRoutes.slice(0, 5);
  const trialHref = signedIn ? CAREER_MAP_SIGNED_IN_HREF : CAREER_MAP_SIGNUP_HREF;

  return (
    <div className={`rm ${styles.page}`} data-testid="landing-page" data-landing="remap">
      <RemapSiteHeader signedIn={signedIn} />

      <main id="main">
        {/* Hero */}
        <section id="top" className={`rm-container ${styles.hero}`} aria-labelledby="hero-heading">
          <div className={styles.heroCopy}>
            <p className="rm-kicker">{LANDING_HERO.kicker}</p>
            <h1 id="hero-heading" className="rm-h1">
              {LANDING_HERO.titleLead} <span className="rm-accent">{LANDING_HERO.titleAccent}</span>
            </h1>
            <p className={`rm-lede ${styles.heroLede}`}>{LANDING_HERO.lede}</p>
            <HeroForm />
          </div>
          <figure className={styles.heroMap}>
            <HeroNetworkMap />
            <figcaption className={`rm-small ${styles.heroCaption}`}>{LANDING_HERO.mapCaption}</figcaption>
          </figure>
        </section>

        {/* Launch film */}
        <section className={`rm-container ${styles.film}`} aria-labelledby="film-heading">
          <div className={styles.filmHead}>
            <h2 id="film-heading" className={styles.filmTitle}>
              {LANDING_FILM.title}
            </h2>
            <p className="rm-p">{LANDING_FILM.summary}</p>
          </div>
          <LaunchFilm />
          <p className={`rm-small ${styles.filmNote}`}>{LANDING_FILM.note}</p>
        </section>

        {/* The gap, in three numbers */}
        <section className="rm-band" aria-labelledby="gap-heading" data-testid="landing-stats">
          <div className={`rm-container ${styles.bandInner} ${styles.gapInner}`}>
            <h2 id="gap-heading" className={`rm-h2 ${styles.gapHeading}`}>
              {LANDING_GAP_HEADING}
            </h2>
            <div className={styles.stats}>
              {LANDING_STATS.map((stat) => (
                <figure key={stat.value} className={`${styles.stat} ${STAT_TONE_CLASS[stat.tone]}`}>
                  <div className={styles.statValue}>{stat.value}</div>
                  <p className={styles.statLabel}>{stat.label}</p>
                  <figcaption className="rm-small">
                    Source: <cite className={styles.cite}>{stat.source}</cite>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* How the map gets drawn */}
        <section id="how" className={`rm-container ${styles.section}`} aria-labelledby="how-heading">
          <div className={styles.intro}>
            <h2 id="how-heading" className="rm-h2">
              How the map gets drawn
            </h2>
            <p className={styles.introLede}>Three steps, in this order. The first two are free.</p>
          </div>
          <ol className={styles.steps}>
            {LANDING_STEPS.map((step) => (
              <li key={step.title} className={styles.step}>
                <div className={styles.stepHead}>
                  <span className={`${STEP_DOT_CLASS[step.dot]} ${styles.stepDot}`} aria-hidden="true" />
                  <h3 className={styles.stepTitle}>{step.title}</h3>
                </div>
                <p className="rm-p">{step.body}</p>
              </li>
            ))}
          </ol>

          <article className={styles.example} aria-labelledby="example-heading" data-testid="landing-example">
            <div className={styles.exampleHead}>
              <h3 id="example-heading" className={styles.exampleTitle}>
                {LANDING_EXAMPLE.heading}
              </h3>
              <p className={`rm-small ${styles.exampleContext}`}>
                <ExampleChip />
                <span>{LANDING_EXAMPLE.context}</span>
              </p>
            </div>
            <TranslationList rows={LANDING_EXAMPLE.rows.map((row) => ({ before: row.before, now: row.now }))} />
            <div className={styles.exampleResult}>
              <div className={styles.exampleNewTitle}>
                <span className={styles.exampleNewTitleLabel}>{LANDING_EXAMPLE.newTitleLabel}</span>
                <span className={styles.exampleNewTitleValue}>{LANDING_EXAMPLE.newTitle}</span>
              </div>
              <a href="/map" className="rm-btn rm-btn--primary" data-testid="cta-map-career-example" data-agent-action="start-career-map" data-cta-location="example">
                {LANDING_EXAMPLE.cta}
              </a>
            </div>
          </article>
        </section>

        {/* Proof */}
        <section id="proof" className="rm-band" aria-labelledby="proof-heading">
          <div className={`rm-container ${styles.section}`}>
            <div className={styles.intro}>
              <h2 id="proof-heading" className="rm-h2">
                {LANDING_PROOF.heading}
              </h2>
              <p className={styles.introLede}>{LANDING_PROOF.lede}</p>
            </div>

            <div className={styles.proofRow}>
              <div className={styles.proofText}>
                <h3 className={styles.proofTitle}>{LANDING_PROOF.site.title}</h3>
                <p className="rm-p">{LANDING_PROOF.site.body}</p>
              </div>
              <figure className={`${styles.mock} ${styles.siteMock}`} aria-label="Example of a proof site">
                <div className={styles.browserBar}>
                  <span className={styles.browserUrl}>{LANDING_PROOF.site.url}</span>
                  <ExampleChip />
                  <span className="rm-chip rm-chip--green">Live</span>
                </div>
                <div className={styles.siteBody}>
                  <span className={styles.siteName}>{LANDING_PROOF.site.name}</span>
                  <span className={styles.siteHeadline}>{LANDING_PROOF.site.headline}</span>
                  <p className={styles.siteBio}>{LANDING_PROOF.site.bio}</p>
                </div>
              </figure>
            </div>

            <div className={`${styles.proofRow} ${styles.proofRowReverse}`}>
              <figure className={`${styles.mock} ${styles.cardMock}`} aria-label="Example of a voice model comparison">
                <div className={styles.modelHead}>
                  <span className={styles.modelName}>{LANDING_PROOF.model.name}</span>
                  <ExampleChip />
                </div>
                <div className={styles.modelBlock}>
                  <span className={styles.modelLabel}>{LANDING_PROOF.model.baseLabel}</span>
                  <span className={styles.modelBase}>{LANDING_PROOF.model.baseOutput}</span>
                </div>
                <div className={`${styles.modelBlock} ${styles.modelTuned}`}>
                  <span className={`${styles.modelLabel} ${styles.modelLabelNew}`}>{LANDING_PROOF.model.name}</span>
                  <span className={styles.modelOutput}>{LANDING_PROOF.model.tunedOutput}</span>
                </div>
                <p className={`rm-small ${styles.modelCard}`}>
                  {LANDING_PROOF.model.tunedOn}. Method: {VOICE_MODEL_METHOD_LABEL}.
                </p>
              </figure>
              <div className={styles.proofText}>
                <h3 className={styles.proofTitle}>{LANDING_PROOF.model.title}</h3>
                <p className="rm-p">{LANDING_PROOF.model.body}</p>
              </div>
            </div>

            <div className={styles.proofRow}>
              <div className={styles.proofText}>
                <h3 className={styles.proofTitle}>{LANDING_PROOF.log.title}</h3>
                <p className="rm-p">{LANDING_PROOF.log.body}</p>
              </div>
              <figure className={`${styles.mock} ${styles.cardMock}`} aria-label="Example of a build log post">
                <div className={styles.logByline}>
                  <ExampleChip />
                  <span>{LANDING_PROOF.log.byline}</span>
                </div>
                <span className={styles.logTitle}>{LANDING_PROOF.log.postTitle}</span>
                <ol className={styles.flow} aria-label="Workflow">
                  {LANDING_PROOF.log.steps.map((step, index) => (
                    <li key={step} className={styles.flowItem}>
                      {index > 0 ? <span className={styles.flowLink} aria-hidden="true" /> : null}
                      <span className={index === LANDING_PROOF.log.steps.length - 1 ? `${styles.flowStep} ${styles.flowStepNew}` : styles.flowStep}>{step}</span>
                    </li>
                  ))}
                </ol>
              </figure>
            </div>
          </div>
        </section>

        {/* Remapped: hidden until the library has published routes */}
        {routes.length > 0 ? (
          <section id="remapped" className={`rm-container ${styles.section} ${styles.remapped}`} aria-labelledby="remapped-heading" data-testid="landing-remapped">
            <div className={styles.remappedCopy}>
              <p className="rm-kicker">{LANDING_REMAPPED.kicker}</p>
              <h2 id="remapped-heading" className="rm-h2">
                {LANDING_REMAPPED.heading}
              </h2>
              <p className={styles.introLede}>{LANDING_REMAPPED.body}</p>
              <a href="/remapped" className={`rm-btn rm-btn--secondary ${styles.alignStart}`} data-testid="cta-see-remapped" data-cta-location="remapped">
                {LANDING_REMAPPED.cta}
              </a>
            </div>
            <ul className={styles.routeList}>
              {routes.map((route) => (
                <li key={route.slug}>
                  <a href={`/remapped/${route.slug}`} className={styles.routeLink}>
                    <span className={styles.routeFrom}>{route.fromTitle}</span>
                    <span className={styles.routeBar} aria-hidden="true" />
                    <span className="rm-sr-only"> to </span>
                    <span className={styles.routeTo}>{route.toTitle}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* A tutor for the whole route */}
        {/* White band only when Remapped sits between it and the white Proof band. */}
        <section className={routes.length > 0 ? "rm-band" : undefined} aria-labelledby="tutor-heading">
          <div className={`rm-container ${styles.bandInner} ${styles.tutorInner}`}>
            <h2 id="tutor-heading" className={styles.tutorHeading}>
              {LANDING_TUTOR.heading}
            </h2>
            <div className={styles.tutorItems}>
              {LANDING_TUTOR.items.map((item) => (
                <div key={item.title} className={styles.tutorItem}>
                  <h3 className="rm-h4">{item.title}</h3>
                  <p className="rm-p">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className={`rm-container ${styles.section} ${styles.pricing}`} aria-labelledby="pricing-heading" data-testid="landing-pricing">
          <h2 id="pricing-heading" className="rm-h2">
            {LANDING_PRICING.heading}
          </h2>
          <div className={styles.plans}>
            <div className={styles.plan}>
              <h3 className={styles.planTitle}>{LANDING_PRICING.free.title}</h3>
              <div className={styles.planPrice}>{LANDING_PRICING.free.price}</div>
              <ul className={styles.planList}>
                {LANDING_PRICING.free.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <a href="/map" className={`rm-btn rm-btn--secondary ${styles.planCta}`} data-testid="cta-map-career-pricing" data-agent-action="start-career-map" data-cta-location="pricing">
                {LANDING_PRICING.free.cta}
              </a>
            </div>
            <div className={`${styles.plan} ${styles.planPaid}`}>
              <h3 className={styles.planTitle}>{LANDING_PRICING.paid.title}</h3>
              <div className={styles.planPriceRow}>
                <span className={styles.planPrice}>{LANDING_PRICING.paid.price}</span>
                <span className={styles.planCadence}>{LANDING_PRICING.paid.cadence}</span>
              </div>
              <ul className={styles.planList}>
                {LANDING_PRICING.paid.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <a href={trialHref} className={`rm-btn rm-btn--primary ${styles.planCta}`} data-testid="cta-start-trial-pricing" data-agent-action="start-trial" data-cta-location="pricing">
                {signedIn ? LANDING_PRICING.paid.ctaSignedIn : LANDING_PRICING.paid.cta}
              </a>
              <p className="rm-small">{LANDING_PRICING.paid.note}</p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="rm-band" aria-labelledby="faq-heading" data-testid="landing-faq">
          <div className={`rm-container ${styles.section} ${styles.faq}`}>
            <h2 id="faq-heading" className={`rm-h2 ${styles.faqHeading}`}>
              {LANDING_FAQ_HEADING}
            </h2>
            <div className={styles.faqList}>
              {LANDING_FAQS.map((entry) => (
                <div key={entry.question} className={styles.faqItem}>
                  <h3 className="rm-h4">{entry.question}</h3>
                  <p className="rm-p">{entry.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Guides */}
        {guides.length > 0 ? (
          <section className={`rm-container ${styles.section} ${styles.guides}`} aria-labelledby="guides-heading" data-testid="landing-guides">
            <div className={styles.guidesHead}>
              <div className={styles.intro}>
                <h2 id="guides-heading" className="rm-h2">
                  {LANDING_GUIDES.heading}
                </h2>
                <p className={styles.introLede}>{LANDING_GUIDES.lede}</p>
              </div>
              <a href="/learn" className="rm-btn rm-btn--secondary" data-cta-location="guides">
                {LANDING_GUIDES.cta}
              </a>
            </div>
            <ul className={styles.guideGrid}>
              {guides.map((guide) => (
                <li key={guide.slug}>
                  <a href={`/learn/${guide.slug}`} className={styles.guideCard}>
                    <span className={styles.guideMeta}>
                      <span>{guide.category}</span>
                      <span>{guide.readingTime}</span>
                    </span>
                    <span className={styles.guideTitle}>{guide.title}</span>
                    <span className={styles.guideBody}>{guide.description}</span>
                    <span className={styles.guideMore}>Read the guide</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Final CTA */}
        <section className={`rm-container ${styles.final}`} aria-labelledby="final-heading">
          <div className={styles.finalBar} aria-hidden="true" />
          <h2 id="final-heading" className={styles.finalHeading}>
            {LANDING_FINAL.heading}
          </h2>
          <p className="rm-lede">{LANDING_FINAL.body}</p>
          <a href="/map" className={`rm-btn rm-btn--primary rm-btn--lg ${styles.finalCta}`} data-testid="cta-map-career-bottom" data-agent-action="start-career-map" data-cta-location="bottom">
            {LANDING_FINAL.cta}
          </a>
        </section>
      </main>

      <RemapSiteFooter />
    </div>
  );
}
