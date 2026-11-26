/**
 * Profile handles no learner may hold: the built-in example pages
 * (`maya-ortiz` is the fictional example linked from the landing page and
 * sitemap, `alex-chen-ai` the older example) and words that read as product
 * pages. The single source of truth: imported by lib/runtime.ts (handle
 * generation at sign-up) and lib/proof/site-profile.ts (handle edits).
 * Deliberately import-free so neither side can create an import cycle.
 */
export const RESERVED_PROFILE_HANDLES = ["alex-chen-ai", "maya-ortiz", "example", "examples", "admin", "dashboard", "api"] as const;

const RESERVED = new Set<string>(RESERVED_PROFILE_HANDLES);

export function isReservedProfileHandle(handle: string): boolean {
  return RESERVED.has(handle.trim().toLowerCase());
}

/**
 * The handle itself when it is not reserved, else the first free numeric
 * suffix (`maya-ortiz` -> `maya-ortiz-2`), the same shape a handle clash
 * resolves to.
 */
export function avoidReservedProfileHandle(handle: string): string {
  if (!isReservedProfileHandle(handle)) return handle;
  let suffix = 2;
  while (isReservedProfileHandle(`${handle}-${suffix}`)) suffix += 1;
  return `${handle}-${suffix}`;
}
