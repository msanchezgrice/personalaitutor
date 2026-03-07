import { z } from "zod";
import {
  jsonError,
  jsonOk,
  runtimeFindOnboardingSession,
  runtimeUpdateOnboardingDraft,
} from "@/lib/runtime";
import { verifyOnboardingSessionToken } from "@/lib/onboarding-session-token";

const goalEnum = z.enum([
  "build_business",
  "upskill_current_job",
  "showcase_for_job",
  "learn_foundations",
  "ship_ai_projects",
]);

const careerCategoryEnum = z.enum([
  "product-manager",
  "designer",
  "marketing",
  "accounting",
  "legal",
  "software-engineering",
  "other",
]);

const draftSchema = z
  .object({
    fullName: z.string().max(120).optional().nullable(),
    careerCategory: careerCategoryEnum.optional().nullable(),
    careerCategoryLabel: z.string().max(120).optional().nullable(),
    customCareerCategory: z.string().max(120).optional().nullable(),
    careerPathId: z.string().max(80).optional().nullable(),
    jobTitle: z.string().max(160).optional().nullable(),
    yearsExperience: z.enum(["0-1", "1-3", "3-5", "5-10", "10+"]).optional().nullable(),
    companySize: z.enum(["startup", "small", "medium", "large"]).optional().nullable(),
    situation: z
      .enum(["employed", "unemployed", "student", "founder", "freelancer", "career_switcher"])
      .optional()
      .nullable(),
    dailyWorkSummary: z.string().max(4000).optional().nullable(),
    keySkills: z.string().max(2000).optional().nullable(),
    linkedinUrl: z.string().max(1000).optional().nullable(),
    selectedGoals: z.array(goalEnum).optional(),
    aiComfort: z.number().int().min(1).max(5).optional().nullable(),
    resumeFilename: z.string().max(255).optional().nullable(),
    uploadedResumeName: z.string().max(255).optional().nullable(),
    currentStep: z.number().int().min(1).max(5).optional().nullable(),
  })
  .partial();

const schema = z.object({
  sessionId: z.string().min(1),
  sessionToken: z.string().min(20),
  draft: draftSchema,
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return jsonError("INVALID_BODY", "Invalid onboarding draft payload", 400, {
      issues: parsed.error.issues,
    });
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

  const session = await runtimeUpdateOnboardingDraft({
    sessionId: parsed.data.sessionId,
    draft: parsed.data.draft,
  });
  if (!session) {
    return jsonError("SESSION_NOT_FOUND", "Onboarding session was not found", 404);
  }

  return jsonOk({ session });
}
