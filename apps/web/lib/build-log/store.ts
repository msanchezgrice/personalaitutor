import "server-only";

import { randomUUID } from "node:crypto";
import type { BuildLogPost, BuildLogPostPublic, BuildLogPostStatus, ProofPieceStatus } from "@aitutor/shared";
import { BUILD_LOG_BODY_MAX, BUILD_LOG_TITLE_MAX } from "@aitutor/shared";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { slugifyBuildLogTitle, uniqueBuildLogSlug } from "@/lib/build-log/slug";
import {
  BUILD_LOG_MAX_POSTS_PER_LEARNER,
  BUILD_LOG_PUBLISH_MIN_BODY_CHARS,
  BUILD_LOG_SUMMARY_MAX,
} from "@/lib/build-log/limits";

/**
 * Build log posts: short public posts about what the learner built.
 * Dual mode (memory | supabase) like lib/anonymous-assessment.ts.
 * Table: public.build_log_posts (migration 20261126030000). Not to be confused
 * with the older, unrelated public.build_log_entries (project job logs).
 *
 * Slugs come from the title, are unique per learner, and freeze once the post
 * has been published for the first time (`publishedAt` set). `publishedAt` is
 * the first publish date and survives unpublish/republish.
 */

export { BUILD_LOG_MAX_POSTS_PER_LEARNER, BUILD_LOG_SUMMARY_MAX };

const TABLE = "build_log_posts";
const SELECT_FIELDS =
  "id, learner_profile_id, slug, title, summary, body_markdown, status, published_at, created_at, updated_at";

type BuildLogPostRow = {
  id: string;
  learner_profile_id: string;
  slug: string;
  title: string;
  summary: string | null;
  body_markdown: string | null;
  status: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BuildLogPostInput = {
  title: string;
  summary?: string;
  bodyMarkdown?: string;
};

type PersistenceMode = "memory" | "supabase";

function mode(): PersistenceMode {
  const explicit = process.env.PERSISTENCE_MODE?.toLowerCase();
  if (explicit === "supabase" || explicit === "memory") return explicit;
  if (explicit) {
    throw new Error("PERSISTENCE_MODE_INVALID");
  }
  const hasSupabaseCreds = Boolean(
    (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY),
  );
  if (hasSupabaseCreds) return "supabase";
  throw new Error("PERSISTENCE_MODE_REQUIRED");
}

function fromRow(row: BuildLogPostRow): BuildLogPost {
  return {
    id: row.id,
    learnerProfileId: row.learner_profile_id,
    slug: row.slug,
    title: row.title,
    summary: row.summary ?? "",
    bodyMarkdown: row.body_markdown ?? "",
    status: row.status === "published" ? "published" : "draft",
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toBuildLogPostPublic(post: BuildLogPost): BuildLogPostPublic {
  return {
    slug: post.slug,
    title: post.title,
    summary: post.summary,
    bodyMarkdown: post.bodyMarkdown,
    publishedAt: post.publishedAt,
  };
}

function cleanTitle(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, BUILD_LOG_TITLE_MAX);
}

function cleanSummary(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, BUILD_LOG_SUMMARY_MAX);
}

function cleanBody(value: string | undefined): string {
  return (value ?? "").replace(/\r\n?/g, "\n").trim().slice(0, BUILD_LOG_BODY_MAX);
}

function byCreatedDesc(a: BuildLogPost, b: BuildLogPost) {
  return b.createdAt.localeCompare(a.createdAt);
}

function byPublishedDesc(a: BuildLogPost, b: BuildLogPost) {
  return (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "") || byCreatedDesc(a, b);
}

/** Can the post still change slug? Only until it has been published once. */
function slugIsFrozen(post: Pick<BuildLogPost, "publishedAt">) {
  return Boolean(post.publishedAt);
}

/** Publishing needs a real title and a body; the summary is optional. */
export function buildLogPublishProblem(post: Pick<BuildLogPost, "title" | "bodyMarkdown">): string | null {
  if (post.title.trim().length < 3) return "Add a title before you publish.";
  if (post.bodyMarkdown.trim().length < BUILD_LOG_PUBLISH_MIN_BODY_CHARS) return "Write a little more before you publish (at least a few sentences).";
  return null;
}

// --- memory mode -----------------------------------------------------------

const memoryPosts = new Map<string, BuildLogPost>();
let memoryClock = 0;

/** Strictly increasing timestamps so ordering is stable inside one millisecond. */
function nowIso() {
  const now = Math.max(Date.now(), memoryClock + 1);
  memoryClock = now;
  return new Date(now).toISOString();
}

export function resetBuildLogStateForTests(): void {
  memoryPosts.clear();
  memoryClock = 0;
}

function memoryPostsFor(learnerProfileId: string) {
  return [...memoryPosts.values()].filter((post) => post.learnerProfileId === learnerProfileId);
}

// --- supabase helpers ------------------------------------------------------

async function supabaseTakenSlugs(learnerProfileId: string, exceptId?: string): Promise<string[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from(TABLE).select("id, slug").eq("learner_profile_id", learnerProfileId);
  if (error) throw new Error(`BUILD_LOG_READ_FAILED:${error.message}`);
  return ((data ?? []) as Array<{ id: string; slug: string }>).filter((row) => row.id !== exceptId).map((row) => row.slug);
}

function isUniqueViolation(error: { code?: string; message?: string } | null) {
  return Boolean(error && (error.code === "23505" || /duplicate key/i.test(error.message ?? "")));
}

// --- reads -----------------------------------------------------------------

/** All posts for the learner (drafts and published), newest first. */
export async function listBuildLogPosts(learnerProfileId: string): Promise<BuildLogPost[]> {
  if (mode() === "memory") {
    return memoryPostsFor(learnerProfileId).sort(byCreatedDesc).map((post) => ({ ...post }));
  }
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select(SELECT_FIELDS)
    .eq("learner_profile_id", learnerProfileId)
    .order("created_at", { ascending: false })
    .limit(BUILD_LOG_MAX_POSTS_PER_LEARNER);
  if (error) throw new Error(`BUILD_LOG_READ_FAILED:${error.message}`);
  return ((data ?? []) as BuildLogPostRow[]).map(fromRow);
}

/** Published posts, newest first, in the public shape. */
export async function listPublishedBuildLogPosts(learnerProfileId: string): Promise<BuildLogPostPublic[]> {
  if (mode() === "memory") {
    return memoryPostsFor(learnerProfileId)
      .filter((post) => post.status === "published")
      .sort(byPublishedDesc)
      .map(toBuildLogPostPublic);
  }
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select(SELECT_FIELDS)
    .eq("learner_profile_id", learnerProfileId)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(BUILD_LOG_MAX_POSTS_PER_LEARNER);
  if (error) throw new Error(`BUILD_LOG_READ_FAILED:${error.message}`);
  return ((data ?? []) as BuildLogPostRow[]).map(fromRow).sort(byPublishedDesc).map(toBuildLogPostPublic);
}

/** One post, only if it belongs to `learnerProfileId`. The owner check for every [id] route. */
export async function getBuildLogPostForOwner(input: { id: string; learnerProfileId: string }): Promise<BuildLogPost | null> {
  if (mode() === "memory") {
    const post = memoryPosts.get(input.id);
    return post && post.learnerProfileId === input.learnerProfileId ? { ...post } : null;
  }
  if (!/^[0-9a-f-]{36}$/i.test(input.id)) return null;
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select(SELECT_FIELDS)
    .eq("id", input.id)
    .eq("learner_profile_id", input.learnerProfileId)
    .maybeSingle();
  if (error) throw new Error(`BUILD_LOG_READ_FAILED:${error.message}`);
  return data ? fromRow(data as BuildLogPostRow) : null;
}

/** A post by slug for one learner, any status. Callers decide who may see drafts. */
export async function findBuildLogPostBySlug(input: { learnerProfileId: string; slug: string }): Promise<BuildLogPost | null> {
  if (mode() === "memory") {
    const post = memoryPostsFor(input.learnerProfileId).find((entry) => entry.slug === input.slug);
    return post ? { ...post } : null;
  }
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select(SELECT_FIELDS)
    .eq("learner_profile_id", input.learnerProfileId)
    .eq("slug", input.slug)
    .maybeSingle();
  if (error) throw new Error(`BUILD_LOG_READ_FAILED:${error.message}`);
  return data ? fromRow(data as BuildLogPostRow) : null;
}

/** A published post by slug, or null. */
export async function findPublishedBuildLogPost(input: { learnerProfileId: string; slug: string }): Promise<BuildLogPost | null> {
  const post = await findBuildLogPostBySlug(input);
  return post && post.status === "published" ? post : null;
}

export async function getBuildLogStatus(learnerProfileId: string): Promise<ProofPieceStatus> {
  const posts = await listBuildLogPosts(learnerProfileId);
  const published = posts.filter((post) => post.status === "published").length;
  const drafts = posts.length - published;
  if (published > 0) {
    return { state: "live", summary: `${published} ${published === 1 ? "post" : "posts"} published` };
  }
  if (drafts > 0) {
    return { state: "draft", summary: `${drafts} ${drafts === 1 ? "draft" : "drafts"}, nothing published yet` };
  }
  return { state: "empty", summary: "Write your first post" };
}

// --- writes ----------------------------------------------------------------

export async function createBuildLogPost(input: { learnerProfileId: string } & BuildLogPostInput): Promise<BuildLogPost> {
  const title = cleanTitle(input.title);
  if (!title) throw new Error("BUILD_LOG_TITLE_REQUIRED");
  const summary = cleanSummary(input.summary);
  const bodyMarkdown = cleanBody(input.bodyMarkdown);
  const base = slugifyBuildLogTitle(title);

  if (mode() === "memory") {
    const existing = memoryPostsFor(input.learnerProfileId);
    if (existing.length >= BUILD_LOG_MAX_POSTS_PER_LEARNER) throw new Error("BUILD_LOG_LIMIT_REACHED");
    const now = nowIso();
    const post: BuildLogPost = {
      id: randomUUID(),
      learnerProfileId: input.learnerProfileId,
      slug: uniqueBuildLogSlug(base, existing.map((entry) => entry.slug)),
      title,
      summary,
      bodyMarkdown,
      status: "draft",
      publishedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    memoryPosts.set(post.id, post);
    return { ...post };
  }

  const supabase = getSupabaseAdminClient();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const taken = await supabaseTakenSlugs(input.learnerProfileId);
    if (taken.length >= BUILD_LOG_MAX_POSTS_PER_LEARNER) throw new Error("BUILD_LOG_LIMIT_REACHED");
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        learner_profile_id: input.learnerProfileId,
        slug: uniqueBuildLogSlug(base, taken),
        title,
        summary,
        body_markdown: bodyMarkdown,
        status: "draft",
        created_at: now,
        updated_at: now,
      })
      .select(SELECT_FIELDS)
      .single();
    if (isUniqueViolation(error)) continue;
    if (error || !data) throw new Error(`BUILD_LOG_CREATE_FAILED:${error?.message ?? "NO_ROW"}`);
    return fromRow(data as BuildLogPostRow);
  }
  throw new Error("BUILD_LOG_CREATE_FAILED:SLUG_CONFLICT");
}

/** Edits title/summary/body. Returns null when the post is not this learner's. */
export async function updateBuildLogPost(input: {
  id: string;
  learnerProfileId: string;
  patch: Partial<BuildLogPostInput>;
}): Promise<BuildLogPost | null> {
  const current = await getBuildLogPostForOwner({ id: input.id, learnerProfileId: input.learnerProfileId });
  if (!current) return null;

  const title = input.patch.title !== undefined ? cleanTitle(input.patch.title) : current.title;
  if (!title) throw new Error("BUILD_LOG_TITLE_REQUIRED");
  const summary = input.patch.summary !== undefined ? cleanSummary(input.patch.summary) : current.summary;
  const bodyMarkdown = input.patch.bodyMarkdown !== undefined ? cleanBody(input.patch.bodyMarkdown) : current.bodyMarkdown;
  const reslug = !slugIsFrozen(current) && title !== current.title;

  if (mode() === "memory") {
    const slug = reslug
      ? uniqueBuildLogSlug(
          slugifyBuildLogTitle(title),
          memoryPostsFor(input.learnerProfileId)
            .filter((entry) => entry.id !== current.id)
            .map((entry) => entry.slug),
        )
      : current.slug;
    const next: BuildLogPost = { ...current, title, summary, bodyMarkdown, slug, updatedAt: nowIso() };
    memoryPosts.set(next.id, next);
    return { ...next };
  }

  const supabase = getSupabaseAdminClient();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const slug = reslug
      ? uniqueBuildLogSlug(slugifyBuildLogTitle(title), await supabaseTakenSlugs(input.learnerProfileId, current.id))
      : current.slug;
    const { data, error } = await supabase
      .from(TABLE)
      .update({ title, summary, body_markdown: bodyMarkdown, slug, updated_at: new Date().toISOString() })
      .eq("id", current.id)
      .eq("learner_profile_id", input.learnerProfileId)
      .select(SELECT_FIELDS)
      .maybeSingle();
    if (isUniqueViolation(error) && reslug) continue;
    if (error) throw new Error(`BUILD_LOG_UPDATE_FAILED:${error.message}`);
    return data ? fromRow(data as BuildLogPostRow) : null;
  }
  throw new Error("BUILD_LOG_UPDATE_FAILED:SLUG_CONFLICT");
}

/**
 * Publish or unpublish. The first publish stamps `publishedAt` and freezes the
 * slug. Throws BUILD_LOG_NOT_READY:<message> when the post is too thin to publish.
 */
export async function setBuildLogPostPublished(input: {
  id: string;
  learnerProfileId: string;
  published: boolean;
}): Promise<BuildLogPost | null> {
  const current = await getBuildLogPostForOwner({ id: input.id, learnerProfileId: input.learnerProfileId });
  if (!current) return null;
  if (input.published) {
    const problem = buildLogPublishProblem(current);
    if (problem) throw new Error(`BUILD_LOG_NOT_READY:${problem}`);
  }
  const status: BuildLogPostStatus = input.published ? "published" : "draft";

  if (mode() === "memory") {
    const now = nowIso();
    const next: BuildLogPost = {
      ...current,
      status,
      publishedAt: input.published ? current.publishedAt ?? now : current.publishedAt,
      updatedAt: now,
    };
    memoryPosts.set(next.id, next);
    return { ...next };
  }

  const now = new Date().toISOString();
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      status,
      published_at: input.published ? current.publishedAt ?? now : current.publishedAt,
      updated_at: now,
    })
    .eq("id", current.id)
    .eq("learner_profile_id", input.learnerProfileId)
    .select(SELECT_FIELDS)
    .maybeSingle();
  if (error) throw new Error(`BUILD_LOG_UPDATE_FAILED:${error.message}`);
  return data ? fromRow(data as BuildLogPostRow) : null;
}

/** Deletes the post. Returns false when it is not this learner's (or already gone). */
export async function deleteBuildLogPost(input: { id: string; learnerProfileId: string }): Promise<boolean> {
  const current = await getBuildLogPostForOwner(input);
  if (!current) return false;
  if (mode() === "memory") {
    return memoryPosts.delete(current.id);
  }
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from(TABLE).delete().eq("id", current.id).eq("learner_profile_id", input.learnerProfileId);
  if (error) throw new Error(`BUILD_LOG_DELETE_FAILED:${error.message}`);
  return true;
}
