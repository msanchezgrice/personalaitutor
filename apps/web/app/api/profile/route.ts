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
  avatarUrl: z
    .string()
    .refine((value) => {
      if (value.startsWith("data:image/")) return true;
      try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    }, "avatarUrl must be an image data URL or HTTP(S) URL")
    .optional()
    .nullable(),
  headline: z.string().min(4).max(140).optional(),
  bio: z.string().min(8).max(1200).optional(),
  careerPathId: z.string().min(1).optional(),
  tools: z.array(z.string().min(1)).max(40).optional(),
  goals: z.array(goals).max(10).optional(),
  socialLinks: z
    .object({
      linkedin: z.string().min(1).optional(),
      x: z.string().min(1).optional(),
      website: z.string().min(1).optional(),
      github: z.string().min(1).optional(),
    })
    .optional(),
});

function normalizeUrl(input?: string) {
  if (!input) return undefined;
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  const value = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(value);
    return parsed.toString();
  } catch {
    return undefined;
  }
}

function provided(input?: string) {
  return typeof input === "string" && input.trim().length > 0;
}

export async function PATCH(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return jsonError("INVALID_BODY", "Invalid profile patch payload", 400, { issues: parsed.error.issues });
  }

  const userId = getUserId(req);
  if (!userId) {
    return jsonError("UNAUTHENTICATED", "Sign in required", 401);
  }
  const payload = parsed.data;
  const normalizedSocialLinks = payload.socialLinks
    ? {
        linkedin: normalizeUrl(payload.socialLinks.linkedin),
        x: normalizeUrl(payload.socialLinks.x),
        website: normalizeUrl(payload.socialLinks.website),
        github: normalizeUrl(payload.socialLinks.github),
      }
    : undefined;

  if (
    payload.socialLinks &&
    ((provided(payload.socialLinks.linkedin) && !normalizedSocialLinks?.linkedin) ||
      (provided(payload.socialLinks.x) && !normalizedSocialLinks?.x) ||
      (provided(payload.socialLinks.website) && !normalizedSocialLinks?.website) ||
      (provided(payload.socialLinks.github) && !normalizedSocialLinks?.github))
  ) {
    return jsonError("INVALID_BODY", "Invalid social link URL", 400);
  }

  const profile = await runtimeUpdateProfile(userId, {
    ...payload,
    socialLinks: normalizedSocialLinks,
  });
  if (!profile) {
    return jsonError("USER_NOT_FOUND", "Profile update requires a valid user", 404);
  }

  return jsonOk({ profile });
}
