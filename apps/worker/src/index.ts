import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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

const workerId = process.env.WORKER_ID ?? `worker_${Math.random().toString(36).slice(2, 8)}`;
const claimLimit = Number(process.env.CLAIM_LIMIT ?? "5");
const pollMs = Number(process.env.WORKER_POLL_MS ?? "2500");
const schedulerMs = Number(process.env.SCHEDULER_POLL_MS ?? "60000");
const defaultUserRef = process.env.DEFAULT_USER_ID ?? "user_test_0001";

let client: SupabaseClient | null = null;
let started = false;

function nowIso() {
  return new Date().toISOString();
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
      title: "AI tooling update: model context windows and eval tooling",
      url: "https://example.com/ai-news/context-evals",
      summary: "New eval practices improve reliability for production copilots.",
      career_path_ids: ["software-engineering", "quality-assurance"],
      published_at: publishedAt,
    },
    {
      id: randomUUID(),
      title: "Agentic workflows in go-to-market automation",
      url: "https://example.com/ai-news/gtm-agents",
      summary: "Marketing and RevOps teams are shipping multi-agent outbound systems.",
      career_path_ids: ["marketing-seo", "sales-revops"],
      published_at: publishedAt,
    },
    {
      id: randomUUID(),
      title: "Retrieval best practices for support copilots",
      url: "https://example.com/ai-news/support-rag",
      summary: "RAG quality gates and routing now standard for support agents.",
      career_path_ids: ["customer-support", "operations"],
      published_at: publishedAt,
    },
  ];

  await supabase.from("news_insights").delete().neq("id", "00000000-0000-0000-0000-000000000000");
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

  const { data: news } = await supabase
    .from("news_insights")
    .select("id")
    .order("published_at", { ascending: false })
    .limit(3);

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
    news_ids: (news ?? []).map((entry) => entry.id),
    failure_code: null,
  });

  console.log("[worker] daily update sent");
}

async function runSchedulers() {
  await refreshRelevantNews();
  await createDailyUpdateForDefaultUser();
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
