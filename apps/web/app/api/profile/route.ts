import { jsonError, jsonOk, runtimeUpdateProfile } from "@/lib/runtime";
import { z } from "zod";
import { NextRequest } from "next/server";
import { getUserId } from "@/lib/api";

const goals = z.enum([
  "build_business",
  "upskill_current_job",
  "showcase_for_job",
  "learn_foundations",
  "ship_ai_projects",
]);

const schema = z.object({
  handle: z.string().min(2).max(64).optional(),
  name: z.string().min(2).max(80).optional(),
  avatarUrl: z.string().url().optional().nullable(),
  headline: z.string().min(4).max(140).optional(),
  bio: z.string().min(8).max(1200).optional(),
  careerPathId: z.string().min(1).optional(),
  tools: z.array(z.string().min(1)).max(40).optional(),
  goals: z.array(goals).max(10).optional(),
  socialLinks: z
    .object({
      linkedin: z.string().url().optional(),
      x: z.string().url().optional(),
      website: z.string().url().optional(),
      github: z.string().url().optional(),
    })
    .optional(),
});

export async function PATCH(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return jsonError("INVALID_BODY", "Invalid profile patch payload", 400, { issues: parsed.error.issues });
  }

  const userId = getUserId(req);
  if (!userId) {
    return jsonError("UNAUTHENTICATED", "Sign in required", 401);
  }
  const profile = await runtimeUpdateProfile(userId, parsed.data);
  if (!profile) {
    return jsonError("USER_NOT_FOUND", "Profile update requires a valid user", 404);
  }

  return jsonOk({ profile });
}
