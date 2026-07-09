import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { MDD_CAREER_MAPPINGS, type BriefingStory, type DailyBriefing } from "@aitutor/daily-content";

/**
 * MAST→MDD briefing feed (approved decision I).
 *
 * MDD's career hubs (mydailydownload.com/ai-for/<career>) render "latest
 * briefing" from MDD's separate Supabase `briefings` table, which went stale
 * when its Python cron retired. After MAST's news-refresh scheduler builds
 * the 9 path briefings, this module mirrors them into MDD's table — one row
 * per MDD career, mapped via the inverse of the daily-content taxonomy
 * (each MDD career receives the briefing of the MAST path it folded into).
 *
 * Mapping choices (documented per the taxonomy's provenance data):
 * - 13 of MDD's 15 careers map to a MAST path and get that path's briefing.
 * - `legal` and `healthcare` are retired verticals (mastPathId: null) with
 *   no honest MAST briefing to mirror — they are SKIPPED, never approximated
 *   (their hubs keep MDD's graceful "no data" fallback).
 * - Rows are written at seniority "Mid Level" — the tier MDD's hub pages
 *   prefer when selecting the latest row.
 *
 * Contract: env-gated on MDD_SUPABASE_URL + MDD_SUPABASE_SERVICE_ROLE_KEY
 * (silent skip with one log line when unset), idempotent upsert on
 * (career_id, seniority, date), and failure-isolated — an MDD write failure
 * must never fail the MAST refresh.
 */

const MDD_HUB_SENIORITY = "Mid Level";

export type MddBriefingFeedResult =
  | { skipped: true; reason: "MDD_ENV_MISSING" }
  | {
      skipped: false;
      written: string[];
      failures: Array<{ careerId: string; error: string }>;
    };

/**
 * Minimal structural client so tests can inject a stub (same DI pattern as
 * the daily-briefing store's `build` injection) — production uses the real
 * supabase-js client built from the MDD envs.
 */
export type MddBriefingsClient = {
  from(table: string): {
    upsert(
      row: Record<string, unknown>,
      options: { onConflict: string },
    ): PromiseLike<{ error: { message?: string } | null }>;
  };
};

function mddEnv(): { url: string; serviceRoleKey: string } | null {
  const url = process.env.MDD_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.MDD_SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) return null;
  return { url, serviceRoleKey };
}

function mddClient(env: { url: string; serviceRoleKey: string }): SupabaseClient {
  return createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** MDD's blocks_json used "%B %d, %Y" display dates (e.g. "July 09, 2026"). */
function mddDisplayDate(isoDate: string): string {
  const parsed = Date.parse(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(parsed)) return isoDate;
  return new Date(parsed).toLocaleDateString("en-US", {
    month: "long",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** MAST camelCase story → MDD snake_case item view (news_engine._item_view). */
function mddItemView(story: BriefingStory) {
  return {
    headline: story.headline,
    summary: story.summary,
    source: story.source,
    url: story.url,
    published: story.published,
    trending_score: story.trendingScore ?? 1,
  };
}

/** MDD `briefings.blocks_json`, matching news_engine.build_briefing exactly. */
export function buildMddBlocksJson(
  briefing: DailyBriefing,
  career: { mddId: string; mddName: string },
) {
  return {
    category_id: career.mddId,
    category_name: career.mddName,
    date: mddDisplayDate(briefing.date),
    day_of_week: briefing.dayOfWeek,
    dow_theme: briefing.dowTheme,
    dow_blurb: briefing.dowBlurb,
    seniority: MDD_HUB_SENIORITY,
    topStory: briefing.topStory ? mddItemView(briefing.topStory) : null,
    quickHits: briefing.quickHits.map(mddItemView),
    sources: briefing.sources.map((source) => ({ name: source.name, url: source.url })),
    // Never fabricated — MDD kept these null and the hub renders no block.
    toolOfTheDay: null,
    byTheNumbers: null,
    fetched_count: briefing.fetchedCount,
    feeds_ok: briefing.feedsOk,
    feeds_fail: briefing.feedsFail,
  };
}

export async function feedBriefingsToMdd(
  briefings: DailyBriefing[],
  options: { client?: MddBriefingsClient } = {},
): Promise<MddBriefingFeedResult> {
  const env = mddEnv();
  if (!env && !options.client) {
    return { skipped: true, reason: "MDD_ENV_MISSING" };
  }

  const byPathId = new Map(briefings.map((briefing) => [briefing.careerPathId, briefing]));
  const written: string[] = [];
  const failures: Array<{ careerId: string; error: string }> = [];

  let client: MddBriefingsClient;
  try {
    client = options.client ?? (mddClient(env as { url: string; serviceRoleKey: string }) as MddBriefingsClient);
  } catch (error) {
    return {
      skipped: false,
      written,
      failures: [{ careerId: "*", error: error instanceof Error ? error.message : "MDD_CLIENT_FAILED" }],
    };
  }

  for (const career of MDD_CAREER_MAPPINGS) {
    // Retired verticals (legal, healthcare) have no MAST path: skip.
    if (!career.mastPathId) continue;
    const briefing = byPathId.get(career.mastPathId);
    if (!briefing) continue;

    try {
      const { error } = await client.from("briefings").upsert(
        {
          career_id: career.mddId,
          seniority: MDD_HUB_SENIORITY,
          dow: briefing.dayOfWeek,
          date: briefing.date,
          blocks_json: buildMddBlocksJson(briefing, career),
          html: null,
        },
        { onConflict: "career_id,seniority,date" },
      );
      if (error) {
        failures.push({ careerId: career.mddId, error: error.message || "UPSERT_FAILED" });
        continue;
      }
      written.push(career.mddId);
    } catch (error) {
      failures.push({
        careerId: career.mddId,
        error: error instanceof Error ? error.message : "UPSERT_FAILED",
      });
    }
  }

  return { skipped: false, written, failures };
}
