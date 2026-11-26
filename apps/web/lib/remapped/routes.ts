// FOUNDATION-SEED (owner: workstream G, Remapped library). Signatures only;
// workstream G replaces this with the authored library and removes this marker.
import type { RemappedRoute } from "@aitutor/shared";

export const REMAPPED_ROUTES: readonly RemappedRoute[] = [];

/** Routes whose publishAt is on or before `now`, newest first. */
export function listRemappedRoutes(_now: Date = new Date()): RemappedRoute[] {
  return [];
}

export function getRemappedRoute(_slug: string, _now: Date = new Date()): RemappedRoute | null {
  return null;
}
