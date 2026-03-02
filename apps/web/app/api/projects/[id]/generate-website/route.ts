import { jsonError, jsonOk, runtimeRequestArtifactGeneration } from "@/lib/runtime";
import { NextRequest } from "next/server";
import { forcedFailCode, getUserId } from "@/lib/api";

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const userId = getUserId(req);

  const result = await runtimeRequestArtifactGeneration({
    projectId: id,
    userId,
    kind: "website",
    forceFailCode: forcedFailCode(req),
  });

  if (!result) {
    return jsonError("PROJECT_NOT_FOUND", "Project was not found", 404);
  }

  if (!result.result?.ok) {
    return jsonError("WEBSITE_GENERATION_FAILED", "Website generation failed", 409, {
      jobId: result.job.id,
      failureCode: result.result?.job.lastErrorCode,
      recoveryAction: "Retry website generation after dependency recovery",
    });
  }

  return jsonOk({ job: result.job, project: result.project });
}
