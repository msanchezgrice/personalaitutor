import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";

/**
 * Career maps are linked wherever anonymous assessments are linked today:
 * dashboard load (_lib.ts) and the onboarding claim/complete routes. The map
 * linking must never break those production paths.
 */

const {
  mockGetAuthSeed,
  mockRuntimeGetBillingAccessState,
  mockRuntimeClaimOnboardingSession,
  mockLinkAssessments,
  mockLinkCareerMaps,
  mockReadCookieToken,
} = vi.hoisted(() => ({
  mockGetAuthSeed: vi.fn(),
  mockRuntimeGetBillingAccessState: vi.fn(),
  mockRuntimeClaimOnboardingSession: vi.fn(),
  mockLinkAssessments: vi.fn(),
  mockLinkCareerMaps: vi.fn(),
  mockReadCookieToken: vi.fn(),
}));

class MockNextRequest extends Request {
  nextUrl: URL;

  constructor(input: string, init?: RequestInit) {
    super(input, init);
    this.nextUrl = new URL(input);
  }
}

vi.mock("next/server", () => ({ NextRequest: MockNextRequest }), { virtual: true });

vi.mock("@/lib/auth", () => ({ getAuthSeed: mockGetAuthSeed }));
vi.mock("@/lib/admin-access", () => ({ isAdminEmail: () => false }));
vi.mock("@/lib/stripe-server", () => ({ syncBillingFromCheckoutSession: vi.fn() }));
vi.mock("@/lib/anonymous-assessment", () => ({ linkAnonymousAssessmentsToProfile: mockLinkAssessments }));

vi.mock("@/lib/runtime", async () => {
  const http = await vi.importActual<typeof import("../../packages/shared/src/http")>("../../packages/shared/src/http");
  return {
    jsonOk: http.jsonOk,
    jsonError: http.jsonError,
    runtimeGetBillingAccessState: mockRuntimeGetBillingAccessState,
    runtimeGetDashboardSummary: vi.fn(),
    runtimeClaimOnboardingSession: mockRuntimeClaimOnboardingSession,
  };
});

vi.mock("@/lib/career-map-linking", async () => {
  const actual = await vi.importActual<typeof import("../../apps/web/lib/career-map-linking")>("../../apps/web/lib/career-map-linking");
  return {
    linkCareerMapsForLearner: mockLinkCareerMaps,
    readCareerMapCookieToken: mockReadCookieToken,
    readCareerMapCookieFromRequest: actual.readCareerMapCookieFromRequest,
  };
});

import { getDashboardBillingGateState } from "../../apps/web/app/dashboard/_lib";
import { POST as claimPost } from "../../apps/web/app/api/onboarding/claim/route";
import { CAREER_MAP_COOKIE_NAME } from "@aitutor/shared";

const SESSION_ID = "9d84f0cc-45e8-43c2-bc59-923bc842ad9a";

describe("career map linking call sites", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mockGetAuthSeed.mockReset();
    mockRuntimeGetBillingAccessState.mockReset();
    mockRuntimeClaimOnboardingSession.mockReset();
    mockLinkAssessments.mockReset();
    mockLinkCareerMaps.mockReset();
    mockReadCookieToken.mockReset();

    mockGetAuthSeed.mockResolvedValue({ userId: "user_1", name: "Maya", email: "maya@example.com", avatarUrl: null, handleBase: "maya" });
    mockRuntimeGetBillingAccessState.mockResolvedValue({
      subscription: null,
      status: "trialing",
      accessAllowed: true,
      profile: { id: "profile_1", name: "Maya", handle: "maya", published: false },
    });
    mockLinkAssessments.mockResolvedValue(undefined);
    mockLinkCareerMaps.mockResolvedValue({ skipped: false, linkedByToken: true, linkedByEmail: 0, failures: [] });
    mockReadCookieToken.mockResolvedValue("tok_cookie");
  });

  test("dashboard load links the cookie's map and same-email maps to the learner profile", async () => {
    await getDashboardBillingGateState();
    expect(mockLinkAssessments).toHaveBeenCalledWith({ learnerProfileId: "profile_1", email: "maya@example.com" });
    expect(mockLinkCareerMaps).toHaveBeenCalledWith({ learnerProfileId: "profile_1", email: "maya@example.com", cookieToken: "tok_cookie" });
  });

  test("dashboard load survives a career map linking failure", async () => {
    mockLinkCareerMaps.mockRejectedValue(new Error("unexpected"));
    const billing = await getDashboardBillingGateState();
    expect(billing.accessAllowed).toBe(true);
    expect(billing.profile?.id).toBe("profile_1");
  });

  test("dashboard load survives an assessment linking failure and still links maps", async () => {
    mockLinkAssessments.mockRejectedValue(new Error("assessment store down"));
    const billing = await getDashboardBillingGateState();
    expect(billing.accessAllowed).toBe(true);
    expect(mockLinkCareerMaps).toHaveBeenCalledTimes(1);
  });

  test("dashboard load without a profile does not try to link", async () => {
    mockRuntimeGetBillingAccessState.mockResolvedValue({ subscription: null, status: "none", accessAllowed: false, profile: null });
    await getDashboardBillingGateState();
    expect(mockLinkCareerMaps).not.toHaveBeenCalled();
  });

  test("onboarding claim links maps using the request's map cookie", async () => {
    mockRuntimeClaimOnboardingSession.mockResolvedValue({
      session: { id: SESSION_ID },
      user: { id: "profile_1", handle: "maya", name: "Maya" },
      migrated: false,
    });
    const response = await claimPost(
      new MockNextRequest("https://example.com/api/onboarding/claim", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: `${CAREER_MAP_COOKIE_NAME}=tok_req` },
        body: JSON.stringify({ sessionId: SESSION_ID }),
      }) as never,
    );
    expect(response.status).toBe(200);
    expect(mockLinkCareerMaps).toHaveBeenCalledWith({ learnerProfileId: "profile_1", email: "maya@example.com", cookieToken: "tok_req" });
  });

  test("onboarding claim still succeeds when map linking fails", async () => {
    mockRuntimeClaimOnboardingSession.mockResolvedValue({
      session: { id: SESSION_ID },
      user: { id: "profile_1", handle: "maya", name: "Maya" },
      migrated: false,
    });
    mockLinkCareerMaps.mockRejectedValue(new Error("unexpected"));
    const response = await claimPost(
      new MockNextRequest("https://example.com/api/onboarding/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: SESSION_ID }),
      }) as never,
    );
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(mockLinkCareerMaps).toHaveBeenCalledWith({ learnerProfileId: "profile_1", email: "maya@example.com", cookieToken: null });
  });

  test("onboarding complete links maps beside the assessment link, failure-isolated", () => {
    const source = readFileSync(path.resolve(process.cwd(), "apps/web/app/api/onboarding/complete/route.ts"), "utf8");
    const assessmentIndex = source.indexOf("await linkAnonymousAssessmentsToProfile(");
    const mapIndex = source.indexOf("await linkCareerMapsForLearner(");
    expect(assessmentIndex).toBeGreaterThan(-1);
    expect(mapIndex).toBeGreaterThan(assessmentIndex);
    // Inside its own try/catch, using the claimed profile and the request cookie.
    const block = source.slice(source.lastIndexOf("try {", mapIndex), source.indexOf("}", source.indexOf("catch (error)", mapIndex)));
    expect(block).toContain("learnerProfileId: claimResult.user.id");
    expect(block).toContain("readCareerMapCookieFromRequest(req)");
    expect(block).toContain("console.warn");
  });
});
