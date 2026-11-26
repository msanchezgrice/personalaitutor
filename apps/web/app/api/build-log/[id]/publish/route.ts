import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@aitutor/shared";
import { buildLogFailure, buildLogPostPath, resolveBuildLogAccess } from "@/lib/build-log/access";
import { buildLogPublishBodySchema, readJsonBody } from "@/lib/build-log/schemas";
import { setBuildLogPostPublished } from "@/lib/build-log/store";

/**
 * Publish or unpublish one post. A published post is only visible to the
 * public once the learner's profile is published too; `profilePublished`
 * tells the editor which message to show.
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await resolveBuildLogAccess(req);
    if (!access.ok) return access.response;
    const { id } = await context.params;
    const parsed = buildLogPublishBodySchema.safeParse(await readJsonBody(req));
    if (!parsed.success) {
      return jsonError("INVALID_BODY", "Send { published: true | false }.", 400, { issues: parsed.error.issues });
    }
    let post;
    try {
      post = await setBuildLogPostPublished({ id, learnerProfileId: access.profile.id, published: parsed.data.published });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "";
      if (reason.startsWith("BUILD_LOG_NOT_READY:")) {
        return jsonError("BUILD_LOG_NOT_READY", reason.slice("BUILD_LOG_NOT_READY:".length), 400);
      }
      throw error;
    }
    if (!post) return jsonError("BUILD_LOG_POST_NOT_FOUND", "Post not found", 404);
    const path = buildLogPostPath(access.profile.handle, post.slug);
    return jsonOk({
      post: { ...post, path },
      publicUrl: path,
      profilePublished: access.profile.published,
      live: post.status === "published" && access.profile.published,
    });
  } catch (error) {
    return buildLogFailure(error);
  }
}
