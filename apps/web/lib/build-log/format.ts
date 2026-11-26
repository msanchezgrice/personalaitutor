/** Client-safe date labels for build log posts. All dates are shown in UTC so server and client agree. */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function parse(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "Nov 16" */
export function formatBuildLogShortDate(value: string | null | undefined): string {
  const date = parse(value);
  return date ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "";
}

/** "November 16, 2026" */
export function formatBuildLogLongDate(value: string | null | undefined): string {
  const date = parse(value);
  return date ? date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }) : "";
}

/** Week number counted from the learner's first published post (week 1 = the first seven days). */
export function buildLogWeekNumber(publishedAt: string | null | undefined, firstPublishedAt: string | null | undefined): number | null {
  const date = parse(publishedAt);
  const first = parse(firstPublishedAt);
  if (!date || !first) return null;
  return Math.max(1, Math.floor((date.getTime() - first.getTime()) / WEEK_MS) + 1);
}

/** "Week 3 · Nov 16", as in the proof page design. */
export function buildLogDateLabel(publishedAt: string | null | undefined, firstPublishedAt: string | null | undefined): string {
  const week = buildLogWeekNumber(publishedAt, firstPublishedAt);
  const short = formatBuildLogShortDate(publishedAt);
  return week ? `Week ${week} · ${short}` : short;
}
