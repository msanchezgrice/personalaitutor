import { getCatalogData, jsonError, jsonOk, runtimeCreateOnboardingSession } from "@/lib/runtime";
import { z } from "zod";
import { NextRequest } from "next/server";
import { getUserId } from "@/lib/api";

const bodySchema = z
  .object({
    userId: z.string().min(1).optional(),
    name: z.string().min(1).max(80).optional(),
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

    const requestUserId = payload.data?.userId ?? getUserId(req);
    const { user, session } = await runtimeCreateOnboardingSession({
      ...(payload.data ?? {}),
      userId: requestUserId,
    });
    const catalog = getCatalogData();
    return jsonOk({ user, session, onboardingOptions: catalog.careerPaths.map((c) => ({ id: c.id, name: c.name })) });
  } catch (error) {
    return jsonError("ONBOARDING_START_FAILED", "Failed to start onboarding session", 500, {
      reason: error instanceof Error ? error.message : "UNKNOWN",
    });
  }
}
