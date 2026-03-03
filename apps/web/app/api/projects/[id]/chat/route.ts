import { jsonError, jsonOk, runtimeAddProjectChatMessage } from "@/lib/runtime";
import { z } from "zod";
import { NextRequest } from "next/server";
import { forcedFailCode, getUserId } from "@/lib/api";

const schema = z.object({
  message: z.string().min(1).max(4000),
  userId: z.string().min(1).optional(),
});

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return jsonError("INVALID_BODY", "Invalid chat payload", 400, { issues: parsed.error.issues });
  }

  const { id } = await context.params;
  const userId = getUserId(req);
  const result = await runtimeAddProjectChatMessage({
    projectId: id,
    userId,
    message: parsed.data.message,
    forceFailCode: forcedFailCode(req),
  });

  if (!result) {
    return jsonError("PROJECT_NOT_FOUND", "Project was not found", 404);
  }

  if (!result.result?.ok) {
    return jsonError("CHAT_JOB_FAILED", "AI Tutor chat action failed", 409, {
      jobId: result.job.id,
      failureCode: result.result?.job.lastErrorCode,
      recoveryAction: "Retry chat after resolving provider or worker issue",
    });
  }

  return jsonOk({ job: result.job, reply: result.reply });
}
