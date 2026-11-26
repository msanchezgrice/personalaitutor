import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@aitutor/shared";
import { buildLogFailure, buildLogPostPath, resolveBuildLogAccess } from "@/lib/build-log/access";
import { buildLogPatchBodySchema, readJsonBody } from "@/lib/build-log/schemas";
import { deleteBuildLogPost, getBuildLogPostForOwner, updateBuildLogPost } from "@/lib/build-log/store";

type Context = { params: Promise<{ id: string }> };

const notFound = () => jsonError("BUILD_LOG_POST_NOT_FOUND", "Post not found", 404);

export async function GET(req: NextRequest, context: Context) {
  try {
    const access = await resolveBuildLogAccess(req);
    if (!access.ok) return access.response;
    const { id } = await context.params;
    const post = await getBuildLogPostForOwner({ id, learnerProfileId: access.profile.id });
    if (!post) return notFound();
    return jsonOk({ post: { ...post, path: buildLogPostPath(access.profile.handle, post.slug) } });
  } catch (error) {
    return buildLogFailure(error);
  }
}

export async function PATCH(req: NextRequest, context: Context) {
  try {
    const access = await resolveBuildLogAccess(req);
    if (!access.ok) return access.response;
    const { id } = await context.params;
    const parsed = buildLogPatchBodySchema.safeParse(await readJsonBody(req));
    if (!parsed.success) {
      return jsonError("INVALID_BODY", "Check the title, summary and body.", 400, { issues: parsed.error.issues });
    }
    const post = await updateBuildLogPost({ id, learnerProfileId: access.profile.id, patch: parsed.data });
    if (!post) return notFound();
    return jsonOk({ post: { ...post, path: buildLogPostPath(access.profile.handle, post.slug) } });
  } catch (error) {
    return buildLogFailure(error);
  }
}

export async function DELETE(req: NextRequest, context: Context) {
  try {
    const access = await resolveBuildLogAccess(req);
    if (!access.ok) return access.response;
    const { id } = await context.params;
    const deleted = await deleteBuildLogPost({ id, learnerProfileId: access.profile.id });
    if (!deleted) return notFound();
    return jsonOk({ deleted: true });
  } catch (error) {
    return buildLogFailure(error);
  }
}
