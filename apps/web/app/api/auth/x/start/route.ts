import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@aitutor/shared";
import { missingEnv } from "@/lib/api";
import { getAuthUserId } from "@/lib/auth";
import { createPkceVerifier, issueOAuthStateToken, pkceChallengeS256 } from "@/lib/oauth-state";

const required = ["X_CLIENT_ID"];

function allowMockOAuth() {
  const explicit = process.env.ALLOW_MOCK_OAUTH?.trim().toLowerCase();
  if (explicit === "1" || explicit === "true") return true;
  if (explicit === "0" || explicit === "false") return false;
  return process.env.NODE_ENV !== "production";
}

function resolveRedirectUri(req: NextRequest, configured: string | undefined, fallbackPath: string) {
  const fallback = `${req.nextUrl.origin}${fallbackPath}`;
  const appBase = process.env.APP_BASE_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configured || !configured.trim()) {
    if (appBase) {
      try {
        return new URL(fallbackPath, appBase).toString();
      } catch {
        // Fall back to request origin below.
      }
    }
    return fallback;
  }
  try {
    const parsed = new URL(configured.trim());
    return parsed.toString();
  } catch {
    if (appBase) {
      try {
        return new URL(fallbackPath, appBase).toString();
      } catch {
        // Fall back to request origin below.
      }
    }
    return fallback;
  }
}

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) {
    return jsonError("UNAUTHENTICATED", "Sign in required", 401);
  }
  const mockRequested = req.nextUrl.searchParams.get("mock") === "1";
  const mock = mockRequested && allowMockOAuth();
  if (mockRequested && !mock) {
    return jsonError("MOCK_OAUTH_DISABLED", "Mock OAuth is disabled", 403);
  }
  const redirect = req.nextUrl.searchParams.get("redirect") === "1";
  const stateToken = issueOAuthStateToken({
    provider: "x",
    data: {
      userId,
      redirect,
      mock,
    },
  });

  if (!mock) {
    const missing = missingEnv(required);
    if (missing.length) {
      return jsonError("X_OAUTH_CONFIG_MISSING", "X OAuth is not configured", 503, { missing });
    }

    const clientId = process.env.X_CLIENT_ID as string;
    const redirectUri = resolveRedirectUri(req, process.env.X_REDIRECT_URI, "/api/auth/x/callback");
    const codeVerifier = createPkceVerifier();
    const codeChallenge = pkceChallengeS256(codeVerifier);

    const authorizeUrl = new URL("https://twitter.com/i/oauth2/authorize");
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("client_id", clientId);
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("scope", "tweet.read users.read tweet.write offline.access");
    authorizeUrl.searchParams.set("state", stateToken);
    authorizeUrl.searchParams.set("code_challenge", codeChallenge);
    authorizeUrl.searchParams.set("code_challenge_method", "S256");

    const response = NextResponse.redirect(authorizeUrl);
    response.cookies.set({
      name: "x_oauth_pkce_verifier",
      value: codeVerifier,
      httpOnly: true,
      secure: req.nextUrl.protocol === "https:",
      sameSite: "lax",
      path: "/api/auth/x/callback",
      maxAge: 60 * 10,
    });
    return response;
  }

  const callback = new URL("/api/auth/x/callback", req.nextUrl.origin);
  callback.searchParams.set("code", "mock_x_code");
  callback.searchParams.set("state", stateToken);
  if (redirect) {
    callback.searchParams.set("redirect", "1");
  }
  return NextResponse.redirect(callback);
}
