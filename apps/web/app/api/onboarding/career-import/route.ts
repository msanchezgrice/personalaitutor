import { jsonError, jsonOk, runtimeFindOnboardingSession, runtimeUpdateOnboardingCareerImport } from "@/lib/runtime";
import { z } from "zod";
import { verifyOnboardingSessionToken } from "@/lib/onboarding-session-token";

const schema = z.object({
  sessionId: z.string().min(1),
  sessionToken: z.string().min(20),
  careerPathId: z.string().min(1),
  careerCategoryLabel: z.string().min(1).max(80).optional(),
  jobTitle: z.string().min(1).max(120).optional(),
  yearsExperience: z.enum(["0-1", "1-3", "3-5", "5-10", "10+"]).optional(),
  companySize: z.enum(["startup", "small", "medium", "large"]).optional().nullable(),
  dailyWorkSummary: z.string().max(4000).optional(),
  keySkills: z.string().max(2000).optional().nullable(),
  aiComfort: z.number().int().min(1).max(5).optional(),
  linkedinUrl: z.string().url().optional().nullable(),
  resumeFilename: z.string().min(1).optional().nullable(),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return jsonError("INVALID_BODY", "Invalid career import payload", 400, { issues: parsed.error.issues });
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

  const session = await runtimeUpdateOnboardingCareerImport({
    sessionId: parsed.data.sessionId,
    careerPathId: parsed.data.careerPathId,
    careerCategoryLabel: parsed.data.careerCategoryLabel,
    jobTitle: parsed.data.jobTitle,
    yearsExperience: parsed.data.yearsExperience,
    companySize: parsed.data.companySize,
    dailyWorkSummary: parsed.data.dailyWorkSummary,
    keySkills: parsed.data.keySkills,
    aiComfort: parsed.data.aiComfort,
    linkedinUrl: parsed.data.linkedinUrl,
    resumeFilename: parsed.data.resumeFilename,
  });
  if (!session) {
    return jsonError("CAREER_IMPORT_FAILED", "Career import failed due to missing session or invalid career path", 400);
  }

  return jsonOk({ session });
}
