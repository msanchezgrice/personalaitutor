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
    await runtimeMarkOAuthFailure(userId, "x", "X_OAUTH_DENIED");
    if (req.nextUrl.searchParams.get("redirect") === "1" || state?.redirect) {
      return NextResponse.redirect(new URL("/dashboard/social?oauth=x_denied", req.nextUrl.origin));
    }
    return jsonError("X_OAUTH_DENIED", "X OAuth was denied", 401);
  }

  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    await runtimeMarkOAuthFailure(userId, "x", "X_OAUTH_CODE_MISSING");
    return jsonError("X_OAUTH_CODE_MISSING", "X callback missing authorization code", 400);
  }

  const connection = await runtimeConnectOAuth(userId, "x", "X Account");

  if (req.nextUrl.searchParams.get("redirect") === "1" || state?.redirect) {
    return NextResponse.redirect(new URL("/dashboard/social?oauth=x_connected", req.nextUrl.origin));
  }

  return jsonOk({ status: "connected", connection });
}
