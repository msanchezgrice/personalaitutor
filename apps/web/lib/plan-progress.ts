import "server-only";

import type { AssessmentReport } from "@/lib/assessment-report";
import {
  getLatestAssessmentReportForProfile,
  listAssessmentReportsForProfile,
  type AssessmentReportRecord,
} from "@/lib/anonymous-assessment";
import { listCompletedTutorSessionModuleTitles } from "@/lib/tutor-session";

/**
 * 30-day-plan progress (spine phases 1-3): the assessment report's
 * `thirtyDayPlan` is the learner's per-user module ordering, and this module
 * answers "which plan week is the learner in right now?".
 *
 * Current week = weeks elapsed since the ORIGINAL report (clamped to the plan
 * length), advanced further when the learner has already completed the tutor
 * sessions for later weeks' modules. No storage — everything derives from
 * `assessment_report_history` + `module_tutor_sessions`.
 *
 * Backward compatible by construction: users with no linked report get null
 * (callers keep today's behavior), and pre-spine reports without per-week
 * moduleTitle still get week math from report age.
 */

export type ThirtyDayPlanWeek = AssessmentReport["thirtyDayPlan"][number];

const WEEK_MS = 7 * 86_400_000;

function moduleKey(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function sortedPlan(plan: ThirtyDayPlanWeek[]) {
  return [...plan].sort((a, b) => a.week - b.week);
}

/**
 * Pure current-week math (spine phase 1).
 * - Week from plan age: floor(days since the plan was created / 7) + 1,
 *   clamped to [1, plan length] (a 5-weeks-old 4-week plan clamps to 4).
 * - Completed module tutor sessions advance the week when the learner is
 *   further along than the calendar: highest completed plan week + 1, clamped.
 * The later of the two wins.
 */
export function computeCurrentPlanWeek(input: {
  plan: ThirtyDayPlanWeek[];
  planCreatedAt: string;
  now?: Date;
  completedModuleTitles?: string[];
}): number {
  const plan = sortedPlan(input.plan);
  const totalWeeks = plan.length;
  if (!totalWeeks) return 1;

  const now = input.now ?? new Date();
  const createdMs = Date.parse(input.planCreatedAt);
  const elapsedMs = Number.isFinite(createdMs) ? Math.max(0, now.getTime() - createdMs) : 0;
  const ageWeek = Math.min(totalWeeks, Math.floor(elapsedMs / WEEK_MS) + 1);

  const completed = new Set((input.completedModuleTitles ?? []).map(moduleKey));
  let sessionWeek = 1;
  plan.forEach((week, index) => {
    if (week.moduleTitle && completed.has(moduleKey(week.moduleTitle))) {
      sessionWeek = Math.max(sessionWeek, Math.min(totalWeeks, index + 2));
    }
  });

  return Math.max(ageWeek, sessionWeek);
}

export type PlanWeekState = {
  /** 1-based plan position (matches the plan's own week numbering). */
  week: number;
  focus: string;
  moduleTitle: string | null;
  /** True when this week's module tutor session has been completed. */
  completed: boolean;
  isCurrent: boolean;
};

export type PlanProgress = {
  plan: ThirtyDayPlanWeek[];
  totalWeeks: number;
  currentWeek: number;
  currentEntry: ThirtyDayPlanWeek;
  /** The current week's module (exact catalog string) — null on pre-spine plans. */
  moduleTitle: string | null;
  weeks: PlanWeekState[];
  /** createdAt of the ORIGINAL report row for the active assessment. */
  planCreatedAt: string;
  report: Pick<AssessmentReportRecord, "anonymousAssessmentId" | "createdAt" | "report">;
};

/**
 * Pure progress derivation from an append-only report history (oldest first).
 * Daily re-scoring appends fresh rows that copy the plan forward, so the week
 * anchor is the EARLIEST row of the latest row's assessment — a rescore never
 * resets the learner to week 1, while a genuine retake (new assessment id)
 * starts a new 30-day clock.
 */
export function computePlanProgress(input: {
  history: Array<Pick<AssessmentReportRecord, "anonymousAssessmentId" | "createdAt" | "report">>;
  completedModuleTitles: string[];
  now?: Date;
}): PlanProgress | null {
  const history = input.history;
  if (!history.length) return null;

  const latest = history[history.length - 1];
  const plan = sortedPlan(latest.report?.thirtyDayPlan ?? []);
  if (!plan.length) return null;

  const anchor =
    history.find((entry) => entry.anonymousAssessmentId === latest.anonymousAssessmentId) ?? latest;

  const currentWeek = computeCurrentPlanWeek({
    plan,
    planCreatedAt: anchor.createdAt,
    now: input.now,
    completedModuleTitles: input.completedModuleTitles,
  });

  const completed = new Set(input.completedModuleTitles.map(moduleKey));
  const weeks: PlanWeekState[] = plan.map((week, index) => ({
    week: index + 1,
    focus: week.focus,
    moduleTitle: week.moduleTitle ?? null,
    completed: Boolean(week.moduleTitle && completed.has(moduleKey(week.moduleTitle))),
    isCurrent: index + 1 === currentWeek,
  }));

  const currentEntry = plan[currentWeek - 1];
  return {
    plan,
    totalWeeks: plan.length,
    currentWeek,
    currentEntry,
    moduleTitle: currentEntry.moduleTitle ?? null,
    weeks,
    planCreatedAt: anchor.createdAt,
    report: latest,
  };
}

/**
 * Live plan progress for a signed-in learner. Null when there is no linked
 * report or the report has no plan — callers keep pre-spine behavior.
 */
export async function getPlanProgressForProfile(
  learnerProfileId: string,
  now?: Date,
): Promise<PlanProgress | null> {
  const history = await listAssessmentReportsForProfile(learnerProfileId);
  if (!history.length) return null;

  const completedModuleTitles = await listCompletedTutorSessionModuleTitles(learnerProfileId).catch(
    () => [] as string[],
  );
  return computePlanProgress({ history, completedModuleTitles, now });
}

/**
 * The current plan week's module title for a learner — the plan-aware "active
 * module". Null (never a throw) when there is no report / no plan module, so
 * callers can fall back to the career path's first module.
 */
export async function getCurrentPlanModuleTitleForProfile(
  learnerProfileId: string,
  now?: Date,
): Promise<string | null> {
  try {
    const progress = await getPlanProgressForProfile(learnerProfileId, now);
    return progress?.moduleTitle ?? null;
  } catch {
    return null;
  }
}

/**
 * Plan-ordered module titles from the learner's latest report ([] when there
 * is no report or the plan has no modules). Used to order
 * moduleRecommendations by the plan sequence (spine phase 2). Never throws.
 */
export async function getPlanModuleTitlesForProfile(learnerProfileId: string): Promise<string[]> {
  try {
    const record = await getLatestAssessmentReportForProfile(learnerProfileId);
    const plan = sortedPlan(record?.report?.thirtyDayPlan ?? []);
    return plan
      .map((week) => week.moduleTitle?.trim())
      .filter((title): title is string => Boolean(title));
  } catch {
    return [];
  }
}

// --- starter project seed (spine phase 2) ---------------------------------------

/**
 * Starter project title/description. With a linked report the seed comes from
 * plan week 1's focus + the report's top gap; without one it is byte-for-byte
 * the pre-spine generic starter copy.
 */
export function buildStarterProjectSeed(input: {
  careerPathName: string | null;
  report: Pick<AssessmentReport, "thirtyDayPlan" | "gaps"> | null;
}): { title: string; description: string } {
  const weekOne = input.report ? sortedPlan(input.report.thirtyDayPlan ?? [])[0] : undefined;

  if (!weekOne) {
    return input.careerPathName
      ? {
          title: `${input.careerPathName} Starter Build`,
          description: `Starter project generated from your ${input.careerPathName} path to begin collecting proof artifacts.`,
        }
      : {
          title: "AI Starter Build",
          description: "Starter project generated from onboarding to begin collecting proof artifacts.",
        };
  }

  const topGap = input.report?.gaps?.[0] ?? null;
  const focus = weekOne.focus.trim();
  const descriptionParts = [
    `Week 1 of your 30-day plan: ${focus}.`,
    topGap ? `This build attacks your top gap — ${topGap.title}.` : null,
    weekOne.moduleTitle
      ? `Run the ${weekOne.moduleTitle} module and collect proof artifacts as you go.`
      : "Collect proof artifacts as you go.",
  ].filter(Boolean);

  return {
    title: `Week 1: ${focus}`.slice(0, 140),
    description: descriptionParts.join(" "),
  };
}

/** Async wrapper for the starter seed: personalized only when a linked report exists. */
export async function getStarterProjectSeedForProfile(input: {
  learnerProfileId: string;
  careerPathName: string | null;
}): Promise<{ title: string; description: string }> {
  const record = await getLatestAssessmentReportForProfile(input.learnerProfileId).catch(() => null);
  return buildStarterProjectSeed({
    careerPathName: input.careerPathName,
    report: record?.report ?? null,
  });
}

// --- dashboard "This week's focus" card (spine phase 3) --------------------------

export type WeeklyFocusCardData = {
  currentWeek: number;
  totalWeeks: number;
  focus: string;
  actions: string[];
  moduleTitle: string | null;
  weeks: Array<{ week: number; completed: boolean; isCurrent: boolean }>;
};

/** Read model for the dashboard home card. Null without a linked plan. */
export async function getWeeklyFocusCard(
  learnerProfileId: string,
  now?: Date,
): Promise<WeeklyFocusCardData | null> {
  const progress = await getPlanProgressForProfile(learnerProfileId, now);
  if (!progress) return null;

  return {
    currentWeek: progress.currentWeek,
    totalWeeks: progress.totalWeeks,
    focus: progress.currentEntry.focus,
    actions: progress.currentEntry.actions,
    moduleTitle: progress.moduleTitle,
    weeks: progress.weeks.map((week) => ({
      week: week.week,
      completed: week.completed,
      isCurrent: week.isCurrent,
    })),
  };
}
