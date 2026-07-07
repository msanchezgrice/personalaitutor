import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/runtime";
import { createAnonymousAssessment } from "@/lib/anonymous-assessment";

const bodySchema = z
  .object({
    careerPathId: z.string().min(1).max(80).optional().nullable(),
    visitorId: z.string().min(1).max(160).optional().nullable(),
  })
  .optional();

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return jsonError("INVALID_BODY", "Invalid anonymous assessment start payload", 400, {
        issues: parsed.error.issues,
      });
    }

    const assessment = await createAnonymousAssessment({
      careerPathId: parsed.data?.careerPathId ?? null,
      visitorId: parsed.data?.visitorId ?? null,
    });

    return jsonOk({
      assessment: {
        id: assessment.id,
        status: assessment.status,
        createdAt: assessment.createdAt,
      },
      sessionToken: assessment.sessionToken,
    });
  } catch (error) {
    return jsonError("ANONYMOUS_ASSESSMENT_START_FAILED", "Failed to start the assessment", 500, {
      reason: error instanceof Error ? error.message : "UNKNOWN",
    });
  }
}
