import type { FeedTier } from "./feeds";

/** A fetched, canonicalized feed item — the atom the whole pipeline works on. */
export type FeedItem = {
  /** Canonical URL (tracking params stripped, redirects unwrapped). */
  url: string;
  originalUrl: string;
  title: string;
  summary: string;
  source: string;
  tier: FeedTier;
  /** Raw published timestamp string (ISO8601 or RFC822), may be "". */
  published: string;
  contentHash: string;
  /** How many distinct feeds carried this story (set by dedupe). */
  trendingScore?: number;
};

export type RankedFeedItem = FeedItem & {
  score: number;
  overlap: number;
};

export type FetchStats = {
  ok: number;
  fail: number;
  totalFeeds: number;
  totalItems: number;
  failures: Array<{ source: string; url: string; error: string }>;
};

export type BriefingStory = {
  headline: string;
  summary: string;
  source: string;
  url: string;
  published: string;
  trendingScore: number;
};

export type BriefingSource = {
  name: string;
  url: string;
};

export type DailyBriefing = {
  careerPathId: string;
  careerPathName: string;
  /** ISO date (yyyy-mm-dd) the briefing was built for. */
  date: string;
  dayOfWeek: number;
  dowTheme: string;
  dowBlurb: string;
  topStory: BriefingStory | null;
  quickHits: BriefingStory[];
  sources: BriefingSource[];
  /**
   * Curation-only blocks we cannot honestly derive from RSS: always null.
   * NEVER fabricated (ported behavior from MDD's build_briefing).
   */
  toolOfTheDay: null;
  byTheNumbers: null;
  fetchedCount: number;
  feedsOk: number;
  feedsFail: number;
  validated: boolean;
};
