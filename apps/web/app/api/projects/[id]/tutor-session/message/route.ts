import { NextRequest } from "next/server";
import { z } from "zod";
import { appendBuildLog, jsonError, jsonOk, runtimeFindProjectById, runtimeFindUserById } from "@/lib/runtime";
import { getUserId } from "@/lib/api";
import { requireBillingAccess } from "@/lib/billing-access";
import { resolveModuleGuideForProfile } from "@/lib/artifact-generation";
import { getLatestAssessmentReportForProfile } from "@/lib/anonymous-assessment";
import { generateTutorSessionReply, getTutorSessionForProject } from "@/lib/tutor-session";

const schema = z.object({
  message: z.string().min(1).max(4000),
});

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return jsonError("INVALID_BODY", "Invalid tutor session message", 400, { issues: parsed.error.issues });
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

  const guide = resolveModuleGuideForProfile(profile, session.moduleTitle);
  const report = await getLatestAssessmentReportForProfile(profile.id).catch(() => null);

  try {
    const reply = await generateTutorSessionReply({
      session,
      guide,
      learner: {
        name: profile.name,
        headline: profile.headline || null,
        goals: (profile.goals ?? []).map((goal) => String(goal)),
      },
      assessment: report
        ? {
            readinessScore: report.readinessScore,
            headline: report.report.headline,
            topGaps: report.report.gaps.slice(0, 3).map((gap) => gap.title),
          }
        : null,
      message: parsed.data.message,
    });

    await appendBuildLog({
      projectId: project.id,
      userId: profile.id,
      level: "info",
      message: `Tutor session message: ${parsed.data.message.slice(0, 80)}`,
      metadata: { tutorSessionId: session.id },
    });

    return jsonOk({ reply, sessionId: session.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    const code = message.startsWith("OPENAI_CONFIG_MISSING") ? "OPENAI_CONFIG_MISSING" : "TUTOR_SESSION_REPLY_FAILED";
    return jsonError(code, "Unable to generate tutor reply right now", 502, {
      reason: message.slice(0, 300),
      recoveryAction: "Retry in a minute",
    });
  }
}
