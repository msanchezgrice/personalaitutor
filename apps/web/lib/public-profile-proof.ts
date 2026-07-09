import "server-only";

import {
  artifactCountsAsBuiltEvidence,
  buildDashboardGamification,
  canMarkProjectBuilt,
  canMarkSkillVerified,
  effectiveCurrentStreak,
  getDashboardSummary as memGetDashboardSummary,
  type DashboardGamification,
  type Project,
  type ProjectArtifact,
  type StreakState,
  type UserProfile,
} from "@aitutor/shared";
import type { AssessmentReportRecord } from "@/lib/anonymous-assessment";
import { listAssessmentReportsForProfile } from "@/lib/anonymous-assessment";
import { computePlanProgress } from "@/lib/plan-progress";
import {
  countTutorSessionMilestones,
  listCompletedTutorSessionModuleTitles,
  type TutorSessionMilestones,
} from "@/lib/tutor-session";
import { getStreak } from "@/lib/daily-action";
import { todayBriefingDate } from "@/lib/daily-briefing-store";
import { collectGamificationActivitySignalsSafe } from "@/lib/gamification-signals";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Public-profile proof assembly (rebuild: employer-facing trust surface).
 *
 * The public page at /u/[handle] is the product's proof-of-work claim, so
 * every number here derives from real tables:
 * - readiness score + delta ......... assessment_report_history (append-only)
 * - 30-day-plan progress ............ plan-progress.ts over the same history
 * - verified/built skills ........... user_skill_evidence RE-GATED at read
 *                                     time through verification-gating.ts
 * - artifacts ....................... project_artifacts, only entries with
 *                                     persisted generated content (contentId)
 *                                     or user-submitted proof — placeholder-era
 *                                     artifacts never render
 * - build activity .................. module_tutor_sessions (completed only)
 * - streak .......................... learner_streaks
 * - XP level ........................ the same buildDashboardGamification model
 *                                     the dashboard shows
 *
 * Absent data hides a section (null / []) — nothing is ever fabricated.
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

// --- public read-model types --------------------------------------------------

export type PublicReadiness = {
  /** Latest 0-100 readiness score from assessment_report_history. */
  score: number;
  /** The very first score on record — the baseline the delta is measured from. */
  firstScore: number;
  /** Latest minus first; null when only one entry exists (baseline). */
  delta: number | null;
  headline: string;
  updatedAt: string | null;
};

export type PublicPlanProgress = {
  currentWeek: number;
  totalWeeks: number;
  focus: string;
  moduleTitle: string | null;
  weeks: Array<{ week: number; completed: boolean; isCurrent: boolean }>;
};

export type PublicSkill = {
  skill: string;
  status: "verified" | "built";
  evidenceCount: number;
};

export type PublicArtifactLink = {
  kind: string;
  label: string;
  url: string;
  projectTitle: string;
  projectSlug: string;
  createdAt: string;
  source: "generated" | "proof";
};

export type PublicBuildActivity = {
  sessionsStarted: number;
  sessionsCompleted: number;
  completedModules: string[];
};

export type PublicStreak = { current: number; longest: number };

export type PublicLevel = {
  level: number;
  label: string;
  subtitle: string;
  xpTotal: number;
};

export type PublicProfileProof = {
  readiness: PublicReadiness | null;
  plan: PublicPlanProgress | null;
  skills: PublicSkill[];
  artifacts: PublicArtifactLink[];
  activity: PublicBuildActivity | null;
  streak: PublicStreak | null;
  level: PublicLevel | null;
};

export type ProofHistoryEntry = Pick<
  AssessmentReportRecord,
  "anonymousAssessmentId" | "createdAt" | "readinessScore" | "report"
>;

// --- pure derivations ----------------------------------------------------------

export function derivePublicReadiness(history: ProofHistoryEntry[]): PublicReadiness | null {
  if (!history.length) return null;
  const first = history[0];
  const latest = history[history.length - 1];
  return {
    score: latest.readinessScore,
    firstScore: first.readinessScore,
    delta: history.length > 1 ? latest.readinessScore - first.readinessScore : null,
    headline: latest.report.headline,
    updatedAt: latest.createdAt ?? null,
  };
}

const STATUS_RANK: Record<PublicSkill["status"], number> = { verified: 1, built: 0 };

/**
 * Re-gates stored skill statuses through verification-gating at read time.
 * Legacy rows awarded by the pre-rebuild auto-award paths can claim
 * built/verified without evidence — the public page never repeats that claim:
 * - verified requires a completed tutor-session checklist AND built evidence,
 * - built requires a real generated artifact or submitted proof,
 * - anything unbacked (and every in_progress skill) is hidden.
 */
export function gatePublicSkills(
  skills: UserProfile["skills"],
  input: { artifacts: ProjectArtifact[]; checklistComplete: boolean },
): PublicSkill[] {
  const builtOk = canMarkProjectBuilt(input.artifacts);
  const verifiedOk = canMarkSkillVerified({
    checklistComplete: input.checklistComplete,
    artifacts: input.artifacts,
  });

  const gated: PublicSkill[] = [];
  for (const entry of skills) {
    if (entry.status !== "verified" && entry.status !== "built") continue;
    if (entry.status === "verified" && verifiedOk) {
      gated.push({ skill: entry.skill, status: "verified", evidenceCount: entry.evidenceCount });
      continue;
    }
    if (builtOk) {
      gated.push({ skill: entry.skill, status: "built", evidenceCount: entry.evidenceCount });
    }
  }

  return gated.sort(
    (a, b) =>
      STATUS_RANK[b.status] - STATUS_RANK[a.status] ||
      b.evidenceCount - a.evidenceCount ||
      a.skill.localeCompare(b.skill),
  );
}

export function artifactKindLabel(kind: string): string {
  switch (kind) {
    case "website":
      return "Website";
    case "pptx":
      return "Presentation";
    case "pdf":
      return "Project Brief";
    case "resume_docx":
      return "Resume (DOCX)";
    case "resume_pdf":
      return "Resume (PDF)";
    case "proof_link":
      return "Proof Link";
    case "proof_upload":
      return "Uploaded Proof";
    default:
      return "Artifact";
  }
}

/**
 * Flattens a profile's projects into publicly-linkable artifacts. Only
 * artifacts that pass `artifactCountsAsBuiltEvidence` qualify: generated
 * artifacts with persisted content (their /generated URL renders) or
 * user-submitted proof. Placeholder-era artifact rows are dropped.
 */
export function collectPublicArtifacts(projects: Project[]): PublicArtifactLink[] {
  const links: PublicArtifactLink[] = [];
  for (const project of projects) {
    for (const artifact of project.artifacts) {
      if (!artifactCountsAsBuiltEvidence(artifact)) continue;
      const metadata = artifact.metadata ?? {};
      const source = metadata.source === "generated_artifact" ? "generated" : "proof";
      const metadataLabel = typeof metadata.label === "string" ? metadata.label.trim() : "";
      links.push({
        kind: String(artifact.kind),
        label: metadataLabel || artifactKindLabel(String(artifact.kind)),
        url: artifact.url,
        projectTitle: project.title,
        projectSlug: project.slug,
        createdAt: artifact.createdAt,
        source,
      });
    }
  }
  return links.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

/** True when this artifact may appear on the public proof surface. */
export function isPublicArtifact(artifact: ProjectArtifact): boolean {
  return artifactCountsAsBuiltEvidence(artifact);
}

// --- assembly --------------------------------------------------------------------

export function assemblePublicProfileProof(input: {
  profile: UserProfile;
  projects: Project[];
  history: ProofHistoryEntry[];
  completedModuleTitles: string[];
  milestones: TutorSessionMilestones;
  streak: StreakState | null;
  gamification: DashboardGamification | null;
  now?: Date;
}): PublicProfileProof {
  const now = input.now ?? new Date();

  const planProgress = computePlanProgress({
    history: input.history,
    completedModuleTitles: input.completedModuleTitles,
    now,
  });

  const allArtifacts = input.projects.flatMap((project) => project.artifacts);
  const skills = gatePublicSkills(input.profile.skills, {
    artifacts: allArtifacts,
    checklistComplete: input.milestones.completed > 0,
  });

  const streakCurrent = input.streak ? effectiveCurrentStreak(input.streak, todayBriefingDate(now)) : 0;
  const streakLongest = input.streak?.longestStreak ?? 0;

  return {
    readiness: derivePublicReadiness(input.history),
    plan: planProgress
      ? {
          currentWeek: planProgress.currentWeek,
          totalWeeks: planProgress.totalWeeks,
          focus: planProgress.currentEntry.focus,
          moduleTitle: planProgress.moduleTitle,
          weeks: planProgress.weeks.map((week) => ({
            week: week.week,
            completed: week.completed,
            isCurrent: week.isCurrent,
          })),
        }
      : null,
    skills,
    artifacts: collectPublicArtifacts(input.projects),
    activity:
      input.milestones.completed > 0
        ? {
            sessionsStarted: input.milestones.started,
            sessionsCompleted: input.milestones.completed,
            completedModules: input.completedModuleTitles,
          }
        : null,
    streak: streakCurrent > 0 || streakLongest > 0 ? { current: streakCurrent, longest: streakLongest } : null,
    level: input.gamification
      ? {
          level: input.gamification.level,
          label: input.gamification.levelLabel,
          subtitle: input.gamification.levelSubtitle,
          xpTotal: input.gamification.xpTotal,
        }
      : null,
  };
}

// --- gamification (read-only, dashboard-consistent) --------------------------------

/**
 * Read-only mirror of the gamification assembly inside
 * `runtimeGetDashboardSummary` (runtime.ts) so the public level matches the
 * dashboard level. Unlike the dashboard path this NEVER writes (no profile
 * creation, no starter-project seeding) — a public page load must not mutate
 * state. Keep the query shapes in sync with runtime.ts.
 */
async function getPublicGamification(
  profile: UserProfile,
  projects: Project[],
  now: Date,
): Promise<DashboardGamification | null> {
  try {
    const activity = await collectGamificationActivitySignalsSafe(profile.id, now);

    if (mode() === "memory") {
      return memGetDashboardSummary(profile.id, activity, [])?.gamification ?? null;
    }

    const supabase = getSupabaseAdminClient();
    const [{ data: events }, { data: onboarding }, { data: latestAssessment }, { data: socialDrafts }] =
      await Promise.all([
        supabase
          .from("agent_job_events")
          .select("id,job_id,learner_profile_id,project_id,event_type,message,created_at,payload")
          .eq("learner_profile_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("onboarding_sessions")
          .select("id,created_at")
          .eq("learner_profile_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("assessment_attempts")
          .select("id,started_at,submitted_at,updated_at")
          .eq("learner_profile_id", profile.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("social_drafts")
          .select("id,status,created_at,updated_at")
          .eq("learner_profile_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(30),
      ]);

    const latestEvents = (events ?? [])
      .filter((event) => {
        const message = String(event.message ?? "").toLowerCase();
        const eventType = String(event.event_type ?? "").toLowerCase();
        const payload =
          event.payload && typeof event.payload === "object" ? (event.payload as Record<string, unknown>) : {};
        const reason = String(payload.reason ?? "").toLowerCase();
        if (reason === "scheduler_refresh_slot") return false;
        if (message.includes("memory.refresh")) return false;
        if (eventType.includes("scheduler")) return false;
        return true;
      })
      .map((event) => ({
        id: event.id,
        jobId: event.job_id,
        userId: event.learner_profile_id,
        projectId: event.project_id,
        type: event.event_type,
        message: event.message,
        createdAt: event.created_at,
        payload: event.payload ?? {},
      }));

    const socialRows = Array.isArray(socialDrafts) ? socialDrafts : [];
    const firstSocialDraft = socialRows
      .slice()
      .sort((a, b) => Date.parse(String(a.created_at)) - Date.parse(String(b.created_at)))[0];
    const firstPublishedSocialDraft = socialRows
      .filter((row) => String(row.status || "").toLowerCase() === "published")
      .sort(
        (a, b) =>
          Date.parse(String(a.updated_at || a.created_at)) - Date.parse(String(b.updated_at || b.created_at)),
      )[0];

    return buildDashboardGamification({
      user: profile,
      projects,
      latestEvents,
      hasOnboardingSession: Boolean(onboarding?.id),
      onboardingStartedAt: onboarding?.created_at ?? null,
      hasCompletedAssessment: Boolean(latestAssessment?.submitted_at),
      assessmentSubmittedAt: latestAssessment?.submitted_at ?? null,
      hasSocialDraft: socialRows.length > 0,
      socialDraftCreatedAt: firstSocialDraft?.created_at ?? null,
      hasPublishedSocialDraft: Boolean(firstPublishedSocialDraft?.id),
      socialDraftPublishedAt:
        firstPublishedSocialDraft?.updated_at ?? firstPublishedSocialDraft?.created_at ?? null,
      activity,
    });
  } catch (error) {
    console.warn(
      "[public-profile] gamification assembly failed",
      error instanceof Error ? error.message : "unknown",
    );
    return null;
  }
}

/**
 * Live proof assembly for a (published or owner-previewed) profile. Every
 * source is failure-isolated: a broken store hides its section instead of
 * taking down the public page or fabricating data.
 */
export async function getPublicProfileProof(
  profile: UserProfile,
  projects: Project[],
  now: Date = new Date(),
): Promise<PublicProfileProof> {
  const [history, completedModuleTitles, milestones, streak, gamification] = await Promise.all([
    listAssessmentReportsForProfile(profile.id).catch(() => [] as AssessmentReportRecord[]),
    listCompletedTutorSessionModuleTitles(profile.id).catch(() => [] as string[]),
    countTutorSessionMilestones(profile.id).catch(
      () => ({ started: 0, completed: 0, firstCompletedAt: null }) as TutorSessionMilestones,
    ),
    getStreak(profile.id).catch(() => null),
    getPublicGamification(profile, projects, now),
  ]);

  return assemblePublicProfileProof({
    profile,
    projects,
    history,
    completedModuleTitles,
    milestones,
    streak,
    gamification,
    now,
  });
}
