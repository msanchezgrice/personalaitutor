/**
 * Inactivity winback emails (rebuild Phase 3.5): 7/14/30-day nudges anchored
 * to the learner's assessment report ("your gap plan has N unfinished
 * steps"). Same campaign machinery + idempotency as lifecycle emails; the
 * sweep lives in `apps/web/lib/winback.ts`.
 *
 * This module is pure: window resolution + template.
 */

export const WINBACK_KEYS = ["winback_7", "winback_14", "winback_30"] as const;

export type WinbackKey = (typeof WINBACK_KEYS)[number];

export function isWinbackCampaignKey(value: string | null | undefined): value is WinbackKey {
  return WINBACK_KEYS.includes(value as WinbackKey);
}

export const WINBACK_WINDOWS_DAYS: Record<WinbackKey, { min: number; max: number | null }> = {
  winback_7: { min: 7, max: 14 },
  winback_14: { min: 14, max: 30 },
  winback_30: { min: 30, max: null },
};

/**
 * Which winback (if any) is due for a learner: mirrors
 * `resolveLifecycleEmailKey`'s window style — the CURRENT inactivity stage
 * fires once; earlier stages are never replayed once their window has passed.
 */
export function resolveWinbackKey(input: {
  lastActiveAt: string | null | undefined;
  sentKeys: string[];
  nowIso?: string;
}): WinbackKey | null {
  if (!input.lastActiveAt) return null;
  const lastActive = Date.parse(input.lastActiveAt);
  if (Number.isNaN(lastActive)) return null;

  const now = input.nowIso ? Date.parse(input.nowIso) : Date.now();
  if (Number.isNaN(now)) return null;

  const ageDays = (now - lastActive) / 86_400_000;
  const sent = new Set(input.sentKeys);

  for (const key of ["winback_30", "winback_14", "winback_7"] as const) {
    const window = WINBACK_WINDOWS_DAYS[key];
    const inWindow = ageDays >= window.min && (window.max === null || ageDays < window.max);
    if (inWindow && !sent.has(key)) return key;
  }
  return null;
}

export type WinbackEmailContext = {
  key: WinbackKey;
  baseUrl: string;
  learnerName: string;
  careerPathName: string | null;
  readinessScore: number | null;
  /** Open gaps from the latest report that have no completed proof yet. */
  unfinishedGapCount: number;
  topGapTitle: string | null;
  dashboardUrl?: string;
};

export type WinbackEmail = {
  key: WinbackKey;
  subject: string;
  previewText: string;
  html: string;
  text: string;
};

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function daysFor(key: WinbackKey): number {
  return WINBACK_WINDOWS_DAYS[key].min;
}

export function buildWinbackEmail(context: WinbackEmailContext): WinbackEmail {
  const dashboardUrl = context.dashboardUrl ?? `${context.baseUrl.replace(/\/+$/, "")}/dashboard/`;
  const days = daysFor(context.key);
  const gapCount = Math.max(0, Math.floor(context.unfinishedGapCount));
  const gapPhrase =
    gapCount > 0
      ? `your gap plan has ${gapCount} unfinished step${gapCount === 1 ? "" : "s"}`
      : "your gap plan is waiting for its next step";

  const subject =
    context.key === "winback_7"
      ? `It's been a week — ${gapPhrase}`
      : context.key === "winback_14"
        ? `Two weeks out: ${gapPhrase}`
        : `Your AI-readiness plan is going stale — ${gapPhrase}`;

  const scoreLine =
    context.readinessScore !== null
      ? `Your AI-readiness score is still ${context.readinessScore}/100 — it only moves when you close a gap with proof.`
      : "Your AI-readiness score is waiting on your first assessment.";

  const gapLine = context.topGapTitle
    ? `The highest-impact gap on your plan is still open: "${context.topGapTitle}".`
    : "Your next recommended module is ready in the dashboard.";

  const urgency =
    context.key === "winback_30"
      ? `The ${context.careerPathName ?? "AI"} landscape moved every day of the last ${days} — your report's ranking of what matters has been re-checked against it daily. Fifteen minutes gets you back on the board.`
      : `It has been ${days} days since your last check-in. One 15-minute action restarts your streak and counts toward this week's artifact.`;

  const previewText = `${gapPhrase[0].toUpperCase()}${gapPhrase.slice(1)} — 15 minutes gets you moving again.`;

  const html = [
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(previewText)}</div>`,
    `<div style="font-family:Inter,Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;">`,
    `<div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;">`,
    `<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;">${escapeHtml(context.learnerName)}, ${escapeHtml(gapPhrase)}.</h1>`,
    `<p style="margin:0 0 12px;color:#475569;line-height:1.7;">${escapeHtml(scoreLine)}</p>`,
    `<p style="margin:0 0 12px;color:#475569;line-height:1.7;">${escapeHtml(gapLine)}</p>`,
    `<p style="margin:0 0 18px;color:#475569;line-height:1.7;">${escapeHtml(urgency)}</p>`,
    `<a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;background:#0f766e;color:#ffffff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700;">Pick up where you left off</a>`,
    `</div></div>`,
  ].join("");

  const text = [
    `${context.learnerName}, ${gapPhrase}.`,
    scoreLine,
    gapLine,
    urgency,
    `Pick up where you left off: ${dashboardUrl}`,
  ].join("\n\n");

  return { key: context.key, subject, previewText, html, text };
}
