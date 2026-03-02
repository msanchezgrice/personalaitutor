import { generateProjectOgSvg, jsonError, runtimeFindProjectBySlug, runtimeFindUserByHandle } from "@/lib/runtime";

export async function GET(_req: Request, context: { params: Promise<{ handle: string; projectSlug: string }> }) {
  const { handle, projectSlug } = await context.params;
  const profile = await runtimeFindUserByHandle(handle);
  if (!profile) {
    return jsonError("PROFILE_NOT_FOUND", "Profile not found", 404);
  }

  const project = await runtimeFindProjectBySlug(projectSlug);
  if (!project || project.userId !== profile.id) {
    return jsonError("PROJECT_NOT_FOUND", "Project not found", 404);
  }

  const svg = generateProjectOgSvg({
    title: project.title,
    handle,
    projectSlug,
    state: project.state,
  });

  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
