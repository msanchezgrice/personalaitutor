import { jsonError, jsonOk, runtimePublishProfile } from "@/lib/runtime";
import { NextRequest } from "next/server";
import { getUserId } from "@/lib/api";

export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) {
    return jsonError("UNAUTHENTICATED", "Sign in required", 401);
  }
  const profile = await runtimePublishProfile(userId);
  if (!profile) {
    return jsonError("USER_NOT_FOUND", "Cannot publish profile for unknown user", 404);
  }

  return jsonOk({ profile, publicUrl: `/u/${profile.handle}` });
}
