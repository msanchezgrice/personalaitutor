import { createHash, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  CAREER_PATHS,
  MODULE_TRACKS,
  type AcquisitionAttribution,
  buildRecommendedModuleGuide,
  buildDashboardGamification,
  addProjectChatMessage as memAddProjectChatMessage,
  connectOAuth as memConnectOAuth,
  createDailyUpdate as memCreateDailyUpdate,
  createEmployerLead as memCreateEmployerLead,
  createOnboardingSession as memCreateOnboardingSession,
  createProject as memCreateProject,
  createSocialDrafts as memCreateSocialDrafts,
  findOnboardingSession as memFindOnboardingSession,
  getBillingSubscription as memGetBillingSubscription,
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
  listOAuthConnections as memListOAuthConnections,
  listProjectEvents as memListProjectEvents,
  listProjectsByUser as memListProjectsByUser,
  listTalent,
  markOAuthFailure as memMarkOAuthFailure,
  publishProfile as memPublishProfile,
  publishSocialDraft as memPublishSocialDraft,
  refreshRelevantNews as memRefreshRelevantNews,
  recordProjectArtifact as memRecordProjectArtifact,
  requestArtifactGeneration as memRequestArtifactGeneration,
  startAssessment as memStartAssessment,
  submitAssessment as memSubmitAssessment,
  syncProjectModuleSteps as memSyncProjectModuleSteps,
  updateOnboardingCareerImport as memUpdateOnboardingCareerImport,
  updateProjectModuleStep as memUpdateProjectModuleStep,
  updateOnboardingSituation as memUpdateOnboardingSituation,
  updateProfile as memUpdateProfile,
  upsertUserProfile as memUpsertUserProfile,
  upsertBillingSubscription as memUpsertBillingSubscription,
  type AssessmentAttempt,
  type BillingSubscription,
  type BillingSubscriptionStatus,
  type BuildLogEntry,
  type DailyUpdate,
  type DashboardSummary,
  type NewsInsight,
  type OAuthConnection,
  type OnboardingSession,
  type Project,
  type ProjectModuleStep,
  type ProjectModuleStepStatus,
  type PublishMode,
  type RecommendedModuleGuide,
  type RecommendedModuleToolActionKind,
  type SocialDraft,
  type SocialPlatform,
  type TalentCard,
  type UserProfile,
} from "@aitutor/shared";
import { BRAND_NAME, getSiteUrl } from "./site";
import { mergeAttribution } from "./attribution";
import { recordPersistedFunnelEvent } from "./funnel-events-server";
import { billingAccessAllowed, normalizeBillingStatus } from "./billing";

const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001";

type PersistenceMode = "memory" | "supabase";

export type SignupAuditChatSummary = {
  userMessageCount: number;
  lastUserMessageAt: string | null;
  lastUserMessage: string | null;
};

export type SignupAuditRecord = {
  profile: UserProfile & {
    contactEmail?: string | null;
  };
  externalUserId: string | null;
  posthogDistinctId: string | null;
  posthogPersonUrl: string | null;
  welcomeEmailSentAt: string | null;
  onboarding: OnboardingSession | null;
  assessment: AssessmentAttempt | null;
  projectCount: number;
  chat: SignupAuditChatSummary;
  resume: {
    fileName: string | null;
    signedUrl: string | null;
  };
};

export type SignupAuditProjectSummary = {
  id: string;
  slug: string;
  title: string;
  state: Project["state"];
  createdAt: string;
  updatedAt: string;
};

export type SignupAuditTimelineEntry = {
  id: string;
  timestamp: string;
  category: "attribution" | "signup" | "email" | "onboarding" | "assessment" | "project" | "chat" | "job";
  title: string;
  detail: string | null;
  projectId?: string | null;
};

export type SignupAuditDetail = SignupAuditRecord & {
  projects: SignupAuditProjectSummary[];
  timeline: SignupAuditTimelineEntry[];
};

export type RuntimeBillingAccessState = {
  profile: UserProfile | null;
  subscription: BillingSubscription | null;
  status: BillingSubscriptionStatus;
  accessAllowed: boolean;
};

type SignupAuditProfileRow = {
  id: string;
  external_user_id: string | null;
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
  acquisition?: Record<string, unknown> | null;
  contact_email: string | null;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
  welcome_email_sent_at: string | null;
};

type ProfileRow = {
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
  acquisition?: Record<string, unknown> | null;
  contact_email?: string | null;
  stripe_customer_id?: string | null;
  created_at: string;
  updated_at: string;
};

const PROFILE_SELECT_FIELDS =
  "id,handle,full_name,headline,bio,career_path_id,published,tokens_used,goals,tools,social_links,acquisition,contact_email,stripe_customer_id,created_at,updated_at";

type BillingSubscriptionRow = {
  learner_profile_id: string;
  stripe_subscription_id: string;
  stripe_customer_id: string | null;
  stripe_price_id: string;
  status: string;
  trial_ends_at: string | null;
  current_period_ends_at: string | null;
  cancel_at_period_end: boolean;
  last_webhook_event_id: string | null;
  last_webhook_received_at: string | null;
  created_at: string;
  updated_at: string;
};

type StripeWebhookEventStateRow = {
  stripe_event_id: string;
  event_type: string;
  learner_profile_id: string | null;
  state: "processing" | "processed";
  processed_at: string | null;
  created_at: string;
  updated_at: string;
};

const memoryStripeWebhookEvents = new Map<
  string,
  {
    eventType: string;
    userId: string | null;
    state: "processing" | "processed";
    processedAt: string | null;
  }
>();

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

function includeSyntheticTalent() {
  const explicit = process.env.INCLUDE_SYNTHETIC_TALENT?.trim().toLowerCase();
  if (explicit === "1" || explicit === "true") return true;
  if (explicit === "0" || explicit === "false") return false;
  return process.env.NODE_ENV !== "production";
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
  return getSiteUrl();
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

function parseAcquisition(input: unknown): AcquisitionAttribution | undefined {
  if (!input || typeof input !== "object") return undefined;
  const parsed = mergeAttribution(undefined, input as AcquisitionAttribution);
  return parsed ?? undefined;
}

const ONBOARDING_GOALS = new Set([
  "build_business",
  "upskill_current_job",
  "find_new_role",
  "showcase_for_job",
  "learn_foundations",
  "ship_ai_projects",
]);

const ONBOARDING_SITUATIONS = new Set([
  "employed",
  "unemployed",
  "student",
  "founder",
  "freelancer",
  "career_switcher",
]);

const ONBOARDING_CAREER_CATEGORIES = new Set([
  "product-manager",
  "sales",
  "customer-service",
  "operations",
  "hr",
  "designer",
  "marketing",
  "accounting",
  "legal",
  "software-engineering",
  "other",
]);

const ONBOARDING_YEARS_EXPERIENCE = new Set(["0-1", "1-3", "3-5", "5-10", "10+"]);
const ONBOARDING_COMPANY_SIZES = new Set(["startup", "small", "medium", "large"]);
const ONBOARDING_PATH_IDS = new Set(CAREER_PATHS.map((path) => path.id));

function hasOwnField(input: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(input, key);
}

function cleanOnboardingText(value: unknown, max = 300) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;
  return normalized.slice(0, max);
}

function parseOnboardingIntakeProfile(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;

  const source = input as Record<string, unknown>;
  const next: Record<string, unknown> = {};

  if (hasOwnField(source, "fullName")) {
    next.fullName = cleanOnboardingText(source.fullName, 120) ?? null;
  }
  if (hasOwnField(source, "careerCategory")) {
    const value = cleanOnboardingText(source.careerCategory, 80);
    next.careerCategory = value && ONBOARDING_CAREER_CATEGORIES.has(value) ? value : null;
  }
  if (hasOwnField(source, "careerCategoryLabel")) {
    next.careerCategoryLabel = cleanOnboardingText(source.careerCategoryLabel, 120) ?? null;
  }
  if (hasOwnField(source, "customCareerCategory")) {
    next.customCareerCategory = cleanOnboardingText(source.customCareerCategory, 120) ?? null;
  }
  if (hasOwnField(source, "careerPathId")) {
    const value = cleanOnboardingText(source.careerPathId, 80);
    next.careerPathId = value && ONBOARDING_PATH_IDS.has(value) ? value : null;
  }
  if (hasOwnField(source, "jobTitle")) {
    next.jobTitle = cleanOnboardingText(source.jobTitle, 160) ?? null;
  }
  if (hasOwnField(source, "yearsExperience")) {
    const value = cleanOnboardingText(source.yearsExperience, 20);
    next.yearsExperience = value && ONBOARDING_YEARS_EXPERIENCE.has(value) ? value : null;
  }
  if (hasOwnField(source, "companySize")) {
    const raw = source.companySize;
    if (raw === null) {
      next.companySize = null;
    } else {
      const value = cleanOnboardingText(raw, 20);
      next.companySize = value && ONBOARDING_COMPANY_SIZES.has(value) ? value : null;
    }
  }
  if (hasOwnField(source, "situation")) {
    const value = cleanOnboardingText(source.situation, 40);
    next.situation = value && ONBOARDING_SITUATIONS.has(value) ? value : null;
  }
  if (hasOwnField(source, "dailyWorkSummary")) {
    next.dailyWorkSummary = cleanOnboardingText(source.dailyWorkSummary, 4000) ?? null;
  }
  if (hasOwnField(source, "keySkills")) {
    next.keySkills = cleanOnboardingText(source.keySkills, 2000) ?? null;
  }
  if (hasOwnField(source, "linkedinUrl")) {
    next.linkedinUrl = cleanOnboardingText(source.linkedinUrl, 1000) ?? null;
  }
  if (hasOwnField(source, "selectedGoals") && Array.isArray(source.selectedGoals)) {
    next.selectedGoals = Array.from(
      new Set(
        source.selectedGoals.filter(
          (entry): entry is string => typeof entry === "string" && ONBOARDING_GOALS.has(entry),
        ),
      ),
    );
  }
  if (hasOwnField(source, "aiComfort")) {
    const value = Number(source.aiComfort);
    next.aiComfort = Number.isFinite(value) ? Math.max(1, Math.min(5, Math.round(value))) : null;
  }
  if (hasOwnField(source, "resumeFilename")) {
    next.resumeFilename = cleanOnboardingText(source.resumeFilename, 255) ?? null;
  }
  if (hasOwnField(source, "uploadedResumeName")) {
    next.uploadedResumeName = cleanOnboardingText(source.uploadedResumeName, 255) ?? null;
  }
  if (hasOwnField(source, "currentStep")) {
    const value = Number(source.currentStep);
    next.currentStep = Number.isFinite(value) ? Math.max(1, Math.min(5, Math.round(value))) : null;
  }

  return Object.keys(next).length ? next : undefined;
}

function mergeOnboardingIntakeProfile(existing: unknown, incoming: unknown): Record<string, unknown> {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  const next = parseOnboardingIntakeProfile(incoming);
  if (!next && !Object.keys(base).length) {
    return {};
  }

  return {
    ...base,
    ...(next ?? {}),
    savedAt: new Date().toISOString(),
  };
}

function parseStoredOnboardingIntakeProfile(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const raw = (input as Record<string, unknown>).intakeProfile;
  return parseOnboardingIntakeProfile(raw);
}

function buildOnboardingSessionAcquisition(
  attribution: AcquisitionAttribution | null | undefined,
  intakeProfile: Record<string, unknown> | undefined,
) {
  const next: Record<string, unknown> = {};
  const sanitizedAttribution = mergeAttribution(undefined, attribution) ?? undefined;
  if (sanitizedAttribution?.first) {
    next.first = sanitizedAttribution.first;
  }
  if (sanitizedAttribution?.last) {
    next.last = sanitizedAttribution.last;
  }
  if (intakeProfile && Object.keys(intakeProfile).length) {
    next.intakeProfile = intakeProfile;
  }
  return next;
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

function profileFromRow(row: ProfileRow, skills: UserProfile["skills"]): UserProfile {
  const links = row.social_links ?? {};
  return {
    id: row.id,
    handle: row.handle,
    name: row.full_name,
    avatarUrl: typeof links.avatar === "string" ? links.avatar : null,
    contactEmail: row.contact_email ?? null,
    stripeCustomerId: row.stripe_customer_id ?? null,
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
    acquisition: parseAcquisition(row.acquisition) ?? undefined,
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
    .select(PROFILE_SELECT_FIELDS)
    .eq("id", normalizedUserId)
    .single();

  if (!error && data) {
    return data;
  }

  if (!isUuid(userId)) {
    const { data: byExternal } = await supabase
      .from("learner_profiles")
      .select(PROFILE_SELECT_FIELDS)
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

function billingSubscriptionFromRow(row: BillingSubscriptionRow): BillingSubscription {
  return {
    userId: row.learner_profile_id,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    stripePriceId: row.stripe_price_id,
    status: row.status as BillingSubscription["status"],
    trialEndsAt: row.trial_ends_at,
    currentPeriodEndsAt: row.current_period_ends_at,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    lastWebhookEventId: row.last_webhook_event_id,
    lastWebhookReceivedAt: row.last_webhook_received_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getBillingSubscriptionRowByUserId(userId: string) {
  const supabase = getSupabaseAdmin();
  const normalizedUserId = normalizeUserId(userId);
  const { data } = await supabase
    .from("billing_subscriptions")
    .select(
      "learner_profile_id,stripe_subscription_id,stripe_customer_id,stripe_price_id,status,trial_ends_at,current_period_ends_at,cancel_at_period_end,last_webhook_event_id,last_webhook_received_at,created_at,updated_at",
    )
    .eq("learner_profile_id", normalizedUserId)
    .maybeSingle();

  return (data as BillingSubscriptionRow | null) ?? null;
}

async function getStripeWebhookEventProfileId(userId?: string | null) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) return null;
  const profile = await runtimeGetOrCreateProfile({ userId: normalizedUserId });
  return profile.id;
}

async function getOrCreateProfile(input: {
  userId?: string;
  name?: string;
  email?: string | null;
  avatarUrl?: string | null;
  handleBase?: string;
  careerPathId?: string;
  acquisition?: AcquisitionAttribution;
}) {
  const supabase = getSupabaseAdmin();
  const normalizedUserId = normalizeUserId(input.userId);
  const normalizedEmail = input.email?.trim().toLowerCase() || null;
  const inferredName =
    input.name?.trim() ||
    input.handleBase?.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) ||
    "New Learner";
  const defaultHeadline = "AI Builder";
  const defaultBio = "Building practical AI workflows and sharing public proof of execution.";

  const existing = await getProfileRowById(input.userId ?? normalizedUserId);
  if (existing) {
    const updates: Record<string, unknown> = {};
    const existingName = typeof existing.full_name === "string" ? existing.full_name.trim() : "";
    const existingHeadline = typeof existing.headline === "string" ? existing.headline.trim() : "";
    const existingBio = typeof existing.bio === "string" ? existing.bio.trim() : "";
    const links = existing.social_links ?? {};
    const nextLinks: Record<string, string> = {
      ...links,
    };

    if (input.name?.trim() && existingName !== input.name.trim()) {
      updates.full_name = input.name.trim();
      existing.full_name = input.name.trim();
    } else if (!existingName) {
      updates.full_name = inferredName;
      existing.full_name = inferredName;
    }

    if (!existingHeadline) {
      updates.headline = defaultHeadline;
      existing.headline = defaultHeadline;
    }

    if (!existingBio) {
      updates.bio = defaultBio;
      existing.bio = defaultBio;
    }

    if (!existing.career_path_id) {
      updates.career_path_id = input.careerPathId ?? CAREER_PATHS[0].id;
      existing.career_path_id = String(updates.career_path_id);
    }

    if (normalizedEmail && existing.contact_email !== normalizedEmail) {
      updates.contact_email = normalizedEmail;
      existing.contact_email = normalizedEmail;
    }

    const publicWebsite = `${appBaseUrl()}/u/${existing.handle}`;
    if (!nextLinks.website) {
      nextLinks.website = publicWebsite;
    }

    if (input.avatarUrl && nextLinks.avatar !== input.avatarUrl) {
      nextLinks.avatar = input.avatarUrl;
    }

    if (JSON.stringify(nextLinks) !== JSON.stringify(links)) {
      updates.social_links = nextLinks;
      existing.social_links = nextLinks;
    }

    if (input.acquisition) {
      const mergedAcquisition = mergeAttribution(
        parseAcquisition(existing.acquisition) ?? undefined,
        input.acquisition,
      );
      if (mergedAcquisition) {
        updates.acquisition = mergedAcquisition;
        existing.acquisition = mergedAcquisition as unknown as Record<string, unknown>;
      }
    }

    if (Object.keys(updates).length) {
      updates.updated_at = new Date().toISOString();
      await supabase.from("learner_profiles").update(updates).eq("id", existing.id);
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

  const selectFields = PROFILE_SELECT_FIELDS;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const insert = {
      id: normalizedUserId,
      auth_user_id: normalizedUserId,
      external_user_id: input.userId ?? null,
      contact_email: normalizedEmail,
      handle,
      full_name: inferredName,
      headline: defaultHeadline,
      bio: defaultBio,
      career_path_id: input.careerPathId ?? CAREER_PATHS[0].id,
      published: false,
      tokens_used: 0,
      goals: [],
      tools: [],
      social_links: {
        website: `${appBaseUrl()}/u/${handle}`,
        ...(input.avatarUrl ? { avatar: input.avatarUrl } : {}),
      },
      acquisition: input.acquisition ?? {},
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

export async function runtimeGetOrCreateProfile(input: {
  userId?: string;
  name?: string;
  email?: string | null;
  avatarUrl?: string | null;
  handleBase?: string;
  careerPathId?: string;
  acquisition?: AcquisitionAttribution;
}) {
  if (mode() === "memory") {
    const userId = input.userId ?? DEFAULT_USER_ID;
    const existing = memFindUserById(userId);
    const inferredName =
      input.name?.trim() ||
      input.handleBase?.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) ||
      existing?.name ||
      "New Learner";
    const nextHandle = safeHandle(input.handleBase ?? existing?.handle ?? input.name ?? userId) || existing?.handle || "learner";
    const mergedLinks = {
      ...(existing?.socialLinks ?? {}),
      website: existing?.socialLinks.website ?? `${appBaseUrl()}/u/${nextHandle}`,
    };

    return memUpsertUserProfile({
      id: userId,
      handle: existing?.handle ?? nextHandle,
      name: inferredName,
      avatarUrl: input.avatarUrl ?? existing?.avatarUrl ?? null,
      contactEmail: input.email?.trim().toLowerCase() || existing?.contactEmail || null,
      stripeCustomerId: existing?.stripeCustomerId ?? null,
      headline: existing?.headline ?? "AI Builder",
      bio: existing?.bio ?? "Building practical AI workflows and sharing public proof of execution.",
      careerPathId: input.careerPathId ?? existing?.careerPathId ?? CAREER_PATHS[0].id,
      skills: existing?.skills ?? [],
      tools: existing?.tools ?? [],
      socialLinks: mergedLinks,
      published: existing?.published ?? false,
      tokensUsed: existing?.tokensUsed ?? 0,
      goals: existing?.goals ?? [],
      acquisition: input.acquisition ?? existing?.acquisition,
    });
  }

  return getOrCreateProfile(input);
}

async function getProjectArtifacts(projectId: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("project_artifacts")
    .select("kind,url,created_at,metadata")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

async function getProjectModuleSteps(projectId: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("project_module_steps")
    .select("id,project_id,learner_profile_id,step_key,title,order_index,status,completed_at,updated_at")
    .eq("project_id", projectId)
    .order("order_index", { ascending: true });

  return (data ?? []).map((row) => ({
    id: row.id,
    projectId: row.project_id,
    userId: row.learner_profile_id,
    stepKey: row.step_key,
    title: row.title,
    orderIndex: Number(row.order_index ?? 0),
    status: row.status as ProjectModuleStepStatus,
    completedAt: row.completed_at ?? null,
    updatedAt: row.updated_at,
  }));
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
  const moduleSteps = await getProjectModuleSteps(row.id);
  const buildLog = await getBuildLog(row.id);
  return {
    id: row.id,
    userId: row.learner_profile_id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    state: row.state,
    artifacts: artifacts.map((entry) => ({
      kind: entry.kind,
      url: entry.url,
      createdAt: entry.created_at,
      metadata: entry.metadata ?? {},
    })),
    moduleSteps,
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

  if ((input.status ?? "queued") === "queued") {
    await insertJobEvent({
      jobId,
      userId: input.userId,
      projectId: input.projectId,
      type: "job.queued",
      message: `${input.type} queued`,
      payload: input.payload,
    });
  }

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

async function insertVerificationEvent(input: {
  userId: string;
  projectId: string | null;
  skill: string;
  eventType: "module_started" | "module_completed" | "artifact_generated" | "verification_passed" | "verification_revoked";
  details?: Record<string, unknown>;
}) {
  const supabase = getSupabaseAdmin();
  await supabase.from("verification_events").insert({
    id: randomUUID(),
    learner_profile_id: input.userId,
    project_id: input.projectId,
    event_type: input.eventType,
    skill_name: input.skill,
    details: input.details ?? {},
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
  acquisition?: AcquisitionAttribution;
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
    acquisition: buildOnboardingSessionAcquisition(
      input.acquisition ?? profile.acquisition ?? {},
      mergeOnboardingIntakeProfile(undefined, {
        fullName: input.name ?? profile.name,
        careerPathId: input.careerPathId ?? profile.careerPathId,
      }),
    ),
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
      intakeProfile: parseStoredOnboardingIntakeProfile(data.acquisition),
      acquisition: parseAcquisition(data.acquisition) ?? undefined,
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
    intakeProfile: parseStoredOnboardingIntakeProfile(data.acquisition),
    acquisition: parseAcquisition(data.acquisition) ?? undefined,
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
      acquisition: buildOnboardingSessionAcquisition(
        session.acquisition,
        mergeOnboardingIntakeProfile(session.intakeProfile, {
          situation: input.situation,
          selectedGoals: input.goals,
        }),
      ),
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
      acquisition: buildOnboardingSessionAcquisition(
        session.acquisition,
        mergeOnboardingIntakeProfile(session.intakeProfile, {
          careerPathId: input.careerPathId,
          careerCategoryLabel: input.careerCategoryLabel,
          jobTitle: input.jobTitle,
          yearsExperience: input.yearsExperience,
          companySize: input.companySize ?? null,
          aiComfort: input.aiComfort,
          linkedinUrl: input.linkedinUrl ?? null,
          resumeFilename: input.resumeFilename ?? null,
          uploadedResumeName: input.resumeFilename ?? null,
        }),
      ),
      status: "assessment_pending",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.sessionId);

  const existingProfile = await getProfileRowById(session.userId);
  if (existingProfile) {
    const existingLinks = existingProfile.social_links ?? {};
    const linkedinUrl =
      typeof input.linkedinUrl === "string" && input.linkedinUrl.trim().length ? input.linkedinUrl.trim() : null;

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

    const resolvedHeadline = input.jobTitle?.trim() || input.careerCategoryLabel?.trim();
    if (resolvedHeadline) {
      profilePatch.headline = resolvedHeadline.slice(0, 140);
    }
    if (linkedinUrl || Object.keys(existingLinks).length) {
      profilePatch.social_links = nextLinks;
    }

    await supabase.from("learner_profiles").update(profilePatch).eq("id", existingProfile.id);
  }

  return runtimeFindOnboardingSession(input.sessionId);
}

export async function runtimeUpdateOnboardingDraft(input: {
  sessionId: string;
  draft: Record<string, unknown>;
}) {
  if (mode() === "memory") return memFindOnboardingSession(input.sessionId);

  const session = await runtimeFindOnboardingSession(input.sessionId);
  if (!session) return null;

  const supabase = getSupabaseAdmin();
  const nextIntakeProfile = mergeOnboardingIntakeProfile(session.intakeProfile, input.draft);

  await supabase
    .from("onboarding_sessions")
    .update({
      acquisition: buildOnboardingSessionAcquisition(session.acquisition, nextIntakeProfile),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.sessionId);

  const fullName = typeof nextIntakeProfile.fullName === "string" ? nextIntakeProfile.fullName.trim() : "";
  if (fullName) {
    await supabase
      .from("learner_profiles")
      .update({
        full_name: fullName.slice(0, 120),
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.userId);
  }

  return runtimeFindOnboardingSession(input.sessionId);
}

export async function runtimeClaimOnboardingSession(input: {
  sessionId: string;
  authUserId: string;
  seed?: {
    name?: string;
    email?: string | null;
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
    email: input.seed?.email ?? null,
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
  const mergedAcquisition = mergeAttribution(
    mergeAttribution(currentTarget.acquisition, sourceProfile?.acquisition),
    refreshedSession.acquisition,
  );
  if (mergedAcquisition) {
    patch.acquisition = mergedAcquisition;
  }

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

  await recordPersistedFunnelEvent({
    eventKey: "guest_session_claimed",
    occurredAt: new Date().toISOString(),
    authUserId: input.authUserId,
    learnerProfileId: updatedUser.id,
    onboardingSessionId: input.sessionId,
    utmSource: mergedAcquisition?.last?.utmSource ?? mergedAcquisition?.first?.utmSource ?? null,
    utmMedium: mergedAcquisition?.last?.utmMedium ?? mergedAcquisition?.first?.utmMedium ?? null,
    utmCampaign: mergedAcquisition?.last?.utmCampaign ?? mergedAcquisition?.first?.utmCampaign ?? null,
    utmContent: mergedAcquisition?.last?.utmContent ?? mergedAcquisition?.first?.utmContent ?? null,
    utmTerm: mergedAcquisition?.last?.utmTerm ?? mergedAcquisition?.first?.utmTerm ?? null,
    firstUtmSource: mergedAcquisition?.first?.utmSource ?? null,
    firstUtmMedium: mergedAcquisition?.first?.utmMedium ?? null,
    firstUtmCampaign: mergedAcquisition?.first?.utmCampaign ?? null,
    firstUtmContent: mergedAcquisition?.first?.utmContent ?? null,
    firstUtmTerm: mergedAcquisition?.first?.utmTerm ?? null,
    landingPath: mergedAcquisition?.last?.landingPath ?? mergedAcquisition?.first?.landingPath ?? null,
    firstLandingPath: mergedAcquisition?.first?.landingPath ?? null,
    referrer: mergedAcquisition?.last?.referrer ?? mergedAcquisition?.first?.referrer ?? null,
    firstReferrer: mergedAcquisition?.first?.referrer ?? null,
    paidSource: null,
    properties: {
      migrated: sourceProfileId !== updatedUser.id,
      source_profile_id: sourceProfileId,
      target_profile_id: updatedUser.id,
    },
  });

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
  actorUserId?: string;
}) {
  if (mode() === "memory") return memSubmitAssessment(input);

  const supabase = getSupabaseAdmin();
  const { data: attempt } = await supabase
    .from("assessment_attempts")
    .select("*")
    .eq("id", input.assessmentId)
    .maybeSingle();
  if (!attempt) return null;

  if (input.actorUserId) {
    const actor = await runtimeFindUserById(input.actorUserId);
    if (!actor || actor.id !== attempt.learner_profile_id) {
      return null;
    }
  }

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
    find_new_role: ["sales-revops", "customer-support", "human-resources"],
    showcase_for_job: ["software-engineering", "quality-assurance", "product-management"],
    learn_foundations: ["operations", "human-resources", "product-management"],
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
      ["operations", "customer-support", "human-resources"].forEach(pushPath);
    } else if (aiComfort >= 4) {
      ["software-engineering", "quality-assurance", "sales-revops"].forEach(pushPath);
    } else {
      ["product-management", "marketing-seo", "human-resources"].forEach(pushPath);
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
    .select(PROFILE_SELECT_FIELDS)
    .eq("handle", handle)
    .maybeSingle();
  if (!data) return null;

  const skills = await getSkillsForProfile(data.id);
  return profileFromRow(data, skills);
}

export async function runtimeGetBillingSubscription(userId: string) {
  if (mode() === "memory") return memGetBillingSubscription(userId);

  const row = await getBillingSubscriptionRowByUserId(userId);
  return row ? billingSubscriptionFromRow(row) : null;
}

export async function runtimeGetBillingAccessState(input: {
  userId?: string | null;
  seed?: {
    name?: string;
    handleBase?: string;
    avatarUrl?: string | null;
    email?: string | null;
  };
}): Promise<RuntimeBillingAccessState> {
  const userId = String(input.userId || "").trim();
  if (!userId) {
    return {
      profile: null,
      subscription: null,
      status: "none",
      accessAllowed: false,
    };
  }

  const profile = await runtimeGetOrCreateProfile({
    userId,
    name: input.seed?.name,
    email: input.seed?.email ?? null,
    avatarUrl: input.seed?.avatarUrl ?? null,
    handleBase: input.seed?.handleBase,
  });
  const subscription = await runtimeGetBillingSubscription(profile.id);
  const status = normalizeBillingStatus(subscription?.status);

  return {
    profile,
    subscription,
    status,
    accessAllowed: billingAccessAllowed(status),
  };
}

export async function runtimeClaimStripeWebhookEvent(input: {
  eventId: string;
  eventType: string;
  userId?: string | null;
}) {
  const eventId = String(input.eventId || "").trim();
  if (!eventId) {
    throw new Error("STRIPE_WEBHOOK_EVENT_ID_REQUIRED");
  }

  if (mode() === "memory") {
    if (memoryStripeWebhookEvents.has(eventId)) {
      return false;
    }
    memoryStripeWebhookEvents.set(eventId, {
      eventType: input.eventType,
      userId: input.userId?.trim() || null,
      state: "processing",
      processedAt: null,
    });
    return true;
  }

  const supabase = getSupabaseAdmin();
  const profileId = await getStripeWebhookEventProfileId(input.userId);
  const { error } = await supabase.from("stripe_webhook_events").insert({
    stripe_event_id: eventId,
    event_type: input.eventType,
    learner_profile_id: profileId,
    state: "processing",
    processed_at: null,
  } satisfies Partial<StripeWebhookEventStateRow>);

  if (!error) {
    return true;
  }
  if (error.code === "23505") {
    return false;
  }

  throw new Error(`STRIPE_WEBHOOK_EVENT_CLAIM_FAILED:${error.message ?? "UNKNOWN"}`);
}

export async function runtimeMarkStripeWebhookEventProcessed(input: {
  eventId: string;
  userId?: string | null;
  processedAt?: string | null;
}) {
  const eventId = String(input.eventId || "").trim();
  if (!eventId) {
    throw new Error("STRIPE_WEBHOOK_EVENT_ID_REQUIRED");
  }

  const processedAt = input.processedAt?.trim() || new Date().toISOString();
  if (mode() === "memory") {
    const existing = memoryStripeWebhookEvents.get(eventId);
    if (!existing) {
      memoryStripeWebhookEvents.set(eventId, {
        eventType: "unknown",
        userId: input.userId?.trim() || null,
        state: "processed",
        processedAt,
      });
      return;
    }
    memoryStripeWebhookEvents.set(eventId, {
      ...existing,
      userId: input.userId?.trim() || existing.userId,
      state: "processed",
      processedAt,
    });
    return;
  }

  const supabase = getSupabaseAdmin();
  const profileId = await getStripeWebhookEventProfileId(input.userId);
  const { error } = await supabase
    .from("stripe_webhook_events")
    .update({
      learner_profile_id: profileId,
      state: "processed",
      processed_at: processedAt,
      updated_at: new Date().toISOString(),
    } satisfies Partial<StripeWebhookEventStateRow>)
    .eq("stripe_event_id", eventId);

  if (error) {
    throw new Error(`STRIPE_WEBHOOK_EVENT_MARK_FAILED:${error.message ?? "UNKNOWN"}`);
  }
}

export async function runtimeReleaseStripeWebhookEventClaim(eventIdInput: string) {
  const eventId = String(eventIdInput || "").trim();
  if (!eventId) return;

  if (mode() === "memory") {
    const existing = memoryStripeWebhookEvents.get(eventId);
    if (existing?.state === "processing") {
      memoryStripeWebhookEvents.delete(eventId);
    }
    return;
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("stripe_webhook_events")
    .delete()
    .eq("stripe_event_id", eventId)
    .eq("state", "processing");

  if (error) {
    throw new Error(`STRIPE_WEBHOOK_EVENT_RELEASE_FAILED:${error.message ?? "UNKNOWN"}`);
  }
}

export async function runtimeUpsertBillingSubscription(input: {
  userId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string;
  stripePriceId: string;
  status: BillingSubscription["status"];
  trialEndsAt: string | null;
  currentPeriodEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  lastWebhookEventId?: string | null;
  lastWebhookReceivedAt?: string | null;
}) {
  if (mode() === "memory") {
    return memUpsertBillingSubscription(input);
  }

  const profile = await runtimeGetOrCreateProfile({ userId: input.userId });
  const previous = await runtimeGetBillingSubscription(profile.id);
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  if (input.stripeCustomerId) {
    await supabase
      .from("learner_profiles")
      .update({
        stripe_customer_id: input.stripeCustomerId,
        updated_at: now,
      })
      .eq("id", profile.id);
  }

  const row = {
    learner_profile_id: profile.id,
    stripe_customer_id: input.stripeCustomerId,
    stripe_subscription_id: input.stripeSubscriptionId,
    stripe_price_id: input.stripePriceId,
    status: input.status,
    trial_ends_at: input.trialEndsAt,
    current_period_ends_at: input.currentPeriodEndsAt,
    cancel_at_period_end: input.cancelAtPeriodEnd,
    last_webhook_event_id: input.lastWebhookEventId ?? null,
    last_webhook_received_at: input.lastWebhookReceivedAt ?? null,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("billing_subscriptions")
    .upsert(row, { onConflict: "learner_profile_id" })
    .select(
      "learner_profile_id,stripe_subscription_id,stripe_customer_id,stripe_price_id,status,trial_ends_at,current_period_ends_at,cancel_at_period_end,last_webhook_event_id,last_webhook_received_at,created_at,updated_at",
    )
    .single();

  if (error || !data) {
    throw new Error(`BILLING_SUBSCRIPTION_UPSERT_FAILED:${error?.message ?? "UNKNOWN"}`);
  }

  const subscription = billingSubscriptionFromRow(data as BillingSubscriptionRow);

  const wasActiveBefore = previous ? ["trialing", "active"].includes(previous.status) : false;
  const isActiveNow = ["trialing", "active"].includes(subscription.status);
  if (isActiveNow && !wasActiveBefore) {
    await recordPersistedFunnelEvent({
      eventKey: "billing_checkout_completed",
      eventId: subscription.stripeSubscriptionId,
      occurredAt: subscription.updatedAt,
      authUserId: input.userId === profile.id ? null : input.userId,
      learnerProfileId: profile.id,
      utmSource: profile.acquisition?.last?.utmSource ?? profile.acquisition?.first?.utmSource ?? null,
      utmMedium: profile.acquisition?.last?.utmMedium ?? profile.acquisition?.first?.utmMedium ?? null,
      utmCampaign: profile.acquisition?.last?.utmCampaign ?? profile.acquisition?.first?.utmCampaign ?? null,
      utmContent: profile.acquisition?.last?.utmContent ?? profile.acquisition?.first?.utmContent ?? null,
      utmTerm: profile.acquisition?.last?.utmTerm ?? profile.acquisition?.first?.utmTerm ?? null,
      firstUtmSource: profile.acquisition?.first?.utmSource ?? null,
      firstUtmMedium: profile.acquisition?.first?.utmMedium ?? null,
      firstUtmCampaign: profile.acquisition?.first?.utmCampaign ?? null,
      firstUtmContent: profile.acquisition?.first?.utmContent ?? null,
      firstUtmTerm: profile.acquisition?.first?.utmTerm ?? null,
      landingPath: profile.acquisition?.last?.landingPath ?? profile.acquisition?.first?.landingPath ?? null,
      firstLandingPath: profile.acquisition?.first?.landingPath ?? null,
      referrer: profile.acquisition?.last?.referrer ?? profile.acquisition?.first?.referrer ?? null,
      firstReferrer: profile.acquisition?.first?.referrer ?? null,
      paidSource: null,
      properties: {
        billing_status: subscription.status,
        stripe_subscription_id: subscription.stripeSubscriptionId,
        stripe_customer_id: subscription.stripeCustomerId,
      },
    });
  }

  return subscription;
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
  const mergedAcquisition = mergeAttribution(profile.acquisition, patch.acquisition);

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
      acquisition: mergedAcquisition ?? profile.acquisition ?? {},
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.id);

  return runtimeFindUserById(profile.id);
}

export async function runtimePublishProfile(userId: string) {
  const billing = await runtimeGetBillingAccessState({ userId });
  if (!billing.accessAllowed) return null;
  if (mode() === "memory") return memPublishProfile(userId);

  const supabase = getSupabaseAdmin();
  const profile = await runtimeFindUserById(userId);
  if (!profile) return null;

  await supabase
    .from("learner_profiles")
    .update({ published: true, updated_at: new Date().toISOString() })
    .eq("id", profile.id);

  const publishedProfile = await runtimeFindUserById(profile.id);
  if (publishedProfile?.published) {
    const jobId = await createJob({
      userId: profile.id,
      projectId: null,
      type: "profile.publish",
      payload: { handle: publishedProfile.handle },
      status: "completed",
    });
    await insertJobEvent({
      jobId,
      userId: profile.id,
      projectId: null,
      type: "profile.published",
      message: `Profile ${publishedProfile.handle} published`,
      payload: { handle: publishedProfile.handle },
    });
  }

  return publishedProfile;
}

export async function runtimeCreateProject(input: {
  userId: string;
  title: string;
  description: string;
  slug?: string;
}) {
  const billing = await runtimeGetBillingAccessState({ userId: input.userId });
  if (!billing.accessAllowed) return null;
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

  const jobId = await createJob({
    userId: profile.id,
    projectId: data.id,
    type: "project.create",
    payload: { title: data.title },
    status: "completed",
  });
  await insertJobEvent({
    jobId,
    userId: profile.id,
    projectId: data.id,
    type: "project.created",
    message: `Project ${data.title} created`,
    payload: { title: data.title },
  });

  await recordPersistedFunnelEvent({
    eventKey: "project_created",
    eventId: data.id,
    occurredAt: data.created_at,
    authUserId: input.userId === profile.id ? null : input.userId,
    learnerProfileId: profile.id,
    projectId: data.id,
    utmSource: profile.acquisition?.last?.utmSource ?? profile.acquisition?.first?.utmSource ?? null,
    utmMedium: profile.acquisition?.last?.utmMedium ?? profile.acquisition?.first?.utmMedium ?? null,
    utmCampaign: profile.acquisition?.last?.utmCampaign ?? profile.acquisition?.first?.utmCampaign ?? null,
    utmContent: profile.acquisition?.last?.utmContent ?? profile.acquisition?.first?.utmContent ?? null,
    utmTerm: profile.acquisition?.last?.utmTerm ?? profile.acquisition?.first?.utmTerm ?? null,
    firstUtmSource: profile.acquisition?.first?.utmSource ?? null,
    firstUtmMedium: profile.acquisition?.first?.utmMedium ?? null,
    firstUtmCampaign: profile.acquisition?.first?.utmCampaign ?? null,
    firstUtmContent: profile.acquisition?.first?.utmContent ?? null,
    firstUtmTerm: profile.acquisition?.first?.utmTerm ?? null,
    landingPath: profile.acquisition?.last?.landingPath ?? profile.acquisition?.first?.landingPath ?? null,
    firstLandingPath: profile.acquisition?.first?.landingPath ?? null,
    referrer: profile.acquisition?.last?.referrer ?? profile.acquisition?.first?.referrer ?? null,
    firstReferrer: profile.acquisition?.first?.referrer ?? null,
    paidSource: null,
    properties: {
      title: data.title,
      state: data.state,
    },
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

export async function runtimeListOAuthConnections(userId: string): Promise<OAuthConnection[]> {
  if (mode() === "memory") return memListOAuthConnections(userId);
  const supabase = getSupabaseAdmin();
  const profile = await runtimeFindUserById(userId);
  if (!profile) return [];

  const { data } = await supabase
    .from("oauth_connections")
    .select("learner_profile_id,platform,connected,account_label,connected_at,last_error_code")
    .eq("learner_profile_id", profile.id);

  const rows = data ?? [];
  const byPlatform = new Map<string, OAuthConnection>();
  for (const row of rows) {
    byPlatform.set(row.platform, {
      userId: row.learner_profile_id,
      platform: row.platform as OAuthConnection["platform"],
      connected: Boolean(row.connected),
      accountLabel: row.account_label ?? null,
      connectedAt: row.connected_at ?? null,
      lastErrorCode: row.last_error_code ?? null,
    });
  }

  for (const platform of ["linkedin_profile", "linkedin", "x"] as const) {
    if (!byPlatform.has(platform)) {
      byPlatform.set(platform, {
        userId: profile.id,
        platform,
        connected: false,
        accountLabel: null,
        connectedAt: null,
        lastErrorCode: null,
      });
    }
  }

  return Array.from(byPlatform.values());
}

function projectModuleStepKey(title: string, index: number) {
  const base = safeHandle(title).slice(0, 48) || `step-${index + 1}`;
  return `step-${index + 1}-${base}`;
}

export async function runtimeSyncProjectModuleSteps(input: {
  projectId: string;
  userId: string;
  steps: string[];
}) {
  if (mode() === "memory") return memSyncProjectModuleSteps(input);

  const project = await runtimeFindProjectById(input.projectId);
  const profile = await runtimeFindUserById(input.userId);
  if (!project || !profile || project.userId !== profile.id) return null;

  const supabase = getSupabaseAdmin();
  const existing = await getProjectModuleSteps(project.id);
  const existingByKey = new Map(existing.map((step) => [step.stepKey, step]));
  const normalizedSteps = input.steps.map((title, index) => {
    const stepKey = projectModuleStepKey(title, index);
    const current = existingByKey.get(stepKey);
    return {
      id: current?.id ?? randomUUID(),
      project_id: project.id,
      learner_profile_id: profile.id,
      step_key: stepKey,
      title,
      order_index: index + 1,
      status: current?.status ?? "not_started",
      completed_at: current?.completedAt ?? null,
      updated_at: new Date().toISOString(),
    };
  });

  if (normalizedSteps.length) {
    await supabase.from("project_module_steps").upsert(normalizedSteps, { onConflict: "project_id,step_key" });
  }

  const nextKeys = new Set(normalizedSteps.map((step) => step.step_key));
  const staleIds = existing.filter((step) => !nextKeys.has(step.stepKey)).map((step) => step.id);
  if (staleIds.length) {
    await supabase.from("project_module_steps").delete().in("id", staleIds);
  }

  return runtimeFindProjectById(project.id);
}

export async function runtimeUpdateProjectModuleStep(input: {
  projectId: string;
  userId: string;
  stepKey: string;
  status: ProjectModuleStepStatus;
}) {
  const billing = await runtimeGetBillingAccessState({ userId: input.userId });
  if (!billing.accessAllowed) return null;
  if (mode() === "memory") return memUpdateProjectModuleStep(input);

  const project = await runtimeFindProjectById(input.projectId);
  const profile = await runtimeFindUserById(input.userId);
  if (!project || !profile || project.userId !== profile.id) return null;

  const targetStep = project.moduleSteps.find((step) => step.stepKey === input.stepKey);
  if (!targetStep) return null;

  const beforeAnyStarted = project.moduleSteps.some((step) => step.status !== "not_started");
  const beforeAllCompleted = project.moduleSteps.length > 0 && project.moduleSteps.every((step) => step.status === "completed");
  const wasCompleted = targetStep.status === "completed";
  const now = new Date().toISOString();
  const supabase = getSupabaseAdmin();

  await supabase
    .from("project_module_steps")
    .update({
      status: input.status,
      completed_at: input.status === "completed" ? now : null,
      updated_at: now,
    })
    .eq("project_id", project.id)
    .eq("step_key", input.stepKey);

  const updatedProject = await runtimeFindProjectById(project.id);
  if (!updatedProject) return null;
  const nextSteps = updatedProject.moduleSteps;
  const anyStarted = nextSteps.some((step) => step.status !== "not_started");
  const allCompleted = nextSteps.length > 0 && nextSteps.every((step) => step.status === "completed");
  const targetSkill = CAREER_PATHS.find((path) => path.id === profile.careerPathId)?.modules[0] ?? "Applied AI";

  if (anyStarted && (updatedProject.state === "planned" || updatedProject.state === "idea")) {
    await supabase
      .from("projects")
      .update({ state: "building", updated_at: now })
      .eq("id", updatedProject.id);
  }

  if (!beforeAnyStarted && anyStarted) {
    await upsertSkill({
      userId: profile.id,
      skill: targetSkill,
      status: "in_progress",
      score: Math.max(getVerificationPolicy().moduleMinScore * 0.5, 0.2),
      evidenceDelta: 0,
    });
    await insertVerificationEvent({
      userId: profile.id,
      projectId: updatedProject.id,
      skill: targetSkill,
      eventType: "module_started",
      details: {
        stepKey: input.stepKey,
        stepTitle: targetStep.title,
      },
    });
    await appendBuildLog({
      projectId: updatedProject.id,
      userId: profile.id,
      level: "info",
      message: `Module started: ${targetStep.title}`,
      metadata: { stepKey: input.stepKey, status: input.status },
    });
    const jobId = await createJob({
      userId: profile.id,
      projectId: updatedProject.id,
      type: "project.module_started",
      payload: { stepKey: input.stepKey, stepTitle: targetStep.title },
      status: "completed",
    });
    await insertJobEvent({
      jobId,
      userId: profile.id,
      projectId: updatedProject.id,
      type: "project.module_started",
      message: `Module started: ${targetStep.title}`,
      payload: { stepKey: input.stepKey, stepTitle: targetStep.title },
    });
  }

  if (!wasCompleted && input.status === "completed") {
    await appendBuildLog({
      projectId: updatedProject.id,
      userId: profile.id,
      level: "success",
      message: `Step completed: ${targetStep.title}`,
      metadata: { stepKey: input.stepKey, status: input.status },
    });
    const jobId = await createJob({
      userId: profile.id,
      projectId: updatedProject.id,
      type: "project.step_completed",
      payload: { stepKey: input.stepKey, stepTitle: targetStep.title },
      status: "completed",
    });
    await insertJobEvent({
      jobId,
      userId: profile.id,
      projectId: updatedProject.id,
      type: "project.step_completed",
      message: `Step completed: ${targetStep.title}`,
      payload: { stepKey: input.stepKey, stepTitle: targetStep.title },
    });
  } else if (wasCompleted && input.status !== "completed") {
    await appendBuildLog({
      projectId: updatedProject.id,
      userId: profile.id,
      level: "warn",
      message: `Step reopened: ${targetStep.title}`,
      metadata: { stepKey: input.stepKey, status: input.status },
    });
  }

  if (!beforeAllCompleted && allCompleted) {
    await upsertSkill({
      userId: profile.id,
      skill: targetSkill,
      status: "built",
      score: Math.max(getVerificationPolicy().moduleMinScore + 0.05, 0.45),
      evidenceDelta: 1,
    });
    await insertVerificationEvent({
      userId: profile.id,
      projectId: updatedProject.id,
      skill: targetSkill,
      eventType: "module_completed",
      details: {
        completedStepCount: nextSteps.length,
      },
    });
    await appendBuildLog({
      projectId: updatedProject.id,
      userId: profile.id,
      level: "success",
      message: `Module checklist completed for ${updatedProject.title}.`,
      metadata: { completedStepCount: nextSteps.length },
    });
    const jobId = await createJob({
      userId: profile.id,
      projectId: updatedProject.id,
      type: "project.completed",
      payload: { completedStepCount: nextSteps.length },
      status: "completed",
    });
    await insertJobEvent({
      jobId,
      userId: profile.id,
      projectId: updatedProject.id,
      type: "project.completed",
      message: `Project ${updatedProject.title} completed`,
      payload: { completedStepCount: nextSteps.length },
    });
  }

  return runtimeFindProjectById(project.id);
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
  const billing = await runtimeGetBillingAccessState({ userId: input.userId });
  if (!billing.accessAllowed) return null;
  if (mode() === "memory") return memAddProjectChatMessage(input);

  const project = await runtimeFindProjectById(input.projectId);
  const profile = await runtimeFindUserById(input.userId);
  if (!project || !profile || project.userId !== profile.id) return null;

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
  stepKey?: string | null;
  forceFailCode?: string;
}) {
  const billing = await runtimeGetBillingAccessState({ userId: input.userId });
  if (!billing.accessAllowed) return null;
  if (mode() === "memory") return memRequestArtifactGeneration(input);

  const project = await runtimeFindProjectById(input.projectId);
  const profile = await runtimeFindUserById(input.userId);
  if (!project || !profile || project.userId !== profile.id) return null;
  const step = input.stepKey ? project.moduleSteps.find((entry) => entry.stepKey === input.stepKey) ?? null : null;

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
    metadata: {
      source: "generated_artifact",
      generator: input.kind === "website" ? "website" : "artifact",
      stepKey: step?.stepKey ?? null,
      stepTitle: step?.title ?? null,
    },
  });

  await appendBuildLog({
    projectId: project.id,
    userId: profile.id,
    level: "success",
    message: `Artifact generated${step ? ` for ${step.title}` : ""}: ${input.kind}`,
    metadata: {
      stepKey: step?.stepKey ?? null,
      stepTitle: step?.title ?? null,
    },
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

export async function runtimeRecordProjectArtifact(input: {
  projectId: string;
  userId: string;
  kind: string;
  url: string;
  logMessage: string;
  metadata?: Record<string, unknown>;
  awardTokens?: number;
}) {
  const billing = await runtimeGetBillingAccessState({ userId: input.userId });
  if (!billing.accessAllowed) return null;
  if (mode() === "memory") {
    return memRecordProjectArtifact(input);
  }

  const project = await runtimeFindProjectById(input.projectId);
  const profile = await runtimeFindUserById(input.userId);
  if (!project || !profile || project.userId !== profile.id) return null;
  const wasCompleted = project.state === "built" || project.state === "showcased";

  const supabase = getSupabaseAdmin();

  await supabase.from("project_artifacts").insert({
    id: randomUUID(),
    project_id: project.id,
    kind: input.kind,
    url: input.url,
    metadata: input.metadata ?? {},
  });

  await appendBuildLog({
    projectId: project.id,
    userId: profile.id,
    level: "success",
    message: input.logMessage,
    metadata: input.metadata,
  });

  await supabase
    .from("projects")
    .update({ state: "built", updated_at: new Date().toISOString() })
    .eq("id", project.id);

  await upsertSkill({
    userId: profile.id,
    skill: CAREER_PATHS.find((path) => path.id === profile.careerPathId)?.modules[0] ?? "Applied AI",
    status: "built",
    score: Math.max(getVerificationPolicy().projectMinScore + 0.1, 0.5),
    evidenceDelta: 1,
  });

  await insertVerificationEvent({
    userId: profile.id,
    projectId: project.id,
    skill: CAREER_PATHS.find((path) => path.id === profile.careerPathId)?.modules[0] ?? "Applied AI",
    eventType: "artifact_generated",
    details: {
      kind: input.kind,
      artifactUrl: input.url,
      source: input.metadata?.source ?? "manual_submission",
    },
  });

  await touchProfileTokenUsage(profile.id, Math.max(0, Number(input.awardTokens ?? 180)));

  const artifactJobId = await createJob({
    userId: profile.id,
    projectId: project.id,
    type: "project.proof_attached",
    payload: {
      kind: input.kind,
      url: input.url,
      source: input.metadata?.source ?? "manual_submission",
      stepKey: typeof input.metadata?.stepKey === "string" ? input.metadata.stepKey : null,
    },
    status: "completed",
  });
  await insertJobEvent({
    jobId: artifactJobId,
    userId: profile.id,
    projectId: project.id,
    type: "project.proof_attached",
    message: `Proof attached for ${project.title}`,
    payload: {
      kind: input.kind,
      url: input.url,
      source: input.metadata?.source ?? "manual_submission",
      stepKey: typeof input.metadata?.stepKey === "string" ? input.metadata.stepKey : null,
    },
  });
  if (!wasCompleted) {
    const completedJobId = await createJob({
      userId: profile.id,
      projectId: project.id,
      type: "project.completed",
      payload: {
        source: input.metadata?.source ?? "manual_submission",
      },
      status: "completed",
    });
    await insertJobEvent({
      jobId: completedJobId,
      userId: profile.id,
      projectId: project.id,
      type: "project.completed",
      message: `Project ${project.title} completed`,
      payload: {
        source: input.metadata?.source ?? "manual_submission",
      },
    });
  }

  return runtimeFindProjectById(project.id);
}

type ProjectToolActionOutput = {
  toolKey: string;
  actionKey: RecommendedModuleToolActionKind;
  title: string;
  content: string;
  copyLabel: string;
  format: "markdown" | "text";
  openUrl?: string | null;
  openLabel?: string | null;
};

type ProjectToolActionConfig = {
  title: string;
  copyLabel: string;
  format: "markdown" | "text";
  instructions: string[];
};

const PROJECT_TOOL_ACTIONS: Record<Exclude<RecommendedModuleToolActionKind, "social_drafts">, ProjectToolActionConfig> = {
  jira_ticket: {
    title: "Jira ticket draft",
    copyLabel: "Copy Jira ticket",
    format: "markdown",
    instructions: [
      "Write a ready-to-paste Jira issue.",
      "Include sections for Summary, Background, Proposed AI workflow, Acceptance criteria, and Proof to attach.",
      "Keep it concrete and scoped tightly enough to ship in one focused pass.",
    ],
  },
  linear_ticket: {
    title: "Linear issue draft",
    copyLabel: "Copy Linear issue",
    format: "markdown",
    instructions: [
      "Write a concise Linear issue.",
      "Include Problem, Proposed change, Success check, and Proof to attach.",
      "Keep the tone crisp and operator-friendly.",
    ],
  },
  notion_brief: {
    title: "Notion brief",
    copyLabel: "Copy brief",
    format: "markdown",
    instructions: [
      "Write a Notion-ready brief in markdown.",
      "Include Context, Workflow, AI approach, Deliverable, Risks, and Proof to capture.",
      "Make it readable by a teammate who did not attend the conversation.",
    ],
  },
  slack_update: {
    title: "Slack update",
    copyLabel: "Copy Slack update",
    format: "text",
    instructions: [
      "Write a short Slack update.",
      "Keep it under 8 lines.",
      "Include what changed, what is ready for review, and the clearest next ask.",
    ],
  },
  gmail_draft: {
    title: "Email draft",
    copyLabel: "Copy email draft",
    format: "text",
    instructions: [
      "Write a ready-to-send email.",
      "Start with a 'Subject:' line, then a blank line, then the body.",
      "Keep the tone direct, specific, and professional.",
    ],
  },
  hubspot_note: {
    title: "CRM note",
    copyLabel: "Copy CRM note",
    format: "text",
    instructions: [
      "Write a HubSpot-ready CRM note or sequence input.",
      "Include current context, recommended action, and the next follow-up step.",
      "Keep it concise enough to paste into a rep workflow immediately.",
    ],
  },
  github_summary: {
    title: "GitHub summary",
    copyLabel: "Copy GitHub summary",
    format: "markdown",
    instructions: [
      "Write a GitHub-ready summary.",
      "Include Overview, What changed, Verification, and Next step.",
      "Assume another engineer will read it in a pull request or README context.",
    ],
  },
};

function findProjectCurrentStep(project: Project) {
  return project.moduleSteps.find((step) => step.status === "in_progress")
    ?? project.moduleSteps.find((step) => step.status !== "completed")
    ?? project.moduleSteps.at(-1)
    ?? null;
}

function projectArtifactSummary(project: Project) {
  return project.artifacts
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3)
    .map((artifact) => {
      const stepKey = typeof artifact.metadata?.stepKey === "string" ? artifact.metadata.stepKey : null;
      return `${artifact.kind}: ${artifact.url}${stepKey ? ` (step ${stepKey})` : ""}`;
    })
    .join(" | ");
}

function projectBuildLogSummary(project: Project) {
  return project.buildLog
    .slice(-4)
    .map((entry) => `${entry.level}: ${entry.message}`)
    .join(" | ");
}

function stepDefinitionForProjectStep(guide: RecommendedModuleGuide, step: ProjectModuleStep | null) {
  if (!step) return null;
  return guide.stepDefinitions[Math.max(0, step.orderIndex - 1)] ?? null;
}

export async function runtimeGenerateProjectToolAction(input: {
  projectId: string;
  userId: string;
  toolKey: string;
  moduleTitle: string;
  careerPathId?: string | null;
  stepKey?: string | null;
}) {
  const billing = await runtimeGetBillingAccessState({ userId: input.userId });
  if (!billing.accessAllowed) {
    return { ok: false as const, errorCode: "SUBSCRIPTION_REQUIRED", output: null };
  }
  const project = await runtimeFindProjectById(input.projectId);
  const profile = await runtimeFindUserById(input.userId);
  if (!project || !profile || project.userId !== profile.id) {
    return { ok: false as const, errorCode: "FORBIDDEN", output: null };
  }

  const guide = buildRecommendedModuleGuide({
    careerPathId: input.careerPathId ?? profile.careerPathId,
    moduleTitle: input.moduleTitle,
    jobTitle: profile.headline,
    primaryGoal: profile.goals?.[0] ?? null,
  });
  const tool = guide.toolLaunches.find((entry) => entry.key === input.toolKey) ?? null;
  if (!tool?.apiAction) {
    return { ok: false as const, errorCode: "TOOL_ACTION_UNAVAILABLE", output: null };
  }

  const selectedStep = input.stepKey
    ? project.moduleSteps.find((step) => step.stepKey === input.stepKey) ?? findProjectCurrentStep(project)
    : findProjectCurrentStep(project);
  const stepDefinition = stepDefinitionForProjectStep(guide, selectedStep);
  const completedStepCount = project.moduleSteps.filter((step) => step.status === "completed").length;
  const totalStepCount = project.moduleSteps.length;

  if (tool.apiAction.actionKey === "social_drafts") {
    const ideas = await runtimeGenerateSocialIdeas({
      userId: profile.id,
      projectId: project.id,
    });
    if (!ideas.ok || !ideas.ideas) {
      return { ok: false as const, errorCode: ideas.errorCode, output: null };
    }
    const content = [
      "LinkedIn draft",
      ideas.ideas.linkedin,
      "",
      "X draft",
      ideas.ideas.x,
    ].join("\n");

    if (mode() !== "memory") {
      await appendBuildLog({
        projectId: project.id,
        userId: profile.id,
        level: "info",
        message: `Generated ${tool.label} social drafts from project context.`,
        metadata: {
          toolKey: tool.key,
          actionKey: tool.apiAction.actionKey,
          stepKey: selectedStep?.stepKey ?? null,
          source: "tool_action_api",
        },
      });
      await touchProfileTokenUsage(profile.id, 70);
    }

    return {
      ok: true as const,
      output: {
        toolKey: tool.key,
        actionKey: tool.apiAction.actionKey,
        title: tool.apiAction.label,
        content,
        copyLabel: "Copy drafts",
        format: "text" as const,
        openUrl: "/dashboard/social/",
        openLabel: "Open Social Drafts",
      },
    };
  }

  const actionConfig = PROJECT_TOOL_ACTIONS[tool.apiAction.actionKey as Exclude<RecommendedModuleToolActionKind, "social_drafts">];
  if (!actionConfig) {
    return { ok: false as const, errorCode: "TOOL_ACTION_UNAVAILABLE", output: null };
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false as const, errorCode: "OPENAI_CONFIG_MISSING", output: null };
  }

  const prompt = [
    `You are ${BRAND_NAME}, generating a tool-ready draft for ${tool.label}.`,
    `Requested output: ${actionConfig.title}`,
    ...actionConfig.instructions,
    "Return only the final draft. Do not wrap it in code fences. Do not add commentary before or after the draft.",
    `Learner role: ${profile.headline || "AI Builder"}`,
    `Career path: ${guide.careerPathName}`,
    `Module title: ${guide.moduleTitle}`,
    `Why this module: ${guide.whyThisModule}`,
    `Expected output: ${guide.expectedOutput}`,
    `Project title: ${project.title}`,
    `Project description: ${project.description}`,
    `Project state: ${project.state}`,
    `Checklist progress: ${completedStepCount}/${totalStepCount}`,
    selectedStep ? `Current step: ${selectedStep.title}` : "Current step: none selected",
    stepDefinition ? `Why this step: ${stepDefinition.whyThisStep}` : "Why this step: none",
    stepDefinition
      ? `Proof requirement: ${stepDefinition.proofRequirement.label} - ${stepDefinition.proofRequirement.description}`
      : "Proof requirement: none",
    project.artifacts.length
      ? `Recent proof artifacts: ${projectArtifactSummary(project)}`
      : "Recent proof artifacts: none yet",
    project.buildLog.length
      ? `Recent build log: ${projectBuildLogSummary(project)}`
      : "Recent build log: none yet",
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
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`OPENAI_TOOL_ACTION_FAILED:${response.status}:${detail.slice(0, 200)}`);
    }

    const payload = (await response.json()) as {
      output_text?: string;
      output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
    };
    const content = extractOpenAiOutputText(payload);
    if (!content) {
      throw new Error("OPENAI_TOOL_ACTION_EMPTY");
    }

    if (mode() !== "memory") {
      await appendBuildLog({
        projectId: project.id,
        userId: profile.id,
        level: "info",
        message: `${actionConfig.title} generated for ${selectedStep?.title ?? guide.moduleTitle}.`,
        metadata: {
          toolKey: tool.key,
          actionKey: tool.apiAction.actionKey,
          stepKey: selectedStep?.stepKey ?? null,
          source: "tool_action_api",
        },
      });
      await touchProfileTokenUsage(profile.id, 90);
    }

    return {
      ok: true as const,
      output: {
        toolKey: tool.key,
        actionKey: tool.apiAction.actionKey,
        title: actionConfig.title,
        content,
        copyLabel: actionConfig.copyLabel,
        format: actionConfig.format,
        openUrl: tool.href,
        openLabel: `Open ${tool.label}`,
      },
    };
  } catch (error) {
    return {
      ok: false as const,
      errorCode:
        error instanceof Error && error.message.startsWith("OPENAI_TOOL_ACTION_FAILED")
          ? "OPENAI_TOOL_ACTION_FAILED"
          : "OPENAI_TOOL_ACTION_UNAVAILABLE",
      output: null,
    };
  }
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
  if (!profile || seed?.email?.trim()) {
    profile = await getOrCreateProfile({
      userId,
      name: seed?.name ?? "New Learner",
      email: seed?.email ?? null,
      avatarUrl: seed?.avatarUrl ?? null,
      handleBase: seed?.handleBase ?? "learner",
    });
  }
  if (!profile) return null;

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

  const [
    { data: jobs },
    { data: events },
    { data: onboarding },
    { data: latestAssessment },
    { data: socialDrafts },
  ] = await Promise.all([
    supabase
      .from("agent_jobs")
      .select("id,type,status,attempts,max_attempts,payload,created_at,updated_at,lease_until,last_error_code,project_id,learner_profile_id")
      .eq("learner_profile_id", profile.id)
      .in("status", ["queued", "claimed", "running"])
      .order("created_at", { ascending: false }),
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

  const filteredEvents = (events ?? []).filter((event) => {
    const message = String(event.message ?? "").toLowerCase();
    const eventType = String(event.event_type ?? "").toLowerCase();
    const payload = event.payload && typeof event.payload === "object" ? (event.payload as Record<string, unknown>) : {};
    const reason = String(payload.reason ?? "").toLowerCase();

    if (reason === "scheduler_refresh_slot") return false;
    if (message.includes("memory.refresh")) return false;
    if (eventType.includes("scheduler")) return false;
    return true;
  });

  const daily = await getLatestDailyUpdate(profile.id);
  const latestEvents = filteredEvents.map((event) => ({
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
    .sort((a, b) => Date.parse(String(a.updated_at || a.created_at)) - Date.parse(String(b.updated_at || b.created_at)))[0];
  const gamification = buildDashboardGamification({
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
    socialDraftPublishedAt: firstPublishedSocialDraft?.updated_at ?? firstPublishedSocialDraft?.created_at ?? null,
  });

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
    latestEvents,
    moduleRecommendations: MODULE_TRACKS.filter((track) => track.careerPathId === profile.careerPathId),
    dailyUpdate: daily,
    gamification,
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

function enforceFirstPersonDraft(text: string, learnerName: string) {
  let normalized = String(text ?? "");
  if (!normalized.trim()) return normalized;

  const safeName = learnerName
    .trim()
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  if (safeName) {
    normalized = normalized.replace(new RegExp(`\\b${safeName}\\b`, "gi"), "I");
    normalized = normalized.replace(new RegExp(`\\b${safeName}'s\\b`, "gi"), "my");
  }

  normalized = normalized
    .replace(/\b(?:he|she|they)\s+(am|is)\b/gi, "I am")
    .replace(/\b(?:he|she|they)\s+(was|were)\b/gi, "I was")
    .replace(/\b(?:he|she|they)\s+(has|have)\b/gi, "I have")
    .replace(
      /\b(?:he|she|they)\s+(started|built|launched|created|completed|learned|ships|shipped|uses|used|is|write|writes|share|shares)\b/gi,
      "I $1",
    )
    .replace(/\byou\s+(are|were|have|had|built|launched|created|completed|learned|use|used|share|shared)\b/gi, "I $1")
    .replace(/\byour\b/gi, "my")
    .replace(/\bhis\b/gi, "my")
    .replace(/\bher\b/gi, "my")
    .replace(/\btheir\b/gi, "my")
    .replace(/\bhim\b/gi, "me")
    .replace(/\bthem\b/gi, "me")
    .replace(/\bhimself\b/gi, "myself")
    .replace(/\bherself\b/gi, "myself")
    .replace(/\bthemself\b/gi, "myself")
    .replace(/\bthemselves\b/gi, "myself")
    .replace(/\bI\s+is\b/gi, "I am")
    .replace(/\bI\s+has\b/gi, "I have")
    .replace(/\bI\s+was\s+positioning\s+myself\b/gi, "I positioned myself")
    .replace(/\bBy\s+structuring\s+my\b/gi, "I structured my")
    .replace(/\bBy\s+sharing\b/gi, "I shared")
    .replace(/\bBy\s+building\b/gi, "I built");

  normalized = normalized
    .replace(/\s+/g, " ")
    .replace(/\s([,.!?;:])/g, "$1")
    .trim();

  if (!/\b(i|i'm|i've|my|me|mine)\b/i.test(normalized)) {
    normalized = `I'm sharing this update: ${normalized}`;
  }

  return normalized;
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

type PersonalizedNewsCategory = "capabilities" | "tools" | "job_displacement" | "policy" | "workflow";
type StoryImpact = "high" | "medium" | "low";

type PersonalizedNewsStory = {
  title: string;
  url: string;
  summary: string;
  category: PersonalizedNewsCategory;
  relevanceScore: number;
  rankingScore: number;
  whyRelevant: string;
  recommendedAction: string;
  impact: StoryImpact;
  source: string | null;
  publishedAt: string;
};

type PersonalizedNewsPayload = {
  focusSummary: string;
  selectionRationale: string;
  stories: Array<{
    title: string;
    url: string;
    source?: string | null;
    publishedAt?: string | null;
    summary: string;
    category?: string | null;
    relevanceScore?: number | null;
    whyRelevant?: string | null;
    actionForUser?: string | null;
    impact?: string | null;
  }>;
};

type LearnerNewsContext = {
  user: UserProfile;
  projects: Project[];
  latestEvents: DashboardSummary["latestEvents"];
  onboarding: OnboardingSession | null;
  assessment:
    | {
        score: number;
        submittedAt: string | null;
        recommendedCareerPathIds: string[];
      }
    | null;
  memoryRows: Array<{ key: string; value: unknown }>;
  missionSnapshot: string | null;
  memorySnapshot: string | null;
  focusSignals: string[];
  careerPathIds: string[];
};

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeStoryCategory(input?: string | null): PersonalizedNewsCategory {
  const normalized = String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (normalized === "capabilities" || normalized === "capability") return "capabilities";
  if (normalized === "tools" || normalized === "tooling" || normalized === "infrastructure") return "tools";
  if (normalized === "job_displacement" || normalized === "job_market" || normalized === "labor" || normalized === "workforce") {
    return "job_displacement";
  }
  if (normalized === "policy" || normalized === "regulation" || normalized === "compliance") return "policy";
  return "workflow";
}

function normalizeImpact(input?: string | null): StoryImpact {
  const normalized = String(input ?? "")
    .trim()
    .toLowerCase();
  if (normalized === "high" || normalized === "critical") return "high";
  if (normalized === "low") return "low";
  return "medium";
}

function sanitizeHttpUrl(input: string) {
  try {
    const parsed = new URL(input.trim());
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

function parseDateOrNow(input?: string | null) {
  if (!input) return new Date().toISOString();
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

function trimText(value: unknown, max = 320) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function extractJsonPayload(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(withoutFence) as PersonalizedNewsPayload;
  } catch {
    return null;
  }
}

function keywordSet(parts: Array<string | null | undefined>) {
  const values = parts
    .flatMap((entry) => String(entry ?? "").toLowerCase().split(/[^a-z0-9]+/g))
    .map((entry) => entry.trim())
    .filter((entry) => entry.length >= 3);
  return new Set(values);
}

function keywordOverlap(a: Set<string>, b: Set<string>) {
  let matches = 0;
  for (const value of a) {
    if (b.has(value)) matches += 1;
  }
  return matches;
}

function scoreNewsStory(story: PersonalizedNewsStory, context: LearnerNewsContext) {
  let score = clampNumber(Number(story.relevanceScore || 0), 10, 100);
  const situation = context.onboarding?.situation ?? null;
  const userGoals = new Set(context.user.goals);
  const userKeywords = keywordSet([
    context.user.headline,
    context.user.bio,
    ...context.user.tools,
    ...context.user.skills.map((entry) => entry.skill),
    ...context.projects.map((project) => project.title),
  ]);
  const storyKeywords = keywordSet([story.title, story.summary, story.whyRelevant, story.recommendedAction]);
  const overlap = keywordOverlap(userKeywords, storyKeywords);

  score += Math.min(12, overlap * 2);

  if (story.category === "tools" && context.user.tools.length > 0) {
    score += 8;
  }
  if (story.category === "job_displacement" && (situation === "unemployed" || situation === "career_switcher" || situation === "student")) {
    score += 12;
  }
  if (story.category === "capabilities" && (context.user.careerPathId === "software-engineering" || context.user.careerPathId === "quality-assurance")) {
    score += 6;
  }
  if (story.category === "workflow" && context.projects.some((entry) => entry.state === "building" || entry.state === "built")) {
    score += 5;
  }
  if (story.category === "policy" && (userGoals.has("showcase_for_job") || userGoals.has("find_new_role"))) {
    score += 4;
  }

  return clampNumber(score, 1, 100);
}

function buildFallbackPersonalizedStories(context: LearnerNewsContext, count: number) {
  const now = new Date().toISOString();
  const base: PersonalizedNewsStory[] = [
    {
      title: "AI capabilities: teams are adopting stricter eval gates before deployment",
      url: "https://openai.com/news/",
      summary: "Organizations are pairing better model quality with regression testing to keep AI workflows stable.",
      category: "capabilities",
      relevanceScore: 82,
      rankingScore: 82,
      whyRelevant: `This supports your ${context.user.careerPathId} path by reducing production risk while shipping faster.`,
      recommendedAction: "Create a simple pre-release eval checklist for your next project update.",
      impact: "high",
      source: "OpenAI News",
      publishedAt: now,
    },
    {
      title: "AI tools: automation platforms now ship agent-first workflow builders",
      url: "https://www.anthropic.com/news",
      summary: "AI-native automation is lowering setup overhead for multi-step personal and team workflows.",
      category: "tools",
      relevanceScore: 80,
      rankingScore: 80,
      whyRelevant: context.user.tools.length
        ? `You already use ${context.user.tools.slice(0, 3).join(", ")}, so this trend can compound your current stack.`
        : "This can reduce build time and improve experimentation speed for your projects.",
      recommendedAction: "Automate one recurring task end-to-end and measure weekly time saved.",
      impact: "medium",
      source: "Anthropic News",
      publishedAt: now,
    },
    {
      title: "Job displacement signal: hiring is shifting toward AI-augmented execution proof",
      url: "https://www.weforum.org/stories/",
      summary: "Employers are emphasizing practical AI delivery evidence over generic tool familiarity.",
      category: "job_displacement",
      relevanceScore: 85,
      rankingScore: 85,
      whyRelevant: "This directly impacts your career resilience and positioning in AI-assisted roles.",
      recommendedAction: "Publish one measurable project artifact to strengthen your portfolio signal.",
      impact: "high",
      source: "World Economic Forum",
      publishedAt: now,
    },
    {
      title: "Workflow pattern: lightweight copilots are replacing manual status reporting",
      url: "https://ai.google/discover/blog/",
      summary: "Teams are using AI summaries and automated context assembly to reduce coordination overhead.",
      category: "workflow",
      relevanceScore: 76,
      rankingScore: 76,
      whyRelevant: "Your ongoing projects can benefit from less manual status work and faster iteration loops.",
      recommendedAction: "Set up an automated weekly project summary from your build logs and notes.",
      impact: "medium",
      source: "Google AI Blog",
      publishedAt: now,
    },
  ];

  return base.slice(0, Math.max(1, Math.min(8, count)));
}

function extractMissionAndMemory(rows: Array<{ key: string; value: unknown }>) {
  const missionKeys = ["mission", "mission_markdown", "mission_snapshot"];
  const memoryKeys = ["memory", "memory_markdown", "memory_snapshot", "refresh_slot"];
  let missionSnapshot: string | null = null;
  let memorySnapshot: string | null = null;

  for (const row of rows) {
    if (!missionSnapshot && missionKeys.includes(row.key) && typeof row.value === "string") {
      missionSnapshot = trimText(row.value, 1800);
    }
    if (!memorySnapshot && memoryKeys.includes(row.key)) {
      if (typeof row.value === "string") {
        memorySnapshot = trimText(row.value, 1800);
      } else if (row.value && typeof row.value === "object") {
        memorySnapshot = trimText(JSON.stringify(row.value), 1800);
      }
    }
  }

  return { missionSnapshot, memorySnapshot };
}

async function getLatestOnboardingSessionForUser(userId: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("onboarding_sessions")
    .select("*")
    .eq("learner_profile_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

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
    intakeProfile: parseStoredOnboardingIntakeProfile(data.acquisition),
    status: data.status,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  } as OnboardingSession;
}

async function getLatestAssessmentAttemptForUser(userId: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("assessment_attempts")
    .select("score,submitted_at,recommended_career_path_ids")
    .eq("learner_profile_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    score: Number(data.score ?? 0),
    submittedAt: data.submitted_at ?? null,
    recommendedCareerPathIds: data.recommended_career_path_ids ?? [],
  };
}

function emptySignupAuditChatSummary(): SignupAuditChatSummary {
  return {
    userMessageCount: 0,
    lastUserMessageAt: null,
    lastUserMessage: null,
  };
}

function posthogPersonUrl(query: string | null | undefined) {
  const normalized = typeof query === "string" ? query.trim() : "";
  if (!normalized) return null;
  const projectId = process.env.POSTHOG_PROJECT_ID?.trim() || process.env.POSTHOG_CLI_PROJECT_ID?.trim() || "330799";
  return `https://us.posthog.com/project/${encodeURIComponent(projectId)}/persons?q=${encodeURIComponent(normalized)}`;
}

async function resolveResumeUploadForSession(input: {
  sessionId: string;
  resumeFilename: string | null | undefined;
}) {
  const fileName = typeof input.resumeFilename === "string" && input.resumeFilename.trim() ? input.resumeFilename.trim() : null;
  if (!input.sessionId || !fileName) {
    return {
      fileName,
      signedUrl: null,
    };
  }

  const supabase = getSupabaseAdmin();
  const bucket = process.env.SUPABASE_RESUME_BUCKET?.trim() || "onboarding-resumes";
  const folder = `onboarding/${input.sessionId}`;

  try {
    const { data: objects } = await supabase.storage.from(bucket).list(folder, {
      limit: 20,
      offset: 0,
    });
    const candidates = (objects ?? [])
      .filter((entry) => typeof entry.name === "string" && entry.name.includes(fileName))
      .sort((a, b) => b.name.localeCompare(a.name));
    const match = candidates[0];
    if (!match?.name) {
      return {
        fileName,
        signedUrl: null,
      };
    }

    const objectPath = `${folder}/${match.name}`;
    const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(objectPath, 60 * 60);
    return {
      fileName,
      signedUrl: signed?.signedUrl ?? null,
    };
  } catch {
    return {
      fileName,
      signedUrl: null,
    };
  }
}

async function hydrateSignupAuditRecords(profileRows: SignupAuditProfileRow[]) {
  if (!profileRows.length) {
    return [] as SignupAuditRecord[];
  }

  const supabase = getSupabaseAdmin();
  const userIds = profileRows.map((row) => row.id);

  const [{ data: onboardingRows }, { data: assessmentRows }, { data: projectRows }] = await Promise.all([
    supabase
      .from("onboarding_sessions")
      .select("id,learner_profile_id,situation,career_path_id,linkedin_url,resume_filename,ai_knowledge_score,goals,acquisition,status,created_at,updated_at")
      .in("learner_profile_id", userIds)
      .order("updated_at", { ascending: false }),
    supabase
      .from("assessment_attempts")
      .select("id,learner_profile_id,score,started_at,submitted_at,answers,recommended_career_path_ids,updated_at")
      .in("learner_profile_id", userIds)
      .order("updated_at", { ascending: false }),
    supabase
      .from("projects")
      .select("id,learner_profile_id")
      .in("learner_profile_id", userIds),
  ]);

  const latestOnboardingByUser = new Map<string, OnboardingSession>();
  for (const row of (onboardingRows ?? []) as Array<{
    id: string;
    learner_profile_id: string;
    situation: OnboardingSession["situation"];
    career_path_id: string | null;
    linkedin_url: string | null;
    resume_filename: string | null;
    ai_knowledge_score: number | null;
    goals: string[] | null;
    acquisition?: Record<string, unknown> | null;
    status: OnboardingSession["status"];
    created_at: string;
    updated_at: string;
  }>) {
    if (latestOnboardingByUser.has(row.learner_profile_id)) continue;
    latestOnboardingByUser.set(row.learner_profile_id, {
      id: row.id,
      userId: row.learner_profile_id,
      situation: row.situation,
      careerPathId: row.career_path_id,
      linkedinUrl: row.linkedin_url,
      resumeFilename: row.resume_filename,
      aiKnowledgeScore: row.ai_knowledge_score,
      goals: ((row.goals ?? []) as OnboardingSession["goals"]) || [],
      intakeProfile: parseStoredOnboardingIntakeProfile(row.acquisition),
      acquisition: parseAcquisition(row.acquisition) ?? undefined,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  const latestAssessmentByUser = new Map<string, AssessmentAttempt>();
  for (const row of (assessmentRows ?? []) as Array<{
    id: string;
    learner_profile_id: string;
    score: number;
    started_at: string;
    submitted_at: string | null;
    answers: Array<{ questionId: string; value: number }> | null;
    recommended_career_path_ids: string[] | null;
  }>) {
    if (latestAssessmentByUser.has(row.learner_profile_id)) continue;
    latestAssessmentByUser.set(row.learner_profile_id, {
      id: row.id,
      userId: row.learner_profile_id,
      score: Number(row.score ?? 0),
      startedAt: row.started_at,
      submittedAt: row.submitted_at,
      answers: row.answers ?? [],
      recommendedCareerPathIds: row.recommended_career_path_ids ?? [],
    });
  }

  const projectRowsTyped = (projectRows ?? []) as Array<{ id: string; learner_profile_id: string }>;
  const projectCountByUser = new Map<string, number>();
  const projectToUserId = new Map<string, string>();
  for (const row of projectRowsTyped) {
    projectToUserId.set(row.id, row.learner_profile_id);
    projectCountByUser.set(row.learner_profile_id, (projectCountByUser.get(row.learner_profile_id) ?? 0) + 1);
  }

  const chatByUser = new Map<string, SignupAuditChatSummary>();
  const projectIds = projectRowsTyped.map((row) => row.id);
  if (projectIds.length) {
    const { data: chatLogs } = await supabase
      .from("build_log_entries")
      .select("project_id,message,created_at")
      .in("project_id", projectIds)
      .ilike("message", "User message:%")
      .order("created_at", { ascending: false });

    for (const row of (chatLogs ?? []) as Array<{ project_id: string; message: string; created_at: string }>) {
      const userId = projectToUserId.get(row.project_id);
      if (!userId) continue;

      const existing = chatByUser.get(userId) ?? emptySignupAuditChatSummary();
      existing.userMessageCount += 1;
      if (!existing.lastUserMessageAt) {
        existing.lastUserMessageAt = row.created_at;
        existing.lastUserMessage = row.message.replace(/^User message:\s*/i, "").trim() || null;
      }
      chatByUser.set(userId, existing);
    }
  }

  const resumeByUser = new Map<string, { fileName: string | null; signedUrl: string | null }>();
  await Promise.all(
    profileRows.map(async (row) => {
      const onboarding = latestOnboardingByUser.get(row.id);
      if (!onboarding?.id) {
        resumeByUser.set(row.id, { fileName: onboarding?.resumeFilename ?? null, signedUrl: null });
        return;
      }
      resumeByUser.set(
        row.id,
        await resolveResumeUploadForSession({
          sessionId: onboarding.id,
          resumeFilename: onboarding.resumeFilename,
        }),
      );
    }),
  );

  return profileRows.map((row) => ({
    profile: {
      ...profileFromRow(row, []),
      contactEmail: row.contact_email ?? null,
    },
    externalUserId: row.external_user_id ?? null,
    posthogDistinctId: row.external_user_id ?? row.contact_email ?? row.id,
    posthogPersonUrl: posthogPersonUrl(row.external_user_id ?? row.contact_email ?? row.id),
    welcomeEmailSentAt: row.welcome_email_sent_at ?? null,
    onboarding: latestOnboardingByUser.get(row.id) ?? null,
    assessment: latestAssessmentByUser.get(row.id) ?? null,
    projectCount: projectCountByUser.get(row.id) ?? 0,
    chat: chatByUser.get(row.id) ?? emptySignupAuditChatSummary(),
    resume: resumeByUser.get(row.id) ?? { fileName: null, signedUrl: null },
  })) satisfies SignupAuditRecord[];
}

export async function runtimeListSignupAuditRecords(input?: {
  days?: number;
  limit?: number;
  search?: string | null;
  includeSeeded?: boolean;
}) {
  if (mode() === "memory") return [] as SignupAuditRecord[];

  const supabase = getSupabaseAdmin();
  const days = Math.max(1, Math.min(90, Math.floor(Number(input?.days ?? 7) || 7)));
  const limit = Math.max(1, Math.min(200, Math.floor(Number(input?.limit ?? 50) || 50)));
  const includeSeeded = input?.includeSeeded === true;
  const search = typeof input?.search === "string" ? input.search.trim().toLowerCase() : "";
  const fetchLimit = Math.max(limit * 4, 200);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  let profileQuery = supabase
    .from("learner_profiles")
    .select(
      "id,external_user_id,handle,full_name,headline,bio,career_path_id,published,tokens_used,goals,tools,social_links,acquisition,contact_email,stripe_customer_id,created_at,updated_at,welcome_email_sent_at",
    )
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(fetchLimit);

  if (!includeSeeded) {
    profileQuery = profileQuery.not("external_user_id", "is", null);
  }

  const { data: rawProfiles } = await profileQuery;
  const matchedProfiles = ((rawProfiles ?? []) as SignupAuditProfileRow[])
    .filter((row) => {
      if (!search) return true;
      return [row.full_name, row.contact_email, row.handle]
        .filter((value): value is string => typeof value === "string")
        .some((value) => value.toLowerCase().includes(search));
    })
    .slice(0, limit);

  if (!matchedProfiles.length) {
    return [] as SignupAuditRecord[];
  }

  return hydrateSignupAuditRecords(matchedProfiles);
}

export async function runtimeGetSignupAuditDetail(userId: string) {
  if (mode() === "memory") return null as SignupAuditDetail | null;

  const supabase = getSupabaseAdmin();
  const normalizedUserId = normalizeUserId(userId);
  const { data: rawProfile } = await supabase
    .from("learner_profiles")
    .select(
      "id,external_user_id,handle,full_name,headline,bio,career_path_id,published,tokens_used,goals,tools,social_links,acquisition,contact_email,stripe_customer_id,created_at,updated_at,welcome_email_sent_at",
    )
    .eq("id", normalizedUserId)
    .maybeSingle();

  const profileRow = (rawProfile as SignupAuditProfileRow | null) ?? null;
  if (!profileRow?.id) return null;

  const [baseRecord] = await hydrateSignupAuditRecords([profileRow]);
  if (!baseRecord) return null;

  const [{ data: onboardingRows }, { data: assessmentRows }, { data: projectRows }, { data: jobEvents }, { data: buildLogs }] =
    await Promise.all([
      supabase
        .from("onboarding_sessions")
        .select("id,situation,career_path_id,linkedin_url,resume_filename,ai_knowledge_score,goals,acquisition,status,created_at,updated_at")
        .eq("learner_profile_id", profileRow.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("assessment_attempts")
        .select("id,score,answers,recommended_career_path_ids,started_at,submitted_at,updated_at")
        .eq("learner_profile_id", profileRow.id)
        .order("started_at", { ascending: true }),
      supabase
        .from("projects")
        .select("id,slug,title,state,created_at,updated_at")
        .eq("learner_profile_id", profileRow.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("agent_job_events")
        .select("id,project_id,event_type,message,created_at")
        .eq("learner_profile_id", profileRow.id)
        .order("created_at", { ascending: true })
        .limit(200),
      supabase
        .from("build_log_entries")
        .select("id,project_id,level,message,created_at")
        .eq("learner_profile_id", profileRow.id)
        .order("created_at", { ascending: true })
        .limit(200),
    ]);

  const projects = ((projectRows ?? []) as Array<{
    id: string;
    slug: string;
    title: string;
    state: Project["state"];
    created_at: string;
    updated_at: string;
  }>).map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    state: row.state,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })) satisfies SignupAuditProjectSummary[];

  const timeline: SignupAuditTimelineEntry[] = [];
  const pushTimeline = (entry: SignupAuditTimelineEntry | null | undefined) => {
    if (!entry?.timestamp) return;
    timeline.push(entry);
  };
  const includeJobEvent = (eventType: string, message: string | null | undefined) => {
    const normalizedType = eventType.trim().toLowerCase();
    const normalizedMessage = (message ?? "").trim().toLowerCase();
    if (normalizedType === "job.queued" || normalizedType === "job.running") {
      return false;
    }
    if (normalizedType.includes("memory") || normalizedMessage.includes("memory.refresh")) {
      return false;
    }
    return true;
  };

  const profileAcquisition = parseAcquisition(profileRow.acquisition);
  if (profileAcquisition?.first?.capturedAt) {
    pushTimeline({
      id: `attr-first-${profileRow.id}`,
      timestamp: profileAcquisition.first.capturedAt,
      category: "attribution",
      title: "First attribution captured",
      detail: [profileAcquisition.first.utmSource, profileAcquisition.first.utmCampaign, profileAcquisition.first.landingPath]
        .filter(Boolean)
        .join(" • ") || null,
    });
  }
  if (profileAcquisition?.last?.capturedAt && profileAcquisition.last.capturedAt !== profileAcquisition.first?.capturedAt) {
    pushTimeline({
      id: `attr-last-${profileRow.id}`,
      timestamp: profileAcquisition.last.capturedAt,
      category: "attribution",
      title: "Last attribution touch captured",
      detail: [profileAcquisition.last.utmSource, profileAcquisition.last.utmCampaign, profileAcquisition.last.landingPath]
        .filter(Boolean)
        .join(" • ") || null,
    });
  }

  pushTimeline({
    id: `signup-${profileRow.id}`,
    timestamp: profileRow.created_at,
    category: "signup",
    title: "Signup recorded",
    detail: profileRow.contact_email ?? profileRow.handle,
  });

  if (profileRow.welcome_email_sent_at) {
    pushTimeline({
      id: `welcome-${profileRow.id}`,
      timestamp: profileRow.welcome_email_sent_at,
      category: "email",
      title: "Welcome email sent",
      detail: profileRow.contact_email ?? null,
    });
  }

  for (const row of (onboardingRows ?? []) as Array<{
    id: string;
    situation: OnboardingSession["situation"];
    career_path_id: string | null;
    linkedin_url: string | null;
    resume_filename: string | null;
    ai_knowledge_score: number | null;
    goals: string[] | null;
    acquisition?: Record<string, unknown> | null;
    status: OnboardingSession["status"];
    created_at: string;
    updated_at: string;
  }>) {
    pushTimeline({
      id: `onboarding-start-${row.id}`,
      timestamp: row.created_at,
      category: "onboarding",
      title: "Onboarding session started",
      detail: [row.status, row.career_path_id, row.situation].filter(Boolean).join(" • ") || null,
    });
    if (row.updated_at && row.updated_at !== row.created_at) {
      const intake = parseStoredOnboardingIntakeProfile(row.acquisition);
      const primaryGoal = Array.isArray((intake as Record<string, unknown> | undefined)?.selectedGoals)
        ? String(((intake as Record<string, unknown>).selectedGoals as unknown[])[0] ?? "")
        : row.goals?.[0] ?? null;
      pushTimeline({
        id: `onboarding-update-${row.id}`,
        timestamp: row.updated_at,
        category: "onboarding",
        title: "Onboarding draft updated",
        detail: [row.status, primaryGoal, row.resume_filename ? "resume" : "", row.linkedin_url ? "linkedin" : ""]
          .filter(Boolean)
          .join(" • ") || null,
      });
    }
  }

  for (const row of (assessmentRows ?? []) as Array<{
    id: string;
    score: number;
    answers: Array<{ questionId: string; value: number }> | null;
    recommended_career_path_ids: string[] | null;
    started_at: string;
    submitted_at: string | null;
  }>) {
    pushTimeline({
      id: `assessment-start-${row.id}`,
      timestamp: row.started_at,
      category: "assessment",
      title: "Assessment started",
      detail: null,
    });
    if (row.submitted_at) {
      pushTimeline({
        id: `assessment-submit-${row.id}`,
        timestamp: row.submitted_at,
        category: "assessment",
        title: "Assessment submitted",
        detail: `Score ${Math.round((Number(row.score ?? 0) <= 1 ? Number(row.score ?? 0) * 100 : Number(row.score ?? 0)) || 0)}%`,
      });
    }
  }

  for (const project of projects) {
    pushTimeline({
      id: `project-${project.id}`,
      timestamp: project.createdAt,
      category: "project",
      title: `Project created: ${project.title}`,
      detail: project.state,
      projectId: project.id,
    });
  }

  for (const row of (jobEvents ?? []) as Array<{
    id: string;
    project_id: string | null;
    event_type: string;
    message: string;
    created_at: string;
  }>) {
    if (!includeJobEvent(row.event_type, row.message)) continue;
    pushTimeline({
      id: row.id,
      timestamp: row.created_at,
      category: "job",
      title: row.event_type,
      detail: row.message ?? null,
      projectId: row.project_id,
    });
  }

  for (const row of (buildLogs ?? []) as Array<{
    id: string;
    project_id: string | null;
    level: BuildLogEntry["level"];
    message: string;
    created_at: string;
  }>) {
    const message = row.message?.trim() ?? "";
    if (!message) continue;
    if (/^User message:/i.test(message)) {
      pushTimeline({
        id: row.id,
        timestamp: row.created_at,
        category: "chat",
        title: "User chat message",
        detail: message.replace(/^User message:\s*/i, "").trim() || null,
        projectId: row.project_id,
      });
      continue;
    }
    if (/^Artifact generated:/i.test(message) || /^Project .* created\.$/i.test(message) || /^My AI Skill Tutor reply generated/i.test(message)) {
      pushTimeline({
        id: row.id,
        timestamp: row.created_at,
        category: "project",
        title: message,
        detail: row.level,
        projectId: row.project_id,
      });
    }
  }

  timeline.sort((a, b) => {
    const time = a.timestamp.localeCompare(b.timestamp);
    if (time !== 0) return time;
    return a.id.localeCompare(b.id);
  });

  return {
    ...baseRecord,
    projects,
    timeline,
  } satisfies SignupAuditDetail;
}

async function getAgentMemoryRowsForUser(userId: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("agent_memory")
    .select("memory_key,memory_value")
    .eq("learner_profile_id", userId)
    .order("refreshed_at", { ascending: false })
    .limit(12);

  return (data ?? []).map((row) => ({
    key: String(row.memory_key),
    value: row.memory_value,
  }));
}

async function assembleLearnerNewsContext(input: {
  userId: string;
  seed?: { name?: string; handleBase?: string; avatarUrl?: string | null; email?: string | null };
}) {
  const summary = await runtimeGetDashboardSummary(input.userId, input.seed);
  if (!summary) return null;

  const [onboarding, assessment, memoryRows] = await Promise.all([
    getLatestOnboardingSessionForUser(summary.user.id),
    getLatestAssessmentAttemptForUser(summary.user.id),
    getAgentMemoryRowsForUser(summary.user.id),
  ]);

  const { missionSnapshot, memorySnapshot } = extractMissionAndMemory(memoryRows);

  const focusSignals: string[] = [];
  if (summary.user.goals.length) focusSignals.push(`goals:${summary.user.goals.slice(0, 3).join(",")}`);
  if (summary.user.tools.length) focusSignals.push(`tools:${summary.user.tools.slice(0, 4).join(",")}`);
  if (summary.user.skills.length) {
    const topSkills = summary.user.skills
      .slice()
      .sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0))
      .slice(0, 4)
      .map((entry) => entry.skill);
    focusSignals.push(`skills:${topSkills.join(",")}`);
  }
  if (summary.projects.length) {
    focusSignals.push(`projects:${summary.projects.slice(0, 3).map((entry) => `${entry.title}(${entry.state})`).join(" | ")}`);
  }
  if (onboarding?.situation) {
    focusSignals.push(`onboarding_situation:${onboarding.situation}`);
  }
  if (onboarding?.aiKnowledgeScore != null) {
    focusSignals.push(`ai_knowledge_score:${Number(onboarding.aiKnowledgeScore).toFixed(2)}`);
  }
  if (assessment?.recommendedCareerPathIds?.length) {
    focusSignals.push(`recommended_paths:${assessment.recommendedCareerPathIds.slice(0, 3).join(",")}`);
  }

  const careerPathIds = Array.from(
    new Set([
      summary.user.careerPathId,
      ...(assessment?.recommendedCareerPathIds ?? []),
      ...(onboarding?.careerPathId ? [onboarding.careerPathId] : []),
    ].filter(Boolean)),
  );

  return {
    user: summary.user,
    projects: summary.projects,
    latestEvents: summary.latestEvents,
    onboarding,
    assessment,
    memoryRows,
    missionSnapshot,
    memorySnapshot,
    focusSignals,
    careerPathIds,
  } satisfies LearnerNewsContext;
}

async function generateNewsFromOpenAi(input: {
  context: LearnerNewsContext;
  count: number;
}): Promise<{ source: "llm_web" | "fallback"; focusSummary: string; selectionRationale: string; stories: PersonalizedNewsStory[] }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return {
      source: "fallback",
      focusSummary: "Fallback stories generated from local learner context.",
      selectionRationale: "OpenAI API key missing; using deterministic context-based recommendations.",
      stories: buildFallbackPersonalizedStories(input.context, input.count),
    };
  }

  const model = process.env.OPENAI_NEWS_MODEL?.trim() || process.env.OPENAI_MODEL?.trim() || "gpt-4.1";
  const contextForPrompt = {
    profile: {
      name: input.context.user.name,
      headline: input.context.user.headline,
      bio: input.context.user.bio,
      careerPathId: input.context.user.careerPathId,
      goals: input.context.user.goals,
      tools: input.context.user.tools,
      topSkills: input.context.user.skills
        .slice(0, 6)
        .map((entry) => ({ skill: entry.skill, score: Number(entry.score ?? 0), status: entry.status })),
    },
    onboarding: input.context.onboarding
      ? {
          situation: input.context.onboarding.situation,
          goals: input.context.onboarding.goals,
          aiKnowledgeScore: input.context.onboarding.aiKnowledgeScore,
          careerPathId: input.context.onboarding.careerPathId,
        }
      : null,
    assessment: input.context.assessment,
    projects: input.context.projects.slice(0, 5).map((project) => ({
      title: project.title,
      description: project.description,
      state: project.state,
      recentLog: project.buildLog.slice(-2).map((entry) => entry.message).join(" | "),
    })),
    recentEvents: input.context.latestEvents.slice(0, 8).map((event) => event.message),
    missionSnapshot: input.context.missionSnapshot,
    memorySnapshot: input.context.memorySnapshot,
    focusSignals: input.context.focusSignals,
  };

  const prompt = [
    "You are an AI news curator for a specific user. Identify the most relevant recent AI stories for this person.",
    "Prioritize these themes: capabilities, tools, job displacement, policy, and workflow changes.",
    "Use reliable sources and prefer recent stories (last 90 days when possible).",
    `Return STRICT JSON only with this exact shape:`,
    "{",
    '  "focusSummary": "short summary of what this user should watch",',
    '  "selectionRationale": "why these stories were selected for this user",',
    '  "stories": [',
    "    {",
    '      "title": "story headline",',
    '      "url": "https://...",',
    '      "source": "publisher name",',
    '      "publishedAt": "ISO date or YYYY-MM-DD",',
    '      "summary": "2-3 sentence summary",',
    '      "category": "capabilities|tools|job_displacement|policy|workflow",',
    '      "relevanceScore": 0-100,',
    '      "whyRelevant": "personal relevance explanation",',
    '      "actionForUser": "specific next action",',
    '      "impact": "high|medium|low"',
    "    }",
    "  ]",
    "}",
    `Return ${input.count} stories.`,
    "Avoid generic advice. Tie each story directly to user context.",
    `User context JSON:\n${JSON.stringify(contextForPrompt, null, 2)}`,
  ].join("\n");

  try {
    const timeoutMs = Math.max(4000, Math.min(20000, Number(process.env.OPENAI_NEWS_TIMEOUT_MS ?? 12000)));
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(new Error("OPENAI_NEWS_TIMEOUT")), timeoutMs);
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        input: prompt,
        temperature: 0.2,
        tools: [{ type: "web_search_preview" }],
      }),
    }).finally(() => clearTimeout(timeoutHandle));

    if (!response.ok) {
      throw new Error(`OPENAI_RESPONSE_FAILED:${response.status}`);
    }

    const payload = (await response.json()) as {
      output_text?: string;
      output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
    };
    const outputText = extractOpenAiOutputText(payload);
    const parsed = extractJsonPayload(outputText);
    if (!parsed || !Array.isArray(parsed.stories) || parsed.stories.length === 0) {
      throw new Error("OPENAI_NEWS_PARSE_FAILED");
    }

    const normalized: PersonalizedNewsStory[] = parsed.stories
      .map((story) => {
        const url = sanitizeHttpUrl(trimText(story.url, 500));
        if (!url) return null;
        const title = trimText(story.title, 220);
        const summary = trimText(story.summary, 520);
        if (!title || !summary) return null;

        return {
          title,
          url,
          summary,
          category: normalizeStoryCategory(story.category),
          relevanceScore: clampNumber(Number(story.relevanceScore ?? 0), 0, 100),
          rankingScore: 0,
          whyRelevant: trimText(story.whyRelevant, 360) || "Relevant to your current learning and project priorities.",
          recommendedAction: trimText(story.actionForUser, 300) || "Review this story and map one concrete application to your current project.",
          impact: normalizeImpact(story.impact),
          source: trimText(story.source, 120) || null,
          publishedAt: parseDateOrNow(story.publishedAt),
        } satisfies PersonalizedNewsStory;
      })
      .filter((entry): entry is PersonalizedNewsStory => Boolean(entry));

    if (!normalized.length) {
      throw new Error("OPENAI_NEWS_NORMALIZATION_EMPTY");
    }

    const ranked = normalized
      .map((story) => ({
        ...story,
        rankingScore: scoreNewsStory(story, input.context),
      }))
      .sort((a, b) => b.rankingScore - a.rankingScore)
      .slice(0, Math.max(1, Math.min(8, input.count)));

    return {
      source: "llm_web",
      focusSummary: trimText(parsed.focusSummary, 260) || "Latest AI shifts matched to your goals, tools, and active projects.",
      selectionRationale:
        trimText(parsed.selectionRationale, 360) ||
        "Selected for relevance across your goals, onboarding context, and current build activity.",
      stories: ranked,
    };
  } catch {
    const fallbackStories = buildFallbackPersonalizedStories(input.context, input.count).map((story) => ({
      ...story,
      rankingScore: scoreNewsStory(story, input.context),
    }));
    return {
      source: "fallback",
      focusSummary: "Fallback stories generated from local learner context.",
      selectionRationale: "Web-enabled generation was unavailable, so recommendations were assembled from stored user context.",
      stories: fallbackStories,
    };
  }
}

async function preferredNewsIdsForUser(userId: string, limit = 3) {
  const supabase = getSupabaseAdmin();
  const { data: personalized } = await supabase
    .from("news_insights")
    .select("id")
    .eq("learner_profile_id", userId)
    .order("published_at", { ascending: false })
    .limit(limit);

  const personalizedIds = (personalized ?? []).map((entry) => entry.id);
  if (personalizedIds.length >= limit) {
    return personalizedIds.slice(0, limit);
  }

  const globalNeed = limit - personalizedIds.length;
  const { data: global } = await supabase
    .from("news_insights")
    .select("id")
    .is("learner_profile_id", null)
    .order("published_at", { ascending: false })
    .limit(globalNeed);

  return [...personalizedIds, ...(global ?? []).map((entry) => entry.id)];
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
  const billing = await runtimeGetBillingAccessState({
    userId: input.userId,
    seed: input.seed,
  });
  if (!billing.accessAllowed) {
    return { ok: false as const, errorCode: "SUBSCRIPTION_REQUIRED", ideas: null, memorySignals: [] as string[] };
  }
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
    '- write in strict first-person singular voice ("I", "my").',
    "- never refer to the learner by name or in third person.",
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
        linkedin: sanitizeSocialText(enforceFirstPersonDraft(ideas.linkedin, summary.user.name), targetUrl),
        x: sanitizeSocialText(enforceFirstPersonDraft(ideas.x, summary.user.name), targetUrl),
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
  const billing = await runtimeGetBillingAccessState({ userId: input.userId });
  if (!billing.accessAllowed) {
    return { ok: false as const, errorCode: "SUBSCRIPTION_REQUIRED", drafts: [] as SocialDraft[] };
  }
  if (mode() === "memory") return memCreateSocialDrafts(input);
  if (input.forceFailCode) {
    return { ok: false as const, errorCode: input.forceFailCode, drafts: [] as SocialDraft[] };
  }

  const profile = await runtimeFindUserById(input.userId);
  if (!profile) return { ok: false as const, errorCode: "USER_NOT_FOUND", drafts: [] as SocialDraft[] };

  const project = input.projectId ? await runtimeFindProjectById(input.projectId) : null;
  if (input.projectId && !project) {
    return { ok: false as const, errorCode: "PROJECT_NOT_FOUND", drafts: [] as SocialDraft[] };
  }
  if (project && project.userId !== profile.id) {
    return { ok: false as const, errorCode: "FORBIDDEN", drafts: [] as SocialDraft[] };
  }
  const baseUrl = appBaseUrl();
  const profileUrl = `${baseUrl}/u/${profile.handle}`;
  const targetUrl = project ? `${profileUrl}/projects/${project.slug}` : profileUrl;
  const ogUrl = project
    ? `${baseUrl}/api/og/project/${profile.handle}/${project.slug}`
    : `${baseUrl}/api/og/profile/${profile.handle}`;

  const baseText = project
    ? `I shipped ${project.title} with ${BRAND_NAME}. Platform Verified build log plus artifacts.`
    : `I'm building AI-native skills with ${BRAND_NAME}. Platform Verified projects and proof.`;

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
  userId?: string;
  forceFailCode?: string;
}) {
  if (input.userId) {
    const billing = await runtimeGetBillingAccessState({ userId: input.userId });
    if (!billing.accessAllowed) {
      return { ok: false as const, errorCode: "SUBSCRIPTION_REQUIRED", draft: null };
    }
  }
  if (mode() === "memory") return memPublishSocialDraft(input);

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("social_drafts")
    .select("id,learner_profile_id,project_id,platform,text,og_url,share_url,status,created_at,updated_at")
    .eq("id", input.draftId)
    .maybeSingle();

  if (!data) return { ok: false as const, errorCode: "DRAFT_NOT_FOUND", draft: null };

  if (input.userId) {
    const actor = await runtimeFindUserById(input.userId);
    if (!actor) return { ok: false as const, errorCode: "USER_NOT_FOUND", draft: null };
    if (data.learner_profile_id !== actor.id) {
      return { ok: false as const, errorCode: "FORBIDDEN", draft: null };
    }
  }

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

export async function runtimeRefreshRelevantNews(options?: {
  forceFailCode?: string;
  userId?: string;
  seed?: { name?: string; handleBase?: string; avatarUrl?: string | null; email?: string | null };
  maxStories?: number;
  preferFresh?: boolean;
}) {
  if (options?.userId) {
    const billing = await runtimeGetBillingAccessState({
      userId: options.userId,
      seed: options.seed,
    });
    if (!billing.accessAllowed) {
      return { ok: false as const, errorCode: "SUBSCRIPTION_REQUIRED", insights: [] };
    }
  }
  if (mode() === "memory") {
    const memoryResult = memRefreshRelevantNews({
      forceFailCode: options?.forceFailCode,
      userId: options?.userId,
      contextSignals: [],
    });
    if (!memoryResult.ok) {
      return { ok: false as const, errorCode: memoryResult.errorCode, insights: [] };
    }
    return {
      ok: true as const,
      source: "memory_fallback" as const,
      contextSignals: [] as string[],
      focusSummary: "In-memory personalized AI news recommendations.",
      selectionRationale: "Generated from local test state.",
      insights: memoryResult.insights,
    };
  }
  if (options?.forceFailCode) {
    return { ok: false as const, errorCode: options.forceFailCode, insights: [] };
  }

  const supabase = getSupabaseAdmin();
  const maxStories = Math.max(3, Math.min(8, Number(options?.maxStories ?? 5)));
  const preferFresh = Boolean(options?.preferFresh);

  const mapNewsInsightRow = (row: {
    id: string;
    title: string;
    url: string;
    summary: string;
    career_path_ids: string[];
    published_at: string;
    learner_profile_id: string | null;
    metadata: Record<string, unknown>;
  }): NewsInsight => ({
    id: row.id,
    title: row.title,
    url: row.url,
    summary: row.summary,
    careerPathIds: row.career_path_ids,
    publishedAt: row.published_at,
    learnerProfileId: row.learner_profile_id,
    category: (row.metadata.category as NewsInsight["category"]) ?? "workflow",
    relevanceScore: Number(row.metadata.relevance_score ?? 0),
    rankingScore: Number(row.metadata.ranking_score ?? 0),
    whyRelevant: String(row.metadata.why_relevant ?? ""),
    recommendedAction: String(row.metadata.recommended_action ?? ""),
    impact: (row.metadata.impact as NewsInsight["impact"]) ?? "medium",
    source: typeof row.metadata.source === "string" ? row.metadata.source : null,
    contextSignals: Array.isArray(row.metadata.context_signals)
      ? row.metadata.context_signals.filter((entry): entry is string => typeof entry === "string")
      : [],
  });

  const rowsToResponse = (
    rows: Array<{
      id: string;
      title: string;
      url: string;
      summary: string;
      career_path_ids: string[];
      published_at: string;
      learner_profile_id: string | null;
      metadata: Record<string, unknown>;
    }>,
    fallback: {
      source: string;
      contextSignals: string[];
      focusSummary: string;
      selectionRationale: string;
    },
  ) => {
    const newestMetadata = (rows[0]?.metadata ?? {}) as Record<string, unknown>;
    return {
      ok: true as const,
      source:
        typeof newestMetadata.generated_source === "string" && newestMetadata.generated_source.trim().length
          ? newestMetadata.generated_source
          : fallback.source,
      contextSignals: Array.isArray(newestMetadata.context_signals)
        ? newestMetadata.context_signals.filter((entry): entry is string => typeof entry === "string")
        : fallback.contextSignals,
      focusSummary:
        typeof newestMetadata.focus_summary === "string" && newestMetadata.focus_summary.trim().length
          ? newestMetadata.focus_summary
          : fallback.focusSummary,
      selectionRationale:
        typeof newestMetadata.selection_rationale === "string" && newestMetadata.selection_rationale.trim().length
          ? newestMetadata.selection_rationale
          : fallback.selectionRationale,
      insights: rows.map((row) =>
        mapNewsInsightRow({
          ...row,
          metadata: (row.metadata ?? {}) as Record<string, unknown>,
        }),
      ),
    };
  };

  if (!options?.userId) {
    const now = new Date().toISOString();
    const rows = [
      {
        id: randomUUID(),
        title: "Model capability leap: teams are hardening eval gates before release",
        url: "https://openai.com/news/",
        summary: "Production teams are emphasizing evaluation coverage and regression checks for reliable AI shipping.",
        career_path_ids: ["software-engineering", "quality-assurance"],
        published_at: now,
        learner_profile_id: null,
        metadata: {
          category: "capabilities",
          relevance_score: 80,
          ranking_score: 80,
          impact: "high",
          source: "OpenAI News",
        },
      },
      {
        id: randomUUID(),
        title: "Tooling shift: agent-first automation is moving into mainstream stacks",
        url: "https://www.anthropic.com/news",
        summary: "Teams are using integrated agent tooling to reduce manual orchestration and speed up experiments.",
        career_path_ids: ["operations", "marketing-seo", "sales-revops"],
        published_at: now,
        learner_profile_id: null,
        metadata: {
          category: "tools",
          relevance_score: 76,
          ranking_score: 76,
          impact: "medium",
          source: "Anthropic News",
        },
      },
      {
        id: randomUUID(),
        title: "Labor market trend: AI-assisted execution proof is becoming mandatory",
        url: "https://www.weforum.org/stories/",
        summary: "Hiring bar is shifting from AI familiarity to demonstrable AI-enabled output and business impact.",
        career_path_ids: ["product-management", "customer-support", "operations"],
        published_at: now,
        learner_profile_id: null,
        metadata: {
          category: "job_displacement",
          relevance_score: 83,
          ranking_score: 83,
          impact: "high",
          source: "World Economic Forum",
        },
      },
    ];

    await supabase.from("news_insights").delete().is("learner_profile_id", null);
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
      source: "global_fallback" as const,
      contextSignals: [] as string[],
      focusSummary: "Global AI trends relevant to platform learners.",
      selectionRationale: "Refreshed baseline global stories.",
      insights: rows.map((row) => ({
        id: row.id,
        title: row.title,
        url: row.url,
        summary: row.summary,
        careerPathIds: row.career_path_ids,
        publishedAt: row.published_at,
        learnerProfileId: null,
        category: row.metadata.category,
        relevanceScore: row.metadata.relevance_score,
        rankingScore: row.metadata.ranking_score,
        impact: row.metadata.impact,
        source: row.metadata.source,
      })),
    };
  }

  const context = await assembleLearnerNewsContext({
    userId: options.userId,
    seed: options.seed,
  });

  if (!context) {
    return { ok: false as const, errorCode: "USER_NOT_FOUND", insights: [] };
  }

  const { data: cachedPersonalizedRows } = await supabase
    .from("news_insights")
    .select("id,title,url,summary,career_path_ids,published_at,learner_profile_id,metadata")
    .eq("learner_profile_id", context.user.id)
    .order("published_at", { ascending: false })
    .limit(maxStories);

  const todayUtc = new Date().toISOString().slice(0, 10);
  const newestCached = (cachedPersonalizedRows ?? [])[0];
  const newestCachedDay =
    newestCached && typeof newestCached.published_at === "string" ? newestCached.published_at.slice(0, 10) : "";
  const hasPersonalizedRows = (cachedPersonalizedRows?.length ?? 0) >= 3;

  if (hasPersonalizedRows && newestCachedDay === todayUtc) {
    return rowsToResponse(cachedPersonalizedRows ?? [], {
      source: "cache",
      contextSignals: context.focusSignals,
      focusSummary: "Daily AI news briefing from your latest context.",
      selectionRationale: "Loaded cached personalized AI news for the current day.",
    });
  }

  const { data: cachedGlobalRows } = await supabase
    .from("news_insights")
    .select("id,title,url,summary,career_path_ids,published_at,learner_profile_id,metadata")
    .is("learner_profile_id", null)
    .order("published_at", { ascending: false })
    .limit(maxStories);

  const newestGlobal = (cachedGlobalRows ?? [])[0];
  const newestGlobalDay =
    newestGlobal && typeof newestGlobal.published_at === "string" ? newestGlobal.published_at.slice(0, 10) : "";
  const hasGlobalRows = (cachedGlobalRows?.length ?? 0) >= 3;

  if (!preferFresh) {
    if (hasPersonalizedRows) {
      return rowsToResponse(cachedPersonalizedRows ?? [], {
        source: "stale_cache",
        contextSignals: context.focusSignals,
        focusSummary: "Showing your latest stored AI news while a fresh briefing catches up.",
        selectionRationale: "Returned the most recent personalized AI news to avoid an empty state.",
      });
    }
    if (hasGlobalRows) {
      return rowsToResponse(cachedGlobalRows ?? [], {
        source: newestGlobalDay === todayUtc ? "global_cache" : "global_stale_cache",
        contextSignals: context.focusSignals,
        focusSummary: "Showing the latest available AI stories matched to your current goals and projects.",
        selectionRationale: "Returned the latest stored global AI briefing to keep the feed warm.",
      });
    }
  }

  const generated = await generateNewsFromOpenAi({
    context,
    count: maxStories,
  });

  if (generated.source === "fallback") {
    if (hasPersonalizedRows) {
      return rowsToResponse(cachedPersonalizedRows ?? [], {
        source: "stale_cache",
        contextSignals: context.focusSignals,
        focusSummary: "Showing your latest stored AI news while a fresh briefing catches up.",
        selectionRationale: "Fresh generation timed out, so the most recent personalized AI news was returned.",
      });
    }
    if (hasGlobalRows) {
      return rowsToResponse(cachedGlobalRows ?? [], {
        source: newestGlobalDay === todayUtc ? "global_cache" : "global_stale_cache",
        contextSignals: context.focusSignals,
        focusSummary: "Showing the latest available AI stories matched to your current goals and projects.",
        selectionRationale: "Fresh generation timed out, so the latest stored global AI briefing was returned.",
      });
    }
  }

  const now = new Date().toISOString();
  const rows = generated.stories.map((story) => ({
    id: randomUUID(),
    learner_profile_id: context.user.id,
    title: story.title,
    url: story.url,
    summary: story.summary,
    career_path_ids: context.careerPathIds.length ? context.careerPathIds : [context.user.careerPathId],
    published_at: story.publishedAt || now,
    metadata: {
      category: story.category,
      relevance_score: story.relevanceScore,
      ranking_score: story.rankingScore,
      why_relevant: story.whyRelevant,
      recommended_action: story.recommendedAction,
      impact: story.impact,
      source: story.source,
      context_signals: context.focusSignals,
      focus_summary: generated.focusSummary,
      selection_rationale: generated.selectionRationale,
      generated_source: generated.source,
    },
  }));

  await supabase.from("news_insights").delete().eq("learner_profile_id", context.user.id);
  if (rows.length) {
    await supabase.from("news_insights").insert(rows);
  }

  await runtimeQueueAgentMemoryRefreshJob({
    userId: context.user.id,
    reason: "news_refresh_personalized",
  });

  return {
    ok: true as const,
    source: generated.source,
    contextSignals: context.focusSignals,
    focusSummary: generated.focusSummary,
    selectionRationale: generated.selectionRationale,
    insights: rows.map((row) =>
      mapNewsInsightRow({
        ...row,
        metadata: row.metadata as Record<string, unknown>,
      }),
    ),
  };
}

export async function runtimeCreateDailyUpdate(input: { userId: string; forceFailCode?: string }) {
  const billing = await runtimeGetBillingAccessState({ userId: input.userId });
  if (!billing.accessAllowed) {
    return { ok: false as const, errorCode: "SUBSCRIPTION_REQUIRED", update: null };
  }
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
  const preferredNewsIds = await preferredNewsIdsForUser(profile.id, 3);

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
    news_ids: preferredNewsIds,
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

type RuntimeTalentFilters = Parameters<typeof listTalent>[0] & { realOnly?: boolean };

export async function runtimeListTalent(filters?: RuntimeTalentFilters) {
  const { realOnly = false, ...queryFilters } = filters ?? {};

  if (mode() === "memory") return listTalent(queryFilters);

  const supabase = getSupabaseAdmin();
  const includeSynthetic = !realOnly && includeSyntheticTalent();
  const synthetic = includeSynthetic ? listTalent(queryFilters) : [];

  const { data: profiles, error } = await supabase
    .from("learner_profiles")
    .select("id,handle,full_name,headline,career_path_id,published,tools,goals,social_links,updated_at")
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error || !profiles?.length) {
    return includeSynthetic ? listTalent(queryFilters) : [];
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

  const fallbackSynthetic = !includeSynthetic && !real.length ? listTalent(queryFilters) : [];
  const mergedByHandle = new Map<string, TalentCard>();
  if (includeSynthetic) {
    for (const candidate of synthetic) mergedByHandle.set(candidate.handle, candidate);
  } else if (!real.length) {
    for (const candidate of fallbackSynthetic) mergedByHandle.set(candidate.handle, candidate);
  }
  for (const candidate of real) mergedByHandle.set(candidate.handle, candidate);

  const all = includeSynthetic || !real.length ? [...mergedByHandle.values()] : real;
  const query = queryFilters.q?.toLowerCase().trim();

  return all.filter((candidate) => {
    if (queryFilters.role && candidate.role !== queryFilters.role) return false;
    if (queryFilters.skill && !candidate.topSkills.includes(queryFilters.skill)) return false;
    if (queryFilters.tool && !candidate.topTools.includes(queryFilters.tool)) return false;
    if (queryFilters.status && candidate.status !== queryFilters.status) return false;
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
      careerType: profile.goals.includes("showcase_for_job") || profile.goals.includes("find_new_role") ? "Job Seeker" : "Employed",
      role: profile.headline || "AI Builder",
      status,
      topSkills: topSkills.length ? topSkills : ["AI Foundations"],
      topTools: profile.tools.length ? profile.tools.slice(0, 3) : [BRAND_NAME],
      evidenceScore: Math.max(0, Math.min(100, evidenceScore)),
    } as TalentCard;
  }

  const syntheticCandidate = getTalentByHandle(handle);
  if (syntheticCandidate) {
    return syntheticCandidate;
  }

  if (includeSyntheticTalent()) {
    return getTalentByHandle(handle);
  }
  return null;
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
