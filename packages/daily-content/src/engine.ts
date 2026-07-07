import { createHash } from "node:crypto";
import { callOpenAiResponses } from "@aitutor/shared";
import { allFeeds, type FeedSource } from "./feeds";
import { cleanFeedText, parseFeedXml } from "./rss";
import { getCareerPathCategory, type CareerPathCategory } from "./taxonomy";
import type {
  BriefingSource,
  BriefingStory,
  DailyBriefing,
  FeedItem,
  FetchStats,
  RankedFeedItem,
} from "./types";

/**
 * Real, cited briefing engine (rebuild Phase 3.1). TypeScript port of MDD's
 * `newsletter-backend/news_engine.py`: fetch real items from free RSS feeds,
 * canonicalize + dedupe, rank per career path, optionally rewrite summaries
 * with a STRICT grounded LLM prompt, and emit a structured briefing in which
 * **every rendered URL is guaranteed to exist in the fetched set**.
 *
 * Hard invariant (the guardrail): no fact / headline / URL is ever emitted
 * unless it came from a feed item we actually fetched. Missing top story
 * after validation is a HARD FAILURE (`BRIEFING_TOP_STORY_MISSING`).
 *
 * The ONE sanctioned degradation (matching MDD's design): without an
 * OPENAI_API_KEY the grounded-summarization pass is skipped and the engine
 * passes real feed titles + summaries through unchanged. It NEVER invents.
 */

export const MAX_QUICK_HITS = 5;

// ──────────────────────────────────────────────────────────────────────────
// Day-of-week hero themes (ported overlay).
// ──────────────────────────────────────────────────────────────────────────
export const DOW_THEMES: Record<number, [string, string]> = {
  1: ["The Setup", "Week-ahead lead — what to watch this week"], // Monday
  2: ["Tool Tuesday", "A tool worth trying today"],
  3: ["Playbook Wednesday", "A tactical workflow you can run now"],
  4: ["Signal Thursday", "The signal that matters for your role"],
  5: ["The Roundup", "The week's biggest moves, rounded up"],
  6: ["Weekend Read", "One longer read for the weekend"],
  0: ["Weekend Read", "One longer read for the weekend"], // Sunday
};

// Tracking / junk query params to strip during canonicalization.
const TRACKING_PARAMS = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "utm_id", "utm_name", "utm_reader", "utm_brand", "utm_social",
  "mc_cid", "mc_eid", "fbclid", "gclid", "dclid", "msclkid", "igshid",
  "yclid", "_hsenc", "_hsmi", "hsctatracking", "mkt_tok", "vero_id",
  "ref", "ref_src", "ref_url", "source", "cmpid", "ncid", "spm",
  "guccounter", "guce_referrer", "guce_referrer_sig",
]);

// Params that commonly wrap a redirect target (decode without a network call).
const REDIRECT_PARAMS = ["url", "u", "redirect", "redirect_url", "dest", "destination", "target"];

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "for", "to", "of", "in", "on", "with",
  "is", "are", "was", "were", "this", "that", "it", "its", "as", "at",
  "by", "from", "new", "ai", "how", "why", "what", "you", "your",
]);

// ──────────────────────────────────────────────────────────────────────────
// Canonicalize
// ──────────────────────────────────────────────────────────────────────────

/**
 * Normalize a URL: unwrap obvious redirect wrappers (no network), strip
 * tracking params, drop fragments, lowercase the host, trim a trailing slash.
 * Falls back to the original on any error — canonicalization must never throw.
 */
export function canonicalizeUrl(url: string): string {
  if (!url) return url;
  const original = url.trim();
  let current = original;
  try {
    // Best-effort unwrap of a redirect wrapper: ?url=<encoded real url>.
    for (let i = 0; i < 3; i += 1) {
      const parsed = new URL(current);
      let unwrapped: string | null = null;
      for (const key of REDIRECT_PARAMS) {
        const candidate = parsed.searchParams.get(key);
        if (candidate) {
          const decoded = safeDecode(candidate);
          if (decoded.startsWith("http://") || decoded.startsWith("https://")) {
            unwrapped = decoded;
            break;
          }
        }
      }
      if (unwrapped && unwrapped !== current) {
        current = unwrapped;
        continue;
      }
      break;
    }

    const parsed = new URL(current);
    if (!parsed.protocol) return original;

    const kept: string[] = [];
    for (const [key, value] of parsed.searchParams.entries()) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) continue;
      if (value === "") continue;
      kept.push(`${key}=${value}`);
    }
    const query = kept.join("&");

    let path = parsed.pathname;
    if (path.length > 1 && path.endsWith("/")) {
      path = path.slice(0, -1);
    }

    const host = parsed.host.toLowerCase();
    return `${parsed.protocol}//${host}${path}${query ? `?${query}` : ""}`;
  } catch {
    return original;
  }
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function contentHash(url: string, title: string): string {
  const basis = `${canonicalizeUrl(url)}|${(title || "").trim().toLowerCase()}`;
  return createHash("sha256").update(basis, "utf8").digest("hex").slice(0, 16);
}

// ──────────────────────────────────────────────────────────────────────────
// Fetch
// ──────────────────────────────────────────────────────────────────────────

export type FetchAllOptions = {
  feeds?: FeedSource[];
  perFeedLimit?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  log?: (message: string) => void;
};

/**
 * Pull every feed via native fetch + the hand-rolled parser. Per-feed
 * try/catch: one bad feed never breaks the run.
 */
export async function fetchAllFeeds(options: FetchAllOptions = {}): Promise<{ items: FeedItem[]; stats: FetchStats }> {
  const feeds = options.feeds ?? allFeeds();
  const perFeedLimit = options.perFeedLimit ?? 25;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const fetchImpl = options.fetchImpl ?? fetch;
  const log = options.log ?? (() => {});

  const items: FeedItem[] = [];
  let ok = 0;
  let fail = 0;
  const failures: FetchStats["failures"] = [];

  const results = await Promise.all(
    feeds.map(async (feed) => {
      try {
        const controller = new AbortController();
        const timeoutHandle = setTimeout(() => controller.abort(new Error("FEED_TIMEOUT")), timeoutMs);
        let response: Response;
        try {
          response = await fetchImpl(feed.url, {
            signal: controller.signal,
            headers: {
              "user-agent": "MyAISkillTutor briefing engine (+https://www.myaiskilltutor.com)",
              accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
            },
          });
        } finally {
          clearTimeout(timeoutHandle);
        }
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const xml = await response.text();
        const entries = parseFeedXml(xml);
        if (!entries.length) {
          throw new Error("no entries");
        }

        const feedItems: FeedItem[] = [];
        for (const entry of entries.slice(0, perFeedLimit)) {
          const link = (entry.link || "").trim();
          const title = cleanFeedText(entry.title);
          if (!link || !title) continue;
          const canon = canonicalizeUrl(link);
          feedItems.push({
            url: canon,
            originalUrl: link,
            title,
            summary: cleanFeedText(entry.summary).slice(0, 1200),
            source: feed.source,
            tier: feed.tier,
            published: entry.published || "",
            contentHash: contentHash(canon, title),
          });
        }
        return { ok: true as const, feed, feedItems };
      } catch (error) {
        return {
          ok: false as const,
          feed,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );

  for (const result of results) {
    if (result.ok) {
      ok += 1;
      items.push(...result.feedItems);
      log(`feed OK  ${result.feed.source} ${result.feedItems.length} items`);
    } else {
      fail += 1;
      failures.push({ source: result.feed.source, url: result.feed.url, error: result.error });
      log(`feed FAIL ${result.feed.source} ${result.error}`);
    }
  }

  return {
    items,
    stats: { ok, fail, totalFeeds: feeds.length, totalItems: items.length, failures },
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Dedupe
// ──────────────────────────────────────────────────────────────────────────

function normalizeTitle(title: string): string {
  return (title || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const TIER_RANK: Record<string, number> = { primary: 0, research: 1, press: 2, indie: 3 };

/**
 * Drop exact content-hash dupes + near-dupes by normalized title. Tracks a
 * `trendingScore` = how many feeds carried the story. Keeps the highest-trust
 * (primary > research > press > indie) representative.
 */
export function dedupeItems(items: FeedItem[]): FeedItem[] {
  const byHash = new Map<string, FeedItem & { trendingScore: number; _sources: Set<string> }>();
  for (const item of items) {
    const existing = byHash.get(item.contentHash);
    if (!existing) {
      byHash.set(item.contentHash, { ...item, trendingScore: 1, _sources: new Set([item.source]) });
    } else if (!existing._sources.has(item.source)) {
      existing.trendingScore += 1;
      existing._sources.add(item.source);
    }
  }

  const byTitle = new Map<string, FeedItem & { trendingScore: number; _sources: Set<string> }>();
  for (const item of byHash.values()) {
    const key = normalizeTitle(item.title) || item.url;
    const kept = byTitle.get(key);
    if (!kept) {
      byTitle.set(key, item);
      continue;
    }
    kept.trendingScore += 1;
    for (const source of item._sources) kept._sources.add(source);
    // Prefer the higher-trust source as the representative.
    if ((TIER_RANK[item.tier] ?? 9) < (TIER_RANK[kept.tier] ?? 9)) {
      const mergedScore = kept.trendingScore;
      const mergedSources = kept._sources;
      const replacement = { ...item, trendingScore: mergedScore, _sources: mergedSources };
      byTitle.set(key, replacement);
    }
  }

  return Array.from(byTitle.values()).map((entry) => {
    const { _sources, ...rest } = entry;
    void _sources;
    return rest;
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Rank
// ──────────────────────────────────────────────────────────────────────────

/** Return a multiplier in (0,1]; newer = closer to 1. ~7-day half-life. */
export function recencyDecay(published: string, now: Date = new Date()): number {
  if (!published) return 0.5;
  const normalized = published.replace(/Z$/, "+00:00");
  let timestamp = Date.parse(normalized);
  if (Number.isNaN(timestamp)) {
    timestamp = Date.parse(published);
  }
  if (Number.isNaN(timestamp)) return 0.5;
  const ageDays = Math.max(0, (now.getTime() - timestamp) / 86_400_000);
  return 0.5 ** (ageDays / 7);
}

export function extractKeywords(text: string): Set<string> {
  const tokens = (text || "").toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return new Set(tokens.filter((token) => !STOPWORDS.has(token) && token.length > 2));
}

const TIER_BOOST: Record<string, number> = { primary: 1.15, research: 1.0, press: 1.05, indie: 1.0 };

/**
 * Score items by keyword overlap with the career path's search terms +
 * recency decay + a small trending boost + a small first-party trust boost.
 * Deterministic for a fixed `now`. Returns the top N.
 */
export function rankForCategory(
  items: FeedItem[],
  category: Pick<CareerPathCategory, "name" | "searchTerms">,
  options: { topN?: number; now?: Date } = {},
): RankedFeedItem[] {
  const topN = options.topN ?? Math.max(MAX_QUICK_HITS * 3, 12);
  const now = options.now ?? new Date();
  const terms = extractKeywords(`${category.searchTerms} ${category.name}`);

  const scored: RankedFeedItem[] = items.map((item) => {
    const textKeywords = extractKeywords(`${item.title} ${item.summary}`);
    let overlap = 0;
    for (const term of terms) {
      if (textKeywords.has(term)) overlap += 1;
    }
    // Relevance dominates: category keyword overlap is the primary signal so
    // off-topic-but-recent items can't crowd out on-topic ones. A small floor
    // keeps a high-trending breaking item eligible without letting noise win.
    const relevance = 1.0 * overlap + 0.15;
    const recency = recencyDecay(item.published, now);
    const trending = 1.0 + 0.35 * ((item.trendingScore ?? 1) - 1);
    // Recency is a gentle multiplier (0.7..1.0), not a co-equal term, so a
    // 3-keyword on-topic story beats a 0-keyword item published an hour ago.
    const score = relevance * (0.7 + 0.3 * recency) * trending * (TIER_BOOST[item.tier] ?? 1.0);
    return {
      ...item,
      score: Math.round(score * 10_000) / 10_000,
      overlap,
    };
  });

  // Sort by score, then break ties toward more recent items.
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return recencyDecay(b.published, now) - recencyDecay(a.published, now);
  });
  return scored.slice(0, topN);
}

// ──────────────────────────────────────────────────────────────────────────
// Grounded summarization (LLM optional; pass-through without a key)
// ──────────────────────────────────────────────────────────────────────────

const GROUNDED_EDITOR_SYSTEM_PROMPT =
  "You are a careful newsletter editor. You will be given ONE news item: " +
  "a title, a source summary, and a source URL. Rewrite ONLY using facts " +
  "present in the provided text. Add NO facts, numbers, names, quotes, or " +
  "claims that are not in the provided text. If a detail is unknown, omit " +
  "it. Keep it to 1-2 sentences, neutral and factual. Return JSON: " +
  '{"headline": "...", "summary": "...", "url": "<unchanged source url>"}. ' +
  "The url MUST be returned exactly as given.";

export type SummarizeOptions = {
  model?: string;
  log?: (message: string) => void;
  /** Injectable for tests; defaults to the shared Responses client. */
  callLlm?: typeof callOpenAiResponses;
};

/**
 * If OPENAI_API_KEY is set, rewrite each item's headline/summary using a
 * STRICT grounded prompt (temp 0, JSON mode). Otherwise pass the real feed
 * title + summary through UNCHANGED — the ONE sanctioned degradation in this
 * codebase (matching MDD's zero-key design). Either way the source URL is
 * preserved verbatim; a rewrite that alters the URL is discarded.
 */
export async function summarizeGrounded<T extends FeedItem>(items: T[], options: SummarizeOptions = {}): Promise<T[]> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const log = options.log ?? (() => {});
  if (!apiKey) {
    log("OPENAI_API_KEY not set -> grounded summarization OFF (passing real feed text through unchanged)");
    return items.map((item) => ({ ...item }));
  }

  const callLlm = options.callLlm ?? callOpenAiResponses;
  const model = options.model ?? "gpt-4.1-mini";

  return Promise.all(
    items.map(async (item) => {
      const next = { ...item };
      try {
        const prompt = [
          GROUNDED_EDITOR_SYSTEM_PROMPT,
          "",
          JSON.stringify({ title: item.title, summary: item.summary, url: item.url }),
        ].join("\n");
        const raw = await callLlm({
          prompt,
          model,
          temperature: 0,
          maxOutputTokens: 300,
          textFormat: { type: "json_object" },
        });
        const data = JSON.parse(raw) as { headline?: string; summary?: string; url?: string };
        // GUARD: never let the model change the URL. If it did, discard the
        // rewrite and fall back to the real feed text for this item.
        if ((data.url ?? "").trim() === item.url) {
          next.title = (data.headline ?? item.title).trim() || item.title;
          next.summary = (data.summary ?? item.summary).trim() || item.summary;
        } else {
          log(`summary URL drift on '${item.title.slice(0, 60)}' -> keeping original feed text`);
        }
      } catch (error) {
        log(
          `summarize failed for '${item.title.slice(0, 60)}' (${error instanceof Error ? error.message : error}) -> keeping original feed text`,
        );
      }
      return next;
    }),
  );
}

// ──────────────────────────────────────────────────────────────────────────
// GUARDRAIL
// ──────────────────────────────────────────────────────────────────────────

function collectUrls(value: unknown): string[] {
  const urls: string[] = [];
  if (Array.isArray(value)) {
    for (const entry of value) urls.push(...collectUrls(entry));
  } else if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      if ((key === "url" || key === "sourceUrl" || key === "source_url") && typeof entry === "string" && entry) {
        urls.push(entry);
      } else {
        urls.push(...collectUrls(entry));
      }
    }
  }
  return urls;
}

/**
 * HARD INVARIANT: every URL rendered in the briefing must exist in the
 * fetched set. Any block whose source URL is not in the fetched set is
 * dropped. Throws `BRIEFING_TOP_STORY_MISSING` if, after cleaning, the
 * briefing has no grounded top story, and `BRIEFING_GUARDRAIL_VIOLATION` if
 * any rendered URL survives outside the fetched set (should be unreachable).
 */
export function validateBriefing(briefing: DailyBriefing, fetchedUrls: Set<string>, log: (m: string) => void = () => {}): DailyBriefing {
  const ok = (url: unknown): url is string => typeof url === "string" && fetchedUrls.has(url);

  const next: DailyBriefing = { ...briefing };

  if (next.topStory && !ok(next.topStory.url)) {
    log("guardrail: topStory url not in fetched set -> dropping topStory");
    next.topStory = null;
  }

  next.quickHits = (next.quickHits ?? []).filter((hit) => {
    if (ok(hit.url)) return true;
    log(`guardrail: dropping quickHit with non-fetched url: ${hit.url}`);
    return false;
  });

  next.sources = (next.sources ?? []).filter((source) => {
    if (ok(source.url)) return true;
    log(`guardrail: dropping source with non-fetched url: ${source.url}`);
    return false;
  });

  // A briefing must be grounded: no top story after cleaning is a hard failure.
  if (!next.topStory) {
    throw new Error("BRIEFING_TOP_STORY_MISSING");
  }

  const remaining = collectUrls(next);
  const bad = remaining.filter((url) => !fetchedUrls.has(url));
  if (bad.length) {
    throw new Error(`BRIEFING_GUARDRAIL_VIOLATION:${bad.length}:${bad.slice(0, 3).join(",")}`);
  }

  next.validated = true;
  return next;
}

// ──────────────────────────────────────────────────────────────────────────
// Compose a briefing
// ──────────────────────────────────────────────────────────────────────────

function storyView(item: FeedItem): BriefingStory {
  return {
    headline: item.title,
    summary: item.summary,
    source: item.source,
    url: item.url,
    published: item.published || "",
    trendingScore: item.trendingScore ?? 1,
  };
}

export type ComposeOptions = {
  category: CareerPathCategory;
  items: FeedItem[];
  fetchedUrls: Set<string>;
  stats: FetchStats;
  now?: Date;
  dayOfWeek?: number;
  maxQuickHits?: number;
  summarize?: (items: RankedFeedItem[]) => Promise<RankedFeedItem[]>;
  log?: (message: string) => void;
};

/**
 * Pure composition step (fetch already done): dedupe → rank → grounded
 * summarize → compose Big Story + Quick Hits + Sources → GUARDRAIL.
 *
 * Note: the grounded-summarization pass runs on the items that will render
 * (top story + quick hits) instead of MDD's wider ranked slice — behaviour
 * per item is identical, it just avoids paying for rewrites that are never
 * shown.
 */
export async function composeBriefing(options: ComposeOptions): Promise<DailyBriefing> {
  const now = options.now ?? new Date();
  const maxQuickHits = options.maxQuickHits ?? MAX_QUICK_HITS;
  const dayOfWeek = options.dayOfWeek ?? now.getUTCDay();
  const [dowTheme, dowBlurb] = DOW_THEMES[dayOfWeek] ?? DOW_THEMES[1];
  const log = options.log ?? (() => {});

  const deduped = dedupeItems(options.items);
  const ranked = rankForCategory(deduped, options.category, { now });

  const renderable = ranked.slice(0, 1 + maxQuickHits);
  const summarizer = options.summarize ?? ((items: RankedFeedItem[]) => summarizeGrounded(items, { log }));
  const summarized = await summarizer(renderable);

  const top = summarized[0] ?? null;
  const rest = summarized.slice(1, 1 + maxQuickHits);

  const briefing: DailyBriefing = {
    careerPathId: options.category.id,
    careerPathName: options.category.name,
    date: now.toISOString().slice(0, 10),
    dayOfWeek,
    dowTheme,
    dowBlurb,
    topStory: top ? storyView(top) : null,
    quickHits: rest.map(storyView),
    sources: [],
    // Curation-only blocks we cannot honestly derive from RSS: omitted.
    // NEVER fabricated.
    toolOfTheDay: null,
    byTheNumbers: null,
    fetchedCount: options.fetchedUrls.size,
    feedsOk: options.stats.ok,
    feedsFail: options.stats.fail,
    validated: false,
  };

  // Build the sources list from the rendered items (top + quick hits).
  const seen = new Set<string>();
  const rendered = [...(briefing.topStory ? [briefing.topStory] : []), ...briefing.quickHits];
  const sources: BriefingSource[] = [];
  for (const story of rendered) {
    if (!seen.has(story.url)) {
      seen.add(story.url);
      sources.push({ name: story.source, url: story.url });
    }
  }
  briefing.sources = sources;

  return validateBriefing(briefing, options.fetchedUrls, log);
}

export type BuildBriefingOptions = {
  careerPathId: string;
  now?: Date;
  dayOfWeek?: number;
  maxQuickHits?: number;
  feeds?: FeedSource[];
  fetchImpl?: typeof fetch;
  log?: (message: string) => void;
};

/**
 * Full pipeline for one MAST career path: fetch (Lane A free RSS) →
 * canonicalize (done in fetch) → dedupe → rank → grounded summarize →
 * compose → GUARDRAIL.
 */
export async function buildBriefing(options: BuildBriefingOptions): Promise<DailyBriefing> {
  const category = getCareerPathCategory(options.careerPathId);
  if (!category) {
    throw new Error(`BRIEFING_UNKNOWN_CAREER_PATH:${options.careerPathId}`);
  }

  const { items, stats } = await fetchAllFeeds({
    feeds: options.feeds,
    fetchImpl: options.fetchImpl,
    log: options.log,
  });

  // The fetched-URL set is the universe the guardrail validates against.
  const fetchedUrls = new Set(items.map((item) => item.url));

  return composeBriefing({
    category,
    items,
    fetchedUrls,
    stats,
    now: options.now,
    dayOfWeek: options.dayOfWeek,
    maxQuickHits: options.maxQuickHits,
    log: options.log,
  });
}

/**
 * Build briefings for many paths from a SINGLE fetch pass (the daily cron
 * refresh). Per-path failures are isolated so one path missing a grounded top
 * story never blocks the others.
 */
export async function buildBriefingsForPaths(
  careerPathIds: string[],
  options: Omit<BuildBriefingOptions, "careerPathId"> = {},
): Promise<{
  briefings: DailyBriefing[];
  failures: Array<{ careerPathId: string; error: string }>;
  stats: FetchStats;
}> {
  const { items, stats } = await fetchAllFeeds({
    feeds: options.feeds,
    fetchImpl: options.fetchImpl,
    log: options.log,
  });
  const fetchedUrls = new Set(items.map((item) => item.url));

  const briefings: DailyBriefing[] = [];
  const failures: Array<{ careerPathId: string; error: string }> = [];

  for (const careerPathId of careerPathIds) {
    const category = getCareerPathCategory(careerPathId);
    if (!category) {
      failures.push({ careerPathId, error: `BRIEFING_UNKNOWN_CAREER_PATH:${careerPathId}` });
      continue;
    }
    try {
      briefings.push(
        await composeBriefing({
          category,
          items,
          fetchedUrls,
          stats,
          now: options.now,
          dayOfWeek: options.dayOfWeek,
          maxQuickHits: options.maxQuickHits,
          log: options.log,
        }),
      );
    } catch (error) {
      failures.push({
        careerPathId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { briefings, failures, stats };
}
