import { NextRequest } from "next/server";
import { jsonError, jsonOk, runtimeFindProjectById, runtimeFindUserById } from "@/lib/runtime";
import { getUserId } from "@/lib/api";
import { requireBillingAccess } from "@/lib/billing-access";
import { resolveModuleGuideForProfile } from "@/lib/artifact-generation";
import { getTutorSessionForProject, startTutorSession } from "@/lib/tutor-session";

async function loadProjectContext(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const userId = getUserId(req);
  if (!userId) {
    return { error: jsonError("UNAUTHENTICATED", "Sign in required", 401) } as const;
  }
  const access = await requireBillingAccess({ userId });
  if (!access.ok) {
    return { error: access.response } as const;
  }
  const [profile, project] = await Promise.all([runtimeFindUserById(userId), runtimeFindProjectById(id)]);
  if (!profile) {
    return { error: jsonError("USER_NOT_FOUND", "Profile was not found", 404) } as const;
  }
  if (!project) {
    return { error: jsonError("PROJECT_NOT_FOUND", "Project was not found", 404) } as const;
  }
  if (project.userId !== profile.id) {
    return { error: jsonError("FORBIDDEN", "Project access denied", 403) } as const;
  }
  return { userId, profile, project } as const;
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const loaded = await loadProjectContext(req, context);
  if ("error" in loaded) return loaded.error;

  const session = await getTutorSessionForProject({
    projectId: loaded.project.id,
    learnerProfileId: loaded.profile.id,
    includeCompleted: true,
  });
  return jsonOk({ session });
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const loaded = await loadProjectContext(req, context);
  if ("error" in loaded) return loaded.error;

  try {
    const guide = resolveModuleGuideForProfile(loaded.profile);
    const session = await startTutorSession({
      projectId: loaded.project.id,
      learnerProfileId: loaded.profile.id,
      guide,
    });
    return jsonOk({ session });
  } catch (error) {
    return jsonError("TUTOR_SESSION_START_FAILED", "Unable to start tutor session", 500, {
      reason: error instanceof Error ? error.message : "UNKNOWN",
    });
  }
}
