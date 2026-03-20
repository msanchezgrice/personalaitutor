import { jsonError, jsonOk, runtimeFindProjectById, runtimeFindUserById, runtimeUpdateProjectModuleStep } from "@/lib/runtime";
import { z } from "zod";
import { NextRequest } from "next/server";
import { getUserId } from "@/lib/api";
import { requireBillingAccess } from "@/lib/billing-access";

const schema = z.object({
  stepKey: z.string().min(1).max(160),
  status: z.enum(["not_started", "in_progress", "completed"]),
});

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return jsonError("INVALID_BODY", "Invalid module step payload", 400, { issues: parsed.error.issues });
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

  const updatedProject = await runtimeUpdateProjectModuleStep({
    projectId: project.id,
    userId,
    stepKey: parsed.data.stepKey,
    status: parsed.data.status,
  });

  if (!updatedProject) {
    return jsonError("MODULE_STEP_UPDATE_FAILED", "Unable to update module step", 409);
  }

  return jsonOk({
    project: updatedProject,
    moduleSteps: updatedProject.moduleSteps,
  });
}
