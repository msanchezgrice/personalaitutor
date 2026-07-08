import "server-only";

import {
  CAREER_PATH_CATEGORIES,
  buildBriefing,
  buildBriefingsForPaths,
  getCareerPathCategory,
  type BriefingStory,
  type DailyBriefing,
} from "@aitutor/daily-content";
import { resolveOpenAiModel } from "@aitutor/shared";
import {
  getDailyBriefing,
  getLatestDailyBriefing,
  persistDailyBriefing,
  todayBriefingDate,
  type DailyBriefingRecord,
} from "@/lib/daily-briefing-store";

/**
 * Daily landscape briefing service (rebuild Phase 3.1/3.2).
 *
 * Replaces the retired `generateNewsFromOpenAi` free-recall path: the
 * dashboard's daily AI news now reads today's briefing for the user's career
 * path from the store (generated on demand on a cache miss) — real fetched
 * stories with citation URLs, guardrail-validated, never fabricated.
 */

const DEFAULT_BRIEFING_PATH = "product-management";

export function resolveBriefingPathId(candidates: Array<string | null | undefined>): string {
  for (const candidate of candidates) {
    if (candidate && getCareerPathCategory(candidate)) return candidate;
  }
  return DEFAULT_BRIEFING_PATH;
}

type BriefingBuildFn = (careerPathId: string, now: Date) => Promise<DailyBriefing>;

function defaultBriefingBuild(): BriefingBuildFn {
  return (careerPathId: string, at: Date) => buildBriefing({ careerPathId, now: at });
}

function briefingModel(): string | null {
  return process.env.OPENAI_API_KEY?.trim() ? resolveOpenAiModel() : null;
}

export async function getOrGenerateDailyBriefing(input: {
  careerPathId: string;
  now?: Date;
  /** Injectable for tests; defaults to the real engine (network fetch). */
  build?: BriefingBuildFn;
}): Promise<DailyBriefingRecord> {
  const now = input.now ?? new Date();
  const briefingDate = todayBriefingDate(now);

  const cached = await getDailyBriefing({ careerPathId: input.careerPathId, briefingDate });
  if (cached) return cached;

  const build = input.build ?? defaultBriefingBuild();
  const briefing = await build(input.careerPathId, now);

  return persistDailyBriefing({
    careerPathId: input.careerPathId,
    briefingDate,
    briefing,
    model: briefingModel(),
  });
}

// --- serving chain (live E2E finding #1, 2026-07-07) ---------------------------
//
// Root cause of the "global_cache" regression: briefings are keyed by UTC
// calendar date, so just past UTC midnight (e.g. ~9pm CT) the exact-match
// lookup for "today" misses even though yesterday's perfectly good briefing
// exists — and the caller then fell back to legacy global stories. Serving
// order is now: today's row → latest row (with a background regeneration when
// it is stale >24h) → blocking on-demand generation only when the path has no
// rows at all.

const STALE_BRIEFING_MS = 24 * 60 * 60 * 1000;

/** In-flight background regenerations keyed by `${path}:${date}` (idempotent). */
const backgroundBriefingBuilds = new Map<string, Promise<void>>();

/** Test hook: awaits all in-flight background regenerations. Never rejects. */
export async function waitForBackgroundBriefingBuilds(): Promise<void> {
  await Promise.all(Array.from(backgroundBriefingBuilds.values()));
}

function briefingIsStale(record: DailyBriefingRecord, now: Date): boolean {
  const createdAtMs = Date.parse(record.createdAt);
  if (Number.isFinite(createdAtMs) && now.getTime() - createdAtMs > STALE_BRIEFING_MS) {
    return true;
  }
  // Date heuristic: a row 2+ calendar days behind is always >24h old.
  const yesterday = todayBriefingDate(new Date(now.getTime() - STALE_BRIEFING_MS));
  return record.briefingDate < yesterday;
}

function triggerBackgroundBriefingRefresh(input: {
  careerPathId: string;
  briefingDate: string;
  now: Date;
  build: BriefingBuildFn;
}): void {
  const key = `${input.careerPathId}:${input.briefingDate}`;
  if (backgroundBriefingBuilds.has(key)) return;
  const task = (async () => {
    try {
      const briefing = await input.build(input.careerPathId, input.now);
      await persistDailyBriefing({
        careerPathId: input.careerPathId,
        briefingDate: input.briefingDate,
        briefing,
        model: briefingModel(),
      });
    } catch (error) {
      // Background refresh is best-effort: the caller already served the
      // latest stored briefing; the daily cron remains the durable refresher.
      console.warn(
        `[daily-briefing] background refresh failed for ${key}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      backgroundBriefingBuilds.delete(key);
    }
  })();
  backgroundBriefingBuilds.set(key, task);
}

/**
 * Resolve the briefing to serve right now: today's row → latest row →
 * blocking on-demand generation (only when the path has no rows at all).
 * Serving a non-today row that is stale >24h kicks a background regeneration
 * of today's briefing without blocking the response.
 */
export async function resolveServableDailyBriefing(input: {
  careerPathId: string;
  now?: Date;
  build?: BriefingBuildFn;
}): Promise<{ record: DailyBriefingRecord; isToday: boolean }> {
  const now = input.now ?? new Date();
  const briefingDate = todayBriefingDate(now);
  const build = input.build ?? defaultBriefingBuild();

  const today = await getDailyBriefing({ careerPathId: input.careerPathId, briefingDate });
  if (today) return { record: today, isToday: true };

  const latest = await getLatestDailyBriefing({ careerPathId: input.careerPathId });
  if (latest) {
    if (briefingIsStale(latest, now)) {
      triggerBackgroundBriefingRefresh({ careerPathId: input.careerPathId, briefingDate, now, build });
    }
    return { record: latest, isToday: latest.briefingDate === briefingDate };
  }

  const briefing = await build(input.careerPathId, now);
  const record = await persistDailyBriefing({
    careerPathId: input.careerPathId,
    briefingDate,
    briefing,
    model: briefingModel(),
  });
  return { record, isToday: true };
}

/**
 * Daily cron refresh: build briefings for all 9 MAST paths from a SINGLE
 * feed-fetch pass and persist them. Per-path failures are isolated and
 * reported, never swallowed.
 */
export async function refreshAllDailyBriefings(options: { now?: Date } = {}): Promise<{
  refreshed: string[];
  failures: Array<{ careerPathId: string; error: string }>;
  feedsOk: number;
  feedsFail: number;
}> {
  const now = options.now ?? new Date();
  const briefingDate = todayBriefingDate(now);
  const pathIds = CAREER_PATH_CATEGORIES.map((category) => category.id);

  const { briefings, failures, stats } = await buildBriefingsForPaths(pathIds, { now });

  const refreshed: string[] = [];
  const persistFailures: Array<{ careerPathId: string; error: string }> = [];
  for (const briefing of briefings) {
    try {
      await persistDailyBriefing({
        careerPathId: briefing.careerPathId,
        briefingDate,
        briefing,
        model: process.env.OPENAI_API_KEY?.trim() ? resolveOpenAiModel() : null,
      });
      refreshed.push(briefing.careerPathId);
    } catch (error) {
      persistFailures.push({
        careerPathId: briefing.careerPathId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    refreshed,
    failures: [...failures, ...persistFailures],
    feedsOk: stats.ok,
    feedsFail: stats.fail,
  };
}

// --- dashboard news mapping ----------------------------------------------------

export type BriefingNewsStory = {
  title: string;
  url: string;
  summary: string;
  category: "capabilities" | "tools" | "job_displacement" | "policy" | "workflow";
  relevanceScore: number;
  rankingScore: number;
  whyRelevant: string;
  recommendedAction: string;
  impact: "high" | "medium" | "low";
  source: string | null;
  publishedAt: string;
};

function storyPublishedAt(story: BriefingStory, fallbackIso: string): string {
  if (story.published) {
    const parsed = Date.parse(story.published);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  return fallbackIso;
}

function toStory(story: BriefingStory, input: { pathName: string; isTop: boolean; rank: number; fallbackIso: string }): BriefingNewsStory {
  // whyRelevant/recommendedAction are honest framing copy about how the story
  // was selected — they carry no invented facts, names, or URLs.
  return {
    title: story.headline,
    url: story.url,
    summary: story.summary || `Reported by ${story.source}.`,
    category: "workflow",
    relevanceScore: Math.max(10, 100 - input.rank * 10),
    rankingScore: Math.max(10, 100 - input.rank * 10),
    whyRelevant: input.isTop
      ? `Today's top-ranked landscape story for ${input.pathName}, selected by keyword relevance to your role.`
      : `Ranked for ${input.pathName} by keyword relevance, cross-feed trending, and recency.`,
    recommendedAction: "Open the source, then note one concrete implication for your current gap plan.",
    impact: input.isTop ? "high" : "medium",
    source: story.source || null,
    publishedAt: storyPublishedAt(story, input.fallbackIso),
  };
}

/**
 * Map a validated briefing to the dashboard's personalized-news story shape.
 * Every URL comes from the briefing (guardrail-validated fetched set).
 */
export function briefingToNewsStories(briefing: DailyBriefing, maxStories: number): BriefingNewsStory[] {
  const fallbackIso = `${briefing.date}T00:00:00.000Z`;
  const stories: BriefingNewsStory[] = [];
  if (briefing.topStory) {
    stories.push(toStory(briefing.topStory, { pathName: briefing.careerPathName, isTop: true, rank: 0, fallbackIso }));
  }
  for (const [index, hit] of briefing.quickHits.entries()) {
    stories.push(toStory(hit, { pathName: briefing.careerPathName, isTop: false, rank: index + 1, fallbackIso }));
  }
  return stories.slice(0, Math.max(1, maxStories));
}

/**
 * The dashboard entry point (replaces `generateNewsFromOpenAi`): serve the
 * user's path briefing via the chain today's row → latest row → on-demand
 * generation, and return grounded stories. A non-today row is served
 * immediately (source `briefing_stale`) — real fetched stories always beat
 * an empty state or the legacy global cache. Failure is explicit — there is
 * NO fabricated-story fallback.
 */
export async function briefingNewsForPath(input: {
  careerPathId: string | null | undefined;
  recommendedPathIds?: string[];
  maxStories: number;
  now?: Date;
  build?: (careerPathId: string, now: Date) => Promise<DailyBriefing>;
}): Promise<
  | {
      ok: true;
      source: "briefing" | "briefing_stale";
      careerPathId: string;
      briefingDate: string;
      focusSummary: string;
      selectionRationale: string;
      stories: BriefingNewsStory[];
    }
  | { ok: false; errorCode: string }
> {
  const careerPathId = resolveBriefingPathId([input.careerPathId, ...(input.recommendedPathIds ?? [])]);
  try {
    const { record, isToday } = await resolveServableDailyBriefing({
      careerPathId,
      now: input.now,
      build: input.build,
    });
    const stories = briefingToNewsStories(record.briefing, input.maxStories);
    if (!stories.length) {
      return { ok: false, errorCode: "BRIEFING_EMPTY" };
    }
    return {
      ok: true,
      source: isToday ? "briefing" : "briefing_stale",
      careerPathId,
      briefingDate: record.briefingDate,
      focusSummary: `${record.briefing.dowTheme}: ${
        isToday ? "today's" : `the latest (${record.briefingDate})`
      } AI landscape briefing for ${record.briefing.careerPathName}, built from ${record.briefing.fetchedCount} fetched stories across ${record.briefing.feedsOk} live feeds.`,
      selectionRationale:
        "Stories are ranked by keyword relevance to your career path, cross-feed trending, source trust tier, and recency. Every URL comes from a real fetched feed item.",
      stories,
    };
  } catch (error) {
    return {
      ok: false,
      errorCode: error instanceof Error ? error.message.slice(0, 120) : "BRIEFING_FAILED",
    };
  }
}
