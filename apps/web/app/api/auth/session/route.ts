import { jsonError, jsonOk, runtimeGetDashboardSummary } from "@/lib/runtime";
import { getAuthSeed } from "@/lib/auth";
import { NextRequest } from "next/server";
import { billingSeedFromAuthSeed, runtimeGetBillingAccessState, toBillingPayload } from "@/lib/billing-access";

export async function GET(req: NextRequest) {
  const seed = await getAuthSeed(req);
  if (!seed?.userId) {
    return jsonError("UNAUTHENTICATED", "Sign in required", 401);
  }

  const billing = await runtimeGetBillingAccessState({
    userId: seed.userId,
    seed: billingSeedFromAuthSeed(seed),
  });
  const auth = {
    userId: seed.userId,
    name: seed.name ?? billing.profile?.name ?? null,
    email: seed.email ?? billing.profile?.contactEmail ?? null,
    avatarUrl: seed.avatarUrl ?? billing.profile?.avatarUrl ?? null,
  };

  if (!billing.accessAllowed) {
    return jsonOk({
      auth,
      billing: toBillingPayload(billing),
      summary: null,
    });
  }

  const summary = await runtimeGetDashboardSummary(seed.userId, {
    name: seed.name,
    handleBase: seed.handleBase,
    avatarUrl: seed.avatarUrl ?? null,
    email: seed.email ?? null,
  });

  if (!summary) {
    return jsonError("USER_NOT_FOUND", "Unable to load session profile", 404);
  }

  return jsonOk({
    auth: {
      ...auth,
      name: auth.name ?? summary.user.name,
      avatarUrl: auth.avatarUrl ?? summary.user.avatarUrl ?? null,
    },
    billing: toBillingPayload(billing),
    summary,
  });
}
