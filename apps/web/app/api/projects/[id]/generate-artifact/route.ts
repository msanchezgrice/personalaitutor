import { jsonError, jsonOk, runtimeRequestArtifactGeneration } from "@/lib/runtime";
import { z } from "zod";
import { NextRequest } from "next/server";
import { forcedFailCode, getUserId } from "@/lib/api";

const schema = z.object({
  kind: z.enum(["pptx", "pdf", "resume_docx", "resume_pdf"]),
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
  const result = await runtimeRequestArtifactGeneration({
    projectId: id,
    userId,
    kind: parsed.data.kind,
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
