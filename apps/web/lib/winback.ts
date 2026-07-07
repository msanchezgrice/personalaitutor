import "server-only";

import {
  buildWinbackEmail,
  resolveWinbackKey,
  type WinbackKey,
} from "@aitutor/shared";
import { getLatestAssessmentReportForProfile } from "@/lib/anonymous-assessment";
import {
  recordCampaignDelivery,
  sendCampaignEmail,
  sentCampaignKeysForUser,
  type SendEmailResult,
} from "@/lib/campaign-email";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getSiteUrl } from "@/lib/site";

/**
 * Inactivity winback sweep (rebuild Phase 3.5): 7/14/30-day emails anchored
 * to the learner's report ("your gap plan has N unfinished steps"). Runs from
 * the scheduler (cron GET /api/scheduler/winback) daily; idempotent via the
 * `learner_email_deliveries` campaign ledger (one send per key per learner).
 *
 * "Last active" = the learner's most recent product action we track:
 * latest completed daily action, else latest tutor-session touch, else
 * profile creation. Deliberately NOT `learner_profiles.updated_at`, which is
 * bumped by system processes.
 */

export type WinbackCandidate = {
  learnerProfileId: string;
  externalUserId: string | null;
  name: string;
  email: string;
  careerPathName: string | null;
  lastActiveAt: string | null;
};

export type WinbackAnchor = {
  readinessScore: number | null;
  unfinishedGapCount: number;
  topGapTitle: string | null;
};

export type WinbackSweepDeps = {
  listCandidates: (limit: number) => Promise<WinbackCandidate[]>;
  sentCampaignKeys: (learnerProfileId: string) => Promise<string[]>;
  loadAnchor: (learnerProfileId: string) => Promise<WinbackAnchor>;
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

// --- real data collectors (supabase) --------------------------------------------

async function listCandidatesFromDb(limit: number): Promise<WinbackCandidate[]> {
  const supabase = getSupabaseAdminClient();
  const { data: profiles } = await supabase
    .from("learner_profiles")
    .select("id,external_user_id,full_name,contact_email,career_path_id,created_at")
    .not("contact_email", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  const rows = (profiles ?? []) as Array<{
    id: string;
    external_user_id: string | null;
    full_name: string | null;
    contact_email: string | null;
    career_path_id: string | null;
    created_at: string;
  }>;
  if (!rows.length) return [];

  const profileIds = rows.map((row) => row.id);
  const [{ data: actionRows }, { data: sessionRows }] = await Promise.all([
    supabase
      .from("daily_actions")
      .select("learner_profile_id,completed_at")
      .in("learner_profile_id", profileIds)
      .eq("status", "completed")
      .order("completed_at", { ascending: false }),
    supabase
      .from("module_tutor_sessions")
      .select("learner_profile_id,updated_at")
      .in("learner_profile_id", profileIds)
      .order("updated_at", { ascending: false }),
  ]);

  const lastActionByProfile = new Map<string, string>();
  for (const row of (actionRows ?? []) as Array<{ learner_profile_id: string; completed_at: string | null }>) {
    if (row.completed_at && !lastActionByProfile.has(row.learner_profile_id)) {
      lastActionByProfile.set(row.learner_profile_id, row.completed_at);
    }
  }
  const lastSessionByProfile = new Map<string, string>();
  for (const row of (sessionRows ?? []) as Array<{ learner_profile_id: string; updated_at: string | null }>) {
    if (row.updated_at && !lastSessionByProfile.has(row.learner_profile_id)) {
      lastSessionByProfile.set(row.learner_profile_id, row.updated_at);
    }
  }

  return rows
    .filter((row) => Boolean(row.contact_email?.trim()))
    .map((row) => {
      const timestamps = [
        lastActionByProfile.get(row.id),
        lastSessionByProfile.get(row.id),
        row.created_at,
      ].filter((value): value is string => Boolean(value));
      const lastActiveAt = timestamps.sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
      return {
        learnerProfileId: row.id,
        externalUserId: row.external_user_id,
        name: row.full_name?.trim() || "there",
        email: row.contact_email!.trim(),
        careerPathName: row.career_path_id,
        lastActiveAt,
      };
    });
}

async function loadAnchorFromDb(learnerProfileId: string): Promise<WinbackAnchor> {
  const latestReport = await getLatestAssessmentReportForProfile(learnerProfileId);
  if (!latestReport) {
    return { readinessScore: null, unfinishedGapCount: 0, topGapTitle: null };
  }

  const supabase = getSupabaseAdminClient();
  const { data: completedSessions } = await supabase
    .from("module_tutor_sessions")
    .select("module_title")
    .eq("learner_profile_id", learnerProfileId)
    .eq("status", "completed");

  const closed = new Set(
    ((completedSessions ?? []) as Array<{ module_title: string }>).map((row) => row.module_title.toLowerCase()),
  );
  const openGaps = latestReport.report.gaps.filter((gap) => !closed.has(gap.title.toLowerCase()));

  return {
    readinessScore: latestReport.readinessScore,
    unfinishedGapCount: openGaps.length,
    topGapTitle: openGaps[0]?.title ?? null,
  };
}

const DEFAULT_DEPS: WinbackSweepDeps = {
  listCandidates: listCandidatesFromDb,
  sentCampaignKeys: sentCampaignKeysForUser,
  loadAnchor: loadAnchorFromDb,
  sendEmail: sendCampaignEmail,
  recordDelivery: recordCampaignDelivery,
};

export type WinbackSweepResult = {
  sent: number;
  skipped: number;
  failed: Array<{ learnerProfileId: string; error: string }>;
  sentKeysByUser: Array<{ learnerProfileId: string; key: WinbackKey }>;
};

export async function sendWinbacksDue(options: {
  now?: Date;
  limit?: number;
  deps?: Partial<WinbackSweepDeps>;
} = {}): Promise<WinbackSweepResult> {
  const now = options.now ?? new Date();
  const limit = options.limit ?? 300;
  const deps: WinbackSweepDeps = { ...DEFAULT_DEPS, ...(options.deps ?? {}) };

  const candidates = await deps.listCandidates(limit);
  let sent = 0;
  let skipped = 0;
  const failed: WinbackSweepResult["failed"] = [];
  const sentKeysByUser: WinbackSweepResult["sentKeysByUser"] = [];

  for (const candidate of candidates) {
    try {
      const sentKeys = await deps.sentCampaignKeys(candidate.learnerProfileId);
      const key = resolveWinbackKey({
        lastActiveAt: candidate.lastActiveAt,
        sentKeys,
        nowIso: now.toISOString(),
      });
      if (!key) {
        skipped += 1;
        continue;
      }

      const anchor = await deps.loadAnchor(candidate.learnerProfileId);
      const email = buildWinbackEmail({
        key,
        baseUrl: getSiteUrl(),
        learnerName: candidate.name,
        careerPathName: candidate.careerPathName,
        readinessScore: anchor.readinessScore,
        unfinishedGapCount: anchor.unfinishedGapCount,
        topGapTitle: anchor.topGapTitle,
      });

      const delivered = await deps.sendEmail({
        to: candidate.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });

      await deps.recordDelivery({
        learnerProfileId: candidate.learnerProfileId,
        externalUserId: candidate.externalUserId,
        campaignKey: key,
        status: delivered.ok ? "sent" : "failed",
        recipientEmail: candidate.email,
        subject: email.subject,
        providerMessageId: delivered.ok ? delivered.messageId : null,
        emailSource: "winback",
        payload: delivered.ok ? { previewText: email.previewText } : { errorCode: delivered.errorCode },
        sentAt: delivered.ok ? new Date().toISOString() : null,
      });

      if (delivered.ok) {
        sent += 1;
        sentKeysByUser.push({ learnerProfileId: candidate.learnerProfileId, key });
      } else {
        failed.push({ learnerProfileId: candidate.learnerProfileId, error: delivered.errorCode });
      }
    } catch (error) {
      failed.push({
        learnerProfileId: candidate.learnerProfileId,
        error: error instanceof Error ? error.message.slice(0, 160) : "WINBACK_FAILED",
      });
    }
  }

  return { sent, skipped, failed, sentKeysByUser };
}
