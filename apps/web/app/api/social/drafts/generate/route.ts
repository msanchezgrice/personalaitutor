import { jsonError, jsonOk, runtimeCreateSocialDrafts } from "@/lib/runtime";
import { z } from "zod";
import { NextRequest } from "next/server";
import { forcedFailCode, getUserId } from "@/lib/api";

const schema = z.object({
  userId: z.string().optional(),
  projectId: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return jsonError("INVALID_BODY", "Invalid social draft payload", 400, { issues: parsed.error.issues });
    }

    const userId = parsed.data.userId ?? getUserId(req);
    const result = await runtimeCreateSocialDrafts({
      userId,
      projectId: parsed.data.projectId,
      forceFailCode: forcedFailCode(req),
    });

    if (!result.ok) {
      return jsonError("SOCIAL_DRAFT_GENERATION_FAILED", "Failed to generate social drafts", 409, {
        failureCode: result.errorCode,
        recoveryAction: "Retry generation after provider recovery",
      });
    }

    return jsonOk({ drafts: result.drafts });
  } catch (error) {
    return jsonError("SOCIAL_DRAFT_GENERATION_FAILED", "Failed to generate social drafts", 500, {
      reason: error instanceof Error ? error.message : "UNKNOWN",
    });
  }
}
