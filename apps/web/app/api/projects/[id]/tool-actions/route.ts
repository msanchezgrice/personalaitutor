import { jsonError, jsonOk, runtimeFindProjectById, runtimeFindUserById, runtimeGenerateProjectToolAction } from "@/lib/runtime";
import { NextRequest } from "next/server";
import { z } from "zod";
import { getUserId } from "@/lib/api";
import { requireBillingAccess } from "@/lib/billing-access";

const schema = z.object({
  toolKey: z.string().min(1).max(80),
  moduleTitle: z.string().min(1).max(160),
  careerPathId: z.string().max(80).optional().nullable(),
  stepKey: z.string().max(120).optional().nullable(),
});

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return jsonError("INVALID_BODY", "Invalid tool action payload", 400, { issues: parsed.error.issues });
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

    const result = await runtimeGenerateProjectToolAction({
      projectId: project.id,
      userId,
      toolKey: parsed.data.toolKey,
      moduleTitle: parsed.data.moduleTitle,
      careerPathId: parsed.data.careerPathId,
      stepKey: parsed.data.stepKey,
    });

    if (!result.ok || !result.output) {
      return jsonError("TOOL_ACTION_FAILED", "Unable to generate tool output", 409, {
        failureCode: result.errorCode,
      });
    }

    return jsonOk({
      output: result.output,
    });
  } catch (error) {
    return jsonError("TOOL_ACTION_FAILED", "Unable to generate tool output", 500, {
      reason: error instanceof Error ? error.message : "UNKNOWN",
    });
  }
}
