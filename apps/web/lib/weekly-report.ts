import "server-only";

import {
  buildWeeklyReportEmail,
  deriveScoreTrend,
  effectiveCurrentStreak,
  weeklyReportCampaignKey,
  type WeeklyReportContext,
} from "@aitutor/shared";
import { listAssessmentReportsForProfile, getLatestAssessmentReportForProfile } from "@/lib/anonymous-assessment";
import {
  listActiveSubscribers,
  recordCampaignDelivery,
  sendCampaignEmail,
  sentCampaignKeysForUser,
  type ActiveSubscriber,
  type SendEmailResult,
} from "@/lib/campaign-email";
import { getStreak, listCompletedDailyActionsSince } from "@/lib/daily-action";
import { resolveBriefingPathId } from "@/lib/daily-briefing";
import { listDailyBriefingsSince, todayBriefingDate } from "@/lib/daily-briefing-store";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getSiteUrl } from "@/lib/site";

/**
 * Weekly proof-of-watch email sweep (rebuild Phase 3.4).
 *
 * Runs from the scheduler (cron GET /api/scheduler/weekly-report). For every
 * ACTIVE subscriber the context is computed AT SEND TIME from live tables
 * (report history, tutor sessions, artifacts, streaks, briefings) — a month-2
 * email necessarily differs from a day-0 email. Idempotency: one send per
 * learner per ISO week via the `learner_email_deliveries` campaign ledger.
 */

export type WeeklyReportCandidate = ActiveSubscriber;

export type WeeklySweepDeps = {
  listActiveSubscribers: (limit: number) => Promise<WeeklyReportCandidate[]>;
  sentCampaignKeys: (learnerProfileId: string) => Promise<string[]>;
  computeContext: (candidate: WeeklyReportCandidate, now: Date) => Promise<WeeklyReportContext>;
  sendEmail: (input: { to: string; subject: string; html: string; text: string }) => Promise<SendEmailResult>;
  recordDelivery: (input: {
    learnerProfileId: string;
    externalUserId?: string | null;
    campaignKey: string;
    status: "sent" | "failed";
    recipientEmail: string;
    subject: string;
    providerMessageId?: string | null;
    emailSource: string;
    payload?: Record<string, unknown>;
    sentAt?: string | null;
  }) => Promise<void>;
};

function weekStartIso(now: Date): string {
  return new Date(now.getTime() - 7 * 86_400_000).toISOString();
}

function weekStartDate(now: Date): string {
  return todayBriefingDate(new Date(now.getTime() - 7 * 86_400_000));
}

// --- real data collectors (supabase) --------------------------------------------

/** Live-data context computation — everything is queried at send time. */
export async function computeWeeklyReportContext(
  candidate: WeeklyReportCandidate,
  now: Date,
): Promise<WeeklyReportContext> {
  const supabase = getSupabaseAdminClient();
  const sinceIso = weekStartIso(now);
  const sinceDate = weekStartDate(now);
  const baseUrl = getSiteUrl();

  const [history, latestReport, streak, completedActions] = await Promise.all([
    listAssessmentReportsForProfile(candidate.learnerProfileId),
    getLatestAssessmentReportForProfile(candidate.learnerProfileId),
    getStreak(candidate.learnerProfileId),
    listCompletedDailyActionsSince({ learnerProfileId: candidate.learnerProfileId, sinceDate }),
  ]);

  const [{ data: sessionRows }, { data: artifactRows }] = await Promise.all([
    supabase
      .from("module_tutor_sessions")
      .select("module_title,completed_at")
      .eq("learner_profile_id", candidate.learnerProfileId)
      .eq("status", "completed")
      .gte("completed_at", sinceIso),
    supabase
      .from("project_artifact_contents")
      .select("kind,content_kind,artifact_url,created_at")
      .eq("learner_profile_id", candidate.learnerProfileId)
      .gte("created_at", sinceIso),
  ]);

  const gapsClosed = ((sessionRows ?? []) as Array<{ module_title: string }>).map((row) => row.module_title);
  const artifactsGenerated = ((artifactRows ?? []) as Array<{ content_kind: string; artifact_url: string }>).map(
    (row) => ({
      title: `Generated ${row.content_kind}`,
      url: row.artifact_url,
    }),
  );

  const careerPathId = resolveBriefingPathId([
    candidate.careerPathId,
    latestReport?.report.recommendedPath?.careerPathId,
  ]);
  const briefingsThisWeek = await listDailyBriefingsSince({ careerPathId, sinceDate });
  const topBriefing = briefingsThisWeek[0]?.briefing ?? null;
  const landscapeChange = topBriefing?.topStory
    ? {
        headline: topBriefing.topStory.headline,
        url: topBriefing.topStory.url,
        source: topBriefing.topStory.source,
        summary: topBriefing.topStory.summary || null,
      }
    : null;

  const closedTitles = new Set(gapsClosed.map((title) => title.toLowerCase()));
  const topOpenGap = latestReport?.report.gaps.find((gap) => !closedTitles.has(gap.title.toLowerCase())) ?? null;
  const nextStep = topOpenGap
    ? `Close "${topOpenGap.title}" — start its tutor session and finish with a generated artifact.`
    : "Pick the next module in your path and run its tutor session to keep the score climbing.";

  return {
    baseUrl,
    learnerName: candidate.name,
    careerPathName: topBriefing?.careerPathName ?? null,
    scoreTrend: deriveScoreTrend(
      history.map((entry) => ({ readinessScore: entry.readinessScore, createdAt: entry.createdAt })),
      now,
    ),
    gapsClosed: gapsClosed.length ? gapsClosed : completedActions.map((action) => action.gapRef),
    artifactsGenerated,
    streak: {
      current: effectiveCurrentStreak(streak, todayBriefingDate(now)),
      longest: streak.longestStreak,
    },
    landscapeChange,
    nextStep,
    dashboardUrl: `${baseUrl.replace(/\/+$/, "")}/dashboard/`,
  };
}

const DEFAULT_DEPS: WeeklySweepDeps = {
  listActiveSubscribers,
  sentCampaignKeys: sentCampaignKeysForUser,
  computeContext: computeWeeklyReportContext,
  sendEmail: sendCampaignEmail,
  recordDelivery: recordCampaignDelivery,
};

export type WeeklySweepResult = {
  campaignKey: string;
  sent: number;
  skipped: number;
  failed: Array<{ learnerProfileId: string; error: string }>;
};

export async function sendWeeklyReportsDue(options: {
  now?: Date;
  limit?: number;
  deps?: Partial<WeeklySweepDeps>;
} = {}): Promise<WeeklySweepResult> {
  const now = options.now ?? new Date();
  const limit = options.limit ?? 200;
  const deps: WeeklySweepDeps = { ...DEFAULT_DEPS, ...(options.deps ?? {}) };
  const campaignKey = weeklyReportCampaignKey(now);

  const candidates = await deps.listActiveSubscribers(limit);
  let sent = 0;
  let skipped = 0;
  const failed: WeeklySweepResult["failed"] = [];

  for (const candidate of candidates) {
    try {
      const sentKeys = await deps.sentCampaignKeys(candidate.learnerProfileId);
      if (sentKeys.includes(campaignKey)) {
        skipped += 1;
        continue;
      }

      // Computed AT SEND TIME — never frozen at trigger creation.
      const context = await deps.computeContext(candidate, now);
      const email = buildWeeklyReportEmail(context, now);

      const delivered = await deps.sendEmail({
        to: candidate.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });

      await deps.recordDelivery({
        learnerProfileId: candidate.learnerProfileId,
        externalUserId: candidate.externalUserId,
        campaignKey,
        status: delivered.ok ? "sent" : "failed",
        recipientEmail: candidate.email,
        subject: email.subject,
        providerMessageId: delivered.ok ? delivered.messageId : null,
        emailSource: "weekly_report",
        payload: delivered.ok
          ? { previewText: email.previewText }
          : { errorCode: delivered.errorCode },
        sentAt: delivered.ok ? new Date().toISOString() : null,
      });

      if (delivered.ok) {
        sent += 1;
      } else {
        failed.push({ learnerProfileId: candidate.learnerProfileId, error: delivered.errorCode });
      }
    } catch (error) {
      failed.push({
        learnerProfileId: candidate.learnerProfileId,
        error: error instanceof Error ? error.message.slice(0, 160) : "WEEKLY_REPORT_FAILED",
      });
    }
  }

  return { campaignKey, sent, skipped, failed };
}
