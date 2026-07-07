import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type { AssessmentAnswer, AssessmentReport } from "@/lib/assessment-report";

/**
 * Server-side persistence for the anonymous assessment flow (Phase 1 of the
 * rebuild). Anonymous sessions are keyed by an unguessable token — no Clerk
 * account required. Follows runtime.ts's memory/supabase persistence-mode
 * convention so the vitest suite (PERSISTENCE_MODE=memory) exercises the full
 * lifecycle in-process.
 *
 * Tables: `anonymous_assessments` + `assessment_report_history`
 * (migration `supabase/migrations/20260707150000_add_anonymous_assessments.sql`).
 */

export type AnonymousAssessmentStatus = "started" | "submitted" | "completed";

export type AnonymousAssessment = {
  id: string;
  sessionToken: string;
  status: AnonymousAssessmentStatus;
  careerPathId: string | null;
  careerCategoryLabel: string | null;
  jobTitle: string | null;
  yearsExperience: string | null;
  companySize: string | null;
  situation: string | null;
  goals: string[];
  aiComfort: number | null;
  linkedinUrl: string | null;
  resumeText: string | null;
  answers: AssessmentAnswer[];
  email: string | null;
  emailCapturedAt: string | null;
  reportEmailSentAt: string | null;
  learnerProfileId: string | null;
  linkedAt: string | null;
  visitorId: string | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
};

export type AssessmentReportRecord = {
  id: string;
  anonymousAssessmentId: string;
  learnerProfileId: string | null;
  readinessScore: number;
  deterministicScore: number | null;
  model: string | null;
  report: AssessmentReport;
  createdAt: string;
};

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

export function generateAssessmentSessionToken() {
  return randomBytes(24).toString("base64url");
}

export function normalizeEmailAddress(input: string | null | undefined): string | null {
  if (typeof input !== "string") return null;
  const normalized = input.trim().toLowerCase();
  if (!normalized || normalized.length > 320) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized)) return null;
  return normalized;
}

function cleanText(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLen);
}

// --- memory mode -----------------------------------------------------------

const memoryAssessments = new Map<string, AnonymousAssessment>();
const memoryReports = new Map<string, AssessmentReportRecord[]>();

export function resetAnonymousAssessmentStateForTests() {
  memoryAssessments.clear();
  memoryReports.clear();
}

// --- supabase row mapping ---------------------------------------------------

type AnonymousAssessmentRow = {
  id: string;
  session_token: string;
  status: string;
  career_path_id: string | null;
  career_category_label: string | null;
  job_title: string | null;
  years_experience: string | null;
  company_size: string | null;
  situation: string | null;
  goals: unknown;
  ai_comfort: number | null;
  linkedin_url: string | null;
  resume_text: string | null;
  answers: unknown;
  email: string | null;
  email_captured_at: string | null;
  report_email_sent_at: string | null;
  learner_profile_id: string | null;
  linked_at: string | null;
  visitor_id: string | null;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
};

const ASSESSMENT_SELECT_FIELDS =
  "id,session_token,status,career_path_id,career_category_label,job_title,years_experience,company_size,situation,goals,ai_comfort,linkedin_url,resume_text,answers,email,email_captured_at,report_email_sent_at,learner_profile_id,linked_at,visitor_id,created_at,updated_at,submitted_at";

function assessmentFromRow(row: AnonymousAssessmentRow): AnonymousAssessment {
  return {
    id: row.id,
    sessionToken: row.session_token,
    status: (row.status as AnonymousAssessmentStatus) ?? "started",
    careerPathId: row.career_path_id,
    careerCategoryLabel: row.career_category_label,
    jobTitle: row.job_title,
    yearsExperience: row.years_experience,
    companySize: row.company_size,
    situation: row.situation,
    goals: Array.isArray(row.goals) ? row.goals.filter((entry): entry is string => typeof entry === "string") : [],
    aiComfort: row.ai_comfort === null || row.ai_comfort === undefined ? null : Number(row.ai_comfort),
    linkedinUrl: row.linkedin_url,
    resumeText: row.resume_text,
    answers: Array.isArray(row.answers) ? (row.answers as AssessmentAnswer[]) : [],
    email: row.email,
    emailCapturedAt: row.email_captured_at,
    reportEmailSentAt: row.report_email_sent_at,
    learnerProfileId: row.learner_profile_id,
    linkedAt: row.linked_at,
    visitorId: row.visitor_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at,
  };
}

type AssessmentReportHistoryRow = {
  id: string;
  anonymous_assessment_id: string;
  learner_profile_id: string | null;
  readiness_score: number;
  deterministic_score: number | null;
  model: string | null;
  report: unknown;
  created_at: string;
};

const REPORT_SELECT_FIELDS =
  "id,anonymous_assessment_id,learner_profile_id,readiness_score,deterministic_score,model,report,created_at";

function reportFromRow(row: AssessmentReportHistoryRow): AssessmentReportRecord {
  return {
    id: row.id,
    anonymousAssessmentId: row.anonymous_assessment_id,
    learnerProfileId: row.learner_profile_id,
    readinessScore: Number(row.readiness_score),
    deterministicScore: row.deterministic_score === null ? null : Number(row.deterministic_score),
    model: row.model,
    report: row.report as AssessmentReport,
    createdAt: row.created_at,
  };
}

// --- lifecycle --------------------------------------------------------------

export async function createAnonymousAssessment(input: {
  careerPathId?: string | null;
  visitorId?: string | null;
}): Promise<AnonymousAssessment> {
  const now = new Date().toISOString();
  const record: AnonymousAssessment = {
    id: randomUUID(),
    sessionToken: generateAssessmentSessionToken(),
    status: "started",
    careerPathId: cleanText(input.careerPathId, 80),
    careerCategoryLabel: null,
    jobTitle: null,
    yearsExperience: null,
    companySize: null,
    situation: null,
    goals: [],
    aiComfort: null,
    linkedinUrl: null,
    resumeText: null,
    answers: [],
    email: null,
    emailCapturedAt: null,
    reportEmailSentAt: null,
    learnerProfileId: null,
    linkedAt: null,
    visitorId: cleanText(input.visitorId, 160),
    createdAt: now,
    updatedAt: now,
    submittedAt: null,
  };

  if (mode() === "memory") {
    memoryAssessments.set(record.id, record);
    return { ...record };
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("anonymous_assessments")
    .insert({
      id: record.id,
      session_token: record.sessionToken,
      status: record.status,
      career_path_id: record.careerPathId,
      visitor_id: record.visitorId,
      created_at: record.createdAt,
      updated_at: record.updatedAt,
    })
    .select(ASSESSMENT_SELECT_FIELDS)
    .single();

  if (error || !data) {
    throw new Error(`ANONYMOUS_ASSESSMENT_CREATE_FAILED:${error?.message ?? "NO_ROW"}`);
  }
  return assessmentFromRow(data as AnonymousAssessmentRow);
}

export async function findAnonymousAssessmentByToken(token: string): Promise<AnonymousAssessment | null> {
  const normalized = cleanText(token, 200);
  if (!normalized) return null;

  if (mode() === "memory") {
    const match = Array.from(memoryAssessments.values()).find((entry) => entry.sessionToken === normalized);
    return match ? { ...match } : null;
  }

  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("anonymous_assessments")
    .select(ASSESSMENT_SELECT_FIELDS)
    .eq("session_token", normalized)
    .maybeSingle();
  return data ? assessmentFromRow(data as AnonymousAssessmentRow) : null;
}

export async function submitAnonymousAssessment(input: {
  sessionToken: string;
  careerPathId?: string | null;
  careerCategoryLabel?: string | null;
  jobTitle?: string | null;
  yearsExperience?: string | null;
  companySize?: string | null;
  situation?: string | null;
  goals: string[];
  aiComfort?: number | null;
  linkedinUrl?: string | null;
  resumeText?: string | null;
  answers: AssessmentAnswer[];
}): Promise<AnonymousAssessment | null> {
  const existing = await findAnonymousAssessmentByToken(input.sessionToken);
  if (!existing) return null;

  const now = new Date().toISOString();
  const patch = {
    careerPathId: cleanText(input.careerPathId, 80) ?? existing.careerPathId,
    careerCategoryLabel: cleanText(input.careerCategoryLabel, 120) ?? existing.careerCategoryLabel,
    jobTitle: cleanText(input.jobTitle, 160) ?? existing.jobTitle,
    yearsExperience: cleanText(input.yearsExperience, 40) ?? existing.yearsExperience,
    companySize: cleanText(input.companySize, 40) ?? existing.companySize,
    situation: cleanText(input.situation, 60) ?? existing.situation,
    goals: input.goals.filter((entry): entry is string => typeof entry === "string").slice(0, 12),
    aiComfort:
      input.aiComfort === null || input.aiComfort === undefined ? existing.aiComfort : Number(input.aiComfort),
    linkedinUrl: cleanText(input.linkedinUrl, 500) ?? existing.linkedinUrl,
    resumeText: cleanText(input.resumeText, 20000) ?? existing.resumeText,
    answers: input.answers.map((entry) => ({ questionId: String(entry.questionId), value: Number(entry.value) })),
    status: "submitted" as const,
    submittedAt: now,
    updatedAt: now,
  };

  if (mode() === "memory") {
    const record = memoryAssessments.get(existing.id);
    if (!record) return null;
    const next = { ...record, ...patch };
    memoryAssessments.set(existing.id, next);
    return { ...next };
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("anonymous_assessments")
    .update({
      career_path_id: patch.careerPathId,
      career_category_label: patch.careerCategoryLabel,
      job_title: patch.jobTitle,
      years_experience: patch.yearsExperience,
      company_size: patch.companySize,
      situation: patch.situation,
      goals: patch.goals,
      ai_comfort: patch.aiComfort,
      linkedin_url: patch.linkedinUrl,
      resume_text: patch.resumeText,
      answers: patch.answers,
      status: patch.status,
      submitted_at: patch.submittedAt,
      updated_at: patch.updatedAt,
    })
    .eq("id", existing.id)
    .select(ASSESSMENT_SELECT_FIELDS)
    .single();

  if (error || !data) return null;
  return assessmentFromRow(data as AnonymousAssessmentRow);
}

export async function captureAssessmentEmail(input: {
  sessionToken: string;
  email: string;
}): Promise<AnonymousAssessment | null> {
  const email = normalizeEmailAddress(input.email);
  if (!email) return null;

  const existing = await findAnonymousAssessmentByToken(input.sessionToken);
  if (!existing) return null;

  const now = new Date().toISOString();

  if (mode() === "memory") {
    const record = memoryAssessments.get(existing.id);
    if (!record) return null;
    const next: AnonymousAssessment = {
      ...record,
      email,
      emailCapturedAt: record.emailCapturedAt ?? now,
      status: "completed",
      updatedAt: now,
    };
    memoryAssessments.set(existing.id, next);
    return { ...next };
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("anonymous_assessments")
    .update({
      email,
      email_captured_at: existing.emailCapturedAt ?? now,
      status: "completed",
      updated_at: now,
    })
    .eq("id", existing.id)
    .select(ASSESSMENT_SELECT_FIELDS)
    .single();

  if (error || !data) return null;
  return assessmentFromRow(data as AnonymousAssessmentRow);
}

export async function markAssessmentReportEmailSent(assessmentId: string): Promise<AnonymousAssessment | null> {
  const now = new Date().toISOString();

  if (mode() === "memory") {
    const record = memoryAssessments.get(assessmentId);
    if (!record) return null;
    const next = { ...record, reportEmailSentAt: now, updatedAt: now };
    memoryAssessments.set(assessmentId, next);
    return { ...next };
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("anonymous_assessments")
    .update({ report_email_sent_at: now, updated_at: now })
    .eq("id", assessmentId)
    .select(ASSESSMENT_SELECT_FIELDS)
    .single();

  if (error || !data) return null;
  return assessmentFromRow(data as AnonymousAssessmentRow);
}

// --- score history (the product's spine) ------------------------------------

export async function appendAssessmentReport(input: {
  anonymousAssessmentId: string;
  learnerProfileId?: string | null;
  readinessScore: number;
  deterministicScore?: number | null;
  model?: string | null;
  report: AssessmentReport;
}): Promise<AssessmentReportRecord> {
  const record: AssessmentReportRecord = {
    id: randomUUID(),
    anonymousAssessmentId: input.anonymousAssessmentId,
    learnerProfileId: cleanText(input.learnerProfileId, 80),
    readinessScore: Math.round(Number(input.readinessScore)),
    deterministicScore:
      input.deterministicScore === null || input.deterministicScore === undefined
        ? null
        : Number(input.deterministicScore),
    model: cleanText(input.model, 120),
    report: input.report,
    createdAt: new Date().toISOString(),
  };

  if (mode() === "memory") {
    const history = memoryReports.get(record.anonymousAssessmentId) ?? [];
    history.push(record);
    memoryReports.set(record.anonymousAssessmentId, history);
    return { ...record };
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("assessment_report_history")
    .insert({
      id: record.id,
      anonymous_assessment_id: record.anonymousAssessmentId,
      learner_profile_id: record.learnerProfileId,
      readiness_score: record.readinessScore,
      deterministic_score: record.deterministicScore,
      model: record.model,
      report: record.report,
      created_at: record.createdAt,
    })
    .select(REPORT_SELECT_FIELDS)
    .single();

  if (error || !data) {
    throw new Error(`ASSESSMENT_REPORT_PERSIST_FAILED:${error?.message ?? "NO_ROW"}`);
  }
  return reportFromRow(data as AssessmentReportHistoryRow);
}

export async function listAssessmentReports(anonymousAssessmentId: string): Promise<AssessmentReportRecord[]> {
  if (mode() === "memory") {
    return (memoryReports.get(anonymousAssessmentId) ?? []).map((entry) => ({ ...entry }));
  }

  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("assessment_report_history")
    .select(REPORT_SELECT_FIELDS)
    .eq("anonymous_assessment_id", anonymousAssessmentId)
    .order("created_at", { ascending: true });

  return ((data ?? []) as AssessmentReportHistoryRow[]).map(reportFromRow);
}

export async function getLatestAssessmentReport(
  anonymousAssessmentId: string,
): Promise<AssessmentReportRecord | null> {
  const history = await listAssessmentReports(anonymousAssessmentId);
  return history.length ? history[history.length - 1] : null;
}

// --- account linking ---------------------------------------------------------

/**
 * Links anonymous assessments (matched on captured email) to a learner
 * profile. Runs wherever onboarding claim / user creation already happens.
 * Idempotent: only unlinked rows are claimed; an already-linked assessment is
 * never reassigned.
 */
export async function linkAnonymousAssessmentsToProfile(input: {
  learnerProfileId: string;
  email: string | null | undefined;
}): Promise<number> {
  const learnerProfileId = cleanText(input.learnerProfileId, 80);
  const email = normalizeEmailAddress(input.email);
  if (!learnerProfileId || !email) return 0;

  const now = new Date().toISOString();

  if (mode() === "memory") {
    let linked = 0;
    for (const [id, record] of memoryAssessments) {
      if (record.email !== email || record.learnerProfileId) continue;
      memoryAssessments.set(id, { ...record, learnerProfileId, linkedAt: now, updatedAt: now });
      const history = memoryReports.get(id);
      if (history) {
        memoryReports.set(
          id,
          history.map((entry) => (entry.learnerProfileId ? entry : { ...entry, learnerProfileId })),
        );
      }
      linked += 1;
    }
    return linked;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("anonymous_assessments")
    .update({ learner_profile_id: learnerProfileId, linked_at: now, updated_at: now })
    .eq("email", email)
    .is("learner_profile_id", null)
    .select("id");

  if (error || !data?.length) return 0;

  const linkedIds = (data as Array<{ id: string }>).map((row) => row.id);
  await supabase
    .from("assessment_report_history")
    .update({ learner_profile_id: learnerProfileId })
    .in("anonymous_assessment_id", linkedIds)
    .is("learner_profile_id", null);

  return linkedIds.length;
}
