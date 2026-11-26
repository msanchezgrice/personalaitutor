import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@aitutor/shared";
import { buildLogFailure, buildLogPostPath, resolveBuildLogAccess } from "@/lib/build-log/access";
import { getBuildLogMapContext } from "@/lib/build-log/context";
import { buildLogCreateBodySchema, readJsonBody } from "@/lib/build-log/schemas";
import { createBuildLogPost, listBuildLogPosts } from "@/lib/build-log/store";

/** The learner's posts (drafts and published), their profile state and the first-post suggestion from their map. */
export async function GET(req: NextRequest) {
  try {
    const access = await resolveBuildLogAccess(req);
    if (!access.ok) return access.response;
    const { profile } = access;
    const [posts, context] = await Promise.all([listBuildLogPosts(profile.id), getBuildLogMapContext(profile.id)]);
    return jsonOk({
      posts: posts.map((post) => ({ ...post, path: buildLogPostPath(profile.handle, post.slug) })),
      profile: { handle: profile.handle, name: profile.name, published: profile.published },
      suggestion: context?.firstPostTitle
        ? { title: context.firstPostTitle, summary: context.firstPostSummary, newTitle: context.newTitle }
        : null,
    });
  } catch (error) {
    return buildLogFailure(error);
  }
}

/** Creates a draft post. */
export async function POST(req: NextRequest) {
  try {
    const access = await resolveBuildLogAccess(req);
    if (!access.ok) return access.response;
    const parsed = buildLogCreateBodySchema.safeParse(await readJsonBody(req));
    if (!parsed.success) {
      return jsonError("INVALID_BODY", "Check the title, summary and body.", 400, { issues: parsed.error.issues });
    }
    const post = await createBuildLogPost({ learnerProfileId: access.profile.id, ...parsed.data });
    return jsonOk({ post: { ...post, path: buildLogPostPath(access.profile.handle, post.slug) } });
  } catch (error) {
    return buildLogFailure(error);
  }
}
