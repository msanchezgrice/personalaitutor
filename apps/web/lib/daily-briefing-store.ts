import "server-only";

import { randomUUID } from "node:crypto";
import type { DailyBriefing } from "@aitutor/daily-content";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Persistence for daily landscape briefings (rebuild Phase 3.1): one briefing
 * per career path per day, produced by the ported MDD engine
 * (`packages/daily-content`). The dashboard news feed, the daily re-scoring
 * pass, and the weekly proof-of-watch email all read from this store.
 *
 * Follows the repo's memory/supabase dual-mode convention (see
 * `artifact-content-store.ts`).
 *
 * Table: `daily_briefings`
 * (migration `supabase/migrations/20260707210000_add_daily_briefings_actions_streaks.sql`).
 */

type PersistenceMode = "memory" | "supabase";

function mode(): PersistenceMode {
  const explicit = process.env.PERSISTENCE_MODE?.toLowerCase();
  if (explicit === "supabase" || explicit === "memory") return explicit;
  if (explicit) {
    throw new Error("PERSISTENCE_MODE_INVALID");
  }
  const hasSupabaseCreds = Boolean(
    (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY),
  );
  if (hasSupabaseCreds) return "supabase";
  throw new Error("PERSISTENCE_MODE_REQUIRED");
}

export type DailyBriefingRecord = {
  id: string;
  careerPathId: string;
  /** ISO date (yyyy-mm-dd). */
  briefingDate: string;
  briefing: DailyBriefing;
  model: string | null;
  createdAt: string;
};

export function todayBriefingDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

// --- memory mode -------------------------------------------------------------

const memoryBriefings = new Map<string, DailyBriefingRecord>();

function memoryKey(careerPathId: string, briefingDate: string) {
  return `${careerPathId}:${briefingDate}`;
}

export function resetDailyBriefingStateForTests() {
  memoryBriefings.clear();
}

// --- supabase row mapping ------------------------------------------------------

type DailyBriefingRow = {
  id: string;
  career_path_id: string;
  briefing_date: string;
  briefing: unknown;
  model: string | null;
  created_at: string;
};

const BRIEFING_SELECT_FIELDS = "id,career_path_id,briefing_date,briefing,model,created_at";

function recordFromRow(row: DailyBriefingRow): DailyBriefingRecord {
  return {
    id: row.id,
    careerPathId: row.career_path_id,
    briefingDate: String(row.briefing_date).slice(0, 10),
    briefing: row.briefing as DailyBriefing,
    model: row.model,
    createdAt: row.created_at,
  };
}

// --- lifecycle ---------------------------------------------------------------

/**
 * Idempotent per (careerPathId, briefingDate): re-persisting the same day
 * replaces the stored briefing (upsert), so the daily refresh can safely
 * re-run.
 */
export async function persistDailyBriefing(input: {
  careerPathId: string;
  briefingDate: string;
  briefing: DailyBriefing;
  model?: string | null;
}): Promise<DailyBriefingRecord> {
  if (!input.briefing?.validated) {
    // Never persist a briefing that has not passed the no-fabrication guardrail.
    throw new Error("DAILY_BRIEFING_NOT_VALIDATED");
  }

  const record: DailyBriefingRecord = {
    id: randomUUID(),
    careerPathId: input.careerPathId,
    briefingDate: input.briefingDate,
    briefing: input.briefing,
    model: input.model ?? null,
    createdAt: new Date().toISOString(),
  };

  if (mode() === "memory") {
    const key = memoryKey(record.careerPathId, record.briefingDate);
    const existing = memoryBriefings.get(key);
    if (existing) {
      record.id = existing.id;
      record.createdAt = existing.createdAt;
    }
    memoryBriefings.set(key, record);
    return { ...record };
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("daily_briefings")
    .upsert(
      {
        career_path_id: record.careerPathId,
        briefing_date: record.briefingDate,
        briefing: record.briefing,
        model: record.model,
      },
      { onConflict: "career_path_id,briefing_date" },
    )
    .select(BRIEFING_SELECT_FIELDS)
    .single();

  if (error || !data) {
    throw new Error(`DAILY_BRIEFING_PERSIST_FAILED:${error?.message ?? "NO_ROW"}`);
  }
  return recordFromRow(data as DailyBriefingRow);
}

export async function getDailyBriefing(input: {
  careerPathId: string;
  briefingDate: string;
}): Promise<DailyBriefingRecord | null> {
  if (mode() === "memory") {
    const record = memoryBriefings.get(memoryKey(input.careerPathId, input.briefingDate));
    return record ? { ...record } : null;
  }

  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("daily_briefings")
    .select(BRIEFING_SELECT_FIELDS)
    .eq("career_path_id", input.careerPathId)
    .eq("briefing_date", input.briefingDate)
    .maybeSingle();
  return data ? recordFromRow(data as DailyBriefingRow) : null;
}

/**
 * Newest stored briefing for a path regardless of date. Serving fallback for
 * the UTC date-boundary window where today's row does not exist yet (live
 * E2E finding #1, 2026-07-07): the latest real briefing always beats the
 * legacy global cache.
 */
export async function getLatestDailyBriefing(input: {
  careerPathId: string;
}): Promise<DailyBriefingRecord | null> {
  if (mode() === "memory") {
    const records = Array.from(memoryBriefings.values())
      .filter((record) => record.careerPathId === input.careerPathId)
      .sort((a, b) => b.briefingDate.localeCompare(a.briefingDate));
    return records.length ? { ...records[0] } : null;
  }

  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("daily_briefings")
    .select(BRIEFING_SELECT_FIELDS)
    .eq("career_path_id", input.careerPathId)
    .order("briefing_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? recordFromRow(data as DailyBriefingRow) : null;
}

/** Briefings for a path since a date (inclusive), newest first. */
export async function listDailyBriefingsSince(input: {
  careerPathId: string;
  sinceDate: string;
}): Promise<DailyBriefingRecord[]> {
  if (mode() === "memory") {
    return Array.from(memoryBriefings.values())
      .filter((record) => record.careerPathId === input.careerPathId && record.briefingDate >= input.sinceDate)
      .sort((a, b) => b.briefingDate.localeCompare(a.briefingDate))
      .map((record) => ({ ...record }));
  }

  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("daily_briefings")
    .select(BRIEFING_SELECT_FIELDS)
    .eq("career_path_id", input.careerPathId)
    .gte("briefing_date", input.sinceDate)
    .order("briefing_date", { ascending: false });
  return ((data ?? []) as DailyBriefingRow[]).map(recordFromRow);
}
