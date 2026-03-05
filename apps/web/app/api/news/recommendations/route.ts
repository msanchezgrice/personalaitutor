import { jsonError, jsonOk, runtimeRefreshRelevantNews } from "@/lib/runtime";
import { z } from "zod";
import { NextRequest } from "next/server";
import { getAuthSeed } from "@/lib/auth";
import { forcedFailCode, getUserId } from "@/lib/api";

const schema = z.object({
  maxStories: z.number().int().min(3).max(8).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return jsonError("INVALID_BODY", "Invalid news recommendation payload", 400, {
        issues: parsed.error.issues,
      });
    }

    const seed = await getAuthSeed(req);
    const userId = seed?.userId ?? getUserId(req);
    if (!userId) {
      return jsonError("UNAUTHENTICATED", "Sign in required", 401);
    }

    const result = await runtimeRefreshRelevantNews({
      forceFailCode: forcedFailCode(req),
      userId,
      maxStories: parsed.data.maxStories,
      seed: seed
        ? {
            name: seed.name,
            handleBase: seed.handleBase,
            avatarUrl: seed.avatarUrl ?? null,
            email: seed.email ?? null,
          }
        : undefined,
    });

    if (!result.ok) {
      return jsonError("NEWS_RECOMMENDATIONS_FAILED", "Unable to generate personalized AI news", 409, {
        failureCode: result.errorCode,
      });
    }

    return jsonOk({
      insights: result.insights,
      source: result.source,
      focusSummary: result.focusSummary,
      selectionRationale: result.selectionRationale,
      contextSignals: result.contextSignals,
    });
  } catch (error) {
    return jsonError("NEWS_RECOMMENDATIONS_FAILED", "Unable to generate personalized AI news", 500, {
      reason: error instanceof Error ? error.message : "UNKNOWN",
    });
  }
}

