import { jsonError, jsonOk, runtimeConnectOAuth, runtimeMarkOAuthFailure, runtimeUpdateProfile } from "@/lib/runtime";
import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { verifyOAuthStateToken } from "@/lib/oauth-state";

function sanitizeRedirectPath(path: string | null | undefined) {
  if (!path || !path.trim()) return null;
  const value = path.trim();
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  if (value.length > 400) return null;
  return value;
}

function allowMockOAuth() {
  const explicit = process.env.ALLOW_MOCK_OAUTH?.trim().toLowerCase();
  if (explicit === "1" || explicit === "true") return true;
  if (explicit === "0" || explicit === "false") return false;
  return process.env.NODE_ENV !== "production";
}

function buildRedirectTarget(req: NextRequest, status: "linkedin_connected" | "linkedin_denied", redirectPath?: string | null) {
  const fallback = new URL(`/dashboard/social?oauth=${status}`, req.nextUrl.origin);
  const safe = sanitizeRedirectPath(redirectPath);
  if (!safe) return fallback;

  const target = new URL(safe, req.nextUrl.origin);
  target.searchParams.set("oauth", status);
  return target;
}

function resolveRedirectUri(req: NextRequest) {
  const fallback = `${req.nextUrl.origin}/api/auth/linkedin/callback`;
  const configured = process.env.LINKEDIN_REDIRECT_URI;
  if (!configured || !configured.trim()) return fallback;
  try {
    return new URL(configured.trim()).toString();
  } catch {
    return fallback;
  }
}

function pickLegacyPictureUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const profilePicture = (payload as { profilePicture?: unknown }).profilePicture;
  if (!profilePicture || typeof profilePicture !== "object") return null;
  const displayImage = (profilePicture as { "displayImage~"?: unknown })["displayImage~"];
  if (!displayImage || typeof displayImage !== "object") return null;
  const elements = (displayImage as { elements?: unknown }).elements;
  if (!Array.isArray(elements) || !elements.length) return null;
  const last = elements[elements.length - 1] as { identifiers?: Array<{ identifier?: string }> };
  const identifier = last?.identifiers?.[0]?.identifier;
  return typeof identifier === "string" && identifier.trim() ? identifier.trim() : null;
}

export async function GET(req: NextRequest) {
  const error = req.nextUrl.searchParams.get("error");
  const state = verifyOAuthStateToken<{
    userId?: string;
    redirect?: boolean;
    mock?: boolean;
    redirectPath?: string | null;
  }>(req.nextUrl.searchParams.get("state"), "linkedin");
  if (!state) {
    return jsonError("LINKEDIN_OAUTH_STATE_INVALID", "LinkedIn callback state is invalid or expired", 400);
  }
  const authUserId = await getAuthUserId(req);
  const userId = authUserId ?? (typeof state.data.userId === "string" ? state.data.userId : null);
  const redirectPath = sanitizeRedirectPath(state.data.redirectPath);
  const shouldRedirect = req.nextUrl.searchParams.get("redirect") === "1" || Boolean(state.data.redirect) || Boolean(redirectPath);
  const mockFlow = Boolean(state.data.mock) && allowMockOAuth();

  if (!userId) {
    if (shouldRedirect) {
      return NextResponse.redirect(buildRedirectTarget(req, "linkedin_denied", redirectPath));
    }
    return jsonError("UNAUTHENTICATED", "Sign in required", 401);
  }

  if (state.data.mock && !mockFlow) {
    await runtimeMarkOAuthFailure(userId, "linkedin_profile", "MOCK_OAUTH_DISABLED");
    if (shouldRedirect) {
      return NextResponse.redirect(buildRedirectTarget(req, "linkedin_denied", redirectPath));
    }
    return jsonError("MOCK_OAUTH_DISABLED", "Mock OAuth is disabled", 403);
  }

  if (error) {
    await runtimeMarkOAuthFailure(userId, "linkedin_profile", "LINKEDIN_OAUTH_DENIED");
    if (shouldRedirect) {
      return NextResponse.redirect(buildRedirectTarget(req, "linkedin_denied", redirectPath));
    }
    return jsonError("LINKEDIN_OAUTH_DENIED", "LinkedIn OAuth was denied", 401);
  }

  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    await runtimeMarkOAuthFailure(userId, "linkedin_profile", "LINKEDIN_OAUTH_CODE_MISSING");
    return jsonError("LINKEDIN_OAUTH_CODE_MISSING", "LinkedIn callback missing authorization code", 400);
  }

  let accountLabel = "LinkedIn Profile";
  let pictureUrl: string | null = null;
  if (!mockFlow) {
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
        const info = (await profileRes.json()) as { name?: string; email?: string; picture?: string };
        accountLabel = info.name?.trim() || info.email?.trim() || accountLabel;
        if (typeof info.picture === "string" && info.picture.trim()) {
          pictureUrl = info.picture.trim();
        }
      } else {
        // Compatibility path for classic LinkedIn scopes (r_liteprofile/r_emailaddress).
        const meRes = await fetch(
          "https://api.linkedin.com/v2/me?projection=(id,localizedFirstName,localizedLastName,profilePicture(displayImage~:playableStreams))",
          { headers: { authorization: `Bearer ${accessToken}` } },
        );
        if (meRes.ok) {
          const me = (await meRes.json()) as {
            localizedFirstName?: string;
            localizedLastName?: string;
            profilePicture?: unknown;
          };
          const fullName = `${me.localizedFirstName ?? ""} ${me.localizedLastName ?? ""}`.trim();
          accountLabel = fullName || accountLabel;
          pictureUrl = pickLegacyPictureUrl(me) ?? pictureUrl;
        }

        const emailRes = await fetch(
          "https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))",
          { headers: { authorization: `Bearer ${accessToken}` } },
        );
        if (emailRes.ok) {
          const emailPayload = (await emailRes.json()) as {
            elements?: Array<{ "handle~"?: { emailAddress?: string } }>;
          };
          const email = emailPayload.elements?.[0]?.["handle~"]?.emailAddress?.trim();
          if (email && accountLabel === "LinkedIn Profile") {
            accountLabel = email;
          }
        }
      }
    } catch {
      // Non-blocking label enrichment.
    }
  }

  const profileConnection = await runtimeConnectOAuth(userId, "linkedin_profile", accountLabel);
  const postConnection = await runtimeConnectOAuth(userId, "linkedin", "LinkedIn Posting");

  const shouldApplyName =
    typeof accountLabel === "string" &&
    accountLabel.trim().length >= 2 &&
    accountLabel !== "LinkedIn Profile" &&
    !accountLabel.includes("@");

  if (pictureUrl || shouldApplyName) {
    try {
      await runtimeUpdateProfile(userId, {
        ...(pictureUrl ? { avatarUrl: pictureUrl } : {}),
        ...(shouldApplyName ? { name: accountLabel.trim() } : {}),
      });
    } catch {
      // Non-blocking profile enrichment.
    }
  }

  if (shouldRedirect) {
    return NextResponse.redirect(buildRedirectTarget(req, "linkedin_connected", redirectPath));
  }

  return jsonOk({
    status: "connected",
    profileConnection,
    postConnection,
  });
}
