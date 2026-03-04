import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@aitutor/shared";
import { getUserId, missingEnv } from "@/lib/api";
import { getAuthUserId } from "@/lib/auth";
import { runtimeFindOnboardingSession } from "@/lib/runtime";

const required = ["LINKEDIN_CLIENT_ID"];

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
  const appBase = process.env.APP_BASE_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  const appBaseUrl = appBase
    ? (() => {
      try {
        return new URL(appBase);
      } catch {
        return null;
      }
    })()
    : null;

  const fromAppBase = appBaseUrl ? new URL(fallbackPath, appBaseUrl).toString() : null;

  if (!configured || !configured.trim()) {
    return fromAppBase ?? fallback;
  }

  try {
    const parsed = new URL(configured.trim());
    // If a stale host is configured, prefer canonical APP_BASE_URL for prod consistency.
    if (appBaseUrl && parsed.host !== appBaseUrl.host) {
      return fromAppBase ?? fallback;
    }
    return parsed.toString();
  } catch {
    return fromAppBase ?? fallback;
  }
}

export async function GET(req: NextRequest) {
  let userId = (await getAuthUserId(req)) ?? getUserId(req) ?? req.nextUrl.searchParams.get("userId");
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
  const mock = req.nextUrl.searchParams.get("mock") === "1";
  const redirect = req.nextUrl.searchParams.get("redirect") === "1";
  const redirectPath = sanitizeRedirectPath(req.nextUrl.searchParams.get("redirectPath"));

  if (!mock) {
    const missing = missingEnv(required);
    if (missing.length) {
      return jsonError("LINKEDIN_OAUTH_CONFIG_MISSING", "LinkedIn OAuth is not configured", 503, { missing });
    }

    const clientId = process.env.LINKEDIN_CLIENT_ID as string;
    const redirectUri = resolveRedirectUri(req, process.env.LINKEDIN_REDIRECT_URI, "/api/auth/linkedin/callback");
    const state = Buffer.from(JSON.stringify({ userId, ts: Date.now(), redirect, redirectPath })).toString("base64url");
    const scope = process.env.LINKEDIN_OAUTH_SCOPE?.trim() || "r_liteprofile r_emailaddress w_member_social";

    const authorizeUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("client_id", clientId);
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("scope", scope);
    authorizeUrl.searchParams.set("state", state);

    return NextResponse.redirect(authorizeUrl);
  }

  const callback = new URL("/api/auth/linkedin/callback", req.nextUrl.origin);
  callback.searchParams.set("code", "mock_linkedin_code");
  callback.searchParams.set(
    "state",
    Buffer.from(JSON.stringify({ userId, mock: true, redirect, redirectPath })).toString("base64url"),
  );
  if (redirect) {
    callback.searchParams.set("redirect", "1");
  }
  return NextResponse.redirect(callback);
}
