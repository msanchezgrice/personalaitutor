import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@aitutor/shared";
import { missingEnv } from "@/lib/api";
import { getAuthUserId } from "@/lib/auth";
import { runtimeFindOnboardingSession } from "@/lib/runtime";
import { issueOAuthStateToken } from "@/lib/oauth-state";

const required = ["LINKEDIN_CLIENT_ID"];

function allowMockOAuth() {
  const explicit = process.env.ALLOW_MOCK_OAUTH?.trim().toLowerCase();
  if (explicit === "1" || explicit === "true") return true;
  if (explicit === "0" || explicit === "false") return false;
  return process.env.NODE_ENV !== "production";
}

function sanitizeRedirectPath(path: string | null) {
  if (!path || !path.trim()) return null;
  const value = path.trim();
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  if (value.length > 400) return null;
  return value;
}

function resolveRedirectUri(req: NextRequest, configured: string | undefined, fallbackPath: string) {
  const fallback = `${req.nextUrl.origin}${fallbackPath}`;
  if (!configured || !configured.trim()) return fallback;
  try {
    return new URL(configured.trim()).toString();
  } catch {
    return fallback;
  }
}

export async function GET(req: NextRequest) {
  let userId = await getAuthUserId(req);
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!userId && sessionId) {
    const session = await runtimeFindOnboardingSession(sessionId);
    userId = session?.userId ?? null;
  }
  if (!userId) {
    return jsonError("UNAUTHENTICATED", "Sign in required", 401, {
      sessionIdProvided: Boolean(sessionId),
    });
  }
  const mockRequested = req.nextUrl.searchParams.get("mock") === "1";
  const mock = mockRequested && allowMockOAuth();
  if (mockRequested && !mock) {
    return jsonError("MOCK_OAUTH_DISABLED", "Mock OAuth is disabled", 403);
  }
  const redirect = req.nextUrl.searchParams.get("redirect") === "1";
  const redirectPath = sanitizeRedirectPath(req.nextUrl.searchParams.get("redirectPath"));
  const stateToken = issueOAuthStateToken({
    provider: "linkedin",
    data: {
      userId,
      redirect,
      redirectPath: redirectPath ?? null,
      mock,
    },
  });

  if (!mock) {
    const missing = missingEnv(required);
    if (missing.length) {
      return jsonError("LINKEDIN_OAUTH_CONFIG_MISSING", "LinkedIn OAuth is not configured", 503, { missing });
    }

    const clientId = process.env.LINKEDIN_CLIENT_ID as string;
    const redirectUri = resolveRedirectUri(req, process.env.LINKEDIN_REDIRECT_URI, "/api/auth/linkedin/callback");
    const scope = process.env.LINKEDIN_OAUTH_SCOPE?.trim() || "r_liteprofile r_emailaddress w_member_social";

    const authorizeUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("client_id", clientId);
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("scope", scope);
    authorizeUrl.searchParams.set("state", stateToken);

    return NextResponse.redirect(authorizeUrl);
  }

  const callback = new URL("/api/auth/linkedin/callback", req.nextUrl.origin);
  callback.searchParams.set("code", "mock_linkedin_code");
  callback.searchParams.set("state", stateToken);
  if (redirect) {
    callback.searchParams.set("redirect", "1");
  }
  return NextResponse.redirect(callback);
}
