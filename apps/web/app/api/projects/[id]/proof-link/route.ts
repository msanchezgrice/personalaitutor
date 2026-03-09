import { jsonError, jsonOk, runtimeFindProjectById, runtimeFindUserById, runtimeRecordProjectArtifact } from "@/lib/runtime";
import { z } from "zod";
import { NextRequest } from "next/server";
import { getUserId } from "@/lib/api";

const schema = z.object({
  url: z.string().url(),
  label: z.string().max(120).optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
  stepKey: z.string().max(120).optional().nullable(),
});

function summarizeNote(value: string | null | undefined) {
  const cleaned = String(value || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned.length > 120 ? `${cleaned.slice(0, 117).trim()}...` : cleaned;
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return jsonError("INVALID_BODY", "Invalid proof link payload", 400, { issues: parsed.error.issues });
  }

  const { id } = await context.params;
  const userId = getUserId(req);
  if (!userId) {
    return jsonError("UNAUTHENTICATED", "Sign in required", 401);
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
  const step = parsed.data.stepKey
    ? project.moduleSteps.find((entry) => entry.stepKey === parsed.data.stepKey) ?? null
    : null;
  if (parsed.data.stepKey && !step) {
    return jsonError("STEP_NOT_FOUND", "Module step was not found", 404);
  }

  const label = parsed.data.label?.trim() || "Manual proof link";
  const note = parsed.data.note?.trim() || "";
  const projectWithArtifact = await runtimeRecordProjectArtifact({
    projectId: project.id,
    userId,
    kind: "proof_link",
    url: parsed.data.url,
    logMessage: note
      ? `Proof link added${step ? ` for ${step.title}` : ""}: ${label}. ${summarizeNote(note)}`
      : `Proof link added${step ? ` for ${step.title}` : ""}: ${label}`,
    metadata: {
      source: "proof_link",
      label,
      note: note || null,
      stepKey: step?.stepKey ?? null,
      stepTitle: step?.title ?? null,
    },
    awardTokens: 140,
  });

  if (!projectWithArtifact) {
    return jsonError("PROOF_LINK_FAILED", "Unable to save proof link", 409);
  }

  return jsonOk({
    project: projectWithArtifact,
    artifact: {
      kind: "proof_link",
      url: parsed.data.url,
      label,
      stepKey: step?.stepKey ?? null,
    },
  });
}
