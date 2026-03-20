import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  mockGetAuthSeed,
  mockIsAdminEmail,
  mockRuntimeGetBillingAccessState,
  mockRuntimeGetDashboardSummary,
  mockRuntimeClaimOnboardingSession,
  mockSyncBillingFromCheckoutSession,
} = vi.hoisted(() => ({
  mockGetAuthSeed: vi.fn(),
  mockIsAdminEmail: vi.fn(),
  mockRuntimeGetBillingAccessState: vi.fn(),
  mockRuntimeGetDashboardSummary: vi.fn(),
  mockRuntimeClaimOnboardingSession: vi.fn(),
  mockSyncBillingFromCheckoutSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getAuthSeed: mockGetAuthSeed,
}));

vi.mock("@/lib/admin-access", () => ({
  isAdminEmail: mockIsAdminEmail,
}));

vi.mock("@/lib/runtime", () => ({
  runtimeGetBillingAccessState: mockRuntimeGetBillingAccessState,
  runtimeGetDashboardSummary: mockRuntimeGetDashboardSummary,
  runtimeClaimOnboardingSession: mockRuntimeClaimOnboardingSession,
}));

vi.mock("@/lib/stripe-server", () => ({
  syncBillingFromCheckoutSession: mockSyncBillingFromCheckoutSession,
}));

import { getDashboardBillingGateState } from "../../apps/web/app/dashboard/_lib";

describe("dashboard server state", () => {
  beforeEach(() => {
    mockGetAuthSeed.mockReset();
    mockIsAdminEmail.mockReset();
    mockRuntimeGetBillingAccessState.mockReset();
    mockRuntimeGetDashboardSummary.mockReset();
    mockRuntimeClaimOnboardingSession.mockReset();
    mockSyncBillingFromCheckoutSession.mockReset();

    mockIsAdminEmail.mockReturnValue(false);
    mockRuntimeGetBillingAccessState.mockResolvedValue({
      subscription: null,
      status: "none",
      accessAllowed: false,
      profile: {
        id: "profile_123",
        name: "Signed In Learner",
        handle: "signed-in-learner",
        published: false,
      },
    });
  });

  test("claims the onboarding session before loading billing state when the dashboard handoff includes a session id", async () => {
    mockGetAuthSeed.mockResolvedValue({
      userId: "user_123",
      name: "Signed In Learner",
      email: "learner@example.com",
      avatarUrl: null,
      handleBase: "signed-in-learner",
    });

    await getDashboardBillingGateState({
      onboardingSessionId: "9d84f0cc-45e8-43c2-bc59-923bc842ad9a",
    });

    expect(mockRuntimeClaimOnboardingSession).toHaveBeenCalledWith({
      sessionId: "9d84f0cc-45e8-43c2-bc59-923bc842ad9a",
      authUserId: "user_123",
      seed: {
        name: "Signed In Learner",
        email: "learner@example.com",
        handleBase: "signed-in-learner",
        avatarUrl: null,
      },
    });
  });
});
