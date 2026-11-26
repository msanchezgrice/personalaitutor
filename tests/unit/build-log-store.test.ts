import { beforeEach, describe, expect, test } from "vitest";
import {
  createBuildLogPost,
  deleteBuildLogPost,
  findBuildLogPostBySlug,
  findPublishedBuildLogPost,
  getBuildLogPostForOwner,
  getBuildLogStatus,
  listBuildLogPosts,
  listPublishedBuildLogPosts,
  resetBuildLogStateForTests,
  setBuildLogPostPublished,
  updateBuildLogPost,
} from "../../apps/web/lib/build-log/store";
import { isValidBuildLogSlug, slugifyBuildLogTitle, uniqueBuildLogSlug, BUILD_LOG_SLUG_MAX } from "../../apps/web/lib/build-log/slug";

const LEARNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const BODY = "I built a small workflow that turns our launch brief into a checklist. It broke twice.";

describe("build log slug rules", () => {
  test("derives a clean slug from the title", () => {
    expect(slugifyBuildLogTitle("I turned our launch checklist into one agent workflow")).toBe(
      "i-turned-our-launch-checklist-into-one-agent-workflow",
    );
    expect(slugifyBuildLogTitle("  24 emails later, the model stopped saying “exciting”!  ")).toBe(
      "24-emails-later-the-model-stopped-saying-exciting",
    );
    expect(slugifyBuildLogTitle("My studio closed. Here's the map I'm following")).toBe("my-studio-closed-heres-the-map-im-following");
    expect(slugifyBuildLogTitle("Café & crème brûlée")).toBe("cafe-and-creme-brulee");
  });

  test("falls back to 'post' when nothing usable is left", () => {
    expect(slugifyBuildLogTitle("!!!")).toBe("post");
    expect(slugifyBuildLogTitle("日本語")).toBe("post");
  });

  test("caps length at a word boundary", () => {
    const slug = slugifyBuildLogTitle("word ".repeat(60));
    expect(slug.length).toBeLessThanOrEqual(BUILD_LOG_SLUG_MAX);
    expect(slug.endsWith("-")).toBe(false);
    expect(isValidBuildLogSlug(slug)).toBe(true);
  });

  test("adds a numeric suffix on clashes", () => {
    expect(uniqueBuildLogSlug("hello", [])).toBe("hello");
    expect(uniqueBuildLogSlug("hello", ["hello"])).toBe("hello-2");
    expect(uniqueBuildLogSlug("hello", ["hello", "hello-2"])).toBe("hello-3");
  });

  test("validates slugs strictly", () => {
    expect(isValidBuildLogSlug("ok-slug-2")).toBe(true);
    expect(isValidBuildLogSlug("Bad")).toBe(false);
    expect(isValidBuildLogSlug("../etc")).toBe(false);
    expect(isValidBuildLogSlug("a--b")).toBe(false);
    expect(isValidBuildLogSlug("")).toBe(false);
  });
});

describe("build log store (memory mode)", () => {
  beforeEach(() => {
    resetBuildLogStateForTests();
  });

  test("creates drafts with unique slugs per learner", async () => {
    const first = await createBuildLogPost({ learnerProfileId: LEARNER, title: "My first agent", bodyMarkdown: BODY });
    const second = await createBuildLogPost({ learnerProfileId: LEARNER, title: "My first agent" });
    const otherLearner = await createBuildLogPost({ learnerProfileId: OTHER, title: "My first agent" });
    expect(first.slug).toBe("my-first-agent");
    expect(second.slug).toBe("my-first-agent-2");
    expect(otherLearner.slug).toBe("my-first-agent");
    expect(first.status).toBe("draft");
    expect(first.publishedAt).toBeNull();
    const list = await listBuildLogPosts(LEARNER);
    expect(list.map((post) => post.id)).toEqual([second.id, first.id]);
  });

  test("rejects an empty title", async () => {
    await expect(createBuildLogPost({ learnerProfileId: LEARNER, title: "   " })).rejects.toThrow("BUILD_LOG_TITLE_REQUIRED");
  });

  test("re-derives the slug while a draft, freezes it after the first publish", async () => {
    const post = await createBuildLogPost({ learnerProfileId: LEARNER, title: "Working title", bodyMarkdown: BODY });
    const renamed = await updateBuildLogPost({ id: post.id, learnerProfileId: LEARNER, patch: { title: "Better title" } });
    expect(renamed?.slug).toBe("better-title");

    const published = await setBuildLogPostPublished({ id: post.id, learnerProfileId: LEARNER, published: true });
    expect(published?.status).toBe("published");
    const firstPublishedAt = published?.publishedAt;
    expect(firstPublishedAt).toBeTruthy();

    const renamedAgain = await updateBuildLogPost({ id: post.id, learnerProfileId: LEARNER, patch: { title: "Final title" } });
    expect(renamedAgain?.title).toBe("Final title");
    expect(renamedAgain?.slug).toBe("better-title");

    // Unpublish + republish keeps the slug and the first publish date.
    await setBuildLogPostPublished({ id: post.id, learnerProfileId: LEARNER, published: false });
    const unpublished = await getBuildLogPostForOwner({ id: post.id, learnerProfileId: LEARNER });
    expect(unpublished?.status).toBe("draft");
    expect(unpublished?.slug).toBe("better-title");
    const republished = await setBuildLogPostPublished({ id: post.id, learnerProfileId: LEARNER, published: true });
    expect(republished?.publishedAt).toBe(firstPublishedAt);
    expect(republished?.slug).toBe("better-title");
  });

  test("a renamed draft avoids the slug of another post", async () => {
    await createBuildLogPost({ learnerProfileId: LEARNER, title: "Taken" });
    const post = await createBuildLogPost({ learnerProfileId: LEARNER, title: "Something" });
    const renamed = await updateBuildLogPost({ id: post.id, learnerProfileId: LEARNER, patch: { title: "Taken" } });
    expect(renamed?.slug).toBe("taken-2");
  });

  test("refuses to publish a thin post", async () => {
    const post = await createBuildLogPost({ learnerProfileId: LEARNER, title: "Hello there", bodyMarkdown: "Too short." });
    await expect(setBuildLogPostPublished({ id: post.id, learnerProfileId: LEARNER, published: true })).rejects.toThrow(
      /^BUILD_LOG_NOT_READY:/,
    );
  });

  test("owner checks: another learner can't read, edit, publish or delete", async () => {
    const post = await createBuildLogPost({ learnerProfileId: LEARNER, title: "Mine", bodyMarkdown: BODY });
    expect(await getBuildLogPostForOwner({ id: post.id, learnerProfileId: OTHER })).toBeNull();
    expect(await updateBuildLogPost({ id: post.id, learnerProfileId: OTHER, patch: { title: "Hijacked" } })).toBeNull();
    expect(await setBuildLogPostPublished({ id: post.id, learnerProfileId: OTHER, published: true })).toBeNull();
    expect(await deleteBuildLogPost({ id: post.id, learnerProfileId: OTHER })).toBe(false);
    const still = await getBuildLogPostForOwner({ id: post.id, learnerProfileId: LEARNER });
    expect(still?.title).toBe("Mine");
    expect(still?.status).toBe("draft");
  });

  test("published list is newest first, public shape only", async () => {
    const a = await createBuildLogPost({ learnerProfileId: LEARNER, title: "Post A", bodyMarkdown: BODY });
    const b = await createBuildLogPost({ learnerProfileId: LEARNER, title: "Post B", bodyMarkdown: BODY });
    await createBuildLogPost({ learnerProfileId: LEARNER, title: "Draft C", bodyMarkdown: BODY });
    await setBuildLogPostPublished({ id: b.id, learnerProfileId: LEARNER, published: true });
    await setBuildLogPostPublished({ id: a.id, learnerProfileId: LEARNER, published: true });
    const list = await listPublishedBuildLogPosts(LEARNER);
    expect(list.map((post) => post.title)).toEqual(["Post A", "Post B"]);
    expect(Object.keys(list[0]).sort()).toEqual(["bodyMarkdown", "publishedAt", "slug", "summary", "title"]);
    expect(await findPublishedBuildLogPost({ learnerProfileId: LEARNER, slug: "draft-c" })).toBeNull();
    expect((await findBuildLogPostBySlug({ learnerProfileId: LEARNER, slug: "draft-c" }))?.status).toBe("draft");
    expect(await findPublishedBuildLogPost({ learnerProfileId: OTHER, slug: "post-a" })).toBeNull();
  });

  test("status for the Proof Studio hub", async () => {
    expect(await getBuildLogStatus(LEARNER)).toEqual({ state: "empty", summary: "Write your first post" });
    const a = await createBuildLogPost({ learnerProfileId: LEARNER, title: "Post A", bodyMarkdown: BODY });
    expect(await getBuildLogStatus(LEARNER)).toEqual({ state: "draft", summary: "1 draft, nothing published yet" });
    const b = await createBuildLogPost({ learnerProfileId: LEARNER, title: "Post B", bodyMarkdown: BODY });
    await setBuildLogPostPublished({ id: a.id, learnerProfileId: LEARNER, published: true });
    expect(await getBuildLogStatus(LEARNER)).toEqual({ state: "live", summary: "1 post published" });
    await setBuildLogPostPublished({ id: b.id, learnerProfileId: LEARNER, published: true });
    expect(await getBuildLogStatus(LEARNER)).toEqual({ state: "live", summary: "2 posts published" });
  });

  test("delete removes the post", async () => {
    const post = await createBuildLogPost({ learnerProfileId: LEARNER, title: "Gone soon" });
    expect(await deleteBuildLogPost({ id: post.id, learnerProfileId: LEARNER })).toBe(true);
    expect(await listBuildLogPosts(LEARNER)).toEqual([]);
    expect(await deleteBuildLogPost({ id: post.id, learnerProfileId: LEARNER })).toBe(false);
  });

  test("trims and caps fields", async () => {
    const post = await createBuildLogPost({
      learnerProfileId: LEARNER,
      title: `  ${"t".repeat(300)}  `,
      summary: `line one\n\nline two ${"s".repeat(400)}`,
      bodyMarkdown: "  \r\nbody\r\n  ",
    });
    expect(post.title.length).toBe(120);
    expect(post.summary.startsWith("line one line two")).toBe(true);
    expect(post.summary.length).toBe(240);
    expect(post.bodyMarkdown).toBe("body");
  });
});
