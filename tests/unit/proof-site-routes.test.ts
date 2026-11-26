import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  EXAMPLE_CAREER_MAP,
  findUserById,
  resetStateForTests,
  upsertBillingSubscription,
  upsertUserProfile,
  type CareerMapRecord,
} from "@aitutor/shared";

/**
 * Proof site API: auth, billing gate, validation, handle rules, profile sync,
 * draft hard-failure contract and unpublish. Real memory-mode stores; auth,
 * the career map store (workstream A) and the LLM are mocked.
 */

const mocks = vi.hoisted(() => ({
  getAuthSeed: vi.fn(),
  getLatestCareerMapForProfile: vi.fn(),
  draftProofSite: vi.fn(),
}));

class MockNextRequest extends Request {
  nextUrl: URL;
  constructor(input: string, init?: RequestInit) {
    super(input, init);
    this.nextUrl = new URL(input);
  }
}

vi.mock("next/server", () => ({ NextRequest: MockNextRequest }), { virtual: true });
vi.mock("@/lib/auth", () => ({ getAuthSeed: mocks.getAuthSeed }));
vi.mock("@/lib/career-map/store", () => ({ getLatestCareerMapForProfile: mocks.getLatestCareerMapForProfile }));
vi.mock("@/lib/proof/site-draft", () => ({ draftProofSite: mocks.draftProofSite }));

import { GET, PUT } from "@/app/api/proof/site/route";
import { POST as DRAFT } from "@/app/api/proof/site/draft/route";
import { POST as UNPUBLISH } from "@/app/api/proof/site/unpublish/route";
import { POST as PUBLISH } from "@/app/api/profile/publish/route";
import { getProofSite, resetProofSiteStateForTests } from "@/lib/proof/site-store";

const USER_ID = "user_proof_site_1";

function mapRecord(overrides: Partial<CareerMapRecord> = {}): CareerMapRecord {
  return {
    id: "map-record-1",
    token: "tok_example_123456789012345",
    status: "completed",
    source: "paste",
    inputText: "résumé text",
    map: EXAMPLE_CAREER_MAP,
    model: "test-model",
    failureReason: null,
    email: null,
    emailCapturedAt: null,
    mapEmailSentAt: null,
    learnerProfileId: USER_ID,
    linkedAt: "2026-11-24T00:00:00.000Z",
    visitorId: null,
    ipHash: null,
    createdAt: "2026-11-24T00:00:00.000Z",
    updatedAt: "2026-11-24T00:00:00.000Z",
    ...overrides,
  };
}

function seedUser(options: { billing?: "active" | "none"; published?: boolean } = {}) {
  upsertUserProfile({
    id: USER_ID,
    handle: "proof-site-learner",
    name: "Pat Rivera",
    headline: "AI Builder",
    bio: "Building practical AI workflows and sharing public proof of execution.",
    published: options.published ?? false,
    skills: [],
    socialLinks: {},
  });
  if (options.billing !== "none") {
    upsertBillingSubscription({
      userId: USER_ID,
      stripeCustomerId: "cus_ps",
      stripeSubscriptionId: "sub_ps",
      stripePriceId: "price_ps",
      status: "active",
      trialEndsAt: null,
      currentPeriodEndsAt: null,
      cancelAtPeriodEnd: false,
    });
  }
}

function request(method: string, body?: unknown, path = "/api/proof/site") {
  return new MockNextRequest(`http://localhost${path}`, {
    method,
    headers: { "content-type": "application/json", "x-user-id": USER_ID },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  }) as never;
}

const VALID_BODY = {
  handle: "pat-rivera",
  newTitle: "Go-to-Market Engineer",
  previousRole: "Senior Marketing Manager at a game studio, 2018 to 2025",
  tagline: "I turn launch plans into AI workflows.",
  bio: "Seven years of launches, lifecycle email and community work, now built as AI workflows.",
  translations: [
    { before: "Planned 4 global game launches", now: "Builds AI launch workflows" },
    { before: "Wrote player emails to 12M players", now: "Writes brand-voice prompts" },
  ],
  contactEmail: "Pat@Example.com",
  linkedinUrl: "linkedin.com/in/pat-rivera",
};

beforeEach(() => {
  resetStateForTests();
  resetProofSiteStateForTests();
  mocks.getAuthSeed.mockReset();
  mocks.getAuthSeed.mockResolvedValue({ userId: USER_ID });
  mocks.getLatestCareerMapForProfile.mockReset();
  mocks.getLatestCareerMapForProfile.mockResolvedValue(null);
  mocks.draftProofSite.mockReset();
});

describe("auth and billing gate", () => {
  test("signed out is 401", async () => {
    mocks.getAuthSeed.mockResolvedValue(null);
    const response = await GET(new MockNextRequest("http://localhost/api/proof/site") as never);
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHENTICATED");
  });

  test("no active plan is 402 on GET, PUT and draft", async () => {
    seedUser({ billing: "none" });
    for (const response of [await GET(request("GET")), await PUT(request("PUT", VALID_BODY)), await DRAFT(request("POST", {}, "/api/proof/site/draft"))]) {
      expect(response.status).toBe(402);
      expect((await response.json()).error.code).toBe("SUBSCRIPTION_REQUIRED");
    }
  });
});

describe("GET /api/proof/site", () => {
  test("returns site null, profile basics and the latest map view without private fields", async () => {
    seedUser();
    mocks.getLatestCareerMapForProfile.mockResolvedValue(mapRecord());
    const response = await GET(request("GET"));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(json.site).toBeNull();
    expect(json.profile).toEqual({ handle: "proof-site-learner", name: "Pat Rivera", published: false });
    expect(json.map.token).toBe("tok_example_123456789012345");
    expect(json.map.map.primary.titleId).toBe("gtm-engineer");
    expect(json.map).not.toHaveProperty("inputText");
    expect(json.map).not.toHaveProperty("email");
    expect(mocks.getLatestCareerMapForProfile).toHaveBeenCalledWith(USER_ID);
  });

  test("a map that is not completed counts as no map", async () => {
    seedUser();
    mocks.getLatestCareerMapForProfile.mockResolvedValue(mapRecord({ status: "failed", map: null }));
    const json = await (await GET(request("GET"))).json();
    expect(json.map).toBeNull();
  });
});

describe("PUT /api/proof/site", () => {
  test("saves the site and syncs handle, headline, bio and LinkedIn onto the profile", async () => {
    seedUser();
    mocks.getLatestCareerMapForProfile.mockResolvedValue(mapRecord());
    const response = await PUT(request("PUT", VALID_BODY));
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.publicUrl).toBe("/u/pat-rivera");
    expect(json.site).toMatchObject({
      learnerProfileId: USER_ID,
      careerMapId: "map-record-1",
      newTitle: "Go-to-Market Engineer",
      contactEmail: "pat@example.com",
      linkedinUrl: "https://linkedin.com/in/pat-rivera",
    });
    const profile = findUserById(USER_ID);
    expect(profile?.handle).toBe("pat-rivera");
    expect(profile?.headline).toBe("Go-to-Market Engineer");
    expect(profile?.bio).toBe(VALID_BODY.bio);
    expect(profile?.socialLinks.linkedin).toBe("https://linkedin.com/in/pat-rivera");
    expect((await getProofSite(USER_ID))?.tagline).toBe(VALID_BODY.tagline);
  });

  test("invalid bodies are 400 with issues", async () => {
    seedUser();
    const response = await PUT(request("PUT", { ...VALID_BODY, bio: "short", translations: [] }));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error.code).toBe("INVALID_BODY");
    expect(json.error.issues.length).toBeGreaterThan(0);
    expect((await PUT(request("PUT", "not json"))).status).toBe(400);
  });

  test("a non-LinkedIn address is rejected", async () => {
    seedUser();
    const response = await PUT(request("PUT", { ...VALID_BODY, linkedinUrl: "https://evil.example.com/in/pat" }));
    expect(response.status).toBe(400);
    expect((await response.json()).error.field).toBe("linkedinUrl");
  });

  test("a handle held by someone else is 409 HANDLE_TAKEN and nothing is saved", async () => {
    seedUser();
    upsertUserProfile({ id: "someone-else", handle: "pat-rivera", name: "Other Pat", published: true, skills: [], socialLinks: {} });
    const response = await PUT(request("PUT", VALID_BODY));
    expect(response.status).toBe(409);
    const json = await response.json();
    expect(json.error.code).toBe("HANDLE_TAKEN");
    expect(json.error.field).toBe("handle");
    expect(json.error.message).toContain("/u/pat-rivera");
    expect(await getProofSite(USER_ID)).toBeNull();
    expect(findUserById(USER_ID)?.handle).toBe("proof-site-learner");
  });

  test("example handles are reserved and malformed handles are 400", async () => {
    seedUser();
    for (const handle of ["maya-ortiz", "alex-chen-ai"]) {
      const response = await PUT(request("PUT", { ...VALID_BODY, handle }));
      expect(response.status).toBe(409);
    }
    const bad = await PUT(request("PUT", { ...VALID_BODY, handle: "Pat Rivera!" }));
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toMatchObject({ code: "HANDLE_INVALID", field: "handle" });
    expect((await PUT(request("PUT", { ...VALID_BODY, handle: "ab" }))).status).toBe(400);
  });

  test("keeping your own handle is fine and a second save keeps the linked map", async () => {
    seedUser();
    mocks.getLatestCareerMapForProfile.mockResolvedValue(mapRecord());
    await PUT(request("PUT", { ...VALID_BODY, handle: "proof-site-learner" }));
    mocks.getLatestCareerMapForProfile.mockResolvedValue(mapRecord({ id: "map-record-2" }));
    const response = await PUT(request("PUT", { ...VALID_BODY, handle: "proof-site-learner", contactEmail: "", linkedinUrl: "" }));
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.site.careerMapId).toBe("map-record-1");
    expect(json.site.contactEmail).toBeNull();
    expect(json.site.linkedinUrl).toBeNull();
    expect(findUserById(USER_ID)?.socialLinks.linkedin).toBeUndefined();
  });
});

describe("POST /api/proof/site/draft", () => {
  test("409 when the learner has no career map", async () => {
    seedUser();
    const response = await DRAFT(request("POST", {}, "/api/proof/site/draft"));
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("CAREER_MAP_MISSING");
    expect(mocks.draftProofSite).not.toHaveBeenCalled();
  });

  test("returns the draft without saving anything", async () => {
    seedUser();
    mocks.getLatestCareerMapForProfile.mockResolvedValue(mapRecord());
    const draft = { tagline: "I turn launch plans into AI workflows.", bio: "x".repeat(60), translations: VALID_BODY.translations };
    mocks.draftProofSite.mockResolvedValue({ draft, model: "gpt-test", newTitle: "Go-to-Market Engineer", previousRole: "Senior Marketing Manager" });
    const response = await DRAFT(request("POST", {}, "/api/proof/site/draft"));
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json).toMatchObject({ draft, newTitle: "Go-to-Market Engineer", previousRole: "Senior Marketing Manager", careerMapId: "map-record-1" });
    expect(mocks.draftProofSite).toHaveBeenCalledWith({ map: EXAMPLE_CAREER_MAP, profile: { name: "Pat Rivera" } });
    expect(await getProofSite(USER_ID)).toBeNull();
  });

  test("LLM failure is a 502 with reason and recovery, never content", async () => {
    seedUser();
    mocks.getLatestCareerMapForProfile.mockResolvedValue(mapRecord());
    mocks.draftProofSite.mockRejectedValue(new Error("PROOF_SITE_DRAFT_INVALID_OUTPUT:UNGROUNDED_NUMBER"));
    const response = await DRAFT(request("POST", {}, "/api/proof/site/draft"));
    expect(response.status).toBe(502);
    const json = await response.json();
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("PROOF_SITE_DRAFT_FAILED");
    expect(json.error.reason).toContain("UNGROUNDED_NUMBER");
    expect(json.error.recoveryAction).toBeTruthy();
    expect(json).not.toHaveProperty("draft");
  });

  test("a missing key maps to OPENAI_CONFIG_MISSING", async () => {
    seedUser();
    mocks.getLatestCareerMapForProfile.mockResolvedValue(mapRecord());
    mocks.draftProofSite.mockRejectedValue(new Error("OPENAI_CONFIG_MISSING"));
    const response = await DRAFT(request("POST", {}, "/api/proof/site/draft"));
    expect(response.status).toBe(502);
    expect((await response.json()).error.code).toBe("OPENAI_CONFIG_MISSING");
  });
});

describe("publish and unpublish", () => {
  test("publish through /api/profile/publish, then unpublish takes the page down", async () => {
    seedUser();
    await PUT(request("PUT", VALID_BODY));
    const published = await PUBLISH(request("POST", {}, "/api/profile/publish"));
    expect(published.status).toBe(200);
    expect(findUserById(USER_ID)?.published).toBe(true);

    const response = await UNPUBLISH(request("POST", {}, "/api/proof/site/unpublish"));
    expect(response.status).toBe(200);
    expect((await response.json()).profile).toEqual({ handle: "pat-rivera", name: "Pat Rivera", published: false });
    expect(findUserById(USER_ID)?.published).toBe(false);
  });

  test("unpublish works without an active plan but still needs a signed-in user", async () => {
    seedUser({ billing: "none", published: true });
    const response = await UNPUBLISH(request("POST", {}, "/api/proof/site/unpublish"));
    expect(response.status).toBe(200);
    expect(findUserById(USER_ID)?.published).toBe(false);

    mocks.getAuthSeed.mockResolvedValue(null);
    const anonymous = await UNPUBLISH(new MockNextRequest("http://localhost/api/proof/site/unpublish", { method: "POST" }) as never);
    expect(anonymous.status).toBe(401);
  });
});
