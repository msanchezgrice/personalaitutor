/**
 * Slug rules for build log posts. Pure functions: shared by the store and the tests.
 *
 *  - Derived from the title: lower case, accents folded, anything that is not a
 *    letter or digit becomes a single hyphen, trimmed, at most 72 characters
 *    (cut at a word boundary when possible).
 *  - Unique per learner: a clash gets "-2", "-3", ...
 *  - Stable after the first publish (the store stops re-deriving it once
 *    `publishedAt` is set, so shared links keep working).
 */

export const BUILD_LOG_SLUG_MAX = 72;
const FALLBACK_SLUG = "post";

export function slugifyBuildLogTitle(title: string): string {
  const base = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!base) return FALLBACK_SLUG;
  if (base.length <= BUILD_LOG_SLUG_MAX) return base;
  const cut = base.slice(0, BUILD_LOG_SLUG_MAX);
  const lastHyphen = cut.lastIndexOf("-");
  const trimmed = lastHyphen >= 24 ? cut.slice(0, lastHyphen) : cut;
  return trimmed.replace(/-+$/g, "") || FALLBACK_SLUG;
}

/** Picks `base`, or `base-2`, `base-3`, ... whichever is not in `taken`. */
export function uniqueBuildLogSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; n < 10_000; n += 1) {
    const suffix = `-${n}`;
    const candidate = `${base.slice(0, BUILD_LOG_SLUG_MAX - suffix.length).replace(/-+$/g, "")}${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new Error("BUILD_LOG_SLUG_EXHAUSTED");
}

export function isValidBuildLogSlug(slug: string): boolean {
  return slug.length > 0 && slug.length <= BUILD_LOG_SLUG_MAX && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}
