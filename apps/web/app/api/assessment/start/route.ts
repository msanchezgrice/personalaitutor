import { jsonError, jsonOk, runtimeFindOnboardingSession, runtimeStartAssessment } from "@/lib/runtime";
import { z } from "zod";
import { NextRequest } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { verifyOnboardingSessionToken } from "@/lib/onboarding-session-token";

const schema = z
  .object({
    sessionId: z.string().min(1).optional(),
    sessionToken: z.string().min(20).optional(),
  })
  .optional();

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return jsonError("INVALID_BODY", "Invalid assessment start payload", 400, { issues: parsed.error.issues });
    }

    let candidateUserId: string | null = null;
    if (parsed.data?.sessionId) {
      const session = await runtimeFindOnboardingSession(parsed.data.sessionId);
      if (!session) {
        return jsonError("SESSION_NOT_FOUND", "Onboarding session was not found", 404);
      }
      const validToken = verifyOnboardingSessionToken(parsed.data.sessionToken, {
        sessionId: parsed.data.sessionId,
        userId: session.userId,
      });
      if (!validToken) {
        return jsonError("UNAUTHORIZED_SESSION", "Onboarding session token is invalid or expired", 401);
      }
      candidateUserId = session.userId;
    } else {
      candidateUserId = await getAuthUserId(req);
    }

    if (!candidateUserId) {
      return jsonError("UNAUTHENTICATED", "Sign in required", 401);
    }

    const assessment = await runtimeStartAssessment(candidateUserId);
    if (!assessment) {
      return jsonError("USER_NOT_FOUND", "Assessment cannot start without a valid user", 404);
    }

    return jsonOk({ assessment });
  } catch (error) {
    return jsonError("ASSESSMENT_START_FAILED", "Failed to start assessment", 500, {
      reason: error instanceof Error ? error.message : "UNKNOWN",
    });
  }
}
