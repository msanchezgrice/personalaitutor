import { jsonError, jsonOk, runtimeConnectOAuth, runtimeMarkOAuthFailure } from "@/lib/runtime";
import { NextRequest, NextResponse } from "next/server";

function parseState(state: string | null) {
  if (!state) return null;
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    return JSON.parse(decoded) as { userId?: string; redirect?: boolean };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const error = req.nextUrl.searchParams.get("error");
  const state = parseState(req.nextUrl.searchParams.get("state"));
  const userId = state?.userId ?? "00000000-0000-0000-0000-000000000001";

  if (error) {
    await runtimeMarkOAuthFailure(userId, "linkedin_profile", "LINKEDIN_OAUTH_DENIED");
    if (req.nextUrl.searchParams.get("redirect") === "1" || state?.redirect) {
      return NextResponse.redirect(new URL("/dashboard/social?oauth=linkedin_denied", req.nextUrl.origin));
    }
    return jsonError("LINKEDIN_OAUTH_DENIED", "LinkedIn OAuth was denied", 401);
  }

  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    await runtimeMarkOAuthFailure(userId, "linkedin_profile", "LINKEDIN_OAUTH_CODE_MISSING");
    return jsonError("LINKEDIN_OAUTH_CODE_MISSING", "LinkedIn callback missing authorization code", 400);
  }

  const profileConnection = await runtimeConnectOAuth(userId, "linkedin_profile", "LinkedIn Profile");
  const postConnection = await runtimeConnectOAuth(userId, "linkedin", "LinkedIn Posting");

  if (req.nextUrl.searchParams.get("redirect") === "1" || state?.redirect) {
    return NextResponse.redirect(new URL("/dashboard/social?oauth=linkedin_connected", req.nextUrl.origin));
  }

  return jsonOk({
    status: "connected",
    profileConnection,
    postConnection,
  });
}
