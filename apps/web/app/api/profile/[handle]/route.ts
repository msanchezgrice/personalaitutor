import { jsonError, jsonOk, runtimeFindUserByHandle } from "@/lib/runtime";

export async function GET(_req: Request, context: { params: Promise<{ handle: string }> }) {
  const { handle } = await context.params;
  const profile = await runtimeFindUserByHandle(handle);
  if (!profile) {
    return jsonError("PROFILE_NOT_FOUND", "Profile was not found", 404);
  }

  if (!profile.published) {
    return jsonError("PROFILE_NOT_PUBLISHED", "Profile is private and not published", 403, {
      recoveryAction: "Publish profile from dashboard before requesting public endpoint",
    });
  }

  return jsonOk({ profile });
}
