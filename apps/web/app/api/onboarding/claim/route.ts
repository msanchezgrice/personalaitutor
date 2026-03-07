import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthSeed } from "@/lib/auth";
import {
  jsonError,
  jsonOk,
  runtimeClaimOnboardingSession,
} from "@/lib/runtime";

const schema = z.object({
  sessionId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return jsonError("INVALID_BODY", "Invalid onboarding claim payload", 400, {
      issues: parsed.error.issues,
    });
  }

  const seed = await getAuthSeed(req);
  if (!seed?.userId) {
    return jsonError("UNAUTHENTICATED", "Sign in required", 401);
  }

  try {
    const claimed = await runtimeClaimOnboardingSession({
      sessionId: parsed.data.sessionId,
      authUserId: seed.userId,
      seed: {
        name: seed.name,
        email: seed.email ?? null,
        handleBase: seed.handleBase,
        avatarUrl: seed.avatarUrl ?? null,
      },
    });

    if (!claimed) {
      return jsonError("SESSION_NOT_FOUND", "Onboarding session not found", 404);
    }

    return jsonOk({
      session: claimed.session,
      user: claimed.user,
      migrated: claimed.migrated,
    });
  } catch (error) {
    return jsonError("ONBOARDING_CLAIM_FAILED", "Unable to claim onboarding session", 500, {
      reason: error instanceof Error ? error.message : "UNKNOWN",
    });
  }
}
