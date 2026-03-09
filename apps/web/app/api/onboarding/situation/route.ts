import { jsonError, jsonOk, runtimeFindOnboardingSession, runtimeUpdateOnboardingSituation } from "@/lib/runtime";
import { z } from "zod";
import { verifyOnboardingSessionToken } from "@/lib/onboarding-session-token";

const goalEnum = z.enum([
  "build_business",
  "upskill_current_job",
  "find_new_role",
  "showcase_for_job",
  "learn_foundations",
  "ship_ai_projects",
]);

const situationSchema = z.object({
  sessionId: z.string().min(1),
  sessionToken: z.string().min(20),
  situation: z.enum(["employed", "unemployed", "student", "founder", "freelancer", "career_switcher"]),
  goals: z.array(goalEnum).min(1),
});

export async function POST(req: Request) {
  const parsed = situationSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return jsonError("INVALID_BODY", "Invalid onboarding situation payload", 400, { issues: parsed.error.issues });
  }

  const existing = await runtimeFindOnboardingSession(parsed.data.sessionId);
  if (!existing) {
    return jsonError("SESSION_NOT_FOUND", "Onboarding session was not found", 404);
  }
  const validToken = verifyOnboardingSessionToken(parsed.data.sessionToken, {
    sessionId: parsed.data.sessionId,
    userId: existing.userId,
  });
  if (!validToken) {
    return jsonError("UNAUTHORIZED_SESSION", "Onboarding session token is invalid or expired", 401);
  }

  const session = await runtimeUpdateOnboardingSituation({
    sessionId: parsed.data.sessionId,
    situation: parsed.data.situation,
    goals: parsed.data.goals,
  });
  if (!session) {
    return jsonError("SESSION_NOT_FOUND", "Onboarding session was not found", 404);
  }

  return jsonOk({ session });
}
