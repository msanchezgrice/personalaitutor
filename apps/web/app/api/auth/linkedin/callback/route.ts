import { jsonError, jsonOk, runtimeConnectOAuth, runtimeMarkOAuthFailure, runtimeUpdateProfile } from "@/lib/runtime";
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
  const configured = process.env.LINKEDIN_REDIRECT_URI;
  const fromAppBase = appBaseUrl ? new URL("/api/auth/linkedin/callback", appBaseUrl).toString() : null;

  if (!configured || !configured.trim()) {
    return fromAppBase ?? fallback;
  }
  try {
    const parsed = new URL(configured.trim());
    if (appBaseUrl && parsed.host !== appBaseUrl.host) {
      return fromAppBase ?? fallback;
    }
    return parsed.toString();
  } catch {
    return fromAppBase ?? fallback;
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
  const state = parseState(req.nextUrl.searchParams.get("state"));
  const userId = req.headers.get("x-user-id") ?? state?.userId ?? null;
  const shouldRedirect = req.nextUrl.searchParams.get("redirect") === "1" || state?.redirect;

  if (!userId) {
    if (shouldRedirect) {
      return NextResponse.redirect(new URL("/dashboard/social?oauth=linkedin_denied", req.nextUrl.origin));
    }
    return jsonError("UNAUTHENTICATED", "Sign in required", 401);
  }

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
  let pictureUrl: string | null = null;
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

  if (pictureUrl) {
    try {
      await runtimeUpdateProfile(userId, { avatarUrl: pictureUrl });
    } catch {
      // Non-blocking avatar enrichment.
    }
  }

  if (shouldRedirect) {
    return NextResponse.redirect(new URL("/dashboard/social?oauth=linkedin_connected", req.nextUrl.origin));
  }

  return jsonOk({
    status: "connected",
    profileConnection,
    postConnection,
  });
}
