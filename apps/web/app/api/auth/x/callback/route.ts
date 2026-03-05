import { runtimeConnectOAuth, runtimeMarkOAuthFailure } from "@/lib/runtime";
import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { verifyOAuthStateToken } from "@/lib/oauth-state";

function resolveRedirectUri(req: NextRequest) {
  const fallback = `${req.nextUrl.origin}/api/auth/x/callback`;
  const appBase = process.env.APP_BASE_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  const configured = process.env.X_REDIRECT_URI;
  if (!configured || !configured.trim()) {
    if (appBase) {
      try {
        return new URL("/api/auth/x/callback", appBase).toString();
      } catch {
        // Fall back to request origin below.
      }
    }
    return fallback;
  }
  try {
    return new URL(configured.trim()).toString();
  } catch {
    if (appBase) {
      try {
        return new URL("/api/auth/x/callback", appBase).toString();
      } catch {
        // Fall back to request origin below.
      }
    }
    return fallback;
  }
}

export async function GET(req: NextRequest) {
  const clearPkceCookie = (response: NextResponse) => {
    response.cookies.set({
      name: "x_oauth_pkce_verifier",
      value: "",
      path: "/api/auth/x/callback",
      maxAge: 0,
    });
    return response;
  };

  const oauthError = (
    code: string,
    message: string,
    status: number,
    details?: Record<string, unknown>,
  ) =>
    clearPkceCookie(NextResponse.json(
      {
        ok: false,
        error: {
          code,
          message,
          details: details ?? {},
        },
      },
      {
        status,
        headers: {
          "cache-control": "no-store, max-age=0, must-revalidate",
          pragma: "no-cache",
          expires: "0",
        },
      },
    ));

  const error = req.nextUrl.searchParams.get("error");
  const state = verifyOAuthStateToken<{
    userId?: string;
    redirect?: boolean;
    mock?: boolean;
  }>(req.nextUrl.searchParams.get("state"), "x");
  const shouldRedirect = req.nextUrl.searchParams.get("redirect") === "1" || Boolean(state?.data.redirect);

  if (!state) {
    if (shouldRedirect) {
      return clearPkceCookie(NextResponse.redirect(new URL("/dashboard/social?oauth=x_denied", req.nextUrl.origin)));
    }
    return oauthError("X_OAUTH_STATE_INVALID", "X callback state is invalid or expired", 400);
  }

  const authUserId = await getAuthUserId(req);
  const userId = authUserId ?? (typeof state.data.userId === "string" ? state.data.userId : null);

  if (!userId) {
    if (shouldRedirect) {
      return clearPkceCookie(NextResponse.redirect(new URL("/dashboard/social?oauth=x_denied", req.nextUrl.origin)));
    }
    return oauthError("UNAUTHENTICATED", "Sign in required", 401);
  }

  if (error) {
    await runtimeMarkOAuthFailure(userId, "x", "X_OAUTH_DENIED");
    if (shouldRedirect) {
      return clearPkceCookie(NextResponse.redirect(new URL("/dashboard/social?oauth=x_denied", req.nextUrl.origin)));
    }
    return oauthError("X_OAUTH_DENIED", "X OAuth was denied", 401);
  }

  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    await runtimeMarkOAuthFailure(userId, "x", "X_OAUTH_CODE_MISSING");
    return oauthError("X_OAUTH_CODE_MISSING", "X callback missing authorization code", 400);
  }

  if (!state.data.mock) {
    const clientId = process.env.X_CLIENT_ID;
    const clientSecret = process.env.X_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      await runtimeMarkOAuthFailure(userId, "x", "X_OAUTH_CONFIG_MISSING");
      return oauthError("X_OAUTH_CONFIG_MISSING", "X OAuth is not configured", 503, {
        missing: [
          !clientId ? "X_CLIENT_ID" : null,
          !clientSecret ? "X_CLIENT_SECRET" : null,
        ].filter(Boolean),
      });
    }

    const codeVerifier = req.cookies.get("x_oauth_pkce_verifier")?.value?.trim();
    if (!codeVerifier) {
      await runtimeMarkOAuthFailure(userId, "x", "X_PKCE_VERIFIER_MISSING");
      return oauthError("X_PKCE_VERIFIER_MISSING", "X OAuth verifier cookie missing or expired", 400);
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
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      await runtimeMarkOAuthFailure(userId, "x", "X_TOKEN_EXCHANGE_FAILED");
      return oauthError("X_TOKEN_EXCHANGE_FAILED", "X token exchange failed", 502, {
        response: text.slice(0, 300),
      });
    }
  }

  const connection = await runtimeConnectOAuth(userId, "x", "X Account");

  if (shouldRedirect) {
    return clearPkceCookie(NextResponse.redirect(new URL("/dashboard/social?oauth=x_connected", req.nextUrl.origin)));
  }

  const response = NextResponse.json({ ok: true, status: "connected", connection }, {
    headers: {
      "cache-control": "no-store, max-age=0, must-revalidate",
      pragma: "no-cache",
      expires: "0",
    },
  });
  return clearPkceCookie(response);
}
