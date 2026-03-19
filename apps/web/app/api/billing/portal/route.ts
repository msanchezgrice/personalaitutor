import { NextRequest } from "next/server";
import { z } from "zod";
import { getUserId } from "@/lib/api";
import { getAuthSeed } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/runtime";
import { createStripePortalSession } from "@/lib/stripe-server";

const bodySchema = z
  .object({
    returnTo: z.string().max(500).optional().nullable(),
  })
  .optional();

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return jsonError("INVALID_BODY", "Invalid billing portal payload", 400, {
        issues: parsed.error.issues,
      });
    }

    const seed = await getAuthSeed(req);
    const userId = seed?.userId ?? getUserId(req);
    if (!userId) {
      return jsonError("UNAUTHENTICATED", "Sign in required", 401);
    }

    const session = await createStripePortalSession({
      userId,
      name: seed?.name,
      email: seed?.email ?? null,
      avatarUrl: seed?.avatarUrl ?? null,
      handleBase: seed?.handleBase,
      returnTo: parsed.data?.returnTo ?? "/dashboard/profile",
    });

    return jsonOk({
      url: session.url,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "UNKNOWN";
    if (reason === "BILLING_CUSTOMER_NOT_FOUND") {
      return jsonError("BILLING_CUSTOMER_NOT_FOUND", "No billing subscription found for this learner", 409);
    }
    return jsonError("BILLING_PORTAL_FAILED", "Unable to open billing portal", 500, {
      reason,
    });
  }
}
