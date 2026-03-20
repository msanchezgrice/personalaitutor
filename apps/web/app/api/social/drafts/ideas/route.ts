import { jsonError, jsonOk, runtimeGenerateSocialIdeas } from "@/lib/runtime";
import { z } from "zod";
import { NextRequest } from "next/server";
import { getAuthSeed } from "@/lib/auth";
import { getUserId } from "@/lib/api";
import { billingSeedFromAuthSeed, requireBillingAccess } from "@/lib/billing-access";

const schema = z.object({
  projectId: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return jsonError("INVALID_BODY", "Invalid social idea payload", 400, { issues: parsed.error.issues });
    }

    const seed = await getAuthSeed(req);
    const userId = seed?.userId ?? getUserId(req);
    if (!userId) {
      return jsonError("UNAUTHENTICATED", "Sign in required", 401);
    }
    const access = await requireBillingAccess({
      userId,
      seed: billingSeedFromAuthSeed(seed),
    });
    if (!access.ok) {
      return access.response;
    }

    const result = await runtimeGenerateSocialIdeas({
      userId,
      projectId: parsed.data.projectId,
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
      return jsonError("SOCIAL_IDEA_GENERATION_FAILED", "Unable to generate social ideas", 409, {
        failureCode: result.errorCode,
      });
    }

    return jsonOk({
      ideas: result.ideas,
      source: result.source,
      memorySignals: result.memorySignals,
    });
  } catch (error) {
    return jsonError("SOCIAL_IDEA_GENERATION_FAILED", "Unable to generate social ideas", 500, {
      reason: error instanceof Error ? error.message : "UNKNOWN",
    });
  }
}
