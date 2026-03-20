import { jsonError, jsonOk, runtimeFindProjectById, runtimeFindUserById, runtimeRequestArtifactGeneration } from "@/lib/runtime";
import { z } from "zod";
import { NextRequest } from "next/server";
import { forcedFailCode, getUserId } from "@/lib/api";
import { requireBillingAccess } from "@/lib/billing-access";

const schema = z.object({
  kind: z.enum(["pptx", "pdf", "resume_docx", "resume_pdf"]),
  stepKey: z.string().max(120).optional().nullable(),
});

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return jsonError("INVALID_BODY", "Invalid artifact request", 400, { issues: parsed.error.issues });
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
  const [profile, project] = await Promise.all([
    runtimeFindUserById(userId),
    runtimeFindProjectById(id),
  ]);
  if (!profile) {
    return jsonError("USER_NOT_FOUND", "Profile was not found", 404);
  }
  if (!project) {
    return jsonError("PROJECT_NOT_FOUND", "Project was not found", 404);
  }
  if (project.userId !== profile.id) {
    return jsonError("FORBIDDEN", "Project access denied", 403);
  }
  if (parsed.data.stepKey && !project.moduleSteps.some((step) => step.stepKey === parsed.data.stepKey)) {
    return jsonError("STEP_NOT_FOUND", "Module step was not found", 404);
  }

  const result = await runtimeRequestArtifactGeneration({
    projectId: id,
    userId,
    kind: parsed.data.kind,
    stepKey: parsed.data.stepKey,
    forceFailCode: forcedFailCode(req),
  });

  if (!result) {
    return jsonError("PROJECT_NOT_FOUND", "Project was not found", 404);
  }

  if (!result.result?.ok) {
    return jsonError("ARTIFACT_GENERATION_FAILED", "Artifact generation failed", 409, {
      jobId: result.job.id,
      failureCode: result.result?.job.lastErrorCode,
      recoveryAction: "Retry artifact generation after dependency recovery",
    });
  }

  return jsonOk({ job: result.job, project: result.project });
}
