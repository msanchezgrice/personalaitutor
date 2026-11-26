import { beforeEach, describe, expect, test, vi } from "vitest";
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server.node.js";

const { mockFindByHandle, mockFindById, mockGetAuthSeed, mockGetProofSite } = vi.hoisted(() => ({
  mockFindByHandle: vi.fn(),
  mockFindById: vi.fn(),
  mockGetAuthSeed: vi.fn(),
  mockGetProofSite: vi.fn(),
}));

vi.mock("@/lib/runtime", () => ({
  runtimeFindUserByHandle: mockFindByHandle,
  runtimeFindUserById: mockFindById,
}));
vi.mock("@/lib/auth", () => ({ getAuthSeed: mockGetAuthSeed }));
vi.mock("@/lib/career-map/store", () => ({ getLatestCareerMapForProfile: vi.fn(async () => null) }));
vi.mock("@/lib/proof/site-store", () => ({ getProofSite: mockGetProofSite }));

import BuildLogArticlePage, { generateMetadata } from "../../apps/web/app/u/[handle]/log/[slug]/page";
import { GET as ogGet } from "../../apps/web/app/api/og/log/[handle]/[slug]/route";
import { BuildLogSectionView, ProfileBuildLogSection } from "../../apps/web/components/proof/profile-build-log-section";
import {
  createBuildLogPost,
  resetBuildLogStateForTests,
  setBuildLogPostPublished,
} from "../../apps/web/lib/build-log/store";

/** next/navigation notFound() throws this digest. */
const NOT_FOUND = /NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/;
const PROFILE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const BODY = "I built a workflow.\n\n## What broke\n<script>alert(1)</script> and [bad](javascript:alert(1)).";

function profile(published: boolean) {
  return { id: PROFILE_ID, handle: "casey-builds", name: "Casey Park", published };
}

async function seedPosts() {
  const published = await createBuildLogPost({
    learnerProfileId: PROFILE_ID,
    title: "I turned our launch checklist into one agent workflow",
    summary: "The brief, the workflow and what broke.",
    bodyMarkdown: BODY,
  });
  await setBuildLogPostPublished({ id: published.id, learnerProfileId: PROFILE_ID, published: true });
  const draft = await createBuildLogPost({ learnerProfileId: PROFILE_ID, title: "Still a draft", bodyMarkdown: BODY });
  return { published, draft };
}

const pageProps = (slug: string, handle = "casey-builds") => ({ params: Promise.resolve({ handle, slug }) });

async function renderPage(slug: string, handle?: string) {
  const element = await BuildLogArticlePage(pageProps(slug, handle));
  return renderToStaticMarkup(element);
}

beforeEach(() => {
  resetBuildLogStateForTests();
  vi.clearAllMocks();
  mockGetAuthSeed.mockResolvedValue(null);
  mockFindById.mockResolvedValue(null);
  mockGetProofSite.mockResolvedValue({ newTitle: "Go-to-Market Engineer" });
});

describe("public article page gating", () => {
  test("published post on a published profile renders for anyone", async () => {
    mockFindByHandle.mockResolvedValue(profile(true));
    await seedPosts();
    const html = await renderPage("i-turned-our-launch-checklist-into-one-agent-workflow");
    expect(html).toContain("<h1");
    expect(html).toContain("I turned our launch checklist into one agent workflow");
    expect(html).toContain('href="/u/casey-builds"');
    expect(html).toContain("Casey Park");
    expect(html).toContain("Go-to-Market Engineer");
    expect(html).toContain("A proof page on");
    expect(html).toContain("Map your own career");
    expect(html).toContain("Casey Park wrote and published this post");
    expect(html).toContain('"@type":"BlogPosting"');
    expect(html).not.toContain("build-log-preview-banner");
    // Hostile body content is escaped, the javascript: link is dropped.
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)");
    expect(html).not.toContain('href="javascript:');
    expect(mockGetAuthSeed).not.toHaveBeenCalled();
  });

  test("a draft is 404 for the public", async () => {
    mockFindByHandle.mockResolvedValue(profile(true));
    await seedPosts();
    await expect(renderPage("still-a-draft")).rejects.toThrow(NOT_FOUND);
  });

  test("a published post on an unpublished profile is 404 for the public", async () => {
    mockFindByHandle.mockResolvedValue(profile(false));
    await seedPosts();
    await expect(renderPage("i-turned-our-launch-checklist-into-one-agent-workflow")).rejects.toThrow(NOT_FOUND);
  });

  test("another signed-in learner still gets 404 for a draft", async () => {
    mockFindByHandle.mockResolvedValue(profile(true));
    mockGetAuthSeed.mockResolvedValue({ userId: "clerk_other" });
    mockFindById.mockResolvedValue({ id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" });
    await seedPosts();
    await expect(renderPage("still-a-draft")).rejects.toThrow(NOT_FOUND);
  });

  test("the owner can preview a draft, with a banner and no JSON-LD", async () => {
    mockFindByHandle.mockResolvedValue(profile(false));
    mockGetAuthSeed.mockResolvedValue({ userId: "clerk_casey" });
    mockFindById.mockResolvedValue({ id: PROFILE_ID });
    await seedPosts();
    const html = await renderPage("still-a-draft");
    expect(html).toContain("build-log-preview-banner");
    expect(html).toContain("Preview: only you can see this.");
    expect(html).not.toContain("BlogPosting");
    const metadata = await generateMetadata(pageProps("still-a-draft"));
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  test("unknown handle, unknown slug and malformed slug are 404", async () => {
    mockFindByHandle.mockResolvedValue(null);
    await expect(renderPage("anything", "nobody")).rejects.toThrow(NOT_FOUND);
    mockFindByHandle.mockResolvedValue(profile(true));
    await expect(renderPage("missing-post")).rejects.toThrow(NOT_FOUND);
    await expect(renderPage("..%2F..%2Fetc")).rejects.toThrow(NOT_FOUND);
  });

  test("metadata: canonical, OG image route and article type", async () => {
    mockFindByHandle.mockResolvedValue(profile(true));
    await seedPosts();
    const metadata = await generateMetadata(pageProps("i-turned-our-launch-checklist-into-one-agent-workflow"));
    expect(metadata.alternates?.canonical).toBe("/u/casey-builds/log/i-turned-our-launch-checklist-into-one-agent-workflow");
    expect(metadata.description).toBe("The brief, the workflow and what broke.");
    const og = metadata.openGraph as { type?: string; images?: Array<{ url: string; width: number; height: number }> };
    expect(og.type).toBe("article");
    expect(og.images?.[0]).toMatchObject({
      url: "/api/og/log/casey-builds/i-turned-our-launch-checklist-into-one-agent-workflow",
      width: 1200,
      height: 630,
    });
    expect(metadata.robots).toBeUndefined();
  });
});

describe("OG image route gating", () => {
  const ogParams = (slug: string) => ({ params: Promise.resolve({ handle: "casey-builds", slug }) });

  test("404 for drafts and unpublished profiles", async () => {
    mockFindByHandle.mockResolvedValue(profile(true));
    await seedPosts();
    expect((await ogGet(new Request("http://localhost/x"), ogParams("still-a-draft"))).status).toBe(404);
    mockFindByHandle.mockResolvedValue(profile(false));
    expect(
      (await ogGet(new Request("http://localhost/x"), ogParams("i-turned-our-launch-checklist-into-one-agent-workflow"))).status,
    ).toBe(404);
  });
});

describe("OG image route render", () => {
  test("renders a 1200x630 PNG for a public post", async () => {
    mockFindByHandle.mockResolvedValue(profile(true));
    await seedPosts();
    const response = await ogGet(new Request("http://localhost/x"), {
      params: Promise.resolve({ handle: "casey-builds", slug: "i-turned-our-launch-checklist-into-one-agent-workflow" }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    const bytes = new Uint8Array(await response.arrayBuffer());
    // PNG IHDR width/height live at bytes 16..23.
    const view = new DataView(bytes.buffer);
    expect(view.getUint32(16)).toBe(1200);
    expect(view.getUint32(20)).toBe(630);
  }, 30_000);
});

describe("ProfileBuildLogSection", () => {
  test("returns null when there are no published posts", async () => {
    await createBuildLogPost({ learnerProfileId: PROFILE_ID, title: "Only a draft", bodyMarkdown: BODY });
    const element = await ProfileBuildLogSection({ learnerProfileId: PROFILE_ID, handle: "casey-builds", displayName: "Casey Park" });
    expect(element).toBeNull();
  });

  test("lists published posts newest first with week labels and links", () => {
    const html = renderToStaticMarkup(
      BuildLogSectionView({
        handle: "casey-builds",
        displayName: "Casey Park",
        posts: [
          { slug: "week-one", title: "My studio closed. Here is the map I'm following", publishedAt: "2026-11-02T15:00:00.000Z" },
          { slug: "week-three", title: "I turned our launch checklist into one agent workflow", publishedAt: "2026-11-16T15:00:00.000Z" },
          { slug: "week-two", title: "24 emails later", publishedAt: "2026-11-09T15:00:00.000Z" },
        ],
      })!,
    );
    expect(html).toContain("Build log");
    const order = ["week-three", "week-two", "week-one"].map((slug) => html.indexOf(`/u/casey-builds/log/${slug}`));
    expect(order.every((index) => index > -1)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(html).toContain("Week 3 · Nov 16");
    expect(html).toContain("Week 1 · Nov 2");
    expect(html).toContain("I&#x27;m following");
  });

  test("renders the real store data", async () => {
    await seedPosts();
    const element = await ProfileBuildLogSection({ learnerProfileId: PROFILE_ID, handle: "casey-builds", displayName: "Casey Park" });
    const html = renderToStaticMarkup(element!);
    expect(html).toContain("/u/casey-builds/log/i-turned-our-launch-checklist-into-one-agent-workflow");
    expect(html).not.toContain("Still a draft");
  });
});
