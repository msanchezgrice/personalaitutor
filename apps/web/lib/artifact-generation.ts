import "server-only";

import { randomUUID } from "node:crypto";
import {
  CAREER_PATHS,
  artifactGenerationFailureCode,
  buildRecommendedModuleGuide,
  canMarkProjectBuilt,
  completeArtifactGeneration as memCompleteArtifactGeneration,
  failArtifactGeneration as memFailArtifactGeneration,
  findProjectById as memFindProjectById,
  findUserById as memFindUserById,
  generateArtifactContent,
  getCareerPath,
  getVerificationPolicy,
  markSkillVerified as memMarkSkillVerified,
  recordProjectArtifact as memRecordProjectArtifact,
  requestArtifactGeneration as memRequestArtifactGeneration,
  type ArtifactGenerationContext,
  type Project,
  type RecommendedModuleGuide,
  type UserProfile,
} from "@aitutor/shared";
import {
  appendBuildLog,
  createJob,
  getSupabaseAdmin,
  insertJobEvent,
  insertVerificationEvent,
  runtimeFindProjectById,
  runtimeFindUserById,
  runtimeGetBillingAccessState,
  touchProfileTokenUsage,
  upsertSkill,
} from "@/lib/runtime";
import { getLatestAssessmentReportForProfile } from "@/lib/anonymous-assessment";
import { persistArtifactContent } from "@/lib/artifact-content-store";
import { getCurrentPlanModuleTitleForProfile } from "@/lib/plan-progress";

/**
 * Real artifact generation pipeline (Phase 2.1), extracted from `runtime.ts`.
 *
 * Flow: request → job created → LLM content generation (personalized from the
 * learner's profile, assessment report, module playbook, and completed-module
 * evidence) → structured content persisted → artifact row inserted with a
 * `contentId` → project flips to `built` → skill awarded.
 *
 * HARD FAILURE contract: if generation fails for any reason, the job is
 * marked failed, NO artifact row is written, project/skill state does NOT
 * flip, and no placeholder is ever emitted.
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

export type GeneratableArtifactKind = "website" | "pptx" | "pdf" | "resume_docx" | "resume_pdf";

export function artifactExtensionFor(kind: GeneratableArtifactKind) {
  switch (kind) {
    case "website":
      return "html";
    case "pptx":
      return "pptx";
    case "resume_docx":
      return "docx";
    default:
      return "pdf";
  }
}

export function buildGeneratedArtifactUrl(projectSlug: string, kind: GeneratableArtifactKind) {
  return `/generated/${projectSlug}/${kind}-${Date.now()}.${artifactExtensionFor(kind)}`;
}

/** The module guide used for both artifact context and tutor sessions. */
export function resolveModuleGuideForProfile(profile: UserProfile, moduleTitle?: string | null): RecommendedModuleGuide {
  const careerPath = getCareerPath(profile.careerPathId);
  return buildRecommendedModuleGuide({
    careerPathId: profile.careerPathId,
    moduleTitle: moduleTitle?.trim() || careerPath?.modules[0] || "Starter AI Pack",
    jobTitle: profile.headline,
    primaryGoal: profile.goals?.[0] ?? null,
  });
}

/**
 * Spine phase 2: the ACTIVE module comes from the learner's 30-day plan —
 * `thirtyDayPlan[currentWeek].moduleTitle` — and falls back to the career
 * path's first module for users without a linked report / plan module.
 * The plan lookup never throws, so this is a strict superset of the old
 * static `modules[0]` behavior.
 */
export async function resolveActiveModuleGuideForProfile(profile: UserProfile): Promise<RecommendedModuleGuide> {
  const planModuleTitle = await getCurrentPlanModuleTitleForProfile(profile.id);
  return resolveModuleGuideForProfile(profile, planModuleTitle);
}

export async function buildArtifactGenerationContext(input: {
  profile: UserProfile;
  project: Project;
  guide?: RecommendedModuleGuide;
}): Promise<ArtifactGenerationContext> {
  const guide = input.guide ?? (await resolveActiveModuleGuideForProfile(input.profile));
  const careerPath = getCareerPath(input.profile.careerPathId);
  const report = await getLatestAssessmentReportForProfile(input.profile.id).catch(() => null);

  const completedSteps = input.project.moduleSteps
    .filter((step) => step.status === "completed")
    .map((step) => ({ title: step.title, completedAt: step.completedAt }));

  const proofArtifacts = input.project.artifacts
    .filter((artifact) => artifact.kind === "proof_link" || artifact.kind === "proof_upload")
    .slice(-5)
    .map((artifact) => ({
      kind: String(artifact.kind),
      url: artifact.url,
      note:
        typeof artifact.metadata?.note === "string"
          ? artifact.metadata.note
          : typeof artifact.metadata?.label === "string"
            ? artifact.metadata.label
            : null,
    }));

  const buildNotes = (input.project.buildLog ?? [])
    .filter((entry) => entry.message.startsWith("User message:") || entry.message.startsWith("Proof update"))
    .slice(-5)
    .map((entry) => entry.message.replace(/^User message:\s*/, "").slice(0, 300));

  return {
    learner: {
      name: input.profile.name,
      headline: input.profile.headline || null,
      careerPathId: input.profile.careerPathId || null,
      careerPathName: careerPath?.name ?? null,
      goals: (input.profile.goals ?? []).map((goal) => String(goal)),
      bio: input.profile.bio || null,
    },
    assessment: report
      ? {
          readinessScore: report.readinessScore,
          headline: report.report.headline,
          summary: report.report.summary,
          topGaps: report.report.gaps.slice(0, 4).map((gap) => ({
            title: gap.title,
            whyItMatters: gap.whyItMatters,
            marketImpact: gap.marketImpact,
          })),
        }
      : null,
    module: {
      moduleTitle: guide.moduleTitle,
      whyThisModule: guide.whyThisModule,
      expectedOutput: guide.expectedOutput,
      proofChecklist: guide.proofChecklist,
      steps: guide.steps,
    },
    project: {
      title: input.project.title,
      slug: input.project.slug,
      description: input.project.description,
    },
    evidence: {
      completedSteps,
      proofArtifacts,
      buildNotes,
    },
  };
}

function targetSkillFor(profile: UserProfile) {
  return CAREER_PATHS.find((path) => path.id === profile.careerPathId)?.modules[0] ?? "Applied AI";
}

/**
 * Phase 2.3 verified gate: awarded ONLY when the tutor-session proof
 * checklist is complete AND the project has real built evidence. Callers
 * (tutor-session complete route) enforce the checklist; this helper enforces
 * the evidence gate.
 */
export async function awardVerifiedSkillForProject(input: {
  userId: string;
  projectId: string;
}): Promise<{ awarded: boolean; skill: string | null; reason?: string }> {
  if (mode() === "memory") {
    const project = memFindProjectById(input.projectId);
    if (!project || !canMarkProjectBuilt(project.artifacts)) {
      return { awarded: false, skill: null, reason: "NEEDS_ARTIFACT_OR_PROOF" };
    }
    const skill = memMarkSkillVerified({ userId: input.userId, projectId: input.projectId });
    return skill
      ? { awarded: true, skill: skill.skill }
      : { awarded: false, skill: null, reason: "SKILL_NOT_FOUND" };
  }

  const project = await runtimeFindProjectById(input.projectId);
  const profile = await runtimeFindUserById(input.userId);
  if (!project || !profile || project.userId !== profile.id) {
    return { awarded: false, skill: null, reason: "PROJECT_NOT_FOUND" };
  }
  if (!canMarkProjectBuilt(project.artifacts)) {
    return { awarded: false, skill: null, reason: "NEEDS_ARTIFACT_OR_PROOF" };
  }

  const skill = targetSkillFor(profile);
  await upsertSkill({
    userId: profile.id,
    skill,
    status: "verified",
    score: Math.max(getVerificationPolicy().projectMinScore + 0.2, 0.6),
    evidenceDelta: 1,
  });
  await insertVerificationEvent({
    userId: profile.id,
    projectId: project.id,
    skill,
    eventType: "verification_passed",
    details: { source: "tutor_session_checklist" },
  });
  await appendBuildLog({
    projectId: project.id,
    userId: profile.id,
    level: "success",
    message: `Skill verified: ${skill}`,
    metadata: { source: "tutor_session_checklist" },
  });
  return { awarded: true, skill };
}

export async function runtimeRequestArtifactGeneration(input: {
  projectId: string;
  userId: string;
  kind: GeneratableArtifactKind;
  stepKey?: string | null;
  forceFailCode?: string;
}) {
  const billing = await runtimeGetBillingAccessState({ userId: input.userId });
  if (!billing.accessAllowed) return null;

  if (mode() === "memory") {
    return memoryRequestArtifactGeneration(input);
  }

  const project = await runtimeFindProjectById(input.projectId);
  const profile = await runtimeFindUserById(input.userId);
  if (!project || !profile || project.userId !== profile.id) return null;
  const step = input.stepKey ? project.moduleSteps.find((entry) => entry.stepKey === input.stepKey) ?? null : null;

  const supabase = getSupabaseAdmin();

  await supabase.from("projects").update({ state: "building", updated_at: new Date().toISOString() }).eq("id", project.id);

  // Snapshot the generation context into the job payload so the async worker
  // path works from explicit data, never "latest state" (explicit identity
  // across process boundaries).
  const context = await buildArtifactGenerationContext({ profile, project });

  const jobId = await createJob({
    userId: profile.id,
    projectId: project.id,
    type: input.kind === "website" ? "project.generate_website" : "project.generate_artifact",
    payload: { kind: input.kind, forceFailCode: input.forceFailCode ?? null, context },
    // The request path generates synchronously below; "running" keeps the
    // worker from double-claiming. Jobs enqueued as "queued" (e.g. crash
    // recovery) are processed by the worker with the same pipeline.
    status: "running",
  });

  if (input.forceFailCode) {
    return failSupabaseArtifactJob({
      supabase,
      jobId,
      profileId: profile.id,
      projectId: project.id,
      kind: input.kind,
      failureCode: input.forceFailCode,
    });
  }

  let generated;
  try {
    generated = await generateArtifactContent({ kind: input.kind, context });
  } catch (error) {
    return failSupabaseArtifactJob({
      supabase,
      jobId,
      profileId: profile.id,
      projectId: project.id,
      kind: input.kind,
      failureCode: artifactGenerationFailureCode(error),
    });
  }

  const artifactUrl = buildGeneratedArtifactUrl(project.slug, input.kind);
  const contentRecord = await persistArtifactContent({
    projectId: project.id,
    learnerProfileId: profile.id,
    artifactUrl,
    kind: input.kind,
    contentKind: generated.contentKind,
    content: generated.content,
    model: generated.model,
  });

  await supabase.from("project_artifacts").insert({
    id: randomUUID(),
    project_id: project.id,
    kind: input.kind,
    url: artifactUrl,
    metadata: {
      source: "generated_artifact",
      generator: input.kind === "website" ? "website" : "artifact",
      contentId: contentRecord.id,
      model: generated.model,
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
      contentId: contentRecord.id,
      model: generated.model,
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
    skill: targetSkillFor(profile),
    status: "built",
    score: Math.max(getVerificationPolicy().projectMinScore + 0.1, 0.5),
    evidenceDelta: 1,
  });

  await insertVerificationEvent({
    userId: profile.id,
    projectId: project.id,
    skill: targetSkillFor(profile),
    eventType: "artifact_generated",
    details: { kind: input.kind, artifactUrl, contentId: contentRecord.id },
  });

  await touchProfileTokenUsage(profile.id, 950);

  return {
    job: { id: jobId, status: "completed", lastErrorCode: null },
    result: { ok: true, job: { id: jobId, lastErrorCode: null } },
    project: await runtimeFindProjectById(project.id),
  };
}

async function failSupabaseArtifactJob(input: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  jobId: string;
  profileId: string;
  projectId: string;
  kind: string;
  failureCode: string;
}) {
  await input.supabase
    .from("agent_jobs")
    .update({ status: "failed", last_error_code: input.failureCode, updated_at: new Date().toISOString() })
    .eq("id", input.jobId);

  await insertJobEvent({
    jobId: input.jobId,
    userId: input.profileId,
    projectId: input.projectId,
    type: "job.failed",
    message: `${input.kind} generation failed (${input.failureCode})`,
    payload: { errorCode: input.failureCode },
  });

  await appendBuildLog({
    projectId: input.projectId,
    userId: input.profileId,
    level: "error",
    message: `Artifact generation failed for ${input.kind}: ${input.failureCode}`,
  });

  return {
    job: { id: input.jobId, status: "failed", lastErrorCode: input.failureCode },
    result: { ok: false, job: { id: input.jobId, lastErrorCode: input.failureCode } },
    project: await runtimeFindProjectById(input.projectId),
  };
}

async function memoryRequestArtifactGeneration(input: {
  projectId: string;
  userId: string;
  kind: GeneratableArtifactKind;
  stepKey?: string | null;
  forceFailCode?: string;
}) {
  const project = memFindProjectById(input.projectId);
  const profile = memFindUserById(input.userId);
  if (!project || !profile) return null;
  const step = input.stepKey ? project.moduleSteps.find((entry) => entry.stepKey === input.stepKey) ?? null : null;

  const pending = memRequestArtifactGeneration({
    projectId: input.projectId,
    userId: input.userId,
    kind: input.kind,
    stepKey: input.stepKey ?? null,
    forceFailCode: input.forceFailCode,
  });
  if (!pending) return null;
  if (input.forceFailCode) {
    return { ...pending, job: { ...pending.job, status: "failed" as const, lastErrorCode: input.forceFailCode } };
  }

  const context = await buildArtifactGenerationContext({ profile, project });

  let generated;
  try {
    generated = await generateArtifactContent({ kind: input.kind, context });
  } catch (error) {
    const failureCode = artifactGenerationFailureCode(error);
    const failed = memFailArtifactGeneration({
      jobId: pending.job.id,
      projectId: input.projectId,
      userId: input.userId,
      failureCode,
    });
    return failed;
  }

  const artifactUrl = buildGeneratedArtifactUrl(project.slug, input.kind);
  const contentRecord = await persistArtifactContent({
    projectId: project.id,
    learnerProfileId: profile.id,
    artifactUrl,
    kind: input.kind,
    contentKind: generated.contentKind,
    content: generated.content,
    model: generated.model,
  });

  return memCompleteArtifactGeneration({
    jobId: pending.job.id,
    projectId: input.projectId,
    userId: input.userId,
    kind: input.kind,
    url: artifactUrl,
    contentId: contentRecord.id,
    model: generated.model,
    stepKey: step?.stepKey ?? null,
    stepTitle: step?.title ?? null,
  });
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

  const artifactMetadata = input.metadata ?? {};
  await supabase.from("project_artifacts").insert({
    id: randomUUID(),
    project_id: project.id,
    kind: input.kind,
    url: input.url,
    metadata: artifactMetadata,
  });

  await appendBuildLog({
    projectId: project.id,
    userId: profile.id,
    level: "success",
    message: input.logMessage,
    metadata: input.metadata,
  });

  // Phase 2.3 gate: only real evidence (submitted proof or generated content)
  // moves the project to "built". This path records user-submitted proof, so
  // re-check against the full artifact set.
  const refreshed = await runtimeFindProjectById(project.id);
  if (refreshed && canMarkProjectBuilt(refreshed.artifacts)) {
    await supabase
      .from("projects")
      .update({ state: "built", updated_at: new Date().toISOString() })
      .eq("id", project.id);
  }

  await upsertSkill({
    userId: profile.id,
    skill: targetSkillFor(profile),
    status: "built",
    score: Math.max(getVerificationPolicy().projectMinScore + 0.1, 0.5),
    evidenceDelta: 1,
  });

  await insertVerificationEvent({
    userId: profile.id,
    projectId: project.id,
    skill: targetSkillFor(profile),
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
