import { jsonError } from "@aitutor/shared";
import { runtimeGetBillingAccessState as loadRuntimeBillingAccessState } from "@/lib/runtime";

export type BillingSeedInput = {
  name?: string;
  handleBase?: string;
  avatarUrl?: string | null;
  email?: string | null;
};

export const runtimeGetBillingAccessState = loadRuntimeBillingAccessState;

export function billingSeedFromAuthSeed(
  seed:
    | {
        name?: string | null;
        handleBase?: string;
        avatarUrl?: string | null;
        email?: string | null;
      }
    | null
    | undefined,
): BillingSeedInput | undefined {
  if (!seed) return undefined;
  return {
    name: seed.name ?? undefined,
    handleBase: seed.handleBase,
    avatarUrl: seed.avatarUrl ?? null,
    email: seed.email ?? null,
  };
}

export function toBillingPayload(input: { status: string; accessAllowed: boolean }) {
  return {
    status: input.status,
    accessAllowed: input.accessAllowed,
  };
}

export function jsonSubscriptionRequired(
  billing: { status: string; accessAllowed: boolean },
  message = "Start your 7-day free trial to unlock this feature.",
) {
  return jsonError("SUBSCRIPTION_REQUIRED", message, 402, {
    billing: toBillingPayload(billing),
  });
}

export async function requireBillingAccess(input: {
  userId: string;
  seed?: BillingSeedInput;
  message?: string;
}) {
  const billing = await loadRuntimeBillingAccessState({
    userId: input.userId,
    seed: input.seed,
  });

  if (billing.accessAllowed) {
    return {
      ok: true as const,
      billing,
    };
  }

  return {
    ok: false as const,
    billing,
    response: jsonSubscriptionRequired(billing, input.message),
  };
}
