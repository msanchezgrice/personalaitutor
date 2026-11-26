import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCareerMapLine } from "@aitutor/shared";
import { RouteMap } from "@/components/remap/route-map";
import { RemapSiteFooter, RemapSiteHeader } from "@/components/remap/site-chrome";
import { TranslationList } from "@/components/remap/translation-list";
import {
  describeRemappedRoute,
  formatRemappedDate,
  getRelatedRemappedRoutes,
  getRemappedDestination,
  getRemappedNearbyStops,
  getRemappedRoute,
  listRemappedRoutes,
} from "@/lib/remapped/routes";
import {
  BRAND_NAME,
  BRAND_X_HANDLE,
  DEFAULT_OG_IMAGE_ALT,
  DEFAULT_OG_IMAGE_HEIGHT,
  DEFAULT_OG_IMAGE_PATH,
  DEFAULT_OG_IMAGE_WIDTH,
  getSiteUrl,
} from "@/lib/site";
import { RemappedMapCta, RemappedRouteList } from "../remapped-parts";
import styles from "../remapped.module.css";
import { RemappedRouteViewTracker } from "./route-view-tracker";

// Rebuilt daily so a route scheduled for today goes live without a deploy.
export const revalidate = 86400;

export function generateStaticParams() {
  return listRemappedRoutes(new Date()).map((route) => ({ slug: route.slug }));
}

type RouteParams = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const route = getRemappedRoute(slug, new Date());
  if (!route) {
    return { title: `Route not found | ${BRAND_NAME}`, robots: { index: false, follow: false } };
  }
  const destination = getRemappedDestination(route);
  const pageTitle = `${route.fromTitle} to ${destination.title}: a career route | ${BRAND_NAME}`;
  const description = describeRemappedRoute(route);
  const path = `/remapped/${route.slug}`;
  return {
    title: pageTitle,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: pageTitle,
      description,
      url: path,
      type: "article",
      publishedTime: `${route.publishAt}T00:00:00Z`,
      authors: [BRAND_NAME],
      images: [{ url: DEFAULT_OG_IMAGE_PATH, width: DEFAULT_OG_IMAGE_WIDTH, height: DEFAULT_OG_IMAGE_HEIGHT, alt: DEFAULT_OG_IMAGE_ALT, type: "image/png" }],
    },
    twitter: {
      card: "summary_large_image",
      site: BRAND_X_HANDLE,
      title: pageTitle,
      description,
      images: [DEFAULT_OG_IMAGE_PATH],
    },
  };
}

function jsonLd(data: unknown) {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}

export default async function RemappedRoutePage({ params }: RouteParams) {
  const { slug } = await params;
  const now = new Date();
  const route = getRemappedRoute(slug, now);
  if (!route) notFound();

  const destination = getRemappedDestination(route);
  const line = getCareerMapLine(destination.line);
  const nearby = getRemappedNearbyStops(route);
  const related = getRelatedRemappedRoutes(route, now, 3);
  const appBaseUrl = getSiteUrl();
  const url = `${appBaseUrl}/remapped/${route.slug}`;
  const headline = `${route.fromTitle} to ${destination.title}`;

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline,
    description: describeRemappedRoute(route),
    datePublished: `${route.publishAt}T00:00:00Z`,
    dateModified: `${route.publishAt}T00:00:00Z`,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    image: [`${appBaseUrl}${DEFAULT_OG_IMAGE_PATH}`],
    isPartOf: { "@type": "CollectionPage", name: "Remapped", url: `${appBaseUrl}/remapped` },
    about: [
      { "@type": "Occupation", name: route.fromTitle },
      { "@type": "Occupation", name: destination.title, description: destination.blurb },
    ],
    author: { "@type": "Organization", name: BRAND_NAME, url: appBaseUrl },
    publisher: {
      "@type": "Organization",
      name: BRAND_NAME,
      url: appBaseUrl,
      logo: { "@type": "ImageObject", url: `${appBaseUrl}/assets/branding/brand_brain_icon.svg` },
    },
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: appBaseUrl },
      { "@type": "ListItem", position: 2, name: "Remapped", item: `${appBaseUrl}/remapped` },
      { "@type": "ListItem", position: 3, name: headline, item: url },
    ],
  };

  return (
    <div className="rm">
      <RemapSiteHeader active="remapped" />
      <main id="main">
        <article>
          <header className={`rm-container ${styles.hero}`}>
            <p className="rm-kicker">
              <a href="/remapped" style={{ textDecoration: "none" }}>
                Remapped
              </a>
              <span aria-hidden="true"> · </span>
              <time dateTime={route.publishAt}>{formatRemappedDate(route.publishAt)}</time>
            </p>
            <h1 className="rm-h1">
              {route.fromTitle} to <span className="rm-accent">{destination.title}</span>
            </h1>
            <p className="rm-lede">{route.intro}</p>
            <div className={styles.chips}>
              <span className="rm-chip rm-chip--green">{line.label} line</span>
              <span className="rm-chip">From {route.fromField}</span>
            </div>
          </header>

          <section className={`rm-container ${styles.mapSection}`} aria-label="Route map">
            <div className={`rm-card rm-card--raised ${styles.mapCard}`}>
              <RouteMap
                fromTitle={route.fromTitle}
                fromField={route.fromField}
                toTitle={destination.title}
                toLineId={destination.line}
                alternates={nearby.map((stop) => stop.title)}
                animate
              />
            </div>
            <div className={styles.destination}>
              <div className={styles.destinationMain}>
                <h2 className="rm-kicker">What a {destination.title} does</h2>
                <p className={styles.destinationBlurb}>{destination.blurb}</p>
              </div>
              {nearby.length ? (
                <div className={styles.nearby}>
                  <h2 className="rm-kicker rm-kicker--muted">Other stops on the {line.label} line</h2>
                  <ul className={`rm-divider-list ${styles.nearbyList}`}>
                    {nearby.map((stop) => (
                      <li key={stop.id}>
                        <span className={styles.nearbyTitle}>{stop.title}</span>
                        <span className="rm-small">{stop.blurb}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </section>

          <section className="rm-container" aria-labelledby="translations-heading" style={{ paddingBottom: "clamp(56px, 8vw, 80px)" }}>
            <div className={styles.sectionHead}>
              <h2 id="translations-heading" className="rm-h2">
                What the old job becomes
              </h2>
              <p className="rm-p">Four everyday tasks from the old job, and the AI-era skill each one turns into.</p>
            </div>
            <div className={`rm-card ${styles.translationsCard}`}>
              <TranslationList rows={route.translations} beforeLabel="In the old job" nowLabel="In the new one" />
            </div>
          </section>

          <section className="rm-band" aria-labelledby="gaps-heading">
            <div className="rm-container rm-section">
              <div className={styles.split}>
                <div className={styles.splitHead}>
                  <h2 id="gaps-heading" className="rm-h2">
                    What you probably don&apos;t have yet
                  </h2>
                  <p className="rm-p">The experience carries over. These pieces usually do not, and they are what a hiring manager will look for.</p>
                </div>
                <ul className={`rm-divider-list ${styles.splitBody}`}>
                  {route.gaps.map((gap) => (
                    <li key={gap.gap} className={styles.gapItem}>
                      <span aria-hidden="true" className={styles.gapRing} />
                      <span className={styles.gapText}>
                        <span className={styles.gapTitle}>{gap.gap}</span>
                        <span className={styles.gapClose}>
                          <span className={styles.gapCloseLabel}>Close it: </span>
                          {gap.closeWith}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="rm-container rm-section" aria-labelledby="project-heading">
            <div className={styles.split}>
              <div className={styles.splitHead}>
                <p className="rm-kicker">Your first project</p>
                <h2 id="project-heading" className="rm-h2">
                  {route.firstProject.title}
                </h2>
                <p className="rm-p">Small enough to finish in a week of evenings. Public enough that a stranger can open it and see how you work.</p>
              </div>
              <div className={`rm-card ${styles.splitBody} ${styles.projectCard}`}>
                <ol className={styles.steps}>
                  {route.firstProject.steps.map((step) => (
                    <li key={step} className={styles.step}>
                      <span className={styles.stepText}>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </section>

          <section className="rm-band" aria-labelledby="watch-heading">
            <div className="rm-container rm-section">
              <div className={styles.split}>
                <div className={styles.splitHead}>
                  <h2 id="watch-heading" className="rm-h2">
                    What stays hard
                  </h2>
                  <p className="rm-p">No route is all upside. Read these before you commit.</p>
                </div>
                <ul className={`rm-divider-list ${styles.splitBody}`}>
                  {route.watchOuts.map((item) => (
                    <li key={item} className={styles.watchItem}>
                      <span aria-hidden="true" className={styles.watchMark} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </article>

        <section className="rm-container rm-section" aria-label="Map your own career">
          <RemappedMapCta
            title="Get this done for your own résumé. Free, about a minute."
            body="This route is drawn from the everyday work of the job. Yours will differ. Paste your résumé and we map what you actually did to the title it fits, with the line behind every skill."
            testId="cta-map-career-route"
          />
          <p className={`rm-small ${styles.disclaimer}`}>
            A route is a starting point, not a hiring prediction. The new title is a direction to test, not a credential or a promise of a job.
          </p>
        </section>

        {related.length ? (
          <section className={`rm-container ${styles.related}`} aria-labelledby="related-heading">
            <div className={styles.relatedHead}>
              <h2 id="related-heading" className="rm-h3">
                More routes
              </h2>
              <a href="/remapped" className="rm-btn rm-btn--secondary rm-btn--sm">
                See every route
              </a>
            </div>
            <RemappedRouteList routes={related} showDates={false} />
          </section>
        ) : null}
      </main>
      <RemapSiteFooter />
      <RemappedRouteViewTracker slug={route.slug} fromTitle={route.fromTitle} toTitleId={route.toTitleId} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(articleLd)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(breadcrumbLd)} />
    </div>
  );
}
