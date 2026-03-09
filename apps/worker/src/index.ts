import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  CAREER_PATHS,
  EMAIL_PRODUCT_NAME,
  LIFECYCLE_EMAIL_UTM_MEDIUM,
  LIFECYCLE_EMAIL_UTM_SOURCE,
  appendLifecycleEmailTracking,
  buildLifecycleEmail,
  capturePosthogServerEvent,
  resolveLifecycleEmailKey,
  type LifecycleEmailAssessment,
  type LifecycleEmailKey,
  type LifecycleEmailNewsItem,
  type LifecycleEmailSocialDraft,
} from "@aitutor/shared";

type ArtifactKind = "website" | "pptx" | "pdf" | "resume_docx" | "resume_pdf";

type ClaimedJob = {
  id: string;
  learner_profile_id: string | null;
  project_id: string | null;
  type: string;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
  max_attempts: number;
};

type LifecycleEmailEventType =
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained"
  | "unsubscribed";

const workerId = process.env.WORKER_ID ?? `worker_${Math.random().toString(36).slice(2, 8)}`;
const claimLimit = Number(process.env.CLAIM_LIMIT ?? "5");
const pollMs = Number(process.env.WORKER_POLL_MS ?? "2500");
const schedulerMs = Number(process.env.SCHEDULER_POLL_MS ?? "60000");
const defaultUserRef = process.env.DEFAULT_USER_ID ?? "user_test_0001";
const defaultBaseUrl = "https://www.myaiskilltutor.com";

let client: SupabaseClient | null = null;
let started = false;

function nowIso() {
  return new Date().toISOString();
}

function normalizeSiteUrl(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return defaultBaseUrl;
  const withScheme = /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withScheme);
    url.protocol = "https:";
    url.port = "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return trimmed.replace(/\/+$/, "");
  }
}

function appBaseUrl() {
  const explicit = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (explicit?.trim()) return normalizeSiteUrl(explicit);
  if (process.env.VERCEL_URL?.trim()) return normalizeSiteUrl(process.env.VERCEL_URL);
  return defaultBaseUrl;
}

function posthogCaptureHost() {
  return (process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://us.i.posthog.com").replace(/\/+$/, "");
}

function posthogProjectApiKey() {
  return process.env.POSTHOG_PROJECT_API_KEY?.trim() || process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() || "";
}

function splitEnvList(raw: string | undefined) {
  if (!raw?.trim()) return [];
  return Array.from(
    new Set(
      raw
        .split(/[,\n]/)
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}

function dailySignupReportRecipients() {
  return splitEnvList(
    process.env.DAILY_SIGNUP_REPORT_RECIPIENTS ?? process.env.RESEND_SIGNUP_REPORT_TO,
  );
}

function dailySignupReportTimeZone() {
  return process.env.DAILY_SIGNUP_REPORT_TIMEZONE?.trim() || "America/New_York";
}

function dailySignupReportHour() {
  const parsed = Number(process.env.DAILY_SIGNUP_REPORT_HOUR ?? "8");
  if (!Number.isFinite(parsed)) return 8;
  return Math.max(0, Math.min(23, Math.floor(parsed)));
}

function timeZoneParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: Number(get("hour") || "0"),
  };
}

function dateKeyInTimeZone(date: Date, timeZone: string) {
  const parts = timeZoneParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function hourInTimeZone(date: Date, timeZone: string) {
  return timeZoneParts(date, timeZone).hour;
}

function formatDateTimeInTimeZone(input: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(input));
}

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function lifecycleFromAddress() {
  const configured = process.env.RESEND_FROM_EMAIL?.trim();
  if (configured) return configured;
  return `${EMAIL_PRODUCT_NAME} <onboarding@resend.dev>`;
}

async function sendResendEmail(input: { to: string; subject: string; html: string; text: string }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false as const,
      errorCode: "RESEND_API_KEY_MISSING",
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: lifecycleFromAddress(),
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return {
        ok: false as const,
        errorCode: `RESEND_RESPONSE_${response.status}`,
        detail: detail.slice(0, 200),
      };
    }

    const payload = (await response.json().catch(() => null)) as { id?: unknown } | null;
    return {
      ok: true as const,
      messageId: typeof payload?.id === "string" && payload.id.trim() ? payload.id.trim() : null,
    };
  } catch (error) {
    return {
      ok: false as const,
      errorCode: "RESEND_REQUEST_FAILED",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

function supabaseAdmin() {
  if (client) return client;

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error("SUPABASE_ENV_MISSING");
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return client;
}

function artifactExtension(kind: ArtifactKind) {
  switch (kind) {
    case "website":
      return "html";
    case "pptx":
      return "pptx";
    case "pdf":
      return "pdf";
    case "resume_docx":
      return "docx";
    case "resume_pdf":
      return "pdf";
    default:
      return "bin";
  }
}

function statusRank(status: string) {
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

async function insertJobEvent(input: {
  jobId: string;
  userId: string | null;
  projectId: string | null;
  type: string;
  message: string;
  payload?: Record<string, unknown>;
}) {
  const supabase = supabaseAdmin();
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

async function appendBuildLog(input: {
  projectId: string;
  userId: string;
  message: string;
  level: "info" | "success" | "warn" | "error";
  metadata?: Record<string, unknown>;
}) {
  const supabase = supabaseAdmin();
  await supabase.from("build_log_entries").insert({
    id: randomUUID(),
    project_id: input.projectId,
    learner_profile_id: input.userId,
    message: input.message,
    level: input.level,
    metadata: input.metadata ?? {},
  });
}

async function setJobStatus(job: ClaimedJob, status: string, extra?: Partial<{ lease_until: string | null; last_error_code: string | null }>) {
  const supabase = supabaseAdmin();
  await supabase
    .from("agent_jobs")
    .update({
      status,
      lease_until: extra?.lease_until ?? (status === "queued" ? null : null),
      last_error_code: extra?.last_error_code ?? null,
      updated_at: nowIso(),
    })
    .eq("id", job.id);
}

async function upsertBuiltSkill(userId: string, skillName: string, score = 0.55) {
  const supabase = supabaseAdmin();
  const { data: existing } = await supabase
    .from("user_skill_evidence")
    .select("id,status,score,evidence_count")
    .eq("learner_profile_id", userId)
    .eq("skill_name", skillName)
    .maybeSingle();

  if (!existing) {
    await supabase.from("user_skill_evidence").insert({
      id: randomUUID(),
      learner_profile_id: userId,
      skill_name: skillName,
      status: "built",
      score,
      evidence_count: 1,
    });
    return;
  }

  const existingStatus = String(existing.status ?? "not_started");
  const nextStatus = statusRank(existingStatus) > statusRank("built") ? existingStatus : "built";

  await supabase
    .from("user_skill_evidence")
    .update({
      status: nextStatus,
      score: Math.max(Number(existing.score ?? 0), score),
      evidence_count: Number(existing.evidence_count ?? 0) + 1,
      updated_at: nowIso(),
    })
    .eq("id", existing.id);
}

async function firstModuleForUser(userId: string) {
  const supabase = supabaseAdmin();
  const { data: profile } = await supabase
    .from("learner_profiles")
    .select("career_path_id")
    .eq("id", userId)
    .maybeSingle();

  const careerPathId = profile?.career_path_id;
  if (!careerPathId) return "Applied AI";

  const { data: module } = await supabase
    .from("module_catalog")
    .select("title")
    .eq("career_path_id", careerPathId)
    .order("order_index", { ascending: true })
    .limit(1)
    .maybeSingle();

  return module?.title ?? "Applied AI";
}

async function incrementTokens(userId: string, delta: number) {
  const supabase = supabaseAdmin();
  const { data: profile } = await supabase
    .from("learner_profiles")
    .select("id,tokens_used")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) return;

  await supabase
    .from("learner_profiles")
    .update({
      tokens_used: Number(profile.tokens_used ?? 0) + delta,
      updated_at: nowIso(),
    })
    .eq("id", profile.id);
}

type LifecycleProfileRow = {
  id: string;
  external_user_id: string | null;
  handle: string;
  full_name: string;
  contact_email: string | null;
  career_path_id: string | null;
  goals: string[] | null;
  acquisition: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  welcome_email_sent_at: string | null;
};

type LifecycleDeliveryRow = {
  id: string;
  campaign_key: string;
  status: string;
  recipient_email: string;
  subject: string;
  provider: string | null;
  provider_message_id: string | null;
  payload: Record<string, unknown> | null;
  sent_at: string | null;
};

type DailySignupDigestRow = {
  id: string;
  full_name: string;
  contact_email: string | null;
  created_at: string;
  external_user_id: string | null;
  career_path_id: string | null;
  acquisition: Record<string, unknown> | null;
};

type DailySignupDigestOnboardingRow = {
  id: string;
  learner_profile_id: string;
  situation: string | null;
  career_path_id: string | null;
  linkedin_url: string | null;
  resume_filename: string | null;
  ai_knowledge_score: number | null;
  goals: string[] | null;
  acquisition: Record<string, unknown> | null;
  status: string | null;
  created_at: string;
  updated_at: string;
};

type DailySignupDigestAssessmentRow = {
  id: string;
  learner_profile_id: string;
  score: number | null;
  started_at: string;
  submitted_at: string | null;
  answers: Array<{ questionId?: string; value?: number }> | null;
  recommended_career_path_ids: string[] | null;
  updated_at: string;
};

type DailySignupDigestProjectRow = {
  id: string;
  learner_profile_id: string;
};

type DailySignupDigestChatSummary = {
  userMessageCount: number;
  lastUserMessageAt: string | null;
  lastUserMessage: string | null;
};

type DailySignupDigestRecord = {
  signup: DailySignupDigestRow;
  onboarding: DailySignupDigestOnboardingRow | null;
  assessment: DailySignupDigestAssessmentRow | null;
  projectCount: number;
  chat: DailySignupDigestChatSummary;
  intake: Record<string, unknown> | null;
  attribution: {
    source: string;
    medium: string;
    campaign: string;
    content: string;
    landingPath: string;
    referrer: string;
  };
  linkedInUrl: string | null;
  resume: {
    fileName: string | null;
    signedUrl: string | null;
  };
  adminUrl: string;
  posthogUrl: string | null;
};

type DailySignupDigestState = {
  last_report_date_key?: string | null;
  last_sent_at?: string | null;
  signup_count?: number;
  recipient_count?: number;
  window_hours?: number;
};

function signupSource(row: DailySignupDigestRow) {
  const acquisition = row.acquisition;
  if (!acquisition || typeof acquisition !== "object" || Array.isArray(acquisition)) return "unknown";

  const lastTouch = "last" in acquisition ? acquisition.last : null;
  const firstTouch = "first" in acquisition ? acquisition.first : null;
  const lastSource =
    lastTouch && typeof lastTouch === "object" && !Array.isArray(lastTouch) && "utmSource" in lastTouch
      ? String(lastTouch.utmSource ?? "").trim()
      : "";
  if (lastSource) return lastSource;

  const firstSource =
    firstTouch && typeof firstTouch === "object" && !Array.isArray(firstTouch) && "utmSource" in firstTouch
      ? String(firstTouch.utmSource ?? "").trim()
      : "";
  return firstSource || "unknown";
}

function objectRecord(input: unknown) {
  return input && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : null;
}

function stringValue(input: unknown) {
  return typeof input === "string" && input.trim() ? input.trim() : null;
}

function stringArray(input: unknown) {
  return Array.isArray(input)
    ? input.map((entry) => stringValue(entry)).filter((entry): entry is string => Boolean(entry))
    : [];
}

function trimText(input: string | null | undefined, max = 220) {
  if (!input) return null;
  const normalized = input.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function safeExternalUrl(input: string | null | undefined) {
  const normalized = stringValue(input);
  if (!normalized) return null;
  if (/^https?:\/\//i.test(normalized)) return normalized;
  return `https://${normalized}`;
}

function posthogPersonUrl(query: string | null | undefined) {
  const normalized = stringValue(query);
  if (!normalized) return null;
  const projectId = process.env.POSTHOG_PROJECT_ID?.trim() || process.env.POSTHOG_CLI_PROJECT_ID?.trim() || "330799";
  return `https://us.posthog.com/project/${encodeURIComponent(projectId)}/persons?q=${encodeURIComponent(normalized)}`;
}

function extractIntakeProfile(acquisition: Record<string, unknown> | null | undefined) {
  const topLevel = objectRecord(acquisition);
  const nested = topLevel ? objectRecord(topLevel.intakeProfile) : null;
  return nested ?? topLevel;
}

function dailySignupAttribution(input: {
  signupAcquisition: Record<string, unknown> | null;
  onboardingAcquisition: Record<string, unknown> | null;
}) {
  const onboarding = objectRecord(input.onboardingAcquisition);
  const signup = objectRecord(input.signupAcquisition);
  const last = objectRecord(onboarding?.last) ?? objectRecord(signup?.last);
  const first = objectRecord(onboarding?.first) ?? objectRecord(signup?.first);
  return {
    source: stringValue(last?.utmSource) || stringValue(first?.utmSource) || "unknown",
    medium: stringValue(last?.utmMedium) || stringValue(first?.utmMedium) || "unknown",
    campaign: stringValue(last?.utmCampaign) || stringValue(first?.utmCampaign) || "unknown",
    content: stringValue(last?.utmContent) || stringValue(first?.utmContent) || "unknown",
    landingPath: stringValue(last?.landingPath) || stringValue(first?.landingPath) || "unknown",
    referrer: stringValue(last?.referrer) || stringValue(first?.referrer) || "unknown",
  };
}

function normalizePaidSourceFromAttribution(input: {
  source: string | null;
  gclid?: string | null;
  msclkid?: string | null;
}) {
  const source = (input.source ?? "").toLowerCase();
  if (source.includes("linkedin")) return "linkedin";
  if (source === "x" || source.includes("twitter")) return "x";
  if (
    source === "fb" ||
    source === "ig" ||
    source === "an" ||
    source.includes("facebook") ||
    source.includes("instagram") ||
    source.includes("meta")
  ) {
    return "facebook";
  }
  if (input.gclid || source.includes("google")) return "google";
  if (input.msclkid || source.includes("bing")) return "bing";
  return "unknown";
}

function lifecycleCohortAttribution(profile: LifecycleProfileRow) {
  const acquisition = objectRecord(profile.acquisition);
  const last = objectRecord(acquisition?.last);
  const first = objectRecord(acquisition?.first);
  const source = (stringValue(last?.utmSource) || stringValue(first?.utmSource) || "unknown").toLowerCase();
  const medium = (stringValue(last?.utmMedium) || stringValue(first?.utmMedium) || "unknown").toLowerCase();
  const campaign = (stringValue(last?.utmCampaign) || stringValue(first?.utmCampaign) || "unknown").toLowerCase();
  return {
    cohortSource: source,
    cohortMedium: medium,
    cohortCampaign: campaign,
    cohortPaidSource: normalizePaidSourceFromAttribution({
      source,
      gclid: stringValue(last?.gclid) || stringValue(first?.gclid),
      msclkid: stringValue(last?.msclkid) || stringValue(first?.msclkid),
    }),
  };
}

function lifecycleDistinctId(profile: LifecycleProfileRow, recipientEmail: string) {
  return stringValue(profile.external_user_id) || stringValue(recipientEmail) || profile.id;
}

function lifecycleEmailEventName(eventType: LifecycleEmailEventType) {
  switch (eventType) {
    case "sent":
      return "email_sent";
    case "delivered":
      return "email_delivered";
    case "opened":
      return "email_opened";
    case "clicked":
      return "email_clicked";
    case "bounced":
      return "email_bounced";
    case "complained":
      return "email_complained";
    case "unsubscribed":
      return "email_unsubscribed";
  }
}

async function insertLifecycleEmailEvent(input: {
  deliveryId: string;
  userId: string;
  externalUserId?: string | null;
  recipientEmail: string;
  campaignKey: LifecycleEmailKey;
  provider: string;
  providerMessageId?: string | null;
  providerEventId: string;
  eventType: LifecycleEmailEventType;
  eventAt: string;
  emailSource: string;
  emailMedium: string;
  emailCampaign: string;
  emailContent?: string | null;
  cohortSource: string;
  cohortMedium: string;
  cohortCampaign: string;
  cohortPaidSource: string;
  linkUrl?: string | null;
  linkHost?: string | null;
  linkPath?: string | null;
  payload?: Record<string, unknown>;
}) {
  const supabase = supabaseAdmin();
  const { error } = await supabase.from("learner_email_events").insert({
    id: randomUUID(),
    delivery_id: input.deliveryId,
    learner_profile_id: input.userId,
    external_user_id: input.externalUserId ?? null,
    provider: input.provider,
    provider_message_id: input.providerMessageId ?? null,
    provider_event_id: input.providerEventId,
    campaign_key: input.campaignKey,
    event_type: input.eventType,
    event_at: input.eventAt,
    email_source: input.emailSource,
    email_medium: input.emailMedium,
    email_campaign: input.emailCampaign,
    email_content: input.emailContent ?? null,
    cohort_source: input.cohortSource,
    cohort_medium: input.cohortMedium,
    cohort_campaign: input.cohortCampaign,
    cohort_paid_source: input.cohortPaidSource,
    link_url: input.linkUrl ?? null,
    link_host: input.linkHost ?? null,
    link_path: input.linkPath ?? null,
    payload: input.payload ?? {},
    updated_at: nowIso(),
  });

  if (error) {
    if (error.code === "23505") return false;
    throw error;
  }

  return true;
}

async function captureLifecycleEmailEventToPosthog(input: {
  distinctId: string;
  recipientEmail: string;
  userId: string;
  campaignKey: LifecycleEmailKey;
  deliveryId: string;
  eventType: LifecycleEmailEventType;
  eventAt: string;
  provider: string;
  providerMessageId?: string | null;
  emailSource: string;
  emailMedium: string;
  emailCampaign: string;
  emailContent?: string | null;
  cohortSource: string;
  cohortMedium: string;
  cohortCampaign: string;
  cohortPaidSource: string;
  linkUrl?: string | null;
  linkHost?: string | null;
  linkPath?: string | null;
  payload?: Record<string, unknown>;
}) {
  const apiKey = posthogProjectApiKey();
  if (!apiKey) return false;

  const result = await capturePosthogServerEvent({
    apiKey,
    host: posthogCaptureHost(),
    event: lifecycleEmailEventName(input.eventType),
    distinctId: input.distinctId,
    timestamp: input.eventAt,
    properties: {
      app: "email",
      channel: "email",
      event_source: input.eventType === "sent" ? "worker" : "resend_webhook",
      learner_profile_id: input.userId,
      recipient_email: input.recipientEmail,
      lifecycle_delivery_id: input.deliveryId,
      lifecycle_campaign_key: input.campaignKey,
      email_provider: input.provider,
      provider_message_id: input.providerMessageId ?? null,
      utm_source: input.emailSource,
      utm_medium: input.emailMedium,
      utm_campaign: input.emailCampaign,
      utm_content: input.emailContent ?? null,
      cohort_source: input.cohortSource,
      cohort_medium: input.cohortMedium,
      cohort_campaign: input.cohortCampaign,
      cohort_paid_source: input.cohortPaidSource,
      link_url: input.linkUrl ?? null,
      link_host: input.linkHost ?? null,
      link_path: input.linkPath ?? null,
      ...(input.payload ?? {}),
    },
  });

  if (!result.ok) {
    console.error(
      `[worker] posthog lifecycle event failed event=${lifecycleEmailEventName(input.eventType)} user=${input.userId} reason=${result.reason ?? result.status ?? "unknown"}`,
    );
  }

  return result.ok;
}

function emptyDailySignupChatSummary(): DailySignupDigestChatSummary {
  return {
    userMessageCount: 0,
    lastUserMessageAt: null,
    lastUserMessage: null,
  };
}

async function resolveResumeUploadForSession(input: {
  sessionId: string;
  resumeFilename: string | null | undefined;
}) {
  const fileName = stringValue(input.resumeFilename);
  if (!input.sessionId || !fileName) {
    return {
      fileName,
      signedUrl: null,
    };
  }

  const supabase = supabaseAdmin();
  const bucket = process.env.SUPABASE_RESUME_BUCKET?.trim() || "onboarding-resumes";
  const folder = `onboarding/${input.sessionId}`;

  try {
    const { data: objects } = await supabase.storage.from(bucket).list(folder, {
      limit: 20,
      offset: 0,
    });
    const match = (objects ?? [])
      .filter((entry) => typeof entry.name === "string" && entry.name.includes(fileName))
      .sort((a, b) => b.name.localeCompare(a.name))[0];
    if (!match?.name) {
      return {
        fileName,
        signedUrl: null,
      };
    }

    const { data: signed } = await supabase.storage
      .from(bucket)
      .createSignedUrl(`${folder}/${match.name}`, 60 * 60 * 24 * 7);
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

async function hydrateDailySignupDigestRows(rows: DailySignupDigestRow[]) {
  if (!rows.length) {
    return [] as DailySignupDigestRecord[];
  }

  const supabase = supabaseAdmin();
  const userIds = rows.map((row) => row.id);
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

  const latestOnboardingByUser = new Map<string, DailySignupDigestOnboardingRow>();
  for (const row of (onboardingRows ?? []) as DailySignupDigestOnboardingRow[]) {
    if (latestOnboardingByUser.has(row.learner_profile_id)) continue;
    latestOnboardingByUser.set(row.learner_profile_id, row);
  }

  const latestAssessmentByUser = new Map<string, DailySignupDigestAssessmentRow>();
  for (const row of (assessmentRows ?? []) as DailySignupDigestAssessmentRow[]) {
    if (latestAssessmentByUser.has(row.learner_profile_id)) continue;
    latestAssessmentByUser.set(row.learner_profile_id, row);
  }

  const projectCountByUser = new Map<string, number>();
  const projectToUser = new Map<string, string>();
  const projectIds: string[] = [];
  for (const row of (projectRows ?? []) as DailySignupDigestProjectRow[]) {
    projectIds.push(row.id);
    projectToUser.set(row.id, row.learner_profile_id);
    projectCountByUser.set(row.learner_profile_id, (projectCountByUser.get(row.learner_profile_id) ?? 0) + 1);
  }

  const chatByUser = new Map<string, DailySignupDigestChatSummary>();
  if (projectIds.length) {
    const { data: chatLogs } = await supabase
      .from("build_log_entries")
      .select("project_id,message,created_at")
      .in("project_id", projectIds)
      .ilike("message", "User message:%")
      .order("created_at", { ascending: false });

    for (const row of (chatLogs ?? []) as Array<{ project_id: string; message: string; created_at: string }>) {
      const userId = projectToUser.get(row.project_id);
      if (!userId) continue;
      const existing = chatByUser.get(userId) ?? emptyDailySignupChatSummary();
      existing.userMessageCount += 1;
      if (!existing.lastUserMessageAt) {
        existing.lastUserMessageAt = row.created_at;
        existing.lastUserMessage = trimText(row.message.replace(/^User message:\s*/i, "").trim(), 280);
      }
      chatByUser.set(userId, existing);
    }
  }

  const resumeByUser = new Map<string, { fileName: string | null; signedUrl: string | null }>();
  await Promise.all(
    rows.map(async (row) => {
      const onboarding = latestOnboardingByUser.get(row.id);
      if (!onboarding?.id) {
        resumeByUser.set(row.id, { fileName: stringValue(onboarding?.resume_filename), signedUrl: null });
        return;
      }
      resumeByUser.set(
        row.id,
        await resolveResumeUploadForSession({
          sessionId: onboarding.id,
          resumeFilename: onboarding.resume_filename,
        }),
      );
    }),
  );

  return rows.map((row) => {
    const onboarding = latestOnboardingByUser.get(row.id) ?? null;
    const assessment = latestAssessmentByUser.get(row.id) ?? null;
    const intake = extractIntakeProfile(onboarding?.acquisition);
    const linkedInUrl = safeExternalUrl(
      stringValue(intake?.linkedinUrl) || stringValue(onboarding?.linkedin_url),
    );
    const posthogQuery = row.external_user_id || row.contact_email || row.id;
    return {
      signup: row,
      onboarding,
      assessment,
      projectCount: projectCountByUser.get(row.id) ?? 0,
      chat: chatByUser.get(row.id) ?? emptyDailySignupChatSummary(),
      intake,
      attribution: dailySignupAttribution({
        signupAcquisition: row.acquisition,
        onboardingAcquisition: onboarding?.acquisition ?? null,
      }),
      linkedInUrl,
      resume: resumeByUser.get(row.id) ?? { fileName: null, signedUrl: null },
      adminUrl: `${appBaseUrl()}/dashboard/admin/signups/${row.id}`,
      posthogUrl: posthogPersonUrl(posthogQuery),
    };
  });
}

function careerPathName(pathId: string | null) {
  if (!pathId) return "Unknown";
  return CAREER_PATHS.find((path) => path.id === pathId)?.name ?? pathId;
}

function assessmentScoreLabel(score: number | null | undefined) {
  const numeric = Number(score ?? 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return "Not submitted";
  const percent = numeric <= 1 ? numeric * 100 : numeric;
  return `${Math.round(percent)}%`;
}

function assessmentAnswerSummary(answers: Array<{ questionId?: string; value?: number }> | null | undefined) {
  const labels: Record<string, string> = {
    career_experience: "exp",
    ai_comfort: "ai",
    daily_work_complexity: "work",
    linkedin_context: "linkedin",
    resume_context: "resume",
  };

  return (answers ?? [])
    .map((entry) => {
      const key = typeof entry?.questionId === "string" ? entry.questionId : null;
      const value = Number(entry?.value ?? 0);
      if (!key || !Number.isFinite(value)) return null;
      return `${labels[key] ?? key}:${value}`;
    })
    .filter((entry): entry is string => Boolean(entry))
    .join(" | ");
}

async function sendDailySignupDigest() {
  const recipients = dailySignupReportRecipients();
  if (!recipients.length) {
    console.log("[worker] daily signup digest skipped: recipients missing");
    return;
  }

  const supabase = supabaseAdmin();
  const stateProfileId = await resolveDefaultProfileId();
  if (!stateProfileId) {
    console.log("[worker] daily signup digest skipped: default profile not found");
    return;
  }

  const timeZone = dailySignupReportTimeZone();
  if (hourInTimeZone(new Date(), timeZone) < dailySignupReportHour()) {
    return;
  }

  const reportDateKey = dateKeyInTimeZone(new Date(), timeZone);
  const { data: stateRow } = await supabase
    .from("agent_memory")
    .select("memory_value")
    .eq("learner_profile_id", stateProfileId)
    .eq("memory_key", "daily_signup_digest")
    .maybeSingle();

  const state =
    stateRow?.memory_value && typeof stateRow.memory_value === "object" && !Array.isArray(stateRow.memory_value)
      ? (stateRow.memory_value as DailySignupDigestState)
      : {};
  if (state.last_report_date_key === reportDateKey) {
    return;
  }

  const windowHours = 24;
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();
  const { data: signups } = await supabase
    .from("learner_profiles")
    .select("id,full_name,contact_email,created_at,external_user_id,career_path_id,acquisition")
    .not("external_user_id", "is", null)
    .not("contact_email", "is", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = ((signups ?? []) as DailySignupDigestRow[]).filter((row) => row.contact_email);
  const records = await hydrateDailySignupDigestRows(rows);
  const sourceCounts = new Map<string, number>();
  for (const record of records) {
    const source = record.attribution.source.toLowerCase() || "unknown";
    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
  }

  const sourceSummary = Array.from(sourceCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([source, count]) => `${source}: ${count}`);

  const rangeEndLabel = formatDateTimeInTimeZone(new Date().toISOString(), timeZone);
  const rangeStartLabel = formatDateTimeInTimeZone(since, timeZone);
  const subject = `Daily signup digest: ${records.length} in the last ${windowHours} hours`;
  const onboardingCount = records.filter((record) => Boolean(record.onboarding)).length;
  const assessmentCount = records.filter((record) => Boolean(record.assessment?.submitted_at)).length;
  const chatCount = records.filter((record) => record.chat.userMessageCount > 0).length;
  const projectCount = records.filter((record) => record.projectCount > 0).length;
  const summaryText =
    records.length > 0
      ? `${records.length} signups in the last ${windowHours} hours. Sources: ${sourceSummary.join(", ")}`
      : `No new signups in the last ${windowHours} hours.`;
  const signupCards = records.length
    ? records
        .map((record) => {
          const row = record.signup;
          const intake = record.intake ?? {};
          const displayName = row.full_name?.trim() || stringValue(intake.fullName) || "Unknown";
          const email = row.contact_email?.trim() || "Unknown";
          const createdAt = formatDateTimeInTimeZone(row.created_at, timeZone);
          const path = careerPathName(record.onboarding?.career_path_id ?? row.career_path_id);
          const goals = stringArray(intake.selectedGoals).length
            ? stringArray(intake.selectedGoals)
            : (record.onboarding?.goals ?? []);
          const experience = stringValue(intake.yearsExperience) || "Not set";
          const companySize = stringValue(intake.companySize) || "Not set";
          const aiComfort = stringValue(intake.aiComfort) || "Not set";
          const careerCategory =
            stringValue(intake.careerCategoryLabel) ||
            stringValue(intake.careerCategory) ||
            stringValue(intake.customCareerCategory) ||
            "Not set";
          const jobTitle = stringValue(intake.jobTitle) || "Not set";
          const dailyWorkSummary = trimText(stringValue(intake.dailyWorkSummary), 320) || "Not provided";
          const keySkills = trimText(stringValue(intake.keySkills), 220) || "Not provided";
          const answerSummary = assessmentAnswerSummary(record.assessment?.answers);
          const recommendedPaths = (record.assessment?.recommended_career_path_ids ?? [])
            .map((entry) => careerPathName(entry))
            .join(", ");
          const links = [
            `<a href="${escapeHtml(record.adminUrl)}" style="color:#0f766e;text-decoration:underline;">Admin timeline</a>`,
            record.posthogUrl
              ? `<a href="${escapeHtml(record.posthogUrl)}" style="color:#0f766e;text-decoration:underline;">PostHog person</a>`
              : null,
            record.linkedInUrl
              ? `<a href="${escapeHtml(record.linkedInUrl)}" style="color:#0f766e;text-decoration:underline;">LinkedIn</a>`
              : null,
            record.resume.signedUrl
              ? `<a href="${escapeHtml(record.resume.signedUrl)}" style="color:#0f766e;text-decoration:underline;">Resume</a>`
              : null,
          ]
            .filter(Boolean)
            .join(" · ");

          return `
            <section style="border:1px solid #e2e8f0;border-radius:16px;padding:18px;background:#ffffff">
              <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
                <div>
                  <div style="font-size:18px;font-weight:700;color:#0f172a">${escapeHtml(displayName)}</div>
                  <div style="margin-top:4px;color:#475569">${escapeHtml(email)} · ${escapeHtml(createdAt)}</div>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap">
                  <span style="border:1px solid #bae6fd;background:#eff6ff;border-radius:999px;padding:4px 10px;font-size:12px;color:#0369a1">${escapeHtml(record.attribution.source)}</span>
                  <span style="border:1px solid #d9f99d;background:#f7fee7;border-radius:999px;padding:4px 10px;font-size:12px;color:#3f6212">${escapeHtml(record.onboarding?.status || "signup_only")}</span>
                  <span style="border:1px solid #e9d5ff;background:#faf5ff;border-radius:999px;padding:4px 10px;font-size:12px;color:#7e22ce">projects ${record.projectCount}</span>
                  <span style="border:1px solid #f5d0fe;background:#fdf4ff;border-radius:999px;padding:4px 10px;font-size:12px;color:#a21caf">chats ${record.chat.userMessageCount}</span>
                </div>
              </div>
              <div style="margin-top:14px;font-size:13px;color:#334155;line-height:1.7">
                <div><strong>Campaign:</strong> ${escapeHtml(record.attribution.campaign)} | <strong>Content:</strong> ${escapeHtml(record.attribution.content)} | <strong>Landing:</strong> ${escapeHtml(record.attribution.landingPath)}</div>
                <div><strong>Path:</strong> ${escapeHtml(path)} | <strong>Job title:</strong> ${escapeHtml(jobTitle)} | <strong>Career category:</strong> ${escapeHtml(careerCategory)}</div>
                <div><strong>Situation:</strong> ${escapeHtml(record.onboarding?.situation || "Not set")} | <strong>Goals:</strong> ${escapeHtml(goals.join(", ") || "Not set")}</div>
                <div><strong>Experience:</strong> ${escapeHtml(experience)} | <strong>Company size:</strong> ${escapeHtml(companySize)} | <strong>AI comfort:</strong> ${escapeHtml(aiComfort)}</div>
                <div><strong>Assessment:</strong> ${escapeHtml(assessmentScoreLabel(record.assessment?.score))} ${answerSummary ? `| <strong>Answers:</strong> ${escapeHtml(answerSummary)}` : ""}</div>
                <div><strong>Recommended:</strong> ${escapeHtml(recommendedPaths || "Not available")}</div>
                <div><strong>Key skills:</strong> ${escapeHtml(keySkills)}</div>
                <div><strong>Daily work summary:</strong> ${escapeHtml(dailyWorkSummary)}</div>
                <div><strong>Last chat:</strong> ${escapeHtml(record.chat.lastUserMessage || "No chat yet")}</div>
                <div><strong>Links:</strong> ${links || "No extra links available"}</div>
              </div>
            </section>
          `.trim();
        })
        .join("")
    : `
      <section style="border:1px solid #e2e8f0;border-radius:16px;padding:18px;background:#ffffff;color:#64748b;text-align:center">
        No new contactable signups in this window.
      </section>
    `.trim();

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;color:#0f172a;background:#f8fafc;padding:24px">
      <div style="max-width:900px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;padding:24px">
        <h1 style="margin:0 0 8px;font-size:24px;">Daily signup digest</h1>
        <p style="margin:0 0 16px;color:#475569;">Window: ${escapeHtml(rangeStartLabel)} to ${escapeHtml(rangeEndLabel)} (${escapeHtml(timeZone)})</p>
        <p style="margin:0 0 16px;font-size:18px;font-weight:600;">${escapeHtml(summaryText)}</p>
        <p style="margin:0 0 6px;color:#475569;">Source breakdown: ${escapeHtml(sourceSummary.join(", ") || "none")}</p>
        <p style="margin:0 0 20px;color:#475569;">Onboarding: ${onboardingCount} · Assessment complete: ${assessmentCount} · Chatted: ${chatCount} · Built projects: ${projectCount}</p>
        <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:0 0 20px;">
          <div style="border:1px solid #d1fae5;background:#ecfdf5;border-radius:14px;padding:14px">
            <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#047857">Signups</div>
            <div style="margin-top:8px;font-size:26px;font-weight:700;color:#064e3b">${records.length}</div>
          </div>
          <div style="border:1px solid #bae6fd;background:#f0f9ff;border-radius:14px;padding:14px">
            <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#0369a1">Onboarding</div>
            <div style="margin-top:8px;font-size:26px;font-weight:700;color:#0c4a6e">${onboardingCount}</div>
          </div>
          <div style="border:1px solid #fde68a;background:#fffbeb;border-radius:14px;padding:14px">
            <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#b45309">Assessment</div>
            <div style="margin-top:8px;font-size:26px;font-weight:700;color:#78350f">${assessmentCount}</div>
          </div>
          <div style="border:1px solid #e9d5ff;background:#faf5ff;border-radius:14px;padding:14px">
            <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#7e22ce">Chatters</div>
            <div style="margin-top:8px;font-size:26px;font-weight:700;color:#581c87">${chatCount}</div>
          </div>
        </div>
        <div style="display:grid;gap:14px">${signupCards}</div>
      </div>
    </div>
  `.trim();

  const textLines = [
    "Daily signup digest",
    `Window: ${rangeStartLabel} to ${rangeEndLabel} (${timeZone})`,
    summaryText,
    `Source breakdown: ${sourceSummary.join(", ") || "none"}`,
    `Onboarding: ${onboardingCount} | Assessment complete: ${assessmentCount} | Chatted: ${chatCount} | Built projects: ${projectCount}`,
    "",
    ...records.map((record) => {
      const row = record.signup;
      const intake = record.intake ?? {};
      const displayName = row.full_name?.trim() || stringValue(intake.fullName) || "Unknown";
      const email = row.contact_email?.trim() || "Unknown";
      const createdAt = formatDateTimeInTimeZone(row.created_at, timeZone);
      const path = careerPathName(record.onboarding?.career_path_id ?? row.career_path_id);
      const goals = stringArray(intake.selectedGoals).length
        ? stringArray(intake.selectedGoals).join(", ")
        : (record.onboarding?.goals ?? []).join(", ");
      const answerSummary = assessmentAnswerSummary(record.assessment?.answers) || "none";
      return [
        `${displayName} | ${email} | ${record.attribution.source} | ${path} | ${createdAt}`,
        `  admin: ${record.adminUrl}`,
        record.posthogUrl ? `  posthog: ${record.posthogUrl}` : null,
        record.linkedInUrl ? `  linkedin: ${record.linkedInUrl}` : null,
        record.resume.signedUrl ? `  resume: ${record.resume.signedUrl}` : null,
        `  status: onboarding=${record.onboarding?.status || "signup_only"} assessment=${assessmentScoreLabel(record.assessment?.score)} projects=${record.projectCount} chats=${record.chat.userMessageCount}`,
        `  campaign: ${record.attribution.campaign} | content: ${record.attribution.content} | landing: ${record.attribution.landingPath}`,
        `  title: ${stringValue(intake.jobTitle) || "Not set"} | category: ${stringValue(intake.careerCategoryLabel) || stringValue(intake.careerCategory) || stringValue(intake.customCareerCategory) || "Not set"} | goals: ${goals || "Not set"}`,
        `  answers: ${answerSummary}`,
        `  key skills: ${trimText(stringValue(intake.keySkills), 200) || "Not provided"}`,
        `  daily work: ${trimText(stringValue(intake.dailyWorkSummary), 240) || "Not provided"}`,
        `  last chat: ${record.chat.lastUserMessage || "No chat yet"}`,
        "",
      ]
        .filter((entry): entry is string => Boolean(entry))
        .join("\n");
    }),
  ];

  for (const recipient of recipients) {
    const delivered = await sendResendEmail({
      to: recipient,
      subject,
      html,
      text: textLines.join("\n"),
    });
    if (!delivered.ok) {
      console.error(`[worker] daily signup digest failed recipient=${recipient} code=${delivered.errorCode}`);
      return;
    }
  }

  await supabase.from("agent_memory").upsert(
    {
      learner_profile_id: stateProfileId,
      memory_key: "daily_signup_digest",
      memory_value: {
        last_report_date_key: reportDateKey,
        last_sent_at: nowIso(),
        signup_count: records.length,
        recipient_count: recipients.length,
        window_hours: windowHours,
      },
      refreshed_at: nowIso(),
    },
    { onConflict: "learner_profile_id,memory_key" },
  );

  console.log(`[worker] daily signup digest sent count=${records.length} recipients=${recipients.length}`);
}

async function latestOnboardingForUser(userId: string) {
  const supabase = supabaseAdmin();
  const { data } = await supabase
    .from("onboarding_sessions")
    .select("id,created_at,updated_at")
    .eq("learner_profile_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}

async function latestAssessmentForUser(userId: string): Promise<LifecycleEmailAssessment | null> {
  const supabase = supabaseAdmin();
  const { data } = await supabase
    .from("assessment_attempts")
    .select("score,answers,recommended_career_path_ids,started_at,submitted_at")
    .eq("learner_profile_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const rawAnswers = Array.isArray(data.answers) ? data.answers : [];
  const answers = rawAnswers
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const questionId = typeof entry.questionId === "string" ? entry.questionId : null;
      const value = Number((entry as { value?: number }).value ?? 0);
      if (!questionId) return null;
      return { questionId, value };
    })
    .filter((entry): entry is { questionId: string; value: number } => Boolean(entry));

  return {
    score: Number(data.score ?? 0),
    answers,
    recommendedCareerPathIds: Array.isArray(data.recommended_career_path_ids)
      ? data.recommended_career_path_ids.filter((entry): entry is string => typeof entry === "string")
      : [],
    startedAt: data.started_at ?? null,
    submittedAt: data.submitted_at ?? null,
  };
}

async function latestProjectForUser(userId: string, handle: string) {
  const supabase = supabaseAdmin();
  const { data } = await supabase
    .from("projects")
    .select("id,slug,title,state,updated_at")
    .eq("learner_profile_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    title: data.title,
    state: data.state,
    url: `${appBaseUrl()}/u/${handle}/projects/${data.slug}`,
  };
}

async function recentSocialDraftsForUser(userId: string): Promise<LifecycleEmailSocialDraft[]> {
  const supabase = supabaseAdmin();
  const { data } = await supabase
    .from("social_drafts")
    .select("platform,text")
    .eq("learner_profile_id", userId)
    .order("updated_at", { ascending: false })
    .limit(10);

  const drafts: LifecycleEmailSocialDraft[] = [];
  const seen = new Set<string>();
  for (const row of data ?? []) {
    if ((row.platform !== "linkedin" && row.platform !== "x") || seen.has(row.platform)) continue;
    drafts.push({
      platform: row.platform,
      text: String(row.text ?? ""),
    });
    seen.add(row.platform);
    if (drafts.length >= 2) break;
  }

  return drafts;
}

async function relevantNewsForUser(userId: string, careerPathId: string | null): Promise<LifecycleEmailNewsItem[]> {
  const supabase = supabaseAdmin();
  const { data: personalized } = await supabase
    .from("news_insights")
    .select("title,url,summary,career_path_ids,metadata")
    .eq("learner_profile_id", userId)
    .order("published_at", { ascending: false })
    .limit(3);

  const personalizedItems = (personalized ?? []).map((row) => ({
    title: String(row.title ?? ""),
    url: String(row.url ?? ""),
    summary: String(row.summary ?? ""),
    source: typeof row.metadata?.source === "string" ? row.metadata.source : null,
    whyRelevant: typeof row.metadata?.why_relevant === "string" ? row.metadata.why_relevant : null,
    recommendedAction: typeof row.metadata?.recommended_action === "string" ? row.metadata.recommended_action : null,
  }));

  if (personalizedItems.length >= 3) {
    return personalizedItems.slice(0, 3);
  }

  const { data: globalRows } = await supabase
    .from("news_insights")
    .select("title,url,summary,career_path_ids,metadata")
    .is("learner_profile_id", null)
    .order("published_at", { ascending: false })
    .limit(8);

  const remaining = 3 - personalizedItems.length;
  const globalItems = (globalRows ?? [])
    .filter((row) => {
      const ids = Array.isArray(row.career_path_ids) ? row.career_path_ids.filter((entry): entry is string => typeof entry === "string") : [];
      return !careerPathId || !ids.length || ids.includes(careerPathId);
    })
    .map((row) => ({
      title: String(row.title ?? ""),
      url: String(row.url ?? ""),
      summary: String(row.summary ?? ""),
      source: typeof row.metadata?.source === "string" ? row.metadata.source : null,
      whyRelevant: typeof row.metadata?.why_relevant === "string" ? row.metadata.why_relevant : null,
      recommendedAction: typeof row.metadata?.recommended_action === "string" ? row.metadata.recommended_action : null,
    }))
    .slice(0, remaining);

  return [...personalizedItems, ...globalItems];
}

async function lifecycleDeliveriesForUser(userId: string) {
  const supabase = supabaseAdmin();
  const { data } = await supabase
    .from("learner_email_deliveries")
    .select("id,campaign_key,status,recipient_email,subject,provider,provider_message_id,payload,sent_at")
    .eq("learner_profile_id", userId);

  return (data ?? []) as LifecycleDeliveryRow[];
}

async function upsertLifecycleDelivery(input: {
  deliveryId: string;
  userId: string;
  externalUserId?: string | null;
  campaignKey: LifecycleEmailKey;
  status: "sent" | "failed";
  recipientEmail: string;
  subject: string;
  provider: string;
  providerMessageId?: string | null;
  emailSource: string;
  emailMedium: string;
  emailCampaign: string;
  cohortSource: string;
  cohortMedium: string;
  cohortCampaign: string;
  cohortPaidSource: string;
  payload?: Record<string, unknown>;
  sentAt?: string | null;
}) {
  const supabase = supabaseAdmin();
  const row = {
    id: input.deliveryId,
    learner_profile_id: input.userId,
    external_user_id: input.externalUserId ?? null,
    campaign_key: input.campaignKey,
    status: input.status,
    recipient_email: input.recipientEmail,
    subject: input.subject,
    provider: input.provider,
    provider_message_id: input.providerMessageId ?? null,
    email_source: input.emailSource,
    email_medium: input.emailMedium,
    email_campaign: input.emailCampaign,
    cohort_source: input.cohortSource,
    cohort_medium: input.cohortMedium,
    cohort_campaign: input.cohortCampaign,
    cohort_paid_source: input.cohortPaidSource,
    payload: input.payload ?? {},
    sent_at: input.sentAt ?? null,
    updated_at: nowIso(),
  };

  const { error } = await supabase.from("learner_email_deliveries").upsert(row, { onConflict: "id" });
  if (error) throw error;
}

async function moduleCtaForUser(userId: string, careerPathId: string | null) {
  const fallbackTitle = await firstModuleForUser(userId);
  const modules = CAREER_PATHS.find((entry) => entry.id === careerPathId)?.modules ?? [fallbackTitle];
  const supabase = supabaseAdmin();
  const { data } = await supabase
    .from("user_skill_evidence")
    .select("skill_name,status")
    .eq("learner_profile_id", userId)
    .in("skill_name", modules);

  const skillStatusByName = new Map<string, string>();
  for (const row of data ?? []) {
    skillStatusByName.set(String(row.skill_name), String(row.status));
  }

  const inProgress = modules.find((module) => skillStatusByName.get(module) === "in_progress") ?? null;
  const nextModule =
    modules.find((module) => {
      const status = skillStatusByName.get(module);
      return status !== "built" && status !== "verified";
    }) ?? null;
  const title = inProgress ?? nextModule ?? modules[0] ?? fallbackTitle;
  const status = skillStatusByName.get(title);

  return {
    title,
    href: `${appBaseUrl()}/dashboard/?module=${encodeURIComponent(title)}`,
    buttonLabel: status === "in_progress" ? `Continue ${title}` : `Start ${title}`,
    helperText:
      status === "in_progress"
        ? "Keep building from the module you already started."
        : "This is the clearest next module in your current path.",
  };
}

async function maybeSendLifecycleEmailForProfile(profile: LifecycleProfileRow) {
  const recipientEmail = profile.contact_email?.trim();
  if (!recipientEmail) return false;

  const [deliveries, onboarding, assessment, project, socialDrafts, newsItems, moduleCta] = await Promise.all([
    lifecycleDeliveriesForUser(profile.id),
    latestOnboardingForUser(profile.id),
    latestAssessmentForUser(profile.id),
    latestProjectForUser(profile.id, profile.handle),
    recentSocialDraftsForUser(profile.id),
    relevantNewsForUser(profile.id, profile.career_path_id),
    moduleCtaForUser(profile.id, profile.career_path_id),
  ]);

  const sentKeys = deliveries
    .filter((delivery) => delivery.status === "sent")
    .map((delivery) => delivery.campaign_key)
    .filter((key): key is LifecycleEmailKey =>
      ([
        "welcome",
        "day_1_next_steps",
        "day_2_follow_up",
        "day_3_follow_up",
        "week_1_digest",
      ] as const).includes(key as LifecycleEmailKey),
    );

  const nextKey = resolveLifecycleEmailKey({
    anchorIso: onboarding?.created_at ?? profile.created_at,
    sentKeys,
  });
  if (!nextKey) return false;
  if (nextKey !== "welcome" && !onboarding) return false;

  const baseUrl = appBaseUrl();
  const existingDelivery = deliveries.find((delivery) => delivery.campaign_key === nextKey) ?? null;
  const deliveryId = existingDelivery?.id ?? randomUUID();
  const provider = "resend";
  const emailSource = LIFECYCLE_EMAIL_UTM_SOURCE;
  const emailMedium = LIFECYCLE_EMAIL_UTM_MEDIUM;
  const emailCampaign = nextKey;
  const { cohortSource, cohortMedium, cohortCampaign, cohortPaidSource } = lifecycleCohortAttribution(profile);
  const trackedLink = (url: string, cta: string) =>
    appendLifecycleEmailTracking({
      url,
      campaignKey: nextKey,
      deliveryId,
      cta,
    });
  const dashboardUrl = `${baseUrl}/dashboard/?welcome=1`;
  const dashboardTrackingUrl = trackedLink(dashboardUrl, "dashboard");
  const publicProfileUrl = `${baseUrl}/u/${profile.handle}`;
  const publicProfileTrackingUrl = trackedLink(publicProfileUrl, "public_profile");
  const careerPathName = CAREER_PATHS.find((entry) => entry.id === profile.career_path_id)?.name ?? null;
  const trackedModuleCta = {
    ...moduleCta,
    href: trackedLink(moduleCta.href, "module_cta"),
  };
  const trackedNewsItems = newsItems.map((item, index) => ({
    ...item,
    url: trackedLink(item.url, `news_${index + 1}`),
  }));
  const template = buildLifecycleEmail({
    key: nextKey,
    baseUrl,
    learnerName: profile.full_name,
    learnerHandle: profile.handle,
    careerPathName,
    goals: Array.isArray(profile.goals) ? profile.goals.filter((entry): entry is string => typeof entry === "string") : [],
    dashboardUrl,
    dashboardTrackingUrl,
    publicProfileUrl,
    publicProfileTrackingUrl,
    assessment,
    moduleCta: trackedModuleCta,
    project,
    socialDrafts,
    newsItems: trackedNewsItems,
  });

  const delivered = await sendResendEmail({
    to: recipientEmail,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });

  if (!delivered.ok) {
    await upsertLifecycleDelivery({
      deliveryId,
      userId: profile.id,
      externalUserId: profile.external_user_id,
      campaignKey: nextKey,
      status: "failed",
      recipientEmail,
      subject: template.subject,
      provider,
      providerMessageId: existingDelivery?.provider_message_id ?? null,
      emailSource,
      emailMedium,
      emailCampaign,
      cohortSource,
      cohortMedium,
      cohortCampaign,
      cohortPaidSource,
      payload: {
        deliveryId,
        errorCode: delivered.errorCode,
        detail: "detail" in delivered ? delivered.detail ?? null : null,
      },
      sentAt: null,
    });
    console.error(`[worker] lifecycle email failed key=${nextKey} user=${profile.id} code=${delivered.errorCode}`);
    return false;
  }

  const sentAt = nowIso();
  await upsertLifecycleDelivery({
    deliveryId,
    userId: profile.id,
    externalUserId: profile.external_user_id,
    campaignKey: nextKey,
    status: "sent",
    recipientEmail,
    subject: template.subject,
    provider,
    providerMessageId: delivered.messageId ?? existingDelivery?.provider_message_id ?? null,
    emailSource,
    emailMedium,
    emailCampaign,
    cohortSource,
    cohortMedium,
    cohortCampaign,
    cohortPaidSource,
    payload: {
      previewText: template.previewText,
      deliveryId,
      providerMessageId: delivered.messageId ?? null,
    },
    sentAt,
  });

  const sentInserted = await insertLifecycleEmailEvent({
    deliveryId,
    userId: profile.id,
    externalUserId: profile.external_user_id,
    recipientEmail,
    campaignKey: nextKey,
    provider,
    providerMessageId: delivered.messageId ?? existingDelivery?.provider_message_id ?? null,
    providerEventId: `${provider}:sent:${deliveryId}`,
    eventType: "sent",
    eventAt: sentAt,
    emailSource,
    emailMedium,
    emailCampaign,
    cohortSource,
    cohortMedium,
    cohortCampaign,
    cohortPaidSource,
    payload: {
      subject: template.subject,
      previewText: template.previewText,
    },
  });

  if (sentInserted) {
    await captureLifecycleEmailEventToPosthog({
      distinctId: lifecycleDistinctId(profile, recipientEmail),
      recipientEmail,
      userId: profile.id,
      campaignKey: nextKey,
      deliveryId,
      eventType: "sent",
      eventAt: sentAt,
      provider,
      providerMessageId: delivered.messageId ?? existingDelivery?.provider_message_id ?? null,
      emailSource,
      emailMedium,
      emailCampaign,
      cohortSource,
      cohortMedium,
      cohortCampaign,
      cohortPaidSource,
      payload: {
        subject: template.subject,
        previewText: template.previewText,
      },
    });
  }

  if (nextKey === "welcome" && !profile.welcome_email_sent_at) {
    await supabaseAdmin()
      .from("learner_profiles")
      .update({
        welcome_email_sent_at: nowIso(),
        updated_at: nowIso(),
      })
      .eq("id", profile.id)
      .is("welcome_email_sent_at", null);
  }

  console.log(`[worker] lifecycle email sent key=${nextKey} user=${profile.id}`);
  return true;
}

async function sendDueLifecycleEmails() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.log("[worker] lifecycle email skipped: RESEND_API_KEY missing");
    return;
  }

  const supabase = supabaseAdmin();
  const { data: profiles } = await supabase
    .from("learner_profiles")
    .select("id,external_user_id,handle,full_name,contact_email,career_path_id,goals,acquisition,created_at,updated_at,welcome_email_sent_at")
    .not("contact_email", "is", null)
    .order("updated_at", { ascending: false })
    .limit(120);

  let sentCount = 0;
  for (const profile of (profiles ?? []) as LifecycleProfileRow[]) {
    const sent = await maybeSendLifecycleEmailForProfile(profile);
    if (sent) sentCount += 1;
  }

  console.log(`[worker] lifecycle emails sent: ${sentCount}`);
}

async function processArtifactJob(job: ClaimedJob) {
  if (!job.project_id || !job.learner_profile_id) return;
  const supabase = supabaseAdmin();

  const { data: project } = await supabase
    .from("projects")
    .select("id,slug,title")
    .eq("id", job.project_id)
    .maybeSingle();

  if (!project) return;

  const payloadKind = String(job.payload?.kind ?? "");
  const kind =
    payloadKind === "website" ||
    payloadKind === "pptx" ||
    payloadKind === "pdf" ||
    payloadKind === "resume_docx" ||
    payloadKind === "resume_pdf"
      ? (payloadKind as ArtifactKind)
      : job.type === "project.generate_website"
        ? "website"
        : "pdf";

  const artifactUrl = `/generated/${project.slug}/${kind}-${Date.now()}.${artifactExtension(kind)}`;

  await supabase.from("project_artifacts").insert({
    id: randomUUID(),
    project_id: project.id,
    kind,
    url: artifactUrl,
  });

  await supabase
    .from("projects")
    .update({ state: "built", updated_at: nowIso() })
    .eq("id", project.id);

  await appendBuildLog({
    projectId: project.id,
    userId: job.learner_profile_id,
    level: "success",
    message: `Artifact generated: ${kind}`,
  });

  const skill = await firstModuleForUser(job.learner_profile_id);
  await upsertBuiltSkill(job.learner_profile_id, skill, 0.55);
  await incrementTokens(job.learner_profile_id, 950);
}

async function processMemoryRefreshJob(job: ClaimedJob) {
  if (!job.learner_profile_id) return;

  const supabase = supabaseAdmin();
  const userId = job.learner_profile_id;
  const now = nowIso();

  const { data: profile } = await supabase
    .from("learner_profiles")
    .select("id,handle,full_name,headline,career_path_id,goals,tools,updated_at")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    throw new Error("MEMORY_REFRESH_PROFILE_NOT_FOUND");
  }

  const { data: skills } = await supabase
    .from("user_skill_evidence")
    .select("skill_name,status,score,evidence_count,updated_at")
    .eq("learner_profile_id", userId)
    .order("updated_at", { ascending: false })
    .limit(8);

  const { data: projects } = await supabase
    .from("projects")
    .select("id,slug,title,state,updated_at")
    .eq("learner_profile_id", userId)
    .order("updated_at", { ascending: false })
    .limit(5);

  const { data: events } = await supabase
    .from("agent_job_events")
    .select("event_type,message,created_at")
    .eq("learner_profile_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: personalizedNews } = await supabase
    .from("news_insights")
    .select("id,title,url,published_at")
    .eq("learner_profile_id", userId)
    .order("published_at", { ascending: false })
    .limit(3);

  const personalized = personalizedNews ?? [];
  let news = personalized;
  if (personalized.length < 3) {
    const { data: globalNews } = await supabase
      .from("news_insights")
      .select("id,title,url,published_at")
      .is("learner_profile_id", null)
      .order("published_at", { ascending: false })
      .limit(3 - personalized.length);
    news = [...personalized, ...(globalNews ?? [])];
  }

  const memoryValue = {
    refreshedAt: now,
    profile: {
      id: profile.id,
      handle: profile.handle,
      name: profile.full_name,
      headline: profile.headline,
      careerPathId: profile.career_path_id,
      goals: profile.goals ?? [],
      tools: profile.tools ?? [],
      profileUpdatedAt: profile.updated_at,
    },
    topSkills: (skills ?? []).map((skill) => ({
      skill: skill.skill_name,
      status: skill.status,
      score: Number(skill.score ?? 0),
      evidenceCount: Number(skill.evidence_count ?? 0),
      updatedAt: skill.updated_at ?? null,
    })),
    recentProjects: (projects ?? []).map((project) => ({
      id: project.id,
      slug: project.slug,
      title: project.title,
      state: project.state,
      updatedAt: project.updated_at,
    })),
    recentEvents: (events ?? []).map((event) => ({
      type: event.event_type,
      message: event.message,
      createdAt: event.created_at,
    })),
    recentNews: (news ?? []).map((entry) => ({
      id: entry.id,
      title: entry.title,
      url: entry.url,
      publishedAt: entry.published_at,
    })),
  };

  await supabase.from("agent_memory").upsert(
    {
      learner_profile_id: userId,
      memory_key: "refresh_slot",
      memory_value: memoryValue,
      refreshed_at: now,
    },
    { onConflict: "learner_profile_id,memory_key" },
  );
}

async function scheduleRetryOrFail(job: ClaimedJob, failureCode: string) {
  const supabase = supabaseAdmin();
  const attempts = Number(job.attempts ?? 1);
  const maxAttempts = Number(job.max_attempts ?? 3);

  if (attempts < maxAttempts) {
    const backoffMs = Math.min(5 * 60_000, 15_000 * 2 ** Math.max(0, attempts - 1));
    const leaseUntil = new Date(Date.now() + backoffMs).toISOString();

    await supabase
      .from("agent_jobs")
      .update({
        status: "queued",
        lease_until: leaseUntil,
        last_error_code: failureCode,
        updated_at: nowIso(),
      })
      .eq("id", job.id);

    await insertJobEvent({
      jobId: job.id,
      userId: job.learner_profile_id,
      projectId: job.project_id,
      type: "job.retry_scheduled",
      message: `${job.type} retry scheduled in ${Math.round(backoffMs / 1000)}s`,
      payload: { failureCode, backoffMs },
    });
    return;
  }

  await setJobStatus(job, "failed", { lease_until: null, last_error_code: failureCode });
  await insertJobEvent({
    jobId: job.id,
    userId: job.learner_profile_id,
    projectId: job.project_id,
    type: "job.failed",
    message: `${job.type} failed (${failureCode})`,
    payload: { failureCode },
  });
}

async function processClaimedJob(job: ClaimedJob) {
  const forceFailCode = typeof job.payload?.forceFailCode === "string" ? job.payload.forceFailCode : null;

  await setJobStatus(job, "running", { lease_until: new Date(Date.now() + 60_000).toISOString(), last_error_code: null });
  await insertJobEvent({
    jobId: job.id,
    userId: job.learner_profile_id,
    projectId: job.project_id,
    type: "job.running",
    message: `${job.type} is running`,
  });

  if (forceFailCode) {
    if (job.project_id && job.learner_profile_id) {
      await appendBuildLog({
        projectId: job.project_id,
        userId: job.learner_profile_id,
        level: "error",
        message: `Job ${job.type} failed with ${forceFailCode}`,
        metadata: { errorCode: forceFailCode },
      });
    }

    await scheduleRetryOrFail(job, forceFailCode);
    return;
  }

  if (job.type === "project.chat" && job.project_id && job.learner_profile_id) {
    const userMessage = typeof job.payload?.message === "string" ? job.payload.message : "(no message)";
    await appendBuildLog({
      projectId: job.project_id,
      userId: job.learner_profile_id,
      level: "success",
      message: `AI Tutor reply generated for: ${userMessage.slice(0, 80)}`,
    });
  }

  if (job.type === "project.generate_website" || job.type === "project.generate_artifact") {
    await processArtifactJob(job);
  }

  if (job.type === "memory.refresh") {
    await processMemoryRefreshJob(job);
  }

  await setJobStatus(job, "completed", { lease_until: null, last_error_code: null });
  await insertJobEvent({
    jobId: job.id,
    userId: job.learner_profile_id,
    projectId: job.project_id,
    type: "job.completed",
    message: `${job.type} completed`,
  });
}

async function claimJobs() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.rpc("claim_agent_jobs", {
    p_worker_id: workerId,
    p_limit: claimLimit,
  });

  if (error) {
    throw new Error(`CLAIM_FAILED:${error.message}`);
  }

  return (data ?? []) as ClaimedJob[];
}

async function processClaimedJobs() {
  const jobs = await claimJobs();
  if (!jobs.length) return;

  for (const job of jobs) {
    try {
      await processClaimedJob(job);
      console.log(`[worker] job completed: ${job.id} type=${job.type}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[worker] job error: ${job.id} ${message}`);
      await scheduleRetryOrFail(job, "WORKER_RUNTIME_ERROR");
    }
  }
}

async function refreshRelevantNews() {
  const supabase = supabaseAdmin();
  const publishedAt = nowIso();
  const rows = [
    {
      id: randomUUID(),
      title: "Model capability leap: teams are hardening eval gates before release",
      url: "https://openai.com/news/",
      summary: "Production teams are emphasizing evaluation coverage and regression checks for reliable AI shipping.",
      career_path_ids: ["software-engineering", "quality-assurance"],
      published_at: publishedAt,
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
      published_at: publishedAt,
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
      published_at: publishedAt,
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
  console.log(`[worker] news refreshed: ${rows.length}`);
}

async function resolveDefaultProfileId() {
  const supabase = supabaseAdmin();

  const byId = await supabase
    .from("learner_profiles")
    .select("id")
    .eq("id", defaultUserRef)
    .maybeSingle();
  if (byId.data?.id) return byId.data.id;

  const byExternal = await supabase
    .from("learner_profiles")
    .select("id")
    .eq("external_user_id", defaultUserRef)
    .maybeSingle();
  if (byExternal.data?.id) return byExternal.data.id;

  return null;
}

async function createDailyUpdateForDefaultUser() {
  const supabase = supabaseAdmin();
  const profileId = await resolveDefaultProfileId();
  if (!profileId) {
    console.log("[worker] daily update skipped: default profile not found");
    return;
  }

  const { count } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("learner_profile_id", profileId);

  if (!count) {
    console.log("[worker] daily update skipped: no projects");
    return;
  }

  const { data: personalizedNews } = await supabase
    .from("news_insights")
    .select("id")
    .eq("learner_profile_id", profileId)
    .order("published_at", { ascending: false })
    .limit(3);

  const personalizedIds = (personalizedNews ?? []).map((entry) => entry.id);
  let newsIds = personalizedIds;
  if (newsIds.length < 3) {
    const { data: globalNews } = await supabase
      .from("news_insights")
      .select("id")
      .is("learner_profile_id", null)
      .order("published_at", { ascending: false })
      .limit(3 - newsIds.length);
    newsIds = [...newsIds, ...(globalNews ?? []).map((entry) => entry.id)];
  }

  await supabase.from("daily_update_emails").insert({
    id: randomUUID(),
    learner_profile_id: profileId,
    status: "sent",
    summary: `You have ${count} active projects. Keep shipping system-verified artifacts.`,
    upcoming_tasks: [
      "Complete one module checkpoint",
      "Generate one new artifact",
      "Publish one social post draft",
    ],
    news_ids: newsIds,
    failure_code: null,
  });

  console.log("[worker] daily update sent");
}

async function queueMemoryRefreshJobs() {
  const supabase = supabaseAdmin();
  const { data: profiles } = await supabase
    .from("learner_profiles")
    .select("id")
    .order("updated_at", { ascending: false })
    .limit(60);

  if (!profiles?.length) {
    console.log("[worker] memory refresh skipped: no profiles");
    return;
  }

  let queuedCount = 0;
  for (const profile of profiles) {
    const { data: existing } = await supabase
      .from("agent_jobs")
      .select("id")
      .eq("learner_profile_id", profile.id)
      .eq("type", "memory.refresh")
      .in("status", ["queued", "claimed", "running"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.id) continue;

    const jobId = randomUUID();
    await supabase.from("agent_jobs").insert({
      id: jobId,
      learner_profile_id: profile.id,
      project_id: null,
      type: "memory.refresh",
      payload: {
        reason: "scheduler_refresh_slot",
      },
      status: "queued",
      attempts: 0,
      max_attempts: 3,
    });

    await insertJobEvent({
      jobId,
      userId: profile.id,
      projectId: null,
      type: "job.queued",
      message: "memory.refresh queued",
      payload: {
        reason: "scheduler_refresh_slot",
      },
    });

    queuedCount += 1;
  }

  console.log(`[worker] memory refresh jobs queued: ${queuedCount}`);
}

async function runSchedulers() {
  await refreshRelevantNews();
  await queueMemoryRefreshJobs();
  await createDailyUpdateForDefaultUser();
  await sendDueLifecycleEmails();
  await sendDailySignupDigest();
}

function logError(scope: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[worker] ${scope} failed: ${message}`);
}

async function start() {
  if (started) return;
  started = true;

  try {
    supabaseAdmin();
  } catch (error) {
    logError("startup", error);
    return;
  }

  console.log(`[worker] starting id=${workerId} pollMs=${pollMs} schedulerMs=${schedulerMs}`);

  let processing = false;
  let scheduling = false;

  setInterval(async () => {
    if (processing) return;
    processing = true;
    try {
      await processClaimedJobs();
    } catch (error) {
      logError("process-jobs", error);
    } finally {
      processing = false;
    }
  }, pollMs);

  try {
    await runSchedulers();
  } catch (error) {
    logError("scheduler-initial", error);
  }

  setInterval(async () => {
    if (scheduling) return;
    scheduling = true;
    try {
      await runSchedulers();
    } catch (error) {
      logError("scheduler", error);
    } finally {
      scheduling = false;
    }
  }, schedulerMs);
}

void start();
