/**
 * Small shared constants for the Career Map funnel. Safe to import from client
 * components (no secrets, no server-only imports).
 */

/** Where "start building" sends a signed-out visitor. The sign-up page reads `from=map` to adjust its copy. */
export const CAREER_MAP_SIGNUP_HREF = "/sign-up?redirect_url=%2Fdashboard%2Fproof&from=map";

/** Where the same call to action sends a signed-in visitor. */
export const CAREER_MAP_SIGNED_IN_HREF = "/dashboard/proof";

/**
 * sessionStorage key for a draft handed from the landing page hero to /map.
 * Value: JSON `{ "text": string, "source": "paste" | "describe" }`.
 * /map reads it on mount, clears it and, when the URL has `?from=home` and the
 * text is long enough, starts generating straight away.
 */
export const CAREER_MAP_DRAFT_STORAGE_KEY = "mast_cm_draft";

/** Public paths of the launch film. */
export const LAUNCH_FILM_SRC = "/video/the-missing-map-720p.mp4";
export const LAUNCH_FILM_POSTER = "/video/the-missing-map-poster.jpg";
