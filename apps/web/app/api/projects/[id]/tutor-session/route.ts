import { NextRequest } from "next/server";
import { jsonError, jsonOk, runtimeFindProjectById, runtimeFindUserById } from "@/lib/runtime";
import { getUserId } from "@/lib/api";
import { requireBillingAccess } from "@/lib/billing-access";
import { resolveModuleGuideForProfile } from "@/lib/artifact-generation";
import {
  getTutorSessionForProject,
  restartTutorSession,
  startTutorSession,
  tutorSessionPlaybookDrifted,
} from "@/lib/tutor-session";

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
  // UX audit F5: surface playbook drift so the workbench/chat can offer
  // "Playbook updated — restart" on sessions that snapshot stale steps.
  const playbookDrifted =
    session && session.status === "active"
      ? tutorSessionPlaybookDrifted(session, resolveModuleGuideForProfile(loaded.profile))
      : false;
  return jsonOk({ session, playbookDrifted });
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const loaded = await loadProjectContext(req, context);
  if ("error" in loaded) return loaded.error;

  const body = (await req.json().catch(() => ({}))) as { restart?: boolean };

  try {
    const guide = resolveModuleGuideForProfile(loaded.profile);
    const session = body?.restart === true
      ? // Restart after a playbook update: archives the stale session and
        // starts a fresh one from the current playbook (UX audit F5).
        await restartTutorSession({
          projectId: loaded.project.id,
          learnerProfileId: loaded.profile.id,
          guide,
        })
      : await startTutorSession({
          projectId: loaded.project.id,
          learnerProfileId: loaded.profile.id,
          guide,
        });
    return jsonOk({ session, playbookDrifted: false });
  } catch (error) {
    return jsonError("TUTOR_SESSION_START_FAILED", "Unable to start tutor session", 500, {
      reason: error instanceof Error ? error.message : "UNKNOWN",
    });
  }
}
