import { beforeEach, describe, expect, test } from "vitest";
import {
  runtimeFindUserById,
  runtimeGetBillingAccessState,
  runtimeGetBillingSubscription,
  runtimeGetOrCreateProfile,
  runtimeUpsertBillingSubscription,
} from "../../apps/web/lib/runtime";
import { resetStateForTests } from "../../packages/shared/src/store";

describe("runtime billing helpers", () => {
  beforeEach(() => {
    resetStateForTests();
  });

  test("creates or reuses a learner profile and stores billing state in memory mode", async () => {
    const profile = await runtimeGetOrCreateProfile({
      userId: "user_billing_001",
      name: "Billing Learner",
      email: "billing@example.com",
      handleBase: "billing-learner",
      avatarUrl: null,
    });

    expect(profile.id).toBe("user_billing_001");
    expect(await runtimeGetBillingSubscription(profile.id)).toBeNull();

    const saved = await runtimeUpsertBillingSubscription({
      userId: profile.id,
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_123",
      stripePriceId: "price_123",
      status: "trialing",
      trialEndsAt: "2026-03-26T12:00:00.000Z",
      currentPeriodEndsAt: "2026-03-26T12:00:00.000Z",
      cancelAtPeriodEnd: false,
      lastWebhookEventId: "evt_123",
      lastWebhookReceivedAt: "2026-03-19T12:00:00.000Z",
    });

    expect(saved.status).toBe("trialing");
    expect(saved.stripeCustomerId).toBe("cus_123");
    expect(await runtimeGetBillingSubscription(profile.id)).toMatchObject({
      stripeSubscriptionId: "sub_123",
      status: "trialing",
    });
    expect(await runtimeFindUserById(profile.id)).toMatchObject({
      stripeCustomerId: "cus_123",
    });
  });

  test("computes billing access from the stored subscription state", async () => {
    const locked = await runtimeGetBillingAccessState({
      userId: "user_billing_lock_001",
      seed: {
        name: "Locked Learner",
        email: "locked@example.com",
        handleBase: "locked-learner",
        avatarUrl: null,
      },
    });

    expect(locked.accessAllowed).toBe(false);
    expect(locked.status).toBe("none");
    expect(locked.profile?.id).toBe("user_billing_lock_001");

    await runtimeUpsertBillingSubscription({
      userId: "user_billing_lock_001",
      stripeCustomerId: "cus_trialing_123",
      stripeSubscriptionId: "sub_trialing_123",
      stripePriceId: "price_trialing_123",
      status: "trialing",
      trialEndsAt: "2026-03-26T12:00:00.000Z",
      currentPeriodEndsAt: "2026-03-26T12:00:00.000Z",
      cancelAtPeriodEnd: false,
      lastWebhookEventId: "evt_trialing_123",
      lastWebhookReceivedAt: "2026-03-19T12:00:00.000Z",
    });

    const unlocked = await runtimeGetBillingAccessState({ userId: "user_billing_lock_001" });

    expect(unlocked.accessAllowed).toBe(true);
    expect(unlocked.status).toBe("trialing");
    expect(unlocked.subscription?.stripeSubscriptionId).toBe("sub_trialing_123");
  });
});
