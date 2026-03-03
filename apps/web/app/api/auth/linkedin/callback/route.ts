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
  const fallback = `${req.nextUrl.origin}/api/auth/linkedin/callback`;
  const configured = process.env.LINKEDIN_REDIRECT_URI;
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
    await runtimeMarkOAuthFailure(userId, "linkedin_profile", "LINKEDIN_OAUTH_DENIED");
    if (shouldRedirect) {
      return NextResponse.redirect(new URL("/dashboard/social?oauth=linkedin_denied", req.nextUrl.origin));
    }
    return jsonError("LINKEDIN_OAUTH_DENIED", "LinkedIn OAuth was denied", 401);
  }

  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    await runtimeMarkOAuthFailure(userId, "linkedin_profile", "LINKEDIN_OAUTH_CODE_MISSING");
    return jsonError("LINKEDIN_OAUTH_CODE_MISSING", "LinkedIn callback missing authorization code", 400);
  }

  let accountLabel = "LinkedIn Profile";
  if (!state?.mock) {
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      await runtimeMarkOAuthFailure(userId, "linkedin_profile", "LINKEDIN_OAUTH_CONFIG_MISSING");
      return jsonError("LINKEDIN_OAUTH_CONFIG_MISSING", "LinkedIn OAuth is not configured", 503, {
        missing: [
          !clientId ? "LINKEDIN_CLIENT_ID" : null,
          !clientSecret ? "LINKEDIN_CLIENT_SECRET" : null,
        ].filter(Boolean),
      });
    }

    const redirectUri = resolveRedirectUri(req);
    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      await runtimeMarkOAuthFailure(userId, "linkedin_profile", "LINKEDIN_TOKEN_EXCHANGE_FAILED");
      return jsonError("LINKEDIN_TOKEN_EXCHANGE_FAILED", "LinkedIn token exchange failed", 502, {
        response: text.slice(0, 300),
      });
    }

    const tokenPayload = (await tokenRes.json()) as { access_token?: string };
    const accessToken = tokenPayload.access_token;
    if (!accessToken) {
      await runtimeMarkOAuthFailure(userId, "linkedin_profile", "LINKEDIN_TOKEN_MISSING");
      return jsonError("LINKEDIN_TOKEN_MISSING", "LinkedIn token response missing access token", 502);
    }

    try {
      const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });
      if (profileRes.ok) {
        const info = (await profileRes.json()) as { name?: string; email?: string };
        accountLabel = info.name?.trim() || info.email?.trim() || accountLabel;
      }
    } catch {
      // Non-blocking label enrichment.
    }
  }

  const profileConnection = await runtimeConnectOAuth(userId, "linkedin_profile", accountLabel);
  const postConnection = await runtimeConnectOAuth(userId, "linkedin", "LinkedIn Posting");

  if (shouldRedirect) {
    return NextResponse.redirect(new URL("/dashboard/social?oauth=linkedin_connected", req.nextUrl.origin));
  }

  return jsonOk({
    status: "connected",
    profileConnection,
    postConnection,
  });
}
