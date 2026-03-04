import { jsonError, jsonOk, runtimeUpdateOnboardingCareerImport } from "@/lib/runtime";
import { z } from "zod";

const schema = z.object({
  sessionId: z.string().min(1),
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

  const session = await runtimeUpdateOnboardingCareerImport(parsed.data);
  if (!session) {
    return jsonError("CAREER_IMPORT_FAILED", "Career import failed due to missing session or invalid career path", 400);
  }

  return jsonOk({ session });
}
