import type { Metadata } from "next";
import { RemapSiteFooter, RemapSiteHeader } from "@/components/remap/site-chrome";
import { getRemappedDestination, listRemappedRoutes } from "@/lib/remapped/routes";
import {
  BRAND_NAME,
  BRAND_X_HANDLE,
  DEFAULT_OG_IMAGE_ALT,
  DEFAULT_OG_IMAGE_HEIGHT,
  DEFAULT_OG_IMAGE_PATH,
  DEFAULT_OG_IMAGE_WIDTH,
  getSiteUrl,
} from "@/lib/site";
import { RemappedMapCta, RemappedRouteList } from "./remapped-parts";
import styles from "./remapped.module.css";

export const revalidate = 86400;

const PAGE_TITLE = `Remapped: one new career route every week | ${BRAND_NAME}`;
const PAGE_DESCRIPTION =
  "Each week we take one job and draw its route to an AI-era title: which skills carry over, what is missing, and a first project you can finish in a week.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/remapped" },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "/remapped",
    type: "website",
    images: [{ url: DEFAULT_OG_IMAGE_PATH, width: DEFAULT_OG_IMAGE_WIDTH, height: DEFAULT_OG_IMAGE_HEIGHT, alt: DEFAULT_OG_IMAGE_ALT, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    site: BRAND_X_HANDLE,
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE_PATH],
  },
};

export default function RemappedIndexPage() {
  const routes = listRemappedRoutes(new Date());
  const appBaseUrl = getSiteUrl();
  const listLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Remapped",
    description: PAGE_DESCRIPTION,
    url: `${appBaseUrl}/remapped`,
    publisher: { "@type": "Organization", name: BRAND_NAME, url: appBaseUrl },
    mainEntity: {
      "@type": "ItemList",
      itemListOrder: "https://schema.org/ItemListOrderDescending",
      itemListElement: routes.map((route, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: `${route.fromTitle} to ${getRemappedDestination(route).title}`,
        url: `${appBaseUrl}/remapped/${route.slug}`,
      })),
    },
  };

  return (
    <div className="rm">
      <RemapSiteHeader active="remapped" />
      <main id="main">
        <section className={`rm-container ${styles.indexHero}`} aria-labelledby="remapped-heading">
          <div className={styles.indexIntro}>
            <p className="rm-kicker">Remapped</p>
            <h1 id="remapped-heading" className={`rm-h1 ${styles.indexTitle}`}>
              One new career, remapped every week
            </h1>
            <p className="rm-lede">
              Each week we take one job that is shrinking and draw its route: which skills carry over, what the new title is, and what to build first.
            </p>
            <p className="rm-small">A new route goes up every Monday. Each one is a starting point drawn from the everyday work of the old job, not a promise of a role.</p>
          </div>
        </section>

        <section className={`rm-container ${styles.indexList}`} aria-label="Published routes, newest first">
          {routes.length ? <RemappedRouteList routes={routes} latestSlug={routes[0]?.slug ?? null} /> : <p className="rm-p">The first route goes up on Monday.</p>}
        </section>

        <section className="rm-container" style={{ paddingBottom: "clamp(56px, 8vw, 88px)" }}>
          <RemappedMapCta
            title="Don't see your job? Map your own."
            body="Paste your résumé or describe your last job. We draw your route: the new title it fits, the skills that carry over with the line behind each one, and what to build first. Free, about a minute."
            testId="cta-map-career-remapped"
          />
        </section>
      </main>
      <RemapSiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(listLd).replace(/</g, "\\u003c") }} />
    </div>
  );
}
