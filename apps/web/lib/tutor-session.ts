import "server-only";

import { randomUUID } from "node:crypto";
import type { RecommendedModuleGuide } from "@aitutor/shared";
import { callOpenAiResponses } from "@/lib/openai-responses";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Checkpointed tutor sessions per module (Phase 2.2 of the rebuild).
 *
 * The tutor walks the learner through the module playbook step-by-step.
 * Per-step and proof-checklist completion is tracked server-side and is
 * resumable; completing the session is what unlocks the `verified` gate
 * (Phase 2.3) once the project also has real built evidence.
 *
 * Follows the repo's memory/supabase dual-mode convention (see
 * `anonymous-assessment.ts`).
 *
 * Table: `module_tutor_sessions`
 * (migration `supabase/migrations/20260707191000_add_module_tutor_sessions.sql`).
 */

export type TutorSessionStep = {
  index: number;
  title: string;
  whyThisStep: string;
  status: "pending" | "completed";
  completedAt: string | null;
  evidenceNote: string | null;
};

export type TutorSessionChecklistItem = {
  index: number;
  label: string;
  done: boolean;
  evidence: string | null;
  completedAt: string | null;
};

export type TutorSessionRecord = {
  id: string;
  projectId: string;
  learnerProfileId: string;
  careerPathId: string;
  moduleTitle: string;
  status: "active" | "completed";
  currentStepIndex: number;
  steps: TutorSessionStep[];
  checklist: TutorSessionChecklistItem[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type TutorSessionCompletionResult =
  | { ok: true; session: TutorSessionRecord }
  | { ok: false; errorCode: "TUTOR_SESSION_INCOMPLETE"; pendingSteps: number; pendingChecklist: number };

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

// --- memory mode -------------------------------------------------------------

const memorySessions = new Map<string, TutorSessionRecord>();

export function resetTutorSessionStateForTests() {
  memorySessions.clear();
}

// --- supabase row mapping ------------------------------------------------------

type TutorSessionRow = {
  id: string;
  project_id: string;
  learner_profile_id: string;
  career_path_id: string;
  module_title: string;
  status: string;
  current_step_index: number;
  steps: unknown;
  checklist: unknown;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

const SESSION_SELECT_FIELDS =
  "id,project_id,learner_profile_id,career_path_id,module_title,status,current_step_index,steps,checklist,created_at,updated_at,completed_at";

function sessionFromRow(row: TutorSessionRow): TutorSessionRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    learnerProfileId: row.learner_profile_id,
    careerPathId: row.career_path_id,
    moduleTitle: row.module_title,
    status: (row.status as TutorSessionRecord["status"]) ?? "active",
    currentStepIndex: Number(row.current_step_index ?? 0),
    steps: Array.isArray(row.steps) ? (row.steps as TutorSessionStep[]) : [],
    checklist: Array.isArray(row.checklist) ? (row.checklist as TutorSessionChecklistItem[]) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

async function persistSessionPatch(session: TutorSessionRecord): Promise<TutorSessionRecord | null> {
  if (mode() === "memory") {
    memorySessions.set(session.id, session);
    return { ...session };
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("module_tutor_sessions")
    .update({
      status: session.status,
      current_step_index: session.currentStepIndex,
      steps: session.steps,
      checklist: session.checklist,
      updated_at: session.updatedAt,
      completed_at: session.completedAt,
    })
    .eq("id", session.id)
    .select(SESSION_SELECT_FIELDS)
    .single();

  if (error || !data) return null;
  return sessionFromRow(data as TutorSessionRow);
}

async function findSessionById(sessionId: string, learnerProfileId: string): Promise<TutorSessionRecord | null> {
  if (mode() === "memory") {
    const session = memorySessions.get(sessionId);
    return session && session.learnerProfileId === learnerProfileId ? { ...session } : null;
  }

  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("module_tutor_sessions")
    .select(SESSION_SELECT_FIELDS)
    .eq("id", sessionId)
    .eq("learner_profile_id", learnerProfileId)
    .maybeSingle();
  return data ? sessionFromRow(data as TutorSessionRow) : null;
}

// --- lifecycle -----------------------------------------------------------------

function firstPendingStepIndex(steps: TutorSessionStep[]) {
  const pending = steps.find((step) => step.status !== "completed");
  return pending ? pending.index : steps.length;
}

export async function getTutorSessionForProject(input: {
  projectId: string;
  learnerProfileId: string;
  includeCompleted?: boolean;
}): Promise<TutorSessionRecord | null> {
  if (mode() === "memory") {
    const sessions = Array.from(memorySessions.values())
      .filter(
        (session) =>
          session.projectId === input.projectId &&
          session.learnerProfileId === input.learnerProfileId &&
          // Archived sessions (completed with no completedAt) are never
          // resumed or displayed — they only exist as history.
          (input.includeCompleted
            ? session.status === "active" || Boolean(session.completedAt)
            : session.status === "active"),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return sessions.length ? { ...sessions[0] } : null;
  }

  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("module_tutor_sessions")
    .select(SESSION_SELECT_FIELDS)
    .eq("project_id", input.projectId)
    .eq("learner_profile_id", input.learnerProfileId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (!input.includeCompleted) {
    query = query.eq("status", "active");
  } else {
    // Exclude archived rows (status completed + completed_at null).
    query = query.or("status.eq.active,completed_at.not.is.null");
  }
  const { data } = await query.maybeSingle();
  return data ? sessionFromRow(data as TutorSessionRow) : null;
}

/**
 * Starts (or resumes) the tutor session for a module. Idempotent: an existing
 * active session for the project is returned unchanged, making the session
 * resumable across visits.
 */
export async function startTutorSession(input: {
  projectId: string;
  learnerProfileId: string;
  guide: RecommendedModuleGuide;
}): Promise<TutorSessionRecord> {
  const existing = await getTutorSessionForProject({
    projectId: input.projectId,
    learnerProfileId: input.learnerProfileId,
  });
  if (existing) return existing;

  const now = new Date().toISOString();
  const record: TutorSessionRecord = {
    id: randomUUID(),
    projectId: input.projectId,
    learnerProfileId: input.learnerProfileId,
    careerPathId: input.guide.careerPathId,
    moduleTitle: input.guide.moduleTitle,
    status: "active",
    currentStepIndex: 0,
    steps: input.guide.steps.map((title, index) => ({
      index,
      title,
      whyThisStep: input.guide.stepDefinitions[index]?.whyThisStep ?? "",
      status: "pending",
      completedAt: null,
      evidenceNote: null,
    })),
    checklist: input.guide.proofChecklist.map((label, index) => ({
      index,
      label,
      done: false,
      evidence: null,
      completedAt: null,
    })),
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };

  if (mode() === "memory") {
    memorySessions.set(record.id, record);
    return { ...record };
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("module_tutor_sessions")
    .insert({
      id: record.id,
      project_id: record.projectId,
      learner_profile_id: record.learnerProfileId,
      career_path_id: record.careerPathId,
      module_title: record.moduleTitle,
      status: record.status,
      current_step_index: record.currentStepIndex,
      steps: record.steps,
      checklist: record.checklist,
      created_at: record.createdAt,
      updated_at: record.updatedAt,
    })
    .select(SESSION_SELECT_FIELDS)
    .single();

  if (error || !data) {
    throw new Error(`TUTOR_SESSION_CREATE_FAILED:${error?.message ?? "NO_ROW"}`);
  }
  return sessionFromRow(data as TutorSessionRow);
}

/**
 * True when the module playbook changed after this session snapshotted its
 * steps (UX audit F5). Sessions intentionally snapshot for resumability;
 * drift means the workbench should offer "Playbook updated — restart".
 * Detection compares the stored step titles and checklist labels against the
 * current guide — no schema change needed.
 */
export function tutorSessionPlaybookDrifted(session: TutorSessionRecord, guide: RecommendedModuleGuide): boolean {
  const sessionSteps = session.steps.map((step) => step.title);
  const sessionChecklist = session.checklist.map((item) => item.label);
  if (sessionSteps.length !== guide.steps.length) return true;
  if (sessionChecklist.length !== guide.proofChecklist.length) return true;
  if (sessionSteps.some((title, index) => title !== guide.steps[index])) return true;
  if (sessionChecklist.some((label, index) => label !== guide.proofChecklist[index])) return true;
  return false;
}

/**
 * Archived = status "completed" WITHOUT a `completedAt`. The status CHECK
 * constraint only allows 'active' | 'completed' (migration 20260707191000),
 * so archiving reuses 'completed' and the null completed_at distinguishes
 * "replaced by a restart" from "actually finished". `completeTutorSession`
 * always stamps completedAt, so the two states never collide.
 */
export function isTutorSessionArchived(session: TutorSessionRecord): boolean {
  return session.status === "completed" && !session.completedAt;
}

async function archiveTutorSession(session: TutorSessionRecord): Promise<TutorSessionRecord | null> {
  return persistSessionPatch({
    ...session,
    status: "completed",
    completedAt: null,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Restart after a playbook update (UX audit F5): archives the current active
 * session (its evidence stays queryable) and starts a fresh session from the
 * current playbook. With no active session it simply starts one.
 */
export async function restartTutorSession(input: {
  projectId: string;
  learnerProfileId: string;
  guide: RecommendedModuleGuide;
}): Promise<TutorSessionRecord> {
  const active = await getTutorSessionForProject({
    projectId: input.projectId,
    learnerProfileId: input.learnerProfileId,
  });
  if (active) {
    const archived = await archiveTutorSession(active);
    if (!archived) {
      throw new Error("TUTOR_SESSION_ARCHIVE_FAILED");
    }
  }
  return startTutorSession(input);
}

export async function completeTutorSessionStep(input: {
  sessionId: string;
  learnerProfileId: string;
  stepIndex: number;
  evidenceNote?: string | null;
}): Promise<TutorSessionRecord | null> {
  const session = await findSessionById(input.sessionId, input.learnerProfileId);
  if (!session) return null;

  const step = session.steps.find((entry) => entry.index === input.stepIndex);
  if (!step) {
    throw new Error("TUTOR_SESSION_STEP_NOT_FOUND");
  }

  const now = new Date().toISOString();
  const nextSteps = session.steps.map((entry) =>
    entry.index === input.stepIndex
      ? {
          ...entry,
          status: "completed" as const,
          completedAt: entry.completedAt ?? now,
          evidenceNote: input.evidenceNote?.trim().slice(0, 1000) || entry.evidenceNote,
        }
      : entry,
  );

  const next: TutorSessionRecord = {
    ...session,
    steps: nextSteps,
    currentStepIndex: firstPendingStepIndex(nextSteps),
    updatedAt: now,
  };
  return persistSessionPatch(next);
}

export async function setTutorChecklistItem(input: {
  sessionId: string;
  learnerProfileId: string;
  itemIndex: number;
  done: boolean;
  evidence?: string | null;
}): Promise<TutorSessionRecord | null> {
  const session = await findSessionById(input.sessionId, input.learnerProfileId);
  if (!session) return null;

  const item = session.checklist.find((entry) => entry.index === input.itemIndex);
  if (!item) {
    throw new Error("TUTOR_SESSION_CHECKLIST_ITEM_NOT_FOUND");
  }

  const now = new Date().toISOString();
  const next: TutorSessionRecord = {
    ...session,
    checklist: session.checklist.map((entry) =>
      entry.index === input.itemIndex
        ? {
            ...entry,
            done: input.done,
            evidence: input.done ? input.evidence?.trim().slice(0, 1000) || entry.evidence : entry.evidence,
            completedAt: input.done ? entry.completedAt ?? now : null,
          }
        : entry,
    ),
    updatedAt: now,
  };
  return persistSessionPatch(next);
}

export type TutorSessionMilestones = {
  /** Sessions ever started for this learner (any status). */
  started: number;
  /** Sessions fully completed (steps + proof checklist done). */
  completed: number;
  firstCompletedAt: string | null;
};

/**
 * Tutor-session milestone counts — a gamification XP signal (rebuild
 * dashboard batch item 4).
 */
export async function countTutorSessionMilestones(learnerProfileId: string): Promise<TutorSessionMilestones> {
  if (mode() === "memory") {
    const sessions = Array.from(memorySessions.values()).filter(
      (session) => session.learnerProfileId === learnerProfileId,
    );
    const completedAts = sessions
      .filter((session) => session.status === "completed" && session.completedAt)
      .map((session) => String(session.completedAt))
      .sort();
    return {
      started: sessions.length,
      // Archived sessions (completed + no completedAt) never count as
      // completed — restarting after a playbook update must not grant XP.
      completed: sessions.filter((session) => session.status === "completed" && session.completedAt).length,
      firstCompletedAt: completedAts[0] ?? null,
    };
  }

  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("module_tutor_sessions")
    .select("status,completed_at")
    .eq("learner_profile_id", learnerProfileId);

  const rows = (data ?? []) as Array<{ status: string; completed_at: string | null }>;
  const completedAts = rows
    .filter((row) => row.status === "completed" && row.completed_at)
    .map((row) => String(row.completed_at))
    .sort();
  return {
    started: rows.length,
    completed: rows.filter((row) => row.status === "completed" && row.completed_at).length,
    firstCompletedAt: completedAts[0] ?? null,
  };
}

export function tutorSessionChecklistComplete(session: TutorSessionRecord) {
  return (
    session.steps.length > 0 &&
    session.steps.every((step) => step.status === "completed") &&
    session.checklist.length > 0 &&
    session.checklist.every((item) => item.done)
  );
}

/**
 * Completes the session. Blocked until every playbook step AND every proof
 * checklist item is done — completing a tutor session is the `verified` gate
 * input, so it can never be short-circuited.
 */
export async function completeTutorSession(input: {
  sessionId: string;
  learnerProfileId: string;
}): Promise<TutorSessionCompletionResult> {
  const session = await findSessionById(input.sessionId, input.learnerProfileId);
  if (!session) {
    return { ok: false, errorCode: "TUTOR_SESSION_INCOMPLETE", pendingSteps: 0, pendingChecklist: 0 };
  }

  if (session.status === "completed") {
    return { ok: true, session };
  }

  if (!tutorSessionChecklistComplete(session)) {
    return {
      ok: false,
      errorCode: "TUTOR_SESSION_INCOMPLETE",
      pendingSteps: session.steps.filter((step) => step.status !== "completed").length,
      pendingChecklist: session.checklist.filter((item) => !item.done).length,
    };
  }

  const now = new Date().toISOString();
  const completed = await persistSessionPatch({
    ...session,
    status: "completed",
    updatedAt: now,
    completedAt: now,
  });
  if (!completed) {
    return { ok: false, errorCode: "TUTOR_SESSION_INCOMPLETE", pendingSteps: 0, pendingChecklist: 0 };
  }
  return { ok: true, session: completed };
}

// --- tutor prompt -----------------------------------------------------------------

export type TutorSessionLearnerContext = {
  name: string;
  headline: string | null;
  goals: string[];
};

export type TutorSessionAssessmentContext = {
  readinessScore: number;
  headline: string;
  topGaps: string[];
} | null;

export function buildTutorSessionPrompt(input: {
  session: TutorSessionRecord;
  guide: RecommendedModuleGuide;
  learner: TutorSessionLearnerContext;
  assessment: TutorSessionAssessmentContext;
  message: string;
}) {
  const { session, guide } = input;
  const currentStep = session.steps.find((step) => step.index === session.currentStepIndex) ?? null;
  const doneChecklist = session.checklist.filter((item) => item.done).length;

  return [
    "You are My AI Skill Tutor, running a structured, checkpointed module session for a working professional.",
    "Coach them through the playbook step-by-step. Be concrete, reference their real work, and always name the proof they should capture before moving on.",
    "",
    "## Learner",
    `Name: ${input.learner.name}`,
    `Role: ${input.learner.headline ?? "Not provided"}`,
    `Goals: ${input.learner.goals.length ? input.learner.goals.join(", ") : "not provided"}`,
    ...(input.assessment
      ? [
          `AI-readiness score: ${input.assessment.readinessScore}/100 — ${input.assessment.headline}`,
          `Top gaps: ${input.assessment.topGaps.join("; ")}`,
        ]
      : []),
    "",
    "## Module playbook",
    `Module: ${guide.moduleTitle} (${guide.careerPathName})`,
    `Why this module: ${guide.whyThisModule}`,
    `Expected output: ${guide.expectedOutput}`,
    "Proof checklist (ALL must be evidenced before the session can complete):",
    ...guide.proofChecklist.map((item, index) => {
      const state = session.checklist[index]?.done ? "DONE" : "OPEN";
      return `- [${state}] ${item}`;
    }),
    "",
    "## Session state",
    `Current step: ${Math.min(session.currentStepIndex + 1, session.steps.length)} of ${session.steps.length}`,
    ...session.steps.map(
      (step) => `- Step ${step.index + 1} [${step.status === "completed" ? "DONE" : "PENDING"}]: ${step.title}${step.evidenceNote ? ` (evidence: ${step.evidenceNote})` : ""}`,
    ),
    `Checklist progress: ${doneChecklist}/${session.checklist.length}`,
    ...(currentStep ? [`Focus the learner on: ${currentStep.title} — ${currentStep.whyThisStep}`] : ["All steps are complete — help the learner finish the proof checklist and generate their artifact."]),
    "",
    "Respond in <= 6 sentences. End with exactly one concrete action and the proof to capture for it.",
    `Learner message: ${input.message}`,
  ].join("\n");
}

export async function generateTutorSessionReply(input: {
  session: TutorSessionRecord;
  guide: RecommendedModuleGuide;
  learner: TutorSessionLearnerContext;
  assessment: TutorSessionAssessmentContext;
  message: string;
}): Promise<string> {
  const prompt = buildTutorSessionPrompt(input);
  try {
    return await callOpenAiResponses({ prompt, temperature: 0.3 });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("OPENAI_API_KEY_MISSING")) {
      throw new Error("OPENAI_CONFIG_MISSING");
    }
    throw error;
  }
}
