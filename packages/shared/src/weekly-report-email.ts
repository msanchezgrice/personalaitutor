/**
 * Weekly proof-of-watch email (rebuild Phase 3.4). Lifecycle emails stop
 * after week_one; this recurring campaign proves the product kept watching:
 * score trend, gaps closed, artifacts generated, streak, and the top
 * landscape change for the learner's path this week (with a real fetched
 * URL) — all computed AT SEND TIME by `apps/web/lib/weekly-report.ts`.
 *
 * This module is pure (template + campaign-key + trend derivation) so the
 * vitest suite can prove a month-2 email differs from a day-0 email.
 */

export const WEEKLY_REPORT_CAMPAIGN_PREFIX = "weekly_report_";

function isoWeek(date: Date): { year: number; week: number } {
  // ISO-8601 week number (weeks start Monday; week 1 contains the first Thursday).
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = (target.getUTCDay() + 6) % 7; // Monday = 0
  target.setUTCDate(target.getUTCDate() - dayNumber + 3); // nearest Thursday
  const year = target.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(year, 0, 4));
  const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3);
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
  return { year, week };
}

/** One send per learner per ISO week: e.g. `weekly_report_2026_w28`. */
export function weeklyReportCampaignKey(now: Date | string): string {
  const date = typeof now === "string" ? new Date(now) : now;
  const { year, week } = isoWeek(date);
  return `${WEEKLY_REPORT_CAMPAIGN_PREFIX}${year}_w${String(week).padStart(2, "0")}`;
}

export function isWeeklyReportCampaignKey(value: string | null | undefined): boolean {
  return typeof value === "string" && /^weekly_report_\d{4}_w\d{2}$/.test(value);
}

export type ScoreTrendPoint = {
  readinessScore: number;
  createdAt: string;
};

export type ScoreTrend = {
  current: number | null;
  weekAgo: number | null;
  delta: number | null;
};

/**
 * Score trend from append-only report history, computed at send time:
 * `current` = newest score, `weekAgo` = newest score at or before the window
 * start (fallback: the oldest known score).
 */
export function deriveScoreTrend(points: ScoreTrendPoint[], now: Date | string, windowDays = 7): ScoreTrend {
  const nowMs = (typeof now === "string" ? new Date(now) : now).getTime();
  const sorted = [...points]
    .filter((point) => Number.isFinite(point.readinessScore) && !Number.isNaN(Date.parse(point.createdAt)))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

  if (!sorted.length) return { current: null, weekAgo: null, delta: null };

  const current = sorted[sorted.length - 1].readinessScore;
  const windowStart = nowMs - windowDays * 86_400_000;
  let weekAgo: number | null = null;
  for (const point of sorted) {
    if (Date.parse(point.createdAt) <= windowStart) {
      weekAgo = point.readinessScore;
    }
  }
  if (weekAgo === null) weekAgo = sorted[0].readinessScore;

  return { current, weekAgo, delta: current - weekAgo };
}

export type WeeklyReportContext = {
  baseUrl: string;
  learnerName: string;
  careerPathName: string | null;
  scoreTrend: ScoreTrend;
  /** Gap/module titles closed (tutor session completed) this week. */
  gapsClosed: string[];
  /** Artifacts generated this week. */
  artifactsGenerated: Array<{ title: string; url?: string | null }>;
  streak: { current: number; longest: number };
  /** Top landscape change this week for the learner's path — real fetched URL. */
  landscapeChange: { headline: string; url: string; source: string; summary?: string | null } | null;
  nextStep: string;
  dashboardUrl?: string;
};

export type WeeklyReportEmail = {
  campaignKey: string;
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

function trendLine(trend: ScoreTrend): string {
  if (trend.current === null) {
    return "No readiness score on file yet — finish the assessment to start your trend.";
  }
  if (trend.delta === null || trend.delta === 0) {
    return `Your AI-readiness score held at ${trend.current}/100 this week.`;
  }
  const direction = trend.delta > 0 ? "up" : "down";
  return `Your AI-readiness score moved ${direction} ${Math.abs(trend.delta)} point${Math.abs(trend.delta) === 1 ? "" : "s"} this week: ${trend.weekAgo} → ${trend.current}/100.`;
}

function subjectFor(context: WeeklyReportContext): string {
  const trend = context.scoreTrend;
  if (trend.current !== null && trend.delta !== null && trend.delta !== 0) {
    const arrow = trend.delta > 0 ? "▲" : "▼";
    return `Your AI-readiness score: ${trend.current}/100 (${arrow}${Math.abs(trend.delta)} this week)`;
  }
  if (trend.current !== null) {
    return `Your week in review: score ${trend.current}/100, ${context.gapsClosed.length} gap${context.gapsClosed.length === 1 ? "" : "s"} closed`;
  }
  return "Your week in review from My AI Skill Tutor";
}

export function buildWeeklyReportEmail(context: WeeklyReportContext, now: Date | string = new Date()): WeeklyReportEmail {
  const campaignKey = weeklyReportCampaignKey(now);
  const dashboardUrl = context.dashboardUrl ?? `${context.baseUrl.replace(/\/+$/, "")}/dashboard/`;
  const subject = subjectFor(context);
  const previewText = trendLine(context.scoreTrend);

  const sections: Array<{ title: string; lines: string[]; link?: { label: string; url: string } }> = [];

  sections.push({ title: "Score trend", lines: [trendLine(context.scoreTrend)] });

  sections.push({
    title: "Gaps closed this week",
    lines: context.gapsClosed.length
      ? context.gapsClosed.map((gap) => `Closed with proof: ${gap}`)
      : ["No gap closed this week. One tutor session gets the next one done."],
  });

  sections.push({
    title: "Artifacts generated this week",
    lines: context.artifactsGenerated.length
      ? context.artifactsGenerated.map((artifact) =>
          artifact.url ? `${artifact.title} — ${artifact.url}` : artifact.title,
        )
      : ["No new artifacts this week."],
  });

  sections.push({
    title: "Streak",
    lines: [
      context.streak.current > 0
        ? `Current streak: ${context.streak.current} day${context.streak.current === 1 ? "" : "s"} (longest: ${context.streak.longest}).`
        : `No active streak. Complete today's action to start one (longest so far: ${context.streak.longest}).`,
    ],
  });

  if (context.landscapeChange) {
    sections.push({
      title: `What changed in the landscape for ${context.careerPathName ?? "your role"}`,
      lines: [
        context.landscapeChange.summary
          ? `${context.landscapeChange.headline} — ${context.landscapeChange.summary}`
          : context.landscapeChange.headline,
        `Source: ${context.landscapeChange.source} — ${context.landscapeChange.url}`,
      ],
    });
  } else {
    sections.push({
      title: `What changed in the landscape for ${context.careerPathName ?? "your role"}`,
      lines: ["No landscape briefing was available for your path this week."],
    });
  }

  sections.push({
    title: "Next recommended step",
    lines: [context.nextStep],
    link: { label: "Open your dashboard", url: dashboardUrl },
  });

  const html = [
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(previewText)}</div>`,
    `<div style="font-family:Inter,Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;">`,
    `<div style="max-width:640px;margin:0 auto;">`,
    `<div style="background:#ffffff;border:1px solid #dbe4ee;border-radius:20px;padding:24px;">`,
    `<h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;">${escapeHtml(context.learnerName)}, here is what your tutor watched this week.</h1>`,
    `<p style="margin:0;color:#475569;line-height:1.7;">${escapeHtml(trendLine(context.scoreTrend))}</p>`,
    `</div>`,
    ...sections.map(
      (section) =>
        `<section style="margin:16px 0 0;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:20px;">` +
        `<h2 style="margin:0 0 10px;font-size:16px;color:#0f172a;">${escapeHtml(section.title)}</h2>` +
        `<ul style="margin:0;padding-left:18px;color:#334155;line-height:1.7;">${section.lines
          .map((line) => `<li style="margin:0 0 6px;">${escapeHtml(line)}</li>`)
          .join("")}</ul>` +
        (section.link
          ? `<div style="margin-top:14px;"><a href="${escapeHtml(section.link.url)}" style="display:inline-block;background:#0f766e;color:#ffffff;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:700;">${escapeHtml(section.link.label)}</a></div>`
          : "") +
        `</section>`,
    ),
    `<p style="margin:18px 0 0;text-align:center;color:#64748b;font-size:13px;line-height:1.6;">You are receiving this weekly report because you have an active My AI Skill Tutor subscription.</p>`,
    `</div></div>`,
  ].join("");

  const text = [
    `${context.learnerName}, here is what your tutor watched this week.`,
    "",
    ...sections.flatMap((section) => [
      section.title.toUpperCase(),
      ...section.lines.map((line) => `- ${line}`),
      ...(section.link ? [`${section.link.label}: ${section.link.url}`] : []),
      "",
    ]),
  ].join("\n");

  return { campaignKey, subject, previewText, html, text };
}
