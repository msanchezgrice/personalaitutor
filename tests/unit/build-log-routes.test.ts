import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { EXAMPLE_CAREER_MAP } from "@aitutor/shared";

const { mockGetAuthSeed, mockGetUserId, mockRequireBillingAccess, mockGetLatestCareerMap } = vi.hoisted(() => ({
  mockGetAuthSeed: vi.fn(),
  mockGetUserId: vi.fn(),
  mockRequireBillingAccess: vi.fn(),
  mockGetLatestCareerMap: vi.fn(),
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
vi.mock("@/lib/api", () => ({ getUserId: mockGetUserId }));
vi.mock("@/lib/billing-access", () => ({
  requireBillingAccess: mockRequireBillingAccess,
  billingSeedFromAuthSeed: (seed: unknown) => seed ?? undefined,
}));
vi.mock("@/lib/career-map/store", () => ({ getLatestCareerMapForProfile: mockGetLatestCareerMap }));
vi.mock("@/lib/proof/site-store", () => ({ getProofSite: vi.fn(async () => null) }));

import { GET as listGet, POST as listPost } from "../../apps/web/app/api/build-log/route";
import { DELETE as idDelete, GET as idGet, PATCH as idPatch } from "../../apps/web/app/api/build-log/[id]/route";
import { POST as publishPost } from "../../apps/web/app/api/build-log/[id]/publish/route";
import { POST as draftPost, maxDuration } from "../../apps/web/app/api/build-log/draft/route";
import { resetBuildLogStateForTests } from "../../apps/web/lib/build-log/store";

const ALICE = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", handle: "alice-builds", name: "Alice Doe", published: true };
const BOB = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", handle: "bob-builds", name: "Bob Roe", published: false };
const BODY = "I built a workflow that turns our launch brief into a checklist. It kept skipping one step.";

function signIn(profile: typeof ALICE | null, accessAllowed = true) {
  if (!profile) {
    mockGetAuthSeed.mockResolvedValue(null);
    mockGetUserId.mockReturnValue(null);
    return;
  }
  mockGetAuthSeed.mockResolvedValue({ userId: `clerk_${profile.handle}` });
  mockRequireBillingAccess.mockResolvedValue(
    accessAllowed
      ? { ok: true, billing: { profile, accessAllowed: true, status: "active" } }
      : {
          ok: false,
          billing: { profile, accessAllowed: false, status: "canceled" },
          response: Response.json({ ok: false, error: { code: "SUBSCRIPTION_REQUIRED" } }, { status: 402 }),
        },
  );
}

const req = (url: string, method = "GET", body?: unknown) =>
  new MockNextRequest(`http://localhost${url}`, {
    method,
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    headers: body === undefined ? undefined : { "content-type": "application/json" },
  }) as never;
const params = <T extends Record<string, string>>(value: T) => ({ params: Promise.resolve(value) });

async function createPost(title = "My first workflow", bodyMarkdown = BODY) {
  const response = await listPost(req("/api/build-log", "POST", { title, summary: "A short summary of it.", bodyMarkdown }));
  const json = await response.json();
  expect(response.status).toBe(200);
  return json.post as { id: string; slug: string; path: string; status: string };
}

beforeEach(() => {
  resetBuildLogStateForTests();
  vi.clearAllMocks();
  mockGetLatestCareerMap.mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("build log routes: gating", () => {
  test("signed out -> 401 on every route", async () => {
    signIn(null);
    const responses = await Promise.all([
      listGet(req("/api/build-log")),
      listPost(req("/api/build-log", "POST", { title: "x" })),
      idGet(req("/api/build-log/x"), params({ id: "x" })),
      idPatch(req("/api/build-log/x", "PATCH", { title: "x" }), params({ id: "x" })),
      idDelete(req("/api/build-log/x", "DELETE"), params({ id: "x" })),
      publishPost(req("/api/build-log/x/publish", "POST", { published: true }), params({ id: "x" })),
      draftPost(req("/api/build-log/draft", "POST", { notes: "x".repeat(60) })),
    ]);
    for (const response of responses) expect(response.status).toBe(401);
    expect(mockRequireBillingAccess).not.toHaveBeenCalled();
  });

  test("no Career Builder access -> 402 on every route", async () => {
    signIn(ALICE, false);
    const responses = await Promise.all([
      listGet(req("/api/build-log")),
      listPost(req("/api/build-log", "POST", { title: "x" })),
      idGet(req("/api/build-log/x"), params({ id: "x" })),
      publishPost(req("/api/build-log/x/publish", "POST", { published: true }), params({ id: "x" })),
      draftPost(req("/api/build-log/draft", "POST", { notes: "x".repeat(60) })),
    ]);
    for (const response of responses) expect(response.status).toBe(402);
  });

  test("the draft route allows long LLM calls", () => {
    expect(maxDuration).toBe(120);
  });
});

describe("build log routes: CRUD and publish", () => {
  test("create, list, read, patch, publish, unpublish, delete", async () => {
    signIn(ALICE);
    const post = await createPost();
    expect(post.slug).toBe("my-first-workflow");
    expect(post.path).toBe("/u/alice-builds/log/my-first-workflow");
    expect(post.status).toBe("draft");

    const list = await (await listGet(req("/api/build-log"))).json();
    expect(list.ok).toBe(true);
    expect(list.posts).toHaveLength(1);
    expect(list.profile).toEqual({ handle: "alice-builds", name: "Alice Doe", published: true });
    expect(list.suggestion).toBeNull();

    const read = await (await idGet(req(`/api/build-log/${post.id}`), params({ id: post.id }))).json();
    expect(read.post.id).toBe(post.id);

    const patched = await (await idPatch(req(`/api/build-log/${post.id}`, "PATCH", { title: "Renamed workflow" }), params({ id: post.id }))).json();
    expect(patched.post.title).toBe("Renamed workflow");
    expect(patched.post.slug).toBe("renamed-workflow");

    const published = await publishPost(req(`/api/build-log/${post.id}/publish`, "POST", { published: true }), params({ id: post.id }));
    const publishedJson = await published.json();
    expect(published.status).toBe(200);
    expect(publishedJson.post.status).toBe("published");
    expect(publishedJson.live).toBe(true);
    expect(publishedJson.publicUrl).toBe("/u/alice-builds/log/renamed-workflow");

    const afterRename = await (await idPatch(req(`/api/build-log/${post.id}`, "PATCH", { title: "Third title" }), params({ id: post.id }))).json();
    expect(afterRename.post.slug).toBe("renamed-workflow");

    const unpublished = await (await publishPost(req(`/api/build-log/${post.id}/publish`, "POST", { published: false }), params({ id: post.id }))).json();
    expect(unpublished.post.status).toBe("draft");

    const deleted = await idDelete(req(`/api/build-log/${post.id}`, "DELETE"), params({ id: post.id }));
    expect((await deleted.json()).deleted).toBe(true);
    const gone = await idGet(req(`/api/build-log/${post.id}`), params({ id: post.id }));
    expect(gone.status).toBe(404);
  });

  test("publishing on an unpublished profile is allowed but not live", async () => {
    signIn(BOB);
    const post = await createPost();
    const json = await (await publishPost(req(`/api/build-log/${post.id}/publish`, "POST", { published: true }), params({ id: post.id }))).json();
    expect(json.post.status).toBe("published");
    expect(json.profilePublished).toBe(false);
    expect(json.live).toBe(false);
  });

  test("a thin post cannot be published", async () => {
    signIn(ALICE);
    const post = await createPost("Tiny post", "Too short.");
    const response = await publishPost(req(`/api/build-log/${post.id}/publish`, "POST", { published: true }), params({ id: post.id }));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("BUILD_LOG_NOT_READY");
  });

  test("invalid bodies -> 400 INVALID_BODY", async () => {
    signIn(ALICE);
    const post = await createPost();
    const cases = await Promise.all([
      listPost(req("/api/build-log", "POST", { title: "" })),
      listPost(req("/api/build-log", "POST", "{not json")),
      listPost(req("/api/build-log", "POST", { title: "ok", bodyMarkdown: "x".repeat(12001) })),
      idPatch(req(`/api/build-log/${post.id}`, "PATCH", {}), params({ id: post.id })),
      publishPost(req(`/api/build-log/${post.id}/publish`, "POST", { published: "yes" }), params({ id: post.id })),
      draftPost(req("/api/build-log/draft", "POST", { notes: "short" })),
    ]);
    for (const response of cases) {
      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe("INVALID_BODY");
    }
  });

  test("returns the first-post suggestion from the career map", async () => {
    signIn(ALICE);
    mockGetLatestCareerMap.mockResolvedValue({ status: "completed", map: EXAMPLE_CAREER_MAP });
    const json = await (await listGet(req("/api/build-log"))).json();
    expect(json.suggestion).toEqual({
      title: EXAMPLE_CAREER_MAP.proofPlan.buildLog.firstPostTitle,
      summary: EXAMPLE_CAREER_MAP.proofPlan.buildLog.summary,
      newTitle: "Go-to-Market Engineer",
    });
  });

  test("a map store failure does not break the list", async () => {
    signIn(ALICE);
    mockGetLatestCareerMap.mockRejectedValue(new Error("FOUNDATION_SEED_NOT_IMPLEMENTED"));
    const response = await listGet(req("/api/build-log"));
    expect(response.status).toBe(200);
    expect((await response.json()).suggestion).toBeNull();
  });
});

describe("build log routes: owner checks", () => {
  test("another learner gets 404 on every [id] route and changes nothing", async () => {
    signIn(ALICE);
    const post = await createPost();
    signIn(BOB);
    const responses = await Promise.all([
      idGet(req(`/api/build-log/${post.id}`), params({ id: post.id })),
      idPatch(req(`/api/build-log/${post.id}`, "PATCH", { title: "Hijacked" }), params({ id: post.id })),
      publishPost(req(`/api/build-log/${post.id}/publish`, "POST", { published: true }), params({ id: post.id })),
      idDelete(req(`/api/build-log/${post.id}`, "DELETE"), params({ id: post.id })),
    ]);
    for (const response of responses) {
      expect(response.status).toBe(404);
      expect((await response.json()).error.code).toBe("BUILD_LOG_POST_NOT_FOUND");
    }
    const bobList = await (await listGet(req("/api/build-log"))).json();
    expect(bobList.posts).toEqual([]);

    signIn(ALICE);
    const still = await (await idGet(req(`/api/build-log/${post.id}`), params({ id: post.id }))).json();
    expect(still.post.title).toBe("My first workflow");
    expect(still.post.status).toBe("draft");
  });
});

describe("build log routes: draft from notes", () => {
  const NOTES = "- built a checklist workflow from our launch brief\n- used ChatGPT and a Google Sheet\n- it skipped the localisation step\n- next: add a review step";
  const GOOD = {
    title: "I turned our launch brief into a checklist workflow",
    summary: "A small checklist workflow built from our launch brief, and the step it skipped.",
    bodyMarkdown:
      "I built a checklist workflow from our launch brief.\n\n## How I built it\nI used ChatGPT and a Google Sheet.\n\n## What broke\nIt skipped the localisation step.\n\n## Next\nAdd a review step.",
  };

  test("returns a draft and saves nothing", async () => {
    signIn(ALICE);
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ output_text: JSON.stringify(GOOD) }), text: async () => "" }),
    );
    const response = await draftPost(req("/api/build-log/draft", "POST", { notes: NOTES }));
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.draft).toEqual(GOOD);
    const list = await (await listGet(req("/api/build-log"))).json();
    expect(list.posts).toEqual([]);
  });

  test("missing key -> 502 OPENAI_CONFIG_MISSING", async () => {
    signIn(ALICE);
    vi.stubEnv("OPENAI_API_KEY", "");
    const response = await draftPost(req("/api/build-log/draft", "POST", { notes: NOTES }));
    expect(response.status).toBe(502);
    const json = await response.json();
    expect(json.error.code).toBe("OPENAI_CONFIG_MISSING");
    expect(json.error.recoveryAction).toBeTruthy();
  });

  test("invalid model output -> 502 BUILD_LOG_DRAFT_FAILED, no placeholder", async () => {
    signIn(ALICE);
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ output_text: "nope" }), text: async () => "" }),
    );
    const response = await draftPost(req("/api/build-log/draft", "POST", { notes: NOTES }));
    expect(response.status).toBe(502);
    const json = await response.json();
    expect(json.error.code).toBe("BUILD_LOG_DRAFT_FAILED");
    expect(json.error.reason).toBe("BUILD_LOG_INVALID_OUTPUT:NOT_JSON");
    expect(json.draft).toBeUndefined();
  });
});
