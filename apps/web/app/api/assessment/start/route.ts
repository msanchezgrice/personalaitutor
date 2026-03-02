import { jsonError, jsonOk, runtimeFindOnboardingSession, runtimeStartAssessment } from "@/lib/runtime";
import { z } from "zod";
import { NextRequest } from "next/server";
import { getUserId } from "@/lib/api";

const schema = z
  .object({
    userId: z.string().min(1).optional(),
    sessionId: z.string().min(1).optional(),
  })
  .optional();

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return jsonError("INVALID_BODY", "Invalid assessment start payload", 400, { issues: parsed.error.issues });
  }

  const candidateUserId = parsed.data?.sessionId
    ? (await runtimeFindOnboardingSession(parsed.data.sessionId))?.userId
    : parsed.data?.userId ?? getUserId(req);

  if (!candidateUserId) {
    return jsonError("USER_NOT_FOUND", "Assessment cannot start without a valid user", 404);
  }

  const assessment = await runtimeStartAssessment(candidateUserId);
  if (!assessment) {
    return jsonError("USER_NOT_FOUND", "Assessment cannot start without a valid user", 404);
  }

  return jsonOk({ assessment });
}
