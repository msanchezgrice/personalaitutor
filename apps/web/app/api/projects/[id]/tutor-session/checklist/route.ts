import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk, runtimeFindProjectById, runtimeFindUserById } from "@/lib/runtime";
import { getUserId } from "@/lib/api";
import { requireBillingAccess } from "@/lib/billing-access";
import { getTutorSessionForProject, setTutorChecklistItem } from "@/lib/tutor-session";

const schema = z.object({
  itemIndex: z.number().int().min(0).max(50),
  done: z.boolean(),
  evidence: z.string().max(1000).optional().nullable(),
});

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return jsonError("INVALID_BODY", "Invalid tutor session checklist payload", 400, { issues: parsed.error.issues });
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

  const session = await getTutorSessionForProject({ projectId: project.id, learnerProfileId: profile.id });
  if (!session) {
    return jsonError("TUTOR_SESSION_NOT_FOUND", "Start a tutor session first", 404);
  }

  try {
    const updated = await setTutorChecklistItem({
      sessionId: session.id,
      learnerProfileId: profile.id,
      itemIndex: parsed.data.itemIndex,
      done: parsed.data.done,
      evidence: parsed.data.evidence,
    });
    if (!updated) {
      return jsonError("TUTOR_SESSION_NOT_FOUND", "Tutor session was not found", 404);
    }
    return jsonOk({ session: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "TUTOR_SESSION_CHECKLIST_ITEM_NOT_FOUND") {
      return jsonError("TUTOR_SESSION_CHECKLIST_ITEM_NOT_FOUND", "Checklist item was not found", 404);
    }
    return jsonError("TUTOR_SESSION_CHECKLIST_FAILED", "Unable to update checklist item", 500, { reason: message });
  }
}
