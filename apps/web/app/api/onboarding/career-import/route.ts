import { jsonError, jsonOk, runtimeUpdateOnboardingCareerImport } from "@/lib/runtime";
import { z } from "zod";

const schema = z.object({
  sessionId: z.string().min(1),
  careerPathId: z.string().min(1),
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
