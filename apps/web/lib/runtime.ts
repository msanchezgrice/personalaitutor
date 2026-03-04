import { createHash, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  CAREER_PATHS,
  MODULE_TRACKS,
  addProjectChatMessage as memAddProjectChatMessage,
  connectOAuth as memConnectOAuth,
  createDailyUpdate as memCreateDailyUpdate,
  createEmployerLead as memCreateEmployerLead,
  createOnboardingSession as memCreateOnboardingSession,
  createProject as memCreateProject,
  createSocialDrafts as memCreateSocialDrafts,
  findOnboardingSession as memFindOnboardingSession,
  findProjectById as memFindProjectById,
  findProjectBySlug as memFindProjectBySlug,
  findUserByHandle as memFindUserByHandle,
  findUserById as memFindUserById,
  generateProfileOgSvg,
  generateProjectOgSvg,
  getCatalogData,
  getDashboardSummary as memGetDashboardSummary,
  getEmployerFacets,
  getTalentByHandle,
  getVerificationPolicy,
  jsonError,
  jsonOk,
  listProjectEvents as memListProjectEvents,
  listProjectsByUser as memListProjectsByUser,
  listTalent,
  markOAuthFailure as memMarkOAuthFailure,
  publishProfile as memPublishProfile,
  publishSocialDraft as memPublishSocialDraft,
  refreshRelevantNews as memRefreshRelevantNews,
  requestArtifactGeneration as memRequestArtifactGeneration,
  startAssessment as memStartAssessment,
  submitAssessment as memSubmitAssessment,
  updateOnboardingCareerImport as memUpdateOnboardingCareerImport,
  updateOnboardingSituation as memUpdateOnboardingSituation,
  updateProfile as memUpdateProfile,
  upsertUserProfile as memUpsertUserProfile,
  type AssessmentAttempt,
  type BuildLogEntry,
  type DailyUpdate,
  type DashboardSummary,
  type OnboardingSession,
  type Project,
  type PublishMode,
  type SocialDraft,
  type SocialPlatform,
  type TalentCard,
  type UserProfile,
} from "@aitutor/shared";
import { BRAND_NAME } from "./site";

const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001";

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

let cachedClient: SupabaseClient | null = null;

function getSupabaseAdmin() {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_ENV_MISSING");
  }

  cachedClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return cachedClient;
}

function appBaseUrl() {
  const explicit = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl.replace(/\/+$/, "")}`;
  return "http://localhost:6396";
}

function welcomeFromAddress() {
  const configured = process.env.RESEND_FROM_EMAIL?.trim();
  if (configured) return configured;
  return `${BRAND_NAME} <onboarding@resend.dev>`;
}

async function sendWelcomeEmail(input: { to: string; name: string; handle: string }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return false;

  const dashboardUrl = `${appBaseUrl()}/dashboard/?welcome=1`;
  const profileUrl = `${appBaseUrl()}/u/${input.handle}/`;
  const subject = `Welcome to ${BRAND_NAME}`;
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;color:#0f172a;background:#f8fafc;padding:24px">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;padding:24px">
        <div style="display:flex;align-items:center;gap:10px;margin:0 0 16px;padding-bottom:12px;border-bottom:1px solid #e2e8f0;">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:8px;background:#10b981;color:#ffffff;font-size:14px;font-weight:700;">AI</span>
          <span style="font-size:15px;font-weight:700;letter-spacing:.2px;">${BRAND_NAME}</span>
        </div>
        <h1 style="margin:0 0 10px;font-size:24px;">Welcome, ${input.name}.</h1>
        <p style="margin:0 0 14px;line-height:1.6;color:#475569;">
          Your AI Tutor workspace is ready. Start your onboarding, finish your assessment, and publish your first verified project.
        </p>
        <p style="margin:0 0 20px;line-height:1.6;color:#475569;">
          Dashboard: <a href="${dashboardUrl}">${dashboardUrl}</a><br />
          Public profile: <a href="${profileUrl}">${profileUrl}</a>
        </p>
        <a href="${dashboardUrl}" style="display:inline-block;background:#10b981;color:#ffffff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:600;">Open Dashboard</a>
      </div>
    </div>
  `.trim();
  const text = [
    `Welcome to ${BRAND_NAME}, ${input.name}.`,
    "Your workspace is ready.",
    `Dashboard: ${dashboardUrl}`,
    `Public profile: ${profileUrl}`,
  ].join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: welcomeFromAddress(),
      to: [input.to],
      subject,
      html,
      text,
    }),
  });

  return res.ok;
}

async function maybeSendWelcomeEmail(input: { profileId: string; email?: string | null; name: string; handle: string }) {
  const email = input.email?.trim();
  if (!email) return;
  if (!process.env.RESEND_API_KEY?.trim()) return;

  const supabase = getSupabaseAdmin();
  const { data: statusRow } = await supabase
    .from("learner_profiles")
    .select("welcome_email_sent_at")
    .eq("id", input.profileId)
    .maybeSingle();

  if (!statusRow || statusRow.welcome_email_sent_at) return;

  try {
    const delivered = await sendWelcomeEmail({
      to: email,
      name: input.name,
      handle: input.handle,
    });

    if (!delivered) return;

    await supabase
      .from("learner_profiles")
      .update({
        welcome_email_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.profileId)
      .is("welcome_email_sent_at", null);
  } catch (error) {
    console.warn("[welcome-email] send failed", error instanceof Error ? error.message : "unknown");
  }
}

function isUuid(input: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input);
}

function safeHandle(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function parseSkillTools(input?: string | null) {
  if (!input || !input.trim()) return [];
  return Array.from(
    new Set(
      input
        .split(/[,\n]/)
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ).slice(0, 20);
}

function uuidFromExternalId(input: string) {
  const hex = createHash("sha256").update(`personalaitutor:${input}`).digest("hex").slice(0, 32).split("");
  hex[12] = "4";
  const nibble = parseInt(hex[16] ?? "0", 16);
  hex[16] = ((nibble & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20, 32).join("")}`;
}

function normalizeUserId(input?: string | null) {
  if (!input) {
    throw new Error("USER_ID_REQUIRED");
  }
  if (input === "user_test_0001") return DEFAULT_USER_ID;
  if (isUuid(input)) return input;
  return uuidFromExternalId(input);
}

function skillStatusRank(status: string) {
  switch (status) {
    case "not_started":
      return 0;
    case "in_progress":
      return 1;
    case "built":
      return 2;
    case "verified":
      return 3;
    default:
      return 0;
  }
}

function profileFromRow(
  row: {
    id: string;
    handle: string;
    full_name: string;
    headline: string;
    bio: string;
    career_path_id: string | null;
    published: boolean;
    tokens_used: number;
    goals: string[] | null;
    tools: string[] | null;
    social_links: Record<string, string> | null;
    created_at: string;
    updated_at: string;
  },
  skills: UserProfile["skills"],
): UserProfile {
  const links = row.social_links ?? {};
  return {
    id: row.id,
    handle: row.handle,
    name: row.full_name,
    avatarUrl: typeof links.avatar === "string" ? links.avatar : null,
    headline: row.headline,
    bio: row.bio,
    careerPathId: row.career_path_id ?? CAREER_PATHS[0].id,
    skills,
    tools: row.tools ?? [],
    socialLinks: {
      linkedin: typeof links.linkedin === "string" ? links.linkedin : undefined,
      x: typeof links.x === "string" ? links.x : undefined,
      website: typeof links.website === "string" ? links.website : undefined,
      github: typeof links.github === "string" ? links.github : undefined,
    },
    published: row.published,
    tokensUsed: row.tokens_used,
    goals: ((row.goals ?? []) as UserProfile["goals"]) || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSkillRows(rows: Array<{ skill_name: string; status: string; score: number; evidence_count: number }>) {
  return rows.map((row) => ({
    skill: row.skill_name,
    status: row.status as UserProfile["skills"][number]["status"],
    score: Number(row.score ?? 0),
    evidenceCount: Number(row.evidence_count ?? 0),
  }));
}

async function getProfileRowById(userId: string) {
  const supabase = getSupabaseAdmin();
  const normalizedUserId = normalizeUserId(userId);
  const { data, error } = await supabase
    .from("learner_profiles")
    .select("id,handle,full_name,headline,bio,career_path_id,published,tokens_used,goals,tools,social_links,created_at,updated_at")
    .eq("id", normalizedUserId)
    .single();

  if (!error && data) {
    return data;
  }

  if (!isUuid(userId)) {
    const { data: byExternal } = await supabase
      .from("learner_profiles")
      .select("id,handle,full_name,headline,bio,career_path_id,published,tokens_used,goals,tools,social_links,created_at,updated_at")
      .eq("external_user_id", userId)
      .maybeSingle();
    if (byExternal) return byExternal;
  }

  return null;
}

async function getSkillsForProfile(profileId: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("user_skill_evidence")
    .select("skill_name,status,score,evidence_count")
    .eq("learner_profile_id", profileId)
    .order("updated_at", { ascending: false });

  return toSkillRows(data ?? []);
}

async function getOrCreateProfile(input: {
  userId?: string;
  name?: string;
  avatarUrl?: string | null;
  handleBase?: string;
  careerPathId?: string;
}) {
  const supabase = getSupabaseAdmin();
  const normalizedUserId = normalizeUserId(input.userId);

  const existing = await getProfileRowById(input.userId ?? normalizedUserId);
  if (existing) {
    if (input.name && input.name.trim() && existing.full_name !== input.name.trim()) {
      await supabase
        .from("learner_profiles")
        .update({
          full_name: input.name.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      existing.full_name = input.name.trim();
    }
    if (input.avatarUrl) {
      const links = existing.social_links ?? {};
      if (links.avatar !== input.avatarUrl) {
        await supabase
          .from("learner_profiles")
          .update({
            social_links: {
              ...links,
              avatar: input.avatarUrl,
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        existing.social_links = {
          ...links,
          avatar: input.avatarUrl,
        };
      }
    }
    const skills = await getSkillsForProfile(existing.id);
    return profileFromRow(existing, skills);
  }

  const handleBase = safeHandle(input.handleBase ?? "test-user");
  let handle = handleBase || "test-user";
  let suffix = 2;

  while (true) {
    const { data } = await supabase.from("learner_profiles").select("id").eq("handle", handle).maybeSingle();
    if (!data) break;
    handle = `${handleBase}-${suffix}`;
    suffix += 1;
  }

  const selectFields =
    "id,handle,full_name,headline,bio,career_path_id,published,tokens_used,goals,tools,social_links,created_at,updated_at";

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const inferredName = input.name?.trim() || input.handleBase?.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "New Learner";
    const inferredBio = "Building practical AI workflows and sharing public proof of execution.";
    const insert = {
      id: normalizedUserId,
      auth_user_id: normalizedUserId,
      external_user_id: input.userId ?? null,
      handle,
      full_name: inferredName,
      headline: "AI Builder",
      bio: inferredBio,
      career_path_id: input.careerPathId ?? CAREER_PATHS[0].id,
      published: false,
      tokens_used: 0,
      goals: [],
      tools: [],
      social_links: {
        website: `${appBaseUrl()}/u/${handle}`,
        ...(input.avatarUrl ? { avatar: input.avatarUrl } : {}),
      },
    };

    const { data, error } = await supabase.from("learner_profiles").insert(insert).select(selectFields).single();
    if (!error && data) {
      return profileFromRow(data, []);
    }

    if (error?.code === "23505") {
      const existingRow = await getProfileRowById(input.userId ?? normalizedUserId);
      if (existingRow) {
        const skills = await getSkillsForProfile(existingRow.id);
        return profileFromRow(existingRow, skills);
      }

      const conflictMessage = error.message?.toLowerCase() ?? "";
      if (conflictMessage.includes("handle")) {
        handle = `${handleBase}-${suffix}`;
        suffix += 1;
        continue;
      }
    }

    throw new Error(`PROFILE_CREATE_FAILED:${error?.message ?? "UNKNOWN"}`);
  }

  throw new Error("PROFILE_CREATE_FAILED:HANDLE_CONFLICT_RETRY_EXHAUSTED");
}

async function getProjectArtifacts(projectId: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("project_artifacts")
    .select("kind,url,created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

async function getBuildLog(projectId: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("build_log_entries")
    .select("id,message,level,created_at,metadata,project_id,learner_profile_id")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  return (data ?? []).map((row) => ({
    id: row.id,
    projectId: row.project_id,
    userId: row.learner_profile_id,
    message: row.message,
    level: row.level as BuildLogEntry["level"],
    createdAt: row.created_at,
    metadata: row.metadata ?? {},
  }));
}

async function projectFromRow(row: {
  id: string;
  learner_profile_id: string;
  slug: string;
  title: string;
  description: string;
  state: Project["state"];
  created_at: string;
  updated_at: string;
}): Promise<Project> {
  const artifacts = await getProjectArtifacts(row.id);
  const buildLog = await getBuildLog(row.id);
  return {
    id: row.id,
    userId: row.learner_profile_id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    state: row.state,
    artifacts: artifacts.map((entry) => ({ kind: entry.kind, url: entry.url, createdAt: entry.created_at })),
    buildLog,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getProjectsByUserFromDb(userId: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("projects")
    .select("id,learner_profile_id,slug,title,description,state,created_at,updated_at")
    .eq("learner_profile_id", normalizeUserId(userId))
    .order("created_at", { ascending: false });

  const rows = data ?? [];
  const mapped: Project[] = [];
  for (const row of rows) {
    mapped.push(await projectFromRow(row));
  }
  return mapped;
}

async function insertJobEvent(input: {
  jobId: string;
  userId: string;
  projectId: string | null;
  type: string;
  message: string;
  payload?: Record<string, unknown>;
}) {
  const supabase = getSupabaseAdmin();
  await supabase.from("agent_job_events").insert({
    id: randomUUID(),
    job_id: input.jobId,
    learner_profile_id: input.userId,
    project_id: input.projectId,
    event_type: input.type,
    message: input.message,
    payload: input.payload ?? {},
  });
}

async function createJob(input: {
  userId: string;
  projectId: string | null;
  type: string;
  payload: Record<string, unknown>;
  status?: string;
}) {
  const supabase = getSupabaseAdmin();
  const jobId = randomUUID();

  await supabase.from("agent_jobs").insert({
    id: jobId,
    learner_profile_id: input.userId,
    project_id: input.projectId,
    type: input.type,
    payload: input.payload,
    status: input.status ?? "queued",
    attempts: 0,
    max_attempts: 3,
  });

  await insertJobEvent({
    jobId,
    userId: input.userId,
    projectId: input.projectId,
    type: "job.queued",
    message: `${input.type} queued`,
    payload: input.payload,
  });

  return jobId;
}

async function appendBuildLog(input: {
  projectId: string;
  userId: string;
  message: string;
  level: BuildLogEntry["level"];
  metadata?: Record<string, unknown>;
}) {
  const supabase = getSupabaseAdmin();
  await supabase.from("build_log_entries").insert({
    id: randomUUID(),
    project_id: input.projectId,
    learner_profile_id: input.userId,
    message: input.message,
    level: input.level,
    metadata: input.metadata ?? {},
  });
}

async function touchProfileTokenUsage(userId: string, addTokens: number) {
  const supabase = getSupabaseAdmin();
  const existing = await getProfileRowById(userId);
  if (!existing) return;
  await supabase
    .from("learner_profiles")
    .update({ tokens_used: Number(existing.tokens_used ?? 0) + addTokens })
    .eq("id", existing.id);
}

async function upsertSkill(input: {
  userId: string;
  skill: string;
  status: "not_started" | "in_progress" | "built" | "verified";
  score: number;
  evidenceDelta: number;
}) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("user_skill_evidence")
    .select("id,status,score,evidence_count")
    .eq("learner_profile_id", input.userId)
    .eq("skill_name", input.skill)
    .maybeSingle();

  if (!data) {
    await supabase.from("user_skill_evidence").insert({
      id: randomUUID(),
      learner_profile_id: input.userId,
      skill_name: input.skill,
      status: input.status,
      score: input.score,
      evidence_count: Math.max(0, input.evidenceDelta),
    });
    return;
  }

  const statusOrder = {
    not_started: 0,
    in_progress: 1,
    built: 2,
    verified: 3,
  } as const;

  const nextStatus =
    statusOrder[input.status] > statusOrder[data.status as keyof typeof statusOrder]
      ? input.status
      : (data.status as keyof typeof statusOrder);

  await supabase
    .from("user_skill_evidence")
    .update({
      status: nextStatus,
      score: Math.max(Number(data.score ?? 0), input.score),
      evidence_count: Math.max(0, Number(data.evidence_count ?? 0) + input.evidenceDelta),
      updated_at: new Date().toISOString(),
    })
    .eq("id", data.id);
}

async function getLatestDailyUpdate(userId: string): Promise<DailyUpdate | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("daily_update_emails")
    .select("id,learner_profile_id,status,summary,upcoming_tasks,news_ids,created_at,failure_code")
    .eq("learner_profile_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    userId: data.learner_profile_id,
    status: data.status,
    summary: data.summary,
    upcomingTasks: data.upcoming_tasks ?? [],
    newsIds: data.news_ids ?? [],
    createdAt: data.created_at,
    failureCode: data.failure_code ?? null,
  };
}

export async function runtimeCreateOnboardingSession(input: {
  userId?: string;
  name?: string;
  avatarUrl?: string | null;
  email?: string | null;
  handleBase?: string;
  careerPathId?: string;
}) {
  if (mode() === "memory") return memCreateOnboardingSession(input);

  const supabase = getSupabaseAdmin();
  const profile = await getOrCreateProfile(input);
  const sessionId = randomUUID();

  const row = {
    id: sessionId,
    learner_profile_id: profile.id,
    situation: null,
    career_path_id: input.careerPathId ?? profile.careerPathId,
    linkedin_url: null,
    resume_filename: null,
    ai_knowledge_score: null,
    goals: profile.goals,
    status: "started",
  };

  const { data, error } = await supabase.from("onboarding_sessions").insert(row).select("*").single();
  if (error || !data) {
    throw new Error(`ONBOARDING_SESSION_CREATE_FAILED:${error?.message ?? "UNKNOWN"}`);
  }

  await insertJobEvent({
    jobId: "onboarding",
    userId: profile.id,
    projectId: null,
    type: "onboarding.started",
    message: `Onboarding session ${sessionId} started`,
  });

  await maybeSendWelcomeEmail({
    profileId: profile.id,
    email: input.email ?? null,
    name: profile.name,
    handle: profile.handle,
  });

  return {
    user: profile,
    session: {
      id: data.id,
      userId: data.learner_profile_id,
      situation: data.situation,
      careerPathId: data.career_path_id,
      linkedinUrl: data.linkedin_url,
      resumeFilename: data.resume_filename,
      aiKnowledgeScore: data.ai_knowledge_score,
      goals: data.goals ?? [],
      status: data.status,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    } as OnboardingSession,
  };
}

export async function runtimeFindOnboardingSession(sessionId: string) {
  if (mode() === "memory") return memFindOnboardingSession(sessionId);

  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from("onboarding_sessions").select("*").eq("id", sessionId).maybeSingle();
  if (!data) return null;

  return {
    id: data.id,
    userId: data.learner_profile_id,
    situation: data.situation,
    careerPathId: data.career_path_id,
    linkedinUrl: data.linkedin_url,
    resumeFilename: data.resume_filename,
    aiKnowledgeScore: data.ai_knowledge_score,
    goals: data.goals ?? [],
    status: data.status,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  } as OnboardingSession;
}

export async function runtimeUpdateOnboardingSituation(input: {
  sessionId: string;
  situation: OnboardingSession["situation"];
  goals: UserProfile["goals"];
}) {
  if (mode() === "memory") return memUpdateOnboardingSituation(input);

  const supabase = getSupabaseAdmin();
  const session = await runtimeFindOnboardingSession(input.sessionId);
  if (!session) return null;

  await supabase
    .from("onboarding_sessions")
    .update({
      situation: input.situation,
      goals: input.goals,
      status: "collecting",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.sessionId);

  await supabase
    .from("learner_profiles")
    .update({ goals: input.goals, updated_at: new Date().toISOString() })
    .eq("id", session.userId);

  return runtimeFindOnboardingSession(input.sessionId);
}

export async function runtimeUpdateOnboardingCareerImport(input: {
  sessionId: string;
  careerPathId: string;
  careerCategoryLabel?: string;
  jobTitle?: string;
  yearsExperience?: "0-1" | "1-3" | "3-5" | "5-10" | "10+";
  companySize?: "startup" | "small" | "medium" | "large" | null;
  dailyWorkSummary?: string;
  keySkills?: string | null;
  aiComfort?: number;
  linkedinUrl?: string | null;
  resumeFilename?: string | null;
}) {
  if (mode() === "memory") return memUpdateOnboardingCareerImport(input);

  const session = await runtimeFindOnboardingSession(input.sessionId);
  if (!session) return null;

  const supabase = getSupabaseAdmin();
  await supabase
    .from("onboarding_sessions")
    .update({
      career_path_id: input.careerPathId,
      linkedin_url: input.linkedinUrl ?? null,
      resume_filename: input.resumeFilename ?? null,
      status: "assessment_pending",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.sessionId);

  const existingProfile = await getProfileRowById(session.userId);
  if (existingProfile) {
    const existingLinks = existingProfile.social_links ?? {};
    const linkedinUrl =
      typeof input.linkedinUrl === "string" && input.linkedinUrl.trim().length ? input.linkedinUrl.trim() : null;
    const parsedTools = parseSkillTools(input.keySkills);
    const mergedTools = Array.from(new Set([...(existingProfile.tools ?? []), ...parsedTools])).slice(0, 24);

    const nextLinks = {
      ...existingLinks,
      ...(linkedinUrl ? { linkedin: linkedinUrl } : {}),
    };

    const profilePatch: {
      career_path_id: string;
      headline?: string;
      bio?: string;
      tools?: string[];
      social_links?: Record<string, string>;
      updated_at: string;
    } = {
      career_path_id: input.careerPathId,
      updated_at: new Date().toISOString(),
    };

    if (input.jobTitle?.trim()) {
      profilePatch.headline = input.jobTitle.trim();
    }
    if (input.dailyWorkSummary?.trim()) {
      profilePatch.bio = input.dailyWorkSummary.trim().slice(0, 600);
    }
    if (mergedTools.length) {
      profilePatch.tools = mergedTools;
    }
    if (linkedinUrl || Object.keys(existingLinks).length) {
      profilePatch.social_links = nextLinks;
    }

    await supabase.from("learner_profiles").update(profilePatch).eq("id", existingProfile.id);
  }

  return runtimeFindOnboardingSession(input.sessionId);
}

export async function runtimeClaimOnboardingSession(input: {
  sessionId: string;
  authUserId: string;
  seed?: {
    name?: string;
    handleBase?: string;
    avatarUrl?: string | null;
  };
}) {
  const session = await runtimeFindOnboardingSession(input.sessionId);
  if (!session) return null;

  if (mode() === "memory") {
    const user = await runtimeFindUserById(input.authUserId);
    if (!user) return null;
    return {
      session,
      user,
      migrated: session.userId !== user.id,
    };
  }

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const targetProfile = await getOrCreateProfile({
    userId: input.authUserId,
    name: input.seed?.name,
    avatarUrl: input.seed?.avatarUrl ?? null,
    handleBase: input.seed?.handleBase,
    careerPathId: session.careerPathId ?? undefined,
  });

  const sourceProfileId = session.userId;
  if (sourceProfileId !== targetProfile.id) {
    await supabase
      .from("onboarding_sessions")
      .update({
        learner_profile_id: targetProfile.id,
        updated_at: now,
      })
      .eq("id", input.sessionId);

    await supabase
      .from("assessment_attempts")
      .update({
        learner_profile_id: targetProfile.id,
        updated_at: now,
      })
      .eq("learner_profile_id", sourceProfileId);

    const { data: sourceSkills } = await supabase
      .from("user_skill_evidence")
      .select("id,skill_name,status,score,evidence_count")
      .eq("learner_profile_id", sourceProfileId);
    const { data: targetSkills } = await supabase
      .from("user_skill_evidence")
      .select("id,skill_name,status,score,evidence_count")
      .eq("learner_profile_id", targetProfile.id);

    const targetSkillByName = new Map<
      string,
      { id: string; status: string; score: number; evidence_count: number }
    >();
    for (const row of targetSkills ?? []) {
      targetSkillByName.set(row.skill_name, row);
    }

    for (const sourceSkill of sourceSkills ?? []) {
      const existing = targetSkillByName.get(sourceSkill.skill_name);
      if (!existing) {
        await supabase
          .from("user_skill_evidence")
          .update({
            learner_profile_id: targetProfile.id,
            updated_at: now,
          })
          .eq("id", sourceSkill.id);
        continue;
      }

      const nextStatus =
        skillStatusRank(sourceSkill.status) > skillStatusRank(existing.status)
          ? sourceSkill.status
          : existing.status;

      await supabase
        .from("user_skill_evidence")
        .update({
          status: nextStatus,
          score: Math.max(Number(existing.score ?? 0), Number(sourceSkill.score ?? 0)),
          evidence_count: Math.max(0, Number(existing.evidence_count ?? 0) + Number(sourceSkill.evidence_count ?? 0)),
          updated_at: now,
        })
        .eq("id", existing.id);

      await supabase.from("user_skill_evidence").delete().eq("id", sourceSkill.id);
    }

    await supabase
      .from("projects")
      .update({
        learner_profile_id: targetProfile.id,
        updated_at: now,
      })
      .eq("learner_profile_id", sourceProfileId);

    await supabase
      .from("build_log_entries")
      .update({
        learner_profile_id: targetProfile.id,
      })
      .eq("learner_profile_id", sourceProfileId);

    await supabase
      .from("agent_jobs")
      .update({
        learner_profile_id: targetProfile.id,
        updated_at: now,
      })
      .eq("learner_profile_id", sourceProfileId);

    await supabase
      .from("agent_job_events")
      .update({
        learner_profile_id: targetProfile.id,
      })
      .eq("learner_profile_id", sourceProfileId);

    await supabase
      .from("social_drafts")
      .update({
        learner_profile_id: targetProfile.id,
        updated_at: now,
      })
      .eq("learner_profile_id", sourceProfileId);

    await supabase
      .from("daily_update_emails")
      .update({
        learner_profile_id: targetProfile.id,
      })
      .eq("learner_profile_id", sourceProfileId);

    const { data: sourceOauth } = await supabase
      .from("oauth_connections")
      .select("id,platform,connected,account_label")
      .eq("learner_profile_id", sourceProfileId);

    const { data: targetOauth } = await supabase
      .from("oauth_connections")
      .select("id,platform,connected,account_label")
      .eq("learner_profile_id", targetProfile.id);

    const targetByPlatform = new Map<string, { id: string; connected: boolean; account_label: string | null }>();
    for (const row of targetOauth ?? []) {
      targetByPlatform.set(row.platform, {
        id: row.id,
        connected: Boolean(row.connected),
        account_label: row.account_label ?? null,
      });
    }

    for (const row of sourceOauth ?? []) {
      const existing = targetByPlatform.get(row.platform);
      if (!existing) {
        await supabase
          .from("oauth_connections")
          .update({
            learner_profile_id: targetProfile.id,
            updated_at: now,
          })
          .eq("id", row.id);
        continue;
      }

      const nextConnected = existing.connected || Boolean(row.connected);
      const nextLabel = existing.account_label || row.account_label || null;

      await supabase
        .from("oauth_connections")
        .update({
          connected: nextConnected,
          account_label: nextLabel,
          connected_at: nextConnected ? now : null,
          updated_at: now,
        })
        .eq("id", existing.id);

      await supabase.from("oauth_connections").delete().eq("id", row.id);
    }
  }

  const refreshedSession = await runtimeFindOnboardingSession(input.sessionId);
  if (!refreshedSession) return null;

  const sourceProfile = await runtimeFindUserById(sourceProfileId);
  const currentTarget = await runtimeFindUserById(targetProfile.id);
  if (!currentTarget) return null;

  const mergedGoals = Array.from(
    new Set([
      ...(currentTarget.goals ?? []),
      ...(sourceProfile?.goals ?? []),
      ...(refreshedSession.goals ?? []),
    ]),
  ) as UserProfile["goals"];

  const socialLinks: UserProfile["socialLinks"] = {
    ...currentTarget.socialLinks,
  };
  if (refreshedSession.linkedinUrl?.trim()) {
    socialLinks.linkedin = refreshedSession.linkedinUrl.trim();
  } else if (!socialLinks.linkedin && sourceProfile?.socialLinks.linkedin) {
    socialLinks.linkedin = sourceProfile.socialLinks.linkedin;
  }

  const patch: Partial<UserProfile> = {
    careerPathId: refreshedSession.careerPathId ?? currentTarget.careerPathId,
    goals: mergedGoals,
    socialLinks,
  };

  const mergedTools = Array.from(
    new Set([...(currentTarget.tools ?? []), ...(sourceProfile?.tools ?? [])]),
  ).slice(0, 24);
  if (mergedTools.length) {
    patch.tools = mergedTools;
  }

  const defaultHeadline = "AI Builder";
  const defaultBio = "Building practical AI workflows and sharing public proof of execution.";
  const shouldReplaceHeadline =
    !currentTarget.headline || currentTarget.headline.trim().toLowerCase() === defaultHeadline.toLowerCase();
  const shouldReplaceBio = !currentTarget.bio || currentTarget.bio.trim() === defaultBio;
  if (sourceProfile?.headline && shouldReplaceHeadline) {
    patch.headline = sourceProfile.headline;
  }
  if (sourceProfile?.bio && shouldReplaceBio) {
    patch.bio = sourceProfile.bio;
  }

  if (!currentTarget.avatarUrl && (sourceProfile?.avatarUrl || input.seed?.avatarUrl)) {
    patch.avatarUrl = sourceProfile?.avatarUrl ?? input.seed?.avatarUrl ?? null;
  }
  if (input.seed?.name?.trim()) {
    patch.name = input.seed.name.trim();
  }

  const updatedUser = (await runtimeUpdateProfile(currentTarget.id, patch)) ?? currentTarget;

  return {
    session: refreshedSession,
    user: updatedUser,
    migrated: sourceProfileId !== updatedUser.id,
  };
}

export async function runtimeStartAssessment(userId: string) {
  if (mode() === "memory") return memStartAssessment(userId);

  const profile = await runtimeFindUserById(userId);
  if (!profile) return null;

  const supabase = getSupabaseAdmin();
  const row = {
    id: randomUUID(),
    learner_profile_id: profile.id,
    score: 0,
    answers: [],
    recommended_career_path_ids: [profile.careerPathId],
    started_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from("assessment_attempts").insert(row).select("*").single();
  if (error || !data) return null;

  return {
    id: data.id,
    userId: data.learner_profile_id,
    score: Number(data.score),
    startedAt: data.started_at,
    submittedAt: data.submitted_at,
    answers: data.answers ?? [],
    recommendedCareerPathIds: data.recommended_career_path_ids ?? [],
  } as AssessmentAttempt;
}

export async function runtimeSubmitAssessment(input: {
  assessmentId: string;
  answers: Array<{ questionId: string; value: number }>;
}) {
  if (mode() === "memory") return memSubmitAssessment(input);

  const supabase = getSupabaseAdmin();
  const { data: attempt } = await supabase
    .from("assessment_attempts")
    .select("*")
    .eq("id", input.assessmentId)
    .maybeSingle();
  if (!attempt) return null;

  const total = input.answers.reduce((sum, answer) => sum + Number(answer.value || 0), 0);
  const score = Number((input.answers.length ? total / input.answers.length / 5 : 0).toFixed(4));

  const allPathIds = CAREER_PATHS.map((entry) => entry.id);
  const profile = await runtimeFindUserById(attempt.learner_profile_id);
  const fallbackPath = profile?.careerPathId ?? allPathIds[0];

  const { data: latestOnboarding } = await supabase
    .from("onboarding_sessions")
    .select("career_path_id,goals,situation,ai_knowledge_score,updated_at")
    .eq("learner_profile_id", attempt.learner_profile_id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const careerFromOnboarding =
    typeof latestOnboarding?.career_path_id === "string" && allPathIds.includes(latestOnboarding.career_path_id)
      ? latestOnboarding.career_path_id
      : null;
  const primaryPath = careerFromOnboarding ?? fallbackPath;

  const answerMap = new Map(input.answers.map((entry) => [entry.questionId, Number(entry.value || 0)]));
  const aiComfort = answerMap.get("ai_comfort") ?? Math.max(1, Math.min(5, Math.round(score * 5)));
  const goals = Array.isArray(latestOnboarding?.goals)
    ? (latestOnboarding.goals.filter((entry): entry is string => typeof entry === "string") as string[])
    : [];

  const goalHintsByPath: Record<string, string[]> = {
    build_business: ["product-management", "marketing-seo", "sales-revops"],
    upskill_current_job: [primaryPath, "operations", "software-engineering"],
    showcase_for_job: ["software-engineering", "quality-assurance", "product-management"],
    learn_foundations: ["operations", "product-management", "software-engineering"],
    ship_ai_projects: ["software-engineering", "product-management", "customer-support"],
  };

  const recommended = new Set<string>();
  const pushPath = (candidate: string | null | undefined) => {
    if (!candidate) return;
    if (!allPathIds.includes(candidate)) return;
    recommended.add(candidate);
  };

  pushPath(primaryPath);

  for (const goal of goals) {
    for (const hinted of goalHintsByPath[goal] ?? []) {
      pushPath(hinted);
      if (recommended.size >= 3) break;
    }
    if (recommended.size >= 3) break;
  }

  if (recommended.size < 3) {
    if (aiComfort <= 2) {
      ["operations", "product-management", "customer-support"].forEach(pushPath);
    } else if (aiComfort >= 4) {
      ["software-engineering", "quality-assurance", "sales-revops"].forEach(pushPath);
    } else {
      ["product-management", "marketing-seo", "operations"].forEach(pushPath);
    }
  }

  if (recommended.size < 3) {
    const primaryIndex = Math.max(0, allPathIds.indexOf(primaryPath));
    pushPath(allPathIds[(primaryIndex + 1) % allPathIds.length]);
    pushPath(allPathIds[(primaryIndex + 2) % allPathIds.length]);
    pushPath(allPathIds[(primaryIndex + 3) % allPathIds.length]);
  }

  const recommendedCareerPathIds = Array.from(recommended).slice(0, 3);

  await supabase
    .from("assessment_attempts")
    .update({
      score,
      answers: input.answers,
      recommended_career_path_ids: recommendedCareerPathIds,
      submitted_at: new Date().toISOString(),
    })
    .eq("id", input.assessmentId);

  await supabase
    .from("learner_profiles")
    .update({
      career_path_id: recommendedCareerPathIds[0],
      tokens_used: Number(attempt.tokens_used ?? 0) + 500,
      updated_at: new Date().toISOString(),
    })
    .eq("id", attempt.learner_profile_id);

  const firstModules = CAREER_PATHS.find((path) => path.id === recommendedCareerPathIds[0])?.modules.slice(0, 2) ?? [];
  for (const moduleName of firstModules) {
    await upsertSkill({
      userId: attempt.learner_profile_id,
      skill: moduleName,
      status: "in_progress",
      score: Math.max(0.2, score * 0.8),
      evidenceDelta: 1,
    });
  }

  return {
    id: attempt.id,
    userId: attempt.learner_profile_id,
    score,
    startedAt: attempt.started_at,
    submittedAt: new Date().toISOString(),
    answers: input.answers,
    recommendedCareerPathIds,
  } as AssessmentAttempt;
}

export async function runtimeFindUserById(userId: string) {
  if (mode() === "memory") return memFindUserById(userId);

  const row = await getProfileRowById(userId);
  if (!row) return null;
  const skills = await getSkillsForProfile(row.id);
  return profileFromRow(row, skills);
}

export async function runtimeFindUserByHandle(handle: string) {
  if (mode() === "memory") return memFindUserByHandle(handle);
  const supabase = getSupabaseAdmin();

  const { data } = await supabase
    .from("learner_profiles")
    .select("id,handle,full_name,headline,bio,career_path_id,published,tokens_used,goals,tools,social_links,created_at,updated_at")
    .eq("handle", handle)
    .maybeSingle();
  if (!data) return null;

  const skills = await getSkillsForProfile(data.id);
  return profileFromRow(data, skills);
}

export async function runtimeUpdateProfile(userId: string, patch: Partial<UserProfile>) {
  if (mode() === "memory") return memUpdateProfile(userId, patch);
  const supabase = getSupabaseAdmin();
  const profile = await runtimeFindUserById(userId);
  if (!profile) return null;

  let handle = profile.handle;
  if (patch.handle && patch.handle !== profile.handle) {
    handle = safeHandle(patch.handle);
    let candidate = handle;
    let suffix = 2;
    while (true) {
      const { data } = await supabase.from("learner_profiles").select("id").eq("handle", candidate).maybeSingle();
      if (!data || data.id === profile.id) {
        handle = candidate;
        break;
      }
      candidate = `${handle}-${suffix}`;
      suffix += 1;
    }
  }

  const mergedSocialLinks = {
    ...profile.socialLinks,
    ...(patch.socialLinks ?? {}),
  };

  if (!mergedSocialLinks.website) {
    mergedSocialLinks.website = `${appBaseUrl()}/u/${handle}`;
  }

  const socialLinksPayload: Record<string, string> = {};
  for (const [key, value] of Object.entries(mergedSocialLinks)) {
    if (typeof value === "string" && value.trim().length) {
      socialLinksPayload[key] = value.trim();
    }
  }
  if (patch.avatarUrl !== undefined) {
    if (patch.avatarUrl) {
      socialLinksPayload.avatar = patch.avatarUrl;
    } else {
      delete socialLinksPayload.avatar;
    }
  } else if (profile.avatarUrl) {
    socialLinksPayload.avatar = profile.avatarUrl;
  }

  await supabase
    .from("learner_profiles")
    .update({
      handle,
      full_name: patch.name ?? profile.name,
      headline: patch.headline ?? profile.headline,
      bio: patch.bio ?? profile.bio,
      career_path_id: patch.careerPathId ?? profile.careerPathId,
      tools: patch.tools ?? profile.tools,
      social_links: socialLinksPayload,
      goals: patch.goals ?? profile.goals,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.id);

  return runtimeFindUserById(profile.id);
}

export async function runtimePublishProfile(userId: string) {
  if (mode() === "memory") return memPublishProfile(userId);

  const supabase = getSupabaseAdmin();
  const profile = await runtimeFindUserById(userId);
  if (!profile) return null;

  await supabase
    .from("learner_profiles")
    .update({ published: true, updated_at: new Date().toISOString() })
    .eq("id", profile.id);

  return runtimeFindUserById(profile.id);
}

export async function runtimeCreateProject(input: {
  userId: string;
  title: string;
  description: string;
  slug?: string;
}) {
  if (mode() === "memory") return memCreateProject(input);

  const supabase = getSupabaseAdmin();
  const profile = await runtimeFindUserById(input.userId);
  if (!profile) return null;

  const slugBase = safeHandle(input.slug ?? input.title) || `project-${Date.now()}`;
  let slug = slugBase;
  let suffix = 2;

  while (true) {
    const { data } = await supabase
      .from("projects")
      .select("id")
      .eq("learner_profile_id", profile.id)
      .eq("slug", slug)
      .maybeSingle();
    if (!data) break;
    slug = `${slugBase}-${suffix}`;
    suffix += 1;
  }

  const row = {
    id: randomUUID(),
    learner_profile_id: profile.id,
    slug,
    title: input.title,
    description: input.description,
    state: "planned",
  };

  const { data, error } = await supabase
    .from("projects")
    .insert(row)
    .select("id,learner_profile_id,slug,title,description,state,created_at,updated_at")
    .single();

  if (error || !data) return null;

  await appendBuildLog({
    projectId: data.id,
    userId: profile.id,
    level: "info",
    message: `Project ${data.title} created.`,
  });

  return projectFromRow(data);
}

export async function runtimeFindProjectById(projectId: string) {
  if (mode() === "memory") return memFindProjectById(projectId);
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("projects")
    .select("id,learner_profile_id,slug,title,description,state,created_at,updated_at")
    .eq("id", projectId)
    .maybeSingle();
  if (!data) return null;
  return projectFromRow(data);
}

export async function runtimeFindProjectBySlug(slug: string) {
  if (mode() === "memory") return memFindProjectBySlug(slug);
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("projects")
    .select("id,learner_profile_id,slug,title,description,state,created_at,updated_at")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  return projectFromRow(data);
}

export async function runtimeListProjectsByUser(userId: string) {
  if (mode() === "memory") return memListProjectsByUser(userId);
  return getProjectsByUserFromDb(userId);
}

async function generateTutorReply(input: {
  profile: UserProfile;
  project: Project;
  message: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY_MISSING");
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
  const prompt = [
    `You are ${BRAND_NAME}, a practical coding tutor.`,
    `Learner name: ${input.profile.name}`,
    `Learner role: ${input.profile.headline || "AI Builder"}`,
    `Project: ${input.project.title}`,
    `Project description: ${input.project.description}`,
    "Respond in <= 6 sentences with concrete next steps and one verification check.",
    `Learner message: ${input.message}`,
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: prompt,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OPENAI_RESPONSE_FAILED:${response.status}:${detail.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };

  const fromOutputText = typeof data.output_text === "string" ? data.output_text.trim() : "";
  if (fromOutputText) return fromOutputText;

  const firstText = data.output
    ?.flatMap((entry) => entry.content ?? [])
    .find((entry) => entry.type === "output_text" || entry.type === "text")?.text;

  if (firstText?.trim()) return firstText.trim();
  throw new Error("OPENAI_EMPTY_RESPONSE");
}

export async function runtimeAddProjectChatMessage(input: {
  projectId: string;
  userId: string;
  message: string;
  forceFailCode?: string;
}) {
  if (mode() === "memory") return memAddProjectChatMessage(input);

  const project = await runtimeFindProjectById(input.projectId);
  const profile = await runtimeFindUserById(input.userId);
  if (!project || !profile) return null;

  await appendBuildLog({
    projectId: project.id,
    userId: profile.id,
    level: "info",
    message: `User message: ${input.message}`,
  });

  const jobId = await createJob({
    userId: profile.id,
    projectId: project.id,
    type: "project.chat",
    payload: { message: input.message, forceFailCode: input.forceFailCode ?? null },
  });

  const supabase = getSupabaseAdmin();

  if (input.forceFailCode) {
    await supabase
      .from("agent_jobs")
      .update({ status: "failed", last_error_code: input.forceFailCode, updated_at: new Date().toISOString() })
      .eq("id", jobId);

    await insertJobEvent({
      jobId,
      userId: profile.id,
      projectId: project.id,
      type: "job.failed",
      message: `project.chat failed (${input.forceFailCode})`,
      payload: { errorCode: input.forceFailCode },
    });

    await appendBuildLog({
      projectId: project.id,
      userId: profile.id,
      level: "error",
      message: `Job project.chat failed with ${input.forceFailCode}`,
    });

    return {
      job: { id: jobId, status: "failed", lastErrorCode: input.forceFailCode },
      result: { ok: false, job: { id: jobId, lastErrorCode: input.forceFailCode } },
      reply: null,
    };
  }

  try {
    const reply = await generateTutorReply({
      profile,
      project,
      message: input.message,
    });
    const normalizedReply = /^my ai skill tutor:/i.test(reply.trim()) ? reply.trim() : `${BRAND_NAME}: ${reply.trim()}`;

    await supabase
      .from("agent_jobs")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", jobId);

    await insertJobEvent({
      jobId,
      userId: profile.id,
      projectId: project.id,
      type: "job.completed",
      message: "project.chat completed",
    });

    await appendBuildLog({
      projectId: project.id,
      userId: profile.id,
      level: "success",
      message: `${BRAND_NAME} reply generated for: ${input.message.slice(0, 80)}`,
      metadata: {
        model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      },
    });

    await touchProfileTokenUsage(profile.id, Math.max(80, Math.min(1200, Math.round(input.message.length * 1.8))));

    return {
      job: { id: jobId, status: "completed", lastErrorCode: null },
      result: { ok: true, job: { id: jobId, lastErrorCode: null } },
      reply: normalizedReply,
    };
  } catch (error) {
    const failureCode = error instanceof Error && error.message.startsWith("OPENAI_API_KEY_MISSING")
      ? "OPENAI_CONFIG_MISSING"
      : "OPENAI_CHAT_FAILED";

    await supabase
      .from("agent_jobs")
      .update({ status: "failed", last_error_code: failureCode, updated_at: new Date().toISOString() })
      .eq("id", jobId);

    await insertJobEvent({
      jobId,
      userId: profile.id,
      projectId: project.id,
      type: "job.failed",
      message: `project.chat failed (${failureCode})`,
      payload: {
        failureCode,
        reason: error instanceof Error ? error.message : "UNKNOWN",
      },
    });

    await appendBuildLog({
      projectId: project.id,
      userId: profile.id,
      level: "error",
      message: `${BRAND_NAME} response failed: ${failureCode}`,
      metadata: {
        reason: error instanceof Error ? error.message : "UNKNOWN",
      },
    });

    return {
      job: { id: jobId, status: "failed", lastErrorCode: failureCode },
      result: { ok: false, job: { id: jobId, lastErrorCode: failureCode } },
      reply: null,
    };
  }
}

export async function runtimeRequestArtifactGeneration(input: {
  projectId: string;
  userId: string;
  kind: "website" | "pptx" | "pdf" | "resume_docx" | "resume_pdf";
  forceFailCode?: string;
}) {
  if (mode() === "memory") return memRequestArtifactGeneration(input);

  const project = await runtimeFindProjectById(input.projectId);
  const profile = await runtimeFindUserById(input.userId);
  if (!project || !profile) return null;

  const supabase = getSupabaseAdmin();

  await supabase.from("projects").update({ state: "building", updated_at: new Date().toISOString() }).eq("id", project.id);

  const jobId = await createJob({
    userId: profile.id,
    projectId: project.id,
    type: input.kind === "website" ? "project.generate_website" : "project.generate_artifact",
    payload: { kind: input.kind, forceFailCode: input.forceFailCode ?? null },
  });

  if (input.forceFailCode) {
    await supabase
      .from("agent_jobs")
      .update({ status: "failed", last_error_code: input.forceFailCode, updated_at: new Date().toISOString() })
      .eq("id", jobId);

    await insertJobEvent({
      jobId,
      userId: profile.id,
      projectId: project.id,
      type: "job.failed",
      message: `${input.kind} generation failed (${input.forceFailCode})`,
      payload: { errorCode: input.forceFailCode },
    });

    await appendBuildLog({
      projectId: project.id,
      userId: profile.id,
      level: "error",
      message: `Artifact generation failed for ${input.kind}: ${input.forceFailCode}`,
    });

    return {
      job: { id: jobId, status: "failed", lastErrorCode: input.forceFailCode },
      result: { ok: false, job: { id: jobId, lastErrorCode: input.forceFailCode } },
      project: await runtimeFindProjectById(project.id),
    };
  }

  const artifactUrl = `/generated/${project.slug}/${input.kind}-${Date.now()}.${
    input.kind === "website" ? "html" : input.kind === "pptx" ? "pptx" : input.kind === "resume_docx" ? "docx" : "pdf"
  }`;

  await supabase.from("project_artifacts").insert({
    id: randomUUID(),
    project_id: project.id,
    kind: input.kind,
    url: artifactUrl,
  });

  await appendBuildLog({
    projectId: project.id,
    userId: profile.id,
    level: "success",
    message: `Artifact generated: ${input.kind}`,
  });

  await supabase.from("projects").update({ state: "built", updated_at: new Date().toISOString() }).eq("id", project.id);

  await supabase
    .from("agent_jobs")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", jobId);

  await insertJobEvent({
    jobId,
    userId: profile.id,
    projectId: project.id,
    type: "job.completed",
    message: `${input.kind} generation completed`,
  });

  await upsertSkill({
    userId: profile.id,
    skill: CAREER_PATHS.find((path) => path.id === profile.careerPathId)?.modules[0] ?? "Applied AI",
    status: "built",
    score: Math.max(getVerificationPolicy().projectMinScore + 0.1, 0.5),
    evidenceDelta: 1,
  });

  await touchProfileTokenUsage(profile.id, 950);

  return {
    job: { id: jobId, status: "completed", lastErrorCode: null },
    result: { ok: true, job: { id: jobId, lastErrorCode: null } },
    project: await runtimeFindProjectById(project.id),
  };
}

export async function runtimeListProjectEvents(projectId: string) {
  if (mode() === "memory") return memListProjectEvents(projectId);

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("agent_job_events")
    .select("id,job_id,learner_profile_id,project_id,event_type,message,created_at,payload")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  return (data ?? []).map((row) => ({
    id: row.id,
    jobId: row.job_id,
    userId: row.learner_profile_id,
    projectId: row.project_id,
    type: row.event_type,
    message: row.message,
    createdAt: row.created_at,
    payload: row.payload ?? {},
  }));
}

export async function runtimeGetDashboardSummary(
  userId: string,
  seed?: {
    name?: string;
    handleBase?: string;
    avatarUrl?: string | null;
    email?: string | null;
  },
): Promise<DashboardSummary | null> {
  if (mode() === "memory") return memGetDashboardSummary(userId);

  let profile = await runtimeFindUserById(userId);
  if (!profile) {
    profile = await getOrCreateProfile({
      userId,
      name: seed?.name ?? "New Learner",
      avatarUrl: seed?.avatarUrl ?? null,
      handleBase: seed?.handleBase ?? "learner",
    });
  }
  if (!profile) return null;

  await maybeSendWelcomeEmail({
    profileId: profile.id,
    email: seed?.email ?? null,
    name: profile.name,
    handle: profile.handle,
  });

  // Avoid swapping frequently-changing provider avatar URLs on every request,
  // which can cause visual flicker on dashboard refresh/navigation.
  if (!profile.avatarUrl && seed?.avatarUrl) {
    const refreshed = await runtimeUpdateProfile(profile.id, { avatarUrl: seed.avatarUrl });
    if (refreshed) {
      profile = refreshed;
    }
  }

  let projects = await runtimeListProjectsByUser(profile.id);
  if (!projects.length) {
    const career = CAREER_PATHS.find((path) => path.id === profile.careerPathId);
    const starterTitle = career ? `${career.name} Starter Build` : "AI Starter Build";
    const starterDescription = career
      ? `Starter project generated from your ${career.name} path to begin collecting proof artifacts.`
      : "Starter project generated from onboarding to begin collecting proof artifacts.";

    await runtimeCreateProject({
      userId: profile.id,
      title: starterTitle,
      description: starterDescription,
      slug: "starter-build",
    });

    projects = await runtimeListProjectsByUser(profile.id);
  }

  const supabase = getSupabaseAdmin();

  const { data: jobs } = await supabase
    .from("agent_jobs")
    .select("id,type,status,attempts,max_attempts,payload,created_at,updated_at,lease_until,last_error_code,project_id,learner_profile_id")
    .eq("learner_profile_id", profile.id)
    .in("status", ["queued", "claimed", "running"])
    .order("created_at", { ascending: false });

  const { data: events } = await supabase
    .from("agent_job_events")
    .select("id,job_id,learner_profile_id,project_id,event_type,message,created_at,payload")
    .eq("learner_profile_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const daily = await getLatestDailyUpdate(profile.id);

  return {
    user: profile,
    projects,
    pendingJobs: (jobs ?? []).map((job) => ({
      id: job.id,
      projectId: job.project_id,
      userId: job.learner_profile_id,
      type: job.type,
      payload: job.payload ?? {},
      status: job.status,
      attempts: job.attempts,
      maxAttempts: job.max_attempts,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
      leaseUntil: job.lease_until,
      lastErrorCode: job.last_error_code,
    })),
    latestEvents: (events ?? []).map((event) => ({
      id: event.id,
      jobId: event.job_id,
      userId: event.learner_profile_id,
      projectId: event.project_id,
      type: event.event_type,
      message: event.message,
      createdAt: event.created_at,
      payload: event.payload ?? {},
    })),
    moduleRecommendations: MODULE_TRACKS.filter((track) => track.careerPathId === profile.careerPathId),
    dailyUpdate: daily,
  };
}

function sanitizeSocialText(text: string, targetUrl: string) {
  const normalized = String(text ?? "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!normalized) return targetUrl;
  if (normalized.includes(targetUrl)) return normalized;
  return `${normalized}\n\n${targetUrl}`;
}

function socialShareUrl(platform: SocialPlatform, text: string) {
  return platform === "linkedin"
    ? `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`
    : `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

function extractOpenAiOutputText(data: {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
}) {
  const fromOutputText = typeof data.output_text === "string" ? data.output_text.trim() : "";
  if (fromOutputText) return fromOutputText;
  const firstText = data.output
    ?.flatMap((entry) => entry.content ?? [])
    .find((entry) => entry.type === "output_text" || entry.type === "text")?.text;
  return firstText?.trim() || "";
}

function parseIdeaPayload(raw: string): { linkedin: string; x: string; contextLabel: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(withoutFence) as {
      linkedin?: unknown;
      x?: unknown;
      contextLabel?: unknown;
    };
    if (typeof parsed.linkedin !== "string" || typeof parsed.x !== "string") return null;
    const contextLabel =
      typeof parsed.contextLabel === "string" && parsed.contextLabel.trim().length
        ? parsed.contextLabel.trim().slice(0, 80)
        : "Fresh idea";
    return {
      linkedin: parsed.linkedin,
      x: parsed.x,
      contextLabel,
    };
  } catch {
    return null;
  }
}

export async function runtimeGenerateSocialIdeas(input: {
  userId: string;
  projectId?: string | null;
  seed?: {
    name?: string;
    handleBase?: string;
    avatarUrl?: string | null;
    email?: string | null;
  };
}) {
  const summary =
    mode() === "memory"
      ? memGetDashboardSummary(input.userId)
      : await runtimeGetDashboardSummary(input.userId, input.seed);

  if (!summary) {
    return { ok: false as const, errorCode: "USER_NOT_FOUND", ideas: null, memorySignals: [] as string[] };
  }

  const chosenProject =
    (input.projectId ? summary.projects.find((entry) => entry.id === input.projectId) : null) ??
    summary.projects.find((entry) => entry.state === "building" || entry.state === "built" || entry.state === "showcased") ??
    summary.projects[0] ??
    null;

  const baseUrl = appBaseUrl();
  const profileUrl = `${baseUrl}/u/${summary.user.handle}`;
  const targetUrl = chosenProject ? `${profileUrl}/projects/${chosenProject.slug}` : profileUrl;
  const memorySignals: string[] = [];

  if (summary.user.goals.length) {
    memorySignals.push(`goals:${summary.user.goals.slice(0, 2).join(",")}`);
  }
  if (summary.user.tools.length) {
    memorySignals.push(`tools:${summary.user.tools.slice(0, 4).join(",")}`);
  }
  if (summary.user.skills.length) {
    const topSkills = summary.user.skills
      .slice()
      .sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0))
      .slice(0, 3)
      .map((entry) => entry.skill);
    if (topSkills.length) {
      memorySignals.push(`skills:${topSkills.join(",")}`);
    }
  }
  if (summary.latestEvents.length) {
    memorySignals.push(`events:${summary.latestEvents.slice(0, 2).map((entry) => entry.message).join(" | ")}`);
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false as const,
      errorCode: "OPENAI_CONFIG_MISSING",
      ideas: null,
      memorySignals,
    };
  }

  const projectMemory = chosenProject
    ? [
      `Project title: ${chosenProject.title}`,
      `Project description: ${chosenProject.description}`,
      `Project state: ${chosenProject.state}`,
      chosenProject.buildLog.length
        ? `Recent build log: ${chosenProject.buildLog.slice(-2).map((entry) => entry.message).join(" | ")}`
        : "Recent build log: none",
    ]
    : ["No specific project selected."];

  const prompt = [
    `You are a social media strategist for ${BRAND_NAME}.`,
    "Create two original post drafts based on this learner memory context.",
    "Return JSON only with keys: linkedin, x, contextLabel.",
    "Constraints:",
    "- linkedin: professional voice, 2-4 short paragraphs, no markdown headings.",
    "- x: concise tweet-style post, <= 260 characters before URL, no numbering.",
    "- contextLabel: short 2-5 word label.",
    `- include this URL exactly once in each post: ${targetUrl}`,
    `Learner name: ${summary.user.name}`,
    `Learner headline: ${summary.user.headline || "AI Builder"}`,
    `Learner goals: ${summary.user.goals.join(", ") || "none"}`,
    `Learner tools: ${summary.user.tools.join(", ") || "none"}`,
    `Top skills: ${summary.user.skills
      .slice(0, 5)
      .map((entry) => `${entry.skill} (${Math.round((entry.score || 0) * 100)}%)`)
      .join(", ") || "none"}`,
    `Recent events: ${summary.latestEvents.slice(0, 4).map((entry) => entry.message).join(" | ") || "none"}`,
    ...projectMemory,
    "Avoid cliches and keep the writing specific.",
  ].join("\n");

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
        input: prompt,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OPENAI_RESPONSE_FAILED:${response.status}`);
    }

    const payload = (await response.json()) as {
      output_text?: string;
      output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
    };
    const outputText = extractOpenAiOutputText(payload);
    const ideas = parseIdeaPayload(outputText);
    if (!ideas) {
      throw new Error("OPENAI_SOCIAL_PARSE_FAILED");
    }

    return {
      ok: true as const,
      source: "llm" as const,
      ideas: {
        linkedin: sanitizeSocialText(ideas.linkedin, targetUrl),
        x: sanitizeSocialText(ideas.x, targetUrl),
        contextLabel: ideas.contextLabel,
        targetUrl,
      },
      memorySignals,
    };
  } catch (error) {
    return {
      ok: false as const,
      errorCode:
        error instanceof Error && error.message.startsWith("OPENAI_RESPONSE_FAILED")
          ? "OPENAI_SOCIAL_PROVIDER_FAILED"
          : "OPENAI_SOCIAL_FAILED",
      ideas: null,
      memorySignals,
    };
  }
}

export async function runtimeCreateSocialDrafts(input: {
  userId: string;
  projectId?: string | null;
  forceFailCode?: string;
}) {
  if (mode() === "memory") return memCreateSocialDrafts(input);
  if (input.forceFailCode) {
    return { ok: false as const, errorCode: input.forceFailCode, drafts: [] as SocialDraft[] };
  }

  const profile = await runtimeFindUserById(input.userId);
  if (!profile) return { ok: false as const, errorCode: "USER_NOT_FOUND", drafts: [] as SocialDraft[] };

  const project = input.projectId ? await runtimeFindProjectById(input.projectId) : null;
  const baseUrl = appBaseUrl();
  const profileUrl = `${baseUrl}/u/${profile.handle}`;
  const targetUrl = project ? `${profileUrl}/projects/${project.slug}` : profileUrl;
  const ogUrl = project
    ? `${baseUrl}/api/og/project/${profile.handle}/${project.slug}`
    : `${baseUrl}/api/og/profile/${profile.handle}`;

  const baseText = project
    ? `Shipped ${project.title} with ${BRAND_NAME}. Platform Verified build log + artifacts.`
    : `Building AI-native skills with ${BRAND_NAME}. Platform Verified projects and proof.`;

  const makeDraft = (platform: SocialPlatform, text: string): SocialDraft => ({
    id: randomUUID(),
    userId: profile.id,
    projectId: project?.id ?? null,
    platform,
    text,
    ogUrl,
    shareUrl: socialShareUrl(platform, text),
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const drafts = [
    makeDraft("linkedin", `${baseText} ${targetUrl}`),
    makeDraft("x", `${baseText} ${targetUrl}`),
  ];

  const supabase = getSupabaseAdmin();
  await supabase.from("social_drafts").insert(
    drafts.map((draft) => ({
      id: draft.id,
      learner_profile_id: draft.userId,
      project_id: draft.projectId,
      platform: draft.platform,
      text: draft.text,
      og_url: draft.ogUrl,
      share_url: draft.shareUrl,
      status: draft.status,
    })),
  );

  return { ok: true as const, drafts };
}

export async function runtimePublishSocialDraft(input: {
  draftId: string;
  mode: PublishMode;
  forceFailCode?: string;
}) {
  if (mode() === "memory") return memPublishSocialDraft(input);

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("social_drafts")
    .select("id,learner_profile_id,project_id,platform,text,og_url,share_url,status,created_at,updated_at")
    .eq("id", input.draftId)
    .maybeSingle();

  if (!data) return { ok: false as const, errorCode: "DRAFT_NOT_FOUND", draft: null };

  const draft: SocialDraft = {
    id: data.id,
    userId: data.learner_profile_id,
    projectId: data.project_id,
    platform: data.platform,
    text: data.text,
    ogUrl: data.og_url,
    shareUrl: data.share_url,
    status: data.status,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };

  if (input.forceFailCode) {
    await supabase
      .from("social_drafts")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", draft.id);
    draft.status = "failed";
    draft.updatedAt = new Date().toISOString();
    return { ok: false as const, errorCode: input.forceFailCode, draft };
  }

  if (input.mode === "api") {
    const oauthPlatform = draft.platform === "linkedin" ? "linkedin" : "x";
    const { data: connection } = await supabase
      .from("oauth_connections")
      .select("connected")
      .eq("learner_profile_id", draft.userId)
      .eq("platform", oauthPlatform)
      .maybeSingle();

    if (!connection?.connected) {
      await supabase
        .from("social_drafts")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", draft.id);
      draft.status = "failed";
      draft.updatedAt = new Date().toISOString();
      return { ok: false as const, errorCode: "OAUTH_NOT_CONNECTED", draft };
    }

    await supabase
      .from("social_drafts")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", draft.id);

    draft.status = "failed";
    draft.updatedAt = new Date().toISOString();
    return { ok: false as const, errorCode: "SOCIAL_API_POST_UNAVAILABLE", draft };
  }

  draft.updatedAt = new Date().toISOString();
  return { ok: true as const, draft, composerUrl: draft.shareUrl };
}

export async function runtimeConnectOAuth(userId: string, platform: "linkedin_profile" | "linkedin" | "x", accountLabel: string) {
  if (mode() === "memory") return memConnectOAuth(userId, platform, accountLabel);
  const supabase = getSupabaseAdmin();

  const payload = {
    learner_profile_id: normalizeUserId(userId),
    platform,
    connected: true,
    account_label: accountLabel,
    connected_at: new Date().toISOString(),
    last_error_code: null,
  };

  const { data, error } = await supabase
    .from("oauth_connections")
    .upsert(payload, { onConflict: "learner_profile_id,platform" })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error("OAUTH_CONNECT_FAILED");
  }
  return {
    userId: data.learner_profile_id,
    platform: data.platform,
    connected: data.connected,
    accountLabel: data.account_label,
    connectedAt: data.connected_at,
    lastErrorCode: data.last_error_code,
  };
}

export async function runtimeMarkOAuthFailure(userId: string, platform: "linkedin_profile" | "linkedin" | "x", code: string) {
  if (mode() === "memory") return memMarkOAuthFailure(userId, platform, code);
  const supabase = getSupabaseAdmin();

  const payload = {
    learner_profile_id: normalizeUserId(userId),
    platform,
    connected: false,
    account_label: null,
    connected_at: null,
    last_error_code: code,
  };

  const { data } = await supabase
    .from("oauth_connections")
    .upsert(payload, { onConflict: "learner_profile_id,platform" })
    .select("*")
    .single();

  return {
    userId: data?.learner_profile_id,
    platform: data?.platform,
    connected: data?.connected,
    accountLabel: data?.account_label,
    connectedAt: data?.connected_at,
    lastErrorCode: data?.last_error_code,
  };
}

export async function runtimeQueueAgentMemoryRefreshJob(input: { userId: string; reason?: string }) {
  if (mode() === "memory") {
    return { ok: true as const, queued: false, jobId: null, errorCode: null };
  }

  const profile = await runtimeFindUserById(input.userId);
  if (!profile) {
    return { ok: false as const, queued: false, jobId: null, errorCode: "USER_NOT_FOUND" };
  }

  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase
    .from("agent_jobs")
    .select("id")
    .eq("learner_profile_id", profile.id)
    .eq("type", "memory.refresh")
    .in("status", ["queued", "claimed", "running"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    return { ok: true as const, queued: false, jobId: existing.id, errorCode: null };
  }

  const jobId = await createJob({
    userId: profile.id,
    projectId: null,
    type: "memory.refresh",
    payload: {
      reason: input.reason ?? "manual_request",
    },
  });

  return { ok: true as const, queued: true, jobId, errorCode: null };
}

export async function runtimeRefreshRelevantNews(options?: { forceFailCode?: string }) {
  if (mode() === "memory") return memRefreshRelevantNews(options);
  if (options?.forceFailCode) {
    return { ok: false as const, errorCode: options.forceFailCode, insights: [] };
  }

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const rows = [
    {
      id: randomUUID(),
      title: "AI tooling update: model context windows and eval tooling",
      url: "https://example.com/ai-news/context-evals",
      summary: "New eval practices improve reliability for production copilots.",
      career_path_ids: ["software-engineering", "quality-assurance"],
      published_at: now,
    },
    {
      id: randomUUID(),
      title: "Agentic workflows in go-to-market automation",
      url: "https://example.com/ai-news/gtm-agents",
      summary: "Marketing and RevOps teams are shipping multi-agent outbound systems.",
      career_path_ids: ["marketing-seo", "sales-revops"],
      published_at: now,
    },
    {
      id: randomUUID(),
      title: "Retrieval best practices for support copilots",
      url: "https://example.com/ai-news/support-rag",
      summary: "RAG quality gates and routing now standard for support agents.",
      career_path_ids: ["customer-support", "operations"],
      published_at: now,
    },
  ];

  await supabase.from("news_insights").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("news_insights").insert(rows);

  const { data: profiles } = await supabase.from("learner_profiles").select("id");
  for (const profile of profiles ?? []) {
    await runtimeQueueAgentMemoryRefreshJob({
      userId: profile.id,
      reason: "news_refresh",
    });
  }

  return {
    ok: true as const,
    insights: rows.map((row) => ({
      id: row.id,
      title: row.title,
      url: row.url,
      summary: row.summary,
      careerPathIds: row.career_path_ids,
      publishedAt: row.published_at,
    })),
  };
}

export async function runtimeCreateDailyUpdate(input: { userId: string; forceFailCode?: string }) {
  if (mode() === "memory") return memCreateDailyUpdate(input);

  const profile = await runtimeFindUserById(input.userId);
  if (!profile) return { ok: false as const, errorCode: "USER_NOT_FOUND", update: null };

  const supabase = getSupabaseAdmin();
  if (input.forceFailCode) {
    const failed = {
      id: randomUUID(),
      learner_profile_id: profile.id,
      status: "failed",
      summary: "Daily update failed due to provider error.",
      upcoming_tasks: [],
      news_ids: [],
      failure_code: input.forceFailCode,
    };

    await supabase.from("daily_update_emails").insert(failed);

    return {
      ok: false as const,
      errorCode: input.forceFailCode,
      update: {
        id: failed.id,
        userId: profile.id,
        status: "failed",
        summary: failed.summary,
        upcomingTasks: [],
        newsIds: [],
        createdAt: new Date().toISOString(),
        failureCode: input.forceFailCode,
      } as DailyUpdate,
    };
  }

  const projects = await runtimeListProjectsByUser(profile.id);
  const { data: news } = await supabase.from("news_insights").select("id").order("published_at", { ascending: false }).limit(3);

  const payload = {
    id: randomUUID(),
    learner_profile_id: profile.id,
    status: "sent",
    summary: `You have ${projects.length} active projects and ${profile.skills.length} tracked skills.`,
    upcoming_tasks: [
      "Complete one module checkpoint",
      "Generate one new artifact",
      "Publish one social post draft",
    ],
    news_ids: (news ?? []).map((entry) => entry.id),
    failure_code: null,
  };

  await supabase.from("daily_update_emails").insert(payload);

  return {
    ok: true as const,
    update: {
      id: payload.id,
      userId: profile.id,
      status: "sent",
      summary: payload.summary,
      upcomingTasks: payload.upcoming_tasks,
      newsIds: payload.news_ids,
      createdAt: new Date().toISOString(),
      failureCode: null,
    } as DailyUpdate,
  };
}

export async function runtimeListTalent(filters?: Parameters<typeof listTalent>[0]) {
  if (mode() === "memory") return listTalent(filters);

  const supabase = getSupabaseAdmin();
  const synthetic = listTalent();

  const { data: profiles, error } = await supabase
    .from("learner_profiles")
    .select("id,handle,full_name,headline,career_path_id,published,tools,goals,social_links,updated_at")
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error || !profiles?.length) {
    return listTalent(filters);
  }

  const profileIds = profiles.map((profile) => profile.id);
  const { data: skills } = await supabase
    .from("user_skill_evidence")
    .select("learner_profile_id,skill_name,status,score,evidence_count")
    .in("learner_profile_id", profileIds);

  const { data: situations } = await supabase
    .from("onboarding_sessions")
    .select("learner_profile_id,situation,updated_at")
    .in("learner_profile_id", profileIds)
    .order("updated_at", { ascending: false });

  const skillMap = new Map<string, Array<{ skill_name: string; status: string; score: number; evidence_count: number }>>();
  for (const skill of skills ?? []) {
    const list = skillMap.get(skill.learner_profile_id) ?? [];
    list.push(skill);
    skillMap.set(skill.learner_profile_id, list);
  }

  const situationMap = new Map<string, string | null>();
  for (const row of situations ?? []) {
    if (!situationMap.has(row.learner_profile_id)) {
      situationMap.set(row.learner_profile_id, row.situation);
    }
  }

  const careerTypeMap: Record<string, string> = {
    employed: "Employed",
    unemployed: "Unemployed",
    student: "Student",
    founder: "Founder",
    freelancer: "Freelancer",
    career_switcher: "Career Switcher",
  };

  const real: TalentCard[] = profiles
    .filter((profile) => profile.published)
    .map((profile) => {
      const candidateSkills = skillMap.get(profile.id) ?? [];
      const sortedSkills = [...candidateSkills].sort(
        (a, b) => Number(b.score ?? 0) - Number(a.score ?? 0) || Number(b.evidence_count ?? 0) - Number(a.evidence_count ?? 0),
      );

      const topSkills = sortedSkills.slice(0, 3).map((entry) => entry.skill_name);
      const topTools = (profile.tools ?? []).slice(0, 3);
      const topStatus = sortedSkills.reduce<TalentCard["status"]>((current, entry) => {
        const next = entry.status as TalentCard["status"];
        return skillStatusRank(next) > skillStatusRank(current) ? next : current;
      }, "not_started");

      const scoreBasis = sortedSkills.length
        ? sortedSkills.reduce((sum, entry) => sum + Number(entry.score ?? 0), 0) / sortedSkills.length
        : 0;

      const careerPathName = getCatalogData().careerPaths.find((path) => path.id === profile.career_path_id)?.name;
      const role = profile.headline?.trim() || careerPathName || "AI Builder";
      const situation = situationMap.get(profile.id);

      return {
        handle: profile.handle,
        name: profile.full_name,
        avatarUrl:
          typeof profile.social_links?.avatar === "string"
            ? profile.social_links.avatar
            : null,
        careerType: careerTypeMap[situation ?? ""] ?? "Employed",
        role,
        status: topStatus,
        topSkills: topSkills.length ? topSkills : ["AI Foundations"],
        topTools: topTools.length ? topTools : [BRAND_NAME],
        evidenceScore: Math.max(0, Math.min(100, Math.round(scoreBasis * 100))),
      };
    });

  const mergedByHandle = new Map<string, TalentCard>();
  for (const candidate of synthetic) mergedByHandle.set(candidate.handle, candidate);
  for (const candidate of real) mergedByHandle.set(candidate.handle, candidate);

  const all = [...mergedByHandle.values()];
  const query = filters?.q?.toLowerCase().trim();

  return all.filter((candidate) => {
    if (filters?.role && candidate.role !== filters.role) return false;
    if (filters?.skill && !candidate.topSkills.includes(filters.skill)) return false;
    if (filters?.tool && !candidate.topTools.includes(filters.tool)) return false;
    if (filters?.status && candidate.status !== filters.status) return false;
    if (query) {
      const haystack = `${candidate.handle} ${candidate.name} ${candidate.role} ${candidate.topSkills.join(" ")} ${candidate.topTools.join(" ")}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

export async function runtimeGetTalentByHandle(handle: string) {
  if (mode() === "memory") return getTalentByHandle(handle);

  const profile = await runtimeFindUserByHandle(handle);
  if (profile?.published) {
    const topSkills = [...profile.skills]
      .sort((a, b) => b.score - a.score || b.evidenceCount - a.evidenceCount)
      .slice(0, 3)
      .map((entry) => entry.skill);

    const status = [...profile.skills].reduce<TalentCard["status"]>((current, entry) => {
      return skillStatusRank(entry.status) > skillStatusRank(current) ? entry.status : current;
    }, "not_started");

    const evidenceScore = profile.skills.length
      ? Math.round((profile.skills.reduce((sum, skill) => sum + skill.score, 0) / profile.skills.length) * 100)
      : 0;

    return {
      handle: profile.handle,
      name: profile.name,
      avatarUrl: profile.avatarUrl ?? null,
      careerType: profile.goals.includes("showcase_for_job") ? "Job Seeker" : "Employed",
      role: profile.headline || "AI Builder",
      status,
      topSkills: topSkills.length ? topSkills : ["AI Foundations"],
      topTools: profile.tools.length ? profile.tools.slice(0, 3) : [BRAND_NAME],
      evidenceScore: Math.max(0, Math.min(100, evidenceScore)),
    } as TalentCard;
  }

  return getTalentByHandle(handle);
}

export async function runtimeCreateEmployerLead(input: {
  employerName: string;
  employerEmail: string;
  handle: string;
  note: string;
}) {
  if (mode() === "memory") return memCreateEmployerLead(input);

  const supabase = getSupabaseAdmin();
  const row = {
    id: randomUUID(),
    employer_name: input.employerName,
    employer_email: input.employerEmail,
    handle: input.handle,
    note: input.note,
  };

  await supabase.from("employer_leads").insert(row);
  return {
    id: row.id,
    employerName: row.employer_name,
    employerEmail: row.employer_email,
    handle: row.handle,
    note: row.note,
    createdAt: new Date().toISOString(),
  };
}

export {
  getCatalogData,
  getEmployerFacets,
  generateProfileOgSvg,
  generateProjectOgSvg,
  jsonError,
  jsonOk,
};

export function runtimeMode() {
  return mode();
}
