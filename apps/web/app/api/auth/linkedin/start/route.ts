import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@aitutor/shared";
import { getUserId, missingEnv } from "@/lib/api";

const required = ["LINKEDIN_CLIENT_ID"];

function resolveRedirectUri(req: NextRequest, configured: string | undefined, fallbackPath: string) {
  const fallback = `${req.nextUrl.origin}${fallbackPath}`;
  if (!configured) return fallback;
  try {
    const parsed = new URL(configured);
    return parsed.toString();
  } catch {
    return fallback;
  }
}

export async function GET(req: NextRequest) {
  const userId = getUserId(req);
  const mock = req.nextUrl.searchParams.get("mock") === "1";
  const redirect = req.nextUrl.searchParams.get("redirect") === "1";

  if (!mock) {
    const missing = missingEnv(required);
    if (missing.length) {
      return jsonError("LINKEDIN_OAUTH_CONFIG_MISSING", "LinkedIn OAuth is not configured", 503, { missing });
    }

    const clientId = process.env.LINKEDIN_CLIENT_ID as string;
    const redirectUri = resolveRedirectUri(req, process.env.LINKEDIN_REDIRECT_URI, "/api/auth/linkedin/callback");
    const state = Buffer.from(JSON.stringify({ userId, ts: Date.now(), redirect })).toString("base64url");

    const authorizeUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("client_id", clientId);
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("scope", "r_liteprofile r_emailaddress w_member_social");
    authorizeUrl.searchParams.set("state", state);

    return NextResponse.redirect(authorizeUrl);
  }

  const callback = new URL("/api/auth/linkedin/callback", req.nextUrl.origin);
  callback.searchParams.set("code", "mock_linkedin_code");
  callback.searchParams.set(
    "state",
    Buffer.from(JSON.stringify({ userId, mock: true, redirect })).toString("base64url"),
  );
  if (redirect) {
    callback.searchParams.set("redirect", "1");
  }
  return NextResponse.redirect(callback);
}
