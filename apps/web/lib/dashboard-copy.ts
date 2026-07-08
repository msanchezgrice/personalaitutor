/**
 * Dashboard copy sanitation (live E2E fix 2026-07-07, finding #3).
 *
 * The Home hero picks its copy from dailyUpdate summaries, event-log
 * messages, and project build-log entries. Some of those are bookkeeping
 * lines ("AI Tutor reply generated for: hey", "memory.refresh") that must
 * never render as product copy — when every candidate is noise, callers fall
 * back to their default line.
 *
 * Mirrored by `isDashboardCopyNoise` in `apps/web/public/gemini-runtime.js`
 * (the static runtime cannot import this module) — keep the pattern lists in
 * sync.
 */

const DASHBOARD_COPY_NOISE_PATTERNS = [
  "memory.refresh",
  "ai tutor reply generated",
  "reply generated for",
] as const;

export function isDashboardCopyNoise(value: string | null | undefined): boolean {
  const normalized = String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!normalized) return false;
  return DASHBOARD_COPY_NOISE_PATTERNS.some((pattern) => normalized.includes(pattern));
}

export function sanitizeDashboardCopy(value: string | null | undefined): string {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (isDashboardCopyNoise(normalized)) return "";
  return normalized;
}
