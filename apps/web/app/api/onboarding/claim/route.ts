import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { getAuthSeed } from "@/lib/auth";
import {
  jsonError,
  jsonOk,
  runtimeFindOnboardingSession,
  runtimeGetDashboardSummary,
} from "@/lib/runtime";

const schema = z.object({
  sessionId: z.string().uuid(),
});

function getSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_ENV_MISSING");
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return jsonError("INVALID_BODY", "Invalid onboarding claim payload", 400, { issues: parsed.error.issues });
  }

  const seed = await getAuthSeed(req);
  if (!seed?.userId) {
    return jsonError("UNAUTHENTICATED", "Sign in required", 401);
  }

  try {
    const session = await runtimeFindOnboardingSession(parsed.data.sessionId);
    if (!session) {
      return jsonError("SESSION_NOT_FOUND", "Onboarding session not found", 404);
    }

    const summary = await runtimeGetDashboardSummary(seed.userId, {
      name: seed.name,
      handleBase: seed.handleBase,
      avatarUrl: seed.avatarUrl ?? null,
      email: seed.email ?? null,
    });
    const targetUser = summary?.user;
    if (!targetUser) {
      return jsonError("TARGET_USER_NOT_FOUND", "Unable to resolve target user profile", 404);
    }

    const migrated = session.userId !== targetUser.id;
    if (migrated) {
      const supabase = getSupabaseAdminClient();
      const now = new Date().toISOString();

      const { error: onboardingError } = await supabase
        .from("onboarding_sessions")
        .update({
          learner_profile_id: targetUser.id,
          updated_at: now,
        })
        .eq("id", session.id);

      if (onboardingError) {
        return jsonError("ONBOARDING_CLAIM_FAILED", "Unable to claim onboarding session", 500, {
          reason: onboardingError.message,
        });
      }

      await supabase
        .from("assessment_attempts")
        .update({
          learner_profile_id: targetUser.id,
          updated_at: now,
        })
        .eq("learner_profile_id", session.userId);
    }

    const refreshedSession = await runtimeFindOnboardingSession(parsed.data.sessionId);
    if (!refreshedSession) {
      return jsonError("SESSION_NOT_FOUND", "Onboarding session not found", 404);
    }

    return jsonOk({
      session: refreshedSession,
      user: targetUser,
      migrated,
    });
  } catch (error) {
    return jsonError("ONBOARDING_CLAIM_FAILED", "Unable to claim onboarding session", 500, {
      reason: error instanceof Error ? error.message : "UNKNOWN",
    });
  }
}
