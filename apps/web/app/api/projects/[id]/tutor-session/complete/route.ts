import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk, runtimeFindProjectById, runtimeFindUserById } from "@/lib/runtime";
import { getUserId } from "@/lib/api";
import { requireBillingAccess } from "@/lib/billing-access";
import {
  awardVerifiedSkillForProject,
  runtimeRequestArtifactGeneration,
  type GeneratableArtifactKind,
} from "@/lib/artifact-generation";
import { completeTutorSession, getTutorSessionForProject } from "@/lib/tutor-session";

const schema = z.object({
  // Optionally trigger real artifact generation (Phase 2.1) as the session's
  // concrete output. Omit to submit proof manually instead.
  artifactKind: z.enum(["website", "pptx", "pdf", "resume_docx", "resume_pdf"]).optional().nullable(),
});

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return jsonError("INVALID_BODY", "Invalid tutor session completion payload", 400, { issues: parsed.error.issues });
  }

  const { id } = await context.params;
  const userId = getUserId(req);
  if (!userId) {
    return jsonError("UNAUTHENTICATED", "Sign in required", 401);
  }
  const access = await requireBillingAccess({ userId });
  if (!access.ok) {
    return access.response;
  }
  const [profile, project] = await Promise.all([runtimeFindUserById(userId), runtimeFindProjectById(id)]);
  if (!profile || !project || project.userId !== profile.id) {
    return jsonError("PROJECT_NOT_FOUND", "Project was not found", 404);
  }

  const session = await getTutorSessionForProject({
    projectId: project.id,
    learnerProfileId: profile.id,
    includeCompleted: true,
  });
  if (!session) {
    return jsonError("TUTOR_SESSION_NOT_FOUND", "Start a tutor session first", 404);
  }

  // Verified is gated on FULL checklist completion — never short-circuited.
  const completion = await completeTutorSession({ sessionId: session.id, learnerProfileId: profile.id });
  if (!completion.ok) {
    return jsonError("TUTOR_SESSION_INCOMPLETE", "Finish every step and checklist item first", 409, {
      pendingSteps: completion.pendingSteps,
      pendingChecklist: completion.pendingChecklist,
    });
  }

  // Optionally produce the session's real artifact (hard-failure contract:
  // a failed generation reports loudly and never fabricates progress).
  let generation: { ok: boolean; jobId: string | null; failureCode: string | null } | null = null;
  if (parsed.data.artifactKind) {
    const result = await runtimeRequestArtifactGeneration({
      projectId: project.id,
      userId,
      kind: parsed.data.artifactKind as GeneratableArtifactKind,
    });
    generation = result
      ? {
          ok: Boolean(result.result?.ok),
          jobId: result.job?.id ?? null,
          failureCode: result.result?.ok ? null : result.job?.lastErrorCode ?? "ARTIFACT_GENERATION_FAILED",
        }
      : { ok: false, jobId: null, failureCode: "PROJECT_NOT_FOUND" };
  }

  // Verified requires checklist completion (proven above) AND real built
  // evidence (generated content or submitted proof).
  const verified = await awardVerifiedSkillForProject({ userId, projectId: project.id });

  return jsonOk({
    session: completion.session,
    generation,
    verified,
    nextAction: verified.awarded
      ? null
      : generation && !generation.ok
        ? "RETRY_GENERATION_OR_UPLOAD_PROOF"
        : "GENERATE_ARTIFACT_OR_UPLOAD_PROOF",
  });
}
