import type { RemappedRoute } from "@aitutor/shared";
import { formatRemappedDate, getRemappedDestination } from "@/lib/remapped/routes";
import styles from "./remapped.module.css";

/**
 * Pieces shared by /remapped and /remapped/[slug]. Server components.
 * Plain <a> tags: /map belongs to another workstream and typedRoutes would
 * reject the dynamic /remapped/<slug> hrefs on <Link>.
 */

export function RemappedRouteList({ routes, latestSlug = null, showDates = true }: { routes: RemappedRoute[]; latestSlug?: string | null; showDates?: boolean }) {
  return (
    <ol className={styles.routeList}>
      {routes.map((route) => {
        const destination = getRemappedDestination(route);
        return (
          <li key={route.slug} className={styles.routeItem}>
            <a href={`/remapped/${route.slug}`} className={styles.routeLink} data-testid="remapped-route-link">
              {showDates ? (
                <span className={styles.routeMeta}>
                  <time dateTime={route.publishAt}>{formatRemappedDate(route.publishAt)}</time>
                  {route.slug === latestSlug ? <span className={styles.latest}>Latest</span> : null}
                </span>
              ) : null}
              <span className={styles.routeFrom}>{route.fromTitle}</span>
              <span aria-hidden="true" className={styles.routeBar} />
              <span className="rm-sr-only"> to </span>
              <span className={styles.routeTo}>{destination.title}</span>
              <span aria-hidden="true" className={styles.routeArrow}>
                →
              </span>
            </a>
          </li>
        );
      })}
    </ol>
  );
}

export function RemappedMapCta({ title, body, testId }: { title: string; body: string; testId: string }) {
  return (
    <div className={`rm-card ${styles.ctaCard}`}>
      <div className={styles.ctaText}>
        <span aria-hidden="true" className={styles.ctaBar} />
        <h2 className="rm-h3">{title}</h2>
        <p className="rm-p">{body}</p>
      </div>
      <div className={styles.ctaAction}>
        <a href="/map" className="rm-btn rm-btn--primary rm-btn--lg" data-testid={testId} data-agent-action="start-career-map">
          Map my career
        </a>
        <span className="rm-small">No account needed.</span>
      </div>
    </div>
  );
}
