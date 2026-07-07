import "server-only";

import { randomUUID } from "node:crypto";
import {
  advanceStreak,
  effectiveCurrentStreak,
  generateBriefingRescore,
  type BriefingRescore,
  type StreakState,
} from "@aitutor/shared";
import type { DailyBriefing } from "@aitutor/daily-content";
import {
  appendAssessmentReport,
  getLatestAssessmentReportForProfile,
} from "@/lib/anonymous-assessment";
import { getOrGenerateDailyBriefing, resolveBriefingPathId } from "@/lib/daily-briefing";
import { todayBriefingDate } from "@/lib/daily-briefing-store";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Event-driven re-scoring + daily action (rebuild Phase 3.3).
 *
 * Each day, today's landscape briefing is interpreted against the learner's
 * latest assessment report (gpt-4.1-mini, zod-validated): gap adjustments, an
 * optional bounded score delta (appended to `assessment_report_history` — the
 * score's append-only spine), and the learner's daily action
 * ("Today, 15 min: ..."). Completing the daily action is a check-in that
 * advances the streak (Phase 3.5).
 *
 * HARD FAILURE contract (paid-tier logic): missing key / failed LLM call /
 * missing report = explicit error. No fabricated action, ever.
 *
 * Follows the repo's memory/supabase dual-mode convention.
 * Tables: `daily_actions`, `learner_streaks`
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

export type DailyActionRecord = {
  id: string;
  learnerProfileId: string;
  /** UTC calendar date (yyyy-mm-dd) this action belongs to. */
  actionDate: string;
  careerPathId: string;
  title: string;
  minutes: number;
  gapRef: string;
  artifactRef: string | null;
  scoreDelta: number;
  scoreDeltaReason: string | null;
  gapAdjustments: BriefingRescore["gapAdjustments"];
  status: "pending" | "completed";
  completedAt: string | null;
  createdAt: string;
};

export type StreakRecord = StreakState & {
  learnerProfileId: string;
  updatedAt: string;
};

// --- memory mode -------------------------------------------------------------

const memoryActions = new Map<string, DailyActionRecord>();
const memoryStreaks = new Map<string, StreakRecord>();

function actionKey(learnerProfileId: string, actionDate: string) {
  return `${learnerProfileId}:${actionDate}`;
}

export function resetDailyActionStateForTests() {
  memoryActions.clear();
  memoryStreaks.clear();
}

// --- supabase row mapping ------------------------------------------------------

type DailyActionRow = {
  id: string;
  learner_profile_id: string;
  action_date: string;
  career_path_id: string;
  title: string;
  minutes: number;
  gap_ref: string;
  artifact_ref: string | null;
  score_delta: number;
  score_delta_reason: string | null;
  gap_adjustments: unknown;
  status: string;
  completed_at: string | null;
  created_at: string;
};

const ACTION_SELECT_FIELDS =
  "id,learner_profile_id,action_date,career_path_id,title,minutes,gap_ref,artifact_ref,score_delta,score_delta_reason,gap_adjustments,status,completed_at,created_at";

function actionFromRow(row: DailyActionRow): DailyActionRecord {
  return {
    id: row.id,
    learnerProfileId: row.learner_profile_id,
    actionDate: String(row.action_date).slice(0, 10),
    careerPathId: row.career_path_id,
    title: row.title,
    minutes: Number(row.minutes),
    gapRef: row.gap_ref,
    artifactRef: row.artifact_ref,
    scoreDelta: Number(row.score_delta ?? 0),
    scoreDeltaReason: row.score_delta_reason,
    gapAdjustments: Array.isArray(row.gap_adjustments)
      ? (row.gap_adjustments as DailyActionRecord["gapAdjustments"])
      : [],
    status: row.status === "completed" ? "completed" : "pending",
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

// --- daily action store --------------------------------------------------------

export async function getDailyAction(input: {
  learnerProfileId: string;
  actionDate: string;
}): Promise<DailyActionRecord | null> {
  if (mode() === "memory") {
    const record = memoryActions.get(actionKey(input.learnerProfileId, input.actionDate));
    return record ? { ...record } : null;
  }

  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("daily_actions")
    .select(ACTION_SELECT_FIELDS)
    .eq("learner_profile_id", input.learnerProfileId)
    .eq("action_date", input.actionDate)
    .maybeSingle();
  return data ? actionFromRow(data as DailyActionRow) : null;
}

async function persistDailyAction(record: DailyActionRecord): Promise<DailyActionRecord> {
  if (mode() === "memory") {
    memoryActions.set(actionKey(record.learnerProfileId, record.actionDate), { ...record });
    return { ...record };
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("daily_actions")
    .upsert(
      {
        learner_profile_id: record.learnerProfileId,
        action_date: record.actionDate,
        career_path_id: record.careerPathId,
        title: record.title,
        minutes: record.minutes,
        gap_ref: record.gapRef,
        artifact_ref: record.artifactRef,
        score_delta: record.scoreDelta,
        score_delta_reason: record.scoreDeltaReason,
        gap_adjustments: record.gapAdjustments,
        status: record.status,
        completed_at: record.completedAt,
      },
      { onConflict: "learner_profile_id,action_date" },
    )
    .select(ACTION_SELECT_FIELDS)
    .single();

  if (error || !data) {
    throw new Error(`DAILY_ACTION_PERSIST_FAILED:${error?.message ?? "NO_ROW"}`);
  }
  return actionFromRow(data as DailyActionRow);
}

export async function listCompletedDailyActionsSince(input: {
  learnerProfileId: string;
  sinceDate: string;
}): Promise<DailyActionRecord[]> {
  if (mode() === "memory") {
    return Array.from(memoryActions.values())
      .filter(
        (record) =>
          record.learnerProfileId === input.learnerProfileId &&
          record.status === "completed" &&
          record.actionDate >= input.sinceDate,
      )
      .sort((a, b) => a.actionDate.localeCompare(b.actionDate))
      .map((record) => ({ ...record }));
  }

  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("daily_actions")
    .select(ACTION_SELECT_FIELDS)
    .eq("learner_profile_id", input.learnerProfileId)
    .eq("status", "completed")
    .gte("action_date", input.sinceDate)
    .order("action_date", { ascending: true });
  return ((data ?? []) as DailyActionRow[]).map(actionFromRow);
}

// --- streak store ---------------------------------------------------------------

export async function getStreak(learnerProfileId: string): Promise<StreakRecord> {
  if (mode() === "memory") {
    const record = memoryStreaks.get(learnerProfileId);
    if (record) return { ...record };
    return {
      learnerProfileId,
      currentStreak: 0,
      longestStreak: 0,
      lastActionDate: null,
      updatedAt: new Date().toISOString(),
    };
  }

  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("learner_streaks")
    .select("learner_profile_id,current_streak,longest_streak,last_action_date,updated_at")
    .eq("learner_profile_id", learnerProfileId)
    .maybeSingle();

  if (!data) {
    return {
      learnerProfileId,
      currentStreak: 0,
      longestStreak: 0,
      lastActionDate: null,
      updatedAt: new Date().toISOString(),
    };
  }
  return {
    learnerProfileId,
    currentStreak: Number(data.current_streak ?? 0),
    longestStreak: Number(data.longest_streak ?? 0),
    lastActionDate: data.last_action_date ? String(data.last_action_date).slice(0, 10) : null,
    updatedAt: String(data.updated_at ?? new Date().toISOString()),
  };
}

async function saveStreak(record: StreakRecord): Promise<StreakRecord> {
  if (mode() === "memory") {
    memoryStreaks.set(record.learnerProfileId, { ...record });
    return { ...record };
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("learner_streaks").upsert(
    {
      learner_profile_id: record.learnerProfileId,
      current_streak: record.currentStreak,
      longest_streak: record.longestStreak,
      last_action_date: record.lastActionDate,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "learner_profile_id" },
  );
  if (error) {
    throw new Error(`STREAK_PERSIST_FAILED:${error.message}`);
  }
  return record;
}

// --- orchestration ---------------------------------------------------------------

export type RunDailyRescoreResult =
  | { ok: true; action: DailyActionRecord; created: boolean; scoreAfter: number | null }
  | {
      ok: false;
      errorCode:
        | "ASSESSMENT_REPORT_MISSING"
        | "OPENAI_CONFIG_MISSING"
        | string;
    };

/**
 * Run the daily re-scoring pass for one learner. Idempotent per day: if
 * today's action already exists it is returned unchanged (no duplicate LLM
 * call, no duplicate history append).
 */
export async function runDailyRescoreForUser(input: {
  learnerProfileId: string;
  careerPathId?: string | null;
  now?: Date;
  /** Injectable for tests. */
  deps?: {
    generateRescore?: typeof generateBriefingRescore;
    buildBriefing?: (careerPathId: string, now: Date) => Promise<DailyBriefing>;
  };
}): Promise<RunDailyRescoreResult> {
  const now = input.now ?? new Date();
  const actionDate = todayBriefingDate(now);

  const existing = await getDailyAction({ learnerProfileId: input.learnerProfileId, actionDate });
  if (existing) {
    return { ok: true, action: existing, created: false, scoreAfter: null };
  }

  const latestReport = await getLatestAssessmentReportForProfile(input.learnerProfileId);
  if (!latestReport) {
    // No fabricated action: without a real report there is nothing to score against.
    return { ok: false, errorCode: "ASSESSMENT_REPORT_MISSING" };
  }

  const careerPathId = resolveBriefingPathId([
    input.careerPathId,
    latestReport.report.recommendedPath?.careerPathId,
  ]);

  try {
    const briefingRecord = await getOrGenerateDailyBriefing({
      careerPathId,
      now,
      build: input.deps?.buildBriefing,
    });
    const briefing = briefingRecord.briefing;

    const generate = input.deps?.generateRescore ?? generateBriefingRescore;
    const { rescore, model } = await generate({
      briefing: {
        date: briefing.date,
        careerPathName: briefing.careerPathName,
        topStory: briefing.topStory,
        quickHits: briefing.quickHits,
      },
      report: {
        readinessScore: latestReport.readinessScore,
        headline: latestReport.report.headline,
        gaps: latestReport.report.gaps,
      },
      careerPathName: briefing.careerPathName,
    });

    // Score deltas append to the report history — the score's append-only spine.
    let scoreAfter: number | null = null;
    if (rescore.scoreDelta !== 0) {
      scoreAfter = Math.max(0, Math.min(100, latestReport.readinessScore + rescore.scoreDelta));
      await appendAssessmentReport({
        anonymousAssessmentId: latestReport.anonymousAssessmentId,
        learnerProfileId: input.learnerProfileId,
        readinessScore: scoreAfter,
        deterministicScore: null,
        model,
        report: {
          ...latestReport.report,
          readinessScore: scoreAfter,
          rescore: {
            source: "briefing_rescore",
            briefingDate: briefing.date,
            scoreDelta: rescore.scoreDelta,
            reason: rescore.scoreDeltaReason,
            gapAdjustments: rescore.gapAdjustments,
            baseScore: latestReport.readinessScore,
          },
        } as typeof latestReport.report,
      });
    }

    const action = await persistDailyAction({
      id: randomUUID(),
      learnerProfileId: input.learnerProfileId,
      actionDate,
      careerPathId,
      title: rescore.dailyAction.title,
      minutes: rescore.dailyAction.minutes,
      gapRef: rescore.dailyAction.gapRef,
      artifactRef: rescore.dailyAction.artifactRef ?? null,
      scoreDelta: rescore.scoreDelta,
      scoreDeltaReason: rescore.scoreDeltaReason.trim() || null,
      gapAdjustments: rescore.gapAdjustments,
      status: "pending",
      completedAt: null,
      createdAt: new Date().toISOString(),
    });

    return { ok: true, action, created: true, scoreAfter };
  } catch (error) {
    return {
      ok: false,
      errorCode: error instanceof Error ? error.message.slice(0, 160) : "DAILY_RESCORE_FAILED",
    };
  }
}

export type CompleteDailyActionResult =
  | { ok: true; action: DailyActionRecord; streak: StreakRecord; alreadyCompleted: boolean }
  | { ok: false; errorCode: "DAILY_ACTION_NOT_FOUND" | string };

/**
 * Completing a daily action = a check-in: marks the action completed and
 * advances the streak. Idempotent — completing twice never double-counts.
 */
export async function completeDailyAction(input: {
  learnerProfileId: string;
  now?: Date;
}): Promise<CompleteDailyActionResult> {
  const now = input.now ?? new Date();
  const actionDate = todayBriefingDate(now);

  const action = await getDailyAction({ learnerProfileId: input.learnerProfileId, actionDate });
  if (!action) {
    return { ok: false, errorCode: "DAILY_ACTION_NOT_FOUND" };
  }

  if (action.status === "completed") {
    const streak = await getStreak(input.learnerProfileId);
    return { ok: true, action, streak, alreadyCompleted: true };
  }

  const completed = await persistDailyAction({
    ...action,
    status: "completed",
    completedAt: now.toISOString(),
  });

  const currentStreak = await getStreak(input.learnerProfileId);
  const advanced = advanceStreak(currentStreak, actionDate);
  const streak = await saveStreak({
    ...currentStreak,
    ...advanced,
    learnerProfileId: input.learnerProfileId,
    updatedAt: now.toISOString(),
  });

  return { ok: true, action: completed, streak, alreadyCompleted: false };
}

export type DailyRescoreSweepResult = {
  attempted: number;
  created: number;
  existing: number;
  skipped: Array<{ learnerProfileId: string; reason: string }>;
  failed: Array<{ learnerProfileId: string; error: string }>;
};

/**
 * Cron sweep (GET /api/scheduler/daily-update): run the daily re-scoring pass
 * for every active subscriber. Per-user failures are isolated; users without
 * an assessment report are skipped (expected), other failures are reported.
 * Idempotent per user per day via `runDailyRescoreForUser`.
 */
export async function runDailyRescoreSweep(options: {
  now?: Date;
  limit?: number;
  deps?: {
    listSubscribers?: (limit: number) => Promise<
      Array<{ learnerProfileId: string; careerPathId: string | null }>
    >;
    runForUser?: typeof runDailyRescoreForUser;
  };
} = {}): Promise<DailyRescoreSweepResult> {
  const now = options.now ?? new Date();
  const limit = options.limit ?? 200;
  const listSubscribers =
    options.deps?.listSubscribers ??
    (async (max: number) => {
      const { listActiveSubscribers } = await import("@/lib/campaign-email");
      return listActiveSubscribers(max);
    });
  const runForUser = options.deps?.runForUser ?? runDailyRescoreForUser;

  const subscribers = await listSubscribers(limit);
  const result: DailyRescoreSweepResult = {
    attempted: subscribers.length,
    created: 0,
    existing: 0,
    skipped: [],
    failed: [],
  };

  for (const subscriber of subscribers) {
    try {
      const run = await runForUser({
        learnerProfileId: subscriber.learnerProfileId,
        careerPathId: subscriber.careerPathId,
        now,
      });
      if (run.ok) {
        if (run.created) result.created += 1;
        else result.existing += 1;
      } else if (run.errorCode === "ASSESSMENT_REPORT_MISSING") {
        result.skipped.push({ learnerProfileId: subscriber.learnerProfileId, reason: run.errorCode });
      } else {
        result.failed.push({ learnerProfileId: subscriber.learnerProfileId, error: run.errorCode });
      }
    } catch (error) {
      result.failed.push({
        learnerProfileId: subscriber.learnerProfileId,
        error: error instanceof Error ? error.message.slice(0, 160) : "DAILY_RESCORE_FAILED",
      });
    }
  }

  return result;
}

/** Dashboard read model: today's action (if any) + display streak. */
export async function getDailyActionWithStreak(input: {
  learnerProfileId: string;
  now?: Date;
}): Promise<{
  action: DailyActionRecord | null;
  streak: { current: number; longest: number };
}> {
  const now = input.now ?? new Date();
  const actionDate = todayBriefingDate(now);
  const [action, streak] = await Promise.all([
    getDailyAction({ learnerProfileId: input.learnerProfileId, actionDate }),
    getStreak(input.learnerProfileId),
  ]);
  return {
    action,
    streak: {
      current: effectiveCurrentStreak(streak, actionDate),
      longest: streak.longestStreak,
    },
  };
}
