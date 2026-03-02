import { jsonError, jsonOk, runtimeSubmitAssessment } from "@/lib/runtime";
import { z } from "zod";

const schema = z.object({
  assessmentId: z.string().min(1),
  answers: z.array(z.object({ questionId: z.string().min(1), value: z.number().min(0).max(5) })).min(1),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return jsonError("INVALID_BODY", "Invalid assessment submission", 400, { issues: parsed.error.issues });
  }

  const attempt = await runtimeSubmitAssessment(parsed.data);
  if (!attempt) {
    return jsonError("ASSESSMENT_NOT_FOUND", "Assessment attempt not found", 404);
  }

  return jsonOk({ assessment: attempt });
}
