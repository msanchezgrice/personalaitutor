import { jsonError, jsonOk, runtimeUpdateOnboardingSituation } from "@/lib/runtime";
import { z } from "zod";

const goalEnum = z.enum([
  "build_business",
  "upskill_current_job",
  "showcase_for_job",
  "learn_foundations",
  "ship_ai_projects",
]);

const situationSchema = z.object({
  sessionId: z.string().min(1),
  situation: z.enum(["employed", "unemployed", "student", "founder", "freelancer", "career_switcher"]),
  goals: z.array(goalEnum).min(1),
});

export async function POST(req: Request) {
  const parsed = situationSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return jsonError("INVALID_BODY", "Invalid onboarding situation payload", 400, { issues: parsed.error.issues });
  }

  const session = await runtimeUpdateOnboardingSituation(parsed.data);
  if (!session) {
    return jsonError("SESSION_NOT_FOUND", "Onboarding session was not found", 404);
  }

  return jsonOk({ session });
}
