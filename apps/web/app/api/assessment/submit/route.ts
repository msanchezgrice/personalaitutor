import { jsonError, jsonOk, runtimeSubmitAssessment } from "@/lib/runtime";
import { z } from "zod";
import { NextRequest } from "next/server";
import { getAuthUserId } from "@/lib/auth";

const schema = z.object({
  assessmentId: z.string().min(1),
  answers: z.array(z.object({ questionId: z.string().min(1), value: z.number().min(0).max(5) })).min(1),
});

export async function POST(req: NextRequest) {
  try {
    const authUserId = await getAuthUserId(req);
    if (!authUserId) {
      return jsonError("UNAUTHENTICATED", "Sign in required", 401);
    }

    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return jsonError("INVALID_BODY", "Invalid assessment submission", 400, { issues: parsed.error.issues });
    }

    const attempt = await runtimeSubmitAssessment({
      ...parsed.data,
      actorUserId: authUserId,
    });
    if (!attempt) {
      return jsonError("ASSESSMENT_NOT_FOUND", "Assessment attempt not found", 404);
    }

    return jsonOk({ assessment: attempt });
  } catch (error) {
    return jsonError("ASSESSMENT_SUBMIT_FAILED", "Failed to submit assessment", 500, {
      reason: error instanceof Error ? error.message : "UNKNOWN",
    });
  }
}
