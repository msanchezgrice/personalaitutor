import { NextRequest } from "next/server";
import { z } from "zod";
import { getUserId } from "@/lib/api";
import { getAuthSeed } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/runtime";
import { createStripeCheckoutSession } from "@/lib/stripe-server";

const bodySchema = z
  .object({
    returnTo: z.string().max(500).optional().nullable(),
  })
  .optional();

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return jsonError("INVALID_BODY", "Invalid billing checkout payload", 400, {
        issues: parsed.error.issues,
      });
    }

    const seed = await getAuthSeed(req);
    const userId = seed?.userId ?? getUserId(req);
    if (!userId) {
      return jsonError("UNAUTHENTICATED", "Sign in required", 401);
    }

    const { session } = await createStripeCheckoutSession({
      userId,
      name: seed?.name,
      email: seed?.email ?? null,
      avatarUrl: seed?.avatarUrl ?? null,
      handleBase: seed?.handleBase,
      returnTo: parsed.data?.returnTo ?? "/dashboard",
    });

    return jsonOk({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    return jsonError("BILLING_CHECKOUT_FAILED", "Unable to start billing checkout", 500, {
      reason: error instanceof Error ? error.message : "UNKNOWN",
    });
  }
}
