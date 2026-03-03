import { getCatalogData, jsonError, jsonOk, runtimeCreateOnboardingSession } from "@/lib/runtime";
import { z } from "zod";
import { NextRequest } from "next/server";
import { getUserId } from "@/lib/api";
import { getAuthSeed } from "@/lib/auth";

const bodySchema = z
  .object({
    userId: z.string().min(1).optional(),
    name: z.string().min(1).max(80).optional(),
    avatarUrl: z.string().url().optional().nullable(),
    handleBase: z.string().min(1).max(80).optional(),
    careerPathId: z.string().min(1).optional(),
  })
  .optional();

export async function POST(req: NextRequest) {
  try {
    const payload = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!payload.success) {
      return jsonError("INVALID_BODY", "Invalid onboarding start payload", 400, { issues: payload.error.issues });
    }

    const seed = await getAuthSeed(req);
    const requestUserId = seed?.userId ?? getUserId(req);
    if (!requestUserId) {
      return jsonError("UNAUTHENTICATED", "Sign in required", 401);
    }
    const { user, session } = await runtimeCreateOnboardingSession({
      ...(payload.data ?? {}),
      userId: requestUserId,
      name: payload.data?.name ?? seed?.name,
      avatarUrl: payload.data?.avatarUrl ?? seed?.avatarUrl ?? null,
      email: seed?.email ?? null,
      handleBase: payload.data?.handleBase ?? seed?.handleBase,
    });
    const catalog = getCatalogData();
    return jsonOk({ user, session, onboardingOptions: catalog.careerPaths.map((c) => ({ id: c.id, name: c.name })) });
  } catch (error) {
    return jsonError("ONBOARDING_START_FAILED", "Failed to start onboarding session", 500, {
      reason: error instanceof Error ? error.message : "UNKNOWN",
    });
  }
}
