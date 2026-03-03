import { jsonError, jsonOk, runtimeConnectOAuth, runtimeMarkOAuthFailure } from "@/lib/runtime";
import { NextRequest, NextResponse } from "next/server";

function parseState(state: string | null) {
  if (!state) return null;
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    return JSON.parse(decoded) as { userId?: string; redirect?: boolean; mock?: boolean };
  } catch {
    return null;
  }
}

function resolveRedirectUri(req: NextRequest) {
  const fallback = `${req.nextUrl.origin}/api/auth/x/callback`;
  const configured = process.env.X_REDIRECT_URI;
  if (!configured) return fallback;
  try {
    return new URL(configured).toString();
  } catch {
    return fallback;
  }
}

export async function GET(req: NextRequest) {
  const error = req.nextUrl.searchParams.get("error");
  const state = parseState(req.nextUrl.searchParams.get("state"));
  const userId = req.headers.get("x-user-id") ?? state?.userId ?? "00000000-0000-0000-0000-000000000001";
  const shouldRedirect = req.nextUrl.searchParams.get("redirect") === "1" || state?.redirect;

  if (error) {
    await runtimeMarkOAuthFailure(userId, "x", "X_OAUTH_DENIED");
    if (shouldRedirect) {
      return NextResponse.redirect(new URL("/dashboard/social?oauth=x_denied", req.nextUrl.origin));
    }
    return jsonError("X_OAUTH_DENIED", "X OAuth was denied", 401);
  }

  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    await runtimeMarkOAuthFailure(userId, "x", "X_OAUTH_CODE_MISSING");
    return jsonError("X_OAUTH_CODE_MISSING", "X callback missing authorization code", 400);
  }

  if (!state?.mock) {
    const clientId = process.env.X_CLIENT_ID;
    const clientSecret = process.env.X_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      await runtimeMarkOAuthFailure(userId, "x", "X_OAUTH_CONFIG_MISSING");
      return jsonError("X_OAUTH_CONFIG_MISSING", "X OAuth is not configured", 503, {
        missing: [
          !clientId ? "X_CLIENT_ID" : null,
          !clientSecret ? "X_CLIENT_SECRET" : null,
        ].filter(Boolean),
      });
    }

    const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: "authorization_code",
        client_id: clientId,
        redirect_uri: resolveRedirectUri(req),
        code_verifier: "challenge",
      }),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      await runtimeMarkOAuthFailure(userId, "x", "X_TOKEN_EXCHANGE_FAILED");
      return jsonError("X_TOKEN_EXCHANGE_FAILED", "X token exchange failed", 502, {
        response: text.slice(0, 300),
      });
    }
  }

  const connection = await runtimeConnectOAuth(userId, "x", "X Account");

  if (shouldRedirect) {
    return NextResponse.redirect(new URL("/dashboard/social?oauth=x_connected", req.nextUrl.origin));
  }

  return jsonOk({ status: "connected", connection });
}
