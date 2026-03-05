import { generateProfileOgSvg, jsonError, runtimeFindUserByHandle } from "@/lib/runtime";

export async function GET(_req: Request, context: { params: Promise<{ handle: string }> }) {
  const { handle } = await context.params;
  const profile = await runtimeFindUserByHandle(handle);

  if (!profile || !profile.published) {
    return jsonError("PROFILE_NOT_FOUND", "Profile not found", 404);
  }

  const svg = generateProfileOgSvg({
    name: profile.name,
    handle: profile.handle,
    headline: profile.headline,
    status: "Platform Verified",
  });

  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
