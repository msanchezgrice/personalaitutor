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

export async function getOrGenerateDailyBriefing(input: {
  careerPathId: string;
  now?: Date;
  /** Injectable for tests; defaults to the real engine (network fetch). */
  build?: (careerPathId: string, now: Date) => Promise<DailyBriefing>;
}): Promise<DailyBriefingRecord> {
  const now = input.now ?? new Date();
  const briefingDate = todayBriefingDate(now);

  const cached = await getDailyBriefing({ careerPathId: input.careerPathId, briefingDate });
  if (cached) return cached;

  const build = input.build ?? ((careerPathId: string, at: Date) => buildBriefing({ careerPathId, now: at }));
  const briefing = await build(input.careerPathId, now);

  return persistDailyBriefing({
    careerPathId: input.careerPathId,
    briefingDate,
    briefing,
    model: process.env.OPENAI_API_KEY?.trim() ? resolveOpenAiModel() : null,
  });
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
 * The dashboard entry point (replaces `generateNewsFromOpenAi`): read today's
 * briefing for the user's path (generate on demand if missing) and return
 * grounded stories. Failure is explicit — there is NO fabricated-story
 * fallback.
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
      source: "briefing";
      careerPathId: string;
      focusSummary: string;
      selectionRationale: string;
      stories: BriefingNewsStory[];
    }
  | { ok: false; errorCode: string }
> {
  const careerPathId = resolveBriefingPathId([input.careerPathId, ...(input.recommendedPathIds ?? [])]);
  try {
    const record = await getOrGenerateDailyBriefing({ careerPathId, now: input.now, build: input.build });
    const stories = briefingToNewsStories(record.briefing, input.maxStories);
    if (!stories.length) {
      return { ok: false, errorCode: "BRIEFING_EMPTY" };
    }
    return {
      ok: true,
      source: "briefing",
      careerPathId,
      focusSummary: `${record.briefing.dowTheme}: today's AI landscape briefing for ${record.briefing.careerPathName}, built from ${record.briefing.fetchedCount} fetched stories across ${record.briefing.feedsOk} live feeds.`,
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
