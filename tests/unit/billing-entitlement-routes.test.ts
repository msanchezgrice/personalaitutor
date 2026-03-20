import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  mockGetAuthSeed,
  mockGetUserId,
  mockForcedFailCode,
  mockGetCatalogData,
  mockRuntimeGetDashboardSummary,
  mockRuntimeGetBillingAccessState,
  mockRuntimeCreateSocialDrafts,
} = vi.hoisted(() => ({
  mockGetAuthSeed: vi.fn(),
  mockGetUserId: vi.fn(),
  mockForcedFailCode: vi.fn(),
  mockGetCatalogData: vi.fn(),
  mockRuntimeGetDashboardSummary: vi.fn(),
  mockRuntimeGetBillingAccessState: vi.fn(),
  mockRuntimeCreateSocialDrafts: vi.fn(),
}));

class MockNextRequest extends Request {
  nextUrl: URL;

  constructor(input: string, init?: RequestInit) {
    super(input, init);
    this.nextUrl = new URL(input);
  }
}

vi.mock("next/server", () => ({
  NextRequest: MockNextRequest,
}), { virtual: true });

vi.mock("@/lib/auth", () => ({
  getAuthSeed: mockGetAuthSeed,
}));

vi.mock("@/lib/api", () => ({
  getUserId: mockGetUserId,
  forcedFailCode: mockForcedFailCode,
}));

vi.mock("@/lib/runtime", () => ({
  getCatalogData: mockGetCatalogData,
  runtimeGetDashboardSummary: mockRuntimeGetDashboardSummary,
  runtimeCreateSocialDrafts: mockRuntimeCreateSocialDrafts,
  jsonOk: (data: Record<string, unknown>, init?: ResponseInit) => Response.json({ ok: true, ...data }, init),
  jsonError: (code: string, message: string, status = 400, details?: Record<string, unknown>) =>
    Response.json(
      {
        ok: false,
        error: {
          code,
          message,
          ...(details ?? {}),
        },
      },
      { status },
    ),
}));

vi.mock("@/lib/billing-access", () => ({
  runtimeGetBillingAccessState: mockRuntimeGetBillingAccessState,
  billingSeedFromAuthSeed: (seed: {
    name?: string | null;
    handleBase?: string | null;
    avatarUrl?: string | null;
    email?: string | null;
  } | null | undefined) =>
    seed
      ? {
          name: seed.name ?? undefined,
          handleBase: seed.handleBase ?? undefined,
          avatarUrl: seed.avatarUrl ?? null,
          email: seed.email ?? null,
        }
      : undefined,
  jsonSubscriptionRequired: (billing: { status: string; accessAllowed: boolean }) =>
    Response.json(
      {
        ok: false,
        error: {
          code: "SUBSCRIPTION_REQUIRED",
          message: "Start your 7-day free trial to unlock this feature.",
          billing: {
            status: billing.status,
            accessAllowed: billing.accessAllowed,
          },
        },
      },
      { status: 402 },
    ),
  toBillingPayload: (billing: { status: string; accessAllowed: boolean }) => ({
    status: billing.status,
    accessAllowed: billing.accessAllowed,
  }),
  requireBillingAccess: async ({ userId }: { userId: string }) => {
    const billing = await mockRuntimeGetBillingAccessState({ userId });
    if (billing?.accessAllowed) {
      return {
        ok: true as const,
        billing,
      };
    }

    return {
      ok: false as const,
      billing,
      response: Response.json(
        {
          ok: false,
          error: {
            code: "SUBSCRIPTION_REQUIRED",
            message: "Start your 7-day free trial to unlock this feature.",
            billing: billing
              ? {
                  status: billing.status,
                  accessAllowed: billing.accessAllowed,
                }
              : {
                  status: "none",
                  accessAllowed: false,
                },
          },
        },
        { status: 402 },
      ),
    };
  },
}));

import { GET as dashboardSummaryGet } from "../../apps/web/app/api/dashboard/summary/route";
import { GET as authSessionGet } from "../../apps/web/app/api/auth/session/route";
import { POST as socialDraftsGeneratePost } from "../../apps/web/app/api/social/drafts/generate/route";

describe("billing entitlement routes", () => {
  beforeEach(() => {
    mockGetAuthSeed.mockReset();
    mockGetUserId.mockReset();
    mockForcedFailCode.mockReset();
    mockGetCatalogData.mockReset();
    mockRuntimeGetDashboardSummary.mockReset();
    mockRuntimeGetBillingAccessState.mockReset();
    mockRuntimeCreateSocialDrafts.mockReset();
    mockForcedFailCode.mockReturnValue(undefined);
    mockGetCatalogData.mockReturnValue({ careerPaths: [] });
  });

  test("dashboard summary blocks locked users before loading paid data", async () => {
    mockGetAuthSeed.mockResolvedValue({
      userId: "user_123",
      name: "Billing User",
      email: "billing@example.com",
      avatarUrl: null,
      handleBase: "billing-user",
    });
    mockRuntimeGetBillingAccessState.mockResolvedValue({
      profile: null,
      subscription: null,
      status: "none",
      accessAllowed: false,
    });

    const response = await dashboardSummaryGet(new MockNextRequest("http://localhost/api/dashboard/summary"));
    const body = await response.json();

    expect(response.status).toBe(402);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("SUBSCRIPTION_REQUIRED");
    expect(body.error.billing).toEqual({
      status: "none",
      accessAllowed: false,
    });
    expect(mockRuntimeGetDashboardSummary).not.toHaveBeenCalled();
  });

  test("auth session returns auth plus billing state without paid summary data when locked", async () => {
    mockGetAuthSeed.mockResolvedValue({
      userId: "user_123",
      name: "Billing User",
      email: "billing@example.com",
      avatarUrl: "https://example.com/avatar.png",
      handleBase: "billing-user",
    });
    mockRuntimeGetBillingAccessState.mockResolvedValue({
      profile: {
        id: "profile_123",
        handle: "billing-user",
        name: "Billing User",
        avatarUrl: null,
        contactEmail: "billing@example.com",
        stripeCustomerId: null,
        headline: "AI Builder",
        bio: "Building practical AI workflows and sharing public proof of execution.",
        careerPathId: "product-manager",
        skills: [],
        tools: [],
        socialLinks: {},
        published: false,
        tokensUsed: 0,
        goals: [],
        createdAt: "2026-03-19T12:00:00.000Z",
        updatedAt: "2026-03-19T12:00:00.000Z",
      },
      subscription: null,
      status: "none",
      accessAllowed: false,
    });

    const response = await authSessionGet(new MockNextRequest("http://localhost/api/auth/session"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.auth).toEqual({
      userId: "user_123",
      name: "Billing User",
      email: "billing@example.com",
      avatarUrl: "https://example.com/avatar.png",
    });
    expect(body.summary).toBeNull();
    expect(body.billing).toEqual({
      status: "none",
      accessAllowed: false,
    });
    expect(mockRuntimeGetDashboardSummary).not.toHaveBeenCalled();
  });

  test("social draft generation returns subscription required when billing is locked", async () => {
    mockGetUserId.mockReturnValue("user_123");
    mockRuntimeGetBillingAccessState.mockResolvedValue({
      profile: null,
      subscription: null,
      status: "none",
      accessAllowed: false,
    });

    const response = await socialDraftsGeneratePost(
      new MockNextRequest("http://localhost/api/social/drafts/generate", {
        method: "POST",
        body: JSON.stringify({ projectId: "project_123" }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(402);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("SUBSCRIPTION_REQUIRED");
    expect(body.error.billing).toEqual({
      status: "none",
      accessAllowed: false,
    });
    expect(mockRuntimeCreateSocialDrafts).not.toHaveBeenCalled();
  });
});
